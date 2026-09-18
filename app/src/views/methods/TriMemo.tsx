import { useState } from 'react';
import { TRIMEMO_STEPS } from '../../domain/knowledge';
import type { TriMemoData } from '../../domain/types';
import type { AppSnapshot } from '../../store/store';
import { addSeed, saveTool, selectTool } from '../../store/store';
import { uid } from '../../lib/id';
import { AutoInput, AutoText, Card, Empty, QuickAdd } from '../../components/ui';
import { Canvas, wrapLines } from '../../components/diagram';

const W = 960;
const H = 460;
const PAD = 16;
const MID = H / 2;
// 左右の三角は中央でわずかに重ねる（原典の図と同じ配置）。
const APEX_L = W / 2 + 26;
const APEX_R = W / 2 - 26;

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
          <AutoInput
            value={data.theme}
            onChange={(v) => save({ ...data, theme: v })}
            placeholder="例: 銭湯に若い人を呼ぶアイデア"
          />
        </label>
        <ol className="tiny muted" style={{ margin: '0 0 10px', paddingLeft: 20 }}>
          {TRIMEMO_STEPS.map((s) => <li key={s}>{s.replace(/^\(\d\)\s*/, '')}</li>)}
        </ol>

        <Canvas viewBox={`0 0 ${W} ${H}`} minWidth={620} label="三角メモ">
          {/* 左の三角（右向き）: テーマに関連するもの */}
          <polygon className="tri-shape-a" points={`${PAD},${PAD} ${PAD},${H - PAD} ${APEX_L},${MID}`} />
          {/* 右の三角（左向き）: ターゲットの好きなこと */}
          <polygon className="tri-shape-b" points={`${W - PAD},${PAD} ${W - PAD},${H - PAD} ${APEX_R},${MID}`} />

          <text className="tri-side-label" x={PAD + 46} y={MID + 8}>A</text>
          <text className="tri-side-label" x={W - PAD - 62} y={MID + 8}>B</text>
          <text className="dg-caption" x={PAD + 8} y={PAD - 3}>テーマに関連するもの</text>
          <text className="dg-caption" x={W - PAD} y={PAD - 3} textAnchor="end">ターゲットの好きなこと</text>

          {data.a.map((word, i) => {
            const p = slotIn('left', i, data.a.length);
            return (
              <Word
                key={`a-${i}-${word}`}
                x={p.x} y={p.y} text={word}
                picked={pick.a === word}
                onClick={() => setPick((s) => ({ ...s, a: s.a === word ? null : word }))}
                onRemove={() => save({ ...data, a: data.a.filter((_, j) => j !== i) })}
              />
            );
          })}
          {data.b.map((word, i) => {
            const p = slotIn('right', i, data.b.length);
            return (
              <Word
                key={`b-${i}-${word}`}
                x={p.x} y={p.y} text={word}
                picked={pick.b === word}
                onClick={() => setPick((s) => ({ ...s, b: s.b === word ? null : word }))}
                onRemove={() => save({ ...data, b: data.b.filter((_, j) => j !== i) })}
              />
            );
          })}

          {data.a.length === 0 && (
            <text className="dg-box-empty" x={PAD + 120} y={MID + 34} textAnchor="middle">下の欄から書き出す</text>
          )}
          {data.b.length === 0 && (
            <text className="dg-box-empty" x={W - PAD - 120} y={MID + 34} textAnchor="middle">下の欄から書き出す</text>
          )}
        </Canvas>

        <div className="grid two" style={{ marginTop: 12 }}>
          <div>
            <b style={{ fontSize: 13.5 }}>A — テーマに関連するもの</b>
            <div className="tiny muted" style={{ marginBottom: 6 }}>関係する人・呼び名・イメージ・体験</div>
            <QuickAdd placeholder="キーワード" cta="A に足す" onAdd={(t) => save({ ...data, a: [...data.a, t] })} />
          </div>
          <div>
            <b style={{ fontSize: 13.5 }}>B — ターゲットの好きなこと</b>
            <div className="tiny muted" style={{ marginBottom: 6 }}>Aに書いた内容はすべて忘れて自由に</div>
            <QuickAdd placeholder="好きなこと" cta="B に足す" onAdd={(t) => save({ ...data, b: [...data.b, t] })} />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="accent" disabled={!pick.a || !pick.b} onClick={combine}>
            {pick.a && pick.b
              ? `「${pick.a}」×「${pick.b}」を掛け合わせる`
              : '図の中の A と B から1つずつ選んでください'}
          </button>
          <span className="tiny muted">図の言葉はクリックで選択、×で削除</span>
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

/**
 * 三角形の内側に収まる位置を返す。
 * 頂点に近づくほど幅が狭くなるので、行ごとに使える横幅を計算して中央に置く。
 */
function slotIn(side: 'left' | 'right', index: number, total: number): { x: number; y: number } {
  const rows = Math.max(total, 1);
  // 上下の頂点付近は狭すぎるため、0.12〜0.88 の範囲に収める。
  const t = rows === 1 ? 0.5 : 0.12 + (index / (rows - 1)) * 0.76;
  const y = PAD + t * (H - PAD * 2);
  const narrowness = Math.abs(2 * t - 1);          // 0=中央(最も広い) 1=上下端
  const usable = (1 - narrowness) * (side === 'left' ? APEX_L - PAD : W - PAD - APEX_R);
  const x = side === 'left'
    ? PAD + usable * 0.5
    : W - PAD - usable * 0.5;
  return { x, y };
}

function Word({ x, y, text, picked, onClick, onRemove }: {
  x: number; y: number; text: string; picked: boolean; onClick: () => void; onRemove: () => void;
}) {
  const lines = wrapLines(text, 8, 2);
  const w = Math.max(56, Math.min(8, text.length) * 13 + 18);
  const h = lines.length > 1 ? 38 : 26;
  return (
    <g>
      <rect
        className={`tri-word-bg${picked ? ' is-picked' : ''}`}
        x={x - w / 2} y={y - h / 2} width={w} height={h} rx={13}
        onClick={onClick}
      />
      {lines.map((line, i) => (
        <text
          key={i}
          className={`tri-word${picked ? ' is-picked' : ''}`}
          x={x} y={y + 4.5 + (i - (lines.length - 1) / 2) * 14}
          textAnchor="middle"
          onClick={onClick}
        >
          {line}
        </text>
      ))}
      <g style={{ cursor: 'pointer' }} onClick={onRemove}>
        <title>削除</title>
        <circle cx={x + w / 2 - 2} cy={y - h / 2 + 2} r={8} fill="var(--surface)" stroke="var(--line)" />
        <text x={x + w / 2 - 2} y={y - h / 2 + 5.5} textAnchor="middle" fontSize={10} fill="var(--ink-soft)">×</text>
      </g>
    </g>
  );
}
