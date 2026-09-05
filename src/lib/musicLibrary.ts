/**
 * musicLibrary.ts — model & logika pustaka musik lokal (MURNI, tanpa Android → bisa diuji penuh).
 *
 * Bagian dari "pemutar sungguhan" (Tahap 1). Diisi oleh pemindai MediaStore native (Tahap 3, pola
 * Gramophone/Auxio) yang mengembalikan daftar LibraryTrack, lalu logika di sini menyusunnya jadi
 * album/artis, mengurutkan, dan mencari — untuk UI browser pustaka. Field LibraryTrack dipetakan
 * langsung dari kolom MediaStore.Audio.Media (_id, TITLE, ARTIST, ALBUM, ALBUM_ID, DURATION, TRACK,
 * YEAR, DATE_ADDED, content uri).
 */

export interface LibraryTrack {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumId?: string;
  durationSec: number;
  trackNo?: number;
  year?: number;
  addedAt?: number; // unix detik (DATE_ADDED) — untuk "baru ditambahkan"
}

export interface LibraryAlbum {
  id: string;
  album: string;
  artist: string; // "Berbagai Artis" bila lagu-lagunya beda artis
  year?: number;
  durationSec: number;
  tracks: LibraryTrack[];
}

export interface LibraryArtist {
  name: string;
  albumCount: number;
  trackCount: number;
  tracks: LibraryTrack[];
}

export type TrackSort = 'title' | 'artist' | 'album' | 'recent' | 'duration';

export const VARIOUS_ARTISTS = 'Berbagai Artis';

function norm(s: string): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Kunci album: pakai albumId bila ada, kalau tidak gabungan artis::album (ternormalisasi). */
function albumKey(t: LibraryTrack): string {
  if (t.albumId && t.albumId.length > 0) return 'aid:' + t.albumId;
  return 'na:' + norm(t.artist) + '::' + norm(t.album);
}

/** Bandingkan aman untuk sort teks (locale-insensitive sederhana, stabil). */
function byText(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  return na < nb ? -1 : na > nb ? 1 : 0;
}

/** Urutkan lagu dalam album: nomor track (yang tak punya di belakang), lalu judul. */
function compareInAlbum(a: LibraryTrack, b: LibraryTrack): number {
  const ta = a.trackNo ?? Number.MAX_SAFE_INTEGER;
  const tb = b.trackNo ?? Number.MAX_SAFE_INTEGER;
  if (ta !== tb) return ta - tb;
  return byText(a.title, b.title);
}

/** Kelompokkan lagu menjadi album, terurut (artis lalu tahun lalu nama album). */
export function groupIntoAlbums(tracks: LibraryTrack[]): LibraryAlbum[] {
  const map = new Map<string, LibraryTrack[]>();
  for (const t of tracks) {
    const k = albumKey(t);
    const arr = map.get(k);
    if (arr) arr.push(t);
    else map.set(k, [t]);
  }

  const albums: LibraryAlbum[] = [];
  for (const [id, arr] of map) {
    const sorted = [...arr].sort(compareInAlbum);
    const distinctArtists = new Set(arr.map((t) => norm(t.artist)));
    const artist = distinctArtists.size === 1 ? sorted[0].artist : VARIOUS_ARTISTS;
    const years = arr.map((t) => t.year).filter((y): y is number => typeof y === 'number' && y > 0);
    albums.push({
      id,
      album: sorted[0].album,
      artist,
      year: years.length > 0 ? Math.min(...years) : undefined,
      durationSec: arr.reduce((s, t) => s + (t.durationSec || 0), 0),
      tracks: sorted,
    });
  }

  albums.sort((a, b) => {
    const byArtist = byText(a.artist, b.artist);
    if (byArtist !== 0) return byArtist;
    const ya = a.year ?? Number.MAX_SAFE_INTEGER;
    const yb = b.year ?? Number.MAX_SAFE_INTEGER;
    if (ya !== yb) return ya - yb;
    return byText(a.album, b.album);
  });
  return albums;
}

/** Kelompokkan lagu menjadi artis, terurut menurut nama. */
export function groupIntoArtists(tracks: LibraryTrack[]): LibraryArtist[] {
  const map = new Map<string, LibraryTrack[]>();
  for (const t of tracks) {
    const k = norm(t.artist);
    const arr = map.get(k);
    if (arr) arr.push(t);
    else map.set(k, [t]);
  }

  const artists: LibraryArtist[] = [];
  for (const arr of map.values()) {
    const albumIds = new Set(arr.map(albumKey));
    artists.push({
      name: arr[0].artist,
      albumCount: albumIds.size,
      trackCount: arr.length,
      tracks: [...arr].sort((a, b) => byText(a.title, b.title)),
    });
  }
  artists.sort((a, b) => byText(a.name, b.name));
  return artists;
}

/** Urutkan daftar lagu menurut kriteria (mengembalikan array baru). */
export function sortTracks(tracks: LibraryTrack[], by: TrackSort): LibraryTrack[] {
  const arr = [...tracks];
  switch (by) {
    case 'title':
      return arr.sort((a, b) => byText(a.title, b.title));
    case 'artist':
      return arr.sort((a, b) => byText(a.artist, b.artist) || byText(a.title, b.title));
    case 'album':
      return arr.sort((a, b) => byText(a.album, b.album) || compareInAlbum(a, b));
    case 'duration':
      return arr.sort((a, b) => (a.durationSec || 0) - (b.durationSec || 0));
    case 'recent':
      return arr.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
    default:
      return arr;
  }
}

/** Cari lagu berdasar judul/artis/album (substring ternormalisasi). Query kosong -> semua. */
export function searchLibrary(tracks: LibraryTrack[], query: string): LibraryTrack[] {
  const q = norm(query);
  if (q.length === 0) return tracks;
  return tracks.filter((t) => {
    const hay = norm(t.title) + '\u0000' + norm(t.artist) + '\u0000' + norm(t.album);
    return hay.includes(q);
  });
}
