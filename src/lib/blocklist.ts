/**
 * blocklist.ts — daftar blokir sumber (per paket app), logika murni.
 *
 * Kelemahan warisan pendekatan NotificationListener (dan diakui Pano): tak ada cara pasti
 * membedakan musik dari non-musik hanya dari metadata. Solusi praktis: biarkan pengguna MEMBLOKIR
 * app yang menghasilkan scrobble sampah (podcast, video, game, browser). Scrobble dari paket
 * terblokir dilewati saat penyerapan (drain) — pola sama dengan preferensi "scrobble dari app lain".
 */

/** Apakah sebuah paket sumber diblokir. Pencocokan persis (nama paket bersifat kanonik). */
export function isSourceBlocked(pkg: string | undefined, blocked: string[]): boolean {
  if (!pkg) return false;
  return blocked.includes(pkg);
}

/** Toggle status blokir sebuah paket. Murni (mengembalikan array baru, tanpa duplikat). */
export function toggleBlocked(blocked: string[], pkg: string): string[] {
  if (!pkg) return blocked;
  if (blocked.includes(pkg)) {
    return blocked.filter((p) => p !== pkg);
  }
  return [...blocked, pkg];
}
