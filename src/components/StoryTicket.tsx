interface StoryTicketProps {
  artist: string;
  title: string;
  album?: string;
  timestamp: Date;
  loved?: boolean;
  /**
   * settled  — tiket di Riwayat. TANPA tanggal (sudah pindah ke header grup hari), cukup jam + ♥.
   * printing — tiket yang "sedang tercetak" keluar dari slot printer di Now Playing. Sudut atas
   *            lurus & tanpa border-atas supaya menyatu mulus dengan slot di atasnya.
   * fresh    — sama seperti settled, tapi border amber terang: entri yang BARU saja tercatat.
   */
  variant?: 'printing' | 'settled' | 'fresh';
  /** Hanya untuk variant="printing": label kiri ("MENCETAK…" / "TERCATAT ✓") */
  printLabel?: string;
  /** Hanya untuk variant="printing": teks kanan (mis. "1:12 / 3:30") */
  printMeta?: string;
  /** Hanya untuk variant="printing": transform/opacity animasi "sobek" saat scrobble tercatat */
  tearing?: boolean;
  /** Animasi masuk untuk entri riwayat yang baru tercatat */
  animateIn?: boolean;
  /** Kalau diberikan, ♥ jadi tombol toggle (bukan sekadar indikator). Hanya varian settled/fresh. */
  onToggleLoved?: () => void;
}

/**
 * StoryTicket — signature visual Scrola.
 *
 * Setiap track dirender sebagai "tiket cerita": tepi kiri berlubang perforasi, isi bergaya struk.
 * Redesign "Hutan Malam": tanggal DIHAPUS dari tiket settled (dipindah ke header grup hari di
 * HistoryScreen) supaya tiket lebih bersih; variant "printing" kini dirancang menyatu dengan
 * slot printer di Now Playing (border-atas dilepas, sudut atas lurus).
 */
export default function StoryTicket({
  artist,
  title,
  album,
  timestamp,
  loved,
  variant = 'settled',
  printLabel,
  printMeta,
  tearing = false,
  animateIn = false,
  onToggleLoved,
}: StoryTicketProps) {
  const isPrinting = variant === 'printing';
  const isFresh = variant === 'fresh';
  // Guard terhadap Date invalid (mis. timestamp korup dari DB) — tanpa ini, toLocaleTimeString
  // pada Date(NaN) merender teks "Invalid Date" yang jelek.
  const validDate = !isNaN(timestamp.getTime());

  if (isPrinting) {
    return (
      <div
        className="flex rounded-b-[10px] overflow-hidden border border-t-0 border-amber/35 bg-surfaceRaised"
        style={{
          transform: tearing ? 'translateY(20px) rotate(1.5deg)' : 'none',
          opacity: tearing ? 0 : 1,
          transition: 'transform 0.55s cubic-bezier(0.5,0,0.75,0), opacity 0.55s ease',
        }}
      >
        <div className="ticket-perforation shrink-0" aria-hidden="true" />
        <div className="flex-1 pt-3 pb-3.5 pr-4 pl-3 min-w-0">
          <div className="flex justify-between gap-2">
            <span className="font-mono text-[10px] tracking-[0.1em] text-amber uppercase">
              {printLabel}
            </span>
            <span className="font-mono text-[10px] text-muted shrink-0">{printMeta}</span>
          </div>
          <h3 className="font-display text-[17px] font-semibold text-paper mt-1 truncate">{title}</h3>
          <p className="text-[13px] text-muted truncate">
            {artist}
            {validDate && (
              <> · {timestamp.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}{' '}
              {timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex rounded-r-lg overflow-hidden border bg-surface ${
        isFresh ? 'border-amber/45' : 'border-white/5'
      } ${animateIn ? 'animate-fade-slide-in' : ''}`}
    >
      <div className="ticket-perforation shrink-0" aria-hidden="true" />
      <div className="flex-1 py-3 pr-4 pl-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          {/* Tanggal sengaja TIDAK ada di sini — sudah ditampilkan sekali di header grup hari,
              jadi tiket cukup menunjukkan jam. Ini membuat daftar riwayat jauh lebih bersih. */}
          <span className="font-mono text-[10px] text-muted">
            {validDate ? timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
          {onToggleLoved ? (
            // Tombol toggle love. Area sentuh diperluas ke 44×44 (negatif margin supaya layout
            // visual tiket tidak melebar) — ukuran glyph tetap kecil, targetnya yang besar.
            <button
              onClick={onToggleLoved}
              className="flex items-center justify-center w-11 h-11 -my-3.5 -mr-3 shrink-0"
              role="switch"
              aria-checked={!!loved}
              aria-label={loved ? 'Hapus tanda suka' : 'Tandai suka'}
            >
              <span
                className={`text-[15px] transition-colors ${loved ? 'text-coral' : 'text-muted/40'}`}
              >
                {loved ? '♥' : '♡'}
              </span>
            </button>
          ) : (
            loved && (
              <span className="text-coral text-[11px]" aria-label="Disukai">
                ♥
              </span>
            )
          )}
        </div>
        <h3 className="font-display text-lg leading-snug font-semibold text-paper mt-1 truncate">
          {title}
        </h3>
        <p className="text-sm text-muted truncate">
          {artist}
          {album ? <span className="text-muted/60"> · {album}</span> : null}
        </p>
      </div>
    </div>
  );
}
