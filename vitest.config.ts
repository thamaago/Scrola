import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Fungsi murni di scrobbleLogic.ts tidak butuh DOM, jadi environment node cukup & lebih cepat.
    // Kalau nanti ada test komponen React, buat file terpisah dengan environment jsdom.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
