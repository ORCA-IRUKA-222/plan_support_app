import { useMemo, useState } from 'react';
import { MIND_AXES, MIND_TIPS } from '../../domain/knowledge';
import type { AppSnapshot } from '../../store/store';
import type { MindMapData, MindNode } from '../../domain/types';
import { saveTool, selectTool } from '../../store/store';
import { uid } from '../../lib/id';
import { AutoInput, Card, Empty, QuickAdd } from '../../components/ui';
import { Box, Canvas, EditorPanel, curvePath, truncate } from '../../components/diagram';

const W = 1020;
const H = 780;
const CX = W / 2;
const CY = H / 2;
const R_AXIS = 212;   // 第1階層（8軸）までの距離
const R_NODE = 330;   // 第2階層までの距離
const FAN = 30;       // 第2階層を広げる角度（度）

const rad = (deg: number) => (deg * Math.PI) / 180;
/** 真上から時計回りに配置する。 */
const angleOf = (i: number) => -90 + i * (360 / MIND_AXES.length);
const pointAt = (deg: number, r: number) => ({ x: CX + Math.cos(rad(deg)) * r, y: CY + Math.sin(rad(deg)) * r });

interface Placed {
  id: string;
  x: number;
  y: number;
  axisId: string;
  text: string;
}

/**
 * マインドマップ。第1階層は8軸に固定する。
 * 自由に枝を伸ばすより、この8軸を埋めるほうがゲーム企画では機能する。
 */
export default function MindMap({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const data = selectTool<MindMapData>(snapshot, projectId, 'mindmap');
  const save = (d: MindMapData) => saveTool(projectId, 'mindmap', d);
  const [selected, setSelected] = useState<string>(MIND_AXES[0].id);

  const nodesOf = (axisId: string): MindNode[] => data.axes[axisId] ?? [];
  const setAxis = (axisId: string, nodes: MindNode[]) =>
    save({ ...data, axes: { ...data.axes, [axisId]: nodes } });

  /** 第2階層ノードの座標。リンク線を引くために一度にすべて求める。 */
  const placed = useMemo<Map<string, Placed>>(() => {
    const map = new Map<string, Placed>();
    MIND_AXES.forEach((axis, ai) => {
      const nodes = data.axes[axis.id] ?? [];
      const base = angleOf(ai);
      nodes.forEach((n, ni) => {
        const spread = nodes.length === 1 ? 0 : (ni / (nodes.length - 1) - 0.5) * 2 * FAN;
        const p = pointAt(base + spread, R_NODE);
        map.set(n.id, { id: n.id, x: p.x, y: p.y, axisId: axis.id, text: n.text });
      });
    });
    return map;
  }, [data.axes]);

  const emptyAxes = MIND_AXES.filter((a) => nodesOf(a.id).length === 0);
  const shallowAxes = MIND_AXES.filter(
    (a) => nodesOf(a.id).length > 0 && nodesOf(a.id).every((n) => n.children.length === 0),
  );

  const crossLinks = useMemo(() => {
    const out: { from: Placed; to: Placed; key: string }[] = [];
    // リンクは片側にしか保存されないので、向きに関係なく組で重複を除く。
    // 「ID の小さい側からだけ描く」とすると、大きい側に保存された線が消えてしまう。
    const seen = new Set<string>();
    for (const [, node] of placed) {
      const src = data.axes[node.axisId]?.find((n) => n.id === node.id);
      for (const targetId of src?.links ?? []) {
        const to = placed.get(targetId);
        if (!to) continue;
        const key = [node.id, targetId].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ from: node, to, key });
      }
    }
    return out;
  }, [placed, data.axes]);

  const selectedAxis = MIND_AXES.find((a) => a.id === selected) ?? MIND_AXES[0];
  const selectedNodes = nodesOf(selectedAxis.id);

  return (
    <>
      <Card title="マインドマップ（第1階層 固定8軸）" sub="埋まらない枝が本当の弱点">
        <label className="field" style={{ marginBottom: 10 }}>
          <span className="lbl">中心に置く種</span>
          <AutoInput
            value={data.seed}
            onChange={(v) => save({ ...data, seed: v })}
            placeholder="核の一行、または検討中の種"
          />
        </label>

        <Canvas viewBox={`0 0 ${W} ${H}`} minWidth={680} label="マインドマップ">
          {/* 中心 → 軸 の線 */}
          {MIND_AXES.map((axis, i) => {
            const p = pointAt(angleOf(i), R_AXIS);
            return (
              <line
                key={`spoke-${axis.id}`}
                className={`dg-link${nodesOf(axis.id).length === 0 ? ' is-muted' : ''}`}
                x1={CX} y1={CY} x2={p.x} y2={p.y}
              />
            );
          })}

          {/* 軸 → 第2階層 の線 */}
          {MIND_AXES.map((axis, i) => {
            const a = pointAt(angleOf(i), R_AXIS);
            return nodesOf(axis.id).map((n) => {
              const p = placed.get(n.id);
              if (!p) return null;
              return (
                <line key={`branch-${n.id}`} className="dg-link is-thin" x1={a.x} y1={a.y} x2={p.x} y2={p.y} />
              );
            });
          })}

          {/* 枝から枝への線。ここがつながると強い企画になる。 */}
          {crossLinks.map(({ from, to, key }) => (
            <path key={key} className="dg-link is-cross" d={curvePath(from.x, from.y, to.x, to.y, 0.18)} />
          ))}

          {/* 中心 */}
          <g>
            <circle className="dg-center-bg" cx={CX} cy={CY} r={72} />
            {data.seed.trim()
              ? wrapCenter(data.seed).map((line, i, arr) => (
                  <text
                    key={i} className="dg-center-text" x={CX}
                    y={CY + 5 + (i - (arr.length - 1) / 2) * 17} textAnchor="middle"
                  >
                    {line}
                  </text>
                ))
              : <text className="dg-center-empty" x={CX} y={CY + 4} textAnchor="middle">種を入力</text>}
          </g>

          {/* 第1階層（8軸） */}
          {MIND_AXES.map((axis, i) => {
            const p = pointAt(angleOf(i), R_AXIS);
            const n = nodesOf(axis.id).length;
            return (
              <Box
                key={axis.id}
                x={p.x} y={p.y} w={132} h={46}
                text={axis.name}
                selected={selected === axis.id}
                warn={n === 0}
                badge={n || undefined}
                perLine={8} maxLines={1}
                title={`${axis.name} — ${axis.hint}`}
                onClick={() => setSelected(axis.id)}
              />
            );
          })}

          {/* 第2階層 */}
          {[...placed.values()].map((p) => {
            const node = data.axes[p.axisId]?.find((n) => n.id === p.id);
            return (
              <Box
                key={p.id}
                x={p.x} y={p.y} w={136} h={40}
                text={p.text || '（未記入）'}
                accent={(node?.links.length ?? 0) > 0}
                badge={node?.children.length || undefined}
                perLine={9} maxLines={2}
                title={p.text}
                onClick={() => setSelected(p.axisId)}
              />
            );
          })}
        </Canvas>

        <ul className="tiny muted" style={{ margin: '10px 0 0', paddingLeft: 18 }}>
          {MIND_TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>

        {(emptyAxes.length > 0 || shallowAxes.length > 0) && (
          <p className="hint strong" style={{ marginTop: 10, marginBottom: 0 }}>
            {emptyAxes.length > 0 && (
              <>手つかずの枝: <b>{emptyAxes.map((a) => a.name).join('、')}</b>。ここが企画の弱点です。<br /></>
            )}
            {shallowAxes.length > 0 && (
              <>まだ浅い枝: {shallowAxes.map((a) => a.name).join('、')}。もう一段掘ると具体になります。</>
            )}
          </p>
        )}
      </Card>

      <EditorPanel
        title={`${selectedAxis.name} を書く`}
        sub={selectedAxis.hint}
      >
        <QuickAdd
          placeholder={`${selectedAxis.name} の枝を足す`}
          cta="枝を足す"
          onAdd={(t) =>
            setAxis(selectedAxis.id, [...selectedNodes, { id: uid('mn'), text: t, links: [], children: [] }])
          }
        />

        <div className="list" style={{ marginTop: 10 }}>
          {selectedNodes.length === 0 && (
            <Empty>この枝はまだ空です。第1階層だけだと項目表になり、発想が広がりません。</Empty>
          )}
          {selectedNodes.map((node) => (
            <div key={node.id} className="item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 7 }}>
              <div className="row tight">
                <AutoInput
                  value={node.text}
                  onChange={(v) =>
                    setAxis(selectedAxis.id, selectedNodes.map((n) => (n.id === node.id ? { ...n, text: v } : n)))
                  }
                />
                <button
                  className="ghost sm danger"
                  onClick={() => setAxis(selectedAxis.id, selectedNodes.filter((n) => n.id !== node.id))}
                  aria-label="この枝を削除"
                >
                  ×
                </button>
              </div>

              {node.children.map((child) => (
                <div key={child.id} className="row tight" style={{ paddingLeft: 16 }}>
                  <span className="muted" aria-hidden="true">└</span>
                  <AutoInput
                    value={child.text}
                    onChange={(v) =>
                      setAxis(selectedAxis.id, selectedNodes.map((n) =>
                        n.id === node.id
                          ? { ...n, children: n.children.map((c) => (c.id === child.id ? { ...c, text: v } : c)) }
                          : n,
                      ))
                    }
                  />
                  <button
                    className="ghost sm danger"
                    onClick={() =>
                      setAxis(selectedAxis.id, selectedNodes.map((n) =>
                        n.id === node.id ? { ...n, children: n.children.filter((c) => c.id !== child.id) } : n,
                      ))
                    }
                    aria-label="削除"
                  >
                    ×
                  </button>
                </div>
              ))}

              <div className="row tight">
                <button
                  className="ghost sm"
                  onClick={() =>
                    setAxis(selectedAxis.id, selectedNodes.map((n) =>
                      n.id === node.id ? { ...n, children: [...n.children, { id: uid('leaf'), text: '' }] } : n,
                    ))
                  }
                >
                  + もう一段掘る
                </button>
                <LinkPicker
                  node={node}
                  candidates={[...placed.values()].filter((p) => p.id !== node.id && p.text.trim())}
                  onChange={(links) =>
                    setAxis(selectedAxis.id, selectedNodes.map((n) => (n.id === node.id ? { ...n, links } : n)))
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </EditorPanel>
    </>
  );
}

function wrapCenter(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  const per = 8;
  const lines: string[] = [];
  for (let i = 0; i < clean.length && lines.length < 4; i += per) lines.push(clean.slice(i, i + per));
  if (clean.length > per * 4) lines[3] = `${lines[3]!.slice(0, per - 1)}…`;
  return lines;
}

/** 枝から枝への線。「操作」と「収益」がつながると強い企画になる。 */
function LinkPicker({ node, candidates, onChange }: {
  node: MindNode;
  candidates: Placed[];
  onChange: (links: string[]) => void;
}) {
  const axisName = (id: string) => MIND_AXES.find((a) => a.id === id)?.name ?? '';
  const linked = candidates.filter((c) => node.links.includes(c.id));
  return (
    <>
      <select
        value=""
        aria-label="他の枝とつなぐ"
        style={{ width: 'auto', maxWidth: 190, fontSize: 12, padding: '2px 6px' }}
        onChange={(e) => { if (e.target.value) onChange([...new Set([...node.links, e.target.value])]); }}
      >
        <option value="">⇄ 他の枝とつなぐ…</option>
        {candidates.filter((c) => !node.links.includes(c.id)).map((c) => (
          <option key={c.id} value={c.id}>{axisName(c.axisId)}: {truncate(c.text, 16)}</option>
        ))}
      </select>
      {linked.map((c) => (
        <button
          key={c.id}
          className="chip accent"
          title="クリックで解除"
          onClick={() => onChange(node.links.filter((id) => id !== c.id))}
        >
          ⇄ {axisName(c.axisId)}: {truncate(c.text, 10)}
        </button>
      ))}
    </>
  );
}
