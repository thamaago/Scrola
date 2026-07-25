import { scrobbleThresholdSec } from './scrobbleLogic';

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
  if (t.durationSec <= 30) return 0;
  return scrobbleThresholdSec(t.durationSec) * 1000;
}

/**
 * Perbarui tracker berdasarkan event. Mengembalikan tracker BARU (murni, mudah dites).
 *
 * @param ev.trackKey  kunci track dari event
 * @param ev.isPlaying apakah sekarang sedang diputar
 * @param ev.durationSec durasi track
 * @param now waktu sekarang (ms)
 */
export function applyEvent(
  t: PlaybackTracker,
  ev: { trackKey: string; isPlaying: boolean; durationSec: number },
  now: number
): PlaybackTracker {
  // Track berganti -> mulai hitung dari nol.
  if (ev.trackKey !== t.trackKey) {
    return {
      trackKey: ev.trackKey,
      playedMs: 0,
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
