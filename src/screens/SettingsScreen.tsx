import { useEffect, useState, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { NowPlaying, type NowPlayingState } from '../hooks/useNowPlaying';
import { clearSession } from '../lib/secureStore';
import { Diagnostics } from '../lib/diagnostics';
import { getExternalScrobbleEnabled, setExternalScrobbleEnabled } from '../lib/preferences';
import { getAccountStats, getQueueStatus } from '../lib/db/queries';
import { flushQueue } from '../lib/scrobbleEngine';
import { sourceLabel } from '../lib/sourceLabels';
import { buildBackupJson, restoreFromJson, type RestoreSummary } from '../lib/backupService';
import { SharePlugin } from '../lib/share';

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
  const [eventLog, setEventLog] = useState<string | null>(null);
  const [listenerDiag, setListenerDiag] = useState<{
    granted: boolean;
    connected: boolean;
    connectedAtMs: number;
    lastEventAtMs: number;
    lastEventPackage: string;
    totalEvents: number;
    activeSessions: number;
    detectedPackages?: string[];
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

  function refreshEventLog() {
    Diagnostics.readEventLog()
      .then((r) => setEventLog(r.log))
      .catch((e) => {
        console.warn('Gagal membaca log peristiwa:', e);
        setEventLog('(gagal membaca log)');
      });
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

  // ===== Cadangan data =====
  const [backupBusy, setBackupBusy] = useState<null | 'export' | 'import'>(null);
  const [backupMsg, setBackupMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  async function handleExportBackup() {
    if (backupBusy) return;
    setBackupBusy('export');
    setBackupMsg(null);
    try {
      const json = await buildBackupJson();
      const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      await SharePlugin.shareFile({
        content: json,
        filename: `scrola-backup-${stamp}.json`,
        mimeType: 'application/json',
        title: 'Simpan cadangan Scrola',
      });
      setBackupMsg({ kind: 'ok', text: 'Cadangan disiapkan. Simpan file-nya ke tempat yang aman (Drive, dll).' });
    } catch (e) {
      console.warn('Gagal membuat cadangan:', e);
      setBackupMsg({ kind: 'err', text: 'Gagal membuat cadangan. Coba lagi.' });
    } finally {
      setBackupBusy(null);
    }
  }

  function summaryText(s: RestoreSummary): string {
    const parts = [
      `${s.notesRestored} catatan dipulihkan`,
      `${s.favoritesRestored} favorit`,
      `${s.inserted} riwayat disisipkan`,
    ];
    if (s.conflicts > 0) parts.push(`${s.conflicts} catatan lokal dipertahankan (tak ditimpa)`);
    return parts.join(' · ');
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset supaya memilih file yang sama lagi tetap memicu onChange
    if (!file || backupBusy) return;
    setBackupBusy('import');
    setBackupMsg(null);
    try {
      const text = await file.text();
      const summary = await restoreFromJson(text);
      setBackupMsg({ kind: 'ok', text: `Pulih: ${summaryText(summary)}.` });
    } catch (err) {
      // parseBackup melempar pesan Indonesia yang deskriptif untuk file rusak/bukan-backup.
      const msg = err instanceof Error ? err.message : 'File tidak bisa dibaca.';
      setBackupMsg({ kind: 'err', text: msg });
    } finally {
      setBackupBusy(null);
    }
  }

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

              {listenerDiag.detectedPackages && listenerDiag.detectedPackages.length > 0 && (
                <div className="mt-3">
                  <p className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase mb-1.5">
                    Sumber terdeteksi ({listenerDiag.detectedPackages.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {listenerDiag.detectedPackages.map((pkg) => (
                      <span
                        key={pkg}
                        className="font-mono text-[11px] text-amber bg-amber/10 border border-amber/25 rounded-full px-2.5 py-1"
                      >
                        {sourceLabel(pkg)}
                      </span>
                    ))}
                  </div>
                </div>
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

      {/* ===== Log Peristiwa (diagnosis mendalam) ===== */}
      <section className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase mb-2">
          Log Peristiwa Scrobble
        </p>
        <div className="bg-surface rounded-[10px] py-3.5 px-4">
          <p className="text-muted text-xs mb-3 leading-relaxed">
            Jejak mentah apa yang terjadi saat lagu memenuhi syarat — untuk menemukan di titik mana
            pencatatan berhenti. Putar lagu sampai lewat separuh, lalu tekan muat.
          </p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={refreshEventLog}
              className="bg-amber text-ink text-xs font-semibold rounded-md py-2 px-3"
            >
              Muat log
            </button>
            <button
              onClick={() => {
                Diagnostics.clearEventLog().then(() => setEventLog(''));
              }}
              className="border border-white/10 text-muted text-xs rounded-md py-2 px-3"
            >
              Bersihkan
            </button>
          </div>
          {eventLog !== null && (
            <pre className="bg-ink rounded-lg p-3 text-[11px] text-muted font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
              {eventLog || '(kosong — belum ada peristiwa terekam)'}
            </pre>
          )}
        </div>
      </section>

      {/* ===== Cadangan Data ===== */}
      <section className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase mb-2">Cadangan Data</p>
        <div className="bg-surface rounded-[10px] py-4 px-4">
          <p className="text-paper text-sm mb-1">Simpan catatan &amp; favoritmu</p>
          <p className="text-muted text-xs mb-3.5 leading-relaxed">
            Catatan per-lagu hanya ada di HP ini. Update biasa tidak menghapusnya, tapi install ulang,
            ganti HP, atau &ldquo;Clear data&rdquo; bisa. Buat cadangan file (JSON) yang kamu pegang
            sendiri — tanpa cloud. Memulihkan bersifat aman: tidak pernah menimpa catatan yang sudah ada.
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={handleExportBackup}
              disabled={backupBusy !== null}
              className="flex-1 border border-amber/40 text-amber font-body font-semibold text-sm rounded-lg py-3 active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {backupBusy === 'export' ? 'Menyiapkan…' : 'Buat cadangan'}
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              disabled={backupBusy !== null}
              className="flex-1 border border-white/15 text-paper font-body font-semibold text-sm rounded-lg py-3 active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {backupBusy === 'import' ? 'Memulihkan…' : 'Pulihkan dari file'}
            </button>
          </div>
          {/* input file tersembunyi — dibaca langsung di WebView (FileReader), tanpa plugin native. */}
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
          {backupMsg && (
            <p
              className={`text-xs mt-3 leading-relaxed ${backupMsg.kind === 'ok' ? 'text-amber' : 'text-red-300'}`}
              role="status"
            >
              {backupMsg.text}
            </p>
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
