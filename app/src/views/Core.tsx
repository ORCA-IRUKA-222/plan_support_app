import { useState } from 'react';
import { JUDGES } from '../domain/knowledge';
import type { CoreData, Score } from '../domain/types';
import type { GateContext } from '../domain/gates';
import type { RouteId } from '../routes';
import { saveCore } from '../store/store';
import { AutoText, Card, Empty, QuickAdd } from '../components/ui';

/**
 * 段階2「核を決める」。
 * ここを飛ばすと後半で書いた要素が前半と矛盾して「機能の羅列」になる。
 */
export default function Core({ ctx, go }: { ctx: GateContext; go: (r: RouteId) => void }) {
  const { project, core, seeds } = ctx;
  const [showSeeds, setShowSeeds] = useState(false);
  const patch = (p: Partial<CoreData>) => saveCore(project.id, { ...core, ...p });

  const len = core.oneLiner.trim().length;
  const lenState = len === 0 ? '' : len <= 60 ? 'ok' : 'danger';

  return (
    <>
      <Card
        title="核の一行"
        sub="一文で言えて、聞いた人が絵を想像できるか"
        actions={
          <button className="sm" onClick={() => setShowSeeds((v) => !v)}>
            {showSeeds ? '種を隠す' : '★の種から選ぶ'}
          </button>
        }
      >
        <AutoText
          value={core.oneLiner}
          rows={2}
          placeholder="例: 操作させないアクションゲーム。プレイヤーは「見送る」ことでしか進めない。"
          onChange={(v) => patch({ oneLiner: v })}
        />
        <div className="row tight" style={{ marginTop: 6 }}>
          <span className={`pill ${lenState}`}>{len} 字</span>
          <span className="tiny muted">60字以内を目安に。言えないものは核が2つ以上あります。</span>
        </div>

        {showSeeds && (
          <div className="list" style={{ marginTop: 12 }}>
            {seeds.filter((s) => s.starred).length === 0 && <Empty>★を付けた種がありません。</Empty>}
            {seeds.filter((s) => s.starred).map((s) => (
              <div key={s.id} className="item">
                <div className="body">{s.text}</div>
                <button className="sm" onClick={() => patch({ oneLiner: s.text })}>核にする</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="3層モデル" sub="核 / 骨格 / 演出 を分けて書くと、後から足した要素で核がぼやけない">
        <div className="grid three">
          <label className="field">
            <span className="lbl">核</span>
            <span className="tiny muted">これを失うと企画が別物になるもの</span>
            <AutoText value={core.core} rows={5} onChange={(v) => patch({ core: v })} />
          </label>
          <label className="field">
            <span className="lbl">骨格</span>
            <span className="tiny muted">核を成立させる仕組み（ルール・ループ・構造）</span>
            <AutoText value={core.structure} rows={5} onChange={(v) => patch({ structure: v })} />
          </label>
          <label className="field">
            <span className="lbl">演出</span>
            <span className="tiny muted">題材・世界観・見た目。差し替え可能なもの</span>
            <AutoText value={core.staging} rows={5} onChange={(v) => patch({ staging: v })} />
          </label>
        </div>
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          迷ったら「演出」を消してみる。それでも面白ければ核は生きています。
        </p>
      </Card>

      <Card title="良い種かどうかの4判定" sub="4つすべてが3以上でゲート通過">
        <div className="list">
          {JUDGES.map((j) => {
            const v = core.judge[j.key];
            return (
              <div key={j.key} className="item">
                <div className="body">
                  <b style={{ fontSize: 13.5 }}>{j.name}</b>
                  <div className="tiny muted">{j.desc}</div>
                </div>
                <div className="row tight">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      className="chip"
                      aria-pressed={v >= n}
                      onClick={() => patch({ judge: { ...core.judge, [j.key]: (v === n ? 0 : n) as Score } })}
                      aria-label={`${j.name} ${n}点`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="人に話した反応"
        sub="「なるほど」ではなく「それどうなるの?」と聞き返されたか"
      >
        <QuickAdd
          placeholder="誰に話して、どう返ってきたか（例: 田中「それ最後どうなるの?」）"
          cta="記録"
          onAdd={(t) => patch({ reactions: [...core.reactions, t] })}
        />
        <div className="list" style={{ marginTop: 10 }}>
          {core.reactions.length === 0 && <Empty>まだ誰にも話していません。反応の質が4判定のうち1つです。</Empty>}
          {core.reactions.map((r, i) => (
            <div key={`${i}-${r}`} className="item">
              <div className="body">{r}</div>
              <button
                className="ghost sm danger"
                onClick={() => patch({ reactions: core.reactions.filter((_, j) => j !== i) })}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </Card>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="accent" onClick={() => go('skeleton')}>骨格の検証へ進む</button>
        <button onClick={() => go('methods')}>核が決まらない → 思考ツールへ</button>
      </div>
    </>
  );
}
