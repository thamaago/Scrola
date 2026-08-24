import { useEffect, useRef, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { getToken, getAuthUrl, getSession, isApiKeyMissing, LastfmApiError } from '../lib/lastfm';
import { saveSession } from '../lib/secureStore';
import { useI18n } from '../lib/i18nContext';
import type { ErrDescriptor } from '../lib/appError';

export default function LoginScreen({ onAuthed }: { onAuthed: (username: string) => void }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<'idle' | 'waiting' | 'error'>('idle');
  // Simpan error sebagai deskriptor {key, params}, BUKAN teks jadi — diterjemahkan saat render
  // supaya ganti bahasa saat pesan tampil pun ikut berubah.
  const [errDesc, setErrDesc] = useState<ErrDescriptor | null>(null);
  // Nilai konstan sepanjang umur app (di-inject saat build) — cukup dihitung sekali.
  const apiKeyMissing = isApiKeyMissing();
  // Animasi keluar: tiket hero "terbang" saat auth sukses, BARU onAuthed dipanggil setelah
  // animasinya selesai (~620ms) supaya transisi ke app tidak memotong gerakan di tengah.
  const [exiting, setExiting] = useState(false);
  const pendingTokenRef = useRef<string | null>(null);
  const exchangedRef = useRef(false);
  const browserFinishedHandleRef = useRef<{ remove: () => void } | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Last.fm akan redirect balik ke scrola://auth-callback setelah user authorize.
  //
  // CATATAN KEAMANAN: scrola:// adalah custom URL scheme, BUKAN Android App Link terverifikasi
  // (verified https:// deep link). Ini berarti aplikasi LAIN yang terpasang di perangkat yang
  // sama secara teknis bisa mengirim Intent palsu ke scrola://auth-callback?token=NILAI_APAPUN
  // untuk mencoba menyuntikkan token miliknya sendiri. Karena itu kita SENGAJA TIDAK memakai
  // nilai token dari query string URL sama sekali — event deep link ini hanya dipakai sebagai
  // SINYAL "user sudah kembali dari browser", sementara token yang benar-benar ditukar ke
  // Last.fm selalu token yang KITA minta sendiri lewat auth.getToken() (pendingTokenRef).
  // Skenario terburuk kalau ada Intent palsu: exchangeToken jalan lebih awal dengan token yang
  // belum diotorisasi user -> auth.getSession gagal -> pesan error "coba lagi", tidak ada
  // pengambilalihan sesi.
  useEffect(() => {
    const listener = CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith('scrola://auth-callback')) return;
      await Browser.close().catch(() => {});
      const token = pendingTokenRef.current;
      if (!token) {
        setStatus('error');
        setErrDesc({ key: 'login.error.noSession' });
        return;
      }
      await exchangeToken(token);
    });
    return () => {
      listener.then((h) => h.remove());
    };
  }, []);

  async function exchangeToken(token: string) {
    if (exchangedRef.current) return;
    exchangedRef.current = true;
    try {
      const session = await getSession(token);
      await saveSession(session.name, session.key);
      // Mainkan animasi tiket keluar dulu, baru serahkan kontrol ke App. 620ms sedikit di atas
      // durasi transisi 0.6s supaya gerakan selesai penuh sebelum unmount.
      setExiting(true);
      exitTimerRef.current = setTimeout(() => onAuthed(session.name), 620);
    } catch (e) {
      exchangedRef.current = false; // izinkan coba lagi
      setStatus('error');
      // Tampilkan pesan SPESIFIK per kode error Last.fm. Sebelumnya semua kegagalan diringkas
      // jadi satu pesan generik "belum sempat mengizinkan", padahal penyebabnya bisa sangat
      // berbeda (secret salah vs token belum diotorisasi) dan solusinya pun berbeda. Tanpa
      // membedakannya, pengguna (dan developer) hanya bisa menebak.
      if (e instanceof LastfmApiError) {
        switch (e.code) {
          case 13: // Invalid method signature
            setErrDesc({ key: 'login.error.sig' });
            break;
          case 10: // Invalid API key
            setErrDesc({ key: 'login.error.apiKey' });
            break;
          case 14: // Token not authorized
            setErrDesc({ key: 'login.error.notAuthorized' });
            break;
          case 4:
          case 15: // Invalid / expired token
            setErrDesc({ key: 'login.error.expired' });
            break;
          default:
            setErrDesc({ key: 'login.error.rejected', params: { code: e.code, message: e.message } });
        }
      } else {
        // Sebab teknis (jaringan/JSON) dicatat ke console; ke pengguna cukup pesan bersih terlokalkan.
        console.warn('Gagal menyelesaikan otorisasi:', e);
        setErrDesc({ key: 'login.error.contactFail' });
      }
    }
  }

  async function handleConnect() {
    try {
      exchangedRef.current = false;
      setStatus('waiting');
      const token = await getToken();
      pendingTokenRef.current = token;
      await Browser.open({ url: getAuthUrl(token) });

      // Lepas listener browserFinished dari percobaan sebelumnya (kalau ada) sebelum daftar
      // yang baru — sebelumnya setiap tekan "Hubungkan" menambah listener baru tanpa melepas
      // yang lama, jadi listener bisa menumpuk kalau user mencoba beberapa kali.
      browserFinishedHandleRef.current?.remove();
      browserFinishedHandleRef.current = await Browser.addListener('browserFinished', async () => {
        browserFinishedHandleRef.current?.remove();
        browserFinishedHandleRef.current = null;
        await exchangeToken(token);
      });
    } catch (e) {
      setStatus('error');
      // Jangan berasumsi ini selalu masalah internet — penyebab lain (API key ditolak, balasan
      // bukan JSON, blokir jaringan) tampak sama kalau pesannya digeneralisasi, dan pengguna
      // akan sia-sia memeriksa koneksinya. Tampilkan sebab aslinya.
      if (e instanceof LastfmApiError) {
        setErrDesc({ key: 'login.error.rejected', params: { code: e.code, message: e.message } });
      } else {
        console.warn('Gagal menghubungi Last.fm:', e);
        setErrDesc({ key: 'login.error.network' });
      }
    }
  }

  useEffect(() => {
    return () => {
      browserFinishedHandleRef.current?.remove();
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-center px-7">
      {/* Tiket brand — hero berbentuk tiket ADMIT ONE, miring 1.5°. Elemen signature pertama
          yang dilihat pengguna: bahasa visual tiket diperkenalkan sejak layar pertama. */}
      <div
        className="flex rounded-r-[14px] overflow-hidden border border-amber/30 bg-surface mb-9"
        style={{
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          transform: exiting ? 'translateX(80px) rotate(5deg)' : 'rotate(-1.5deg)',
          opacity: exiting ? 0 : 1,
          transition: 'transform 0.6s cubic-bezier(0.5,0,0.75,0), opacity 0.6s ease',
        }}
      >
        <div className="ticket-perforation-lg shrink-0" aria-hidden="true" />
        <div className="flex-1 pt-[26px] px-6 pb-[26px]">
          <div className="flex justify-between items-baseline">
            <p className="font-mono text-[10px] tracking-[0.3em] text-amber uppercase">Scrola</p>
            <p className="font-mono text-[10px] text-muted">{t('login.ticketNo')}</p>
          </div>
          <h1 className="font-display text-[32px] leading-[1.2] font-semibold text-paper mt-3.5">
            Every song
            <br />
            leaves a story.
          </h1>
          <div className="border-t border-dashed border-paper/15 mt-5 pt-3.5">
            <p className="font-mono text-[10px] tracking-[0.1em] text-muted">
              {t('login.tagline')}
            </p>
          </div>
        </div>
      </div>

      <p className="text-muted text-sm leading-relaxed mb-7">
        {t('login.intro')}
      </p>

      {/* Kalau app di-build TANPA API key (kesalahan paling umum saat build sendiri dari source),
          jangan biarkan user menekan tombol lalu bingung dengan error samar "Invalid API key"
          dari Last.fm — beri tahu persis apa yang kurang dan ke mana harus melihat. */}
      {apiKeyMissing ? (
        <div className="border border-coral/40 bg-coral/5 rounded-lg p-4">
          <p className="text-coral text-sm font-medium mb-1.5">{t('login.apiKeyMissing.title')}</p>
          <p className="text-muted text-xs leading-relaxed">
            {t('login.apiKeyMissing.body')}
          </p>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={status === 'waiting' || exiting}
          className="bg-amber text-ink font-body font-semibold text-base rounded-lg py-4 px-6
                     active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {status === 'waiting' ? t('login.waiting') : t('login.connect')}
        </button>
      )}

      {status === 'error' && errDesc && (
        <p className="text-coral text-sm mt-3 text-center">{t(errDesc.key, errDesc.params)}</p>
      )}

      <p className="text-muted text-xs mt-5 text-center leading-relaxed">
        {status === 'waiting' ? t('login.hint.waiting') : t('login.hint.idle')}
      </p>
    </div>
  );
}
