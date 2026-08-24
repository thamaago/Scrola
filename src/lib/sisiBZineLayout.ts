/**
 * sisiBZineLayout.ts — fungsi murni untuk tata letak "zine" Sisi B (recap mingguan yang bisa
 * dibagikan sebagai gambar). Dipisah dari renderer Canvas supaya keputusan format/label/normalisasi
 * bisa diunit-test tanpa DOM — pola sama seperti shareCardLayout.ts & scrobbleLogic.ts.
 */

import { subjectHash } from './ticketSerialLogic';
import { DEFAULT_LOCALE, type Locale } from './i18n';
import { formatMonth } from './i18nFormat';

/** Label hari, index 0=Senin .. 6=Minggu — cocok dengan urutan SisiBStats.dayCounts. */
export const DAY_LABELS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/**
 * Rentang minggu (Senin–Minggu) jadi label ringkas Indonesia. Tahun/bulan hanya diulang di sisi
 * kiri kalau berbeda dari sisi kanan, supaya ringkas:
 *   satu bulan   : "11–17 Agu 2025"
 *   lintas bulan : "29 Sep–5 Okt 2025"
 *   lintas tahun : "29 Des 2025–4 Jan 2026"
 *
 * Memakai komponen tanggal LOKAL (bukan UTC) agar konsisten dengan startOfIsoWeek yang
 * menghasilkan tengah-malam lokal. Akhir minggu dihitung via setDate(+6) — aman terhadap DST
 * seandainya nanti menyasar zona ber-DST (Indonesia sendiri tidak punya DST).
 */
export function weekRangeLabel(weekStartUnixSec: number, locale: Locale = DEFAULT_LOCALE): string {
  const start = new Date(weekStartUnixSec * 1000);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const sD = start.getDate();
  const sM = start.getMonth();
  const sY = start.getFullYear();
  const eD = end.getDate();
  const eM = end.getMonth();
  const eY = end.getFullYear();

  const mon = (m: number) => formatMonth(locale, m, 'short');
  const right = `${eD} ${mon(eM)} ${eY}`;
  let left: string;
  if (sY !== eY) {
    left = `${sD} ${mon(sM)} ${sY}`;
  } else if (sM !== eM) {
    left = `${sD} ${mon(sM)}`;
  } else {
    left = `${sD}`;
  }
  return `${left}–${right}`;
}

/**
 * Tinggi bar per hari (px) dinormalisasi: hari dengan scrobble terbanyak = maxBarPx, sisanya
 * proporsional, dibulatkan ke integer. Selalu mengembalikan 7 elemen (kekurangan diisi 0).
 * Semua nol -> semua 0 (tanpa pembagian dengan nol).
 */
export function dayBarHeights(dayCounts: number[], maxBarPx: number): number[] {
  const seven = Array.from({ length: 7 }, (_, i) => dayCounts[i] ?? 0);
  const peak = Math.max(...seven);
  if (peak <= 0) return seven.map(() => 0);
  return seven.map((c) => Math.round((c / peak) * maxBarPx));
}

/**
 * Jam puncak (0-23) jadi rentang satu jam format Indonesia (titik pemisah), mis. 21 -> "21.00–22.00".
 * Jam 23 membungkus ke "23.00–00.00". null -> "—".
 */
export function peakHourLabel(hour: number | null): string {
  if (hour === null || hour === undefined) return '—';
  const pad = (h: number) => String(h).padStart(2, '0');
  return `${pad(hour)}.00–${pad((hour + 1) % 24)}.00`;
}

/**
 * Serial "koleksi" dekoratif untuk zine mingguan. STABIL per minggu — hanya bergantung pada minggu,
 * BUKAN pada jumlah scrobble/waktu berbagi — supaya membagikan ulang zine minggu yang sama selalu
 * memberi serial identik (esensial untuk sesuatu yang disebut "koleksi"). Suffix memakai subjectHash
 * (djb2) yang sama dengan sistem serial tiket koleksi, agar bahasa serial di seluruh app konsisten.
 *
 * CATATAN: week-of-year sederhana (ceil hari-ke-N / 7), BUKAN ISO-8601 ketat — cukup untuk penanda
 * koleksi, bukan perhitungan kalender yang mengikat.
 */
export function zineSerial(weekStartUnixSec: number): string {
  const start = new Date(weekStartUnixSec * 1000);
  const year = start.getFullYear();
  const startOfYear = new Date(year, 0, 1).getTime();
  const dayOfYear = Math.floor((start.getTime() - startOfYear) / 86400000) + 1;
  const weekOfYear = String(Math.ceil(dayOfYear / 7)).padStart(2, '0');
  const suffix = subjectHash(`${year}-W${weekOfYear}`).toUpperCase();
  return `SB-${year}-W${weekOfYear}-${suffix}`;
}
