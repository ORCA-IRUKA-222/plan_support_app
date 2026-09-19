import type { AnyRecord } from '../domain/types';
import { allRecords, mergeRemote, store } from './store';
import { GistError, createGist, fetchRecords, pushRecords } from './gist';
import { mergeAll } from './merge';

export interface SyncResult {
  ok: boolean;
  pulled: number;
  pushed: boolean;
  message: string;
  at: number;
  /** 同期の過程で Gist を新規作成した場合の ID。 */
  createdGistId?: string;
}

export const isConfigured = (): boolean => store.getSnapshot().sync.token.trim().length > 0;

const LAST_SYNCED_KEY = 'kikaku.lastSyncedAt';

export function lastSyncedAt(): number {
  if (typeof localStorage === 'undefined') return 0;
  return Number(localStorage.getItem(LAST_SYNCED_KEY) ?? 0);
}

function markSynced(at: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LAST_SYNCED_KEY, String(at));
}

const count = (r: Record<string, AnyRecord>) => Object.keys(r).length;

/**
 * Gist と1往復して両端末の内容を揃える。
 *
 *   1. Gist を読む
 *   2. 手元の記録と突き合わせ、レコードごとに updatedAt の新しい方を残す（LWW）
 *   3. 手元に反映する
 *   4. 突き合わせた結果が Gist と違っていれば書き戻す
 *
 * 全量を書き戻すので、どちらの端末で足したものも消えない。
 * 同じ項目を両方で直した場合のみ、あとから保存した方が残る。
 */
export async function syncNow({ allowCreate = false } = {}): Promise<SyncResult> {
  const at = Date.now();
  const { token, gistId } = store.getSnapshot().sync;

  if (!token.trim()) {
    return { ok: false, pulled: 0, pushed: false, at, message: 'アクセストークンを設定してください。' };
  }

  try {
    if (!gistId.trim()) {
      // 自動同期では絶対に Gist を作らない。
      // 2台目でトークンを入れた直後に勝手に別の Gist ができてしまうと、
      // 以後どれだけ同期しても1台目とつながらず、しかも気づけない。
      if (!allowCreate) {
        return {
          ok: false, pulled: 0, pushed: false, at,
          message: 'Gist ID が未設定です。1台目なら「いま同期する」で作成、2台目なら1台目の ID を入れてください。',
        };
      }
      const created = await createGist(token.trim(), allRecords());
      markSynced(at);
      return {
        ok: true, pulled: 0, pushed: true, at, createdGistId: created,
        message: `Gist を作成しました (ID: ${created})。他の端末にはこの ID を入れてください。`,
      };
    }

    const cfg = { token: token.trim(), gistId: gistId.trim() };
    const remote = await fetchRecords(cfg);

    const local = allRecords();
    const merged = mergeAll(local, Object.values(remote)).next;

    const pulled = mergeRemote(Object.values(remote));

    // Gist に無い記録、または手元の方が新しい記録があるときだけ書き戻す。
    const needsPush =
      count(merged) !== count(remote) ||
      Object.values(merged).some((r) => remote[r.id]?.updatedAt !== r.updatedAt);

    if (needsPush) await pushRecords(cfg, merged);
    markSynced(at);

    return {
      ok: true,
      pulled,
      pushed: needsPush,
      at,
      message: needsPush
        ? `同期しました（受信 ${pulled} 件 / 送信 ${count(merged)} 件）`
        : `同期しました（受信 ${pulled} 件 / 送るものはありません）`,
    };
  } catch (err) {
    const message = err instanceof GistError
      ? err.message
      : `同期に失敗しました: ${err instanceof Error ? err.message : String(err)}`;
    return { ok: false, pulled: 0, pushed: false, at, message };
  }
}

/** 次回に全部取り直させる。 */
export function resetSyncCursor(): void {
  markSynced(0);
}
