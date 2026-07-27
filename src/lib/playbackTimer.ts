import { scrobbleThresholdSec } from './scrobbleLogic';

/**
 * Ambang cadangan (detik) saat DURASI track TIDAK DILAPORKAN oleh sumber (durationSec <= 0).
 * Sebagian pemutar terkenal tidak selalu menaruh METADATA_KEY_DURATION di MediaSession (atau
 * menaruhnya terlambat). Tanpa durasi kita tak bisa menghitung "50% durasi", jadi kita pakai
 * aturan Last.fm yang lain: scrobble setelah track diputar >= 4 menit (mana yang lebih dulu).
 * Ini membuat deteksi tahan banting lintas pemutar, bukan diam-diam gagal.
 */
export const UNKNOWN_DURATION_FALLBACK_SEC = 240;

/**
 * Ambang scrobble dalam MS untuk sebuah durasi. Tiga kasus:
 *  - durasi tak dilaporkan (<= 0): pakai aturan 4 menit (UNKNOWN_DURATION_FALLBACK_SEC).
 *  - durasi valid tapi <= 30s: 0 (terlalu pendek — spek Last.fm melarang scrobble).
 *  - durasi > 30s: min(50% durasi, 240s).
 */
export function thresholdMsForDuration(durationSec: number): number {
  if (durationSec <= 0) return UNKNOWN_DURATION_FALLBACK_SEC * 1000;
  if (durationSec <= 30) return 0;
  return scrobbleThresholdSec(durationSec) * 1000;
}

/**
 * playbackTimer.ts — memutuskan kelayakan scrobble dari WAKTU BERLALU, bukan dari `position`
 * MediaSession.
 *
 * KENAPA INI ADA (temuan dari membandingkan dengan Pano Scrobbler):
 * Jalur lama membaca `PlaybackState.position` dan membandingkannya dengan ambang. Tapi `position`
 * hanya diperbarui saat callback `onPlaybackStateChanged` menyala — yaitu saat play/pause/seek,
 * BUKAN tiap detik. Kalau lagu diputar lurus tanpa disentuh, `position` mandek di nilai lama dan
 * ambang tidak pernah terlampaui, sehingga scrobble TIDAK PERNAH terpicu meski deteksi bekerja
 * sempurna (event metadata tetap masuk saat ganti lagu).
 *
 * Pano menyiasati ini dengan menghitung waktu putar sendiri memakai timer, bukan mempercayai
 * `position` (terlihat dari issue #570 mereka: bug-nya berbicara soal "menit ke-N dari instance
 * baru", bukan posisi lagu). Modul ini melakukan hal yang sama: saat sebuah track mulai diputar,
 * kita jadwalkan pengecekan setelah (ambang - sudah diputar) detik. Kalau track masih sama & masih
 * berjalan saat timer berbunyi, ia layak discrobble.
 *
 * Ini menangani jeda dengan benar: pause menghentikan akumulasi, resume melanjutkannya, jadi lagu
 * yang dijeda 10 menit lalu dilanjutkan tetap butuh total waktu putar yang sama.
 */

export interface PlaybackTracker {
  /** Kunci track aktif "artist::title", null kalau tidak ada. */
  trackKey: string | null;
  /** Total milidetik track ini sudah benar-benar diputar (tidak termasuk saat dijeda). */
  playedMs: number;
  /** Timestamp (ms) saat pemutaran terakhir dilanjutkan; null kalau sedang dijeda. */
  playingSince: number | null;
  /** Durasi track dalam detik (untuk menghitung ambang). */
  durationSec: number;
}

export function createTracker(): PlaybackTracker {
  return { trackKey: null, playedMs: 0, playingSince: null, durationSec: 0 };
}

/**
 * Total waktu putar sampai saat `now`, termasuk sesi berjalan yang belum ditutup.
 */
export function playedMsUntil(t: PlaybackTracker, now: number): number {
  if (t.playingSince === null) return t.playedMs;
  return t.playedMs + Math.max(0, now - t.playingSince);
}

/**
 * Ambang scrobble dalam MS untuk track ini. 0 kalau durasi tak valid (belum bisa dihitung).
 */
export function thresholdMs(t: PlaybackTracker): number {
  return thresholdMsForDuration(t.durationSec);
}

/**
 * Perbarui tracker berdasarkan event. Mengembalikan tracker BARU (murni, mudah dites).
 *
 * @param ev.trackKey  kunci track dari event
 * @param ev.isPlaying apakah sekarang sedang diputar
 * @param ev.durationSec durasi track
 * @param now waktu sekarang (ms)
 */
/**
 * Batasi seed posisi awal agar masuk akal: tak pernah melebihi durasi track (atau ambang fallback
 * 4 menit bila durasi tak diketahui), dan 0 bila posisi tak ada/negatif. Mencegah posisi bogus
 * memicu scrobble instan yang keliru.
 */
function clampSeedMs(positionMs: number | undefined, durationSec: number): number {
  if (!positionMs || positionMs <= 0) return 0;
  const maxMs = (durationSec > 0 ? durationSec : UNKNOWN_DURATION_FALLBACK_SEC) * 1000;
  return Math.min(positionMs, maxMs);
}

export function applyEvent(
  t: PlaybackTracker,
  ev: { trackKey: string; isPlaying: boolean; durationSec: number; positionMs?: number },
  now: number
): PlaybackTracker {
  // Track berganti -> mulai tracker baru. SEED dengan posisi saat ini kalau lagu terdeteksi di
  // TENGAH pemutaran: tanpa seed, lagu yang baru terdeteksi (mis. karena deteksi pemutar agak
  // lambat) dihitung dari 0 sehingga scrobble-nya tertunda — atau terlewat sama sekali kalau lagu
  // keburu habis sebelum ambang tercapai. Seed dibatasi clampSeedMs agar konservatif.
  if (ev.trackKey !== t.trackKey) {
    return {
      trackKey: ev.trackKey,
      playedMs: clampSeedMs(ev.positionMs, ev.durationSec),
      playingSince: ev.isPlaying ? now : null,
      durationSec: ev.durationSec,
    };
  }

  // Track sama: perbarui akumulasi sesuai transisi play/pause.
  const wasPlaying = t.playingSince !== null;

  if (ev.isPlaying && !wasPlaying) {
    // resume: buka sesi berjalan baru
    return { ...t, playingSince: now, durationSec: ev.durationSec || t.durationSec };
  }
  if (!ev.isPlaying && wasPlaying) {
    // pause: tutup sesi berjalan, akumulasikan
    return {
      ...t,
      playedMs: t.playedMs + Math.max(0, now - (t.playingSince ?? now)),
      playingSince: null,
      durationSec: ev.durationSec || t.durationSec,
    };
  }
  // status main tidak berubah: mungkin hanya update durasi
  return { ...t, durationSec: ev.durationSec || t.durationSec };
}

/** Hasil perhitungan progres kartu "Sedang Diamati" — murni, tanpa menyentuh state React. */
export interface ObservedProgress {
  /** Durasi <= 30s: tidak akan pernah dicatat (bar disembunyikan, tampilkan "terlalu pendek"). */
  tooShort: boolean;
  /** Ambang scrobble dalam detik; 0 kalau tooShort. */
  thresholdSec: number;
  /** Waktu putar (bukan posisi) yang sudah terkumpul, dalam detik. */
  playedSec: number;
  /** 0..1 untuk lebar bar. */
  progress: number;
  /** Detik menuju layak; 0 kalau sudah. */
  remainingSec: number;
  /** progress sudah mencapai ambang. */
  eligible: boolean;
}

/**
 * Menghitung progres bar "Sedang Diamati" dari WAKTU BERLALU (playedMs), bukan `position`
 * MediaSession yang mandek di antara event. Dipisah jadi fungsi murni supaya bisa dites tanpa
 * React/plugin — sekaligus menyatukan sumber kebenaran bar dengan logika kelayakan scrobble
 * (keduanya kini memakai played-time yang sama), jadi teks "tercatat dalam ..." benar-benar
 * turun seiring timer scrobble sungguhan, bukan angka mati.
 */
export function observedProgress(durationSec: number, playedMs: number): ObservedProgress {
  const thresholdSec = thresholdMsForDuration(durationSec) / 1000;
  // "tooShort" hanya benar-benar untuk durasi valid <= 30s (ambang 0). Durasi tak dilaporkan
  // BUKAN tooShort — ia memakai fallback 4 menit, jadi bar tetap ditampilkan.
  const tooShort = thresholdSec <= 0;
  const playedSec = Math.max(0, playedMs / 1000);
  if (thresholdSec <= 0) {
    return { tooShort, thresholdSec: 0, playedSec, progress: 0, remainingSec: 0, eligible: false };
  }
  const progress = Math.min(playedSec / thresholdSec, 1);
  const remainingSec = Math.max(0, Math.ceil(thresholdSec - playedSec));
  return { tooShort, thresholdSec, playedSec, progress, remainingSec, eligible: progress >= 1 };
}

/**
 * Berapa ms lagi sampai track ini layak discrobble, dihitung dari `now`.
 * <= 0 berarti SUDAH layak. Infinity berarti tak akan pernah (durasi tak valid).
 */
export function msUntilEligible(t: PlaybackTracker, now: number): number {
  const th = thresholdMs(t);
  if (th <= 0) return Infinity;
  if (t.playingSince === null) return Infinity; // sedang dijeda: tidak menghitung mundur
  const played = playedMsUntil(t, now);
  return Math.max(0, th - played);
}
