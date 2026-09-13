import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../secureStore', () => ({ loadSession: vi.fn(async () => ({ username: 'test', sk: 'test' })) }));
vi.mock('../lastfm', () => ({ scrobbleBatch: vi.fn(), updateNowPlaying: vi.fn() }));
vi.mock('../pendingNotes', () => ({ flushPendingNotes: vi.fn() }));
vi.mock('../diagnostics', () => ({ diag: vi.fn() }));
vi.mock('../db/queries', () => ({
  addToQueue: vi.fn(), getQueueBatch: vi.fn(), removeFromQueue: vi.fn(),
  markQueueAttemptFailed: vi.fn(), addHistoryBatch: vi.fn(), getHistory: vi.fn(),
}));

import { flushQueue } from '../scrobbleEngine';
import { scrobbleBatch } from '../lastfm';
import { getQueueBatch, removeFromQueue, markQueueAttemptFailed, addHistoryBatch } from '../db/queries';

describe('offline queue retention', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps a scrobble through more than eight failed requests and sends it on recovery', async () => {
    const row = { id: 1, artist: 'Artist', track: 'Song', timestamp: 1700000000, attempts: 0 };
    vi.mocked(getQueueBatch).mockImplementation(async () => [row]);
    vi.mocked(markQueueAttemptFailed).mockImplementation(async () => { row.attempts++; });
    vi.mocked(scrobbleBatch).mockRejectedValue(new Error('Offline'));

    for (let i = 0; i < 12; i++) await flushQueue();
    expect(row.attempts).toBe(12);
    expect(removeFromQueue).not.toHaveBeenCalled();
    expect(addHistoryBatch).not.toHaveBeenCalled();

    vi.mocked(scrobbleBatch).mockResolvedValue({ scrobbles: { scrobble: { ignoredMessage: { code: '0' } } } });
    vi.mocked(getQueueBatch).mockReset().mockResolvedValueOnce([row]).mockResolvedValue([]);
    await flushQueue();
    expect(removeFromQueue).toHaveBeenCalledOnce();
    expect(removeFromQueue).toHaveBeenCalledWith([1]);
    expect(addHistoryBatch).toHaveBeenCalledOnce();
  });
});
