import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, stats, sync } from '../src/db.js';

const rec = (id, updatedAt, body = 'x') => ({ id, kind: 'note', updatedAt, body });
const WS = 'ws-test';

let db;
beforeEach(() => { db = openDb(':memory:'); });

describe('sync', () => {
  test('送ったレコードが保存され、カーソルが進む', () => {
    const res = sync(db, WS, 0, [rec('a', 100), rec('b', 100)]);
    assert.equal(res.changes.length, 2);
    assert.equal(res.cursor, 2);
    assert.equal(stats(db, WS).records, 2);
  });

  test('カーソル以降の変更だけを返す', () => {
    const first = sync(db, WS, 0, [rec('a', 100)]);
    const second = sync(db, WS, first.cursor, [rec('b', 200)]);
    assert.deepEqual(second.changes.map((c) => c.id), ['b']);
  });

  test('古い更新は無視される (LWW)', () => {
    sync(db, WS, 0, [rec('a', 500, 'new')]);
    const res = sync(db, WS, 99, [rec('a', 100, 'old')]);
    const a = res.changes.find((c) => c.id === 'a');
    assert.equal(a.body, 'new');
    assert.equal(stats(db, WS).records, 1);
  });

  test('同じ updatedAt の再送でも履歴を増やさない', () => {
    sync(db, WS, 0, [rec('a', 100)]);
    const before = stats(db, WS).cursor;
    sync(db, WS, 0, [rec('a', 100)]);
    assert.equal(stats(db, WS).cursor, before);
  });

  test('ワークスペースが違えば互いに見えない', () => {
    sync(db, 'alice', 0, [rec('a', 100)]);
    const bob = sync(db, 'bob', 0, []);
    assert.equal(bob.changes.length, 0);
    assert.equal(stats(db, 'alice').records, 1);
    assert.equal(stats(db, 'bob').records, 0);
  });

  test('PC と Android の 2 端末が同じ状態に収束する', () => {
    // PC が a を作る
    const pc1 = sync(db, WS, 0, [rec('a', 100, 'pc')]);
    // Android が同期して a を受け取り、b を作る
    const an1 = sync(db, WS, 0, [rec('b', 150, 'android')]);
    assert.deepEqual(an1.changes.map((c) => c.id).sort(), ['a', 'b']);
    // PC が再同期すると b が届く
    const pc2 = sync(db, WS, pc1.cursor, []);
    assert.deepEqual(pc2.changes.map((c) => c.id), ['b']);
    // どちらも同じカーソルに揃う
    assert.equal(pc2.cursor, an1.cursor);
  });

  test('同じレコードを両端末で編集したら、あとの更新が残る', () => {
    sync(db, WS, 0, [rec('a', 100, 'pc')]);
    sync(db, WS, 0, [rec('a', 200, 'android')]);
    const res = sync(db, WS, 0, []);
    assert.equal(res.changes.find((c) => c.id === 'a').body, 'android');
  });

  test('壊れたレコードは黙って捨てる', () => {
    const res = sync(db, WS, 0, [null, { id: 5 }, { updatedAt: 1 }, rec('ok', 100)]);
    assert.deepEqual(res.changes.map((c) => c.id), ['ok']);
  });

  test('削除は墓標として伝わる', () => {
    sync(db, WS, 0, [rec('a', 100)]);
    sync(db, WS, 0, [{ ...rec('a', 200), deleted: true }]);
    const res = sync(db, WS, 0, []);
    assert.equal(res.changes.find((c) => c.id === 'a').deleted, true);
  });
});

describe('時計のずれに対する収束', () => {
  test('push が LWW で負けたら、カーソルが進んでいても勝者が返る', () => {
    // 端末A が新しい updatedAt で書き込む
    const a = sync(db, WS, 0, [rec('x', 500, 'winner')]);
    // 端末B は既に同期済み (cursor = a.cursor) だが、時計が遅れていて古い値を送る
    const b = sync(db, WS, a.cursor, [rec('x', 100, 'loser')]);
    const got = b.changes.find((c) => c.id === 'x');
    assert.ok(got, '負けたレコードの勝者が返るべき');
    assert.equal(got.body, 'winner');
  });

  test('勝者が二重に返らない', () => {
    sync(db, WS, 0, [rec('x', 500, 'winner')]);
    const res = sync(db, WS, 0, [rec('x', 100, 'loser')]);
    assert.equal(res.changes.filter((c) => c.id === 'x').length, 1);
  });
});
