/**
 * secureStore.ts
 * Wrapper untuk plugin native SecureStorePlugin (Android Keystore AES-256-GCM),
 * pola yang sama dengan penyimpanan master key di Strongbox — TIDAK memakai
 * @capacitor/preferences polos untuk data sensitif (session key Last.fm).
 */
import { registerPlugin } from '@capacitor/core';

export interface SecureStorePluginInterface {
  set(options: { key: string; value: string }): Promise<void>;
  get(options: { key: string }): Promise<{ value: string | null }>;
  remove(options: { key: string }): Promise<void>;
}

const SecureStore = registerPlugin<SecureStorePluginInterface>('SecureStore');

const SESSION_KEY = 'lastfm_session_key';
const SESSION_USER = 'lastfm_session_user';

export async function saveSession(username: string, sk: string) {
  // Dua operasi set terpisah tidak atomik. Kalau yang pertama berhasil tapi yang kedua gagal
  // (mis. Keystore error di tengah), penyimpanan jadi setengah-tertulis: session key tersimpan
  // tanpa username pasangannya. loadSession() memang akan mengembalikan null dalam kondisi itu
  // (butuh keduanya), tapi lebih bersih membersihkan sisa yang terlanjur tertulis daripada
  // meninggalkan session key sensitif menggantung tanpa konteks. Jadi kalau ada yang gagal,
  // hapus keduanya lalu teruskan errornya ke pemanggil.
  try {
    await SecureStore.set({ key: SESSION_KEY, value: sk });
    await SecureStore.set({ key: SESSION_USER, value: username });
  } catch (e) {
    await SecureStore.remove({ key: SESSION_KEY }).catch(() => {});
    await SecureStore.remove({ key: SESSION_USER }).catch(() => {});
    throw e;
  }
}

export async function loadSession(): Promise<{ username: string; sk: string } | null> {
  const [{ value: sk }, { value: username }] = await Promise.all([
    SecureStore.get({ key: SESSION_KEY }),
    SecureStore.get({ key: SESSION_USER }),
  ]);
  if (!sk || !username) return null;
  return { username, sk };
}

export async function clearSession() {
  await SecureStore.remove({ key: SESSION_KEY });
  await SecureStore.remove({ key: SESSION_USER });
}

export default SecureStore;
