# Rule: Keamanan

Selalu ditegakkan pada setiap perubahan kode Scrola.

- **Tidak ada rahasia ter-hardcode.** API key/secret hanya lewat `import.meta.env` (JS) atau
  GitHub Secrets (CI). Jangan pernah menaruh nilai asli di kode, komentar, atau contoh. `.env.local`
  wajib tetap di `.gitignore`.
- **Session key selalu terenkripsi** via Android Keystore (AES-256-GCM) — tidak pernah plaintext,
  tidak pernah di SharedPreferences tanpa enkripsi, tidak pernah dikirim ke server selain Last.fm.
- **Izin sesempit mungkin.** Storage Access Framework untuk file, bukan izin storage lebar. Jangan
  menambah permission di manifest tanpa alasan yang ditulis jelas.
- **Jangan percaya input eksternal.** Token dari deep link hanya sinyal, bukan sumber kebenaran.
  Data dari file/URI pengguna divalidasi (ukuran, tipe) sebelum diproses.
- **`OutOfMemoryError` bukan `Exception`.** Untuk operasi yang memuat file/gambar besar ke memori,
  validasi ukuran DULU — `catch (Exception)` tidak akan menangkap OOM.
- **Tanpa telemetri pihak ketiga.** Crash dicatat lokal saja. Jangan menambah SDK analytics/crash
  reporting jarak jauh tanpa keputusan produk eksplisit.
- Sebelum menjadikan repo publik atau membuat rilis: jalankan audit rahasia (grep secret, cek
  `.gitignore`, pastikan tidak ada kredensial di history).
