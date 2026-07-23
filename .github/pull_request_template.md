<!--
Terima kasih sudah berkontribusi ke Scrola! Sebelum mengirim, baca CONTRIBUTING.md.
Untuk perubahan besar, checklist di bawah wajib dilengkapi.
-->

## Ringkasan

Jelaskan singkat apa yang diubah dan **kenapa**. Sebutkan juga apa yang sengaja TIDAK termasuk.

## Jenis perubahan

- [ ] Perbaikan bug (fix)
- [ ] Fitur baru (feat)
- [ ] Perbaikan keamanan (security)
- [ ] Refactor / performa / tooling
- [ ] Dokumentasi

## Checklist (wajib untuk perubahan besar — lihat CONTRIBUTING.md)

- [ ] Scope ditulis jelas, termasuk yang sengaja tidak termasuk
- [ ] Logic baru yang rawan bug dipisah jadi fungsi murni + ada test-nya
- [ ] Review 5 putaran selesai (korektnes / concurrency / error / native / keamanan)
- [ ] Sanity check lolos (keseimbangan kurung, JSON/YAML, `npm test`)
- [ ] Tidak ada dependensi baru tanpa alasan (prinsip "ringan")
- [ ] Migrasi DB (bila ada) berupa entri baru, tidak mengubah migrasi lama
- [ ] `CHANGELOG.md` diperbarui di bagian `[Unreleased]`
- [ ] Tidak ada rahasia (API key/secret) yang ikut ter-commit

## Status validasi (jujur)

- [ ] `npm test` hijau
- [ ] Build CI hijau
- [ ] Sudah diuji di perangkat fisik (sebutkan model & versi Android)

> Kalau ada yang belum tercentang di bagian ini, sebutkan secara eksplisit — kejujuran soal
> status validasi adalah bagian dari budaya proyek ini.
