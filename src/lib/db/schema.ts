import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
/**
 * schema.ts
 * Migrasi database bernomor untuk Scrola — pola sama dengan Strongbox
 * (v2: notes/field-kind, v3: favorites DEFAULT 0).
 *
 * Cara kerja: setiap migrasi punya `version` (harus naik berurutan, tanpa lompat) dan daftar
 * statement SQL yang dijalankan sekali saat versi database di device < version migrasi ini.
 * Versi tersimpan lewat PRAGMA user_version bawaan SQLite (lihat db.ts).
 */

export interface Migration {
  version: number;
  /** Daftar statement SQL statis. Pakai ini untuk migrasi sederhana. */
  statements?: string[];
  /** Fungsi migrasi yang bisa memeriksa kondisi DB dulu (untuk idempotensi). */
  statementsFn?: (db: SQLiteDBConnection) => Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS scrobble_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artist TEXT NOT NULL,
        track TEXT NOT NULL,
        album TEXT,
        album_artist TEXT,
        duration INTEGER,
        timestamp INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        UNIQUE(artist, track, timestamp)
      );`,
      `CREATE INDEX IF NOT EXISTS idx_scrobble_queue_timestamp ON scrobble_queue(timestamp);`,

      `CREATE TABLE IF NOT EXISTS scrobble_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artist TEXT NOT NULL,
        track TEXT NOT NULL,
        album TEXT,
        album_artist TEXT,
        duration INTEGER,
        timestamp INTEGER NOT NULL,
        loved INTEGER NOT NULL DEFAULT 0,
        source_package TEXT
      );`,
      `CREATE INDEX IF NOT EXISTS idx_scrobble_history_timestamp ON scrobble_history(timestamp DESC);`,
    ],
  },
  {
    version: 2,
    // Ditulis sebagai fungsi supaya bisa memeriksa dulu apakah kolom sudah ada — melindungi dari
    // database yang terlanjur setengah-termigrasi oleh versi buggy sebelumnya (PRAGMA user_version
    // di dalam transaksi yang diabaikan, sehingga v2 pernah jalan tapi versi tak naik). Tanpa
    // pengecekan ini, ALTER akan gagal "duplicate column name" dan mengunci seluruh DB.
    statementsFn: async (db: SQLiteDBConnection) => {
      const info = await db.query(`PRAGMA table_info(scrobble_history);`);
      const hasNote = (info.values ?? []).some((col: any) => col.name === 'note');
      if (!hasNote) {
        await db.execute(`ALTER TABLE scrobble_history ADD COLUMN note TEXT;`);
      }
    },
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
