# Dokumentasi Scrola

Indeks seluruh dokumen di folder `docs/`. Dokumen pokok proyek (README, CONTRIBUTING, CHANGELOG,
LICENSE, SECURITY, CODE_OF_CONDUCT) ada di root repositori.

## Panduan pengguna & builder

| Dokumen | Isi |
|---|---|
| [`PANDUAN_BUAT_APK.md`](./PANDUAN_BUAT_APK.md) | Dari nol sampai APK terpasang di HP, tanpa perlu menginstal apa pun di komputer (GitHub yang membangunnya). Mulai dari sini kalau cuma ingin memakai app. |
| [`PANDUAN_API_KEY.md`](./PANDUAN_API_KEY.md) | Langkah-demi-langkah memasang API key Last.fm, ditulis untuk orang awam. Wajib kalau membangun Scrola dari kode sumber. |
| [`GITHUB_SETUP.md`](./GITHUB_SETUP.md) | Checklist langkah manual di GitHub UI (secrets, branch protection, rilis pertama) yang tidak bisa diotomasi dari scaffold. |
| [`VALIDASI_DEVICE.md`](./VALIDASI_DEVICE.md) | Checklist uji fungsional di perangkat fisik setelah APK terpasang. |

## Produk & rilis

| Dokumen | Isi |
|---|---|
| [`RELEASES.md`](./RELEASES.md) | Catatan rilis ramah-pengguna (siap tempel ke GitHub Releases) + roadmap versi + kelebihan aplikasi. |
| [`POSITIONING.md`](./POSITIONING.md) | Positioning pasar Indonesia: untuk siapa & kenapa, wedge lokal, perbandingan jujur vs Pano Scrobbler. Rujukan saat menulis deskripsi Play Store / materi rilis. |

## Desain

| Dokumen | Isi |
|---|---|
| [`DESIGN.md`](./DESIGN.md) | Arah desain sebagai pembeda kompetitif — identitas visual "tiket cerita", palet Hutan Malam. |
| [`DEVLOG.md`](./DEVLOG.md) | Log pengembangan desain (redesign UI, keputusan palet & motion) — entri terbaru di atas. |

## Referensi teknis

| Dokumen | Isi |
|---|---|
| [`REFERENSI_SCROBBLE_PANO.md`](./REFERENSI_SCROBBLE_PANO.md) | Pembelajaran mekanisme submit scrobble dari Pano Scrobbler (GPL-3.0): pemetaan sudah/adopsi/tak-berlaku + rekomendasi berprioritas (backoff, cabang error, jeda antar batch). |
| [`REFERENSI_TAG_EDITOR.md`](./REFERENSI_TAG_EDITOR.md) | Pembelajaran editor tag MP3 dari app sejenis (mp3agic/jaudiotagger/TagLib): fokus korektnes (encoding Unicode, album art, tulis aman). |
