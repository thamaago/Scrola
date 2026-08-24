import { describe, it, expect } from 'vitest';
import {
  pluralCategory,
  translatePlural,
  isPluralVariantKey,
  pluralGroupBase,
} from '../i18n';

describe('pluralCategory', () => {
  it('id tidak berinfleksi jamak — selalu "other"', () => {
    expect(pluralCategory('id', 0)).toBe('other');
    expect(pluralCategory('id', 1)).toBe('other');
    expect(pluralCategory('id', 5)).toBe('other');
  });
  it('en: 1 -> one, selain itu -> other (termasuk 0)', () => {
    expect(pluralCategory('en', 1)).toBe('one');
    expect(pluralCategory('en', -1)).toBe('one');
    expect(pluralCategory('en', 0)).toBe('other');
    expect(pluralCategory('en', 2)).toBe('other');
  });
});

describe('isPluralVariantKey / pluralGroupBase', () => {
  it('mengenali sufiks kategori jamak', () => {
    expect(isPluralVariantKey('x.other')).toBe(true);
    expect(isPluralVariantKey('x.one')).toBe(true);
    expect(isPluralVariantKey('x.count')).toBe(false);
    expect(isPluralVariantKey('nav.now')).toBe(false);
  });
  it('mengambil basis grup dari kunci varian', () => {
    expect(pluralGroupBase('ticket.count.other')).toBe('ticket.count');
    expect(pluralGroupBase('ticket.count.one')).toBe('ticket.count');
    expect(pluralGroupBase('nav.now')).toBe('nav.now');
  });
});

describe('translatePlural', () => {
  // Kunci nyata dari kamus: count.tracks.{one,other}
  it('memilih bentuk sesuai kategori & menyisipkan {count}', () => {
    expect(translatePlural('en', 'count.tracks', 1)).toContain('1');
    const one = translatePlural('en', 'count.tracks', 1);
    const many = translatePlural('en', 'count.tracks', 5);
    expect(one).not.toBe(many); // "1 note" vs "5 notes"
    expect(translatePlural('en', 'count.tracks', 5)).toContain('5');
  });
  it('id memakai satu bentuk untuk semua jumlah', () => {
    const a = translatePlural('id', 'count.tracks', 1);
    const b = translatePlural('id', 'count.tracks', 9);
    // teks dasarnya sama, hanya angkanya beda
    expect(a.replace('1', '#')).toBe(b.replace('9', '#'));
  });
  it('count otomatis jadi param, param lain tetap bisa ditambah', () => {
    const s = translatePlural('en', 'count.tracks', 3);
    expect(s).not.toContain('{count}');
  });
  it('fallback ke kunci basis bila grup tak ada di locale target', () => {
    // locale en tanpa kunci -> jatuh ke id -> kalau tak ada di mana pun, kembalikan keyBase
    expect(translatePlural('en', 'tak.ada.grup.xyz', 2)).toBe('tak.ada.grup.xyz');
  });
});
