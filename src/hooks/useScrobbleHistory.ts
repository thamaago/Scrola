import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { readHistory } from '../lib/scrobbleEngine';
import { setLoved, deleteHistoryEntry, updateHistoryEntry, type HistoryRow } from '../lib/db/queries';
import { loveTrack, unloveTrack } from '../lib/lastfm';
import { recordCorrection } from '../lib/correctionsStore';
import { loadSession } from '../lib/secureStore';

export type HistoryEntry = HistoryRow;

export function useScrobbleHistory() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  // Guard SINKRON per-entri untuk aksi yang mengubah data (love/hapus/edit). useRef berubah
  // seketika, sementara setState React baru berlaku di render berikutnya — jadi tanpa ini,
  // dua tap cepat pada ♥ yang sama bisa mengirim track.love DAN track.unlove hampir bersamaan
  // ke Last.fm, dan status akhir di server ditentukan oleh mana yang kebetulan tiba belakangan
  // (tidak deterministik, dan bisa berlawanan dengan ♥ yang ditampilkan). Pola yang sama sudah
  // dipakai untuk mencegah double-save MP3 di useMp3Editor.
  const busyIdsRef = useRef<Set<number>>(new Set());

  const reload = useCallback(() => {
    readHistory()
      .then(setItems)
      .catch((e) => {
        // Kalau initDb() gagal total (lihat main.tsx), getDb() akan terus menolak setiap
        // dipanggil — tanpa catch ini, setiap reload() (termasuk tiap kali app kembali ke
        // foreground lewat listener di bawah) akan jadi unhandled promise rejection berulang.
        console.warn('Gagal memuat riwayat scrobble:', e);
      });
  }, []);

  /**
   * Toggle status loved sebuah entri riwayat — optimistic: UI berubah seketika, lalu
   * disinkronkan ke Last.fm (track.love/unlove) dan DB lokal; kalau ADA yang gagal,
   * di-rollback supaya ♥ di layar tidak pernah berbohong tentang keadaan di Last.fm.
   *
   * Sengaja TANPA antrean offline (beda dengan scrobble): love adalah aksi kosmetik yang
   * dipicu manual — kalau gagal karena offline, pengguna melihat ♥ kembali seperti semula
   * dan bisa mengulanginya nanti. Membangun antrean retry untuk ini menambah kompleksitas
   * (dan kelas bug baru) untuk nilai yang kecil; scrobble diantrekan karena ia OTOMATIS dan
   * hilang selamanya kalau tidak dicatat — love tidak punya sifat itu.
   */
  const toggleLoved = useCallback(async (entry: HistoryEntry): Promise<boolean> => {
    if (busyIdsRef.current.has(entry.id)) return false; // aksi untuk entri ini masih berjalan
    busyIdsRef.current.add(entry.id);
    const nextLoved = !entry.loved;
    // Optimistic: langsung ubah di state supaya sentuhan terasa instan.
    setItems((prev) => prev.map((it) => (it.id === entry.id ? { ...it, loved: nextLoved } : it)));
    try {
      const session = await loadSession();
      if (!session) throw new Error('Belum login');
      if (nextLoved) {
        await loveTrack(session.sk, entry.artist, entry.track);
      } else {
        await unloveTrack(session.sk, entry.artist, entry.track);
      }
      // Last.fm sudah menerima — baru catat ke DB lokal. Kalau penulisan lokal gagal,
      // biarkan error jatuh ke rollback juga: lebih baik UI kembali (dan user mengulang)
      // daripada UI & DB lokal tidak sinkron dengan Last.fm secara diam-diam.
      await setLoved(entry.id, nextLoved);
      return true;
    } catch (e) {
      console.warn('Gagal mengubah status loved, dikembalikan:', e);
      setItems((prev) => prev.map((it) => (it.id === entry.id ? { ...it, loved: entry.loved } : it)));
      return false;
    } finally {
      busyIdsRef.current.delete(entry.id);
    }
  }, []);

  /** Hapus entri dari riwayat LOKAL (Last.fm tidak berubah — batas API mereka). Optimistic. */
  const deleteEntry = useCallback(async (entry: HistoryEntry): Promise<boolean> => {
    if (busyIdsRef.current.has(entry.id)) return false;
    busyIdsRef.current.add(entry.id);
    setItems((prev) => prev.filter((it) => it.id !== entry.id));
    try {
      await deleteHistoryEntry(entry.id);
      return true;
    } catch (e) {
      console.warn('Gagal menghapus entri riwayat, dikembalikan:', e);
      // Rollback: muat ulang dari DB (posisi urutan dipulihkan dengan benar oleh ORDER BY).
      reload();
      return false;
    } finally {
      busyIdsRef.current.delete(entry.id);
    }
  }, [reload]);

  /** Edit metadata entri riwayat LOKAL. Optimistic dengan rollback via reload. */
  const updateEntry = useCallback(
    async (entry: HistoryEntry, fields: { artist: string; track: string; album?: string }): Promise<boolean> => {
      if (busyIdsRef.current.has(entry.id)) return false;
      busyIdsRef.current.add(entry.id);
      setItems((prev) => prev.map((it) => (it.id === entry.id ? { ...it, ...fields } : it)));
      try {
        await updateHistoryEntry(entry.id, fields);
        // "Belajar dari koreksi": ingat perubahan ini sebagai aturan, terapkan otomatis ke scrobble
        // serupa berikutnya. No-op kalau perubahan trivial (dicek di dalam recordCorrection).
        void recordCorrection(
          { artist: entry.artist, track: entry.track },
          { artist: fields.artist, track: fields.track }
        );
        return true;
      } catch (e) {
        console.warn('Gagal mengedit entri riwayat, dikembalikan:', e);
        reload();
        return false;
      } finally {
        busyIdsRef.current.delete(entry.id);
      }
    },
    [reload]
  );

  useEffect(() => {
    reload();
    // Muat ulang tiap kali app kembali ke foreground, supaya scrobble yang terkirim
    // saat app di background (lewat foreground service) langsung terlihat.
    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) reload();
    });
    return () => {
      listener.then((h) => h.remove());
    };
  }, [reload]);

  return { items, reload, toggleLoved, deleteEntry, updateEntry };
}
