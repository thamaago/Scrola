import { registerPlugin } from '@capacitor/core';
import type { LibraryTrack } from './musicLibrary';

export interface PlayerPluginInterface {
  pickAndPlay(): Promise<{ uri: string; title: string; artist: string; albumArt: string | null }>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seekTo(options: { positionMs: number }): Promise<void>;
  getState(): Promise<{ positionMs: number; durationMs: number; isPlaying: boolean }>;
  /** Pindai pustaka musik lokal (MediaStore). Meminta izin READ_MEDIA_AUDIO di API 33+. */
  scanLibrary(): Promise<{ granted: boolean; tracks: LibraryTrack[] }>;
  /** Ambil album art satu lagu (data URI ter-downscale) on-demand. "" bila tak ada. */
  getAlbumArt(options: { uri: string }): Promise<{ art: string }>;
  /** Putar antrean (gapless via setMediaItems native). items dalam urutan main final. */
  playQueue(options: {
    items: { uri: string; title: string; artist: string }[];
    startIndex: number;
  }): Promise<void>;
  skipNext(): Promise<void>;
  skipPrev(): Promise<void>;
  skipToIndex(options: { index: number }): Promise<void>;
  setRepeatMode(options: { mode: 'off' | 'all' | 'one' }): Promise<void>;
  addListener(
    eventName: 'playerPositionChanged' | 'playbackEnded' | 'queueIndexChanged',
    listener: (data: any) => void
  ): Promise<{ remove: () => void }>;
}

export const Player = registerPlugin<PlayerPluginInterface>('Player');

/** Ambil album art satu lagu dengan aman (web preview / gagal -> null). */
export async function fetchAlbumArt(uri: string): Promise<string | null> {
  try {
    const r = await Player.getAlbumArt({ uri });
    return r?.art ? r.art : null;
  } catch {
    return null;
  }
}

/** Putar daftar LibraryTrack (sudah dalam urutan main) sebagai antrean gapless. */
export async function playQueueTracks(tracks: LibraryTrack[], startIndex = 0): Promise<void> {
  if (tracks.length === 0) return;
  await Player.playQueue({
    items: tracks.map((t) => ({ uri: t.uri, title: t.title, artist: t.artist })),
    startIndex,
  });
}

/**
 * Pindai pustaka lokal dengan aman untuk web preview (plugin native tak ada -> kosong).
 * Mengembalikan { granted, tracks }.
 */
export async function scanLocalLibrary(): Promise<{ granted: boolean; tracks: LibraryTrack[] }> {
  try {
    const res = await Player.scanLibrary();
    return { granted: res?.granted ?? false, tracks: res?.tracks ?? [] };
  } catch {
    return { granted: false, tracks: [] };
  }
}
