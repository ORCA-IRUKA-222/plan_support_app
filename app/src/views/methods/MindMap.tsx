import { MIND_AXES, MIND_TIPS } from '../../domain/knowledge';
import type { AppSnapshot } from '../../store/store';
import type { MindMapData, MindNode } from '../../domain/types';
import { saveTool, selectTool } from '../../store/store';
import { uid } from '../../lib/id';
import { AutoInput, Card, QuickAdd } from '../../components/ui';

/**
 * マインドマップ。第1階層は8軸に固定する。
 * 自由に枝を伸ばすより、この8軸を埋めるほうがゲーム企画では機能する。
 */
export default function MindMap({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const data = selectTool<MindMapData>(snapshot, projectId, 'mindmap');
  const save = (d: MindMapData) => saveTool(projectId, 'mindmap', d);

  const axisNodes = (axis: string): MindNode[] => data.axes[axis] ?? [];

  const setAxis = (axis: string, nodes: MindNode[]) =>
    save({ ...data, axes: { ...data.axes, [axis]: nodes } });

  const allNodes = MIND_AXES.flatMap((a) =>
    axisNodes(a.id).map((n) => ({ ...n, axisName: a.name })),
  );
  const emptyAxes = MIND_AXES.filter((a) => axisNodes(a.id).length === 0);
  const shallowAxes = MIND_AXES.filter(
    (a) => axisNodes(a.id).length > 0 && axisNodes(a.id).every((n) => n.children.length === 0),
  );

  return (
    <>
      <Card title="マインドマップ（第1階層 固定8軸）" sub="埋まらない枝が本当の弱点">
        <label className="field" style={{ marginBottom: 10 }}>
          <span className="lbl">中心に置く種</span>
          <AutoInput value={data.seed} onChange={(v) => save({ ...data, seed: v })} placeholder="核の一行、または検討中の種" />
        </label>
        <ul className="tiny muted" style={{ margin: 0, paddingLeft: 18 }}>
          {MIND_TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>
        {(emptyAxes.length > 0 || shallowAxes.length > 0) && (
          <p className="hint strong" style={{ marginTop: 10, marginBottom: 0 }}>
            {emptyAxes.length > 0 && <>未着手の枝: <b>{emptyAxes.map((a) => a.name).join('、')}</b>。ここが企画の弱点です。<br /></>}
            {shallowAxes.length > 0 && <>第2階層がない枝: {shallowAxes.map((a) => a.name).join('、')}。項目表のままです。</>}
          </p>
        )}
      </Card>

      <div className="grid two" style={{ marginTop: 14 }}>
        {MIND_AXES.map((axis) => {
          const nodes = axisNodes(axis.id);
          return (
            <div key={axis.id} className={`axis${nodes.length === 0 ? ' empty-axis' : ''}`}>
              <h3>
                {axis.name}
                <span className="pill">{nodes.length}</span>
              </h3>
              <div className="axis-hint">{axis.hint}</div>

              {nodes.map((node) => (
                <div key={node.id} className="branch">
                  <div className="row tight">
                    <AutoInput
                      value={node.text}
                      onChange={(v) =>
                        setAxis(axis.id, nodes.map((n) => (n.id === node.id ? { ...n, text: v } : n)))
                      }
                    />
                    <button
                      className="ghost sm danger"
                      onClick={() => setAxis(axis.id, nodes.filter((n) => n.id !== node.id))}
                      aria-label="この枝を削除"
                    >
                      ×
                    </button>
                  </div>

                  {node.children.map((child) => (
                    <div key={child.id} className="leaf">
                      <span aria-hidden="true">└</span>
                      <AutoInput
                        value={child.text}
                        onChange={(v) =>
                          setAxis(axis.id, nodes.map((n) =>
                            n.id === node.id
                              ? { ...n, children: n.children.map((c) => (c.id === child.id ? { ...c, text: v } : c)) }
                              : n,
                          ))
                        }
                      />
                      <button
                        className="ghost sm danger"
                        onClick={() =>
                          setAxis(axis.id, nodes.map((n) =>
                            n.id === node.id ? { ...n, children: n.children.filter((c) => c.id !== child.id) } : n,
                          ))
                        }
                        aria-label="削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <div className="row tight" style={{ marginTop: 4 }}>
                    <button
                      className="ghost sm"
                      onClick={() =>
                        setAxis(axis.id, nodes.map((n) =>
                          n.id === node.id ? { ...n, children: [...n.children, { id: uid('leaf'), text: '' }] } : n,
                        ))
                      }
                    >
                      + 第2階層
                    </button>
                    <LinkPicker
                      node={node}
                      candidates={allNodes.filter((n) => n.id !== node.id)}
                      onChange={(links) =>
                        setAxis(axis.id, nodes.map((n) => (n.id === node.id ? { ...n, links } : n)))
                      }
                    />
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 8 }}>
                <QuickAdd
                  placeholder="枝を足す"
                  cta="+"
                  onAdd={(t) => setAxis(axis.id, [...nodes, { id: uid('mn'), text: t, links: [], children: [] }])}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** 枝から枝への線。「操作」と「収益」が繋がると強い企画になる。 */
function LinkPicker({ node, candidates, onChange }: {
  node: MindNode;
  candidates: (MindNode & { axisName: string })[];
  onChange: (links: string[]) => void;
}) {
  const linked = candidates.filter((c) => node.links.includes(c.id));
  return (
    <>
      <select
        value=""
        aria-label="他の枝とつなぐ"
        style={{ width: 'auto', maxWidth: 170, fontSize: 12, padding: '2px 6px' }}
        onChange={(e) => {
          if (!e.target.value) return;
          onChange([...new Set([...node.links, e.target.value])]);
        }}
      >
        <option value="">⇄ つなぐ…</option>
        {candidates.filter((c) => c.text.trim() && !node.links.includes(c.id)).map((c) => (
          <option key={c.id} value={c.id}>{c.axisName}: {c.text.slice(0, 18)}</option>
        ))}
      </select>
      {linked.map((c) => (
        <button
          key={c.id}
          className="chip accent"
          title="クリックで解除"
          onClick={() => onChange(node.links.filter((id) => id !== c.id))}
        >
          ⇄ {c.axisName}: {c.text.slice(0, 12)}
        </button>
      ))}
    </>
  );
}
