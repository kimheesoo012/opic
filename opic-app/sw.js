/* 오프라인 실행용 서비스 워커: 앱 파일을 미리 저장하고, 오프라인이면 저장본으로 연다.
   파일을 바꾸면 VERSION을 올려야 휴대폰에 새 버전이 적용된다. */
const VERSION = 'opic-app-v1';
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
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    /* 화면 이동: 네트워크 우선, 안 되면 저장본 */
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  /* 앱 파일: 저장본 우선, 없으면 네트워크에서 받아 저장 */
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
