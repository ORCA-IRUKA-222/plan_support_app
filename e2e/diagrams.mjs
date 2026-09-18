/**
 * 思考ツールが「図」として描かれているかを確認する。
 * 入力欄が並んでいるだけに戻っていないか、実際の SVG 要素の数で見る。
 *
 *   npm run build && npm run server &
 *   node e2e/diagrams.mjs [URL]
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
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'], timeout: 30000,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

const openTool = async (name) => {
  await page.locator('.nav-item', { hasText: '思考ツール' }).first().click();
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(250);
};

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '企画をはじめる' }).click();

await step('マインドマップ: 中心・8軸・放射線が描かれる', async () => {
  await openTool('マインドマップ');
  await page.locator('svg .dg-center-bg').waitFor({ timeout: 5000 });
  const axes = await page.locator('svg .dg-box').count();
  if (axes < 8) throw new Error(`軸が ${axes} 個しかありません`);
  const spokes = await page.locator('svg line.dg-link').count();
  if (spokes < 8) throw new Error(`中心からの線が ${spokes} 本しかありません`);
});

await step('マインドマップ: 枝を足すと線でつながる', async () => {
  const before = await page.locator('svg line.dg-link').count();
  await page.getByPlaceholder(/の枝を足す/).fill('見送る操作');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const after = await page.locator('svg line.dg-link').count();
  if (after <= before) throw new Error('枝を足しても線が増えませんでした');
  await page.locator('svg .dg-box').filter({ hasText: '見送る操作' }).first().waitFor({ timeout: 3000 });
});

await step('マインドマップ: 枝どうしをつなぐと点線が引かれる', async () => {
  // 別の軸にも枝を作ってから連結する
  await page.locator('svg .dg-box').filter({ hasText: 'どう儲かるか' }).first().click();
  await page.getByPlaceholder(/の枝を足す/).fill('課金の動機');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.locator('select[aria-label="他の枝とつなぐ"]').first().selectOption({ index: 1 });
  await page.locator('svg path.dg-link.is-cross').first().waitFor({ timeout: 5000 });
  const cross = await page.locator('svg path.dg-link.is-cross').count();
  if (cross < 1) throw new Error('枝から枝への線が引かれていません');
});

await step('三角メモ: 三角形が2つ描かれる', async () => {
  await openTool('三角メモ');
  const a = await page.locator('svg polygon.tri-shape-a').count();
  const b = await page.locator('svg polygon.tri-shape-b').count();
  if (a !== 1 || b !== 1) throw new Error(`三角形が A=${a} B=${b} 個です`);
});

await step('三角メモ: 言葉が三角の中に置かれる', async () => {
  await page.getByPlaceholder('キーワード').fill('番台');
  await page.getByPlaceholder('キーワード').press('Enter');
  await page.getByPlaceholder('好きなこと').fill('占い');
  await page.getByPlaceholder('好きなこと').press('Enter');
  await page.waitForTimeout(400);
  const words = await page.locator('svg text.tri-word').count();
  if (words < 2) throw new Error(`図の中の言葉が ${words} 個です`);

  // 図から選んで掛け合わせる
  await page.locator('svg text.tri-word').filter({ hasText: '番台' }).first().click();
  await page.locator('svg text.tri-word').filter({ hasText: '占い' }).first().click();
  await page.getByRole('button', { name: /掛け合わせる/ }).click();
  await page.getByPlaceholder(/面白い言葉をつくる/).waitFor({ timeout: 3000 });
});

await step('マンダラート: 81マスの格子が出る', async () => {
  await openTool('マンダラート');
  const cells = await page.locator('.mandala81 .m-cell').count();
  if (cells !== 81) throw new Error(`マスが ${cells} 個です`);
  if (await page.locator('.mandala81 .m-cell.is-core').count() !== 1) throw new Error('中央の核がありません');
  if (await page.locator('.mandala81 .m-cell.is-theme').count() !== 16) {
    throw new Error('テーマのマスが 16 個ではありません（中央8＋各ブロック中央8）');
  }
});

await step('マンダラート: マスを押すと下で編集できる', async () => {
  await page.locator('.mandala81 .m-cell').nth(30).click();
  await page.locator('.dg-editor textarea').first().fill('テスト要素');
  await page.locator('.dg-editor textarea').first().blur();
  await page.waitForTimeout(400);
  await page.locator('.mandala81 .m-cell').filter({ hasText: 'テスト要素' }).first().waitFor({ timeout: 3000 });
});

await step('SCAMPER: 7操作が輪で描かれる', async () => {
  await openTool('SCAMPER');
  await page.locator('svg .dg-center-bg').waitFor({ timeout: 5000 });
  const boxes = await page.locator('svg .dg-box').count();
  if (boxes !== 7) throw new Error(`操作が ${boxes} 個です`);
  const accent = await page.locator('svg .dg-box.is-accent').count();
  if (accent !== 2) throw new Error(`強調される操作が ${accent} 個です（Eliminate/Reverse の2つのはず）`);
});

await step('逆転発想: 常識と逆転が向かい合う', async () => {
  await openTool('逆転発想 / 問題逆転');
  await page.getByPlaceholder(/全員がやっていること/).fill('プレイヤーがキャラを操作する');
  await page.getByRole('button', { name: '反転する' }).click();
  await page.waitForTimeout(300);
  await page.locator('.flip-card .side.before').first().waitFor({ timeout: 3000 });
  await page.locator('.flip-card .side.after').first().waitFor({ timeout: 3000 });
  const steps = await page.locator('.steps .step').count();
  if (steps !== 5) throw new Error(`問題逆転のステップが ${steps} 個です`);
});

await step('アナロジー移植: 捨てる→抜く→移す の流れが出る', async () => {
  await openTool('アナロジー移植');
  await page.getByPlaceholder(/好きな体験/).fill('謎解きライブ');
  await page.getByRole('button', { name: '分解する' }).click();
  await page.waitForTimeout(300);
  if (await page.locator('.transplant .cell.drop').count() !== 1) throw new Error('表層の欄がありません');
  if (await page.locator('.transplant .cell.keep').count() !== 1) throw new Error('構造の欄がありません');
  if (await page.locator('.transplant .cell.out').count() !== 1) throw new Error('移植先の欄がありません');
});

await step('体験の時間割: 折れ線と目盛りが描かれる', async () => {
  await openTool('体験の時間割');
  await page.getByRole('button', { name: 'チェックポイントで埋める' }).first().click();
  await page.waitForTimeout(400);

  // 全点が 0 のうちは水平線なので、可視判定ではなく存在で確認する。
  await page.locator('svg.spark2 path.curve').first().waitFor({ state: 'attached', timeout: 6000 });
  await page.locator('svg.spark2 path.area').first().waitFor({ state: 'attached', timeout: 6000 });
  const dots = await page.locator('svg.spark2 circle.dot').count();
  if (dots < 3) throw new Error(`点が ${dots} 個です`);
  if (await page.locator('svg.spark2 line.zero').count() !== 1) throw new Error('0 の基準線がありません');
  if (await page.locator('svg.spark2 line.grid').count() < 6) throw new Error('目盛りが足りません');
});

await step('体験の時間割: 点を押して感情を変えると線が動く', async () => {
  const flat = await page.locator('svg.spark2 path.curve').first().getAttribute('d');
  await page.locator('svg.spark2 circle.dot').first().click();
  await page.locator('.dg-editor').first().waitFor({ timeout: 5000 });

  await page.locator('.dg-editor input[type="range"]').fill('3');
  await page.waitForTimeout(400);

  const moved = await page.locator('svg.spark2 path.curve').first().getAttribute('d');
  if (moved === flat) throw new Error('感情を変えても線が動きませんでした');
  // 山ができたので、今度は figure として見えるはず
  await page.locator('svg.spark2 path.curve').first().waitFor({ timeout: 5000 });
  await page.getByText('最高点は', { exact: false }).first().waitFor({ timeout: 5000 });
});

await step('KJ法: 札が束として表示される', async () => {
  await page.locator('.nav-item', { hasText: '種出し' }).first().click();
  for (const t of ['操作させない案', '1日1回だけ案']) {
    await page.getByPlaceholder(/思いついたことを1行で/).fill(t);
    await page.keyboard.press('Enter');
  }
  await page.getByRole('button', { name: '3. まとめる（KJ法）' }).click();
  await page.waitForTimeout(300);
  const cards = await page.locator('.kj-card').count();
  if (cards < 2) throw new Error(`札が ${cards} 枚です`);
  await page.locator('.kj-cluster.is-unsorted').first().waitFor({ timeout: 3000 });
});

await step('スマホ幅でも図がはみ出さない', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tool of ['マインドマップ', '三角メモ', 'マンダラート', 'SCAMPER', '体験の時間割']) {
    await page.locator('.menu-btn').click();
    await page.locator('.nav-item', { hasText: '思考ツール' }).first().click();
    await page.getByRole('button', { name: tool, exact: true }).click();
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 2) throw new Error(`${tool} で横スクロールが発生 (${overflow}px)`);
  }
});

await browser.close();
console.log(`\n${errors.length === 0 ? 'DIAGRAMS PASS' : 'DIAGRAMS FAIL'} — ${errors.length} 件`);
for (const e of errors) console.log('  - ' + e);
process.exit(errors.length ? 1 : 0);
