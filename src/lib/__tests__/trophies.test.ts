import { describe, it, expect } from 'vitest';
import { detectTrophies, TROPHY_DEFS } from '../trophies';

const DAY = 86400;
// helper: bikin row pada waktu lokal tertentu
const at = (y: number, mo: number, d: number, h: number, mi: number, artist = 'A', track = 't') => ({
  artist,
  track,
  timestamp: Math.floor(new Date(y, mo, d, h, mi, 0).getTime() / 1000),
});

describe('detectTrophies', () => {
  it('daftar trofi punya ordinal unik & berurutan', () => {
    const ords = TROPHY_DEFS.map((t) => t.ordinal);
    expect(new Set(ords).size).toBe(ords.length);
    expect(Math.min(...ords)).toBe(1);
  });

  it('Burung Hantu: scrobble larut malam (00–04)', () => {
    const hits = detectTrophies([at(2026, 0, 1, 14, 0), at(2026, 0, 1, 2, 30, 'X', 'malam')]);
    const t = hits.find((h) => h.def.id === 'burung_hantu');
    expect(t).toBeTruthy();
    expect(t!.row.track).toBe('malam');
  });

  it('Ayam Jago: scrobble subuh (04–06); tak ada bila siang saja', () => {
    expect(detectTrophies([at(2026, 0, 1, 5, 10)]).some((h) => h.def.id === 'ayam_jago')).toBe(true);
    expect(detectTrophies([at(2026, 0, 1, 12, 0)]).some((h) => h.def.id === 'ayam_jago')).toBe(false);
  });

  it('Maraton: >=30 scrobble dalam satu hari; 29 tidak', () => {
    const many = Array.from({ length: 30 }, (_, i) => at(2026, 0, 1, 8, i));
    expect(detectTrophies(many).some((h) => h.def.id === 'maraton')).toBe(true);
    const few = Array.from({ length: 29 }, (_, i) => at(2026, 0, 1, 8, i));
    expect(detectTrophies(few).some((h) => h.def.id === 'maraton')).toBe(false);
  });

  it('Jam Sibuk: >=15 scrobble dalam 60 menit', () => {
    const burst = Array.from({ length: 15 }, (_, i) => at(2026, 0, 1, 9, i * 3)); // 0..42 mnt
    expect(detectTrophies(burst).some((h) => h.def.id === 'jam_sibuk')).toBe(true);
  });

  it('Kembali Pulang: scrobble setelah jeda >=30 hari', () => {
    const rows = [at(2026, 0, 1, 10, 0), { artist: 'A', track: 'kembali', timestamp: Math.floor(new Date(2026, 0, 1, 10, 0).getTime() / 1000) + 31 * DAY }];
    const t = detectTrophies(rows).find((h) => h.def.id === 'kembali_pulang');
    expect(t).toBeTruthy();
    expect(t!.row.track).toBe('kembali');
  });

  it('Hari Beragam: >=20 artis berbeda dalam satu hari', () => {
    const rows = Array.from({ length: 20 }, (_, i) => at(2026, 0, 1, 8, i, `Artis${i}`, 't'));
    expect(detectTrophies(rows).some((h) => h.def.id === 'hari_beragam')).toBe(true);
    const rows2 = Array.from({ length: 19 }, (_, i) => at(2026, 0, 1, 8, i, `Artis${i}`, 't'));
    expect(detectTrophies(rows2).some((h) => h.def.id === 'hari_beragam')).toBe(false);
  });

  it('tiap trofi dicetak paling banyak sekali', () => {
    const rows = [at(2026, 0, 1, 2, 0), at(2026, 0, 2, 2, 0), at(2026, 0, 3, 2, 0)];
    const owl = detectTrophies(rows).filter((h) => h.def.id === 'burung_hantu');
    expect(owl).toHaveLength(1);
  });
});
