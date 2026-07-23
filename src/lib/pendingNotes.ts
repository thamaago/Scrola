import { findRecentHistoryId, setHistoryNote } from './db/queries';
import { normalizeNoteForSave } from './noteLogic';

/**
 * pendingNotes.ts — menampung catatan yang ditulis SEBELUM barisnya ada di riwayat.
 *
 * MASALAH YANG DISELESAIKAN: catatan menempel pada satu baris riwayat, tapi baris itu baru
 * terbentuk setelah scrobble berhasil dikirim ke Last.fm. Padahal momen orang ingin menulis justru
 * saat lagunya sedang berjalan — jauh sebelum ambang scrobble tercapai, dan bisa jadi saat sedang
 * offline. Tanpa penampung ini, tombol catatan harus dimatikan sampai lagu tercatat, dan itu
 * membunuh seluruh gunanya.
 *
 * Alurnya: catatan disimpan di memori berkunci "artist::track", lalu DITERAPKAN secara
 * deterministik tepat setelah `addHistoryBatch()` menulis baris riwayat — bukan lewat penundaan
 * berbasis waktu yang rapuh.
 *
 * KETERBATASAN YANG DISADARI: penampung ini ada di memori, jadi catatan yang belum sempat
 * menempel akan hilang kalau app ditutup paksa sebelum scrobble terkirim. Memindahkannya ke tabel
 * DB tersendiri akan menutup celah ini; belum dilakukan karena menambah tabel + migrasi untuk
 * kasus yang relatif jarang, dan sebaiknya diputuskan setelah fitur ini terbukti dipakai.
 */

const pending = new Map<string, string>();

function keyOf(artist: string, track: string): string {
  return `${artist}::${track}`;
}

/**
 * Coba simpan catatan langsung ke riwayat; kalau barisnya belum ada, tahan sebagai tertunda.
 * @returns 'saved' kalau langsung tersimpan, 'pending' kalau ditahan menunggu scrobble.
 */
export async function saveOrHoldNote(
  artist: string,
  track: string,
  rawNote: string
): Promise<'saved' | 'pending'> {
  const note = normalizeNoteForSave(rawNote);
  const key = keyOf(artist, track);

  const historyId = await findRecentHistoryId(artist, track);
  if (historyId !== null) {
    await setHistoryNote(historyId, note);
    pending.delete(key); // jangan biarkan versi lama menimpa yang baru saja disimpan
    return 'saved';
  }

  if (note === null) {
    pending.delete(key);
  } else {
    pending.set(key, note);
  }
  return 'pending';
}

/** Catatan tertunda untuk lagu tertentu — supaya UI tetap menampilkan apa yang sudah diketik. */
export function getPendingNote(artist: string, track: string): string | null {
  return pending.get(keyOf(artist, track)) ?? null;
}

/**
 * Terapkan semua catatan tertunda yang barisnya kini sudah ada di riwayat.
 * Dipanggil tepat setelah riwayat ditulis oleh scrobbleEngine.
 */
export async function flushPendingNotes(): Promise<void> {
  if (pending.size === 0) return;

  for (const [key, note] of Array.from(pending.entries())) {
    const sep = key.indexOf('::');
    if (sep < 0) {
      pending.delete(key);
      continue;
    }
    const artist = key.slice(0, sep);
    const track = key.slice(sep + 2);
    try {
      const historyId = await findRecentHistoryId(artist, track);
      if (historyId !== null) {
        await setHistoryNote(historyId, note);
        pending.delete(key);
      }
      // Belum ada barisnya: biarkan tetap tertunda, coba lagi pada flush berikutnya.
    } catch (e) {
      // Jangan hapus dari penampung kalau gagal — catatan pengguna tidak boleh hilang diam-diam
      // hanya karena satu kegagalan tulis.
      console.warn('Gagal menerapkan catatan tertunda:', e);
    }
  }
}
