import { describe, it, expect } from 'vitest';
import { isSourceBlocked, toggleBlocked } from '../blocklist';

describe('isSourceBlocked', () => {
  it('true kalau paket ada di daftar', () => {
    expect(isSourceBlocked('com.podcast.app', ['com.podcast.app'])).toBe(true);
  });
  it('false kalau tidak ada / kosong / undefined', () => {
    expect(isSourceBlocked('com.spotify.music', ['com.podcast.app'])).toBe(false);
    expect(isSourceBlocked('com.spotify.music', [])).toBe(false);
    expect(isSourceBlocked(undefined, ['x'])).toBe(false);
  });
});

describe('toggleBlocked', () => {
  it('menambah kalau belum ada', () => {
    expect(toggleBlocked([], 'com.a')).toEqual(['com.a']);
  });
  it('membuang kalau sudah ada', () => {
    expect(toggleBlocked(['com.a', 'com.b'], 'com.a')).toEqual(['com.b']);
  });
  it('tidak menggandakan', () => {
    const r = toggleBlocked(['com.a'], 'com.a');
    expect(r).toEqual([]);
  });
  it('paket kosong diabaikan', () => {
    expect(toggleBlocked(['com.a'], '')).toEqual(['com.a']);
  });
});
