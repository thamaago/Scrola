import { useMemo, useState } from 'react';
import StoryTicket from '../components/StoryTicket';
import NoteEditor from '../components/NoteEditor';
import { hasNote, normalizeNoteForSave } from '../lib/noteLogic';
import { setHistoryNote } from '../lib/db/queries';
import type { HistoryEntry } from '../hooks/useScrobbleHistory';
import { groupHistoryByDay } from '../lib/historyGrouping';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function HistoryScreen({
  items,
  freshId,
  onOpenSisiB,
  onOpenTickets,
  onToggleLoved,
  onDeleteEntry,
  onUpdateEntry,
  onNoteSaved,
}: {
  items: HistoryEntry[];
  /** id entri yang BARU saja tercatat — diberi border amber + animasi masuk */
  freshId?: number | null;
  onOpenSisiB: () => void;
  onOpenTickets: () => void;
  onToggleLoved: (entry: HistoryEntry) => void;
  onDeleteEntry: (entry: HistoryEntry) => void;
  onUpdateEntry: (entry: HistoryEntry, fields: { artist: string; track: string; album?: string }) => void;
  /** Dipanggil setelah catatan tersimpan supaya App memuat ulang riwayat & catatannya tampil. */
  onNoteSaved?: () => void;
}) {
  // Sheet aksi per-tiket: null = tertutup. 'menu' = pilih aksi; 'edit' = form; 'delete' = konfirmasi.
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [mode, setMode] = useState<'menu' | 'edit' | 'delete'>('menu');
  const [noteTarget, setNoteTarget] = useState<HistoryEntry | null>(null);
  const [editFields, setEditFields] = useState({ artist: '', track: '', album: '' });

  function openSheet(entry: HistoryEntry) {
    setSelected(entry);
    setMode('menu');
    setEditFields({ artist: entry.artist, track: entry.track, album: entry.album ?? '' });
  }
  function closeSheet() {
    setSelected(null);
  }
  // Pengelompokan dilakukan lewat fungsi murni yang bisa diunit-test (lihat historyGrouping.ts),
  // bukan di dalam komponen — supaya logic tanggal (hari ini/kemarin) terverifikasi terpisah.
  const groups = useMemo(() => groupHistoryByDay(items), [items]);

  const now = new Date();
  const babLabel = `Bab ${ROMAN[now.getMonth()]} · ${BULAN[now.getMonth()]}`;

  return (
    <div className="min-h-screen px-4 pt-8 pb-24">
      <div className="flex justify-between items-center mx-2 mb-[18px]">
        <h1 className="font-display text-2xl font-semibold text-paper">Riwayat</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTickets}
            className="flex items-center gap-1.5 bg-surfaceRaised border border-amber/25 rounded-full py-[7px] px-3.5 active:scale-[0.98] transition-transform"
            aria-label="Buka koleksi tiket"
          >
            <span className="font-mono text-[10px] tracking-[0.15em] text-amber uppercase whitespace-nowrap">
              Tiket
            </span>
          </button>
          <button
            onClick={onOpenSisiB}
            className="flex items-center gap-2 bg-surfaceRaised border border-amber/25 rounded-full py-[7px] px-3.5 active:scale-[0.98] transition-transform"
            aria-label="Buka rekap mingguan Sisi B"
          >
            <span className="font-mono text-[10px] tracking-[0.15em] text-amber uppercase whitespace-nowrap">
              {babLabel}
            </span>
            <span className="text-muted text-xs">→</span>
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center px-4 pt-24">
          <p className="font-display text-2xl text-paper mb-2">Buku ceritamu masih kosong</p>
          <p className="text-muted text-sm max-w-xs">
            Setiap lagu yang selesai kamu dengarkan akan muncul di sini sebagai tiket.
          </p>
        </div>
      ) : (
        groups.map((group, gi) => (
          <div key={group.key} className="mb-6">
            <div className="flex items-baseline justify-between mx-2 mb-2.5">
              <span
                className={`font-mono text-[11px] tracking-[0.2em] uppercase ${
                  gi === 0 && group.label === 'Hari ini' ? 'text-amber' : 'text-muted'
                }`}
              >
                {group.label}
              </span>
              <span className="font-mono text-[11px] text-muted">{group.items.length} lagu</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {group.items.map((item) => {
                const isFresh = freshId != null && item.id === freshId;
                return (
                  <div
                    key={item.id}
                    onClick={(e) => {
                      // Jangan buka sheet kalau yang di-tap adalah tombol ♥ di dalam tiket —
                      // biarkan toggle love bekerja tanpa membuka menu.
                      if ((e.target as HTMLElement).closest('button')) return;
                      openSheet(item);
                    }}
                  >
                    <StoryTicket
                      artist={item.artist}
                      title={item.track}
                      album={item.album}
                      timestamp={new Date(item.timestamp * 1000)}
                      loved={item.loved}
                      variant={isFresh ? 'fresh' : 'settled'}
                      animateIn={isFresh}
                      onToggleLoved={() => onToggleLoved(item)}
                    />
                    {/* Catatan ditampilkan MENEMPEL di bawah tiket, bukan di dalamnya — seperti
                        coretan tangan di balik tiket sungguhan. Sengaja dibedakan gayanya
                        (miring, garis amber di kiri) supaya jelas ini suara pengguna, bukan
                        metadata lagu. */}
                    {hasNote(item.note) && (
                      <p className="ml-[42px] mr-3 mt-1.5 pl-3 border-l-2 border-amber/40 text-muted text-[13px] italic leading-relaxed whitespace-pre-wrap break-words">
                        {item.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* ===== Sheet aksi tiket (tap tiket untuk membuka) ===== */}
      {selected && (
        <div className="fixed inset-0 z-30" role="dialog" aria-modal="true">
          {/* Latar gelap — tap untuk menutup */}
          <div className="absolute inset-0 bg-black/60" onClick={closeSheet} />
          <div className="absolute bottom-0 inset-x-0 bg-surfaceRaised rounded-t-2xl border-t border-white/10 p-5 pb-8">
            <p className="font-display text-lg font-semibold text-paper truncate">{selected.track}</p>
            <p className="text-muted text-sm truncate mb-1">{selected.artist}</p>
            {/* Kejujuran soal batas: aksi di sini hanya menyentuh riwayat lokal */}
            <p className="font-mono text-[10px] text-muted/70 mb-4">
              Hanya riwayat lokal — profil Last.fm tidak berubah (batas API mereka).
            </p>

            {mode === 'menu' && (
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => setNoteTarget(selected)}
                  className="w-full bg-surface border border-amber/30 rounded-lg py-3.5 text-amber text-sm font-medium"
                >
                  {hasNote(selected.note) ? '✎ Ubah catatan' : '+ Tulis catatan'}
                </button>
                <button
                  onClick={() => setMode('edit')}
                  className="w-full bg-surface border border-white/10 rounded-lg py-3.5 text-paper text-sm font-medium"
                >
                  ✎ Edit tiket ini
                </button>
                <button
                  onClick={() => setMode('delete')}
                  className="w-full bg-surface border border-coral/30 rounded-lg py-3.5 text-coral text-sm font-medium"
                >
                  Hapus dari riwayat
                </button>
                <button onClick={closeSheet} className="w-full py-3 text-muted text-sm">
                  Batal
                </button>
              </div>
            )}

            {mode === 'edit' && (
              <div className="flex flex-col gap-2.5">
                {(
                  [
                    ['track', 'Judul'],
                    ['artist', 'Artis'],
                    ['album', 'Album (opsional)'],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">{label}</span>
                    <input
                      value={editFields[field]}
                      onChange={(e) => setEditFields((f) => ({ ...f, [field]: e.target.value }))}
                      className="mt-1 w-full bg-ink border border-white/10 rounded-lg py-3 px-3.5 text-paper text-sm focus:border-amber/50 focus:outline-none"
                    />
                  </label>
                ))}
                <button
                  onClick={() => {
                    const artist = editFields.artist.trim();
                    const track = editFields.track.trim();
                    if (!artist || !track) return; // judul & artis wajib — tombol juga di-disable
                    onUpdateEntry(selected, {
                      artist,
                      track,
                      album: editFields.album.trim() || undefined,
                    });
                    closeSheet();
                  }}
                  disabled={!editFields.artist.trim() || !editFields.track.trim()}
                  className="w-full bg-amber text-ink font-semibold rounded-lg py-3.5 text-sm mt-1 disabled:opacity-40"
                >
                  Simpan
                </button>
                <button onClick={() => setMode('menu')} className="w-full py-2.5 text-muted text-sm">
                  Kembali
                </button>
              </div>
            )}

            {mode === 'delete' && (
              <div className="flex flex-col gap-2.5">
                <p className="text-paper text-sm leading-relaxed">
                  Hapus tiket ini dari riwayat lokal? Tindakan ini tidak bisa dibatalkan.
                </p>
                <button
                  onClick={() => {
                    onDeleteEntry(selected);
                    closeSheet();
                  }}
                  className="w-full bg-coral text-ink font-semibold rounded-lg py-3.5 text-sm"
                >
                  Ya, hapus
                </button>
                <button onClick={() => setMode('menu')} className="w-full py-2.5 text-muted text-sm">
                  Kembali
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor catatan — dibuka dari sheet tiket. Menyimpan langsung ke baris riwayat karena
          di sini barisnya PASTI sudah ada (berbeda dengan layar Sekarang, yang lagunya bisa
          belum tercatat sama sekali). */}
      {noteTarget && (
        <NoteEditor
          initialValue={noteTarget.note ?? ''}
          contextLabel={`${noteTarget.track} — ${noteTarget.artist}`}
          onSave={async (raw) => {
            await setHistoryNote(noteTarget.id, normalizeNoteForSave(raw));
            onNoteSaved?.();
          }}
          onClose={() => {
            setNoteTarget(null);
            closeSheet();
          }}
        />
      )}
    </div>
  );
}
