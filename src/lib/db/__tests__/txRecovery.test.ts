import { describe, it, expect } from 'vitest';

/**
 * txRecovery.test.ts
 *
 * Model MURNI dari state machine transaksi @capacitor-community/sqlite 6.x (direplikasi dari sumber
 * native Database.java), dipakai untuk MENGUNCI logika pemulihan transaksi menggantung di db.ts.
 *
 * Kenapa model, bukan DB asli: yang mau diuji BUKAN SQLite-nya, melainkan DESYNC antara pembukuan
 * transaksi Android (`inTransaction()` = penghitung stack) dan state transaksi SQLite sebenarnya.
 * Desync inilah akar "cannot start a transaction within a transaction" yang terekam di perangkat.
 * Model dua-variabel (androidDepth vs sqliteInTx) menangkapnya tanpa perlu dependensi native.
 */

const NESTED = 'cannot start a transaction within a transaction';

/** Koneksi tiruan yang meniru persis semantik plugin di atas SQLiteDatabase Android. */
function makeConn() {
  let sqliteInTx = false; // kebenaran SQLite (autocommit off?)
  let androidDepth = 0; // pembukuan Android (_db.inTransaction())
  let successful = false;

  // ---- lapisan SQLiteDatabase Android ----
  const _dbBegin = () => {
    if (sqliteInTx) throw new Error(NESTED); // SQLite menolak BEGIN bersarang
    sqliteInTx = true;
    androidDepth = 1;
  };
  const _dbSetSuccess = () => {
    successful = true;
  };
  // Kunci desync: stack Android SELALU di-pop di finally, walau COMMIT ke SQLite gagal.
  const _dbEnd = (opts?: { commitFails?: boolean }) => {
    try {
      if (successful) {
        if (opts?.commitFails) throw new Error('commit failed'); // SQLite tetap in-transaction
        sqliteInTx = false;
      } else {
        sqliteInTx = false; // rollback
      }
    } finally {
      androidDepth = 0;
      successful = false;
    }
  };
  const inTx = () => androidDepth > 0;
  const rawExec = (sql: string) => {
    if (/^\s*BEGIN/i.test(sql)) {
      if (sqliteInTx) throw new Error(NESTED);
      sqliteInTx = true;
    } else if (/^\s*(ROLLBACK|COMMIT)/i.test(sql)) {
      if (!sqliteInTx) throw new Error('cannot rollback - no transaction is active');
      sqliteInTx = false;
    }
    // selain itu: DML/DDL biasa, tidak menyentuh flag
  };

  // ---- API plugin (persis dari Database.java) ----
  const beginTransaction = () => {
    if (inTx()) throw new Error('Already in transaction');
    _dbBegin();
  };
  const commitTransaction = (opts?: { commitFails?: boolean }) => {
    try {
      if (!inTx()) throw new Error('No transaction active');
      _dbSetSuccess();
    } finally {
      _dbEnd(opts);
    }
  };
  const execute = (statements: string[], transaction = true, opts?: { commitFails?: boolean }) => {
    try {
      if (transaction) beginTransaction();
      for (const s of statements) rawExec(s);
      if (transaction) commitTransaction(opts);
    } finally {
      if (transaction && inTx()) _dbEnd();
    }
  };
  const run = (stmt: string, transaction = true, opts?: { commitFails?: boolean }) => {
    try {
      if (transaction) beginTransaction();
      rawExec(stmt);
      if (transaction) commitTransaction(opts);
    } finally {
      if (transaction && inTx()) _dbEnd();
    }
  };
  const isTransactionActive = () => inTx();
  const rollbackTransaction = () => {
    if (inTx()) _dbEnd();
  };

  return {
    execute,
    run,
    isTransactionActive,
    rollbackTransaction,
    _peek: () => ({ sqliteInTx, androidDepth }),
  };
}

type Conn = ReturnType<typeof makeConn>;

// Replika runWriteWithRecovery dari db.ts (bentuk algoritmanya identik).
async function runWriteWithRecovery<T>(db: Conn, fn: () => T): Promise<T> {
  try {
    return fn();
  } catch (e) {
    if (/within a transaction|cannot start a transaction/i.test((e as Error).message)) {
      try {
        db.execute(['ROLLBACK;'], false); // unwrapped: langsung ke SQLite
      } catch {
        /* tidak ada yang perlu dibersihkan */
      }
      return fn();
    }
    throw e;
  }
}

/** Menghasilkan transaksi menggantung mid-session: sebuah tulisan yang COMMIT-nya gagal. */
function induceDangle(db: Conn) {
  try {
    db.run(`INSERT INTO t VALUES(1);`, true, { commitFails: true });
  } catch {
    /* diharapkan gagal; efek sampingnya: SQLite in-tx, Android depth 0 */
  }
}

const insert = (db: Conn) => db.run(`INSERT INTO t VALUES(2);`, true);

describe('desync transaksi Android vs SQLite', () => {
  it('COMMIT yang gagal meninggalkan SQLite in-transaction tapi stack Android 0 (desync)', () => {
    const db = makeConn();
    induceDangle(db);
    expect(db._peek()).toEqual({ sqliteInTx: true, androidDepth: 0 });
  });

  it('tulisan berikutnya gagal dengan error yang sama seperti di perangkat', () => {
    const db = makeConn();
    induceDangle(db);
    expect(() => insert(db)).toThrow(NESTED);
  });
});

describe('recovery yang SALAH (jadi acuan/negatif)', () => {
  it('isTransactionActive()/rollbackTransaction() BUTA terhadap desync — tidak membersihkan', () => {
    const db = makeConn();
    induceDangle(db);
    if (db.isTransactionActive()) db.rollbackTransaction(); // depth 0 -> tidak melakukan apa-apa
    expect(() => insert(db)).toThrow(NESTED); // masih gagal
  });

  it('ROLLBACK DIBUNGKUS (transaction=true) juga tidak membersihkan desync', () => {
    const db = makeConn();
    induceDangle(db);
    try {
      db.execute(['ROLLBACK;'], true);
    } catch {
      /* ditelan seperti kode lama */
    }
    expect(() => insert(db)).toThrow(NESTED); // masih gagal
  });
});

describe('recovery yang BENAR', () => {
  it('ROLLBACK UNWRAPPED (transaction=false) menutup transaksi menggantung', () => {
    const db = makeConn();
    induceDangle(db);
    db.execute(['ROLLBACK;'], false);
    expect(db._peek().sqliteInTx).toBe(false);
    expect(() => insert(db)).not.toThrow();
  });

  it('runWriteWithRecovery memulihkan dangle mid-session lalu tulisan berhasil', async () => {
    const db = makeConn();
    induceDangle(db);
    await expect(runWriteWithRecovery(db, () => insert(db))).resolves.toBeUndefined();
  });

  it('runWriteWithRecovery tidak merusak apa pun pada koneksi bersih', async () => {
    const db = makeConn();
    await expect(runWriteWithRecovery(db, () => insert(db))).resolves.toBeUndefined();
    expect(db._peek()).toEqual({ sqliteInTx: false, androidDepth: 0 });
  });

  it('error non-transaksi TIDAK dipulihkan diam-diam (harus diteruskan)', async () => {
    const db = makeConn();
    await expect(
      runWriteWithRecovery(db, () => {
        throw new Error('UNIQUE constraint failed');
      })
    ).rejects.toThrow('UNIQUE constraint');
  });
});
