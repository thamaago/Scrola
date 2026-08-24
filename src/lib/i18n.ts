import { id } from './locales/id';
import { en } from './locales/en';
import { pt } from './locales/pt';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { ru } from './locales/ru';
import { ja } from './locales/ja';
import { es } from './locales/es';

/**
 * i18n.ts — inti multibahasa RINGAN (tanpa library). Fungsi murni & deterministik → mudah di-TDD.
 * Sisi React (hook + provider + persistensi) ada di i18nContext.tsx. Kamus per-locale di locales/.
 * Format angka/tanggal per-locale (Intl) ada di i18nFormat.ts. Audit kelengkapan kunci di i18nAudit.ts.
 *
 * Aturan fallback: locale diminta → id (basis) → kunci mentah. Jadi menambah kunci di id.ts saja
 * sudah aman (locale lain otomatis jatuh balik ke id sampai diterjemahkan).
 */

export type Locale = 'id' | 'en' | 'pt' | 'de' | 'fr' | 'ru' | 'ja' | 'es';
export const LOCALES: Locale[] = ['id', 'en', 'pt', 'de', 'fr', 'ru', 'ja', 'es'];
export const DEFAULT_LOCALE: Locale = 'id';

const DICTS: Record<Locale, Record<string, string>> = { id, en, pt, de, fr, ru, ja, es };

/** Kamus mentah satu locale (dipakai i18nAudit). Fallback ke basis bila locale tak dikenal. */
export function getDict(locale: Locale): Record<string, string> {
  return DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
}

/**
 * Cermin locale tingkat-modul. React punya context, tapi kode NON-React tetap perlu tahu bahasa
 * aktif: ErrorBoundary (komponen class di ATAS provider), renderer Canvas gambar-bagikan, dan
 * penerjemahan pesan error di luar pohon React. I18nProvider menyinkronkan nilai ini setiap kali
 * locale berubah, jadi `tActive`/`getActiveLocale` selalu mencerminkan pilihan pengguna.
 */
let activeLocale: Locale = DEFAULT_LOCALE;
export function getActiveLocale(): Locale {
  return activeLocale;
}
export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}
/** translate memakai locale aktif — untuk konteks non-React. */
export function tActive(key: string, params?: Record<string, string | number>): string {
  return translate(activeLocale, key, params);
}

/** Petakan kode bahasa apa pun (mis. "en-US", "ID") ke Locale yang didukung; fallback ke default. */
export function resolveLocale(input?: string | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const base = input.toLowerCase().split('-')[0];
  return (LOCALES as string[]).includes(base) ? (base as Locale) : DEFAULT_LOCALE;
}

/** Sisipkan parameter `{nama}` ke dalam string. Dipakai bersama oleh translate & translatePlural. */
function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  let out = s;
  for (const [k, v] of Object.entries(params)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

/**
 * Terjemahkan `key` untuk `locale`, dengan interpolasi `{param}`. Fallback: locale → id → key.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const primary = DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
  const s = primary[key] ?? DICTS[DEFAULT_LOCALE][key] ?? key;
  return interpolate(s, params);
}

// --- Pluralisasi (bentuk jamak) ---------------------------------------------------------------

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export const PLURAL_CATEGORIES: PluralCategory[] = ['zero', 'one', 'two', 'few', 'many', 'other'];

/**
 * Aturan jamak per-locale. Ditulis sendiri (bukan Intl.PluralRules) karena aturan id/en trivial
 * dan kita ingin deterministik lintas mesin/WebView (lihat rule "ringan-dan-fokus").
 * - id: bahasa Indonesia tidak berinfleksi jamak → selalu "other".
 * - en: 1 (atau -1) → "one", selain itu (termasuk 0) → "other".
 */
const PLURAL_RULES: Record<Locale, (n: number) => PluralCategory> = {
  id: () => 'other',
  en: (n) => (Math.abs(n) === 1 ? 'one' : 'other'),
  // Portugis (BR): 1 → tunggal, selain itu (termasuk 0) → jamak. Pilihan pragmatis & alami untuk
  // pt-BR ("0 músicas"), sedikit berbeda dari CLDR yang menaruh 0 di kategori "one".
  pt: (n) => (Math.abs(n) === 1 ? 'one' : 'other'),
  // Jerman: 1 → tunggal, selain itu (termasuk 0) → jamak (sesuai CLDR de).
  de: (n) => (Math.abs(n) === 1 ? 'one' : 'other'),
  // Prancis: 0 DAN 1 → tunggal, ≥2 → jamak (sesuai CLDR fr — "0 chanson", "2 chansons").
  fr: (n) => (Math.abs(n) < 2 ? 'one' : 'other'),
  // Rusia: TIGA bentuk (CLDR ru) — one/few/many. Contoh: 1 трек, 2 трека, 5 треков, 21 трек,
  // 11 треков. Ini menguji infra jamak melampaui pola dua-bentuk.
  ru: (n) => {
    const abs = Math.abs(n);
    const m10 = abs % 10;
    const m100 = abs % 100;
    if (m10 === 1 && m100 !== 11) return 'one';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'few';
    return 'many'; // 0, 5–9, 10, 11–14, 25 dst.
  },
  // Jepang: tanpa infleksi jamak → selalu "other" (seperti id).
  ja: () => 'other',
  // Spanyol: 1 → tunggal, selain itu (termasuk 0) → jamak (CLDR es).
  es: (n) => (Math.abs(n) === 1 ? 'one' : 'other'),
};

/** Kategori jamak yang MUNGKIN dihasilkan tiap locale — dipakai audit untuk tahu kunci apa yang wajib. */
export const LOCALE_PLURAL_CATEGORIES: Record<Locale, PluralCategory[]> = {
  id: ['other'],
  en: ['one', 'other'],
  pt: ['one', 'other'],
  de: ['one', 'other'],
  fr: ['one', 'other'],
  ru: ['one', 'few', 'many'], // integer saja → tanpa 'other' (yang di CLDR hanya untuk pecahan)
  ja: ['other'], // tanpa jamak — satu bentuk saja
  es: ['one', 'other'],
};

export function pluralCategory(locale: Locale, n: number): PluralCategory {
  const rule = PLURAL_RULES[locale] ?? PLURAL_RULES[DEFAULT_LOCALE];
  return rule(n);
}

/** True bila `key` diakhiri sufiks kategori jamak, mis. "x.other" / "x.one". */
export function isPluralVariantKey(key: string): boolean {
  const i = key.lastIndexOf('.');
  if (i < 0) return false;
  return (PLURAL_CATEGORIES as string[]).includes(key.slice(i + 1));
}

/** Ambil basis grup dari kunci varian jamak ("ticket.count.other" → "ticket.count"). */
export function pluralGroupBase(key: string): string {
  return isPluralVariantKey(key) ? key.slice(0, key.lastIndexOf('.')) : key;
}

/**
 * Terjemahkan bentuk jamak. Pilih `${keyBase}.${kategori}`, dengan fallback berlapis:
 * locale[kategori] → locale.other → id[kategori] → id.other → keyBase.
 * `count` otomatis tersedia sebagai `{count}`; param lain boleh ditambah.
 */
export function translatePlural(
  locale: Locale,
  keyBase: string,
  count: number,
  params?: Record<string, string | number>
): string {
  const cat = pluralCategory(locale, count);
  const primary = DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
  const base = DICTS[DEFAULT_LOCALE];
  const s =
    primary[`${keyBase}.${cat}`] ??
    primary[`${keyBase}.other`] ??
    base[`${keyBase}.${cat}`] ??
    base[`${keyBase}.other`];
  if (s == null) return keyBase;
  return interpolate(s, { count, ...(params ?? {}) });
}
