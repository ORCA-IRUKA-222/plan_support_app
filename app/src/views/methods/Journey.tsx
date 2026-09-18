import { useState } from 'react';
import { JOURNEY_CHECKPOINTS, JOURNEY_TIP } from '../../domain/knowledge';
import type { JourneyData, JourneyPoint } from '../../domain/types';
import type { AppSnapshot } from '../../store/store';
import { saveTool, selectTool } from '../../store/store';
import { uid } from '../../lib/id';
import { AutoInput, Card, Empty } from '../../components/ui';
import { EditorPanel, truncate } from '../../components/diagram';

type Track = 'session' | 'month';

const W = 900;
const H = 300;
const PAD_X = 46;
const PAD_Y = 34;
const MID = H / 2;

/** 体験の時間割。1回のセッションと1か月の2つの時間軸で感情の上下を描く。 */
export default function Journey({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const data = selectTool<JourneyData>(snapshot, projectId, 'journey');
  const save = (d: JourneyData) => saveTool(projectId, 'journey', d);
  const [sel, setSel] = useState<{ track: Track; id: string } | null>(null);

  const seed = (track: Track) => {
    const points: JourneyPoint[] = JOURNEY_CHECKPOINTS[track].map((c) => ({
      id: uid('jp'), at: c.at, event: '', emotion: 0,
    }));
    save({ ...data, [track]: points });
  };

  const setPoints = (track: Track, points: JourneyPoint[]) => save({ ...data, [track]: points });

  const selected = sel ? data[sel.track].find((p) => p.id === sel.id) ?? null : null;

  return (
    <>
      <Card title="体験の時間割" sub="1回のセッションと1か月。感情の上下を折れ線で描く">
        <p className="hint strong" style={{ marginBottom: 0 }}>{JOURNEY_TIP}</p>
      </Card>

      {(['session', 'month'] as const).map((track) => {
        const points = data[track];
        return (
          <Card
            key={track}
            title={track === 'session' ? '1回のセッション' : '1か月'}
            sub={track === 'session'
              ? '0分でここが面白い、3分で離脱しない'
              : '1週間後も遊ぶ理由、1か月後に何に課金するか'}
            actions={
              <>
                <button
                  className="sm"
                  onClick={() => setPoints(track, [...points, { id: uid('jp'), at: '', event: '', emotion: 0 }])}
                >
                  + 点を足す
                </button>
                {points.length === 0 && (
                  <button className="sm accent" onClick={() => seed(track)}>チェックポイントで埋める</button>
                )}
              </>
            }
          >
            {points.length === 0 ? (
              <Empty>{JOURNEY_CHECKPOINTS[track].map((c) => `${c.at}: ${c.q}`).join(' / ')}</Empty>
            ) : (
              <>
                <div className="dg-canvas">
                  <Chart
                    points={points}
                    selectedId={sel?.track === track ? sel.id : null}
                    onSelect={(id) => setSel({ track, id })}
                  />
                </div>
                <Flatness points={points} />
              </>
            )}
          </Card>
        );
      })}

      {sel && selected && (
        <EditorPanel
          title={selected.at ? `「${selected.at}」の体験` : 'この時点の体験'}
          sub={sel.track === 'session' ? '1回のセッション' : '1か月'}
          onClose={() => setSel(null)}
        >
          <div className="grid two">
            <label className="field">
              <span className="lbl">時点</span>
              <AutoInput
                value={selected.at}
                placeholder="0分 / 3分 / 1週間後 など"
                onChange={(v) =>
                  setPoints(sel.track, data[sel.track].map((p) => (p.id === selected.id ? { ...p, at: v } : p)))
                }
              />
            </label>
            <label className="field">
              <span className="lbl">何が起きて、何を面白いと思うか</span>
              <AutoInput
                value={selected.event}
                onChange={(v) =>
                  setPoints(sel.track, data[sel.track].map((p) => (p.id === selected.id ? { ...p, event: v } : p)))
                }
              />
            </label>
          </div>
          <div className="row tight" style={{ marginTop: 8 }}>
            <span className="tiny muted" style={{ minWidth: 34 }}>感情</span>
            <input
              type="range" min={-3} max={3} step={1}
              value={selected.emotion}
              style={{ flex: 1, minWidth: 140 }}
              aria-label="感情の高さ"
              onChange={(e) =>
                setPoints(sel.track, data[sel.track].map((p) =>
                  p.id === selected.id ? { ...p, emotion: Number(e.target.value) } : p,
                ))
              }
            />
            <span className="pill">{selected.emotion > 0 ? `+${selected.emotion}` : selected.emotion}</span>
            <button
              className="sm ghost danger"
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                setPoints(sel.track, data[sel.track].filter((p) => p.id !== selected.id));
                setSel(null);
              }}
            >
              この点を削除
            </button>
          </div>
        </EditorPanel>
      )}
    </>
  );
}

function Chart({ points, selectedId, onSelect }: {
  points: JourneyPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const n = Math.max(points.length - 1, 1);
  const x = (i: number) => PAD_X + (i * (W - PAD_X * 2)) / n;
  const y = (v: number) => MID - (v / 3) * (MID - PAD_Y);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.emotion).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${MID} L${x(0).toFixed(1)},${MID} Z`;

  return (
    <svg className="spark2" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="感情の折れ線">
      {[3, 2, 1, -1, -2, -3].map((v) => (
        <line key={v} className="grid" x1={PAD_X} y1={y(v)} x2={W - PAD_X} y2={y(v)} />
      ))}
      <line className="zero" x1={PAD_X} y1={MID} x2={W - PAD_X} y2={MID} />
      <text className="scale" x={PAD_X - 8} y={y(3) + 4} textAnchor="end">+3 最高</text>
      <text className="scale" x={PAD_X - 8} y={MID + 4} textAnchor="end">0</text>
      <text className="scale" x={PAD_X - 8} y={y(-3) + 4} textAnchor="end">-3 離脱</text>

      <path className="area" d={area} />
      <path className="curve" d={line} />

      {points.map((p, i) => (
        <g key={p.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(p.id)}>
          <title>{p.at}: {p.event || '（未記入）'}</title>
          {/* 指でも押しやすいよう、当たり判定を広く取る */}
          <circle cx={x(i)} cy={y(p.emotion)} r={18} fill="transparent" />
          <circle className={`dot${selectedId === p.id ? ' is-selected' : ''}`} cx={x(i)} cy={y(p.emotion)} r={7} />
          <text className="at" x={x(i)} y={H - 14} textAnchor="middle">{p.at || i + 1}</text>
          {p.event && (
            <text className="ev" x={x(i)} y={y(p.emotion) - 14} textAnchor="middle">
              {truncate(p.event, 12)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function Flatness({ points }: { points: JourneyPoint[] }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.emotion);
  const range = Math.max(...values) - Math.min(...values);
  const peak = points.reduce((a, b) => (b.emotion > a.emotion ? b : a));
  return (
    <p className={`hint${range <= 1 ? ' strong' : ''}`} style={{ marginTop: 10, marginBottom: 0 }}>
      振れ幅 {range}。
      {range <= 1
        ? ' この線は平坦です。要素は多くても山がない企画になっている可能性があります。'
        : ` 最高点は「${peak.at || '—'}${peak.event ? `: ${peak.event}` : ''}」。ここを企画書の冒頭に持ってきてください。`}
    </p>
  );
}
