import { describe, it, expect } from 'vitest';
import {
  computeBabStats,
  computeAlbumStats,
  peakBucket,
  startOfMonth,
  startOfYear,
} from '../babAlbumLogic';
import type { SisiBRow } from '../sisiBLogic';

// Timestamp aman-TZ: tengah hari UTC di tanggal tengah-periode, supaya pergeseran zona (±14 jam)
// tidak melintasi batas pekan/bulan. getDate()/getMonth() memakai waktu lokal.
const at = (y: number, m0: number, d: number) => Math.floor(Date.UTC(y, m0, d, 12, 0, 0) / 1000);

describe('computeBabStats — rekap bulanan', () => {
  it('agregasi inti: top artis/lagu, total, durasi, penemuan', () => {
    const rows: SisiBRow[] = [
      { artist: 'Hindia', track: 'Evaluasi', timestamp: at(2026, 6, 3), duration: 200 },
      { artist: 'Hindia', track: 'Evaluasi', timestamp: at(2026, 6, 10), duration: 200 },
      { artist: 'Feast', track: 'Peradaban', timestamp: at(2026, 6, 17), duration: 240 },
    ];
    const before = new Set<string>(['Hindia']); // Hindia sudah dikenal; Feast penemuan baru
    const s = computeBabStats(rows, before);
    expect(s.topArtist).toBe('Hindia');
    expect(s.topArtistPlayCount).toBe(2);
    expect(s.topTrack).toMatchObject({ artist: 'Hindia', track: 'Evaluasi', playCount: 2 });
    expect(s.totalTracks).toBe(3);
    expect(s.totalArtists).toBe(2);
    expect(s.totalDurationSec).toBe(640);
    expect(s.newArtistCount).toBe(1);
  });

  it('bucket tren per pekan dalam bulan (5 slot)', () => {
    const rows: SisiBRow[] = [3, 3, 10, 17, 24, 31].map((d, i) => ({
      artist: `A${i}`,
      track: `t${i}`,
      timestamp: at(2026, 6, d),
    }));
    const s = computeBabStats(rows, new Set());
    // hari 3&3 -> pekan0 (2), 10 -> pekan1, 17 -> pekan2, 24 -> pekan3, 31 -> pekan4
    expect(s.buckets).toEqual([2, 1, 1, 1, 1]);
  });

  it('riwayat kosong -> nol & null, bucket semua 0', () => {
    const s = computeBabStats([], new Set());
    expect(s.topArtist).toBeNull();
    expect(s.topTrack).toBeNull();
    expect(s.totalTracks).toBe(0);
    expect(s.buckets).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('computeAlbumStats — rekap tahunan', () => {
  it('bucket tren per bulan (12 slot)', () => {
    const rows: SisiBRow[] = [
      { artist: 'A', track: 't', timestamp: at(2026, 0, 15) }, // Jan
      { artist: 'B', track: 't', timestamp: at(2026, 0, 20) }, // Jan
      { artist: 'C', track: 't', timestamp: at(2026, 5, 15) }, // Jun
      { artist: 'D', track: 't', timestamp: at(2026, 11, 15) }, // Des
    ];
    const s = computeAlbumStats(rows, new Set());
    expect(s.buckets[0]).toBe(2);
    expect(s.buckets[5]).toBe(1);
    expect(s.buckets[11]).toBe(1);
    expect(s.buckets.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('menghitung penemuan tahunan relatif terhadap artis sebelum tahun ini', () => {
    const rows: SisiBRow[] = [
      { artist: 'Lama', track: 't', timestamp: at(2026, 1, 15) },
      { artist: 'Baru1', track: 't', timestamp: at(2026, 2, 15) },
      { artist: 'Baru2', track: 't', timestamp: at(2026, 3, 15) },
    ];
    const s = computeAlbumStats(rows, new Set(['Lama']));
    expect(s.newArtistCount).toBe(2);
    expect(s.totalArtists).toBe(3);
  });
});

describe('peakBucket', () => {
  it('mengembalikan indeks & nilai tertinggi', () => {
    expect(peakBucket([2, 9, 4])).toEqual({ index: 1, count: 9 });
  });
  it('seri pertama menang', () => {
    expect(peakBucket([5, 5, 3])).toEqual({ index: 0, count: 5 });
  });
  it('semua nol / kosong -> index -1', () => {
    expect(peakBucket([0, 0, 0])).toEqual({ index: -1, count: 0 });
    expect(peakBucket([])).toEqual({ index: -1, count: 0 });
  });
});

describe('startOfMonth / startOfYear', () => {
  it('awal bulan: tanggal 1, tengah malam lokal', () => {
    const d = startOfMonth(new Date(2026, 6, 27, 15, 30));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it('awal tahun: 1 Januari', () => {
    const d = startOfYear(new Date(2026, 6, 27));
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});
