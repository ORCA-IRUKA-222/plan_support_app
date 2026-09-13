/**
 * 実際の使い方をなぞる:
 *   PC でサーバーを止める → スマホでオフラインのまま書く → アプリを閉じる
 *   → PC でサーバーを起動 → スマホを開き直す → 同期される
 *
 * サーバーの停止・再開はテスト側で行うため、起動コマンドを渡して使う。
 *   node e2e/resume.mjs <PORT> <DB_FILE>
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] ?? 8899);
const DB = process.argv[3] ?? '/tmp/kikaku-resume.sqlite';
const BASE = `http://127.0.0.1:${PORT}`;
const KEY = `resume-${Date.now()}-key`;
const errors = [];

const step = async (name, fn) => {
  try { await fn(); console.log(`  ok  ${name}`); }
  catch (e) { console.log(`  FAIL ${name}: ${e.message.split('\n')[0]}`); errors.push(name); }
};

let server = null;
async function startServer() {
  server = spawn(process.execPath, ['--no-warnings', 'server/src/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_FILE: DB },
    stdio: 'ignore',
  });
  const deadline = Date.now() + 20000;
  for (;;) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* まだ */ }
    if (Date.now() > deadline) throw new Error('サーバーが起動しません');
    await new Promise((r) => setTimeout(r, 200));
  }
}
async function stopServer() {
  if (!server) return;
  server.kill('SIGTERM');
  server = null;
  // ポートが解放されるまで待つ
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${BASE}/api/health`); } catch { return; }
    await new Promise((r) => setTimeout(r, 100));
  }
}

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  timeout: 30000,
});

const navigate = async (page, label) => {
  const menu = page.locator('.menu-btn');
  if (await menu.isVisible()) await menu.click();
  await page.locator('.nav-item', { hasText: label }).first().click();
  await page.waitForTimeout(200);
};
const configure = async (page) => {
  await navigate(page, '設定・同期');
  await page.getByPlaceholder('http://192.168.1.10:8787').fill(BASE);
  await page.locator('input[type="password"]').fill(KEY);
  await page.locator('input[type="password"]').blur();
  await page.waitForTimeout(600);
};
const syncNow = async (page) => {
  await page.getByRole('button', { name: '⟳ 同期' }).click();
  await page.waitForTimeout(1200);
};

await startServer();

// --- PC 側で企画を作る ---
const pcCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pc = await pcCtx.newPage();
await pc.goto(BASE, { waitUntil: 'networkidle' });

await step('PC: 企画を作って同期する', async () => {
  await pc.getByRole('button', { name: '企画をはじめる' }).click();
  await pc.getByPlaceholder(/遊んだもの/).fill('PCで書いた最初のメモ');
  await pc.getByRole('button', { name: 'メモする' }).click();
  await configure(pc);
  await syncNow(pc);
});

// --- スマホ側で受け取る ---
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const phone = await phoneCtx.newPage();
await phone.goto(BASE, { waitUntil: 'networkidle' });

await step('スマホ: 同期して PC の内容を受け取る', async () => {
  await configure(phone);
  await syncNow(phone);
  await phone.reload({ waitUntil: 'networkidle' });
  await phone.locator('.tabbar button', { hasText: 'ネタ帳' }).click();
  await phone.getByText('PCで書いた最初のメモ').first().waitFor({ timeout: 8000 });
});

// --- PC の電源を切った状態 ---
await step('PC のサーバーを止める', async () => {
  await stopServer();
  const res = await fetch(`${BASE}/api/health`).then(() => 'まだ生きている').catch(() => null);
  if (res) throw new Error(res);
});

await step('スマホ: サーバーが落ちていても書ける', async () => {
  await phone.getByPlaceholder(/遊んだもの/).fill('外出先で書いたメモ');
  await phone.getByRole('button', { name: 'メモする' }).click();
  await phone.getByText('外出先で書いたメモ').first().waitFor({ timeout: 5000 });
});

await step('スマホ: アプリを閉じても消えない', async () => {
  await phone.close();
  const reopened = await phoneCtx.newPage();
  await reopened.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => { /* サーバー停止中 */ });
  const mounted = await reopened.evaluate(
    () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
  );
  if (!mounted) throw new Error('サーバー停止中に起動できませんでした');
  await reopened.locator('.tabbar button', { hasText: 'ネタ帳' }).click();
  await reopened.getByText('外出先で書いたメモ').first().waitFor({ timeout: 8000 });
  await reopened.close();
});

// --- PC を起動し直す ---
await step('PC のサーバーを起動し直す', async () => {
  await startServer();
});

await step('スマホ: 開き直すだけで自動的に送信される', async () => {
  const back = await phoneCtx.newPage();
  await back.goto(BASE, { waitUntil: 'networkidle' });
  // 起動時の自動同期を待つ (手動で ⟳ は押さない)
  await back.waitForTimeout(3000);
  await back.close();

  // サーバーに届いているかを直接確かめる
  const res = await fetch(`${BASE}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Workspace-Key': KEY },
    body: JSON.stringify({ cursor: 0, changes: [] }),
  }).then((r) => r.json());
  const found = res.changes.some(
    (r) => r.kind === 'note' && String(r.body ?? '').includes('外出先で書いたメモ'),
  );
  if (!found) throw new Error('オフラインで書いた内容がサーバーに届いていません');
});

await step('PC: 開き直すとスマホの内容が出る', async () => {
  await pc.reload({ waitUntil: 'networkidle' });
  await navigate(pc, 'ネタ帳');
  await pc.getByText('外出先で書いたメモ').first().waitFor({ timeout: 10000 });
});

await stopServer();
await browser.close();
try { rmSync(DB, { force: true }); rmSync(`${DB}-wal`, { force: true }); rmSync(`${DB}-shm`, { force: true }); } catch { /* 後始末 */ }

console.log(`\n${errors.length === 0 ? 'RESUME PASS' : 'RESUME FAIL'} — ${errors.length} 件`);
for (const e of errors) console.log('  - ' + e);
process.exit(errors.length ? 1 : 0);
