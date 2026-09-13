import { PHASES, PHASE_WARNING, PITFALLS, METHOD_ROUTING } from '../domain/knowledge';
import { gateStates, nextAction, phaseProgress, type GateContext } from '../domain/gates';
import type { RouteId } from '../routes';
import type { Phase } from '../domain/types';
import { toggleGate, updateProject } from '../store/store';
import { AutoInput, Card, Check, Progress } from '../components/ui';

export default function Dashboard({ ctx, go }: { ctx: GateContext; go: (r: RouteId) => void }) {
  const { project } = ctx;
  const progress = phaseProgress(ctx);
  const next = nextAction(ctx);
  const totalPassed = progress.reduce((n, p) => n + p.passed, 0);
  const totalGates = progress.reduce((n, p) => n + p.total, 0);

  return (
    <>
      <Card
        title={project.title}
        sub={project.oneLiner || '核の一行はまだありません'}
        actions={<button className="sm" onClick={() => go('core')}>核を編集</button>}
      >
        <div className="grid two">
          <label className="field">
            <span className="lbl">企画名</span>
            <AutoInput value={project.title} onChange={(v) => updateProject(project.id, { title: v })} />
          </label>
          <label className="field">
            <span className="lbl">提出先</span>
            <span className="tiny muted">収益構造・IP・時間軸の前提になります</span>
            <AutoInput
              value={project.audience}
              onChange={(v) => updateProject(project.id, { audience: v })}
              placeholder="例: ◯◯社 新卒選考インターン課題"
            />
          </label>
          <label className="field">
            <span className="lbl">締切</span>
            <input
              type="date"
              value={project.deadline}
              onChange={(e) => updateProject(project.id, { deadline: e.target.value })}
            />
          </label>
          <div className="col">
            <span className="lbl" style={{ fontSize: 13, fontWeight: 600 }}>
              全体の進捗 {totalPassed} / {totalGates}
            </span>
            <Progress value={totalPassed} max={totalGates} />
            {project.deadline && <span className="tiny muted">{daysLeft(project.deadline)}</span>}
          </div>
        </div>
      </Card>

      {next && (
        <Card title="次にやること">
          <p className="hint strong">
            <b>段階{next.phase}「{PHASES[next.phase]?.name}」</b> — {next.gate.label}
            {next.gate.detail && <> （{next.gate.detail}）</>}
          </p>
          <button className="accent" onClick={() => go((PHASES[next.phase]?.route ?? 'dashboard') as RouteId)}>
            {PHASES[next.phase]?.name}へ進む
          </button>
        </Card>
      )}

      <Card title="企画書ができるまでの5段階" sub="次へ進んでいい条件（ゲート）を満たしてから進む">
        <p className="hint">{PHASE_WARNING}</p>
        <div className="list">
          {PHASES.map((def) => {
            const states = gateStates(def.phase, ctx);
            const passed = states.filter((s) => s.passed).length;
            const current = project.phase === def.phase;
            return (
              <div
                key={def.phase}
                className="item"
                style={current ? { borderColor: 'var(--accent)' } : undefined}
              >
                <div className="body">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b style={{ fontSize: 14 }}>
                      {def.phase}. {def.name}
                      {current && <span className="pill accent" style={{ marginLeft: 8 }}>いまここ</span>}
                    </b>
                    <span className={`pill ${passed === states.length ? 'ok' : passed > 0 ? 'warn' : ''}`}>
                      {passed} / {states.length}
                    </span>
                  </div>
                  <div className="tiny muted">{def.todo} — 次へ進む条件: {def.gate}</div>
                  <div style={{ margin: '7px 0' }}><Progress value={passed} max={states.length} /></div>
                  {current && (
                    <div className="col" style={{ gap: 2, marginTop: 6 }}>
                      {states.map((s) =>
                        s.auto ? (
                          <div key={s.id} className="tiny row tight">
                            <span aria-hidden="true">{s.passed ? '✔' : '□'}</span>
                            <span className={s.passed ? 'muted' : ''}>{s.label}</span>
                            {s.detail && <span className="pill">{s.detail}</span>}
                          </div>
                        ) : (
                          <Check
                            key={s.id}
                            checked={s.passed}
                            onChange={(v) => toggleGate(project.id, s.id, v)}
                          >
                            {s.label}
                          </Check>
                        ),
                      )}
                    </div>
                  )}
                  <div className="row tight" style={{ marginTop: 8 }}>
                    <button className="sm" onClick={() => go(def.route as RouteId)}>開く</button>
                    {!current && (
                      <button
                        className="sm ghost"
                        onClick={() => updateProject(project.id, { phase: def.phase as Phase })}
                      >
                        ここを「いまここ」にする
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid two">
        <Card title="手法の使い分け">
          <table className="data">
            <thead><tr><th>状況</th><th>使う手法</th></tr></thead>
            <tbody>
              {METHOD_ROUTING.map((r) => (
                <tr key={r.situation}><td>{r.situation}</td><td>{r.methods}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="row tight" style={{ marginTop: 10 }}>
            <button className="sm" onClick={() => go('methods')}>思考ツールを開く</button>
            <button className="sm" onClick={() => go('frameworks')}>フレームワークを開く</button>
          </div>
        </Card>

        <Card title="陥りやすい罠">
          <div className="list">
            {PITFALLS.map((p) => (
              <div key={p.name} className="item">
                <div className="body">
                  <b style={{ fontSize: 13.5 }}>{p.name}</b>
                  <div className="tiny muted">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function daysLeft(deadline: string): string {
  const end = new Date(`${deadline}T23:59:59`).getTime();
  if (Number.isNaN(end)) return '';
  const days = Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return `締切を ${-days} 日過ぎています`;
  if (days === 0) return '締切は今日です';
  return `締切まで あと ${days} 日`;
}
