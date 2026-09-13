import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 既定パスはカレントディレクトリではなく、このファイルの位置から決める。
 *
 * npm workspaces 経由 (npm run server) で起動すると cwd が server/ になる。
 * cwd 基準で解決すると server/app/dist を探しに行き、画面が全部 404 になる。
 */
export function resolvePaths(env = process.env, moduleUrl = import.meta.url) {
  const here = dirname(fileURLToPath(moduleUrl));
  const serverRoot = resolve(here, '..');
  const repoRoot = resolve(here, '../..');
  return {
    serverRoot,
    repoRoot,
    dbFile: env.DB_FILE ? resolve(env.DB_FILE) : resolve(serverRoot, 'data/sync.sqlite'),
    staticDir: env.STATIC_DIR ? resolve(env.STATIC_DIR) : resolve(repoRoot, 'app/dist'),
  };
}
