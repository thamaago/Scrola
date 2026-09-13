import { usePlayer } from '../hooks/usePlayer';
import type { MusicQueue } from '../hooks/useMusicQueue';

export default function MiniPlayer({ queue, onOpen, onOpenQueue }: { queue: MusicQueue; onOpen: () => void; onOpenQueue: () => void }) {
  const player = usePlayer();
  const track = queue.isActive && queue.currentTrack
    ? { title: queue.currentTrack.title, artist: queue.currentTrack.artist, art: queue.currentArt }
    : player.track
      ? { title: player.track.title, artist: player.track.artist, art: player.track.albumArt }
      : null;

  if (!track) return null;

  const isPlaying = player.state?.isPlaying ?? false;

  return (
    <div className="fixed inset-x-0 bottom-[57px] z-20 px-2 pb-1">
      <div className="mx-auto max-w-lg flex items-center gap-3 rounded-lg border border-amber/20 bg-surfaceRaised/95 px-3 py-2 shadow-lg backdrop-blur-sm">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Buka pemutar">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-ink">
            {track.art ? <img src={track.art} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-amber">♪</span>}
          </div>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-paper">{track.title}</span>
            <span className="block truncate text-[11px] text-muted">{track.artist}</span>
          </span>
        </button>
        <button
          onClick={() => void (isPlaying ? player.pause() : player.resume())}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber/40 text-paper"
          aria-label={isPlaying ? 'Jeda' : 'Putar'}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>
        {queue.isActive && <button onClick={onOpenQueue} className="flex h-9 w-9 shrink-0 items-center justify-center text-amber" aria-label="Buka antrean">≡</button>}
      </div>
    </div>
  );
}
