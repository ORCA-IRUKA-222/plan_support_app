export const ROUTES = [
  { id: 'dashboard', label: 'ダッシュボード', ico: '◎', group: '進行' },
  { id: 'notes', label: 'ネタ帳', ico: '✎', group: '進行', phase: 0 },
  { id: 'seeds', label: '種出し', ico: '⁂', group: '進行', phase: 1 },
  { id: 'core', label: '核を決める', ico: '●', group: '進行', phase: 2 },
  { id: 'skeleton', label: '骨格を検証', ico: '⌘', group: '進行', phase: 3 },
  { id: 'proposal', label: '企画書', ico: '▤', group: '進行', phase: 4 },
  { id: 'present', label: '発表', ico: '▶', group: '進行' },
  { id: 'methods', label: '思考ツール', ico: '✦', group: '道具' },
  { id: 'frameworks', label: 'フレームワーク', ico: '⊞', group: '道具' },
  { id: 'settings', label: '設定・同期', ico: '⚙', group: '道具' },
] as const;

export type RouteId = (typeof ROUTES)[number]['id'];

/** モバイルのタブバーに出す5つ。 */
export const TAB_ROUTES: RouteId[] = ['dashboard', 'notes', 'seeds', 'proposal', 'methods'];

export function parseHash(hash: string): RouteId {
  const id = hash.replace(/^#\/?/, '').split('/')[0] ?? '';
  return (ROUTES.find((r) => r.id === id)?.id ?? 'dashboard') as RouteId;
}
