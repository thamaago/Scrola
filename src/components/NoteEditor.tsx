import { useEffect, useRef, useState } from 'react';
import { NOTE_MAX_LENGTH, clampNote, remainingChars } from '../lib/noteLogic';
import { useI18n } from '../lib/i18nContext';

interface NoteEditorProps {
  initialValue: string;
  /** Judul kecil di atas editor, mis. nama lagu — memberi konteks catatan ini untuk apa. */
  contextLabel?: string;
  onSave: (note: string) => Promise<void> | void;
  onClose: () => void;
}

/**
 * NoteEditor — menulis catatan 140 karakter pada sebuah tiket.
 *
 * Batas panjang ditegakkan di DUA lapis: di sini (agar pengguna melihat sisanya secara langsung)
 * dan di normalizeNoteForSave() sebelum menyentuh DB. Mengandalkan `maxLength` HTML saja tidak
 * cukup — atribut itu menghitung unit UTF-16, sehingga satu emoji memakan dua jatah dan hitungan
 * yang dilihat pengguna jadi tidak masuk akal.
 */
export default function NoteEditor({
  initialValue,
  contextLabel,
  onSave,
  onClose,
}: NoteEditorProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  // Guard SINKRON: penyimpanan menyentuh DB dan bisa memakan waktu; tanpa ini, tap ganda cepat
  // memicu dua penulisan. Pola yang sama dengan tombol bagikan & simpan MP3.
  const savingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Fokus otomatis + kursor di akhir, supaya pengguna bisa langsung mengetik atau melanjutkan
    // catatan yang sudah ada tanpa memindahkan kursor manual.
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const left = remainingChars(value);
  const nearLimit = left <= 20;

  async function handleSave() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave(value);
      onClose();
    } catch (e) {
      console.warn('Gagal menyimpan catatan:', e);
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/80 flex items-end sm:items-center justify-center px-4 pb-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('np.writeNote')}
    >
      <div
        className="w-full max-w-sm bg-surfaceRaised rounded-[14px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-[10px] tracking-[0.2em] text-amber uppercase mb-1">
          {t('note.eyebrow')}
        </p>
        {contextLabel && (
          <p className="text-muted text-xs mb-3 truncate">{contextLabel}</p>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(clampNote(e.target.value))}
          rows={3}
          placeholder={t('note.placeholder')}
          className="w-full bg-ink text-paper rounded-lg p-3 text-[15px] leading-relaxed resize-none outline-none border border-white/5 focus:border-amber/40 placeholder:text-muted/50"
        />

        <div className="flex items-center justify-between mt-2">
          <span
            className={`font-mono text-[11px] tabular-nums ${
              nearLimit ? 'text-coral' : 'text-muted'
            }`}
          >
            {left} / {NOTE_MAX_LENGTH}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-muted text-sm py-2 px-3"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber text-ink text-sm font-semibold rounded-lg py-2 px-4 disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {saving ? t('note.saving') : t('common.save')}
            </button>
          </div>
        </div>

        <p className="text-muted/60 text-[11px] mt-3 leading-relaxed">
          {t('note.privacy')}
        </p>
      </div>
    </div>
  );
}
