import { useState } from 'react';
import type { MandalaData } from '../../domain/types';
import type { AppSnapshot } from '../../store/store';
import { saveTool, selectTool } from '../../store/store';
import { AutoText, Card } from '../../components/ui';
import { EditorPanel } from '../../components/diagram';

/** 3×3 の中で、中央(4)以外の 8 マスが周囲マスに対応する。 */
const SURROUND = [0, 1, 2, 3, 5, 6, 7, 8];
const cellIndex = (pos: number) => (pos < 4 ? pos : pos - 1);

type Target = { block: 'core' } | { block: 'theme'; i: number } | { block: 'sub'; i: number; j: number };

/**
 * マンダラート。中央の核を8つに割り、その8つをさらに8つに割る。
 * 「81マスを埋めないといけない」という枠の力で、7個目・8個目に予想外が出る。
 */
export default function Mandala({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const data = selectTool<MandalaData>(snapshot, projectId, 'mandala');
  const save = (d: MandalaData) => saveTool(projectId, 'mandala', d);
  const [target, setTarget] = useState<Target>({ block: 'core' });

  const cells = data.cells;
  const sub = (i: number) => data.sub[i] ?? Array<string>(8).fill('');

  const setCell = (i: number, v: string) => {
    const next = cells.slice();
    next[i] = v;
    save({ ...data, cells: next });
  };
  const setSub = (i: number, j: number, v: string) => {
    const rows = data.sub.map((r) => r.slice());
    const row = rows[i] ?? Array<string>(8).fill('');
    row[j] = v;
    rows[i] = row;
    save({ ...data, sub: rows });
  };

  const filledThemes = cells.filter((c) => c.trim()).length;
  const filledAll = filledThemes + data.sub.reduce((n, r) => n + r.filter((c) => c.trim()).length, 0);

  /**
   * 9×9 の各マスが何にあたるかを求める。
   * 中央ブロック(4)は「核＋8テーマ」、周囲ブロック(b)は「テーマ b ＋その展開」。
   */
  const cellAt = (row: number, col: number) => {
    const block = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const pos = (row % 3) * 3 + (col % 3);

    if (block === 4) {
      if (pos === 4) return { kind: 'core' as const, text: data.center, target: { block: 'core' } as Target };
      const i = cellIndex(pos);
      return { kind: 'theme' as const, text: cells[i] ?? '', target: { block: 'theme', i } as Target };
    }

    const i = cellIndex(block);
    if (pos === 4) return { kind: 'theme' as const, text: cells[i] ?? '', target: { block: 'theme', i } as Target };
    const j = cellIndex(pos);
    return { kind: 'leaf' as const, text: sub(i)[j] ?? '', target: { block: 'sub', i, j } as Target };
  };

  const sameTarget = (a: Target, b: Target) =>
    a.block === b.block &&
    (a.block !== 'theme' || (b.block === 'theme' && a.i === b.i)) &&
    (a.block !== 'sub' || (b.block === 'sub' && a.i === b.i && a.j === b.j));

  const targetLabel = (): { title: string; hint: string; value: string; onChange: (v: string) => void } => {
    if (target.block === 'core') {
      return {
        title: '中央 — 核',
        hint: 'この企画の中心に置く一行',
        value: data.center,
        onChange: (v) => save({ ...data, center: v }),
      };
    }
    if (target.block === 'theme') {
      return {
        title: `テーマ ${target.i + 1}`,
        hint: '核を成り立たせる要素。8つ埋めきる',
        value: cells[target.i] ?? '',
        onChange: (v) => setCell(target.i, v),
      };
    }
    return {
      title: `テーマ ${target.i + 1}「${cells[target.i] || '未記入'}」 の展開 ${target.j + 1}`,
      hint: 'そのテーマを具体に落とす',
      value: sub(target.i)[target.j] ?? '',
      onChange: (v) => setSub(target.i, target.j, v),
    };
  };

  const editor = targetLabel();

  return (
    <>
      <Card title="マンダラート" sub={`テーマ ${filledThemes} / 8 ・ 全体 ${filledAll} / 72`}>
        <p className="hint">
          中央の3×3が「核＋8テーマ」、その外側の8ブロックが各テーマの展開です。
          枠が固定されているぶん強制的に埋めさせる力があり、7個目・8個目で予想外のアイデアが出ます。
          マスをクリックすると下の欄で編集できます。
        </p>

        <div className="dg-canvas">
          {/* 3×3 のブロックに分けて描くと、どこが1つのまとまりか目で追える。 */}
          <div className="mandala81" role="grid" aria-label="マンダラート 9×9">
            {Array.from({ length: 9 }, (_, block) => (
              <div
                key={block}
                className={`m-block${block === 4 ? ' is-center' : ''}`}
                role="rowgroup"
              >
                {Array.from({ length: 9 }, (_, pos) => {
                  const row = Math.floor(block / 3) * 3 + Math.floor(pos / 3);
                  const col = (block % 3) * 3 + (pos % 3);
                  const c = cellAt(row, col);
                  const selected = sameTarget(target, c.target);
                  return (
                    <button
                      key={pos}
                      className={[
                        'm-cell',
                        c.kind === 'core' ? 'is-core' : '',
                        c.kind === 'theme' ? 'is-theme' : '',
                        selected ? 'is-selected' : '',
                        c.text.trim() ? '' : 'is-empty',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setTarget(c.target)}
                      title={c.text || '未記入'}
                    >
                      {c.text.trim() ? c.text.slice(0, 18) : '＋'}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <EditorPanel title={editor.title} sub={editor.hint}>
        <AutoText value={editor.value} rows={3} onChange={editor.onChange} />
        {target.block === 'theme' && (
          <div className="row tight" style={{ marginTop: 8 }}>
            <span className="tiny muted">このテーマの展開へ:</span>
            {SURROUND.map((_, j) => (
              <button
                key={j}
                className="chip"
                onClick={() => setTarget({ block: 'sub', i: target.i, j })}
                disabled={!(cells[target.i] ?? '').trim()}
              >
                {j + 1}{(sub(target.i)[j] ?? '').trim() ? ' ✔' : ''}
              </button>
            ))}
          </div>
        )}
        {target.block === 'sub' && (
          <div className="row tight" style={{ marginTop: 8 }}>
            <button className="chip" onClick={() => setTarget({ block: 'theme', i: target.i })}>
              ← テーマ {target.i + 1} に戻る
            </button>
          </div>
        )}
      </EditorPanel>
    </>
  );
}
