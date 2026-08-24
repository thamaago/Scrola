import { translatePlural, DEFAULT_LOCALE, type Locale } from './i18n';

export interface SisiBRow {
  artist: string;
  track: string;
  album?: string;
  timestamp: number; // unix seconds
  duration?: number; // detik
}

export interface SisiBTopTrack {
  artist: string;
  track: string;
  album?: string;
  playCount: number;
}

export interface SisiBStats {
  topArtist: string | null;
  topTrack: SisiBTopTrack | null;
  /** Jam (0-23) dengan jumlah scrobble terbanyak dalam seminggu, null kalau tidak ada data */
  peakHour: number | null;
  /** Jumlah artis yang scrobble PERTAMA-nya (sepanjang sejarah) jatuh di minggu ini */
  newArtistCount: number;
  totalTracks: number;
  totalArtists: number;
  totalDurationSec: number;
  /** Jumlah scrobble per hari, index 0=Senin .. 6=Minggu, relatif terhadap weekStartUnixSec */
  dayCounts: number[];
}

/**
 * Hitung semua statistik Sisi B dari baris riwayat dalam rentang minggu + daftar artis yang
 * SUDAH pernah muncul sebelum minggu ini (untuk deteksi "penemuan"/artis baru).
 *
 * Sengaja fungsi MURNI terpisah dari query SQL: query cukup mengambil baris mentah dalam
 * rentang tanggal (`getHistoryInRange`) + daftar artis sebelum minggu ini
 * (`getDistinctArtistsBefore`), lalu SEMUA agregasi (top artist/track, jam puncak, hitung per
 * hari) dilakukan di sini — jauh lebih murah untuk diverifikasi lewat unit test murni
 * dibanding menulis banyak query SQL agregat yang rawan salah tanpa bisa dikompilasi & dites
 * langsung di lingkungan ini. Pola yang sama dengan `scrobbleLogic.ts`.
 *
 * CATATAN ZONA WAKTU: hari-ke-hari dihitung dengan blok tetap 86400 detik dari weekStartUnixSec,
 * bukan kalender lokal per-baris — ini aman untuk Indonesia (WIB/WITA/WIT tidak punya DST),
 * tapi kalau suatu saat menyasar pengguna di zona dengan DST, pendekatan ini perlu direvisi ke
 * perbandingan tanggal lokal per-baris seperti di `historyGrouping.ts`.
 */
export function computeSisiBStats(
  weekRows: SisiBRow[],
  artistsBeforeWeek: Set<string>,
  weekStartUnixSec: number
): SisiBStats {
  const trackCounts = new Map<string, SisiBTopTrack>();
  const artistCounts = new Map<string, number>();
  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);
  const artistsThisWeek = new Set<string>();
  let totalDurationSec = 0;

  for (const row of weekRows) {
    const trackKey = `${row.artist}::${row.track}`;
    const existing = trackCounts.get(trackKey);
    if (existing) {
      existing.playCount += 1;
    } else {
      trackCounts.set(trackKey, { artist: row.artist, track: row.track, album: row.album, playCount: 1 });
    }

    artistCounts.set(row.artist, (artistCounts.get(row.artist) ?? 0) + 1);
    artistsThisWeek.add(row.artist);

    const date = new Date(row.timestamp * 1000);
    hourCounts[date.getHours()] += 1;

    const dayIdx = Math.min(6, Math.max(0, Math.floor((row.timestamp - weekStartUnixSec) / 86400)));
    dayCounts[dayIdx] += 1;

    totalDurationSec += row.duration ?? 0;
  }

  let topTrack: SisiBTopTrack | null = null;
  for (const t of trackCounts.values()) {
    if (!topTrack || t.playCount > topTrack.playCount) topTrack = t;
  }

  let topArtist: string | null = null;
  let topArtistCount = 0;
  for (const [artist, count] of artistCounts.entries()) {
    if (count > topArtistCount) {
      topArtist = artist;
      topArtistCount = count;
    }
  }

  let peakHour: number | null = null;
  let peakHourCount = 0;
  hourCounts.forEach((count, hour) => {
    if (count > peakHourCount) {
      peakHourCount = count;
      peakHour = hour;
    }
  });

  let newArtistCount = 0;
  artistsThisWeek.forEach((artist) => {
    if (!artistsBeforeWeek.has(artist)) newArtistCount += 1;
  });

  return {
    topArtist,
    topTrack,
    peakHour,
    newArtistCount,
    totalTracks: weekRows.length,
    totalArtists: artistsThisWeek.size,
    totalDurationSec,
    dayCounts,
  };
}

/** Awal minggu ISO (Senin 00:00 waktu lokal) yang memuat tanggal `reference`. */
export function startOfIsoWeek(reference: Date = new Date()): Date {
  const d = new Date(reference);
  const day = d.getDay(); // 0=Minggu, 1=Senin, ... 6=Sabtu
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format detik jadi durasi manusiawi per-locale, mis. "6 jam 12 menit" / "6 hours 12 minutes".
 * Satuan jam/menit diambil dari kamus (jamak sadar-locale). `locale` default 'id' agar pemanggil
 * & test lama tetap konsisten tanpa perubahan.
 */
export function formatDurationHuman(totalSec: number, locale: Locale = DEFAULT_LOCALE): string {
  const totalMin = Math.round(totalSec / 60);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const h = () => translatePlural(locale, 'unit.hours', hours);
  const m = () => translatePlural(locale, 'unit.minutes', minutes);
  if (hours === 0) return m();
  if (minutes === 0) return h();
  return `${h()} ${m()}`;
}
