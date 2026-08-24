import { useEffect, useState, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { getHistoryInRange, getDistinctArtistsBefore } from '../lib/db/queries';
import {
  computeSisiBStats,
  startOfIsoWeek,
  formatDurationHuman,
  type SisiBStats,
} from '../lib/sisiBLogic';
import { renderSisiBZine } from '../lib/sisiBZineImage';
import { SharePlugin } from '../lib/share';
import { useI18n } from '../lib/i18nContext';
import { formatDate } from '../lib/i18nFormat';

/**
 * SisiBScreen — rekap mingguan sebagai cerita, bukan dashboard angka.
 *
 * SEMUA data dihitung dari SQLite LOKAL (tidak ada request ke server mana pun), konsisten dengan
 * prinsip tanpa-telemetri Scrola: rekap ini bekerja offline dan tidak membocorkan kebiasaan
 * dengarmu ke siapa pun. Agregasinya memakai fungsi murni di sisiBLogic.ts yang bisa diunit-test.
 */
export default function SisiBScreen({
  open,
  onClose,
  onOpenBabAlbum,
  onOpenPenemuan,
}: {
  open: boolean;
  onClose: () => void;
  onOpenBabAlbum?: () => void;
  onOpenPenemuan?: () => void;
}) {
  const { t, tp, locale, weekday } = useI18n();
  const [stats, setStats] = useState<SisiBStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // Bar chart dianimasikan naik dari 0 — dinyalakan sesaat SETELAH overlay terbuka & data siap,
  // supaya transisi CSS-nya benar-benar terlihat (kalau langsung di nilai akhir, tidak ada animasi).
  const [barsIn, setBarsIn] = useState(false);
  const [weekLabel, setWeekLabel] = useState('');
  const [weekStartSec, setWeekStartSec] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const sharingRef = useRef(false);

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
        setWeekStartSec(weekStartSec);

        const weekEnd = new Date((weekStartSec + 6 * 86400) * 1000);
        const fmt = (d: Date) => formatDate(locale, d, { day: 'numeric', month: 'short' });
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
  }, [open, locale]);

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

  async function handleShare() {
    if (sharingRef.current || !stats || weekStartSec === null) return;
    sharingRef.current = true;
    setSharing(true);
    setShareError(null);
    try {
      const base64 = await renderSisiBZine(stats, weekStartSec);
      await SharePlugin.shareImage({
        base64,
        filename: 'scrola-sisib.png',
        title: t('sisib.share.title'),
      });
    } catch (e) {
      console.warn('Gagal membagikan Sisi B:', e);
      setShareError('common.shareImageError');
      setTimeout(() => setShareError(null), 3000);
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  }
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
          <p className="font-mono text-[10px] tracking-[0.3em] text-coral uppercase">{t('sisib.eyebrow')}</p>
          <button onClick={onClose} className="text-muted text-[13px]">
            {t('common.close')} ✕
          </button>
        </div>

        {loading && <p className="text-muted text-sm mt-8">{t('sisib.loading')}</p>}

        {error && (
          <p className="text-coral text-sm mt-8">
            {t('sisib.error')}
          </p>
        )}

        {!loading && !error && !hasData && (
          <div className="flex-1 flex flex-col justify-center text-center">
            <h1 className="font-display text-[28px] leading-tight font-semibold text-paper">
              {t('sisib.empty.title')}
            </h1>
            <p className="text-muted text-sm mt-3 leading-relaxed">
              {t('sisib.empty.body')}
            </p>
          </div>
        )}

        {!loading && !error && hasData && stats && (
          <>
            <h1 className="font-display text-[32px] leading-[1.15] font-semibold text-paper mt-3.5">
              {t('sisib.hero', { artist: stats.topArtist ?? '' })}
            </h1>
            <p className="text-muted text-[13px] mt-3.5 mb-7 leading-relaxed">
              {weekLabel} · {tp('count.tracks', stats.totalTracks)} · {tp('count.artists', stats.totalArtists)}
              {stats.totalDurationSec > 0 && ` · ${formatDurationHuman(stats.totalDurationSec, locale)}`}
            </p>

            <div className="flex flex-col gap-3">
              {/* Tiket Emas — lagu paling sering diputar minggu ini */}
              {stats.topTrack && (
                <div className="flex rounded-r-[10px] overflow-hidden border border-amber/30 bg-surfaceRaised">
                  <div className="ticket-perforation shrink-0" aria-hidden="true" />
                  <div className="flex-1 py-3.5 px-4 min-w-0">
                    <p className="font-mono text-[10px] tracking-[0.15em] text-amber uppercase">
                      {t('sisib.goldTicket')}
                    </p>
                    <h3 className="font-display text-[19px] font-semibold text-paper mt-1 truncate">
                      {stats.topTrack.track}
                    </h3>
                    <p className="text-[13px] text-muted truncate">
                      {stats.topTrack.artist} · {t('stats.plays', { count: stats.topTrack.playCount })}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1 bg-surface border border-white/5 rounded-[10px] py-3.5 px-4">
                  <p className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase">
                    {t('sisib.goldHour')}
                  </p>
                  <p className="font-display text-xl font-semibold text-paper mt-1">
                    {stats.peakHour !== null
                      ? `${stats.peakHour.toString().padStart(2, '0')}.00`
                      : '—'}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{t('sisib.goldHour.sub')}</p>
                </div>
                {onOpenPenemuan ? (
                  <button
                    onClick={onOpenPenemuan}
                    className="flex-1 bg-surface border border-white/5 rounded-[10px] py-3.5 px-4 text-left active:scale-[0.99] transition-transform"
                  >
                    <p className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase">
                      {t('penemuan.eyebrow')}
                    </p>
                    <p className="font-display text-xl font-semibold text-paper mt-1">
                      {tp('count.artists', stats.newArtistCount)}
                    </p>
                    <p className="text-xs text-amber mt-0.5">{t('sisib.penemuan.newSeeAll')}</p>
                  </button>
                ) : (
                  <div className="flex-1 bg-surface border border-white/5 rounded-[10px] py-3.5 px-4">
                    <p className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase">
                      {t('penemuan.eyebrow')}
                    </p>
                    <p className="font-display text-xl font-semibold text-paper mt-1">
                      {tp('count.artists', stats.newArtistCount)}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{t('sisib.penemuan.newLogged')}</p>
                  </div>
                )}
              </div>

              {/* Irama minggu — 7 bar, hari tersibuk disorot */}
              <div className="bg-surface border border-white/5 rounded-[10px] py-3.5 px-4">
                <p className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase mb-2.5">
                  {t('sisib.rhythm')}
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
                      aria-label={t('sisib.aria.dayCount', { day: weekday(i, 'short'), count })}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <span
                      key={i}
                      className={`flex-1 text-center font-mono text-[9px] ${
                        i === busiestDay ? 'text-amber' : 'text-muted'
                      }`}
                    >
                      {weekday(i, 'short')}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-8" />

            {onOpenBabAlbum && (
              <button
                onClick={onOpenBabAlbum}
                className="flex items-center justify-between w-full bg-surfaceRaised border border-white/5 rounded-lg py-3 px-4 mb-3 active:scale-[0.99] transition-transform"
              >
                <span className="text-sm text-paper">{t('sisib.seeBabAlbum')}</span>
                <span className="font-mono text-[10px] tracking-[0.15em] text-amber uppercase">
                  {t('sisib.babAlbumTag')}
                </span>
              </button>
            )}

            {/* Ekspor recap sebagai zine gambar (Canvas -> PNG -> share native). */}
            <button
              onClick={handleShare}
              disabled={sharing || !stats || weekStartSec === null}
              className="border border-amber/40 text-amber font-body font-semibold text-sm rounded-lg py-3.5 px-6 active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sharing ? t('ticket.preparing') : t('sisib.shareZine')}
            </button>
            {shareError && (
              <p className="text-center text-xs text-red-300 mt-2" role="alert">
                {t(shareError)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
