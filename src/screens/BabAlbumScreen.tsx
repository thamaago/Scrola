import { useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { getHistoryInRange, getDistinctArtistsBefore } from '../lib/db/queries';
import { formatDurationHuman } from '../lib/sisiBLogic';
import {
  computeBabStats,
  computeAlbumStats,
  peakBucket,
  startOfMonth,
  startOfYear,
  type NarrativePeriodStats,
} from '../lib/babAlbumLogic';

/**
 * BabAlbumScreen — rekap naratif jangka panjang: "Bab" (bulan) & "Album" (tahun).
 *
 * Redesain untuk orang awam: alih-alih dashboard angka, layar dibuka dengan satu KALIMAT yang
 * langsung menceritakan periode ("Bulan Juli, kamu memutar 210 lagu"), memakai bahasa polos
 * (bukan "irama/penemuan/teratas"), dan grafik dijelaskan gamblang dengan bulan teramai DINAMAI.
 *
 * Mengomposisi query yang sudah ada dengan fungsi murni babAlbumLogic (pola sama SisiBScreen);
 * semua agregasi teruji di babAlbumLogic.test.ts. Tata letak & animasi tetap perlu konfirmasi device.
 */

type Period = 'bulan' | 'tahun';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Count-up sederhana untuk angka hero. Menghormati prefers-reduced-motion. */
function useCountUp(target: number, active: boolean): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    if (prefersReducedMotion() || target <= 0) {
      setValue(target);
      return;
    }
    const duration = 700;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(eased * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, active]);
  return value;
}

export default function BabAlbumScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('bulan');
  const [stats, setStats] = useState<NarrativePeriodStats | null>(null);
  const [monthName, setMonthName] = useState('');
  const [yearLabel, setYearLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (!open) return;
    const listener = CapApp.addListener('backButton', () => onClose());
    return () => {
      void listener.then((h) => h.remove());
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setReveal(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    setReveal(false);

    (async () => {
      try {
        const now = new Date();
        let startSec: number;
        let endSec: number;

        if (period === 'bulan') {
          const start = startOfMonth(now);
          const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
          startSec = Math.floor(start.getTime() / 1000);
          endSec = Math.floor(end.getTime() / 1000);
          setMonthName(MONTH_LONG[start.getMonth()]);
          setYearLabel(String(start.getFullYear()));
        } else {
          const start = startOfYear(now);
          const end = new Date(start.getFullYear() + 1, 0, 1);
          startSec = Math.floor(start.getTime() / 1000);
          endSec = Math.floor(end.getTime() / 1000);
          setYearLabel(String(start.getFullYear()));
        }

        const [rows, artistsBefore] = await Promise.all([
          getHistoryInRange(startSec, endSec),
          getDistinctArtistsBefore(startSec),
        ]);
        if (cancelled) return;

        const result =
          period === 'bulan'
            ? computeBabStats(rows, artistsBefore)
            : computeAlbumStats(rows, artistsBefore);
        setStats(result);
        setTimeout(() => {
          if (!cancelled) setReveal(true);
        }, 60);
      } catch (e) {
        if (!cancelled) {
          console.warn('Gagal menghitung rekap Bab/Album:', e);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [period, open]);

  const total = stats?.totalTracks ?? 0;
  const countedTotal = useCountUp(total, reveal && !!stats);

  if (!open) return null;

  const eyebrow = period === 'bulan' ? 'Bab' : 'Album';
  const periodTitle = period === 'bulan' ? `${monthName} ${yearLabel}` : yearLabel;
  const periodNoun = period === 'bulan' ? 'bulan' : 'tahun';

  const buckets = stats?.buckets ?? [];
  const peak = peakBucket(buckets);
  const maxBucket = Math.max(1, ...buckets);
  const bucketInitials =
    period === 'bulan' ? ['P1', 'P2', 'P3', 'P4', 'P5'] : MONTH_SHORT.map((m) => m[0]);
  const peakName =
    peak.index < 0
      ? ''
      : period === 'bulan'
        ? `Pekan ke-${peak.index + 1}`
        : MONTH_LONG[peak.index];

  // Entrance bertahap: tiap blok muncul sedikit lebih lambat. Dinonaktifkan saat reduce-motion.
  const step = prefersReducedMotion() ? 0 : 1;
  const revealStyle = (order: number) => ({
    opacity: reveal ? 1 : 0,
    transform: reveal ? 'translateY(0)' : 'translateY(10px)',
    transition: `opacity 0.5s ease ${order * 0.08 * step}s, transform 0.5s ease ${order * 0.08 * step}s`,
  });

  return (
    <div className="fixed inset-0 bg-ink z-40 overflow-y-auto">
      <div className="relative px-7 pt-10 pb-16 min-h-full">
        <div className="flex justify-between items-center">
          <p className="font-mono text-[10px] tracking-[0.3em] text-amber uppercase">{eyebrow}</p>
          <button onClick={onClose} className="text-muted text-[13px]" aria-label="Tutup rekap">
            Tutup
          </button>
        </div>

        <h1 className="font-display text-[26px] leading-tight font-semibold text-paper mt-2">
          {periodTitle || '—'}
        </h1>

        {/* Toggle Bulan / Tahun */}
        <div className="flex gap-2 mt-4">
          {(['bulan', 'tahun'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={
                'flex-1 py-2 rounded-full font-mono text-[11px] tracking-[0.15em] uppercase transition-colors ' +
                (period === p
                  ? 'bg-amber text-ink'
                  : 'bg-surfaceRaised text-muted border border-white/5')
              }
            >
              {p === 'bulan' ? 'Bulan' : 'Tahun'}
            </button>
          ))}
        </div>

        {loading && <p className="text-muted text-sm mt-10">Menyusun ceritamu…</p>}
        {error && (
          <p className="text-coral text-sm mt-10">Rekap tidak terbaca. Coba tutup lalu buka lagi.</p>
        )}

        {!loading && !error && stats && total === 0 && (
          <div className="py-20 text-center">
            <p className="font-display text-2xl text-paper mb-2">Halaman ini masih kosong</p>
            <p className="text-muted text-sm max-w-xs mx-auto">
              Putar lagu, dan {periodNoun} ini akan menulis ceritanya sendiri.
            </p>
          </div>
        )}

        {!loading && !error && stats && total > 0 && (
          <div className="mt-8 space-y-6">
            {/* HERO NARATIF — kalimat pembuka, angka besar teranyam (bukan angka telanjang) */}
            <div style={revealStyle(0)}>
              <p className="font-display text-[22px] leading-snug text-paper">
                {period === 'bulan' ? `Bulan ${monthName}, kamu memutar` : `Sepanjang ${yearLabel}, kamu memutar`}{' '}
                <span className="text-amber font-semibold">{countedTotal.toLocaleString('id-ID')} lagu</span>.
              </p>
              <p className="text-muted text-sm mt-2 leading-relaxed">
                Dari {stats.totalArtists.toLocaleString('id-ID')} artis
                {stats.newArtistCount > 0 && (
                  <>
                    {' '}— <span className="text-paper">{stats.newArtistCount}</span> di antaranya baru
                    pertama kamu dengar
                  </>
                )}
                {stats.totalDurationSec > 0 && `. Total ${formatDurationHuman(stats.totalDurationSec)} mendengar`}.
              </p>
            </div>

            {/* Lagu yang paling sering diputar */}
            {stats.topTrack && (
              <div
                style={revealStyle(1)}
                className="flex rounded-r-[10px] overflow-hidden border border-amber/30 bg-surfaceRaised"
              >
                <div className="ticket-perforation shrink-0" aria-hidden="true" />
                <div className="flex-1 py-3.5 px-4 min-w-0">
                  <p className="font-mono text-[10px] tracking-[0.15em] text-amber uppercase">
                    Lagu yang paling sering diputar
                  </p>
                  <h3 className="font-display text-[19px] font-semibold text-paper mt-1 truncate">
                    {stats.topTrack.track}
                  </h3>
                  <p className="text-[13px] text-muted truncate">
                    {stats.topTrack.artist} · {stats.topTrack.playCount}× diputar
                  </p>
                </div>
              </div>
            )}

            {/* Artis paling sering */}
            {stats.topArtist && (
              <div
                style={revealStyle(2)}
                className="bg-surface border border-white/5 rounded-[10px] py-3.5 px-4"
              >
                <p className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase">
                  Artis yang paling sering kamu putar
                </p>
                <div className="flex items-baseline justify-between gap-3 mt-1">
                  <h3 className="font-display text-[19px] font-semibold text-paper truncate">
                    {stats.topArtist}
                  </h3>
                  <span className="font-mono text-xs text-amber whitespace-nowrap">
                    {stats.topArtistPlayCount}× diputar
                  </span>
                </div>
              </div>
            )}

            {/* Kapan kamu mendengar — grafik dijelaskan gamblang, puncak dinamai */}
            <div style={revealStyle(3)} className="bg-surface border border-white/5 rounded-[10px] py-4 px-4">
              <p className="font-display text-base font-semibold text-paper">Kapan kamu mendengar</p>
              {peakName && (
                <p className="text-[13px] text-muted mt-0.5">
                  Paling ramai di <span className="text-amber">{peakName}</span> — {peak.count.toLocaleString('id-ID')} lagu.
                </p>
              )}
              <div className="flex items-end gap-1.5 h-20 mt-4">
                {buckets.map((count, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                    <div className="w-full flex items-end h-16">
                      <div
                        className="w-full rounded-t-[3px]"
                        style={{
                          background: i === peak.index ? '#D6A756' : 'rgba(214,167,86,0.28)',
                          height: reveal ? `${Math.max((count / maxBucket) * 100, 4)}%` : '4%',
                          transition: `height 0.6s cubic-bezier(0.22,1,0.36,1) ${(0.3 + i * 0.04) * step}s`,
                        }}
                        aria-label={`${bucketInitials[i]}: ${count} lagu`}
                      />
                    </div>
                    <span
                      className={
                        'font-mono text-[9px] ' + (i === peak.index ? 'text-amber' : 'text-muted')
                      }
                    >
                      {bucketInitials[i]}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted mt-3">
                Tiap batang satu {period === 'bulan' ? 'pekan' : 'bulan'} · makin tinggi, makin banyak lagu.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
