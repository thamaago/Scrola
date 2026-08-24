import { describe, it, expect } from 'vitest';
import {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_PLURAL_CATEGORIES,
  getDict,
  pluralCategory,
  isPluralVariantKey,
  pluralGroupBase,
  PLURAL_CATEGORIES,
} from '../i18n';
import { bcp47 } from '../i18nFormat';
import { auditLocale } from '../i18nAudit';

const NON_BASE = LOCALES.filter((l) => l !== DEFAULT_LOCALE);
const base = getDict(DEFAULT_LOCALE);

/** Ekstrak himpunan placeholder {nama} dari sebuah string. */
function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}
/** Hilangkan placeholder lalu cek apakah masih ada huruf (untuk deteksi teks belum diterjemahkan). */
function hasLetters(s: string): boolean {
  return /[A-Za-zÀ-ÿА-яЁёぁ-んァ-ヶ一-龯]/.test(s.replace(/\{\w+\}/g, ''));
}

describe('Kelengkapan i18n — registrasi tiap locale konsisten', () => {
  it('setiap LOCALE punya BCP-47, kamus, kategori jamak, & aturan jamak valid', () => {
    for (const loc of LOCALES) {
      expect(bcp47(loc), `bcp47 ${loc}`).toBeTruthy();
      expect(bcp47(loc), `bcp47 ${loc} format`).toMatch(/^[a-z]{2}(-[A-Za-z0-9]+)?$/);
      const dict = getDict(loc);
      expect(Object.keys(dict).length, `kamus ${loc} terisi`).toBeGreaterThan(250);
      const cats = LOCALE_PLURAL_CATEGORIES[loc];
      expect(cats, `kategori jamak ${loc}`).toBeTruthy();
      expect(cats.length).toBeGreaterThan(0);
      // pluralCategory harus menghasilkan kategori yang dideklarasikan
      for (const n of [0, 1, 2, 5, 11, 21, 22, 100]) {
        const c = pluralCategory(loc, n);
        expect(PLURAL_CATEGORIES, `${loc} n=${n} kategori sah`).toContain(c);
        expect(cats, `${loc} n=${n} kategori (${c}) dideklarasikan`).toContain(c);
      }
    }
  });
});

describe('Kelengkapan i18n — paritas penuh dengan basis (id)', () => {
  it('tiap locale non-basis menutup id tanpa kunci hilang / asing', () => {
    for (const loc of NON_BASE) {
      const { missing, extra } = auditLocale(loc);
      expect(missing, `${loc} kekurangan: ${missing.join(', ')}`).toEqual([]);
      expect(extra, `${loc} kunci asing: ${extra.join(', ')}`).toEqual([]);
    }
  });
});

describe('Kelengkapan i18n — paritas PLACEHOLDER (menangkap {count} hilang/typo)', () => {
  it('setiap terjemahan memakai persis placeholder yang sama dengan basis', () => {
    const problems: string[] = [];
    for (const key of Object.keys(base)) {
      if (isPluralVariantKey(key)) {
        // Tangani grup jamak sekali, dari kunci basis `.other`.
        if (!key.endsWith('.other')) continue;
        const group = pluralGroupBase(key);
        const ref = placeholders(base[key]);
        for (const loc of NON_BASE) {
          const dict = getDict(loc);
          for (const cat of LOCALE_PLURAL_CATEGORIES[loc]) {
            const k = `${group}.${cat}`;
            const val = dict[k];
            if (val == null) continue; // ditangani audit
            const got = placeholders(val);
            if (JSON.stringify(got) !== JSON.stringify(ref)) {
              problems.push(`${loc}:${k} punya {${got.join(',')}} ≠ basis {${ref.join(',')}}`);
            }
          }
        }
      } else {
        const ref = placeholders(base[key]);
        for (const loc of NON_BASE) {
          const val = getDict(loc)[key];
          if (val == null) continue;
          const got = placeholders(val);
          if (JSON.stringify(got) !== JSON.stringify(ref)) {
            problems.push(`${loc}:${key} punya {${got.join(',')}} ≠ basis {${ref.join(',')}}`);
          }
        }
      }
    }
    expect(problems, `Ketidakcocokan placeholder:\n${problems.join('\n')}`).toEqual([]);
  });
});

describe('Kelengkapan i18n — tidak ada teks tertinggal (belum diterjemahkan)', () => {
  it('tak ada nilai non-basis yang identik dgn id sambil mengandung huruf (kecuali yang wajar)', () => {
    // Kunci yang WAJAR bernilai identik antar-locale (nama bahasa, penutup kalimat, dsb.)
    const allowKey = (key: string) =>
      key.startsWith('lang.') || key === 'bab.hero.post' || key === 'bab.subtitle.post';
    // Nilai yang merupakan istilah internasional/serumpun — identik antar-bahasa itu WAJAR,
    // bukan tanda belum diterjemahkan (Album, Genre, Scrobble, dll.).
    const COGNATES = new Set(
      ['album', 'artist', 'album artist', 'genre', 'scrobble', 'serial'].map((s) => s)
    );
    const leftovers: string[] = [];
    for (const key of Object.keys(base)) {
      if (allowKey(key)) continue;
      const b = base[key];
      if (!hasLetters(b)) continue; // angka/simbol saja → identik itu wajar
      if (COGNATES.has(b.toLowerCase())) continue; // istilah serumpun
      for (const loc of NON_BASE) {
        const val = getDict(loc)[key];
        if (val != null && val === b) leftovers.push(`${loc}:${key} = "${b}"`);
      }
    }
    expect(leftovers, `Kemungkinan teks belum diterjemahkan:\n${leftovers.join('\n')}`).toEqual([]);
  });
});
