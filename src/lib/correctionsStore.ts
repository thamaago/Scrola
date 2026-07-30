import SecureStore from './secureStore';
import { upsertRule, type CorrectionRule, type NamePair } from './corrections';

/**
 * correctionsStore.ts — penyimpanan aturan "belajar dari koreksi".
 *
 * Memakai plugin SecureStore yang SUDAH ada (sama seperti preferences.ts) alih-alih menambah
 * dependensi. Di-cache di memori supaya jalur drain (yang menerapkan koreksi ke tiap scrobble)
 * tidak memanggil plugin native berulang. Logika murni (matching/upsert) ada di corrections.ts.
 */

const KEY = 'learned_corrections';

let cache: CorrectionRule[] | null = null;

export async function loadCorrections(): Promise<CorrectionRule[]> {
  if (cache !== null) return cache;
  try {
    const { value } = await SecureStore.get({ key: KEY });
    cache = value ? (JSON.parse(value) as CorrectionRule[]) : [];
  } catch (e) {
    // Plugin gagal (mis. preview web) atau JSON rusak — jangan sampai mematikan scrobble.
    console.warn('Gagal membaca koreksi tersimpan, memakai kosong:', e);
    cache = [];
  }
  return cache;
}

/** Rekam koreksi dari edit Riwayat. No-op kalau perubahan trivial (lihat shouldRecordCorrection). */
export async function recordCorrection(from: NamePair, to: NamePair): Promise<void> {
  const rules = await loadCorrections();
  const next = upsertRule(rules, from, to);
  if (next === rules) return; // tidak ada perubahan yang perlu disimpan
  cache = next;
  try {
    await SecureStore.set({ key: KEY, value: JSON.stringify(next) });
  } catch (e) {
    console.warn('Gagal menyimpan koreksi:', e);
  }
}
