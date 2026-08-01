import { describe, it, expect } from 'vitest';
import { partitionByAttempts, MAX_SCROBBLE_BATCH, parseScrobbleResponse } from '../scrobbleLogic';

// Bentuk respons Last.fm: `scrobbles.scrobble` = objek saat 1 track, array saat banyak.
const resp = (codes: (string | number)[]) => ({
  scrobbles: {
    scrobble:
      codes.length === 1
        ? { ignoredMessage: { code: String(codes[0]) } }
        : codes.map((c) => ({ ignoredMessage: { code: String(c) } })),
  },
});

// Baris antrean minimal: hanya `attempts` yang relevan untuk partisi.
const row = (attempts: number, id = String(attempts)) => ({ id, attempts });

describe('MAX_SCROBBLE_BATCH', () => {
  it('sama dengan batas per-panggilan track.scrobble Last.fm (50)', () => {
    expect(MAX_SCROBBLE_BATCH).toBe(50);
  });
});

describe('partitionByAttempts', () => {
  it('baris di bawah maxAttempts masuk toSend, yang >= maxAttempts dibuang', () => {
    const rows = [row(0), row(7), row(8), row(9)];
    const { toSend, toDrop } = partitionByAttempts(rows, 8);
    expect(toSend.map((r) => r.attempts)).toEqual([0, 7]);
    expect(toDrop.map((r) => r.attempts)).toEqual([8, 9]);
  });

  it('mempertahankan urutan asli di kedua partisi (timestamp/urutan kirim tak boleh acak)', () => {
    const rows = [row(9, 'a'), row(1, 'b'), row(8, 'c'), row(2, 'd')];
    const { toSend, toDrop } = partitionByAttempts(rows, 8);
    expect(toSend.map((r) => r.id)).toEqual(['b', 'd']);
    expect(toDrop.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('semua layak -> toDrop kosong', () => {
    const { toSend, toDrop } = partitionByAttempts([row(0), row(1)], 8);
    expect(toSend).toHaveLength(2);
    expect(toDrop).toHaveLength(0);
  });

  it('semua beracun -> toSend kosong', () => {
    const { toSend, toDrop } = partitionByAttempts([row(8), row(10)], 8);
    expect(toSend).toHaveLength(0);
    expect(toDrop).toHaveLength(2);
  });

  it('array kosong -> dua partisi kosong (tidak melempar)', () => {
    const { toSend, toDrop } = partitionByAttempts([], 8);
    expect(toSend).toEqual([]);
    expect(toDrop).toEqual([]);
  });
});

describe('parseScrobbleResponse — kode transien vs permanen', () => {
  it('kode 5 (batas harian) transien: masuk ignored DAN retryable', () => {
    const { accepted, ignoredIndexes, retryableIndexes } = parseScrobbleResponse(resp(['0', '5', '1']), 3);
    expect(accepted).toBe(1); // hanya index 0 diterima
    expect([...ignoredIndexes].sort()).toEqual([1, 2]); // 5 dan 1 dua-duanya ignored
    expect([...retryableIndexes]).toEqual([1]); // hanya yang kode 5 boleh dicoba ulang
  });

  it('kode 1-4 permanen: ignored tapi TIDAK retryable', () => {
    const { ignoredIndexes, retryableIndexes } = parseScrobbleResponse(resp(['1', '2', '3', '4']), 4);
    expect([...ignoredIndexes].sort()).toEqual([0, 1, 2, 3]);
    expect(retryableIndexes.size).toBe(0);
  });

  it('semua kode 5 -> semua retryable, accepted 0', () => {
    const { accepted, retryableIndexes } = parseScrobbleResponse(resp(['5', '5']), 2);
    expect(accepted).toBe(0);
    expect([...retryableIndexes].sort()).toEqual([0, 1]);
  });

  it('kode 5 sebagai number juga terdeteksi', () => {
    const r = { scrobbles: { scrobble: [{ ignoredMessage: { code: 5 } }, { ignoredMessage: { code: 0 } }] } };
    const { retryableIndexes } = parseScrobbleResponse(r, 2);
    expect([...retryableIndexes]).toEqual([0]);
  });

  it('semua sukses -> ignored & retryable kosong', () => {
    const { accepted, ignoredIndexes, retryableIndexes } = parseScrobbleResponse(resp(['0', '0']), 2);
    expect(accepted).toBe(2);
    expect(ignoredIndexes.size).toBe(0);
    expect(retryableIndexes.size).toBe(0);
  });
});
