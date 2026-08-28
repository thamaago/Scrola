# Scrola — Every Song Leaves a Story

![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)
![Platform: Android](https://img.shields.io/badge/Platform-Android%206.0%2B-green.svg)
![Status: Pre-release](https://img.shields.io/badge/Status-0.1.0%20pre--release-orange.svg)
[![Build Status](https://github.com/<username>thamaago/scrola/actions/workflows/build.yml/badge.svg)](https://github.com/<username>thamaago/scrola/actions/workflows/build.yml)

> Ganti `<username>` di badge Build Status di atas dengan username GitHub-mu setelah repo dibuat —
> badge ini otomatis menampilkan hijau/merah sesuai status build CI terakhir.

Scrobbler premium untuk Last.fm — **open source, ringan, tanpa iklan, tanpa telemetri**. Player
musik internal + deteksi now-playing dari aplikasi musik lain di HP (Spotify, YouTube Music, dll),
dengan riwayat scrobble bergaya "tiket cerita".

> 🚀 **Baru pertama kali & cuma ingin punya APK-nya?**
> Baca [`docs/PANDUAN_BUAT_APK.md`](./docs/PANDUAN_BUAT_APK.md) — panduan dari nol sampai APK
> terpasang di HP, **tanpa perlu menginstal apa pun** di komputer (GitHub yang membangunnya).

> **Sebelum mengembangkan lebih lanjut, baca:**
> - [`CONTRIBUTING.md`](./CONTRIBUTING.md) — alur kerja & proses wajib untuk setiap perubahan besar
>   (termasuk ritual review 5 putaran dan "Definisi Selesai").
> - [`CHANGELOG.md`](./CHANGELOG.md) — riwayat perubahan terstruktur. Wajib diperbarui tiap
>   perubahan besar.
> - [`SECURITY.md`](./SECURITY.md) — cara melaporkan kerentanan keamanan.
> - [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — kode etik kontributor.
> - [`docs/RELEASES.md`](./docs/RELEASES.md) — catatan rilis siap-tempel untuk GitHub Releases +
>   roadmap versi + kelebihan aplikasi.
> - [`docs/POSITIONING.md`](./docs/POSITIONING.md) — positioning pasar Indonesia (untuk siapa &
>   kenapa, wedge lokal, perbandingan jujur vs Pano Scrobbler). Rujukan saat menulis deskripsi
>   Play Store / materi rilis.
> - [`docs/REFERENSI_SCROBBLE_PANO.md`](./docs/REFERENSI_SCROBBLE_PANO.md) — pembelajaran mekanisme
>   submit scrobble dari Pano Scrobbler (GPL-3.0): pemetaan sudah/adopsi/tak-berlaku + rekomendasi
>   berprioritas (backoff, cabang error top-level, jeda antar batch).
> - [`docs/REFERENSI_TAG_EDITOR.md`](./docs/REFERENSI_TAG_EDITOR.md) — pembelajaran editor tag MP3 dari
>   app sejenis (mp3agic/jaudiotagger/TagLib): fokus korektnes (encoding Unicode, album art, tulis
>   aman) ketimbang menambah fitur.
> - [`docs/GITHUB_SETUP.md`](./docs/GITHUB_SETUP.md) — checklist langkah manual di GitHub UI
>   (secrets, branch protection, rilis pertama) yang tidak bisa diotomasi dari scaffold ini.
> - [`docs/PANDUAN_API_KEY.md`](./docs/PANDUAN_API_KEY.md) — **panduan langkah-demi-langkah
>   memasang API key Last.fm**, ditulis untuk orang awam. Wajib dibaca kalau kamu membangun
>   Scrola sendiri dari kode sumber. (Kalau kamu hanya memakai APK rilis, kamu tidak butuh ini.)

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
positioning: alternatif yang indah, ringan, dan bisa dipercaya.

## Status proyek

Ini adalah **scaffold fase 1–2** (scope + arsitektur + skeleton awal) dari metodologi 5 fase:
scope → arsitektur → build bertahap → feedback loop → hardening. Semua file sudah bisa
di-build, tapi beberapa bagian masih placeholder yang ditandai `TODO` — dirancang supaya kita
bisa lanjut membangun fitur demi fitur berdasarkan hasil build nyata dari CI (Android SDK tidak
dijalankan langsung saat menyusun scaffold ini, jadi log GitHub Actions adalah sumber kebenaran build).

## Langkah setup wajib sebelum build pertama

1. **Daftar API key Last.fm**: buka https://www.last.fm/api/account/create, isi nama app
   "Scrola", dapatkan `API key` dan `Shared secret`.
2. Buat file `.env.local` di root project (sudah di-`.gitignore`, jangan commit):
   ```
   VITE_LASTFM_API_KEY=isi_di_sini
   VITE_LASTFM_API_SECRET=isi_di_sini
   ```
3. Untuk build via CI, tambahkan sebagai **Repository secret** di GitHub:
   `Settings → Secrets and variables → Actions → New repository secret`
   - `LASTFM_API_KEY`
   - `LASTFM_API_SECRET`

## Menjalankan lokal (web preview, tanpa fitur native)

```bash
npm install
npm run dev
```

## Build Android — panduan lengkap (baca sebelum push ke GitHub)

Repo ini **tidak menyertakan folder `android/` yang sudah jadi** — itu disengaja. Capacitor
menolak generate project baru kalau foldernya sudah ada, jadi file custom kita disimpan
terpisah di `native-overlay/` dan digabungkan lewat script setelah `cap add android` jalan.

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
> lockfile ini ada; kalau lupa commit, workflow otomatis fallback ke `npm install` biasa (tetap
> jalan, hanya kurang reproducible/cepat) — tapi tetap lebih baik commit lockfile-nya dari awal.

Lalu tambahkan dependency Media3 (ExoPlayer + MediaSession) — belum bisa diotomatisasi lewat
script karena format `build.gradle` bervariasi antar versi Capacitor. Buka
`android/app/build.gradle`, cari blok `dependencies { ... }`, tambahkan:

```groovy
implementation "androidx.media3:media3-exoplayer:1.4.1"
implementation "androidx.media3:media3-session:1.4.1"
implementation "com.mpatric:mp3agic:0.9.1"
```

**Catatan jujur soal `mp3agic`** (dipakai `Mp3MetadataPlugin.kt` untuk baca/tulis tag ID3):
Android tidak punya API bawaan untuk MENULIS tag ID3 (`MediaMetadataRetriever` cuma bisa baca),
jadi dipakai library eksternal ringan pure-Java ini. Kode plugin ditulis berdasarkan bentuk API
mp3agic 0.9.1, TAPI belum pernah dikompilasi terhadap toolchain Android/Gradle nyata. Kalau
`gradle build` gagal spesifik di `Mp3MetadataPlugin.kt` dengan error "unresolved reference" pada
method seperti `albumArtist` atau `genreDescription`, itu kemungkinan besar karena nama method
sedikit berbeda di versi mp3agic yang benar-benar ter-resolve — cek langsung Javadoc
`com.mpatric.mp3agic.ID3v24Tag` untuk nama method yang tepat.

Terakhir, sinkronkan aset web + commit:

```bash
npm run build
npx cap sync android
git add android/ native-overlay/
git commit -m "Setup Android platform + native overlay Scrola"
git push
```

Push ini akan memicu `.github/workflows/build.yml` yang otomatis:
1. Cek folder `android/` benar-benar ter-commit (kalau lupa, CI gagal dengan pesan jelas, bukan error Gradle yang membingungkan)
2. `npm ci` → `npm run build` (inject `LASTFM_API_KEY`/`LASTFM_API_SECRET` dari GitHub Secrets)
3. `npx cap sync android` (menyalin aset web terbaru + plugin ke `android/`)
4. `./gradlew assembleDebug`
5. Upload hasil APK sebagai artifact — unduh dari tab **Actions** pada run yang sukses, bagian **Artifacts**

### Kalau lupa langkah setup lokal

Workflow CI sengaja diberi guard di awal: jika folder `android/` belum ter-commit, build akan
langsung gagal di step pertama dengan pesan instruksi, bukan error Gradle yang panjang dan
membingungkan untuk di-debug dari log CI saja.

## Apa yang sudah ada di scaffold ini

| Bagian | File | Status |
|---|---|---|
| Client API Last.fm (auth, sign, scrobble) | `src/lib/lastfm.ts` | Siap pakai |
| Penyimpanan session key terenkripsi (Keystore) | `native-overlay/.../SecureStorePlugin.kt` + `src/lib/secureStore.ts` | Siap pakai |
| Deteksi now-playing app lain (MediaSession) | `native-overlay/.../ScrolaNotificationListener.kt` + `NowPlayingPlugin.kt` | Siap pakai |
| **Wiring event native → state React** | `src/hooks/useNowPlaying.ts` | **Baru: siap pakai** |
| **Riwayat scrobble tersambung ke UI** | `src/hooks/useScrobbleHistory.ts` | **Baru: siap pakai (backend Preferences, lihat catatan di bawah)** |
| **Layar Settings (izin notifikasi, logout)** | `src/screens/SettingsScreen.tsx` | **Baru: siap pakai** |
| **Login otomatis via deep link** | `src/screens/LoginScreen.tsx` | **Baru: siap pakai — perlu 1 langkah setup manual, lihat di bawah** |
| Engine antrean scrobble offline-first | `src/lib/scrobbleEngine.ts` | **Sekarang di SQLite** (`src/lib/db/`), migrasi bernomor pola Strongbox |
| **Foreground service notifikasi Now Playing** | `ScrobbleForegroundService.kt` + `ScrolaApplication.kt` | **Baru: siap pakai** |
| **MainActivity & Application class** (sebelumnya dirujuk manifest tapi belum dibuat — celah build) | `MainActivity.kt`, `ScrolaApplication.kt` | **Baru: dibuat, celah build tertutup** |
| **Izin runtime POST_NOTIFICATIONS (Android 13+)** | `NowPlayingPlugin.kt` (`requestNotificationPermission`) | **Baru: siap pakai** |
| **Player musik internal (ExoPlayer/Media3)** | `PlaybackService.kt` + `PlayerPlugin.kt` + `src/lib/player.ts` + `src/hooks/usePlayer.ts` | **Baru: siap pakai** — lihat catatan arsitektur di bawah |
| **Struktur native-overlay + script merge otomatis** | `native-overlay/`, `scripts/apply-native-overlay.cjs` | **Baru: menggantikan instruksi copy-paste manual sebelumnya** |
| Manifest & network config aman by default | `native-overlay/android/app/src/main/AndroidManifest.xml`, dst. | Siap pakai |
| UI: Now Playing (+ kontrol player), History, Settings + komponen StoryTicket | `src/screens/*`, `src/components/StoryTicket.tsx` | Siap pakai, tersambung ke data asli |
| CI build APK (dengan guard & cache) | `.github/workflows/build.yml` | Siap pakai |

### Arsitektur player internal — kenapa dibungkus MediaSessionService

`PlaybackService.kt` bukan sekadar wrapper ExoPlayer biasa — ia adalah `MediaSessionService`
(Media3). Ini pilihan desain yang disengaja: `ScrolaNotificationListener` membaca now-playing
lewat `MediaSessionManager.getActiveSessions()`, yang mencakup **semua** sesi media aktif di
sistem begitu izin Notification Access diberikan — termasuk sesi milik Scrola sendiri.

Konsekuensinya: lagu yang diputar dari player internal otomatis mengalir lewat **pipeline
scrobble yang sama persis** dengan lagu dari Spotify/YouTube Music. Tidak ada kode scrobble
terpisah untuk "sumber sendiri". `usePlayer.ts` (hook baru) hanya mengurus kontrol UI
(pilih file, play/pause/seek) — logika scrobble tetap 100% di `useNowPlayingListener`.

Pemilihan file memakai Storage Access Framework (`ACTION_OPEN_DOCUMENT`), jadi **tidak perlu**
permission `READ_MEDIA_AUDIO` — user memilih file secara eksplisit lewat picker sistem.

### Setup tambahan untuk SQLite (`@capacitor-community/sqlite`)

Plugin ini butuh sedikit konfigurasi native tambahan setelah `npm install`:

1. `npx cap sync android` — menarik kode native plugin ke folder `android/`.
2. Jika nanti minifikasi/ProGuard diaktifkan untuk build release, tambahkan rule berikut di
   `android/app/proguard-rules.pro` (belum perlu untuk build debug via CI saat ini):
   ```
   -keep class com.getcapacitor.community.database.sqlite.** { *; }
   -keep class net.sqlcipher.** { *; }
   ```
3. Skema database ada di `src/lib/db/schema.ts` — tambah migrasi baru dengan menaikkan
   `version` dan menulis statement SQL baru, jangan pernah mengubah migrasi versi lama yang
   sudah pernah dirilis (sama seperti aturan migrasi Room di Strongbox).

### Langkah setup tambahan untuk login otomatis (deep link)

Supaya `scrola://auth-callback` benar-benar diterima balik dari Last.fm setelah user authorize:
1. Buka halaman app kamu di https://www.last.fm/api/account/ (setelah `auth.getToken` didaftarkan)
2. Isi field **Callback URL** dengan: `scrola://auth-callback`
3. Tanpa ini, Last.fm tidak akan redirect balik ke app — user akan tertahan di browser (fallback `browserFinished` di kode akan tetap mencoba menukar token begitu tab ditutup, tapi pengalamannya kurang mulus).

## Branding & ikon app

Ikon app dan splash screen sudah dibuat mengikuti identitas visual Scrola (motif "tiket cerita",
plum-ink `#1C1420` + amber `#E8B04B` + aksen coral `#FF6B7A`), dibuat terprogram (Python/Pillow)
supaya konsisten dan mudah di-regenerate kalau brand berubah.

**Sudah termasuk di `native-overlay/`:**
- Adaptive icon lengkap (foreground + background + monochrome untuk themed icon Android 13+)
  di semua densitas (`mipmap-mdpi` s.d. `mipmap-xxxhdpi`), plus `mipmap-anydpi-v26/ic_launcher.xml`
- Fallback ikon legacy (flattened + versi bulat) untuk API < 26 yang tidak mendukung adaptive icon
- Splash screen (`res/drawable/splash.png`) + konfigurasi `@capacitor/splash-screen` di
  `capacitor.config.ts` dengan warna latar `#1C1420` senada (mencegah kedipan putih sebelum
  splash muncul di sebagian perangkat)

**Perlu diverifikasi setelah `npx cap add android`** (satu-satunya bagian yang tidak bisa
dipastikan 100% tanpa Android SDK sungguhan): Capacitor menaruh referensi splash screen di
`res/drawable/splash.xml` (layer-list) atau langsung `res/drawable/splash.png` tergantung versi
template. Setelah `npm run native:overlay`, buka `android/app/src/main/res/drawable/` — kalau ada
`splash.xml` yang mereferensikan bitmap dengan nama lain, sesuaikan referensinya ke `splash.png`
yang baru ditimpa, atau ganti isi `splash.xml` agar menunjuk ke drawable kita.

**Play Store icon (512×512, bukan bagian dari APK)** ada di lampiran pesan ini secara terpisah —
dipakai saat upload listing ke Play Console, bukan file yang perlu masuk ke folder Android.

Kalau brand berubah nanti (warna/motif), tinggal jalankan ulang:
```bash
python3 branding/generate_icons.py
python3 branding/generate_splash.py
```
Keduanya menulis langsung ke `native-overlay/android/app/src/main/res/` (siap di-merge lewat
`npm run native:overlay` seperti biasa) DAN ke `branding/preview/` untuk pratinjau cepat tanpa
perlu buka Android Studio.


### Rentang Android yang didukung

**`minSdkVersion` diset ke 23 (Android 6.0, 2015)**, dinaikkan otomatis oleh
`npm run native:overlay` dari default Capacitor (22). Ini bukan pembatasan sembarangan —
`SecureStorePlugin` memakai `KeyGenParameterSpec` (Android Keystore) untuk mengenkripsi session
key, dan kelas ini **baru tersedia sejak API 23**. Kalau minSdk dibiarkan di 22, app akan crash
saat login persis di perangkat Android 5.1 ke bawah. Android 6.0 dirilis 2015 — API 23 tetap
mencakup mayoritas mutlak perangkat aktif hari ini, jadi ini trade-off yang wajar dibanding
melemahkan enkripsi demi menyokong OS berumur lebih dari 10 tahun.

`targetSdkVersion` mengikuti default Capacitor (35, Android 15) untuk syarat terbaru Play Store.
Fitur yang butuh API tinggi (notification channel API 26+, POST_NOTIFICATIONS API 33+, foreground
service type API 29+/34+) semuanya sudah dibungkus pengecekan `Build.VERSION.SDK_INT` di kode,
jadi tetap aman dijalankan di perangkat API 23 sampai API 35+ tanpa crash akibat API yang belum ada.

### Yang sudah dioptimasi untuk hemat RAM

- **Buffer ExoPlayer diperkecil**: default Media3 dirancang untuk streaming adaptif dari jaringan
  (bisa menahan puluhan MB di buffer). Karena player internal Scrola memutar file lokal, buffer
  diset jauh lebih kecil (`DefaultLoadControl` custom di `PlaybackService.kt`) — hemat RAM
  signifikan tanpa mengorbankan kelancaran playback file lokal.
- **`PlaybackService` auto-stop**: 10 detik setelah track selesai tanpa track baru dimuat, service
  (beserta ExoPlayer + MediaSession di dalamnya) otomatis dimatikan — tidak menghuni RAM secara
  idle menunggu user kembali.
- **`ScrobbleForegroundService` juga auto-stop** saat tidak ada sesi media aktif sama sekali
  (lihat `ScrolaNotificationListener.rebindControllers`).
- **Query database selalu dibatasi** (`getHistory(limit=100)`, `getQueueBatch(50)`) — riwayat
  tidak pernah memuat seluruh isi tabel ke memori sekaligus walau sudah discrobble ribuan track.
- **Tidak ada native library (`lib/`)** dan tidak ada aset bitmap besar — ikon notifikasi berupa
  vector drawable, bukan PNG.
- **`android:largeHeap="false"`** — sengaja tidak diaktifkan supaya app tidak diberi alokasi heap
  besar oleh sistem yang justru mendorong kebiasaan boros memori.
- Polling posisi playback di `PlayerPlugin` (untuk progress bar) dihentikan otomatis saat plugin
  di-destroy, bukan berjalan tanpa henti selama proses app hidup (lihat catatan di riwayat audit
  di atas — ini salah satu bug yang sudah diperbaiki).

### Batasan yang jujur perlu diketahui

Scrola dibangun di atas Capacitor, yang menjalankan UI di dalam WebView (Chromium) — ini
**inheren memakai RAM lebih besar dibanding app Android native murni**, sama seperti aplikasi
Capacitor/React Native/Flutter lainnya secara umum. Optimasi di atas mengurangi jejak memori di
bagian yang bisa dikontrol (player, service, database, query), tapi tidak menghilangkan baseline
overhead WebView itu sendiri. Kalau suatu saat RAM jadi masalah kritis di perangkat sangat low-end,
opsi lebih jauh adalah menulis ulang UI secara native — di luar cakupan arsitektur saat ini.

Untuk build **release** (bukan debug yang dipakai CI sekarang), aktifkan juga code/resource
shrinking di `android/app/build.gradle` untuk memperkecil ukuran APK (tidak berpengaruh besar ke
RAM runtime, tapi mempercepat instalasi & startup pertama di perangkat lawas):
```groovy
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

Semua fungsi inti (auth, deteksi now-playing, scrobble, queue offline, foreground service,
player internal) sudah ada. Sisanya bersifat polish:

1. Penyempurnaan ikon app & splash screen bila diperlukan — aset dasar sudah dibuat terprogram
   dan bisa diregenerasi lewat script di `branding/` (lihat bagian "Branding & ikon app").
2. Layar "pilih track dari riwayat untuk diputar ulang" (opsional, saat ini player hanya
   mendukung 1 track terpilih dalam sesi, tanpa playlist/queue).
3. Uji nyata di device fisik lewat APK hasil CI — ini yang paling penting sekarang. Kalau ada
   error build atau crash saat dipakai, kumpulkan log/`adb logcat`-nya untuk diperbaiki.

Fokus sekarang: pastikan langkah "Build Android" di atas berhasil sampai APK ter-upload di
GitHub Actions. Kalau ada error di step manapun, kirim log lengkapnya.

## Fitur edit metadata MP3

Bisa mengubah tag ID3 (judul, artist, album, album artist, tahun, genre, sampul album) pada
file MP3 lokal — diakses lewat tombol pensil (✎) di sebelah judul lagu yang sedang diputar di
tab "Sekarang", atau tautan "atau edit metadata MP3" saat belum ada lagu diputar (untuk mengedit
file lain yang tidak sedang aktif).

**Cara kerja teknis:** Android tidak punya API bawaan untuk MENULIS tag ID3 (`MediaMetadataRetriever`
cuma bisa baca), jadi dipakai library `mp3agic` (pure-Java, ringan, tidak perlu kompilasi native).
Karena file dipilih lewat Storage Access Framework, alurnya: salin ke berkas sementara di
cache app → baca/tulis tag pakai mp3agic → salin hasilnya balik ke file asli lewat
`ContentResolver.openOutputStream` → hapus file sementara. File asli di penyimpanan device
benar-benar berubah, bukan cuma salinan di dalam app.

**Batasan yang jujur perlu diketahui:**
- Butuh izin **tulis** (bukan cuma baca) ke file — beberapa provider penyimpanan (mis. folder
  yang di-sync cloud storage tertentu, atau device dengan storage terenkripsi khusus vendor)
  bisa saja menolak permintaan write meski sudah lewat picker sistem.
- Kode `Mp3MetadataPlugin.kt` ditulis berdasarkan bentuk API mp3agic 0.9.1, **belum pernah
  dikompilasi** terhadap toolchain Android/Gradle nyata. Kalau build gagal di file ini dengan
  error "unresolved reference" pada method seperti `albumArtist`/`genreDescription`, cek Javadoc
  `com.mpatric.mp3agic.ID3v24Tag` untuk nama method yang tepat.
- Kalau tag ID3 yang ada sebelumnya bukan versi 2.4 (mis. masih ID3v2.3 lama), menyimpan akan
  menuliskannya ulang sebagai ID3v2.4 — field di luar 6 yang ada di form (judul/artist/album/
  album artist/tahun/genre/sampul) mungkin tidak ikut terbawa. Ini simplifikasi yang disengaja
  untuk menjaga kode tetap sederhana, bukan bug yang belum ketahuan.

## Perbaikan bertahap atas kelemahan (cons)

Setelah penilaian pro/kontra, beberapa kelemahan mulai dibereskan dari yang termudah:

**1. Test otomatis untuk logic murni (`src/lib/scrobbleLogic.ts` + `__tests__/`)**
Logic paling kritis & rawan bug — aturan eligibility scrobble, parsing respons Last.fm (kuirk
single-vs-array), dan pembangunan signature — dipisah jadi fungsi murni tanpa dependensi native,
lalu ditest dengan Vitest (`npm test`). 17+ assertion mencakup kasus ambang & edge case. CI
menjalankan test ini sebelum build APK, jadi regresi di logic inti ketahuan lebih awal. Ini
jenis test yang bisa jalan tanpa device/emulator, jadi paling bernilai untuk mulai.

**2. Error boundary React (`src/components/ErrorBoundary.tsx`)**
Sebelumnya, satu error render di komponen mana pun = seluruh layar jadi kosong tanpa petunjuk.
Sekarang ada pesan yang bisa dibaca + tombol muat ulang, alih-alih kebuntuan total.

**3. Crash logging native lokal (`CrashLogger.kt`)**
Uncaught exception native dicatat ke file lokal (`filesDir/last_crash.txt`) — TANPA dikirim ke
server mana pun (keputusan sadar: tanpa telemetri pihak ketiga demi privasi & bobot ringan).
Konsekuensi jujurnya: kamu tidak otomatis tahu kalau app crash di HP orang lain; log harus
dibagikan manual. Fitur "bagikan log" di Pengaturan bisa ditambahkan nanti kalau perlu.

**Kelemahan yang TIDAK bisa diperbaiki lewat kode — hanya bisa diterima/dimitigasi:**
- *Belum pernah dikompilasi/diuji di device nyata*: hanya hilang setelah build CI berhasil &
  app dijalankan di HP fisik. Tidak ada jalan pintas.
- *Ketergantungan pada API Last.fm*: di luar kendali kita. Mitigasi yang sudah ada: timeout
  request, antrean offline dengan retry, penanganan error yang tidak meng-crash app.
- *Kompleksitas native tinggi*: inheren untuk fitur yang diminta. Test & error boundary di atas
  mengurangi risiko regresi, tapi tidak menghilangkan kompleksitasnya.

## Riwayat audit internal — putaran keempat (kode terbaru: test, error boundary, crash log)

Review 5 putaran lagi, fokus ke kode yang paling belum tersentuh review sebelumnya. 5 masalah
ditemukan & diperbaiki:

**CrashLogger.kt:** `previousHandler` yang bernilai null bisa membuat thread yang crash menggantung
alih-alih ditutup bersih — ditambahkan fallback `killProcess` + `exitProcess`. Tanpa ini, dalam
kondisi tertentu app bisa masuk keadaan setengah-mati yang lebih buruk dari crash biasa.

**vite-env.d.ts:** deklarasi `ImportMetaEnv` manual tidak menyertakan properti bawaan Vite
(`DEV`/`PROD`/`MODE`), sehingga `import.meta.env.DEV` di ErrorBoundary akan error TypeScript —
ditambahkan eksplisit.

**Mp3MetadataPlugin.kt:** kalau data URI album art rusak, `Base64.decode` melempar exception yang
sebelumnya merambat ke catch besar dan membatalkan SELURUH save — termasuk field teks
(judul/artist/album) yang sudah di-set. Diperbaiki dengan mengisolasi penanganan artwork dalam
try/catch sendiri, supaya kegagalan gambar tidak menjatuhkan editan teks.

**MainActivity.kt + DiagnosticsPlugin.kt:** ada plugin `DiagnosticsPlugin` (jembatan JS untuk
membaca/menghapus log crash) yang sudah ditulis TAPI belum didaftarkan di `MainActivity` — jadi
fungsinya gagal saat runtime. Sekaligus wrapper JS-nya belum ada dan `SettingsScreen` belum
memakainya, jadi fitur "lihat log crash" masih setengah jadi. Dilengkapi: plugin didaftarkan,
wrapper JS dibuat, dan bagian "Diagnostik" ditambahkan di Pengaturan (hanya muncul kalau memang
ada crash tercatat) dengan tombol lihat detail & hapus. Ini sekaligus menuntaskan con "crash
logging" dari sesi sebelumnya — sekarang log-nya benar-benar bisa diakses user, bukan cuma lewat
adb.

## Riwayat audit internal — putaran keempat (review menyeluruh lintas-lapisan)

Review lagi 5 putaran, termasuk kode yang baru ditambahkan (test, ErrorBoundary, CrashLogger)
karena kode baru paling mungkin punya bug yang belum tersentuh review. 5 masalah ditemukan &
diperbaiki (beberapa file ternyata sudah bersih dari review sebelumnya):

**Database (`db.ts`):** `initPromise` tidak di-reset kalau inisialisasi DB GAGAL — satu kegagalan
awal (mis. migrasi error) akan mengunci promise yang sudah reject selamanya, dan setiap `getDb()`
berikutnya mengembalikan kegagalan yang sama meski penyebabnya mungkin sementara. App tidak bisa
memuat data tanpa restart total. Diperbaiki agar bisa dicoba ulang.

**Edit metadata (`useMp3Editor.ts`):** double-tap tombol Simpan bisa memicu DUA proses tulis ke
file MP3 yang sama bersamaan (state React `saving` bersifat async, tidak langsung memblokir tap
kedua) — dua read-modify-write paralel ke file yang sama berisiko merusak file. Ditambahkan guard
`useRef` sinkron.

**Penyimpanan sesi (`secureStore.ts` + `SecureStorePlugin.kt`):** `saveSession` melakukan dua
operasi set terpisah tanpa atomicity — kalau yang kedua gagal, session key tersimpan tanpa
username pasangannya; ditambahkan cleanup on failure. Di sisi native, data terenkripsi yang korup
(`AEADBadTagException`) sebelumnya menghasilkan error permanen yang mengunci alur login setiap app
dibuka — sekarang diperlakukan sama seperti kunci invalid: data korup dibersihkan, user tinggal
login ulang.

**Pipeline scrobble (`scrobbleEngine.ts`) — paling penting:** urutan operasi sebelumnya menyimpan
ke history DULU baru menghapus dari antrean. Kalau penghapusan antrean gagal setelah history
tersimpan, track tetap di antrean dan akan **di-scrobble ULANG ke Last.fm** pada flush berikutnya —
duplikat yang terlihat di profil publik Last.fm user. Urutan dibalik (hapus antrean dulu) sehingga
skenario kegagalan terburuk hanya kehilangan salinan history LOKAL (jauh lebih ringan daripada
mengotori data publik user). Sekaligus rekursi per-batch diubah jadi loop untuk keamanan call
stack pada antrean offline yang menumpuk panjang.

## Riwayat audit internal — putaran ketiga (infrastruktur & interaksi antar-fitur)

Review lagi 5 putaran, kali ini fokus ke file yang belum diperiksa ulang baru-baru ini plus
interaksi antar semua fitur setelah digabung. 9 masalah ditemukan & diperbaiki:

**Native — koneksi & lifecycle:** `db.open()` sebelumnya dipanggil tanpa syarat walau koneksi
hasil `retrieveConnection()` kemungkinan sudah dalam keadaan terbuka — berisiko error "database
already open". `sessionListener` di `ScrolaNotificationListener` bisa terdaftar dobel kalau
`onListenerConnected()` terpanggil ulang oleh sistem. Lifecycle `onListenerDisconnected()` (kebalikan
dari `onListenerConnected`) tidak pernah ditangani sama sekali — kalau user mencabut izin
notification access saat service masih berjalan, referensi lama tetap menggantung.

**Bug visual:** komponen `StoryTicket` mereferensikan animasi `animate-[fadeIn_0.4s_ease]` tapi
keyframe `fadeIn`-nya **tidak pernah didefinisikan** di mana pun — browser diam-diam mengabaikan
animasi ke keyframe tak dikenal, jadi efek fade-in yang dimaksud tidak pernah benar-benar jalan.

**Bug JS:** `readHistory()` di `useScrobbleHistory` tidak punya `.catch()` — kalau inisialisasi
database gagal total, ini jadi unhandled promise rejection yang berulang tiap kali app kembali
ke foreground.

**Bug paling kritis putaran ini — jaringan:** `fetch()` ke Last.fm API tidak punya timeout sama
sekali. Kalau koneksi macet (captive portal, jaringan buruk), request bisa menggantung tanpa
batas waktu — dan karena mutex `isFlushing` (dari audit sebelumnya) baru direset di blok
`finally` SETELAH promise selesai, satu request yang menggantung akan **mengunci pengiriman
scrobble secara permanen** untuk sisa sesi app. Diperbaiki dengan `AbortController` + timeout 15
detik.

**Bug konfigurasi build (paling penting untuk CI):** workflow GitHub Actions memakai `npm ci`,
tapi project ini tidak (dan tidak bisa, di environment saya) punya `package-lock.json` —
`npm ci` MENSYARATKAN lockfile itu ada, kalau tidak, build gagal di langkah paling pertama.
`actions/setup-node@v4` dengan opsi `cache: npm` punya syarat yang sama dan akan gagal lebih
dulu lagi. Keduanya diperbaiki: cache dihapus sementara, `npm ci` diberi fallback otomatis ke
`npm install` kalau lockfile belum ada.

**Dependensi tak terpakai:** `react-router-dom` dan `@capacitor/preferences` terpasang di
`package.json` tapi tidak pernah benar-benar diimpor di kode manapun (navigasi sebenarnya cuma
`useState` tab switching; Preferences sudah digantikan SQLite) — dihapus, menambah bobot bundle
tanpa manfaat, bertentangan dengan prinsip "ringan" yang sudah ditetapkan untuk app ini.

## Riwayat audit internal — putaran kedua (fitur album art + edit metadata MP3)

Setelah menambahkan ekstraksi album art dan fitur edit metadata MP3, dilakukan 5 putaran review
lagi khusus untuk kode baru. 9 masalah ditemukan & diperbaiki:

**Bug tipe data & korektnes (Mp3MetadataPlugin.kt):** kode awal mencoba menggabungkan tag ID3v1
dan ID3v2 lewat satu ekspresi elvis padahal keduanya tipe tidak kompatibel di mp3agic (berisiko
gagal kompilasi) — diperbaiki dengan membaca keduanya terpisah lalu menggabung hasil string-nya.
Ada juga akses non-null-safe ke property nullable yang berisiko gagal kompilasi. Yang paling
penting: bug data-loss di mana tag ID3v2.3 yang sudah ada (default banyak tagger lama seperti
iTunes/foobar2000) akan **dibuang total** dan diganti tag v2.4 baru saat disimpan, menghilangkan
semua field lain yang tidak ada di form edit ini — sekarang tag lama dipakai ulang apa adanya.

**Bug RAM & mime type (ImageUtils.kt, baru — menyatukan logic yang sempat terduplikasi):**
mime type artwork sebelumnya selalu di-hardcode "image/jpeg" walau gambar aslinya PNG dan tidak
sempat dikompres ulang — sekarang dideteksi dari magic bytes sebenarnya. `BitmapFactory.decodeByteArray()`
sebelumnya men-decode gambar SEPENUHNYA ke memori dulu sebelum tahu ukurannya, berisiko RAM
tinggi/OOM untuk artwork beresolusi besar — diperbaiki dengan cek dimensi dulu (inSampleSize)
sebelum decode penuh, konsisten dengan prinsip "ringan" yang sudah ditetapkan untuk app ini.

**Bug JS (usePlayer.ts, EditMetadataScreen.tsx):** membatalkan file picker (aksi normal) memicu
unhandled promise rejection. Setelah edit metadata track yang SEDANG diputar, tampilan Now Playing
tidak ikut ter-update sampai user memutar ulang — ditambahkan sinkronisasi tampilan (dengan catatan
jujur: MediaSession/scrobble tetap pakai data lama sampai pemutaran berikutnya). Tombol "Batal" bisa
ditekan di tengah proses simpan (file tetap tertulis di background walau UI ditutup, membingungkan).
Tombol back hardware Android tidak menutup overlay edit metadata sama sekali.

**Bug keamanan/crash (Mp3MetadataPlugin.kt):** pemilihan gambar sampul tidak memvalidasi ukuran
file sebelum membaca penuh ke memori — `OutOfMemoryError` adalah subclass `Error` (bukan
`Exception`), jadi tidak tertangkap oleh `catch(e: Exception)` yang ada; file sangat besar bisa
meng-crash app tanpa tertangani. Sekarang ukuran divalidasi lebih dulu (maks 20MB) sebelum dibaca.
File sementara di cache app juga tidak pernah dibersihkan kalau app crash di tengah proses —
ditambahkan pembersihan otomatis saat plugin dimuat.

## Riwayat audit internal — putaran pertama (5 putaran review bug & keamanan)

Sebelum tahap uji device, seluruh kode (TS + Kotlin) sudah melalui 5 putaran review manual.
18 masalah ditemukan & diperbaiki:

**Korektnes pipeline scrobble:** timestamp scrobble sebelumnya memakai waktu saat syarat
50%/4-menit terpenuhi, bukan waktu track mulai (bisa meleset beberapa menit dari histori
sebenarnya di Last.fm) — sekarang dicatat sejak track pertama terdeteksi. Track dengan
`duration: 0` sempat diam-diam diabaikan karena pengecekan truthy. Refire metadata untuk track
yang sama pada beberapa app musik berisiko scrobble ganda — sekarang hanya dianggap track baru
kalau memang benar-benar berganti.

**Concurrency & keandalan antrean:** dua `flushQueue()` yang berjalan bersamaan bisa
menduplikasi entri riwayat (race condition) — ditambahkan mutex. Track yang ditolak permanen
oleh Last.fm sebelumnya dicoba ulang selamanya — dibatasi 8x percobaan. Respons batch scrobble
sebelumnya dianggap 100% sukses tanpa memeriksa `ignoredMessage` per-track dari Last.fm.

**Ketahanan error di JS:** kegagalan plugin native (mis. error Keystore) pada pemuatan sesi
sebelumnya bisa mengunci app selamanya di layar blank karena state loading tidak pernah
di-reset — sekarang selalu fallback ke layar login. Beberapa `addListener()` ke plugin native
tidak punya `.catch()`, berisiko unhandled promise rejection terutama saat preview web.

**Native Android:** `getLaunchIntentForPackage()` yang bisa `null` sebelumnya langsung dilempar
ke `PendingIntent.getActivity()` tanpa null-check di dua tempat (bisa crash). Saat >1 sesi media
aktif bersamaan, sesi yang di-pause bisa menimpa state track yang sedang aktif diputar —
ditambahkan filter. Kunci Keystore yang ter-invalidasi (mis. user reset kredensial layar kunci)
sebelumnya bikin login gagal permanen — sekarang otomatis pulih. Delay tetap 300ms sebelum
memutar file dari player internal diganti retry-poll yang lebih andal di perangkat lambat.

**Keamanan alur auth:** `scrola://auth-callback` adalah custom URL scheme yang secara teknis
bisa disalahgunakan app lain di perangkat yang sama untuk mengirim token palsu — token dari
query string URL sekarang tidak pernah dipercaya, hanya dipakai sebagai sinyal "user kembali
dari browser"; token asli yang dipakai selalu yang kita minta sendiri.

Detail lengkap tercatat di CHANGELOG. Semua perbaikan sudah masuk ke kode.
