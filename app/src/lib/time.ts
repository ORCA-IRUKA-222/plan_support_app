let lastIssued = 0;

/**
 * 単調増加するタイムスタンプ。
 * 端末時計が巻き戻っても、同一セッション内では必ず前回より大きい値を返す。
 * これがないと LWW マージで「古い編集が新しい編集に勝つ」事故が起きる。
 */
export function now(): number {
  const t = Date.now();
  lastIssued = t > lastIssued ? t : lastIssued + 1;
  return lastIssued;
}

/** テスト用。 */
export function __resetClock(): void {
  lastIssued = 0;
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
