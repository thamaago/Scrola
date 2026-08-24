import SecureStore from './secureStore';

/**
 * preferences.ts
 *
 * Preferensi app yang TIDAK sensitif (mis. toggle "Scrobble dari app lain"). Sengaja memakai
 * plugin SecureStore yang SUDAH ada alih-alih menambah dependensi @capacitor/preferences —
 * paket itu sempat dihapus dari package.json karena tidak terpakai, dan menambahkannya kembali
 * hanya untuk satu boolean bertentangan dengan prinsip "ringan" proyek.
 * Overhead enkripsi Keystore untuk satu nilai boolean dapat diabaikan.
 *
 * Nilai di-cache di memori supaya scrobbleEngine (yang membacanya di jalur panas setiap event
 * playback) tidak perlu memanggil plugin native berulang kali.
 */

const KEY_EXTERNAL_SCROBBLE = 'pref_external_scrobble_enabled';

let externalScrobbleCache: boolean | null = null;

/** Default: true — deteksi dari app lain adalah fitur inti Scrola, jadi menyala kecuali dimatikan. */
export async function getExternalScrobbleEnabled(): Promise<boolean> {
  if (externalScrobbleCache !== null) return externalScrobbleCache;
  try {
    const { value } = await SecureStore.get({ key: KEY_EXTERNAL_SCROBBLE });
    // Hanya string '0' yang berarti mati; nilai belum pernah diset (null) = default menyala.
    externalScrobbleCache = value !== '0';
  } catch (e) {
    // Plugin gagal (mis. preview web) — jangan sampai kegagalan membaca preferensi kosmetik
    // mematikan fitur inti. Default aman: menyala.
    console.warn('Gagal membaca preferensi scrobble eksternal, memakai default (menyala):', e);
    externalScrobbleCache = true;
  }
  return externalScrobbleCache;
}

export async function setExternalScrobbleEnabled(enabled: boolean): Promise<void> {
  externalScrobbleCache = enabled; // update cache dulu supaya UI & engine langsung konsisten
  await SecureStore.set({ key: KEY_EXTERNAL_SCROBBLE, value: enabled ? '1' : '0' });
}

// Daftar package sumber yang DIABAIKAN scrobble-nya (mis. app yang dipakai menonton video, bukan
// mendengar musik). Deterministik & dikendalikan pengguna — audio vs video tak bisa dibedakan andal
// dari metadata notifikasi, jadi ini lever yang jujur. Disimpan sebagai JSON array, di-cache di memori.
const KEY_IGNORED_SOURCES = 'pref_ignored_sources';
let ignoredSourcesCache: string[] | null = null;

export async function getIgnoredSources(): Promise<string[]> {
  if (ignoredSourcesCache !== null) return ignoredSourcesCache;
  try {
    const { value } = await SecureStore.get({ key: KEY_IGNORED_SOURCES });
    const parsed = value ? JSON.parse(value) : [];
    ignoredSourcesCache = Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch (e) {
    console.warn('Gagal membaca daftar sumber diabaikan, memakai kosong:', e);
    ignoredSourcesCache = [];
  }
  return ignoredSourcesCache;
}

export async function setIgnoredSources(packages: string[]): Promise<void> {
  ignoredSourcesCache = packages;
  await SecureStore.set({ key: KEY_IGNORED_SOURCES, value: JSON.stringify(packages) });
}

/** Toggle satu package di daftar diabaikan; kembalikan daftar baru. */
export async function toggleIgnoredSource(pkg: string): Promise<string[]> {
  const cur = await getIgnoredSources();
  const next = cur.includes(pkg) ? cur.filter((p) => p !== pkg) : [...cur, pkg];
  await setIgnoredSources(next);
  return next;
}

// --- Locale (bahasa tampilan) ---
import type { Locale } from './i18n';
import { resolveLocale } from './i18n';

const KEY_LOCALE = 'pref_locale';
let localeCache: Locale | null = null;

/** Locale tersimpan, atau null bila belum pernah dipilih (pemanggil boleh pakai bahasa perangkat). */
export async function getSavedLocale(): Promise<Locale | null> {
  if (localeCache !== null) return localeCache;
  try {
    const { value } = await SecureStore.get({ key: KEY_LOCALE });
    if (!value) return null;
    localeCache = resolveLocale(value);
    return localeCache;
  } catch {
    return null;
  }
}

export async function setSavedLocale(locale: Locale): Promise<void> {
  localeCache = locale;
  try {
    await SecureStore.set({ key: KEY_LOCALE, value: locale });
  } catch (e) {
    console.warn('Gagal menyimpan preferensi bahasa:', e);
  }
}
