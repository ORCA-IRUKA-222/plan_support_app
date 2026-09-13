import { CTPT, SIX_W2H, SWOT, THREE_C, THREE_C_TIP } from '../domain/knowledge';
import type { CtptData, SixW2HData, SwotData, ThreeCData } from '../domain/types';
import type { AppSnapshot } from '../store/store';
import { saveTool, selectTool } from '../store/store';
import { AutoText, Card, Field } from '../components/ui';

/**
 * 企画書作成に活用できるフレームワーク。
 * 3C は事実のみを集め、解釈は SWOT で行う。6W2H と CTPT は施策の言語化に使う。
 */
export default function Frameworks({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const threec = selectTool<ThreeCData>(snapshot, projectId, 'threec');
  const swot = selectTool<SwotData>(snapshot, projectId, 'swot');
  const sixw2h = selectTool<SixW2HData>(snapshot, projectId, 'sixw2h');
  const ctpt = selectTool<CtptData>(snapshot, projectId, 'ctpt');

  return (
    <>
      <Card title="3C分析" sub="現状分析。客観的でバランスのとれた事実を集める">
        <p className="hint strong">{THREE_C_TIP}</p>
        <div className="grid three">
          {THREE_C.map((c) => (
            <Field key={c.key} label={c.name} hint={c.hint}>
              <AutoText
                value={threec[c.key]}
                rows={5}
                onChange={(v) => saveTool(projectId, 'threec', { ...threec, [c.key]: v })}
              />
            </Field>
          ))}
        </div>
        <Field label="→ 導かれる課題" hint="この課題を解決する手段が「施策の詳細」につながります">
          <AutoText value={threec.issue} rows={3} onChange={(v) => saveTool(projectId, 'threec', { ...threec, issue: v })} />
        </Field>
      </Card>

      <Card title="SWOT分析" sub="3Cで集めた事実を解釈する">
        <div className="grid two">
          {SWOT.map((s) => (
            <Field key={s.key} label={s.name} hint={s.hint}>
              <AutoText
                value={swot[s.key]}
                rows={4}
                onChange={(v) => saveTool(projectId, 'swot', { ...swot, [s.key]: v })}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="6W2H" sub="8項目に従って整理するだけで、事実を正確に伝えられる">
        <div className="grid two">
          {SIX_W2H.map((w) => (
            <Field key={w.key} label={w.name} hint={w.hint}>
              <AutoText
                value={sixw2h[w.key]}
                rows={3}
                onChange={(v) => saveTool(projectId, 'sixw2h', { ...sixw2h, [w.key]: v })}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="CTPT" sub="具体的なアクションプランをわかりやすく示す軸">
        <div className="grid two">
          {CTPT.map((c) => (
            <Field key={c.key} label={c.name} hint={c.hint}>
              <AutoText
                value={ctpt[c.key]}
                rows={3}
                onChange={(v) => saveTool(projectId, 'ctpt', { ...ctpt, [c.key]: v })}
              />
            </Field>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          「CTPT」を軸に企画書を作ると、読み手の興味を喚起するために不可欠なストーリー性が生まれます。
        </p>
      </Card>
    </>
  );
}
