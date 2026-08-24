import { diag } from './diagnostics';

/**
 * validationChecklist.ts — mencatat ke LOG PERISTIWA on-device, saat app dibuka, daftar fitur yang
 * masih perlu divalidasi di perangkat terinstall. Tujuannya: saat kamu memakai build terpasang dan
 * membuka log (Settings), log itu sendiri mengingatkan apa yang perlu dicek — dan screenshot log jadi
 * bisa ditelusuri ke versi build tertentu.
 *
 * Cara pakai: perbarui PENDING_VALIDATION saat fitur ditambah/divalidasi (coret yang sudah lolos).
 */

export const APP_VERSION = '0.1.0';

/** Item yang belum tervalidasi device (ringkas). Perbarui seiring fitur divalidasi/ditambah. */
export const PENDING_VALIDATION: string[] = [
  'notif Scrola hilang otomatis saat diam (2 mnt)',
  'mute scrobble per-app (Settings › Sumber)',
  'edit tag lagu yang sedang diputar → simpan berhasil',
  'backup → restore: riwayat + tiket + koreksi kembali utuh',
  'paging Riwayat (10/halaman) di mode periode',
  'emblem tiket per-jenis + jam dengar tampil',
  'tiket Momen/Setia/Beruntun tercetak sesuai aturan',
  'backoff eksponensial penuh (offline lama)',
];

/** Baris-baris yang akan ditulis ke log (murni, teruji terpisah dari efek samping diag). */
export function buildValidationLines(): string[] {
  const lines = [`BUILD Scrola v${APP_VERSION} — cek daftar validasi di bawah`];
  lines.push(`VALIDASI tertunda (${PENDING_VALIDATION.length}):`);
  PENDING_VALIDATION.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
  return lines;
}

/** Tulis stempel build + checklist validasi ke log peristiwa. Dipanggil sekali saat startup. */
export function logValidationChecklist(): void {
  for (const line of buildValidationLines()) diag(line);
}
