import { useMemo, useState } from 'react';
import { DESIGN_CAUTION, DESIGN_CHECKS, PITFALLS, PROPOSAL_SECTIONS } from '../domain/knowledge';
import type { CtptData, ProposalData, SixW2HData, SwotData, ThreeCData } from '../domain/types';
import type { GateContext } from '../domain/gates';
import type { AppSnapshot } from '../store/store';
import type { RouteId } from '../routes';
import { saveTool, selectTool } from '../store/store';
import { download, draftSection, safeFilename, toHtml, toMarkdown } from '../lib/export';
import { AutoInput, AutoText, Card, Check, Empty, Progress } from '../components/ui';

/** 段階4「書面化」。構成は Adobe とマネーフォワードの記事の要素をまとめたもの。 */
export default function Proposal({ ctx, snapshot, onToast, go }: {
  ctx: GateContext; snapshot: AppSnapshot; onToast: (m: string) => void; go: (r: RouteId) => void;
}) {
  const { project, proposal, skeleton } = ctx;
  const [tab, setTab] = useState<'write' | 'preview' | 'check'>('write');
  const save = (d: ProposalData) => saveTool(project.id, 'proposal', d);

  const sources = useMemo(() => ({
    threec: selectTool<ThreeCData>(snapshot, project.id, 'threec'),
    swot: selectTool<SwotData>(snapshot, project.id, 'swot'),
    sixw2h: selectTool<SixW2HData>(snapshot, project.id, 'sixw2h'),
    ctpt: selectTool<CtptData>(snapshot, project.id, 'ctpt'),
    skeleton,
    oneLiner: project.oneLiner,
  }), [snapshot, project.id, project.oneLiner, skeleton]);

  const doc: ProposalData = {
    ...proposal,
    title: proposal.title || project.title,
  };

  const enabled = doc.sections.filter((s) => s.enabled);
  const written = enabled.filter((s) => s.body.trim()).length;

  const patchSection = (id: string, p: Partial<ProposalData['sections'][number]>) =>
    save({ ...doc, sections: doc.sections.map((s) => (s.id === id ? { ...s, ...p } : s)) });

  const fillAll = () => {
    let filled = 0;
    const sections = doc.sections.map((s) => {
      if (s.body.trim()) return s;
      const draft = draftSection(s.id, sources);
      if (!draft) return s;
      filled++;
      return { ...s, body: draft, enabled: true };
    });
    save({ ...doc, sections });
    onToast(filled ? `${filled} セクションに下書きを入れました` : '下書きの材料がまだありません。フレームワークを埋めてください。');
  };

  return (
    <>
      <Card
        title="企画書"
        sub={`${written} / ${enabled.length} セクション記入済み`}
        actions={
          <>
            <button className="sm" onClick={fillAll}>フレームワークから下書き</button>
            <button className="sm" onClick={() => download(`${safeFilename(doc.title)}.md`, toMarkdown(doc), 'text/markdown')}>
              Markdown
            </button>
            <button className="sm" onClick={() => download(`${safeFilename(doc.title)}.html`, toHtml(doc), 'text/html')}>
              HTML
            </button>
            <button className="sm" onClick={() => window.print()}>印刷 / PDF</button>
          </>
        }
      >
        <Progress value={written} max={Math.max(enabled.length, 1)} />
        <div className="grid two" style={{ marginTop: 12 }}>
          <label className="field">
            <span className="lbl">タイトル</span>
            <AutoInput value={doc.title} onChange={(v) => save({ ...doc, title: v })} />
          </label>
          <label className="field">
            <span className="lbl">サブタイトル（核の一行）</span>
            <AutoInput
              value={doc.subtitle}
              placeholder={project.oneLiner || '核の一行'}
              onChange={(v) => save({ ...doc, subtitle: v })}
            />
          </label>
          <label className="field">
            <span className="lbl">作成者</span>
            <AutoInput value={doc.author} onChange={(v) => save({ ...doc, author: v })} />
          </label>
          <label className="field">
            <span className="lbl">日付</span>
            <input type="date" value={doc.date} onChange={(e) => save({ ...doc, date: e.target.value })} />
          </label>
        </div>
        <div className="row tight" style={{ marginTop: 12 }}>
          {(['write', 'preview', 'check'] as const).map((t) => (
            <button key={t} className="chip" aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === 'write' ? '書く' : t === 'preview' ? 'プレビュー' : '仕上げチェック'}
            </button>
          ))}
          <button className="chip" onClick={() => go('present')}>発表へ</button>
        </div>
      </Card>

      {tab === 'write' && (
        <>
          <p className="hint strong" style={{ marginTop: 14 }}>
            背景説明から始めない。一番面白い瞬間から始めて、根拠は後ろに置く。
          </p>
          {doc.sections.map((s, i) => {
            const def = PROPOSAL_SECTIONS.find((d) => d.id === s.id);
            return (
              <Card
                key={s.id}
                title={`${i + 1}. ${s.title}`}
                sub={def?.hint}
                actions={
                  <>
                    {!def?.required && (
                      <Check checked={s.enabled} onChange={(v) => patchSection(s.id, { enabled: v })}>使う</Check>
                    )}
                    <button
                      className="sm ghost"
                      onClick={() => {
                        const draft = draftSection(s.id, sources);
                        if (!draft) return onToast('このセクションの材料がまだありません');
                        patchSection(s.id, { body: draft, enabled: true });
                      }}
                    >
                      下書き
                    </button>
                  </>
                }
              >
                {s.enabled ? (
                  <>
                    <AutoText
                      value={s.body}
                      rows={7}
                      placeholder={def?.placeholder}
                      onChange={(v) => patchSection(s.id, { body: v })}
                    />
                    <div className="tiny muted" style={{ marginTop: 4 }}>{s.body.trim().length} 字</div>
                  </>
                ) : (
                  <p className="tiny muted" style={{ margin: 0 }}>このセクションは使いません。</p>
                )}
              </Card>
            );
          })}
        </>
      )}

      {tab === 'preview' && (
        <div style={{ marginTop: 14 }}>
          <div className="preview">
            <h1>{doc.title || '（無題の企画）'}</h1>
            {(doc.subtitle || project.oneLiner) && (
              <p className="doc-sub">{doc.subtitle || project.oneLiner}</p>
            )}
            <p className="doc-sub">{[doc.author, doc.date].filter(Boolean).join(' / ')}</p>
            {enabled.filter((s) => s.body.trim()).length === 0 && (
              <Empty>まだ何も書かれていません。「書く」タブか「フレームワークから下書き」から始めてください。</Empty>
            )}
            {enabled.filter((s) => s.body.trim()).map((s) => (
              <section key={s.id}>
                <h2>{s.title}</h2>
                <div className="doc-body">{s.body.trim()}</div>
              </section>
            ))}
          </div>
        </div>
      )}

      {tab === 'check' && (
        <>
          <Card title="伝わる企画書にするための6項目" sub="文章の3ポイント + 見やすく整える3つの法則">
            <p className="hint strong">{DESIGN_CAUTION}</p>
            {DESIGN_CHECKS.map((d) => (
              <Check
                key={d.id}
                checked={Boolean(doc.design.checks[d.id])}
                onChange={(v) => save({ ...doc, design: { ...doc.design, checks: { ...doc.design.checks, [d.id]: v } } })}
              >
                <b>{d.label}</b> — <span className="muted">{d.desc}</span>
              </Check>
            ))}
          </Card>

          <Card title="配色とフォント" sub="ベース70% / メイン25% / アクセント5%。書き出す HTML に反映されます">
            <div className="grid four">
              <label className="field">
                <span className="lbl">フォント</span>
                <select value={doc.design.font} onChange={(e) => save({ ...doc, design: { ...doc.design, font: e.target.value } })}>
                  {['游ゴシック', 'メイリオ', 'ヒラギノ角ゴ'].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              {([['base', 'ベースカラー'], ['main', 'メインカラー'], ['accent', 'アクセントカラー']] as const).map(([k, label]) => (
                <label className="field" key={k}>
                  <span className="lbl">{label}</span>
                  <input
                    type="color"
                    value={doc.design[k]}
                    onChange={(e) => save({ ...doc, design: { ...doc.design, [k]: e.target.value } })}
                  />
                </label>
              ))}
            </div>
          </Card>

          <Card title="陥りやすい罠" sub="提出前に読み返す">
            {PITFALLS.map((p) => (
              <div key={p.name} className="item" style={{ marginBottom: 6 }}>
                <div className="body">
                  <b style={{ fontSize: 13.5 }}>{p.name}</b>
                  <div className="tiny muted">{p.desc}</div>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
