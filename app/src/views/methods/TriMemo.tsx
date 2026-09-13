import { useState } from 'react';
import { TRIMEMO_STEPS } from '../../domain/knowledge';
import type { TriMemoData } from '../../domain/types';
import type { AppSnapshot } from '../../store/store';
import { addSeed, saveTool, selectTool } from '../../store/store';
import { uid } from '../../lib/id';
import { AutoInput, AutoText, Card, Empty, QuickAdd } from '../../components/ui';

/**
 * 三角メモ。AとBに書いた別々のキーワードを掛け合わせて奇抜なアイデアを生む。
 * Bを書くときはAの内容をすべて忘れて自由に書き出すのがコツ。
 */
export default function TriMemo({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const data = selectTool<TriMemoData>(snapshot, projectId, 'trimemo');
  const save = (d: TriMemoData) => saveTool(projectId, 'trimemo', d);
  const [pick, setPick] = useState<{ a: string | null; b: string | null }>({ a: null, b: null });

  const combine = () => {
    if (!pick.a || !pick.b) return;
    save({ ...data, combos: [...data.combos, { id: uid('cmb'), a: pick.a, b: pick.b, idea: '' }] });
    setPick({ a: null, b: null });
  };

  return (
    <>
      <Card title="三角メモ" sub="AとBのキーワードを掛け合わせる">
        <label className="field" style={{ marginBottom: 10 }}>
          <span className="lbl">テーマ</span>
          <AutoInput value={data.theme} onChange={(v) => save({ ...data, theme: v })} placeholder="例: 銭湯に若い人を呼ぶアイデア" />
        </label>
        <ol className="tiny muted" style={{ margin: 0, paddingLeft: 20 }}>
          {TRIMEMO_STEPS.map((s) => <li key={s}>{s.replace(/^\(\d\)\s*/, '')}</li>)}
        </ol>

        <div className="tri" style={{ marginTop: 12 }}>
          <div className="side a">
            <b style={{ fontSize: 13.5 }}>A — テーマに関連するもの</b>
            <div className="tiny muted" style={{ marginBottom: 7 }}>関係する人・呼び名・イメージ・体験</div>
            <QuickAdd placeholder="キーワード" cta="+" onAdd={(t) => save({ ...data, a: [...data.a, t] })} />
            <div className="row tight" style={{ marginTop: 8 }}>
              {data.a.map((k, i) => (
                <button
                  key={`${i}-${k}`}
                  className="chip"
                  aria-pressed={pick.a === k}
                  onClick={() => setPick((p) => ({ ...p, a: p.a === k ? null : k }))}
                  onDoubleClick={() => save({ ...data, a: data.a.filter((_, j) => j !== i) })}
                  title="ダブルクリックで削除"
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="side b">
            <b style={{ fontSize: 13.5 }}>B — ターゲットの好きなこと</b>
            <div className="tiny muted" style={{ marginBottom: 7 }}>Aに書いた内容はすべて忘れて自由に</div>
            <QuickAdd placeholder="好きなこと" cta="+" onAdd={(t) => save({ ...data, b: [...data.b, t] })} />
            <div className="row tight" style={{ marginTop: 8 }}>
              {data.b.map((k, i) => (
                <button
                  key={`${i}-${k}`}
                  className="chip"
                  aria-pressed={pick.b === k}
                  onClick={() => setPick((p) => ({ ...p, b: p.b === k ? null : k }))}
                  onDoubleClick={() => save({ ...data, b: data.b.filter((_, j) => j !== i) })}
                  title="ダブルクリックで削除"
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="accent" disabled={!pick.a || !pick.b} onClick={combine}>
            {pick.a && pick.b ? `「${pick.a}」×「${pick.b}」を掛け合わせる` : 'A と B から1つずつ選んでください'}
          </button>
        </div>
      </Card>

      <Card title="掛け合わせ" sub={`${data.combos.length} 件`}>
        {data.combos.length === 0 && <Empty>まだありません。AとBから1つずつ選んでください。</Empty>}
        <div className="list">
          {data.combos.map((c) => (
            <div key={c.id} className="item">
              <div className="body">
                <div className="row tight">
                  <span className="chip static">{c.a}</span>
                  <span aria-hidden="true">×</span>
                  <span className="chip static accent">{c.b}</span>
                </div>
                <AutoText
                  value={c.idea}
                  rows={2}
                  placeholder="この2つを結びつけて、面白い言葉をつくる"
                  onChange={(v) =>
                    save({ ...data, combos: data.combos.map((x) => (x.id === c.id ? { ...x, idea: v } : x)) })
                  }
                />
              </div>
              <div className="col" style={{ gap: 4 }}>
                <button
                  className="sm ghost"
                  disabled={!c.idea.trim()}
                  onClick={() => addSeed(projectId, `[三角メモ] ${c.idea.trim()}`, 'transplant')}
                >
                  種へ
                </button>
                <button
                  className="sm ghost danger"
                  onClick={() => save({ ...data, combos: data.combos.filter((x) => x.id !== c.id) })}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>出典: 『すごいメモ。』小西利行 著／かんき出版</p>
      </Card>
    </>
  );
}
