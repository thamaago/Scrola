import { describe, it, expect } from 'vitest';
import {
  createQueue,
  currentTrack,
  currentItemIndex,
  orderedUris,
  isAtEnd,
  next,
  prev,
  jumpToItem,
  cycleRepeat,
  setRepeat,
  toggleShuffle,
  addToQueue,
  removeItem,
} from '../playbackQueue';

const ITEMS = ['a', 'b', 'c', 'd'];

describe('createQueue & dasar', () => {
  it('mulai di startIndex', () => {
    const q = createQueue(ITEMS, 1);
    expect(currentTrack(q)).toBe('b');
    expect(currentItemIndex(q)).toBe(1);
  });
  it('kosong -> position -1, currentTrack null', () => {
    const q = createQueue([]);
    expect(q.position).toBe(-1);
    expect(currentTrack(q)).toBeNull();
  });
  it('startIndex di-clamp', () => {
    expect(currentTrack(createQueue(ITEMS, 99))).toBe('d');
  });
});

describe('next / prev', () => {
  it('next maju biasa', () => {
    let q = createQueue(ITEMS, 0);
    q = next(q);
    expect(currentTrack(q)).toBe('b');
  });
  it('next di ujung, repeat off -> tetap (berhenti)', () => {
    let q = createQueue(ITEMS, 3);
    expect(isAtEnd(q)).toBe(true);
    q = next(q);
    expect(currentTrack(q)).toBe('d');
  });
  it('next di ujung, repeat all -> balik awal', () => {
    let q = setRepeat(createQueue(ITEMS, 3), 'all');
    q = next(q);
    expect(currentTrack(q)).toBe('a');
  });
  it('repeat one + auto -> tetap lagu sama', () => {
    let q = setRepeat(createQueue(ITEMS, 1), 'one');
    q = next(q, true);
    expect(currentTrack(q)).toBe('b');
  });
  it('repeat one + tekan tombol (bukan auto) -> tetap maju', () => {
    let q = setRepeat(createQueue(ITEMS, 1), 'one');
    q = next(q, false);
    expect(currentTrack(q)).toBe('c');
  });
  it('prev di awal repeat all -> ke akhir', () => {
    let q = setRepeat(createQueue(ITEMS, 0), 'all');
    q = prev(q);
    expect(currentTrack(q)).toBe('d');
  });
});

describe('jump & repeat cycle', () => {
  it('jumpToItem', () => {
    let q = createQueue(ITEMS, 0);
    q = jumpToItem(q, 2);
    expect(currentTrack(q)).toBe('c');
  });
  it('cycleRepeat off->all->one->off', () => {
    let q = createQueue(ITEMS);
    expect(q.repeat).toBe('off');
    q = cycleRepeat(q);
    expect(q.repeat).toBe('all');
    q = cycleRepeat(q);
    expect(q.repeat).toBe('one');
    q = cycleRepeat(q);
    expect(q.repeat).toBe('off');
  });
});

describe('shuffle', () => {
  const reverseShuffle = (arr: number[]) => [...arr].reverse();
  it('menyala: track saat ini tetap di depan, sisanya diacak', () => {
    let q = createQueue(ITEMS, 1); // current 'b' (item 1)
    q = toggleShuffle(q, reverseShuffle);
    expect(q.shuffle).toBe(true);
    expect(currentTrack(q)).toBe('b'); // tetap main
    expect(q.playOrder[0]).toBe(1); // 'b' di depan
    // sisanya [0,2,3] dibalik -> [3,2,0]
    expect(q.playOrder).toEqual([1, 3, 2, 0]);
    expect(orderedUris(q)).toEqual(['b', 'd', 'c', 'a']);
  });
  it('mati: kembali urutan asli, tetap di track yang sama', () => {
    let q = createQueue(ITEMS, 1);
    q = toggleShuffle(q, reverseShuffle);
    q = toggleShuffle(q, reverseShuffle);
    expect(q.shuffle).toBe(false);
    expect(q.playOrder).toEqual([0, 1, 2, 3]);
    expect(currentTrack(q)).toBe('b');
  });
});

describe('addToQueue', () => {
  it('menambah di akhir, current tetap', () => {
    let q = createQueue(ITEMS, 1);
    q = addToQueue(q, ['e', 'f']);
    expect(q.items).toHaveLength(6);
    expect(currentTrack(q)).toBe('b');
    expect(orderedUris(q)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
  it('menambah ke antrean kosong', () => {
    let q = createQueue([]);
    q = addToQueue(q, ['x']);
    expect(currentTrack(q)).toBe('x');
  });
});

describe('removeItem', () => {
  it('hapus sebelum current -> position turun, current sama', () => {
    let q = createQueue(ITEMS, 2); // current 'c'
    q = removeItem(q, 0); // hapus 'a'
    expect(currentTrack(q)).toBe('c');
    expect(q.items).toEqual(['b', 'c', 'd']);
  });
  it('hapus current -> pindah ke track berikutnya di slot sama', () => {
    let q = createQueue(ITEMS, 1); // current 'b'
    q = removeItem(q, 1); // hapus 'b'
    expect(q.items).toEqual(['a', 'c', 'd']);
    expect(currentTrack(q)).toBe('c');
  });
  it('hapus current terakhir -> clamp ke akhir baru', () => {
    let q = createQueue(ITEMS, 3); // current 'd'
    q = removeItem(q, 3);
    expect(currentTrack(q)).toBe('c');
  });
  it('hapus satu-satunya -> kosong', () => {
    let q = createQueue(['solo'], 0);
    q = removeItem(q, 0);
    expect(currentTrack(q)).toBeNull();
    expect(q.position).toBe(-1);
  });
});
