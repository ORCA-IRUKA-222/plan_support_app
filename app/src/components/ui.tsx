import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

export function Card({ title, sub, actions, children }: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="card">
      {(title || actions) && (
        <header>
          {title && <h2>{title}</h2>}
          {sub && <span className="sub">{sub}</span>}
          {actions && <div style={{ marginLeft: 'auto' }} className="row tight">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="lbl">{label}</span>
      {hint && <span className="tiny muted">{hint}</span>}
      {children}
    </label>
  );
}

/**
 * 入力のたびに全レコードを書き戻すと重いので、ローカル state で持って
 * blur / デバウンス時にだけ保存する textarea。
 */
export function AutoText({ value, onChange, rows = 3, placeholder, delay = 500 }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; delay?: number;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const push = (v: string) => {
    dirty.current = false;
    if (timer.current) clearTimeout(timer.current);
    if (v !== value) onChange(v);
  };

  return (
    <textarea
      rows={rows}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => {
        const v = e.target.value;
        dirty.current = true;
        setDraft(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => push(v), delay);
      }}
      onBlur={(e) => push(e.target.value)}
    />
  );
}

export function AutoInput({ value, onChange, placeholder, type = 'text', delay = 500 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; delay?: number;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (!dirty.current) setDraft(value); }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const push = (v: string) => {
    dirty.current = false;
    if (timer.current) clearTimeout(timer.current);
    if (v !== value) onChange(v);
  };

  return (
    <input
      type={type}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => {
        const v = e.target.value;
        dirty.current = true;
        setDraft(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => push(v), delay);
      }}
      onBlur={(e) => push(e.target.value)}
    />
  );
}

export function Check({ checked, onChange, children }: {
  checked: boolean; onChange: (v: boolean) => void; children: ReactNode;
}) {
  return (
    <label className={`check${checked ? ' done' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** Enter で確定する行追加フォーム。 */
export function QuickAdd({ onAdd, placeholder, cta = '追加', multiline = false, autoFocus = false }: {
  onAdd: (text: string) => void; placeholder: string; cta?: string; multiline?: boolean; autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const id = useId();
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
  };
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {multiline ? (
        <textarea
          id={id}
          rows={2}
          style={{ flex: 1, minWidth: 180 }}
          placeholder={placeholder}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
          }}
        />
      ) : (
        <input
          id={id}
          type="text"
          style={{ flex: 1, minWidth: 180 }}
          placeholder={placeholder}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        />
      )}
      <button className="accent" onClick={submit} disabled={!text.trim()}>{cta}</button>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}

/** 一定時間で消えるトーストの状態管理。 */
export function useToast(): [string | null, (m: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const show = (m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3200);
  };
  return [msg, show];
}
