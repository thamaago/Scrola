import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { NowPlaying, type NowPlayingState } from '../hooks/useNowPlaying';
import { clearSession } from '../lib/secureStore';
import { Diagnostics } from '../lib/diagnostics';
import { getExternalScrobbleEnabled, setExternalScrobbleEnabled } from '../lib/preferences';
import { getAccountStats, getQueueStatus } from '../lib/db/queries';
import { flushQueue } from '../lib/scrobbleEngine';
import { sourceLabel } from '../lib/sourceLabels';

export default function SettingsScreen({
  username,
  current,
  onLoggedOut,
}: {
  username: string;
  current: NowPlayingState | null;
  onLoggedOut: () => void;
}) {
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [crashLog, setCrashLog] = useState<string | null>(null);
  const [showCrashLog, setShowCrashLog] = useState(false);
  const [externalOn, setExternalOn] = useState(true);
  const [accountStats, setAccountStats] = useState<{ totalScrobbles: number; firstYear: number | null } | null>(null);
  const [queueStatus, setQueueStatus] = useState<{
    pending: number;
    lastError: string | null;
    maxAttempts: number;
    oldestTimestamp: number | null;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [listenerDiag, setListenerDiag] = useState<{
    granted: boolean;
    connected: boolean;
    connectedAtMs: number;
    lastEventAtMs: number;
    lastEventPackage: string;
    totalEvents: number;
    activeSessions: number;
    androidSdk: number;
    manufacturer: string;
  } | null>(null);

  useEffect(() => {
    Diagnostics.getLastCrashLog()
      .then(({ log }) => setCrashLog(log))
      .catch(() => {
        // Plugin tidak tersedia (mis. preview web) — abaikan, fitur ini memang native-only.
      });
    getExternalScrobbleEnabled().then(setExternalOn).catch(() => {});
    refreshQueueStatus();
    refreshListenerDiag();
    getAccountStats()
      .then(setAccountStats)
      .catch((e) => {
        // Kartu tetap tampil tanpa statistik — data hias, bukan fungsional.
        console.warn('Gagal memuat statistik akun untuk Backstage Pass:', e);
      });
  }, []);

  useEffect(() => {
    NowPlaying.requestNotificationPermission().catch(() => {});
    refreshPermissionStatus();
    // Cek ulang tiap kali app kembali ke foreground — user mungkin baru saja memberi izin
    // di halaman Settings sistem.
    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) refreshPermissionStatus();
    });
    return () => {
      listener.then((h) => h.remove());
    };
  }, []);

  async function refreshPermissionStatus() {
    try {
      const { granted } = await NowPlaying.isNotificationAccessGranted();
      setNotifGranted(granted);
    } catch (e) {
      console.warn('Gagal mengecek status izin notifikasi:', e);
      setNotifGranted(false);
    }
  }

  function refreshListenerDiag() {
    NowPlaying.getListenerDiagnostics()
      .then(setListenerDiag)
      .catch((e) => {
        // Plugin versi lama tidak punya method ini — jangan jatuhkan layar Pengaturan.
        console.warn('Gagal membaca diagnosis listener:', e);
      });
  }

  function refreshQueueStatus() {
    getQueueStatus()
      .then(setQueueStatus)
      .catch((e) => {
        // Panel diagnosis tidak boleh menjatuhkan layar Pengaturan kalau DB bermasalah — tapi juga
        // TIDAK boleh tersangkut "Memeriksa…" selamanya. Set status kosong eksplisit supaya UI
        // keluar dari keadaan loading dan menampilkan bahwa antreannya tidak terbaca.
        console.warn('Gagal membaca status antrean:', e);
        setQueueStatus({ pending: 0, lastError: 'Antrean tidak terbaca', maxAttempts: 0, oldestTimestamp: null });
      });
  }

  async function handleRetryQueue() {
    setRetrying(true);
    try {
      await flushQueue();
    } catch (e) {
      console.warn('Percobaan kirim ulang antrean gagal:', e);
    } finally {
      setRetrying(false);
      refreshQueueStatus();
    refreshListenerDiag();
    }
  }

  async function handleLogout() {
    await clearSession();
    onLoggedOut();
  }

  function handleToggleExternal() {
    const next = !externalOn;
    setExternalOn(next); // optimistic — UI langsung merespons
    setExternalScrobbleEnabled(next).catch((e) => {
      // Kalau persist gagal, kembalikan UI supaya tidak berbohong soal state tersimpan.
      console.warn('Gagal menyimpan preferensi scrobble eksternal:', e);
      setExternalOn(!next);
    });
  }

  const externalNowPlaying =
    current && current.packageName !== 'com.scrola.app' ? current : null;

  return (
    <div className="min-h-screen px-5 pt-8 pb-24">
      <h1 className="font-display text-2xl font-semibold text-paper mb-6">Pengaturan</h1>

      {/* ===== Backstage Pass — kartu akun bergaya tiket ===== */}
      <div
        className="flex rounded-r-[14px] overflow-hidden border border-amber/30 mb-6"
        style={{ background: 'linear-gradient(150deg, #223026, #1A251E)' }}
      >
        <div className="ticket-perforation-lg shrink-0" aria-hidden="true" />
        <div className="flex-1 pt-5 px-5 pb-[18px] min-w-0">
          <div className="flex justify-between items-baseline">
            <p className="font-mono text-[10px] tracking-[0.25em] text-amber uppercase">
              Backstage Pass
            </p>
            {accountStats?.firstYear && (
              <p className="font-mono text-[10px] text-muted">sejak {accountStats.firstYear}</p>
            )}
          </div>
          <h2 className="font-display text-[26px] font-semibold text-paper mt-2.5 truncate">
            {username}
          </h2>
          <p className="text-[13px] text-muted mt-1">
            Terhubung ke Last.fm
            {accountStats != null &&
              accountStats.totalScrobbles > 0 &&
              ` · ${accountStats.totalScrobbles.toLocaleString('id-ID')} scrobble`}
          </p>
          <div className="border-t border-dashed border-paper/15 mt-4 pt-3 flex justify-between items-center gap-3">
            <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase truncate">
              last.fm/user/{username}
            </span>
            <button onClick={handleLogout} className="text-coral text-[13px] font-medium shrink-0">
              Putuskan
            </button>
          </div>
        </div>
      </div>

      {/* ===== Deteksi Musik ===== */}
      <section className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase mb-2">
          Deteksi Musik
        </p>
        <div className="bg-surface rounded-[10px] py-3.5 px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="pr-2">
              <p className="text-paper font-medium text-[15px]">Akses notifikasi</p>
              <p className="text-muted text-xs mt-0.5">Untuk membaca Spotify, YT Music, dll.</p>
            </div>
            <span
              className={`shrink-0 text-xs font-mono px-2 py-1 rounded ${
                notifGranted ? 'bg-amber/15 text-amber' : 'bg-coral/15 text-coral'
              }`}
            >
              {notifGranted === null ? '...' : notifGranted ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>

          {!notifGranted && notifGranted !== null && (
            <button
              onClick={async () => {
                await NowPlaying.openNotificationAccessSettings().catch(() => {});
              }}
              className="mt-3 w-full bg-amber text-ink font-body font-semibold rounded-md py-2.5 text-sm"
            >
              Buka Pengaturan Notifikasi
            </button>
          )}

          {/* Toggle: Scrobble dari app lain */}
          <div className="flex items-center justify-between gap-3 pt-3.5 mt-3.5 border-t border-white/5">
            <div className="pr-2">
              <p className="text-paper font-medium text-[15px]">Scrobble dari app lain</p>
              <p className="text-muted text-xs mt-0.5">
                Matikan untuk mencatat player internal saja
              </p>
            </div>
            <button
              onClick={handleToggleExternal}
              role="switch"
              aria-checked={externalOn}
              aria-label="Scrobble dari app lain"
              className="relative w-11 h-[26px] rounded-full shrink-0"
              style={{
                background: externalOn ? '#D6A756' : 'rgba(239,237,224,0.15)',
                transition: 'background 0.25s ease',
              }}
            >
              <span
                className="absolute top-[3px] w-5 h-5 rounded-full bg-ink"
                style={{
                  left: externalOn ? '21px' : '3px',
                  transition: 'left 0.25s cubic-bezier(0.22,1,0.36,1)',
                }}
              />
            </button>
          </div>

          {/* Baris deteksi live — meredup saat toggle mati */}
          {notifGranted && (
            <div
              className="mt-3.5 py-2.5 px-3 rounded-lg flex items-center gap-2.5"
              style={{
                background: 'rgba(16,23,17,0.6)',
                opacity: externalOn ? 1 : 0.35,
                transition: 'opacity 0.3s ease',
              }}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  externalNowPlaying ? 'bg-amber' : 'bg-muted/40'
                }`}
              />
              <p className="text-muted text-xs leading-relaxed min-w-0 truncate">
                {externalNowPlaying ? (
                  <>
                    Mendeteksi dari{' '}
                    <span className="text-paper">{sourceLabel(externalNowPlaying.packageName)}</span>{' '}
                    — {externalNowPlaying.artist}, {externalNowPlaying.title}
                  </>
                ) : (
                  'Belum ada app musik lain yang terdeteksi memutar.'
                )}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ===== Diagnosis Deteksi Musik ===== */}
      <section className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase mb-2">
          Diagnosis Deteksi Musik
        </p>
        <div className="bg-surface rounded-[10px] py-3.5 px-4">
          {listenerDiag === null ? (
            <p className="text-muted text-sm">Memeriksa…</p>
          ) : (
            <>
              {/* Tiga lapis, ditampilkan berurutan — lapis pertama yang gagal adalah akar
                  masalahnya, jadi pengguna tidak perlu menebak harus memperbaiki yang mana. */}
              <DiagRow ok={listenerDiag.granted} label="Izin akses notifikasi" />
              <DiagRow ok={listenerDiag.connected} label="Layanan pemantau hidup" />
              <DiagRow
                ok={listenerDiag.totalEvents > 0}
                label={`Kabar dari app musik (${listenerDiag.totalEvents}×)`}
              />

              {listenerDiag.lastEventPackage && (
                <p className="font-mono text-[11px] text-muted mt-2.5 truncate">
                  terakhir: {sourceLabel(listenerDiag.lastEventPackage)}
                  {listenerDiag.lastEventAtMs > 0 &&
                    ` · ${Math.round((Date.now() - listenerDiag.lastEventAtMs) / 1000)} detik lalu`}
                </p>
              )}

              {/* Saran perbaikan SPESIFIK untuk lapis pertama yang gagal */}
              {!listenerDiag.granted && (
                <p className="text-coral text-xs mt-3 leading-relaxed">
                  Aktifkan <span className="text-paper">Akses notifikasi</span> di atas.
                </p>
              )}

              {listenerDiag.granted && !listenerDiag.connected && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-coral text-xs leading-relaxed mb-2">
                    Izin tercentang tapi layanan tidak hidup. Dua penyebab tersering:
                  </p>
                  {listenerDiag.androidSdk >= 33 && (
                    <p className="text-muted text-xs leading-relaxed mb-2">
                      <span className="text-paper">1. Android {'>'}= 13 memblokir aplikasi
                      sideload.</span> Buka Setelan → Aplikasi → Scrola → menu 3 titik →{' '}
                      <span className="text-paper">Izinkan setelan yang dibatasi</span>, lalu
                      aktifkan ulang akses notifikasi.
                    </p>
                  )}
                  <p className="text-muted text-xs leading-relaxed">
                    <span className="text-paper">
                      2. {listenerDiag.manufacturer || 'Perangkat'} membatasi aplikasi latar.
                    </span>{' '}
                    Cari <span className="text-paper">"Aplikasi tak pernah tidur"</span> di setelan
                    sistem dan tambahkan Scrola ke daftarnya.
                  </p>
                </div>
              )}

              {listenerDiag.connected && listenerDiag.totalEvents === 0 && (
                <p className="text-muted text-xs mt-3 leading-relaxed">
                  Layanan hidup tapi belum ada aplikasi musik yang melapor. Coba putar lagu, lalu
                  buka layar ini lagi. Kalau tetap nol, aplikasi musiknya mungkin tidak melaporkan
                  MediaSession ke sistem.
                </p>
              )}

              <button
                onClick={refreshListenerDiag}
                className="mt-3 text-amber text-xs font-mono underline underline-offset-4"
              >
                periksa ulang
              </button>
            </>
          )}
        </div>
      </section>

      {/* ===== Antrean Scrobble — panel diagnosis ===== */}
      <section className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase mb-2">
          Antrean Scrobble
        </p>
        <div className="bg-surface rounded-[10px] py-3.5 px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="pr-2 min-w-0">
              <p className="text-paper font-medium text-[15px]">
                {queueStatus === null
                  ? 'Memeriksa…'
                  : queueStatus.pending === 0
                  ? 'Antrean kosong'
                  : `${queueStatus.pending} lagu menunggu dikirim`}
              </p>
              <p className="text-muted text-xs mt-0.5 leading-relaxed">
                {queueStatus === null
                  ? ''
                  : queueStatus.pending === 0
                  ? 'Semua lagu yang memenuhi syarat sudah terkirim ke Last.fm.'
                  : `Sudah dicoba ${queueStatus.maxAttempts}×. Lagu tetap tersimpan dan akan dikirim ulang.`}
              </p>
            </div>
            {queueStatus !== null && queueStatus.pending > 0 && (
              <button
                onClick={handleRetryQueue}
                disabled={retrying}
                className="shrink-0 bg-amber text-ink text-xs font-semibold rounded-md py-2 px-3 disabled:opacity-50"
              >
                {retrying ? '...' : 'Kirim'}
              </button>
            )}
          </div>

          {/* Pesan kegagalan terakhir — inilah yang membedakan "tidak pernah masuk antrean"
              dari "masuk tapi ditolak Last.fm", dan menunjukkan alasan penolakannya. */}
          {queueStatus?.lastError && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="font-mono text-[10px] tracking-[0.1em] text-coral uppercase mb-1">
                Kegagalan terakhir
              </p>
              <p className="text-muted text-xs font-mono break-words leading-relaxed">
                {queueStatus.lastError}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ===== Tentang ===== */}
      <section className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase mb-2">Tentang</p>
        <div className="bg-surface rounded-[10px] py-3.5 px-4 flex justify-between items-center">
          <div>
            <p className="text-paper text-sm">Scrola 0.1.0</p>
            <p className="text-muted text-xs mt-0.5">Every song leaves a story.</p>
          </div>
          <span className="font-mono text-[10px] text-muted">GPL-3.0</span>
        </div>
      </section>

      {/* ===== Diagnostik — hanya tampil kalau ada crash tercatat ===== */}
      {crashLog && (
        <section>
          <p className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase mb-2">
            Diagnostik
          </p>
          <div className="bg-surface rounded-[10px] py-3.5 px-4">
            <p className="text-paper text-sm">Laporan kendala terakhir</p>
            <p className="text-muted text-xs mt-0.5 mb-3">
              Scrola sempat mengalami kendala. Kamu bisa melihat detail teknisnya dan
              mengirimkannya untuk membantu perbaikan.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowCrashLog((v) => !v)}
                className="text-amber text-sm font-medium"
              >
                {showCrashLog ? 'Sembunyikan' : 'Lihat Detail'}
              </button>
              <button
                onClick={() => {
                  Diagnostics.clearLastCrashLog()
                    .then(() => {
                      setCrashLog(null);
                      setShowCrashLog(false);
                    })
                    .catch(() => {});
                }}
                className="text-coral text-sm font-medium"
              >
                Hapus
              </button>
            </div>
            {showCrashLog && (
              <pre className="text-muted/70 text-[10px] font-mono mt-3 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                {crashLog}
              </pre>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Satu baris diagnosis: centang hijau / silang koral + label.
 * Dipisah jadi komponen kecil supaya tiga lapis pemeriksaan tampil konsisten dan mudah ditambah.
 */
function DiagRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
          ok ? 'bg-amber text-ink' : 'bg-coral/20 text-coral'
        }`}
        aria-hidden="true"
      >
        {ok ? '✓' : '✕'}
      </span>
      <span className={`text-[13px] ${ok ? 'text-paper' : 'text-muted'}`}>{label}</span>
    </div>
  );
}
