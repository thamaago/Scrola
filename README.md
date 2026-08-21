# Scrola — Every Song Leaves a Story

![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)
![Platform: Android](https://img.shields.io/badge/Platform-Android%206.0%2B-green.svg)
![Status: Pre-release](https://img.shields.io/badge/Status-0.1.0%20pre--release-orange.svg)
[![Build Status](https://github.com/thamaago/Scrola/actions/workflows/build.yml/badge.svg)](https://github.com/thamaago/Scrola/actions/workflows/build.yml)

Scrobbler Last.fm untuk Android — **open source, ringan, tanpa iklan, tanpa telemetri**. Punya
player musik internal + deteksi now-playing dari aplikasi lain (Spotify, YouTube Music, dll),
antrean scrobble offline, riwayat bergaya "tiket cerita", dan editor metadata MP3.

> 🚀 **Baru pertama kali & cuma ingin punya APK-nya?**
> Baca [`docs/PANDUAN_BUAT_APK.md`](./docs/PANDUAN_BUAT_APK.md) — panduan dari nol sampai APK
> terpasang di HP, **tanpa perlu menginstal apa pun** di komputer (GitHub yang membangunnya).

## Daftar isi

- [Fitur utama](#fitur-utama)
- [Dikembangkan dengan Claude Code](#dikembangkan-dengan-claude-code)
- [Lisensi & open source](#lisensi--open-source)
- [Status proyek](#status-proyek)
- [Setup API key Last.fm](#setup-api-key-lastfm)
- [Menjalankan lokal (web preview)](#menjalankan-lokal-web-preview)
- [Build Android — panduan lengkap](#build-android--panduan-lengkap)
- [Catatan arsitektur & konfigurasi](#catatan-arsitektur--konfigurasi)
- [Branding & ikon app](#branding--ikon-app)
- [Rentang Android & jejak memori](#rentang-android--jejak-memori)
- [Fitur edit metadata MP3](#fitur-edit-metadata-mp3)
- [Dokumentasi lengkap](#dokumentasi-lengkap)

## Fitur utama

| Fitur | Implementasi utama |
|---|---|
| Client API Last.fm (auth, sign, scrobble) | `src/lib/lastfm.ts` |
| Penyimpanan session key terenkripsi (Keystore) | `native-overlay/.../SecureStorePlugin.kt` + `src/lib/secureStore.ts` |
| Deteksi now-playing app lain (MediaSession) | `native-overlay/.../ScrolaNotificationListener.kt` + `NowPlayingPlugin.kt` |
| Player musik internal (ExoPlayer/Media3) | `PlaybackService.kt` + `PlayerPlugin.kt` + `src/lib/player.ts` + `src/hooks/usePlayer.ts` |
| Engine antrean scrobble offline-first (SQLite) | `src/lib/scrobbleEngine.ts` + `src/lib/db/` |
| Foreground service notifikasi Now Playing | `ScrobbleForegroundService.kt` + `ScrolaApplication.kt` |
| Login otomatis via deep link | `src/screens/LoginScreen.tsx` |
| Editor metadata MP3 (tag ID3) | `Mp3MetadataPlugin.kt` + `src/hooks/useMp3Editor.ts` |
| UI (Now Playing, Riwayat, Settings, Sisi B, dll) + komponen StoryTicket | `src/screens/*`, `src/components/StoryTicket.tsx` |
| CI build APK (dengan guard & cache) | `.github/workflows/build.yml` |

Player internal dan deteksi eksternal berbagi **satu pipeline scrobble yang sama** — lihat
[Catatan arsitektur](#catatan-arsitektur--konfigurasi).

## Dikembangkan dengan Claude Code

Repositori ini disusun mengikuti metode [everything-claude-code](https://github.com/WorldFlowAI/everything-claude-code):
konfigurasi Claude Code (rules, commands, agents) yang menegakkan proses pengembangan Scrola secara
otomatis. Kalau kamu memakai Claude Code:

- **[`CLAUDE.md`](./CLAUDE.md)** (root) — konteks utama proyek: arsitektur, batasan lingkungan, aturan tak-boleh-dilanggar.
- **`.claude/rules/`** — panduan yang selalu ditegakkan: keamanan, review 5 putaran, prinsip ringan, kejujuran status.
- **`.claude/commands/`** — slash command: `/audit` (review 5 putaran), `/sanity-check`, `/feature` (alur fitur baru), `/release`.
- **`.claude/agents/`** — subagen: `feature-architect`, `native-android-specialist`, `ui-craftsman`, `code-reviewer`, `security-reviewer`, `test-engineer`, `scribe`.

Struktur ini membuat proses yang selama pengembangan dijalankan manual (ritual audit 5 putaran,
prinsip ringan, kejujuran soal validasi) jadi bagian tetap yang otomatis dirujuk Claude Code pada
sesi-sesi berikutnya.

## Lisensi & open source

Scrola berlisensi **GNU GPL-3.0** — lihat [`LICENSE`](./LICENSE). Artinya siapa pun bebas memakai,
mempelajari, memodifikasi, dan mendistribusikan ulang, dengan syarat turunannya tetap open source
di bawah lisensi yang sama (copyleft). Pilihan ini disengaja: pesaing terdekat (Pano Scrobbler)
juga GPL, dan copyleft mencegah kode Scrola dipakai membuat versi tertutup yang bersaing.

> **Kalau kamu lebih memilih adopsi maksimal** dan tidak keberatan kode dipakai di produk tertutup,
> ganti isi `LICENSE` dengan teks MIT dan sesuaikan badge di atas. Keputusan lisensi ada di
> tanganmu sebagai pemilik proyek — GPL-3.0 hanya default yang direkomendasikan untuk posisi ini.

Scrola sengaja **tanpa telemetri, tanpa iklan, tanpa layanan tertutup** — sejalan dengan nilai
yang dicari komunitas scrobbler open source. Prinsip ini bukan sekadar teknis, tapi bagian dari
positioning: alternatif yang indah, ringan, dan bisa dipercaya. Lihat
[`docs/POSITIONING.md`](./docs/POSITIONING.md).

## Status proyek

Ini adalah **scaffold fase 1–2** (scope + arsitektur + skeleton awal) dari metodologi 5 fase:
scope → arsitektur → build bertahap → feedback loop → hardening. Semua file dirancang agar bisa
di-build, tapi beberapa bagian masih placeholder yang ditandai `TODO`.

> **Catatan kejujuran status:** kode belum pernah dikompilasi/diuji di perangkat fisik. Sampai
> versi `0.1.0` berhasil ter-build di CI dan dijalankan di HP nyata, semua fitur berstatus **belum
> tervalidasi di device** — log GitHub Actions dan uji perangkat adalah satu-satunya sumber
> kebenaran. Lihat [`CONTRIBUTING.md`](./CONTRIBUTING.md) bagian "Definisi Selesai".

Riwayat perubahan teknis lengkap (termasuk semua putaran audit review) ada di
[`CHANGELOG.md`](./CHANGELOG.md).

## Setup API key Last.fm

1. **Daftar API key Last.fm**: buka https://www.last.fm/api/account/create, isi nama app
   "Scrola", dapatkan `API key` dan `Shared secret`. Panduan langkah-demi-langkah untuk orang awam
   ada di [`docs/PANDUAN_API_KEY.md`](./docs/PANDUAN_API_KEY.md).
2. Buat file `.env.local` di root project (sudah di-`.gitignore`, jangan commit):
   ```
   VITE_LASTFM_API_KEY=isi_di_sini
   VITE_LASTFM_API_SECRET=isi_di_sini
   ```
3. Untuk build via CI, tambahkan sebagai **Repository secret** di GitHub
   (`Settings → Secrets and variables → Actions → New repository secret`):
   - `LASTFM_API_KEY`
   - `LASTFM_API_SECRET`

## Menjalankan lokal (web preview)

Tanpa fitur native, hanya untuk pratinjau UI di browser:

```bash
npm install
npm run dev
```

## Build Android — panduan lengkap

Repo ini **tidak menyertakan folder `android/` yang sudah jadi** — itu disengaja. Capacitor
menolak generate project baru kalau foldernya sudah ada, jadi file custom disimpan terpisah di
`native-overlay/` dan digabungkan lewat script setelah `cap add android` jalan.

**Langkah ini dilakukan SEKALI di komputermu, lalu hasilnya (folder `android/`) di-commit ke
git — CI di GitHub tidak menjalankan ulang langkah generate ini, CI hanya build APK dari yang
sudah di-commit.**

```bash
npm install
npx cap add android              # generate project Gradle bersih dari template Capacitor
npm run native:overlay           # gabungkan file custom dari native-overlay/ ke android/
```

> **Penting:** `npm install` di atas akan menghasilkan `package-lock.json` — **pastikan file ini
> ikut ter-commit** (jangan pernah masuk `.gitignore`). CI memakai `npm ci` yang mensyaratkan
> lockfile ini; kalau lupa commit, workflow otomatis fallback ke `npm install` biasa (tetap jalan,
> hanya kurang reproducible).

Lalu tambahkan dependency Media3 (ExoPlayer + MediaSession) — belum bisa diotomatisasi lewat
script karena format `build.gradle` bervariasi antar versi Capacitor. Buka
`android/app/build.gradle`, cari blok `dependencies { ... }`, tambahkan:

```groovy
implementation "androidx.media3:media3-exoplayer:1.4.1"
implementation "androidx.media3:media3-session:1.4.1"
implementation "com.mpatric:mp3agic:0.9.1"
```

> **Catatan soal `mp3agic`** (dipakai `Mp3MetadataPlugin.kt` untuk baca/tulis tag ID3): Android
> tidak punya API bawaan untuk MENULIS tag ID3 (`MediaMetadataRetriever` cuma bisa baca), jadi
> dipakai library eksternal ringan pure-Java ini. Kode plugin ditulis berdasarkan bentuk API
> mp3agic 0.9.1 dan belum diverifikasi lewat kompilasi. Kalau `gradle build` gagal spesifik di
> `Mp3MetadataPlugin.kt` dengan error "unresolved reference" pada method seperti `albumArtist` atau
> `genreDescription`, cek Javadoc `com.mpatric.mp3agic.ID3v24Tag` untuk nama method yang tepat.

Terakhir, sinkronkan aset web + commit:

```bash
npm run build
npx cap sync android
git add android/ native-overlay/
git commit -m "Setup Android platform + native overlay Scrola"
git push
```

Push ini memicu `.github/workflows/build.yml` yang otomatis:

1. Cek folder `android/` benar-benar ter-commit (kalau lupa, CI gagal dengan pesan jelas, bukan error Gradle yang membingungkan).
2. `npm ci` → `npm run build` (inject `LASTFM_API_KEY`/`LASTFM_API_SECRET` dari GitHub Secrets).
3. `npx cap sync android` (menyalin aset web terbaru + plugin ke `android/`).
4. `./gradlew assembleDebug`.
5. Upload hasil APK sebagai artifact — unduh dari tab **Actions** pada run yang sukses, bagian **Artifacts**.

Checklist langkah manual di GitHub UI (secrets, branch protection, rilis pertama) ada di
[`docs/GITHUB_SETUP.md`](./docs/GITHUB_SETUP.md).

## Catatan arsitektur & konfigurasi

### Kenapa player internal dibungkus MediaSessionService

`PlaybackService.kt` bukan sekadar wrapper ExoPlayer biasa — ia adalah `MediaSessionService`
(Media3). Ini pilihan desain yang disengaja: `ScrolaNotificationListener` membaca now-playing lewat
`MediaSessionManager.getActiveSessions()`, yang mencakup **semua** sesi media aktif di sistem begitu
izin Notification Access diberikan — termasuk sesi milik Scrola sendiri.

Konsekuensinya: lagu yang diputar dari player internal otomatis mengalir lewat **pipeline scrobble
yang sama persis** dengan lagu dari Spotify/YouTube Music. Tidak ada kode scrobble terpisah untuk
"sumber sendiri". `usePlayer.ts` hanya mengurus kontrol UI (pilih file, play/pause/seek) — logika
scrobble tetap 100% di `useNowPlayingListener`.

Pemilihan file memakai Storage Access Framework (`ACTION_OPEN_DOCUMENT`), jadi **tidak perlu**
permission `READ_MEDIA_AUDIO` — user memilih file secara eksplisit lewat picker sistem.

### Setup tambahan SQLite (`@capacitor-community/sqlite`)

1. `npx cap sync android` — menarik kode native plugin ke folder `android/`.
2. Jika minifikasi/ProGuard diaktifkan untuk build release nanti, tambahkan rule berikut di
   `android/app/proguard-rules.pro` (belum perlu untuk build debug via CI saat ini):
   ```
   -keep class com.getcapacitor.community.database.sqlite.** { *; }
   -keep class net.sqlcipher.** { *; }
   ```
3. Skema database ada di `src/lib/db/schema.ts` — tambah migrasi baru dengan menaikkan `version`
   dan menulis statement SQL baru; **jangan pernah mengubah migrasi versi lama yang sudah dirilis**.

### Setup tambahan login otomatis (deep link)

Supaya `scrola://auth-callback` benar-benar diterima balik dari Last.fm setelah user authorize:

1. Buka halaman app kamu di https://www.last.fm/api/account/ (setelah `auth.getToken` didaftarkan).
2. Isi field **Callback URL** dengan: `scrola://auth-callback`.
3. Tanpa ini, Last.fm tidak redirect balik ke app — user tertahan di browser (fallback
   `browserFinished` di kode tetap mencoba menukar token begitu tab ditutup, tapi pengalamannya
   kurang mulus).

## Branding & ikon app

Ikon app dan splash screen dibuat mengikuti identitas visual Scrola (motif "tiket cerita",
palet Hutan Malam), dibuat terprogram (Python/Pillow) supaya konsisten dan mudah di-regenerate
kalau brand berubah.

**Sudah termasuk di `native-overlay/`:**

- Adaptive icon lengkap (foreground + background + monochrome untuk themed icon Android 13+) di
  semua densitas (`mipmap-mdpi` s.d. `mipmap-xxxhdpi`), plus `mipmap-anydpi-v26/ic_launcher.xml`.
- Fallback ikon legacy (flattened + versi bulat) untuk API < 26 yang tidak mendukung adaptive icon.
- Splash screen (`res/drawable/splash.png`) + konfigurasi `@capacitor/splash-screen` di
  `capacitor.config.ts` (mencegah kedipan putih sebelum splash muncul di sebagian perangkat).

**Perlu diverifikasi setelah `npx cap add android`:** Capacitor menaruh referensi splash screen di
`res/drawable/splash.xml` (layer-list) atau langsung `res/drawable/splash.png` tergantung versi
template. Setelah `npm run native:overlay`, buka `android/app/src/main/res/drawable/` — kalau ada
`splash.xml` yang mereferensikan bitmap dengan nama lain, sesuaikan ke `splash.png`.

Regenerasi aset kalau brand berubah:

```bash
python3 branding/generate_icons.py
python3 branding/generate_splash.py
```

Keduanya menulis langsung ke `native-overlay/android/app/src/main/res/` (siap di-merge lewat
`npm run native:overlay`) dan ke `branding/preview/` untuk pratinjau cepat.

## Rentang Android & jejak memori

### Rentang Android yang didukung

**`minSdkVersion` diset ke 23 (Android 6.0, 2015)**, dinaikkan otomatis oleh `npm run native:overlay`
dari default Capacitor (22). `SecureStorePlugin` memakai `KeyGenParameterSpec` (Android Keystore)
untuk mengenkripsi session key, dan kelas ini **baru tersedia sejak API 23**. Kalau minSdk dibiarkan
di 22, app akan crash saat login di perangkat Android 5.1 ke bawah.

`targetSdkVersion` mengikuti default Capacitor (35, Android 15) untuk syarat terbaru Play Store.
Fitur yang butuh API tinggi (notification channel API 26+, POST_NOTIFICATIONS API 33+, foreground
service type API 29+/34+) semuanya dibungkus pengecekan `Build.VERSION.SDK_INT`, jadi tetap aman
dijalankan di perangkat API 23 sampai API 35+.

### Optimasi hemat RAM

- **Buffer ExoPlayer diperkecil** (`DefaultLoadControl` custom di `PlaybackService.kt`) — karena
  player memutar file lokal, bukan streaming adaptif dari jaringan.
- **`PlaybackService` auto-stop** 10 detik setelah track selesai tanpa track baru; **`ScrobbleForegroundService`
  juga auto-stop** saat tidak ada sesi media aktif.
- **Query database selalu dibatasi** (`getHistory(limit=100)`, `getQueueBatch(50)`) — tidak pernah
  memuat seluruh tabel ke memori sekaligus.
- **Tidak ada native library besar / bitmap besar** — ikon notifikasi berupa vector drawable.
- **`android:largeHeap="false"`** — sengaja tidak diaktifkan.

### Batasan yang jujur perlu diketahui

Scrola dibangun di atas Capacitor yang menjalankan UI dalam WebView (Chromium) — ini **inheren
memakai RAM lebih besar dibanding app native murni**, sama seperti aplikasi Capacitor/React
Native/Flutter pada umumnya. Optimasi di atas mengurangi jejak memori di bagian yang bisa
dikontrol, tapi tidak menghilangkan baseline overhead WebView.

Untuk build **release** (bukan debug yang dipakai CI sekarang), aktifkan code/resource shrinking di
`android/app/build.gradle`:

```groovy
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

## Fitur edit metadata MP3

Bisa mengubah tag ID3 (judul, artist, album, album artist, tahun, genre, sampul album) pada file
MP3 lokal — diakses lewat tombol pensil (✎) di sebelah judul lagu yang sedang diputar di tab
"Sekarang", atau tautan "atau edit metadata MP3" saat belum ada lagu diputar.

**Cara kerja teknis:** karena file dipilih lewat Storage Access Framework, alurnya: salin ke file
sementara di cache app → baca/tulis tag pakai mp3agic → salin hasilnya balik ke file asli lewat
`ContentResolver.openOutputStream` → hapus file sementara. File asli di penyimpanan device
benar-benar berubah, bukan cuma salinan di dalam app.

**Batasan yang jujur perlu diketahui:**

- Butuh izin **tulis** ke file — beberapa provider penyimpanan (folder sync cloud tertentu, atau
  storage terenkripsi khusus vendor) bisa menolak permintaan write meski sudah lewat picker sistem.
- Kalau tag ID3 yang ada sebelumnya bukan versi 2.4 (mis. masih ID3v2.3 lama), menyimpan akan
  menuliskannya ulang sebagai ID3v2.4 — field di luar 6 yang ada di form mungkin tidak ikut terbawa.
  Ini simplifikasi yang disengaja untuk menjaga kode tetap sederhana.

## Dokumentasi lengkap

Indeks seluruh dokumen ada di [`docs/README.md`](./docs/README.md). Yang paling sering dibutuhkan:

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — alur kerja & proses wajib tiap perubahan besar (ritual review 5 putaran, "Definisi Selesai").
- [`CHANGELOG.md`](./CHANGELOG.md) — riwayat perubahan teknis terstruktur.
- [`docs/PANDUAN_BUAT_APK.md`](./docs/PANDUAN_BUAT_APK.md) — dari nol sampai APK di HP, tanpa instal apa pun.
- [`docs/PANDUAN_API_KEY.md`](./docs/PANDUAN_API_KEY.md) — memasang API key Last.fm untuk orang awam.
- [`docs/RELEASES.md`](./docs/RELEASES.md) — catatan rilis + roadmap + kelebihan aplikasi.
- [`docs/POSITIONING.md`](./docs/POSITIONING.md) — positioning pasar & perbandingan jujur vs Pano Scrobbler.
- [`docs/DESIGN.md`](./docs/DESIGN.md) — arah desain sebagai pembeda kompetitif.
- [`SECURITY.md`](./SECURITY.md) — cara melaporkan kerentanan keamanan.
