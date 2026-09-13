import type { MusicQueue } from '../hooks/useMusicQueue';

export default function QueueSheet({ queue, onClose }: { queue: MusicQueue; onClose: () => void }) {
  if (!queue.isActive || queue.items.length === 0) return null;
  const upcoming = queue.items.slice(queue.position + 1);
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/50" role="dialog" aria-modal="true" aria-label="Antrean pemutaran">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Tutup antrean" />
      <section className="relative max-h-[75vh] w-full overflow-y-auto rounded-t-2xl border-t border-amber/20 bg-surface px-5 pb-8 pt-4 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted/40" />
        <div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">Pemutar</p><h2 className="font-display text-xl font-semibold text-paper">Antrean</h2></div><button onClick={onClose} className="text-sm text-muted">Tutup</button></div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Sedang diputar</p>
        <div className="flex items-center gap-3 rounded-lg border border-amber/25 bg-surfaceRaised px-3 py-3"><div className="flex h-11 w-11 items-center justify-center rounded bg-ink text-amber">♪</div><div className="min-w-0"><p className="truncate text-sm font-medium text-paper">{queue.currentTrack?.title}</p><p className="truncate text-xs text-muted">{queue.currentTrack?.artist}</p></div></div>
        <p className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Berikutnya</p>
        {upcoming.length === 0 ? <p className="rounded-lg bg-ink px-3 py-4 text-sm text-muted">Tidak ada lagu berikutnya.</p> : <div className="space-y-1">{upcoming.map((track, index) => <div key={`${track.id}-${index}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5"><span className="w-5 text-center font-mono text-[11px] text-muted">{index + 1}</span><div className="min-w-0"><p className="truncate text-sm text-paper">{track.title}</p><p className="truncate text-xs text-muted">{track.artist}</p></div></div>)}</div>}
      </section>
    </div>
  );
}
