import { describe, it, expect } from 'vitest';
import {
  createTracker,
  applyEvent,
  playedMsUntil,
  thresholdMs,
  msUntilEligible,
  observedProgress,
} from '../playbackTimer';

describe('playbackTimer — kelayakan berbasis waktu berlalu', () => {
  it('menghitung ambang dari durasi (50% atau 240s)', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::x', isPlaying: true, durationSec: 200 }, 0);
    expect(thresholdMs(t)).toBe(100_000); // 50% dari 200s
    t = applyEvent(t, { trackKey: 'B::y', isPlaying: true, durationSec: 600 }, 0);
    expect(thresholdMs(t)).toBe(240_000); // dibatasi 240s
  });

  it('menghitung mundur berdasarkan waktu, BUKAN position — inti perbaikannya', () => {
    // Skenario yang gagal di arsitektur lama: lagu diputar lurus tanpa event tambahan.
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::x', isPlaying: true, durationSec: 200 }, 0);
    expect(msUntilEligible(t, 0)).toBe(100_000);
    expect(msUntilEligible(t, 60_000)).toBe(40_000);
    expect(msUntilEligible(t, 100_000)).toBe(0); // layak, tanpa perlu satu pun event tambahan
    expect(playedMsUntil(t, 90_000)).toBe(90_000);
  });

  it('menangani pause/resume: waktu jeda tidak dihitung', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'B::y', isPlaying: true, durationSec: 200 }, 0);
    t = applyEvent(t, { trackKey: 'B::y', isPlaying: false, durationSec: 200 }, 40_000); // pause di 40s
    expect(t.playedMs).toBe(40_000);
    expect(msUntilEligible(t, 60_000)).toBe(Infinity); // dijeda: tidak menghitung mundur

    t = applyEvent(t, { trackKey: 'B::y', isPlaying: true, durationSec: 200 }, 70_000); // resume di 70s
    // total main 40s + (now - 70s). Layak saat total = 100s -> now = 130s
    expect(msUntilEligible(t, 100_000)).toBe(30_000);
    expect(msUntilEligible(t, 130_000)).toBe(0);
  });

  it('mereset saat track berganti', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::x', isPlaying: true, durationSec: 200 }, 0);
    t = applyEvent(t, { trackKey: 'C::z', isPlaying: true, durationSec: 180 }, 50_000);
    expect(t.playedMs).toBe(0);
    expect(t.durationSec).toBe(180);
    expect(t.trackKey).toBe('C::z');
  });

  it('tidak pernah menganggap lagu di bawah 30 detik layak', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'D::s', isPlaying: true, durationSec: 20 }, 0);
    expect(thresholdMs(t)).toBe(0);
    expect(msUntilEligible(t, 999_999)).toBe(Infinity);
  });
});

describe('observedProgress — bar "Sedang Diamati" dari waktu berlalu', () => {
  it('durasi <= 30s ditandai tooShort, bar disembunyikan', () => {
    const p = observedProgress(20, 5_000);
    expect(p.tooShort).toBe(true);
    expect(p.thresholdSec).toBe(0);
    expect(p.progress).toBe(0);
    expect(p.eligible).toBe(false);
  });

  it('setengah jalan menuju ambang -> progress 0.5, sisa waktu benar', () => {
    // durasi 200s -> ambang 100s. played 50s -> setengah.
    const p = observedProgress(200, 50_000);
    expect(p.thresholdSec).toBe(100);
    expect(p.progress).toBeCloseTo(0.5, 5);
    expect(p.remainingSec).toBe(50);
    expect(p.eligible).toBe(false);
  });

  it('mencapai ambang -> progress dijepit 1, sisa 0, eligible true', () => {
    const p = observedProgress(200, 100_000);
    expect(p.progress).toBe(1);
    expect(p.remainingSec).toBe(0);
    expect(p.eligible).toBe(true);
  });

  it('lewat ambang tidak membuat progress > 1 (dijepit)', () => {
    const p = observedProgress(200, 250_000);
    expect(p.progress).toBe(1);
    expect(p.remainingSec).toBe(0);
    expect(p.eligible).toBe(true);
  });

  it('lagu panjang memakai ambang 240s, bukan 50%', () => {
    // durasi 600s -> 50% = 300s, tapi dibatasi 240s.
    const p = observedProgress(600, 120_000); // played 120s dari ambang 240s
    expect(p.thresholdSec).toBe(240);
    expect(p.progress).toBeCloseTo(0.5, 5);
    expect(p.remainingSec).toBe(120);
  });

  it('remainingSec dibulatkan ke atas (tidak pernah menampilkan 0 sebelum benar-benar layak)', () => {
    const p = observedProgress(200, 99_500); // 0.5s tersisa
    expect(p.remainingSec).toBe(1);
    expect(p.eligible).toBe(false);
  });
});
