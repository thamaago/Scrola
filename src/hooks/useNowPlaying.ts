import { useEffect, useRef, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { notifyNowPlaying, enqueueScrobble } from '../lib/scrobbleEngine';
import { diag } from '../lib/diagnostics';
import {
  createTracker,
  applyEvent,
  msUntilEligible,
  playedMsUntil,
  type PlaybackTracker,
} from '../lib/playbackTimer';
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
  /**
   * Waktu putar (bukan posisi) yang sudah terkumpul untuk track ini, dalam ms. Sumber gerak bar
   * "Sedang Diamati": `positionSec` dari MediaSession mandek di antara event, jadi bar dulu ikut
   * beku. Nilai ini di-tick tiap detik dari tracker waktu-berlalu (lihat ticker di bawah).
   */
  playedMs: number;
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
  // Tracker waktu-berlalu (menggantikan ketergantungan pada position MediaSession yang mandek).
  const trackerRef = useRef<PlaybackTracker>(createTracker());
  // Timer terjadwal untuk memicu scrobble saat ambang waktu tercapai.
  const scrobbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        playedMs: isSameTrack ? prev?.playedMs ?? 0 : 0,
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
      const now = Date.now();

      // Perbarui tracker WAKTU BERLALU. Kita TIDAK lagi memakai `positionSec` untuk memutuskan
      // kelayakan — position dari MediaSession mandek kalau lagu diputar lurus (lihat
      // playbackTimer.ts). Kita hitung sendiri berapa lama track benar-benar diputar.
      trackerRef.current = applyEvent(
        trackerRef.current,
        { trackKey, isPlaying, durationSec: meta.durationSec },
        now
      );

      // Segerakan playedMs ke state begitu tracker diperbarui, supaya bar bereaksi langsung saat
      // play/pause/seek tanpa menunggu tick 1 detik berikutnya. Di antara event, ticker di bawah
      // yang menjaga bar tetap bergerak.
      const playedNow = playedMsUntil(trackerRef.current, now);
      setCurrent((prev) => (prev && prev.playedMs !== playedNow ? { ...prev, playedMs: playedNow } : prev));

      // Jadwalkan (atau jadwalkan ulang) pengecekan kelayakan. Setiap event menghitung ulang
      // "berapa lama lagi sampai layak", lalu memasang satu timer. Timer lama dibatalkan supaya
      // tidak menumpuk.
      if (scrobbleTimerRef.current !== null) {
        clearTimeout(scrobbleTimerRef.current);
        scrobbleTimerRef.current = null;
      }

      if (scrobbledTrackKeyRef.current === trackKey) return; // sudah discrobble

      const wait = msUntilEligible(trackerRef.current, now);
      if (!Number.isFinite(wait)) return; // dijeda atau durasi tak valid: tak ada yang dijadwalkan

      scrobbleTimerRef.current = setTimeout(() => {
        scrobbleTimerRef.current = null;
        diag(`timer BERBUNYI untuk ${trackKey}`);
        // Verifikasi ULANG saat timer berbunyi: track harus masih sama, masih berjalan, dan
        // benar-benar sudah memenuhi waktu (guard terhadap event yang mungkin datang di sela).
        const tr = trackerRef.current;
        if (tr.trackKey !== trackKey) { diag(`timer batal: track berganti`); return; }
        if (msUntilEligible(tr, Date.now()) > 0) { diag(`timer batal: belum cukup waktu`); return; }
        if (scrobbledTrackKeyRef.current === trackKey) { diag(`timer batal: sudah discrobble`); return; }

        scrobbledTrackKeyRef.current = trackKey;
        diag(`LAYAK -> memicu enqueue untuk ${trackKey}`);

        const isInternal = data.packageName === 'com.scrola.app';
        (isInternal ? Promise.resolve(true) : getExternalScrobbleEnabled())
          .then((allowed) => {
            if (!allowed) return; // dilewati sesuai preferensi; flag tetap set
            return enqueueScrobble(
              {
                artist: meta.artist,
                track: meta.title,
                album: meta.album,
                duration: meta.durationSec,
                timestamp: meta.startedAt,
              },
              data.packageName
            );
          })
          .catch((e) => {
            if (scrobbledTrackKeyRef.current === trackKey) {
              scrobbledTrackKeyRef.current = null;
            }
            console.warn('Gagal memasukkan scrobble ke antrean, akan dicoba lagi:', e);
          });
      }, wait);
    }).then((h) => (stateHandle = h)).catch((e) => {
      console.warn('NowPlaying.addListener(playbackStateChanged) gagal didaftarkan:', e);
    });

    return () => {
      metaHandle?.remove();
      stateHandle?.remove();
      if (scrobbleTimerRef.current !== null) clearTimeout(scrobbleTimerRef.current);
    };
  }, []);

  // Ticker halus untuk bar "Sedang Diamati". `positionSec` dari MediaSession hanya di-update saat
  // event play/pause/seek, jadi kalau lagu diputar lurus bar dulu MEMBEKU (dan cuma "melompat"
  // saat Spotify sesekali memancarkan ulang state). Di sini kita render ulang tiap detik dari
  // tracker WAKTU-BERLALU — sumber yang sama dengan logika kelayakan scrobble — sehingga bar &
  // teks "tercatat dalam ..." bergerak mulus dan jujur mengikuti timer scrobble sebenarnya.
  //
  // Aman terhadap jeda: saat dijeda `playingSince` null, `playedMsUntil` mengembalikan nilai beku,
  // jadi bar berhenti sendiri tanpa perlu logika khusus. Kita hanya setCurrent kalau nilainya
  // BERUBAH, supaya tidak memicu render sia-sia saat idle/dijeda.
  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((prev) => {
        if (!prev) return prev;
        // Hanya laporkan played-time kalau tracker memang untuk track yang sedang ditampilkan —
        // mencegah sisa tracker dari track sebelumnya bocor ke kartu track baru.
        const curKey = `${prev.artist}::${prev.title}`;
        const t = trackerRef.current;
        const played = t.trackKey === curKey ? playedMsUntil(t, Date.now()) : 0;
        return prev.playedMs === played ? prev : { ...prev, playedMs: played };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return current;
}
