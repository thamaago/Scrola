import { describe, it, expect } from 'vitest';
import { auditDictionaries, auditLocale } from '../i18nAudit';
import { LOCALES, DEFAULT_LOCALE } from '../i18n';

describe('auditDictionaries (fungsi murni, pakai fixtures)', () => {
  const base = {
    'nav.now': 'Sekarang',
    'nav.history': 'Riwayat',
    'x.count.other': '{count} item',
  };

  it('mendeteksi kunci basis yang HILANG di target', () => {
    const target = { 'nav.now': 'Now' }; // kurang nav.history + x.count
    const { missing } = auditDictionaries(base, target, ['one', 'other']);
    expect(missing).toContain('nav.history');
    // grup jamak: target 'one'/'other' wajib ada keduanya
    expect(missing).toContain('x.count.one');
    expect(missing).toContain('x.count.other');
  });

  it('mendeteksi kunci ASING di target (tak dikenal basis)', () => {
    const target = {
      'nav.now': 'Now',
      'nav.history': 'History',
      'x.count.one': '{count} item',
      'x.count.other': '{count} items',
      'kunci.hantu': 'ghost', // tak ada di basis -> asing
    };
    const { extra } = auditDictionaries(base, target, ['one', 'other']);
    expect(extra).toContain('kunci.hantu');
    // varian jamak yang grupnya dikenal basis TIDAK dianggap asing
    expect(extra).not.toContain('x.count.one');
    expect(extra).not.toContain('x.count.other');
  });

  it('target lengkap -> missing & extra kosong', () => {
    const target = {
      'nav.now': 'Now',
      'nav.history': 'History',
      'x.count.one': '{count} item',
      'x.count.other': '{count} items',
    };
    const { missing, extra } = auditDictionaries(base, target, ['one', 'other']);
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });
});

describe('audit kamus NYATA proyek', () => {
  it('tidak ada kunci ASING di locale non-basis (jaga dari typo/kunci basi)', () => {
    for (const loc of LOCALES) {
      if (loc === DEFAULT_LOCALE) continue;
      const { extra } = auditLocale(loc);
      expect(extra, `locale ${loc} punya kunci asing: ${extra.join(', ')}`).toEqual([]);
    }
  });

  it('setiap locale non-basis LENGKAP menutupi basis id (tanpa kunci hilang)', () => {
    for (const loc of LOCALES) {
      if (loc === DEFAULT_LOCALE) continue;
      const { missing } = auditLocale(loc);
      expect(missing, `locale ${loc} kekurangan kunci: ${missing.join(', ')}`).toEqual([]);
    }
  });
});
