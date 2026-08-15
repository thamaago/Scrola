/**
 * corrections.ts — "belajar dari koreksi" (logika murni).
 *
 * Saat kamu memperbaiki entri Riwayat yang salah label, Scrola mengingat koreksinya sebagai ATURAN
 * dan menerapkannya otomatis ke scrobble serupa berikutnya. Ini versi Scrola yang lebih ramah dari
 * "regex edits" Pano Scrobbler: alih-alih menulis regex, kamu cukup mengedit sekali seperti biasa.
 *
 * Pencocokan berbasis (artist, track) yang dinormalisasi (case-insensitive, spasi dikolaps) —
 * KONSERVATIF (cocok persis), supaya tak pernah salah mengoreksi lagu lain yang kebetulan mirip.
 * Aturan bekerja pada nilai SETELAH cleanTrackMetadata (sama seperti yang tersimpan di Riwayat).
 */

export interface CorrectionRule {
  fromArtist: string;
  fromTrack: string;
  toArtist: string;
  toTrack: string;
}

export interface NamePair {
  artist: string;
  track: string;
}

/** Batas jumlah aturan tersimpan (aturan terbaru dipertahankan). */
export const MAX_CORRECTION_RULES = 500;

const SEP = '\u0000';

function norm(s: string): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Kunci pencocokan dari sepasang (artist, track). */
export function matchKey(artist: string, track: string): string {
  return norm(artist) + SEP + norm(track);
}

/** Apakah koreksi ini layak disimpan: benar-benar berubah & target tidak kosong. */
export function shouldRecordCorrection(from: NamePair, to: NamePair): boolean {
  if (!to.artist?.trim() || !to.track?.trim()) return false;
  return matchKey(from.artist, from.track) !== matchKey(to.artist, to.track);
}

/**
 * Sisipkan/replace aturan berdasarkan kunci `from`. Aturan lama dengan kunci sama dibuang; aturan
 * baru ditaruh di DEPAN (paling baru). Dibatasi MAX_CORRECTION_RULES. Murni (mengembalikan array
 * baru). Kalau `from == to` (dinormalisasi), tidak menambah apa pun (lihat shouldRecordCorrection).
 */
export function upsertRule(rules: CorrectionRule[], from: NamePair, to: NamePair): CorrectionRule[] {
  if (!shouldRecordCorrection(from, to)) return rules;
  const key = matchKey(from.artist, from.track);
  const next: CorrectionRule[] = [
    {
      fromArtist: from.artist,
      fromTrack: from.track,
      toArtist: to.artist,
      toTrack: to.track,
    },
    ...rules.filter((r) => matchKey(r.fromArtist, r.fromTrack) !== key),
  ];
  return next.slice(0, MAX_CORRECTION_RULES);
}

/** Terapkan aturan yang cocok (kalau ada) ke sepasang (artist, track). Murni. */
export function applyCorrection(input: NamePair, rules: CorrectionRule[]): NamePair {
  const key = matchKey(input.artist, input.track);
  for (const r of rules) {
    if (matchKey(r.fromArtist, r.fromTrack) === key) {
      return { artist: r.toArtist, track: r.toTrack };
    }
  }
  return input;
}

/**
 * Gabungkan aturan koreksi dari backup ke aturan lokal — NON-DESTRUKTIF: aturan lokal untuk kunci
 * `from` yang sama DIPERTAHANKAN (tidak ditimpa data masuk), aturan `from` baru ditambahkan. Dipakai
 * saat restore agar koreksi buatan pengguna ikut ter-backup tanpa menghapus yang sudah ada.
 */
export function mergeCorrections(local: CorrectionRule[], incoming: CorrectionRule[]): CorrectionRule[] {
  const keyOf = (r: CorrectionRule) => matchKey(r.fromArtist, r.fromTrack);
  const seen = new Set(local.map(keyOf));
  const merged = [...local];
  for (const r of incoming) {
    const k = keyOf(r);
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(r);
    }
  }
  return merged;
}
