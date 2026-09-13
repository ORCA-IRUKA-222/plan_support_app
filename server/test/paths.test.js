import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePaths } from '../src/paths.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('既定パスの解決', () => {
  test('リポジトリのルートと server/ を正しく指す', () => {
    const p = resolvePaths({});
    assert.equal(p.repoRoot, REPO_ROOT);
    assert.equal(p.serverRoot, resolve(REPO_ROOT, 'server'));
  });

  test('カレントディレクトリが変わっても既定パスは変わらない', () => {
    // 回帰テスト: cwd 基準で解決していると npm run server (cwd=server/) のとき
    // server/app/dist を探しに行き、画面が全部 404 になる。
    const original = process.cwd();
    try {
      process.chdir(resolve(REPO_ROOT, 'server'));
      const fromServer = resolvePaths({});
      process.chdir(REPO_ROOT);
      const fromRoot = resolvePaths({});

      assert.equal(fromServer.staticDir, fromRoot.staticDir);
      assert.equal(fromServer.dbFile, fromRoot.dbFile);
      assert.equal(fromServer.staticDir, resolve(REPO_ROOT, 'app/dist'));
      assert.equal(fromServer.dbFile, resolve(REPO_ROOT, 'server/data/sync.sqlite'));
    } finally {
      process.chdir(original);
    }
  });

  test('環境変数があればそちらを優先する', () => {
    const p = resolvePaths({ DB_FILE: '/tmp/x/my.sqlite', STATIC_DIR: '/tmp/y/dist' });
    assert.equal(p.dbFile, '/tmp/x/my.sqlite');
    assert.equal(p.staticDir, '/tmp/y/dist');
  });

  test('環境変数の相対パスは絶対パスにする', () => {
    const p = resolvePaths({ DB_FILE: 'rel/a.sqlite', STATIC_DIR: 'rel/dist' });
    assert.ok(p.dbFile.startsWith('/'), '絶対パスであるべき');
    assert.ok(p.staticDir.startsWith('/'), '絶対パスであるべき');
  });
});
