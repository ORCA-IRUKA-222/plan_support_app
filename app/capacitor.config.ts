import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.kikaku.bansou',
  appName: '企画伴走',
  webDir: 'dist',
  android: {
    // 端末内 localStorage を確実に永続化させる。
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
