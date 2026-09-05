import { useRef, useState } from 'react';
import { positionFromTouch, progressRatio, formatMs } from '../lib/seekLogic';

interface SeekTimelineProps {
  positionMs: number;
  durationMs: number;
  /** Ambang scrobble dalam ms — ditandai di timeline. 0 = tidak ditampilkan. */
  scrobbleAtMs?: number;
  onSeek: (positionMs: number) => void;
}

/**
 * SeekTimeline — timeline pemutar yang bisa digeser.
 *
 * Layar Sekarang awalnya sengaja mengganti progress bar dengan metafora "tiket tercetak". Tapi
 * tiket itu menunjukkan progres menuju SCROBBLE, bukan posisi dalam lagu — jadi tidak ada cara
 * mengulang bagian yang disukai, dan tombol ±10s cuma penopang kasar. Keduanya menjawab
 * pertanyaan berbeda, jadi keduanya perlu ada.
 *
 * PENANDA AMBANG SCROBBLE: garis kecil di timeline menunjukkan titik di mana lagu resmi tercatat.
 * Ini bukan hiasan — ia menyatukan dua konsep yang tadinya terpisah, dan menjawab pertanyaan yang
 * selama ini hanya bisa ditebak: "kalau saya lompat ke sini, apa lagunya masih tercatat?"
 * Sejauh yang saya tahu tidak ada scrobbler lain yang menampilkan ini.
 */
export default function SeekTimeline({
  positionMs,
  durationMs,
  scrobbleAtMs = 0,
  onSeek,
}: SeekTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Saat menggeser, posisi ditentukan jari — BUKAN oleh pembaruan posisi dari player. Tanpa
  // pemisahan ini, bar akan "melawan" jari: geser ke kanan lalu tersentak balik tiap kali event
  // posisi tiba dari pemutar.
  const [dragMs, setDragMs] = useState<number | null>(null);

  const shownMs = dragMs ?? positionMs;
  const ratio = progressRatio(shownMs, durationMs);
  const scrobbleRatio = scrobbleAtMs > 0 ? progressRatio(scrobbleAtMs, durationMs) : 0;
  const passedScrobble = scrobbleAtMs > 0 && shownMs >= scrobbleAtMs;

  function msFromEvent(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return positionFromTouch(clientX, rect.left, rect.width, durationMs);
  }

  return (
    <div className="w-full">
      {/* Area sentuh dibuat tinggi 36px meski bar-nya tipis — bar 4px mustahil dikenai jari
          dengan akurat. Bar-nya sendiri diposisikan di tengah area ini. */}
      <div
        ref={trackRef}
        className="relative h-9 flex items-center cursor-pointer touch-none"
        role="slider"
        aria-label="Posisi pemutaran"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.round(durationMs / 1000))}
        aria-valuenow={Math.round(shownMs / 1000)}
        aria-valuetext={`${formatMs(shownMs)} dari ${formatMs(durationMs)}`}
        onPointerDown={(e) => {
          if (durationMs <= 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragMs(msFromEvent(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragMs === null) return;
          setDragMs(msFromEvent(e.clientX));
        }}
        onPointerUp={(e) => {
          if (dragMs === null) return;
          const target = msFromEvent(e.clientX);
          setDragMs(null);
          onSeek(target);
        }}
        onPointerCancel={() => setDragMs(null)}
      >
        {/* Track */}
        <div className="absolute inset-x-0 h-1 rounded-full bg-ink" />

        {/* Bagian terisi */}
        <div
          className="absolute left-0 h-1 rounded-full bg-amber"
          style={{
            width: `${ratio * 100}%`,
            transition: dragMs === null ? 'width 0.25s linear' : 'none',
          }}
        />

        {/* Penanda ambang scrobble — titik di mana lagu resmi tercatat */}
        {scrobbleRatio > 0 && scrobbleRatio < 1 && (
          <div
            className="absolute w-[2px] h-3 rounded-full"
            style={{
              left: `${scrobbleRatio * 100}%`,
              background: passedScrobble ? '#D6A756' : 'rgba(239,237,224,0.35)',
              transform: 'translateX(-1px)',
            }}
            aria-hidden="true"
          />
        )}

        {/* Handle */}
        <div
          className="absolute rounded-full bg-amber border-[3px] border-ink"
          style={{
            left: `${ratio * 100}%`,
            width: dragMs !== null ? 20 : 15,
            height: dragMs !== null ? 20 : 15,
            transform: 'translateX(-50%)',
            transition: dragMs === null ? 'left 0.25s linear, width 0.15s, height 0.15s' : 'width 0.15s, height 0.15s',
          }}
        />
      </div>

      <div className="flex justify-between items-center -mt-1">
        <span className="font-mono text-[11px] text-muted tabular-nums">{formatMs(shownMs)}</span>
        {scrobbleAtMs > 0 && (
          <span className={`font-mono text-[10px] ${passedScrobble ? 'text-amber' : 'text-muted/70'}`}>
            {passedScrobble ? '✓ melewati titik catat' : `tercatat di ${formatMs(scrobbleAtMs)}`}
          </span>
        )}
        <span className="font-mono text-[11px] text-muted tabular-nums">{formatMs(durationMs)}</span>
      </div>
    </div>
  );
}
