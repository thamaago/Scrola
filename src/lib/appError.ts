import { translate, tActive, type Locale } from './i18n';

/**
 * appError.ts — error yang MENUNDA penerjemahan sampai titik tampil.
 *
 * Masalah: kalau lib/hook melempar/menyimpan pesan yang SUDAH diterjemahkan, teksnya membeku pada
 * bahasa saat error terjadi — ganti bahasa setelahnya tak mengubahnya, dan lib jadi bergantung ke
 * locale. Solusi: bawa `key` (+ `params`) saja; UI menerjemahkan dengan `t()` (atau `errText`)
 * pada saat render, sehingga selalu mengikuti bahasa aktif.
 */
export class AppError extends Error {
  readonly key: string;
  readonly params?: Record<string, string | number>;
  constructor(key: string, params?: Record<string, string | number>) {
    super(key); // .message = key → aman sebagai fallback teknis di log
    this.name = 'AppError';
    this.key = key;
    this.params = params;
  }
}

/** Deskriptor error yang bisa disimpan di state React lalu diterjemahkan saat render. */
export interface ErrDescriptor {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * Ubah error apa pun jadi deskriptor {key, params}. AppError dipetakan langsung; lainnya jatuh ke
 * kunci generik (detail teknis tetap bisa dicatat pemanggil ke console).
 */
export function toErrDescriptor(e: unknown, fallbackKey = 'err.generic'): ErrDescriptor {
  if (e instanceof AppError) return { key: e.key, params: e.params };
  return { key: fallbackKey };
}

/** Terjemahkan error dengan locale eksplisit (mis. di render React yang punya `locale`). */
export function errTextFor(e: unknown, locale: Locale, fallbackKey = 'err.generic'): string {
  const d = toErrDescriptor(e, fallbackKey);
  return translate(locale, d.key, d.params);
}

/** Terjemahkan error memakai locale AKTIF — untuk konteks non-React. */
export function errText(e: unknown, fallbackKey = 'err.generic'): string {
  const d = toErrDescriptor(e, fallbackKey);
  return tActive(d.key, d.params);
}
