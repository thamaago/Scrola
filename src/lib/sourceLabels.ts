/**
 * sourceLabels.ts
 *
 * Pemetaan package name Android → nama aplikasi yang enak dibaca manusia.
 *
 * Dipisah jadi modul sendiri karena dipakai di DUA layar (Pengaturan & Sekarang). Kalau
 * daftarnya diduplikasi, cepat atau lambat keduanya akan berbeda — mis. satu layar menampilkan
 * "YouTube Music" sementara layar lain menampilkan package mentah untuk app yang sama.
 * Satu sumber kebenaran, sesuai .claude/rules/review-5-putaran.md soal duplikasi aturan.
 */

const SOURCE_LABELS: Record<string, string> = {
  'com.spotify.music': 'Spotify',
  'com.google.android.apps.youtube.music': 'YouTube Music',
  'com.google.android.youtube': 'YouTube',
  'deezer.android.app': 'Deezer',
  'com.soundcloud.android': 'SoundCloud',
  'com.apple.android.music': 'Apple Music',
  'com.aspiro.tidal': 'TIDAL',
  'org.videolan.vlc': 'VLC',
  'com.maxmpz.audioplayer': 'Poweramp',
  'com.jetappfactory.jetaudioplus': 'jetAudio',
  'com.scrola.app': 'Scrola',
};

/**
 * Nama app yang enak dibaca. Kalau package tidak dikenal, kembalikan package-nya apa adanya —
 * SENGAJA tidak disamarkan jadi "Aplikasi lain", karena melihat package asli justru membantu
 * pengguna (dan kita) mengenali app apa yang terdeteksi, dan memudahkan menambahkannya ke
 * daftar di atas lewat laporan issue.
 */
export function sourceLabel(packageName: string): string {
  return SOURCE_LABELS[packageName] ?? packageName;
}
