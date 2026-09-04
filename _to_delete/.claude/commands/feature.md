# /feature

Alur menambah fitur baru ke Scrola mengikuti 5 fase di `CONTRIBUTING.md`. Gunakan saat diminta
membangun fitur baru. Tiap fase punya agen spesialisnya — delegasikan bila tersedia.

## Fase

1. **Scope** (agen: `feature-architect`) — tulis apa yang berubah, kenapa, dan apa yang SENGAJA
   tidak termasuk. Batasi cakupan.
2. **Arsitektur** (agen: `feature-architect`) — tentukan lapisan (UI / hook / lib / native). Cek:
   - Bisakah logic yang rawan bug jadi fungsi murni di `scrobbleLogic.ts` agar bisa ditest?
   - Butuh dependensi baru? (benarkan sesuai rule ringan, atau tolak)
   - Butuh migrasi DB? (entri baru, jangan ubah migrasi lama)
   - Selaras dengan `docs/DESIGN.md` dan rule ringan-dan-fokus?
3. **Implementasi bertahap** (agen: `native-android-specialist` untuk .kt/manifest,
   `ui-craftsman` untuk screens/components) — bangun dari lapisan terdalam ke terluar
   (native → wrapper JS → hook → UI). Sertakan komentar yang menjelaskan **kenapa**, bukan cuma apa.
4. **Review 5 putaran** (agen: `code-reviewer` + `security-reviewer`) — jalankan `/audit` pada
   kode baru.
5. **Validasi** (agen: `test-engineer`) — jujur soal status: `npm test`, build CI, uji device.
   Tandai yang belum.

## Selesai (agen: `scribe`)

- Perbarui `CHANGELOG.md` bagian `[Unreleased]` + sinkronkan dokumentasi lain yang tersentuh.
- Kalau fitur menyentuh UI, pertimbangkan memperbarui screenshot/mockup.
- Kalau ini kandidat untuk versi berikutnya, catat di roadmap `docs/RELEASES.md`.

## Penolakan yang sehat

Kalau fitur yang diminta menyeret Scrola ke ranah music player serba bisa (equalizer, playlist
rumit, Hi-Res), sampaikan dengan jujur bahwa itu di luar fokus (lihat rule ringan-dan-fokus) dan
tawarkan alternatif yang selaras.
