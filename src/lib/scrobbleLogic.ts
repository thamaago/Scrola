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
  // Subset dari ignoredIndexes yang penolakannya TRANSIEN (kode 5 = batas scrobble harian) —
  // boleh dicoba ulang nanti, jangan dibuang. Kode 1-4 permanen dan TIDAK masuk sini.
  retryableIndexes: Set<number>;
}

// Kode ignoredMessage yang bersifat sementara & layak retry. Per dok resmi Last.fm hanya kode 5
// (Daily scrobble limit exceeded); kode 1-4 (artist/track diabaikan, timestamp terlalu tua/baru)
// permanen.
const RETRYABLE_IGNORE_CODES = new Set(['5']);

/**
 * Parse respons track.scrobble dari Last.fm. Saat mengirim >1 track, field `scrobble` berupa
 * array; saat hanya 1 track, Last.fm API mengembalikannya sebagai objek tunggal (bukan array
 * berisi 1 elemen) — kuirk yang cukup terkenal di API ini, jadi wajib dinormalisasi.
 *
 * `ignoredMessage.code` != "0" berarti track ditolak Last.fm. Sebagian besar penolakan permanen
 * (artist/track diabaikan, timestamp di luar jendela) — buang. Tapi kode 5 (batas harian) hanya
 * sementara: kembalikan lewat `retryableIndexes` supaya pemanggil bisa menahannya di antrean.
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
        if (RETRYABLE_IGNORE_CODES.has(String(code))) retryableIndexes.add(i);
      }
    });
  }
  // Kalau jumlah item respons tidak cocok (format tak terduga), jangan tebak-tebak —
  // anggap semua diterima daripada salah membuang data yang sebetulnya sukses.
  return { accepted: expectedCount - ignoredIndexes.size, ignoredIndexes, retryableIndexes };
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

// Placeholder artist "tak dikenal" (berbagai bahasa/bentuk) — bukan artis sungguhan.
const UNKNOWN_ARTIST = new Set(['tidak dikenal', 'unknown', 'unknown artist', '<unknown>', 'artis tidak dikenal']);

/** Judul yang sebenarnya content-URI / document-id (fallback saat file lokal tak punya tag ID3). */
function looksLikeUriTitle(s: string): boolean {
  return /^(content|file|audio|https?):/i.test(s) || /%3a/i.test(s) || s.includes('://');
}

/**
 * Apakah pasangan (artist, track) layak di-scrobble ke Last.fm? Menolak metadata SAMPAH: artist
 * kosong / placeholder "tak dikenal", atau judul yang sebetulnya content-URI/document-id (mis.
 * file lokal tanpa tag ID3 → judul jatuh ke "audio%3A1000343174"). Mencegah mengotori profil
 * Last.fm pengguna dengan entri tak berarti sampai metadata jelas (mis. setelah diedit tag-nya).
 */
export function isScrobbableMetadata(artist: string | null | undefined, track: string | null | undefined): boolean {
  const a = (artist ?? '').trim();
  const t = (track ?? '').trim();
  if (a === '' || UNKNOWN_ARTIST.has(a.toLowerCase())) return false;
  if (t === '' || looksLikeUriTitle(t)) return false;
  return true;
}

/**
 * Keputusan MURNI: apakah sebuah sumber (aplikasi) boleh di-scrobble? Pemutar internal Scrola selalu
 * boleh (pengguna memilihnya langsung). Sumber eksternal butuh master toggle nyala DAN tidak ada di
 * daftar diabaikan. Dipakai untuk menyaring app non-musik (mis. menonton video di YouTube) secara
 * deterministik — karena audio vs video tak bisa dibedakan andal dari metadata notifikasi.
 */
export function shouldScrobbleSource(
  sourcePackage: string | undefined,
  externalAllowed: boolean,
  ignoredSources: string[]
): boolean {
  if (sourcePackage === 'com.scrola.app') return true;
  if (!externalAllowed) return false;
  if (sourcePackage && ignoredSources.includes(sourcePackage)) return false;
  return true;
}
