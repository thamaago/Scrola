/**
 * lastfm.ts
 * Client tipis untuk Last.fm Web API (AudioScrobbler 2.0).
 * Referensi resmi: https://www.last.fm/api
 *
 * CATATAN KEAMANAN:
 * - api_key bersifat publik (memang didesain untuk dibundel di client, sama seperti app resmi Last.fm).
 * - api_secret TIDAK sepenuhnya bisa disembunyikan di aplikasi mobile murni client-side — ini
 *   keterbatasan bawaan model API Last.fm untuk desktop/mobile client, bukan kelemahan yang kita buat.
 *   Mitigasi realistis: jangan commit secret ke repo publik (pakai env/secret manager di CI),
 *   dan jika suatu saat ada backend Scrola, pindahkan proses signing ke server.
 * - Session key (sk) milik USER disimpan terenkripsi di device (lihat secureStore.ts), tidak pernah
 *   dikirim lewat query string tanpa TLS.
 */

import md5 from 'md5';
import { CapacitorHttp, type HttpResponse } from '@capacitor/core';
import { buildSignatureBase } from './scrobbleLogic';

const API_ROOT = 'https://ws.audioscrobbler.com/2.0/';

// Kredensial di-inject saat build dari file .env.local (di-gitignore).
// Panduan lengkap untuk orang awam: docs/PANDUAN_API_KEY.md
const PLACEHOLDER_KEY = 'ISI_API_KEY_ANDA';
const PLACEHOLDER_SECRET = 'ISI_API_SECRET_ANDA';
const API_KEY = import.meta.env.VITE_LASTFM_API_KEY ?? PLACEHOLDER_KEY;
const API_SECRET = import.meta.env.VITE_LASTFM_API_SECRET ?? PLACEHOLDER_SECRET;

/**
 * True kalau API key belum dipasang sama sekali (masih nilai placeholder, atau file .env.local
 * berisi teks contoh yang belum diganti). Dipakai LoginScreen untuk menampilkan pesan yang
 * MENUNTUN ("API key belum dipasang, lihat docs/PANDUAN_API_KEY.md") alih-alih membiarkan
 * request terbang ke Last.fm dan pulang dengan error samar "Invalid API key" yang tidak
 * memberi tahu orang harus berbuat apa. Ini kesalahan pertama yang paling mungkin dialami
 * orang yang baru pertama kali mem-build dari source.
 */
export function isApiKeyMissing(): boolean {
  return (
    !API_KEY ||
    !API_SECRET ||
    API_KEY === PLACEHOLDER_KEY ||
    API_SECRET === PLACEHOLDER_SECRET ||
    API_KEY.startsWith('isi_api_key') ||
    API_SECRET.startsWith('isi_api_secret')
  );
}

export interface TrackInfo {
  artist: string;
  track: string;
  album?: string;
  albumArtist?: string;
  duration?: number; // detik
  timestamp?: number; // unix seconds, wajib untuk scrobble
  trackNumber?: number;
}

export interface LastfmSession {
  name: string; // username
  key: string; // session key (sk)
  subscriber: boolean;
}

/** Bangun api_sig sesuai spesifikasi Last.fm: md5(param1value1param2value2...secret).
 * Pembangunan STRING BASE-nya (penyaringan format/callback, pengurutan, penggabungan) memakai
 * buildSignatureBase dari scrobbleLogic.ts yang sudah diunit-test — di sini tinggal menempelkan
 * secret & md5. Sebelumnya logic base ini terduplikasi di dua tempat, rawan berubah tak sinkron. */
function buildSignature(params: Record<string, string | number | undefined>): string {
  return md5(buildSignatureBase(params) + API_SECRET);
}

async function call(
  method: string,
  params: Record<string, string | number | undefined>,
  { signed = false, httpMethod = 'GET' as 'GET' | 'POST', timeoutMs = 15_000 } = {}
) {
  const allParams: Record<string, string | number | undefined> = {
    method,
    api_key: API_KEY,
    ...params,
  };
  if (signed) {
    allParams.api_sig = buildSignature(allParams);
  }
  allParams.format = 'json';

  // Semua nilai dinormalkan jadi string; parameter undefined dibuang.
  const flat: Record<string, string> = {};
  Object.entries(allParams).forEach(([k, v]) => {
    if (v !== undefined) flat[k] = String(v);
  });

  // KENAPA CapacitorHttp, BUKAN fetch():
  // Capacitor memuat aplikasi dari origin https://localhost, sehingga fetch() di dalam WebView
  // tunduk pada aturan CORS browser. API Last.fm TIDAK mengirim header Access-Control-Allow-Origin
  // (ia memang ditujukan untuk klien native, bukan browser), jadi setiap request diblokir WebView
  // SEBELUM sempat terkirim — dan errornya muncul sebagai kegagalan jaringan generik ("Failed to
  // fetch"), yang menyesatkan karena tampak seperti masalah koneksi padahal internet baik-baik saja.
  // CapacitorHttp menjalankan request di lapisan native Android, jadi CORS tidak berlaku sama
  // sekali. Ini bug yang hanya muncul di perangkat: di lingkungan dev, kegagalannya bisa tertutup
  // oleh proxy Vite.
  let response: HttpResponse;
  try {
    response = await CapacitorHttp.request({
      method: httpMethod,
      url: API_ROOT,
      // GET: parameter masuk query string. POST: masuk body form-urlencoded (yang diminta Last.fm).
      ...(httpMethod === 'GET'
        ? { params: flat }
        : {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: flat,
          }),
      // Pengganti AbortController: CapacitorHttp punya batas waktunya sendiri. Batas waktu tetap
      // WAJIB ada — tanpanya, satu request yang menggantung (captive portal, koneksi setengah
      // putus) bisa mengunci mutex flushQueue() PERMANEN sampai app di-restart, dan tidak ada
      // scrobble lain yang akan pernah terkirim.
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
    });
  } catch (e) {
    // Kegagalan di lapisan native (DNS gagal, timeout, tidak ada koneksi).
    throw new Error(
      `Gagal menghubungi Last.fm untuk method ${method}: ${(e as Error)?.message ?? 'kesalahan jaringan'}`
    );
  }

  if (response.status < 200 || response.status >= 300) {
    // Bukan error dari Last.fm (yang formatnya JSON dengan field `error`), tapi error HTTP
    // level jaringan/server (mis. proxy publik WiFi mengembalikan halaman HTML, 502/503 dst).
    throw new Error(`Last.fm mengembalikan status HTTP ${response.status} untuk method ${method}`);
  }

  // CapacitorHttp sudah mem-parse JSON bila Content-Type-nya JSON; kalau ternyata masih string
  // (mis. server mengembalikan text/plain), parse manual agar penanganannya seragam.
  const json = typeof response.data === 'string' ? safeJsonParse(response.data, method) : response.data;

  if (json?.error) {
    throw new LastfmApiError(json.error, json.message);
  }
  return json;
}

function safeJsonParse(raw: string, method: string) {
  try {
    return JSON.parse(raw);
  } catch {
    // Biasanya terjadi kalau jaringan menyisipkan halaman HTML (captive portal WiFi publik).
    throw new Error(`Balasan Last.fm untuk method ${method} bukan JSON yang valid`);
  }
}

export class LastfmApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = 'LastfmApiError';
  }
}

// ---------- Auth flow (desktop/mobile "web auth") ----------

export async function getToken(): Promise<string> {
  const json = await call('auth.getToken', {});
  return json.token as string;
}

export function getAuthUrl(token: string): string {
  return `https://www.last.fm/api/auth/?api_key=${API_KEY}&token=${token}`;
}

export async function getSession(token: string): Promise<LastfmSession> {
  const json = await call('auth.getSession', { token }, { signed: true });
  return json.session as LastfmSession;
}

// ---------- Scrobbling ----------

export async function updateNowPlaying(sk: string, t: TrackInfo) {
  return call(
    'track.updateNowPlaying',
    {
      artist: t.artist,
      track: t.track,
      album: t.album,
      albumArtist: t.albumArtist,
      duration: t.duration,
      trackNumber: t.trackNumber,
      sk,
    },
    { signed: true, httpMethod: 'POST' }
  );
}

/** Scrobble satu track. Untuk batch, lihat scrobbleBatch(). */
export async function scrobble(sk: string, t: TrackInfo) {
  if (!t.timestamp) throw new Error('timestamp wajib diisi untuk scrobble');
  return call(
    'track.scrobble',
    {
      artist: t.artist,
      track: t.track,
      album: t.album,
      albumArtist: t.albumArtist,
      timestamp: t.timestamp,
      duration: t.duration,
      sk,
    },
    { signed: true, httpMethod: 'POST' }
  );
}

/** Last.fm mendukung hingga 50 scrobble per call lewat parameter berindeks artist[0], track[0], dst. */
export async function scrobbleBatch(sk: string, tracks: TrackInfo[]) {
  if (tracks.length === 0) return;
  if (tracks.length > 50) throw new Error('Maksimum 50 track per batch scrobble');

  const params: Record<string, string | number | undefined> = { sk };
  tracks.forEach((t, i) => {
    if (!t.timestamp) throw new Error(`track[${i}] tidak punya timestamp`);
    params[`artist[${i}]`] = t.artist;
    params[`track[${i}]`] = t.track;
    params[`timestamp[${i}]`] = t.timestamp;
    if (t.album) params[`album[${i}]`] = t.album;
    if (t.albumArtist) params[`albumArtist[${i}]`] = t.albumArtist;
    if (t.duration !== undefined) params[`duration[${i}]`] = t.duration;
  });

  return call('track.scrobble', params, { signed: true, httpMethod: 'POST' });
}

export async function loveTrack(sk: string, artist: string, track: string) {
  return call('track.love', { artist, track, sk }, { signed: true, httpMethod: 'POST' });
}

export async function unloveTrack(sk: string, artist: string, track: string) {
  return call('track.unlove', { artist, track, sk }, { signed: true, httpMethod: 'POST' });
}

// isScrobbleEligible sengaja TIDAK didefinisikan di sini — ia hidup di scrobbleLogic.ts sebagai
// fungsi murni yang sudah diunit-test, dan di-re-export di bawah supaya pemanggil lama yang
// mengimpor dari 'lastfm' tetap jalan tanpa perlu tahu file mana yang jadi sumbernya. Menyimpan
// dua definisi identik (seperti sebelumnya) berisiko keduanya berubah tak sinkron diam-diam.
export { isScrobbleEligible } from './scrobbleLogic';
