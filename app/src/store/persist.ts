import type { AnyRecord } from '../domain/types';

export interface SyncSettings {
  serverUrl: string;
  workspaceKey: string;
  autoSync: boolean;
}

export interface PersistedState {
  version: 1;
  records: Record<string, AnyRecord>;
  /** サーバーから受け取った最終シーケンス。次回はここから差分を貰う。 */
  cursor: number;
  sync: SyncSettings;
  activeProjectId: string | null;
}

const KEY = 'kikaku.state.v1';

export const emptyState = (): PersistedState => ({
  version: 1,
  records: {},
  cursor: 0,
  sync: { serverUrl: '', workspaceKey: '', autoSync: true },
  activeProjectId: null,
});

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function load(storage: Store): PersistedState {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (parsed.version !== 1 || typeof parsed.records !== 'object' || parsed.records === null) {
      return emptyState();
    }
    const base = emptyState();
    return {
      version: 1,
      records: parsed.records as Record<string, AnyRecord>,
      cursor: typeof parsed.cursor === 'number' ? parsed.cursor : 0,
      sync: { ...base.sync, ...(parsed.sync ?? {}) },
      activeProjectId: parsed.activeProjectId ?? null,
    };
  } catch {
    // 壊れた保存データでアプリごと起動不能になるのを避ける。
    return emptyState();
  }
}

export class QuotaError extends Error {
  constructor() {
    super('保存領域が上限に達しました。設定画面からバックアップを取り、不要な企画を削除してください。');
    this.name = 'QuotaError';
  }
}

export function save(storage: Store, state: PersistedState): void {
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    if (err instanceof Error && /quota|exceeded/i.test(err.name + err.message)) throw new QuotaError();
    throw err;
  }
}

export const STORAGE_KEY = KEY;
