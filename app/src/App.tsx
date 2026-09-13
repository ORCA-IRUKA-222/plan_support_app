import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROUTES, TAB_ROUTES, parseHash, type RouteId } from './routes';
import { PHASES } from './domain/knowledge';
import { gateStates, type GateContext } from './domain/gates';
import type { CoreData, FiveQData, ProposalData, SkeletonData } from './domain/types';
import {
  createProject, selectNotes, selectProject, selectProjects, selectSeeds, selectTool,
  setActiveProject, useApp,
} from './store/store';
import { syncNow } from './store/sync';
import { Toast, useToast } from './components/ui';

import Dashboard from './views/Dashboard';
import Notes from './views/Notes';
import Seeds from './views/Seeds';
import Core from './views/Core';
import Skeleton from './views/Skeleton';
import Proposal from './views/Proposal';
import Present from './views/Present';
import Methods from './views/Methods';
import Frameworks from './views/Frameworks';
import Settings from './views/Settings';

export default function App() {
  const [route, setRoute] = useState<RouteId>(() =>
    parseHash(typeof location === 'undefined' ? '' : location.hash),
  );
  const [toast, showToast] = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((id: RouteId) => {
    location.hash = `#/${id}`;
    setRoute(id);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  // ドロワーを開いている間は背面をスクロールさせない。
  useEffect(() => {
    document.body.classList.toggle('drawer-open', menuOpen);
    return () => document.body.classList.remove('drawer-open');
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const snapshot = useApp((s) => s);
  const projects = useMemo(() => selectProjects(snapshot), [snapshot]);
  const active = selectProject(snapshot, snapshot.activeProjectId) ?? projects[0] ?? null;
  const projectId = active?.id ?? null;

  const notes = useMemo(() => selectNotes(snapshot, projectId), [snapshot, projectId]);
  const seeds = useMemo(() => (projectId ? selectSeeds(snapshot, projectId) : []), [snapshot, projectId]);

  const ctx: GateContext | null = useMemo(() => {
    if (!active) return null;
    return {
      project: active,
      notes,
      seeds,
      core: selectTool<CoreData>(snapshot, active.id, 'core'),
      skeleton: selectTool<SkeletonData>(snapshot, active.id, 'skeleton'),
      fiveq: selectTool<FiveQData>(snapshot, active.id, 'fiveq'),
      proposal: selectTool<ProposalData>(snapshot, active.id, 'proposal'),
    };
  }, [snapshot, active, notes, seeds]);

  // ---- 自動同期: 起動時と、変更が落ち着いた30秒後 ----
  const syncing = useRef(false);
  const runSync = useCallback(
    async (announce: boolean) => {
      if (syncing.current) return;
      const { serverUrl, workspaceKey } = snapshot.sync;
      if (!serverUrl || !workspaceKey) {
        if (announce) showToast('同期サーバーが未設定です。設定画面から登録してください。');
        return;
      }
      syncing.current = true;
      const result = await syncNow();
      syncing.current = false;
      if (announce || !result.ok) showToast(result.message);
    },
    [snapshot.sync, showToast],
  );

  useEffect(() => {
    if (!snapshot.sync.autoSync) return;
    void runSync(false);
    const onVisible = () => { if (document.visibilityState === 'visible') void runSync(false); };
    const onOnline = () => void runSync(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
    // 起動時に一度だけ購読する。runSync は sync 設定の変更で作り直される。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.sync.autoSync, snapshot.sync.serverUrl, snapshot.sync.workspaceKey]);

  useEffect(() => {
    if (!snapshot.sync.autoSync) return;
    const t = setTimeout(() => void runSync(false), 30_000);
    return () => clearTimeout(t);
  }, [snapshot.records, snapshot.sync.autoSync, runSync]);

  const badges = useMemo(() => {
    if (!ctx) return {} as Partial<Record<RouteId, string>>;
    const out: Partial<Record<RouteId, string>> = {};
    for (const def of PHASES) {
      const states = gateStates(def.phase, ctx);
      const done = states.filter((s) => s.passed).length;
      const routeId = def.route as RouteId;
      out[routeId] = `${done}/${states.length}`;
    }
    return out;
  }, [ctx]);

  const view = () => {
    if (route === 'settings') return <Settings onToast={showToast} />;
    if (!active || !ctx) {
      return (
        <div className="card">
          <h2>まだ企画がありません</h2>
          <p className="hint">
            まずは企画をひとつ作ってください。名前は仮でかまいません。核が決まったら変えられます。
            <br />
            すでに別の端末で始めている場合は、企画を作らずに同期設定から始めてください。
          </p>
          <div className="row">
            <button className="accent" onClick={() => { createProject('新しい企画'); go('notes'); }}>
              企画をはじめる
            </button>
            <button onClick={() => go('settings')}>他の端末から同期する</button>
          </div>
        </div>
      );
    }
    switch (route) {
      case 'dashboard': return <Dashboard ctx={ctx} go={go} />;
      case 'notes': return <Notes projectId={active.id} notes={notes} onToast={showToast} />;
      case 'seeds': return <Seeds projectId={active.id} seeds={seeds} onToast={showToast} />;
      case 'core': return <Core ctx={ctx} go={go} />;
      case 'skeleton': return <Skeleton ctx={ctx} />;
      case 'proposal': return <Proposal ctx={ctx} snapshot={snapshot} onToast={showToast} go={go} />;
      case 'present': return <Present ctx={ctx} snapshot={snapshot} />;
      case 'methods': return <Methods projectId={active.id} snapshot={snapshot} />;
      case 'frameworks': return <Frameworks projectId={active.id} snapshot={snapshot} />;
      default: return <Dashboard ctx={ctx} go={go} />;
    }
  };

  const groups = ['進行', '道具'] as const;

  return (
    <div className="shell">
      <nav className="sidebar" data-open={menuOpen} aria-label="メインナビゲーション">
        <div className="brand">
          <img src="./icon.svg" alt="" />
          <b>企画伴走</b>
        </div>

        <ProjectPicker projects={projects} activeId={active?.id ?? null} />

        {groups.map((group) => (
          <div className="nav-group" key={group}>
            <span>{group}</span>
            {ROUTES.filter((r) => r.group === group).map((r) => (
              <button
                key={r.id}
                className="nav-item"
                aria-current={route === r.id ? 'page' : undefined}
                onClick={() => go(r.id)}
              >
                <span className="ico" aria-hidden="true">{r.ico}</span>
                {r.label}
                {badges[r.id] && <span className="badge">{badges[r.id]}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="main">
        <header className="topbar">
          <button
            className="menu-btn ghost"
            aria-label="メニューを開く"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
          <h1>{ROUTES.find((r) => r.id === route)?.label}</h1>
          {active && <span className="pill">{PHASES[active.phase]?.name}</span>}
          <span className="spacer" />
          <button className="ghost" onClick={() => void runSync(true)} title="いま同期する">
            ⟳ 同期
          </button>
        </header>

        <main className={`content${route === 'present' ? ' wide' : ''}`}>{view()}</main>
      </div>

      {menuOpen && (
        <button className="backdrop" aria-label="メニューを閉じる" onClick={() => setMenuOpen(false)} />
      )}

      <nav className="tabbar" aria-label="タブ">
        {TAB_ROUTES.map((id) => {
          const r = ROUTES.find((x) => x.id === id);
          if (!r) return null;
          return (
            <button key={id} aria-current={route === id ? 'page' : undefined} onClick={() => go(id)}>
              <span className="ico" aria-hidden="true">{r.ico}</span>
              {r.label}
            </button>
          );
        })}
      </nav>

      <Toast message={snapshot.storageError ?? toast} />
    </div>
  );
}

function ProjectPicker({ projects, activeId }: { projects: { id: string; title: string }[]; activeId: string | null }) {
  return (
    <div className="col" style={{ gap: 6, padding: '0 8px' }}>
      <select
        value={activeId ?? ''}
        onChange={(e) => {
          if (e.target.value === '__new') {
            const title = prompt('企画の名前 (仮でOK)');
            if (title !== null) createProject(title);
            return;
          }
          setActiveProject(e.target.value || null);
        }}
        aria-label="企画を選ぶ"
      >
        {projects.length === 0 && <option value="">(企画なし)</option>}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.title}</option>
        ))}
        <option value="__new">+ 新しい企画…</option>
      </select>
    </div>
  );
}
