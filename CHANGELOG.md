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
  melanggar prinsip inti "satu pipeline" yang tercatat di CLAUDE.md.
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
- Jebakan ini ditambahkan ke `.claude/agents/native-android-specialist.md` agar tidak terulang.

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
  CLAUDE.md, dan CONTRIBUTING.md diperbarui. Script kini diuji end-to-end terhadap struktur
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

### Added — Perluasan agen Claude Code
- **5 agen baru** di `.claude/agents/`, dipetakan ke tahapan kerja `CONTRIBUTING.md` dan proses
  sistem app: `feature-architect` (Fase 1-2 — rancang scope/arsitektur sebelum kode, penolak
  scope creep), `native-android-specialist` (Fase 3 lapisan native — memuat peta pipeline
  MediaSession & seluruh jebakan yang pernah ditemukan audit agar tidak terulang),
  `ui-craftsman` (Fase 3 lapisan UI — penjaga sistem desain Hutan Malam & aksesibilitas),
  `test-engineer` (Fase 5 — unit test logic murni + pola simulasi Node saat vitest belum
  terinstall), dan `scribe` (pencatat perubahan yang dilakukan agen lain ke CHANGELOG +
  penjaga sinkronisasi seluruh dokumentasi GitHub; append-only terhadap riwayat, dilarang
  menyentuh kode aplikasi).
- `CLAUDE.md` diperbarui: daftar agen kini memuat pemetaan fase + alur lengkap satu fitur
  (architect → implementer → reviewer → test → scribe).

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
- **Konfigurasi Claude Code** (`CLAUDE.md` + `.claude/`) mengikuti metode
  [everything-claude-code](https://github.com/WorldFlowAI/everything-claude-code): rules yang selalu
  ditegakkan (keamanan, review 5 putaran, prinsip ringan, kejujuran status), slash commands
  (`/audit`, `/sanity-check`, `/feature`, `/release`), dan agents (`code-reviewer`,
  `security-reviewer`). Ini mengubah proses yang selama pengembangan dijalankan manual menjadi
  konfigurasi yang otomatis dirujuk Claude Code di sesi berikutnya.
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
