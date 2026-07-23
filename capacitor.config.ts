import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.scrola.app',
  appName: 'Scrola',
  webDir: 'dist',
  backgroundColor: '#121A15',
  android: {
    allowMixedContent: false,
    backgroundColor: '#121A15',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#121A15',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
