import type { SisiBRow, SisiBTopTrack } from './sisiBLogic';

/**
 * babAlbumLogic.ts — statistik naratif jangka panjang.
 *
 * "Bab" = rekap SATU BULAN (bab dalam buku dengarmu). "Album" = rekap SATU TAHUN.
 * Keduanya memakai agregasi inti yang sama dengan Sisi B mingguan (top artis/lagu, total,
 * penemuan) — hanya berbeda rentang dan dimensi tren. Dipisah sebagai fungsi MURNI (tanpa SQL)
 * supaya bisa diunit-test penuh; query cukup mengambil baris mentah dalam rentang + daftar artis
 * sebelum rentang (untuk deteksi penemuan), sama seperti sisiBLogic.
 *
 * CATATAN ZONA WAKTU: bucket tren memakai kalender LOKAL (getDate/getMonth) — konsisten dengan
 * konvensi sisiBLogic, aman untuk Indonesia (WIB/WITA/WIT tanpa DST). Bila kelak menyasar zona
 * ber-DST, bucketing perlu ditinjau ulang.
 */

export interface NarrativePeriodStats {
  topArtist: string | null;
  topArtistPlayCount: number;
  topTrack: SisiBTopTrack | null;
  totalTracks: number;
  totalArtists: number;
  totalDurationSec: number;
  /** Jumlah artis yang scrobble PERTAMA-nya (sepanjang sejarah) jatuh di periode ini. */
  newArtistCount: number;
  /** Tren: Bab -> per pekan dalam bulan (5 slot, 0=pekan 1); Album -> per bulan (12 slot). */
  buckets: number[];
}

interface CoreAggregate {
  topArtist: string | null;
  topArtistPlayCount: number;
  topTrack: SisiBTopTrack | null;
  totalTracks: number;
  totalArtists: number;
  totalDurationSec: number;
  newArtistCount: number;
}

/** Agregasi inti bersama (top artis/lagu, total, penemuan) — dipakai Bab & Album. Murni. */
function aggregateCore(rows: SisiBRow[], artistsBefore: Set<string>): CoreAggregate {
  const trackCounts = new Map<string, SisiBTopTrack>();
  const artistCounts = new Map<string, number>();
  const artistsInPeriod = new Set<string>();
  let totalDurationSec = 0;

  for (const row of rows) {
    const trackKey = `${row.artist}::${row.track}`;
    const existing = trackCounts.get(trackKey);
    if (existing) {
      existing.playCount += 1;
    } else {
      trackCounts.set(trackKey, {
        artist: row.artist,
        track: row.track,
        album: row.album,
        playCount: 1,
      });
    }

    artistCounts.set(row.artist, (artistCounts.get(row.artist) ?? 0) + 1);
    artistsInPeriod.add(row.artist);
    totalDurationSec += row.duration ?? 0;
  }

  let topTrack: SisiBTopTrack | null = null;
  for (const t of trackCounts.values()) {
    if (!topTrack || t.playCount > topTrack.playCount) topTrack = t;
  }

  let topArtist: string | null = null;
  let topArtistPlayCount = 0;
  for (const [artist, count] of artistCounts.entries()) {
    if (count > topArtistPlayCount) {
      topArtist = artist;
      topArtistPlayCount = count;
    }
  }

  let newArtistCount = 0;
  artistsInPeriod.forEach((artist) => {
    if (!artistsBefore.has(artist)) newArtistCount += 1;
  });

  return {
    topArtist,
    topArtistPlayCount,
    topTrack,
    totalTracks: rows.length,
    totalArtists: artistsInPeriod.size,
    totalDurationSec,
    newArtistCount,
  };
}

/**
 * Rekap "Bab" (satu bulan). Tren dibucket per PEKAN dalam bulan (hari 1-7 -> slot 0, dst.),
 * maksimal 5 slot. `monthRows` diasumsikan sudah difilter ke bulan yang dimaksud oleh pemanggil.
 */
export function computeBabStats(monthRows: SisiBRow[], artistsBeforeMonth: Set<string>): NarrativePeriodStats {
  const core = aggregateCore(monthRows, artistsBeforeMonth);
  const buckets = new Array(5).fill(0);
  for (const row of monthRows) {
    const dayOfMonth = new Date(row.timestamp * 1000).getDate(); // 1..31
    const weekIdx = Math.min(4, Math.floor((dayOfMonth - 1) / 7));
    buckets[weekIdx] += 1;
  }
  return { ...core, buckets };
}

/**
 * Rekap "Album" (satu tahun). Tren dibucket per BULAN (0=Jan .. 11=Des). `yearRows` diasumsikan
 * sudah difilter ke tahun yang dimaksud oleh pemanggil.
 */
export function computeAlbumStats(yearRows: SisiBRow[], artistsBeforeYear: Set<string>): NarrativePeriodStats {
  const core = aggregateCore(yearRows, artistsBeforeYear);
  const buckets = new Array(12).fill(0);
  for (const row of yearRows) {
    const monthIdx = new Date(row.timestamp * 1000).getMonth(); // 0..11
    buckets[monthIdx] += 1;
  }
  return { ...core, buckets };
}

/**
 * Bucket dengan nilai tertinggi (untuk menamai periode teramai di UI). Seri pertama menang saat
 * seri. Mengembalikan { index: -1, count: 0 } bila semua nol/kosong. Murni.
 */
export function peakBucket(buckets: number[]): { index: number; count: number } {
  let index = -1;
  let count = 0;
  buckets.forEach((v, i) => {
    if (v > count) {
      count = v;
      index = i;
    }
  });
  return { index, count };
}

/** Awal bulan (lokal) untuk sebuah referensi — untuk menghitung rentang query Bab. */
export function startOfMonth(reference: Date = new Date()): Date {
  return new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0);
}

/** Awal tahun (lokal) untuk sebuah referensi — untuk menghitung rentang query Album. */
export function startOfYear(reference: Date = new Date()): Date {
  return new Date(reference.getFullYear(), 0, 1, 0, 0, 0, 0);
}
