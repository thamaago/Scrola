# Catatan Rilis Scrola

Berkas ini memuat **catatan rilis (release notes)** siap-tempel untuk halaman
[GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github). Tiap versi
punya satu bagian; salin bagian yang relevan ke deskripsi rilis saat membuat tag di GitHub.

> **Bedanya dengan `CHANGELOG.md`:** CHANGELOG adalah catatan teknis ringkas & lengkap untuk
> pengembang (semua perubahan, termasuk internal). RELEASES ini adalah versi **ramah-pengguna**:
> menyoroti apa yang penting bagi orang yang memakai app, dengan bahasa yang lebih hangat dan
> fokus pada manfaat — bukan detail implementasi.

**Alur membuat rilis** (lihat juga `CONTRIBUTING.md` bagian CHANGELOG):
1. Pastikan `[Unreleased]` di CHANGELOG sudah final untuk versi ini.
2. Naikkan versi di `package.json` sesuai [Semantic Versioning](https://semver.org).
3. Salin bagian versi terkait dari berkas ini ke deskripsi rilis GitHub.
4. Buat tag: `git tag v0.1.0 && git push origin v0.1.0`.
5. Lampirkan APK hasil build CI ke rilis (sebagai aset unduhan).

---

## ⭐ Kenapa Scrola? (kelebihan aplikasi)

Sebelum daftar versi, inilah yang membuat Scrola berbeda — dan kenapa kamu mungkin memilihnya
dibanding scrobbler atau music player lain:

**🎫 Riwayat dengar yang terasa seperti koleksi, bukan daftar.**
Tiap lagu yang kamu dengar jadi "tiket cerita" — kartu bergaya struk dengan tepi perforasi. Bukan
sekadar baris teks di tabel. Scrola dibangun di sekitar satu ide: *setiap lagu meninggalkan cerita.*

**🎧 Scrobble dari mana saja, termasuk Spotify & YouTube Music.**
Scrola mendeteksi musik yang sedang diputar dari aplikasi lain di HP-mu dan mencatatnya ke Last.fm
— bahkan dari app yang tidak punya scrobbling bawaan. Punya player internal sendiri juga, untuk
file lokal.

**💿 Player dengan sentuhan taktil.**
Album art berputar seperti piringan hitam saat lagu berjalan, berhenti saat dijeda. Kecil, tapi
membuat memutar musik terasa personal.

**✏️ Perbaiki tag MP3 langsung di app.**
Bisa mengedit metadata (judul, artist, album, sampul) file MP3 lokal — fitur yang bahkan tidak
dimiliki banyak music player besar.

**🪶 Ringan, tanpa iklan, tanpa telemetri.**
Tidak ada pelacakan, tidak ada iklan, tidak ada layanan tertutup. Data dengarmu milikmu. Session
Last.fm disimpan terenkripsi di perangkat, tidak pernah dikirim ke mana pun selain Last.fm resmi.

**🔓 Open source (GPL-3.0).**
Kode terbuka untuk diperiksa siapa saja. Kamu bisa memverifikasi sendiri klaim privasi di atas.

**🎨 Dirancang, bukan dirakit.**
Palet hangat (plum-ink, amber, coral), tipografi berkarakter, dan identitas visual yang konsisten
di setiap layar. Scrola ingin jadi scrobbler yang *indah* — celah yang belum diisi pesaing.

> Jujur soal posisi: Scrola **bukan** pengganti music player serba bisa seperti Poweramp (tidak ada
> equalizer, playlist rumit, atau format Hi-Res), dan belum sekaya fitur Pano Scrobbler yang sudah
> matang bertahun-tahun. Scrola memilih fokus: scrobbler yang ringan, indah, dan bisa dipercaya.

---

## v0.1.0 — "Debut" (pra-rilis / release candidate)

> ⚠️ **Status: PRA-RILIS.** Versi ini adalah kandidat rilis pertama. Semua fitur di bawah sudah
> dibangun dan melewati lima gelombang audit kode, **tetapi belum divalidasi di perangkat fisik**
> dan belum di-build lewat CI sampai tuntas. Perlakukan sebagai versi eksperimental. Bug besar
> masih mungkin muncul. Lihat `CONTRIBUTING.md` bagian "Definisi Selesai".

Rilis fungsional pertama Scrola: scrobbler Last.fm lengkap dengan player internal, deteksi musik
dari aplikasi lain, antrean offline, riwayat, dan editor metadata MP3.

### ✨ Fitur utama
- **Login Last.fm** yang aman — otorisasi lewat situs resmi Last.fm, session key disimpan
  terenkripsi (AES-256-GCM via Android Keystore), kata sandi tidak pernah disimpan.
- **Scrobbling universal** — mencatat lagu dari player internal Scrola *dan* dari aplikasi lain
  (Spotify, YouTube Music, dll) via deteksi MediaSession.
- **Player internal** dengan album art berputar bergaya vinyl, kontrol putar/jeda/±10 detik.
- **Antrean offline** — scrobble yang gagal terkirim (mis. tidak ada internet) disimpan dan
  dikirim ulang otomatis saat koneksi kembali.
- **Riwayat scrobble** bergaya "tiket cerita", lengkap dengan status loved.
- **Editor metadata MP3** — ubah judul, artist, album, album artist, tahun, genre, dan sampul
  album file MP3 lokal.
- **Ikon adaptif & splash screen** dengan identitas visual Scrola.

### 🔒 Keamanan & privasi
- Tanpa telemetri, tanpa iklan, tanpa layanan tertutup.
- Cleartext traffic dimatikan; tidak mempercayai CA yang dipasang pengguna.
- Izin diminta sesempit mungkin (Storage Access Framework, bukan izin storage lebar).
- Token dari deep link tidak pernah dipercaya langsung (perlindungan dari app jahat di perangkat
  yang sama).
- Crash dicatat lokal saja (`last_crash.txt`), tidak dikirim ke mana pun.

### 🧪 Kualitas
- Logic inti (aturan eligibility scrobble, parsing respons Last.fm, signature) punya unit test.
- Lima gelombang audit kode (masing-masing 5 putaran) telah dilakukan — puluhan bug & celah
  keamanan diperbaiki sebelum rilis. Detail di `CHANGELOG.md`.

### ⚠️ Keterbatasan yang diketahui
- **Belum diuji di perangkat fisik** — ini keterbatasan terbesar saat ini.
- Editor metadata **hanya untuk file MP3 lokal** — lagu dari Spotify/streaming tidak bisa diedit
  (itu audio streaming, bukan file milik Scrola).
- Status "loved" di riwayat masih **read-only** (belum bisa di-toggle) — direncanakan untuk versi
  berikutnya.
- Player internal fokus pada 1 track terpilih; **belum ada playlist/antrean putar**.
- Tipe foreground service (`mediaPlayback`) masih perlu ditinjau sebelum submit ke Play Store.

### 📋 Persyaratan
- Android 6.0 (API 23) atau lebih baru.
- Akun Last.fm.
- Izin "Akses notifikasi" untuk mendeteksi musik dari aplikasi lain.

### 📥 Pemasangan
Unduh berkas `.apk` dari bagian **Assets** di bawah, lalu pasang di HP Android (aktifkan "Instal
dari sumber tidak dikenal" bila diminta). Setelah dibuka, hubungkan akun Last.fm dan beri izin
akses notifikasi lewat halaman Pengaturan di dalam app.

---

## Roadmap ringkas (versi yang dirancang ke depan)

Rencana ini bisa berubah. Nomor versi mengikuti Semantic Versioning. Diperkaya dari hasil review
multi-agen (Jul 2026) — setiap ide diurutkan berdasarkan reuse infrastruktur yang SUDAH ada.

### v0.2.0 — "Cerita yang bisa disunting" ✅ SELESAI (menunggu validasi device/CI)
Fokus: melengkapi interaksi riwayat, memakai infrastruktur yang sudah ada.
- ✅ **Toggle loved/unloved** langsung dari tiket riwayat (optimistic + rollback, guard anti
  double-tap).
- ✅ **Edit & hapus scrobble** dari riwayat lewat sheet aksi — UI jujur menyatakan bahwa ini
  hanya menyentuh riwayat lokal (API publik Last.fm tidak mendukung hapus/edit scrobble).
- ✅ **Tipe foreground service** diperbaiki ke `dataSync` (dari `mediaPlayback` yang tidak jujur
  secara fungsi) — aman untuk review Play Store Android 14+.
- ✅ **Ikon launcher & splash di-regenerasi** ke palet Hutan Malam.

> Semua item di atas sudah diimplementasikan & lolos audit 5 putaran, **tapi belum divalidasi di
> perangkat/CI**. Baru boleh ditandai rilis setelah build hijau + uji di HP fisik.

### v0.3.0 — "Perjalanan dengarmu" (rencana)
Fokus: memperdalam Sisi B & data milik pengguna.
- ✅ **Bagikan Sisi B sebagai gambar tiket** — SELESAI (`renderSisiBZine` + tombol share; belum
  divalidasi device).
- ✅ **Statistik periode lain** (bulanan "Bab", tahunan "Album") — SELESAI (`BabAlbumScreen`).
- **Ekspor CSV/JSON** riwayat dari SQLite — ✅ **JSON SELESAI** (lewat fitur Cadangan Data:
  `backupService` + `shareFile`); **CSV masih terbuka** (kolom `albumArtist` sudah ter-SELECT).
- ✅ **Kurasi "Penemuan"** — SELESAI (`PenemuanScreen` + `discoveryLogic`; belum divalidasi device).

**Sisa v0.3.0:** ekspor CSV (opsional). Sebelum menandai v0.3.0 tuntas: **validasi device** semua
di atas (lihat `docs/VALIDASI_DEVICE.md`).

### v0.4.0 — "Panggung yang lebih luas" (ide, perlu validasi minat pengguna)
- **Scrobble manual** (cari & catat lagu yang didengar offline/di radio) — `scrobbleBatch`
  sudah menerima timestamp arbitrer.
- **Widget home-screen** "sedang ditulis" (tiket mini) — nilai pembeda visual tinggi, tapi
  butuh kerja native (RemoteViews) yang tidak kecil; validasi dulu lewat issue tracker.
- **Dukungan ListenBrainz** sebagai tujuan kedua — arsitektur pipeline memungkinkan (antrean
  agnostik tujuan), tapi menambah bobot; keputusan produk, bukan sekadar teknis.

### v1.0.0 — "Rilis publik" (rencana)
Fokus: stabil, teruji di banyak perangkat, siap Play Store.
- Sudah divalidasi di berbagai perangkat fisik & versi Android.
- Semua keterbatasan besar v0.1.0 teratasi.
- Siap dipublikasikan ke Play Store dan/atau F-Droid.

---

## Template catatan rilis (salin untuk versi baru)

```markdown
## vX.Y.Z — "Nama Rilis" (tanggal)

Ringkasan satu-dua kalimat tentang fokus rilis ini.

### ✨ Fitur baru
- ...

### 🔧 Perbaikan
- ...

### 🔒 Keamanan
- ...

### ⚠️ Keterbatasan yang diketahui
- ...

### 📥 Pemasangan
Unduh `.apk` dari Assets di bawah. Butuh Android 6.0+.

**Changelog lengkap:** lihat CHANGELOG.md atau bandingkan tag di GitHub.
```
