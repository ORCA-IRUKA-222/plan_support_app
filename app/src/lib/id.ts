/** 端末をまたいで衝突しないID。crypto.randomUUID があれば使う。 */
export function uid(prefix = ''): string {
  const g = globalThis.crypto;
  const core =
    g && typeof g.randomUUID === 'function'
      ? g.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random()
          .toString(36)
          .slice(2, 10)}`;
  return prefix ? `${prefix}_${core}` : core;
}

/** 端末IDは初回起動時に1つ生成して保持する。 */
export function deviceId(storage: Pick<Storage, 'getItem' | 'setItem'>): string {
  const key = 'kikaku.deviceId';
  const found = storage.getItem(key);
  if (found) return found;
  const made = uid('dev');
  storage.setItem(key, made);
  return made;
}
