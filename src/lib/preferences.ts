import SecureStore from './secureStore';

/**
 * preferences.ts
 *
 * Preferensi app yang TIDAK sensitif (mis. toggle "Scrobble dari app lain"). Sengaja memakai
 * plugin SecureStore yang SUDAH ada alih-alih menambah dependensi @capacitor/preferences —
 * paket itu sempat dihapus dari package.json karena tidak terpakai, dan menambahkannya kembali
 * hanya untuk satu boolean bertentangan dengan prinsip "ringan" (lihat .claude/rules/ringan-dan-fokus.md).
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
