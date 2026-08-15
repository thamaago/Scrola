import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { getTicketCollection } from '../lib/db/queries';
import type { CollectibleTicket, TicketProgress, TicketKind } from '../lib/ticketSerialLogic';
import { renderTicketShareImage } from '../lib/ticketShareImage';
import { SharePlugin } from '../lib/share';

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

const KIND_LABEL: Record<TicketKind, string> = {
  jejak: 'Jejak',
  penemuan: 'Penemuan',
  setia: 'Setia',
  beruntun: 'Beruntun',
  trofi: 'Trofi',
};

function formatEarned(sec: number): string {
  const d = new Date(sec * 1000);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ProgressRow({ label, ordinal, remaining, unit }: {
  label: string;
  ordinal: number;
  remaining: number;
  unit: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-paper">
        {label}
        <span className="text-muted"> · tiket ke-{ordinal}</span>
      </span>
      <span className="font-mono text-[11px] text-amber whitespace-nowrap">
        {remaining} {unit} lagi
      </span>
    </div>
  );
}

function TicketStub({ ticket }: { ticket: CollectibleTicket }) {
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const base64 = await renderTicketShareImage(ticket);
      await SharePlugin.shareImage({
        base64,
        filename: `scrola-tiket-${ticket.serial}.png`,
        title: `Tiket ${ticket.serial}`,
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
      <div className="flex-1 py-4 pr-4 pl-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-amber uppercase">
            {KIND_LABEL[ticket.kind]}
          </span>
          <span className="font-mono text-[10px] text-muted">{formatEarned(ticket.earnedAtSec)}</span>
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
              ? `lewat “${ticket.earnedTrack.track}”`
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
            aria-label={`Bagikan tiket ${ticket.serial}`}
          >
            {sharing ? 'Menyiapkan…' : '↗ Bagikan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TiketKoleksiScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <p className="font-mono text-[10px] tracking-[0.3em] text-amber uppercase">Koleksi</p>
          <button onClick={onClose} className="text-muted text-[13px]" aria-label="Tutup koleksi">
            Tutup
          </button>
        </div>

        <h1 className="font-display text-[28px] leading-tight font-semibold text-paper mt-2">
          Tiket
        </h1>
        <p className="text-muted text-sm mt-1.5 leading-relaxed">
          Setiap pencapaian mencetak satu tiket bernomor seri. Kumpulkan seiring ceritamu tumbuh.
        </p>

        {loading && <p className="text-muted text-sm mt-8">Memuat koleksi…</p>}

        {error && (
          <p className="text-coral text-sm mt-8">
            Koleksi tidak terbaca. Coba tutup lalu buka lagi.
          </p>
        )}

        {!loading && !error && (
          <>
            {hasProgress && (
              <div className="mt-7 bg-surfaceRaised rounded-xl border border-white/5 px-4 py-3">
                <p className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-1">
                  Menuju berikutnya
                </p>
                {progress?.nextJejak && (
                  <ProgressRow
                    label="Scrobble"
                    ordinal={progress.nextJejak.ordinal}
                    remaining={progress.nextJejak.remaining}
                    unit="scrobble"
                  />
                )}
                {progress?.nextPenemuan && (
                  <ProgressRow
                    label="Penemuan artis"
                    ordinal={progress.nextPenemuan.ordinal}
                    remaining={progress.nextPenemuan.remaining}
                    unit="artis"
                  />
                )}
              </div>
            )}

            {tickets.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
                <p className="font-display text-2xl text-paper mb-2">Belum ada tiket</p>
                <p className="text-muted text-sm max-w-xs">
                  Tiket pertamamu tercetak begitu scrobble pertama tercatat. Putar lagu, dan mulailah
                  mengoleksi.
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-2.5">
                <p className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-1">
                  {tickets.length} tiket terkumpul
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
