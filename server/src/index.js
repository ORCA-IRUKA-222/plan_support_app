import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { resolvePaths } from './paths.js';

/**
 * PC で画面を開くためだけの静的ファイルサーバー。
 *
 * 端末間の同期は GitHub Gist が受け持つので、このサーバーにデータは残らない。
 * ブラウザが file:// では動かない仕組み (Service Worker など) を使うため、
 * 手元でも HTTP で配る必要がある。
 */
const { staticDir: STATIC_DIR } = resolvePaths();
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

async function serve(res, urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let file = join(STATIC_DIR, rel);
  // ディレクトリトラバーサル防止: 解決後のパスが STATIC_DIR 配下であることを確認する。
  if (file !== STATIC_DIR && !file.startsWith(STATIC_DIR + sep)) return send(res, 403, 'forbidden');

  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    file = join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }
  if (!info) {
    // SPA なので未知のパスは index.html に落とす。
    file = join(STATIC_DIR, 'index.html');
    info = await stat(file).catch(() => null);
    if (!info) return send(res, 404, 'ビルドされていません。npm run build を実行してください。');
  }

  send(res, 200, await readFile(file), {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
  });
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname === '/health') return send(res, 200, 'ok');
  await serve(res, url.pathname);
});

server.listen(PORT, HOST, async () => {
  const hasStatic = await stat(STATIC_DIR).then((s) => s.isDirectory()).catch(() => false);
  console.log(`画面を配信中: http://localhost:${PORT}`);
  console.log(`  ファイル: ${STATIC_DIR}${hasStatic ? '' : '  ← 見つかりません。先に npm run build を実行してください'}`);
  console.log('  同期は GitHub Gist が行うので、このサーバーにデータは保存されません。');
});
