import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { openDb, stats, sync } from './db.js';
import { resolvePaths } from './paths.js';

const { dbFile: DB_FILE, staticDir: STATIC_DIR } = resolvePaths();

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
/** 未設定なら誰でも任意の合言葉でワークスペースを作れる。LAN 内利用向けの既定。 */
const ALLOWED_KEYS = (process.env.WORKSPACE_KEYS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_BODY = 8 * 1024 * 1024;

const db = openDb(DB_FILE);

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

function equals(a, b) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

function authorize(key) {
  if (!key) return false;
  if (ALLOWED_KEYS.length === 0) return key.length >= 8;
  return ALLOWED_KEYS.some((allowed) => equals(allowed, key));
}

/** 合言葉そのものはDBに保存せず、ハッシュをワークスペースIDにする。 */
const workspaceOf = (key) => createHash('sha256').update(key).digest('hex').slice(0, 32);

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Workspace-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((res, rej) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        rej(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rej);
  });
}

async function serveStatic(req, res, urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let file = join(STATIC_DIR, rel);
  // ディレクトリトラバーサル防止: 解決後のパスが STATIC_DIR 配下であることを確認する。
  if (file !== STATIC_DIR && !file.startsWith(STATIC_DIR + sep)) return send(res, 403, { error: 'forbidden' });

  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    file = join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }
  if (!info) {
    // SPA なので未知のパスは index.html に落とす。
    file = join(STATIC_DIR, 'index.html');
    info = await stat(file).catch(() => null);
    if (!info) return send(res, 404, { error: 'not found' });
  }
  const data = await readFile(file);
  send(res, 200, data, {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (url.pathname === '/api/health') {
    return send(res, 200, { ok: true, keyRequired: ALLOWED_KEYS.length > 0 });
  }

  if (url.pathname === '/api/sync' || url.pathname === '/api/stats') {
    const key = req.headers['x-workspace-key'];
    if (typeof key !== 'string' || !authorize(key)) {
      return send(res, 401, { error: '合言葉が不正です (8文字以上、サーバー設定と一致が必要)' });
    }
    const workspace = workspaceOf(key);

    if (url.pathname === '/api/stats') return send(res, 200, stats(db, workspace));

    if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, { error: 'invalid json' });
    }
    const cursor = Number.isFinite(payload?.cursor) ? payload.cursor : 0;
    const changes = Array.isArray(payload?.changes) ? payload.changes : [];
    try {
      return send(res, 200, sync(db, workspace, cursor, changes));
    } catch (err) {
      console.error('[sync]', err);
      return send(res, 500, { error: 'sync failed' });
    }
  }

  if (req.method === 'GET') return serveStatic(req, res, url.pathname);
  return send(res, 404, { error: 'not found' });
});

server.listen(PORT, HOST, async () => {
  console.log(`同期サーバー起動: http://${HOST}:${PORT}`);
  console.log(`  DB       : ${DB_FILE}`);
  const hasStatic = await stat(STATIC_DIR).then((s) => s.isDirectory()).catch(() => false);
  console.log(`  静的配信 : ${STATIC_DIR}${hasStatic ? '' : '  ← 見つかりません。npm run build を先に実行してください (API のみ動作)'}`);
  console.log(`  合言葉   : ${ALLOWED_KEYS.length ? `${ALLOWED_KEYS.length} 件を許可` : '任意 (8文字以上)'}`);
});
