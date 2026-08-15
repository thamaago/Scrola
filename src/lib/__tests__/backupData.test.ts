import { describe, it, expect } from 'vitest';
import {
  serializeBackup,
  parseBackup,
  mergeBackup,
  BACKUP_VERSION,
  type BackupHistoryRow,
  type LocalHistoryRow,
} from '../backupData';

const row = (over: Partial<BackupHistoryRow> = {}): BackupHistoryRow => ({
  artist: 'Kirana Seo',
  track: 'Garis Batas',
  timestamp: 1_690_000_000,
  ...over,
});
const local = (id: number, over: Partial<LocalHistoryRow> = {}): LocalHistoryRow => ({
  id,
  artist: 'Kirana Seo',
  track: 'Garis Batas',
  timestamp: 1_690_000_000,
  ...over,
});

describe('serializeBackup / parseBackup', () => {
  it('round-trip: catatan, favorit, dan kunci alami selamat (parse menormalkan bentuk)', () => {
    const rows = [row({ note: 'lagu penutup yang pas' }), row({ track: 'To Do', timestamp: 1_690_000_100, favorite: true })];
    const parsed = parseBackup(serializeBackup(rows, 1_690_000_500));
    expect(parsed.rows[0].note).toBe('lagu penutup yang pas');
    expect(parsed.rows[1].favorite).toBe(true);
    expect(parsed.rows.map((r) => ({ artist: r.artist, track: r.track, timestamp: r.timestamp }))).toEqual(
      rows.map((r) => ({ artist: r.artist, track: r.track, timestamp: r.timestamp }))
    );
    expect(parsed.version).toBe(BACKUP_VERSION);
    expect(parsed.exportedAt).toBe(1_690_000_500);
  });

  it('envelope memuat penanda tipe & jumlah', () => {
    const obj = JSON.parse(serializeBackup([row({ note: 'x' })], 1));
    expect(obj.type).toBe('scrola-backup');
    expect(obj.version).toBe(BACKUP_VERSION);
    expect(obj.counts.history).toBe(1);
    expect(obj.counts.notes).toBe(1);
  });

  it('menolak JSON non-backup / tipe salah / versi tak didukung / history bukan array', () => {
    expect(() => parseBackup('bukan json')).toThrow();
    expect(() => parseBackup(JSON.stringify({ type: 'lain', version: 1, history: [] }))).toThrow();
    expect(() => parseBackup(JSON.stringify({ type: 'scrola-backup', version: 999, history: [] }))).toThrow();
    expect(() => parseBackup(JSON.stringify({ type: 'scrola-backup', version: 1, history: {} }))).toThrow();
  });

  it('menolak baris tanpa field wajib (artist/track/timestamp)', () => {
    const bad = JSON.stringify({ type: 'scrola-backup', version: 1, history: [{ artist: 'A', track: 'B' }] });
    expect(() => parseBackup(bad)).toThrow();
  });
});

describe('mergeBackup — non-destruktif', () => {
  it('DB lokal kosong: semua incoming jadi toInsert', () => {
    const plan = mergeBackup([], [row({ note: 'a' }), row({ track: 'To Do', timestamp: 2, note: 'b' })]);
    expect(plan.toInsert).toHaveLength(2);
    expect(plan.noteRestores).toHaveLength(0);
    expect(plan.noteConflicts).toBe(0);
  });

  it('catatan dipulihkan HANYA kalau baris lokal cocok belum punya catatan', () => {
    const plan = mergeBackup([local(7, { note: null })], [row({ note: 'kembali' })]);
    expect(plan.noteRestores).toEqual([{ id: 7, note: 'kembali' }]);
    expect(plan.toInsert).toHaveLength(0);
  });

  it('TIDAK PERNAH menimpa catatan lokal yang sudah ada (konflik dicatat, lokal menang)', () => {
    const plan = mergeBackup([local(7, { note: 'punyaku' })], [row({ note: 'dari backup' })]);
    expect(plan.noteRestores).toHaveLength(0);
    expect(plan.noteConflicts).toBe(1);
  });

  it('catatan sama persis -> bukan konflik, tak ada perubahan', () => {
    const plan = mergeBackup([local(7, { note: 'sama' })], [row({ note: 'sama' })]);
    expect(plan.noteConflicts).toBe(0);
    expect(plan.noteRestores).toHaveLength(0);
  });

  it('incoming tanpa catatan tidak pernah mengosongkan catatan lokal', () => {
    const plan = mergeBackup([local(7, { note: 'tetap' })], [row({ note: null })]);
    expect(plan.noteRestores).toHaveLength(0);
    expect(plan.noteConflicts).toBe(0);
  });

  it('favorit dipulihkan aditif (backup fav, lokal belum) — tak pernah meng-unfavorite', () => {
    const plan = mergeBackup([local(7, { favorite: false })], [row({ favorite: true })]);
    expect(plan.favoriteRestores).toEqual([7]);
    const plan2 = mergeBackup([local(7, { favorite: true })], [row({ favorite: false })]);
    expect(plan2.favoriteRestores).toHaveLength(0);
  });

  it('cocok berdasarkan (artist, track, timestamp) — beda timestamp = baris berbeda', () => {
    const plan = mergeBackup([local(7, { timestamp: 111 })], [row({ timestamp: 222, note: 'a' })]);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.noteRestores).toHaveLength(0);
  });
});

// ---- Tiket bertahan lewat backup (deterministik dari riwayat) ----
import { computeEarnedTickets } from '../ticketSerialLogic';
import { mergeCorrections } from '../corrections';

describe('tiket bertahan backup→restore (deterministik dari riwayat)', () => {
  it('computeEarnedTickets sama sebelum & sesudah serialize→parse', () => {
    const rows = [
      { artist: 'Muse', track: 'Starlight', timestamp: 1_700_000_000 },
      { artist: 'Muse', track: 'Uprising', timestamp: 1_700_000_100 },
      { artist: 'Adele', track: 'Hello', timestamp: 1_700_000_200 },
    ];
    const before = computeEarnedTickets(rows);
    const parsed = parseBackup(serializeBackup(rows, 123));
    const after = computeEarnedTickets(parsed.rows);
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });
});

describe('corrections di dalam backup', () => {
  const c = (fa: string, ft: string, ta: string, tt: string) => ({ fromArtist: fa, fromTrack: ft, toArtist: ta, toTrack: tt });

  it('serialize menyertakan corrections; parse mengembalikannya', () => {
    const rows = [{ artist: 'A', track: 'x', timestamp: 1 }];
    const corr = [c('a', 'x', 'A Real', 'X Real')];
    const parsed = parseBackup(serializeBackup(rows, 1, corr));
    expect(parsed.corrections).toEqual(corr);
  });

  it('backup lama tanpa corrections -> parsed.corrections = []', () => {
    const parsed = parseBackup(serializeBackup([{ artist: 'A', track: 'x', timestamp: 1 }], 1));
    expect(parsed.corrections).toEqual([]);
  });

  it('mergeCorrections: union, tidak menimpa aturan lokal yang sudah ada', () => {
    const local = [c('a', 'x', 'Lokal', 'X')];
    const incoming = [c('a', 'x', 'Masuk', 'X'), c('b', 'y', 'Baru', 'Y')];
    const merged = mergeCorrections(local, incoming);
    // aturan lokal 'a|x' dipertahankan (tidak ditimpa), 'b|y' ditambahkan
    expect(merged.find((r) => r.fromArtist === 'a')!.toArtist).toBe('Lokal');
    expect(merged.some((r) => r.fromArtist === 'b')).toBe(true);
    expect(merged).toHaveLength(2);
  });
});
