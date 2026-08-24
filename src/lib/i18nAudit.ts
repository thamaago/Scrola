import {
  getDict,
  isPluralVariantKey,
  pluralGroupBase,
  LOCALE_PLURAL_CATEGORIES,
  DEFAULT_LOCALE,
  type Locale,
  type PluralCategory,
} from './i18n';

/**
 * i18nAudit.ts — jaga kelengkapan kamus antar-locale. Basis (id) adalah sumber kebenaran daftar
 * kunci; locale lain harus MENUTUPI semua kunci basis (boleh menerjemahkan, tak boleh menghilangkan
 * kunci) dan TIDAK boleh punya kunci ASING (typo / kunci basi yang tak akan pernah terpakai).
 *
 * Sadar-jamak: satu grup jamak di basis ditulis sebagai `${grup}.other` (id satu bentuk). Locale
 * target dianggap lengkap untuk grup itu bila menyediakan SEMUA kategori yang mungkin dihasilkan
 * aturan jamaknya (mis. en butuh `.one` DAN `.other`). Varian jamak apa pun yang grupnya dikenal
 * basis tidak dianggap asing.
 */

export interface AuditResult {
  /** Kunci basis yang tak tertutup oleh target (harus ditambahkan ke target). */
  missing: string[];
  /** Kunci di target yang tak dikenal basis (kemungkinan typo / basi). */
  extra: string[];
}

/**
 * Bandingkan dua kamus. `base` = kamus basis (id). `target` = kamus yang diperiksa.
 * `targetCategories` = kategori jamak yang mungkin dihasilkan locale target.
 */
export function auditDictionaries(
  base: Record<string, string>,
  target: Record<string, string>,
  targetCategories: PluralCategory[]
): AuditResult {
  // Grup jamak yang dikenal basis (dari kunci `${grup}.other`, atau varian jamak apa pun).
  const baseGroups = new Set<string>();
  for (const k of Object.keys(base)) {
    if (isPluralVariantKey(k)) baseGroups.add(pluralGroupBase(k));
  }

  // --- missing: telusuri kunci basis ---
  const missing: string[] = [];
  const seenMissing = new Set<string>();
  for (const k of Object.keys(base)) {
    if (isPluralVariantKey(k)) {
      const group = pluralGroupBase(k);
      for (const cat of targetCategories) {
        const need = `${group}.${cat}`;
        if (!(need in target) && !seenMissing.has(need)) {
          missing.push(need);
          seenMissing.add(need);
        }
      }
    } else if (!(k in target)) {
      missing.push(k);
    }
  }

  // --- extra: telusuri kunci target ---
  const extra: string[] = [];
  for (const k of Object.keys(target)) {
    if (k in base) continue;
    if (isPluralVariantKey(k) && baseGroups.has(pluralGroupBase(k))) continue; // varian jamak sah
    extra.push(k);
  }

  return { missing, extra };
}

/** Audit satu locale terhadap basis (id) memakai kamus & aturan jamak nyata. */
export function auditLocale(locale: Locale): AuditResult {
  const base = getDict(DEFAULT_LOCALE);
  const target = getDict(locale);
  const cats = LOCALE_PLURAL_CATEGORIES[locale] ?? ['other'];
  return auditDictionaries(base, target, cats);
}
