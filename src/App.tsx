import { useCallback, useEffect, useRef, useState } from 'react';
import { logValidationChecklist } from './lib/validationChecklist';
import { useI18n } from './lib/i18nContext';
import LoginScreen from './screens/LoginScreen';
import NowPlayingScreen from './screens/NowPlayingScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import SisiBScreen from './screens/SisiBScreen';
import TiketKoleksiScreen from './screens/TiketKoleksiScreen';
import BabAlbumScreen from './screens/BabAlbumScreen';
import PenemuanScreen from './screens/PenemuanScreen';
import { loadSession } from './lib/secureStore';
import { useNowPlayingListener, drainAndFlushNative } from './hooks/useNowPlaying';
import { App as CapApp } from '@capacitor/app';
import { useScrobbleHistory } from './hooks/useScrobbleHistory';
import { flushQueue } from './lib/scrobbleEngine';

const TABS = [
  ['now', 'nav.now'],
  ['history', 'nav.history'],
  ['settings', 'nav.settings'],
] as const;

type Tab = (typeof TABS)[number][0];

export default function App() {
  const { t: tr } = useI18n();
  const [username, setUsername] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState<Tab>('now');
  const [sisiBOpen, setSisiBOpen] = useState(false);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [babAlbumOpen, setBabAlbumOpen] = useState(false);
  const [penemuanOpen, setPenemuanOpen] = useState(false);
  // id entri riwayat yang BARU tercatat — untuk border amber + animasi masuk di HistoryScreen.
  const [freshScrobbleId, setFreshScrobbleId] = useState<number | null>(null);
  const prevTopIdRef = useRef<number | null>(null);

  const current = useNowPlayingListener();
  const { items: historyItems, reload: reloadHistory, toggleLoved, deleteEntry, updateEntry } = useScrobbleHistory();

  useEffect(() => {
    loadSession()
      .then((s) => {
        setUsername(s?.username ?? null);
      })
      .catch((e) => {
        // Kalau plugin native gagal (mis. error Keystore, atau preview web tanpa native),
        // JANGAN biarkan app terjebak selamanya di layar blank — anggap saja belum login.
        console.warn('Gagal memuat session tersimpan, arahkan ke layar login:', e);
        setUsername(null);
      })
      .finally(() => {
        setCheckingSession(false);
      });
    logValidationChecklist();
  }, []);

  // Sinkronisasi scrobble: serap yang ditangkap NATIVE di latar (Opsi 2), kirim sisa antrean,
  // lalu muat ulang riwayat. Native menangkap lagu walau app tertutup; JS mengirimnya saat aktif.
  const syncingRef = useRef(false);
  const syncScrobbles = useCallback(async () => {
    // Cegah tumpang-tindih dengan diri sendiri. syncScrobbles dipicu dari beberapa tempat (buka app,
    // kembali foreground, timer 20 dtk) yang bisa berdekatan. Tanpa guard ini, sync #2 bisa memanggil
    // flushQueue SELAGI drain #1 masih meng-enqueue → flush menyela di tengah drain → batch terpecah
    // (mis. "KIRIM 2" lalu "KIRIM 3") dan track dikirim ulang. drain+flush harus satu unit atomik.
    // (drainAll native sendiri sudah atomik, jadi ini murni soal menjaga batch tetap utuh.)
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      await drainAndFlushNative();
      await flushQueue();
      await reloadHistory();
    } catch (e) {
      console.warn('Sinkronisasi scrobble gagal:', e);
    } finally {
      syncingRef.current = false;
    }
  }, [reloadHistory]);

  // Saat app dibuka / session siap.
  useEffect(() => {
    if (username) void syncScrobbles();
  }, [username, syncScrobbles]);

  // Saat app kembali ke foreground + interval berkala selagi aktif — supaya scrobble yang
  // terkumpul di latar cepat terkirim, dan yang terjadi saat app terbuka pun tak menunggu lama.
  useEffect(() => {
    if (!username) return;
    let handle: { remove: () => void } | undefined;
    void CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void syncScrobbles();
    }).then((h) => {
      handle = h;
    });
    const id = setInterval(() => void syncScrobbles(), 20000);
    return () => {
      handle?.remove();
      clearInterval(id);
    };
  }, [username, syncScrobbles]);

  // Deteksi entri riwayat baru: kalau id teratas berubah setelah reload, tandai sebagai "fresh"
  // sebentar (untuk border amber + animasi fadeSlideIn), lalu lepas tandanya.
  useEffect(() => {
    const topId = historyItems[0]?.id ?? null;
    if (topId !== null && prevTopIdRef.current !== null && topId !== prevTopIdRef.current) {
      setFreshScrobbleId(topId);
      const t = setTimeout(() => setFreshScrobbleId(null), 2500);
      prevTopIdRef.current = topId;
      return () => clearTimeout(t);
    }
    prevTopIdRef.current = topId;
  }, [historyItems]);

  // Dipanggil NowPlayingScreen tepat saat ambang scrobble tercapai — muat ulang riwayat setelah
  // jeda singkat supaya entri baru (yang ditulis pipeline scrobble secara async) ikut terbaca.
  const handleScrobbled = useCallback(() => {
    const t = setTimeout(() => reloadHistory(), 1200);
    // Timer sekali jalan; tidak perlu disimpan — kalaupun komponen unmount, reloadHistory aman
    // dipanggil (hanya baca DB + setState di hook yang sudah punya guard .catch).
    void t;
  }, [reloadHistory]);

  if (checkingSession) {
    return <div className="min-h-screen bg-ink" />;
  }

  if (!username) {
    return <LoginScreen onAuthed={setUsername} />;
  }

  const activeIdx = TABS.findIndex(([t]) => t === tab);

  return (
    <div className="bg-ink min-h-screen relative overflow-hidden">
      {/* Ketiga screen selalu ter-render, menumpuk absolut, dengan transisi slide + fade.
          Arah slide mengikuti posisi tab: layar di kiri tab aktif keluar ke -40px, di kanan
          ke +40px — memberi rasa arah spasial. pointer-events dimatikan pada layar nonaktif.

          Catatan performa (dari handoff): kalau render 3 screen sekaligus ternyata berat di
          WebView device nyata, fallback-nya render aktif + yang sedang keluar saja. Mulai dari
          bentuk paling sederhana dulu; optimasi menunggu bukti dari pengujian device. */}
      {TABS.map(([t], idx) => {
        const isActive = t === tab;
        const offset = idx < activeIdx ? -40 : idx > activeIdx ? 40 : 0;
        return (
          <div
            key={t}
            className="absolute inset-0 overflow-y-auto"
            style={{
              opacity: isActive ? 1 : 0,
              transform: `translateX(${isActive ? 0 : offset}px)`,
              transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1)',
              pointerEvents: isActive ? 'auto' : 'none',
            }}
            aria-hidden={!isActive}
          >
            {t === 'now' && <NowPlayingScreen onScrobbled={handleScrobbled} current={current} />}
            {t === 'history' && (
              <HistoryScreen
                items={historyItems}
                freshId={freshScrobbleId}
                onOpenSisiB={() => setSisiBOpen(true)}
                onOpenTickets={() => setTicketsOpen(true)}
                onToggleLoved={(entry) => void toggleLoved(entry)}
                onDeleteEntry={(entry) => void deleteEntry(entry)}
                onUpdateEntry={(entry, fields) => void updateEntry(entry, fields)}
                onNoteSaved={() => void reloadHistory()}
              />
            )}
            {t === 'settings' && (
              <SettingsScreen
                username={username}
                current={current}
                onLoggedOut={() => setUsername(null)}
              />
            )}
          </div>
        );
      })}

      {/* Overlay Sisi B — slide-up di atas segalanya termasuk nav */}
      <SisiBScreen
        open={sisiBOpen}
        onClose={() => setSisiBOpen(false)}
        onOpenBabAlbum={() => setBabAlbumOpen(true)}
        onOpenPenemuan={() => setPenemuanOpen(true)}
      />

      {/* Overlay Bab (bulan) & Album (tahun) */}
      <BabAlbumScreen open={babAlbumOpen} onClose={() => setBabAlbumOpen(false)} />

      {/* Overlay Penemuan — linimasa artis yang ditemukan */}
      <PenemuanScreen open={penemuanOpen} onClose={() => setPenemuanOpen(false)} />

      {/* Overlay Koleksi Tiket */}
      <TiketKoleksiScreen open={ticketsOpen} onClose={() => setTicketsOpen(false)} />

      <nav className="fixed bottom-0 inset-x-0 bg-surface border-t border-white/5 flex z-10">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-3.5 text-sm font-body"
            style={{ color: tab === t ? '#D6A756' : '#8FA394', transition: 'color 0.25s ease' }}
          >
            {tr(label)}
          </button>
        ))}
        {/* Indikator garis atas — meluncur mengikuti tab aktif */}
        <div
          className="absolute top-0 h-0.5 bg-amber"
          style={{
            width: '33.333%',
            left: `${activeIdx * 33.333}%`,
            transition: 'left 0.35s cubic-bezier(0.22,1,0.36,1)',
          }}
          aria-hidden="true"
        />
      </nav>
    </div>
  );
}
