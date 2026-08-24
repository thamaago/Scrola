import { useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { getTicketCollection } from '../lib/db/queries';
import type { CollectibleTicket, TicketProgress } from '../lib/ticketSerialLogic';
import { renderTicketShareImage, drawTicketEmblem } from '../lib/ticketShareImage';
import { emblemSeed } from '../lib/ticketShareLayout';
import { SharePlugin } from '../lib/share';
import { useI18n } from '../lib/i18nContext';
import { formatDate } from '../lib/i18nFormat';
import type { Locale } from '../lib/i18n';

/** Emblem generatif mini per tiket — ikon musik unik per lagu+jenis, membuat tiap tiket mencolok beda. */
function TicketEmblem({ ticket, size = 78 }: { ticket: CollectibleTicket; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawTicketEmblem(ctx, size / 2, size / 2, size / 2 - 3, emblemSeed(ticket), ticket.kind);
  }, [ticket, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} className="shrink-0" aria-hidden="true" />;
}

/**
 * TiketKoleksiScreen — dinding koleksi "tiket bernomor seri".
 *
 * Semua data diturunkan dari SQLite LOKAL lewat getTicketCollection() (fungsi murni
 * ticketSerialLogic.ts), konsisten dengan prinsip tanpa-telemetri Scrola. Elemen signature layar
 * ini adalah CAP NOMOR SERI kuningan pada tiap sobekan tiket — memperkuat identitas cetak/tiket.
 *
 * Catatan: ini layer render. Logika (serial, milestone, progres) sudah teruji penuh di
 * ticketSerialLogic.test.ts; tata letak & animasi tetap perlu dikonfirmasi di perangkat.
 */

// Label jenis tiket kini lewat i18n: t(`ticket.${kind}`) — lihat locales/.

function formatEarned(sec: number, locale: Locale): string {
  const d = new Date(sec * 1000);
  if (isNaN(d.getTime())) return '—';
  const date = formatDate(locale, d, { day: 'numeric', month: 'short', year: 'numeric' });
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${date} · ${hh}.${mm}`;
}

function ProgressRow({ label, ordinalText, remainingText }: {
  label: string;
  ordinalText: string;
  remainingText: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-paper">
        {label}
        <span className="text-muted"> · {ordinalText}</span>
      </span>
      <span className="font-mono text-[11px] text-amber whitespace-nowrap">
        {remainingText}
      </span>
    </div>
  );
}

function TicketStub({ ticket }: { ticket: CollectibleTicket }) {
  const { t, locale } = useI18n();
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const base64 = await renderTicketShareImage(ticket);
      await SharePlugin.shareImage({
        base64,
        filename: `scrola-tiket-${ticket.serial}.png`,
        title: t('tiket.serialShareLabel', { serial: ticket.serial }),
      });
    } catch (e) {
      console.warn('Gagal membagikan tiket:', e);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="flex rounded-r-lg overflow-hidden border border-amber/20 bg-surface">
      <div className="ticket-perforation shrink-0" aria-hidden="true" />
      <div className="flex items-center pl-3 pr-1 shrink-0">
        <TicketEmblem ticket={ticket} />
      </div>
      <div className="flex-1 py-4 pr-4 pl-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-amber uppercase">
            {t(`ticket.${ticket.kind}`)}
          </span>
          <span className="font-mono text-[10px] text-muted">{formatEarned(ticket.earnedAtSec, locale)}</span>
        </div>

        <h3 className="font-display text-lg leading-snug font-semibold text-paper mt-1.5">
          {ticket.label}
        </h3>
        {ticket.subject && (
          <p className="text-sm text-muted truncate mt-0.5">{ticket.subject}</p>
        )}
        {ticket.earnedTrack && (
          <p className="text-[13px] text-muted/70 italic truncate mt-0.5">
            {ticket.subject
              ? t('tiket.via', { track: ticket.earnedTrack.track })
              : `${ticket.earnedTrack.artist} — ${ticket.earnedTrack.track}`}
          </p>
        )}

        {/* Cap nomor seri (signature) + bagikan tiket sebagai gambar (stub 9:16). */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="inline-block font-mono text-[11px] tracking-[0.18em] text-amber uppercase border border-amber/40 rounded px-2 py-1 -rotate-[1.5deg]">
            № {ticket.serial}
          </span>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="font-mono text-[11px] text-amber border border-amber/40 rounded-full px-3 py-1.5 disabled:opacity-40 active:scale-[0.98] transition-transform shrink-0"
            aria-label={t('tiket.serialShareLabel', { serial: ticket.serial })}
          >
            {sharing ? t('ticket.preparing') : `↗ ${t('ticket.share')}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TiketKoleksiScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, tp } = useI18n();
  const [tickets, setTickets] = useState<CollectibleTicket[]>([]);
  const [progress, setProgress] = useState<TicketProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

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
    setError(false);
    (async () => {
      try {
        const { tickets, progress } = await getTicketCollection();
        if (cancelled) return;
        setTickets(tickets);
        setProgress(progress);
      } catch (e) {
        if (!cancelled) setError(true);
        console.warn('Gagal memuat koleksi tiket:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const hasProgress = progress && (progress.nextJejak || progress.nextPenemuan);

  return (
    <div className="fixed inset-0 bg-ink z-40 overflow-y-auto">
      <div className="relative px-7 pt-10 pb-16 min-h-full flex flex-col">
        <div className="flex justify-between items-center">
          <p className="font-mono text-[10px] tracking-[0.3em] text-amber uppercase">{t('tiket.eyebrow')}</p>
          <button onClick={onClose} className="text-muted text-[13px]" aria-label={t('tiket.aria.close')}>
            {t('common.close')}
          </button>
        </div>

        <h1 className="font-display text-[28px] leading-tight font-semibold text-paper mt-2">
          {t('tiket.title')}
        </h1>
        <p className="text-muted text-sm mt-1.5 leading-relaxed">
          {t('tiket.subtitle')}
        </p>

        {loading && <p className="text-muted text-sm mt-8">{t('tiket.loading')}</p>}

        {error && (
          <p className="text-coral text-sm mt-8">
            {t('tiket.error')}
          </p>
        )}

        {!loading && !error && (
          <>
            {hasProgress && (
              <div className="mt-7 bg-surfaceRaised rounded-xl border border-white/5 px-4 py-3">
                <p className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-1">
                  {t('tiket.nextTitle')}
                </p>
                {progress?.nextJejak && (
                  <ProgressRow
                    label={t('tiket.next.scrobble')}
                    ordinalText={t('tiket.next.ordinal', { ordinal: progress.nextJejak.ordinal })}
                    remainingText={t('tiket.next.remaining.scrobble', { remaining: progress.nextJejak.remaining })}
                  />
                )}
                {progress?.nextPenemuan && (
                  <ProgressRow
                    label={t('tiket.next.penemuan')}
                    ordinalText={t('tiket.next.ordinal', { ordinal: progress.nextPenemuan.ordinal })}
                    remainingText={t('tiket.next.remaining.artist', { remaining: progress.nextPenemuan.remaining })}
                  />
                )}
              </div>
            )}

            {tickets.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
                <p className="font-display text-2xl text-paper mb-2">{t('tiket.empty.title')}</p>
                <p className="text-muted text-sm max-w-xs">
                  {t('tiket.empty.body')}
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-2.5">
                <p className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-1">
                  {tp('ticket.collected', tickets.length)}
                </p>
                {tickets.map((t) => (
                  <TicketStub key={t.serial} ticket={t} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
