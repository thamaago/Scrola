import { useCallback, useRef, useState } from 'react';
import { Mp3MetadataNative, type Mp3Metadata } from '../lib/mp3Metadata';

export interface EditableFields {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: string;
  genre: string;
}

export function useMp3Editor() {
  const [current, setCurrent] = useState<Mp3Metadata | null>(null);
  const [fields, setFields] = useState<EditableFields | null>(null);
  const [newAlbumArt, setNewAlbumArt] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // `error` menyimpan KUNCI i18n (bukan teks jadi) — pemanggil menerjemahkan dengan t(error) saat
  // render, jadi pesan mengikuti bahasa aktif termasuk saat diganti sewaktu error tampil.
  const [error, setError] = useState<string | null>(null);
  // Guard SINKRON untuk mencegah save ganda. setSaving(true) bersifat async (baru berlaku di
  // render berikutnya), jadi kalau tombol Simpan ter-tap dua kali sangat cepat, pengecekan
  // `saving` di UI belum tentu sempat memblokir panggilan kedua — dan dua proses saveMetadata
  // yang jalan bersamaan menulis ke FILE MP3 yang sama persis (read-modify-write), berisiko
  // merusak file. useRef berubah seketika (sinkron), jadi jadi jaring pengaman yang benar di sini.
  const savingRef = useRef(false);

  const pickFile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meta = await Mp3MetadataNative.pickMp3ToEdit();
      setCurrent(meta);
      setFields({
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        albumArtist: meta.albumArtist,
        year: meta.year,
        genre: meta.genre,
      });
      setNewAlbumArt(undefined); // reset penanda "artwork diubah" tiap kali pilih file baru
    } catch (e) {
      setError('err.mp3.pick');
      console.warn('pickMp3ToEdit gagal:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Muat metadata dari URI yang sudah dimiliki (mis. lagu yang sedang diputar) — tanpa picker.
  const loadUri = useCallback(async (uri: string) => {
    setLoading(true);
    setError(null);
    try {
      const meta = await Mp3MetadataNative.readMetadata({ uri });
      setCurrent(meta);
      setFields({
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        albumArtist: meta.albumArtist,
        year: meta.year,
        genre: meta.genre,
      });
      setNewAlbumArt(undefined);
    } catch (e) {
      setError('err.mp3.read');
      console.warn('readMetadata gagal:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateField = useCallback((key: keyof EditableFields, value: string) => {
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const removeAlbumArt = useCallback(() => setNewAlbumArt(''), []);
  const setAlbumArtDataUri = useCallback((dataUri: string) => setNewAlbumArt(dataUri), []);

  const pickNewAlbumArt = useCallback(async () => {
    try {
      const { albumArt } = await Mp3MetadataNative.pickAlbumArtImage();
      setNewAlbumArt(albumArt);
    } catch (e) {
      console.warn('pickAlbumArtImage gagal:', e);
    }
  }, []);

  const displayedAlbumArt = newAlbumArt === undefined ? current?.albumArt ?? null : newAlbumArt || null;

  const save = useCallback(async () => {
    if (!current || !fields) return false;
    if (savingRef.current) return false; // sudah ada proses simpan berjalan, abaikan panggilan kedua
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await Mp3MetadataNative.saveMetadata({
        uri: current.uri,
        ...fields,
        albumArtBase64: newAlbumArt,
      });
      return true;
    } catch (e) {
      setError('err.mp3.save');
      console.warn('saveMetadata gagal:', e);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [current, fields, newAlbumArt]);

  const reset = useCallback(() => {
    setCurrent(null);
    setFields(null);
    setNewAlbumArt(undefined);
    setError(null);
  }, []);

  return {
    current,
    fields,
    displayedAlbumArt,
    loading,
    saving,
    error,
    pickFile,
    loadUri,
    updateField,
    removeAlbumArt,
    setAlbumArtDataUri,
    pickNewAlbumArt,
    save,
    reset,
  };
}
