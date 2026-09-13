import type { AnalogyData } from '../../domain/types';
import type { AppSnapshot } from '../../store/store';
import { addSeed, saveTool, selectTool } from '../../store/store';
import { uid } from '../../lib/id';
import { AutoText, Card, Empty, Field, QuickAdd } from '../../components/ui';

/**
 * アナロジー移植。好きな体験を「表層」と「構造」に分け、構造だけを別ジャンルに持ち込む。
 * 題材ごと持ってくると模倣になるが、構造だけなら新作になる。
 */
export default function Analogy({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const data = selectTool<AnalogyData>(snapshot, projectId, 'analogy');
  const save = (d: AnalogyData) => saveTool(projectId, 'analogy', d);
  const patch = (id: string, p: Partial<AnalogyData['items'][number]>) =>
    save({ items: data.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });

  return (
    <Card title="アナロジー移植" sub="表層を捨てて、構造だけを別ジャンルへ">
      <p className="hint">
        謎解きライブの多層ギミックや、サークル運営での「個々が別方向を向きながら集団が保たれる」構造は、
        そのままゲームシステムの原型になります。題材ごと持ってくると模倣ですが、構造だけなら新作です。
      </p>
      <QuickAdd
        placeholder="好きな体験（例: 謎解きライブ / 部活の朝練 / 深夜ラジオ）"
        cta="分解する"
        onAdd={(t) => save({ items: [...data.items, { id: uid('an'), origin: t, surface: '', structure: '', transplant: '' }] })}
      />

      <div className="list" style={{ marginTop: 12 }}>
        {data.items.length === 0 && <Empty>まだありません。まず自分が好きな体験を1つ書いてください。</Empty>}
        {data.items.map((item) => (
          <div key={item.id} className="item">
            <div className="body">
              <b style={{ fontSize: 13.5 }}>{item.origin}</b>
              <div className="grid three" style={{ marginTop: 8 }}>
                <Field label="表層" hint="見た目・題材。ここは捨てる">
                  <AutoText value={item.surface} rows={3} onChange={(v) => patch(item.id, { surface: v })} />
                </Field>
                <Field label="構造" hint="仕組み。何が快感を生んでいるのか">
                  <AutoText value={item.structure} rows={3} onChange={(v) => patch(item.id, { structure: v })} />
                </Field>
                <Field label="移植先" hint="この構造を別ジャンルに置くと何になるか">
                  <AutoText value={item.transplant} rows={3} onChange={(v) => patch(item.id, { transplant: v })} />
                </Field>
              </div>
            </div>
            <div className="col" style={{ gap: 4 }}>
              <button
                className="sm ghost"
                disabled={!item.transplant.trim()}
                onClick={() => addSeed(projectId, `[移植] ${item.transplant.trim()}`, 'transplant')}
              >
                種へ
              </button>
              <button
                className="sm ghost danger"
                onClick={() => save({ items: data.items.filter((i) => i.id !== item.id) })}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
