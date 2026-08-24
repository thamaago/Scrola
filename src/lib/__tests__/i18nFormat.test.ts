import { describe, it, expect } from 'vitest';
import {
  bcp47,
  formatNumber,
  formatDate,
  formatMonth,
  formatDayMonthYear,
  formatWeekday,
} from '../i18nFormat';

describe('bcp47', () => {
  it('memetakan Locale ke tag BCP-47 penuh', () => {
    expect(bcp47('id')).toBe('id-ID');
    expect(bcp47('en')).toBe('en-US');
  });
});

describe('formatNumber', () => {
  it('memakai pemisah ribuan sesuai locale', () => {
    // id: titik sebagai pemisah ribuan; en: koma
    expect(formatNumber('id', 1234567)).toBe('1.234.567');
    expect(formatNumber('en', 1234567)).toBe('1,234,567');
  });
  it('mendukung opsi Intl (mis. minimumFractionDigits)', () => {
    expect(formatNumber('en', 3, { minimumFractionDigits: 2 })).toBe('3.00');
  });
});

describe('formatMonth', () => {
  it('nama bulan panjang per-locale (0 = Januari)', () => {
    expect(formatMonth('id', 0, 'long')).toBe('Januari');
    expect(formatMonth('en', 0, 'long')).toBe('January');
    expect(formatMonth('id', 4, 'long')).toBe('Mei');
  });
  it('nama bulan pendek per-locale', () => {
    expect(formatMonth('id', 0, 'short')).toBe('Jan');
    expect(formatMonth('en', 4, 'short')).toBe('May');
  });
  it('indeks di luar 0..11 dibungkus (defensif)', () => {
    // 12 -> Januari lagi; -1 -> Desember. Fungsi tak boleh melempar.
    expect(() => formatMonth('id', 12, 'long')).not.toThrow();
    expect(() => formatMonth('id', -1, 'long')).not.toThrow();
  });
});

describe('formatDate / formatDayMonthYear', () => {
  // Pakai tengah hari UTC supaya offset zona waktu apa pun tak menggeser tanggalnya.
  it('formatDayMonthYear konsisten dengan urutan locale', () => {
    const utc = Date.UTC(2024, 4, 9, 12); // 9 Mei 2024, 12:00 UTC
    expect(formatDayMonthYear('id', utc)).toBe('9 Mei 2024');
    expect(formatDayMonthYear('en', utc)).toBe('May 9, 2024');
  });
  it('menerima Date maupun epoch-ms', () => {
    const d = new Date(Date.UTC(2024, 0, 1, 12));
    expect(formatDayMonthYear('id', d)).toContain('2024');
    expect(formatDayMonthYear('id', d.getTime())).toContain('2024');
  });
  it('formatDate meneruskan opsi Intl kustom', () => {
    const utc = Date.UTC(2024, 4, 9, 12);
    expect(formatDate('en', utc, { year: 'numeric' })).toBe('2024');
  });
});

describe('formatWeekday (Senin-dulu)', () => {
  it('nama hari pendek per-locale, indeks 0 = Senin', () => {
    const idDays = [0, 1, 2, 3, 4, 5, 6].map((i) => formatWeekday('id', i, 'short'));
    expect(idDays).toEqual(['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']);
    expect(formatWeekday('en', 0, 'short')).toBe('Mon');
    expect(formatWeekday('en', 6, 'short')).toBe('Sun');
  });
  it('indeks di luar 0..6 dibungkus (tak melempar)', () => {
    expect(() => formatWeekday('id', 7, 'short')).not.toThrow();
    expect(formatWeekday('id', 7, 'short')).toBe(formatWeekday('id', 0, 'short'));
  });
});
