import { describe, expect, it } from 'vitest';
import { mergeAll, mergeRecord, pruneTombstones } from './merge';
import type { AnyRecord, Note } from '../domain/types';

const note = (id: string, updatedAt: number, body: string, deleted = false): Note => ({
  id, kind: 'note', updatedAt, body, projectId: null, tags: [], source: null, deleted,
});

describe('mergeRecord', () => {
  it('ローカルが無ければ受信側を採用する', () => {
    const incoming = note('a', 100, 'x');
    expect(mergeRecord(undefined, incoming)).toBe(incoming);
  });

  it('updatedAt が新しいほうを採用する', () => {
    const local = note('a', 200, 'local');
    const incoming = note('a', 100, 'server');
    expect(mergeRecord(local, incoming)).toBe(local);
  });

  it('同着ならサーバー側を採用して結果を決定的にする', () => {
    const local = note('a', 100, 'local');
    const incoming = note('a', 100, 'server');
    expect(mergeRecord(local, incoming)).toBe(incoming);
  });

  it('新しい削除は生きているレコードに勝つ', () => {
    const local = note('a', 100, 'local');
    const incoming = note('a', 150, 'local', true);
    expect(mergeRecord(local, incoming).deleted).toBe(true);
  });

  it('古い削除は新しい編集に負ける（復活する）', () => {
    const local = note('a', 300, 'edited');
    const incoming = note('a', 150, 'old', true);
    expect(mergeRecord(local, incoming)).toBe(local);
  });
});

describe('mergeAll', () => {
  it('変更のあった件数だけを数える', () => {
    const base: Record<string, AnyRecord> = { a: note('a', 200, 'local'), b: note('b', 100, 'b') };
    const { next, changed } = mergeAll(base, [note('a', 100, 'stale'), note('c', 50, 'new')]);
    expect(changed).toBe(1);
    expect((next.a as Note).body).toBe('local');
    expect(next.c).toBeDefined();
  });

  it('元のオブジェクトを書き換えない', () => {
    const base: Record<string, AnyRecord> = { a: note('a', 100, 'x') };
    mergeAll(base, [note('a', 200, 'y')]);
    expect((base.a as Note).body).toBe('x');
  });

  it('端末A・端末Bのどちらから適用しても同じ結果になる', () => {
    const server = note('a', 300, 'from-server');
    const localA = note('a', 200, 'from-a');
    const localB = note('a', 250, 'from-b');
    const resA = mergeAll(mergeAll({ a: localA }, [localB]).next, [server]).next;
    const resB = mergeAll(mergeAll({ a: localB }, [localA]).next, [server]).next;
    expect((resA.a as Note).body).toBe('from-server');
    expect((resB.a as Note).body).toBe('from-server');
  });
});

describe('pruneTombstones', () => {
  const day = 24 * 60 * 60 * 1000;
  it('保持期間を過ぎた削除済みレコードだけを落とす', () => {
    const nowMs = 1_000 * day;
    const records: Record<string, AnyRecord> = {
      old: note('old', nowMs - 100 * day, '', true),
      recent: note('recent', nowMs - 10 * day, '', true),
      live: note('live', nowMs - 200 * day, 'alive'),
    };
    const out = pruneTombstones(records, nowMs);
    expect(Object.keys(out).sort()).toEqual(['live', 'recent']);
  });
});
