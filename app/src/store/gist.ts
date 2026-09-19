/**
 * 端末間同期（GitHub Gist）
 *
 * 秘密の Gist を1つ作り、そこに JSON を読み書きすることでスマホ⇔PC を揃える。
 * 自前のサーバーは要らず、外出先からでも同期できる。
 *
 * トークンはその端末の localStorage にだけ保存され、GitHub 以外へは送信しない。
 * Gist に書き込むデータにもトークンは含めない（含めると GitHub が漏洩と判定し、
 * トークンを自動で無効化してしまう）。
 */
import type { AnyRecord } from '../domain/types';

export const FILENAME = 'kikaku-bansou.json';
const API = 'https://api.github.com';

export interface GistPayload {
  app: 'kikaku-bansou';
  version: 1;
  updatedAt: number;
  records: Record<string, AnyRecord>;
}

export interface GistConfig {
  token: string;
  gistId: string;
}

export class GistError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'GistError';
  }
}

/** 同じ説明を何度も書かないよう、状態コードから利用者向けの文言を作る。 */
function messageFor(status: number): string {
  if (status === 401) return 'トークンが GitHub に認識されませんでした。「接続をテスト」で詳しく調べられます。';
  if (status === 403) return 'アクセスが拒否されました。トークンに gist 権限があるか確認してください。';
  if (status === 404) return 'Gist が見つかりません。ID が違うか、削除されている可能性があります。';
  if (status === 422) return 'GitHub がデータを受け付けませんでした。内容が大きすぎないか確認してください。';
  return `GitHub との通信でエラーが起きました (${status})。`;
}

async function api(token: string, path: string, init: RequestInit = {}): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(API + path, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new GistError('GitHub に接続できませんでした。通信環境を確認してください。');
  }
  if (!res.ok) throw new GistError(messageFor(res.status), res.status);
  return res.json();
}

interface GistFile { content?: string; truncated?: boolean; raw_url?: string }
interface GistResponse { id: string; files?: Record<string, GistFile> }

/** Gist から記録を読み出す。まだ中身が無ければ空を返す。 */
export async function fetchRecords(cfg: GistConfig): Promise<Record<string, AnyRecord>> {
  const gist = (await api(cfg.token, `/gists/${cfg.gistId}`)) as GistResponse;
  const file = gist.files?.[FILENAME] ?? Object.values(gist.files ?? {})[0];
  if (!file) return {};

  // 大きい Gist は content が切り詰められるので、その場合は raw_url から取り直す。
  let text = file.content ?? '';
  if (file.truncated && file.raw_url) {
    const raw = await fetch(file.raw_url);
    if (!raw.ok) throw new GistError(`Gist の本文を取得できませんでした (${raw.status})`, raw.status);
    text = await raw.text();
  }
  if (!text.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GistError('Gist の中身が壊れていて読み取れませんでした。');
  }
  const payload = parsed as Partial<GistPayload>;
  if (!payload || typeof payload.records !== 'object' || payload.records === null) {
    throw new GistError('Gist の中身がこのアプリの形式ではありません。');
  }
  return payload.records as Record<string, AnyRecord>;
}

function encode(records: Record<string, AnyRecord>, token: string): string {
  const payload: GistPayload = {
    app: 'kikaku-bansou',
    version: 1,
    updatedAt: Date.now(),
    records,
  };
  const content = JSON.stringify(payload, null, 1);
  // 保険。トークンが混ざったまま送ると GitHub にトークンを無効化される。
  if (token && content.includes(token)) {
    throw new GistError('内部エラーのため中止しました（送信データにトークンが含まれています）。');
  }
  return content;
}

/** Gist へ記録を書き込む。 */
export async function pushRecords(cfg: GistConfig, records: Record<string, AnyRecord>): Promise<void> {
  await api(cfg.token, `/gists/${cfg.gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [FILENAME]: { content: encode(records, cfg.token) } } }),
  });
}

/** 秘密の Gist を新しく作り、その ID を返す。 */
export async function createGist(token: string, records: Record<string, AnyRecord>): Promise<string> {
  const created = (await api(token, '/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: '企画伴走のデータ（自動生成・非公開）',
      public: false,
      files: { [FILENAME]: { content: encode(records, token) } },
    }),
  })) as GistResponse;
  if (!created.id) throw new GistError('Gist は作成できましたが ID を取得できませんでした。');
  return created.id;
}

export interface Diagnosis {
  ok: boolean;
  user?: string;
  message: string;
}

/**
 * トークンの状態を調べる。
 * 401（トークンそのものが違う）と、権限不足（gist スコープなし / fine-grained）を
 * はっきり区別して伝える。ここが曖昧だと利用者は原因にたどり着けない。
 */
export async function diagnose(rawToken: string): Promise<Diagnosis> {
  const token = rawToken.trim();
  if (!token) return { ok: false, message: 'アクセストークンが入力されていません。' };

  let res: Response;
  try {
    res = await fetch(`${API}/user`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    return { ok: false, message: 'GitHub に接続できませんでした。通信環境を確認してください。' };
  }

  if (res.status === 401) {
    return {
      ok: false,
      message:
        'トークンが GitHub に認識されませんでした。\n' +
        '・先頭の ghp_ から末尾まで、全体をコピーできていますか\n' +
        '・前後や途中に空白・改行が入っていませんか\n' +
        '・有効期限が切れていたり、削除していませんか\n' +
        '・Gist ID 欄とトークン欄を逆に入れていませんか\n' +
        '心当たりがなければ、トークンを作り直すのが確実です。',
    };
  }
  if (!res.ok) {
    return { ok: false, message: `GitHub がエラーを返しました (${res.status})。時間をおいて試してください。` };
  }

  const user = ((await res.json()) as { login?: string }).login ?? '(不明)';
  const scopes = (res.headers.get('X-OAuth-Scopes') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (scopes.length === 0) {
    return {
      ok: false,
      user,
      message:
        `${user} として認証できましたが、このトークンには gist 権限がありません。\n` +
        'Fine-grained token は Gist に対応していません。\n' +
        'Tokens (classic) から、gist にチェックを入れて作り直してください。',
    };
  }
  if (!scopes.includes('gist')) {
    return {
      ok: false,
      user,
      message:
        `${user} として認証できましたが、gist 権限がありません。\n` +
        `現在の権限: ${scopes.join(', ')}\n` +
        'GitHub のトークン設定画面で gist にチェックを入れて更新してください。',
    };
  }
  return { ok: true, user, message: `${user} として接続できました。gist 権限もあります。` };
}
