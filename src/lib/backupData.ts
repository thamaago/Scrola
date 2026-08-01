/**
 * backupData.ts — logika MURNI untuk backup/restore data buatan-pengguna (terutama CATATAN per-lagu
 * dan favorit) sebagai file JSON yang dipegang pengguna sendiri. Tanpa cloud, tanpa telemetri —
 * konsisten dgn positioning privasi Scrola: datamu tetap milikmu.
 *
 * Dipisah sebagai modul murni & teruji karena bagian TERPENTING dari fitur backup bukan tombolnya,
 * melainkan JAMINAN bahwa restore tidak pernah merusak/menimpa catatan yang sudah ada. `mergeBackup`
 * dirancang NON-DESTRUKTIF: hanya menambah (memulihkan catatan ke baris yang belum punya catatan,
 * menyisipkan baris yang hilang), tidak pernah mengosongkan/menimpa catatan lokal atau meng-unfavorite.
 */

export const BACKUP_VERSION = 1;
const BACKUP_TYPE = 'scrola-backup';

export interface BackupHistoryRow {
  artist: string;
  track: string;
  timestamp: number;
  album?: string | null;
  albumArtist?: string | null;
  durationSec?: number | null;
  sourcePackage?: string | null;
  note?: string | null;
  favorite?: boolean;
}

export interface LocalHistoryRow extends BackupHistoryRow {
  id: number;
}

export interface ParsedBackup {
  version: number;
  exportedAt: number;
  rows: BackupHistoryRow[];
}

export interface MergePlan {
  /** Baris yang tak ada padanannya di lokal — sisipkan utuh (mis. restore ke DB kosong). */
  toInsert: BackupHistoryRow[];
  /** Pulihkan catatan ke baris lokal yang cocok & BELUM punya catatan. */
  noteRestores: { id: number; note: string }[];
  /** Jadikan favorit baris lokal yang cocok (aditif). */
  favoriteRestores: number[];
  /** Jumlah baris yang catatan backup-nya BEDA dari catatan lokal yang sudah ada (lokal menang). */
  noteConflicts: number;
}

const hasText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Kunci alami sebuah putaran: artist + track + timestamp. */
function keyOf(r: { artist: string; track: string; timestamp: number }): string {
  return `${r.artist}\u0000${r.track}\u0000${r.timestamp}`;
}

/** Serialize daftar baris riwayat -> JSON backup ber-envelope & berversi. */
export function serializeBackup(rows: BackupHistoryRow[], exportedAtSec: number): string {
  const noteCount = rows.filter((r) => hasText(r.note)).length;
  const favCount = rows.filter((r) => r.favorite).length;
  return JSON.stringify({
    app: 'scrola',
    type: BACKUP_TYPE,
    version: BACKUP_VERSION,
    exportedAt: exportedAtSec,
    counts: { history: rows.length, notes: noteCount, favorites: favCount },
    history: rows,
  });
}

/**
 * Parse & VALIDASI JSON backup. Melempar Error deskriptif kalau bukan backup Scrola yang valid —
 * lebih baik gagal jelas daripada menyuntik data sampah ke DB.
 */
export function parseBackup(json: string): ParsedBackup {
  let obj: any;
  try {
    obj = JSON.parse(json);
  } catch {
    throw new Error('File bukan JSON yang valid.');
  }
  if (!obj || obj.type !== BACKUP_TYPE) {
    throw new Error('File ini bukan backup Scrola.');
  }
  if (obj.version !== BACKUP_VERSION) {
    throw new Error(`Versi backup ${obj.version} tidak didukung (aplikasi memakai v${BACKUP_VERSION}).`);
  }
  if (!Array.isArray(obj.history)) {
    throw new Error('Backup rusak: daftar riwayat tidak ditemukan.');
  }
  const rows: BackupHistoryRow[] = obj.history.map((r: any, i: number) => {
    if (!hasText(r?.artist) || !hasText(r?.track) || typeof r?.timestamp !== 'number') {
      throw new Error(`Backup rusak: baris ke-${i + 1} tidak punya artist/track/timestamp yang sah.`);
    }
    return {
      artist: r.artist,
      track: r.track,
      timestamp: r.timestamp,
      album: r.album ?? null,
      albumArtist: r.albumArtist ?? null,
      durationSec: typeof r.durationSec === 'number' ? r.durationSec : null,
      sourcePackage: r.sourcePackage ?? null,
      note: hasText(r.note) ? r.note : null,
      favorite: r.favorite === true,
    };
  });
  return { version: obj.version, exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : 0, rows };
}

/**
 * Rencanakan restore NON-DESTRUKTIF dari `incoming` ke atas `local`. Tidak menyentuh DB — hanya
 * menghitung rencana yang lalu diterapkan pemanggil. Jaminan: tidak pernah menghapus/menimpa catatan
 * lokal yang sudah ada, tidak pernah meng-unfavorite.
 */
export function mergeBackup(local: LocalHistoryRow[], incoming: BackupHistoryRow[]): MergePlan {
  const byKey = new Map<string, LocalHistoryRow>();
  for (const l of local) byKey.set(keyOf(l), l);

  const plan: MergePlan = { toInsert: [], noteRestores: [], favoriteRestores: [], noteConflicts: 0 };

  for (const inc of incoming) {
    const match = byKey.get(keyOf(inc));
    if (!match) {
      plan.toInsert.push(inc);
      continue;
    }
    // Catatan: hanya pulihkan kalau incoming punya teks & lokal belum. Kalau dua-duanya ada & beda,
    // catat konflik dan biarkan lokal menang. Kalau incoming kosong, jangan pernah menyentuh lokal.
    if (hasText(inc.note)) {
      if (!hasText(match.note)) {
        plan.noteRestores.push({ id: match.id, note: inc.note });
      } else if (match.note!.trim() !== inc.note.trim()) {
        plan.noteConflicts += 1;
      }
    }
    // Favorit: aditif saja.
    if (inc.favorite && !match.favorite) {
      plan.favoriteRestores.push(match.id);
    }
  }
  return plan;
}
