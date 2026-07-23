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
  statements: string[];
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
    statements: [
      // Catatan pribadi per PEMUTARAN (bukan per lagu) — memutar lagu yang sama dua kali
      // menghasilkan dua tiket dengan cerita masing-masing, sesuai metafora tiket Scrola.
      //
      // PENTING: kolom ini SENGAJA tidak ditambahkan ke CREATE TABLE di v1. Kalau ditambahkan di
      // sana JUGA, instalasi baru akan membuat kolomnya di v1 lalu v2 gagal dengan "duplicate
      // column name" — karena ALTER TABLE tidak punya IF NOT EXISTS. Migrasi harus menceritakan
      // sejarah apa adanya, bukan keadaan akhir yang diinginkan.
      `ALTER TABLE scrobble_history ADD COLUMN note TEXT;`,
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
