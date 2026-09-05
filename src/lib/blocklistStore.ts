import SecureStore from './secureStore';
import { toggleBlocked } from './blocklist';

/**
 * blocklistStore.ts — penyimpanan daftar blokir sumber (per paket app) via SecureStore, dengan
 * cache memori supaya jalur drain tidak memanggil plugin native berulang.
 */

const KEY = 'blocked_sources';

let cache: string[] | null = null;

export async function loadBlockedSources(): Promise<string[]> {
  if (cache !== null) return cache;
  try {
    const { value } = await SecureStore.get({ key: KEY });
    cache = value ? (JSON.parse(value) as string[]) : [];
  } catch (e) {
    console.warn('Gagal membaca daftar blokir, memakai kosong:', e);
    cache = [];
  }
  return cache;
}

/** Toggle blokir sebuah paket; menyimpan & memperbarui cache. Mengembalikan daftar baru. */
export async function toggleSourceBlocked(pkg: string): Promise<string[]> {
  const cur = await loadBlockedSources();
  const next = toggleBlocked(cur, pkg);
  cache = next;
  try {
    await SecureStore.set({ key: KEY, value: JSON.stringify(next) });
  } catch (e) {
    console.warn('Gagal menyimpan daftar blokir:', e);
  }
  return next;
}
