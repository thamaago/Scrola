/**
 * noteLogic.ts — aturan catatan pribadi pada tiket, sebagai fungsi murni.
 *
 * Dipisah dari komponen & DB karena aturan panjang/normalisasi adalah tempat bug diam-diam
 * bersarang: emoji yang terpotong di tengah jadi karakter rusak, catatan berisi spasi saja yang
 * tersimpan sebagai "ada catatan", atau hitungan sisa karakter yang meleset dari yang sebenarnya
 * disimpan. Semua itu hanya terasa saat dipakai, bukan saat dibaca.
 */

/**
 * Batas panjang catatan. 140 dipilih bukan karena batasan teknis, tapi karena memaksa ringkas —
 * catatan ini coretan di balik tiket, bukan ulasan. Kalau batas ini diubah, ubah juga teks
 * bantuan di UI; jangan ada dua angka berbeda di dua tempat.
 */
export const NOTE_MAX_LENGTH = 140;

/**
 * Hitung panjang catatan sebagaimana MANUSIA melihatnya.
 *
 * `string.length` di JavaScript menghitung unit UTF-16, bukan karakter. Satu emoji seperti 🎧
 * berbobot 2, dan emoji majemuk (misalnya keluarga atau bendera) bisa jauh lebih besar. Kalau
 * pemotongan memakai .length mentah, emoji bisa terbelah jadi karakter rusak (�) — dan pengguna
 * melihat hitungan sisa yang tidak masuk akal ("kok tulis 1 emoji jatah berkurang 2?").
 * Intl.Segmenter menghitung grafem, yaitu satuan yang benar-benar dilihat mata.
 */
export function noteLength(text: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let n = 0;
    for (const _ of seg.segment(text)) n++;
    return n;
  }
  // Fallback untuk WebView lawas tanpa Intl.Segmenter: Array.from setidaknya menghitung code
  // point (emoji dasar jadi 1), lebih baik daripada .length walau belum sempurna untuk emoji
  // majemuk.
  return Array.from(text).length;
}

/** Sisa karakter yang boleh diketik. Negatif berarti sudah melebihi batas. */
export function remainingChars(text: string): number {
  return NOTE_MAX_LENGTH - noteLength(text);
}

/**
 * Potong catatan ke batas maksimum tanpa membelah emoji.
 * Dipakai sebagai jaring pengaman terakhir sebelum menyimpan — bukan pengganti pembatasan di UI.
 */
export function clampNote(text: string): string {
  if (noteLength(text) <= NOTE_MAX_LENGTH) return text;
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let out = '';
    let n = 0;
    for (const s of seg.segment(text)) {
      if (n >= NOTE_MAX_LENGTH) break;
      out += s.segment;
      n++;
    }
    return out;
  }
  return Array.from(text).slice(0, NOTE_MAX_LENGTH).join('');
}

/**
 * Siapkan catatan untuk disimpan ke DB.
 *
 * Mengembalikan `null` (bukan string kosong) untuk catatan kosong atau berisi spasi saja, supaya
 * kolom `note` konsisten: NULL = tidak ada catatan. Tanpa normalisasi ini, catatan yang dihapus
 * pengguna akan tersimpan sebagai "" dan seluruh UI harus mengecek dua kondisi berbeda untuk
 * hal yang sama — sumber bug "titik catatan muncul padahal catatannya kosong".
 */
export function normalizeNoteForSave(text: string | null | undefined): string | null {
  if (text == null) return null;
  const trimmed = clampNote(text).trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Apakah baris riwayat ini punya catatan yang berarti (untuk menampilkan penanda di UI). */
export function hasNote(note: string | null | undefined): boolean {
  return typeof note === 'string' && note.trim().length > 0;
}
