import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // base './' WAJIB untuk Capacitor. Tanpa ini, Vite menulis path aset absolut (/assets/...) di
  // index.html. Di WebView Android, halaman dimuat dari file:///android_asset/public/, sehingga
  // path absolut /assets/... menunjuk ke ROOT filesystem perangkat (yang kosong) — JS & CSS tidak
  // pernah termuat, dan app tampak "tidak terbuka" (layar putih/hitam kosong). base relatif './'
  // membuat path jadi ./assets/... yang benar relatif terhadap index.html.
  base: './',
  plugins: [react()],
  server: { port: 5173 },
});
