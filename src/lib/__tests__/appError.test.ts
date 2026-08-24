import { describe, it, expect, afterEach } from 'vitest';
import { AppError, toErrDescriptor, errText, errTextFor } from '../appError';
import {
  getActiveLocale,
  setActiveLocale,
  tActive,
  DEFAULT_LOCALE,
} from '../i18n';
import { parseBackup } from '../backupData';

// Cermin locale bersifat global — kembalikan ke default tiap selesai agar test tak saling bocor.
afterEach(() => setActiveLocale(DEFAULT_LOCALE));

describe('AppError & deskriptor', () => {
  it('AppError menyimpan key & params, .message = key (fallback log)', () => {
    const e = new AppError('err.backup.corruptRow', { row: 3 });
    expect(e.key).toBe('err.backup.corruptRow');
    expect(e.params).toEqual({ row: 3 });
    expect(e.message).toBe('err.backup.corruptRow');
    expect(e).toBeInstanceOf(Error);
  });

  it('toErrDescriptor: AppError dipetakan; lainnya jatuh ke fallback', () => {
    expect(toErrDescriptor(new AppError('err.mp3.save'))).toEqual({ key: 'err.mp3.save', params: undefined });
    expect(toErrDescriptor(new Error('boom'))).toEqual({ key: 'err.generic' });
    expect(toErrDescriptor('x', 'err.mp3.read')).toEqual({ key: 'err.mp3.read' });
  });

  it('errTextFor menerjemahkan dgn locale eksplisit', () => {
    expect(errTextFor(new AppError('err.backup.notScrola'), 'en')).toBe('This file isn’t a Scrola backup.');
    expect(errTextFor(new AppError('err.backup.notScrola'), 'id')).toBe('File ini bukan backup Scrola.');
    // interpolasi params
    expect(errTextFor(new AppError('err.backup.corruptRow', { row: 7 }), 'en')).toContain('7');
  });
});

describe('cermin locale aktif (untuk konteks non-React)', () => {
  it('tActive mengikuti locale aktif', () => {
    setActiveLocale('en');
    expect(getActiveLocale()).toBe('en');
    expect(tActive('err.boundary.reload')).toBe('Reload');
    expect(errText(new AppError('err.mp3.pick'))).toBe(
      'Couldn’t read the selected MP3 file. Make sure the format is correct.'
    );
    setActiveLocale('id');
    expect(tActive('err.boundary.reload')).toBe('Muat Ulang');
  });
});

describe('parseBackup melempar AppError berkunci', () => {
  it('JSON tak valid -> err.backup.notJson', () => {
    try {
      parseBackup('bukan json');
      throw new Error('seharusnya melempar');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).key).toBe('err.backup.notJson');
    }
  });
  it('bukan backup Scrola -> err.backup.notScrola', () => {
    try {
      parseBackup(JSON.stringify({ type: 'lain', version: 1, history: [] }));
      throw new Error('seharusnya melempar');
    } catch (e) {
      expect((e as AppError).key).toBe('err.backup.notScrola');
    }
  });
  it('baris rusak -> err.backup.corruptRow dgn nomor baris', () => {
    const bad = JSON.stringify({ type: 'scrola-backup', version: 1, history: [{ artist: '', track: '', timestamp: 'x' }] });
    try {
      parseBackup(bad);
      throw new Error('seharusnya melempar');
    } catch (e) {
      expect((e as AppError).key).toBe('err.backup.corruptRow');
      expect((e as AppError).params).toEqual({ row: 1 });
    }
  });
});
