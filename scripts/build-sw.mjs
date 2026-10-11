import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { loadContent } from './load-content.mjs'
const { phrases, words } = await loadContent()
for (const p of [...phrases, ...words]) if (!existsSync(join('dist', p.audio))) throw new Error(`음성 없음: ${p.id}. npm run audio:generate 또는 개인 소유 WAV 자산을 먼저 제공하세요.`)
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])
const files = walk('dist').filter(f => !f.endsWith('sw.js')).sort()
const hash = createHash('sha256')
for (const file of files) hash.update(readFileSync(file))
const version = `my-en-${hash.digest('hex').slice(0, 12)}`
const urls = files.map(f => '/' + f.slice(5))
writeFileSync('dist/sw.js', `// Generated offline cache. Own origin only; no remote speech or uploads.
const CACHE = ${JSON.stringify(version)};
const FILES = ${JSON.stringify(urls)};
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try { await cache.addAll(FILES); } catch (error) { await caches.delete(CACHE); throw error; }
  })());
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('my-en-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message', e => {
  if (e.data?.type === 'CHECK_READY') e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const ready = (await Promise.all(FILES.map(file => cache.match(file)))).every(Boolean);
    e.ports[0]?.postMessage({ ready });
  })());
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const path = e.request.mode === 'navigate' ? '/index.html' : url.pathname;
    const hit = await cache.match(path);
    if (!hit) return fetch(e.request);
    // Media elements may request byte ranges; serve an honest 206 for cached WAV.
    const range = e.request.headers.get('range');
    if (range && path.endsWith('.wav')) {
      const bytes = await hit.arrayBuffer(), match = /^bytes=(\\d+)-(\\d*)$/.exec(range);
      if (match) {
        const start = Number(match[1]), end = Math.min(match[2] ? Number(match[2]) : bytes.byteLength - 1, bytes.byteLength - 1);
        if (start > end || start >= bytes.byteLength) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + bytes.byteLength } });
        return new Response(bytes.slice(start, end + 1), { status: 206, headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(end-start+1), 'Content-Range': 'bytes ' + start + '-' + end + '/' + bytes.byteLength, 'Accept-Ranges': 'bytes' } });
      }
    }
    return hit;
  })());
});
`)
console.log(`Offline bundle ${version}: ${urls.length} files, ${phrases.length + words.length} voices`)
