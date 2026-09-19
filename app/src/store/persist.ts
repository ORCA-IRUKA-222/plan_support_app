import type { AnyRecord } from '../domain/types';

export interface SyncSettings {
  /** GitHub のアクセストークン（classic / gist 権限）。この端末にだけ保存する。 */
  token: string;
  /** データを置く秘密の Gist の ID。 */
  gistId: string;
  /** 起動時・画面復帰時・変更後に自動で同期するか。 */
  auto: boolean;
}

export interface PersistedState {
  version: 1;
  records: Record<string, AnyRecord>;
  sync: SyncSettings;
  activeProjectId: string | null;
}

const KEY = 'kikaku.state.v1';

export const emptyState = (): PersistedState => ({
  version: 1,
  records: {},
  sync: { token: '', gistId: '', auto: true },
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
    // 自前サーバーで同期していた頃の設定 (serverUrl / workspaceKey / cursor) は
    // 読み捨てる。記録そのものは同じ形なので、そのまま引き継がれる。
    const sync = (parsed.sync ?? {}) as Partial<SyncSettings>;
    return {
      version: 1,
      records: parsed.records as Record<string, AnyRecord>,
      sync: {
        token: typeof sync.token === 'string' ? sync.token : base.sync.token,
        gistId: typeof sync.gistId === 'string' ? sync.gistId : base.sync.gistId,
        auto: typeof sync.auto === 'boolean' ? sync.auto : base.sync.auto,
      },
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
