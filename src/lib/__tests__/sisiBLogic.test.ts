import { describe, it, expect } from 'vitest';
import {
  computeSisiBStats,
  startOfIsoWeek,
  formatDurationHuman,
  type SisiBRow,
} from '../sisiBLogic';

// Senin 6 Juli 2026 00:00 waktu lokal sebagai awal minggu acuan.
const WEEK_START = Math.floor(new Date(2026, 6, 6, 0, 0, 0).getTime() / 1000);
const DAY = 86400;

function r(artist: string, track: string, dayOffset: number, hour: number, duration = 200): SisiBRow {
  return { artist, track, timestamp: WEEK_START + dayOffset * DAY + hour * 3600, duration };
}

describe('computeSisiBStats', () => {
  it('menghitung top artist & top track berdasarkan jumlah putar', () => {
    const rows = [
      r('Hindia', 'Membasuh', 0, 10),
      r('Hindia', 'Membasuh', 1, 11),
      r('Hindia', 'Evaluasi', 2, 12),
      r('Dere', 'Berlari', 3, 13),
    ];
    const stats = computeSisiBStats(rows, new Set(), WEEK_START);
    expect(stats.topArtist).toBe('Hindia');
    expect(stats.topTrack?.track).toBe('Membasuh');
    expect(stats.topTrack?.playCount).toBe(2);
    expect(stats.totalTracks).toBe(4);
    expect(stats.totalArtists).toBe(2);
  });

  it('menghitung dayCounts pada indeks hari yang benar (0=Senin)', () => {
    const rows = [r('A', 'x', 0, 9), r('A', 'y', 0, 21), r('B', 'z', 3, 14)];
    const stats = computeSisiBStats(rows, new Set(), WEEK_START);
    expect(stats.dayCounts[0]).toBe(2); // Senin
    expect(stats.dayCounts[3]).toBe(1); // Kamis
    expect(stats.dayCounts.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('menghitung artis baru: yang TIDAK ada di daftar sebelum minggu ini', () => {
    const rows = [r('Lama', 'x', 0, 9), r('Baru1', 'y', 1, 9), r('Baru2', 'z', 2, 9)];
    const stats = computeSisiBStats(rows, new Set(['Lama']), WEEK_START);
    expect(stats.newArtistCount).toBe(2);
  });

  it('menemukan jam puncak', () => {
    const rows = [r('A', 'a', 0, 22), r('B', 'b', 1, 22), r('C', 'c', 2, 8)];
    const stats = computeSisiBStats(rows, new Set(), WEEK_START);
    expect(stats.peakHour).toBe(22);
  });

  it('menjumlahkan durasi, memperlakukan durasi kosong sebagai 0', () => {
    const rows: SisiBRow[] = [
      r('A', 'a', 0, 9, 300),
      { artist: 'B', track: 'b', timestamp: WEEK_START + 3600 }, // tanpa duration
    ];
    const stats = computeSisiBStats(rows, new Set(), WEEK_START);
    expect(stats.totalDurationSec).toBe(300);
  });

  it('aman untuk minggu kosong: semua nol/null, tidak crash', () => {
    const stats = computeSisiBStats([], new Set(), WEEK_START);
    expect(stats.topArtist).toBeNull();
    expect(stats.topTrack).toBeNull();
    expect(stats.peakHour).toBeNull();
    expect(stats.totalTracks).toBe(0);
    expect(stats.dayCounts).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('startOfIsoWeek', () => {
  it('Rabu -> mundur ke Senin minggu yang sama', () => {
    const wed = new Date(2026, 6, 8, 15, 30); // Rabu 8 Jul 2026
    const start = startOfIsoWeek(wed);
    expect(start.getDay()).toBe(1); // Senin
    expect(start.getDate()).toBe(6);
    expect(start.getHours()).toBe(0);
  });

  it('Minggu -> mundur 6 hari ke Senin (bukan maju)', () => {
    const sun = new Date(2026, 6, 12, 10, 0); // Minggu 12 Jul 2026
    const start = startOfIsoWeek(sun);
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(6);
  });

  it('Senin -> tetap Senin yang sama (jam direset ke 00:00)', () => {
    const mon = new Date(2026, 6, 6, 23, 59);
    const start = startOfIsoWeek(mon);
    expect(start.getDate()).toBe(6);
    expect(start.getHours()).toBe(0);
  });
});

describe('formatDurationHuman', () => {
  it('format menit saja di bawah 1 jam', () => {
    expect(formatDurationHuman(35 * 60)).toBe('35 menit');
  });
  it('format jam bulat tanpa menit', () => {
    expect(formatDurationHuman(2 * 3600)).toBe('2 jam');
  });
  it('format jam + menit', () => {
    expect(formatDurationHuman(6 * 3600 + 12 * 60)).toBe('6 jam 12 menit');
  });
});
