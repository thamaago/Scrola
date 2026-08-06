import { describe, it, expect } from 'vitest';
import { computeDiscoveries, type DiscoveryRow } from '../discoveryLogic';

const r = (artist: string, track: string, timestamp: number): DiscoveryRow => ({ artist, track, timestamp });

describe('computeDiscoveries', () => {
  it('satu entri per artis: penemuan = kemunculan PERTAMA (timestamp terkecil)', () => {
    const rows = [
      r('Kirana Seo', 'Garis Batas', 200),
      r('Kirana Seo', 'To Do', 100), // lebih awal -> ini penemuannya
      r('Muse', 'Starlight', 150),
    ];
    const d = computeDiscoveries(rows);
    const kirana = d.find((x) => x.artist === 'Kirana Seo')!;
    expect(kirana.firstTrack).toBe('To Do');
    expect(kirana.firstTimestamp).toBe(100);
  });

  it('menghitung total putar per artis', () => {
    const rows = [r('Muse', 'Starlight', 1), r('Muse', 'Uprising', 2), r('Muse', 'Starlight', 3)];
    expect(computeDiscoveries(rows)[0].playCount).toBe(3);
  });

  it('urut penemuan TERBARU dulu (firstTimestamp desc)', () => {
    const rows = [r('A', 't', 100), r('B', 't', 300), r('C', 't', 200)];
    expect(computeDiscoveries(rows).map((x) => x.artist)).toEqual(['B', 'C', 'A']);
  });

  it('array kosong -> []', () => {
    expect(computeDiscoveries([])).toEqual([]);
  });

  it('mengabaikan baris tanpa artist (kosong/whitespace)', () => {
    const rows = [r('', 'x', 1), r('   ', 'y', 2), r('Real', 'z', 3)];
    const d = computeDiscoveries(rows);
    expect(d.map((x) => x.artist)).toEqual(['Real']);
  });

  it('artis yang sama beda kapitalisasi/spasi dianggap satu (dinormalkan)', () => {
    const rows = [r('muse', 'a', 10), r('Muse', 'b', 5), r('MUSE ', 'c', 20)];
    const d = computeDiscoveries(rows);
    expect(d).toHaveLength(1);
    expect(d[0].playCount).toBe(3);
    expect(d[0].firstTimestamp).toBe(5); // kemunculan paling awal
    expect(d[0].firstTrack).toBe('b');
  });

  it('mempertahankan bentuk tampil artis dari kemunculan pertama', () => {
    const rows = [r('MUSE', 'a', 10), r('muse', 'b', 5)];
    // pertama (ts=5) memakai "muse" -> itu yang ditampilkan
    expect(computeDiscoveries(rows)[0].artist).toBe('muse');
  });
});
