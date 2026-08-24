import { Component, type ReactNode } from 'react';
import { tActive } from '../lib/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * ErrorBoundary
 *
 * Menangkap error render React yang tidak tertangani. Tanpa ini, satu error di komponen mana pun
 * membuat SELURUH UI jadi layar kosong (putih/gelap) tanpa petunjuk apa pun — user tidak tahu
 * apakah app hang, crash, atau memang begitu. Dengan boundary ini, minimal ada pesan yang bisa
 * dibaca + tombol untuk memuat ulang, alih-alih kebuntuan total.
 *
 * CATATAN: ini hanya menangkap error saat RENDER (lifecycle React). Error di dalam event handler
 * async (mis. Promise yang reject di onClick) TIDAK tertangkap di sini — itu sudah ditangani
 * masing-masing lewat try/catch di hook & fungsi terkait.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Log ke console supaya terlihat di `adb logcat` / remote debugging saat pengembangan.
    // Belum ada crash reporting jarak jauh (Sentry dsb) — itu keputusan sadar untuk sekarang,
    // demi menjaga app tetap ringan & tanpa telemetri pihak ketiga. Kalau nanti perlu, di sinilah
    // tempat mengirim laporan.
    console.error('ErrorBoundary menangkap error render:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-8 text-center">
          {/* Komponen class di ATAS I18nProvider → tak bisa pakai context. Cermin locale modul
              (tActive) tetap mencerminkan bahasa aktif, jadi layar crash pun ikut bahasa. */}
          <p className="font-display text-2xl text-paper mb-2">{tActive('err.boundary.title')}</p>
          <p className="text-muted text-sm max-w-xs mb-6">
            {tActive('err.boundary.body')}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-amber text-ink font-body font-semibold rounded-lg py-3 px-6"
          >
            {tActive('err.boundary.reload')}
          </button>
          {import.meta.env.DEV && (
            <p className="text-muted/50 text-[10px] font-mono mt-6 max-w-xs break-words">
              {this.state.message}
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
