/**
 * 2端末（PC想定 / スマホ想定）が同期サーバー越しに同じ状態へ収束することを確認する。
 * ブラウザのプロファイルを分けることで、別々の localStorage を持つ2台を再現する。
 *
 *   npm run build && npm run server &
 *   node e2e/sync.mjs [URL]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? process.env.SMOKE_URL ?? 'http://127.0.0.1:8787';
const KEY = `e2e-${Date.now()}-secret`;
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

/** 独立した localStorage を持つ「1台の端末」を開く。 */
async function device(label, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  return { label, ctx, page };
}

/** 画面幅にかかわらずナビゲーションする。狭いときはドロワーを開く。 */
async function navigate(page, label) {
  const menu = page.locator('.menu-btn');
  if (await menu.isVisible()) await menu.click();
  await page.locator('.nav-item', { hasText: label }).first().click();
  await page.waitForTimeout(200);
}

async function configureSync(page) {
  await navigate(page, '設定・同期');
  await page.getByPlaceholder('http://192.168.1.10:8787').fill(BASE);
  await page.locator('input[type="password"]').fill(KEY);
  await page.locator('input[type="password"]').blur();
  await page.waitForTimeout(700);
}

async function syncNow(page) {
  await page.getByRole('button', { name: '⟳ 同期' }).click();
  await page.waitForTimeout(1200);
}

const pc = await device('PC', { width: 1280, height: 900 });
const phone = await device('スマホ', { width: 390, height: 844 });

await step('PC: 企画を作って同期設定を入れる', async () => {
  await pc.page.getByRole('button', { name: '企画をはじめる' }).click();
  await pc.page.getByText('いま思いついたことを書く').waitFor({ timeout: 5000 });
  await pc.page.getByPlaceholder(/遊んだもの/).fill('PCで書いたメモ');
  await pc.page.getByRole('button', { name: 'メモする' }).click();
  await configureSync(pc.page);
  await syncNow(pc.page);
});

await step('スマホ: 企画を作らずに同期設定だけで PC の企画が届く', async () => {
  // 2台目は企画を作らない。合言葉を入れて同期すれば PC の企画がそのまま現れる。
  await configureSync(phone.page);
  await syncNow(phone.page);
  await phone.page.reload({ waitUntil: 'networkidle' });
  await phone.page.locator('.tabbar button', { hasText: 'ネタ帳' }).click();
  await phone.page.waitForTimeout(300);
  await phone.page.getByText('PCで書いたメモ').first().waitFor({ timeout: 8000 });
});

await step('スマホ: 追記した内容が PC に返る', async () => {
  await phone.page.getByPlaceholder(/遊んだもの/).fill('スマホで書いたメモ');
  await phone.page.getByRole('button', { name: 'メモする' }).click();
  await syncNow(phone.page);

  await syncNow(pc.page);
  await navigate(pc.page, 'ネタ帳');
  await pc.page.getByText('スマホで書いたメモ').first().waitFor({ timeout: 8000 });
});

await step('両端末が同じメモ件数になる', async () => {
  const count = async (page) =>
    page.locator('.item .body').filter({ hasText: /で書いたメモ/ }).count();
  const a = await count(pc.page);
  const b = await count(phone.page);
  if (a !== b) throw new Error(`件数が違う PC=${a} スマホ=${b}`);
  if (a < 2) throw new Error(`両端末のメモが揃っていない (${a})`);
});

await step('別の合言葉の端末には見えない', async () => {
  const other = await device('別ワークスペース', { width: 1280, height: 900 });
  await navigate(other.page, '設定・同期');
  await other.page.getByPlaceholder('http://192.168.1.10:8787').fill(BASE);
  await other.page.locator('input[type="password"]').fill(`${KEY}-different`);
  await other.page.locator('input[type="password"]').blur();
  await other.page.waitForTimeout(700);
  await syncNow(other.page);
  await navigate(other.page, 'ネタ帳');
  const leaked = await other.page.getByText('PCで書いたメモ').count();
  if (leaked > 0) throw new Error('別の合言葉にデータが漏れている');
  await other.ctx.close();
});

await browser.close();
console.log(`\n${errors.length === 0 ? 'SYNC PASS' : 'SYNC FAIL'} — ${errors.length} 件`);
for (const e of errors) console.log('  - ' + e);
process.exit(errors.length ? 1 : 0);
