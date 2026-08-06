import { describe, it, expect } from 'vitest';
import { groupHistoryByDay } from '../historyGrouping';
import type { HistoryRow } from '../db/queries';

function row(id: number, timestamp: number): HistoryRow {
  return { id, artist: 'A', track: `T${id}`, timestamp, loved: false };
}

// Titik acuan tetap: 10 Juli 2026 15:00 waktu lokal — test tidak bergantung jam saat dijalankan.
const NOW = new Date(2026, 6, 10, 15, 0, 0);
const nowSec = Math.floor(NOW.getTime() / 1000);
const DAY = 86400;

describe('groupHistoryByDay', () => {
  it('mengelompokkan hari ini, kemarin, dan tanggal lama dengan label yang benar', () => {
    const items = [
      row(3, nowSec - 3600), // hari ini 14:00
      row(2, nowSec - DAY), // kemarin 15:00
      row(1, nowSec - 3 * DAY), // 7 Juli
    ];
    const groups = groupHistoryByDay(items, NOW);
    expect(groups).toHaveLength(3);
    expect(groups[0].label).toBe('Hari ini');
    expect(groups[1].label).toBe('Kemarin');
    expect(groups[2].label).toMatch(/07/); // "07 Jul"
  });

  it('menggabungkan beberapa lagu pada hari yang sama ke satu grup, urutan dipertahankan', () => {
    const items = [row(2, nowSec - 60), row(1, nowSec - 7200)];
    const groups = groupHistoryByDay(items, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.id)).toEqual([2, 1]);
  });

  it('lagu dini hari (00:30) vs larut malam kemarin (23:30) masuk grup BERBEDA', () => {
    // Ini kasus off-by-one klasik pengelompokan tanggal: selisih cuma 1 jam tapi beda hari.
    const todayMidnight = new Date(2026, 6, 10, 0, 30).getTime() / 1000;
    const lateYesterday = new Date(2026, 6, 9, 23, 30).getTime() / 1000;
    const groups = groupHistoryByDay([row(2, todayMidnight), row(1, lateYesterday)], NOW);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('Hari ini');
    expect(groups[1].label).toBe('Kemarin');
  });

  it('mengembalikan array kosong untuk input kosong', () => {
    expect(groupHistoryByDay([], NOW)).toEqual([]);
  });
});

// ---- Fitur baru: filter periode & catatan ----
import { groupHistoryByPeriod, filterHistoryWithNotes, recentHistory } from '../historyGrouping';

const rowN = (id: number, timestamp: number, note?: string | null): HistoryRow => ({
  id, artist: 'A', track: `T${id}`, timestamp, loved: false, note: note ?? null,
});

describe('groupHistoryByPeriod — week', () => {
  it('minggu ini vs minggu lalu vs lebih lama', () => {
    const items = [
      rowN(3, nowSec - 3600), // minggu ini
      rowN(2, nowSec - 8 * DAY), // ~minggu lalu
      rowN(1, nowSec - 40 * DAY), // jauh sebelumnya
    ];
    const g = groupHistoryByPeriod(items, 'week', NOW);
    expect(g[0].label).toBe('Minggu ini');
    expect(g[1].label).toBe('Minggu lalu');
    expect(g[2].label).not.toBe('Minggu ini');
    expect(g[2].label).not.toBe('Minggu lalu');
  });
});

describe('groupHistoryByPeriod — month', () => {
  it('bulan ini vs lebih lama diberi label bulan', () => {
    const items = [
      rowN(2, nowSec - 3600), // Juli 2026 (bulan NOW)
      rowN(1, Math.floor(new Date(2026, 4, 15).getTime() / 1000)), // Mei 2026
    ];
    const g = groupHistoryByPeriod(items, 'month', NOW);
    expect(g[0].label).toBe('Bulan ini');
    expect(g[1].label).toContain('Mei');
    expect(g[1].label).toContain('2026');
  });

  it("period 'day' mendelegasikan ke groupHistoryByDay", () => {
    const items = [rowN(1, nowSec - 3600)];
    expect(groupHistoryByPeriod(items, 'day', NOW)[0].label).toBe('Hari ini');
  });
});

describe('filterHistoryWithNotes', () => {
  it('hanya baris dengan catatan non-kosong', () => {
    const items = [rowN(1, 1, 'lagu penutup'), rowN(2, 2, ''), rowN(3, 3, null), rowN(4, 4, '  ')];
    expect(filterHistoryWithNotes(items).map((r) => r.id)).toEqual([1]);
  });
});

describe('recentHistory', () => {
  it('membatasi ke max (default 10), mempertahankan urutan', () => {
    const items = Array.from({ length: 25 }, (_, i) => rowN(i, 1000 - i));
    expect(recentHistory(items)).toHaveLength(10);
    expect(recentHistory(items, 3).map((r) => r.id)).toEqual([0, 1, 2]);
  });
  it('kurang dari max -> apa adanya', () => {
    expect(recentHistory([rowN(1, 1)], 10)).toHaveLength(1);
  });
});
