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
