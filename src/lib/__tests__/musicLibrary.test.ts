import { describe, it, expect } from 'vitest';
import {
  groupIntoAlbums,
  groupIntoArtists,
  sortTracks,
  searchLibrary,
  VARIOUS_ARTISTS,
  type LibraryTrack,
} from '../musicLibrary';

function t(p: Partial<LibraryTrack> & { title: string }): LibraryTrack {
  return {
    id: p.id ?? p.title,
    uri: p.uri ?? 'content://' + (p.id ?? p.title),
    title: p.title,
    artist: p.artist ?? 'Unknown',
    album: p.album ?? 'Unknown',
    albumId: p.albumId,
    durationSec: p.durationSec ?? 180,
    trackNo: p.trackNo,
    year: p.year,
    addedAt: p.addedAt,
  };
}

describe('groupIntoAlbums', () => {
  it('mengelompokkan per albumId & mengurutkan lagu menurut trackNo', () => {
    const tracks = [
      t({ title: 'B', albumId: '1', album: 'Alpha', artist: 'X', trackNo: 2 }),
      t({ title: 'A', albumId: '1', album: 'Alpha', artist: 'X', trackNo: 1 }),
      t({ title: 'C', albumId: '1', album: 'Alpha', artist: 'X', trackNo: 3 }),
    ];
    const albums = groupIntoAlbums(tracks);
    expect(albums).toHaveLength(1);
    expect(albums[0].tracks.map((x) => x.title)).toEqual(['A', 'B', 'C']);
    expect(albums[0].durationSec).toBe(540);
  });

  it('album beda-artis ditandai Berbagai Artis', () => {
    const tracks = [
      t({ title: 'A', albumId: 'comp', album: 'Mix', artist: 'X' }),
      t({ title: 'B', albumId: 'comp', album: 'Mix', artist: 'Y' }),
    ];
    expect(groupIntoAlbums(tracks)[0].artist).toBe(VARIOUS_ARTISTS);
  });

  it('tanpa albumId, pisah berdasar artis::album', () => {
    const tracks = [
      t({ title: 'A', album: 'Self Titled', artist: 'X' }),
      t({ title: 'B', album: 'Self Titled', artist: 'Y' }),
    ];
    // dua album berbeda meski nama album sama (artis beda)
    expect(groupIntoAlbums(tracks)).toHaveLength(2);
  });

  it('album diurutkan artis lalu tahun', () => {
    const tracks = [
      t({ title: 'a', albumId: '2', album: 'Zed', artist: 'B', year: 2020 }),
      t({ title: 'b', albumId: '1', album: 'Aa', artist: 'A', year: 2019 }),
      t({ title: 'c', albumId: '3', album: 'Bee', artist: 'A', year: 2010 }),
    ];
    const albums = groupIntoAlbums(tracks);
    expect(albums.map((x) => x.artist)).toEqual(['A', 'A', 'B']);
    // dalam artis A, tahun menaik: 2010 (Bee) sebelum 2019 (Aa)
    expect(albums[0].album).toBe('Bee');
    expect(albums[1].album).toBe('Aa');
  });
});

describe('groupIntoArtists', () => {
  it('menghitung album & track unik', () => {
    const tracks = [
      t({ title: 'A', albumId: '1', artist: 'X' }),
      t({ title: 'B', albumId: '1', artist: 'X' }),
      t({ title: 'C', albumId: '2', artist: 'X' }),
      t({ title: 'D', albumId: '3', artist: 'Y' }),
    ];
    const artists = groupIntoArtists(tracks);
    expect(artists.map((a) => a.name)).toEqual(['X', 'Y']);
    expect(artists[0].albumCount).toBe(2);
    expect(artists[0].trackCount).toBe(3);
  });
});

describe('sortTracks', () => {
  const tracks = [
    t({ title: 'Beta', artist: 'Z', album: 'M', durationSec: 100, addedAt: 10 }),
    t({ title: 'Alpha', artist: 'A', album: 'N', durationSec: 300, addedAt: 30 }),
    t({ title: 'Gamma', artist: 'M', album: 'L', durationSec: 200, addedAt: 20 }),
  ];
  it('judul', () => {
    expect(sortTracks(tracks, 'title').map((x) => x.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
  it('durasi menaik', () => {
    expect(sortTracks(tracks, 'duration').map((x) => x.durationSec)).toEqual([100, 200, 300]);
  });
  it('terbaru (addedAt menurun)', () => {
    expect(sortTracks(tracks, 'recent').map((x) => x.addedAt)).toEqual([30, 20, 10]);
  });
  it('tidak memutasi input', () => {
    const before = tracks.map((x) => x.title);
    sortTracks(tracks, 'title');
    expect(tracks.map((x) => x.title)).toEqual(before);
  });
});

describe('searchLibrary', () => {
  const tracks = [
    t({ title: 'Chasing Cars', artist: 'Snow Patrol', album: 'Eyes Open' }),
    t({ title: 'Komang', artist: 'Raim Laode', album: 'Single' }),
  ];
  it('cocok judul/artis/album, case-insensitive', () => {
    expect(searchLibrary(tracks, 'snow').map((x) => x.title)).toEqual(['Chasing Cars']);
    expect(searchLibrary(tracks, 'KOMANG')).toHaveLength(1);
    expect(searchLibrary(tracks, 'eyes')).toHaveLength(1);
  });
  it('query kosong -> semua', () => {
    expect(searchLibrary(tracks, '  ')).toHaveLength(2);
  });
  it('tak cocok -> kosong', () => {
    expect(searchLibrary(tracks, 'zzz')).toHaveLength(0);
  });
});
