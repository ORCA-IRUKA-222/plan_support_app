import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.kikaku.bansou',
  appName: '企画伴走',
  webDir: 'dist',
  android: {
    // 端末内 localStorage を確実に永続化させる。
    webContentsDebuggingEnabled: false,
    // アプリは https://localhost で動くため、LAN の同期サーバー
    // (http://192.168.x.x:8787) への通信は「混在コンテンツ」として
    // 既定では遮断される。許可しないと同期が Failed to fetch になる。
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
