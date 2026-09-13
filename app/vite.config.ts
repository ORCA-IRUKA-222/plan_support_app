import { createHash } from 'node:crypto';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * ビルド成果物を列挙して Service Worker を出力する。
 *
 * これがないと、PC (同期サーバー) の電源が入っていないときスマホの PWA が
 * まったく開けない。画面一式を端末にキャッシュしておくことで、
 * サーバーが落ちていても起動できるようにする。
 */
function serviceWorker(): Plugin {
  return {
    name: 'kikaku-service-worker',
    apply: 'build',
    closeBundle() {
      const outDir = join(import.meta.dirname, 'dist');

      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((name) => {
          const full = join(dir, name);
          return statSync(full).isDirectory() ? walk(full) : [full];
        });

      const files = walk(outDir)
        .map((f) => relative(outDir, f).split(sep).join('/'))
        // ソースマップは重いだけで、オフライン起動には要らない。
        .filter((f) => !f.endsWith('.map') && f !== 'sw.js')
        .sort();

      // ファイル名が1つでも変われば別キャッシュになり、古い版は activate で消える。
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12);
      const precache = ['./', ...files.map((f) => `./${f}`)];

      writeFileSync(join(outDir, 'sw.js'), renderServiceWorker(version, precache), 'utf8');
      this.info?.(`service worker: ${files.length} ファイルをプリキャッシュ (${version})`);
    },
  };
}

function renderServiceWorker(version: string, precache: string[]): string {
  return `// 自動生成。編集しても次のビルドで上書きされます。
const CACHE = 'kikaku-${version}';
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // 同期APIは絶対にキャッシュしない。古い応答を返すと同期が壊れる。
  if (url.pathname.startsWith('/api/')) return;

  // 画面遷移はネットワーク優先。つながらなければキャッシュした index.html を返す。
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('./index.html').then((hit) => hit || caches.match('./')).then(
          (hit) => hit || new Response('オフラインです', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }),
        ),
      ),
    );
    return;
  }

  // それ以外はキャッシュ優先。ファイル名にハッシュが入るので中身は変わらない。
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    }),
  );
});
`;
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  // Capacitor は file:// から index.html を読み込むため相対パスで出力する。
  base: './',
  build: { outDir: 'dist', sourcemap: true },
  server: { port: 5173, host: true },
});
