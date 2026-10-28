// 자동 생성 파일 (tools/build.mjs) — 직접 수정하지 마세요.
const VERSION = '71c83fe1a9f4';
const CACHE = 'toeicja-' + VERSION;
const PRECACHE = ["./","css/app.css","data/concepts.json","data/index.json","data/p5-1.json","data/p5-2.json","data/p5-3.json","data/p5-4.json","data/p5-5.json","data/p5-6.json","data/p6-2.json","data/p6.json","data/p7-1.json","data/p7-2.json","data/p7-3.json","data/p7-4.json","data/p7-5.json","data/p7-6.json","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","js/app.js","js/bank.js","js/ctx.js","js/game.js","js/player.js","js/recommend.js","js/review.js","js/schema.js","js/scoring.js","js/screens.js","js/selection.js","js/sessions.js","js/sound.js","js/stats.js","js/store.js","js/ui.js","js/util.js","manifest.webmanifest"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('toeicja-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 캐시 우선(오프라인 실행), 없으면 네트워크 후 캐시에 저장. 페이지 이동은 index.html로.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html', { ignoreSearch: true }).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
