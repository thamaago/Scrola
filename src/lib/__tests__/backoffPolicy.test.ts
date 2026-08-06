import { describe, it, expect } from 'vitest';
import {
  backoffDelayMs,
  canAttempt,
  nextBackoffState,
  INITIAL_BACKOFF,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
} from '../backoffPolicy';

describe('backoffDelayMs', () => {
  it('0 kegagalan -> tanpa backoff (0)', () => {
    expect(backoffDelayMs(0)).toBe(0);
  });

  it('eksponensial: 1->base, 2->2x, 3->4x', () => {
    expect(backoffDelayMs(1)).toBe(BACKOFF_BASE_MS);
    expect(backoffDelayMs(2)).toBe(BACKOFF_BASE_MS * 2);
    expect(backoffDelayMs(3)).toBe(BACKOFF_BASE_MS * 4);
  });

  it('dibatasi maks', () => {
    expect(backoffDelayMs(99)).toBe(BACKOFF_MAX_MS);
    expect(backoffDelayMs(50)).toBeLessThanOrEqual(BACKOFF_MAX_MS);
  });
});

describe('canAttempt', () => {
  it('nextAllowedAtMs 0 -> selalu boleh', () => {
    expect(canAttempt(INITIAL_BACKOFF, 0)).toBe(true);
    expect(canAttempt(INITIAL_BACKOFF, 999_999)).toBe(true);
  });

  it('sebelum jendela -> tidak boleh; pada/ sesudah -> boleh', () => {
    const s = { consecutiveFailures: 1, nextAllowedAtMs: 1000 };
    expect(canAttempt(s, 999)).toBe(false);
    expect(canAttempt(s, 1000)).toBe(true);
    expect(canAttempt(s, 1001)).toBe(true);
  });
});

describe('nextBackoffState', () => {
  it('sukses -> reset ke INITIAL', () => {
    const failed = { consecutiveFailures: 3, nextAllowedAtMs: 5000 };
    expect(nextBackoffState(failed, 'success', 9999)).toEqual(INITIAL_BACKOFF);
  });

  it('gagal dari 0 -> failures 1, nextAllowed = now + base', () => {
    const s = nextBackoffState(INITIAL_BACKOFF, 'failure', 1000);
    expect(s.consecutiveFailures).toBe(1);
    expect(s.nextAllowedAtMs).toBe(1000 + BACKOFF_BASE_MS);
  });

  it('gagal beruntun menaikkan jeda', () => {
    const s1 = nextBackoffState(INITIAL_BACKOFF, 'failure', 0);
    const s2 = nextBackoffState(s1, 'failure', 0);
    expect(s2.consecutiveFailures).toBe(2);
    expect(s2.nextAllowedAtMs).toBe(BACKOFF_BASE_MS * 2);
  });
});
