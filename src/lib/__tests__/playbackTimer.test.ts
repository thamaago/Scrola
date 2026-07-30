import { describe, it, expect } from 'vitest';
import {
  createTracker,
  applyEvent,
  playedMsUntil,
  thresholdMs,
  thresholdMsForDuration,
  msUntilEligible,
  isRepeatEvent,
  observedProgress,
  UNKNOWN_DURATION_FALLBACK_SEC,
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

describe('deteksi lagu diulang (repeat)', () => {
  it('bukan repeat kalau tidak sedang playing', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200 }, 0);
    // sudah layak (>=100s) tapi paused
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: false, durationSec: 200 }, 120_000);
    expect(isRepeatEvent(t, 0, false, 130_000)).toBe(false);
  });

  it('bukan repeat kalau posisi belum kembali ke awal', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200 }, 0);
    expect(isRepeatEvent(t, 50_000, true, 120_000)).toBe(false); // posisi 50s, bukan ~0
  });

  it('bukan repeat kalau putaran sebelumnya BELUM layak (rewind dini)', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200 }, 0); // ambang 100s
    // baru diputar 40s lalu di-rewind ke 0 -> belum layak -> jangan hitung ulang
    expect(isRepeatEvent(t, 0, true, 40_000)).toBe(false);
  });

  it('repeat kalau posisi ~0 dan putaran sebelumnya SUDAH layak', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200 }, 0); // ambang 100s
    expect(isRepeatEvent(t, 0, true, 205_000)).toBe(true); // sudah 205s (>100s), posisi balik ke 0
  });

  it('applyEvent me-reset tracker saat repeat terdeteksi (scrobble ulang mungkin)', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200, positionMs: 0 }, 0);
    // main lewat ambang lalu lagu berputar ulang (posisi ~0, now=205s)
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200, positionMs: 1_000 }, 205_000);
    // instance baru: played ~1s, dan msUntilEligible kembali mendekati ambang penuh
    expect(playedMsUntil(t, 205_000)).toBe(1_000);
    expect(msUntilEligible(t, 205_000)).toBe(99_000); // 100000 - 1000
  });

  it('rewind sebelum layak TIDAK me-reset (tetap satu putaran)', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200, positionMs: 0 }, 0);
    // rewind ke 0 di detik 40 (belum layak) -> harus lanjut akumulasi, bukan reset
    const before = playedMsUntil(t, 40_000);
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200, positionMs: 0 }, 40_000);
    expect(playedMsUntil(t, 40_000)).toBeGreaterThanOrEqual(before); // tidak turun ke ~0
  });
});

describe('seed posisi saat lagu terdeteksi di tengah pemutaran', () => {
  it('track baru dengan positionMs -> playedMs di-seed (bukan 0)', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200, positionMs: 60_000 }, 1_000);
    // playedMs awal = 60s; ditambah waktu berjalan sejak `now`
    expect(playedMsUntil(t, 1_000)).toBe(60_000);
    expect(playedMsUntil(t, 6_000)).toBe(65_000); // +5s berjalan
  });

  it('tanpa positionMs -> tetap mulai 0 (perilaku lama terjaga)', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200 }, 0);
    expect(playedMsUntil(t, 0)).toBe(0);
  });

  it('seed dibatasi durasi track (posisi tak mungkin > panjang lagu)', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: false, durationSec: 100, positionMs: 999_000 }, 0);
    expect(t.playedMs).toBe(100_000); // dipangkas ke 100s
  });

  it('durasi tak diketahui -> seed dibatasi ambang fallback 240s', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: false, durationSec: 0, positionMs: 999_000 }, 0);
    expect(t.playedMs).toBe(UNKNOWN_DURATION_FALLBACK_SEC * 1000);
  });

  it('lagu terdeteksi SUDAH lewat separuh -> langsung layak', () => {
    let t = createTracker();
    // durasi 200s -> ambang 100s. Terdeteksi di posisi 130s -> sudah lewat.
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200, positionMs: 130_000 }, 5_000);
    expect(msUntilEligible(t, 5_000)).toBe(0);
  });

  it('seed hanya saat track BARU, tidak diulang untuk event track sama', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200, positionMs: 60_000 }, 0);
    // event berikutnya untuk track sama membawa positionMs lain -> TIDAK me-reseed
    t = applyEvent(t, { trackKey: 'A::b', isPlaying: true, durationSec: 200, positionMs: 5_000 }, 10_000);
    expect(playedMsUntil(t, 10_000)).toBe(70_000); // 60s seed + 10s berjalan, bukan 5s
  });
});

describe('durasi tak dilaporkan — fallback 4 menit (tahan banting lintas pemutar)', () => {
  it('durationSec <= 0 memakai ambang 240 detik, BUKAN dianggap gagal', () => {
    expect(thresholdMsForDuration(0)).toBe(UNKNOWN_DURATION_FALLBACK_SEC * 1000);
    expect(thresholdMsForDuration(-1)).toBe(240_000);
  });

  it('membedakan "durasi tak diketahui" (0) dari "terlalu pendek" (0<dur<=30)', () => {
    expect(thresholdMsForDuration(20)).toBe(0); // benar-benar pendek: jangan scrobble
    expect(thresholdMsForDuration(0)).toBe(240_000); // tak dilaporkan: pakai 4 menit
  });

  it('tracker dengan durasi 0 tetap bisa layak setelah 4 menit diputar', () => {
    let t = createTracker();
    t = applyEvent(t, { trackKey: 'X::y', isPlaying: true, durationSec: 0 }, 0);
    expect(thresholdMs(t)).toBe(240_000);
    expect(msUntilEligible(t, 0)).toBe(240_000);
    expect(msUntilEligible(t, 180_000)).toBe(60_000);
    expect(msUntilEligible(t, 240_000)).toBe(0); // layak tepat di 4 menit
  });

  it('observedProgress dengan durasi 0: bar TAMPIL (bukan tooShort), pakai 240s', () => {
    const p = observedProgress(0, 120_000); // 2 menit dari 4 menit
    expect(p.tooShort).toBe(false);
    expect(p.thresholdSec).toBe(240);
    expect(p.progress).toBeCloseTo(0.5, 5);
    expect(p.remainingSec).toBe(120);
  });

  it('observedProgress durasi valid tapi <=30s TETAP tooShort (bar disembunyikan)', () => {
    const p = observedProgress(25, 10_000);
    expect(p.tooShort).toBe(true);
    expect(p.thresholdSec).toBe(0);
  });
});
