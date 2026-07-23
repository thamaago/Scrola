import { useCallback, useEffect, useState } from 'react';
import { Player } from '../lib/player';

interface PlayerUiState {
  title: string;
  artist: string;
  albumArt: string | null;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
}

interface TrackInfo {
  uri: string;
  title: string;
  artist: string;
  albumArt: string | null;
}

/**
 * usePlayer
 *
 * Catatan penting: hook ini HANYA mengurus kontrol UI player (pilih file, play/pause/seek,
 * album art). Deteksi now-playing untuk keperluan scrobble TIDAK diambil dari sini — itu tetap
 * lewat useNowPlayingListener() seperti sumber lain (Spotify dkk), karena PlaybackService memang
 * didesain agar sesi medianya ikut terbaca oleh MediaSessionManager yang sama. Dua hook ini
 * saling melengkapi: usePlayer untuk kontrol + tampilan, useNowPlayingListener untuk pipeline
 * scrobble.
 */
export function usePlayer() {
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [state, setState] = useState<PlayerUiState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    Player.addListener('playerPositionChanged', (data) => {
      setState((prev) => ({
        title: prev?.title ?? track?.title ?? '',
        artist: prev?.artist ?? track?.artist ?? '',
        albumArt: prev?.albumArt ?? track?.albumArt ?? null,
        positionMs: data.positionMs,
        durationMs: data.durationMs,
        isPlaying: data.isPlaying,
      }));
    }).then((h) => (handle = h)).catch((e) => {
      console.warn('Player.addListener(playerPositionChanged) gagal didaftarkan:', e);
    });
    return () => handle?.remove();
  }, [track]);

  // Track selesai (STATE_ENDED di native) -> bersihkan state supaya UI kembali ke tampilan
  // "pilih lagu" alih-alih menampilkan disc berhenti di posisi akhir selamanya.
  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    Player.addListener('playbackEnded', () => {
      setState(null);
      setTrack(null);
    }).then((h) => (handle = h)).catch(() => {});
    return () => handle?.remove();
  }, []);

  const pickAndPlay = useCallback(async () => {
    setLoading(true);
    try {
      const result = await Player.pickAndPlay();
      setTrack({ uri: result.uri, title: result.title, artist: result.artist, albumArt: result.albumArt });
    } catch (e) {
      // Termasuk kasus normal: user membuka picker file lalu membatalkannya (tekan back) —
      // itu bukan error yang perlu ditampilkan, cukup diam saja. Sebelumnya promise ini tidak
      // ditangkap sama sekali, jadi setiap kali user batal memilih file akan muncul unhandled
      // promise rejection di console.
      console.warn('pickAndPlay dibatalkan atau gagal:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const pause = useCallback(() => Player.pause(), []);
  const resume = useCallback(() => Player.resume(), []);
  const seekTo = useCallback((positionMs: number) => Player.seekTo({ positionMs }), []);

  /**
   * Perbarui metadata yang DITAMPILKAN untuk track yang sedang dimuat, tanpa reload player —
   * dipakai setelah EditMetadataScreen berhasil menyimpan perubahan pada file yang sama persis
   * dengan yang sedang diputar, supaya UI langsung mencerminkan judul/artist/sampul baru alih-alih
   * menampilkan data lama sampai user memutar ulang.
   *
   * CATATAN JUJUR: ini HANYA memperbarui apa yang ditampilkan di layar. MediaSession internal
   * ExoPlayer (dipakai untuk deteksi now-playing/scrobble lewat useNowPlayingListener) TIDAK
   * ikut diperbarui secara live — treknya akan tetap ter-scrobble dengan judul/artist LAMA kalau
   * proses scrobble untuk track ini sudah/sedang berjalan sebelum edit disimpan. Perubahan penuh
   * baru berlaku bersih mulai pemutaran berikutnya (setelah file dipilih ulang).
   */
  const updateTrackMetadata = useCallback((uri: string, changes: Partial<Omit<TrackInfo, 'uri'>>) => {
    setTrack((prev) => (prev && prev.uri === uri ? { ...prev, ...changes } : prev));
  }, []);

  return { track, state, loading, pickAndPlay, pause, resume, seekTo, updateTrackMetadata };
}
