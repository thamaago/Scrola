/**
 * shareCardLayout.ts — logic MURNI untuk tata letak kartu tiket yang dibagikan.
 *
 * Dipisah dari kode canvas (yang butuh DOM) supaya aturan yang rawan salah — pemotongan teks
 * panjang, ukuran font adaptif — bisa diunit-test tanpa browser. Pola yang sama dengan
 * scrobbleLogic.ts / historyGrouping.ts.
 */

/** Kanvas rasio 9:16 — format yang diterima WhatsApp Status & Instagram Story tanpa dipotong. */
export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1920;

/**
 * Potong teks yang melebihi batas karakter, dengan elipsis. Dipakai untuk judul & artis yang
 * terlalu panjang supaya tidak menabrak tepi tiket.
 *
 * Batas dihitung dari KARAKTER, bukan lebar piksel sebenarnya — pendekatan sederhana yang
 * cukup untuk font display yang lebarnya relatif seragam, dan yang penting: bisa dites tanpa
 * canvas. Kalau nanti terbukti kurang akurat di device untuk judul dengan banyak huruf lebar
 * (W, M), naikkan saja batasnya; jangan tergoda mengukur lewat canvas di sini karena itu
 * membuat fungsi ini tidak bisa ditest lagi.
 */
export function truncateForCard(text: string, maxChars: number): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  if (maxChars <= 1) return '…';
  return clean.slice(0, maxChars - 1).trimEnd() + '…';
}

/**
 * Ukuran font judul menyusut untuk judul panjang, supaya tetap muat dalam satu-dua baris tanpa
 * perlu word-wrap yang rumit.
 */
export function titleFontSize(title: string): number {
  const len = title.trim().length;
  if (len <= 18) return 76;
  if (len <= 28) return 64;
  if (len <= 40) return 54;
  return 46;
}

/** Format detik jadi mm:ss — dipakai di baris meta tiket. */
export function formatDurationForCard(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return '—';
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Nomor tiket dekoratif dari timestamp — konsisten untuk lagu & waktu yang sama. */
export function ticketNumber(timestampSec: number): string {
  const n = Math.abs(Math.floor(timestampSec)) % 10000;
  return `№${n.toString().padStart(4, '0')}`;
}
