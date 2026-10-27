// 빌드: PWA 폴더(dist/pwa)와 그 Pages용 사본(dojo-dog/ 바로 아래), 단일 파일 아티팩트(dist/artifact/dojo-dog.html), 정적 파일 zip
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const r = (...p) => path.join(ROOT, ...p);

const js = (await esbuild.build({ entryPoints: [r('src/ui/main.js')], bundle: true, minify: process.env.NOMIN ? false : true, format: 'iife', target: ['es2020', 'safari14'], write: false, loader: { '.json': 'json' }, legalComments: 'none' })).outputFiles[0].text;
const css = (await esbuild.build({ entryPoints: [r('src/ui/styles.css')], bundle: true, minify: true, write: false })).outputFiles[0].text;
// 판 번호: 코드·스타일에 더해 HTML 틀·매니페스트·아이콘이 바뀌어도 새 판으로 (서비스 워커가 새로 받게)
const verHash = crypto.createHash('sha1').update(js + css).update(fs.readFileSync(r('src/index.html'))).update(fs.readFileSync(r('src/manifest.webmanifest')));
for (const f of fs.readdirSync(r('public/icons')).sort()) verHash.update(fs.readFileSync(r('public/icons', f)));
const ver = verHash.digest('hex').slice(0, 10);
const safeJs = js.replace(/<\/script/gi, '<\\/script');

// PWA
const out = r('dist/pwa');
fs.rmSync(r('dist'), { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
const tpl = fs.readFileSync(r('src/index.html'), 'utf8');
const page = tpl.replace('/*CSS*/', () => css).replace('/*JS*/', () => safeJs);
fs.writeFileSync(path.join(out, 'index.html'), page);
fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync(r('src/sw.js'), 'utf8').replace('__VERSION__', ver));
fs.copyFileSync(r('src/manifest.webmanifest'), path.join(out, 'manifest.webmanifest'));
for (const f of fs.readdirSync(r('public/icons'))) fs.copyFileSync(r('public/icons', f), path.join(out, 'icons', f));

// GitHub Pages(main 브랜치 방식)용 사본: dojo-dog/ 폴더 바로 아래에 두어 /opic/dojo-dog/ 에서 열리게 한다.
// 서비스 워커는 이 폴더를 범위로 등록되므로 같은 도메인의 다른 앱(/opic/, /opic/toeic/ 등)에는 닿지 않는다.
fs.rmSync(r('icons'), { recursive: true, force: true });
fs.cpSync(out, ROOT, { recursive: true });

// 아티팩트용 단일 HTML (문서 골격은 게시할 때 감싸지므로 넣지 않는다. 서비스 워커는 쓰지 않는다)
const icon = 'data:image/png;base64,' + fs.readFileSync(r('public/icons/favicon-64.png')).toString('base64');
const art = [
  '<title>道場犬</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  `<link rel="icon" href="${icon}">`,
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap">',
  `<style>${css}</style>`,
  '<style>html,body{height:100%}</style>',
  '<div id="app"></div>',
  `<script>window.__NO_SW__=true;</script>`,
  `<script>${safeJs}</script>`,
].join('\n');
fs.mkdirSync(r('dist/artifact'), { recursive: true });
fs.writeFileSync(r('dist/artifact/dojo-dog.html'), art);

// zip
execSync(`cd "${r('dist')}" && rm -f dojo-dog-pwa.zip && cd pwa && zip -qr ../dojo-dog-pwa.zip .`);
const kb = (p) => Math.round(fs.statSync(p).size / 1024) + 'KB';
console.log('version', ver, 'pwa index', kb(path.join(out, 'index.html')), 'artifact', kb(r('dist/artifact/dojo-dog.html')), 'zip', kb(r('dist/dojo-dog-pwa.zip')));
