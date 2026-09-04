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
  'com.amazon.mp3': 'Amazon Music',
  'com.tencent.ibg.joox': 'JOOX',
  'com.moonvideo.android.resso': 'Resso',
  'org.videolan.vlc': 'VLC',
  'com.maxmpz.audioplayer': 'Poweramp',
  'in.krosbits.musicolet': 'Musicolet',
  'com.sec.android.app.music': 'Samsung Music',
  'com.aimp.player': 'AIMP',
  'code.name.monkey.retromusic': 'Retro Music',
  'com.kabouzeid.gramophone': 'Phonograph',
  'com.rhmsoft.pulsar': 'Pulsar',
  'com.musicplayer.blackplayerfree': 'BlackPlayer',
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

/**
 * Substring paket yang JELAS bukan pemutar musik — keyboard/IME, launcher, system UI. Beberapa di
 * antaranya (mis. keyboard Samsung `honeyboard`) mendaftarkan MediaSession sehingga ikut "terdeteksi",
 * padahal tak pernah melaporkan judul/artis (jadi tak mungkin ter-scrobble). Disaring HANYA dari
 * daftar tampil "Sumber terdeteksi" agar tak membingungkan pengguna.
 */
const NON_MUSIC_SUBSTRINGS = [
  'honeyboard',
  'inputmethod',
  'swiftkey',
  'keyboard',
  'gboard',
  'launcher',
  'systemui',
];

/**
 * Apakah sebuah package layak dianggap sumber musik untuk DITAMPILKAN? App musik dikenal selalu ya.
 * Selain itu: buang hanya yang cocok pola non-musik jelas; paket tak dikenal lain tetap ditampilkan
 * (sesuai filosofi sourceLabels — memperlihatkan yang tak dikenal membantu identifikasi).
 */
export function isLikelyMusicSource(packageName: string): boolean {
  if (packageName in SOURCE_LABELS) return true;
  const p = packageName.toLowerCase();
  return !NON_MUSIC_SUBSTRINGS.some((s) => p.includes(s));
}
