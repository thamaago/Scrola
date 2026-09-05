# Upgrade Capacitor 6 → 8 (lewat repo GitHub / CI)

**Jawaban singkat: ya, seluruhnya bisa lewat repo GitHub — tanpa Android Studio / SDK lokal.**
Itu memang satu-satunya cara Scrola di-build: `.github/workflows/build.yml` meng-generate `android/`
dari template Capacitor tiap build, menerapkan overlay native, lalu `gradlew assembleDebug` di runner.

## Kenapa ini jadi sederhana

Karena `android/` **tidak** di-commit — CI membuatnya dengan `npx cap add android` setiap kali. Maka
begitu paket npm `@capacitor/*` di ^8, `cap add android` menghasilkan proyek Android **Capacitor 8**
lengkap dengan `variables.gradle` (minSdk 24, compileSdk/target 36), AGP 8.13, dan Gradle wrapper yang
benar — **otomatis, tanpa kamu mengedit file gradle apa pun.** Yang tersisa hanyalah kustomisasi
Scrola yang disuntik `scripts/apply-native-overlay.cjs`.

## Status: SUDAH disiapkan di scaffold ini

- ✅ **`package.json` → Capacitor 8** (`@capacitor/*` + `@capacitor-community/sqlite` @ ^8).
  Divalidasi bertahap 6→7→8 di container: `tsc` bersih, 166 tes lolos, `vite build` sukses, **tanpa
  perubahan kode**. API JS SQLite (risiko terbesar) tidak berubah.
- ✅ **`scripts/apply-native-overlay.cjs` → media3 1.10.0** (dari 1.4.1). Di sinilah versi media3
  sebenarnya disuntik ke `android/app/build.gradle` (bukan di README). Cocok dengan compileSdk 36.
- ✅ **CI Node 20 → 22** di `build.yml` & `release.yml` (Capacitor 8 butuh Node 20+; 22 memberi
  headroom). **JDK sudah 21** (temurin) — sesuai rekomendasi Cap 8.
- ✅ **`package-lock.json` diregenerasi** untuk set Cap 8 (agar `npm ci` di CI reproducible).

## Yang perlu KAMU lakukan

1. **Commit semua** perubahan di scaffold ini — terutama `package.json`, **`package-lock.json`**,
   `scripts/apply-native-overlay.cjs`, `.github/workflows/*.yml`, dan `native-overlay/**` /
   `MIGRASI-CAPACITOR-8.md`.
2. **Push ke `main`** (atau jalankan workflow `Build Android Debug APK` via workflow_dispatch).
3. **Pantau Actions.** CI akan: `npm ci` → `npm test` → `npm run build` → `cap add android` (template
   Cap 8) → `native:overlay` → `cap sync` → JDK 21 → `gradlew assembleDebug` → unggah APK.
4. **Unduh artifact `scrola-debug-apk`**, pasang di perangkat, lalu **uji jalur inti** (lihat di bawah).

## Verifikasi di perangkat (setelah CI hijau)

Fokus pada yang bergantung SQLite & native (paling mungkin terpengaruh upgrade):
- Buka app pertama kali → migrasi DB jalan tanpa error; Riwayat termuat.
- Scrobble Spotify + YouTube Music dengan **app tertutup** → buka app → semua masuk Riwayat,
  ada baris `LATAR:` di Log Peristiwa, tanpa dobel.
- Pemutar internal: putar file lokal **layar mati** → mulus sampai selesai (wake lock); kalau file
  punya tag ReplayGain, ada baris `PEMUTAR: ReplayGain … -> volume …`.
- Editor tag MP3 (baca + tulis via SAF), koreksi metadata, blokir sumber, render Tiket/Sisi B/Bab/Album.

## Kalau CI GAGAL — titik risiko & perbaikan siap-pakai

**A. Kotlin terlalu tua untuk AGP 8.13.** Overlay menyuntik Kotlin `1.9.25`. Biasanya masih diterima
AGP 8.13, tapi kalau build gagal dengan pesan minimum Kotlin version, edit `apply-native-overlay.cjs`:
- Ganti `const KOTLIN_VERSION = '1.9.25';` → `'2.0.21';`
- Kotlin 2.0 mendeprekasi `kotlinOptions{}`. Ganti blok yang disuntik menjadi (di luar `android{}`):
  ```gradle
  import org.jetbrains.kotlin.gradle.dsl.JvmTarget
  kotlin { compilerOptions { jvmTarget = JvmTarget.JVM_21 } }
  ```
  dan naikkan `compileOptions` Java yang disuntik dari 17 → **21** (WAJIB sama dengan Kotlin, kalau
  tidak dexBuilder gagal). Karena JDK CI sudah 21, ini aman.

**B. Platform Android 36 tak ada di runner.** Jarang (ubuntu-latest biasanya sudah punya API 36).
Kalau `gradlew` gagal cari `android-36`, tambahkan langkah sebelum build di `build.yml`:
```yaml
      - uses: android-actions/setup-android@v3
      - run: sdkmanager "platforms;android-36" "build-tools;36.0.0"
```

**C. `@capacitor-community/sqlite` native.** `cap sync` menarik versi Cap 8-nya. API JS sudah
terbukti kompatibel (tsc bersih), tapi perilaku native hanya terbukti di perangkat — uji DB di atas.
Kalau ada error runtime DB, cek changelog plugin & kirim log.

## Rollback
Semua perubahan berbasis git — `git revert` commit upgrade, atau kembalikan `package.json` +
`package-lock.json` + `apply-native-overlay.cjs` ke Cap 6. Karena `android/` di-generate ulang tiap
build, tak ada state gradle tertinggal.

## Referensi resmi
- `capacitorjs.com/docs/updating/7-0`, `.../8-0`, `.../plugins/8-0`
- `@capacitor-community/sqlite` — CHANGELOG di GitHub repo-nya (7.x & 8.x).
