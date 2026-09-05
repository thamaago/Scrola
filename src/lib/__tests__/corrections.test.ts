import { describe, it, expect } from 'vitest';
import {
  matchKey,
  shouldRecordCorrection,
  upsertRule,
  removeRule,
  applyCorrection,
  MAX_CORRECTION_RULES,
  type CorrectionRule,
} from '../corrections';

describe('matchKey — normalisasi', () => {
  it('case-insensitive & spasi dikolaps', () => {
    expect(matchKey('  Bluey ', 'Theme   Song')).toBe(matchKey('bluey', 'theme song'));
  });
  it('artis vs track tidak tertukar', () => {
    expect(matchKey('A', 'B')).not.toBe(matchKey('B', 'A'));
  });
});

describe('shouldRecordCorrection', () => {
  it('true kalau benar-benar berubah', () => {
    expect(shouldRecordCorrection({ artist: 'Ch', track: 'Vid' }, { artist: 'Real', track: 'Song' })).toBe(true);
  });
  it('false kalau hanya beda kapital/spasi', () => {
    expect(shouldRecordCorrection({ artist: 'A', track: 'B' }, { artist: 'a', track: ' b ' })).toBe(false);
  });
  it('false kalau target kosong', () => {
    expect(shouldRecordCorrection({ artist: 'A', track: 'B' }, { artist: '', track: 'B' })).toBe(false);
  });
});

describe('upsertRule', () => {
  it('menambah aturan baru di depan', () => {
    const r = upsertRule([], { artist: 'Ch', track: 'Vid' }, { artist: 'Real', track: 'Song' });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ fromArtist: 'Ch', toArtist: 'Real' });
  });
  it('replace aturan dengan from yang sama (tidak menggandakan)', () => {
    let r = upsertRule([], { artist: 'Ch', track: 'Vid' }, { artist: 'Real', track: 'Song' });
    r = upsertRule(r, { artist: 'ch', track: 'vid' }, { artist: 'Real2', track: 'Song2' });
    expect(r).toHaveLength(1);
    expect(r[0].toArtist).toBe('Real2');
  });
  it('tidak menambah kalau perubahan trivial', () => {
    const r = upsertRule([], { artist: 'A', track: 'B' }, { artist: 'a', track: 'b' });
    expect(r).toHaveLength(0);
  });
  it('dibatasi MAX_CORRECTION_RULES', () => {
    let r: CorrectionRule[] = [];
    for (let i = 0; i < MAX_CORRECTION_RULES + 20; i++) {
      r = upsertRule(r, { artist: `dirty${i}`, track: `vid${i}` }, { artist: `Artist${i}`, track: `Song${i}` });
    }
    expect(r.length).toBe(MAX_CORRECTION_RULES);
    // yang terbaru dipertahankan (dirty{MAX+19} ada di depan)
    expect(r[0].fromArtist).toBe(`dirty${MAX_CORRECTION_RULES + 19}`);
  });
});

describe('removeRule', () => {
  const rules: CorrectionRule[] = [
    { fromArtist: 'Ch1', fromTrack: 'V1', toArtist: 'A1', toTrack: 'T1' },
    { fromArtist: 'Ch2', fromTrack: 'V2', toArtist: 'A2', toTrack: 'T2' },
  ];
  it('membuang aturan yang cocok (case-insensitive)', () => {
    const r = removeRule(rules, 'ch1', 'v1');
    expect(r).toHaveLength(1);
    expect(r[0].fromArtist).toBe('Ch2');
  });
  it('tidak mengubah kalau tak ada yang cocok', () => {
    expect(removeRule(rules, 'X', 'Y')).toHaveLength(2);
  });
});

describe('applyCorrection', () => {
  const rules: CorrectionRule[] = [
    { fromArtist: 'Bluey - Official Channel', fromTrack: 'Bluey Extended Theme Song', toArtist: 'Joff Bush', toTrack: 'Bluey Theme' },
  ];
  it('menerapkan koreksi yang cocok (case-insensitive)', () => {
    expect(applyCorrection({ artist: 'bluey - official channel', track: 'BLUEY EXTENDED THEME SONG' }, rules))
      .toEqual({ artist: 'Joff Bush', track: 'Bluey Theme' });
  });
  it('membiarkan yang tidak cocok', () => {
    expect(applyCorrection({ artist: 'Snow Patrol', track: 'Chasing Cars' }, rules))
      .toEqual({ artist: 'Snow Patrol', track: 'Chasing Cars' });
  });
  it('aturan kosong = tanpa perubahan', () => {
    expect(applyCorrection({ artist: 'A', track: 'B' }, [])).toEqual({ artist: 'A', track: 'B' });
  });
});
