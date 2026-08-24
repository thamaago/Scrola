import React from 'react';
import ReactDOM from 'react-dom/client';
import { SplashScreen } from '@capacitor/splash-screen';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { I18nProvider } from './lib/i18nContext';
import './styles/index.css';
import { initDb } from './lib/db/db';

initDb()
  .catch((e) => console.error('Gagal inisialisasi database:', e))
  .finally(() => {
    const rootEl = document.getElementById('root');
    if (!rootEl) {
      // Seharusnya tidak pernah terjadi (index.html selalu punya #root), tapi kalau iya,
      // pesan ini jauh lebih informatif daripada crash samar dari non-null assertion (!).
      console.error('Elemen #root tidak ditemukan — app tidak bisa di-mount.');
      return;
    }
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <ErrorBoundary>
          <I18nProvider>
            <App />
          </I18nProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
    // Sembunyikan splash setelah app benar-benar siap dirender, bukan berdasar timer tetap —
    // supaya tidak ada jeda layar kosong kalau initDb kebetulan lambat, dan tidak menahan
    // splash lebih lama dari perlu kalau initDb cepat.
    SplashScreen.hide().catch(() => {});
  });
