import { registerPlugin } from '@capacitor/core';

export interface PlayerPluginInterface {
  pickAndPlay(): Promise<{ uri: string; title: string; artist: string; albumArt: string | null }>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seekTo(options: { positionMs: number }): Promise<void>;
  getState(): Promise<{ positionMs: number; durationMs: number; isPlaying: boolean }>;
  addListener(
    eventName: 'playerPositionChanged' | 'playbackEnded',
    listener: (data: any) => void
  ): Promise<{ remove: () => void }>;
}

export const Player = registerPlugin<PlayerPluginInterface>('Player');
