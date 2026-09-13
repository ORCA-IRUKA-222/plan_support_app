import type { AnyRecord } from '../domain/types';

/**
 * Last-Write-Wins マージ。
 * updatedAt が大きい方を採用し、同値なら incoming (サーバー側) を採用して
 * どの端末から見ても同じ結果になるようにする。
 */
export function mergeRecord(local: AnyRecord | undefined, incoming: AnyRecord): AnyRecord {
  if (!local) return incoming;
  return incoming.updatedAt >= local.updatedAt ? incoming : local;
}

export function mergeAll(
  base: Record<string, AnyRecord>,
  incoming: AnyRecord[],
): { next: Record<string, AnyRecord>; changed: number } {
  let changed = 0;
  const next = { ...base };
  for (const rec of incoming) {
    const merged = mergeRecord(next[rec.id], rec);
    if (merged !== next[rec.id]) {
      next[rec.id] = merged;
      changed++;
    }
  }
  return { next, changed };
}

/** 墓標 (deleted) は一定期間で捨てる。既定は90日。 */
export function pruneTombstones(
  records: Record<string, AnyRecord>,
  nowMs: number,
  keepMs = 90 * 24 * 60 * 60 * 1000,
): Record<string, AnyRecord> {
  const out: Record<string, AnyRecord> = {};
  for (const [id, rec] of Object.entries(records)) {
    if (rec.deleted && nowMs - rec.updatedAt > keepMs) continue;
    out[id] = rec;
  }
  return out;
}
