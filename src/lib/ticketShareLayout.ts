import type { CollectibleTicket } from './ticketSerialLogic';

/**
 * ticketShareLayout.ts — bagian MURNI (teruji) dari gambar tiket yang bisa dibagikan. Menghitung
 * hal-hal deterministik: seed pola guilloché (dari serial) & baris "lagu pemicu". Menggambarnya
 * sendiri ada di ticketShareImage.ts (Canvas, hanya berjalan di runtime WebView).
 *
 * Format berbagi = 9:16 (1080×1920) — pas untuk WhatsApp Status & Instagram Story, kanal berbagi
 * paling dominan di Indonesia. Atribusi (wordmark + URL + tagline) menyatu di gambar agar tiap
 * tiket yang dibagikan berfungsi sebagai iklan Scrola.
 */

/**
 * Seed deterministik non-negatif dari serial — dipakai untuk membangkitkan pola guilloche
 * (garis halus seperti uang kertas) yang UNIK per tiket tapi selalu sama untuk serial yang sama.
 * FNV-1a 32-bit sederhana.
 */
export function ticketPatternSeed(serial: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < serial.length; i++) {
    h ^= serial.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * Baris "lagu yang mencetak tiket ini" untuk ditampilkan di gambar. Untuk tiket ber-subject
 * (penemuan — artis sudah tampil) cukup judulnya: lewat “Judul”. Untuk tiket tanpa subject
 * (jejak) tampilkan penuh: Artis — Judul. Null bila tak ada earnedTrack.
 */
export function ticketEarnedLine(ticket: CollectibleTicket): string | null {
  const et = ticket.earnedTrack;
  if (!et) return null;
  if (ticket.subject) return `lewat “${et.track}”`;
  return `${et.artist} — ${et.track}`;
}

/**
 * Seed untuk EMBLEM "piringan/segel" generatif — album-art khas Scrola. Diturunkan dari LAGU
 * (artist|track) supaya emblem terasa milik lagu itu (konsisten per lagu); fallback ke serial bila
 * tak ada earnedTrack. Deterministik → emblem sama untuk lagu yang sama, tanpa jaringan/CORS.
 */
export function emblemSeed(ticket: CollectibleTicket): number {
  const basis = ticket.earnedTrack
    ? `${ticket.earnedTrack.artist}|${ticket.earnedTrack.track}`
    : ticket.serial;
  return ticketPatternSeed(basis);
}
