/**
 * backoffPolicy.ts — kebijakan backoff MURNI untuk retry flush scrobble. Dipisah agar bisa di-TDD
 * tanpa timer/DOM. Pola diadaptasi dari Pano Scrobbler (WorkManager exponential backoff) ke lapisan
 * TS Scrola — lihat docs/REFERENSI_SCROBBLE_PANO.md.
 *
 * Masalah yang diselesaikan: sebelumnya flush di-retry pada interval TETAP 20 dtk. Saat Last.fm
 * rate-limit (kode 5/29) atau jaringan down, Scrola menghantam tiap 20 dtk; dikombinasi MAX_ATTEMPTS,
 * scrobble sah bisa terbuang dalam hitungan menit. Backoff menaikkan jeda antar percobaan secara
 * eksponensial sampai sukses, memberi limit sementara waktu untuk pulih.
 */

export const BACKOFF_BASE_MS = 20_000; // 20 dtk — sama dengan interval sync normal
export const BACKOFF_MAX_MS = 30 * 60_000; // batas atas 30 menit

export interface BackoffState {
  consecutiveFailures: number;
  /** Waktu paling awal boleh mencoba flush lagi (epoch ms). 0 = boleh kapan saja. */
  nextAllowedAtMs: number;
}

export const INITIAL_BACKOFF: BackoffState = { consecutiveFailures: 0, nextAllowedAtMs: 0 };

/**
 * Jeda backoff untuk sejumlah kegagalan beruntun: base * 2^(failures-1), dibatasi maxMs.
 * 0 kegagalan -> 0 (tanpa backoff, kembali ke cadence normal).
 */
export function backoffDelayMs(
  consecutiveFailures: number,
  baseMs: number = BACKOFF_BASE_MS,
  maxMs: number = BACKOFF_MAX_MS
): number {
  if (consecutiveFailures <= 0) return 0;
  const exp = baseMs * Math.pow(2, consecutiveFailures - 1);
  return Math.min(maxMs, exp);
}

/** Apakah boleh mencoba flush sekarang? */
export function canAttempt(state: BackoffState, nowMs: number): boolean {
  return nowMs >= state.nextAllowedAtMs;
}

/**
 * Transisi state setelah satu percobaan flush.
 * - 'success' -> reset (kembali normal).
 * - 'failure' -> naikkan hitungan kegagalan & jadwalkan percobaan berikut setelah backoff.
 */
export function nextBackoffState(
  state: BackoffState,
  outcome: 'success' | 'failure',
  nowMs: number,
  baseMs: number = BACKOFF_BASE_MS,
  maxMs: number = BACKOFF_MAX_MS
): BackoffState {
  if (outcome === 'success') return { ...INITIAL_BACKOFF };
  const failures = state.consecutiveFailures + 1;
  return { consecutiveFailures: failures, nextAllowedAtMs: nowMs + backoffDelayMs(failures, baseMs, maxMs) };
}
