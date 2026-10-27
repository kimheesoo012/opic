/* 오프라인 실행용 서비스 워커: 앱 파일을 미리 저장하고, 오프라인이면 저장본으로 연다.
   온라인이면 항상 최신 파일을 먼저 받아(네트워크 우선) 저장본을 갱신하므로, 앱을 고치면 휴대폰에도 바로 반영된다.
   VERSION은 미리 저장할 파일 목록이 바뀔 때 올린다. */
const VERSION = 'opic-app-v2';
const ASSETS = [
    './',
    './css/app.css',
    './icons/apple-touch-icon.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './index.html',
    './js/app.js',
    './js/core/analysis.js',
    './js/core/backup.js',
    './js/core/db.js',
    './js/core/picker.js',
    './js/core/prompt.js',
    './js/core/quiz.js',
    './js/core/recorder.js',
    './js/core/script.js',
    './js/core/store.js',
    './js/core/stt.js',
    './js/core/tts.js',
    './js/core/util.js',
    './js/core/xp.js',
    './js/data/drills.js',
    './js/data/questions.js',
    './js/data/survey.js',
    './js/ui/bank.js',
    './js/ui/card.js',
    './js/ui/common.js',
    './js/ui/components.js',
    './js/ui/exam.js',
    './js/ui/home.js',
    './js/ui/impromptu.js',
    './js/ui/notes.js',
    './js/ui/progress.js',
    './js/ui/records.js',
    './js/ui/run.js',
    './js/ui/scripts.js',
    './js/ui/settings.js',
    './js/ui/story.js',
    './manifest.webmanifest',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  /* 같은 주소(github.io)를 쓰는 다른 앱의 캐시는 건드리지 않고, 이 앱의 옛 캐시만 지운다 */
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('opic-app-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* 네트워크 우선: 3초 안에 응답이 없거나 오프라인이면 저장본 */
function networkFirst(req, cacheKey) {
  return new Promise(resolve => {
    let done = false;
    const fallback = () => caches.open(VERSION).then(c => c.match(cacheKey || req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? c.match('./') : undefined)));
    const timer = setTimeout(() => { fallback().then(hit => { if (hit && !done) { done = true; resolve(hit); } }); }, 3000);
    fetch(req).then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(cacheKey || req, copy)); }
      if (!done) { done = true; clearTimeout(timer); resolve(res); }
    }).catch(() => fallback().then(hit => { if (!done) { done = true; clearTimeout(timer); resolve(hit || Response.error()); } }));
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(networkFirst(req, req.mode === 'navigate' ? './index.html' : null));
});
