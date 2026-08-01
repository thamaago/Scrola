/**
 * scrobbleEngine.ts
 *
 * Menjembatani event now-playing (dari player internal maupun MediaSession app lain) ke:
 *  1. track.updateNowPlaying (best-effort, dipanggil begitu track baru terdeteksi)
 *  2. antrean scrobble di SQLite (scrobble_queue) — tahan force-close/crash
 *  3. track.scrobble/scrobbleBatch begitu ada koneksi & session tersedia, lalu dipindah ke
 *     scrobble_history setelah sukses
 *
 * Migrasi dari versi Preferences: fungsi publik (enqueueScrobble, flushQueue, notifyNowPlaying,
 * readHistory) sengaja dipertahankan namanya supaya hook di lapisan UI tidak perlu berubah.
 */
import { loadSession } from './secureStore';
import { scrobbleBatch, updateNowPlaying, type TrackInfo } from './lastfm';
import { parseScrobbleResponse, isScrobbleEligible, partitionByAttempts, MAX_SCROBBLE_BATCH } from './scrobbleLogic';
import { flushPendingNotes } from './pendingNotes';
import { diag } from './diagnostics';
import {
  addToQueue,
  getQueueBatch,
  removeFromQueue,
  markQueueAttemptFailed,
  addHistoryBatch,
  getHistory,
  type HistoryRow,
} from './db/queries';

// Setelah gagal sebanyak ini, berhenti mencoba ulang — track kemungkinan besar memang
// ditolak Last.fm secara permanen (nama tidak valid, dll), bukan gangguan jaringan sementara.
// Tanpa batas ini, satu baris "beracun" bisa terus menempati slot batch selamanya.
const MAX_ATTEMPTS = 8;

// Mutex sederhana: mencegah dua flushQueue() berjalan bersamaan (mis. dipanggil dari
// App.tsx saat mount DAN dari enqueueScrobble di saat yang hampir sama). Tanpa ini,
// dua panggilan bisa mengambil baris antrean yang sama, mengirim dua kali ke Last.fm,
// dan menduplikasi entri di scrobble_history.
let isFlushing = false;

export async function enqueueScrobble(track: TrackInfo, sourcePackage?: string) {
  await enqueueScrobbleNoFlush(track, sourcePackage);
  await flushQueue(sourcePackage);
}

// Sama seperti enqueueScrobble TAPI tanpa flush di akhir. Dipakai jalur DRAIN backlog
// (drainAndFlushNative): enqueue semua track dulu, lalu SATU flushQueue di akhir — supaya
// getQueueBatch(MAX_SCROBBLE_BATCH) benar-benar menumpuk & mengirim per batch ≤50, bukan
// satu panggilan Last.fm per track (yang untuk backlog ratusan track jadi ratusan round-trip).
export async function enqueueScrobbleNoFlush(track: TrackInfo, sourcePackage?: string) {
  const timestamp = track.timestamp ?? Math.floor(Date.now() / 1000);
  diag(`enqueue MASUK: ${track.artist} - ${track.track} (src=${sourcePackage ?? '?'})`);
  try {
    await addToQueue({ ...track, timestamp });
    diag(`addToQueue OK`);
  } catch (e) {
    diag(`addToQueue GAGAL: ${(e as Error).message}`);
    throw e;
  }
}

export async function flushQueue(sourcePackage?: string) {
  if (isFlushing) return;
  isFlushing = true;
  try {
    await flushQueueOnce(sourcePackage);
  } finally {
    isFlushing = false;
  }
}

async function flushQueueOnce(sourcePackage?: string) {
  let session: Awaited<ReturnType<typeof loadSession>>;
  try {
    session = await loadSession();
  } catch (e) {
    console.warn('Gagal membaca session tersimpan, tunda pengiriman antrean:', e);
    diag(`flush BERHENTI: gagal baca sesi - ${(e as Error).message}`);
    return;
  }
  if (!session) {
    diag(`flush BERHENTI: sesi NULL (belum login?) — scrobble tertahan di antrean`);
    return; // belum login, biarkan di antrean sampai user connect
  }
  // Antrean kosong: flush ini no-op. JANGAN tulis apa pun ke Log Peristiwa — timer 20 dtk yang
  // menyala terus (App.tsx) akan memenuhi ring-buffer 100 baris dengan baris "mulai kirim batch"
  // kosong dan menggusur baris diagnostik yang berguna. Cek murah dulu sebelum log.
  const pending = await getQueueBatch(1);
  if (pending.length === 0) return;
  diag(`flush: sesi OK, mulai kirim batch`);

  // Loop alih-alih rekursi: antrean offline yang menumpuk lama bisa berisi ratusan track,
  // dan memanggil flushQueueOnce secara rekursif per-batch berisiko menumpuk call stack dalam.
  // Loop menjaga penggunaan stack tetap datar berapa pun panjang antrean.
  while (true) {
    const fullBatch = await getQueueBatch(MAX_SCROBBLE_BATCH);
    if (fullBatch.length === 0) return;

    // Pisahkan baris beracun (lewat batas percobaan) dari yang masih layak — logika murni,
    // diuji di scrobbleBatching.test.ts. Yang beracun dibuang supaya tak menyumbat slot batch.
    const { toSend: batch, toDrop: exhausted } = partitionByAttempts(fullBatch, MAX_ATTEMPTS);
    if (exhausted.length > 0) {
      console.warn(
        `Membuang ${exhausted.length} scrobble dari antrean setelah ${MAX_ATTEMPTS}x gagal:`,
        exhausted.map((r) => `${r.artist} - ${r.track}`)
      );
      await removeFromQueue(exhausted.map((r) => r.id));
    }
    if (batch.length === 0) {
      // Semua yang tersisa di batch ini exhausted & sudah dibuang. Cek apakah masih ada baris
      // lain di antrean (yang belum exhausted) sebelum menyimpulkan antrean kosong.
      const stillRemaining = await getQueueBatch(1);
      if (stillRemaining.length === 0) return;
      continue;
    }

    try {
      diag(`scrobbleBatch KIRIM: ${batch.length} track ke Last.fm`);
      const response = await scrobbleBatch(
        session.sk,
        batch.map((row) => ({
          artist: row.artist,
          track: row.track,
          album: row.album,
          albumArtist: row.albumArtist,
          duration: row.duration,
          timestamp: row.timestamp,
        }))
      );
      diag(`scrobbleBatch BALASAN diterima`);

      const { ignoredIndexes, retryableIndexes } = parseScrobbleResponse(response, batch.length);
      diag(
        `Last.fm terima ${batch.length - ignoredIndexes.size}/${batch.length}, ditolak ${ignoredIndexes.size}` +
          (retryableIndexes.size > 0 ? ` (coba-ulang ${retryableIndexes.size}: batas harian)` : '')
      );

      // PENTING soal urutan & duplikasi: kita HAPUS dari antrean DULU, baru tulis ke history.
      // Kalau removeFromQueue berhasil tapi addHistoryBatch gagal, akibatnya "kehilangan" entri
      // history (track hilang dari riwayat) — tidak enak, tapi TIDAK menyebabkan scrobble ganda
      // ke Last.fm. Sebaliknya (history dulu, baru hapus antrean) berisiko lebih buruk: kalau
      // hapus antrean gagal setelah history tersimpan, track tetap di antrean dan akan
      // di-scrobble ULANG ke Last.fm pada flush berikutnya — duplikat yang terlihat user di
      // profil Last.fm mereka. Dari dua kegagalan parsial, kehilangan baris history lokal jauh
      // lebih ringan daripada mengotori data publik user, jadi urutan ini yang dipilih.
      //
      // Hapus HANYA yang diterima + yang ditolak PERMANEN (kode 1-4). Yang transien (kode 5 =
      // batas scrobble harian) JANGAN dihapus — tahan di antrean untuk dicoba ulang nanti.
      const toRemove = batch.filter((_, i) => !retryableIndexes.has(i));
      await removeFromQueue(toRemove.map((row) => row.id));

      const acceptedRows = batch.filter((_, i) => !ignoredIndexes.has(i));
      if (acceptedRows.length > 0) {
        try {
          await addHistoryBatch(
            acceptedRows.map((row) => ({
              artist: row.artist,
              track: row.track,
              album: row.album,
              albumArtist: row.albumArtist,
              duration: row.duration,
              timestamp: row.timestamp,
              sourcePackage,
            }))
          );
          diag(`addHistoryBatch OK: ${acceptedRows.length} baris ditulis ke Riwayat`);
          // Baris riwayat baru saja ada — inilah saat yang PASTI untuk menempelkan catatan yang
          // ditulis pengguna sebelum lagunya tercatat. Deterministik, bukan menebak lewat timer.
          try {
            await flushPendingNotes();
          } catch (e) {
            console.warn('Gagal menerapkan catatan tertunda setelah menulis riwayat:', e);
          }
        } catch (e) {
          // Track sudah ter-scrobble sukses ke Last.fm & sudah dihapus dari antrean; kegagalan
          // menyimpan salinan history lokal tidak fatal (riwayat di app kurang lengkap, tapi
          // scrobble-nya sendiri sudah tercatat di Last.fm). Jangan lempar — lanjutkan.
          console.warn('Scrobble terkirim tapi gagal menyimpan ke history lokal:', e);
          diag(`addHistoryBatch GAGAL: ${(e as Error).message} — INI kenapa Riwayat kosong!`);
        }
      }
      const permanentIgnored = Array.from(ignoredIndexes).filter((i) => !retryableIndexes.has(i));
      if (permanentIgnored.length > 0) {
        console.warn(
          `Last.fm mengabaikan ${permanentIgnored.length} track (ditolak permanen, tidak dicoba ulang):`,
          permanentIgnored.map((i) => `${batch[i].artist} - ${batch[i].track}`)
        );
      }
      if (retryableIndexes.size > 0) {
        // Batas scrobble harian Last.fm — sementara. Tandai gagal (attempts++, jadi tetap terbatas
        // oleh MAX_ATTEMPTS kalau limit bertahan lama) dan HENTIKAN flush ini: batch berikutnya
        // pasti kena limit yang sama, jadi tak ada gunanya lanjut menguras & menghantam Last.fm.
        // Sisa antrean (termasuk baris ini) dicoba lagi pada flush berikutnya.
        const retryRows = batch.filter((_, i) => retryableIndexes.has(i));
        await markQueueAttemptFailed(
          retryRows.map((row) => row.id),
          'Ditunda: batas scrobble harian Last.fm (kode 5)'
        );
        diag(`Ditahan untuk coba-ulang: ${retryRows.length} track (batas harian Last.fm) — flush dihentikan`);
        return;
      }
      // Lanjut ke iterasi berikutnya untuk memproses sisa antrean (kalau ada).
    } catch (e) {
      // Kegagalan di level request (network/timeout/4xx global) — tandai gagal & coba lagi nanti.
      // Keluar dari loop: kalau request gagal (mis. jaringan putus), batch berikutnya kemungkinan
      // besar juga gagal, jadi tidak ada gunanya terus mencoba sekarang — biarkan flush berikutnya
      // (saat app resume / scrobble baru masuk) yang mencoba lagi.
      await markQueueAttemptFailed(
        batch.map((row) => row.id),
        (e as Error).message
      );
      console.warn('Gagal mengirim scrobble, tetap di antrean untuk dicoba lagi:', e);
      return;
    }
  }
}

export async function notifyNowPlaying(track: TrackInfo) {
  let session: Awaited<ReturnType<typeof loadSession>>;
  try {
    session = await loadSession();
  } catch (e) {
    console.warn('Gagal membaca session tersimpan (tidak fatal):', e);
    return;
  }
  if (!session) return;
  try {
    await updateNowPlaying(session.sk, track);
  } catch (e) {
    console.warn('Gagal update now playing (tidak fatal):', e);
  }
}

export async function readHistory(limit = 100): Promise<HistoryRow[]> {
  return getHistory(limit);
}

/** Dipanggil dari listener posisi playback berkala untuk cek eligibility. */
export function checkEligibility(durationSec: number, playedSec: number) {
  return isScrobbleEligible(durationSec, playedSec);
}

// Guard anti-scrobble-ganda, dipegang di level modul supaya konsisten lintas pemanggil (player
// internal via App.tsx, dan deteksi eksternal via useNowPlaying). Kunci = "artist::track".
const scrobbledTrackKeys = new Set<string>();

export interface MaybeScrobbleInput {
  artist: string;
  track: string;
  album?: string;
  durationSec: number;
  positionSec: number;
  startedAtSec: number;
  sourcePackage: string;
}

/**
 * Pengecekan + enqueue scrobble TERPUSAT untuk player internal MAUPUN deteksi eksternal.
 *
 * KENAPA TERPUSAT: sebelumnya jalur scrobble hanya ada di useNowPlaying yang mendengarkan event
 * plugin NowPlaying (deteksi eksternal). Player internal mengirim event lewat plugin Player yang
 * BERBEDA (playerPositionChanged) dan tidak pernah tersambung ke sini — sehingga lagu yang diputar
 * di dalam Scrola sendiri TIDAK PERNAH tercatat. Itu melanggar prinsip inti "satu pipeline" yang
 * tercatat di CLAUDE.md. Fungsi ini menyatukan keduanya: siapa pun sumbernya, aturan eligibility,
 * guard anti-dobel, dan enqueue-nya identik.
 *
 * @returns true kalau baru saja di-enqueue, false kalau belum memenuhi syarat atau sudah tercatat.
 */
export async function maybeScrobble(input: MaybeScrobbleInput): Promise<boolean> {
  if (!input.artist || !input.track) return false;
  if (!isScrobbleEligible(input.durationSec, input.positionSec)) return false;

  const key = `${input.artist}::${input.track}`;
  if (scrobbledTrackKeys.has(key)) return false;

  // Set SEBELUM await supaya event beruntun (tiap detik) tidak memicu enqueue berkali-kali untuk
  // track yang sama sebelum yang pertama selesai.
  scrobbledTrackKeys.add(key);

  try {
    await enqueueScrobble(
      {
        artist: input.artist,
        track: input.track,
        album: input.album,
        duration: input.durationSec,
        timestamp: input.startedAtSec, // waktu MULAI, sesuai spek Last.fm
      },
      input.sourcePackage
    );
    return true;
  } catch (e) {
    // Enqueue gagal (mis. DB belum siap) — lepas guard supaya percobaan berikutnya bisa mencoba
    // lagi, JANGAN biarkan track hilang diam-diam.
    scrobbledTrackKeys.delete(key);
    console.warn('maybeScrobble: gagal enqueue, akan dicoba lagi:', e);
    return false;
  }
}

/** Lupakan penanda "sudah discrobble" untuk track tertentu — dipanggil saat track BERGANTI supaya
 *  kalau lagu yang sama diputar lagi nanti, ia bisa tercatat lagi. */
export function resetScrobbleGuard(artist?: string, track?: string) {
  if (artist && track) {
    scrobbledTrackKeys.delete(`${artist}::${track}`);
  } else {
    scrobbledTrackKeys.clear();
  }
}
