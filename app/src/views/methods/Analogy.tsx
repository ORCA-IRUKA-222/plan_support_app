import type { AnalogyData } from '../../domain/types';
import type { AppSnapshot } from '../../store/store';
import { addSeed, saveTool, selectTool } from '../../store/store';
import { uid } from '../../lib/id';
import { AutoText, Card, Empty, QuickAdd } from '../../components/ui';

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

      <div style={{ marginTop: 14 }}>
        {data.items.length === 0 && <Empty>まだありません。まず自分が好きな体験を1つ書いてください。</Empty>}
        {data.items.map((item) => (
          <div key={item.id} className="card" style={{ marginBottom: 12 }}>
            <div className="row" style={{ marginBottom: 10 }}>
              <b style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{item.origin}</b>
              <button
                className="sm ghost danger"
                style={{ marginLeft: 'auto' }}
                onClick={() => save({ items: data.items.filter((i) => i.id !== item.id) })}
              >
                削除
              </button>
            </div>

            <div className="transplant">
              <div className="cell drop">
                <div className="tiny muted">表層 — ここは捨てる</div>
                <AutoText
                  value={item.surface}
                  rows={4}
                  placeholder="見た目・題材・世界観"
                  onChange={(v) => patch(item.id, { surface: v })}
                />
              </div>
              <div className="op" aria-hidden="true">捨てる →</div>
              <div className="cell keep">
                <div className="tiny muted">構造 — これだけ抜き出す</div>
                <AutoText
                  value={item.structure}
                  rows={4}
                  placeholder="何が快感を生んでいる仕組みか"
                  onChange={(v) => patch(item.id, { structure: v })}
                />
              </div>
              <div className="op" aria-hidden="true">移植 →</div>
              <div className="cell out">
                <div className="tiny muted">移植先 — 新しい企画</div>
                <AutoText
                  value={item.transplant}
                  rows={4}
                  placeholder="この構造を別ジャンルに置くと何になるか"
                  onChange={(v) => patch(item.id, { transplant: v })}
                />
              </div>
            </div>

            <div className="row tight" style={{ marginTop: 8 }}>
              <button
                className="sm accent"
                disabled={!item.transplant.trim()}
                onClick={() => addSeed(projectId, `[移植] ${item.transplant.trim()}`, 'transplant')}
              >
                種へ送る
              </button>
              {item.surface.trim() && !item.structure.trim() && (
                <span className="tiny muted">表層だけでは模倣になります。構造を書き出してください。</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
