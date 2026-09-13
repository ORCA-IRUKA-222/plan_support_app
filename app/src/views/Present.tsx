import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GateContext } from '../domain/gates';
import type { TalkData } from '../domain/types';
import type { AppSnapshot } from '../store/store';
import { saveTool, selectTool } from '../store/store';
import { uid } from '../lib/id';
import { AutoText, Card, Empty, Field, QuickAdd } from '../components/ui';

interface Slide { title: string; body: string }

/** 発表モード。冒頭30秒のフック、スライド送り、リハーサル用タイマー、想定質問。 */
export default function Present({ ctx, snapshot }: { ctx: GateContext; snapshot: AppSnapshot }) {
  const { project, proposal, skeleton } = ctx;
  const talk = useMemo(
    () => selectTool<TalkData>(snapshot, project.id, 'talk'),
    [snapshot, project.id],
  );
  const save = (d: TalkData) => saveTool(project.id, 'talk', d);
  const [deck, setDeck] = useState(false);

  const slides = useMemo<Slide[]>(() => {
    const head: Slide[] = [
      { title: proposal.title || project.title, body: proposal.subtitle || project.oneLiner },
    ];
    if (talk.hook.trim()) head.push({ title: '冒頭30秒', body: talk.hook });
    const body = proposal.sections
      .filter((s) => s.enabled && s.body.trim())
      .map((s) => ({ title: s.title, body: s.body.trim() }));
    return [...head, ...body];
  }, [proposal, project, talk.hook]);

  return (
    <>
      <Card
        title="発表"
        sub={`${slides.length} 枚 / 目安 ${talk.minutes} 分`}
        actions={<button className="accent" disabled={slides.length === 0} onClick={() => setDeck(true)}>発表を始める</button>}
      >
        <Field
          label="冒頭30秒のフック"
          hint="背景説明から始めない。一番面白い瞬間から始めて、根拠は後ろに置く"
        >
          <AutoText value={talk.hook} rows={3} onChange={(v) => save({ ...talk, hook: v })} placeholder="例: このゲーム、ボタンを押すと負けます。" />
        </Field>
        <div className="grid two">
          <label className="field">
            <span className="lbl">持ち時間（分）</span>
            <input
              type="number"
              min={1}
              value={talk.minutes}
              onChange={(e) => save({ ...talk, minutes: Math.max(1, Number(e.target.value) || 1) })}
            />
          </label>
          <Field label="話す順のメモ">
            <AutoText value={talk.notes} rows={3} onChange={(v) => save({ ...talk, notes: v })} />
          </Field>
        </div>
      </Card>

      <Card title="想定質問" sub="弱点は1つ残して認める。それでもやる理由を用意しておく">
        {(skeleton.weakness.trim() || skeleton.anyway.trim()) && (
          <p className="hint strong">
            {skeleton.weakness && <>認めた弱点: {skeleton.weakness}<br /></>}
            {skeleton.anyway && <>それでもやる理由: {skeleton.anyway}</>}
          </p>
        )}
        <QuickAdd
          placeholder="想定される質問（例: これ、収益どうするんですか?）"
          cta="追加"
          onAdd={(q) => save({ ...talk, qa: [...talk.qa, { id: uid('qa'), q, a: '' }] })}
        />
        <div className="list" style={{ marginTop: 10 }}>
          {talk.qa.length === 0 && <Empty>まだありません。厳しい質問ほど先に書いておくと落ち着いて答えられます。</Empty>}
          {talk.qa.map((item) => (
            <div key={item.id} className="item">
              <div className="body">
                <b style={{ fontSize: 13.5 }}>Q. {item.q}</b>
                <AutoText
                  value={item.a}
                  rows={2}
                  placeholder="A."
                  onChange={(v) => save({ ...talk, qa: talk.qa.map((x) => (x.id === item.id ? { ...x, a: v } : x)) })}
                />
              </div>
              <button
                className="ghost sm danger"
                onClick={() => save({ ...talk, qa: talk.qa.filter((x) => x.id !== item.id) })}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </Card>

      {deck && <Deck slides={slides} minutes={talk.minutes} onClose={() => setDeck(false)} />}
    </>
  );
}

function Deck({ slides, minutes, onClose }: { slides: Slide[]; minutes: number; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const startedAt = useRef(Date.now());
  const accumulated = useRef(0);

  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    const t = setInterval(() => {
      setElapsed(accumulated.current + Math.floor((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => {
      accumulated.current += Math.floor((Date.now() - startedAt.current) / 1000);
      clearInterval(t);
    };
  }, [running]);

  const move = useCallback((d: number) => {
    setI((v) => Math.min(slides.length - 1, Math.max(0, v + d)));
  }, [slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, onClose]);

  const limit = minutes * 60;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const slide = slides[i];

  return (
    <div className="deck" role="dialog" aria-modal="true" aria-label="発表モード">
      <div
        className="slide"
        onClick={(e) => move((e.clientX / window.innerWidth) > 0.35 ? 1 : -1)}
      >
        <h2>{slide?.title}</h2>
        {slide?.body && <div className="doc-body">{slide.body}</div>}
      </div>
      <div className="deck-bar">
        <button onClick={() => move(-1)} disabled={i === 0}>← 前</button>
        <span>{i + 1} / {slides.length}</span>
        <button onClick={() => move(1)} disabled={i === slides.length - 1}>次 →</button>
        <span className={`timer${elapsed > limit ? ' over' : ''}`}>{mm}:{ss} / {minutes}:00</span>
        <button onClick={() => setRunning((r) => !r)}>{running ? '一時停止' : '再開'}</button>
        <button
          onClick={() => { accumulated.current = 0; startedAt.current = Date.now(); setElapsed(0); }}
        >
          リセット
        </button>
        <span style={{ flex: 1 }} />
        <button onClick={onClose}>閉じる（Esc）</button>
      </div>
    </div>
  );
}
