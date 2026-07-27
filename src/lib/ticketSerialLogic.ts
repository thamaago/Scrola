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

export type TicketKind = 'jejak' | 'penemuan' | 'setia' | 'beruntun';

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
}

export interface TicketConfig {
  /** Milestone jumlah scrobble total yang mencetak tiket "jejak". */
  jejakMilestones?: number[];
  /** Milestone jumlah artis unik ditemukan yang mencetak tiket "penemuan". */
  penemuanMilestones?: number[];
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
};

/** Default milestone. Dipisah & diekspor supaya bisa dikonfigurasi (dan diuji dengan angka kecil). */
export const JEJAK_MILESTONES = [1, 100, 500, 1000, 5000, 10000];
export const PENEMUAN_MILESTONES = [1, 10, 25, 50, 100, 250];

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
        });
      }
    }
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
