/**
 * discoveryLogic.ts — logika MURNI untuk "Penemuan": mengubah riwayat jadi linimasa artis yang
 * pertama kali kamu temukan, lengkap dengan lagu yang mengenalkannya & kapan. Angka "penemuan baru"
 * di Sisi B jadi bisa ditelusuri sebagai cerita — sejalan "Every song leaves a story".
 */

export interface DiscoveryRow {
  artist: string;
  track: string;
  timestamp: number;
}

export interface Discovery {
  /** Bentuk tampil artis, diambil dari kemunculan PALING AWAL. */
  artist: string;
  /** Lagu yang mengenalkan artis ini (lagu pada kemunculan pertama). */
  firstTrack: string;
  /** Timestamp kemunculan pertama (unix detik). */
  firstTimestamp: number;
  /** Total scrobble artis ini di data yang diberikan. */
  playCount: number;
}

const normArtist = (a: string) => a.trim().toLowerCase();

/**
 * Hitung penemuan dari daftar riwayat. Satu entri per artis (dinormalkan case/spasi), memakai
 * kemunculan paling awal sebagai "penemuan". Diurut penemuan TERBARU dulu. Baris tanpa artist
 * (kosong/whitespace) diabaikan.
 */
export function computeDiscoveries(rows: DiscoveryRow[]): Discovery[] {
  const byArtist = new Map<string, Discovery>();

  for (const row of rows) {
    if (!row.artist || row.artist.trim().length === 0) continue;
    const key = normArtist(row.artist);
    const existing = byArtist.get(key);
    if (!existing) {
      byArtist.set(key, {
        artist: row.artist,
        firstTrack: row.track,
        firstTimestamp: row.timestamp,
        playCount: 1,
      });
      continue;
    }
    existing.playCount += 1;
    if (row.timestamp < existing.firstTimestamp) {
      existing.firstTimestamp = row.timestamp;
      existing.firstTrack = row.track;
      existing.artist = row.artist; // bentuk tampil ikut kemunculan paling awal
    }
  }

  return Array.from(byArtist.values()).sort((a, b) => b.firstTimestamp - a.firstTimestamp);
}
