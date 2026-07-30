import { describe, it, expect } from 'vitest';
import { cleanTrackMetadata } from '../cleanTrackMetadata';

const YTM = 'com.google.android.apps.youtube.music';
const SPOTIFY = 'com.spotify.music';

describe('cleanTrackMetadata — sumber katalog: hanya noise versi yang dibersihkan', () => {
  it('Spotify bersih dibiarkan apa adanya', () => {
    expect(cleanTrackMetadata({ artist: 'Snow Patrol', track: 'Chasing Cars', sourcePackage: SPOTIFY }))
      .toEqual({ artist: 'Snow Patrol', track: 'Chasing Cars' });
  });

  it('membersihkan tag "Remastered" ala Spotify (semua sumber)', () => {
    expect(cleanTrackMetadata({ artist: 'Oasis', track: 'Wonderwall - Remastered', sourcePackage: SPOTIFY }))
      .toEqual({ artist: 'Oasis', track: 'Wonderwall' });
    expect(cleanTrackMetadata({ artist: 'Nirvana', track: 'Come as You Are - Remastered 2011', sourcePackage: SPOTIFY }))
      .toEqual({ artist: 'Nirvana', track: 'Come as You Are' });
    expect(cleanTrackMetadata({ artist: 'Queen', track: 'Bohemian Rhapsody - 2011 Remaster', sourcePackage: SPOTIFY }))
      .toEqual({ artist: 'Queen', track: 'Bohemian Rhapsody' });
    expect(cleanTrackMetadata({ artist: 'The Beatles', track: 'Let It Be (Remastered 2009)', sourcePackage: SPOTIFY }))
      .toEqual({ artist: 'The Beatles', track: 'Let It Be' });
  });

  it('tanda hubung yang BUKAN noise versi tidak dipisah/dibuang', () => {
    expect(cleanTrackMetadata({ artist: 'MGMT', track: 'Time to Pretend - Bonus', sourcePackage: SPOTIFY }))
      .toEqual({ artist: 'MGMT', track: 'Time to Pretend - Bonus' });
  });

  it('tanpa sourcePackage juga dianggap katalog', () => {
    expect(cleanTrackMetadata({ artist: 'A', track: 'B - C' }))
      .toEqual({ artist: 'A', track: 'B - C' });
  });
});

describe('cleanTrackMetadata — YouTube: kasus nyata dari log', () => {
  it('mashup lo-fi: pisah "Artis - Judul", buang "| Official Audio"', () => {
    const r = cleanTrackMetadata({
      artist: 'Lo-fi Kirana',
      track: 'Dimas Angkasa (Feat Kirana Seo) - Garis Batas ( Mashup) | Official Audio',
      sourcePackage: YTM,
    });
    expect(r).toEqual({
      artist: 'Dimas Angkasa (Feat Kirana Seo)',
      track: 'Garis Batas (Mashup)',
    });
  });

  it('Bluey: buang emoji, "| Bluey", dan suffix channel', () => {
    const r = cleanTrackMetadata({
      artist: 'Bluey - Official Channel',
      track: 'Bluey Extended Theme Song 💙🎶 | Bluey',
      sourcePackage: YTM,
    });
    expect(r).toEqual({ artist: 'Bluey', track: 'Bluey Extended Theme Song' });
  });
});

describe('cleanTrackMetadata — YouTube: pola umum', () => {
  it('channel "- Topic" bersih: buang Topic, JANGAN pisah judul', () => {
    const r = cleanTrackMetadata({
      artist: 'Hindia - Topic',
      track: 'Evaluasi',
      sourcePackage: YTM,
    });
    expect(r).toEqual({ artist: 'Hindia', track: 'Evaluasi' });
  });

  it('"- Topic" dengan judul bertanda hubung tetap tidak dipisah (artis sudah benar)', () => {
    const r = cleanTrackMetadata({
      artist: 'Various Artists - Topic',
      track: 'Intro - Part 1',
      sourcePackage: YTM,
    });
    expect(r).toEqual({ artist: 'Various Artists', track: 'Intro - Part 1' });
  });

  it('buang berbagai tag promosi berkurung', () => {
    expect(cleanTrackMetadata({ artist: 'X', track: 'Feast - Peradaban (Official Music Video)', sourcePackage: YTM }))
      .toEqual({ artist: 'Feast', track: 'Peradaban' });
    expect(cleanTrackMetadata({ artist: 'X', track: 'Nadin Amizah - Bertaut [Lyrics]', sourcePackage: YTM }))
      .toEqual({ artist: 'Nadin Amizah', track: 'Bertaut' });
  });

  it('TIDAK membuang tag bermakna (Remix/Acoustic/Live)', () => {
    expect(cleanTrackMetadata({ artist: 'DJ - Topic', track: 'Lagu (Remix)', sourcePackage: YTM }))
      .toEqual({ artist: 'DJ', track: 'Lagu (Remix)' });
    expect(cleanTrackMetadata({ artist: 'Band', track: 'Sal Priadi - Amin Paling Serius (Live)', sourcePackage: YTM }))
      .toEqual({ artist: 'Sal Priadi', track: 'Amin Paling Serius (Live)' });
  });

  it('judul tanpa pemisah: track = judul bersih, artis = channel tanpa suffix', () => {
    const r = cleanTrackMetadata({
      artist: 'SomeChannel VEVO',
      track: 'Just A Title (Official Video)',
      sourcePackage: YTM,
    });
    expect(r).toEqual({ artist: 'SomeChannel', track: 'Just A Title' });
  });

  it('pisah pada " - " PERTAMA saja', () => {
    const r = cleanTrackMetadata({
      artist: 'Ch',
      track: 'Artis - Judul - Bagian Dua',
      sourcePackage: YTM,
    });
    expect(r).toEqual({ artist: 'Artis', track: 'Judul - Bagian Dua' });
  });

  it('konservatif: kalau hasil pisah kosong, tidak memaksa', () => {
    // " - Judul" -> bagian artis kosong -> jangan pisah
    const r = cleanTrackMetadata({ artist: 'Ch', track: '- Judul Saja', sourcePackage: YTM });
    expect(r.track).toBe('- Judul Saja');
  });

  it('buang blok "[… Release]", "(prod. by …)", "Free Download"', () => {
    expect(cleanTrackMetadata({ artist: 'Ch', track: 'ArtistX - Song [NCS Release]', sourcePackage: YTM }))
      .toEqual({ artist: 'ArtistX', track: 'Song' });
    expect(cleanTrackMetadata({ artist: 'Ch', track: 'Beatmaker - Instrumen (prod. by Someone)', sourcePackage: YTM }))
      .toEqual({ artist: 'Beatmaker', track: 'Instrumen' });
    expect(cleanTrackMetadata({ artist: 'Ch', track: 'DJ - Track (Free Download)', sourcePackage: YTM }))
      .toEqual({ artist: 'DJ', track: 'Track' });
  });

  it('noise versi juga dibersihkan pada judul YouTube setelah dipisah', () => {
    expect(cleanTrackMetadata({ artist: 'Ch', track: 'Oasis - Wonderwall (Remastered) | Official Audio', sourcePackage: YTM }))
      .toEqual({ artist: 'Oasis', track: 'Wonderwall' });
  });

  it('tag YouTube yang diperluas dibuang (COLORS, Visualizer, 4K)', () => {
    expect(cleanTrackMetadata({ artist: 'Ch', track: 'Bernadya - Untungnya, Hidup Harus Tetap Berjalan (Visualizer)', sourcePackage: YTM }))
      .toEqual({ artist: 'Bernadya', track: 'Untungnya, Hidup Harus Tetap Berjalan' });
    expect(cleanTrackMetadata({ artist: 'Ch', track: 'Raim Laode - Komang (4K)', sourcePackage: YTM }))
      .toEqual({ artist: 'Raim Laode', track: 'Komang' });
  });
});
