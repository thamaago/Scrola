import { describe, it, expect } from 'vitest';
import {
  truncateForCard,
  titleFontSize,
  formatDurationForCard,
  ticketNumber,
} from '../shareCardLayout';

describe('truncateForCard', () => {
  it('membiarkan teks pendek apa adanya', () => {
    expect(truncateForCard('Sorai', 20)).toBe('Sorai');
  });

  it('memotong teks panjang dengan elipsis', () => {
    expect(truncateForCard('Gala Bunga Matahari Yang Sangat Panjang', 20)).toBe('Gala Bunga Matahari…');
  });

  it('membuang spasi berlebih di ujung', () => {
    expect(truncateForCard('  Berlari  ', 20)).toBe('Berlari');
    // Potongan tidak boleh menyisakan spasi menggantung sebelum elipsis
    expect(truncateForCard('Halo dunia luas', 6)).toBe('Halo…');
  });

  it('menangani batas ekstrem tanpa error', () => {
    expect(truncateForCard('Panjang', 1)).toBe('…');
    expect(truncateForCard('', 10)).toBe('');
  });
});

describe('titleFontSize', () => {
  it('menyusut seiring panjang judul', () => {
    expect(titleFontSize('Sorai')).toBe(76);
    expect(titleFontSize('Gala Bunga Matahari!!')).toBe(64);
    expect(titleFontSize('a'.repeat(35))).toBe(54);
    expect(titleFontSize('a'.repeat(50))).toBe(46);
  });

  it('monoton tidak naik: judul lebih panjang tidak pernah dapat font lebih besar', () => {
    let prev = Infinity;
    for (let len = 1; len <= 60; len++) {
      const size = titleFontSize('a'.repeat(len));
      expect(size).toBeLessThanOrEqual(prev);
      prev = size;
    }
  });
});

describe('formatDurationForCard', () => {
  it('memformat detik jadi mm:ss', () => {
    expect(formatDurationForCard(215)).toBe('3:35');
    expect(formatDurationForCard(60)).toBe('1:00');
  });

  it('mengembalikan strip untuk durasi tak valid', () => {
    expect(formatDurationForCard(0)).toBe('—');
    expect(formatDurationForCard(-10)).toBe('—');
    expect(formatDurationForCard(NaN)).toBe('—');
  });
});

describe('ticketNumber', () => {
  it('membuat nomor 4 digit yang stabil untuk timestamp sama', () => {
    expect(ticketNumber(1700000042)).toBe('№0042');
    expect(ticketNumber(1700000042)).toBe(ticketNumber(1700000042));
  });

  it('tidak pernah menghasilkan angka negatif', () => {
    expect(ticketNumber(-5)).toBe('№0005');
  });
});
