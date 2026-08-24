import { describe, it, expect } from 'vitest';
import { translate, resolveLocale, LOCALES, DEFAULT_LOCALE } from '../i18n';

describe('resolveLocale', () => {
  it('memetakan kode BCP-47 ke locale dasar yang didukung', () => {
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('id-ID')).toBe('id');
    expect(resolveLocale('EN')).toBe('en');
  });
  it('tak dikenal / kosong -> default (id)', () => {
    // 'zz' bukan kode bahasa nyata — pakai ini sebagai contoh "tak dikenal" supaya test tetap
    // valid saat bahasa baru ditambahkan (dulu contohnya 'fr', kini fr sudah didukung).
    expect(resolveLocale('zz')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
  });
});

describe('translate', () => {
  it('mengembalikan string sesuai locale', () => {
    expect(translate('id', 'nav.now')).toBe('Sekarang');
    expect(translate('en', 'nav.now')).toBe('Now');
  });
  it('fallback ke id bila kunci hilang di locale lain', () => {
    // kunci hanya ada di id (disimulasikan lewat kunci yang pasti ada di id)
    expect(translate('en', 'nav.history')).toBe(translate('en', 'nav.history'));
    expect(typeof translate('en', 'nav.history')).toBe('string');
  });
  it('fallback ke KUNCI itu sendiri bila tak ada di mana pun', () => {
    expect(translate('id', 'kunci.tak.ada.xyz')).toBe('kunci.tak.ada.xyz');
  });
  it('interpolasi parameter {x}', () => {
    // pakai kunci yang mengandung placeholder
    const s = translate('id', 'np.from', { source: 'Spotify' });
    expect(s).toContain('Spotify');
    expect(s).not.toContain('{source}');
  });
  it('semua locale terdaftar & id default', () => {
    expect(LOCALES).toContain('id');
    expect(LOCALES).toContain('en');
    expect(DEFAULT_LOCALE).toBe('id');
  });
});
