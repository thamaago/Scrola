import { useEffect, useRef, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { notifyNowPlaying, enqueueScrobbleNoFlush, flushQueue } from '../lib/scrobbleEngine';
import { shouldScrobbleSource } from '../lib/scrobbleLogic';
import { diag } from '../lib/diagnostics';
import {
  createTracker,
  applyEvent,
  playedMsUntil,
  type PlaybackTracker,
} from '../lib/playbackTimer';
import { getExternalScrobbleEnabled, getIgnoredSources } from '../lib/preferences';
import { cleanTrackMetadata } from '../lib/cleanTrackMetadata';
import { applyCorrection } from '../lib/corrections';
import { loadCorrections } from '../lib/correctionsStore';

/** Satu scrobble yang ditangkap di latar oleh native, menunggu dikirim ke Last.fm. */
export interface NativePendingScrobble {
  artist: string;
  track: string;
  album: string;
  durationSec: number;
  timestamp: number; // unix seconds (waktu mulai track)
  sourcePackage: string;
}

export interface NowPlayingPluginInterface {
  openNotificationAccessSettings(): Promise<void>;
  isNotificationAccessGranted(): Promise<{ granted: boolean }>;
  /** Diagnosis berlapis: izin vs service hidup vs data mengalir. */
  getListenerDiagnostics(): Promise<{
    granted: boolean;
    connected: boolean;
    connectedAtMs: number;
    lastEventAtMs: number;
    lastEventPackage: string;
    totalEvents: number;
    activeSessions: number;
    androidSdk: number;
    manufacturer: string;
  }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  /** Menyerap scrobble yang ditangkap di latar oleh native (Opsi 2), lalu mengosongkan store. */
  drainPendingScrobbles(): Promise<{ scrobbles: NativePendingScrobble[] }>;
  addListener(
    eventName: 'nowPlayingChanged' | 'playbackStateChanged',
    listener: (data: any) => void
  ): Promise<{ remove: () => void }>;
}

export const NowPlaying = registerPlugin<NowPlayingPluginInterface>('NowPlaying');

/**
 * Menyerap scrobble yang ditangkap NATIVE di latar (Opsi 2), memfilter preferensi "scrobble dari
 * app lain", lalu memasukkannya ke antrean + kirim ke Last.fm. Dipanggil dari App saat app aktif
 * (resume + interval). Aman dipanggil di web preview (plugin tak ada -> 0). Mengembalikan jumlah
 * yang diproses.
 */
export async function drainAndFlushNative(): Promise<number> {
  let drained: NativePendingScrobble[] = [];
  try {
    const res = await NowPlaying.drainPendingScrobbles();
    drained = res?.scrobbles ?? [];
  } catch {
    return 0; // plugin native tak tersedia (web) atau gagal — abaikan
  }
  if (drained.length === 0) return 0;

  const externalAllowed = await getExternalScrobbleEnabled().catch(() => true);
  const ignoredSources = await getIgnoredSources().catch(() => [] as string[]);
  const rules = await loadCorrections();
  let done = 0;
  for (const s of drained) {
    // Hormati preferensi: master toggle + daftar sumber diabaikan (mis. app menonton video).
    if (!shouldScrobbleSource(s.sourcePackage, externalAllowed, ignoredSources)) continue;
    try {
      // 1) Rapikan metadata (judul video YouTube -> artis/track wajar). Konservatif: Spotify dsb.
      //    tak disentuh. 2) Terapkan KOREKSI yang pernah kamu ajarkan lewat edit Riwayat.
      const cleaned = cleanTrackMetadata({
        artist: s.artist,
        track: s.track,
        sourcePackage: s.sourcePackage,
      });
      const finalMeta = applyCorrection(cleaned, rules);
      // Drain backlog: enqueue TANPA flush per track. Satu flushQueue di akhir loop (di bawah)
      // membiarkan getQueueBatch(MAX_SCROBBLE_BATCH) mengirim per batch ≤50 — bukan 1 API call/track.
      await enqueueScrobbleNoFlush(
        {
          artist: finalMeta.artist,
          track: finalMeta.track,
          album: s.album || undefined,
          duration: s.durationSec,
          timestamp: s.timestamp,
        },
        s.sourcePackage
      );
      done++;
    } catch (e) {
      console.warn('Gagal memproses scrobble latar:', e);
    }
  }
  // Satu flush untuk seluruh backlog yang barusan di-enqueue.
  if (done > 0) await flushQueue();
  return done;
}

// Konstanta dari android.media.session.PlaybackState
const STATE_PLAYING = 3;

export interface NowPlayingState {
  packageName: string;
  artist: string;
  title: string;
  album?: string;
  durationSec: number;
  positionSec: number;
  /**
   * Waktu putar (bukan posisi) yang sudah terkumpul untuk track ini, dalam ms. Sumber gerak bar
   * "Sedang Diamati": `positionSec` dari MediaSession mandek di antara event, jadi bar dulu ikut
   * beku. Nilai ini di-tick tiap detik dari tracker waktu-berlalu (lihat ticker di bawah).
   */
  playedMs: number;
  isPlaying: boolean;
}

/**
 * useNowPlayingListener
 *
 * Menyambungkan event native (dari ScrolaNotificationListener via NowPlayingPlugin) ke state
 * React, sekaligus menjalankan logika scrobble:
 *  - Saat track baru terdeteksi -> kirim track.updateNowPlaying (best-effort, tidak fatal jika gagal)
 *  - Melacak posisi playback -> begitu eligible (>=50% durasi atau >=4 menit) -> enqueue scrobble
 *    sekali saja per track (dijaga lewat scrobbledRef supaya tidak dobel saat re-render)
 */
export function useNowPlayingListener() {
  const [current, setCurrent] = useState<NowPlayingState | null>(null);
  const metadataRef = useRef<{
    artist: string;
    title: string;
    album?: string;
    durationSec: number;
    startedAt: number; // unix seconds — waktu track ini pertama terdeteksi, dipakai sebagai timestamp scrobble
  } | null>(null);
  const scrobbledTrackKeyRef = useRef<string | null>(null);
  // Tracker waktu-berlalu (menggantikan ketergantungan pada position MediaSession yang mandek).
  const trackerRef = useRef<PlaybackTracker>(createTracker());
  // Timer terjadwal untuk memicu scrobble saat ambang waktu tercapai.
  const scrobbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let metaHandle: { remove: () => void } | undefined;
    let stateHandle: { remove: () => void } | undefined;

    NowPlaying.addListener('nowPlayingChanged', (data) => {
      const trackKey = `${data.artist ?? ''}::${data.title ?? ''}`;
      const isSameTrack = trackKey === (metadataRef.current ? `${metadataRef.current.artist}::${metadataRef.current.title}` : null);

      const meta = {
        artist: data.artist ?? '',
        title: data.title ?? '',
        album: data.album || undefined,
        durationSec: Math.floor((data.durationMs ?? 0) / 1000),
        // Track baru -> catat waktu sekarang sebagai perkiraan waktu mulai (dipakai sebagai
        // timestamp scrobble, BUKAN waktu saat syarat eligibility terpenuhi beberapa menit
        // kemudian). Kalau event ini cuma refire metadata untuk track yang sama, pertahankan
        // startedAt yang lama supaya timestamp tidak bergeser maju tiap kali metadata diupdate.
        startedAt: isSameTrack && metadataRef.current ? metadataRef.current.startedAt : Math.floor(Date.now() / 1000),
      };
      metadataRef.current = meta;
      // Hanya reset flag "sudah discrobble" kalau memang track-nya benar-benar berganti —
      // beberapa app musik refire metadata (mis. artwork baru selesai dimuat) untuk track
      // yang sama, dan reset flag di sini akan menyebabkan scrobble ganda untuk track yang
      // sama persis.
      if (!isSameTrack) {
        scrobbledTrackKeyRef.current = null;
        // Diagnostik lintas-pemutar: cetak sumber + durasi yang BENAR-BENAR terbaca dari
        // MediaSession-nya. Ini yang menyingkap kenapa satu pemutar tercatat dan lain tidak —
        // mis. durasi 0 (tak dilaporkan) langsung terlihat di sini, per paket app.
        diag(
          `sumber: ${data.packageName || '?'} — ${meta.artist || '(tanpa artis)'} · ${meta.title || '(tanpa judul)'} · durasi ${meta.durationSec}s`
        );
      }

      setCurrent((prev) => ({
        packageName: data.packageName,
        artist: meta.artist,
        title: meta.title,
        album: meta.album,
        durationSec: meta.durationSec,
        positionSec: isSameTrack ? prev?.positionSec ?? 0 : 0,
        playedMs: isSameTrack ? prev?.playedMs ?? 0 : 0,
        isPlaying: prev?.isPlaying ?? false,
      }));

      if (meta.artist && meta.title) {
        // Hormati preferensi JUGA untuk update now-playing — master toggle + daftar sumber
        // diabaikan. Tanpa guard ini, sumber yang di-mute tetap "menyiarkan" apa yang diputar ke
        // profil Last.fm (track.updateNowPlaying). Mute harus berarti senyap total untuk sumber itu.
        Promise.all([
          getExternalScrobbleEnabled().catch(() => true),
          getIgnoredSources().catch(() => [] as string[]),
        ])
          .then(([allowed, ignored]) => {
            if (shouldScrobbleSource(data.packageName, allowed, ignored)) {
              notifyNowPlaying({ artist: meta.artist, track: meta.title, album: meta.album, duration: meta.durationSec });
            }
          })
          .catch(() => {
            // Gagal membaca preferensi: pilih diam (tidak mengirim) — lebih aman salah ke arah
            // privasi daripada menyiarkan sesuatu yang mungkin user minta untuk tidak dikirim.
          });
      }
    }).then((h) => (metaHandle = h)).catch((e) => {
      // Umumnya terjadi saat preview web (npm run dev) di mana plugin native tidak tersedia —
      // bukan error fatal, tapi jangan biarkan jadi unhandled promise rejection yang berisik.
      console.warn('NowPlaying.addListener(nowPlayingChanged) gagal didaftarkan:', e);
    });

    NowPlaying.addListener('playbackStateChanged', (data) => {
      const positionSec = Math.floor((data.positionMs ?? 0) / 1000);
      const isPlaying = data.state === STATE_PLAYING;

      setCurrent((prev) =>
        prev
          ? { ...prev, positionSec, isPlaying }
          : prev
      );

      const meta = metadataRef.current;
      if (!meta || !meta.artist || !meta.title) return;

      const trackKey = `${meta.artist}::${meta.title}`;
      const now = Date.now();

      // Perbarui tracker WAKTU BERLALU. Kita TIDAK memakai `positionSec` sebagai sinyal kelayakan
      // yang berjalan (position dari MediaSession mandek kalau lagu diputar lurus — lihat
      // playbackTimer.ts). TAPI kita meneruskan positionMs sebagai SEED awal: kalau lagu baru
      // terdeteksi di tengah pemutaran (mis. deteksi pemutar agak lambat), tracker mulai dari
      // posisi itu, bukan 0 — supaya scrobble tidak tertunda/terlewat. Seed dibatasi di applyEvent.
      trackerRef.current = applyEvent(
        trackerRef.current,
        { trackKey, isPlaying, durationSec: meta.durationSec, positionMs: data.positionMs ?? 0 },
        now
      );

      // Segerakan playedMs ke state begitu tracker diperbarui, supaya bar bereaksi langsung saat
      // play/pause/seek tanpa menunggu tick 1 detik berikutnya. Di antara event, ticker di bawah
      // yang menjaga bar tetap bergerak.
      const playedNow = playedMsUntil(trackerRef.current, now);
      setCurrent((prev) => (prev && prev.playedMs !== playedNow ? { ...prev, playedMs: playedNow } : prev));

      // KELAYAKAN + ENQUEUE kini ditangani NATIVE (ScrolaNotificationListener → PendingScrobbleStore)
      // agar scrobble tetap berjalan saat app di LATAR — WebView dibekukan sehingga timer JS mati
      // (lihat Opsi 2). Tracker JS di atas DIPERTAHANKAN hanya untuk menggerakkan bar "Sedang
      // Diamati"; ia tidak lagi men-scrobble. Hasil tangkapan native diserap lewat
      // drainAndFlushNative() saat app aktif (dipanggil dari App).
    }).then((h) => (stateHandle = h)).catch((e) => {
      console.warn('NowPlaying.addListener(playbackStateChanged) gagal didaftarkan:', e);
    });

    return () => {
      metaHandle?.remove();
      stateHandle?.remove();
      if (scrobbleTimerRef.current !== null) clearTimeout(scrobbleTimerRef.current);
    };
  }, []);

  // Ticker halus untuk bar "Sedang Diamati". `positionSec` dari MediaSession hanya di-update saat
  // event play/pause/seek, jadi kalau lagu diputar lurus bar dulu MEMBEKU (dan cuma "melompat"
  // saat Spotify sesekali memancarkan ulang state). Di sini kita render ulang tiap detik dari
  // tracker WAKTU-BERLALU — sumber yang sama dengan logika kelayakan scrobble — sehingga bar &
  // teks "tercatat dalam ..." bergerak mulus dan jujur mengikuti timer scrobble sebenarnya.
  //
  // Aman terhadap jeda: saat dijeda `playingSince` null, `playedMsUntil` mengembalikan nilai beku,
  // jadi bar berhenti sendiri tanpa perlu logika khusus. Kita hanya setCurrent kalau nilainya
  // BERUBAH, supaya tidak memicu render sia-sia saat idle/dijeda.
  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((prev) => {
        if (!prev) return prev;
        // Hanya laporkan played-time kalau tracker memang untuk track yang sedang ditampilkan —
        // mencegah sisa tracker dari track sebelumnya bocor ke kartu track baru.
        const curKey = `${prev.artist}::${prev.title}`;
        const t = trackerRef.current;
        const played = t.trackKey === curKey ? playedMsUntil(t, Date.now()) : 0;
        return prev.playedMs === played ? prev : { ...prev, playedMs: played };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return current;
}
