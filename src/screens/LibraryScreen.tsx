import { useEffect, useMemo, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { scanLocalLibrary, playQueueTracks } from '../lib/player';
import {
  groupIntoAlbums,
  groupIntoArtists,
  sortTracks,
  searchLibrary,
  type LibraryTrack,
  type TrackSort,
} from '../lib/musicLibrary';
import { formatDurationHuman } from '../lib/sisiBLogic';

/**
 * LibraryScreen — browser pustaka musik lokal ("pemutar sungguhan" Tahap 5).
 *
 * Menyambung scanLibrary (native MediaStore) -> musicLibrary (grup/sort/cari, murni & teruji) ->
 * playQueueTracks (native, gapless). Ketuk lagu = putar daftar yang terlihat sebagai antrean gapless
 * mulai dari situ. Render final terbukti di perangkat; logika penyusun sudah teruji penuh.
 */

type Tab = 'lagu' | 'album' | 'artis';

const SORT_LABEL: Record<TrackSort, string> = {
  title: 'Judul',
  artist: 'Artis',
  album: 'Album',
  recent: 'Terbaru',
  duration: 'Durasi',
};
const SORT_CYCLE: TrackSort[] = ['title', 'artist', 'album', 'recent', 'duration'];

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function LibraryScreen({
  open,
  onClose,
  onPlayQueue,
}: {
  open: boolean;
  onClose: () => void;
  /** Kalau ada, putar lewat antrean app-level (agar layar Sekarang mencerminkannya). */
  onPlayQueue?: (list: LibraryTrack[], startIndex: number) => void;
}) {
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [granted, setGranted] = useState(true);
  const [tab, setTab] = useState<Tab>('lagu');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<TrackSort>('title');

  useEffect(() => {
    if (!open) return;
    const listener = CapApp.addListener('backButton', () => onClose());
    return () => {
      void listener.then((h) => h.remove());
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void scanLocalLibrary().then((res) => {
      if (cancelled) return;
      setGranted(res.granted);
      setTracks(res.tracks);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => searchLibrary(tracks, query), [tracks, query]);
  const sortedTracks = useMemo(() => sortTracks(filtered, sort), [filtered, sort]);
  const albums = useMemo(() => (tab === 'album' ? groupIntoAlbums(filtered) : []), [tab, filtered]);
  const artists = useMemo(() => (tab === 'artis' ? groupIntoArtists(filtered) : []), [tab, filtered]);

  if (!open) return null;

  const playFrom = (list: LibraryTrack[], index: number) => {
    if (onPlayQueue) onPlayQueue(list, index);
    else void playQueueTracks(list, index);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-ink z-40 overflow-y-auto">
      <div className="relative px-6 pt-10 pb-16 min-h-full">
        <div className="flex justify-between items-center">
          <p className="font-mono text-[10px] tracking-[0.3em] text-amber uppercase">Pustaka</p>
          <button onClick={onClose} className="text-muted text-[13px]" aria-label="Tutup pustaka">
            Tutup
          </button>
        </div>

        {/* Cari */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari judul, artis, album…"
          className="w-full mt-4 bg-surface border border-white/5 rounded-lg py-2.5 px-3 text-[14px] text-paper placeholder:text-muted focus:outline-none focus:border-amber/40"
        />

        {/* Tab */}
        <div className="flex gap-2 mt-3">
          {(['lagu', 'album', 'artis'] as Tab[]).map((tt) => (
            <button
              key={tt}
              onClick={() => setTab(tt)}
              className={
                'flex-1 py-2 rounded-full font-mono text-[11px] tracking-[0.12em] uppercase transition-colors ' +
                (tab === tt ? 'bg-amber text-ink' : 'bg-surfaceRaised text-muted border border-white/5')
              }
            >
              {tt}
            </button>
          ))}
        </div>

        {/* Sort (hanya untuk tab Lagu) */}
        {tab === 'lagu' && (
          <button
            onClick={() => setSort(SORT_CYCLE[(SORT_CYCLE.indexOf(sort) + 1) % SORT_CYCLE.length])}
            className="mt-3 font-mono text-[11px] text-muted"
          >
            Urut: <span className="text-amber">{SORT_LABEL[sort]}</span> ↻
          </button>
        )}

        {/* Status */}
        {loading && <p className="text-muted text-sm mt-8">Memindai pustaka…</p>}
        {!loading && !granted && (
          <div className="mt-10 text-center">
            <p className="font-display text-xl text-paper mb-2">Butuh izin akses musik</p>
            <p className="text-muted text-sm max-w-xs mx-auto">
              Scrola perlu izin membaca file musik di perangkatmu untuk menampilkan pustaka. Coba buka
              lagi dan izinkan saat diminta.
            </p>
          </div>
        )}
        {!loading && granted && tracks.length === 0 && (
          <div className="mt-10 text-center">
            <p className="font-display text-xl text-paper mb-2">Tak ada musik lokal</p>
            <p className="text-muted text-sm">Belum ada file musik yang ditemukan di perangkat.</p>
          </div>
        )}

        {/* Daftar */}
        {!loading && granted && tracks.length > 0 && (
          <div className="mt-4">
            {tab === 'lagu' && (
              <>
                <p className="font-mono text-[10px] text-muted mb-2">{sortedTracks.length} lagu</p>
                <div className="space-y-1.5">
                  {sortedTracks.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => playFrom(sortedTracks, i)}
                      className="flex items-center justify-between w-full bg-surface rounded-lg py-2.5 px-3 text-left active:scale-[0.99] transition-transform"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] text-paper truncate">{t.title}</p>
                        <p className="text-[12px] text-muted truncate">
                          {t.artist} · {t.album}
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-muted shrink-0 ml-3">
                        {fmtDur(t.durationSec)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {tab === 'album' && (
              <div className="space-y-1.5">
                {albums.map((al) => (
                  <button
                    key={al.id}
                    onClick={() => playFrom(al.tracks, 0)}
                    className="flex items-center justify-between w-full bg-surface rounded-lg py-2.5 px-3 text-left active:scale-[0.99] transition-transform"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] text-paper truncate">{al.album}</p>
                      <p className="text-[12px] text-muted truncate">
                        {al.artist} · {al.tracks.length} lagu
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-muted shrink-0 ml-3">
                      {formatDurationHuman(al.durationSec)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {tab === 'artis' && (
              <div className="space-y-1.5">
                {artists.map((ar) => (
                  <button
                    key={ar.name}
                    onClick={() => playFrom(ar.tracks, 0)}
                    className="flex items-center justify-between w-full bg-surface rounded-lg py-2.5 px-3 text-left active:scale-[0.99] transition-transform"
                  >
                    <p className="text-[14px] text-paper truncate">{ar.name}</p>
                    <span className="font-mono text-[11px] text-muted shrink-0 ml-3">
                      {ar.albumCount} album · {ar.trackCount} lagu
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
