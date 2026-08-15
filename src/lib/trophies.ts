/**
 * trophies.ts — "trofi" ala game: pencapaian berpola/peristiwa dari riwayat, BUKAN sekadar "sering
 * diputar" atau "pertama didengar". Tiap trofi bernama, unik (one-of-a-kind), dan dicetak SEKALI saat
 * pertama kali kondisinya terpenuhi. Deterministik & murni → mudah di-TDD, dan (karena hanya fungsi
 * dari riwayat) otomatis ikut ter-backup lewat backup riwayat.
 *
 * Semua detektor memakai data yang tersedia: artist, track, timestamp (+ waktu lokal perangkat).
 */

export interface TrophyRow {
  artist: string;
  track: string;
  timestamp: number;
}

export interface TrophyDef {
  id: string;
  /** Ordinal stabil (urutan di TROPHY_DEFS) → serial SCR-T-00000N. Jangan diacak agar serial stabil. */
  ordinal: number;
  label: string;
  /** Deskripsi singkat (ditampilkan sebagai subjek tiket). */
  desc: string;
}

export interface TrophyHit {
  def: TrophyDef;
  /** Scrobble yang membuka trofi (untuk earnedTrack & earnedAtSec). */
  row: TrophyRow;
}

const DAY = 86400;

function localHour(unixSec: number): number {
  return new Date(unixSec * 1000).getHours();
}

function localDayNumber(unixSec: number): number {
  const d = new Date(unixSec * 1000);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
}

type Detector = (rows: TrophyRow[]) => TrophyRow | null;

/** Scrobble pertama yang jam lokalnya memenuhi lo &lt;= jam &lt; hi. */
function firstInHourRange(lo: number, hi: number): Detector {
  return (rows) => {
    for (const r of rows) {
      const h = localHour(r.timestamp);
      if (h >= lo && h < hi) return r;
    }
    return null;
  };
}

/** Scrobble yang membuat sebuah hari mencapai `n` scrobble (hari mana pun, pertama kali). */
function firstDayReachingCount(n: number): Detector {
  return (rows) => {
    const perDay = new Map<number, number>();
    for (const r of rows) {
      const day = localDayNumber(r.timestamp);
      const c = (perDay.get(day) ?? 0) + 1;
      perDay.set(day, c);
      if (c === n) return r;
    }
    return null;
  };
}

/** Scrobble yang melengkapi `n` scrobble dalam jendela `windowSec` (sliding window). */
function firstWindowReaching(n: number, windowSec: number): Detector {
  return (rows) => {
    let start = 0;
    for (let i = 0; i < rows.length; i++) {
      while (rows[i].timestamp - rows[start].timestamp > windowSec) start++;
      if (i - start + 1 >= n) return rows[i];
    }
    return null;
  };
}

/** Scrobble pertama yang datang setelah jeda >= `gapSec` dari scrobble sebelumnya. */
function firstComeback(gapSec: number): Detector {
  return (rows) => {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].timestamp - rows[i - 1].timestamp >= gapSec) return rows[i];
    }
    return null;
  };
}

/** Scrobble yang membuat sebuah hari mencapai `n` artis berbeda. */
function firstDayDistinctArtists(n: number): Detector {
  return (rows) => {
    const perDay = new Map<number, Set<string>>();
    for (const r of rows) {
      const artist = r.artist.trim().toLowerCase();
      if (!artist) continue;
      const day = localDayNumber(r.timestamp);
      let set = perDay.get(day);
      if (!set) {
        set = new Set();
        perDay.set(day, set);
      }
      if (!set.has(artist)) {
        set.add(artist);
        if (set.size === n) return r;
      }
    }
    return null;
  };
}

interface TrophyInternal extends TrophyDef {
  detect: Detector;
}

const DEFS: Array<Omit<TrophyInternal, 'ordinal'>> = [
  { id: 'burung_hantu', label: 'Burung Hantu', desc: 'Mendengarkan di larut malam (00–04)', detect: firstInHourRange(0, 4) },
  { id: 'ayam_jago', label: 'Ayam Jago', desc: 'Mendengarkan saat subuh (04–06)', detect: firstInHourRange(4, 6) },
  { id: 'maraton', label: 'Maraton', desc: '30 scrobble dalam satu hari', detect: firstDayReachingCount(30) },
  { id: 'jam_sibuk', label: 'Jam Sibuk', desc: '15 scrobble dalam satu jam', detect: firstWindowReaching(15, 3600) },
  { id: 'kembali_pulang', label: 'Kembali Pulang', desc: 'Kembali setelah jeda 30+ hari', detect: firstComeback(30 * DAY) },
  { id: 'hari_beragam', label: 'Hari Beragam', desc: '20 artis berbeda dalam satu hari', detect: firstDayDistinctArtists(20) },
];

/** Definisi trofi publik (tanpa detektor) — ordinal = urutan (1-based), stabil untuk serial. */
export const TROPHY_DEFS: TrophyDef[] = DEFS.map((d, i) => ({
  id: d.id,
  ordinal: i + 1,
  label: d.label,
  desc: d.desc,
}));

/**
 * Deteksi semua trofi yang sudah terbuka dari riwayat. `rows` boleh belum terurut — diurutkan
 * kronologis di sini. Tiap trofi muncul paling banyak sekali.
 */
export function detectTrophies(rows: TrophyRow[]): TrophyHit[] {
  const sorted = [...rows].sort(
    (a, b) => a.timestamp - b.timestamp || a.artist.localeCompare(b.artist) || a.track.localeCompare(b.track)
  );
  const hits: TrophyHit[] = [];
  DEFS.forEach((d, i) => {
    const row = d.detect(sorted);
    if (row) hits.push({ def: TROPHY_DEFS[i], row });
  });
  return hits;
}
