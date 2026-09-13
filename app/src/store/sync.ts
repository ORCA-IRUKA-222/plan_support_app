import type { AnyRecord } from '../domain/types';
import { localChangesSince, mergeFromServer, store } from './store';

export interface SyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  applied: number;
  message: string;
  at: number;
}

interface SyncResponse {
  now: number;
  cursor: number;
  changes: AnyRecord[];
}

const LAST_PUSH_KEY = 'kikaku.lastPushedAt';

function lastPushedAt(): number {
  if (typeof localStorage === 'undefined') return 0;
  return Number(localStorage.getItem(LAST_PUSH_KEY) ?? 0);
}

function setLastPushedAt(v: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LAST_PUSH_KEY, String(v));
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return `${trimmed}/api/sync`;
}

/**
 * 差分同期を1往復ぶん実行する。
 * push: 前回 push 以降に手元で変わったレコード
 * pull: サーバーの cursor 以降に他端末が変えたレコード
 * どちらも updatedAt による LWW でマージされる。
 */
export async function syncNow(signal?: AbortSignal): Promise<SyncResult> {
  const snap = store.getSnapshot();
  const { serverUrl, workspaceKey } = snap.sync;
  const at = Date.now();

  if (!serverUrl || !workspaceKey) {
    return { ok: false, pushed: 0, pulled: 0, applied: 0, at, message: '同期サーバーのURLと合言葉を設定してください。' };
  }

  const since = lastPushedAt();
  const changes = localChangesSince(since);

  try {
    const res = await fetch(normalizeUrl(serverUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Workspace-Key': workspaceKey },
      body: JSON.stringify({ cursor: snap.cursor, changes }),
      signal: signal ?? null,
    });

    if (res.status === 401) {
      return { ok: false, pushed: 0, pulled: 0, applied: 0, at, message: '合言葉が一致しません。' };
    }
    if (!res.ok) {
      return { ok: false, pushed: 0, pulled: 0, applied: 0, at, message: `サーバーエラー (${res.status})` };
    }

    const body = (await res.json()) as SyncResponse;
    const applied = mergeFromServer(body.changes ?? [], body.cursor);
    setLastPushedAt(at);

    return {
      ok: true,
      pushed: changes.length,
      pulled: body.changes?.length ?? 0,
      applied,
      at,
      message: `送信 ${changes.length} 件 / 受信 ${body.changes?.length ?? 0} 件 (反映 ${applied} 件)`,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, pushed: 0, pulled: 0, applied: 0, at, message: '同期を中止しました。' };
    }
    return {
      ok: false, pushed: 0, pulled: 0, applied: 0, at,
      message: describeNetworkError(err, serverUrl),
    };
  }
}

/**
 * fetch の失敗は理由を教えてくれない ("Failed to fetch" しか返らない) ので、
 * 実際に起きがちな原因を並べて次に試すことが分かるようにする。
 */
function describeNetworkError(err: unknown, serverUrl: string): string {
  const detail = err instanceof Error ? err.message : String(err);
  const lines = [`同期サーバー (${serverUrl}) につながりません。`];

  if (/^https:/i.test(location.origin) && /^http:/i.test(serverUrl.trim())) {
    lines.push('・アプリが暗号化された接続で動いているため、http:// のサーバーが遮断されている可能性があります。');
  }
  lines.push('・PC で npm run server が動いているか');
  lines.push('・スマホと PC が同じ Wi-Fi につながっているか');
  lines.push('・URL の IP アドレスとポート番号が合っているか');
  lines.push('・PC のファイアウォールが通信を許可しているか');
  lines.push(`（詳細: ${detail}）`);
  return lines.join('\n');
}

/** 同期状態をリセットして次回フル取得させる。 */
export function resetSyncCursor(): void {
  setLastPushedAt(0);
}
