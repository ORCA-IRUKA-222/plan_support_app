import { PROBLEM_REVERSAL_STEPS } from '../../domain/knowledge';
import type { ReversalData } from '../../domain/types';
import type { AppSnapshot } from '../../store/store';
import { addSeed, saveTool, selectTool } from '../../store/store';
import { uid } from '../../lib/id';
import { AutoText, Card, Empty, Field, QuickAdd } from '../../components/ui';

/**
 * 逆転発想と問題逆転。
 * 反転した瞬間に成立条件を考えるのが本番。ここを詰めると独自のコアループができる。
 */
export default function Reversal({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const data = selectTool<ReversalData>(snapshot, projectId, 'reversal');
  const save = (d: ReversalData) => saveTool(projectId, 'reversal', d);

  const patchItem = (id: string, p: Partial<ReversalData['items'][number]>) =>
    save({ ...data, items: data.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });

  return (
    <>
      <Card title="逆転発想" sub="「全員がやっていること」を1つ選び、逆にしたらどうなるかを真面目に考える">
        <p className="hint">
          操作するゲームで「操作させない」、勝つゲームで「負けを集める」、育てるゲームで「壊す」。
          反転した瞬間に<b>成立条件</b>を考えるのが本番です。
        </p>
        <QuickAdd
          placeholder="全員がやっていること（例: プレイヤーがキャラを操作する）"
          cta="反転する"
          onAdd={(t) =>
            save({ ...data, items: [...data.items, { id: uid('rev'), common: t, reversed: '', condition: '', adopted: false }] })
          }
        />

        <div className="list" style={{ marginTop: 12 }}>
          {data.items.length === 0 && <Empty>まだありません。まず「当たり前」を1つ書き出してください。</Empty>}
          {data.items.map((item) => (
            <div key={item.id} className={`item${item.adopted ? ' starred' : ''}`}>
              <div className="body">
                <div className="tiny muted">常識</div>
                <b style={{ fontSize: 13.5 }}>{item.common}</b>
                <div className="grid two" style={{ marginTop: 8 }}>
                  <Field label="逆にしたら" hint="否定形・対義語に置き換える">
                    <AutoText value={item.reversed} rows={2} onChange={(v) => patchItem(item.id, { reversed: v })} />
                  </Field>
                  <Field label="成立条件" hint="ここを詰めると独自のコアループになる">
                    <AutoText value={item.condition} rows={2} onChange={(v) => patchItem(item.id, { condition: v })} />
                  </Field>
                </div>
              </div>
              <div className="col" style={{ gap: 4 }}>
                <button className="sm ghost" onClick={() => patchItem(item.id, { adopted: !item.adopted })}>
                  {item.adopted ? '★' : '☆'}
                </button>
                <button
                  className="sm ghost"
                  disabled={!item.reversed.trim()}
                  onClick={() => addSeed(projectId, `[逆転] ${item.reversed.trim()}`, 'constraint')}
                >
                  種へ
                </button>
                <button
                  className="sm ghost danger"
                  onClick={() => save({ ...data, items: data.items.filter((i) => i.id !== item.id) })}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="問題逆転（5ステップ）" sub="思考が止まったとき、気分転換しながらアイデアを出せる">
        {PROBLEM_REVERSAL_STEPS.map((step) => (
          <Field key={step.key} label={step.label} hint={step.ex}>
            <AutoText
              value={data.problem[step.key]}
              rows={2}
              onChange={(v) => save({ ...data, problem: { ...data.problem, [step.key]: v } })}
            />
          </Field>
        ))}
        <p className="tiny muted" style={{ marginTop: 8 }}>出典: 『アイデア大全』読書猿 著／フォレスト出版</p>
      </Card>
    </>
  );
}
