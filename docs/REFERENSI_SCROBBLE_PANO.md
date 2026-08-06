# Pembelajaran: Mekanisme Submit Scrobble — Referensi Pano Scrobbler

> **Sumber:** [`kawaiiDango/pano-scrobbler`](https://github.com/kawaiiDango/pano-scrobbler)
> (GPL-3.0, sama dengan Scrola). File yang dipelajari: `work/PendingScrobblesWorker.kt`,
> `work/PendingScrobblesWork.android.kt`, `db/PendingScrobblesDao.kt`.
>
> **Etika:** yang diambil di sini adalah **pola & keputusan desain**, dijelaskan dengan kata-kata
> sendiri — BUKAN salinan kode. Lisensi kompatibel seandainya nanti mengadaptasi kode, tapi dokumen
> ini murni pembelajaran arsitektur. Nilai konstanta yang disebut (700, 50, 1000 ms, dst) adalah fakta
> konfigurasi, bukan ekspresi berhak-cipta.

Pano adalah scrobbler Android paling matang & jadi acuan kompetitif Scrola. Menariknya, mempelajari
kodenya **memvalidasi beberapa keputusan Scrola yang sudah ada**, sekaligus menunjukkan beberapa
penghalusan yang layak diadopsi.

---

## Bagaimana Pano menyubmit pending scrobble (ringkasan dari sumber)

1. **Dijalankan sebagai WorkManager Worker**, bukan timer ad-hoc. `doWork()` mengembalikan `Retry`
   saat ada kegagalan → OS menjadwal ulang **dengan exponential backoff** (`setBackoffCriteria`).
2. **Unique work bernama `"pending_scrobbles"`** (`enqueueUniqueWork` + `ExistingWorkPolicy`) →
   OS menjamin **hanya satu** proses submit berjalan pada satu waktu; permintaan baru di-KEEP/REPLACE,
   tidak menumpuk paralel.
3. **Drain terbatas & terurut**: ambil paling banyak `HARD_LIMIT = 700` baris, `ORDER BY timestamp
   ASC` (terlama dulu). Tidak pernah menarik seluruh antrean tak terbatas ke memori sekaligus.
4. **Batch 50** (`BATCH_SIZE = 50`, sesuai batas Last.fm) via `chunked(50)`.
5. **Jeda antar batch** `DELAY = 1000L` (1 detik) — sopan ke server, menekan risiko rate-limit.
6. **Bail-out cepat saat gagal**: `MAX_FAILURES_PER_SERVICE = 1` — setelah **satu** kegagalan untuk
   sebuah layanan, berhenti menguras dan biarkan WorkManager mencoba lagi nanti (dengan backoff).
7. **Hapus-saat-sukses, simpan-saat-gagal**: baris hanya dihapus untuk layanan yang berhasil (atau
   ditolak permanen); yang gagal transien tetap di DB. Kegagalan dicatat (`logFailure`:
   `lastFailedTimestamp`, `lastFailedReason`, `canForceRetry`).
8. **Gating retry-after**: baris yang gagal tidak langsung dicoba lagi — ada jendela tunggu
   (`lastFailedTimestamp <= retryAfterTimestamp`) sebelum layak diretry.
9. **Permanen vs transien**: kode Last.fm 6/7 (parameter/resource invalid) diperlakukan seperti sukses
   untuk penghapusan (drop, jangan retry); kode 29 (rate limit) & 9 (sesi invalid) diperlakukan
   sebagai transien/perlu-berhenti (terlihat dari komentar kode mereka).

---

## Peta ke Scrola: sudah / layak diadopsi / tak berlaku

| Pola Pano | Status di Scrola |
| --- | --- |
| Batch 50 per panggilan | ✅ **Sudah** — `getQueueBatch(50)` / `MAX_SCROBBLE_BATCH`. |
| Serialisasi submit (unique work) | ✅ **Sudah (setara)** — guard `syncingRef` di `App.tsx` (baru). Pano pakai OS WorkManager; Scrola pakai guard in-app + mutex `isFlushing`. Validasi bahwa arah kita benar. |
| Timeout jaringan agar tak nge-lock | ✅ **Sudah** — `timeoutMs=15000` di `callLastfm` (mencegah "lock permanen"). Justru Scrola lebih tahan di sini (lihat bug Pano di bawah). |
| Permanen vs transien (ignoredMessage) | ✅ **Sudah (baru)** — kode 5 transien vs 1-4 permanen di `parseScrobbleResponse`. |
| Terlama-dulu (`ORDER BY timestamp ASC`) | ✅ **Sudah** — `getQueueBatch` memang `ORDER BY timestamp ASC` (dicek). |
| **HARD_LIMIT per run** | 🔧 **Layak adopsi** — `flushQueueOnce` saat ini loop sampai antrean habis; backlog ribuan bisa jadi satu flush raksasa. Batasi mis. ≤ ~500/flush, sisanya siklus berikut. |
| **Jeda antar batch (1 dtk)** | 🔧 **Layak adopsi** — Scrola kirim batch beruntun tanpa jeda. Jeda kecil menekan rate-limit (kode 5) **secara proaktif** — pelengkap penanganan reaktif yang baru kita buat. |
| **Backoff saat gagal** | 🔧 **Layak adopsi (prioritas)** — timer Scrola retry tiap 20 dtk **tetap**, tanpa backoff. Saat Last.fm rate-limit/down, Scrola menghantam tiap 20 dtk; dikombinasi `MAX_ATTEMPTS=8`, scrobble sah bisa terbuang dalam ~menit padahal limit reset harian. |
| **Gating retry-after per baris** | 🔧 **Layak adopsi** — baris gagal langsung diikutkan flush berikutnya; tambahkan jendela tunggu agar tidak menghantam. |
| **Cabang error top-level (9 vs 29)** | 🔧 **Layak adopsi** — `callLastfm` sudah menangkap `LastfmApiError.code`, tapi flush belum bercabang: kode 9 (sesi invalid) percuma diretry → seharusnya berhenti & minta login ulang; kode 29 (rate limit) → backoff. |
| Multi-layanan (ListenBrainz/Libre.fm/Pleroma) | ❌ **Tak berlaku** — Scrola fokus Last.fm. `services` bitmask Pano tak relevan; menjaga Scrola tetap sederhana adalah keunggulan, bukan kekurangan. |
| WorkManager | ❌ **Tak langsung** — submit Scrola jalan di WebView (JS), bukan Worker Kotlin. Prinsipnya (serialisasi + backoff + retry-after) tetap bisa ditiru di lapisan TS. |

---

## Pelajaran dari bug-report Pano (kehati-hatian)

Bug nyata yang tercatat di issue tracker Pano — berharga sebagai "apa yang harus dijaga":

- **Pending stuck / tak pernah terkirim** (#8, #562): submit "macet", force-close + buka ulang
  memperbaikinya — gejala klasik **lock/worker tersangkut**. Ini persis risiko "lock permanen" yang
  kita bahas untuk `isFlushing`/`syncingRef`. **Pertahanan Scrola:** `try/finally` yang selalu melepas
  guard + timeout jaringan 15 dtk. Jaga jangan sampai ada `await` di dalam guard yang bisa menggantung
  tanpa timeout — itulah yang bisa membuat Scrola menderita bug yang sama.
- **Scrobble berulang saat pause→resume lewat tengah lagu** (#570): deteksi ulang saat pause/resume itu
  sulit; Scrola menghadapi kelas masalah yang sama (kerja "repeat detection" kita ada di jalur yang
  benar, tapi butuh uji device untuk kasus pause-resume).

---

## Rekomendasi berprioritas untuk Scrola

Semua di bawah menyentuh jalur submit yang **baru tervalidasi device**, jadi kerjakan satu per satu
dengan `/tdd` + uji device — jangan borongan.

1. **Backoff + retry-after saat gagal (prioritas tertinggi).** ✅ **SUDAH DIIMPLEMENTASI** —
   `backoffPolicy.ts` (murni, TDD) + gate di `flushQueue`: sukses → reset; gagal/rate-limit → jeda
   naik eksponensial (20s→40s→…→maks 30 mnt), timer 20 dtk melewati tick dalam jendela backoff. Ini
   mencegah scrobble sah terbuang oleh `MAX_ATTEMPTS` saat rate-limit sementara. State in-memory
   (reset saat app restart). Belum tervalidasi device.
2. **Cabang error top-level Last.fm.** Di `flushQueueOnce`, tangani `LastfmApiError.code`: 9 (sesi
   invalid) → berhenti + tandai perlu login ulang (jangan retry); 29 (rate limit) → backoff (poin 1);
   selain itu → transien, retry. Pemetaan kode → aksi = fungsi murni yang bisa di-TDD.
3. **Jeda antar batch + HARD_LIMIT per flush.** Tambah jeda ~500–1000 ms antar batch dan batasi jumlah
   baris per satu `flushQueueOnce` (sisanya siklus berikut). Menekan rate-limit proaktif + mencegah
   flush raksasa memblokir. Lokasi: `flushQueueOnce` di `scrobbleEngine.ts`.

Sudah setara Pano & tak perlu diubah: batch 50, serialisasi submit (`syncingRef`+`isFlushing`),
timeout jaringan, permanen-vs-transien (kode 5), dan urutan terlama-dulu (`getQueueBatch` ASC).

Nilai konkret (700/50/1000 ms/1) dari Pano bisa jadi titik awal, tapi sesuaikan dengan skala Scrola
dan buktikan lewat log device — sesuai prinsip "device is the final truth".
