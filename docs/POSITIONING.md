# Positioning Pasar — Scrola di Indonesia

> Dokumen ini **mengonsolidasikan** positioning yang selama ini tersebar (README, `docs/DESIGN.md`
> §analisis kompetitif, `docs/RELEASES.md` §"Kenapa Scrola?") menjadi satu pernyataan posisi pasar
> yang eksplisit, dengan fokus Indonesia. Ia TIDAK mengulang detail fitur — untuk itu lihat dokumen
> sumber. Tujuannya: menjadi rujukan tunggal saat menulis deskripsi Play Store, materi rilis, atau
> menjelaskan "untuk siapa & kenapa" Scrola kepada kontributor/pengguna.
>
> **Catatan kejujuran:** dokumen ini sengaja TIDAK memuat angka pasar (jumlah pengguna streaming,
> penetrasi Last.fm, dll). Angka yang tidak diverifikasi lebih berbahaya daripada tidak ada angka.
> Bagian [Data yang perlu divalidasi](#data-yang-perlu-divalidasi) mencatat data empiris apa yang
> sebaiknya dikumpulkan maintainer sebelum klaim pasar dipertajam atau dipublikasikan.

---

## Pernyataan posisi (satu paragraf)

Scrola adalah scrobbler Last.fm **berbahasa Indonesia lebih dulu**, ringan, dan tanpa telemetri,
yang mengubah riwayat dengar menjadi **koleksi tiket cerita** alih-alih tabel data. Ia untuk
pendengar musik di Indonesia yang ingin mencatat dan merayakan kebiasaan dengarnya — dari Spotify,
YouTube Music, atau file lokal — dengan aplikasi yang terasa personal dan menghargai privasi, bukan
dasbor analitik yang padat. Scrola tidak berusaha mengalahkan scrobbler paling kaya fitur; ia
menang di **rasa, identitas, dan kedekatan bahasa/budaya**.

---

## Untuk siapa

Segmen inti (bukan "semua pengguna Last.fm"):

- **Pendengar musik muda Indonesia** yang aktif di Spotify/YouTube Music dan mulai peduli pada
  "jejak dengar" mereka — sering tumpang tindih dengan budaya berbagi *Spotify Wrapped*, *now
  playing* di Instagram Story, dan estetika visual.
- **Orang yang menghargai desain & keintiman**, bukan kelengkapan fitur. Mereka memilih aplikasi
  karena terasa, bukan karena jumlah tombolnya.
- **Pengguna yang sadar privasi**: menyukai open-source, tanpa iklan, tanpa pelacakan, dan data yang
  tetap di perangkat.
- **Kolektor file lokal / pengarsip**: punya MP3 lokal, ingin tag rapi dan tetap ter-scrobble —
  segmen kecil tapi loyal.

Bukan untuk (jujur): pengguna yang butuh kelengkapan fitur maksimal, lintas platform, atau kontrol
scrobble tingkat lanjut — mereka lebih cocok dengan Pano Scrobbler (lihat bawah).

---

## Kenapa Indonesia (wedge)

Tiga celah yang bisa dimenangkan Scrola secara khusus di sini:

1. **Bahasa Indonesia lebih dulu, bukan terjemahan belakangan.** Mayoritas scrobbler mapan berbahasa
   Inggris. Scrola berbahasa Indonesia sejak antarmuka sampai istilah fiturnya ("Sisi B", "Bab",
   "Album", "tiket cerita") — bukan lokalisasi tempelan. Ini keakraban yang sulit ditiru cepat oleh
   pemain global.

2. **Identitas naratif/cetak yang mudah dibagikan.** Budaya berbagi *now playing* dan recap visual
   kuat di kalangan pendengar Indonesia. Zine Sisi B (recap mingguan) dan kartu tiket yang bisa
   diekspor sebagai gambar dirancang tepat untuk WhatsApp Status / Instagram Story — kanal berbagi
   dominan di sini. Setiap gambar yang dibagikan adalah promosi organik.

3. **Ringan & hemat, hormat pada perangkat & data.** Nol dependensi berat, tanpa telemetri, tanpa
   iklan. Relevan untuk basis perangkat yang beragam dan kesadaran kuota — bukan sekadar nilai etis,
   tapi keunggulan praktis.

Diferensiator produk yang sudah ada (player internal, edit tag MP3, deteksi now-playing lintas app —
lihat `docs/RELEASES.md`) **memetakan langsung** ke segmen di atas: mereka memperkuat rasa "aplikasi
ini memahami cara saya mendengar", bukan sekadar checklist fitur.

---

## Vs Pano Scrobbler (jujur, konsolidasi dari DESIGN.md)

Pano Scrobbler adalah pemain matang, kaya fitur, lintas platform, dengan pengalaman bertahun-tahun.
Scrola **tidak** akan memenangkan perlombaan jumlah fitur, dan tidak mencoba.

| Dimensi | Pano Scrobbler | Scrola |
| --- | --- | --- |
| Kematangan & cakupan fitur | Sangat tinggi | Fokus, lebih sempit |
| Mesin deteksi now-playing | `NotificationListenerService` + `MediaSessionManager` | Sama (tumpang tindih teknis nyata) |
| Player musik internal | Tidak | **Ya** |
| Edit tag MP3 dalam app | Tidak | **Ya** |
| Identitas visual | Dasbor data, netral | **Tiket cerita / cetak, emosional** |
| Bahasa | Inggris (utama) | **Indonesia lebih dulu** |
| Privasi | Baik | Tanpa telemetri, sesi terenkripsi di perangkat |

**Overlap teknis yang harus diakui:** keduanya memakai mekanisme listener yang sama, sehingga di
banyak perangkat pengguna harus MEMILIH salah satu (dua listener bisa saling ganggu). Ini bukan
sekadar kompetisi fitur — ini kompetisi "dipilih untuk dipasang". Pembeda konkret Scrola dalam
situasi ini: **player internal + edit tag** (Pano tak punya) dan **identitas naratif** — dua alasan
untuk memilih Scrola meski mesin scrobble-nya serupa.

Implikasi strategi: jangan berkompetisi di kepadatan fitur/dasbor (wilayah Pano). Menang di sisi
emosional, bahasa, dan berbagi-visual.

---

## Bagaimana ini masuk ke materi publik

- **Deskripsi Play Store / README hero:** pimpin dengan "scrobbler Last.fm berbahasa Indonesia yang
  mengubah riwayat dengar jadi koleksi tiket cerita", lalu privasi & ringan, baru fitur.
- **Materi berbagi:** dorong ekspor zine Sisi B & kartu tiket sebagai mesin pertumbuhan organik
  (tiap gambar membawa nama + tagline Scrola).
- **Nada:** hangat, jujur, tidak membesar-besarkan. Akui keterbatasan (lihat `RELEASES.md` yang sudah
  jujur soal cakupan) — ini membangun kepercayaan pada segmen yang skeptis terhadap hype.

---

## Data yang perlu divalidasi

Sebelum klaim pasar dipertajam/dipublikasikan, kumpulkan (jangan mengarang):

- Ukuran & tren pengguna Last.fm dan streaming musik di Indonesia (sumber tepercaya, bertanggal).
- Perilaku berbagi *now playing* / recap di kalangan target (kanal: IG Story, WA Status, X).
- Berapa banyak target sudah memakai scrobbler, dan hambatan utama mereka (survei kecil / komunitas).
- Sensitivitas kuota/perangkat pada segmen — untuk memperkuat atau menurunkan bobot argumen "ringan".
- Umpan balik langsung: apakah "player internal + edit tag" benar-benar jadi alasan pindah dari Pano.

Isi bagian ini dengan data bersumber sebelum memakainya sebagai dasar keputusan besar.
