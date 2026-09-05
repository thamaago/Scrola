import { useCallback, useEffect, useRef, useState } from 'react';
import { Player, playQueueTracks, fetchAlbumArt } from '../lib/player';
import type { LibraryTrack } from '../lib/musicLibrary';
import {
  createQueue,
  currentItemIndex,
  cycleRepeat,
  toggleShuffle,
  type QueueState,
  type RepeatMode,
} from '../lib/playbackQueue';

/**
 * useMusicQueue — state antrean aktif untuk pemutar internal (Tahap 5b).
 *
 * Pembagian tanggung jawab: JS memiliki URUTAN (shuffle) & MODE (repeat) lewat QueueState (teruji);
 * native memiliki RUNTIME (posisi berjalan) dan memancarkan `queueIndexChanged` saat auto-advance /
 * skip — JS mencerminkannya. next/prev memakai skip native (satu sumber runtime, hindari logika
 * ganda); repeat/shuffle memakai fungsi murni lalu dikonfigurasi ke native.
 */
export function useMusicQueue() {
  const [tracks, setTracks] = useState<LibraryTrack[]>([]); // urutan ASLI (sejajar QueueState.items)
  const [state, setState] = useState<QueueState>(() => createQueue([]));
  const stateRef = useRef(state);
  stateRef.current = state;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  // Native memberi tahu indeks (posisi di urutan main) saat track berpindah.
  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    Player.addListener('queueIndexChanged', (data: { index: number }) => {
      setState((s) => (s.position === data.index ? s : { ...s, position: data.index }));
    })
      .then((h) => {
        handle = h;
      })
      .catch(() => {
        /* plugin tak ada (web) */
      });
    return () => handle?.remove();
  }, []);

  const orderedTracks = (q: QueueState, list: LibraryTrack[]): LibraryTrack[] =>
    q.playOrder.map((i) => list[i]).filter((t): t is LibraryTrack => !!t);

  /** Mulai memutar sebuah daftar (urutan asli) mulai dari startIndex, sebagai antrean gapless. */
  const playList = useCallback(async (list: LibraryTrack[], startIndex: number) => {
    const q = createQueue(
      list.map((t) => t.id),
      startIndex
    );
    setTracks(list);
    tracksRef.current = list;
    setState(q);
    stateRef.current = q;
    await playQueueTracks(orderedTracks(q, list), q.position).catch(() => {});
  }, []);

  const nextTrack = useCallback(() => {
    void Player.skipNext().catch(() => {});
  }, []);
  const prevTrack = useCallback(() => {
    void Player.skipPrev().catch(() => {});
  }, []);

  const cycleRepeatMode = useCallback(() => {
    setState((s) => {
      const ns = cycleRepeat(s);
      void Player.setRepeatMode({ mode: ns.repeat }).catch(() => {});
      return ns;
    });
  }, []);

  const toggleShuffleMode = useCallback(() => {
    const s = stateRef.current;
    const list = tracksRef.current;
    const ns = toggleShuffle(s);
    setState(ns);
    stateRef.current = ns;
    // Terbitkan ulang dengan urutan baru, lompat ke track saat ini (kini di ns.position).
    void playQueueTracks(orderedTracks(ns, list), ns.position).catch(() => {});
  }, []);

  const clear = useCallback(() => {
    setTracks([]);
    setState(createQueue([]));
  }, []);

  const itemIndex = currentItemIndex(state);
  const currentTrack: LibraryTrack | null = itemIndex >= 0 ? tracks[itemIndex] ?? null : null;

  // Ambil album art lagu saat ini (on-demand). Reset saat berganti; batal bila unmount/ganti cepat.
  const [currentArt, setCurrentArt] = useState<string | null>(null);
  useEffect(() => {
    if (!currentTrack) {
      setCurrentArt(null);
      return;
    }
    let cancelled = false;
    setCurrentArt(null);
    void fetchAlbumArt(currentTrack.uri).then((a) => {
      if (!cancelled) setCurrentArt(a);
    });
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id]);

  return {
    currentTrack,
    currentArt,
    isActive: tracks.length > 0 && state.position >= 0,
    repeat: state.repeat as RepeatMode,
    shuffle: state.shuffle,
    position: state.position,
    total: state.playOrder.length,
    playList,
    nextTrack,
    prevTrack,
    cycleRepeatMode,
    toggleShuffleMode,
    clear,
  };
}

export type MusicQueue = ReturnType<typeof useMusicQueue>;
