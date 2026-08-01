import { describe, it, expect } from 'vitest';
import { partitionByAttempts, MAX_SCROBBLE_BATCH } from '../scrobbleLogic';

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
