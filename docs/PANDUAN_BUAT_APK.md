# Cara Membuat APK Scrola — Panduan Pemula

Panduan ini untuk kamu yang **belum pernah ngoding** dan cuma ingin punya file APK Scrola untuk
dipasang di HP.

**Kabar baiknya: kamu TIDAK perlu menginstal apa pun di komputer.** Tidak perlu Android Studio,
tidak perlu Node.js. GitHub yang akan membangun APK-nya untukmu, gratis, di cloud.

Yang kamu butuhkan cuma:
- Akun **GitHub** (gratis)
- Akun **Last.fm** (gratis)
- Browser

Total waktu: sekitar **20 menit**, sebagian besar cuma menunggu.

---

# Bagian 1 — Ambil API Key Last.fm (5 menit)

API key itu seperti **kartu nama aplikasi**. Isinya cuma "halo, saya aplikasi Scrola". Ia tidak
membuka akun siapa pun. Nanti kamu tetap login pakai akun Last.fm-mu sendiri di dalam app.

### Langkah-langkahnya

1. Buka **https://www.last.fm/api/account/create**
2. Login dengan akun Last.fm-mu (kalau belum punya, daftar dulu — gratis).
3. Isi formulir. **Hanya 2 kolom yang wajib:**

   | Kolom | Isi |
   |---|---|
   | Application name | `Scrola` |
   | Application description | `Scrobbler pribadi` |
   Kolom *Callback URL* dan *Homepage* **kosongkan saja**.

   > Callback URL memang tidak dipakai untuk aplikasi mobile (Last.fm menyatakannya sendiri di
   > formulir), dan skema `scrola://` akan ditolak. Setelah menekan "Allow" nanti, cukup tutup
   > tab browser — Scrola menyelesaikan sisanya.

4. Tekan tombol kirim.
5. Muncul halaman berisi dua baris. Ini yang kita butuhkan:

   ```
   API key:        b53a1f2c8d9e4a7b6c5d4e3f2a1b0c9d
   Shared secret:  7f6e5d4c3b2a1908f7e6d5c4b3a29180
   ```

   > ⚠️ **Jangan tutup halaman ini.** Kita butuh kedua nilai itu di Bagian 3.
   > Kalau terlanjur tertutup, kamu bisa melihatnya lagi di https://www.last.fm/api/accounts

---

# Bagian 2 — Naikkan kode Scrola ke GitHub (5 menit)

1. Buka **https://github.com/new**
2. Isi:
   - **Repository name**: `scrola`
   - Pilih **Private** (kalau belum mau dilihat publik) atau **Public**
   - **Jangan** centang "Add a README file"
3. Tekan **Create repository**.
4. Di halaman berikutnya, cari tulisan **"uploading an existing file"** (link kecil di tengah
   halaman) → klik.
5. **Buka file ZIP Scrola di komputermu, ekstrak**, lalu **seret (drag) semua isinya** ke area
   upload di browser.

   > 💡 Kalau file terlalu banyak dan browser lambat, itu normal — tunggu saja sampai daftar
   > file muncul semua.

6. Di kotak bawah, tulis pesan bebas (misal: `versi pertama`), lalu tekan **Commit changes**.

Sekarang kodenya sudah ada di GitHub.

---

# Bagian 3 — Masukkan API Key ke GitHub (3 menit)

Kita **tidak** menaruh API key di dalam kode (nanti bisa dilihat orang). GitHub punya tempat
khusus yang aman namanya **Secrets**.

1. Di halaman repo-mu, klik tab **⚙️ Settings** (paling kanan atas).
2. Di menu kiri, klik **Secrets and variables** → **Actions**.
3. Klik tombol hijau **New repository secret**.
4. Buat secret **pertama**:
   - **Name**: `LASTFM_API_KEY`
   - **Secret**: tempel **API key** dari Bagian 1
   - Klik **Add secret**
5. Klik **New repository secret** lagi. Buat secret **kedua**:
   - **Name**: `LASTFM_API_SECRET`
   - **Secret**: tempel **Shared secret** dari Bagian 1
   - Klik **Add secret**

Hasil akhirnya, kamu punya **dua** secret:

```
LASTFM_API_KEY        Updated now
LASTFM_API_SECRET     Updated now
```

> ⚠️ Nama harus **persis** seperti di atas (huruf besar semua, pakai garis bawah). Salah satu
> huruf saja, build akan gagal.

---

# Bagian 4 — Bangun APK-nya (10 menit, sebagian besar menunggu)

1. Di repo-mu, klik tab **Actions** (di atas).
2. Kalau muncul tombol hijau **"I understand my workflows, go ahead and enable them"** → klik.
3. Di menu kiri, klik **Build Android Debug APK**.
4. Di kanan, klik tombol **Run workflow** → lalu tombol hijau **Run workflow** lagi.
5. **Tunggu.** Akan muncul baris baru dengan lingkaran kuning berputar 🟡. Butuh sekitar
   **5–10 menit** (build pertama paling lama).
6. Kalau selesai dan berubah jadi **centang hijau ✅** → berhasil!

### Ambil APK-nya

1. Klik baris build yang sudah hijau tadi.
2. Scroll ke bawah, ada bagian **Artifacts**.
3. Klik **scrola-debug-apk** → file ZIP terunduh.
4. **Ekstrak ZIP itu** → di dalamnya ada file `app-debug.apk`.
5. **Kirim file APK itu ke HP-mu** (lewat WhatsApp ke diri sendiri, Google Drive, atau kabel USB).

---

# Bagian 5 — Pasang di HP (2 menit)

1. Buka file `app-debug.apk` di HP.
2. Android akan bilang *"Demi keamanan, HP tidak boleh memasang aplikasi tidak dikenal"* →
   tekan **Setelan** → aktifkan **Izinkan dari sumber ini**.
3. Tekan **Pasang**.
4. Buka Scrola → tekan **Hubungkan ke Last.fm** → login dengan akunmu → **Izinkan**.
5. Masuk tab **Atur** → aktifkan **Akses notifikasi** (supaya Scrola bisa membaca Spotify, YT
   Music, dll).

Selesai. Putar lagu, dan tiket ceritamu akan mulai tercetak. 🎫

---

# Kalau Gagal — masalah paling umum

### ❌ Build merah, tulisannya "GitHub Secrets ... belum diisi"
Secret belum dibuat atau namanya salah ketik. Ulangi **Bagian 3**. Nama harus persis
`LASTFM_API_KEY` dan `LASTFM_API_SECRET`.

### ❌ Build merah di langkah "Build debug APK"
Biasanya build pertama memang rewel. Coba **Run workflow** sekali lagi — seringkali langsung
berhasil di percobaan kedua (karena cache sudah terisi).

Kalau masih gagal: klik langkah yang merah, salin pesan errornya, lalu buat **Issue** di repo
(tab Issues → New issue) supaya bisa dibantu.

### ❌ Sudah pasang APK, tapi tombol "Hubungkan" tidak ada, malah muncul peringatan merah
Artinya API key tidak terbaca saat build. Cek lagi **Bagian 3** — kemungkinan besar secret-nya
kosong atau salah nama. Perbaiki, lalu **Run workflow** ulang dan pasang APK yang baru.

### ❌ Lagu dari Spotify tidak tercatat
Buka tab **Atur** di Scrola → pastikan **Akses notifikasi** berstatus **Aktif**, dan toggle
**Scrobble dari app lain** menyala.

---

# Catatan penting

- **APK ini versi "debug"** — aman dipakai sendiri, tapi belum ditandatangani untuk Play Store.
  Cukup untuk memakai sendiri dan membagikannya ke teman.
- **Jangan bagikan Shared secret-mu** ke siapa pun.
- Kalau kamu mengubah kode nanti, cukup **Run workflow** lagi untuk membuat APK baru.
- Scrola ini masih **versi awal (0.1.0)** dan belum diuji luas di banyak HP. Kalau menemukan bug,
  laporkan lewat tab **Issues** — itu justru sangat membantu.
