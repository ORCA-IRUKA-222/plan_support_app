import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// 静的配信の検証はビルド済みの画面がある時だけ。パス解決そのものは paths.test.js が常に見る。
const HAS_DIST = existsSync(resolve(REPO_ROOT, 'app/dist/index.html'));
const PORT = 18787 + (process.pid % 500);
const BASE = `http://127.0.0.1:${PORT}`;

let child;
let dataDir;

/**
 * npm workspaces 経由で起動したときと同じ条件（cwd が server/）で立ち上げる。
 * ここを cwd 基準でパス解決していると app/dist が見つからず全部 404 になる。
 */
before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'kikaku-test-'));
  child = spawn(process.execPath, ['--no-warnings', 'src/index.js'], {
    cwd: resolve(REPO_ROOT, 'server'),
    env: { ...process.env, PORT: String(PORT), DB_FILE: join(dataDir, 'test.sqlite') },
    stdio: 'ignore',
  });

  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch { /* まだ起動していない */ }
    if (Date.now() > deadline) throw new Error('サーバーが起動しませんでした');
    await new Promise((r) => setTimeout(r, 200));
  }
});

after(() => {
  child?.kill();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

describe('静的ファイルサーバー', () => {
  test('ヘルスチェックが応答する', async () => {
    const res = await fetch(`${BASE}/health`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'ok');
  });

  test('server/ から起動してもビルド済み画面を配信する', { skip: HAS_DIST ? false : 'app/dist が未ビルド (npm run build)' }, async () => {
    // 回帰テスト: 既定パスを cwd 基準にすると server/app/dist を見て 404 になる。
    const res = await fetch(BASE);
    assert.equal(res.status, 200, 'index.html が 200 で返るべき');
    const html = await res.text();
    assert.match(html, /<div id="root">/, 'ビルド済みの index.html であるべき');
  });

  test('未知のパスは SPA として index.html に落ちる', { skip: HAS_DIST ? false : 'app/dist が未ビルド (npm run build)' }, async () => {
    const res = await fetch(`${BASE}/some/deep/route`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<div id="root">/);
  });

  test('パストラバーサルでリポジトリ外のファイルを読めない', async () => {
    const res = await fetch(`${BASE}/../../../../etc/passwd`);
    const text = await res.text();
    assert.ok(!text.includes('root:'), '/etc/passwd が漏れてはいけない');
  });

  test('書き込み系のメソッドは受け付けない', async () => {
    // このサーバーは配信専用。データは持たないし、書き込みも受け付けない。
    const res = await fetch(BASE, { method: 'POST' });
    assert.equal(res.status, 405);
  });
});
