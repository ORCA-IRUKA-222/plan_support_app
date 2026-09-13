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
const KEY = 'test-workspace-key';

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
      const res = await fetch(`${BASE}/api/health`);
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

describe('HTTP サーバー', () => {
  test('ヘルスチェックが応答する', async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
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

  test('合言葉が短いと 401', async () => {
    const res = await fetch(`${BASE}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Workspace-Key': 'short' },
      body: JSON.stringify({ cursor: 0, changes: [] }),
    });
    assert.equal(res.status, 401);
  });

  test('合言葉なしだと 401', async () => {
    const res = await fetch(`${BASE}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor: 0, changes: [] }),
    });
    assert.equal(res.status, 401);
  });

  test('レコードを送って受け取れる', async () => {
    const post = (body) =>
      fetch(`${BASE}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Workspace-Key': KEY },
        body: JSON.stringify(body),
      }).then((r) => r.json());

    const first = await post({
      cursor: 0,
      changes: [{ id: 'n1', kind: 'note', updatedAt: 1000, body: 'テスト' }],
    });
    assert.equal(first.changes.length, 1);

    const second = await post({ cursor: 0, changes: [] });
    assert.equal(second.changes.find((c) => c.id === 'n1').body, 'テスト');
  });

  test('パストラバーサルでリポジトリ外のファイルを読めない', async () => {
    const res = await fetch(`${BASE}/../../../../etc/passwd`);
    const text = await res.text();
    assert.ok(!text.includes('root:'), '/etc/passwd が漏れてはいけない');
  });

  test('壊れた JSON は 400', async () => {
    const res = await fetch(`${BASE}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Workspace-Key': KEY },
      body: '{ not json',
    });
    assert.equal(res.status, 400);
  });
});
