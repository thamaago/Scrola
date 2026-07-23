import { useEffect, useRef, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { notifyNowPlaying, enqueueScrobble } from '../lib/scrobbleEngine';
import { isScrobbleEligible } from '../lib/scrobbleLogic';
import { getExternalScrobbleEnabled } from '../lib/preferences';

export interface NowPlayingPluginInterface {
  openNotificationAccessSettings(): Promise<void>;
  isNotificationAccessGranted(): Promise<{ granted: boolean }>;
  /** Diagnosis berlapis: izin vs service hidup vs data mengalir. */
  getListenerDiagnostics(): Promise<{
    granted: boolean;
    connected: boolean;
    connectedAtMs: number;
    lastEventAtMs: number;
    lastEventPackage: string;
    totalEvents: number;
    activeSessions: number;
    androidSdk: number;
    manufacturer: string;
  }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  addListener(
    eventName: 'nowPlayingChanged' | 'playbackStateChanged',
    listener: (data: any) => void
  ): Promise<{ remove: () => void }>;
}

export const NowPlaying = registerPlugin<NowPlayingPluginInterface>('NowPlaying');

// Konstanta dari android.media.session.PlaybackState
const STATE_PLAYING = 3;

export interface NowPlayingState {
  packageName: string;
  artist: string;
  title: string;
  album?: string;
  durationSec: number;
  positionSec: number;
  isPlaying: boolean;
}

/**
 * useNowPlayingListener
 *
 * Menyambungkan event native (dari ScrolaNotificationListener via NowPlayingPlugin) ke state
 * React, sekaligus menjalankan logika scrobble:
 *  - Saat track baru terdeteksi -> kirim track.updateNowPlaying (best-effort, tidak fatal jika gagal)
 *  - Melacak posisi playback -> begitu eligible (>=50% durasi atau >=4 menit) -> enqueue scrobble
 *    sekali saja per track (dijaga lewat scrobbledRef supaya tidak dobel saat re-render)
 */
export function useNowPlayingListener() {
  const [current, setCurrent] = useState<NowPlayingState | null>(null);
  const metadataRef = useRef<{
    artist: string;
    title: string;
    album?: string;
    durationSec: number;
    startedAt: number; // unix seconds — waktu track ini pertama terdeteksi, dipakai sebagai timestamp scrobble
  } | null>(null);
  const scrobbledTrackKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let metaHandle: { remove: () => void } | undefined;
    let stateHandle: { remove: () => void } | undefined;

    NowPlaying.addListener('nowPlayingChanged', (data) => {
      const trackKey = `${data.artist ?? ''}::${data.title ?? ''}`;
      const isSameTrack = trackKey === (metadataRef.current ? `${metadataRef.current.artist}::${metadataRef.current.title}` : null);

      const meta = {
        artist: data.artist ?? '',
        title: data.title ?? '',
        album: data.album || undefined,
        durationSec: Math.floor((data.durationMs ?? 0) / 1000),
        // Track baru -> catat waktu sekarang sebagai perkiraan waktu mulai (dipakai sebagai
        // timestamp scrobble, BUKAN waktu saat syarat eligibility terpenuhi beberapa menit
        // kemudian). Kalau event ini cuma refire metadata untuk track yang sama, pertahankan
        // startedAt yang lama supaya timestamp tidak bergeser maju tiap kali metadata diupdate.
        startedAt: isSameTrack && metadataRef.current ? metadataRef.current.startedAt : Math.floor(Date.now() / 1000),
      };
      metadataRef.current = meta;
      // Hanya reset flag "sudah discrobble" kalau memang track-nya benar-benar berganti —
      // beberapa app musik refire metadata (mis. artwork baru selesai dimuat) untuk track
      // yang sama, dan reset flag di sini akan menyebabkan scrobble ganda untuk track yang
      // sama persis.
      if (!isSameTrack) {
        scrobbledTrackKeyRef.current = null;
      }

      setCurrent((prev) => ({
        packageName: data.packageName,
        artist: meta.artist,
        title: meta.title,
        album: meta.album,
        durationSec: meta.durationSec,
        positionSec: isSameTrack ? prev?.positionSec ?? 0 : 0,
        isPlaying: prev?.isPlaying ?? false,
      }));

      if (meta.artist && meta.title) {
        // Hormati toggle "Scrobble dari app lain" JUGA untuk update now-playing — tanpa guard
        // ini, user yang mematikan pencatatan dari app lain tetap "menyiarkan" apa yang sedang
        // mereka putar di Spotify/YT Music ke profil Last.fm (track.updateNowPlaying). Toggle
        // harus berarti senyap total untuk sumber eksternal, bukan cuma menahan scrobble-nya.
        const isInternalSource = data.packageName === 'com.scrola.app';
        (isInternalSource ? Promise.resolve(true) : getExternalScrobbleEnabled())
          .then((allowed) => {
            if (allowed) {
              notifyNowPlaying({ artist: meta.artist, track: meta.title, album: meta.album, duration: meta.durationSec });
            }
          })
          .catch(() => {
            // Gagal membaca preferensi: pilih diam (tidak mengirim) — lebih aman salah ke arah
            // privasi daripada menyiarkan sesuatu yang mungkin user minta untuk tidak dikirim.
          });
      }
    }).then((h) => (metaHandle = h)).catch((e) => {
      // Umumnya terjadi saat preview web (npm run dev) di mana plugin native tidak tersedia —
      // bukan error fatal, tapi jangan biarkan jadi unhandled promise rejection yang berisik.
      console.warn('NowPlaying.addListener(nowPlayingChanged) gagal didaftarkan:', e);
    });

    NowPlaying.addListener('playbackStateChanged', (data) => {
      const positionSec = Math.floor((data.positionMs ?? 0) / 1000);
      const isPlaying = data.state === STATE_PLAYING;

      setCurrent((prev) =>
        prev
          ? { ...prev, positionSec, isPlaying }
          : prev
      );

      const meta = metadataRef.current;
      if (!meta || !meta.artist || !meta.title) return;

      const trackKey = `${meta.artist}::${meta.title}`;
      // Pakai fungsi tunggal yang sudah diunit-test, bukan menulis ulang aturannya di sini —
      // sebelumnya kondisi ini diduplikasi manual dan berisiko divergen dari aturan resmi.
      const eligible = isScrobbleEligible(meta.durationSec, positionSec);

      if (eligible && scrobbledTrackKeyRef.current !== trackKey) {
        // Set flag SEBELUM enqueue supaya event playback beruntun (yang datang tiap detik) tidak
        // memicu enqueue berkali-kali untuk track yang sama sebelum yang pertama selesai.
        scrobbledTrackKeyRef.current = trackKey;

        // Hormati toggle "Scrobble dari app lain" (Pengaturan). Saat mati, event dari aplikasi
        // musik LAIN diabaikan — tapi player internal Scrola (com.scrola.app) TETAP mencatat,
        // karena mematikan toggle berarti "catat player internal saja", bukan "matikan scrobble".
        // Pengecekan dilakukan async di dalam sini (bukan di luar) supaya tidak menahan jalur
        // event; getExternalScrobbleEnabled() dicache di memori jadi ini murah setelah panggilan
        // pertama.
        const isInternal = data.packageName === 'com.scrola.app';
        (isInternal ? Promise.resolve(true) : getExternalScrobbleEnabled())
          .then((allowed) => {
            if (!allowed) {
              // Dilewati sesuai preferensi user — bukan kegagalan, jadi flag TETAP di-set supaya
              // track ini tidak dicoba lagi berulang kali selama masih diputar.
              return;
            }
            return enqueueScrobble(
              {
                artist: meta.artist,
                track: meta.title,
                album: meta.album,
                duration: meta.durationSec,
                timestamp: meta.startedAt, // waktu track MULAI diputar, sesuai spek Last.fm — bukan waktu sekarang
              },
              data.packageName
            );
          })
          .catch((e) => {
            // Kalau enqueue gagal (mis. DB belum siap), JANGAN biarkan track ini hilang diam-diam.
            // Reset flag HANYA kalau track yang aktif masih sama — supaya percobaan playback
            // berikutnya untuk track ini bisa enqueue lagi. Kalau user sudah ganti lagu, biarkan
            // flag milik track baru apa adanya (jangan ditimpa balik).
            if (scrobbledTrackKeyRef.current === trackKey) {
              scrobbledTrackKeyRef.current = null;
            }
            console.warn('Gagal memasukkan scrobble ke antrean, akan dicoba lagi:', e);
          });
      }
    }).then((h) => (stateHandle = h)).catch((e) => {
      console.warn('NowPlaying.addListener(playbackStateChanged) gagal didaftarkan:', e);
    });

    return () => {
      metaHandle?.remove();
      stateHandle?.remove();
    };
  }, []);

  return current;
}
