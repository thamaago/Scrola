import { describe, it, expect } from 'vitest';
import {
  subjectHash,
  ticketSerial,
  computeEarnedTickets,
  sortTicketsForDisplay,
  computeTicketProgress,
  type TicketRow,
} from '../ticketSerialLogic';

describe('subjectHash', () => {
  it('deterministik & stabil untuk input sama', () => {
    expect(subjectHash('Hindia')).toBe(subjectHash('Hindia'));
  });

  it('selalu 4 karakter base36', () => {
    for (const s of ['a', 'Barasuara', 'Feast', '', 'nama artis yang sangat panjang sekali']) {
      expect(subjectHash(s)).toMatch(/^[0-9a-z]{4}$/);
    }
  });

  it('subjek berbeda -> hash (hampir selalu) berbeda', () => {
    expect(subjectHash('Hindia')).not.toBe(subjectHash('Feast'));
  });
});

describe('ticketSerial', () => {
  it('format global: SCR-<K>-<6 digit>', () => {
    expect(ticketSerial('jejak', 100)).toBe('SCR-J-000100');
    expect(ticketSerial('penemuan', 10)).toBe('SCR-P-000010');
    expect(ticketSerial('beruntun', 7)).toBe('SCR-B-000007');
  });

  it('tiket terkait subjek menyertakan hash agar unik antar subjek', () => {
    const a = ticketSerial('setia', 50, 'Hindia');
    const b = ticketSerial('setia', 50, 'Feast');
    expect(a).toMatch(/^SCR-S-000050-[0-9a-z]{4}$/);
    expect(b).toMatch(/^SCR-S-000050-[0-9a-z]{4}$/);
    expect(a).not.toBe(b); // ordinal sama, subjek beda -> serial beda
  });

  it('deterministik: pemanggilan ulang identik', () => {
    expect(ticketSerial('setia', 50, 'Hindia')).toBe(ticketSerial('setia', 50, 'Hindia'));
  });
});

describe('computeEarnedTickets — jejak (jumlah scrobble)', () => {
  const cfg = { jejakMilestones: [1, 3], penemuanMilestones: [] };

  function rows(n: number): TicketRow[] {
    return Array.from({ length: n }, (_, i) => ({
      artist: `Artis ${i}`,
      track: `Lagu ${i}`,
      timestamp: 1000 + i, // kronologis
    }));
  }

  it('mencetak tiket saat melintasi milestone, pada timestamp baris pemicunya', () => {
    const t = computeEarnedTickets(rows(3), cfg).filter((x) => x.kind === 'jejak');
    expect(t.map((x) => x.ordinal)).toEqual([1, 3]);
    expect(t[0]).toMatchObject({ serial: 'SCR-J-000001', earnedAtSec: 1000, label: 'Scrobble pertamamu' });
    expect(t[1]).toMatchObject({ serial: 'SCR-J-000003', earnedAtSec: 1002, label: 'Scrobble ke-3' });
  });

  it('tidak mencetak untuk jumlah di antara milestone', () => {
    const t = computeEarnedTickets(rows(2), cfg).filter((x) => x.kind === 'jejak');
    expect(t.map((x) => x.ordinal)).toEqual([1]); // baru sampai 2, milestone 3 belum
  });

  it('mengurutkan input yang acak sebelum menghitung', () => {
    const shuffled = [rows(3)[2], rows(3)[0], rows(3)[1]];
    const t = computeEarnedTickets(shuffled, cfg).filter((x) => x.kind === 'jejak');
    expect(t[1].earnedAtSec).toBe(1002); // milestone ke-3 tetap di baris timestamp terbesar
  });
});

describe('computeEarnedTickets — penemuan (artis unik)', () => {
  const cfg = { jejakMilestones: [], penemuanMilestones: [1, 2] };

  it('menghitung artis unik (case+spasi dinormalisasi) dan mencetak di milestone', () => {
    const rows: TicketRow[] = [
      { artist: 'Hindia', track: 'a', timestamp: 10 },
      { artist: ' hindia ', track: 'b', timestamp: 11 }, // artis sama -> bukan penemuan baru
      { artist: 'Feast', track: 'c', timestamp: 12 }, // penemuan ke-2
    ];
    const t = computeEarnedTickets(rows, cfg).filter((x) => x.kind === 'penemuan');
    expect(t.map((x) => x.ordinal)).toEqual([1, 2]);
    expect(t[0]).toMatchObject({ serial: 'SCR-P-000001', subject: 'Hindia', earnedAtSec: 10 });
    expect(t[1]).toMatchObject({ serial: 'SCR-P-000002', subject: 'Feast', earnedAtSec: 12 });
  });

  it('mengabaikan artis kosong', () => {
    const rows: TicketRow[] = [
      { artist: '   ', track: 'a', timestamp: 10 },
      { artist: 'Barasuara', track: 'b', timestamp: 11 },
    ];
    const t = computeEarnedTickets(rows, cfg).filter((x) => x.kind === 'penemuan');
    expect(t.map((x) => x.subject)).toEqual(['Barasuara']);
  });
});

describe('computeEarnedTickets — properti umum', () => {
  it('tidak memutasi input', () => {
    const rows: TicketRow[] = [
      { artist: 'B', track: 'y', timestamp: 20 },
      { artist: 'A', track: 'x', timestamp: 10 },
    ];
    const snapshot = JSON.stringify(rows);
    computeEarnedTickets(rows, { jejakMilestones: [1], penemuanMilestones: [1] });
    expect(JSON.stringify(rows)).toBe(snapshot);
  });

  it('deterministik: dua pemanggilan menghasilkan serial identik', () => {
    const rows: TicketRow[] = [
      { artist: 'A', track: 'x', timestamp: 10 },
      { artist: 'B', track: 'y', timestamp: 11 },
    ];
    const a = computeEarnedTickets(rows, { jejakMilestones: [1, 2], penemuanMilestones: [1, 2] });
    const b = computeEarnedTickets(rows, { jejakMilestones: [1, 2], penemuanMilestones: [1, 2] });
    expect(a).toEqual(b);
  });

  it('riwayat kosong -> tidak ada tiket', () => {
    expect(computeEarnedTickets([])).toEqual([]);
  });
});

describe('sortTicketsForDisplay', () => {
  it('mengurutkan terbaru dulu, tidak memutasi input', () => {
    const rows: TicketRow[] = [
      { artist: 'A', track: 'x', timestamp: 100 },
      { artist: 'B', track: 'y', timestamp: 300 },
      { artist: 'C', track: 'z', timestamp: 200 },
    ];
    const earned = computeEarnedTickets(rows, { jejakMilestones: [1, 2, 3], penemuanMilestones: [] });
    const snapshot = JSON.stringify(earned);
    const sorted = sortTicketsForDisplay(earned);
    const times = sorted.map((t) => t.earnedAtSec);
    // Terurut menurun (terbaru dulu), apa pun jenis tiket yang ikut tergenerasi.
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    // Tiga tiket jejak yang di-setup tetap urut 300 > 200 > 100.
    expect(sorted.filter((t) => t.kind === 'jejak').map((t) => t.earnedAtSec)).toEqual([300, 200, 100]);
    expect(JSON.stringify(earned)).toBe(snapshot); // input asli tak berubah
  });
});

describe('computeTicketProgress', () => {
  const cfg = { jejakMilestones: [1, 100, 500], penemuanMilestones: [1, 10, 25] };

  function rows(n: number, artistsCount = n): TicketRow[] {
    return Array.from({ length: n }, (_, i) => ({
      artist: `Artis ${i % artistsCount}`,
      track: `Lagu ${i}`,
      timestamp: 1000 + i,
    }));
  }

  it('menghitung total & artis unik, lalu milestone berikutnya + sisa', () => {
    const p = computeTicketProgress(rows(40, 8), cfg);
    expect(p.totalScrobbles).toBe(40);
    expect(p.uniqueArtists).toBe(8);
    expect(p.nextJejak).toEqual({ ordinal: 100, remaining: 60 });
    expect(p.nextPenemuan).toEqual({ ordinal: 10, remaining: 2 });
  });

  it('null saat semua milestone sudah terlampaui', () => {
    const p = computeTicketProgress(rows(600, 30), cfg);
    expect(p.nextJejak).toBeNull(); // 600 > 500 (milestone terbesar)
    expect(p.nextPenemuan).toBeNull(); // 30 > 25
  });

  it('riwayat kosong -> milestone pertama sebagai target', () => {
    const p = computeTicketProgress([], cfg);
    expect(p.totalScrobbles).toBe(0);
    expect(p.nextJejak).toEqual({ ordinal: 1, remaining: 1 });
    expect(p.nextPenemuan).toEqual({ ordinal: 1, remaining: 1 });
  });
});

describe('earnedTrack — lagu pemicu tiap tiket', () => {
  const r = (artist: string, track: string, timestamp: number) => ({ artist, track, timestamp });

  it('jejak ke-1 menyimpan lagu pertama; serial TIDAK berubah', () => {
    const rows = [r('A', 'Lagu Satu', 100), r('B', 'Lagu Dua', 200)];
    const t = computeEarnedTickets(rows, { jejakMilestones: [1], penemuanMilestones: [] });
    const jejak = t.find((x) => x.kind === 'jejak')!;
    expect(jejak.earnedTrack).toEqual({ artist: 'A', track: 'Lagu Satu' });
    expect(jejak.serial).toBe('SCR-J-000001'); // serial tetap dari ordinal, tanpa subject-hash
  });

  it('penemuan menyimpan lagu yang mengenalkan artis; serial tetap dari artis', () => {
    const rows = [r('Muse', 'Starlight', 100), r('Muse', 'Uprising', 150)];
    const t = computeEarnedTickets(rows, { jejakMilestones: [], penemuanMilestones: [1] });
    const p = t.find((x) => x.kind === 'penemuan')!;
    expect(p.subject).toBe('Muse');
    expect(p.earnedTrack).toEqual({ artist: 'Muse', track: 'Starlight' }); // lagu PERTAMA artis itu
  });

  it('jejak ke-3 = scrobble ke-3 kronologis', () => {
    const rows = [r('A', 'x', 100), r('B', 'y', 200), r('C', 'z', 300)];
    const t = computeEarnedTickets(rows, { jejakMilestones: [3], penemuanMilestones: [] });
    expect(t.find((x) => x.kind === 'jejak')!.earnedTrack).toEqual({ artist: 'C', track: 'z' });
  });
});

describe('SETIA — satu artis mencapai N putar', () => {
  const r = (artist: string, track: string, timestamp: number) => ({ artist, track, timestamp });

  it('artis diputar 3× -> tiket setia-3 untuk artis itu, subject + serial ber-hash + earnedTrack', () => {
    const rows = [r('Muse', 'a', 100), r('Lain', 'x', 150), r('Muse', 'b', 200), r('Muse', 'c', 300)];
    const t = computeEarnedTickets(rows, { jejakMilestones: [], penemuanMilestones: [], setiaMilestones: [3] });
    const setia = t.filter((x) => x.kind === 'setia');
    expect(setia).toHaveLength(1);
    expect(setia[0].subject).toBe('Muse');
    expect(setia[0].ordinal).toBe(3);
    expect(setia[0].serial.startsWith('SCR-S-000003-')).toBe(true); // ber-hash subjek
    expect(setia[0].earnedTrack).toEqual({ artist: 'Muse', track: 'c' }); // putaran ke-3 artis itu
  });

  it('dua artis masing-masing mencapai milestone -> dua tiket berbeda serial', () => {
    const rows = [r('A', '1', 1), r('B', '1', 2), r('A', '2', 3), r('B', '2', 4)];
    const t = computeEarnedTickets(rows, { jejakMilestones: [], penemuanMilestones: [], setiaMilestones: [2] });
    const setia = t.filter((x) => x.kind === 'setia');
    expect(setia).toHaveLength(2);
    expect(new Set(setia.map((x) => x.serial)).size).toBe(2);
  });
});

describe('BERUNTUN — streak hari beruntun', () => {
  const DAY = 86400;
  const base = Math.floor(new Date(2026, 0, 1, 10, 0, 0).getTime() / 1000);
  const r = (day: number, artist = 'X', track = 't') => ({ artist, track, timestamp: base + day * DAY });

  it('3 hari beruntun -> tiket beruntun-3 (serial global, tanpa hash) + earnedTrack hari ke-3', () => {
    const rows = [r(0, 'X', 't0'), r(1, 'Y', 't1'), r(2, 'Z', 't2')];
    const t = computeEarnedTickets(rows, { jejakMilestones: [], penemuanMilestones: [], beruntunMilestones: [3] });
    const b = t.filter((x) => x.kind === 'beruntun');
    expect(b).toHaveLength(1);
    expect(b[0].ordinal).toBe(3);
    expect(b[0].serial).toBe('SCR-B-000003');
    expect(b[0].earnedTrack).toEqual({ artist: 'Z', track: 't2' });
  });

  it('streak putus lalu lanjut; milestone hanya sekali', () => {
    // hari 0,1,2 (streak 3), lalu bolong hari 3, lalu 4,5,6 (streak 3 lagi)
    const rows = [r(0), r(1), r(2), r(4), r(5), r(6)];
    const t = computeEarnedTickets(rows, { jejakMilestones: [], penemuanMilestones: [], beruntunMilestones: [3] });
    expect(t.filter((x) => x.kind === 'beruntun')).toHaveLength(1);
  });

  it('beberapa scrobble di hari yang sama tidak menambah streak', () => {
    const rows = [r(0), { ...r(0), track: 't2' }, r(1)];
    const t = computeEarnedTickets(rows, { jejakMilestones: [], penemuanMilestones: [], beruntunMilestones: [2] });
    expect(t.filter((x) => x.kind === 'beruntun')).toHaveLength(1); // hari 0 & 1 = streak 2
  });
});
