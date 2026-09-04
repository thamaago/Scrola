# /audit

Jalankan review 5 putaran menyeluruh pada kode Scrola sesuai `.claude/rules/review-5-putaran.md`.

## Langkah

1. Tentukan cakupan: file/lapisan mana yang direview (kalau tidak disebut, prioritaskan kode yang
   paling jarang tersentuh audit sebelumnya + kode yang baru diubah).
2. Lakukan 5 putaran, tiap putaran fokus ke aspek berbeda:
   - Putaran 1: korektnes logic & duplikasi aturan
   - Putaran 2: concurrency & state
   - Putaran 3: penanganan error & promise
   - Putaran 4: native Android (NPE, lifecycle, OOM, foreground service, API level)
   - Putaran 5: keamanan (permission, data sensitif, atomicity, validasi input)
3. Tiap putaran: temukan bug/celah, perbaiki langsung, lalu jalankan `/sanity-check`.
4. Catat singkat temuan tiap putaran.
5. Perbarui `CHANGELOG.md` bagian `[Unreleased]` dengan ringkasan temuan.
6. Ingatkan status jujur: apa yang belum tervalidasi di device/CI.

## Prinsip

- Jangan menyelipkan fitur baru saat audit — catat sebagai known limitation.
- Bug yang hanya muncul di device (mis. crash foreground service) tetap dicatat walau tak bisa
  direproduksi di sini — itu justru menegaskan pentingnya validasi CI/device.
