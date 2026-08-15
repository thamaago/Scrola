import { describe, it, expect } from 'vitest';
import { ticketPatternSeed, ticketEarnedLine, emblemSeed } from '../ticketShareLayout';
import type { CollectibleTicket } from '../ticketSerialLogic';

const base: CollectibleTicket = {
  kind: 'jejak',
  ordinal: 100,
  serial: 'SCR-J-000100',
  label: 'Scrobble ke-100',
  earnedAtSec: 1_700_000_000,
};

describe('ticketPatternSeed', () => {
  it('deterministik & stabil untuk serial yang sama', () => {
    expect(ticketPatternSeed('SCR-J-000100')).toBe(ticketPatternSeed('SCR-J-000100'));
  });
  it('serial berbeda -> seed berbeda', () => {
    expect(ticketPatternSeed('SCR-J-000100')).not.toBe(ticketPatternSeed('SCR-J-000001'));
  });
  it('selalu angka non-negatif', () => {
    expect(ticketPatternSeed('SCR-P-000050')).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(ticketPatternSeed('x'))).toBe(true);
  });
});

describe('ticketEarnedLine', () => {
  it('jejak (tanpa subject) -> "Artis — Judul"', () => {
    const t = { ...base, earnedTrack: { artist: 'Daniel Powter', track: 'Bad Day' } };
    expect(ticketEarnedLine(t)).toBe('Daniel Powter — Bad Day');
  });
  it('penemuan (ada subject artis) -> lewat "Judul"', () => {
    const t: CollectibleTicket = {
      kind: 'penemuan', ordinal: 50, serial: 'SCR-P-000050', label: 'Artis ke-50',
      earnedAtSec: 1, subject: 'Michael Bublé',
      earnedTrack: { artist: 'Michael Bublé', track: "Haven't Met You Yet" },
    };
    expect(ticketEarnedLine(t)).toBe('lewat “Haven\'t Met You Yet”');
  });
  it('tanpa earnedTrack -> null', () => {
    expect(ticketEarnedLine(base)).toBeNull();
  });
});

describe('emblemSeed', () => {
  it('deterministik dari lagu (artist|track)', () => {
    const t = { ...base, earnedTrack: { artist: 'Muse', track: 'Starlight' } };
    expect(emblemSeed(t)).toBe(emblemSeed({ ...t }));
  });
  it('lagu berbeda -> seed berbeda', () => {
    const a = { ...base, earnedTrack: { artist: 'Muse', track: 'Starlight' } };
    const b = { ...base, earnedTrack: { artist: 'Muse', track: 'Uprising' } };
    expect(emblemSeed(a)).not.toBe(emblemSeed(b));
  });
  it('tanpa earnedTrack -> fallback ke serial, tetap angka valid', () => {
    expect(emblemSeed(base)).toBe(emblemSeed({ ...base }));
    expect(Number.isFinite(emblemSeed(base))).toBe(true);
  });
});
