# Kebijakan Keamanan

## Melaporkan kerentanan

Keamanan Scrola ditanggapi serius — apalagi karena aplikasi ini menangani session key Last.fm
milik pengguna dan bisa menulis ulang file MP3 mereka.

**Jangan** melaporkan kerentanan keamanan lewat GitHub Issues publik. Sebaliknya:

1. Buka tab **Security** repositori ini → **Report a vulnerability** (GitHub Private Vulnerability
   Reporting), atau
2. Hubungi pengembang secara privat (lihat kontak di profil GitHub).

Sertakan sebisanya: langkah reproduksi, dampak potensial, dan versi/perangkat yang terpengaruh.

## Yang dianggap masalah keamanan

- Kebocoran atau penyimpanan session key/token yang tidak terenkripsi.
- Cara apa pun agar aplikasi lain di perangkat yang sama bisa menyuntik/mencuri sesi Scrola.
- Kerusakan atau penulisan file MP3 pengguna di luar yang mereka minta.
- Bypass terhadap batasan izin (mis. mengakses file di luar yang dipilih lewat Storage Access
  Framework).

## Prinsip keamanan Scrola (untuk konteks peninjau)

- Session key disimpan terenkripsi AES-256-GCM via Android Keystore — tidak pernah plaintext.
- Tanpa telemetri pihak ketiga. Crash dicatat lokal saja (lihat `CrashLogger.kt`).
- Izin diminta sesempit mungkin (Storage Access Framework, bukan izin storage lebar).
- Token dari deep link tidak pernah dipercaya langsung — hanya sinyal, token asli selalu yang
  diminta aplikasi sendiri.

Detail lebih lanjut ada di `README.md` dan riwayat audit di `CHANGELOG.md`.
