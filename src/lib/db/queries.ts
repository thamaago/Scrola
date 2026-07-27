import { getDb, runWriteWithRecovery } from './db';
import type { TrackInfo } from '../lastfm';
import {
  computeEarnedTickets,
  computeTicketProgress,
  sortTicketsForDisplay,
  type CollectibleTicket,
  type TicketProgress,
  type TicketRow,
} from '../ticketSerialLogic';

export interface QueuedRow extends TrackInfo {
  id: number;
  timestamp: number;
  attempts: number;
}

export interface HistoryRow {
  id: number;
  artist: string;
  track: string;
  album?: string;
  albumArtist?: string;
  timestamp: number;
  loved: boolean;
  sourcePackage?: string;
  /** Catatan pribadi pengguna untuk pemutaran ini. null = tidak ada catatan. */
  note?: string | null;
}

export async function addToQueue(track: TrackInfo & { timestamp: number }) {
  const db = await getDb();
  // INSERT OR IGNORE + constraint UNIQUE(artist, track, timestamp) di skema: kalau track yang
  // sama persis (judul, artist, DAN waktu mulai identik) sudah ada di antrean, penyisipan
  // diabaikan diam-diam alih-alih membuat baris duplikat. Ini jaring pengaman terakhir terhadap
  // scrobble ganda — melengkapi guard flag di useNowPlaying. Dua event dianggap "sama" hanya kalau
  // timestamp mulai-nya sama; memutar lagu yang sama LAGI di waktu berbeda tetap tercatat terpisah
  // (memang seharusnya begitu — itu dua kali dengar yang sah).
  // Dibungkus recovery: kalau koneksi terlanjur punya transaksi menggantung (desync Android/SQLite,
  // mis. warisan sebuah COMMIT batch yang gagal di flush sebelumnya), tulisan ini akan gagal dengan
  // "cannot start a transaction within a transaction". runWriteWithRecovery membersihkannya lalu
  // mengulang sekali — inilah titik yang persis gagal di log perangkat.
  await runWriteWithRecovery(
    () =>
      db.run(
        `INSERT OR IGNORE INTO scrobble_queue (artist, track, album, album_artist, duration, timestamp)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [track.artist, track.track, track.album ?? null, track.albumArtist ?? null, track.duration ?? null, track.timestamp]
      ),
    'addToQueue'
  );
}

export async function getQueueBatch(limit = 50): Promise<QueuedRow[]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT id, artist, track, album, album_artist as albumArtist, duration, timestamp, attempts
     FROM scrobble_queue ORDER BY timestamp ASC LIMIT ?;`,
    [limit]
  );
  return (res.values as QueuedRow[]) ?? [];
}

export async function removeFromQueue(ids: number[]) {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  await db.run(`DELETE FROM scrobble_queue WHERE id IN (${placeholders});`, ids);
}

export async function markQueueAttemptFailed(ids: number[], errorMessage: string) {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  await db.run(
    `UPDATE scrobble_queue SET attempts = attempts + 1, last_error = ? WHERE id IN (${placeholders});`,
    [errorMessage, ...ids]
  );
}

export async function queueLength(): Promise<number> {
  const db = await getDb();
  const res = await db.query(`SELECT COUNT(*) as count FROM scrobble_queue;`);
  return (res.values?.[0]?.count as number) ?? 0;
}

/**
 * Ringkasan antrean untuk panel diagnosis di Pengaturan.
 *
 * KENAPA PERLU: riwayat hanya menampilkan scrobble yang SUDAH berhasil terkirim. Kalau riwayat
 * kosong, ada tiga kemungkinan yang tampak identik dari luar: (1) lagu tak pernah memenuhi syarat
 * sehingga tak pernah masuk antrean, (2) masuk antrean tapi pengiriman gagal, (3) belum ada
 * deteksi sama sekali. Tanpa melihat isi antrean, ketiganya mustahil dibedakan dan perbaikan
 * apa pun hanya jadi tebakan. Query ini membuat perbedaannya terlihat.
 */
export async function getQueueStatus(): Promise<{
  pending: number;
  lastError: string | null;
  maxAttempts: number;
  oldestTimestamp: number | null;
}> {
  const db = await getDb();
  const res = await db.query(
    `SELECT COUNT(*) as pending,
            MAX(attempts) as maxAttempts,
            MIN(timestamp) as oldestTimestamp
     FROM scrobble_queue;`
  );
  const row = res.values?.[0] as
    | { pending: number; maxAttempts: number | null; oldestTimestamp: number | null }
    | undefined;

  // last_error diambil dari baris yang paling banyak gagal — itu yang paling informatif.
  const errRes = await db.query(
    `SELECT last_error FROM scrobble_queue
     WHERE last_error IS NOT NULL ORDER BY attempts DESC LIMIT 1;`
  );
  const lastError = (errRes.values?.[0]?.last_error as string | undefined) ?? null;

  return {
    pending: row?.pending ?? 0,
    lastError,
    maxAttempts: row?.maxAttempts ?? 0,
    oldestTimestamp: row?.oldestTimestamp ?? null,
  };
}

export async function addHistoryBatch(
  tracks: (TrackInfo & { timestamp: number; sourcePackage?: string })[]
) {
  if (tracks.length === 0) return;
  const db = await getDb();

  // Pakai executeSet() milik plugin, BUKAN `execute('BEGIN TRANSACTION')` manual. Plugin
  // mengelola transaksi (dan mode WAL) secara internal; menjalankan BEGIN manual menciptakan
  // transaksi bersarang yang ditolak SQLite ("cannot start a transaction within a transaction")
  // dan, kalau menggantung, menggagalkan SEMUA penulisan DB berikutnya. executeSet menjalankan
  // seluruh batch atomik dengan cara yang benar.
  const set = tracks.map((t) => ({
    statement: `INSERT INTO scrobble_history (artist, track, album, album_artist, duration, timestamp, source_package)
                VALUES (?, ?, ?, ?, ?, ?, ?);`,
    values: [
      t.artist,
      t.track,
      t.album ?? null,
      t.albumArtist ?? null,
      t.duration ?? null,
      t.timestamp,
      t.sourcePackage ?? null,
    ],
  }));
  // Sama seperti addToQueue: bungkus recovery supaya satu transaksi menggantung tidak menggagalkan
  // penulisan Riwayat (yang bikin "Riwayat kosong padahal scrobble terkirim").
  await runWriteWithRecovery(() => db.executeSet(set, /* transaction = */ true), 'addHistoryBatch');
}

export async function getHistory(limit = 100, offset = 0): Promise<HistoryRow[]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT id, artist, track, album, album_artist as albumArtist, timestamp, loved,
            source_package as sourcePackage, note
     FROM scrobble_history ORDER BY timestamp DESC LIMIT ? OFFSET ?;`,
    [limit, offset]
  );
  return ((res.values as any[]) ?? []).map((r) => ({ ...r, loved: !!r.loved }));
}

/**
 * Simpan (atau hapus) catatan pribadi pada SATU baris riwayat.
 * `note` null menghapus catatan — pemanggil wajib menormalkan lewat normalizeNoteForSave()
 * supaya string kosong tidak pernah tersimpan sebagai catatan.
 */
export async function setHistoryNote(historyId: number, note: string | null) {
  const db = await getDb();
  await db.run(`UPDATE scrobble_history SET note = ? WHERE id = ?;`, [note, historyId]);
}

/**
 * Cari baris riwayat TERBARU untuk sebuah lagu — dipakai saat pengguna menulis catatan dari layar
 * Sekarang, karena di sana yang diketahui hanya artis+judul, bukan id baris riwayat.
 *
 * Dibatasi pada 12 jam terakhir supaya catatan tidak salah menempel ke pemutaran lama lagu yang
 * sama dari berhari-hari lalu — itu akan merusak seluruh premis "satu tiket, satu momen".
 * Mengembalikan null kalau lagunya belum tercatat (belum melewati ambang scrobble).
 */
export async function findRecentHistoryId(
  artist: string,
  track: string,
  nowSec: number = Math.floor(Date.now() / 1000)
): Promise<number | null> {
  const db = await getDb();
  const res = await db.query(
    `SELECT id FROM scrobble_history
     WHERE artist = ? AND track = ? AND timestamp >= ?
     ORDER BY timestamp DESC LIMIT 1;`,
    [artist, track, nowSec - 12 * 3600]
  );
  return (res.values?.[0]?.id as number | undefined) ?? null;
}

export async function setLoved(historyId: number, loved: boolean) {
  const db = await getDb();
  await db.run(`UPDATE scrobble_history SET loved = ? WHERE id = ?;`, [loved ? 1 : 0, historyId]);
}

/** Hapus satu entri riwayat LOKAL. Tidak menyentuh Last.fm — API publik mereka tidak
 * menyediakan penghapusan scrobble (hanya bisa lewat situs web); UI wajib jujur soal ini. */
export async function deleteHistoryEntry(historyId: number) {
  const db = await getDb();
  await db.run(`DELETE FROM scrobble_history WHERE id = ?;`, [historyId]);
}

/** Edit metadata satu entri riwayat LOKAL (judul/artis/album). Alasan batas yang sama dengan
 * deleteHistoryEntry: scrobble yang sudah diterima Last.fm tidak bisa diubah lewat API publik. */
export async function updateHistoryEntry(
  historyId: number,
  fields: { artist: string; track: string; album?: string }
) {
  const db = await getDb();
  await db.run(`UPDATE scrobble_history SET artist = ?, track = ?, album = ? WHERE id = ?;`, [
    fields.artist,
    fields.track,
    fields.album ?? null,
    historyId,
  ]);
}

/** Baris riwayat dalam rentang waktu tertentu — dipakai Sisi B untuk rekap mingguan.
 * Sengaja mengambil baris MENTAH (bukan agregat SQL): semua penghitungan statistik dilakukan
 * oleh fungsi murni di `sisiBLogic.ts` yang bisa diunit-test. Lihat catatan di file itu. */
export async function getHistoryInRange(startSec: number, endSec: number) {
  const db = await getDb();
  const res = await db.query(
    `SELECT artist, track, album, duration, timestamp
     FROM scrobble_history WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC;`,
    [startSec, endSec]
  );
  return (res.values as { artist: string; track: string; album?: string; duration?: number; timestamp: number }[]) ?? [];
}

/** Daftar artis unik yang sudah pernah tercatat SEBELUM waktu tertentu — dipakai Sisi B untuk
 * menghitung "penemuan" (artis yang baru pertama kali muncul di minggu ini). */
export async function getDistinctArtistsBefore(beforeSec: number): Promise<Set<string>> {
  const db = await getDb();
  const res = await db.query(
    `SELECT DISTINCT artist FROM scrobble_history WHERE timestamp < ?;`,
    [beforeSec]
  );
  return new Set(((res.values as { artist: string }[]) ?? []).map((r) => r.artist));
}

/** Total scrobble tercatat lokal + tahun scrobble pertama — dipakai kartu "Backstage Pass".
 * Diambil dari DB lokal (bukan user.getInfo Last.fm) supaya tetap bekerja offline dan konsisten
 * dengan prinsip tanpa-telemetri: tidak perlu request tambahan hanya untuk menghias kartu akun. */
export async function getAccountStats(): Promise<{ totalScrobbles: number; firstYear: number | null }> {
  const db = await getDb();
  const res = await db.query(
    `SELECT COUNT(*) as total, MIN(timestamp) as firstTs FROM scrobble_history;`
  );
  const row = res.values?.[0] as { total: number; firstTs: number | null } | undefined;
  const total = row?.total ?? 0;
  const firstTs = row?.firstTs ?? null;
  return {
    totalScrobbles: total,
    firstYear: firstTs ? new Date(firstTs * 1000).getFullYear() : null,
  };
}

/**
 * Turunkan koleksi tiket + progres milestone LANGSUNG dari riwayat. Tiket adalah fungsi murni
 * deterministik dari riwayat (lihat ticketSerialLogic.ts), jadi tak ada tabel/state tersimpan —
 * cukup baca kolom ringan (artist, track, timestamp) untuk SELURUH riwayat secara kronologis lalu
 * hitung. Satu kali baca dipakai untuk keduanya supaya tidak query dua kali.
 */
export async function getTicketCollection(): Promise<{
  tickets: CollectibleTicket[];
  progress: TicketProgress;
}> {
  const db = await getDb();
  const res = await db.query(
    `SELECT artist, track, timestamp FROM scrobble_history ORDER BY timestamp ASC;`
  );
  const rows = ((res.values as TicketRow[]) ?? []).map((r) => ({
    artist: r.artist ?? '',
    track: r.track ?? '',
    timestamp: r.timestamp ?? 0,
  }));
  return {
    tickets: sortTicketsForDisplay(computeEarnedTickets(rows)),
    progress: computeTicketProgress(rows),
  };
}
