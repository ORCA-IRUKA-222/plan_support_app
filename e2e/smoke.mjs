/**
 * 画面の通し確認。
 * 型チェックでは見つからない実行時の壊れ方（レンダーが止まらない、画面が真っ白になる等）を拾う。
 *
 *   npm run build && npm run server &
 *   node e2e/smoke.mjs [URL]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? process.env.SMOKE_URL ?? 'http://127.0.0.1:8787';
const errors = [];
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  timeout: 30000,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const step = async (name, fn) => {
  try {
    await fn();
    // React のツリーが落ちると #root が空になる。各ステップ後に検出する。
    const mounted = await page.evaluate(() => (document.getElementById('root')?.childElementCount ?? 0) > 0);
    if (!mounted) throw new Error('画面が空になりました (レンダー失敗)');
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.log(`  FAIL ${name}: ${e.message.split('\n')[0]}`);
    errors.push(`${name}: ${e.message.split('\n')[0]}`);
  }
};

await page.goto(BASE, { waitUntil: 'networkidle' });

await step('起動して企画作成ボタンが出る', async () => {
  await page.getByRole('button', { name: '企画をはじめる' }).waitFor({ timeout: 8000 });
});

await step('企画を作るとネタ帳へ移る', async () => {
  await page.getByRole('button', { name: '企画をはじめる' }).click();
  await page.getByText('いま思いついたことを書く').waitFor({ timeout: 5000 });
});

await step('メモを3件書ける', async () => {
  for (const t of ['授業でPythonを触ったが退屈 #教育', '銭湯の番台が好き', '通学中は12分ある']) {
    await page.getByPlaceholder(/思いついたこと|遊んだもの/).fill(t);
    await page.getByRole('button', { name: 'メモする' }).click();
  }
  await page.getByText('全 3 件', { exact: false }).waitFor({ timeout: 5000 });
});

await step('タグが抽出されている', async () => {
  await page.getByText('#教育').first().waitFor({ timeout: 3000 });
});

await step('種出しへ行き種を足せる', async () => {
  await page.locator('.nav-item', { hasText: '種出し' }).first().click();
  await page.getByPlaceholder(/思いついたことを1行で/).fill('操作させないアクションゲーム');
  await page.keyboard.press('Enter');
  await page.getByText('操作させないアクションゲーム').first().waitFor({ timeout: 3000 });
});

await step('出所を切り替えられる', async () => {
  await page.getByRole('button', { name: /制約の逆用/ }).first().click();
  await page.getByPlaceholder(/思いついたことを1行で/).fill('1日1回しか遊べない');
  await page.keyboard.press('Enter');
  await page.getByText('1日1回しか遊べない').first().waitFor({ timeout: 3000 });
});

await step('判定タブで点を付けられる', async () => {
  await page.getByRole('button', { name: '2. 判定する' }).click();
  await page.getByText('良い種かどうかの4判定').first().waitFor({ timeout: 3000 });
  await page.getByRole('button', { name: '一行性 4点' }).first().click();
  await page.getByText(/計 4 \/ 16/).first().waitFor({ timeout: 3000 });
});

await step('KJ法タブが開く', async () => {
  await page.getByRole('button', { name: '3. まとめる（KJ法）' }).click();
  await page.getByText('集めてから名前を付ける', { exact: false }).waitFor({ timeout: 3000 });
});

await step('核の画面で一行を書ける', async () => {
  await page.locator('.nav-item', { hasText: '核を決める' }).first().click();
  const ta = page.getByPlaceholder(/操作させないアクションゲーム/);
  await ta.fill('操作させないアクションゲーム。見送ることでしか進めない。');
  await ta.blur();
  await page.getByText(/^\d+ 字$/).first().waitFor({ timeout: 3000 });
});

await step('骨格検証の画面が開く', async () => {
  await page.locator('.nav-item', { hasText: '骨格を検証' }).first().click();
  await page.getByText('コアループ').first().waitFor({ timeout: 3000 });
});

await step('思考ツール: マインドマップの8軸が出る', async () => {
  await page.locator('.nav-item', { hasText: '思考ツール' }).first().click();
  await page.getByText('どう儲かるか').first().waitFor({ timeout: 3000 });
});

await step('マインドマップに枝と第2階層を足せる', async () => {
  const add = page.getByPlaceholder('枝を足す').first();
  await add.fill('見送る操作');
  await add.press('Enter');
  await page.getByRole('button', { name: '+ 第2階層' }).first().click();
});

await step('マンダラートに切り替わる', async () => {
  await page.getByRole('button', { name: 'マンダラート' }).click();
  await page.getByText(/中央の核 \+ 周囲8マス/).waitFor({ timeout: 3000 });
});

await step('三角メモでA×Bを掛け合わせられる', async () => {
  await page.getByRole('button', { name: '三角メモ' }).click();
  await page.getByPlaceholder('キーワード').fill('番台');
  await page.getByPlaceholder('キーワード').press('Enter');
  await page.getByPlaceholder('好きなこと').fill('占い');
  await page.getByPlaceholder('好きなこと').press('Enter');
  await page.getByRole('button', { name: '番台' }).click();
  await page.getByRole('button', { name: '占い' }).click();
  await page.getByRole('button', { name: /掛け合わせる/ }).click();
  await page.getByPlaceholder(/面白い言葉をつくる/).waitFor({ timeout: 3000 });
});

await step('体験の時間割で折れ線が描かれる', async () => {
  await page.getByRole('button', { name: '体験の時間割' }).click();
  await page.getByRole('button', { name: 'チェックポイントで埋める' }).first().click();
  await page.locator('svg.spark').first().waitFor({ timeout: 3000 });
});

await step('フレームワークが開く', async () => {
  await page.locator('.nav-item', { hasText: 'フレームワーク' }).first().click();
  await page.getByText('3C分析').first().waitFor({ timeout: 3000 });
  const ta = page.locator('textarea').first();
  await ta.fill('市場規模は前年比110%');
  await ta.blur();
});

await step('企画書で下書き生成が動く', async () => {
  await page.locator('.nav-item', { hasText: '企画書' }).first().click();
  await page.getByRole('button', { name: 'フレームワークから下書き' }).click();
  await page.getByText(/セクションに下書きを入れました|材料がまだありません/).waitFor({ timeout: 4000 });
});

await step('プレビュータブが描画される', async () => {
  await page.getByRole('button', { name: 'プレビュー' }).click();
  await page.locator('.preview h1').waitFor({ timeout: 3000 });
});

await step('仕上げチェックが開く', async () => {
  await page.getByRole('button', { name: '仕上げチェック' }).click();
  await page.getByText('伝わる企画書にするための6項目').waitFor({ timeout: 3000 });
  await page.getByText('配色は4色以内に抑える').click();
});

await step('発表モードが開いて閉じられる', async () => {
  await page.locator('.nav-item', { hasText: '発表' }).first().click();
  await page.getByPlaceholder(/ボタンを押すと負けます/).fill('このゲーム、ボタンを押すと負けます。');
  await page.getByRole('button', { name: '発表を始める' }).click();
  await page.locator('.deck').waitFor({ timeout: 3000 });
  await page.getByRole('button', { name: /次 →/ }).click();
  await page.keyboard.press('Escape');
  await page.locator('.deck').waitFor({ state: 'detached', timeout: 3000 });
});

await step('ダッシュボードに進捗が出る', async () => {
  await page.locator('.nav-item', { hasText: 'ダッシュボード' }).first().click();
  await page.getByText('企画書ができるまでの5段階').waitFor({ timeout: 3000 });
  await page.getByText(/次にやること/).waitFor({ timeout: 3000 });
});

await step('リロードしてもデータが残る', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.nav-item', { hasText: 'ネタ帳' }).first().click();
  await page.getByText('全 3 件', { exact: false }).waitFor({ timeout: 5000 });
});

await step('設定画面が開く', async () => {
  await page.locator('.nav-item', { hasText: '設定・同期' }).first().click();
  await page.getByText('端末間の同期').waitFor({ timeout: 3000 });
});

// モバイル幅
await step('スマホ幅でタブバーが出て横スクロールしない', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('.tabbar').waitFor({ timeout: 4000 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) throw new Error(`横スクロールが発生 (${overflow}px)`);
});

await step('スマホ幅でもドロワーから全画面へ行ける', async () => {
  for (const label of ['核を決める', '骨格を検証', 'フレームワーク', '発表', '設定・同期']) {
    await page.locator('.menu-btn').click();
    await page.locator('.sidebar[data-open="true"]').waitFor({ timeout: 3000 });
    await page.locator('.nav-item', { hasText: label }).first().click();
    await page.waitForTimeout(150);
    const title = await page.locator('.topbar h1').textContent();
    if (title?.trim() !== label) throw new Error(`${label} に行けない (表示: ${title})`);
  }
});

await browser.close();

console.log(`\n${errors.length === 0 ? 'SMOKE PASS' : 'SMOKE FAIL'} — ${errors.length} 件`);
for (const e of errors) console.log('  - ' + e);
process.exit(errors.length ? 1 : 0);
