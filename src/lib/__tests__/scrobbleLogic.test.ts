import { describe, it, expect } from 'vitest';
import { isScrobbleEligible, parseScrobbleResponse, buildSignatureBase, scrobbleThresholdSec } from '../scrobbleLogic';

/**
 * Aturan resmi Last.fm (dari dokumentasi track.scrobble):
 *  - Durasi track HARUS > 30 detik
 *  - Track sudah diputar >= 50% durasinya ATAU >= 4 menit (240 detik), mana yang lebih dulu.
 *
 * Ini logic murni tanpa dependensi native/jaringan, jadi paling bernilai untuk ditest otomatis:
 * kalau ada regresi di sini, scrobble bisa tercatat terlalu dini/terlambat atau tidak sama sekali,
 * dan itu langsung merusak fungsi inti aplikasi.
 */
describe('isScrobbleEligible', () => {
  it('menolak track yang durasinya 30 detik atau kurang, berapa pun yang sudah diputar', () => {
    expect(isScrobbleEligible(30, 30)).toBe(false);
    expect(isScrobbleEligible(20, 20)).toBe(false);
    expect(isScrobbleEligible(10, 1000)).toBe(false);
  });

  it('menerima kalau sudah diputar >= 50% untuk track pendek (di bawah 8 menit)', () => {
    // Track 3 menit (180s): threshold = min(90, 240) = 90s
    expect(isScrobbleEligible(180, 89)).toBe(false);
    expect(isScrobbleEligible(180, 90)).toBe(true);
    expect(isScrobbleEligible(180, 180)).toBe(true);
  });

  it('memakai batas 4 menit untuk track panjang, bukan 50%', () => {
    // Track 20 menit (1200s): 50% = 600s, tapi batas 240s lebih dulu tercapai
    expect(isScrobbleEligible(1200, 239)).toBe(false);
    expect(isScrobbleEligible(1200, 240)).toBe(true);
    // Tidak perlu menunggu sampai 600s (50%) — 240s sudah cukup
    expect(isScrobbleEligible(1200, 300)).toBe(true);
  });

  it('menangani tepat di ambang durasi minimum (31 detik)', () => {
    // Track 31s: threshold = min(15.5, 240) = 15.5s
    expect(isScrobbleEligible(31, 15)).toBe(false);
    expect(isScrobbleEligible(31, 16)).toBe(true);
  });

  it('menangani nilai nol dan negatif dengan aman (tidak crash, tidak eligible)', () => {
    expect(isScrobbleEligible(0, 0)).toBe(false);
    expect(isScrobbleEligible(-5, 100)).toBe(false);
    expect(isScrobbleEligible(180, 0)).toBe(false);
  });
});

describe('parseScrobbleResponse', () => {
  it('menangani respons SATU track sebagai objek tunggal (kuirk Last.fm), bukan array', () => {
    // Last.fm mengembalikan objek tunggal, bukan array berisi 1 elemen, saat scrobble 1 track
    const response = {
      scrobbles: {
        scrobble: { artist: { '#text': 'A' }, ignoredMessage: { code: '0' } },
      },
    };
    const result = parseScrobbleResponse(response, 1);
    expect(result.accepted).toBe(1);
    expect(result.ignoredIndexes.size).toBe(0);
  });

  it('menangani respons banyak track sebagai array', () => {
    const response = {
      scrobbles: {
        scrobble: [
          { ignoredMessage: { code: '0' } },
          { ignoredMessage: { code: '0' } },
        ],
      },
    };
    const result = parseScrobbleResponse(response, 2);
    expect(result.accepted).toBe(2);
    expect(result.ignoredIndexes.size).toBe(0);
  });

  it('menandai track yang ditolak Last.fm (ignoredMessage.code != 0)', () => {
    const response = {
      scrobbles: {
        scrobble: [
          { ignoredMessage: { code: '0' } },
          { ignoredMessage: { code: '1' } }, // ditolak: artist kosong dsb
        ],
      },
    };
    const result = parseScrobbleResponse(response, 2);
    expect(result.accepted).toBe(1);
    expect(result.ignoredIndexes.has(1)).toBe(true);
    expect(result.ignoredIndexes.has(0)).toBe(false);
  });

  it('menganggap semua diterima kalau format respons tak terduga (tidak membuang data yang mungkin sukses)', () => {
    const result = parseScrobbleResponse({ unexpected: true }, 3);
    expect(result.accepted).toBe(3);
    expect(result.ignoredIndexes.size).toBe(0);
  });

  it('menerima code numerik 0 maupun string "0" sebagai diterima', () => {
    const response = {
      scrobbles: { scrobble: [{ ignoredMessage: { code: 0 } }] },
    };
    const result = parseScrobbleResponse(response, 1);
    expect(result.accepted).toBe(1);
  });
});

describe('buildSignatureBase', () => {
  it('mengurutkan parameter secara alfabetis dan menggabungkan key+value', () => {
    const base = buildSignatureBase({ b: '2', a: '1', c: '3' });
    expect(base).toBe('a1b2c3');
  });

  it('mengecualikan format dan callback dari signature (sesuai spek Last.fm)', () => {
    const base = buildSignatureBase({ method: 'auth.getSession', format: 'json', callback: 'x' });
    expect(base).toBe('methodauth.getSession');
  });

  it('mengabaikan parameter bernilai undefined', () => {
    const base = buildSignatureBase({ a: '1', b: undefined, c: '3' });
    expect(base).toBe('a1c3');
  });

  it('menangani nilai numerik (timestamp dll) dengan benar', () => {
    const base = buildSignatureBase({ timestamp: 1700000000, artist: 'X' });
    expect(base).toBe('artistXtimestamp1700000000');
  });
});

describe('scrobbleThresholdSec', () => {
  it('50% durasi untuk lagu pendek', () => {
    expect(scrobbleThresholdSec(180)).toBe(90);
    expect(scrobbleThresholdSec(264)).toBe(132);
  });

  it('dibatasi maksimal 240 detik untuk lagu panjang', () => {
    expect(scrobbleThresholdSec(1200)).toBe(240);
    expect(scrobbleThresholdSec(480)).toBe(240);
  });

  it('konsisten dengan isScrobbleEligible (satu sumber kebenaran)', () => {
    // Tepat di ambang -> eligible; sedetik sebelum -> belum. Kalau dua fungsi ini divergen,
    // visual tiket "tercetak penuh" bisa berbohong soal kapan lagu benar-benar tercatat.
    const dur = 200;
    const th = scrobbleThresholdSec(dur);
    expect(isScrobbleEligible(dur, th)).toBe(true);
    expect(isScrobbleEligible(dur, th - 1)).toBe(false);
  });
});
