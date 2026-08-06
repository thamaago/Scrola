import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { getAllHistoryForBackup } from '../lib/db/queries';
import { computeDiscoveries, type Discovery } from '../lib/discoveryLogic';

/**
 * PenemuanScreen — linimasa "Penemuan": tiap artis yang pernah kamu temukan, lagu yang
 * mengenalkannya, dan kapan. Melengkapi item roadmap v0.3.0 "kurasi Penemuan" — mengubah angka
 * "penemuan baru" di Sisi B jadi cerita yang bisa ditelusuri.
 *
 * Mengomposisi query yang sudah ada (getAllHistoryForBackup) dengan fungsi murni computeDiscoveries
 * (teruji di discoveryLogic.test.ts). Tata letak & animasi tetap perlu konfirmasi device.
 */

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export default function PenemuanScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [discoveries, setDiscoveries] = useState<Discovery[] | null>(null);

  useEffect(() => {
    if (!open) return;
    const listener = CapApp.addListener('backButton', () => onClose());
    return () => {
      void listener.then((l) => l.remove());
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setDiscoveries(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await getAllHistoryForBackup();
        const result = computeDiscoveries(
          rows.map((r) => ({ artist: r.artist, track: r.track, timestamp: r.timestamp }))
        );
        if (!cancelled) setDiscoveries(result);
      } catch (e) {
        console.warn('Gagal memuat Penemuan:', e);
        if (!cancelled) setDiscoveries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const total = discoveries?.length ?? 0;

  return (
    <div className="fixed inset-0 bg-ink z-40 overflow-y-auto">
      <div className="relative px-7 pt-10 pb-16 min-h-full">
        <div className="flex justify-between items-center">
          <p className="font-mono text-[10px] tracking-[0.3em] text-amber uppercase">Penemuan</p>
          <button onClick={onClose} className="text-muted text-[13px]" aria-label="Tutup Penemuan">
            Tutup
          </button>
        </div>

        <h1 className="font-display text-[26px] leading-tight font-semibold text-paper mt-2">
          {discoveries === null
            ? 'Menyusun penemuanmu…'
            : total === 0
              ? 'Belum ada penemuan'
              : `Kamu menemukan ${total} artis`}
        </h1>
        {discoveries !== null && total > 0 && (
          <p className="text-muted text-[13px] mt-1.5 leading-relaxed">
            Setiap artis punya satu lagu yang mengenalkanmu padanya. Ini urutannya, dari yang terbaru.
          </p>
        )}

        {discoveries === null ? null : total === 0 ? (
          <p className="text-muted text-sm mt-8 leading-relaxed">
            Saat kamu mendengar artis untuk pertama kalinya, dia akan muncul di sini.
          </p>
        ) : (
          <ul className="mt-6 space-y-2.5">
            {discoveries.map((d) => (
              <li
                key={`${d.artist}:${d.firstTimestamp}`}
                className="bg-surface rounded-[10px] py-3.5 px-4 flex items-baseline gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-paper text-[15px] font-medium truncate">{d.artist}</p>
                  <p className="text-muted text-[12px] mt-0.5 truncate">
                    lewat “{d.firstTrack}” · {formatDate(d.firstTimestamp)}
                  </p>
                </div>
                <span className="font-mono text-[11px] text-amber shrink-0">
                  {d.playCount}×
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
