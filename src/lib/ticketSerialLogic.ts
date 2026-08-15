/**
 * ticketSerialLogic.ts — "Tiket Koleksi Bernomor Seri".
 *
 * Ide: momen-momen tertentu dalam mendengarkan (scrobble ke-100, artis ke-10 yang ditemukan, dst.)
 * "mencetak" sebuah tiket koleksi bernomor seri unik — seperti sobekan tiket edisi terbatas. Ini
 * memperkuat identitas cetak/tiket Scrola ("Every Song Leaves a Story") dan menambah mekanik
 * retensi tanpa gimmick.
 *
 * KENAPA MODUL MURNI TERPISAH:
 * Tiket adalah FUNGSI DETERMINISTIK dari riwayat — milestone yang sama pada data yang sama selalu
 * menghasilkan serial yang sama. Karena itu ia tidak butuh tabel DB baru (bisa diturunkan saat
 * dibaca) dan bisa divalidasi 100% lewat simulasi/unit test tanpa perangkat. Ini sejalan dengan
 * prinsip "pisahkan logika murni, uji dulu sebelum integrasi".
 */

import { detectTrophies } from './trophies';

export type TicketKind = 'jejak' | 'penemuan' | 'setia' | 'beruntun' | 'trofi';

/** Baris riwayat minimal yang dibutuhkan untuk menghitung tiket. Kompatibel dengan SisiBRow. */
export interface TicketRow {
  artist: string;
  track: string;
  timestamp: number; // unix seconds
}

export interface CollectibleTicket {
  kind: TicketKind;
  /** Angka milestone: 100 (scrobble ke-100), 10 (penemuan ke-10), dst. */
  ordinal: number;
  /** Serial deterministik & unik, mis. "SCR-J-000100". */
  serial: string;
  /** Label manusiawi (Bahasa Indonesia). */
  label: string;
  /** Timestamp (unix sec) dari scrobble yang MEMICU tiket ini. */
  earnedAtSec: number;
  /** Subjek deskriptif untuk tiket yang terkait entitas (mis. nama artis penemuan). */
  subject?: string;
  /**
   * Lagu yang MENCETAK tiket ini (scrobble pemicu). Untuk 'jejak' = scrobble ke-N; untuk 'penemuan'
   * = lagu yang mengenalkan artis itu. Untuk TAMPILAN saja — TIDAK memengaruhi serial (serial tetap
   * dari ordinal/subject, supaya tiket yang sudah terkumpul tak bergeser). Berlaku untuk semua jenis
   * tiket, termasuk yang ditambahkan nanti.
   */
  earnedTrack?: { artist: string; track: string };
}

export interface TicketConfig {
  /** Milestone jumlah scrobble total yang mencetak tiket "jejak". */
  jejakMilestones?: number[];
  /** Milestone jumlah artis unik ditemukan yang mencetak tiket "penemuan". */
  penemuanMilestones?: number[];
  /** Milestone jumlah putar SATU artis yang mencetak tiket "setia". */
  setiaMilestones?: number[];
  /** Milestone panjang streak hari beruntun yang mencetak tiket "beruntun". */
  beruntunMilestones?: number[];
}

/** Normalisasi artis untuk dedup penemuan (trim + lowercase). Dipakai bersama agar konsisten. */
export function normalizeArtist(artist: string): string {
  return artist.trim().toLowerCase();
}

const KIND_CODE: Record<TicketKind, string> = {
  jejak: 'J',
  penemuan: 'P',
  setia: 'S',
  beruntun: 'B',
  trofi: 'T',
};

/** Default milestone. Dipisah & diekspor supaya bisa dikonfigurasi (dan diuji dengan angka kecil). */
export const JEJAK_MILESTONES = [1, 100, 500, 1000, 5000, 10000];
export const PENEMUAN_MILESTONES = [1, 10, 25, 50, 100, 250];
/** Berapa kali SATU artis diputar untuk mencetak tiket "setia" (kesetiaan pada satu artis). */
export const SETIA_MILESTONES = [25, 50, 100, 250];
/** Panjang streak HARI beruntun (ada scrobble tiap hari) untuk mencetak tiket "beruntun". */
export const BERUNTUN_MILESTONES = [3, 7, 14, 30, 100];

/**
 * Hash string deterministik kecil (varian djb2) -> base36, 4 karakter. Dipakai untuk membuat serial
 * tiket yang terkait SUBJEK tetap unik antar subjek berbeda dengan ordinal sama (mis. dua artis
 * sama-sama mencapai 50 putaran -> "SCR-S-000050-<hash>" berbeda). Murni & stabil lintas sesi.
 */
export function subjectHash(subject: string): string {
  let h = 5381;
  for (let i = 0; i < subject.length; i++) {
    // h * 33 + charCode, dijaga tetap unsigned 32-bit
    h = ((h << 5) + h + subject.charCodeAt(i)) >>> 0;
  }
  return h.toString(36).padStart(4, '0').slice(-4);
}

/**
 * Serial deterministik. Untuk tiket global (jejak/penemuan/beruntun) ordinal sudah unik per jenis,
 * jadi cukup "SCR-<K>-<NNNNNN>". Untuk tiket terkait subjek (mis. "setia" ke satu artis) sertakan
 * hash subjek agar tidak bertabrakan.
 */
export function ticketSerial(kind: TicketKind, ordinal: number, subject?: string): string {
  const code = KIND_CODE[kind];
  const num = String(Math.max(0, Math.floor(ordinal))).padStart(6, '0');
  const base = `SCR-${code}-${num}`;
  return subject ? `${base}-${subjectHash(subject)}` : base;
}

function jejakLabel(count: number): string {
  return count === 1 ? 'Scrobble pertamamu' : `Scrobble ke-${count}`;
}

function penemuanLabel(ordinal: number): string {
  return ordinal === 1
    ? 'Artis pertama yang kamu temukan'
    : `Artis ke-${ordinal} yang kamu temukan`;
}

function setiaLabel(count: number): string {
  return `Diputar ${count}×`;
}

function beruntunLabel(count: number): string {
  return `${count} hari beruntun`;
}

/** Nomor hari LOKAL (hari sejak epoch, zona waktu perangkat) — untuk mendeteksi hari beruntun. */
function localDayNumber(unixSec: number): number {
  const d = new Date(unixSec * 1000);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
}

/**
 * Hitung semua tiket koleksi yang SUDAH diperoleh dari riwayat.
 *
 * Deterministik: input yang sama -> keluaran (termasuk serial & earnedAtSec) yang sama persis.
 * Tidak memutasi `rows`. Mengurutkan kronologis secara internal supaya urutan masukan tak penting.
 *
 * - jejak: saat jumlah kumulatif scrobble MELINTASI sebuah milestone, cetak tiket pada timestamp
 *   baris yang melintasinya.
 * - penemuan: saat jumlah artis unik (dinormalisasi case+trim) melintasi milestone, cetak tiket.
 */
export function computeEarnedTickets(
  rows: TicketRow[],
  config: TicketConfig = {}
): CollectibleTicket[] {
  const jejakSet = new Set(config.jejakMilestones ?? JEJAK_MILESTONES);
  const penemuanSet = new Set(config.penemuanMilestones ?? PENEMUAN_MILESTONES);
  const setiaSet = new Set(config.setiaMilestones ?? SETIA_MILESTONES);
  const beruntunSet = new Set(config.beruntunMilestones ?? BERUNTUN_MILESTONES);

  // Urutkan kronologis tanpa menyentuh input asli. Tie-break stabil pakai artist+track supaya
  // hasil benar-benar deterministik walau ada timestamp identik.
  const sorted = [...rows].sort(
    (a, b) =>
      a.timestamp - b.timestamp ||
      a.artist.localeCompare(b.artist) ||
      a.track.localeCompare(b.track)
  );

  const tickets: CollectibleTicket[] = [];
  const seenArtists = new Set<string>();
  const artistPlays = new Map<string, number>();
  let count = 0;
  let discoveries = 0;

  for (const row of sorted) {
    count++;
    if (jejakSet.has(count)) {
      tickets.push({
        kind: 'jejak',
        ordinal: count,
        serial: ticketSerial('jejak', count),
        label: jejakLabel(count),
        earnedAtSec: row.timestamp,
        earnedTrack: { artist: row.artist, track: row.track },
      });
    }

    const artistKey = normalizeArtist(row.artist);
    if (artistKey.length > 0 && !seenArtists.has(artistKey)) {
      seenArtists.add(artistKey);
      discoveries++;
      if (penemuanSet.has(discoveries)) {
        tickets.push({
          kind: 'penemuan',
          ordinal: discoveries,
          serial: ticketSerial('penemuan', discoveries),
          label: penemuanLabel(discoveries),
          earnedAtSec: row.timestamp,
          subject: row.artist.trim(),
          earnedTrack: { artist: row.artist, track: row.track },
        });
      }
    }

    // SETIA — satu artis mencapai N putar. Serial ber-hash subjek (artis) karena milestone bisa
    // dicapai banyak artis; count melewati tiap nilai tepat sekali → tercetak sekali per artis.
    if (artistKey.length > 0) {
      const plays = (artistPlays.get(artistKey) ?? 0) + 1;
      artistPlays.set(artistKey, plays);
      if (setiaSet.has(plays)) {
        const subject = row.artist.trim();
        tickets.push({
          kind: 'setia',
          ordinal: plays,
          serial: ticketSerial('setia', plays, subject),
          label: setiaLabel(plays),
          earnedAtSec: row.timestamp,
          subject,
          earnedTrack: { artist: row.artist, track: row.track },
        });
      }
    }
  }

  // BERUNTUN — streak hari beruntun (ada scrobble tiap hari). Pass terpisah atas hari unik terurut;
  // milestone dicetak SEKALI (pertama kali streak mencapainya). earnedTrack = scrobble hari penutup.
  const firstRowOfDay = new Map<number, (typeof sorted)[number]>();
  for (const row of sorted) {
    const day = localDayNumber(row.timestamp);
    if (!firstRowOfDay.has(day)) firstRowOfDay.set(day, row);
  }
  const days = [...firstRowOfDay.keys()].sort((a, b) => a - b);
  const awardedBeruntun = new Set<number>();
  let streak = 0;
  let prevDay: number | null = null;
  for (const day of days) {
    streak = prevDay !== null && day === prevDay + 1 ? streak + 1 : 1;
    prevDay = day;
    if (beruntunSet.has(streak) && !awardedBeruntun.has(streak)) {
      awardedBeruntun.add(streak);
      const row = firstRowOfDay.get(day)!;
      tickets.push({
        kind: 'beruntun',
        ordinal: streak,
        serial: ticketSerial('beruntun', streak),
        label: beruntunLabel(streak),
        earnedAtSec: row.timestamp,
        earnedTrack: { artist: row.artist, track: row.track },
      });
    }
  }

  // TROFI — pencapaian berpola/peristiwa (ala game), bukan sekadar jumlah putar/temuan. Deterministik
  // dari riwayat; serial global per trofi (SCR-T-00000N), subject = deskripsi (untuk tampilan saja).
  for (const hit of detectTrophies(sorted)) {
    tickets.push({
      kind: 'trofi',
      ordinal: hit.def.ordinal,
      serial: ticketSerial('trofi', hit.def.ordinal),
      label: hit.def.label,
      earnedAtSec: hit.row.timestamp,
      subject: hit.def.desc,
      earnedTrack: { artist: hit.row.artist, track: hit.row.track },
    });
  }

  return tickets;
}

/**
 * Urutkan tiket untuk ditampilkan: terbaru dulu (earnedAtSec menurun). Stabil & tidak memutasi
 * input (tie-break pakai serial supaya deterministik).
 */
export function sortTicketsForDisplay(tickets: CollectibleTicket[]): CollectibleTicket[] {
  return [...tickets].sort(
    (a, b) => b.earnedAtSec - a.earnedAtSec || a.serial.localeCompare(b.serial)
  );
}

/** Progres menuju milestone berikutnya yang belum diperoleh (untuk hook retensi di UI). */
export interface TicketProgress {
  totalScrobbles: number;
  uniqueArtists: number;
  /** Milestone jejak berikutnya + berapa scrobble lagi; null kalau semua sudah diperoleh. */
  nextJejak: { ordinal: number; remaining: number } | null;
  /** Milestone penemuan berikutnya + berapa artis baru lagi; null kalau semua sudah diperoleh. */
  nextPenemuan: { ordinal: number; remaining: number } | null;
}

/** Milestone terkecil yang masih DI ATAS nilai sekarang (yang berikutnya akan dicetak). */
function nextMilestone(current: number, milestones: number[]): { ordinal: number; remaining: number } | null {
  const upcoming = milestones.filter((m) => m > current).sort((a, b) => a - b);
  if (upcoming.length === 0) return null;
  const ordinal = upcoming[0];
  return { ordinal, remaining: ordinal - current };
}

/**
 * Hitung progres koleksi dari riwayat: total scrobble, artis unik, dan milestone berikutnya untuk
 * jejak & penemuan. Murni & tidak memutasi input.
 */
export function computeTicketProgress(rows: TicketRow[], config: TicketConfig = {}): TicketProgress {
  const jejak = config.jejakMilestones ?? JEJAK_MILESTONES;
  const penemuan = config.penemuanMilestones ?? PENEMUAN_MILESTONES;

  const artists = new Set<string>();
  for (const row of rows) {
    const key = normalizeArtist(row.artist);
    if (key.length > 0) artists.add(key);
  }

  const totalScrobbles = rows.length;
  const uniqueArtists = artists.size;
  return {
    totalScrobbles,
    uniqueArtists,
    nextJejak: nextMilestone(totalScrobbles, jejak),
    nextPenemuan: nextMilestone(uniqueArtists, penemuan),
  };
}
