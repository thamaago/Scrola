# Rule: Ringan & Fokus

Scrola adalah **scrobbler yang ringan, aman, dan indah** — bukan music player serba bisa.

- **Setiap dependensi baru harus dibenarkan.** WebView (Capacitor) sudah punya overhead baseline;
  jangan memperparah. Sebelum menambah paket, tanya: benar-benar perlu, atau bisa ditulis ringkas
  sendiri? Hapus dependensi yang tidak dipakai.
- **Batasi memori.** Buffer ExoPlayer kecil (file lokal, bukan streaming). Downscale gambar
  sebelum decode penuh (`inSampleSize`). Batasi query DB (`LIMIT`). Tanpa aset bitmap raksasa.
- **Jangan seret Scrola ke pertarungan music player.** Equalizer, gapless, playlist rumit, format
  Hi-Res = wilayah Poweramp. Menambahkannya mengencerkan fokus dan melanggar prinsip ringan.
  Usulan semacam ini default-nya ditolak kecuali ada alasan produk yang sangat kuat.
- **Player internal cukup sederhana** — pemutar untuk file yang ingin dipastikan ter-scrobble,
  bukan pengganti music player besar.
- **Animasi CSS murni**, bukan library animasi berat. Hormati `prefers-reduced-motion`.

Rujukan arah produk & desain: `docs/DESIGN.md`. Rujukan analisis kompetitif: lihat CHANGELOG &
diskusi posisi vs Pano Scrobbler.
