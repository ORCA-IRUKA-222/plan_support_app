/**
 * PC (同期サーバー) の電源が入っていない状況を再現し、
 * スマホの PWA がホーム画面から起動できることを確認する。
 *
 *   npm run build && npm run server &
 *   node e2e/offline.mjs [URL]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? process.env.SMOKE_URL ?? 'http://127.0.0.1:8787';
const errors = [];

const step = async (name, fn) => {
  try { await fn(); console.log(`  ok  ${name}`); }
  catch (e) { console.log(`  FAIL ${name}: ${e.message.split('\n')[0]}`); errors.push(name); }
};

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  timeout: 30000,
});

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

await step('オンラインで開くと Service Worker が有効になる', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    null,
    { timeout: 15000 },
  );
});

await step('企画を作ってメモを残す', async () => {
  await page.getByRole('button', { name: '企画をはじめる' }).click();
  await page.getByPlaceholder(/遊んだもの/).fill('オフラインでも読めるはずのメモ');
  await page.getByRole('button', { name: 'メモする' }).click();
  await page.getByText('オフラインでも読めるはずのメモ').first().waitFor({ timeout: 5000 });
});

await step('プリキャッシュが完了している', async () => {
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    if (names.length === 0) return 0;
    const cache = await caches.open(names[0]);
    return (await cache.keys()).length;
  });
  if (cached < 3) throw new Error(`キャッシュされたファイルが少なすぎます (${cached})`);
});

// ここで PC の電源を落とした状態にする
await step('サーバーが落ちていても起動できる', async () => {
  await ctx.setOffline(true);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const mounted = await page.evaluate(
    () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
  );
  if (!mounted) throw new Error('画面が表示されませんでした');
});

await step('オフラインでも保存済みのメモが読める', async () => {
  await page.locator('.tabbar button', { hasText: 'ネタ帳' }).click();
  await page.getByText('オフラインでも読めるはずのメモ').first().waitFor({ timeout: 8000 });
});

await step('オフラインでも新しくメモを書ける', async () => {
  await page.getByPlaceholder(/遊んだもの/).fill('外出先で思いついたこと');
  await page.getByRole('button', { name: 'メモする' }).click();
  await page.getByText('外出先で思いついたこと').first().waitFor({ timeout: 5000 });
});

await step('オンラインに戻すと書いた内容がサーバーへ送られる', async () => {
  await ctx.setOffline(false);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('.tabbar button', { hasText: 'ネタ帳' }).click();
  await page.getByText('外出先で思いついたこと').first().waitFor({ timeout: 8000 });
});

await browser.close();
console.log(`\n${errors.length === 0 ? 'OFFLINE PASS' : 'OFFLINE FAIL'} — ${errors.length} 件`);
for (const e of errors) console.log('  - ' + e);
process.exit(errors.length ? 1 : 0);
