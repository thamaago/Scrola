/**
 * cleanTrackMetadata.ts — merapikan metadata scrobble sebelum dikirim ke Last.fm.
 *
 * Terinspirasi kapabilitas Pano Scrobbler (regex edits + parsing judul YouTube + "fix Remastered"),
 * tapi diwujudkan sebagai fungsi MURNI yang bisa diuji penuh. Dua lapis:
 *   1. Noise VERSI (Remastered/Remaster tahun/dll.) dibersihkan dari track SEMUA sumber — ini yang
 *      sering ditambahkan layanan katalog seperti Spotify.
 *   2. Metadata YouTube (judul video = track, channel = artis) dirapikan agresif: buang emoji,
 *      potong setelah "|", buang tag promosi & blok "[… Release]"/"(prod. …)"/"Free Download",
 *      tangani channel "… - Topic", dan coba pisah "Artis - Judul".
 *
 * KONSERVATIF: kalau ragu, biarkan apa adanya. Ini heuristik; takkan 100% sempurna.
 */

const YOUTUBE_PKGS = new Set([
  'com.google.android.apps.youtube.music',
  'com.google.android.youtube',
]);

/** Tag promosi berkurung yang aman dibuang di ujung. Daftar TERBATAS — Remix/Acoustic/Live/Mashup/
 *  feat/Cover sengaja TIDAK termasuk (bermakna). */
const NOISE_TAG =
  /^(official\s*(music\s*)?video|official\s*audio|official\s*(lyric|lyrics)\s*(video)?|(lyric|lyrics)\s*video|lyrics?|visuali[sz]er|official|m\/?v|hd|hq|full\s*hd|4k|8k|full\s*(audio|video|album)|audio|video|colou?r\s*coded(\s*lyrics)?|a?\s*colou?rs\s*show|clip\s*officiel|video\s*clip|videoclip|performance\s*video)$/i;

/** Noise VERSI yang ditambahkan layanan katalog (paling sering: Remastered). Dibuang dari track. */
function stripVersionNoise(s: string): string {
  let out = s.trim();
  // bentuk berkurung: "(Remastered)", "(Remastered 2011)", "(2011 Remaster)", "[... Remaster]"
  out = out
    .replace(
      /\s*[([]\s*(\d{4}\s+)?(digital\s+)?remaster(ed)?(\s+\d{4})?(\s+version)?\s*[)\]]\s*$/i,
      ''
    )
    .trim();
  // bentuk suffix tanda hubung: "- Remastered", "- Remastered 2011", "- 2011 (Digital) Remaster"
  out = out
    .replace(
      /\s*[-–—]\s*(\d{4}\s+)?(digital\s+)?remaster(ed)?(\s+\d{4})?(\s+version)?\s*$/i,
      ''
    )
    .trim();
  return out.length > 0 ? out : s.trim();
}

/** Buang emoji & simbol piktografik umum. */
function stripEmoji(s: string): string {
  return s.replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu,
    ''
  );
}

/** Rapikan spasi & tanda kutip pintar; kolaps ganda; rapikan spasi di dalam kurung; trim. */
function collapseWs(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Potong dari "|" pertama — di YouTube, bagian setelah pipe hampir selalu channel/tag/album noise. */
function cutPipe(s: string): string {
  const i = s.indexOf('|');
  return i >= 0 ? s.slice(0, i).trim() : s;
}

/** Buang blok noise khas YouTube di mana pun: "[NCS Release]", "(prod. by X)", "Free Download". */
function stripYouTubeExtras(s: string): string {
  return s
    .replace(/\s*[[(][^\])]*\brelease\b[^\])]*[\])]\s*/gi, ' ') // [NCS Release], (Monstercat Release)
    .replace(/\s*[[(]\s*prod\.?\s*(by)?[^\])]*[\])]\s*/gi, ' ') // (prod. by X), [prod X]
    .replace(
      /\s*[[(][^\])]*\b(free\s*download|out\s*now|download\s*link|lyrics?\s*in\s*description)\b[^\])]*[\])]\s*/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Buang tag promosi berkurung di ujung, berulang (mis. "(Official Audio) [HD]"). */
function stripNoiseTags(s: string): string {
  let prev: string;
  let out = s.trim();
  do {
    prev = out;
    out = out
      .replace(/\s*[([]([^()[\]]*)[)\]]\s*$/, (m, inner: string) =>
        NOISE_TAG.test(inner.trim()) ? '' : m
      )
      .trim();
  } while (out !== prev);
  return out;
}

/** Buang suffix channel dari nama artis (mis. "- Topic", "- Official Channel", "VEVO"). */
function stripChannelSuffix(artist: string): string {
  const out = artist
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*-\s*Official\s*(Channel|Artist Channel)$/i, '')
    .replace(/\s*VEVO$/i, '')
    .replace(/\s*-\s*Official$/i, '')
    .trim();
  return out.length > 0 ? out : artist.trim();
}

export interface CleanInput {
  artist: string;
  track: string;
  sourcePackage?: string;
}

export interface CleanResult {
  artist: string;
  track: string;
}

export function cleanTrackMetadata(input: CleanInput): CleanResult {
  const artist0 = collapseWs(stripEmoji(input.artist ?? ''));
  const track0 = collapseWs(stripEmoji(input.track ?? ''));

  const isYouTube = input.sourcePackage ? YOUTUBE_PKGS.has(input.sourcePackage) : false;

  if (!isYouTube) {
    // Sumber katalog: sudah rapi. Hanya buang noise versi (Remastered dll.) dari track.
    return { artist: artist0, track: stripVersionNoise(track0) };
  }

  // --- YouTube ---
  // 1) Channel "… - Topic": auto-generate, biasanya BERSIH. Artis = channel tanpa "- Topic";
  //    track = judul (rapikan tag/pipe/extras + noise versi), JANGAN dipisah.
  if (/\s-\s*Topic$/i.test(artist0)) {
    const t = stripVersionNoise(stripNoiseTags(cutPipe(stripYouTubeExtras(track0))));
    return { artist: stripChannelSuffix(artist0), track: t };
  }

  // 2) Channel biasa: rapikan judul lalu coba pisah "Artis - Judul" di " - " pertama.
  const cleanedTitle = stripNoiseTags(cutPipe(stripYouTubeExtras(track0)));
  const dash = cleanedTitle.indexOf(' - ');
  if (dash > 0) {
    const a = collapseWs(cleanedTitle.slice(0, dash));
    const t = collapseWs(cleanedTitle.slice(dash + 3));
    if (a.length > 0 && t.length > 0) {
      return { artist: stripNoiseTags(a), track: stripVersionNoise(stripNoiseTags(t)) };
    }
  }

  // 3) Tak bisa dipisah dengan andal: judul bersih sebagai track, buang suffix channel dari artis.
  return { artist: stripChannelSuffix(artist0), track: stripVersionNoise(cleanedTitle) };
}
