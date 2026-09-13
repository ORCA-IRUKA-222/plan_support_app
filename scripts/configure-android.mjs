/**
 * `npx cap add android` が生成した Android プロジェクトに、
 * LAN の同期サーバー (平文 HTTP) へ接続するための設定を足す。
 *
 * Android 9 (API 28) 以降、平文 HTTP は既定で遮断される。
 * targetSdk 35 の本アプリもその対象で、これがないと同期が
 * "Failed to fetch" で必ず失敗する。
 *
 * android/ はリポジトリに含めず capacitor.config.ts から再生成する方針なので、
 * 生成のたびにこのスクリプトで設定し直す。何度実行しても結果は同じ。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ATTR = 'android:usesCleartextTraffic="true"';

/**
 * <application> に usesCleartextTraffic="true" を足す。
 * すでにある場合は何もしない。
 */
export function ensureCleartextTraffic(xml) {
  if (xml.includes('android:usesCleartextTraffic')) return { xml, changed: false };

  const open = xml.indexOf('<application');
  if (open === -1) throw new Error('<application> タグが見つかりません');

  // 属性の並びを崩さないよう、タグ名の直後に1つ足す。
  const insertAt = open + '<application'.length;
  const indentMatch = xml.slice(open).match(/\n(\s+)android:/);
  const indent = indentMatch ? indentMatch[1] : '        ';

  return {
    xml: `${xml.slice(0, insertAt)}\n${indent}${ATTR}${xml.slice(insertAt)}`,
    changed: true,
  };
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('使い方: node scripts/configure-android.mjs <AndroidManifest.xml のパス>');
    process.exit(1);
  }
  const { xml, changed } = ensureCleartextTraffic(readFileSync(path, 'utf8'));
  if (changed) {
    writeFileSync(path, xml, 'utf8');
    console.log(`  ${ATTR} を追加しました (${path})`);
  } else {
    console.log('  平文HTTPは既に許可されています');
  }
}

// 直接実行されたときだけ動かす (テストから import しても実行されない)
if (process.argv[1] && process.argv[1].endsWith('configure-android.mjs')) main();
