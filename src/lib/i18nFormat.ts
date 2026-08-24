import { DEFAULT_LOCALE, type Locale } from './i18n';

/**
 * i18nFormat.ts — format angka & tanggal per-locale via `Intl` (bawaan engine, tanpa dependensi).
 * Hanya memakai `Intl.NumberFormat` & `Intl.DateTimeFormat` yang tersedia di SEMUA WebView Android
 * yang didukung (tidak memakai `Intl.RelativeTimeFormat` yang butuh WebView lebih baru).
 *
 * Formatter Intl mahal dibuat; di-cache per (tag+opsi) supaya jalur render tak membangun ulang tiap
 * kali (lihat rule "ringan-dan-fokus").
 */

const BCP47: Record<Locale, string> = { id: 'id-ID', en: 'en-US', pt: 'pt-BR', de: 'de-DE', fr: 'fr-FR', ru: 'ru-RU', ja: 'ja-JP', es: 'es-419' };

/** Petakan Locale internal ke tag BCP-47 penuh untuk Intl. */
export function bcp47(locale: Locale): string {
  return BCP47[locale] ?? BCP47[DEFAULT_LOCALE];
}

const numCache = new Map<string, Intl.NumberFormat>();
const dtCache = new Map<string, Intl.DateTimeFormat>();

function numFmt(locale: Locale, opts?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = bcp47(locale) + '|' + (opts ? JSON.stringify(opts) : '');
  let f = numCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(bcp47(locale), opts);
    numCache.set(key, f);
  }
  return f;
}

function dtFmt(locale: Locale, opts?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = bcp47(locale) + '|' + (opts ? JSON.stringify(opts) : '');
  let f = dtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(bcp47(locale), opts);
    dtCache.set(key, f);
  }
  return f;
}

function toDate(date: Date | number): Date {
  return date instanceof Date ? date : new Date(date);
}

/** Format angka sesuai locale (pemisah ribuan/desimal). */
export function formatNumber(
  locale: Locale,
  value: number,
  opts?: Intl.NumberFormatOptions
): string {
  return numFmt(locale, opts).format(value);
}

/** Format tanggal dengan opsi Intl bebas. Menerima Date atau epoch-ms. */
export function formatDate(
  locale: Locale,
  date: Date | number,
  opts?: Intl.DateTimeFormatOptions
): string {
  return dtFmt(locale, opts).format(toDate(date));
}

/** Nama bulan per-locale. `month` 0..11 (indeks JS); di luar rentang dibungkus (defensif, tak melempar). */
export function formatMonth(locale: Locale, month: number, style: 'long' | 'short' = 'long'): string {
  const idx = ((Math.trunc(month) % 12) + 12) % 12;
  // Pakai tengah hari UTC + timeZone UTC agar hanya komponen bulan yang menentukan hasil.
  return dtFmt(locale, { month: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2000, idx, 1, 12)));
}

/** Tanggal ringkas "9 Mei 2024" / "May 9, 2024" — urutan mengikuti locale. */
export function formatDayMonthYear(locale: Locale, date: Date | number): string {
  return formatDate(locale, date, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Nama hari per-locale, indeks Senin-dulu (0 = Senin … 6 = Minggu) — sesuai tata letak "Irama minggu".
 * Di luar rentang dibungkus (defensif). 2024-01-01 (UTC) adalah hari Senin, dipakai sebagai jangkar.
 */
export function formatWeekday(
  locale: Locale,
  mondayIndex: number,
  style: 'long' | 'short' = 'short'
): string {
  const idx = ((Math.trunc(mondayIndex) % 7) + 7) % 7;
  return dtFmt(locale, { weekday: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + idx, 12)));
}
