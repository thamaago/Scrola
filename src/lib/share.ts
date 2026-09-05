import { registerPlugin } from '@capacitor/core';

export interface SharePluginType {
  shareImage(options: { base64: string; filename?: string; title?: string }): Promise<void>;
}

export const SharePlugin = registerPlugin<SharePluginType>('Share');
