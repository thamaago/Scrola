import { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { useMp3Editor, type EditableFields } from '../hooks/useMp3Editor';
import { useI18n } from '../lib/i18nContext';

// Urutan field editor. Label & placeholder diambil dari kamus: edit.field.<key> / edit.field.<key>.ph
const FIELD_KEYS: (keyof EditableFields)[] = ['title', 'artist', 'album', 'albumArtist', 'year', 'genre'];

/**
 * EditMetadataScreen
 *
 * "Tulis Ulang Cerita" — mengedit tag ID3 file MP3 lokal (judul, artist, album, album artist,
 * tahun, genre, album art). Ditampilkan sebagai overlay penuh layar dari NowPlayingScreen,
 * bukan tab tersendiri di bottom nav, supaya bottom nav tetap ramping dan fitur ini terasa
 * sebagai aksi kontekstual ("edit lagu yang sedang kamu urus"), bukan fitur berdiri sendiri.
 *
 * onSaved (opsional): dipanggil setelah simpan berhasil dengan {uri, title, artist, albumArt}.
 * Dipakai NowPlayingScreen untuk menyinkronkan tampilan kalau file yang diedit kebetulan sama
 * dengan yang sedang diputar — lihat catatan di usePlayer.updateTrackMetadata soal batasannya.
 */
export default function EditMetadataScreen({
  onClose,
  onSaved,
  initialUri,
}: {
  onClose: () => void;
  onSaved?: (result: { uri: string; title: string; artist: string; albumArt: string | null }) => void;
  initialUri?: string;
}) {
  const { t } = useI18n();
  const editor = useMp3Editor();

  // Kalau dibuka dari lagu yang sedang diputar (initialUri diberikan), langsung muat file itu —
  // pengguna tak perlu memilih ulang MP3 yang sama. Hanya sekali saat mount.
  const loadedInitialRef = useRef(false);
  useEffect(() => {
    if (initialUri && !loadedInitialRef.current) {
      loadedInitialRef.current = true;
      void editor.loadUri(initialUri);
    }
  }, [initialUri, editor]);

  // Tombol back hardware Android sebelumnya tidak menutup overlay ini sama sekali (default
  // Capacitor tanpa history WebView untuk di-back-kan biasanya malah keluar dari app) —
  // ditangani eksplisit di sini supaya perilakunya sesuai ekspektasi Android pada umumnya:
  // back menutup modal yang sedang terbuka, bukan keluar dari aplikasi.
  useEffect(() => {
    const listener = CapApp.addListener('backButton', () => {
      if (!editor.saving) onClose();
    });
    return () => {
      listener.then((h) => h.remove());
    };
  }, [editor.saving, onClose]);

  async function handleSave() {
    const ok = await editor.save();
    if (ok) {
      if (editor.current && editor.fields) {
        onSaved?.({
          uri: editor.current.uri,
          title: editor.fields.title,
          artist: editor.fields.artist,
          albumArt: editor.displayedAlbumArt,
        });
      }
      editor.reset();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-ink z-50 overflow-y-auto">
      <div className="px-5 pt-8 pb-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} disabled={editor.saving} className="text-muted text-sm disabled:opacity-40">
            {t('common.cancel')}
          </button>
          <p className="font-mono text-[10px] tracking-[0.3em] text-amber uppercase">
            {t('edit.eyebrow')}
          </p>
          <div style={{ width: 40 }} />
        </div>

        {!editor.current ? (
          <div className="flex flex-col items-center justify-center text-center px-4" style={{ minHeight: '60vh' }}>
            <p className="font-display text-xl text-paper mb-2">{t('edit.pick.title')}</p>
            <p className="text-muted text-sm max-w-xs mb-6">{t('edit.pick.body')}</p>
            <p className="text-muted/70 text-xs max-w-xs mb-6 leading-relaxed">{t('edit.pick.note')}</p>
            <button
              onClick={editor.pickFile}
              disabled={editor.loading}
              className="bg-amber text-ink font-body font-semibold rounded-lg py-3 px-6 disabled:opacity-60"
            >
              {editor.loading ? t('edit.reading') : t('edit.pickFile')}
            </button>
            {editor.error && <p className="text-coral text-sm mt-4">{t(editor.error)}</p>}
          </div>
        ) : (
          <>
            {/* Album art — tampil seperti tiket dengan sampul, bisa diganti/dihapus */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-36 h-36 rounded-lg overflow-hidden bg-surfaceRaised border border-white/5 mb-3">
                {editor.displayedAlbumArt ? (
                  <img src={editor.displayedAlbumArt} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-3xl">♪</div>
                )}
              </div>
              <div className="flex gap-4">
                <button onClick={editor.pickNewAlbumArt} className="text-amber text-sm font-medium">
                  {t('edit.changeArt')}
                </button>
                {editor.displayedAlbumArt && (
                  <button onClick={editor.removeAlbumArt} className="text-coral text-sm font-medium">
                    {t('edit.removeArt')}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {FIELD_KEYS.map((key) => (
                <div key={key}>
                  <label className="font-mono text-[10px] tracking-widest text-muted uppercase mb-1.5 block">
                    {t(`edit.field.${key}`)}
                  </label>
                  <input
                    value={editor.fields?.[key] ?? ''}
                    onChange={(e) => editor.updateField(key, e.target.value)}
                    placeholder={t(`edit.field.${key}.ph`)}
                    className="w-full bg-surface text-paper rounded-md px-3.5 py-3 text-sm
                               border border-white/5 focus:border-amber/50 outline-none
                               placeholder:text-muted/60"
                  />
                </div>
              ))}
            </div>

            {editor.error && <p className="text-coral text-sm mt-4">{t(editor.error)}</p>}

            <button
              onClick={handleSave}
              disabled={editor.saving}
              className="w-full bg-amber text-ink font-body font-semibold rounded-lg py-3.5 mt-8 disabled:opacity-60"
            >
              {editor.saving ? t('edit.saving') : t('edit.saveChanges')}
            </button>
            <p className="text-muted text-xs text-center mt-3 leading-relaxed">
              {t('edit.saveNote')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
