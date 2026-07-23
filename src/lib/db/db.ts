/**
 * db.ts
 * Koneksi database SQLite untuk Scrola via @capacitor-community/sqlite.
 *
 * Menjalankan migrasi bernomor dari schema.ts berdasarkan PRAGMA user_version,
 * pola yang sama seperti sistem migrasi Room di Strongbox tapi versi lebih ringan
 * (tanpa Room, langsung lewat SQL biasa) karena Scrola tidak butuh relasi kompleks.
 */
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { MIGRATIONS } from './schema';

const DB_NAME = 'scrola.db';
const sqlite = new SQLiteConnection(CapacitorSQLite);

let dbInstance: SQLiteDBConnection | null = null;
let initPromise: Promise<SQLiteDBConnection> | null = null;

async function runMigrations(db: SQLiteDBConnection) {
  const versionResult = await db.query('PRAGMA user_version;');
  const currentVersion = (versionResult.values?.[0]?.user_version as number) ?? 0;

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  for (const migration of pending) {
    await db.execute('BEGIN TRANSACTION;');
    try {
      for (const statement of migration.statements) {
        await db.execute(statement);
      }
      await db.execute(`PRAGMA user_version = ${migration.version};`);
      await db.execute('COMMIT;');
    } catch (e) {
      await db.execute('ROLLBACK;');
      throw new Error(`Migrasi v${migration.version} gagal: ${(e as Error).message}`);
    }
  }
}

export async function getDb(): Promise<SQLiteDBConnection> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

    // PENTING: retrieveConnection() mengembalikan koneksi yang SUDAH terbuka (skenario ini
    // terjadi kalau native side masih menyimpan koneksi lama sementara modul JS ini baru saja
    // di-reset, mis. WebView reload) — memanggil .open() lagi padanya berisiko error "database
    // already open" tergantung versi plugin. .open() hanya dipanggil untuk koneksi yang BENAR-BENAR
    // baru dibuat lewat createConnection().
    const db = isConn
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await (async () => {
          const created = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
          await created.open();
          return created;
        })();

    await runMigrations(db);

    dbInstance = db;
    return db;
  })();

  // Kalau inisialisasi GAGAL (mis. migrasi error, atau plugin native belum siap di web preview),
  // reset initPromise ke null supaya panggilan getDb() BERIKUTNYA mencoba lagi dari awal. Tanpa
  // ini, satu kegagalan awal akan "mengunci" promise yang sudah reject selamanya — setiap getDb()
  // selanjutnya mengembalikan kegagalan yang sama meski penyebabnya mungkin cuma sementara, dan
  // app tidak akan pernah bisa memuat data tanpa restart total.
  initPromise.catch(() => {
    initPromise = null;
  });

  return initPromise;
}

/** Dipanggil sekali saat app start (lihat main.tsx) supaya migrasi selesai sebelum UI butuh data. */
export async function initDb() {
  await getDb();
}
