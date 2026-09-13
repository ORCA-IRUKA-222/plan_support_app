import type { CtptData, ProposalData, SixW2HData, SwotData, ThreeCData, SkeletonData } from '../domain/types';

export function toMarkdown(doc: ProposalData): string {
  const lines: string[] = [];
  lines.push(`# ${doc.title || '（無題の企画）'}`);
  if (doc.subtitle) lines.push(`\n> ${doc.subtitle}`);
  const meta = [doc.author, doc.date].filter(Boolean).join(' / ');
  if (meta) lines.push(`\n${meta}`);
  for (const s of doc.sections) {
    if (!s.enabled || !s.body.trim()) continue;
    lines.push(`\n## ${s.title}\n\n${s.body.trim()}`);
  }
  return `${lines.join('\n')}\n`;
}

/** ブラウザの印刷から PDF 化できる、依存なしの単一 HTML。 */
export function toHtml(doc: ProposalData): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const sections = doc.sections
    .filter((s) => s.enabled && s.body.trim())
    .map((s) => `    <section>\n      <h2>${esc(s.title)}</h2>\n      <p>${esc(s.body.trim())}</p>\n    </section>`)
    .join('\n');

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title || '企画書')}</title>
<style>
  :root { --base:${doc.design.base}; --main:${doc.design.main}; --accent:${doc.design.accent}; }
  * { box-sizing: border-box; }
  body {
    font-family: "${esc(doc.design.font)}", "Hiragino Kaku Gothic ProN", Meiryo, system-ui, sans-serif;
    background: var(--base); color: #222; line-height: 1.8;
    max-width: 760px; margin: 0 auto; padding: 48px 28px;
  }
  h1 { color: var(--main); font-size: 26px; margin: 0 0 6px; }
  .sub { color: #666; margin: 0 0 6px; }
  .meta { color: #888; font-size: 13px; margin: 0 0 32px; }
  section { margin-bottom: 28px; break-inside: avoid; }
  h2 { font-size: 17px; color: var(--main); border-left: 5px solid var(--accent); padding-left: 10px; margin: 0 0 8px; }
  p { white-space: pre-wrap; margin: 0; }
  @media print { body { padding: 0; background: #fff; } }
</style>
</head>
<body>
  <h1>${esc(doc.title || '（無題の企画）')}</h1>
  ${doc.subtitle ? `<p class="sub">${esc(doc.subtitle)}</p>` : ''}
  <p class="meta">${esc([doc.author, doc.date].filter(Boolean).join(' / '))}</p>
${sections}
</body>
</html>
`;
}

export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke を次のタスクに回さないと Safari でダウンロードが中断される。
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(name: string): string {
  return (name.trim() || '企画書').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

/** 各セクションに、フレームワークで書いた内容から下書きを作る。 */
export function draftSection(
  id: string,
  src: { threec: ThreeCData; swot: SwotData; sixw2h: SixW2HData; ctpt: CtptData; skeleton: SkeletonData; oneLiner: string },
): string {
  const j = (...parts: (string | undefined)[]) => parts.filter((p) => p && p.trim()).join('\n');
  switch (id) {
    case 'summary':
      return j(src.oneLiner && `${src.oneLiner}`, src.ctpt.concept && `【コンセプト】${src.ctpt.concept}`);
    case 'analysis':
      return j(
        src.threec.customer && `【市場・顧客】\n${src.threec.customer}`,
        src.threec.competitor && `【競合】\n${src.threec.competitor}`,
        src.threec.company && `【自社】\n${src.threec.company}`,
        src.swot.s && `【強み】${src.swot.s}`,
        src.swot.w && `【弱み】${src.swot.w}`,
        src.swot.o && `【機会】${src.swot.o}`,
        src.swot.t && `【脅威】${src.swot.t}`,
        src.threec.issue && `\n→ 導かれる課題\n${src.threec.issue}`,
      );
    case 'purpose':
      return j(src.sixw2h.why && `【なぜ】\n${src.sixw2h.why}`, src.sixw2h.what && `【何を実現するか】\n${src.sixw2h.what}`);
    case 'detail':
      return j(
        src.ctpt.concept && `【コンセプト】${src.ctpt.concept}`,
        src.ctpt.target && `【ターゲット】${src.ctpt.target}`,
        src.ctpt.process && `【プロセス】${src.ctpt.process}`,
        src.ctpt.tool && `【ツール】${src.ctpt.tool}`,
        src.skeleton.loop.input && `\n【コアループ】\n入力: ${src.skeleton.loop.input}\n変化: ${src.skeleton.loop.change}\n報酬: ${src.skeleton.loop.reward}\n次の入力: ${src.skeleton.loop.next}`,
        src.sixw2h.whom && `\n【対象者】${src.sixw2h.whom}`,
        src.sixw2h.how && `【実施方法】${src.sixw2h.how}`,
        src.sixw2h.where && `【実施場所】${src.sixw2h.where}`,
      );
    case 'plan':
      return j(
        src.sixw2h.when && `【スケジュール】\n${src.sixw2h.when}`,
        src.sixw2h.who && `【体制】\n${src.sixw2h.who}`,
        src.sixw2h.howMuch && `【予算】\n${src.sixw2h.howMuch}`,
        src.skeleton.revenue.model && `【収益モデル】${src.skeleton.revenue.model}`,
        src.skeleton.revenue.detail && `${src.skeleton.revenue.detail}`,
        src.skeleton.feasibility.team && `【実現性】チーム: ${src.skeleton.feasibility.team} / 期間: ${src.skeleton.feasibility.period}`,
        src.skeleton.feasibility.prototype && `【プロトタイプ】${src.skeleton.feasibility.prototype}`,
      );
    case 'goal':
      return j(src.threec.issue && `解決する課題: ${src.threec.issue}`, src.sixw2h.why && `目標: ${src.sixw2h.why}`);
    case 'weakness':
      return j(src.skeleton.weakness && `【弱点】\n${src.skeleton.weakness}`, src.skeleton.anyway && `\n【それでもやる理由】\n${src.skeleton.anyway}`);
    default:
      return '';
  }
}
