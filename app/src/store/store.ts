import { useSyncExternalStore } from 'react';
import type {
  AnyRecord, CoreData, Judge, Note, Phase, Project, Seed, Tool, ToolId,
} from '../domain/types';
import { defaultToolData } from '../domain/defaults';
import { now } from '../lib/time';
import { uid } from '../lib/id';
import { load, save, type PersistedState, type SyncSettings } from './persist';
import { mergeAll } from './merge';

type Listener = () => void;

export interface AppSnapshot extends PersistedState {
  /** 保存に失敗したときのメッセージ。UI に出す。 */
  storageError: string | null;
}

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const memoryStorage: Pick<Storage, 'getItem' | 'setItem'> = (() => {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
})();

const storage = isBrowser ? window.localStorage : memoryStorage;

let state: AppSnapshot = { ...load(storage), storageError: null };
const listeners = new Set<Listener>();

function emit(next: AppSnapshot, persist = true) {
  if (persist) {
    try {
      const { storageError: _drop, ...toSave } = next;
      void _drop;
      save(storage, toSave);
      next = { ...next, storageError: null };
    } catch (err) {
      next = { ...next, storageError: err instanceof Error ? err.message : String(err) };
    }
  }
  state = next;
  for (const l of listeners) l();
}

export const store = {
  getSnapshot: (): AppSnapshot => state,
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  /** テスト用に状態を差し替える。 */
  __setState(next: AppSnapshot): void {
    emit(next, false);
  },
};

/**
 * ストアを購読する。
 *
 * 重要: selector は「安定した参照」を返すこと。
 * useSyncExternalStore は毎レンダーで getSnapshot を呼び、前回と Object.is 比較する。
 * 新しい配列やオブジェクトを組み立てて返すと毎回「変わった」と判定され、
 * 再レンダーが止まらなくなる (React も getSnapshot should be cached と警告する)。
 *
 * 派生データが欲しい場合は useApp((s) => s) でスナップショットを取り、
 * useMemo で導出すること。スナップショットの参照は変更時にしか変わらない。
 */
export function useApp<T>(selector: (s: AppSnapshot) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getSnapshot()),
    () => selector(store.getSnapshot()),
  );
}

// ---- 低レベル操作 ----------------------------------------------------------

export function putRecords(recs: AnyRecord[]): void {
  const next = { ...state.records };
  for (const r of recs) next[r.id] = r;
  emit({ ...state, records: next });
}

export function mergeFromServer(incoming: AnyRecord[], cursor: number): number {
  const { next, changed } = mergeAll(state.records, incoming);
  emit({ ...state, records: next, cursor });
  return changed;
}

/** 前回同期以降にこの端末で変更されたレコード。 */
export function localChangesSince(ts: number): AnyRecord[] {
  return Object.values(state.records).filter((r) => r.updatedAt > ts);
}

export function setSyncSettings(patch: Partial<SyncSettings>): void {
  emit({ ...state, sync: { ...state.sync, ...patch } });
}

export function setCursor(cursor: number): void {
  emit({ ...state, cursor });
}

export function setActiveProject(id: string | null): void {
  emit({ ...state, activeProjectId: id });
}

export function replaceAll(next: PersistedState): void {
  emit({ ...next, storageError: null });
}

// ---- セレクタ --------------------------------------------------------------

const alive = <T extends AnyRecord>(r: T): boolean => !r.deleted;

export function selectProjects(s: AppSnapshot): Project[] {
  return Object.values(s.records)
    .filter((r): r is Project => r.kind === 'project' && alive(r))
    .sort((a, b) => Number(a.archived) - Number(b.archived) || b.updatedAt - a.updatedAt);
}

export function selectProject(s: AppSnapshot, id: string | null): Project | null {
  if (!id) return null;
  const r = s.records[id];
  return r && r.kind === 'project' && alive(r) ? r : null;
}

export function selectNotes(s: AppSnapshot, projectId: string | null | 'all'): Note[] {
  return Object.values(s.records)
    .filter((r): r is Note => r.kind === 'note' && alive(r))
    .filter((n) => projectId === 'all' || n.projectId === projectId || n.projectId === null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function selectSeeds(s: AppSnapshot, projectId: string): Seed[] {
  return Object.values(s.records)
    .filter((r): r is Seed => r.kind === 'seed' && alive(r) && r.projectId === projectId)
    .sort((a, b) => a.updatedAt - b.updatedAt);
}

export function toolRecordId(projectId: string, toolId: ToolId): string {
  return `tool:${projectId}:${toolId}`;
}

export function selectTool<T>(s: AppSnapshot, projectId: string, toolId: ToolId): T {
  const rec = s.records[toolRecordId(projectId, toolId)];
  if (rec && rec.kind === 'tool' && alive(rec)) return rec.data as T;
  return defaultToolData(toolId) as T;
}

// ---- アクション ------------------------------------------------------------

export function createProject(title: string): Project {
  const project: Project = {
    id: uid('prj'),
    kind: 'project',
    updatedAt: now(),
    title: title.trim() || '無題の企画',
    oneLiner: '',
    phase: 0,
    gates: {},
    audience: '',
    deadline: '',
    archived: false,
  };
  putRecords([project]);
  setActiveProject(project.id);
  return project;
}

export function updateProject(id: string, patch: Partial<Omit<Project, 'id' | 'kind'>>): void {
  const cur = state.records[id];
  if (!cur || cur.kind !== 'project') return;
  putRecords([{ ...cur, ...patch, updatedAt: now() }]);
}

export function setPhase(id: string, phase: Phase): void {
  updateProject(id, { phase });
}

export function toggleGate(id: string, gateId: string, value: boolean): void {
  const cur = state.records[id];
  if (!cur || cur.kind !== 'project') return;
  updateProject(id, { gates: { ...cur.gates, [gateId]: value } });
}

export function softDelete(id: string): void {
  const cur = state.records[id];
  if (!cur) return;
  putRecords([{ ...cur, deleted: true, updatedAt: now() }]);
}

export const emptyJudge = (): Judge => ({ oneLine: 0, novelty: 0, reaction: 0, necessity: 0 });

export function addNote(input: Pick<Note, 'body'> & Partial<Note>): Note {
  const note: Note = {
    id: uid('note'),
    kind: 'note',
    updatedAt: now(),
    projectId: input.projectId ?? null,
    body: input.body,
    tags: input.tags ?? [],
    source: input.source ?? null,
  };
  putRecords([note]);
  return note;
}

export function updateNote(id: string, patch: Partial<Omit<Note, 'id' | 'kind'>>): void {
  const cur = state.records[id];
  if (!cur || cur.kind !== 'note') return;
  putRecords([{ ...cur, ...patch, updatedAt: now() }]);
}

export function addSeed(projectId: string, text: string, source: Seed['source'] = null): Seed {
  const seed: Seed = {
    id: uid('seed'),
    kind: 'seed',
    updatedAt: now(),
    projectId,
    text,
    source,
    judge: emptyJudge(),
    starred: false,
    group: '',
  };
  putRecords([seed]);
  return seed;
}

export function updateSeed(id: string, patch: Partial<Omit<Seed, 'id' | 'kind'>>): void {
  const cur = state.records[id];
  if (!cur || cur.kind !== 'seed') return;
  putRecords([{ ...cur, ...patch, updatedAt: now() }]);
}

export function saveTool<T>(projectId: string, toolId: ToolId, data: T): void {
  const id = toolRecordId(projectId, toolId);
  const rec: Tool<T> = { id, kind: 'tool', updatedAt: now(), projectId, toolId, data };
  putRecords([rec as AnyRecord]);
}

/** 核の一行は Project と core ツールの両方に持たせるため、まとめて更新する。 */
export function saveCore(projectId: string, data: CoreData): void {
  saveTool(projectId, 'core', data);
  updateProject(projectId, { oneLiner: data.oneLiner });
}
