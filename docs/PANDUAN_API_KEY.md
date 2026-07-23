# Panduan Memasang API Key Last.fm

Panduan ini untuk kamu yang mau **membangun (build) Scrola sendiri dari kode sumber**.

## ⚠️ Baca ini dulu — mungkin kamu tidak butuh panduan ini sama sekali

**Kalau kamu cuma mau MEMAKAI Scrola** (mengunduh file APK dari halaman Releases), kamu **TIDAK
perlu API key**. Cukup pasang aplikasinya, buka, tekan "Hubungkan ke Last.fm", dan login seperti
biasa. Selesai. Panduan ini tidak berlaku untukmu.

Panduan ini **hanya** untuk kamu yang mengunduh kode sumbernya dan mau membangun aplikasinya
sendiri di komputer.

---

## Apa itu API key, sesederhana mungkin

Bayangkan Last.fm adalah sebuah gedung.

- **API key** = kartu nama aplikasimu. Isinya cuma: "Halo, saya aplikasi bernama Scrola." Kartu
  ini **tidak** membuka pintu akun siapa pun.
- **Login-mu nanti** = kamu sendiri yang masuk pakai akunmu, di halaman resmi Last.fm.

Jadi API key itu identitas *aplikasinya*, bukan identitas *kamu*. Keduanya berbeda dan tidak
saling menggantikan.

---

## Langkah 1 — Ambil API key (5 menit, gratis)

1. Buka browser, pergi ke: **https://www.last.fm/api/account/create**
2. Login pakai akun Last.fm-mu (kalau belum punya, daftar dulu — gratis).
3. Isi formulirnya. Hanya 2 kolom yang wajib:

   | Kolom | Isi apa |
   |---|---|
   | **Application name** | `Scrola` (atau nama bebas, misal `Scrola - Budi`) |
   | **Application description** | `Scrobbler pribadi` (bebas, satu kalimat saja) |
   Kolom **Callback URL** dan *Homepage* **KOSONGKAN**.

   > Kenapa Callback URL dikosongkan? Last.fm sendiri menyatakan di formulirnya: *"This field
   > isn't used for desktop or mobile authentication."* Kolom itu khusus aplikasi WEB, dan hanya
   > menerima alamat `http://`/`https://` (skema `scrola://` akan ditolak dengan "Enter a valid
   > URL"). Scrola memakai alur otorisasi mobile: setelah kamu menekan "Allow" di Last.fm, cukup
   > TUTUP tab browser — Scrola menyelesaikan otorisasinya sendiri.

4. Tekan tombol kirim/submit.
5. Muncul halaman berisi dua baris penting:

   ```
   API key:     b53a1f2c8d9e4a7b6c5d4e3f2a1b0c9d
   Shared secret: 7f6e5d4c3b2a1908f7e6d5c4b3a29180
   ```

   > Itu contoh saja — punyamu akan berbeda. **Biarkan halaman ini terbuka**, kita butuh
   > kedua nilai itu di langkah berikutnya.

---

## Langkah 2 — Masukkan ke proyek

Di dalam folder Scrola yang sudah kamu unduh, ada file bernama **`.env.example`**.

1. **Salin (copy) file itu**, lalu **ganti nama salinannya** menjadi **`.env.local`**

   Cara lewat terminal (kalau kamu terbiasa):
   ```bash
   cp .env.example .env.local
   ```

   Cara manual (kalau tidak terbiasa terminal): klik kanan file `.env.example` → Copy → Paste →
   ubah nama file hasil paste menjadi `.env.local` (titik di depan itu penting, jangan dihapus).

2. **Buka file `.env.local`** pakai aplikasi teks apa pun (Notepad, TextEdit, VS Code — bebas).

3. Isinya seperti ini:

   ```
   VITE_LASTFM_API_KEY=isi_api_key_anda_di_sini
   VITE_LASTFM_API_SECRET=isi_api_secret_anda_di_sini
   ```

4. **Ganti** tulisan `isi_api_key_anda_di_sini` dengan **API key** dari Langkah 1, dan
   `isi_api_secret_anda_di_sini` dengan **Shared secret**-nya.

   Hasil akhirnya kira-kira begini:

   ```
   VITE_LASTFM_API_KEY=b53a1f2c8d9e4a7b6c5d4e3f2a1b0c9d
   VITE_LASTFM_API_SECRET=7f6e5d4c3b2a1908f7e6d5c4b3a29180
   ```

   **Perhatikan:**
   - Jangan pakai tanda kutip (`"` atau `'`).
   - Jangan ada spasi sebelum atau sesudah tanda `=`.
   - Jangan hapus tulisan `VITE_LASTFM_API_KEY=` di depannya.

5. **Simpan** file-nya. Selesai.

---

## Langkah 3 — Build

Jalankan seperti biasa (lihat README bagian Build Android):

```bash
npm install
npm run build
npx cap sync android
```

Kalau berhasil, API key-mu otomatis tertanam di aplikasi. Kamu **tidak perlu memasukkannya lagi**
di dalam app — begitu app dibuka, tinggal tekan "Hubungkan ke Last.fm" dan login.

---

## Kalau gagal — 3 masalah paling umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| Tekan "Hubungkan" → muncul error / halaman Last.fm bilang "Invalid API key" | API key salah ketik, atau file masih bernama `.env.example` | Cek ulang: file harus bernama **`.env.local`** (bukan `.env.example`, bukan `env.local`) |
| Sudah login tapi lagu tidak tercatat | Shared secret salah (tanda tangan request ditolak) | Salin ulang **Shared secret**, pastikan tidak ada spasi tersisa |
| File `.env.local` tidak kelihatan di folder | File berawalan titik disembunyikan sistem | Mac: tekan `Cmd + Shift + .` di Finder. Windows: View → centang "Hidden items" |

---

## Aturan penting

- **Jangan pernah membagikan Shared secret-mu** ke siapa pun, dan jangan meng-upload-nya ke
  GitHub. File `.env.local` sudah otomatis diabaikan Git (lihat `.gitignore`), jadi selama kamu
  menaruhnya di sana, ia aman.
- Kalau kamu tidak sengaja membocorkannya, buat API key baru di halaman yang sama — yang lama
  cukup ditinggalkan.

---

## Untuk pemilik repo: memasang API key di GitHub Actions

Kalau kamu ingin build otomatis di GitHub (CI) juga berhasil, API key perlu dipasang sebagai
**Secret** — bukan di-commit ke kode.

1. Buka repo di GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Tekan **New repository secret**, buat dua secret ini:

   | Name | Secret |
   |---|---|
   | `LASTFM_API_KEY` | API key dari Langkah 1 |
   | `LASTFM_API_SECRET` | Shared secret dari Langkah 1 |

3. Selesai. Workflow `build.yml` dan `release.yml` akan otomatis memakainya.

Tanpa dua secret ini, build di GitHub akan gagal di tahap "Build web assets".
