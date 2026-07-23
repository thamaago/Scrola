import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { getHistoryInRange, getDistinctArtistsBefore } from '../lib/db/queries';
import {
  computeSisiBStats,
  startOfIsoWeek,
  formatDurationHuman,
  type SisiBStats,
} from '../lib/sisiBLogic';

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/**
 * SisiBScreen — rekap mingguan sebagai cerita, bukan dashboard angka.
 *
 * SEMUA data dihitung dari SQLite LOKAL (tidak ada request ke server mana pun), konsisten dengan
 * prinsip tanpa-telemetri Scrola: rekap ini bekerja offline dan tidak membocorkan kebiasaan
 * dengarmu ke siapa pun. Agregasinya memakai fungsi murni di sisiBLogic.ts yang bisa diunit-test.
 */
export default function SisiBScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stats, setStats] = useState<SisiBStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // Bar chart dianimasikan naik dari 0 — dinyalakan sesaat SETELAH overlay terbuka & data siap,
  // supaya transisi CSS-nya benar-benar terlihat (kalau langsung di nilai akhir, tidak ada animasi).
  const [barsIn, setBarsIn] = useState(false);
  const [weekLabel, setWeekLabel] = useState('');

  useEffect(() => {
    if (!open) {
      setBarsIn(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const weekStart = startOfIsoWeek();
        const weekStartSec = Math.floor(weekStart.getTime() / 1000);
        const weekEndSec = weekStartSec + 7 * 86400;

        const [rows, artistsBefore] = await Promise.all([
          getHistoryInRange(weekStartSec, weekEndSec),
          getDistinctArtistsBefore(weekStartSec),
        ]);
        if (cancelled) return;

        const result = computeSisiBStats(rows, artistsBefore, weekStartSec);
        setStats(result);

        const weekEnd = new Date((weekStartSec + 6 * 86400) * 1000);
        const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        setWeekLabel(`${fmt(weekStart)} – ${fmt(weekEnd)}`);

        // Beri sedikit jeda agar transisi tinggi bar benar-benar teranimasi dari 0.
        setTimeout(() => {
          if (!cancelled) setBarsIn(true);
        }, 60);
      } catch (e) {
        if (!cancelled) {
          console.warn('Gagal menghitung rekap Sisi B:', e);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Tombol back Android menutup overlay, bukan keluar dari app.
  useEffect(() => {
    if (!open) return;
    const listener = CapApp.addListener('backButton', () => onClose());
    return () => {
      listener.then((h) => h.remove());
    };
  }, [open, onClose]);

  const maxDayCount = stats ? Math.max(...stats.dayCounts, 1) : 1;
  const busiestDay = stats ? stats.dayCounts.indexOf(Math.max(...stats.dayCounts)) : -1;
  const hasData = stats != null && stats.totalTracks > 0;

  return (
    <div
      className="fixed inset-0 bg-ink z-40 overflow-y-auto"
      style={{
        transform: open ? 'translateY(0)' : 'translateY(102%)',
        transition: 'transform 0.5s cubic-bezier(0.22,1,0.36,1)',
      }}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 120% 45% at 50% 0%, rgba(255,122,107,0.12), transparent 60%)',
        }}
      />

      <div className="relative px-7 pt-10 pb-12 min-h-full flex flex-col">
        <div className="flex justify-between items-center">
          <p className="font-mono text-[10px] tracking-[0.3em] text-coral uppercase">Sisi B</p>
          <button onClick={onClose} className="text-muted text-[13px]">
            Tutup ✕
          </button>
        </div>

        {loading && <p className="text-muted text-sm mt-8">Menyusun ceritamu…</p>}

        {error && (
          <p className="text-coral text-sm mt-8">
            Gagal menyusun rekap. Coba tutup dan buka lagi.
          </p>
        )}

        {!loading && !error && !hasData && (
          <div className="flex-1 flex flex-col justify-center text-center">
            <h1 className="font-display text-[28px] leading-tight font-semibold text-paper">
              Minggu ini masih sunyi.
            </h1>
            <p className="text-muted text-sm mt-3 leading-relaxed">
              Belum ada lagu yang tercatat minggu ini. Putar sesuatu — ceritanya akan mulai
              menulis dirinya sendiri.
            </p>
          </div>
        )}

        {!loading && !error && hasData && stats && (
          <>
            <h1 className="font-display text-[32px] leading-[1.15] font-semibold text-paper mt-3.5">
              Minggu ini,
              <br />
              ceritamu berbunyi
              <br />
              seperti {stats.topArtist}.
            </h1>
            <p className="text-muted text-[13px] mt-3.5 mb-7 leading-relaxed">
              {weekLabel} · {stats.totalTracks} lagu · {stats.totalArtists} artis
              {stats.totalDurationSec > 0 && ` · ${formatDurationHuman(stats.totalDurationSec)}`}
            </p>

            <div className="flex flex-col gap-3">
              {/* Tiket Emas — lagu paling sering diputar minggu ini */}
              {stats.topTrack && (
                <div className="flex rounded-r-[10px] overflow-hidden border border-amber/30 bg-surfaceRaised">
                  <div className="ticket-perforation shrink-0" aria-hidden="true" />
                  <div className="flex-1 py-3.5 px-4 min-w-0">
                    <p className="font-mono text-[10px] tracking-[0.15em] text-amber uppercase">
                      Tiket Emas — lagu minggu ini
                    </p>
                    <h3 className="font-display text-[19px] font-semibold text-paper mt-1 truncate">
                      {stats.topTrack.track}
                    </h3>
                    <p className="text-[13px] text-muted truncate">
                      {stats.topTrack.artist} · diputar {stats.topTrack.playCount}×
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1 bg-surface border border-white/5 rounded-[10px] py-3.5 px-4">
                  <p className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase">
                    Jam emas
                  </p>
                  <p className="font-display text-xl font-semibold text-paper mt-1">
                    {stats.peakHour !== null
                      ? `${stats.peakHour.toString().padStart(2, '0')}.00`
                      : '—'}
                  </p>
                  <p className="text-xs text-muted mt-0.5">paling sering mendengar</p>
                </div>
                <div className="flex-1 bg-surface border border-white/5 rounded-[10px] py-3.5 px-4">
                  <p className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase">
                    Penemuan
                  </p>
                  <p className="font-display text-xl font-semibold text-paper mt-1">
                    {stats.newArtistCount} artis
                  </p>
                  <p className="text-xs text-muted mt-0.5">baru pertama tercatat</p>
                </div>
              </div>

              {/* Irama minggu — 7 bar, hari tersibuk disorot */}
              <div className="bg-surface border border-white/5 rounded-[10px] py-3.5 px-4">
                <p className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase mb-2.5">
                  Irama minggu
                </p>
                <div className="flex items-end gap-1.5 h-14">
                  {stats.dayCounts.map((count, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-[3px]"
                      style={{
                        background:
                          i === busiestDay ? '#D6A756' : 'rgba(214,167,86,0.35)',
                        height: barsIn ? `${Math.max((count / maxDayCount) * 100, 4)}%` : '4%',
                        transition: `height 0.6s cubic-bezier(0.22,1,0.36,1) ${0.15 + i * 0.05}s`,
                      }}
                      aria-label={`${HARI[i]}: ${count} lagu`}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {HARI.map((h, i) => (
                    <span
                      key={h}
                      className={`flex-1 text-center font-mono text-[9px] ${
                        i === busiestDay ? 'text-amber' : 'text-muted'
                      }`}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-8" />

            {/* Fitur share ditandai jujur sebagai belum tersedia — lebih baik daripada tombol
                yang tidak melakukan apa-apa saat ditekan. Ada di backlog DEVLOG. */}
            <button
              disabled
              className="border border-amber/40 text-amber font-body font-semibold text-sm rounded-lg py-3.5 px-6 opacity-40 cursor-not-allowed"
              title="Belum tersedia"
            >
              Bagikan sebagai tiket (segera)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
