import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * ワークスペース (合言葉) ごとにレコードを保持する。
 * seq はワークスペース内で単調増加し、クライアントの pull カーソルになる。
 * 端末の時計に依存しないので、時計がずれていても取りこぼさない。
 */
export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS records (
      workspace TEXT NOT NULL,
      id        TEXT NOT NULL,
      seq       INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      body      TEXT NOT NULL,
      PRIMARY KEY (workspace, id)
    );
    CREATE INDEX IF NOT EXISTS records_by_seq ON records (workspace, seq);
    CREATE TABLE IF NOT EXISTS counters (
      workspace TEXT PRIMARY KEY,
      seq       INTEGER NOT NULL
    );
  `);
  return db;
}

function nextSeq(db, workspace, count) {
  const row = db.prepare('SELECT seq FROM counters WHERE workspace = ?').get(workspace);
  const start = row ? row.seq : 0;
  const end = start + count;
  db.prepare(
    'INSERT INTO counters (workspace, seq) VALUES (?, ?) ON CONFLICT(workspace) DO UPDATE SET seq = excluded.seq',
  ).run(workspace, end);
  return start;
}

/**
 * 受け取った変更を LWW で取り込み、cursor 以降の変更を返す。
 *
 * 返す changes には2種類が混ざる:
 *   1. cursor より新しい seq を持つレコード (他端末の変更)
 *   2. 今回の push が LWW で負けたレコードの、サーバー側の勝者
 *
 * 2 が必要なのは端末間で時計がずれている場合。遅れた時計の端末が古い
 * updatedAt で送ると push は無視されるが、勝者の seq がその端末の cursor
 * 以下だと 1 では返らず、その端末だけ古い内容を持ち続けてしまう。
 * 負けたぶんを明示的に返すことで、必ず全端末が同じ状態に収束する。
 */
export function sync(db, workspace, cursor, changes) {
  const readOne = db.prepare('SELECT updatedAt, body FROM records WHERE workspace = ? AND id = ?');
  const write = db.prepare(
    `INSERT INTO records (workspace, id, seq, updatedAt, body) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(workspace, id) DO UPDATE SET seq = excluded.seq, updatedAt = excluded.updatedAt, body = excluded.body`,
  );

  db.exec('BEGIN IMMEDIATE');
  try {
    const accepted = [];
    const rejected = [];
    for (const rec of changes) {
      if (!rec || typeof rec.id !== 'string' || typeof rec.updatedAt !== 'number') continue;
      const existing = readOne.get(workspace, rec.id);
      if (existing && existing.updatedAt >= rec.updatedAt) {
        rejected.push(existing.body);
        continue;
      }
      accepted.push(rec);
    }

    let seq = nextSeq(db, workspace, accepted.length);
    for (const rec of accepted) {
      write.run(workspace, rec.id, ++seq, rec.updatedAt, JSON.stringify(rec));
    }

    const rows = db
      .prepare('SELECT seq, body FROM records WHERE workspace = ? AND seq > ? ORDER BY seq')
      .all(workspace, cursor);

    db.exec('COMMIT');

    const out = rows.map((r) => JSON.parse(r.body));
    const seen = new Set(out.map((r) => r.id));
    for (const body of rejected) {
      const rec = JSON.parse(body);
      if (!seen.has(rec.id)) {
        out.push(rec);
        seen.add(rec.id);
      }
    }

    const head = db.prepare('SELECT seq FROM counters WHERE workspace = ?').get(workspace);
    return { now: Date.now(), cursor: head ? head.seq : cursor, changes: out };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function stats(db, workspace) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM records WHERE workspace = ?').get(workspace);
  const head = db.prepare('SELECT seq FROM counters WHERE workspace = ?').get(workspace);
  return { records: row ? row.n : 0, cursor: head ? head.seq : 0 };
}
