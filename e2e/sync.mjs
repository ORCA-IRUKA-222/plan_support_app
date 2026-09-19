/**
 * 2端末（PC想定 / スマホ想定）が GitHub Gist 越しに同じ状態へ収束することを確認する。
 *
 * 本物の GitHub は叩かない。api.github.com への通信をテスト側で受け止め、
 * ひとつの「疑似 Gist」を共有することで、実際の画面操作だけで往復を再現する。
 *
 *   npm run build && npm run server &
 *   node e2e/sync.mjs [URL]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? process.env.SMOKE_URL ?? 'http://127.0.0.1:8787';
const TOKEN = 'ghp_e2e_dummy_token';
const FILENAME = 'kikaku-bansou.json';
const errors = [];

const step = async (name, fn) => {
  try { await fn(); console.log(`  ok  ${name}`); }
  catch (e) { console.log(`  FAIL ${name}: ${e.message.split('\n')[0]}`); errors.push(name); }
};

/** テスト内で共有する疑似 Gist。両端末がここを読み書きする。 */
const cloud = { id: null, content: null };
let offline = false;
let rejectToken = false;

/** api.github.com への通信を横取りして、疑似 Gist として応答する。 */
async function installGitHubMock(context) {
  await context.route('https://api.github.com/**', async (route) => {
    if (offline) return route.abort('internetdisconnected');

    const req = route.request();
    const url = new URL(req.url());
    // 本物の GitHub は CORS で X-OAuth-Scopes を公開している。
    // これが無いとブラウザから権限を読めず、実際の挙動と変わってしまう。
    const json = (status, body, headers = {}) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'X-OAuth-Scopes, X-Accepted-OAuth-Scopes',
          ...headers,
        },
        body: JSON.stringify(body),
      });

    if (rejectToken) return json(401, { message: 'Bad credentials' });

    if (url.pathname === '/user') {
      return json(200, { login: 'orca' }, { 'X-OAuth-Scopes': 'gist' });
    }
    if (url.pathname === '/gists' && req.method() === 'POST') {
      cloud.id = 'e2egist';
      cloud.content = JSON.parse(req.postData()).files[FILENAME].content;
      return json(201, { id: cloud.id });
    }
    if (url.pathname === `/gists/${cloud.id}`) {
      if (req.method() === 'PATCH') {
        cloud.content = JSON.parse(req.postData()).files[FILENAME].content;
        return json(200, { id: cloud.id });
      }
      return json(200, { id: cloud.id, files: { [FILENAME]: { content: cloud.content ?? '' } } });
    }
    return json(404, { message: 'Not Found' });
  });
}

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  timeout: 30000,
});

/** 独立した localStorage を持つ「1台の端末」を開く。 */
async function device(label, viewport) {
  const ctx = await browser.newContext({ viewport });
  await installGitHubMock(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  return { label, ctx, page };
}

const navigate = async (page, label) => {
  const menu = page.locator('.menu-btn');
  if (await menu.isVisible()) await menu.click();
  await page.locator('.nav-item', { hasText: label }).first().click();
  await page.waitForTimeout(200);
};

const setToken = async (page, gistId) => {
  await navigate(page, '設定・同期');
  if (gistId) {
    const field = page.getByPlaceholder('（空のままで自動作成）');
    await field.fill(gistId);
    await field.blur();
    await page.waitForTimeout(300);
  }
  await page.locator('input[type="password"]').fill(TOKEN);
  await page.locator('input[type="password"]').blur();
  await page.waitForTimeout(700);
};

const syncNow = async (page) => {
  await page.getByRole('button', { name: '⟳ 同期' }).click();
  await page.waitForTimeout(1200);
};

const pc = await device('PC', { width: 1280, height: 900 });
const phone = await device('スマホ', { width: 390, height: 844 });

await step('PC: 接続をテストすると gist 権限を確認できる', async () => {
  await pc.page.getByRole('button', { name: '企画をはじめる' }).click();
  await setToken(pc.page);
  await pc.page.getByRole('button', { name: '接続をテスト' }).click();
  await pc.page.getByText('orca として接続できました', { exact: false }).waitFor({ timeout: 8000 });
});

await step('PC: 初回同期で Gist が自動作成され、ID が入る', async () => {
  await navigate(pc.page, 'ネタ帳');
  await pc.page.getByPlaceholder(/遊んだもの/).fill('PCで書いたメモ');
  await pc.page.getByRole('button', { name: 'メモする' }).click();
  await syncNow(pc.page);

  if (!cloud.id) throw new Error('Gist が作られていません');
  await navigate(pc.page, '設定・同期');
  const id = await pc.page.getByPlaceholder('（空のままで自動作成）').inputValue();
  if (id !== cloud.id) throw new Error(`Gist ID が入っていません (${id})`);
});

await step('PC: 2回目の同期で本文が Gist に載る', async () => {
  await syncNow(pc.page);
  if (!String(cloud.content).includes('PCで書いたメモ')) {
    throw new Error('Gist に内容が書き込まれていません');
  }
});

await step('スマホ: 同じトークンと ID を入れると PC の内容が届く', async () => {
  await setToken(phone.page, cloud.id);
  await syncNow(phone.page);
  await phone.page.reload({ waitUntil: 'networkidle' });
  await phone.page.locator('.tabbar button', { hasText: 'ネタ帳' }).click();
  await phone.page.getByText('PCで書いたメモ').first().waitFor({ timeout: 8000 });
});

await step('スマホ: 通信できなくても書ける', async () => {
  offline = true;
  await phone.page.getByPlaceholder(/遊んだもの/).fill('外出先で書いたメモ');
  await phone.page.getByRole('button', { name: 'メモする' }).click();
  await phone.page.getByText('外出先で書いたメモ').first().waitFor({ timeout: 5000 });
});

await step('スマホ: 通信が戻ると保留分が Gist へ送られる', async () => {
  offline = false;
  await syncNow(phone.page);
  if (!String(cloud.content).includes('外出先で書いたメモ')) {
    throw new Error('オフライン中に書いた内容が Gist に届いていません');
  }
});

await step('PC: 同期するとスマホの内容が出る', async () => {
  await syncNow(pc.page);
  await navigate(pc.page, 'ネタ帳');
  await pc.page.getByText('外出先で書いたメモ').first().waitFor({ timeout: 8000 });
});

await step('両端末が同じ件数になる', async () => {
  const count = async (page) =>
    page.locator('.item .body').filter({ hasText: /で書いたメモ/ }).count();
  await phone.page.reload({ waitUntil: 'networkidle' });
  await phone.page.locator('.tabbar button', { hasText: 'ネタ帳' }).click();
  await phone.page.waitForTimeout(500);
  const a = await count(pc.page);
  const b = await count(phone.page);
  if (a !== b) throw new Error(`件数が違う PC=${a} スマホ=${b}`);
  if (a < 2) throw new Error(`両端末のメモが揃っていない (${a})`);
});

await step('Gist にトークンが含まれていない', async () => {
  if (String(cloud.content).includes(TOKEN)) {
    throw new Error('Gist にトークンが書き込まれています');
  }
});

await step('2台目でトークンだけ入れても勝手に別の Gist を作らない', async () => {
  // ここで自動作成されると、以後どれだけ同期しても1台目とつながらない。
  const third = await device('3台目', { width: 1280, height: 900 });
  const before = cloud.id;
  await navigate(third.page, '設定・同期');
  await third.page.locator('input[type="password"]').fill(TOKEN);
  await third.page.locator('input[type="password"]').blur();
  await third.page.waitForTimeout(2500);   // 自動同期が走るのを待つ
  if (cloud.id !== before) throw new Error('自動同期が新しい Gist を作ってしまいました');
  await third.ctx.close();
});

await step('トークンが無効なら分かる形で失敗する', async () => {
  rejectToken = true;
  await navigate(pc.page, '設定・同期');
  await pc.page.getByRole('button', { name: '接続をテスト' }).click();
  await pc.page.getByText('認識されませんでした', { exact: false }).waitFor({ timeout: 8000 });
  rejectToken = false;
});

await browser.close();
console.log(`\n${errors.length === 0 ? 'SYNC PASS' : 'SYNC FAIL'} — ${errors.length} 件`);
for (const e of errors) console.log('  - ' + e);
process.exit(errors.length ? 1 : 0);
