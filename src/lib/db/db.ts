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

/**
 * Menutup transaksi SQLite yang menggantung akibat desync pembukuan Android vs SQLite (lihat
 * catatan panjang di getDb). Mengirim `ROLLBACK;` UNWRAPPED (transaction=false) langsung ke SQLite.
 *
 * Aman dipanggil kapan saja: kalau memang tidak ada transaksi terbuka, SQLite melempar
 * "cannot rollback - no transaction is active" yang kita telan diam-diam. Jangan diganti dengan
 * isTransactionActive()/rollbackTransaction() — keduanya membaca stack Android yang justru 0 saat
 * desync, jadi buta terhadap transaksi yang perlu ditutup.
 */
export async function clearDanglingTransaction(db: SQLiteDBConnection): Promise<void> {
  try {
    await db.execute('ROLLBACK;', false);
  } catch {
    // Normal: tidak ada transaksi menggantung untuk ditutup.
  }
}

/**
 * Menjalankan sebuah operasi TULIS dengan pemulihan otomatis dari transaksi menggantung.
 *
 * Kalau operasi gagal dengan "cannot start a transaction within a transaction" (gejala desync yang
 * bisa muncul di TENGAH sesi, mis. setelah sebuah COMMIT batch gagal), helper ini membersihkan
 * transaksi level-SQLite lalu MENGULANG operasi tepat satu kali. Error lain diteruskan apa adanya.
 *
 * Dipakai membungkus penulisan pada jalur scrobble (addToQueue, addHistoryBatch) supaya satu
 * transaksi menggantung tidak lagi mematikan seluruh pencatatan sampai app di-restart.
 */
export async function runWriteWithRecovery<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (/within a transaction|cannot start a transaction/i.test(msg)) {
      const db = await getDb();
      await clearDanglingTransaction(db);
      return await fn(); // ulang sekali setelah dibersihkan
    }
    throw e;
  }
}

async function runMigrations(db: SQLiteDBConnection) {
  const versionResult = await db.query('PRAGMA user_version;');
  const currentVersion = (versionResult.values?.[0]?.user_version as number) ?? 0;

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  for (const migration of pending) {
    // JANGAN membungkus migrasi dengan `BEGIN/COMMIT/ROLLBACK` sebagai statement manual.
    // @capacitor-community/sqlite sudah menjalankan setiap execute()/run() di dalam transaksinya
    // sendiri (lewat API transaksi Android `_db.beginTransaction()`). Menyisipkan perintah
    // transaksi mentah sebagai statement men-DESYNC pembukuan transaksi Android dari state SQLite
    // sebenarnya — dan sekali desync, penulisan berikutnya (addToQueue, addHistoryBatch) ditolak
    // dengan "cannot start a transaction within a transaction". (Itulah persisnya jebakan yang
    // dulu bikin "musik tidak tercatat"; lihat catatan panjang di getDb tentang ROLLBACK defensif.)
    //
    // Migrasi kita tidak butuh transaksi manual: tiap versi berisi operasi tunggal, dan ALTER
    // TABLE di SQLite tidak bisa di-rollback sebagian pun. Idempotensi ditangani di dalam
    // statementsFn (cek kolom sebelum ADD). PRAGMA user_version di-set setelah migrasi berhasil.
    try {
      if (typeof (migration as any).statementsFn === 'function') {
        await (migration as any).statementsFn(db);
      } else {
        for (const statement of (migration as any).statements ?? []) {
          await db.execute(statement);
        }
      }
    } catch (e) {
      throw new Error(`Migrasi v${migration.version} gagal: ${(e as Error).message}`);
    }
    // Set versi setelah migrasi berhasil — DENGAN transaction:false (autocommit, TIDAK dibungkus).
    // Kalau dibungkus auto-transaksi plugin, penulisan header user_version tidak selalu persist
    // (inilah akar bug lama "v2 jalan ulang tiap launch"), dan tiap pembungkusan menambah
    // permukaan risiko desync state transaksi Android vs SQLite. PRAGMA ini satu statement,
    // aman dijalankan langsung di autocommit.
    await db.execute(`PRAGMA user_version = ${migration.version};`, false);
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

    // Jaring pengaman transaksi menggantung — versi yang TERBUKTI benar lewat simulasi state
    // machine plugin (lihat src/lib/db/__tests__/txRecovery.test.ts).
    //
    // Duduk perkaranya (terverifikasi dari sumber native Database.java @capacitor-community/sqlite
    // 6.x): plugin mengelola transaksi lewat pembukuan Android `_db.inTransaction()` (sebuah
    // penghitung stack), TAPI COMMIT/ROLLBACK aktual dikirim ke SQLite terpisah. Kalau sebuah
    // COMMIT gagal di tengah (BUSY, constraint, dsb.), `endTransaction()` tetap men-DECREMENT
    // stack Android ke 0 padahal transaksi di SQLite MASIH terbuka. Sejak itu keduanya DESYNC:
    // Android pikir tidak ada transaksi, SQLite tahu masih ada. Penulisan berikutnya
    // (addToQueue -> run -> beginTransaction) mengeluarkan BEGIN saat SQLite masih in-transaction
    // -> "cannot start a transaction within a transaction". Query tetap jalan (tidak menyentuh
    // state transaksi) — persis pola log perangkat: Riwayat & status antrean kebaca, tulisan mati.
    //
    // Kenapa recovery ini pakai `execute('ROLLBACK;', /*transaction=*/false)` dan BUKAN
    // isTransactionActive()/rollbackTransaction(): dua API itu MEMBACA stack Android (=0 saat
    // desync), jadi BUTA terhadap transaksi level-SQLite dan gagal membersihkannya (terbukti di
    // simulasi). ROLLBACK unwrapped dikirim LANGSUNG ke SQLite tanpa menyentuh stack Android,
    // sehingga benar-benar menutup transaksi yang menggantung tanpa menambah desync baru.
    //
    // ATURAN MUTLAK: satu-satunya tempat BEGIN/COMMIT/ROLLBACK mentah boleh dipakai adalah recovery
    // unwrapped ini. Jangan pernah menaruh perintah transaksi mentah di dalam execute()/run() yang
    // DIBUNGKUS (transaction=true) — itulah yang bikin desync sejak awal.
    await clearDanglingTransaction(db);

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
