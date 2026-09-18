import { useState } from 'react';
import { SCAMPER, SCAMPER_TIP } from '../../domain/knowledge';
import type { ScamperData } from '../../domain/types';
import type { AppSnapshot } from '../../store/store';
import { addSeed, saveTool, selectTool } from '../../store/store';
import { AutoInput, AutoText, Card } from '../../components/ui';
import { Box, Canvas, EditorPanel } from '../../components/diagram';

const W = 880;
const H = 560;
const CX = W / 2;
const CY = H / 2;
const R = 196;

const rad = (deg: number) => (deg * Math.PI) / 180;
const angleOf = (i: number) => -90 + i * (360 / SCAMPER.length);

/** SCAMPER / オズボーンのチェックリスト。既存タイトルの分析課題で特に有効。 */
export default function Scamper({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const data = selectTool<ScamperData>(snapshot, projectId, 'scamper');
  const save = (d: ScamperData) => saveTool(projectId, 'scamper', d);
  const [selected, setSelected] = useState<string>(SCAMPER[0].key);

  const op = SCAMPER.find((s) => s.key === selected) ?? SCAMPER[0];
  const value = data.items[op.key] ?? '';
  const filled = SCAMPER.filter((s) => (data.items[s.key] ?? '').trim()).length;

  return (
    <>
      <Card title="SCAMPER" sub={`既存物を7つの操作で改造する（${filled} / 7）`}>
        <label className="field" style={{ marginBottom: 10 }}>
          <span className="lbl">対象（既存タイトル・既存の仕組み）</span>
          <AutoInput
            value={data.subject}
            onChange={(v) => save({ ...data, subject: v })}
            placeholder="例: ◯◯（既存タイトル名）のコアループ"
          />
        </label>

        <Canvas viewBox={`0 0 ${W} ${H}`} minWidth={560} label="SCAMPER の7操作">
          {SCAMPER.map((s, i) => {
            const a = angleOf(i);
            const x = CX + Math.cos(rad(a)) * R;
            const y = CY + Math.sin(rad(a)) * R;
            return <line key={`l-${s.key}`} className="dg-link is-thin" x1={CX} y1={CY} x2={x} y2={y} />;
          })}

          <circle className="dg-center-bg" cx={CX} cy={CY} r={78} />
          {data.subject.trim() ? (
            splitCenter(data.subject).map((line, i, arr) => (
              <text
                key={i} className="dg-center-text" x={CX}
                y={CY + 5 + (i - (arr.length - 1) / 2) * 17} textAnchor="middle"
              >
                {line}
              </text>
            ))
          ) : (
            <text className="dg-center-empty" x={CX} y={CY + 4} textAnchor="middle">対象を入力</text>
          )}

          {SCAMPER.map((s, i) => {
            const a = angleOf(i);
            const x = CX + Math.cos(rad(a)) * R;
            const y = CY + Math.sin(rad(a)) * R;
            const strong = s.key === 'e' || s.key === 'r';
            const written = (data.items[s.key] ?? '').trim();
            return (
              <Box
                key={s.key}
                x={x} y={y} w={150} h={52}
                label={s.name}
                text={s.ja}
                selected={selected === s.key}
                accent={strong}
                badge={written ? '✔' : undefined}
                perLine={6} maxLines={1}
                title={`${s.name}（${s.ja}）— ${s.q}`}
                onClick={() => setSelected(s.key)}
              />
            );
          })}

          <text className="dg-caption" x={CX} y={H - 8} textAnchor="middle">
            オレンジの2つ（Eliminate / Reverse）が最も企画らしい変化を生む
          </text>
        </Canvas>

        <p className="hint strong" style={{ marginTop: 10, marginBottom: 0 }}>{SCAMPER_TIP}</p>
      </Card>

      <EditorPanel title={`${op.name}（${op.ja}）`} sub={op.q}>
        <AutoText
          value={value}
          rows={4}
          onChange={(v) => save({ ...data, items: { ...data.items, [op.key]: v } })}
        />
        <div className="row tight" style={{ marginTop: 8 }}>
          <button
            className="sm accent"
            disabled={!value.trim()}
            onClick={() => addSeed(projectId, `[SCAMPER/${op.ja}] ${value.trim()}`, null)}
          >
            種へ送る
          </button>
          {SCAMPER.map((s) => (
            <button key={s.key} className="chip" aria-pressed={selected === s.key} onClick={() => setSelected(s.key)}>
              {s.ja}
            </button>
          ))}
        </div>
      </EditorPanel>
    </>
  );
}

function splitCenter(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  const per = 8;
  const lines: string[] = [];
  for (let i = 0; i < clean.length && lines.length < 4; i += per) lines.push(clean.slice(i, i + per));
  if (clean.length > per * 4) lines[3] = `${lines[3]!.slice(0, per - 1)}…`;
  return lines;
}
