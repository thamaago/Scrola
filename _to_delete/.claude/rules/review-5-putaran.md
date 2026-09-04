# Rule: Review 5 Putaran

Untuk setiap **perubahan besar** (fitur baru, perbaikan signifikan, refactor lintas-lapisan),
wajib melakukan review lima kali sebelum menganggap selesai. Ini ritual inti Scrola — terbukti
berulang kali menemukan bug nyata sebelum sampai ke perangkat.

Tiap putaran fokus ke aspek berbeda (sesuaikan dengan perubahan):

1. **Korektnes logic** — fungsi murni & aturan bisnis benar di semua edge case? Ada duplikasi
   aturan yang berisiko divergen?
2. **Concurrency & state** — race condition, mutex, promise tanpa `await`, guard sinkron untuk
   aksi yang tak boleh dobel (mis. double-save file).
3. **Penanganan error** — kegagalan (jaringan, plugin native, DB) ditangani tanpa mengunci/crash?
   Ada promise tanpa `.catch()`? Kegagalan diam-diam yang menghilangkan data?
4. **Native Android** — NPE, lifecycle service/listener, `OutOfMemoryError`, kompatibilitas API
   level, aturan foreground service (mis. wajib `startForeground` setelah `startForegroundService`).
5. **Keamanan** — permission, data sensitif, atomicity penyimpanan, validasi input, perilaku saat
   data korup/diutak-atik.

Setelah tiap putaran: jalankan sanity check (lihat `/sanity-check` command). Catat singkat bug yang
ditemukan tiap putaran — jadi bahan entri CHANGELOG dan bukti review bekerja.

**Jangan menyelipkan fitur baru saat audit.** Kalau menemukan fitur yang setengah jadi atau ide
baru saat review, catat sebagai known limitation — jangan implementasikan di tengah audit. Fitur
baru lewat alurnya sendiri.
