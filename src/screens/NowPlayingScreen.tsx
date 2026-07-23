import { useEffect, useRef, useState } from 'react';
import StoryTicket from '../components/StoryTicket';
import EditMetadataScreen from './EditMetadataScreen';
import SeekTimeline from '../components/SeekTimeline';
import { usePlayer } from '../hooks/usePlayer';
import { scrobbleThresholdSec } from '../lib/scrobbleLogic';
import { maybeScrobble, resetScrobbleGuard } from '../lib/scrobbleEngine';
import NoteEditor from '../components/NoteEditor';
import { hasNote, normalizeNoteForSave } from '../lib/noteLogic';
import { saveOrHoldNote, getPendingNote } from '../lib/pendingNotes';
import { renderShareCard } from '../lib/shareImage';
import { SharePlugin } from '../lib/share';
import { sourceLabel } from '../lib/sourceLabels';
import type { NowPlayingState } from '../hooks/useNowPlaying';

const TICKET_FULL_HEIGHT = 96; // px — tinggi tiket saat tercetak penuh

/**
 * NowPlayingScreen — konsep "mesin cetak tiket".
 *
 * Progres menuju scrobble divisualkan sebagai tiket yang perlahan TERCETAK keluar dari slot
 * printer (tingginya = elapsed / ambang scrobble), bukan progress bar biasa. Saat ambang
 * tercapai, tiket "sobek" dan meluncur pergi, lalu muncul lagi bertanda TERCATAT ✓ disertai
 * toast — metafora fisik yang menjelaskan mekanik scrobble tanpa perlu teks penjelas.
 *
 * Ambang scrobble memakai scrobbleThresholdSec() dari scrobbleLogic.ts — SATU sumber kebenaran
 * yang sama dengan yang dipakai pipeline scrobble sungguhan, jadi visual tidak akan pernah
 * berbohong soal kapan lagu benar-benar tercatat.
 *
 * Deteksi dari app lain (Spotify dkk) sengaja TIDAK ditampilkan di sini — cukup jadi info
 * sederhana di Pengaturan, supaya layar ini fokus jadi panggung player internal Scrola.
 */
export default function NowPlayingScreen({
  onScrobbled,
  current,
}: {
  onScrobbled?: () => void;
  /** Deteksi dari aplikasi musik LAIN (null kalau tidak ada). Dipakai hanya saat player internal
   *  kosong, untuk menunjukkan bahwa Scrola tetap bekerja mengamati di latar. */
  current?: NowPlayingState | null;
}) {
  const player = usePlayer();
  const [showEditor, setShowEditor] = useState(false);
  const [tearing, setTearing] = useState(false);
  const [scrobbled, setScrobbled] = useState(false);
  const [toast, setToast] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  // Salinan catatan di layar. Disimpan terpisah dari DB supaya tombol bisa langsung menunjukkan
  // "Catatan tersimpan" walau lagunya belum tercatat di riwayat (catatan masih tertunda).
  const [noteDraft, setNoteDraft] = useState('');
  // Guard SINKRON: render canvas 1080x1920 makan waktu ratusan ms; tanpa ini, tap ganda cepat
  // memicu dua render + dua chooser bersamaan. Pola yang sama dengan anti double-save MP3.
  const sharingRef = useRef(false);

  // Kunci track saat ini — dipakai untuk mereset state animasi saat lagu berganti.
  const trackKey = player.track ? player.track.uri : null;

  // Deteksi dari aplikasi LAIN saja. Player internal Scrola juga muncul di aliran NowPlaying
  // (karena ia MediaSessionService yang sama-sama terbaca pipeline), jadi package sendiri harus
  // disaring — kalau tidak, kartu "sedang diamati" bisa menampilkan lagu Scrola sendiri.
  const externalNowPlaying =
    current && current.packageName !== 'com.scrola.app' ? current : null;
  const lastTrackKeyRef = useRef<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Kapan track internal MULAI diputar — timestamp scrobble (spek Last.fm: waktu mulai).
  const startedAtRef = useRef(Math.floor(Date.now() / 1000));

  // Picu scrobble untuk PLAYER INTERNAL. Ini menutup celah arsitektur: player internal mengirim
  // event lewat plugin Player (playerPositionChanged) yang tidak didengarkan useNowPlaying, jadi
  // sebelumnya lagu yang diputar di dalam Scrola TIDAK PERNAH tercatat. maybeScrobble() terpusat
  // memakai aturan eligibility + guard anti-dobel yang SAMA dengan jalur eksternal.
  //
  // Ditempatkan di sini (bukan App) karena NowPlayingScreen-lah yang memegang player.state via
  // usePlayer. Konsekuensinya: pengecekan hanya jalan saat tab ini ter-render. Untuk player
  // INTERNAL itu dapat diterima — memutar lagu di Scrola berarti pengguna sedang di layar ini;
  // scrobble tetap ter-enqueue begitu ambang tercapai walau kemudian pindah tab, karena guard
  // mencegah pengiriman ganda dan flushQueue berjalan di latar.
  useEffect(() => {
    if (!player.track || !player.state) return;
    const pos = Math.floor((player.state.positionMs ?? 0) / 1000);
    const dur = Math.floor((player.state.durationMs ?? 0) / 1000);
    maybeScrobble({
      artist: player.track.artist,
      track: player.track.title,
      album: undefined,
      durationSec: dur,
      positionSec: pos,
      startedAtSec: startedAtRef.current,
      sourcePackage: 'com.scrola.app',
    }).then((didScrobble) => {
      if (didScrobble) onScrobbled?.();
    });
  }, [player.track, player.state, onScrobbled]);

  // Reset penanda mulai + guard tiap kali track berganti, supaya lagu yang sama bisa tercatat
  // lagi kalau diputar ulang nanti.
  useEffect(() => {
    startedAtRef.current = Math.floor(Date.now() / 1000);
    if (player.track) resetScrobbleGuard(player.track.artist, player.track.title);

    // Draft catatan WAJIB direset saat lagu berganti — tanpa ini, catatan lagu sebelumnya
    // terbawa dan bisa tersimpan ke tiket yang salah. Kalau lagu baru ini punya catatan yang
    // masih tertunda (ditulis lalu app sempat berpindah lagu dan kembali), tampilkan lagi.
    setNoteOpen(false);
    setNoteDraft(
      player.track ? getPendingNote(player.track.artist, player.track.title) ?? '' : ''
    );
  }, [player.track?.uri]);

  // Reset seluruh state animasi saat track berganti — tanpa ini, tiket bisa tetap menampilkan
  // "TERCATAT ✓" dari lagu sebelumnya padahal lagu baru belum tercetak sama sekali.
  useEffect(() => {
    if (trackKey !== lastTrackKeyRef.current) {
      lastTrackKeyRef.current = trackKey;
      setTearing(false);
      setScrobbled(false);
      setToast(false);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
  }, [trackKey]);

  // Bersihkan timer saat unmount supaya tidak memanggil setState pada komponen yang sudah hilang.
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  const positionSec = Math.floor((player.state?.positionMs ?? 0) / 1000);
  const durationSec = Math.floor((player.state?.durationMs ?? 0) / 1000);
  const isPlaying = player.state?.isPlaying ?? false;
  const thresholdSec = durationSec > 30 ? scrobbleThresholdSec(durationSec) : 0;
  const eligible = thresholdSec > 0 && positionSec >= thresholdSec;

  // Picu animasi sobek + toast SEKALI saat ambang scrobble tercapai.
  useEffect(() => {
    if (!eligible || scrobbled || !player.track) return;
    setScrobbled(true);
    setTearing(true);
    setToast(true);
    onScrobbled?.();

    timersRef.current.push(
      setTimeout(() => setTearing(false), 600), // tiket kembali utuh, kini bertanda TERCATAT ✓
      setTimeout(() => setToast(false), 2800) // toast hilang sendiri
    );
  }, [eligible, scrobbled, player.track, onScrobbled]);

  if (!player.track) {
    // Player internal kosong. Tapi belum tentu tidak terjadi apa-apa — bisa jadi Scrola sedang
    // MENGAMATI aplikasi musik lain di latar. Tanpa menampilkannya di sini, layar utama terlihat
    // kosong seperti rusak padahal scrobble sedang berjalan normal, dan pengguna tidak punya cara
    // memastikan deteksinya bekerja tanpa membuka tab Pengaturan.
    //
    // Tampilannya SENGAJA dibuat berbeda dari panggung tiket di bawah: ini "yang Scrola amati",
    // bukan "yang kamu putar di Scrola". Kartu ringkas, tanpa disc berputar, tanpa slot printer.
    const extThreshold =
      externalNowPlaying && externalNowPlaying.durationSec > 30
        ? scrobbleThresholdSec(externalNowPlaying.durationSec)
        : 0;
    const extRemaining = extThreshold
      ? Math.max(0, Math.ceil(extThreshold - externalNowPlaying!.positionSec))
      : 0;
    const extProgress = extThreshold
      ? Math.min(externalNowPlaying!.positionSec / extThreshold, 1)
      : 0;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        {externalNowPlaying ? (
          <div className="w-full max-w-sm mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span
                className={`w-2 h-2 rounded-full ${
                  externalNowPlaying.isPlaying ? 'bg-amber animate-pulse' : 'bg-muted/50'
                }`}
                aria-hidden="true"
              />
              <span className="font-mono text-[10px] tracking-[0.25em] text-amber uppercase">
                Sedang Diamati
              </span>
            </div>

            <div className="flex rounded-r-[10px] overflow-hidden border border-amber/25 bg-surface text-left">
              <div className="ticket-perforation shrink-0" aria-hidden="true" />
              <div className="flex-1 py-3.5 px-4 min-w-0">
                <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase truncate">
                  dari {sourceLabel(externalNowPlaying.packageName)}
                </p>
                <h3 className="font-display text-lg font-semibold text-paper mt-1 truncate">
                  {externalNowPlaying.title}
                </h3>
                <p className="text-[13px] text-muted truncate">{externalNowPlaying.artist}</p>

                {/* Bar progres tipis menuju ambang scrobble — memberi kepastian bahwa hitungannya
                    berjalan, tanpa meniru metafora tiket tercetak milik player internal. */}
                {extThreshold > 0 && (
                  <>
                    <div className="h-[3px] bg-ink rounded-full mt-3 overflow-hidden">
                      <div
                        className="h-full bg-amber rounded-full"
                        style={{ width: `${extProgress * 100}%`, transition: 'width 0.4s linear' }}
                      />
                    </div>
                    <p className="font-mono text-[10px] text-muted mt-1.5">
                      {extProgress >= 1
                        ? 'sudah memenuhi syarat — tercatat ke Riwayat'
                        : `tercatat dalam ${formatSec(extRemaining)}`}
                    </p>
                  </>
                )}
                {extThreshold === 0 && (
                  <p className="font-mono text-[10px] text-muted mt-2.5">
                    terlalu pendek untuk dicatat
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="font-display text-2xl text-paper mb-2">Belum ada cerita</p>
            <p className="text-muted text-sm max-w-xs mb-2">
              Putar lagu dari aplikasi musik apa pun — Scrola akan mencatatnya. Atau putar langsung
              di sini untuk melihat tiketnya tercetak.
            </p>
            <p className="text-muted/70 text-xs max-w-xs mb-6">
              Belum ada aplikasi musik lain yang terdeteksi. Kalau kamu sedang memutar musik di app
              lain, pastikan <span className="text-paper">Akses notifikasi</span> aktif di tab Atur.
            </p>
          </>
        )}

        <button
          onClick={player.pickAndPlay}
          disabled={player.loading}
          className="bg-amber text-ink font-body font-semibold rounded-lg py-4 px-6 disabled:opacity-60 active:scale-[0.98] transition-transform"
        >
          {player.loading ? 'Membuka...' : 'Pilih Lagu dari Perangkat'}
        </button>
        <button
          onClick={() => setShowEditor(true)}
          className="text-muted text-sm font-mono mt-6 underline underline-offset-4"
        >
          atau edit metadata MP3
        </button>
        {showEditor && <EditMetadataScreen onClose={() => setShowEditor(false)} />}
      </div>
    );
  }

  // Tinggi tiket = seberapa jauh menuju ambang scrobble (bukan terhadap total durasi) — inilah
  // inti metafora: tiket selesai tercetak TEPAT saat lagu resmi tercatat.
  const printProgress = thresholdSec > 0 ? Math.min(positionSec / thresholdSec, 1) : 0;
  const ticketHeight = scrobbled ? TICKET_FULL_HEIGHT : printProgress * TICKET_FULL_HEIGHT;

  async function handleShare() {
    if (sharingRef.current || !player.track) return;
    sharingRef.current = true;
    setSharing(true);
    setShareError(null);
    try {
      const base64 = await renderShareCard({
        title: player.track.title,
        artist: player.track.artist,
        albumArt: player.track.albumArt,
        durationSec,
        timestampSec: Math.floor(Date.now() / 1000),
      });
      await SharePlugin.shareImage({
        base64,
        filename: 'scrola-tiket.png',
        title: 'Bagikan tiket',
      });
    } catch (e) {
      console.warn('Gagal membagikan tiket:', e);
      setShareError('Gagal menyiapkan gambar. Coba lagi.');
      setTimeout(() => setShareError(null), 3000);
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  }

  return (
    <div className="min-h-screen px-6 pt-9 pb-24 flex flex-col items-center overflow-hidden">
      <p className="font-mono text-[10px] tracking-[0.3em] text-amber uppercase mb-6 text-center">
        Sedang Ditulis
      </p>

      {/* Disc vinyl 190px — berputar selagi playing, berhenti saat pause */}
      <div className="relative w-[190px] h-[190px] mb-[22px]">
        <div
          className="absolute inset-0 rounded-full bg-surfaceRaised border-4 border-surface shadow-xl overflow-hidden animate-disc-spin"
          style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
        >
          {player.track.albumArt ? (
            <img src={player.track.albumArt} alt="" className="w-full h-full object-cover" draggable={false} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surfaceRaised to-ink">
              <span className="text-muted text-[32px]">♪</span>
            </div>
          )}
          <div className="absolute inset-[10px] rounded-full border border-paper/5" />
          <div className="absolute inset-[26px] rounded-full border border-paper/5" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[42px] h-[42px] rounded-full bg-amber border-4 border-ink" />
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-full">
        <h2 className="font-display text-[22px] font-semibold text-paper text-center truncate">
          {player.track.title}
        </h2>
        <button
          onClick={() => setShowEditor(true)}
          className="text-muted shrink-0"
          aria-label="Edit metadata lagu ini"
        >
          ✎
        </button>
      </div>
      <p className="text-muted text-sm text-center mt-1 mb-4">{player.track.artist}</p>

      {/* Timeline geser — untuk mengulang bagian yang disukai. Berbeda peran dari tiket tercetak
          di bawah: timeline menunjukkan POSISI dalam lagu, tiket menunjukkan progres menuju
          scrobble. Penanda kecil di timeline menyatukan keduanya dengan menunjukkan di titik mana
          lagu resmi tercatat. */}
      <div className="w-[82%] mb-[18px]">
        <SeekTimeline
          positionMs={player.state?.positionMs ?? 0}
          durationMs={player.state?.durationMs ?? 0}
          scrobbleAtMs={thresholdSec > 0 ? thresholdSec * 1000 : 0}
          onSeek={(ms) => player.seekTo(ms)}
        />
      </div>

      {/* Kontrol — hit target ≥44px sesuai standar sentuh */}
      <div className="flex items-center justify-center gap-7 mb-[26px]">
        <button
          onClick={() => player.seekTo(Math.max(0, (player.state?.positionMs ?? 0) - 10000))}
          className="w-14 h-14 rounded-full bg-surface border border-white/5 text-muted font-mono text-[13px] active:scale-95 transition-transform"
          aria-label="Mundur 10 detik"
        >
          −10s
        </button>
        <button
          onClick={isPlaying ? player.pause : player.resume}
          className="w-[72px] h-[72px] rounded-full bg-amber text-ink flex items-center justify-center text-[26px] active:scale-95 transition-transform"
          style={{ boxShadow: '0 8px 24px rgba(214,167,86,0.35)' }}
          aria-label={isPlaying ? 'Jeda' : 'Putar'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => player.seekTo((player.state?.positionMs ?? 0) + 10000)}
          className="w-14 h-14 rounded-full bg-surface border border-white/5 text-muted font-mono text-[13px] active:scale-95 transition-transform"
          aria-label="Maju 10 detik"
        >
          +10s
        </button>
      </div>

      {/* Slot printer — tiket "keluar" dari sini */}
      <div
        className="w-full h-2.5 rounded-full"
        style={{
          background: '#0A0F0C',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8), 0 1px 0 rgba(239,237,224,0.06)',
        }}
        aria-hidden="true"
      />

      {/* Tiket tercetak — tingginya tumbuh seiring lagu diputar */}
      <div
        className="w-[82%] overflow-hidden -mt-0.5"
        style={{ height: `${ticketHeight}px`, transition: 'height 0.3s linear' }}
      >
        <StoryTicket
          artist={player.track.artist}
          title={player.track.title}
          timestamp={new Date()}
          variant="printing"
          tearing={tearing}
          printLabel={scrobbled ? 'Tercatat ✓' : 'Mencetak…'}
          printMeta={`${formatSec(positionSec)} / ${formatSec(durationSec)}`}
        />
      </div>

      <div className="w-[82%] flex justify-between items-center mt-2.5">
        <span className="font-mono text-[11px] text-muted">
          tercetak {Math.round(printProgress * 100)}%
        </span>
        <span className="font-mono text-[11px] text-amber">
          {scrobbled
            ? 'tersimpan di Riwayat'
            : thresholdSec > 0
            ? `scrobble pada ${formatSec(Math.ceil(thresholdSec))}`
            : 'terlalu pendek untuk dicatat'}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2.5">
        {/* Tulis catatan untuk lagu yang SEDANG diputar — inti dari "every song leaves a story".
            Bisa ditulis kapan saja, termasuk sebelum lagu memenuhi ambang scrobble; kalau
            barisnya belum ada di riwayat, catatan ditahan dan menempel otomatis begitu tercatat
            (lihat pendingNotes.ts). */}
        <button
          onClick={() => setNoteOpen(true)}
          className={`flex items-center gap-2 rounded-full py-2.5 px-5 text-[13px] font-medium active:scale-[0.98] transition-transform border ${
            hasNote(noteDraft) ? 'border-amber bg-amber/10 text-amber' : 'border-amber/35 text-amber'
          }`}
          aria-label="Tulis catatan untuk lagu ini"
        >
          <span aria-hidden="true">✎</span>
          {hasNote(noteDraft) ? 'Catatan tersimpan' : 'Tulis catatan'}
        </button>

        {/* Bagikan tiket sebagai gambar — untuk Status WhatsApp / Story Instagram.
            Membuka share sheet Android; pengguna sendiri memilih tujuannya. */}
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center gap-2 border border-amber/35 text-amber rounded-full py-2.5 px-5 text-[13px] font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
          aria-label="Bagikan tiket lagu ini sebagai gambar"
        >
          <span aria-hidden="true">↗</span>
          {sharing ? 'Menyiapkan…' : 'Bagikan'}
        </button>
      </div>
      {shareError && <p className="text-coral text-xs mt-2">{shareError}</p>}

      {noteOpen && player.track && (
        <NoteEditor
          initialValue={noteDraft}
          contextLabel={`${player.track.title} — ${player.track.artist}`}
          onSave={async (raw) => {
            const artist = player.track!.artist;
            const title = player.track!.title;
            await saveOrHoldNote(artist, title, raw);
            setNoteDraft(normalizeNoteForSave(raw) ?? '');
            onScrobbled?.(); // muat ulang riwayat supaya catatan langsung tampak kalau sudah tercatat
          }}
          onClose={() => setNoteOpen(false)}
        />
      )}

      {/* Toast konfirmasi — muncul saat scrobble resmi tercatat */}
      <div
        className="fixed left-6 right-6 bottom-[72px] flex justify-center pointer-events-none z-30"
        style={{
          opacity: toast ? 1 : 0,
          transform: toast ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1)',
        }}
        aria-live="polite"
      >
        <div
          className="flex items-center gap-2.5 bg-surfaceRaised border border-amber/40 rounded-full py-2.5 px-[18px]"
          style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
        >
          <span className="text-amber text-[13px]">✓</span>
          <span className="text-paper text-[13px] font-medium">Tiket tercatat ke Riwayat</span>
        </div>
      </div>

      {showEditor && (
        <EditMetadataScreen
          onClose={() => setShowEditor(false)}
          onSaved={(result) => {
            if (player.track) player.updateTrackMetadata(player.track.uri, result);
          }}
        />
      )}
    </div>
  );
}

function formatSec(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
