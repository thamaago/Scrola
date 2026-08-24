import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  translate,
  translatePlural,
  resolveLocale,
  setActiveLocale,
  DEFAULT_LOCALE,
  type Locale,
} from './i18n';
import {
  formatNumber,
  formatDayMonthYear,
  formatMonth,
  formatWeekday,
} from './i18nFormat';
import { getSavedLocale, setSavedLocale } from './preferences';

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Terjemahkan kunci (dengan interpolasi `{param}`). */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Terjemahkan bentuk jamak; `count` otomatis jadi `{count}`. */
  tp: (keyBase: string, count: number, params?: Record<string, string | number>) => string;
  /** Format angka sesuai locale (pemisah ribuan). */
  n: (value: number, opts?: Intl.NumberFormatOptions) => string;
  /** Tanggal ringkas "9 Mei 2024" / "May 9, 2024". Menerima Date atau epoch-ms. */
  d: (date: Date | number) => string;
  /** Nama bulan per-locale (0 = Januari). */
  month: (monthIndex: number, style?: 'long' | 'short') => string;
  /** Nama hari per-locale, indeks Senin-dulu (0 = Senin). */
  weekday: (mondayIndex: number, style?: 'long' | 'short') => string;
}

const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
  tp: (key) => key,
  n: (v) => String(v),
  d: () => '',
  month: () => '',
  weekday: () => '',
});

/**
 * Provider i18n — memuat locale tersimpan (atau mendeteksi dari bahasa perangkat) saat mount, lalu
 * menyediakan `t()` / `tp()` / formatter yang re-render seluruh app ketika bahasa diganti.
 * Ringan, tanpa library.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    getSavedLocale()
      .then((saved) => {
        if (saved) setLocaleState(saved);
        else if (typeof navigator !== 'undefined') setLocaleState(resolveLocale(navigator.language));
      })
      .catch(() => {});
  }, []);

  // Jaga cermin locale tingkat-modul tetap sinkron supaya kode non-React (ErrorBoundary, renderer
  // Canvas, penerjemahan error) selalu memakai bahasa aktif. Dijalankan sinkron saat render agar
  // nilainya benar bahkan sebelum efek — penting untuk error yang terjadi lebih awal.
  setActiveLocale(locale);

  const setLocale = useCallback((l: Locale) => {
    setActiveLocale(l);
    setLocaleState(l);
    void setSavedLocale(l);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      tp: (keyBase, count, params) => translatePlural(locale, keyBase, count, params),
      n: (v, opts) => formatNumber(locale, v, opts),
      d: (date) => formatDayMonthYear(locale, date),
      month: (monthIndex, style) => formatMonth(locale, monthIndex, style),
      weekday: (mondayIndex, style) => formatWeekday(locale, mondayIndex, style),
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Hook: `const { t, tp, n, d, month, weekday, locale, setLocale } = useI18n();` */
export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
