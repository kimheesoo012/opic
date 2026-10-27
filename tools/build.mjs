// 빌드: ① sw.js 사전 캐시 목록·버전 생성 ② 단일 HTML 번들(dist/) ③ 정적 파일 zip(dist/)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = path.join(root, 'toeic');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

// ① 서비스 워커
const files = walk(app).filter((f) => f !== 'sw.js' && !f.startsWith('.')).sort();
const hash = crypto.createHash('sha256');
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(app, f)));
const version = hash.digest('hex').slice(0, 12);
const precache = ['./', ...files];
const sw = `// 자동 생성 파일 (tools/build.mjs) — 직접 수정하지 마세요.
const VERSION = '${version}';
const CACHE = 'toeic900-' + VERSION;
const PRECACHE = ${JSON.stringify(precache, null, 0)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('toeic900-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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
`;
fs.writeFileSync(path.join(app, 'sw.js'), sw);
console.log(`sw.js: ${precache.length}개 파일, 버전 ${version}`);

// ② 단일 HTML (Artifact·파일 하나로 열기용: 서비스 워커 없음, 데이터 내장)
const idx = JSON.parse(fs.readFileSync(path.join(app, 'data/index.json')));
const concepts = JSON.parse(fs.readFileSync(path.join(app, 'data/concepts.json'))).concepts;
const units = idx.files.flatMap((f) => JSON.parse(fs.readFileSync(path.join(app, 'data', f))).units);
const bundle = await esbuild.build({ entryPoints: [path.join(app, 'js/app.js')], bundle: true, format: 'esm', write: false, minify: true, target: 'es2020' });
const js = bundle.outputFiles[0].text;
const css = fs.readFileSync(path.join(app, 'css/app.css'), 'utf8');
const icon = fs.readFileSync(path.join(app, 'icons/icon-192.png')).toString('base64');
const data = JSON.stringify({ version: idx.version, concepts, units }).replace(/</g, '\\u003c');
const single = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>토익 900 트레이너</title>
<meta name="description" content="진단 → 약점 분석 → 맞춤 추천 → 단계별 오답 복습 → 실전 연습. 오리지널 문제로 TOEIC L&R 고득점 훈련.">
<link rel="icon" href="data:image/png;base64,${icon}">
<style>${css}</style>
</head>
<body>
<div id="app"><div class="page"><h1>토익 900 트레이너</h1><p class="muted">불러오는 중…</p></div></div>
<script>window.__TT_DATA__ = ${data};</script>
<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
fs.writeFileSync(path.join(dist, 'toeic-single.html'), single);
console.log(`dist/toeic-single.html: ${(single.length / 1024).toFixed(0)} KB`);

// ③ 정적 파일 zip
const zipPath = path.join(dist, 'toeic-trainer-static.zip');
fs.rmSync(zipPath, { force: true });
execSync(`cd "${root}" && zip -qr "${zipPath}" toeic -x "*.DS_Store"`);
console.log(`dist/toeic-trainer-static.zip: ${(fs.statSync(zipPath).size / 1024).toFixed(0)} KB`);
