/**
 * scrobbleLogic.ts
 *
 * Fungsi-fungsi murni (pure functions) yang dipisah dari scrobbleEngine.ts supaya bisa diunit-test
 * tanpa perlu mock plugin native, database, atau jaringan. Ini bagian logic yang paling rawan bug
 * halus (parsing respons API, aturan eligibility) sekaligus paling mudah dites secara terisolasi.
 */

export interface ScrobbleResponseParseResult {
  accepted: number;
  ignoredIndexes: Set<number>;
}

/**
 * Parse respons track.scrobble dari Last.fm. Saat mengirim >1 track, field `scrobble` berupa
 * array; saat hanya 1 track, Last.fm API mengembalikannya sebagai objek tunggal (bukan array
 * berisi 1 elemen) — kuirk yang cukup terkenal di API ini, jadi wajib dinormalisasi.
 *
 * `ignoredMessage.code` != "0" berarti track ditolak Last.fm (mis. artist kosong, timestamp
 * terlalu lama) — track begitu tidak perlu dicoba ulang.
 */
export function parseScrobbleResponse(response: any, expectedCount: number): ScrobbleResponseParseResult {
  const raw = response?.scrobbles?.scrobble;
  const list: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const ignoredIndexes = new Set<number>();

  if (list.length === expectedCount) {
    list.forEach((item, i) => {
      const code = item?.ignoredMessage?.code;
      if (code !== undefined && code !== '0' && code !== 0) {
        ignoredIndexes.add(i);
      }
    });
  }
  // Kalau jumlah item respons tidak cocok (format tak terduga), jangan tebak-tebak —
  // anggap semua diterima daripada salah membuang data yang sebetulnya sukses.
  return { accepted: expectedCount - ignoredIndexes.size, ignoredIndexes };
}

/**
 * Ambang waktu (detik) yang harus tercapai sebelum sebuah track boleh di-scrobble, sesuai
 * aturan resmi Last.fm: 50% durasi ATAU 4 menit (240s), mana yang lebih dulu tercapai.
 * Dipakai juga oleh NowPlayingScreen untuk menghitung tinggi tiket "tercetak" (elapsed/threshold),
 * jadi angka ini SATU sumber kebenaran untuk logic eligibility maupun visual progres.
 */
export function scrobbleThresholdSec(durationSec: number): number {
  return Math.min(durationSec * 0.5, 240);
}

/**
 * Aturan resmi Last.fm kapan sebuah track boleh di-scrobble:
 * - Durasi track > 30 detik
 * - Sudah diputar >= 50% durasi ATAU >= 4 menit (240s), mana yang lebih dulu tercapai
 */
export function isScrobbleEligible(durationSec: number, playedSec: number): boolean {
  if (durationSec <= 30) return false;
  return playedSec >= scrobbleThresholdSec(durationSec);
}

/** Bangun api_sig sesuai spesifikasi Last.fm: md5(param1value1param2value2...secret).
 * Fungsi ini murni membangun STRING BASE yang akan di-md5 — proses md5-nya sendiri di lastfm.ts,
 * dipisah begini supaya urutan/penyaringan parameter (bagian yang rawan salah) bisa dites tanpa
 * bergantung pada implementasi md5. */
export function buildSignatureBase(params: Record<string, string | number | undefined>): string {
  const keys = Object.keys(params)
    .filter((k) => k !== 'format' && k !== 'callback' && params[k] !== undefined)
    .sort();
  return keys.map((k) => `${k}${params[k]}`).join('');
}

// Batas jumlah scrobble per satu panggilan track.scrobble Last.fm. Antrean dikirim per grup
// sebesar ini (lihat getQueueBatch di flushQueueOnce) — dulu hardcoded 50, kini bernama supaya
// jalur produksi & test memakai angka yang sama.
export const MAX_SCROBBLE_BATCH = 50;

/**
 * Pisahkan satu batch antrean jadi baris yang MASIH layak dikirim (`toSend`) vs baris "beracun"
 * yang sudah melewati `maxAttempts` dan harus dibuang (`toDrop`). Murni: tidak menyentuh DB atau
 * jaringan — hanya keputusan partisi yang sebelumnya ter-inline di flushQueueOnce, dipisah agar
 * bisa diuji sendiri. Urutan asli dipertahankan supaya urutan kirim (dan timestamp) tak teracak.
 */
export function partitionByAttempts<T extends { attempts: number }>(
  rows: T[],
  maxAttempts: number
): { toSend: T[]; toDrop: T[] } {
  const toSend: T[] = [];
  const toDrop: T[] = [];
  for (const r of rows) {
    if (r.attempts >= maxAttempts) toDrop.push(r);
    else toSend.push(r);
  }
  return { toSend, toDrop };
}
