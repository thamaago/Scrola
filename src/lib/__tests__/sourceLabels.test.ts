import { describe, it, expect } from 'vitest';
import { sourceLabel } from '../sourceLabels';

describe('sourceLabel', () => {
  it('memetakan streaming besar ke nama enak dibaca', () => {
    expect(sourceLabel('com.spotify.music')).toBe('Spotify');
    expect(sourceLabel('com.google.android.apps.youtube.music')).toBe('YouTube Music');
  });

  it('mencakup pemutar file LOKAL yang umum', () => {
    expect(sourceLabel('com.maxmpz.audioplayer')).toBe('Poweramp');
    expect(sourceLabel('in.krosbits.musicolet')).toBe('Musicolet');
    expect(sourceLabel('com.sec.android.app.music')).toBe('Samsung Music');
    expect(sourceLabel('org.videolan.vlc')).toBe('VLC');
  });

  it('mencakup app populer di Indonesia/SEA', () => {
    expect(sourceLabel('com.tencent.ibg.joox')).toBe('JOOX');
    expect(sourceLabel('com.moonvideo.android.resso')).toBe('Resso');
  });

  it('pemutar internal Scrola dikenali', () => {
    expect(sourceLabel('com.scrola.app')).toBe('Scrola');
  });

  it('package tak dikenal dikembalikan apa adanya (bukan disamarkan)', () => {
    expect(sourceLabel('com.contoh.pemutar.baru')).toBe('com.contoh.pemutar.baru');
  });
});
