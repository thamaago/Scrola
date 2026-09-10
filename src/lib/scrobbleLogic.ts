/**
 * scrobbleLogic.ts
 *
 * Fungsi-fungsi murni (pure functions) yang dipisah dari scrobbleEngine.ts supaya bisa diunit-test
 * tanpa perlu mock plugin native, database, atau jaringan. Ini bagian logic yang paling rawan bug
 * halus (parsing respons API, aturan eligibility) sekaligus paling mudah dites secara terisolasi.
 */

/** Batas track per panggilan track.scrobble Last.fm (spek resmi API). */
export const MAX_SCROBBLE_BATCH = 50;

export interface ScrobbleResponseParseResult {
  accepted: number;
  ignoredIndexes: Set<number>;
  /** Bagian dari ignoredIndexes yang penyebabnya TRANSIEN (kode 5 = batas harian) -> boleh dicoba
   *  ulang nanti. Kode 1-4 permanen (artist kosong/timestamp dsb.) TIDAK masuk sini. */
  retryableIndexes: Set<number>;
}

/**
 * Parse respons track.scrobble dari Last.fm. Saat mengirim >1 track, field `scrobble` berupa
 * array; saat hanya 1 track, Last.fm API mengembalikannya sebagai objek tunggal (bukan array
 * berisi 1 elemen) — kuirk yang cukup terkenal di API ini, jadi wajib dinormalisasi.
 *
 * `ignoredMessage.code` != "0" berarti track ditolak Last.fm. Kode 5 (batas harian) bersifat
 * SEMENTARA — track begitu boleh dicoba ulang; kode lain (1-4) permanen.
 */
export function parseScrobbleResponse(response: any, expectedCount: number): ScrobbleResponseParseResult {
  const raw = response?.scrobbles?.scrobble;
  const list: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const ignoredIndexes = new Set<number>();
  const retryableIndexes = new Set<number>();

  if (list.length === expectedCount) {
    list.forEach((item, i) => {
      const code = item?.ignoredMessage?.code;
      if (code !== undefined && code !== '0' && code !== 0) {
        ignoredIndexes.add(i);
        if (code === '5' || code === 5) retryableIndexes.add(i); // batas harian -> transien
      }
    });
  }
  // Kalau jumlah item respons tidak cocok (format tak terduga), jangan tebak-tebak —
  // anggap semua diterima daripada salah membuang data yang sebetulnya sukses.
  return { accepted: expectedCount - ignoredIndexes.size, ignoredIndexes, retryableIndexes };
}

/**
 * Pisahkan baris antrean menjadi yang LAYAK dikirim (attempts < maxAttempts) dan yang DIBUANG
 * (attempts >= maxAttempts, sudah terlalu sering gagal). Urutan asli dipertahankan di kedua
 * partisi supaya urutan/timestamp pengiriman tetap deterministik.
 */
export function partitionByAttempts<T extends { attempts: number }>(
  rows: T[],
  maxAttempts: number
): { toSend: T[]; toDrop: T[] } {
  const toSend: T[] = [];
  const toDrop: T[] = [];
  for (const r of rows) {
    if (r.attempts < maxAttempts) toSend.push(r);
    else toDrop.push(r);
  }
  return { toSend, toDrop };
}

/** Placeholder artist yang jelas bukan metadata sah (dinormalisasi lowercase). */
const UNSCROBBABLE_ARTISTS = new Set([
  'unknown',
  '<unknown>',
  'unknown artist',
  'tidak dikenal',
  'various artists',
]);

/**
 * Apakah pasangan artist/judul layak discrobble. Menolak metadata kosong, placeholder "tak
 * dikenal", dan judul yang sebenarnya content-URI / document-id (mis. "audio:123",
 * "content://…", "file://…", "audio%3A123") yang bocor dari beberapa pemutar. Titik dua biasa
 * di judul yang sah (mis. "Shooting Star: Reprise") tetap diterima.
 */
export function isScrobbableMetadata(artist: string, title: string): boolean {
  const a = (artist ?? '').trim();
  const t = (title ?? '').trim();
  if (!a || !t) return false;
  if (UNSCROBBABLE_ARTISTS.has(a.toLowerCase())) return false;
  if (/:\/\//.test(t)) return false; // content://, file://, http://
  if (/^audio\s*(%3a|:)/i.test(t)) return false; // audio:123, audio%3A123
  if (/%3a/i.test(t)) return false; // colon terenkode -> kemungkinan document-id
  return true;
}

/**
 * Apakah scrobble dari sebuah sumber (paket app) boleh dikirim, mengingat preferensi & daftar
 * blokir. Pemutar internal (com.scrola.app) SELALU boleh. Sumber eksternal butuh preferensi
 * "scrobble dari app lain" menyala DAN paketnya tidak diblokir.
 */
export function shouldScrobbleSource(
  pkg: string | undefined,
  externalEnabled: boolean,
  blocked: string[]
): boolean {
  if (pkg === 'com.scrola.app') return true;
  if (!externalEnabled) return false;
  if (pkg && blocked.includes(pkg)) return false;
  return true;
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
