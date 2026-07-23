import { describe, it, expect } from 'vitest';
import { positionFromTouch, progressRatio, formatMs } from '../seekLogic';

describe('positionFromTouch', () => {
  it('memetakan posisi sentuhan ke waktu secara proporsional', () => {
    expect(positionFromTouch(150, 100, 100, 200_000)).toBe(100_000);
    expect(positionFromTouch(100, 100, 100, 200_000)).toBe(0);
    expect(positionFromTouch(200, 100, 100, 200_000)).toBe(200_000);
  });

  it('membatasi sentuhan di luar area timeline (jari melewati tepi saat menggeser)', () => {
    expect(positionFromTouch(20, 100, 100, 200_000)).toBe(0);
    expect(positionFromTouch(500, 100, 100, 200_000)).toBe(200_000);
  });

  it('mengembalikan 0 (bukan NaN/Infinity) untuk lebar atau durasi tak valid', () => {
    // Lebar 0 terjadi pada render pertama sebelum elemen ter-layout. NaN yang lolos ke seekTo()
    // bisa membuat ExoPlayer melempar error.
    expect(positionFromTouch(150, 100, 0, 200_000)).toBe(0);
    expect(positionFromTouch(150, 100, 100, 0)).toBe(0);
    expect(positionFromTouch(150, 100, 100, -5)).toBe(0);
  });
});

describe('progressRatio', () => {
  it('menghitung rasio 0..1', () => {
    expect(progressRatio(100_000, 200_000)).toBe(0.5);
    expect(progressRatio(0, 200_000)).toBe(0);
  });

  it('aman terhadap durasi 0 dan posisi di luar rentang', () => {
    expect(progressRatio(5_000, 0)).toBe(0);
    expect(progressRatio(300_000, 200_000)).toBe(1);
    expect(progressRatio(-100, 200_000)).toBe(0);
  });
});

describe('formatMs', () => {
  it('memformat milidetik jadi m:ss', () => {
    expect(formatMs(215_000)).toBe('3:35');
    expect(formatMs(5_000)).toBe('0:05');
    expect(formatMs(60_000)).toBe('1:00');
  });

  it('mengembalikan 0:00 untuk nilai tak valid, bukan NaN:NaN', () => {
    expect(formatMs(NaN)).toBe('0:00');
    expect(formatMs(-5)).toBe('0:00');
    expect(formatMs(Infinity)).toBe('0:00');
  });
});
