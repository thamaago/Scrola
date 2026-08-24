import { describe, it, expect } from 'vitest';
import { buildValidationLines, PENDING_VALIDATION, APP_VERSION } from '../validationChecklist';

describe('buildValidationLines', () => {
  it('baris pertama = stempel build dengan versi', () => {
    const lines = buildValidationLines();
    expect(lines[0]).toContain('BUILD');
    expect(lines[0]).toContain(APP_VERSION);
  });

  it('mencantumkan jumlah & tiap item validasi tertunda', () => {
    const lines = buildValidationLines();
    const joined = lines.join('\n');
    expect(joined).toContain(`VALIDASI tertunda (${PENDING_VALIDATION.length})`);
    for (const item of PENDING_VALIDATION) {
      expect(joined).toContain(item);
    }
  });

  it('daftar tidak kosong & tanpa duplikat', () => {
    expect(PENDING_VALIDATION.length).toBeGreaterThan(0);
    expect(new Set(PENDING_VALIDATION).size).toBe(PENDING_VALIDATION.length);
  });
});
