import { describe, it, expect } from 'vitest';
import { translate, translatePlural, resolveLocale } from '../i18n';
import { formatDurationHuman } from '../sisiBLogic';

/**
 * Uji integrasi: memastikan kunci nyata yang dipakai layar benar-benar menghasilkan teks Inggris
 * yang wajar setelah migrasi (bukan sekadar parity kunci). Menangkap regresi placeholder/typo.
 */
describe('render Inggris untuk kunci layar nyata', () => {
  it('interpolasi parameter pada kunci layar', () => {
    expect(translate('en', 'np.status.scrobbleAt', { time: '2:30' })).toBe('scrobbles at 2:30');
    expect(translate('en', 'login.error.rejected', { code: 10, message: 'x' })).toBe(
      'Last.fm rejected the request (code 10): x'
    );
    expect(translate('en', 'bab.hero.monthPre', { month: 'July' })).toBe('In July, you played ');
    expect(translate('en', 'history.pageRange', { from: 1, to: 10, total: 42 })).toBe('1–10 of 42');
  });

  it('bentuk jamak Inggris berbeda antara 1 dan banyak', () => {
    expect(translatePlural('en', 'count.tracks', 1)).toBe('1 song');
    expect(translatePlural('en', 'count.tracks', 5)).toBe('5 songs');
    expect(translatePlural('en', 'ticket.collected', 1)).toBe('1 ticket collected');
    expect(translatePlural('en', 'ticket.collected', 3)).toBe('3 tickets collected');
    expect(translatePlural('en', 'settings.queue.waiting', 1)).toBe('1 song waiting to send');
    expect(translatePlural('en', 'settings.queue.waiting', 2)).toBe('2 songs waiting to send');
    expect(translatePlural('en', 'penemuan.found', 1)).toBe('You discovered 1 artist');
    expect(translatePlural('en', 'penemuan.found', 9)).toBe('You discovered 9 artists');
  });

  it('id memakai satu bentuk jamak', () => {
    expect(translatePlural('id', 'count.tracks', 1)).toBe('1 lagu');
    expect(translatePlural('id', 'count.tracks', 5)).toBe('5 lagu');
  });

  it('formatDurationHuman sadar-locale', () => {
    expect(formatDurationHuman(6 * 3600 + 12 * 60, 'en')).toBe('6 hours 12 minutes');
    expect(formatDurationHuman(1 * 3600 + 1 * 60, 'en')).toBe('1 hour 1 minute');
    expect(formatDurationHuman(35 * 60, 'en')).toBe('35 minutes');
    expect(formatDurationHuman(6 * 3600 + 12 * 60, 'pt')).toBe('6 horas 12 minutos');
    expect(formatDurationHuman(1 * 3600 + 1 * 60, 'pt')).toBe('1 hora 1 minuto');
    // default tetap Indonesia (kompatibilitas pemanggil lama)
    expect(formatDurationHuman(2 * 3600)).toBe('2 jam');
  });
});

describe('Português (Brasil) — locale ke-3', () => {
  it('resolveLocale memetakan pt-BR/PT → pt', () => {
    expect(resolveLocale('pt-BR')).toBe('pt');
    expect(resolveLocale('PT')).toBe('pt');
  });
  it('render pt untuk kunci layar', () => {
    expect(translate('pt', 'nav.now')).toBe('Agora');
    expect(translate('pt', 'np.status.scrobbleAt', { time: '2:30' })).toBe('scrobble em 2:30');
    expect(translate('pt', 'bab.hero.monthPre', { month: 'maio' })).toBe('Em maio, você tocou ');
  });
  it('jamak pt: 1 vs banyak (0 = jamak)', () => {
    expect(translatePlural('pt', 'count.tracks', 1)).toBe('1 música');
    expect(translatePlural('pt', 'count.tracks', 5)).toBe('5 músicas');
    expect(translatePlural('pt', 'count.tracks', 0)).toBe('0 músicas');
    expect(translatePlural('pt', 'ticket.collected', 1)).toBe('1 ingresso colecionado');
    expect(translatePlural('pt', 'ticket.collected', 3)).toBe('3 ingressos colecionados');
  });
});

describe('Deutsch — locale ke-4', () => {
  it('resolveLocale memetakan de-DE/DE → de', () => {
    expect(resolveLocale('de-DE')).toBe('de');
    expect(resolveLocale('DE')).toBe('de');
  });
  it('render de + susunan kalimat verb-akhir (bab.hero.post)', () => {
    expect(translate('de', 'nav.now')).toBe('Jetzt');
    // "Im Mai hast du " + "{count} Songs" + " gespielt." — verba di akhir, benar secara gramatikal
    expect(translate('de', 'bab.hero.monthPre', { month: 'Mai' })).toBe('Im Mai hast du ');
    expect(translate('de', 'bab.hero.post')).toBe(' gespielt.');
  });
  it('jamak de: 1 vs banyak; Künstler tak berubah di jamak', () => {
    expect(translatePlural('de', 'count.tracks', 1)).toBe('1 Song');
    expect(translatePlural('de', 'count.tracks', 5)).toBe('5 Songs');
    expect(translatePlural('de', 'count.artists', 1)).toBe('1 Künstler');
    expect(translatePlural('de', 'count.artists', 5)).toBe('5 Künstler');
    expect(translatePlural('de', 'ticket.collected', 1)).toBe('1 Ticket gesammelt');
    expect(translatePlural('de', 'ticket.collected', 2)).toBe('2 Tickets gesammelt');
  });
  it('formatDurationHuman de', () => {
    expect(formatDurationHuman(6 * 3600 + 12 * 60, 'de')).toBe('6 Stunden 12 Minuten');
    expect(formatDurationHuman(1 * 3600 + 1 * 60, 'de')).toBe('1 Stunde 1 Minute');
  });
});

describe('Français — locale ke-5', () => {
  it('resolveLocale memetakan fr-FR/FR → fr', () => {
    expect(resolveLocale('fr-FR')).toBe('fr');
    expect(resolveLocale('FR')).toBe('fr');
  });
  it('render fr', () => {
    expect(translate('fr', 'nav.now')).toBe('En cours');
    expect(translate('fr', 'bab.hero.monthPre', { month: 'mai' })).toBe('En mai, tu as joué ');
  });
  it('ATURAN JAMAK PRANCIS: 0 DAN 1 → tunggal, ≥2 → jamak', () => {
    expect(translatePlural('fr', 'count.tracks', 0)).toBe('0 chanson'); // tunggal untuk 0!
    expect(translatePlural('fr', 'count.tracks', 1)).toBe('1 chanson');
    expect(translatePlural('fr', 'count.tracks', 2)).toBe('2 chansons');
    expect(translatePlural('fr', 'ticket.collected', 1)).toBe('1 billet collectionné');
    expect(translatePlural('fr', 'ticket.collected', 3)).toBe('3 billets collectionnés');
  });
  it('formatDurationHuman fr', () => {
    expect(formatDurationHuman(6 * 3600 + 12 * 60, 'fr')).toBe('6 heures 12 minutes');
    expect(formatDurationHuman(1 * 3600 + 1 * 60, 'fr')).toBe('1 heure 1 minute');
  });
});

describe('Русский — locale ke-6 (jamak TIGA bentuk)', () => {
  it('resolveLocale memetakan ru-RU/RU → ru', () => {
    expect(resolveLocale('ru-RU')).toBe('ru');
    expect(resolveLocale('RU')).toBe('ru');
  });
  it('render ru (Kiril)', () => {
    expect(translate('ru', 'nav.now')).toBe('Сейчас');
    expect(translate('ru', 'np.status.scrobbleAt', { time: '2:30' })).toBe('скробл на 2:30');
  });
  it('ATURAN JAMAK RUSIA: one/few/many mengikuti CLDR', () => {
    // трек: 1 → one, 2-4 → few, 5+ & 11-14 → many, 21 → one lagi
    expect(translatePlural('ru', 'count.tracks', 1)).toBe('1 трек');
    expect(translatePlural('ru', 'count.tracks', 2)).toBe('2 трека');
    expect(translatePlural('ru', 'count.tracks', 4)).toBe('4 трека');
    expect(translatePlural('ru', 'count.tracks', 5)).toBe('5 треков');
    expect(translatePlural('ru', 'count.tracks', 11)).toBe('11 треков');
    expect(translatePlural('ru', 'count.tracks', 21)).toBe('21 трек');
    expect(translatePlural('ru', 'count.tracks', 22)).toBe('22 трека');
    expect(translatePlural('ru', 'count.tracks', 25)).toBe('25 треков');
    // artis: исполнитель / исполнителя / исполнителей
    expect(translatePlural('ru', 'count.artists', 1)).toBe('1 исполнитель');
    expect(translatePlural('ru', 'count.artists', 3)).toBe('3 исполнителя');
    expect(translatePlural('ru', 'count.artists', 7)).toBe('7 исполнителей');
  });
  it('formatDurationHuman ru', () => {
    expect(formatDurationHuman(2 * 3600 + 2 * 60, 'ru')).toBe('2 часа 2 минуты');
    expect(formatDurationHuman(5 * 3600 + 5 * 60, 'ru')).toBe('5 часов 5 минут');
    expect(formatDurationHuman(1 * 3600 + 1 * 60, 'ru')).toBe('1 час 1 минута');
  });
});

describe('日本語 — locale ke-7 (CJK, tanpa jamak, verb-akhir)', () => {
  it('resolveLocale memetakan ja-JP/JA → ja', () => {
    expect(resolveLocale('ja-JP')).toBe('ja');
    expect(resolveLocale('JA')).toBe('ja');
  });
  it('render ja (CJK)', () => {
    expect(translate('ja', 'nav.now')).toBe('再生中');
    expect(translate('ja', 'np.status.savedHistory')).toBe('履歴に保存済み');
  });
  it('tanpa infleksi jamak: 1曲 dan 5曲 bentuk sama', () => {
    expect(translatePlural('ja', 'count.tracks', 1)).toBe('1曲');
    expect(translatePlural('ja', 'count.tracks', 5)).toBe('5曲');
    expect(translatePlural('ja', 'count.tracks', 0)).toBe('0曲');
    expect(translatePlural('ja', 'ticket.collected', 3)).toBe('チケット3枚を収集');
  });
  it('struktur verb-akhir (SOV) lewat bab.hero.post & subtitle.post', () => {
    // 「5月は、」+「210曲」+「を再生しました。」
    expect(translate('ja', 'bab.hero.monthPre', { month: '5月' })).toBe('5月は、');
    expect(translate('ja', 'bab.hero.post')).toBe('を再生しました。');
    expect(translate('ja', 'bab.subtitle.post')).toBe('。'); // penutup kalimat CJK, bukan "."
  });
  it('formatDurationHuman ja (satu bentuk)', () => {
    expect(formatDurationHuman(6 * 3600 + 12 * 60, 'ja')).toBe('6時間 12分');
    expect(formatDurationHuman(1 * 3600, 'ja')).toBe('1時間');
  });
});

describe('Español — locale ke-8 (jangkauan terluas)', () => {
  it('resolveLocale memetakan es-419/es-MX/ES → es', () => {
    expect(resolveLocale('es-419')).toBe('es');
    expect(resolveLocale('es-MX')).toBe('es');
    expect(resolveLocale('ES')).toBe('es');
  });
  it('render es + jamak one/other', () => {
    expect(translate('es', 'nav.now')).toBe('Ahora');
    expect(translatePlural('es', 'count.tracks', 1)).toBe('1 canción');
    expect(translatePlural('es', 'count.tracks', 5)).toBe('5 canciones');
    expect(translatePlural('es', 'count.tracks', 0)).toBe('0 canciones');
    expect(translatePlural('es', 'penemuan.found', 1)).toBe('Descubriste 1 artista');
    expect(translatePlural('es', 'penemuan.found', 9)).toBe('Descubriste 9 artistas');
  });
  it('formatDurationHuman es', () => {
    expect(formatDurationHuman(6 * 3600 + 12 * 60, 'es')).toBe('6 horas 12 minutos');
    expect(formatDurationHuman(1 * 3600 + 1 * 60, 'es')).toBe('1 hora 1 minuto');
  });
});
