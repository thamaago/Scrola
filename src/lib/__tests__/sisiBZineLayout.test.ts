import { describe, it, expect } from 'vitest';
import { weekRangeLabel, dayBarHeights, peakHourLabel, DAY_LABELS_ID, zineSerial } from '../sisiBZineLayout';

// Bangun weekStart sebagai unix-detik dari komponen tanggal LOKAL, supaya deterministik di TZ
// runner apa pun (konstruksi & pembacaan sama-sama lokal). Cocok dengan startOfIsoWeek yang juga
// menghasilkan tengah-malam lokal hari Senin.
const wk = (y: number, mZeroIdx: number, d: number) =>
  Math.floor(new Date(y, mZeroIdx, d, 0, 0, 0, 0).getTime() / 1000);

describe('weekRangeLabel', () => {
  it('minggu dalam satu bulan: "11–17 Agu 2025"', () => {
    expect(weekRangeLabel(wk(2025, 7, 11))).toBe('11–17 Agu 2025');
  });

  it('minggu lintas bulan menampilkan kedua bulan: "29 Sep–5 Okt 2025"', () => {
    expect(weekRangeLabel(wk(2025, 8, 29))).toBe('29 Sep–5 Okt 2025');
  });

  it('minggu lintas tahun menampilkan kedua tahun: "29 Des 2025–4 Jan 2026"', () => {
    expect(weekRangeLabel(wk(2025, 11, 29))).toBe('29 Des 2025–4 Jan 2026');
  });
});

describe('dayBarHeights', () => {
  it('hari terbanyak = maxBarPx, proporsional untuk sisanya', () => {
    const h = dayBarHeights([0, 5, 10, 0, 0, 0, 0], 100);
    expect(h[2]).toBe(100); // 10 = puncak
    expect(h[1]).toBe(50); // 5 = separuh
    expect(h[0]).toBe(0); // 0 tetap 0
  });

  it('semua nol -> semua nol (tidak membagi dengan nol)', () => {
    expect(dayBarHeights([0, 0, 0, 0, 0, 0, 0], 100)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('membulatkan ke integer', () => {
    const h = dayBarHeights([1, 3, 0, 0, 0, 0, 0], 100);
    expect(Number.isInteger(h[0])).toBe(true);
    expect(h[0]).toBe(33); // 1/3 * 100
  });

  it('selalu 7 elemen', () => {
    expect(dayBarHeights([5], 100)).toHaveLength(7);
  });
});

describe('peakHourLabel', () => {
  it('jam valid -> rentang satu jam format Indonesia (titik)', () => {
    expect(peakHourLabel(21)).toBe('21.00–22.00');
  });

  it('jam 23 membungkus ke 00', () => {
    expect(peakHourLabel(23)).toBe('23.00–00.00');
  });

  it('null -> "—"', () => {
    expect(peakHourLabel(null)).toBe('—');
  });
});

describe('DAY_LABELS_ID', () => {
  it('Senin..Minggu, 7 label', () => {
    expect(DAY_LABELS_ID).toEqual(['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']);
  });
});

describe('zineSerial', () => {
  it('format SB-YYYY-Wnn-XXXX (suffix base36 huruf besar)', () => {
    expect(zineSerial(wk(2025, 7, 11))).toMatch(/^SB-2025-W\d{2}-[0-9A-Z]{4}$/);
  });

  it('deterministik: minggu yang sama -> serial yang sama (stabil saat dibagikan ulang)', () => {
    expect(zineSerial(wk(2025, 7, 11))).toBe(zineSerial(wk(2025, 7, 11)));
  });

  it('minggu berbeda -> serial berbeda', () => {
    expect(zineSerial(wk(2025, 7, 11))).not.toBe(zineSerial(wk(2025, 7, 18)));
  });
});
