// 道場犬 서비스 워커: 앱 셸을 캐시해서 오프라인에서도 실행된다.
// 범위는 이 파일이 있는 폴더(예: /opic/dojo-dog/)뿐이고, 캐시 이름은 「dojoinu-」로 시작하는 것만 만들고 지운다.
const VERSION = 'bfdf1d1d2d';
const CACHE = 'dojoinu-' + VERSION;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-64.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('dojoinu-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 글꼴은 받아 둔 것을 먼저 쓰고, 뒤에서 갱신한다
  if (url.origin.includes('fonts.g')) {
    e.respondWith(
      caches.open(CACHE + '-fonts').then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((r) => (c.put(req, r.clone()), r)).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }
  if (url.origin !== location.origin) return;
  // 페이지 이동은 캐시된 index.html로
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put('./index.html', copy));
      return r;
    }).catch(() => caches.open(CACHE).then((c) => c.match('./index.html'))));
    return;
  }
  // 같은 출처의 다른 사이트 캐시를 보지 않도록, 이 앱의 캐시에서만 찾는다
  e.respondWith(caches.open(CACHE).then((c) => c.match(req)).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return r;
  })));
});
