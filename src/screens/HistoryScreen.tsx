import { useEffect, useMemo, useState } from 'react';
import StoryTicket from '../components/StoryTicket';
import NoteEditor from '../components/NoteEditor';
import { hasNote, normalizeNoteForSave } from '../lib/noteLogic';
import { setHistoryNote } from '../lib/db/queries';
import type { HistoryEntry } from '../hooks/useScrobbleHistory';
import { groupHistoryByDay, groupHistoryByPeriod, filterHistoryWithNotes, recentHistory, paginateHistory } from '../lib/historyGrouping';
import { getAllHistory } from '../lib/db/queries';
import type { HistoryRow } from '../lib/db/queries';
import { useI18n } from '../lib/i18nContext';

// Angka Romawi bulan — netral bahasa. Nama bulan kini via i18n (month()).
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

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
  const { t, tp, month, locale } = useI18n();
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
  // Mode tampilan Riwayat. 'recent' = default, hanya 10 terakhir. Mode lain menampilkan UTUH.
  const [viewMode, setViewMode] = useState<'recent' | 'day' | 'week' | 'month' | 'notes'>('recent');
  const [allItems, setAllItems] = useState<HistoryRow[] | null>(null);
  const [page, setPage] = useState(0);

  // Muat riwayat UTUH hanya saat mode selain 'recent' aktif (lazy). Reload juga saat ada scrobble
  // baru (items berubah) agar mode utuh tetap segar.
  useEffect(() => {
    if (viewMode === 'recent') return;
    let cancelled = false;
    getAllHistory()
      .then((all) => {
        if (!cancelled) setAllItems(all);
      })
      .catch((e) => {
        console.warn('Gagal memuat riwayat utuh:', e);
        if (!cancelled) setAllItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [viewMode, items]);

  // Daftar rata untuk mode aktif (sebelum paging). 'recent' dibatasi 10; mode lain utuh.
  const flatItems = useMemo(() => {
    if (viewMode === 'recent') return recentHistory(items, 10);
    const source = allItems ?? [];
    if (viewMode === 'notes') return filterHistoryWithNotes(source);
    return source; // day / week / month
  }, [viewMode, items, allItems]);

  // Paging 10/halaman. 'recent' selalu ≤10 → 1 halaman (bar tak muncul).
  const pageData = useMemo(() => paginateHistory(flatItems, page, 10), [flatItems, page]);

  // Kelompokkan hanya item di HALAMAN ini. Bentuk grup identik → rendering tak berubah.
  const groups = useMemo(() => {
    const its = pageData.pageItems;
    if (viewMode === 'week' || viewMode === 'month')
      return groupHistoryByPeriod(its, viewMode, new Date(), locale);
    return groupHistoryByDay(its, new Date(), locale); // recent / day / notes
  }, [pageData, viewMode, locale]);

  // Reset ke halaman awal saat ganti mode (rentang halaman bisa beda).
  useEffect(() => {
    setPage(0);
  }, [viewMode]);

  const loadingFull = viewMode !== 'recent' && allItems === null;

  // Bar navigasi halaman (10/halaman). Muncul hanya bila ada >1 halaman. Dipakai di atas & bawah daftar.
  const paginationBar =
    !loadingFull && pageData.totalPages > 1 ? (
      <div className="flex items-center justify-between mx-2 my-3">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={pageData.page === 0}
          className="font-mono text-[11px] rounded-full px-3 py-1.5 border border-white/10 text-paper disabled:opacity-30 active:scale-[0.98] transition-transform"
        >
          {t('history.prev')}
        </button>
        <span className="font-mono text-[10px] text-muted text-center leading-snug">
          {t('history.pageRange', {
            from: pageData.page * 10 + 1,
            to: Math.min((pageData.page + 1) * 10, pageData.total),
            total: pageData.total,
          })}
          <br />
          {t('history.pageOf', { page: pageData.page + 1, total: pageData.totalPages })}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(pageData.totalPages - 1, p + 1))}
          disabled={pageData.page >= pageData.totalPages - 1}
          className="font-mono text-[11px] rounded-full px-3 py-1.5 border border-white/10 text-paper disabled:opacity-30 active:scale-[0.98] transition-transform"
        >
          {t('history.next')}
        </button>
      </div>
    ) : null;

  const now = new Date();
  const babLabel = t('history.bab', { roman: ROMAN[now.getMonth()], month: month(now.getMonth()) });

  return (
    <div className="min-h-screen px-4 pt-8 pb-24">
      <div className="flex justify-between items-center mx-2 mb-[18px]">
        <h1 className="font-display text-2xl font-semibold text-paper">{t('history.title')}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTickets}
            className="flex items-center gap-1.5 bg-surfaceRaised border border-amber/25 rounded-full py-[7px] px-3.5 active:scale-[0.98] transition-transform"
            aria-label={t('history.aria.openTickets')}
          >
            <span className="font-mono text-[10px] tracking-[0.15em] text-amber uppercase whitespace-nowrap">
              {t('history.tickets')}
            </span>
          </button>
          <button
            onClick={onOpenSisiB}
            className="flex items-center gap-2 bg-surfaceRaised border border-amber/25 rounded-full py-[7px] px-3.5 active:scale-[0.98] transition-transform"
            aria-label={t('history.aria.openSisiB')}
          >
            <span className="font-mono text-[10px] tracking-[0.15em] text-amber uppercase whitespace-nowrap">
              {babLabel}
            </span>
            <span className="text-muted text-xs">→</span>
          </button>
        </div>
      </div>

      {/* Pemilih tampilan: Terbaru (10) vs periode utuh vs bercatatan. */}
      <div className="flex gap-1.5 mx-2 mb-4 overflow-x-auto no-scrollbar">
        {(['recent', 'day', 'week', 'month', 'notes'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`font-mono text-[11px] tracking-[0.05em] rounded-full py-1.5 px-3 whitespace-nowrap transition-colors ${
              viewMode === m
                ? 'bg-amber/20 border border-amber/40 text-amber'
                : 'bg-surface border border-white/10 text-muted'
            }`}
          >
            {t(`history.view.${m}`)}
          </button>
        ))}
      </div>

      {viewMode === 'recent' && items.length > 10 && (
        <p className="font-mono text-[10px] text-muted mx-2 mb-3">
          {t('history.recentNote')}
        </p>
      )}

      {paginationBar}

      {loadingFull ? (
        <p className="text-muted text-sm text-center pt-16">{t('history.loadingFull')}</p>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center px-4 pt-24">
          <p className="font-display text-2xl text-paper mb-2">
            {viewMode === 'notes' ? t('history.notes.empty.title') : t('history.empty.title')}
          </p>
          <p className="text-muted text-sm max-w-xs">
            {viewMode === 'notes' ? t('history.notes.empty.body') : t('history.empty.body')}
          </p>
        </div>
      ) : (
        groups.map((group, gi) => (
          <div key={group.key} className="mb-6">
            <div className="flex items-baseline justify-between mx-2 mb-2.5">
              <span
                className={`font-mono text-[11px] tracking-[0.2em] uppercase ${
                  gi === 0 && group.isToday ? 'text-amber' : 'text-muted'
                }`}
              >
                {group.label}
              </span>
              <span className="font-mono text-[11px] text-muted">{tp('count.tracks', group.items.length)}</span>
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

      {paginationBar}

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
              {t('history.localOnly')}
            </p>

            {mode === 'menu' && (
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => setNoteTarget(selected)}
                  className="w-full bg-surface border border-amber/30 rounded-lg py-3.5 text-amber text-sm font-medium"
                >
                  {hasNote(selected.note) ? `✎ ${t('history.action.editNote')}` : `+ ${t('history.action.addNote')}`}
                </button>
                <button
                  onClick={() => setMode('edit')}
                  className="w-full bg-surface border border-white/10 rounded-lg py-3.5 text-paper text-sm font-medium"
                >
                  {`✎ ${t('history.action.editTicket')}`}
                </button>
                <button
                  onClick={() => setMode('delete')}
                  className="w-full bg-surface border border-coral/30 rounded-lg py-3.5 text-coral text-sm font-medium"
                >
                  {t('history.action.delete')}
                </button>
                <button onClick={closeSheet} className="w-full py-3 text-muted text-sm">
                  {t('common.cancel')}
                </button>
              </div>
            )}

            {mode === 'edit' && (
              <div className="flex flex-col gap-2.5">
                {(
                  [
                    ['track', 'history.edit.title'],
                    ['artist', 'history.edit.artist'],
                    ['album', 'history.edit.album'],
                  ] as const
                ).map(([field, labelKey]) => (
                  <label key={field} className="block">
                    <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">{t(labelKey)}</span>
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
                  {t('common.save')}
                </button>
                <button onClick={() => setMode('menu')} className="w-full py-2.5 text-muted text-sm">
                  {t('common.back')}
                </button>
              </div>
            )}

            {mode === 'delete' && (
              <div className="flex flex-col gap-2.5">
                <p className="text-paper text-sm leading-relaxed">
                  {t('history.delete.confirm')}
                </p>
                <button
                  onClick={() => {
                    onDeleteEntry(selected);
                    closeSheet();
                  }}
                  className="w-full bg-coral text-ink font-semibold rounded-lg py-3.5 text-sm"
                >
                  {t('history.delete.yes')}
                </button>
                <button onClick={() => setMode('menu')} className="w-full py-2.5 text-muted text-sm">
                  {t('common.back')}
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
