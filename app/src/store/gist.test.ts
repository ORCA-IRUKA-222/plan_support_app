import { afterEach, describe, expect, it, vi } from 'vitest';
import { FILENAME, GistError, createGist, diagnose, fetchRecords, pushRecords } from './gist';
import type { AnyRecord, Note } from '../domain/types';

const note = (id: string, updatedAt: number, body: string): Note => ({
  id, kind: 'note', updatedAt, body, projectId: null, tags: [], source: null,
});

const CFG = { token: 'ghp_testtoken', gistId: 'abc123' };

/** fetch を差し替えて、GitHub の応答を好きに作る。 */
function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init));
  vi.stubGlobal('fetch', spy);
  return spy;
}

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

const gistWith = (records: Record<string, AnyRecord>) =>
  jsonResponse({
    id: CFG.gistId,
    files: {
      [FILENAME]: {
        content: JSON.stringify({ app: 'kikaku-bansou', version: 1, updatedAt: 1, records }),
      },
    },
  });

afterEach(() => vi.unstubAllGlobals());

describe('fetchRecords', () => {
  it('Gist から記録を読み出す', async () => {
    stubFetch(() => gistWith({ a: note('a', 100, 'メモ') }));
    const records = await fetchRecords(CFG);
    expect((records.a as Note).body).toBe('メモ');
  });

  it('中身が空なら空を返す', async () => {
    stubFetch(() => jsonResponse({ id: CFG.gistId, files: {} }));
    expect(await fetchRecords(CFG)).toEqual({});
  });

  it('truncated なら raw_url から取り直す', async () => {
    const records = { a: note('a', 100, '大きいメモ') };
    const calls: string[] = [];
    stubFetch((url) => {
      calls.push(url);
      if (url.includes('raw')) {
        return new Response(JSON.stringify({ app: 'kikaku-bansou', version: 1, updatedAt: 1, records }));
      }
      return jsonResponse({
        id: CFG.gistId,
        files: { [FILENAME]: { content: '切り詰め', truncated: true, raw_url: 'https://raw/x' } },
      });
    });
    const out = await fetchRecords(CFG);
    expect((out.a as Note).body).toBe('大きいメモ');
    expect(calls.some((c) => c.includes('raw'))).toBe(true);
  });

  it('壊れた JSON は分かる形で失敗する', async () => {
    stubFetch(() => jsonResponse({ id: CFG.gistId, files: { [FILENAME]: { content: '{ not json' } } }));
    await expect(fetchRecords(CFG)).rejects.toThrow(/壊れて/);
  });

  it('別形式の JSON は受け付けない', async () => {
    stubFetch(() => jsonResponse({ id: CFG.gistId, files: { [FILENAME]: { content: '{"hello":1}' } } }));
    await expect(fetchRecords(CFG)).rejects.toThrow(/形式/);
  });

  it('404 は Gist が見つからない旨を伝える', async () => {
    stubFetch(() => jsonResponse({}, { status: 404 }));
    await expect(fetchRecords(CFG)).rejects.toThrow(/見つかりません/);
  });

  it('401 はトークンの問題だと伝える', async () => {
    stubFetch(() => jsonResponse({}, { status: 401 }));
    await expect(fetchRecords(CFG)).rejects.toThrow(/トークン/);
  });

  it('通信できないときも例外の型をそろえる', async () => {
    stubFetch(() => { throw new TypeError('network down'); });
    await expect(fetchRecords(CFG)).rejects.toBeInstanceOf(GistError);
  });
});

describe('pushRecords', () => {
  it('PATCH で所定のファイル名に書き込む', async () => {
    let sent: { files?: Record<string, { content: string }> } | null = null;
    stubFetch((url, init) => {
      expect(init?.method).toBe('PATCH');
      expect(url).toContain(`/gists/${CFG.gistId}`);
      sent = JSON.parse(String(init?.body));
      return jsonResponse({ id: CFG.gistId });
    });
    await pushRecords(CFG, { a: note('a', 100, 'x') });
    const payload = JSON.parse(sent!.files![FILENAME]!.content);
    expect(payload.app).toBe('kikaku-bansou');
    expect(payload.records.a.body).toBe('x');
  });

  it('トークンが混ざったデータは送らない', async () => {
    // Gist にトークンが入ると GitHub が漏洩と判定してトークンを失効させる。
    const spy = stubFetch(() => jsonResponse({ id: CFG.gistId }));
    const leaky = { a: note('a', 100, `うっかり ${CFG.token} を書いたメモ`) };
    await expect(pushRecords(CFG, leaky)).rejects.toThrow(/トークンが含まれ/);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('createGist', () => {
  it('非公開で作り、ID を返す', async () => {
    let body: { public?: boolean } | null = null;
    stubFetch((url, init) => {
      expect(url).toMatch(/\/gists$/);
      body = JSON.parse(String(init?.body));
      return jsonResponse({ id: 'newid' });
    });
    expect(await createGist(CFG.token, {})).toBe('newid');
    expect(body!.public).toBe(false);
  });
});

describe('diagnose', () => {
  const userResponse = (scopes: string | null) =>
    new Response(JSON.stringify({ login: 'orca' }), {
      status: 200,
      headers: scopes === null ? {} : { 'X-OAuth-Scopes': scopes },
    });

  it('未入力を検出する', async () => {
    expect((await diagnose('   ')).ok).toBe(false);
  });

  it('gist 権限があれば成功', async () => {
    stubFetch(() => userResponse('gist, repo'));
    const d = await diagnose(CFG.token);
    expect(d.ok).toBe(true);
    expect(d.user).toBe('orca');
  });

  it('401 はトークン自体の誤りとして案内する', async () => {
    stubFetch(() => new Response('{}', { status: 401 }));
    const d = await diagnose(CFG.token);
    expect(d.ok).toBe(false);
    expect(d.message).toMatch(/認識されませんでした/);
  });

  it('スコープが無い場合は fine-grained の可能性を案内する', async () => {
    stubFetch(() => userResponse(null));
    const d = await diagnose(CFG.token);
    expect(d.ok).toBe(false);
    expect(d.message).toMatch(/Fine-grained/);
  });

  it('gist が含まれないスコープは現在の権限を示す', async () => {
    stubFetch(() => userResponse('repo, workflow'));
    const d = await diagnose(CFG.token);
    expect(d.ok).toBe(false);
    expect(d.message).toMatch(/repo, workflow/);
  });
});
