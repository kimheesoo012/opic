/* 오프라인 실행용 서비스 워커 (tools/build-sw.cjs가 만든다. 직접 고치지 말 것)
   앱 파일은 미리 저장하고, 글꼴(Google Fonts)은 처음 받을 때 저장한다. */
const VERSION = 'talk-notes-f9f0e9958e';
const FONTS = 'talk-notes-fonts';
const ASSETS = [
  './',
  './css/app.css',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './index.html',
  './js/app.js',
  './js/core/deck.js',
  './js/core/game.js',
  './js/core/speech.js',
  './js/core/srs.js',
  './js/core/store.js',
  './js/core/text.js',
  './js/data/notes.js',
  './js/ui/card.js',
  './js/ui/home.js',
  './js/ui/items.js',
  './js/ui/note.js',
  './js/ui/practice.js',
  './js/ui/session.js',
  './js/ui/settings.js',
  './js/ui/stats.js',
  './js/ui/ui.js',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS && k.startsWith('talk-notes')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
