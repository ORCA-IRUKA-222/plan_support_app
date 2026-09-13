import { JOURNEY_CHECKPOINTS, JOURNEY_TIP } from '../../domain/knowledge';
import type { JourneyData, JourneyPoint } from '../../domain/types';
import type { AppSnapshot } from '../../store/store';
import { saveTool, selectTool } from '../../store/store';
import { uid } from '../../lib/id';
import { AutoInput, Card, Empty } from '../../components/ui';

type Track = 'session' | 'month';

/** 体験の時間割。1回のセッションと1か月の2つの時間軸で感情の上下を描く。 */
export default function Journey({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const data = selectTool<JourneyData>(snapshot, projectId, 'journey');
  const save = (d: JourneyData) => saveTool(projectId, 'journey', d);

  const seed = (track: Track) => {
    const points: JourneyPoint[] = JOURNEY_CHECKPOINTS[track].map((c) => ({
      id: uid('jp'), at: c.at, event: '', emotion: 0,
    }));
    save({ ...data, [track]: points });
  };

  return (
    <>
      <Card title="体験の時間割" sub="1回のセッションと1か月。感情の上下を折れ線で描く">
        <p className="hint strong">{JOURNEY_TIP}</p>
      </Card>

      {(['session', 'month'] as const).map((track) => {
        const points = data[track];
        return (
          <Card
            key={track}
            title={track === 'session' ? '1回のセッション' : '1か月'}
            sub={track === 'session' ? '0分でここが面白い、3分で離脱しない' : '1週間後も遊ぶ理由、1か月後に何に課金するか'}
            actions={
              <>
                <button className="sm" onClick={() => save({ ...data, [track]: [...points, { id: uid('jp'), at: '', event: '', emotion: 0 }] })}>
                  + 点を足す
                </button>
                {points.length === 0 && (
                  <button className="sm accent" onClick={() => seed(track)}>チェックポイントで埋める</button>
                )}
              </>
            }
          >
            {points.length === 0 ? (
              <Empty>
                {JOURNEY_CHECKPOINTS[track].map((c) => `${c.at}: ${c.q}`).join(' / ')}
              </Empty>
            ) : (
              <>
                <Spark points={points} />
                <div className="list" style={{ marginTop: 10 }}>
                  {points.map((p, i) => (
                    <div key={p.id} className="item">
                      <div style={{ width: 84, flex: '0 0 84px' }}>
                        <AutoInput
                          value={p.at}
                          placeholder={JOURNEY_CHECKPOINTS[track][i]?.at ?? '時点'}
                          onChange={(v) => save({ ...data, [track]: points.map((x) => (x.id === p.id ? { ...x, at: v } : x)) })}
                        />
                      </div>
                      <div className="body">
                        <AutoInput
                          value={p.event}
                          placeholder={JOURNEY_CHECKPOINTS[track][i]?.q ?? '何が起きて、何を面白いと思うか'}
                          onChange={(v) => save({ ...data, [track]: points.map((x) => (x.id === p.id ? { ...x, event: v } : x)) })}
                        />
                        <div className="row tight" style={{ marginTop: 5 }}>
                          <span className="tiny muted">感情</span>
                          <input
                            type="range"
                            min={-3}
                            max={3}
                            step={1}
                            value={p.emotion}
                            style={{ flex: 1, minWidth: 110 }}
                            onChange={(e) =>
                              save({ ...data, [track]: points.map((x) => (x.id === p.id ? { ...x, emotion: Number(e.target.value) } : x)) })
                            }
                            aria-label="感情の高さ"
                          />
                          <span className="pill">{p.emotion > 0 ? `+${p.emotion}` : p.emotion}</span>
                        </div>
                      </div>
                      <button
                        className="ghost sm danger"
                        onClick={() => save({ ...data, [track]: points.filter((x) => x.id !== p.id) })}
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
                <Flatness points={points} />
              </>
            )}
          </Card>
        );
      })}
    </>
  );
}

function Spark({ points }: { points: JourneyPoint[] }) {
  const W = 600, H = 132, PAD = 18;
  const n = Math.max(points.length - 1, 1);
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / n;
  // emotion -3..3 を上下反転して y に写す。
  const y = (v: number) => H / 2 - (v / 3) * (H / 2 - PAD);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.emotion).toFixed(1)}`).join(' ');

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="感情の折れ線">
      <line className="axis-line" x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} />
      <path className="curve" d={d} />
      {points.map((p, i) => (
        <g key={p.id}>
          <circle className="dot" cx={x(i)} cy={y(p.emotion)} r={4} />
          <text className="lbl" x={x(i)} y={H - 4} textAnchor="middle">{p.at || i + 1}</text>
        </g>
      ))}
    </svg>
  );
}

function Flatness({ points }: { points: JourneyPoint[] }) {
  const values = points.map((p) => p.emotion);
  const range = Math.max(...values) - Math.min(...values);
  if (points.length < 2) return null;
  return (
    <p className={`hint${range <= 1 ? ' strong' : ''}`} style={{ marginTop: 10, marginBottom: 0 }}>
      振れ幅 {range}。
      {range <= 1
        ? ' この線は平坦です。要素は多くても山がない企画になっている可能性があります。'
        : ' 山ができています。どこが最高点かを企画書の冒頭に持ってきてください。'}
    </p>
  );
}
