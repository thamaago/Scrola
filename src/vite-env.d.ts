/// <reference types="vite/client" />

// Menambahkan variabel env kustom milik Scrola lewat declaration merging dengan ImportMetaEnv
// bawaan Vite. Properti bawaan (DEV, PROD, MODE, dll) dicantumkan eksplisit di sini juga supaya
// tidak bergantung pada asumsi soal urutan/cakupan merging antar-module — lebih aman gamblang
// daripada mengandalkan perilaku yang halus.
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly VITE_LASTFM_API_KEY: string;
  readonly VITE_LASTFM_API_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
