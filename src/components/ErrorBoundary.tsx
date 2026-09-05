import { Component, type ReactNode } from 'react';

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
          <p className="font-display text-2xl text-paper mb-2">Ada yang tidak beres</p>
          <p className="text-muted text-sm max-w-xs mb-6">
            Scrola mengalami kendala tak terduga. Coba muat ulang — datamu (riwayat &amp; sesi
            login) aman tersimpan.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-amber text-ink font-body font-semibold rounded-lg py-3 px-6"
          >
            Muat Ulang
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
