import { SCAMPER, SCAMPER_TIP } from '../../domain/knowledge';
import type { ScamperData } from '../../domain/types';
import type { AppSnapshot } from '../../store/store';
import { addSeed, saveTool, selectTool } from '../../store/store';
import { AutoInput, AutoText, Card } from '../../components/ui';

/** SCAMPER / オズボーンのチェックリスト。既存タイトルの分析課題で特に有効。 */
export default function Scamper({ projectId, snapshot }: { projectId: string; snapshot: AppSnapshot }) {
  const data = selectTool<ScamperData>(snapshot, projectId, 'scamper');
  const save = (d: ScamperData) => saveTool(projectId, 'scamper', d);

  return (
    <Card title="SCAMPER" sub="既存物を7つの操作で改造する">
      <label className="field" style={{ marginBottom: 12 }}>
        <span className="lbl">対象（既存タイトル・既存の仕組み）</span>
        <AutoInput value={data.subject} onChange={(v) => save({ ...data, subject: v })} placeholder="例: ◯◯（既存タイトル名）のコアループ" />
      </label>

      <p className="hint strong">{SCAMPER_TIP}</p>

      <div className="list">
        {SCAMPER.map((s) => {
          const strong = s.key === 'e' || s.key === 'r';
          const value = data.items[s.key] ?? '';
          return (
            <div key={s.key} className="item" style={strong ? { borderColor: 'var(--accent)' } : undefined}>
              <div className="body">
                <div className="row tight">
                  <b style={{ fontSize: 13.5 }}>{s.name}（{s.ja}）</b>
                  {strong && <span className="pill warn">企画らしい変化が出やすい</span>}
                </div>
                <div className="tiny muted" style={{ marginBottom: 5 }}>{s.q}</div>
                <AutoText
                  value={value}
                  rows={2}
                  onChange={(v) => save({ ...data, items: { ...data.items, [s.key]: v } })}
                />
              </div>
              <button
                className="sm ghost"
                disabled={!value.trim()}
                title="この案を種として段階1へ送る"
                onClick={() => addSeed(projectId, `[SCAMPER/${s.ja}] ${value.trim()}`, null)}
              >
                種へ
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
