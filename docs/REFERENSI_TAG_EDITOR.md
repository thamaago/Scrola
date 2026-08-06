# Pembelajaran: Editor Tag MP3 — Referensi App Sejenis

> **Sumber yang dipelajari:**
> - [`spkdroid/Mp3-Tag-Editor`](https://github.com/spkdroid/Mp3-Tag-Editor) — editor ID3 Android
>   yang memakai **mp3agic** (library yang SAMA dengan Scrola) → memvalidasi pendekatan kita.
> - [`BobbyESP/Metadator`](https://github.com/BobbyESP/Metadator) — editor metadata + player modern
>   (Jetpack Compose, Material You) yang memakai **TagLib** (multi-format). **Lisensi AGPL-3.0** —
>   boleh dipelajari polanya, TAPI **jangan salin kodenya** ke Scrola (GPL-3.0): AGPL lebih ketat.
> - Library JVM: **jaudiotagger** sebagai alternatif multi-format dari mp3agic.
>
> Yang diambil: **pola & keputusan desain**, dijelaskan dengan kata sendiri — bukan salinan kode.

## Apa yang editor tag Scrola sudah lakukan (baseline)

Plugin `Mp3MetadataPlugin.kt` (Kotlin) + layar "Tulis Ulang Cerita":
- Library **mp3agic** (`com.mpatric.mp3agic`) — MP3/ID3 saja, murni-JVM (tanpa NDK), ringan.
- Field: **judul, artist, album, album artist (TPE2, hanya v2.3/v2.4), tahun, genre, album art**.
  Baca v2 → fallback v1.
- Alur SAF yang benar: `content://` → salin ke file sementara → baca/tulis mp3agic → salin balik
  (mode `rwt`). Membersihkan file sementara sisa saat plugin dimuat.
- **Mempertahankan tag yang sudah ada** (pakai `existingTag` bila ada, buat `ID3v24Tag` baru bila
  tidak) — jadi field yang tidak diedit tetap tersimpan. ✅ bagus.
- **Album art di-downscale** (`ImageUtils.downscaleIfNeeded`) sebelum ditulis. ✅ bagus.

Ini editor yang **fokus** — pelengkap scrobbler ("perbaiki metadata supaya scrobble & tampilan
benar"), bukan tag-editor pustaka penuh. Fokus itu **kekuatan**, sejalan prinsip "ringan".

## Landscape library (pelajaran strategis)

| Library | Format | Sifat | Dipakai |
| --- | --- | --- | --- |
| **mp3agic** | MP3/ID3 saja | murni-JVM, kecil, sederhana | **Scrola**, spkdroid |
| **jaudiotagger** | MP3, FLAC, OGG, M4A/MP4, WAV… | murni-JVM, lebih lengkap | banyak app Android |
| **TagLib** (fork Android) | paling banyak format | C++/NDK, build lebih berat | Metadator |

**Pelajaran:** pilihan mp3agic **tepat** selama lingkupnya "perbaiki tag MP3". Kalau nanti Scrola mau
menandai file **FLAC/M4A** (umum di pustaka lokal audiophile), mp3agic tak bisa → jalurnya
**jaudiotagger** (murni-JVM, migrasi paling mulus) atau TagLib (paling lengkap, paling berat). Ini
**keputusan produk**, bukan sekadar teknis: multi-format menambah nilai TAPI menambah bobot — timbang
terhadap etos "ringan".

## Peta: sudah / layak diadopsi / tak berlaku

| Pola / pelajaran | Status di Scrola |
| --- | --- |
| SAF temp-file → tulis → salin balik | ✅ **Sudah** — pola benar. |
| Pertahankan tag/frame yang tak diedit | ✅ **Sudah** — reuse `existingTag`. |
| Downscale album art | ✅ **Sudah** — `downscaleIfNeeded`. |
| Baca v2 fallback v1 | ✅ **Sudah**. |
| **Encoding teks Unicode (non-Latin)** | 🔴 **Layak adopsi (PRIORITAS)** — plugin tak set encoding; ikut default mp3agic. Untuk app **berbahasa Indonesia**, teks berkarakter khusus (atau CJK) berisiko **rusak/mojibake** kalau ditulis sebagai ISO-8859-1. Wajib pastikan frame teks ditulis UTF-16 (v2.3) / UTF-8 (v2.4). |
| Picture-type album art = "front cover" (3) | 🔧 **Cek** — pastikan APIC ditulis dengan tipe front-cover + MIME benar, agar semua pemutar menampilkannya. |
| Tulis atomik/aman | 🔧 **Halus** — `save(tempOut)` sudah aman, tapi salin-balik `rwt` ke `content://` punya jendela non-atomik (crash saat menyalin bisa merusak file tujuan). Simpan `tempOut` sampai salin terverifikasi sebelum dihapus. |
| Nomor track / disc (TRCK/TPOS) | 🔧 **Opsional** — umum di tag-editor pustaka; untuk lingkup Scrola nilainya kecil. |
| Batch edit banyak file | ❌ **Sengaja tidak** — lingkup Scrola satu-lagu ("perbaiki lagu ini"). Menambah ini = merayap ke wilayah Metadator. |
| Fetch metadata dari internet | 🟡 **Menarik tapi hati-hati** — Scrola sudah punya Last.fm; secara teknis bisa mengambil artist/album/art kanonik. Tapi ini fitur besar & berpotensi menggeser fokus; putuskan sebagai produk, bukan reflek. |
| Editor lirik (USLT / synced) | ❌ **Di luar lingkup** — wilayah player pustaka, bukan scrobbler. |
| TagLib multi-format | ❌ **Tak langsung** — hanya relevan bila memutuskan mendukung non-MP3 (lihat "Landscape"). |

## Rekomendasi berprioritas

Semua menyentuh plugin native → **wajib uji device** (tak bisa dijalankan di lingkungan dev ini),
dan sejalan dengan status kematangan app: **validasi dulu, jangan menumpuk**.

1. **Encoding Unicode (prioritas tertinggi, ini bug korektnes, bukan fitur).** Pastikan mp3agic
   menulis field teks dengan encoding Unicode untuk input non-ASCII. Uji device dengan: nama
   berkarakter khusus Indonesia, judul dengan emoji, dan teks CJK — lalu baca balik & cek di pemutar
   lain. Kalau rusak, set encoding frame teks secara eksplisit (UTF-16 untuk v2.3, UTF-8 untuk v2.4)
   atau paksa tulis `ID3v24Tag`. **Ini paling penting untuk app berbahasa Indonesia.**
2. **Picture-type + MIME album art.** Pastikan APIC ditulis sebagai front-cover (tipe 3) dengan MIME
   sesuai (`image/jpeg`/`image/png`), agar art tampil konsisten di semua pemutar.
3. **Salin-balik lebih aman.** Jangan hapus `tempOut` sampai salinan ke `content://` terverifikasi
   (mis. cek ukuran), agar crash saat menyalin tidak meninggalkan file rusak tanpa cadangan.
4. **(Opsional) Nomor track/disc** kalau memang diminta pengguna — kecil & aman.

**Sikap yang dijaga:** JANGAN tergoda meniru kelengkapan Metadator (batch, lirik, multi-format,
fetch-internet). Editor tag Scrola sengaja ramping sebagai pelengkap scrobbler; membiarkannya fokus
adalah pembeda, bukan kekurangan. Prioritaskan **korektnes** (encoding, art, tulis aman) di atas
penambahan fitur — apalagi mengingat app secara keseluruhan masih menunggu validasi device.
