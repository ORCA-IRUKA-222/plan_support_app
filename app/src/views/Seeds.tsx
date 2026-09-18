import { useMemo, useState } from 'react';
import type { JudgeKey } from '../domain/knowledge';
import { JUDGES, SOURCES, SOURCE_MAP } from '../domain/knowledge';
import type { Score, Seed, SourceId } from '../domain/types';
import { addSeed, softDelete, updateSeed } from '../store/store';
import { AutoInput, Card, Empty, Progress, QuickAdd } from '../components/ui';

const TARGET = 30;

/**
 * 段階1「種を出す」。
 * 発散 → 4判定 → KJ法での収束、を1画面で回す。
 */
export default function Seeds({ projectId, seeds, onToast }: {
  projectId: string; seeds: Seed[]; onToast: (m: string) => void;
}) {
  const [source, setSource] = useState<SourceId>('passion');
  const [mode, setMode] = useState<'diverge' | 'judge' | 'kj'>('diverge');
  const [promptIdx, setPromptIdx] = useState(0);

  const byCount = useMemo(() => {
    const m = new Map<SourceId, number>();
    for (const s of seeds) if (s.source) m.set(s.source, (m.get(s.source) ?? 0) + 1);
    return m;
  }, [seeds]);

  const starred = seeds.filter((s) => s.starred).length;
  const usedSources = byCount.size;
  const def = SOURCE_MAP[source];
  const prompt = def.prompts[promptIdx % def.prompts.length] ?? '';

  return (
    <>
      <Card title="発散の状況" sub="質を問わず30〜50個。まず量を出す">
        <div className="grid three">
          <Stat label="種の数" value={`${seeds.length}`} goal={`/ ${TARGET}`} now={seeds.length} max={TARGET} />
          <Stat label="話したくなる種 ★" value={`${starred}`} goal="/ 3" now={starred} max={3} />
          <Stat label="使った出所" value={`${usedSources}`} goal="/ 7 分類" now={usedSources} max={7} />
        </div>
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          発想が止まるときは、たいてい同じ出所ばかり掘っています。意識的に出所を切り替えてください。
        </p>
      </Card>

      <div className="row tight" style={{ margin: '14px 0' }}>
        {(['diverge', 'judge', 'kj'] as const).map((m) => (
          <button key={m} className="chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === 'diverge' ? '1. 出す' : m === 'judge' ? '2. 判定する' : '3. まとめる（KJ法）'}
          </button>
        ))}
      </div>

      {mode === 'diverge' && (
        <Card title="出所を切り替えて出す">
          <div className="row tight" style={{ marginBottom: 10 }}>
            {SOURCES.map((s) => (
              <button
                key={s.id}
                className="chip"
                aria-pressed={source === s.id}
                onClick={() => { setSource(s.id); setPromptIdx(0); }}
                title={s.hint}
              >
                {s.name} <span className="muted">{byCount.get(s.id) ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="hint strong">
            <b>{def.name}</b>（{def.hint}）<br />
            {prompt}
            <button className="sm ghost" style={{ marginLeft: 6 }} onClick={() => setPromptIdx((i) => i + 1)}>
              別の問い
            </button>
          </div>

          <QuickAdd
            placeholder="思いついたことを1行で。質は問わない（Enter で追加）"
            cta="種を足す"
            autoFocus
            onAdd={(t) => { addSeed(projectId, t, source); }}
          />

          <div className="list" style={{ marginTop: 12 }}>
            {seeds.filter((s) => s.source === source).slice().reverse().map((s) => (
              <div key={s.id} className={`item${s.starred ? ' starred' : ''}`}>
                <button
                  className="ghost sm"
                  title="人に話したくなる種"
                  onClick={() => updateSeed(s.id, { starred: !s.starred })}
                >
                  {s.starred ? '★' : '☆'}
                </button>
                <div className="body">{s.text}</div>
                <button className="ghost sm danger" onClick={() => softDelete(s.id)}>削除</button>
              </div>
            ))}
            {byCount.get(source) === undefined && <Empty>この出所からはまだ出していません。</Empty>}
          </div>
        </Card>
      )}

      {mode === 'judge' && <JudgeMode seeds={seeds} />}

      {mode === 'kj' && <KjMode seeds={seeds} onToast={onToast} />}
    </>
  );
}

function Stat({ label, value, goal, now, max }: {
  label: string; value: string; goal: string; now: number; max: number;
}) {
  return (
    <div className="col" style={{ gap: 5 }}>
      <span className="tiny muted">{label}</span>
      <div><b style={{ fontSize: 21 }}>{value}</b> <span className="tiny muted">{goal}</span></div>
      <Progress value={now} max={max} />
    </div>
  );
}

/** 良い種かどうかの4判定。0=未評価, 1〜4 で採点。 */
function JudgeMode({ seeds }: { seeds: Seed[] }) {
  const [onlyStarred, setOnlyStarred] = useState(false);
  const list = onlyStarred ? seeds.filter((s) => s.starred) : seeds;
  const ranked = list
    .slice()
    .sort((a, b) => total(b) - total(a) || Number(b.starred) - Number(a.starred));

  return (
    <Card title="良い種かどうかの4判定" sub="点数そのものより、どこが弱いかを見るための道具">
      <div className="row tight" style={{ marginBottom: 8 }}>
        <button className="chip" aria-pressed={onlyStarred} onClick={() => setOnlyStarred((v) => !v)}>
          ★ だけ表示
        </button>
      </div>
      <ul className="tiny muted" style={{ marginTop: 0, paddingLeft: 18 }}>
        {JUDGES.map((j) => <li key={j.key}><b>{j.name}</b>: {j.desc}</li>)}
      </ul>

      {ranked.length === 0 ? (
        <Empty>まず「1. 出す」で種を書き出してください。</Empty>
      ) : (
        <div className="list">
          {ranked.map((s) => (
            <div key={s.id} className={`item${s.starred ? ' starred' : ''}`}>
              <div className="body">
                <div>{s.text}</div>
                <div className="row tight" style={{ marginTop: 7 }}>
                  {JUDGES.map((j) => (
                    <span key={j.key} className="row tight" style={{ gap: 3 }}>
                      <span className="tiny muted" style={{ minWidth: 62 }}>{j.name}</span>
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={n}
                          className="chip sm"
                          style={{ padding: '1px 7px' }}
                          aria-pressed={s.judge[j.key as JudgeKey] >= n}
                          onClick={() =>
                            updateSeed(s.id, {
                              judge: {
                                ...s.judge,
                                [j.key]: (s.judge[j.key as JudgeKey] === n ? 0 : n) as Score,
                              },
                            })
                          }
                          aria-label={`${j.name} ${n}点`}
                        >
                          {n}
                        </button>
                      ))}
                    </span>
                  ))}
                  <span className="pill">計 {total(s)} / 16</span>
                </div>
              </div>
              <button className="ghost sm" onClick={() => updateSeed(s.id, { starred: !s.starred })}>
                {s.starred ? '★' : '☆'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const total = (s: Seed) => Object.values(s.judge).reduce((a, b) => a + b, 0);

/**
 * KJ法。先にカテゴリを決めず、似たもの同士を集めてから名前を付ける。
 * 名前を付ける瞬間の言葉がキャッチコピーの原型になる。
 */
function KjMode({ seeds, onToast }: { seeds: Seed[]; onToast: (m: string) => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const m = new Map<string, Seed[]>();
    for (const s of seeds) {
      const key = s.group || '';
      const arr = m.get(key);
      if (arr) arr.push(s); else m.set(key, [s]);
    }
    return [...m.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0], 'ja')));
  }, [seeds]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const groupPicked = () => {
    if (picked.size === 0) return;
    const name = prompt('集めた束に、いま浮かんだ言葉で名前を付けてください（先に分類枠を作らないこと）');
    if (!name) return;
    for (const id of picked) updateSeed(id, { group: name.trim() });
    setPicked(new Set());
    onToast(`「${name.trim()}」でまとめました`);
  };

  return (
    <Card
      title="KJ法 — 集めてから名前を付ける"
      sub="先に分類枠を作ると既存の枠組みに戻ってしまいます"
      actions={
        <>
          <span className="tiny muted">{picked.size} 枚選択中</span>
          <button className="accent sm" disabled={picked.size === 0} onClick={groupPicked}>
            束にして名前を付ける
          </button>
        </>
      }
    >
      <p className="hint">
        似ていると感じた札をクリックして選び、まとめて名前を付けます。
        名前を付ける瞬間に出てくる言葉が、そのままキャッチコピーの原型になることがあります。
      </p>

      {seeds.length === 0 && <Empty>まず「1. 出す」で種を書き出してください。</Empty>}

      {groups.map(([name, items]) => (
        <div
          key={name || '__ungrouped'}
          className={`kj-cluster ${name ? 'is-named' : 'is-unsorted'}`}
        >
          <header>
            {name ? (
              <>
                <span className="pill ok">束</span>
                <div style={{ flex: 1, minWidth: 140, maxWidth: 320 }}>
                  <AutoInput
                    value={name}
                    onChange={(v) => { for (const s of items) updateSeed(s.id, { group: v.trim() }); }}
                  />
                </div>
                <span className="tiny muted">{items.length} 枚</span>
                <button
                  className="ghost sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => { for (const s of items) updateSeed(s.id, { group: '' }); }}
                >
                  束を解く
                </button>
              </>
            ) : (
              <>
                <span className="pill">未分類</span>
                <span className="tiny muted">{items.length} 枚 — 似たものを選んで束にしてください</span>
              </>
            )}
          </header>

          <div className="kj-cards">
            {items.map((s) => (
              <button
                key={s.id}
                className={`kj-card${picked.has(s.id) ? ' is-picked' : ''}`}
                onClick={() => toggle(s.id)}
                title={s.source ? SOURCE_MAP[s.source].name : undefined}
              >
                {s.text}
                {s.starred && <span style={{ color: 'var(--accent)' }}> ★</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}
