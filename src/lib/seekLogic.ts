/**
 * seekLogic.ts — fungsi murni untuk timeline pemutar.
 *
 * Dipisah dari komponen karena konversi koordinat↔waktu rawan off-by-one dan pembagian nol
 * (durasi 0 saat metadata belum termuat), dan itu jenis kesalahan yang baru terasa saat dipakai:
 * jari geser ke ujung kiri malah melompat ke akhir lagu, atau app membeku karena NaN.
 * Pola yang sama dengan scrobbleLogic.ts / historyGrouping.ts.
 */

/**
 * Ubah posisi sentuhan jadi milidetik.
 * @param clientX posisi X sentuhan/kursor di layar
 * @param trackLeft tepi kiri elemen timeline
 * @param trackWidth lebar elemen timeline
 * @param durationMs durasi total lagu
 */
export function positionFromTouch(
  clientX: number,
  trackLeft: number,
  trackWidth: number,
  durationMs: number
): number {
  // Lebar 0 terjadi kalau elemen belum ter-layout (render pertama). Tanpa guard ini hasilnya
  // NaN/Infinity, yang kalau diteruskan ke seekTo() bisa membuat ExoPlayer melempar error.
  if (trackWidth <= 0 || durationMs <= 0) return 0;
  const ratio = (clientX - trackLeft) / trackWidth;
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.round(clamped * durationMs);
}

/** Rasio 0..1 untuk lebar bar terisi. Aman terhadap durasi 0 dan posisi melebihi durasi. */
export function progressRatio(positionMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, positionMs / durationMs));
}

/** Format milidetik jadi m:ss. Nilai tak valid jadi "0:00", bukan "NaN:NaN". */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
