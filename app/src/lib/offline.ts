/**
 * この接続でオフライン起動 (Service Worker) が使えるかを判定する。
 *
 * Service Worker は「安全なコンテキスト」でしか動かない。
 * HTTPS か localhost だけが該当し、`http://192.168.x.x:8787` のような
 * LAN の IP アドレスへの平文 HTTP では navigator.serviceWorker 自体が存在しない。
 * つまり PWA をスマホに入れても、PC を切ると開けない。
 */
export interface OfflineCapability {
  available: boolean;
  reason: string;
  /** APK / localhost / HTTPS のいずれかで動いているか。 */
  secure: boolean;
}

export function offlineCapability(): OfflineCapability {
  if (typeof window === 'undefined') {
    return { available: false, reason: 'ブラウザ外で実行されています', secure: false };
  }

  const secure = window.isSecureContext === true;
  const hasApi = 'serviceWorker' in navigator;

  if (secure && hasApi) {
    return {
      available: true,
      secure: true,
      reason: 'この端末では、同期サーバーが止まっていてもアプリを起動できます。',
    };
  }

  if (!secure) {
    return {
      available: false,
      secure: false,
      reason:
        `この接続 (${window.location.origin}) は暗号化されていないため、` +
        'ブラウザがオフライン起動の仕組み (Service Worker) を許可しません。' +
        'いま入力した内容はこの端末に保存されますが、PC の同期サーバーを止めると' +
        'この画面自体が開けなくなります。外出先でも使いたい場合は APK 版を入れてください。',
    };
  }

  return {
    available: false,
    secure: true,
    reason: 'このブラウザは Service Worker に対応していないため、オフライン起動はできません。',
  };
}
