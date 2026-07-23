import { describe, it, expect } from 'vitest';
import {
  NOTE_MAX_LENGTH,
  noteLength,
  remainingChars,
  clampNote,
  normalizeNoteForSave,
  hasNote,
} from '../noteLogic';

describe('noteLength', () => {
  it('menghitung teks biasa per karakter', () => {
    expect(noteLength('Lagu ini')).toBe(8);
  });

  it('menghitung emoji sebagai SATU karakter, bukan dua unit UTF-16', () => {
    // string.length untuk '🎧' adalah 2 — kalau dipakai, pengguna melihat jatah berkurang 2
    // padahal hanya mengetik satu emoji.
    expect(noteLength('🎧')).toBe(1);
    expect(noteLength('Sore 🎧')).toBe(6);
  });

  it('menghitung emoji majemuk sebagai satu grafem', () => {
    expect(noteLength('👨‍👩‍👧')).toBe(1);
  });
});

describe('remainingChars', () => {
  it('menghitung sisa jatah', () => {
    expect(remainingChars('halo')).toBe(NOTE_MAX_LENGTH - 4);
    expect(remainingChars('')).toBe(NOTE_MAX_LENGTH);
  });

  it('bernilai negatif kalau melebihi batas', () => {
    expect(remainingChars('a'.repeat(150))).toBe(-10);
  });
});

describe('clampNote', () => {
  it('membiarkan catatan pendek apa adanya', () => {
    expect(clampNote('pendek')).toBe('pendek');
  });

  it('memotong tepat di batas', () => {
    expect(noteLength(clampNote('a'.repeat(200)))).toBe(NOTE_MAX_LENGTH);
  });

  it('TIDAK membelah emoji di batas (mencegah karakter rusak)', () => {
    const pas = 'a'.repeat(NOTE_MAX_LENGTH - 1) + '👨‍👩‍👧';
    expect(clampNote(pas)).toBe(pas);

    const lewat = 'a'.repeat(NOTE_MAX_LENGTH) + '👨‍👩‍👧';
    expect(clampNote(lewat)).toBe('a'.repeat(NOTE_MAX_LENGTH));
    expect(clampNote(lewat)).not.toContain('\uFFFD');
  });
});

describe('normalizeNoteForSave', () => {
  it('mengubah catatan kosong jadi null, bukan string kosong', () => {
    // NULL = tidak ada catatan. Kalau "" ikut tersimpan, seluruh UI harus mengecek dua kondisi
    // untuk hal yang sama — sumber bug "penanda catatan muncul padahal isinya kosong".
    expect(normalizeNoteForSave('')).toBeNull();
    expect(normalizeNoteForSave('   ')).toBeNull();
    expect(normalizeNoteForSave(null)).toBeNull();
    expect(normalizeNoteForSave(undefined)).toBeNull();
  });

  it('membuang spasi di ujung dan memotong yang kepanjangan', () => {
    expect(normalizeNoteForSave('  halo  ')).toBe('halo');
    expect(noteLength(normalizeNoteForSave('a'.repeat(300))!)).toBe(NOTE_MAX_LENGTH);
  });
});

describe('hasNote', () => {
  it('hanya menganggap ada catatan kalau isinya berarti', () => {
    expect(hasNote('x')).toBe(true);
    expect(hasNote('')).toBe(false);
    expect(hasNote('   ')).toBe(false);
    expect(hasNote(null)).toBe(false);
    expect(hasNote(undefined)).toBe(false);
  });
});
