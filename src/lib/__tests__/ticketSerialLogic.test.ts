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
    expect(sorted.map((t) => t.earnedAtSec)).toEqual([300, 200, 100]);
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
