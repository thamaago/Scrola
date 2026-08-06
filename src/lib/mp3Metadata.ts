import { registerPlugin } from '@capacitor/core';

export interface Mp3Metadata {
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: string;
  genre: string;
  albumArt: string | null; // data URI, atau null kalau tidak ada artwork
}

export interface SaveMp3MetadataOptions {
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: string;
  genre: string;
  /**
   * undefined -> artwork tidak diubah
   * ''        -> hapus artwork
   * data URI  -> ganti artwork
   */
  albumArtBase64?: string;
}

export interface Mp3MetadataPluginInterface {
  pickMp3ToEdit(): Promise<Mp3Metadata>;
  readMetadata(options: { uri: string }): Promise<Mp3Metadata>;
  pickAlbumArtImage(): Promise<{ albumArt: string }>;
  saveMetadata(options: SaveMp3MetadataOptions): Promise<void>;
}

export const Mp3MetadataNative = registerPlugin<Mp3MetadataPluginInterface>('Mp3Metadata');
