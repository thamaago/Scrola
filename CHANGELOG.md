# Changelog

Semua perubahan penting pada Scrola dicatat di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
dan proyek ini menggunakan [Semantic Versioning](https://semver.org/lang/id/).

Jenis perubahan yang dipakai: `Added` (fitur baru), `Changed` (perubahan pada fitur yang sudah
ada), `Fixed` (perbaikan bug), `Security` (perbaikan celah keamanan), `Removed` (penghapusan),
`Deprecated` (akan dihapus), dan `Internal` (perubahan yang tidak terlihat user: audit, refactor,
tooling).

> **Catatan status:** Sampai versi `0.1.0` benar-benar berhasil ter-build di CI dan dijalankan di
> perangkat fisik, SEMUA entri di bawah berstatus **belum tervalidasi di device** — ditulis
> berdasarkan review kode manual, bukan hasil kompilasi/pengujian nyata. Lihat CONTRIBUTING.md
> bagian "Definisi Selesai".

## [Unreleased]

### Internal — verifikasi kelengkapan i18n (8 bahasa benar-benar utuh)
Menambah `i18nCompleteness.test.ts` sebagai penjaga permanen bahwa SETIAP bahasa terimplementasi
penuh — bukan sekadar "test lain hijau". Empat lapis pemeriksaan:
- **Registrasi konsisten:** tiap locale di `LOCALES` punya tag BCP-47 valid, kamus terisi (>250 kunci),
  kategori jamak dideklarasikan, dan `pluralCategory` selalu menghasilkan kategori yang dideklarasikan
  (dicek untuk n = 0,1,2,5,11,21,22,100).
- **Paritas kunci penuh:** ke-8 locale menutup basis id tanpa kunci hilang/asing (via audit).
- **Paritas PLACEHOLDER:** tiap terjemahan memakai persis `{param}` yang sama dengan basis — menangkap
  `{count}` yang hilang atau typo (`{cont}`) yang tak terdeteksi audit. **0 ketidakcocokan** di 8 bahasa.
- **Deteksi teks tertinggal:** tak ada nilai non-id yang identik dengan Indonesia sambil mengandung
  huruf (kecuali istilah serumpun: Album/Artist/Genre/Scrobble/Serial). Membuktikan tak ada kalimat
  Indonesia yang lupa diterjemahkan.
- Dikonfirmasi juga: **tak ada string hardcoded** tersisa di layar/komponen (semua lewat `t()`), dan
  teks gambar-bagikan Canvas semuanya lewat `tActive` (hanya glyph '♪' yang literal).
- Hasil: `npm test` **337 hijau**, `tsc` 0, `vite build` sukses. Semua 8 bahasa lolos keempat lapis.
- **Yang MASIH belum "selesai" (jujur):** (a) mutu terjemahan pt/de/fr/ru/ja/es = AI, belum ditinjau
  penutur asli; (b) belum tervalidasi di device (Gradle/CI + HP fisik, termasuk render Kiril/CJK di
  Canvas & kelengkapan data ICU per-locale). Utuh secara STRUKTUR & CAKUPAN — belum secara mutu-native
  & device.

### Added — bahasa ke-8: Español (Spanyol) — jangkauan terluas (LatAm + Spanyol)
- **Spanyol (`es`)** ditambahkan penuh. Bukan tantangan struktur baru (jamak one/other seperti en),
  melainkan **jangkauan maksimum**: Spanyol + seluruh Amerika Latin (Meksiko, Argentina, Chile, dll —
  banyak pasar Last.fm besar). Dengan Inggris+Spanyol+Portugis(BR), Scrola kini menutup mayoritas
  pengguna Last.fm Amerika.
- **BCP-47 `es-419`** (Spanyol Amerika Latin) dipilih, bukan `es-ES` — memakai pemisah ribuan koma
  ("1,234,567") yang mewakili audiens Spanyol terbesar; kosakata netral-LatAm ("entrada" untuk tiket).
- Registrasi `i18n.ts`; kamus `locales/es.ts` **paritas 100% dengan id** (audit). Tanggal via Intl
  ("mayo"、"lun"、"9 may 2024"). Trato informal ("tú").
- **Review 5 putaran (ringkas):** korektnes — audit paritas 8 locale + integrasi es (jamak one/other,
  durasi, `resolveLocale('es-419'/'es-MX')`); state — nihil; error — semua `err.*` es; WebView — Intl
  `es-419` (perlu validasi ICU device); aman — nihil.
- Terjemahan AI berkualitas tinggi, belum ditinjau penutur asli.
- `npm test` hijau (**333**), `tsc` 0 error, `vite build` sukses. **Belum tervalidasi di device.**

### Added — bahasa ke-7: 日本語 (Jepang) — aksara CJK + kalimat verba-akhir (SOV)
- **Jepang (`ja`)** ditambahkan penuh. Jepang pasar Last.fm yang cukup besar; membawa dua tantangan
  baru sekaligus: **aksara CJK** (Kanji/Hiragana/Katakana) dan **tata kalimat SOV** (verba di akhir).
- **Jepang TANPA infleksi jamak** — satu bentuk saja (`other`), persis seperti Indonesia. Membuktikan
  infra jamak menampung rentang penuh: 1-bentuk (id/ja) · 2-bentuk (en/de/pt/fr) · 3-bentuk (ru).
  `PLURAL_RULES.ja = () => 'other'`. "1曲"/"5曲" bentuknya sama.
- **Perbaikan arsitektur untuk penutup kalimat CJK:** subtitle Bab/Album dulu memaku "." di JSX.
  Ditambah kunci `bab.subtitle.post` (Latin = "."; ja = "。") — sejajar dengan `bab.hero.post` (de/ja).
  Kini kalimat Jepang berakhir dengan「。」yang benar. Hero verba-akhir juga alami:
  「5月は、」+「210曲」+「を再生しました。」.
- Registrasi `i18n.ts` + BCP-47 `ja-JP`; kamus `locales/ja.ts` **paritas 100% dengan id** (audit).
  Angka/tanggal `ja-JP` via Intl ("1,234,567"、"5月"、曜日 "月火水…"、"2024年5月9日")；`hg.monthYear`
  di-override jadi urutan "{year}年{month}".
- **Review 5 putaran (ringkas):** korektnes — audit paritas 7 locale + integrasi ja (satu-bentuk,
  verba-akhir, `resolveLocale('ja-JP')`); state — tak ada; error — semua `err.*` ja; WebView — Intl
  `ja-JP` + render glyph CJK di Canvas perlu font fallback sistem (WAJIB validasi device); aman — nihil.
- **Batas jujur ja:** (a) terjemahan AI, belum ditinjau penutur asli; (b) render teks CJK pada
  GAMBAR-bagikan (Canvas) bergantung font CJK sistem — bisa jadi kotak-tofu jika absen (perlu cek HP);
  (c) label sumbu sparkline mode "tahun" memakai huruf pertama nama bulan — untuk ja jadi digit (Okt/Nov/
  Des → "1") — masalah kosmetik lama yang tak khusus ja, dicatat untuk perbaikan terpisah.
- `npm test` hijau (**330**), `tsc` 0 error, `vite build` sukses. **Belum tervalidasi di device.**

### Added — bahasa ke-6: Русский (Rusia) — aksara Kiril + jamak TIGA bentuk (one/few/many)
- **Rusia (`ru`)** ditambahkan penuh. Komunitas Last.fm Rusia secara historis sangat besar.
  Lompatan teknis terbesar: aksara **Kiril** + **jamak 3-bentuk** (sebelumnya semua locale cuma 2).
- **Bukti infra jamak benar-benar skalabel:** aturan Rusia (CLDR) memakai `one`/`few`/`many` —
  1 трек, 2 трека, 5 треков, 21 трек, 22 трека, 25 треков, 11 треков. Ditambahkan
  `LOCALE_PLURAL_CATEGORIES.ru = ['one','few','many']` + fungsi aturan `%10`/`%100`. `translatePlural`
  yang sudah ada menanganinya **tanpa perubahan** — hanya butuh 3 kunci per grup jamak di kamus.
  Test audit otomatis MEMAKSA ketiga bentuk ada untuk setiap grup (10 grup × 3 = 30 bentuk).
- Registrasi `i18n.ts` + BCP-47 `ru-RU`; kamus `locales/ru.ts` **paritas 100% dengan id** (audit).
  Angka/tanggal `ru-RU` via Intl ("1 234 567", "май", "пн").
- **Kehati-hatian tata bahasa Rusia:** di mana kala lampau akan memaksa gender ("ты открыл/открыла"),
  dipakai konstruksi impersonal netral ("Найдено {count} исполнителей") supaya tak berasumsi gender
  pengguna. Sisa kala-lampau langka ditandai "(а)" (mis. "включил(а)").
- **Review 5 putaran (ringkas):** korektnes — audit paritas 6 locale hijau + integrasi ru (one/few/many
  utk 1/2/4/5/11/21/22/25, durasi, `resolveLocale('ru-RU')`); state — tak ada; error — semua `err.*`
  ru; WebView — Intl `ru-RU` (perlu validasi ICU device); aman — tanpa perubahan izin/rahasia.
- **Catatan mutu terjemahan:** kamus non-id/en (pt/de/fr/ru) dihasilkan AI berkualitas tinggi tapi
  **belum ditinjau penutur asli** — Rusia paling perlu proofread karena tata bahasanya kompleks. Ini
  bukan "selesai" sampai ditinjau + divalidasi device.
- `npm test` hijau (**325**), `tsc` 0 error, `vite build` sukses. **Belum tervalidasi di device.**

### Added — bahasa ke-5: Français (Prancis) — aturan jamak berbeda (0 = tunggal)
- **Prancis (`fr`)** ditambahkan penuh. Prancis pasar musik/Last.fm besar Eropa Barat berikutnya
  setelah Jerman; bahasa Prancis juga berjangkauan luas (Prancis, Belgia, Swiss, Kanada-Québec, Afrika
  frankofon). Catatan jujur: peringkat trafik Last.fm #6+ di balik paywall Similarweb, jadi Prancis
  dipilih sebagai pasar Eropa besar berikutnya yang andal (bukan angka pasti).
- Registrasi `i18n.ts` + BCP-47 `fr-FR`; kamus `locales/fr.ts` **paritas 100% dengan id** (audit).
  Angka/tanggal `fr-FR` via Intl (mis. "1 234 567", "mai", "lun.").
- **Menguji fleksibilitas pluralisasi:** aturan jamak Prancis berbeda dari en/de/pt — **0 DAN 1
  keduanya tunggal** ("0 chanson", "1 chanson", "2 chansons"). Diterapkan `fr: n<2 ? 'one':'other'`
  (sesuai CLDR fr) & diverifikasi test. Infra lama menampungnya tanpa perubahan struktural.
- Detail Prancis via kunci sendiri: genderisasi artikel di `bab.noun` ("ce mois"/"cette année"),
  `stats.plays` netral-gender ("{count} écoutes"), tutoiement ("tu") konsisten.
- **Test baseline diperbarui:** `resolveLocale` dulu memakai `'fr'` sebagai contoh "tak dikenal";
  karena fr kini didukung, contohnya diganti `'zz'` (kode yang memang tak akan pernah nyata).
- **Review 5 putaran (ringkas):** korektnes — audit paritas 5 locale hijau + integrasi fr (termasuk
  0→tunggal, durasi, `resolveLocale('fr-FR')`); state — tak ada; error — semua `err.*` fr; WebView —
  Intl `fr-FR` (perlu validasi ICU device); aman — tanpa perubahan izin/rahasia.
- `npm test` hijau (**321**), `tsc` 0 error, `vite build` sukses. **Belum tervalidasi di device.**

### Added — bahasa ke-4: Deutsch (Jerman) — pasar Last.fm berikutnya setelah Brasil
- **Jerman (`de`)** ditambahkan penuh. Dasar: Jerman #4 trafik Last.fm (~5,9%, Similarweb Jan 2026),
  pasar bahasa-baru berikutnya setelah AS/UK/Kanada (Inggris) & Brasil (pt).
- Registrasi `i18n.ts` + BCP-47 `de-DE`; kamus `locales/de.ts` **paritas 100% dengan id** (dijamin
  audit). Angka/tanggal `de-DE` via Intl (mis. "1.234.567,5", "Mai", "Mo").
- **Perbaikan arsitektur untuk bahasa verba-akhir:** hero Bab/Album dulu memaku akhiran "." di JSX,
  jadi kalimat Jerman ("Im Mai hast du 210 Songs **gespielt**.") — yang verbanya di AKHIR — mustahil
  benar. Ditambah kunci `bab.hero.post` (id/en/pt = "."; de = " gespielt.") + layar memakainya. Kini
  pola i18n menampung SOV/verba-akhir tanpa hack. Detail Jerman lain ditangani lewat kunci sendiri:
  jamak datif "Von {count} Künstlern", artikel bergenre di `bab.noun` ("dieser Monat"/"dieses Jahr"),
  jamak "Künstler" yang tak berubah.
- Pemilih bahasa di Ajustes kini bisa **membungkus baris** (`flex-wrap`) karena sudah 4 opsi.
- **Review 5 putaran (ringkas):** korektnes — audit paritas 4 locale hijau + integrasi de
  (render/jamak/durasi/verba-akhir/`resolveLocale('de-DE')`); state — hanya `flex-wrap`; error — semua
  `err.*` de; WebView — Intl `de-DE` (perlu validasi ICU device); aman — tanpa perubahan izin/rahasia.
- `npm test` hijau (**317**), `tsc` 0 error, `vite build` sukses. **Belum tervalidasi di device.**

### Added — bahasa ke-3: Português (Brasil) — pasar scrobbler terbesar di luar Inggris
- **Portugis Brasil (`pt`)** ditambahkan penuh. Dasar pemilihan: Brasil adalah negara #2 trafik
  Last.fm (~11%, di bawah AS ~29%, di atas UK ~6% — Similarweb Jan 2026), komunitas non-Inggris
  terbesar. Membuktikan fondasi i18n benar-benar skalabel: cukup **satu file kamus + 4 baris registrasi**.
- Registrasi di `i18n.ts` (`LOCALES`/`Locale`/`PLURAL_RULES`/`LOCALE_PLURAL_CATEGORIES`) + tag BCP-47
  `pt-BR` di `i18nFormat.ts`. Kamus lengkap `locales/pt.ts` — **paritas 100% dengan basis id**
  (dijamin test audit; tak ada kunci hilang/asing), termasuk bentuk jamak `one/other`.
- Pemilih bahasa di Ajustes otomatis menampilkan opsi ke-3 ("Português (Brasil)") lewat `LOCALES.map`;
  deteksi otomatis dari bahasa perangkat (`navigator.language` `pt-BR` → `pt`) juga langsung jalan.
- Nama bulan/hari, pemisah ribuan, dan tanggal mengikuti `pt-BR` via `Intl` (mis. "1.234.567",
  "seg./ter./…", "maio"). Istilah domain "scrobble" dipertahankan; metafora tiket → "ingresso".
- Catatan jamak: pt memakai 1 → tunggal, selain itu → jamak (termasuk "0 músicas") — pilihan pragmatis
  & alami pt-BR, sedikit beda dari CLDR (yang menaruh 0 di kategori "one").
- **Review 5 putaran (ringkas):** korektnes — audit paritas 3 locale hijau + test integrasi pt
  (render/jamak/durasi/`resolveLocale('pt-BR')`); state — tak ada state baru, `LOCALES` menyetir picker
  & auto-deteksi; error — semua `err.*` diterjemahkan pt; WebView — `Intl pt-BR` (perlu validasi ICU di
  perangkat); aman — tak ada perubahan izin/rahasia.
- `npm test` hijau (**313**), `tsc` 0 error, `vite build` sukses. **Belum tervalidasi di device.**

### Added — i18n "utuh": pesan error terlokalkan + SETIAP elemen ikut bahasa (crash screen & gambar)
Melengkapi migrasi i18n: pesan error kini terjemah, dan celah "tidak ikut berganti bahasa" ditutup —
termasuk layar crash & teks pada gambar-bagikan. Total **303 → 310 test** (7 test baru appError).

- **Cermin locale tingkat-modul** (`getActiveLocale`/`setActiveLocale`/`tActive` di `i18n.ts`) —
  inti agar KODE NON-REACT ikut bahasa aktif. `I18nProvider` menyinkronkannya sinkron saat render,
  jadi `ErrorBoundary` (komponen class DI ATAS provider, tak punya context), renderer Canvas, dan
  penerjemahan error semua memakai bahasa yang sama dengan UI.
- **Error ditunda terjemahannya sampai titik tampil** (`appError.ts`): kelas `AppError {key, params}`
  + `toErrDescriptor`/`errText`/`errTextFor`. Prinsip: lib/hook TIDAK lagi menyimpan teks jadi
  (yang membeku pada bahasa saat error terjadi) — cukup bawa KUNCI; UI menerjemahkan saat render,
  jadi ganti bahasa saat pesan sedang tampil pun ikut berubah. (`appError.test.ts`)
  - `useMp3Editor` menyimpan kunci error (`err.mp3.*`), diterjemahkan di EditMetadata.
  - `parseBackup` melempar `AppError` berkunci (`err.backup.*`, mis. baris rusak bawa nomor baris) →
    Settings menerjemahkan via `errTextFor`.
  - Login menyimpan error sebagai deskriptor `{key, params}` (bukan string); sebab teknis jaringan
    dicatat ke console, ke pengguna tampil pesan bersih terlokalkan (bukan lagi pesan mentah lastfm).
  - Toast "gagal siapkan gambar" (Now Playing & Sisi B) kini simpan kunci → live-switch.
- **Layar crash (ErrorBoundary) ikut bahasa** — pakai `tActive('err.boundary.*')`.
- **Teks pada GAMBAR-bagikan ikut bahasa** (Canvas): zine Sisi B (SISI B/RECAP MINGGUAN/LAGU MINGGU
  INI/label statistik/nama hari/rentang minggu), kartu Now Playing ("SEDANG DIPUTAR", "TIKET №…"),
  dan tiket koleksi (label jenis, tanggal, baris "lewat …") — lewat `tActive`/`getActiveLocale()` +
  `formatMonth`/`formatWeekday`. Nama merek ("Scrola", "Every song leaves a story.") tetap.
- **Menutup "batas yang diketahui" dari entri sebelumnya:** (a) ErrorBoundary ✔, (b) error hook/lib
  (mp3, backup) ✔, (c) teks gambar-bagikan ✔. Sisa yang SENGAJA dibiarkan: string yang dilempar di
  dalam `lastfm.ts` (hanya muncul di diagnostik/console teknis, bukan UI) & invarian internal scrobble.
- **Review 5 putaran (ringkas):** korektnes — AppError/mirror/parseBackup teruji; state — cermin
  di-set sinkron & idempotent (aman StrictMode), error tersimpan sbg kunci → live-switch; error —
  fallback `err.generic`, sebab teknis tetap tercatat; WebView — hanya `Intl` aman + baca dict; aman —
  parameter error dirender sbg teks (ter-escape / fillText), tanpa rahasia/permission baru.
- `npm test` hijau (310), `tsc` 0 error, `vite build` sukses. **Belum tervalidasi di device.**

### Added — multibahasa TUNTAS: infra i18n diperkuat + SEMUA layar & komponen dwibahasa
Melanjutkan fondasi i18n di bawah. Kini seluruh UI benar-benar dwibahasa (id/en), bukan lagi hanya
tab & label tiket. Semua fungsi baru murni & ber-TDD; total **275 → 303 test** (28 test i18n baru).

- **Infra i18n diperkuat** (semua tanpa library, bundle tetap kecil):
  - Pluralisasi (`translatePlural`, `pluralCategory`) — konvensi kunci `key.one`/`key.other`. id satu
    bentuk, en one/other. Aturan ditulis sendiri (bukan `Intl.PluralRules`) agar deterministik lintas
    WebView. (`i18nPlural.test.ts`)
  - Format angka & tanggal per-locale via `Intl` bawaan — `i18nFormat.ts`: `formatNumber`, `formatDate`,
    `formatMonth`, `formatDayMonthYear`, `formatWeekday` (Senin-dulu). Formatter di-cache. SENGAJA tidak
    memakai `Intl.RelativeTimeFormat` (butuh WebView lebih baru) demi kompatibilitas. (`i18nFormat.test.ts`)
  - Audit kelengkapan kunci — `i18nAudit.ts`: `auditDictionaries`/`auditLocale`, sadar-jamak. Test
    menjamin `en` MENUTUPI penuh basis `id` (tak ada kunci hilang / kunci asing) → cegah drift kamus.
    (`i18nAudit.test.ts`, `i18nIntegration.test.ts`)
  - `useI18n()` kini mengekspos `t`, `tp` (jamak), `n` (angka), `d` (tanggal), `month`, `weekday`.
- **Migrasi layar & komponen (bukti-kerja → tuntas):** LoginScreen, HistoryScreen, NowPlayingScreen,
  PenemuanScreen, SisiBScreen, BabAlbumScreen, EditMetadataScreen, TiketKoleksiScreen, SettingsScreen,
  serta komponen NoteEditor, StoryTicket, SeekTimeline — semua teks tampil, placeholder, pesan error UI,
  dan `aria-label`-nya kini lewat `t()`/`tp()`. Kalimat naratif (Sisi B / Bab-Album) & hitungan pakai
  interpolasi + jamak. Array nama bulan/hari lokal (BULAN/MONTH_SHORT/MONTH_LONG/HARI) DIHAPUS, diganti
  `formatMonth`/`formatWeekday` (satu sumber, hemat baris).
- **Lib ikut dilokalkan** (mundur-kompatibel, `locale` default `id` → test & pemanggil lama utuh):
  `formatDurationHuman(sec, locale)`, `weekRangeLabel(sec, locale)`, dan label pengelompokan riwayat
  (`groupHistoryByDay`/`groupHistoryByPeriod` — "Hari ini/Kemarin/Minggu ini/Bulan ini/…"). `DayGroup`
  kini punya flag `isToday` supaya penyorotan UI tak lagi membandingkan string label.
- **Review 5 putaran (ringkas):**
  1. *Korektnes:* rantai fallback jamak & audit sadar-jamak diverifikasi via `i18nIntegration.test.ts`
     (id 1 bentuk; en 1↔banyak beda). `formatMonth`/`formatWeekday` membungkus indeks di luar rentang.
  2. *State:* nilai context di-`useMemo` pada `[locale]`; ganti bahasa me-render ulang. BabAlbum
     menyimpan `monthIndex` (bukan nama jadi), jadi nama bulan ikut ganti saat locale berpindah tanpa
     fetch ulang; SisiB menambah `locale` ke dep efek agar label minggu ikut menyegar.
  3. *Error:* `translate`/`translatePlural` tak pernah melempar (fallback ke kunci). Formatter Intl
     di-cache; tak ada promise baru tanpa catch.
  4. *WebView:* hanya `Intl.NumberFormat`/`DateTimeFormat` (tersedia luas); `RelativeTimeFormat`
     dihindari. **Perlu validasi device** untuk memastikan data ICU locale `id`/`en` lengkap di WebView.
  5. *Keamanan:* interpolasi pakai split/join (bukan regex/eval); output dirender React sebagai teks
     (ter-escape) → nama artis/lagu sebagai parameter aman. Tanpa rahasia/permission baru.
- **Batas yang diketahui (jujur, belum dikerjakan):** (a) `ErrorBoundary` (layar crash) tetap Indonesia —
  komponen class & sengaja tak bergantung pada i18n yang bisa jadi justru sumber crash-nya; (b) sebagian
  pesan error dari hook/lib (`useMp3Editor`, `lastfm.ts`, parser backup) masih Indonesia saat
  ditampilkan; (c) teks pada GAMBAR-bagikan (zine Sisi B & stub tiket via Canvas) tetap Indonesia —
  pipeline render terpisah, di luar lingkup migrasi ini.
- `npm test` hijau (303), `tsc` 0 error, `vite build` sukses. **Belum tervalidasi di device** (Gradle/CI
  & HP fisik) sesuai "Definisi Selesai".

### Added — fondasi multibahasa (i18n) ringan: Bahasa Indonesia + English
- Inti i18n TANPA library (bundle tetap kecil): `i18n.ts` (murni, TDD, **7 test baru**, total **275**)
  dengan `translate(locale, key, params)` (interpolasi `{x}`, fallback locale→id→kunci) & `resolveLocale`
  (mis. "en-US"→en). Kamus per-locale di `locales/id.ts` & `locales/en.ts` (id = basis).
- React: `I18nProvider` + hook `useI18n()` (`t`, `locale`, `setLocale`); membungkus app di main.tsx.
  Bahasa dideteksi dari perangkat saat pertama, bisa diganti manual, dan **disimpan** (`getSavedLocale`/
  `setSavedLocale` di preferences, pola SecureStore + cache). Ganti bahasa langsung me-render ulang UI.
- **Pemilih bahasa di Settings** (Bahasa Indonesia / English). Migrasi bukti-kerja: tab navigasi
  (Sekarang/Riwayat/Atur), label jenis tiket (Jejak/Penemuan/Setia/Beruntun/Momen), teks "N tiket
  terkumpul" & tombol Bagikan.
- tsc 0 error, brace seimbang. **Belum tervalidasi device.** Catatan: ini FONDASI — mayoritas string
  layar lain masih hardcode Indonesia; dimigrasikan bertahap ke sistem `t()` yang sama (tambah kunci di
  id.ts lalu terjemahkan di en.ts). Teks gambar-bagikan Canvas & label native belum ikut.

### Added — build terpasang sebagai UPDATE (tanpa uninstall) + log checklist validasi
- **Terpasang sebagai update, data aman.** Akar masalah "harus uninstall tiap build": CI membuat
  `android/` via `cap add android` lalu build debug APK yang ditandatangani `~/.android/debug.keystore`
  yang di-generate ACAK tiap run → tanda tangan beda → Android menolak install di atas versi lama.
  Kini keystore debug TETAP di-commit (`native-overlay/android/scrola-debug.keystore`, parameter debug
  standar) dan CI (build.yml & release.yml) menyalinnya ke `~/.android/debug.keystore` sebelum build →
  semua build ditandatangani sama → APK baru terpasang sebagai **update**, riwayat/tiket/koreksi tak
  hilang. (Ini keystore DEV, bukan untuk rilis Play Store.)
- **Log mencatat yang perlu divalidasi.** Saat app dibuka, `logValidationChecklist()` menulis stempel
  build + daftar item yang belum tervalidasi device ke log peristiwa (`validationChecklist.ts`, murni,
  **3 test baru**, total **268**). Screenshot log kini bisa ditelusuri ke build & langsung mengingatkan
  apa yang perlu dicek.
- tsc 0 error, brace seimbang. **Belum tervalidasi CI/device** (perlu 1x run CI + 1x install).

### Changed — notifikasi Scrola hilang otomatis saat diam (tak lagi menggantung lagu terakhir)
- Notifikasi foreground Scrola dulu terus menampilkan lagu TERAKHIR walau tak ada yang diputar (sifat
  media Android: sesi tetap hidup dalam keadaan paused). Kini saat playback dijeda/diam,
  `ScrobbleForegroundService` menjadwalkan penghapusan notifikasi otomatis setelah 2 menit
  (`stopForeground(REMOVE)` + `stopSelf`); saat listener mendeteksi playback baru (`update(isPlaying=true)`),
  jadwal dibatalkan & notifikasi muncul lagi. Aturan foreground tetap dipatuhi (startForeground
  dipanggil segera; hanya penghentiannya yang ditunda). onDestroy & ACTION_STOP membatalkan jadwal.
- Kosmetik & tak memengaruhi scrobble (digerbang status PLAYING + ambang + dedup). Notifikasi milik
  app sumber (Spotify/YouTube Music) tetap di luar kendali Scrola. Perubahan native — **belum
  tervalidasi device** (uji: putar → jeda → tunggu 2 mnt → notifikasi Scrola hilang → putar lagi →
  muncul kembali).

### Changed — kembalikan framing "Trofi" jadi tiket, jam dengar di tiap tiket, emblem mencolok
- **Konsep disatukan kembali sebagai TIKET.** Label kategori "TROFI" diganti "MOMEN" (di aplikasi &
  gambar bagikan) — pencapaian berpola (Burung Hantu, Ayam Jago, dst.) tetap ada, tapi dibingkai
  sebagai tiket koleksi, bukan trofi game terpisah. Jenis internal & serial `SCR-T-…` dipertahankan
  agar tiket yang sudah didapat tak bergeser.
- **Jam dengar di tiap tiket.** `formatEarned` (kartu & gambar bagikan) kini menampilkan tanggal +
  jam, mis. "11 Agu 2026 · 05.02" (format Indonesia, pemisah titik).
- **Tiap tiket mencolok unik.** Emblem musik generatif (yang tadinya hanya di gambar bagikan) kini
  tampil di SETIAP kartu di Koleksi Tiket — komponen `TicketEmblem` merender emblem per lagu+jenis di
  kanvas mini (dpr-aware). Tiap tiket langsung terlihat berbeda sekilas.
- tsc 0 error, 265 test, brace seimbang. **Belum tervalidasi device** (render emblem kanvas mini di
  daftar + jam dengar).

### Added — sistem TROFI (pencapaian ala game) + backup tiket & koreksi
Menjawab: "pastikan tiap tiket unik seperti trophy game (bukan sekadar sering diputar / pertama
didengar)" dan "pastikan data tiket & lainnya bisa di-backup".

- **Jenis tiket baru `trofi`** — pencapaian BERPOLA/PERISTIWA, bukan hitungan putar. `trophies.ts`
  (murni, TDD, **8 test**): Burung Hantu (dengar 00–04), Ayam Jago (subuh 04–06), Maraton (30
  scrobble/hari), Jam Sibuk (15 scrobble/60 mnt), Kembali Pulang (jeda 30+ hari), Hari Beragam (20
  artis berbeda/hari). Tiap trofi bernama, one-of-a-kind, dicetak SEKALI, deterministik dari riwayat.
  Serial global `SCR-T-00000N`; ikon emblem khusus (medali berbintang).
- **Backup tiket — sudah terjamin & kini terbukti.** Tiket = fungsi deterministik dari riwayat, dan
  riwayat (artist/track/timestamp) ada di backup → restore meregenerasi tiket identik. Ditambah test
  round-trip yang membuktikan `computeEarnedTickets` sama persis sebelum/sesudah serialize→parse.
- **Backup koreksi (data user yang tadinya belum ter-backup).** Envelope backup kini menyertakan
  `corrections`; `mergeCorrections` (murni, non-destruktif — aturan lokal tak ditimpa) + `mergeInCorrections`
  di store; `buildBackupJson`/`restoreFromJson` membaca & memulihkannya; ringkasan restore menampilkan
  "N koreksi dipulihkan". **4 test backup baru.**
- Total **265 test**, tsc 0 error, brace seimbang. **Belum tervalidasi device.**

### Added — aturan perolehan tiket SETIA & BERUNTUN
- Jenis tiket `setia` & `beruntun` (yang ikonnya sudah dibuat) kini benar-benar BISA DIPEROLEH,
  dihitung deterministik dari riwayat di `computeEarnedTickets` (TDD, **5 test baru**, total **253**):
  - **SETIA** — satu artis mencapai N putar (default `[25, 50, 100, 250]`). Subject = artis; serial
    ber-hash subjek (`SCR-S-000050-xxxx`) karena banyak artis bisa mencapai milestone sama; `earnedTrack`
    = lagu pada putaran ke-N artis itu.
  - **BERUNTUN** — streak hari beruntun (ada scrobble tiap hari, default `[3, 7, 14, 30, 100]`).
    Serial global (`SCR-B-000007`); dicetak SEKALI saat streak pertama kali mencapai milestone;
    `earnedTrack` = scrobble hari penutup streak. Beberapa scrobble di hari sama tak menambah streak.
- Otomatis muncul di Koleksi Tiket (getTicketCollection pakai config default) lengkap dengan ikon
  per-jenis (SETIA=riak, BERUNTUN=gelombang) dan tombol bagikan. Serial semua jenis tetap deterministik
  & stabil. tsc 0 error, brace seimbang. **Belum tervalidasi device.**

### Added — ikon musik generatif per-JENIS tiket (album-art khas Scrola)
- Tiket tak menyimpan cover album & menarik cover Last.fm ke Canvas bermasalah (CORS -> taint ->
  gagal export). Solusinya: **ikon musik generatif**, unik per lagu, on-brand, deterministik, tanpa
  jaringan — dan kini **tiap JENIS tiket punya bentuk berkarakter sendiri**:
  - **JEJAK** -> spektrum equalizer radial ("audio bloom") — perjalanan scrobble menumpuk.
  - **PENEMUAN** -> konstelasi (bintang berjarak + garis) — menemukan bintang baru (vibe malam).
  - **SETIA** -> riak/mandala (busur konsentris berjeda) — kembali berputar.
  - **BERUNTUN** -> gelombang mendatar — momentum tak putus.
- `emblemSeed(ticket)` (murni, TDD, total **248** test): seed dari LAGU (artist|track), fallback serial.
  Renderer `drawTicketEmblem(...kind)` memakai PRNG mulberry32 → bentuk tetap UNIK per lagu di dalam
  tiap jenis, tetap keluarga Scrola (bingkai stempel + palet Hutan Malam + aksen amber/coral by seed).
- Layout: judul -> IKON (pusat) -> artis/lagu/tanggal -> cap serial -> atribusi. Mockup PIL memperlihatkan
  4 jenis. tsc 0 error, brace seimbang, tanpa kode mati. **Belum tervalidasi device.**

### Added — bagikan tiket sebagai gambar (stub 9:16) — unit iklan organik
- Tiap tiket koleksi kini bisa dibagikan sebagai **gambar stub vertikal 1080×1920** (format WhatsApp
  Status / Instagram Story — kanal berbagi dominan di Indonesia). Tombol "↗ Bagikan" di tiap tiket →
  render Canvas → `SharePlugin.shareImage` (pola & plumbing sama dengan zine Sisi B, tanpa dependensi
  baru).
- **Keunikan & fungsi-iklan by design:** (1) **cap № serial** jadi hero (bukti "diperoleh", serial
  rendah = early-adopter); (2) **lagu pemicu** + milestone bercerita; (3) **pola guilloche
  unik-per-serial** (deterministik dari `ticketPatternSeed`, seperti uang kertas — sulit ditiru); (4)
  **atribusi menyatu** di gambar (wordmark "Scrola" + "Every song leaves a story." + "scrola.app")
  supaya tiap tiket yang dibagikan menarik install.
- Pure-logic + TDD: `ticketShareLayout.ts` (`ticketPatternSeed` deterministik, `ticketEarnedLine`)
  **6 test baru**, total **245**. Renderer `ticketShareImage.ts` (Canvas). Mockup PIL
  `scripts/mockup_ticket_share.py` untuk persetujuan layout.
- tsc 0 error, brace seimbang. **Belum tervalidasi device** — perlu cek render Canvas + share sheet di
  SM-X706B (font Fraunces/IBM Plex Mono, `№`, guilloche). Serverless → rarity bersifat pribadi
  ("1 dari 1 milikmu"), tak menjanjikan kelangkaan global.
- Dari pertanyaan device: tiket JEJAK ("Scrobble pertamamu", "Scrobble ke-100") tak menampilkan lagu
  karena merayakan JUMLAH, bukan satu lagu. Kini **setiap tiket** (semua jenis, termasuk yang akan
  ditambahkan nanti) menyimpan **lagu pemicunya** lewat field baru `CollectibleTicket.earnedTrack`:
  jejak ke-N = scrobble ke-N; penemuan = lagu yang mengenalkan artis itu.
- **Serial tetap** — `earnedTrack` hanya untuk TAMPILAN; `ticketSerial` tak berubah (jejak dari
  ordinal, penemuan dari artis), jadi tiket yang sudah terkumpul tak bergeser. Diuji eksplisit
  (**3 test baru**, total **239**): earnedTrack benar + serial tak berubah.
- UI `TiketKoleksiScreen`: jejak menampilkan "Artis — Judul"; penemuan (artis sudah tampil) menampilkan
  "lewat 'Judul'". Data sudah tersedia dari query tiket (`SELECT artist, track, timestamp`) — tanpa
  perubahan skema/query. tsc 0 error, brace seimbang. **Belum tervalidasi device.**
- Dari feedback device: mode Per hari/minggu/bulan menampilkan daftar penuh menjulur ke bawah. Kini
  dipaginasi **10 lagu per halaman** dengan bar navigasi (‹ Sebelumnya / Berikutnya ›, "1–10 dari 26 ·
  Hal 1/3") di atas & bawah daftar. Mode **Terbaru** tetap 10 tanpa paging (1 halaman).
- Pure-logic + TDD: `paginateHistory(items, page, pageSize=10)` (**5 test baru**, total **236**) —
  memotong per halaman & meng-clamp halaman di luar rentang (aman saat ganti mode/item berubah).
  Alur baru: item mode → **paginate** → group **halaman ini** (bentuk grup identik → rendering tak
  berubah). Halaman reset ke 0 saat mode berganti.
- Murni logika + React (tanpa native). tsc 0 error, brace seimbang. **Belum tervalidasi device** —
  cek: mode Per hari dgn >10 lagu menampilkan bar, Berikutnya/Sebelumnya berpindah halaman, tombol
  nonaktif di ujung.
- Logika filter per-sumber (`shouldScrobbleSource` + `getIgnoredSources`/`toggleIgnoredSource`,
  diterapkan di drain & real-time) sudah ada dari sesi sebelumnya; sesi ini **melengkapi UI-nya** di
  Settings. Chip "Sumber terdeteksi" kini **bisa diketuk** untuk membisukan/mengaktifkan scrobble dari
  app itu (dibisukan = dicoret + 🔇), dengan hint bahwa ini berguna untuk app menonton video (mis.
  YouTube utama) tanpa mematikan sumber musik lain.
- Menjawab kebutuhan pengguna dari log device: "Key & Peele" ter-scrobble dari
  `com.google.android.youtube` (app YouTube utama, mayoritas video). Membisukan sumber itu menghentikan
  tontonan ter-scrobble secara deterministik, sementara Spotify & YouTube Music tetap jalan. (Catatan:
  ini per-APP; tak bisa memisah musik vs video DI DALAM app yang sama — batasan semua scrobbler notif.)
- Optimistic + rollback bila persist gagal. tsc 0 error, 231 test lolos, brace seimbang. **Belum
  tervalidasi device** — perlu cek: ketuk sumber → jadi dibisukan → scrobble berikutnya dari sumber itu
  tak muncul.
- Riwayat kini punya pemilih mode: **Terbaru** (default, hanya **10 lagu terakhir**), **Per hari**,
  **Per minggu**, **Per bulan** (ketiganya menampilkan riwayat **UTUH** dikelompokkan per periode), dan
  **Bercatatan** (hanya lagu yang punya catatan). Sesuai permintaan: default ringkas, periode = lengkap.
- Pure-logic + TDD (**6 test baru**, total **226**): `groupHistoryByPeriod` (day/week/month — label
  "Minggu ini"/"Minggu lalu"/rentang & "Bulan ini"/"Bulan lalu"/"Nama Tahun", memakai ulang
  `startOfIsoWeek` & `weekRangeLabel` yang sudah ada), `filterHistoryWithNotes`, `recentHistory`. Semua
  menghasilkan bentuk grup identik dengan `groupHistoryByDay` → rendering Riwayat tak berubah.
- Data: `getAllHistory()` (query utuh) dimuat **lazy** hanya saat mode non-Terbaru dipilih; mode
  Terbaru tetap ringan (10 dari prop yang sudah dimuat). Ada state loading & empty-state khusus
  ("Belum ada catatan" untuk mode Bercatatan).
- Murni logika + React (tanpa native baru). `tsc` 0 error, brace seimbang. **Belum tervalidasi
  device** — perlu cek tampilan pemilih & pengelompokan periode di SM-X706B.
Dari feedback device (file lokal tanpa tag ID3 tampil sebagai `audio%3A...` / "Tidak dikenal" tapi
tetap menghitung mundur untuk scrobble):

- **A. Metadata sampah tak di-scrobble.** `isScrobbableMetadata(artist, track)` (murni, TDD, **6 test
  baru**, total **220**) menolak artist kosong/placeholder ("Tidak dikenal"/"Unknown") dan judul yang
  sebenarnya content-URI/document-id (`audio%3A…`, `content://…`). Di-guard di `enqueueScrobbleNoFlush`
  (chokepoint SEMUA jalur scrobble) — file tanpa metadata jelas TIDAK mengotori profil Last.fm sampai
  jelas (mis. setelah tag diedit). `NowPlayingScreen` kini menampilkan "metadata belum jelas — edit tag
  dulu" alih-alih hitung mundur menyesatkan, dan tak memunculkan toast "tercatat".
- **B. Edit tag lagu yang sedang diputar → langsung ke editornya.** Dulu tombol edit membuka picker
  kosong (user harus cari ulang MP3). Sekarang: metode native baru `Mp3Metadata.readMetadata(uri)`
  (baca tag dari URI tanpa picker) + `useMp3Editor.loadUri` + `EditMetadataScreen initialUri` +
  `NowPlayingScreen` meneruskan URI file yang diputar (hanya `content://` lokal). Agar bisa **disimpan**,
  file-pick `PlayerPlugin` kini mengambil izin **READ|WRITE** persisten (fallback READ bila provider tak
  memberi write) — selaras dengan editor yang memang menulis ulang file.
- Validasi di sini: tsc 0 error, 220 test, brace `.ts/.tsx/.kt` seimbang. **Task B belum tervalidasi
  device** & bergantung perilaku SAF: (1) URI pemutar dapat dibaca editor, (2) izin WRITE benar-benar
  diberikan provider sehingga SIMPAN berhasil. Wajib diuji: putar file lokal → tap edit (✎) → editor
  terbuka dengan file itu → ubah → simpan → berhasil.
- Dari screenshot device: `com.samsung.android.honeyboard` (keyboard Samsung) muncul sebagai "sumber"
  karena punya MediaSession, padahal tak pernah melaporkan judul/artis (tak mungkin ter-scrobble) —
  cosmetic/berpotensi membingungkan. `isLikelyMusicSource` (murni, TDD, **5 test baru**, total **214**)
  menyaring keyboard/IME/launcher/systemui dari daftar tampil, mempertahankan app musik dikenal DAN
  paket tak dikenal lain (sesuai filosofi sourceLabels: perlihatkan yang tak dikenal untuk identifikasi).
- **Validasi device (screenshot 02.46):** UI ketiga tab render mulus; H4/H5/H6 lolos (deteksi, log,
  antrean jujur "kosong"); A3 sebagian (jam Riwayat berurutan & wajar, tak menumpuk); UI Cadangan Data
  & Backstage Pass tampil benar; teks CJK render benar di Riwayat. Ditandai di `docs/VALIDASI_DEVICE.md`.
  Dikonfirmasi bukan-bug: "Sh**ting Stars" = metadata sumber (Scrola tak menyensor teks).

### Fixed / Security — audit menyeluruh 5 putaran
- **Putaran 1 (build/tipe):** memperbaiki **2 error `tsc` pra-ada** (`Intl.Segmenter` tak dikenal
  di `lib` tsconfig) dengan menambah `ES2022.Intl` — kode-nya sendiri sudah dijaga runtime + fallback.
  **`tsc` kini 0 error** (dulu 2). Brace `.ts/.tsx/.kt` semua seimbang; tak ada TODO/FIXME tertinggal.
- **Putaran 2 (logika/async):** tak ada `==` longgar (hanya idiom `== null` & komentar), tak ada
  floating promise, tak ada `console.log` sisa. Integrasi backoff (outcome terminal, state ditulis
  hanya dalam guard `isFlushing`) & urutan restore (id lokal tak ter-invalidasi insert) ditelaah — bersih.
- **Putaran 3 (keamanan):** semua query DB **parameterized** (tak ada interpolasi SQL); secret Last.fm
  dari `import.meta.env` (`.env*` di-gitignore, ada placeholder-guard); izin manifest minimal (editor
  MP3 via SAF, tanpa izin storage); tak ada `dangerouslySetInnerHTML`/`eval`. **Fixed (hardening):**
  `SharePlugin.shareFile/shareImage` kini menyanitasi `filename` ke basename aman (defense-in-depth
  anti path-traversal; sebelumnya tak tereksploitasi karena filename selalu dari kode kita).
- **Putaran 4 (konkurensi/lifecycle):** semua guard (`isFlushing`/`syncingRef`/`sharingRef`) reset di
  `finally`; `setInterval` di-clear; listener React & native dilepas di cleanup. Tak ada leak baru.
- **Putaran 5 (integritas data):** restore backup **terbukti non-destruktif** (nol delete/clear/
  overwrite di jalurnya); tak ada `catch` kosong penelan-error atau `as any` di modul baru.
- **Batas jujur:** ini audit **statis** (tipe, pola, telaah logika, grep keamanan) — mempersempit
  ruang bug, TAPI tidak menggantikan validasi device. "Bebas bug" penuh tetap butuh uji di SM-X706B
  (lihat `docs/VALIDASI_DEVICE.md`). Verifikasi akhir: **tsc 0 error, 209 test lolos.**
- Menutup item roadmap v0.3.0 yang tersisa: kurasi "Penemuan" sebagai layar tersendiri, bukan
  sekadar angka. Mengubah stat "penemuan baru" di Sisi B jadi cerita yang bisa ditelusuri — tiap
  artis yang pernah ditemukan, lagu yang mengenalkannya, kapan, dan berapa kali diputar.
- `discoveryLogic.ts` (MURNI, TDD, **7 test baru**): `computeDiscoveries` — satu entri per artis
  (dinormalkan case/spasi), memakai kemunculan PALING AWAL sebagai penemuan, diurut terbaru dulu,
  mengabaikan artist kosong. Total **209 test lolos**.
- `PenemuanScreen.tsx` — overlay (pola sama Bab/Album) yang mengomposisi `getAllHistoryForBackup`
  (query yang sudah ada) dengan `computeDiscoveries`. Kartu stat "Penemuan" di Sisi B kini bisa
  di-tap untuk membuka linimasa lengkap.
- Murni logika + React (tanpa native baru). `tsc` bersih (rantai App→SisiB→Penemuan→query typecheck),
  brace seimbang. **Belum tervalidasi device** — tampilan & navigasi perlu dicek di SM-X706B.
- `docs/REFERENSI_TAG_EDITOR.md`: studi app editor tag ID3 open-source (spkdroid/Mp3-Tag-Editor yang
  juga pakai **mp3agic** → memvalidasi pendekatan Scrola; Metadator yang pakai **TagLib** multi-format;
  serta jaudiotagger). Memetakan baseline Scrola (mp3agic, SAF temp-file, pertahankan tag, downscale
  art) vs yang layak diadopsi. **Prioritas #1: encoding Unicode** — plugin belum set encoding, ikut
  default mp3agic; untuk app berbahasa Indonesia, teks non-Latin/CJK berisiko mojibake bila ditulis
  ISO-8859-1 (wajib uji device + paksa UTF-16/UTF-8). Juga: picture-type album art, salin-balik lebih
  aman. Sikap dijaga: TIDAK meniru kelengkapan Metadator (batch/lirik/multi-format) — editor Scrola
  sengaja ramping sebagai pelengkap scrobbler. Catatan lisensi: Metadator AGPL-3.0 → pelajari pola,
  jangan salin kode ke Scrola (GPL-3.0). Ditautkan dari README. Dokumen saja — 202 test tetap.
- Implementasi rekomendasi #1 dari `docs/REFERENSI_SCROBBLE_PANO.md`. Sebelumnya flush di-retry pada
  interval TETAP 20 dtk; saat Last.fm rate-limit (kode 5/29) atau jaringan down, Scrola menghantam
  tiap 20 dtk dan — dikombinasi `MAX_ATTEMPTS=8` — bisa **membuang scrobble sah** dalam hitungan menit.
- `backoffPolicy.ts` (MURNI, TDD, **8 test baru**): `backoffDelayMs` (eksponensial base 20s ×2^n,
  batas 30 mnt), `canAttempt`, `nextBackoffState`. `flushQueue` kini: cek `canAttempt` sebelum flush
  (lewati bila dalam jendela backoff); `flushQueueOnce` mengembalikan `FlushOutcome`
  (`ok`/`noop`/`rate_limited`/`error`) → sukses reset backoff, gagal/rate-limit menaikkan jeda.
- Drain native TIDAK terpengaruh (tetap memindah pending → antrean JS); hanya flush jaringan yang
  di-gate. State backoff in-memory (reset saat app restart = percobaan segar). Timer 20 dtk tetap;
  tick yang jatuh dalam jendela backoff dilewati.
- Validasi: **202 test lolos**, `tsc` bersih, brace seimbang. Belum tervalidasi device — harap log
  saat jaringan diputus menunjukkan jeda retry yang MEMBESAR (mis. `flush error → backoff ~40s`),
  bukan spam tiap 20 dtk; dan setelah jaringan pulih, satu flush sukses lalu cadence normal kembali.
- `docs/REFERENSI_SCROBBLE_PANO.md`: studi pola submit pending-scrobble Pano Scrobbler (GPL-3.0, dari
  sumbernya — `PendingScrobblesWorker`, DAO, penjadwalan WorkManager) sebagai pembelajaran, bukan
  salinan kode. Memvalidasi keputusan Scrola yang sudah ada (batch 50, serialisasi submit via
  `syncingRef`/`isFlushing`, timeout jaringan, permanen-vs-transien kode 5, urutan terlama-dulu) dan
  mengidentifikasi penghalusan berprioritas: **backoff + retry-after saat gagal** (mencegah scrobble
  sah terbuang oleh MAX_ATTEMPTS saat rate-limit sementara), **cabang error top-level** (9 sesi vs 29
  rate-limit), dan **jeda antar batch + HARD_LIMIT per flush**. Termasuk pelajaran dari bug-report Pano
  (pending stuck #8/#562 → jaga guard/timeout; repeat pause-resume #570). Ditautkan dari README.
  Dokumen saja — tak menyentuh kode; 194 test tetap.
- Terdiagnosis dari log device 16:04: batch-drain 3 track latar terpecah jadi `KIRIM 2` lalu
  `KIRIM 3` (2 track terkirim ulang) karena `syncScrobbles` (dipicu dari buka-app / kembali-foreground
  / timer 20 dtk) bisa **tumpang-tindih dengan dirinya sendiri**: sync #2 memanggil `flushQueue`
  selagi drain #1 masih meng-enqueue → flush menyela di tengah drain.
- **Tidak ada kerusakan data** (dikonfirmasi dari kode): `drainAll` native atomik (`synchronized`,
  baca+hapus) → tak ada double-drain; riwayat lokal benar; timestamp asli terjaga; Last.fm dedup
  mencegah duplikat terlihat. Isunya efisiensi/keutuhan batch, bukan korupsi.
- Fix: guard `syncingRef` di `App.tsx` menjadikan drain→flush→reload **satu unit atomik**; pemicu yang
  datang saat sync berjalan dilewati (timer 20 dtk berikutnya menyusul). Batch-drain kembali utuh
  (`KIRIM N` sekali). Guard React murni (pola sama dgn `sharingRef`) — divalidasi kode + tsc; 194 test
  tetap lolos. Belum tervalidasi device: harap log berikutnya menunjukkan satu `KIRIM N` tanpa
  `KIRIM` pecah saat drain backlog.
- **Hasil uji device (08:12, log A2):** 56 track backlog lintas-pemutar (YouTube Music + Spotify)
  ter-drain jadi **2 batch (15 + 41), 56/56 diterima, 56 baris ditulis** — batch-drain & tangkap
  latar lintas-pemutar TERVALIDASI. TAPI target "satu KIRIM N bersih" BELUM tercapai: masih ada flush
  menyela di tengah drain. Sumbernya (dari kode) BUKAN tumpang-tindih `syncScrobbles` (itu sudah
  ter-guard) melainkan jalur **real-time** `enqueueScrobble`→`flushQueue`: lagu yang sedang diputar
  jadi layak scrobble di tengah drain. Dampaknya **kosmetik** di kasus ini (15+41 = 2 panggilan API,
  sama dengan 50+6), walau untuk backlog lebih besar bisa menambah 1 panggilan. Sengaja **tidak
  diperbaiki** dulu: menambah guard lagi ke jalur submit yang baru tervalidasi berisiko > manfaat.

### Added — backup/restore data (catatan & favorit) via file JSON
- Catatan per-lagu adalah data buatan-pengguna yang tak tergantikan. Upgrade di tempat tidak
  menghapusnya, TAPI reinstall / ganti HP / "Clear data" / APK berkunci-beda menghapusnya — dan
  `allowBackup="false"` (sengaja, demi privasi) berarti tak ada jaring cloud. Kini ada backup manual
  JSON: file dipegang pengguna, tanpa cloud, selaras positioning privasi.
- **Core murni** `backupData.ts`: `serializeBackup` (envelope berversi), `parseBackup` (validasi ketat
  → menolak file rusak/bukan-backup dgn pesan jelas), `mergeBackup` (**NON-DESTRUKTIF**: pulihkan
  catatan hanya ke baris yang belum bercatatan, sisipkan baris hilang, favorit aditif — tak pernah
  menimpa/mengosongkan catatan lokal atau meng-unfavorite; konflik dicatat, lokal menang). TDD, 11 test.
- **Wiring:** `backupService.ts` (orkestrasi DB+merge); query `getAllHistoryForBackup` +
  `insertBackupRows` (insert restore lengkap dgn note & loved, atomik via executeSet); method native
  `shareFile` di plugin Share Kotlin (menulis JSON ke cacheDir → FileProvider → share sheet — **tanpa
  dependensi npm/SDK baru**); tombol **Buat cadangan** (export) & **Pulihkan dari file** (import via
  `<input type=file>` WebView → FileReader → parse → merge → terapkan) di `SettingsScreen`, dengan
  ringkasan hasil ("X catatan dipulihkan · Y favorit · Z konflik dipertahankan").
- Validasi: **194 test lolos**, `tsc` bersih (rantai backupService→queries→share→SettingsScreen
  typecheck), brace `.ts/.tsx/.kt` seimbang. Bagian native (`shareFile`) + import file **belum
  tervalidasi device** — bukti akhir: CI + uji export→simpan→install ulang→pulihkan di SM-X706B.

### Docs — positioning pasar Indonesia diformalkan
- `docs/POSITIONING.md` baru: mengonsolidasikan positioning yang selama ini tersebar (README,
  `DESIGN.md` §kompetitif, `RELEASES.md` §"Kenapa Scrola?") jadi satu pernyataan posisi pasar
  Indonesia yang eksplisit — untuk siapa, wedge lokal (Bahasa Indonesia lebih dulu, identitas
  naratif/cetak yang mudah dibagikan, ringan/tanpa telemetri), perbandingan jujur vs Pano Scrobbler
  (termasuk overlap listener yang harus diakui), dan pemetaan ke materi publik.
- **Sengaja tanpa angka pasar karangan** (etos kejujuran): ada bagian "Data yang perlu divalidasi"
  yang mencatat data empiris apa yang harus dikumpulkan maintainer sebelum klaim dipertajam.
- Ditautkan dari daftar dokumen README. Menutup item roadmap "positioning pasar Indonesia (belum
  diformalkan)". Perubahan dokumen saja — tak menyentuh kode; suite tetap 183 test.

### Fixed — serial zine kini stabil per minggu & selaras dgn sistem serial tiket
- Serial zine sebelumnya (dibuat di giliran yang sama) memakai suffix `totalTracks % 10000`: (a)
  BERUBAH kalau zine minggu yang sama dibagikan ulang setelah scrobble bertambah — padahal serial
  "koleksi" harus tetap; (b) rawan tabrakan; (c) tidak memakai konvensi hash serial yang sudah ada.
- `zineSerial(weekStartUnixSec)` dipindah dari inline (tak teruji) ke `sisiBZineLayout.ts` (murni,
  teruji), kini HANYA bergantung minggu, dan suffix-nya memakai `subjectHash` (djb2) yang sama dengan
  `ticketSerialLogic.ts` → bahasa serial konsisten di seluruh app. Format tetap `SB-YYYY-Wnn-XXXX`
  (tampilan yang sudah disetujui), tapi XXXX kini hash stabil, bukan angka yang bisa berubah.
- TDD RED→GREEN, **3 test baru** (format, determinisme/stabilitas, minggu berbeda→serial berbeda).
  Total **183 test lolos**. Catatan: sebelum ekspor zine pernah dipakai luas, tak ada serial lama
  yang perlu dimigrasikan — aman.

### Added (v0.3.0) — ekspor zine Sisi B
- Item roadmap "Sisi B sebagai zine/share yang bisa diekspor" — SELESAI (di balik proof device).
  Cek existing dulu: `SisiBScreen`/`BabAlbumScreen`/`TiketKoleksiScreen` + logikanya sudah ada; yang
  kurang HANYA ekspor gambar (baris ~248 `SisiBScreen` sebelumnya placeholder jujur "belum tersedia").
- `sisiBZineLayout.ts` — modul MURNI: `weekRangeLabel` (rentang minggu Indonesia, ringkas lintas
  bulan/tahun), `dayBarHeights` (normalisasi 7 hari, aman nol), `peakHourLabel`, `DAY_LABELS_ID`.
  TDD RED→GREEN, **11 test baru** (total **180 lolos**).
- `sisiBZineImage.ts` — `renderSisiBZine(stats, weekStartUnixSec)` menggambar zine 1080×1920 via
  Canvas (mengikuti pola `shareImage.ts`: nol dependensi, tunggu `document.fonts.ready`, base64 PNG),
  tema Hutan Malam: perforasi, masthead rentang minggu, lagu teratas, bar chart mingguan (hari puncak
  disorot), grid statistik, strip jam puncak, serial koleksi dekoratif, tagline.
- `SisiBScreen` — placeholder diganti tombol "Bagikan sebagai zine" sungguhan → `renderSisiBZine`
  → `SharePlugin.shareImage` (pipeline sama dengan share tiket Now Playing), lengkap dgn state
  loading & pesan error.
- `scripts/mockup_sisib_zine.py` — mockup PIL sebagai proxy visual (disetujui) sebelum Canvas dibangun.
- Validasi: `tsc` bersih (2 error `Intl.Segmenter` pra-ada), 180 test lolos, brace `.ts/.tsx` seimbang.
  Renderer Canvas tak bisa dijalankan di lingkungan ini → **belum tervalidasi device**; bukti akhir
  tetap CI + tampilan share di SM-X706B.

### Fixed — scrobble yang ditolak karena batas harian tak lagi dibuang (kode 5)
- `parseScrobbleResponse` dulu memperlakukan **semua** `ignoredMessage.code` non-nol sebagai
  "ditolak permanen → buang". Padahal per dok resmi Last.fm hanya kode 1-4 (artist/track diabaikan,
  timestamp terlalu tua/baru) yang permanen; **kode 5 = batas scrobble harian** bersifat sementara.
  Membuangnya = kehilangan scrobble sah, bertentangan dengan etos app.
- Kini parse mengembalikan `retryableIndexes` (subset ignored berkode 5). Di `flushQueueOnce`:
  diterima + ditolak-permanen dihapus dari antrean seperti biasa; yang **transien ditahan di
  antrean** (`markQueueAttemptFailed`, jadi tetap terbatas `MAX_ATTEMPTS` bila limit bertahan lama),
  lalu flush **dihentikan** siklus itu (batch berikutnya pasti kena limit sama — hindari menghantam
  Last.fm dalam loop). Sisa antrean dicoba lagi pada flush berikutnya.
- Kode `ignoredMessage` diverifikasi langsung dari dok resmi Last.fm (track.scrobble), bukan ingatan.
- **Pure-logic + TDD:** RED→GREEN, **5 test baru** untuk klasifikasi transien/permanen (kode string
  & number, campuran, semua-5, semua-sukses). Total **169 test lolos**. `tsc` bersih (2 error
  `Intl.Segmenter` pra-ada). Belum tervalidasi device (kasus ini langka — perlu backlog masif
  menembus batas harian); bukti akhir tetap CI + device.

### Changed — position-poll adaptif (tindak lanjut Temuan 2 audit RAM)
- `PlayerPlugin` dulu repost poll posisi **tiap 1 dtk tanpa syarat** sepanjang WebView hidup —
  termasuk saat `PlaybackService.instance == null` (internal player tak pernah dipakai, kasus umum
  karena mayoritas sesi hanya scrobble Spotify eksternal). Bangun CPU tiap detik tanpa emit apa pun.
- Kini interval adaptif: **1 dtk saat playing** (perilaku lama persis — progress bar & eligibility
  tak berubah), 2 dtk saat pause, 3 dtk saat tak ada internal player (+lewati emit). Keputusan
  interval dipisah ke `nextPollDelayMs(playing, hasService)` agar niatnya eksplisit.
- Loop **tidak** pernah berhenti total selama plugin hidup (hanya melambat), jadi begitu playback
  lanjut, seek-bar pasti pulih tanpa pemicu eksternal — sengaja dipilih untuk menghindari risiko
  seek-bar freeze setelah resume. Penghentian penuh tetap hanya di `handleOnDestroy()`.
- Murni Kotlin lifecycle (tak ada harness JVM di lingkungan ini) → divalidasi lewat pembacaan kode +
  brace-balance semua `.kt` seimbang + 164 test TS tetap hijau. **Bukti akhir: CI + device.**

### Changed — drain backlog kini per-batch (≤50), bukan 1 API call/track
- **Sebelumnya:** `drainAndFlushNative` memanggil `enqueueScrobble` per track, dan tiap enqueue
  langsung flush → tiap track jadi satu panggilan `track.scrobble` sendiri (terlihat di log device
  13:13: `scrobbleBatch KIRIM: 1 track` berulang 14×). Untuk backlog ratusan track (offline lama)
  ini jadi ratusan round-trip berurutan — lambat & rawan throttle Last.fm.
- **Sekarang:** `enqueueScrobble` dipecah jadi `enqueueScrobbleNoFlush` (enqueue saja) + versi biasa
  (enqueue + flush, untuk scrobble real-time tunggal). Drain memakai NoFlush untuk SEMUA track lalu
  **satu** `flushQueue` di akhir; `getQueueBatch(MAX_SCROBBLE_BATCH=50)` yang sudah ada kini benar-benar
  menumpuk & mengirim per batch ≤50. Ratusan track → ~⌈N/50⌉ panggilan, bukan N.
- Perilaku scrobble real-time tunggal (dari listener) TIDAK berubah — tetap flush tiap track.
- **Pure-logic + TDD:** partisi baris beracun/layak diekstrak jadi `partitionByAttempts` di
  `scrobbleLogic.ts` (dulu inline di `flushQueueOnce`) + konstanta `MAX_SCROBBLE_BATCH`. RED→GREEN,
  **6 test baru**, total **164 test lolos**. `tsc` bersih (2 error `Intl.Segmenter` pra-ada tak terkait).
- **Tervalidasi device (SM-X706B):** log 22:40:58 — 6 scrobble latar (ditangkap 22:13–22:39) di-drain
  sebagai **6 `enqueue MASUK` tanpa flush di antaranya → satu `flush` → `scrobbleBatch KIRIM: 6 track`**
  (bukan 6× `1 track`), `Last.fm terima 6/6 ditolak 0`, `addHistoryBatch OK: 6 baris` (tanpa duplikat).
  Prediksi "satu baris N>1" terpenuhi.

### Fixed — Log Peristiwa tak lagi dipenuhi flush kosong
- Timer sinkronisasi 20 dtk (`App.tsx`) memanggil `flushQueue` terus-menerus. `flushQueueOnce` menulis
  `flush: sesi OK, mulai kirim batch` ke Log Peristiwa SEBELUM mengecek antrean kosong — sehingga saat
  idle, ring-buffer 100 baris terisi noise dan menggusur baris diagnostik berguna (terlihat di log
  device: baris tsb berulang tiap 20 dtk tanpa scrobble apa pun sesudahnya).
- Kini flush yang antreannya kosong = no-op senyap (cek `getQueueBatch(1)` murah dulu, baru log).
- **Tervalidasi device:** log 13:13:31–36 menunjukkan pipeline scrobble tembus penuh — 14 track Spotify
  berturut, `Last.fm terima 1/1` + `addHistoryBatch OK` semua, 0 ditolak. Timestamp asli (waktu mulai)
  ikut terkirim sesuai spek Last.fm. Isu "core scrobble belum tervalidasi device" — **selesai.**

### Internal — audit RAM/memory (lanjutan sesi sebelumnya)
- Audit jejak memori/lifecycle native. Kondisi awal ternyata sudah rapi: `PlaybackService.onDestroy`
  memanggil `cancelIdleStop()` + `player.release()` + `mediaSession.release()`; `PlayerPlugin`
  menghentikan position-poll di `handleOnDestroy()`; `ScrolaNotificationListener.cleanupAllCallbacks()`
  melepas semua callback controller + `OnActiveSessionsChangedListener`.
- **Fixed (leak kecil, nyata):** `cleanupAllCallbacks()` tidak membatalkan `eligibilityRunnable` yang
  pending. Saat izin notifikasi dicabut / listener di-destroy dengan timer eligibility masih menunggu
  (`postDelayed`, s.d. `wait` ms), Runnable itu tetap antre di main looper — menahan referensi ke
  listener mati + state track lama, lalu tetap eksekusi pasca-teardown. Kini dibatalkan di cleanup,
  simetris dengan cancel-sebelum-reschedule yang sudah ada.
- **Catatan:** (1) position-poll `PlayerPlugin` repost tiap 1 dtk walau idle/pause — **kini
  ditindaklanjuti** (lihat entri "position-poll adaptif" di atas). (2) `NativeEventLog`
  read-modify-write nulis ulang seluruh file tiap event tapi dibatasi ≤100 baris (beberapa KB) — aman,
  tak diubah.
- Validasi: brace/paren balance semua `.kt` seimbang; perubahan murni lifecycle Android (tak ada
  logika murni untuk disimulasikan Vitest), jadi divalidasi lewat pembacaan kode + simetri. **Bukti
  akhir tetap: build CI + perilaku device.**

### Fixed — lagu yang DIULANG kini tercatat ulang (deteksi repeat)
- **Bug:** `applyEvent` tak reset saat `trackKey` sama, jadi memutar lagu yang sama berkali-kali
  hanya menghasilkan 1 scrobble (Last.fm seharusnya 1 per putaran penuh).
- **Perbaikan:** `isRepeatEvent` — kalau posisi kembali ke awal (≤ `REPEAT_START_MS`) PADAHAL putaran
  ini sudah diputar cukup lama sampai LAYAK (pakai waktu-berlalu, bukan jejak posisi), itu putaran
  baru → tracker di-reset + guard scrobble native dilepas (scrobble ulang). **Konservatif:** rewind
  sebelum layak TIDAK menghasilkan scrobble ganda.
- Diterapkan identik di `playbackTimer.ts` (bar) dan `ScrobbleTracker.kt` (jalur scrobble native);
  listener melepas `scrobbledTrackKey` saat repeat. **6 test TS + 7 test Kotlin** (dikompilasi +
  dijalankan kotlinc), 22 test tracker lama tetap lolos (parity).

### Added — "Belajar dari koreksi" (versi ramah dari regex edits Pano)
- Saat kamu memperbaiki entri Riwayat yang salah label, Scrola **mengingat** koreksinya sebagai
  aturan dan menerapkannya OTOMATIS ke scrobble serupa berikutnya — tanpa perlu menulis regex.
- `corrections.ts` (murni): pencocokan (artist, track) dinormalisasi (case-insensitive, spasi
  dikolaps) — KONSERVATIF, cocok persis agar tak salah mengoreksi lagu lain. `upsertRule` (replace
  by-key, batasi 500 aturan terbaru), `applyCorrection`, `shouldRecordCorrection`. `correctionsStore.ts`
  menyimpan lewat SecureStore + cache memori. **12 test.**
- Wiring: `useScrobbleHistory.updateEntry` merekam koreksi setelah edit; `drainAndFlushNative`
  menerapkannya SETELAH `cleanTrackMetadata` (satu titik yang dilewati semua scrobble). Total 158
  test TS lolos.
- **Batas:** aturan bekerja pada nilai setelah pembersih (sama seperti yang tampil di Riwayat).
  Belum divalidasi di device; belum ada UI untuk melihat/menghapus aturan (bisa jadi tahap lanjutan).


### Changed — pembersih metadata diperluas berdasarkan kapabilitas Pano Scrobbler
- Setelah meriset Pano Scrobbler (regex edits, "extract mode", parsing judul YouTube, "fix
  Remastered"), `cleanTrackMetadata.ts` diperluas dengan yang berdampak-tinggi & aman:
  - **Noise VERSI (semua sumber, termasuk Spotify):** buang tag "Remastered" ala katalog dari track
    — `- Remastered`, `- Remastered 2011`, `- 2011 (Digital) Remaster`, `(Remastered 2011)`, dll.
    Ini yang sering ditambahkan Spotify. Tanda hubung yang BUKAN noise versi tetap tidak disentuh.
  - **Blok noise YouTube diperluas:** buang `[NCS Release]`/`(… Release)`, `(prod. by …)`,
    `(Free Download)`/`(Out Now)`/`(Download Link)`, dan tag promosi tambahan (Visualizer, 4K/8K,
    Full HD, COLORS show, clip officiel, videoclip, dst.) — sambil tetap mempertahankan tag bermakna
    (Remix/Acoustic/Live/Mashup/feat/Cover).
  - Normalisasi tanda kutip pintar (“ ” ‘ ’) dan spasi dalam kurung.
- **Tetap konservatif:** heuristik agresif hanya untuk paket YouTube; sumber katalog hanya kena
  pembersih noise versi. Kalau ragu, biarkan apa adanya.
- **16 test** (`cleanTrackMetadata.test.ts`, +5) termasuk 4 bentuk Remastered, blok Release/prod/
  download, noise versi pada judul YouTube, dan tag YouTube yang diperluas. Total 140 test lolos.
- **Belum divalidasi di device.** Heuristik tak pernah 100% sempurna; bisa dijadikan toggle atau
  diperluas lagi bila kamu menemukan pola judul lain.


### Added — pembersih metadata scrobble (judul video YouTube -> artis/track wajar)
- **Dari log perangkat:** YouTube Music mengirim JUDUL VIDEO sebagai track dan NAMA CHANNEL sebagai
  artis untuk konten non-katalog — mis. artis "Lo-fi Kirana" · track "Dimas Angkasa (Feat Kirana
  Seo) - Garis Batas (Mashup) | Official Audio", dan artis "Bluey - Official Channel" · track "Bluey
  Extended Theme Song 💙🎶 | Bluey". Keduanya terkirim mentah ke Last.fm.
- **`cleanTrackMetadata.ts`** (murni, dipasang di `drainAndFlushNative` sebelum enqueue — satu titik
  yang dilewati semua scrobble):
  - **Konservatif lintas sumber:** sumber katalog (Spotify dsb.) TIDAK disentuh selain trim/emoji —
    judul yang memang mengandung " - " tidak dipisah. Heuristik agresif hanya untuk paket YouTube.
  - YouTube: buang emoji, potong bagian setelah " | " (channel/tag/album noise), buang tag promosi
    berkurung dari daftar TERBATAS (Official Audio/Video, Lyrics, HD, dst.) — sambil MEMPERTAHANKAN
    tag bermakna (Remix/Acoustic/Live/Mashup/feat).
  - Channel "… - Topic" (auto-generate, biasanya bersih): buang "- Topic", judul dipakai apa adanya
    (tidak dipisah). Channel biasa: coba pisah "Artis - Judul" di " - " pertama; kalau gagal, buang
    suffix channel (VEVO/Official Channel) dari artis dan pakai judul bersih sebagai track.
- **11 test** (`cleanTrackMetadata.test.ts`) termasuk dua kasus nyata dari log, jaminan Spotify tak
  tersentuh, "- Topic", pelestarian tag bermakna, pisah pada dash pertama, dan sikap konservatif saat
  hasil pisah kosong. Total 135 test lolos.
- **Batas jujur:** ini heuristik — tak akan 100% sempurna untuk semua judul aneh. Sengaja memihak
  "biarkan apa adanya" saat ragu agar tak merusak metadata yang sudah benar. Belum divalidasi di
  device; bisa dijadikan toggle bila kamu ingin.


### Added — Scrobble di LATAR belakang (Opsi 2, Tahap 2–3: kelayakan native + serap JS)
- **Menyelesaikan pemindahan pipeline kelayakan ke native** supaya scrobble tetap berjalan saat app
  ditutup/di-latar-kan (WebView dibekukan → timer JS mati; itu sebabnya dulu hanya lagu yang diputar
  saat app terbuka yang tercatat).
- **Tahap 2 — penangkapan native di latar:**
  - `PendingScrobbleStore.kt` — antrean tangkapan append-only (format base64+tab agar bebas masalah
    escaping judul/artis; **9 tes Kotlin** untuk encode/decode/parse termasuk tab/newline/emoji/baris
    rusak). Terpisah dari DB Capacitor (hindari path non-standar + lock lintas-proses).
  - `NativeEventLog.kt` — penulis Log Peristiwa bersama & ter-sinkronisasi (dipakai JS via
    DiagnosticsPlugin dan jalur latar native), agar scrobble-latar TERLIHAT di log
    (`LATAR: layak & disimpan (pending) — …`).
  - `ScrolaNotificationListener` kini menjalankan `ScrobbleTracker` (Tahap 1) + timer kelayakan
    `Handler.postDelayed` di main looper. Saat sebuah track memenuhi ambang, disimpan ke
    PendingScrobbleStore — **walau app tertutup**. Callback MediaController & Runnable sama-sama di
    main looper, jadi akses tracker single-thread (tanpa race).
- **Tahap 3 — serap + kirim dari JS:**
  - `NowPlayingPlugin.drainPendingScrobbles()` — menyerap & mengosongkan store.
  - `drainAndFlushNative()` (JS) — menyerap, memfilter preferensi "scrobble dari app lain", lalu
    enqueue + kirim ke Last.fm. Dedup dijaga `UNIQUE(artist,track,timestamp)` di antrean.
  - `App` memanggilnya saat startup, saat kembali foreground (`appStateChange`), dan tiap 20 detik
    selagi aktif — jadi tangkapan latar cepat terkirim.
  - **Kelayakan/enqueue sisi JS DINONAKTIFKAN** (timer di `useNowPlaying` dibuang) agar tak dobel
    dengan native. Tracker JS dipertahankan HANYA untuk bar "Sedang Diamati".
- **Batas jujur:** logika murni (tracker + store) divalidasi 31 tes Kotlin di sini, tapi INTEGRASI
  native (wiring listener, Handler timer di latar, jembatan plugin, I/O file) **hanya bisa dibuktikan
  di CI build + perangkat**. Yang perlu diuji: putar musik di Spotify/YT Music dengan Scrola
  TERTUTUP beberapa lagu, lalu buka Scrola — Riwayat harus terisi SEMUA lagu (dengan timestamp
  aslinya), dan Log Peristiwa memuat baris `LATAR: …`.


### Added — Scrobble di LATAR belakang (Opsi 2, Tahap 1: tracker kelayakan native)
- **Menutup isu paling fundamental:** kelayakan + enqueue scrobble dulu berjalan di JS (WebView),
  yang DIBEKUKAN Android saat app ditutup/di-latar-kan — sehingga lagu yang diputar di latar tak
  pernah memenuhi ambang, dan hanya lagu yang diputar saat app terbuka yang tercatat. (Deteksi
  sudah native/latar; yang belum adalah kelayakan.)
- **Desain Opsi 2 (hibrida, tahan banting):** native melakukan deteksi + kelayakan + simpan ke
  penyimpanan native sendiri (append-only) di LATAR; JS menyerapnya lalu mengirim ke Last.fm saat
  app dibuka. Karena scrobble Last.fm membawa timestamp, lagu tetap tercatat dengan waktu aslinya.
  Sengaja TIDAK menulis langsung ke DB @capacitor-community/sqlite dari native (path non-standar +
  risiko lock lintas-proses) — penyimpanan native yang terpisah lebih aman.
- **Tahap 1 — `ScrobbleTracker.kt`:** port SETIA dari `playbackTimer.ts` (tracker waktu-berlalu,
  ambang, fallback durasi tak dikenal 4 menit, seed posisi, `msUntilEligible` dengan sentinel
  `Long.MAX_VALUE` = Infinity). Murni tanpa dependensi Android → **divalidasi dengan 22 tes Kotlin
  sungguhan** (dikompilasi kotlinc + dijalankan), cocok 1:1 dengan 22 kasus vitest sisi TS. Logika
  dijaga identik di kedua sisi; DB tidak terenkripsi (`no-encryption`, `scrola.db`) dikonfirmasi.
- **Tahap berikutnya (belum dikerjakan):** (2) penyimpanan "pending scrobbles" native + Handler
  timer di NotificationListener yang memanggil tracker ini di latar; (3) plugin `drainPendingScrobbles()`
  + JS menyerap saat app dibuka → enqueue → kirim Last.fm, dan MENONAKTIFKAN kelayakan/enqueue sisi
  JS (agar tak dobel dengan native). Integrasi native ini **wajib divalidasi di CI + perangkat**.


### Fixed — pemutar internal di-scrobble GANDA (dua jalur enqueue)
- **Bukti dari log perangkat:** memutar file lokal via Scrola menghasilkan DUA `enqueue MASUK …
  (src=com.scrola.app)` dan dua `addToQueue OK` untuk satu lagu. Pemutar internal ternyata
  discrobble oleh dua jalur sekaligus: (A) efek `maybeScrobble()` lama di `NowPlayingScreen`
  (berbasis posisi), dan (B) jalur listener → tracker waktu-berlalu (yang kini mendeteksi sesi
  `com.scrola.app` dengan benar sejak durasi di-backfill).
- **Kenapa berbahaya:** kali ini scrobble ganda tertolak `UNIQUE(artist, track, timestamp)` di
  antrean, tapi rapuh — kalau kedua jalur menghitung timestamp yang sedikit berbeda, keduanya
  lolos dan menjadi **scrobble ganda di profil Last.fm** pengguna.
- **Perbaikan:** hapus jalur A (efek `maybeScrobble` + `startedAtRef` + `resetScrobbleGuard` di
  `NowPlayingScreen`). Jalur A adalah peninggalan dari masa ketika listener belum melihat sesi
  internal; kini redundan. Pemutar internal discrobble lewat jalur yang SAMA dengan sumber
  eksternal (listener → tracker), yang malah lebih baik karena tetap jalan di latar. Panggung
  tiket di NowPlayingScreen tetap murni VISUAL (tidak lagi men-scrobble).
- **Catatan deteksi:** log yang sama mengonfirmasi deteksi & pencatatan internal BEKERJA penuh
  (`enqueue … src=com.scrola.app` → `addToQueue OK` → `Last.fm terima 1/1` → `addHistoryBatch OK`),
  dan panel "Sumber terdeteksi" di Pengaturan menampilkan Spotify, YouTube Music, dan Scrola.
- **Belum divalidasi di device** setelah perubahan ini — yang perlu dicek: memutar file lokal kini
  hanya menghasilkan SATU `enqueue MASUK src=com.scrola.app` (bukan dua).


### Fixed — deteksi lintas-pemutar: sesi yang mulai dalam keadaan PAUSE lalu di-play tak terbaca
- **Akar:** callback `onPlaybackStateChanged` hanya memanggil `emitPlaybackState`, TIDAK
  `emitNowPlaying`. Padahal `emitNowPlaying` (yang memancarkan metadata/track `nowPlayingChanged`)
  di-skip saat bind kalau sesi sedang pause (`if (!isPlaying) return`). Akibatnya: pemutar yang
  MULAI dalam keadaan pause lalu di-play — umum pada pemutar file lokal (Poweramp, Musicolet, dll.)
  dan kadang YouTube Music — tak terdeteksi sampai metadatanya kebetulan berubah, karena sisi JS
  tak pernah menerima metadata track itu.
- **Perbaikan:** `onPlaybackStateChanged` kini memancarkan KEDUANYA — `emitNowPlaying` dulu (set
  metadata di sisi JS) baru `emitPlaybackState` (update tracker). `emitNowPlaying` punya gerbang
  isPlaying sendiri, jadi aman saat pause. Play/resume kini langsung memicu deteksi.

### Added — daftar "Sumber terdeteksi" di Pengaturan (verifikasi cakupan lintas-pemutar)
- Listener kini mencatat HIMPUNAN paket pemutar yang pernah benar-benar terbaca
  (`detectedPackages`, LinkedHashSet ter-sinkronisasi), diekspos lewat status plugin, dan
  ditampilkan sebagai chip di panel Diagnosis Pengaturan. Sekarang bisa diverifikasi langsung di
  perangkat: putar lagu di Spotify, YouTube Music, dan pemutar lokal → semua muncul di daftar.
- `sourceLabels.ts` diperluas: menambah pemutar lokal umum (Musicolet, Samsung Music, AIMP, Retro
  Music, Phonograph, Pulsar, BlackPlayer) dan app populer di Indonesia/SEA (JOOX, Resso, Amazon
  Music). Package tak dikenal tetap tampil apa adanya (memudahkan menambah ke daftar). Dikunci
  `sourceLabels.test.ts` (5 test). Total 124 test lolos.
- **Belum divalidasi di device.** Ini justru fitur untuk MEMVALIDASI di device: daftar sumber +
  diag `sumber: <paket> … durasi <N>s` per track bersama-sama membuktikan pemutar mana yang
  terbaca dan dengan data apa.


### Added — seed posisi saat lagu terdeteksi di tengah pemutaran (akurasi waktu scrobble)
- **Melengkapi perbaikan latensi deteksi:** kalau sebuah lagu baru terdeteksi saat sudah diputar
  sebagian (mis. deteksi pemutar agak lambat), tracker waktu-berlalu dulu mulai dari 0 — sehingga
  scrobble tertunda, bahkan bisa TERLEWAT kalau lagu keburu habis sebelum ambang tercapai.
- **Perbaikan:** `applyEvent` kini menerima `positionMs` dan, HANYA saat track BARU, men-seed
  `playedMs` dengan posisi saat itu (bukan 0). `useNowPlaying` meneruskan `data.positionMs`.
  Contoh: lagu 2:25 yang baru terdeteksi di posisi 1:11 kini langsung mendekati/melewati ambang
  (72s), bukan menunggu 72s lagi dari nol.
- **Konservatif:** seed dibatasi `clampSeedMs` — tak pernah melebihi durasi track (atau ambang
  fallback 4 menit bila durasi tak diketahui), dan 0 bila posisi tak ada; jadi posisi bogus tak
  bisa memicu scrobble instan yang keliru. Seed HANYA saat track baru — event berikutnya untuk
  track yang sama tidak me-reseed (tetap memakai akumulasi waktu berjalan).
- **Dikunci test** (`playbackTimer.test.ts`, +6): seed dari posisi & lanjut berjalan; tanpa
  positionMs tetap 0 (perilaku lama); seed dipangkas durasi; dipangkas 240s saat durasi 0; lagu
  yang terdeteksi sudah lewat separuh langsung layak; tidak me-reseed untuk track sama. Total 119
  test lolos.
- **Belum divalidasi di device.**


### Fixed — deteksi pemutar non-Spotify (mis. YouTube Music) terasa lambat
- **Gejala dari perangkat:** kartu "Sedang Diamati" muncul cepat untuk Spotify tapi tertunda untuk
  YouTube Music, padahal deteksinya akhirnya jalan.
- **Akar:** `onNotificationPosted` di `ScrolaNotificationListener` masih **stub kosong** — listener
  hanya bereaksi pada `onActiveSessionsChanged`. Sebagian pemutar (khususnya YT Music) mendaftarkan
  MediaSession-nya ke `MediaSessionManager` beberapa saat setelah notifikasi media-nya muncul, jadi
  `onActiveSessionsChanged` menyala terlambat dan deteksi ikut lambat. Spotify mendaftarkan sesinya
  cepat, makanya terasa instan.
- **Perbaikan:** `onNotificationPosted` kini memindai ulang sesi aktif begitu ada notifikasi
  **kategori TRANSPORT** (kontrol media) — jalur yang biasanya tampil lebih dulu daripada sesi
  aktif. Aman & hemat: hanya bereaksi ke notifikasi media (bukan semua notifikasi), di-throttle
  ~1,2 detik, dan hanya rebind bila **kumpulan paket** sesi berubah (dibandingkan lewat
  `packageName`, karena `getActiveSessions` mengembalikan instance controller baru tiap panggil) —
  jadi tidak mengganggu callback yang sudah berjalan untuk sesi yang sama.
- **Batas jujur:** ini memangkas latensi ketika sesi memang sudah aktif tapi `onActiveSessionsChanged`
  belum sempat menyala. Bila sebuah pemutar benar-benar mengaktifkan sesinya terlambat, itu di luar
  kendali kita. Murni perubahan native — **wajib dikonfirmasi di perangkat** (bandingkan jeda
  deteksi YT Music sebelum vs sesudah).


### Added — Statistik Naratif "Bab" (bulanan) & "Album" (tahunan) — Tahap 1–2: logika + UI
- Lanjutan roadmap naratif setelah Sisi B mingguan: **Bab** = rekap satu bulan, **Album** = rekap
  satu tahun. Menggunakan agregasi inti yang sama dengan Sisi B (top artis/lagu, total, durasi,
  penemuan) namun beda rentang & dimensi tren.
- **Modul murni `babAlbumLogic.ts`** (belum ada UI — sengaja bertahap):
  - `computeBabStats(monthRows, artistsBeforeMonth)` — tren dibucket per PEKAN dalam bulan (5 slot).
  - `computeAlbumStats(yearRows, artistsBeforeYear)` — tren dibucket per BULAN (12 slot).
  - `startOfMonth`/`startOfYear` — bantu hitung rentang query.
  - Memakai ulang tipe `SisiBRow`/`SisiBTopTrack` (tanpa duplikasi) dan agregasi inti bersama.
- **Integrasi TIDAK butuh query baru:** cukup `getHistoryInRange(start, end)` +
  `getDistinctArtistsBefore(start)` yang sudah ada (pola sama dengan SisiBScreen), jadi tahap
  UI nanti tinggal mengomposisi.
- **7 test** (`babAlbumLogic.test.ts`): agregasi inti; bucket pekan (Bab) & bulan (Album);
  penemuan relatif; riwayat kosong; `startOfMonth`/`startOfYear`. Timestamp uji aman-TZ (tengah
  hari UTC di tanggal tengah-periode). Total 110 test lolos.
- **Tahap 2 — UI (`BabAlbumScreen.tsx`), didesain ulang untuk orang awam:** alih-alih dashboard
  angka, layar dibuka dengan satu **kalimat naratif** ("Sepanjang 2026, kamu memutar 842 lagu")
  dengan angka besar teranyam (bukan telanjang) + count-up halus. Bahasa dipolos-kan (bukan
  "irama/penemuan/teratas"): "Lagu yang paling sering diputar", "Artis yang paling sering kamu
  putar", dan grafik **"Kapan kamu mendengar"** yang dijelaskan gamblang — bulan teramai DINAMAI
  ("Paling ramai di Juni — 95 lagu"), batang puncak disorot, plus baris penjelas "tiap batang satu
  bulan · makin tinggi, makin banyak". Toggle Bulan/Tahun; entrance bertahap; menghormati
  prefers-reduced-motion. Helper murni baru `peakBucket` (+3 test) menamai puncak. Empty state
  mengundang bertindak.
- **Verifikasi:** `vite build` sukses, `tsc` bersih, 110 test lolos, mockup PIL memvalidasi tata
  letak Album (12-bar) sebelum device.
- **Status device:** logika teruji penuh; **tata letak & animasi bar belum dikonfirmasi di
  perangkat.**


### Added — Tiket Koleksi Bernomor Seri (Tahap 1–3: logika + integrasi + UI)
- Fitur baru pertama pasca-perbaikan inti scrobble: momen tertentu (scrobble ke-100, artis ke-10
  yang ditemukan, dst.) "mencetak" tiket koleksi bernomor seri unik — memperkuat identitas
  cetak/tiket Scrola dan menambah mekanik retensi.
- **Modul murni `ticketSerialLogic.ts`** (belum ada UI/integrasi — sengaja bertahap):
  - `ticketSerial(kind, ordinal, subject?)` — serial deterministik `SCR-<K>-<NNNNNN>` (mis.
    `SCR-J-000100`); tiket terkait subjek menyertakan `subjectHash` agar unik antar subjek dengan
    ordinal sama.
  - `computeEarnedTickets(rows, config?)` — menurunkan tiket yang sudah diperoleh LANGSUNG dari
    riwayat (deterministik, tak memutasi input, mengurutkan kronologis sendiri). Karena tiket
    murni fungsi dari riwayat, **tak butuh tabel/migrasi DB** untuk menampilkannya.
  - Jenis awal: `jejak` (milestone jumlah scrobble) & `penemuan` (milestone artis unik). Slot
    `setia`/`beruntun` sudah disiapkan di tipe + jalur serial (dites) untuk tahap berikutnya.
- **14 test** (`ticketSerialLogic.test.ts`): hash deterministik & 4-char; format serial global vs
  terkait-subjek; pencetakan tepat di milestone pada timestamp pemicu; normalisasi artis
  (case+spasi); abai artis kosong; input acak diurutkan; tidak memutasi input; determinisme penuh.
  Total 99 test lolos.
- **Tahap 2 — integrasi baca (`queries.ts`):**
  - Tambahan murni di `ticketSerialLogic.ts`: `sortTicketsForDisplay` (terbaru dulu, stabil, tak
    memutasi) dan `computeTicketProgress` (total scrobble, artis unik, milestone berikutnya + sisa
    — hook retensi "N lagi menuju tiket ke-100"). +4 test (total 18 di modul ini, 103 keseluruhan).
  - `getTicketCollection()`: SATU kali baca riwayat (kolom ringan `artist, track, timestamp`,
    kronologis) → menurunkan `{ tickets, progress }` lewat fungsi murni. Tetap **tanpa tabel/migrasi
    DB** — koleksi murni turunan riwayat.
  - `normalizeArtist` di-ekstrak & dipakai bersama (dedup penemuan konsisten antara koleksi &
    progres).
- **Tahap 3 — UI (`TiketKoleksiScreen.tsx`):** layar koleksi overlay (meniru pola SisiBScreen,
  tema Hutan Malam) yang dibuka dari tombol "Tiket" di header Riwayat. Isi: kartu progres "Menuju
  berikutnya" (hook retensi: "60 scrobble lagi · tiket ke-100"), daftar sobekan tiket terbaru-dulu,
  masing-masing dengan tepi perforasi + **cap nomor seri kuningan** (elemen signature: mono,
  bordered, sedikit miring seperti stempel). Empty state mengarahkan ("tiket pertama tercetak di
  scrobble pertama"). Di-wire di `App.tsx` (`ticketsOpen`) + prop `onOpenTickets` di HistoryScreen.
- **Verifikasi:** `vite build` sukses (91 modul, layar baru ikut terkompilasi), `tsc` bersih, 103
  test lolos, mockup PIL memvalidasi hierarki & cap seri sebelum device.
- **Status device:** logika (serial/milestone/progres) teruji penuh; **tata letak & animasi UI
  belum dikonfirmasi di perangkat** — itu gerbang terakhir. Opsional berikutnya: tabel `seen_tickets`
  bila ingin notif "tiket baru tercetak", dan cap seri di StoryTicket Riwayat.


### Fixed — lagu yang diputar Scrola sendiri tidak pernah tercatat + tahan banting lintas pemutar
- **Gejala:** scrobble dari Spotify jalan, tapi lagu yang diputar oleh pemutar internal Scrola tak
  pernah masuk Riwayat.
- **Akar:** pemutar internal adalah MediaSession Media3, dan `MediaMetadata` Media3 **tidak punya
  field durasi** (durasi ada di timeline player, bukan metadata). Jadi saat sesi internal terbaca
  `MediaSessionManager`, `METADATA_KEY_DURATION` = 0 → `durationSec` = 0. Di penjadwal kelayakan,
  durasi 0 membuat `msUntilEligible` = `Infinity`, dan penjadwalan berhenti secara **senyap**
  (`if (!Number.isFinite(wait)) return`). Sumber eksternal seperti Spotify mengisi durasi dengan
  benar, makanya lolos; internal tidak.
- **Perbaikan berlapis (tahan banting apa pun perilaku bridge Media3):**
  - **Fallback durasi tak dikenal (TS, untuk SEMUA pemutar):** `thresholdMsForDuration()` baru
    membedakan tiga kasus — durasi tak dilaporkan (`<= 0`) memakai aturan Last.fm **4 menit**
    (bukan gagal diam-diam), durasi valid `<= 30s` tetap "terlalu pendek" (tak discrobble), durasi
    `> 30s` memakai 50%/240s. `thresholdMs`/`observedProgress` kini lewat helper ini, jadi pemutar
    terkenal mana pun yang tak melaporkan durasi tetap tercatat setelah 4 menit.
  - **Backfill durasi internal (native):** `PlaybackService.lastKnownDurationMs` (`@Volatile`,
    di-set di main thread saat player READY) menyimpan durasi asli dari timeline. Listener
    mem-backfill-nya saat `METADATA_KEY_DURATION` = 0 **dan** paketnya milik sendiri — sehingga
    lagu internal memenuhi ambang di 50% (perilaku benar), bukan sekadar menunggu 4 menit. Aman
    lintas-thread: listener tak menyentuh objek ExoPlayer, hanya membaca field volatile.
  - **Fallback field metadata (native):** kalau `ARTIST`/`TITLE` standar kosong, jatuh ke
    `ALBUM_ARTIST`/`DISPLAY_SUBTITLE` dan `DISPLAY_TITLE` — membantu pemutar yang hanya mengisi
    field "display". (Peningkatan best-effort; belum diverifikasi pada tiap pemutar.)
- **Diagnostik baru:** setiap kali track berganti, Log Peristiwa mencetak
  `sumber: <paket> — <artis> · <judul> · durasi <N>s`. Ini langsung menyingkap di perangkat kenapa
  satu pemutar tercatat dan lain tidak (mis. durasi 0 terlihat gamblang per app).
- **Dikunci test** (`playbackTimer.test.ts`, +5): durasi 0 → ambang 240s & layak tepat di 4 menit;
  membedakan "tak dikenal" (0) dari "terlalu pendek" (`0<dur<=30`); `observedProgress` durasi 0
  menampilkan bar (bukan tooShort). Total 85 test lolos.
- **Belum divalidasi di device.** Yang menentukan tetap satu log saat memutar file lokal: cari
  baris `sumber: com.scrola.app ... durasi <N>s` (harus > 0 berkat backfill) diikuti `enqueue
  MASUK ... src=com.scrola.app`.


### Fixed — bar "Sedang Diamati" beku dari awal sampai akhir (visual, bukan scrobble)
- **Gejala dari perangkat:** progress bar di kartu Sedang Diamati diam di posisi awal sepanjang
  lagu, lalu sesekali "melompat", padahal scrobble-nya sendiri berjalan normal.
- **Akar:** bar & teks "tercatat dalam ..." dihitung dari `externalNowPlaying.positionSec`, yang
  hanya di-update saat event `playbackStateChanged` (play/pause/seek) — bukan tiap detik. Kalau
  lagu diputar lurus, Spotify tidak memancarkan state baru, jadi `positionSec` membeku dan bar ikut
  beku; ia hanya melompat ketika Spotify sesekali memancarkan ulang state. Ini efek samping migrasi
  kelayakan ke waktu-berlalu (`playbackTimer.ts`): logika scrobble sudah pindah ke played-time,
  tapi visualnya tertinggal di `positionSec` yang mati.
- **Perbaikan:** bar kini di-drive dari WAKTU BERLALU yang sama dengan logika kelayakan.
  - Helper murni baru `observedProgress(durationSec, playedMs)` di `playbackTimer.ts` (menghitung
    progress/remaining/eligible dari played-time & ambang scrobble yang sama) — 6 test di
    `playbackTimer.test.ts`.
  - `useNowPlaying`: field `playedMs` di state + **ticker 1 detik** yang me-render ulang dari
    tracker played-time; aman terhadap jeda (nilai beku saat `playingSince` null) dan hanya
    setCurrent kalau nilainya berubah (tak ada render sia-sia saat idle).
  - `NowPlayingScreen`: memakai `observedProgress`, transisi bar disamakan ke `1s linear`.
  - Efek samping bagus: "tercatat dalam ..." sekarang turun sinkron dengan timer scrobble
    sungguhan, bukan angka mati. Belum divalidasi di device.

### Added — recovery transaksi menggantung kini TERLIHAT di Log Peristiwa
- `clearDanglingTransaction()` dan `runWriteWithRecovery()` sebelumnya senyap: kalau sesi kebetulan
  bersih ATAU recovery menyala, log sama-sama cuma menampilkan `addToQueue OK` — tak bisa dibedakan.
- Sekarang: `clearDanglingTransaction` memancarkan `diag('recovery[<ctx>]: transaksi menggantung
  DIBERSIHKAN')` **hanya kalau ROLLBACK benar-benar sukses** (artinya memang ada dangle nyata; kalau
  tak ada, tetap senyap). `runWriteWithRecovery` menerima `label` (`addToQueue`/`addHistoryBatch`)
  dan mencatat saat menangkap error "cannot start a transaction" lalu mengulang.
- Tujuannya bukti langsung on-device: kalau log menampilkan `recovery[addToQueue]: ... DIBERSIHKAN`
  diikuti `addToQueue OK`, itu menunjukkan fix desync benar-benar menyelamatkan sesi yang
  menggantung — bukan sekadar sesi kebetulan bersih. Tanpa ini, "sesi bersih lolos" dan "recovery
  berhasil" tak terbedakan di log.

### Fixed — AKAR SEBENARNYA "musik tidak tercatat": desync transaksi Android vs SQLite
- **Bukti pasti dari log perangkat.** Pipeline berjalan sempurna sampai titik terakhir:
  `timer BERBUNYI` → `LAYAK` → `enqueue MASUK (Kirana Seo - Garis Batas, src=com.spotify.music)`
  → lalu **`addToQueue GAGAL: cannot start a transaction within a transaction: BEGIN TRANSACTION`**.
  Deteksi, kelayakan, dan pemicuan scrobble semuanya benar; yang gagal adalah penulisan ke DB.
- **KOREKSI diagnosis sebelumnya (jujur).** Entri lama di CHANGELOG ini menuding "`BEGIN
  TRANSACTION` manual di `runMigrations` dan `addHistoryBatch`". Itu SALAH: audit `grep` memastikan
  kode tidak punya `BEGIN` manual sama sekali. Dan "ROLLBACK defensif" yang dulu ditambahkan di
  `getDb()` (`db.execute('ROLLBACK;')`, terbungkus `transaction=true`) ternyata **tidak menyelesaikan
  apa pun** — simulasi state-machine membuktikannya buta terhadap kondisi yang sebenarnya perlu
  dibersihkan.
- **Akar yang benar (terverifikasi dari sumber native `Database.java` 6.x).** Plugin melacak
  transaksi lewat pembukuan Android `_db.inTransaction()` (penghitung stack), sementara COMMIT
  aktual dikirim ke SQLite terpisah. Ketika sebuah COMMIT gagal di tengah (mis. batch di flush),
  `endTransaction()` tetap men-DECREMENT stack Android ke 0 **padahal transaksi SQLite masih
  terbuka**. Sejak itu keduanya DESYNC: Android pikir tak ada transaksi, SQLite tahu masih ada.
  Penulisan berikutnya (`addToQueue` → `run` → `beginTransaction`) mengeluarkan `BEGIN` saat SQLite
  masih in-transaction → ditolak. Query tetap jalan (tak menyentuh state transaksi) — itulah kenapa
  Riwayat & status antrean tetap kebaca sementara SEMUA tulisan mati sampai app di-restart.
- **Perbaikan (divalidasi simulasi, bukan asumsi):**
  - `clearDanglingTransaction()` baru: mengirim `ROLLBACK` **UNWRAPPED** (`execute('ROLLBACK;',
    false)`) langsung ke SQLite. Ini menutup transaksi menggantung tanpa menyentuh stack Android —
    berbeda dari `isTransactionActive()/rollbackTransaction()` yang membaca stack Android (=0 saat
    desync) sehingga tak pernah membersihkan apa-apa.
  - `runWriteWithRecovery()` baru membungkus `addToQueue` dan `addHistoryBatch`: kalau tulisan kena
    "cannot start a transaction within a transaction", bersihkan lalu ULANG sekali. Penting karena
    dangle bisa lahir di TENGAH sesi (COMMIT batch gagal) lalu mematikan `addToQueue` berikutnya —
    persis urutan di log (flush 10:22 → addToQueue gagal 10:24). Perbaikan hanya-di-init tak cukup.
  - `getDb()`: `ROLLBACK` defensif yang lama (terbungkus, tak efektif) diganti pemanggilan
    `clearDanglingTransaction()` yang unwrapped.
  - `runMigrations`: `PRAGMA user_version` kini di-set dengan `transaction=false` supaya benar-benar
    persist (sekaligus menuntaskan bug lama "v2 jalan ulang tiap launch") dan tidak menambah
    permukaan pembungkusan transaksi.
- **Test regresi baru** `src/lib/db/__tests__/txRecovery.test.ts` (8 kasus) memodelkan state machine
  plugin dan mengunci: (a) COMMIT gagal → desync, (b) tulisan berikutnya gagal seperti di device,
  (c) recovery salah (isTransactionActive & ROLLBACK terbungkus) TIDAK membersihkan, (d) ROLLBACK
  unwrapped + retry membersihkan & tulisan berhasil, (e) koneksi bersih tidak terpengaruh, (f) error
  non-transaksi tetap diteruskan.
- **Belum tervalidasi di device.** Ini CI/simulasi, bukan build fisik. "Device is the final truth":
  yang membuktikan perbaikan ini benar adalah `Riwayat` yang akhirnya terisi di SM-X706B, bukan test
  hijau. Cara cek cepat: putar satu lagu lewat separuh → Log Peristiwa harus menunjukkan
  `addToQueue OK` (bukan GAGAL), lalu tiket muncul di Riwayat.

### Added — Log peristiwa scrobble on-device (berhenti menebak, mulai mengukur)
- Setelah dua perbaikan berbasis dugaan (timer, migrasi DB) tidak menyelesaikan "musik tidak
  tercatat", ditambahkan **jejak runtime nyata** alih-alih menebak lagi. 16 titik `diag()` di
  sepanjang pipeline: timer berbunyi → enqueue masuk → addToQueue OK/gagal → sesi OK/null →
  scrobbleBatch kirim → balasan Last.fm (diterima/ditolak) → addHistoryBatch OK/gagal.
- **`DiagnosticsPlugin` diperluas**: `appendLog`/`readEventLog`/`clearEventLog` menulis ring
  buffer 100 baris ke `filesDir/event_log.txt` — bisa dibaca langsung dari panel baru "Log
  Peristiwa Scrobble" di Pengaturan, tanpa perlu adb/komputer.
- Tujuannya menemukan lapis PERSIS tempat rantai putus. Hipotesis yang akan dibedakan oleh log:
  (a) timer tak pernah berbunyi → masalah di jalur event/eligibility; (b) enqueue masuk tapi
  addToQueue gagal → DB; (c) sesi null → scrobble tertahan karena dianggap belum login; (d)
  scrobbleBatch ditolak Last.fm → masalah signature/kredensial; (e) semua OK tapi addHistoryBatch
  gagal → bug penulisan riwayat. Masing-masing mengarah ke perbaikan yang berbeda.
- Ini bukan fitur untuk pengguna akhir — ini instrumen diagnosis. Akan dicabut/disederhanakan
  begitu akar masalah ketemu.

### Fixed — AKAR "UI bilang tercatat tapi Riwayat kosong": migrasi DB mengunci seluruh database
- **Gejala dari 3 screenshot pengguna yang saling bertentangan:** layar Sekarang menyatakan "sudah
  memenuhi syarat — tercatat ke Riwayat", Antrean "kosong", tapi Riwayat "masih kosong" — dan
  panel Antrean menampilkan "Kegagalan terakhir: Antrean tidak terbaca". Ketidakcocokan itu berarti
  seluruh lapisan DB gagal, bukan cuma satu query.
- **Akar 1 — `PRAGMA user_version` di DALAM transaksi.** Runner migrasi men-set versi skema di
  dalam `BEGIN...COMMIT`. Pada SQLite, PRAGMA itu bisa diabaikan diam-diam di dalam transaksi,
  sehingga `user_version` TIDAK PERNAH naik. Akibatnya migrasi v2 (`ALTER TABLE ADD COLUMN note`,
  ditambahkan bersama fitur catatan) dijalankan ULANG setiap app dibuka, gagal pada jalan kedua
  dengan "duplicate column name", dan menggagalkan SELURUH `getDb()`. Tidak ada scrobble yang bisa
  masuk antrean, riwayat tak bisa ditulis, status antrean melempar. PRAGMA dipindah ke LUAR
  transaksi (setelah COMMIT) supaya benar-benar tersimpan.
- **Akar 2 — migrasi v2 tidak idempoten.** Untuk memulihkan database yang TERLANJUR rusak oleh
  bug di atas (kolom `note` sudah ada tapi versi masih 1), migrasi v2 kini berupa fungsi yang
  memeriksa `PRAGMA table_info` dulu dan hanya menjalankan `ALTER` bila kolomnya belum ada.
  Runner migrasi diperluas mendukung `statementsFn` selain `statements`. Disimulasikan: DB baru,
  DB sudah termigrasi, dan DB setengah-rusak — ketiganya pulih tanpa crash (7 assertion).
- Ini menjelaskan kenapa fitur catatan "mematahkan" scrobble: keduanya tak berhubungan secara
  logika, tapi migrasi yang menyertai catatan-lah yang mengunci DB. Pelajaran: migrasi DB pertama
  pada database berisi data adalah titik paling berbahaya, dan memang sudah ditandai berisiko saat
  fitur catatan ditambahkan — hanya saja penyebab teknis persisnya (PRAGMA dalam transaksi) baru
  ketahuan dari perangkat.

### Fixed — AKAR "musik tidak tercatat": kelayakan scrobble kini berbasis WAKTU, bukan position
- **Temuan dari perangkat + membandingkan dengan Pano Scrobbler.** Panel diagnosis membuktikan
  deteksi bekerja sempurna (Spotify melapor 45×, izin/service/aliran data semua hijau) — jadi bug
  bukan di deteksi. Akarnya: jalur lama membaca `PlaybackState.position` dari MediaSession dan
  membandingkannya dengan ambang. Tapi `position` HANYA diperbarui saat callback
  `onPlaybackStateChanged` menyala (play/pause/seek), BUKAN tiap detik. Lagu yang diputar lurus
  tanpa disentuh membuat `position` mandek → ambang tak pernah terlampaui → scrobble TIDAK PERNAH
  terpicu meski event metadata terus masuk.
- **Solusi meniru pendekatan Pano:** hitung waktu putar sendiri dengan timer, jangan percaya
  `position`. (Terlihat dari issue #570 Pano yang berbicara soal "menit ke-N dari instance baru",
  bukan posisi lagu — bukti mereka memakai elapsed time, bukan position.) Modul baru
  **`playbackTimer.ts`** melacak total waktu track benar-benar diputar (pause menghentikan
  akumulasi, resume melanjutkan), lalu `useNowPlaying` menjadwalkan `setTimeout` untuk memicu
  scrobble tepat saat ambang waktu tercapai — tanpa bergantung pada `position` sama sekali.
- **18 assertion** memvalidasi termasuk skenario pause/resume (waktu jeda tidak dihitung) dan lagu
  diputar lurus (layak murni berdasarkan waktu). `position` kini hanya dipakai untuk tampilan UI,
  tidak lagi untuk keputusan scrobble.

### Fixed — Panel "Antrean Scrobble" tersangkut "Memeriksa…" selamanya
- Kalau `getQueueStatus()` melempar (mis. tabel belum siap), `catch` lama hanya mencatat log
  sehingga `queueStatus` tetap `null` dan UI tersangkut di keadaan loading — terlihat di
  screenshot pengguna. Kini di-set status eksplisit "Antrean tidak terbaca" supaya UI keluar dari
  loading dan menunjukkan kondisi sebenarnya.

### Added — Diagnosis deteksi musik BERLAPIS (hasil riset arsitektur Pano Scrobbler)
- **Temuan riset:** Pano Scrobbler memakai pendekatan yang SAMA dengan Scrola —
  `NotificationListenerService` + `MediaSessionManager` (dikonfirmasi dari kebijakan privasi &
  nama komponen `com.arn.scrobble.media.NLService`). Jadi arsitektur deteksi Scrola tidak salah.
  Yang berbeda: FAQ mereka menempatkan DUA hambatan tingkat-perangkat sebagai pertanyaan nomor
  satu dan dua — bukan bug kode:
  1. **Android 13+ memblokir akses notifikasi untuk aplikasi sideload.** Pengguna harus menekan
     "Allow restricted settings" di App info dulu; sebelum itu izin tidak pernah benar-benar
     berlaku. Scrola dipasang lewat APK dari GitHub, jadi persis terkena aturan ini.
  2. **Samsung/Xiaomi/Huawei membunuh proses latar secara agresif.** Solusi Samsung: tambahkan
     app ke "Aplikasi tak pernah tidur".
- **Celah diagnostik yang ditemukan:** `isNotificationAccessGranted()` hanya memeriksa SETELAN
  `enabled_notification_listeners`. Setelan bisa menyatakan izin diberikan sementara service tidak
  pernah tersambung — persis yang terjadi pada kedua kasus di atas. Akibatnya kegagalan scrobble
  mustahil didiagnosis: semuanya tampak "sudah diizinkan".
- **`getListenerDiagnostics()` baru** memisahkan tiga lapis yang dari luar identik: (a) izin
  diberikan, (b) layanan pemantau benar-benar hidup (`onListenerConnected` pernah menyala),
  (c) data benar-benar mengalir (`totalEvents > 0`, dengan package & waktu event terakhir).
  `ScrolaNotificationListener` kini mencatat status koneksi, jumlah event, sumber terakhir, dan
  jumlah sesi aktif.
- **Panel "Diagnosis Deteksi Musik" di Pengaturan** menampilkan ketiga lapis berurutan, dan
  memberi saran perbaikan SPESIFIK untuk lapis pertama yang gagal — termasuk instruksi "Izinkan
  setelan yang dibatasi" yang hanya muncul di Android 13+, dan nama produsen perangkat pada saran
  "Aplikasi tak pernah tidur".
- Catatan: perbedaan arsitektur yang tersisa (logika scrobble Scrola berjalan di JS/WebView,
  sedangkan Pano murni native) BELUM disentuh. Kalau setelah dua hambatan perangkat di atas
  diselesaikan ternyata deteksi mengalir tapi scrobble tetap tidak tercatat saat app di latar,
  barulah pemindahan logika ke lapisan native terbukti perlu.

### Added — Catatan pribadi 140 karakter pada tiket
- Pengguna bisa menulis catatan singkat pada lagu yang sedang diputar (layar Sekarang) maupun
  pada tiket mana pun di Riwayat. Catatan tampil menempel di bawah tiket dengan gaya berbeda
  (miring, garis amber di kiri) — seperti coretan tangan di balik tiket sungguhan, jelas
  dibedakan dari metadata lagu.
- **Catatan menempel pada satu PEMUTARAN, bukan pada lagu.** Memutar lagu yang sama dua kali
  menghasilkan dua tiket dengan cerita masing-masing — sesuai premis "satu tiket, satu momen".
  Diverifikasi lewat simulasi: catatan pemutaran lama tidak tertimpa oleh catatan pemutaran baru.
- **Catatan tidak pernah dikirim ke Last.fm** (tidak ada field untuk itu di API mereka, dan itu
  memang lebih baik). Disebutkan eksplisit di UI editor.
- **`noteLogic.ts`** (fungsi murni + 20 assertion): batas panjang dihitung per GRAFEM lewat
  `Intl.Segmenter`, bukan `string.length`. Alasannya konkret: `'🎧'.length` bernilai 2, sehingga
  satu emoji memakan dua jatah dan hitungan sisa yang dilihat pengguna jadi tidak masuk akal;
  emoji majemuk bisa terbelah jadi karakter rusak (�) saat dipotong di batas. Ada fallback
  `Array.from` untuk WebView lawas. `normalizeNoteForSave()` memastikan catatan kosong tersimpan
  sebagai NULL, bukan string kosong — supaya UI tidak perlu mengecek dua kondisi untuk hal sama.
- **`pendingNotes.ts`**: menampung catatan yang ditulis SEBELUM barisnya ada di riwayat. Catatan
  menempel pada baris riwayat, tapi baris itu baru terbentuk setelah scrobble terkirim ke Last.fm
  — padahal momen orang ingin menulis justru saat lagunya berjalan, jauh sebelum ambang tercapai
  dan bisa jadi saat offline. Catatan tertunda diterapkan secara DETERMINISTIK tepat setelah
  `addHistoryBatch()` menulis riwayat, bukan lewat penundaan berbasis timer yang rapuh.
- **Migrasi DB v2** (`ALTER TABLE scrobble_history ADD COLUMN note TEXT`). Kolom ini SENGAJA tidak
  ikut ditambahkan ke `CREATE TABLE` v1: kalau ada di dua tempat, instalasi baru membuat kolomnya
  di v1 lalu v2 gagal dengan "duplicate column name" karena `ALTER TABLE` tidak punya
  `IF NOT EXISTS`. Migrasi harus menceritakan sejarah apa adanya, bukan keadaan akhir.
- Guard sinkron anti double-tap pada tombol simpan; draft catatan direset saat lagu berganti
  (tanpa itu catatan lagu sebelumnya bisa tersimpan ke tiket yang salah).

### Belum dikerjakan — konsekuensi yang disadari dari fitur catatan
- **Ekspor/cadangan belum ada, dan fitur ini membuatnya jadi kebutuhan nyata.** Scrobble bisa
  dipulihkan dari server Last.fm; catatan TIDAK — ia hanya ada di perangkat. Kalau app dihapus
  atau DB rusak, catatan hilang selamanya. Ini harus dikerjakan sebelum pengguna mengumpulkan
  banyak catatan untuk hilang.
- Penampung catatan tertunda ada di MEMORI, jadi catatan yang belum sempat menempel akan hilang
  kalau app ditutup paksa sebelum scrobble terkirim. Memindahkannya ke tabel DB akan menutup
  celah ini; ditunda karena menambah tabel + migrasi untuk kasus yang relatif jarang.
- Tampilan kalender bulanan (bagian kedua dari ide asli) SENGAJA belum dikerjakan — risiko
  "kalender dengan mayoritas kotak kosong terlihat rusak" baru bisa dinilai setelah ada data
  riwayat yang cukup, dan riwayat sendiri belum terbukti terisi di perangkat.
- **BELUM tervalidasi di perangkat.** Migrasi v2 khususnya perlu diperhatikan: ini migrasi DB
  pertama yang benar-benar dijalankan pada database yang sudah ada isinya.

### Fixed — Lagu dari player internal TIDAK PERNAH tercatat (pipeline scrobble terputus)
- **Akar masalah:** player internal mengirim event lewat plugin `Player`
  (`playerPositionChanged`), sedangkan satu-satunya jalur yang memicu scrobble ada di
  `useNowPlaying` yang hanya mendengarkan event plugin `NowPlaying` (deteksi eksternal). Kedua
  plugin ini terpisah, jadi lagu yang diputar DI DALAM Scrola tidak pernah melewati pengecekan
  scrobble sama sekali — memutar musik, memperbarui UI & tiket, tapi Riwayat tetap kosong. Ini
  melanggar prinsip inti "satu pipeline" proyek.
- **`maybeScrobble()` terpusat di `scrobbleEngine`**: satu fungsi berisi aturan eligibility +
  guard anti-dobel (Set level-modul) + enqueue, dipakai bersama. `NowPlayingScreen` kini
  memanggilnya untuk player internal via `player.state`, dengan `sourcePackage='com.scrola.app'`.
  Divalidasi dengan 10 assertion simulasi (ambang, anti-dobel event beruntun, lagu <30s ditolak,
  reset saat track berganti memungkinkan replay tercatat lagi).
- **Batasan diketahui (jujur):** pengecekan scrobble internal berjalan saat tab Sekarang
  ter-render. Untuk player internal ini dapat diterima — memutar di Scrola berarti pengguna sedang
  di layar itu, dan guard mencegah pengiriman ganda. Penyatuan penuh jalur eksternal
  (`useNowPlaying` masih pakai guard lokalnya sendiri) SENGAJA ditunda: jalur itu sudah berfungsi
  di perangkat, dan menyentuhnya sekarang berisiko regresi tanpa pengujian device. Dicatat sebagai
  langkah lanjutan.
- **BELUM tervalidasi di perangkat** — perbaikan ini murni JS (menghindari build native lagi dalam
  siklus debug), tapi logika pemicunya bergantung pada `player.state` yang datang dari event native
  yang belum pernah kita amati sungguhan sampai lagu penuh. Uji: putar lagu internal 2-3 menit
  sampai lewat separuh, cek Riwayat.

### Added — Timeline geser di pemutar internal (bisa mengulang bagian favorit)
- **`SeekTimeline`**: bar posisi yang bisa digeser dengan jari, lengkap dengan waktu berjalan &
  durasi. Sebelumnya tidak ada cara melompat ke bagian lagu tertentu — tombol ±10s hanya penopang
  kasar. Ini celah desain, bukan keterbatasan teknis: layar Sekarang mengganti progress bar
  tradisional dengan metafora "tiket tercetak", tapi tiket menunjukkan progres menuju SCROBBLE,
  bukan posisi dalam lagu. Keduanya menjawab pertanyaan berbeda, jadi keduanya perlu ada.
- **Penanda ambang scrobble di timeline** — garis kecil menunjukkan titik di mana lagu resmi
  tercatat, berubah jadi amber setelah dilewati, dengan label "tercatat di 1:47" / "✓ melewati
  titik catat". Ini menyatukan dua konsep yang tadinya terpisah dan menjawab pertanyaan yang
  selama ini hanya bisa ditebak: "kalau saya lompat ke sini, lagunya masih tercatat tidak?"
- Detail interaksi: area sentuh 36px meski bar hanya 4px (bar tipis mustahil dikenai jari akurat);
  posisi saat menggeser ditentukan jari dan TIDAK ditimpa pembaruan dari pemutar (tanpa pemisahan
  ini bar "melawan" jari — tersentak balik tiap event posisi tiba); handle membesar saat disentuh;
  atribut `role="slider"` + `aria-valuetext` untuk pembaca layar.
- **`seekLogic.ts`** (fungsi murni + 17 assertion test): konversi koordinat↔waktu dengan clamping,
  aman terhadap lebar elemen 0 (render pertama sebelum layout) dan durasi 0 — tanpa guard itu
  hasilnya NaN/Infinity yang diteruskan ke `seekTo()` bisa membuat ExoPlayer melempar error.

### Added — Kartu tiket yang dibagikan kini menonjolkan album art
- **Latar buram dari album art itu sendiri.** Setiap tiket kini terasa "milik lagu itu" alih-alih
  template seragam — warna dominan sampul meresap ke seluruh gambar. Ditambah tirai gelap
  bergradien (0,94 di tepi, 0,80 di tengah) agar teks & kartu tetap terbaca di atas sampul terang.
- **Teknik blur sengaja BUKAN `ctx.filter = 'blur()'`.** Dukungan filter di WebView Android tidak
  merata antar versi/vendor, dan kalau tak didukung ia gagal DIAM-DIAM — album art tergambar penuh
  tanpa blur, teks jadi tak terbaca, dan tak ada yang tahu sampai ada yang mengeluh. Sebagai
  gantinya: art digambar ke kanvas mungil (36×64) lalu diperbesar penuh dengan interpolasi
  kualitas tinggi; pembesaran ekstrem itu sendiri menghasilkan gradasi lembut menyerupai blur.
  Bekerja di mana pun canvas bekerja, dan jauh lebih murah dari blur sungguhan.
- **Disc diperbesar dari 420px ke 520px** (39% → 48% lebar kanvas), dengan alur vinyl ketiga dan
  label tengah yang ikut diskalakan proporsional. Posisi vertikal dihitung ulang (cardY+380) agar
  menyisakan 42px dari label atas dan 136px ke garis putus di bawah.
- **Tata letak diverifikasi secara VISUAL**, bukan hanya aritmatika: komposisi dirender ulang
  sebagai mockup PIL untuk memastikan tak ada tabrakan antar elemen sebelum dikirim. Ini menutup
  celah yang selama proyek ini berulang kali disebut — "tidak bisa memverifikasi tampilan dari
  sini" — setidaknya untuk geometri tata letak.
- `art` kini dimuat sekali di awal (dipakai latar + disc), bukan dua kali.

### Fixed — Kualitas & distorsi album art pada gambar tiket yang dibagikan
- **`imageSmoothingQuality = 'high'`** diaktifkan pada canvas. Default browser adalah `'low'`,
  sehingga album art yang diskalakan ke ukuran disc tampak kasar & bergerigi padahal sumbernya
  tajam. Ini pengaturan tunggal yang paling terasa dampaknya pada ketajaman hasil akhir, dengan
  biaya hanya beberapa milidetik.
- **Distorsi aspek rasio diperbaiki (bug nyata).** Album art sebelumnya diregangkan paksa jadi
  persegi (`drawImage` dengan lebar=tinggi=diameter). Untuk artwork persegi — mayoritas kasus —
  itu kebetulan benar, tapi artwork yang TIDAK persegi (sampul single 1000×800, scan piringan)
  jadi penyok/gepeng di gambar yang dibagikan, dan langsung terlihat oleh penerimanya. Kini
  memakai pola "cover": aspek rasio dipertahankan, bagian tengah diambil.
- **Resolusi sumber SENGAJA tidak dinaikkan.** Sempat dipertimbangkan menaikkan
  `maxDimensionPx` di `ImageUtils`, tapi analisisnya tidak mendukung: album art ≤500KB sudah
  diteruskan apa adanya (resolusi asli, tanpa kompresi ulang), dan yang >500KB dikecilkan ke 800px
  — masih 1,9× dari ukuran render disc (420px). Menaikkannya hanya menambah pemakaian memori tanpa
  perbedaan yang terlihat. Batas sesungguhnya ada pada resolusi artwork yang tertanam di file MP3
  itu sendiri, yang di luar kendali aplikasi.

### Added — Panel diagnosis "Antrean Scrobble" di Pengaturan
- Menampilkan jumlah lagu yang menunggu dikirim, jumlah percobaan, **pesan kegagalan terakhir**
  dari Last.fm, dan tombol kirim ulang manual.
- **KENAPA:** Riwayat hanya menampilkan scrobble yang SUDAH berhasil terkirim. Ketika riwayat
  kosong, tiga kondisi yang sangat berbeda tampak identik dari luar: (1) lagu tak pernah memenuhi
  syarat sehingga tak pernah masuk antrean, (2) masuk antrean tapi pengiriman ditolak/gagal,
  (3) tidak ada deteksi sama sekali. Tanpa melihat isi antrean, ketiganya mustahil dibedakan dan
  perbaikan apa pun hanya jadi tebakan. Kolom `last_error` selama ini SUDAH ditulis ke DB tapi
  tak pernah ditampilkan di mana pun — informasi diagnostik yang terbuang.
- Query baru `getQueueStatus()` (jumlah, percobaan terbanyak, error terakhir, timestamp tertua).
- Dilatarbelakangi laporan nyata: deteksi YouTube Music terlihat bekerja (notifikasi muncul) tapi
  Riwayat tetap kosong — tanpa panel ini tidak ada cara menentukan di titik mana rantai putus.

### Added — Kartu "Sedang Diamati" di layar Sekarang
- Saat player internal kosong TAPI ada aplikasi musik lain yang terdeteksi, layar Sekarang kini
  menampilkan kartu ringkas: nama sumber (Spotify/YouTube Music/dll), judul & artis, titik indikator
  berdenyut saat memutar, dan bar progres menuju ambang scrobble ("tercatat dalam 1:24").
  Sebelumnya layar utama menampilkan "Belum ada cerita" meski Scrola sedang mencatat di latar —
  terlihat seperti rusak, dan pengguna tak punya cara memastikan deteksi bekerja tanpa membuka
  tab Pengaturan. Dilaporkan langsung oleh pengguna yang mengalami kebingungan itu.
- Tampilannya sengaja DIBEDAKAN dari panggung tiket player internal (kartu datar, tanpa disc
  berputar, tanpa slot printer): ini "yang Scrola amati", bukan "yang kamu putar di Scrola".
- Empty state juga diperbaiki: kini menyebut bahwa Scrola mencatat dari aplikasi mana pun, dan
  mengarahkan ke pengaturan **Akses notifikasi** kalau belum ada deteksi — penyebab paling umum
  ketika pengguna merasa "kok tidak terdeteksi".
- `sourceLabels.ts` baru: pemetaan package→nama app dipindah dari `SettingsScreen` jadi modul
  bersama (kini dipakai 2 layar; duplikasi akan cepat divergen). Daftar diperluas ke 11 app.
  Package tak dikenal ditampilkan apa adanya, bukan disamarkan — memudahkan pengguna melaporkan
  app yang belum terdaftar.

### Risiko diketahui — perlu divalidasi di perangkat (BELUM diperbaiki)
- Posisi pemutaran aplikasi eksternal hanya diterima saat `onPlaybackStateChanged` menyala
  (play/pause/seek), **bukan tiap detik**. Dua konsekuensi yang perlu diuji:
  (a) bar progres di kartu bisa terlihat melompat/diam alih-alih mengalir;
  (b) **lebih serius** — pengecekan kelayakan scrobble ikut bergantung event yang sama, sehingga
  lagu yang diputar lurus tanpa jeda berpotensi tidak pernah memicu evaluasi ambang dan
  scrobble-nya terlewat.
  Belum diperbaiki secara sengaja: seberapa sering app seperti Spotify/YT Music mengirim
  pembaruan sangat bergantung implementasi masing-masing, dan menambah polling posisi punya biaya
  baterai. Validasi dulu, baru putuskan — sesuai pelajaran sesi ini: jangan memperbaiki tebakan.

### Fixed — Crash saat menekan pause: ExoPlayer diakses dari thread yang salah
- **Semua akses player di `PlayerPlugin` kini dibungkus `mainHandler.post { }`** (`pause`,
  `resume`, `seekTo`, dan `getState`). ExoPlayer menolak diakses dari thread selain main dan
  melempar `IllegalStateException: Player is accessed on the wrong thread`, sementara method
  `@PluginMethod` Capacitor berjalan di thread `'CapacitorPlugins'`. `call.resolve()` ikut
  dipindah ke dalam blok tersebut (Capacitor mengizinkan resolve asinkron).
- Aturan ini berlaku untuk **pembacaan** juga, bukan hanya perintah — karena itu `getState()`
  (posisi/durasi/isPlaying) ikut dibungkus, padahal sekilas tampak tidak berbahaya.
- Titik akses lain diverifikasi sudah aman: polling posisi dan `waitForServiceAndRun` keduanya
  berjalan di dalam runnable yang di-post ke `mainHandler`, sehingga `playUri` juga sudah di main
  thread.
- Aturan didokumentasikan di DUA tempat — di titik definisi (`PlaybackService`) dan di agen
  `native-android-specialist` — agar kontributor berikutnya tidak mengulanginya. Kelas bug ini
  tidak tertangkap compiler; hanya muncul saat dijalankan.
- Ditemukan lewat `CrashLogger` internal Scrola yang menunjuk baris persisnya — fitur diagnostik
  yang dibangun jauh sebelumnya akhirnya terpakai sesuai tujuannya.

### Milestone — Otorisasi Last.fm berhasil penuh 🎉
- Rantai login tuntas di perangkat nyata: token diambil, browser otorisasi terbuka, sesi ditukar,
  dan **sesi tersimpan di Keystore** (SecureStore berfungsi setelah urutan `registerPlugin`
  dikembalikan). Pengguna berhasil masuk, memilih lagu dari perangkat, dan memutarnya.

### Fixed — REGRESI YANG DIPERKENALKAN SENDIRI: urutan `registerPlugin` di MainActivity
- **Urutan `registerPlugin()` dikembalikan ke SEBELUM `super.onCreate()`** (posisi aslinya, dan
  sesuai dokumentasi resmi Capacitor). `registerPlugin()` hanya menambah kelas ke daftar
  `initialPlugins`; yang MEMBANGUN bridge dari daftar itu adalah `super.onCreate()`. Mendaftarkan
  sesudahnya membuat bridge terlanjur dibuat tanpa plugin-plugin tersebut, sehingga setiap panggilan
  dari JS gagal: `"SecureStore" plugin is not implemented on android` — yang menggagalkan
  penyimpanan sesi tepat setelah otorisasi Last.fm berhasil.
- **Asal regresi (jujur):** urutan ini sempat dibalik sebagai tebakan penyebab crash startup, dan
  dinyatakan dengan keyakinan tinggi tanpa bukti log. Tebakan itu keliru — crash sebenarnya karena
  kode Kotlin tidak ter-compile sama sekali (plugin Kotlin tak aktif di Gradle). Mengubah kode yang
  tidak rusak justru menanam bug baru yang baru muncul beberapa build kemudian, setelah masalah
  lain teratasi. Pelajaran: jangan mengubah kode berdasarkan tebakan; tunggu log.

### Milestone — Perbaikan CORS terbukti bekerja
- Error yang muncul kini berasal dari `saveSession()`, BUKAN dari pemanggilan API. Artinya seluruh
  rantai jaringan sudah lolos: `auth.getToken` berhasil, browser otorisasi terbuka, dan
  `auth.getSession` mengembalikan sesi yang valid. Penggantian `fetch()` → `CapacitorHttp`
  terkonfirmasi menyelesaikan blokir CORS di WebView.

### Fixed — "Tidak bisa menghubungi Last.fm" padahal internet normal (CORS di WebView)
- **`fetch()` diganti `CapacitorHttp`** di `lastfm.ts`. Capacitor memuat app dari origin
  `https://localhost`, sehingga `fetch()` di dalam WebView tunduk aturan CORS browser. API Last.fm
  tidak mengirim header `Access-Control-Allow-Origin` (ia memang untuk klien native), jadi setiap
  request **diblokir WebView sebelum sempat terkirim** — muncul sebagai kegagalan jaringan generik
  yang menyesatkan ("periksa koneksi internet") padahal koneksi baik-baik saja. `CapacitorHttp`
  menjalankan request di lapisan native Android sehingga CORS tidak berlaku. Bug ini hanya muncul
  di perangkat; di lingkungan dev tertutup proxy Vite.
- Batas waktu tetap dipertahankan (`connectTimeout`/`readTimeout` menggantikan `AbortController`) —
  tanpa itu, satu request menggantung bisa mengunci mutex `flushQueue()` permanen sampai app
  di-restart, dan tidak ada scrobble lain yang akan terkirim.
- Balasan non-JSON (mis. halaman captive portal WiFi) kini ditangani dengan pesan yang jelas,
  bukan error parse yang membingungkan.
- **`LoginScreen` tidak lagi mengasumsikan setiap kegagalan = masalah internet.** Penyebab asli
  ditampilkan; kegagalan dari Last.fm ditampilkan dengan kode + pesannya. Pola yang sama dengan
  perbaikan diagnosis auth sebelumnya: berhenti menebak, tampilkan sebab sesungguhnya.

### Fixed — Koreksi panduan: Callback URL harus DIKOSONGKAN (alur otorisasi mobile)
- Panduan sempat keliru menyuruh mengisi Callback URL dengan `scrola://auth-callback`. Last.fm
  menolaknya ("Enter a valid URL" — kolom itu hanya menerima http/https) dan formulirnya sendiri
  menyatakan: *"This field isn't used for desktop or mobile authentication."* Scrola adalah
  aplikasi mobile, jadi kolom itu memang tidak dipakai. Kedua panduan dikembalikan ke
  "kosongkan", kini disertai penjelasan KENAPA agar tidak salah lagi.
- `LoginScreen` kini menampilkan petunjuk saat menunggu otorisasi: setelah menekan "Allow",
  pengguna perlu MENUTUP tab browser agar Scrola menyelesaikan penukaran token (alur mobile
  Last.fm tidak melakukan redirect balik). Langkah ini tidak intuitif dan sebelumnya tak
  dijelaskan di mana pun.
- Catatan teknis: intent-filter `scrola://auth-callback` di manifest kini efektif tidak terpakai
  (dipertahankan sebagai jalur cadangan yang tidak berbahaya); penukaran token bergantung pada
  listener `browserFinished`.

### Fixed — Diagnosis kegagalan otorisasi Last.fm
- **`LoginScreen` menelan semua kegagalan auth jadi satu pesan generik** ("Belum sempat
  mengizinkan akses...") padahal `lastfm.ts` sudah melempar `LastfmApiError` dengan kode spesifik.
  Penyebab yang sangat berbeda — API secret salah (kode 13), API key salah (10), token belum
  diotorisasi (14), token kedaluwarsa (4/15) — semuanya tampak sama, sehingga pengguna & developer
  hanya bisa menebak. Kini tiap kode menampilkan pesan + langkah perbaikan yang tepat, dan kode
  tak dikenal ditampilkan apa adanya (`kode N: pesan`) alih-alih disembunyikan.
- **Panduan diperbaiki: Callback URL WAJIB diisi `scrola://auth-callback`** — panduan sebelumnya
  keliru menyuruh mengosongkannya. Manifest sudah punya intent-filter untuk skema itu; tanpa
  callback terdaftar di Last.fm, pengguna tidak dikembalikan ke app setelah menekan Allow dan
  otorisasi terasa macet/gagal. Diperbaiki di `docs/PANDUAN_API_KEY.md` dan
  `docs/PANDUAN_BUAT_APK.md`.

### Milestone — App berhasil terbuka di perangkat nyata 🎫
- Setelah rantai perbaikan build (TypeScript hilang → ESM/CommonJS → plugin Kotlin tak aktif →
  duplikat `MainActivity` saat dexing), APK akhirnya terpasang DAN terbuka di HP: layar Login
  tampil utuh dengan tiket "ADMIT ONE", palet Hutan Malam, font Fraunces/IBM Plex Mono, dan
  perforasi tiket — sesuai spec desain. Rendering WebView terkonfirmasi bekerja.

### Fixed — Audit rantai compile menyeluruh (setelah bug Kotlin): jvmTarget hilang
- **`kotlinOptions.jvmTarget` tidak diset** — tersangka kegagalan build berikutnya setelah plugin
  Kotlin diaktifkan. Capacitor 6 menyetel Java ke 17, tapi kompiler Kotlin default ke JVM 1.8;
  target yang tidak konsisten menggagalkan Gradle dengan "Inconsistent JVM-target compatibility
  (Java 17 vs Kotlin JVM 1.8)". `apply-native-overlay.cjs` kini menyuntikkan
  `kotlinOptions { jvmTarget = '17' }` ke blok `android {}`. Diuji end-to-end + idempoten bersama
  seluruh penyuntikan lain.

### Internal — Audit "apakah semuanya ter-compile & ter-package" (kelas bug baru pasca-Kotlin)
- Setelah bug plugin Kotlin, audit diarahkan ke pertanyaan yang berbeda dari sebelumnya: bukan
  "apakah kode benar" tapi "apakah setiap potong kode benar-benar ikut ter-compile & masuk APK".
- **Diverifikasi bersih**: kelima kelas yang didaftarkan manifest (MainActivity, PlaybackService,
  ScrobbleForegroundService, ScrolaApplication, ScrolaNotificationListener) punya file `.kt`; semua
  13 file `.kt` berpackage `com.scrola.app` yang cocok dengan folder & `applicationId` (kalau tidak
  cocok = ClassNotFoundException tersembunyi); semua import lokal TS resolve ke file nyata (nol
  broken import); semua import library Kotlin (media3.common/exoplayer/session, mp3agic, androidx.core,
  getcapacitor) punya dependensi yang tersuntik; Java 21 di CI cukup untuk media3 1.4.x.
- Pengujian idempoten script overlay dijalankan berulang untuk memastikan penyuntikan Kotlin,
  jvmTarget, dan dependensi tidak menduplikasi saat script jalan >1×.

### Fixed — Build gagal di tahap dexing (dexBuilderDebug)
- **AKAR (dari log `--info`): `MainActivity` terdefinisi ganda** — `npx cap add android` membuat
  `MainActivity.java` dari template Capacitor, lalu overlay menambahkan `MainActivity.kt` (versi
  Kotlin dengan registrasi plugin). Keduanya meng-compile jadi `com.scrola.app.MainActivity`, dan
  dexer menolak: "Type com.scrola.app.MainActivity is defined multiple times
  (kotlin-classes/... vs javac/...)". Build meng-compile keduanya tanpa protes; baru dexer yang
  gagal. Script overlay kini **menghapus file `.java` template yang punya padanan `.kt`** sebelum
  menyalin — dilakukan secara umum (semua `.kt` overlay, bukan hanya MainActivity) agar tahan
  perubahan template. Diuji end-to-end: `.java` terhapus, `.kt` tetap, idempoten.
- (Perbaikan sebelumnya di baris ini — menyamakan `compileOptions` Java & Kotlin ke 17 — ternyata
  BUKAN penyebab dexing gagal, tapi tetap benar & diperlukan agar target bytecode konsisten.)
- `build.yml` kini `--stacktrace --info` pada langkah build — justru inilah yang memunculkan
  `Caused by: ... defined multiple times` yang sebelumnya tersembunyi. Diagnosis berbasis log,
  bukan tebakan.

### Added — Perilaku pemutaran audio yang benar (bukan enhancement kualitas)
- **`AudioAttributes` (USAGE_MEDIA + CONTENT_TYPE_MUSIC) + `handleAudioFocus`** pada ExoPlayer:
  Android kini merutekan audio Scrola sebagai musik (mengikuti volume media, bukan dering) dan
  otomatis meredup/berhenti-lanjut saat ada telepon/notifikasi alih-alih menabrak audio aplikasi
  lain. **Bukan** peningkatan kualitas suara — Scrola tidak memproses audio; kualitas ditentukan
  file sumber + DAC perangkat. Ini soal perilaku pemutar yang benar.
- **`handleAudioBecomingNoisy`**: auto-pause saat headphone/Bluetooth dicabut — mencegah lagu
  tiba-tiba menggelegar dari speaker HP di tempat umum. Perilaku standar yang diharapkan setiap
  pemutar musik.
- Keputusan produk (via prinsip feature-architect): Scrola SENGAJA tidak menambah equalizer,
  upsampling, atau mode Hi-Res/bit-perfect. Itu ranah audiophile player (Poweramp, Neutron, UAPP)
  yang bukan posisi Scrola sebagai "scrobbler ringan, aman, indah". Player internal ada terutama
  agar sesi media terbaca pipeline scrobble yang sama, bukan untuk jadi pemutar audiophile.

### Fixed — Audit rantai compile (gelombang 9): jvmTarget Kotlin
- **`kotlinOptions.jvmTarget` tidak diset** — Capacitor 6 menyetel Java ke 17, tapi kompiler Kotlin
  default ke JVM 1.8. Ketidakcocokan ini menggagalkan build dengan "Inconsistent JVM-target
  compatibility (Java 17 vs Kotlin JVM 1.8)". `apply-native-overlay.cjs` kini menyuntikkan
  `kotlinOptions { jvmTarget = '17' }` ke blok `android {}`. Ditemukan saat menelusuri rantai
  file→compile→package secara sistematis setelah bug Kotlin; diuji end-to-end + idempoten.

### Internal — Audit rantai compile (gelombang 9): "apakah semua ter-compile & ter-package?"
- Setelah bug Kotlin (kelas "kode benar tapi tak ter-compile"), audit diarahkan ke seluruh rantai
  sumber→compile→package→runtime. **Diverifikasi bersih**: kelima kelas manifest punya file `.kt`;
  ke-13 file `.kt` berpackage `com.scrola.app` yang benar (cocok folder → tak ada
  ClassNotFoundException tersembunyi); `applicationId` konsisten; semua import lokal TS resolve ke
  file nyata; `index.html` bersih (#root ada, entry benar); semua import Kotlin eksternal
  (media3.common/exoplayer/session, mp3agic, androidx.core) punya dependensinya; NotificationListener
  & Playback(MediaSessionService) punya intent-filter + permission yang benar; `POST_NOTIFICATIONS`
  yang diminta kode ada di manifest; versi `@capacitor/*` seragam (major 6); Java 21 cukup.
- Catatan proses: dua "temuan" awal (deps dobel, marker 2×) terbukti false-positive dari hitungan
  grep mentah setelah diverifikasi teliti — sama seperti gelombang 8. Melaporkan bug palsu sama
  merugikannya dengan melewatkan yang nyata.

### Fixed — AKAR crash startup: plugin Kotlin tidak aktif (ditemukan dari log device)
- **Seluruh kode native Scrola berbahasa Kotlin, tapi template Android Capacitor 6 murni Java —
  plugin Kotlin tidak pernah diaktifkan di Gradle.** Akibatnya build SUKSES (Gradle hanya
  mengabaikan file `.kt` yang tak dikenalnya), APK terbentuk & terinstall, TAPI nol kelas Kotlin
  masuk APK. App crash instan saat dibuka: `RuntimeException: Unable to instantiate application
  com.scrola.app.ScrolaApplication` → `ClassNotFoundException`. Ini bug paling fundamental proyek —
  lolos SEMUA pemeriksaan build (build memang tidak error) dan hanya ketahuan dari bug report
  perangkat nyata (gejala: "Scrola ditutup karena aplikasi ini memiliki bug"). Diperbaiki:
  `apply-native-overlay.cjs` kini menyuntikkan `classpath kotlin-gradle-plugin:1.9.25` ke root
  `build.gradle` dan `apply plugin: 'kotlin-android'` ke app `build.gradle`. Diuji end-to-end
  terhadap template Capacitor 6 tiruan + idempoten.
- Catatan: perbaikan urutan `super.onCreate()`/`registerPlugin` dan `base: './'` sebelumnya tetap
  benar & diperlukan, tapi tidak akan pernah berpengaruh selama bug Kotlin ini ada — karena app
  crash di `ScrolaApplication` bahkan SEBELUM mencapai `MainActivity`.

### Fixed — App crash saat dibuka di perangkat nyata (tap ikon → tidak terjadi apa-apa)
- **`MainActivity` memanggil `registerPlugin()` SEBELUM `super.onCreate()`** — urutan terbalik.
  `super.onCreate()` (di `BridgeActivity`) yang menginisialisasi bridge Capacitor; memanggil
  `registerPlugin()` sebelumnya mengakses bridge yang masih null → NullPointerException → app
  crash seketika saat dibuka (gejala: tap ikon tidak terjadi apa-apa, lalu sistem menawarkan
  "hapus data"). Komentar lama bahkan keliru menyebut "sebelum super.onCreate()" sebagai pola yang
  benar. Diperbaiki: `super.onCreate()` dulu, baru semua `registerPlugin()`. Ditemukan langsung
  dari menjalankan app di HP — kelas bug lifecycle native yang mustahil terlihat tanpa device.

### Fixed — App tidak terbuka di perangkat nyata (layar putih)
- **`vite.config.ts` tidak punya `base: './'`** — penyebab paling umum #1 untuk Capacitor + Vite.
  Tanpanya, Vite menulis path aset ABSOLUT (`/assets/index-xxx.js`) di `index.html`. Di WebView
  Android halaman dimuat dari `file:///android_asset/public/`, sehingga `/assets/...` menunjuk ke
  root filesystem perangkat (kosong) — JS & CSS tidak pernah termuat dan app tampak "tidak
  terbuka" (layar putih/hitam). Ditambahkan `base: './'` agar path aset relatif. Ini bug pertama
  yang ditemukan dari menjalankan app di HP sungguhan — tak mungkin terlihat tanpa device.
- Dicatat untuk perbaikan lanjutan (bukan penyebab layar putih, tapi terkait): font Google masih
  dimuat dari CDN (`fonts.googleapis.com`) via `<link>` di `index.html`. Punya fallback
  serif/sans-serif jadi app tetap tampil, tapi idealnya di-bundle lokal agar tampilan konsisten
  saat offline. Masuk backlog.

### Internal — Audit gelombang 8 (fokus: kelas bug yang lolos ke CI)
- Audit 5 putaran diarahkan ke kategori kesalahan yang baru terbukti lolos dari review manual:
  konfigurasi build, ESM/CommonJS, dependensi yang hilang, dan konsistensi lintas-lapisan yang
  hanya gagal saat runtime/compile — dengan menekankan VERIFIKASI JALAN, bukan sekadar baca.
- **Diverifikasi bersih** (beberapa sempat jadi false-positive grep lalu dikonfirmasi aman):
  semua `@capacitor/*` yang diimpor terdaftar di `package.json` (`@capacitor/preferences` hanya
  ada di komentar, bukan import nyata); nol import tak terpakai yang melanggar `noUnusedLocals`;
  keenam nama plugin cocok sempurna JS `registerPlugin` ↔ Kotlin `@CapacitorPlugin(name)` ↔
  registrasi `MainActivity` (ketidakcocokan di sini = bug runtime yang tak tertangkap compiler);
  signature `updateEntry`/`renderShareCard` konsisten antar-lapisan; tidak ada `useRef()` kosong;
  tidak ada JSX di file `.ts`.
- **Keamanan fitur share diverifikasi**: FileProvider hanya mengekspos `shared_images/` (DB &
  MP3 temp tak terjangkau), hanya `Base64.decode` (tanpa eval/exec), izin URI bersifat sementara,
  log tidak membocorkan data pengguna.
- Tidak ada bug baru yang nyata ditemukan di putaran ini — tapi verifikasi nama plugin & dependensi
  memberi keyakinan pada kelas kesalahan yang sebelumnya luput.

### Fixed — Dua bug ditemukan oleh build CI PERTAMA (yang tidak terdeteksi review manual)
- **Script overlay memakai CommonJS (`require`) padahal `package.json` ber-`"type": "module"`** —
  Node memperlakukan semua `.js` sebagai ES module, jadi script gagal dengan `ReferenceError:
  require is not defined in ES module scope`. Diganti ekstensinya ke **`.cjs`**
  (`scripts/apply-native-overlay.cjs`) — Node memperlakukan `.cjs` sebagai CommonJS terlepas dari
  `"type"`, jadi isi script tidak perlu diubah sama sekali. Rujukan di `package.json`, README,
  dan CONTRIBUTING.md diperbarui. Script kini diuji end-to-end terhadap struktur
  `android/` tiruan hasil `cap add`: 14 file Kotlin tersalin, strings tergabung tanpa duplikat,
  minSdk 22→23, ketiga dependensi tersuntik ke blok yang benar.
- **`typescript` tidak pernah terdaftar di `package.json`** — padahal seluruh proyek ditulis dalam
  TypeScript. Akibatnya `npx cap add android` gagal ("Could not find installation of TypeScript.
  To use capacitor.config.ts files, you must install TypeScript"). Ditambahkan bersama
  `@types/react`, `@types/react-dom`, `@types/node` yang juga hilang. Kelas kesalahan ini mustahil
  terlihat dari pembacaan kode — hanya build sungguhan yang menangkapnya.
- **Dependensi native tidak pernah masuk ke `build.gradle`** — `apply-native-overlay.js` hanya
  MENCETAK pengingat "tambahkan Media3 secara manual". Langkah manual itu mustahil dijalankan di
  CI (GitHub Actions membuat folder `android/` baru dari template setiap kali), sehingga build
  Gradle pasti gagal dengan "Unresolved reference: media3". Script kini **menyuntikkan dependensi
  otomatis**: `media3-exoplayer/session/common` (player internal), `mp3agic` (editor tag), dan
  `androidx.core-ktx` (NotificationCompat + FileProvider). Idempoten, dan regex `^dependencies\s*\{`
  diverifikasi tidak salah menyisipkan ke blok `dependencies` bersarang di dalam `buildscript`.

### Changed — CI kini bisa membangun APK tanpa tooling lokal sama sekali
- `build.yml` & `release.yml` **membuat folder `android/` sendiri** (`npx cap add android` +
  `npm run native:overlay`) kalau belum ada di repo. Sebelumnya CI menolak build dan menyuruh
  pengguna menjalankan perintah di komputernya dulu — itu penghalang nyata bagi orang yang tidak
  punya Node.js terpasang. Sekarang seseorang bisa: upload kode lewat web GitHub → isi 2 secret →
  Run workflow → unduh APK. Nol instalasi.
- `build.yml` **memeriksa GitHub Secrets di langkah pertama** dan gagal dengan pesan yang menuntun
  (nama secret yang benar + rujukan panduan) alih-alih baru gagal jauh di tengah build dengan
  error samar dari Vite.

### Added — Panduan pemula
- **`docs/PANDUAN_BUAT_APK.md`** — panduan dari nol sampai APK terpasang di HP untuk orang yang
  belum pernah ngoding: ambil API key (tabel isi formulir), upload ke GitHub lewat web, isi
  Secrets, jalankan workflow, unduh artifact, pasang di HP, aktifkan akses notifikasi. Ditutup
  dengan 4 masalah tersering + solusinya. Dirujuk paling atas di README.

### Added — Bagikan tiket sebagai gambar (Status WhatsApp / Story Instagram)
- Tombol **"Bagikan tiket"** di Now Playing: merender lagu yang sedang diputar jadi gambar tiket
  1080×1920 (rasio story, tidak terpotong di WA/IG) lalu membuka share sheet Android.
- **`src/lib/shareImage.ts`** — renderer Canvas API **bawaan browser, nol dependensi baru**.
  `html2canvas` (≈200KB) sengaja ditolak: berat, dan hasilnya sering meleset untuk efek kustom
  seperti perforasi tiket. Menggambar manual memberi kontrol penuh + hasil yang persis identitas
  Scrola (disc vinyl, perforasi, garis putus, tagline "Every song leaves a story").
- **`src/lib/shareCardLayout.ts`** — logic murni (truncate judul, ukuran font adaptif, format
  durasi, nomor tiket) + unit test, dipisah dari kode canvas supaya bisa diverifikasi tanpa DOM.
- **`SharePlugin.kt`** (plugin native baru) — base64 → PNG di cacheDir → `content://` URI lewat
  FileProvider → `Intent.ACTION_SEND` chooser. `@capacitor/share` tidak dipakai (nol dependensi
  npm baru + kontrol penuh atas FileProvider). Menangkap `OutOfMemoryError` secara eksplisit
  (bukan `Exception` — gambar 1080×1920 bisa beberapa MB di perangkat low-end).
- **FileProvider** didaftarkan di manifest dengan `exported="false"` + `grantUriPermissions`, dan
  lingkup path **dipersempit ke satu subfolder cache** (`res/xml/file_paths.xml`) — aplikasi
  penerima tidak punya jalan menyentuh file lain milik Scrola (DB scrobble, MP3 sementara).

### Batas yang jujur (didokumentasikan, bukan bug)
- Scrola hanya bisa **membuka share sheet**; pengguna sendiri yang memilih "WhatsApp → Status"
  atau "Instagram → Story". Posting **langsung** ke Status/Story tidak diimplementasikan: WhatsApp
  tidak punya API publik untuk itu, dan Instagram Story butuh SDK Meta + App ID terdaftar —
  menambah dependensi berat dan jalur pelacakan pihak ketiga, bertentangan dengan prinsip ringan &
  tanpa-telemetri Scrola.

### Fixed — Audit 5 putaran atas fitur share
- **Guard sinkron anti double-tap** pada tombol Bagikan (render canvas makan ratusan ms; dua tap
  cepat memicu dua render + dua chooser).
- File PNG **tidak dihapus setelah `startActivity`** — app tujuan membacanya SETELAH chooser
  ditutup, jadi menghapusnya di situ membuat mereka menerima gambar kosong. Solusi: nama file
  selalu sama (share berikutnya menimpa, tidak menumpuk) + folder dibersihkan saat plugin dimuat.

### Added — Onboarding kredensial
- **`docs/PANDUAN_API_KEY.md`** — panduan langkah-demi-langkah memasang API key Last.fm, ditulis
  untuk orang awam (analogi "kartu nama aplikasi", tabel isi formulir, contoh isi file, tabel 3
  masalah tersering + solusinya, cara menampilkan file tersembunyi di Mac/Windows). Dibuka dengan
  peringatan tegas bahwa **pengguna APK rilis TIDAK butuh API key sama sekali** — panduan ini hanya
  untuk yang membangun dari kode sumber.
- **Guard `isApiKeyMissing()`** di `lastfm.ts` + peringatan di `LoginScreen`: kalau app di-build
  tanpa kredensial, tombol "Hubungkan" diganti kotak penjelas yang menyebut file mana yang harus
  dibuat dan panduan mana yang harus dibaca. Sebelumnya, kesalahan paling umum saat build sendiri
  (lupa membuat `.env.local`) hanya menghasilkan error samar "Invalid API key" dari Last.fm yang
  tidak memberi tahu orang harus berbuat apa.
- `.env.example` kini menunjuk langsung ke panduan tersebut.

### Added — Roadmap v0.2.0 (dieksekusi termudah → tersulit)
- **Toggle loved/unloved dari riwayat** — ♥ di tiket kini tombol (hit target 44×44 lewat negative
  margin, glyph tetap kecil; `role="switch"` + `aria-checked`). Optimistic update dengan rollback
  penuh kalau Last.fm ATAU DB lokal gagal, supaya ♥ di layar tidak pernah berbohong tentang
  keadaan di server. Sengaja TANPA antrean offline: love adalah aksi manual & tidak hilang
  selamanya kalau gagal (beda dengan scrobble yang otomatis) — membangun retry untuk ini menambah
  kelas bug baru demi nilai kecil.
- **Edit & hapus scrobble** — tap tiket membuka sheet aksi (menu → form edit / konfirmasi hapus).
  Query baru `deleteHistoryEntry` & `updateHistoryEntry`, keduanya ter-parameterisasi penuh.
  UI **jujur menyatakan batasnya**: "Hanya riwayat lokal — profil Last.fm tidak berubah (batas API
  mereka)", karena API publik Last.fm tidak menyediakan hapus/edit scrobble.

### Changed — Roadmap v0.2.0
- **Ikon launcher, adaptive icon, monochrome & splash di-regenerasi ke palet Hutan Malam**
  (`branding/generate_icons.py` + `generate_splash.py`; konstanta PLUM→INK). Menutup backlog visual
  terakhir dari redesign — sebelumnya ikon masih plum lama sementara app sudah hijau lumut.
- **`foregroundServiceType` service scrobble: `mediaPlayback` → `dataSync`** (+ permission
  `FOREGROUND_SERVICE_DATA_SYNC`, + `startForeground` 3-argumen dengan
  `FOREGROUND_SERVICE_TYPE_DATA_SYNC` di API 29+). Service ini mendeteksi & MENGIRIM scrobble,
  tidak memutar media — tipe lama tidak jujur secara fungsi dan berisiko ditolak review Play Store
  di Android 14+. `PlaybackService` (yang benar-benar memutar audio) tetap `mediaPlayback`.
  Menutup *known issue* yang tercatat sejak audit gelombang 5.

### Fixed — Audit 5 putaran atas perubahan di atas
- **Race condition double-tap ♥**: dua tap cepat mengirim `track.love` dan `track.unlove` ke
  Last.fm hampir bersamaan; status akhir di server ditentukan oleh mana yang kebetulan tiba
  belakangan — bisa berlawanan dengan ♥ yang ditampilkan. Ditambahkan guard sinkron per-entri
  (`useRef<Set<number>>`, pola sama dengan anti-double-save MP3) yang juga melindungi hapus & edit.

### Internal — Review multi-agen gelombang 7 (7 agen, lintas domain)
- Review menyeluruh oleh seluruh agen sesuai perannya: feature-architect (struktur lapisan —
  disiplin, logic rawan bug semua di fungsi murni ber-test), native-android-specialist (semua
  jebakan 6 gelombang audit terverifikasi masih tertangani, nol regresi native), ui-craftsman
  (nol warna di luar token, aksesibilitas tersebar baik, satu-satunya teks 9px sesuai spec),
  security-reviewer (query baru ter-parameterisasi penuh; Sisi B terbukti murni lokal tanpa
  request keluar; guard token deep-link utuh), test-engineer (3 modul murni ter-cover, semua
  test menyuntik waktu tetap, nol regresi).
- **Fixed (privasi/konsistensi, temuan code-reviewer):** `notifyNowPlaying` tidak menghormati
  toggle "Scrobble dari app lain" — status now-playing dari Spotify/YT Music tetap terkirim ke
  profil Last.fm meski user mematikan pencatatan sumber eksternal. Kini ter-guard dengan
  preferensi yang sama seperti jalur scrobble; bila preferensi gagal terbaca, memilih diam
  (aman ke arah privasi). Belum tervalidasi di device.

### Changed — Redesign UI "Hutan Malam"
- **Palet baru hijau lumut + emas kuningan** menggantikan plum/amber (nilai token di
  `tailwind.config.js`; nama token tidak berubah sehingga seluruh className lama tetap jalan).
- Now Playing: progres scrobble kini divisualkan sebagai **tiket yang "tercetak"** keluar dari
  slot printer — tingginya mengikuti `elapsed / ambang scrobble` dari `scrobbleThresholdSec()`
  (satu sumber kebenaran dengan pipeline scrobble sungguhan); tiket "sobek" + toast saat resmi
  tercatat. Kontrol seek dibesarkan ke 56px, play 72px (standar hit target sentuh ≥44px).
- Riwayat: dikelompokkan **per hari** (header "Hari ini"/"Kemarin"/tanggal + jumlah lagu) lewat
  fungsi murni `historyGrouping.ts` yang diunit-test; tanggal dihapus dari tiket (pindah ke header
  grup); entri baru beranimasi masuk dengan border amber.
- Pengaturan: kartu akun **"Backstage Pass"** bergaya tiket (total scrobble & tahun bergabung
  dari DB lokal — tanpa request tambahan, konsisten prinsip tanpa-telemetri).
- Login: brand hero berbentuk **tiket "ADMIT ONE"** miring 1,5° dengan animasi keluar saat
  berhasil masuk. Seluruh logika auth (deep link guard, token safety) dipertahankan utuh.
- Navigasi tab kini **beranimasi** (slide ±40px + fade 0.4s, indikator amber meluncur di nav bar);
  ketiga screen ter-render menumpuk dengan `pointer-events` dikelola.

### Added — Redesign UI "Hutan Malam"
- **Layar "Sisi B"**: rekap mingguan naratif (lagu teratas "Tiket Emas", jam emas, artis baru
  "Penemuan", bar chart "Irama minggu" beranimasi stagger) — dihitung SEPENUHNYA dari SQLite
  lokal lewat fungsi murni `sisiBLogic.ts` (diunit-test) + query baru `getHistoryInRange` /
  `getDistinctArtistsBefore`. Dibuka dari pil "Bab" di Riwayat, overlay slide-up.
- Pengaturan: **toggle "Scrobble dari app lain"** — saat mati, event dari aplikasi musik lain
  diabaikan tapi player internal tetap mencatat. Preferensi disimpan via SecureStore yang sudah
  ada (sengaja TIDAK menambah dependensi `@capacitor/preferences` kembali — prinsip ringan),
  dibaca `useNowPlaying` dengan cache memori.
- Query `getAccountStats()` (total scrobble + tahun pertama) untuk kartu Backstage Pass.
- `scrobbleThresholdSec()` diekspor terpisah di `scrobbleLogic.ts` + test konsistensinya dengan
  `isScrobbleEligible` — dipakai bersama oleh pipeline scrobble dan visual tiket tercetak.
- Varian CSS baru: `.ticket-perforation-lg` (perforasi 16px untuk tiket hero) dan keyframe
  `fadeSlideIn` untuk entri riwayat baru.
- `docs/DEVLOG.md` — log keputusan desain redesign (dari design handoff).

### Catatan status (jujur)
- Seluruh redesign **belum tervalidasi di perangkat/CI** — nilai px/warna/timing mengikuti spec
  handoff high-fidelity, tapi rendering nyata di WebView Android perlu dicek di device.
- Ikon launcher & splash **masih memakai palet lama** (`branding/generate_icons.py` belum
  di-regenerasi) — sudah tercatat sebagai backlog di `docs/DEVLOG.md`.
- Tombol "Bagikan sebagai tiket" di Sisi B sengaja nonaktif bertanda "(segera)" — share-as-image
  adalah fase 2 sesuai handoff.

### Added — Tahapan proses GitHub
- `.editorconfig` — konsistensi format lintas editor untuk kontributor.
- `CODEOWNERS` — review PR otomatis (perlu diisi username asli sebelum push).
- `.github/dependabot.yml` — automasi update dependency mingguan (npm, Gradle, GitHub Actions),
  dikelompokkan per-ekosistem agar PR tidak berkeping-keping. Relevan langsung dengan rule
  keamanan: dependensi usang adalah sumber kerentanan yang mudah luput.
- `.github/workflows/release.yml` — workflow baru: saat tag `v*` di-push, otomatis build + jalankan
  test + buat **draft** GitHub Release dengan APK terlampir. Sengaja tetap draft (bukan
  auto-publish) sampai deskripsi rilis ditinjau manusia. Terpisah dari `build.yml` (yang tetap
  jalan tiap push ke `main` untuk build debug rutin).
- Badge status CI (Build Status) di README, tertaut ke `build.yml`.
- `docs/GITHUB_SETUP.md` — checklist konsolidasi semua langkah yang HANYA bisa dilakukan manual
  lewat GitHub UI (metadata repo, secrets, branch protection, aktivasi rilis pertama, signing key
  untuk build release Play Store di masa depan). Ini menyatukan semua "langkah manual" yang
  sebelumnya tersebar di berbagai dokumen jadi satu urutan yang jelas.

### Internal — Audit gelombang 6 (DB, manifest, bootstrap, CI)
- **Fixed (integritas data):** antrean scrobble tidak punya perlindungan duplikat — track yang
  sama bisa masuk dua kali (risiko scrobble ganda). Ditambah constraint `UNIQUE(artist, track,
  timestamp)` + `INSERT OR IGNORE` sebagai jaring pengaman terakhir, melengkapi guard flag di
  `useNowPlaying`.
- **Fixed:** `albumArtist` tersimpan di tabel riwayat tapi tidak pernah di-`SELECT` kembali —
  hilang dari data yang dibaca. Kini ikut diambil (berguna untuk ekspor CSV di roadmap).
- **Fixed (fungsional serius):** `ScrolaNotificationListener` dideklarasikan `exported="false"` di
  manifest — padahal `NotificationListenerService` di-bind oleh `system_server` dan butuh
  `exported="true"` agar bisa di-bind (deteksi musik bisa mati total tanpa ini). Tetap aman karena
  dilindungi permission sistem `BIND_NOTIFICATION_LISTENER_SERVICE`.
- **Fixed:** `openNotificationAccessSettings` bisa crash (NPE/`ActivityNotFoundException`) — kini
  pakai `FLAG_ACTIVITY_NEW_TASK` + `resolveActivity` + try/catch.
- **Fixed:** non-null assertion `document.getElementById('root')!` di `main.tsx` diganti guard
  informatif.
- **Fixed (CI):** `npm test` dipindah SEBELUM `npm run build` — fail-fast, dan test murni tidak
  butuh kredensial `VITE_LASTFM_*` sehingga lebih andal dijalankan lebih dulu.
- Diverifikasi: `parseScrobbleResponse`, `isScrobbleEligible`, `buildSignatureBase` — 23 assertion
  test masih hijau. Konsistensi lintas-file (nama prefs ↔ backup rules, channel ID) terkonfirmasi.

### Added — Open source & positioning
- **Lisensi GPL-3.0** (`LICENSE`) — Scrola resmi dijadikan proyek open source. Copyleft dipilih
  agar turunan tetap terbuka, sejalan dengan posisi melawan Pano Scrobbler yang juga GPL.
- Berkas kelengkapan open source: `SECURITY.md` (kebijakan pelaporan kerentanan),
  `CODE_OF_CONDUCT.md` (Contributor Covenant), template issue (bug & fitur) dan pull request di
  `.github/`.
- `.env.example` sebagai template kredensial yang aman di-commit; `.gitignore` diperkuat (keystore,
  `.aab`, `local.properties`, dll) untuk mencegah kebocoran rahasia di repo publik.
- `docs/DESIGN.md` — dokumen arah desain yang menetapkan **desain sebagai pembeda kompetitif
  utama** (celah "scrobbler yang indah" yang tidak diisi Pano/Simple Scrobbler), lengkap dengan
  token, prinsip, dan kriteria evaluasi keputusan desain.
- `docs/RELEASES.md` — catatan rilis berformat GitHub Releases (ramah-pengguna), berisi template
  untuk versi mendatang, rilis v0.1.0 lengkap, roadmap versi (v0.2.0/v0.3.0/v1.0.0), dan bagian
  "kelebihan aplikasi". Alur rilis di `CONTRIBUTING.md` diperbarui agar merujuk berkas ini.

### Security
- Audit rahasia sebelum go open source: dipastikan tidak ada API key/secret ter-hardcode di kode;
  kredensial asli hanya ada di `.env.local` yang di-gitignore dan belum pernah masuk history git.

### Internal — Audit gelombang 5 (deduplikasi & crash native)
- **Fixed:** hapus duplikasi definisi `isScrobbleEligible` (sempat ada di `lastfm.ts` DAN
  `scrobbleLogic.ts`) dan logic `buildSignature` — keduanya kini bersumber tunggal dari
  `scrobbleLogic.ts` yang sudah diunit-test, mencegah keduanya berubah tak sinkron diam-diam.
- **Fixed:** `useNowPlaying` sebelumnya menulis ulang aturan eligibility secara manual (duplikat
  ketiga) — kini memakai fungsi tunggal yang sama.
- **Fixed:** kalau `enqueueScrobble` gagal (mis. DB belum siap), flag "sudah discrobble" sudah
  terlanjur di-set sehingga track itu tak pernah dicoba lagi — kini flag di-reset saat gagal agar
  bisa dicoba ulang.
- **Fixed (crash Android 12+):** `ScrobbleForegroundService` pada jalur `ACTION_STOP` bisa memicu
  `ForegroundServiceDidNotStartInTimeException` kalau di-start via `startForegroundService()` tanpa
  pernah memanggil `startForeground()` — kini selalu masuk state foreground sekejap sebelum stop.
- **Fixed:** guard terhadap `Invalid Date` di `StoryTicket` kalau timestamp korup.
- **Fixed:** regex merge `strings.xml` di script overlay tidak menangani atribut tambahan
  (mis. `formatted="false"`) dan tidak meng-escape nama saat cek duplikat — keduanya diperbaiki.
- **Known issue (didokumentasikan, belum diperbaiki):** `foregroundServiceType="mediaPlayback"`
  pada `ScrobbleForegroundService` mungkin tidak sesuai fungsinya (service ini mendeteksi, bukan
  memutar) dan berisiko ditolak review Play Store di Android 14+. Perlu keputusan produk soal tipe
  yang tepat (`dataSync`/`specialUse`) sebelum submit.
- **Known limitation (didokumentasikan, bukan bug):** status "loved" di riwayat masih read-only —
  belum ada toggle. Penambahan toggle adalah fitur baru yang harus lewat alur pengembangan sendiri
  (lihat CONTRIBUTING.md), bukan diselipkan saat audit.

---

## [0.1.0] — belum dirilis (kandidat rilis pertama)

Versi fungsional pertama Scrola: scrobbler Last.fm untuk Android dengan player internal, deteksi
musik dari aplikasi lain, antrean offline, riwayat, dan editor metadata MP3. Belum pernah
di-build di CI maupun diuji di perangkat fisik — itu syarat untuk menandai versi ini benar-benar
"rilis".

### Added
- Autentikasi Last.fm lewat alur web (deep link `scrola://auth-callback`) dengan penyimpanan
  session key terenkripsi.
- Player musik internal berbasis ExoPlayer/Media3 yang dibungkus sebagai `MediaSessionService`,
  sehingga sesi medianya ikut terbaca pipeline scrobble yang sama dengan aplikasi lain.
- Deteksi now-playing dari aplikasi musik lain (Spotify, YouTube Music, dll) via
  `NotificationListenerService` + `MediaSessionManager`.
- Antrean scrobble offline-first berbasis SQLite dengan retry cap dan validasi respons per-track.
- Foreground service dengan notifikasi status untuk menjaga deteksi tetap hidup.
- Riwayat scrobble dengan komponen kartu "story ticket" dan status loved.
- Editor metadata MP3 (tag ID3: judul, artist, album, album artist, tahun, genre, sampul album)
  untuk file lokal, lewat library `mp3agic`.
- Album art: ekstraksi artwork ter-embed dari file yang diputar, ditampilkan sebagai disc vinyl
  berputar di layar Now Playing.
- Ikon adaptif (foreground/background/monochrome), splash screen, dan aset branding — dibuat
  terprogram lewat script Python agar bisa di-regenerate.
- Test otomatis (Vitest) untuk logic murni: aturan eligibility scrobble, parsing respons Last.fm,
  pembangunan signature.
- Error boundary React (mencegah layar putih total saat crash render).
- Crash logging native lokal (`CrashLogger.kt`) tanpa telemetri pihak ketiga.

### Changed
- Layar Now Playing difokuskan sepenuhnya ke player internal Scrola (disc album art berputar +
  kontrol playback); deteksi eksternal dipindah jadi info sederhana di tab Pengaturan.
- `minSdkVersion` dinaikkan ke 23 (Android 6.0) — disyaratkan oleh `KeyGenParameterSpec` untuk
  enkripsi session key. Dinaikkan otomatis oleh `npm run native:overlay`.

### Security
- Desain keamanan mengikuti pelajaran dari audit APK Last.fm resmi (temuan F-01 s.d. F-07):
  `network_security_config` tanpa cleartext & tanpa trust CA user; `allowBackup=false` +
  `dataExtractionRules`; session key disimpan terenkripsi AES-256-GCM via Android Keystore;
  Storage Access Framework alih-alih permission storage yang lebar; token dari deep link tidak
  pernah dipercaya langsung (hanya sinyal, token asli selalu yang diminta sendiri).

### Internal — Audit & pengerasan (4 gelombang, masing-masing 5 putaran review)
- **Gelombang 1** (fondasi): timestamp scrobble akurat (waktu track mulai, bukan waktu
  eligibility), guard double-scrobble, mutex `flushQueue` anti-race, retry cap, parsing respons
  per-track, recovery Keystore, penanganan NPE `getLaunchIntentForPackage`, keamanan token deep
  link.
- **Gelombang 2** (album art + edit MP3): perbaikan type mismatch ID3v1/v2, cegah data-loss tag
  ID3v2.3 yang dibuang saat simpan, deteksi mime type via magic bytes, downscale gambar aman-RAM
  (`inSampleSize`), penanganan OOM saat pilih gambar besar, pembersihan file temp.
- **Gelombang 3** (infrastruktur & interaksi): `db.open()` bersyarat, guard listener session
  dobel, `onListenerDisconnected`, keyframe `fadeIn` yang hilang, timeout `fetch` (mencegah mutex
  terkunci permanen), fallback CI `npm ci`→`npm install` tanpa lockfile, hapus dependensi tak
  terpakai (`react-router-dom`, `@capacitor/preferences`).
- **Gelombang 4** (menyeluruh lintas-lapisan): reset `initPromise` saat init DB gagal, guard
  sinkron anti double-save (cegah korupsi file MP3), atomicity `saveSession` + penanganan
  `AEADBadTagException`, dan pembalikan urutan operasi pipeline scrobble untuk mencegah **scrobble
  duplikat di profil Last.fm user** (hapus antrean dulu, baru tulis history).

---

## Cara membaca versi

- **MAJOR** (`1.0.0`): perubahan yang memutus kompatibilitas (mis. format database berubah tanpa
  migrasi, atau perubahan arsitektur yang memaksa user setup ulang).
- **MINOR** (`0.2.0`): fitur baru yang kompatibel ke belakang.
- **PATCH** (`0.1.1`): perbaikan bug tanpa fitur baru.

Selama masih `0.x.y`, API/arsitektur internal masih boleh berubah relatif bebas — kestabilan
penuh dijanjikan mulai `1.0.0`.
