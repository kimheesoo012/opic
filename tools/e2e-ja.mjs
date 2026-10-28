// 일본어판(toeic-ja) 휴대폰 화면 확인: 문구 일본어화, 650점대 기본값, 주요 흐름, 한국어판과 저장소·캐시 분리
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 8791;
const ROOT = `http://localhost:${PORT}`;
const BASE = `${ROOT}/toeic-ja/`;
const shotDir = process.env.SHOTS || path.resolve('dist/shots-ja');
fs.mkdirSync(shotDir, { recursive: true });
const results = [];
const ok = (name, cond, detail = '') => { results.push({ name, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const shot = (p, name, full = false) => p.screenshot({ path: `${shotDir}/${name}.png`, fullPage: full });

const HANGUL = /[가-힣]/;
// 안내 말투·이모지 금지
const BAD_COPY = /てみてください|してみましょう|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const KANA = /[぀-ヿ]/;

async function answerLoop(p, { maxSteps = 500, wrongRate = 0.4 } = {}) {
  for (let i = 0; i < maxSteps; i++) {
    if ((await p.evaluate(() => location.hash)) !== '#play') return;
    if (await p.$('[data-act="conceptOk"]')) { await p.click('[data-act="conceptOk"]'); continue; }
    const fresh = await p.$$('.choice[data-act="choose"]:not(.right):not(.wrong)');
    if (fresh.length && !(await p.$('.exp'))) await fresh[Math.random() < wrongRate ? Math.floor(Math.random() * fresh.length) : 0].click();
    const next = await p.$('[data-act="next"]:not([disabled])');
    if (next) await next.click();
    await p.waitForTimeout(10);
  }
}
const pageText = (p) => p.evaluate(() => document.body.innerText);
const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const server = await serve(PORT);
const browser = await chromium.launch();
const errors = [];
const copyIssues = [];
async function checkText(p, where) {
  const t = await pageText(p);
  if (HANGUL.test(t)) copyIssues.push(`${where}: 한글 "${t.match(/.{0,12}[가-힣].{0,12}/)[0]}"`);
  if (BAD_COPY.test(t)) copyIssues.push(`${where}: ${t.match(BAD_COPY)[0]}`);
  const ox = await overflowX(p);
  if (ox > 1) copyIssues.push(`${where}: 가로 넘침 ${ox}px`);
}
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'ja-JP' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // 1. 홈
  await p.goto(BASE);
  await p.waitForSelector('[data-act="startRec"]');
  const home = await pageText(p);
  ok('홈: 일본어 화면, html lang=ja', home.includes('今日のRC') && (await p.getAttribute('html', 'lang')) === 'ja');
  ok('홈: 기본 목표 730', home.includes('目標 730'));
  ok('홈: 첫 추천은 クイック診断', (await p.textContent('.rec')).includes('クイック診断'));
  await checkText(p, 'ホーム');
  await shot(p, '01-home');

  // 2. 간단 진단 → 결과
  await p.click('[data-act="startRec"]');
  await p.waitForSelector('.sess');
  await checkText(p, '診断');
  await shot(p, '02-diag');
  await answerLoop(p);
  ok('진단 완료 → 결과', (await p.evaluate(() => location.hash)) === '#result');
  ok('결과: RC推定スコア範囲 또는 学習レベル', /RC推定スコア範囲|学習レベル/.test(await pageText(p)));
  const rw = await p.textContent('.reward');
  ok('결과: 획득 XP·첫 배지 일본어', /\+\d+ XP/.test(rw) && rw.includes('はじめの一歩') && rw.includes('今回の学習'), rw.replace(/\s+/g, ' ').slice(0, 60));
  await checkText(p, '結果');
  await shot(p, '03-result', true);

  // 3. 목표: 650점대용 선택지와 RC 목표 계산(730 − LC 350 = 380)
  await p.goto(`${BASE}#goal`);
  await p.waitForSelector('[data-act="setGoal"]');
  const goals = await p.$$eval('[data-act="setGoal"]', (bs) => bs.map((b) => b.textContent.trim()));
  ok('목표 선택지 700·730·800·860·900', goals.join(',') === '700,730,800,860,900', goals.join(','));
  ok('RC 목표 380 (730 − LC 350)', (await pageText(p)).includes('730 − LC 350') && (await p.textContent('.card b')).trim() === '380');
  await checkText(p, '目標');

  // 4. Part 5 연습: 즉시 해설이 일본어
  await p.goto(`${BASE}#learn`);
  await p.click('[data-act="startPart"][data-p="5"]');
  await p.waitForSelector('.sess');
  // 오답이 나오고 단어 칩이 있는 문항까지 진행
  let found = false;
  for (let i = 0; i < 10 && !found; i++) {
    await (await p.$$('.choice[data-act="choose"]'))[i % 4].click();
    await p.waitForSelector('.exp');
    found = !!(await p.$('.verdict.bad')) && !!(await p.$('.vocab-row .chip')) && !!(await p.$('[data-act="cause"]'));
    if (!found) await p.click('[data-act="next"]');
  }
  ok('오답 + 단어가 있는 Part 5 문항 도달', found);
  const exp = await p.textContent('.exp');
  ok('Part 5 해설: 일본어(가나 포함)', KANA.test(await p.textContent('.why')) && !HANGUL.test(exp));
  ok('Part 5 해설: 不正解 표시와 ポイント', exp.includes('不正解') && exp.includes('ポイント'));
  const tr5 = await p.evaluate(() => ({ en: !!document.querySelector('.exp .trans .en b'), tr: (document.querySelector('.exp .trans .tr') || {}).textContent || '', lbl: [...document.querySelectorAll('.exp .lbl')].map((x) => x.textContent) }));
  ok('Part 5 해설: 訳 구역(정답 넣은 문장 + 일본어 해석)', tr5.en && KANA.test(tr5.tr) && !HANGUL.test(tr5.tr) && tr5.lbl.includes('正解の理由') && tr5.lbl.includes('訳'), tr5.lbl.join('/'));
  const causes = await p.$$eval('[data-act="cause"]', (bs) => bs.map((b) => b.textContent));
  ok('오답 원인 칩 일본어', causes.includes('知らない単語') && causes.includes('ひっかけ'), causes.join('/'));
  await checkText(p, 'Part 5 解説');
  await shot(p, '04-p5-explain', true);
  await p.click('.vocab-row .chip');
  await p.waitForSelector('.sheet [data-act="saveWord"]');
  const sh = await p.textContent('.sheet');
  ok('단어 뜻 일본어', !HANGUL.test(sh) && KANA.test(sh) && sh.includes('単語帳に保存'), sh.slice(0, 50));
  await shot(p, '04b-word');
  await p.click('.sheet [data-act="saveWord"]');
  await p.click('.sheet [data-act="closeSheet"]');
  await answerLoop(p, { wrongRate: 0.5 });

  // 5. Part 7 이중·삼중 지문
  await p.goto(`${BASE}#learn`);
  await p.click('[data-act="startMulti"]');
  await p.waitForSelector('.ptabs');
  const tabs = await p.$$('.ptabs [role="tab"]');
  await tabs[1].click();
  ok('Part 7 지문 탭 전환', (await p.getAttribute('.ptabs [role="tab"]:nth-child(2)', 'aria-selected')) === 'true');
  await checkText(p, 'Part 7');
  await shot(p, '05-p7-multi');
  await (await p.$$('.choice[data-act="choose"]'))[0].click();
  await p.waitForSelector('.exp');
  ok('Part 7 해설 일본어', KANA.test(await p.textContent('.why')));
  const ev7 = await p.evaluate(() => ({ marks: document.querySelectorAll('.passage mark.ev, .passage td.ev').length, ev: (document.querySelector('.exp .ev') || {}).textContent || '', q: (document.querySelector('.exp .qtr') || {}).textContent || '' }));
  ok('Part 7 해설: 根拠の文 + 지문 강조 + 設問 일본어', ev7.marks >= 1 && ev7.ev.includes('根拠の文') && KANA.test(ev7.q) && !HANGUL.test(ev7.q), JSON.stringify(ev7).slice(0, 100));
  await checkText(p, 'Part 7 解説');
  ok('세트를 다 풀기 전: 本文の訳は잠김', (await p.textContent('.exp .ptr-lock')).includes('本文全体の訳') && !(await p.$('.ptr-bar')));
  for (let i = 0; i < 6; i++) {
    if (!(await p.$('.exp'))) { await (await p.$$('.choice[data-act="choose"]'))[0].click(); await p.waitForSelector('.exp'); }
    if (await p.$('.ptr-bar')) break;
    await p.click('[data-act="next"]');
  }
  ok('세트 끝: 訳を表示 버튼', (await p.textContent('.ptr-bar [data-act="ptrans"]')) === '訳を表示' && (await p.textContent('.exp [data-act="ptransGo"]')) === '本文全体の訳を見る');
  await p.click('[data-act="ptransGo"]');
  await p.waitForSelector('.passage.tr-on');
  const tr7 = await p.evaluate(() => { const ptr = [...document.querySelectorAll('.passage .ptr')]; return { n: ptr.length, pp: document.querySelectorAll('.passage .pp').length, txt: ptr.map((e) => e.textContent).join(' ') }; });
  ok('Part 7 지문 해석 일본어, 문단마다', tr7.n > 0 && tr7.n <= tr7.pp && KANA.test(tr7.txt) && !HANGUL.test(tr7.txt) && (await p.textContent('[data-act="ptrans"]')) === '訳を隠す', `${tr7.n}/${tr7.pp} ${tr7.txt.slice(0, 60)}`);
  await checkText(p, 'Part 7 本文の訳');
  await shot(p, '05b-p7-trans');
  await p.click('[data-act="exitAsk"]');
  await p.click('[data-act="exitFinish"]');
  await p.waitForSelector('.pt-det', { state: 'attached' });
  const det = await p.evaluate(() => { const d = document.querySelector('.pt-det'); return { sum: d.querySelector('summary').textContent, txt: [...d.querySelectorAll('.ptr')].map((e) => e.textContent).join(' ') }; });
  ok('결과 화면: 本文と訳', det.sum === '本文と訳' && KANA.test(det.txt) && !HANGUL.test(det.txt), det.sum);
  await checkText(p, '結果 本文と訳');

  // 6. 나머지 화면 문구
  for (const r of ['home', 'review', 'stats', 'prefs', 'about', 'train-para', 'train-vocab']) {
    await p.goto(`${BASE}#${r}`);
    await p.waitForSelector('.nav');
    await checkText(p, r);
  }
  // 7-a. 학습 동기 화면
  await p.goto(`${BASE}#home`);
  await p.waitForSelector('.streak');
  const wk = await p.$$eval('.week .wd span', (xs) => xs.map((x) => x.textContent).join(''));
  ok('홈: 연속 기록 카드 일본어(월~일, 日連続, XP 고리)', wk === '月火水木金土日' && (await p.textContent('.streak-n')).includes('日連続') && (await p.textContent('.streak .ring')).includes('XP'), wk);
  await shot(p, '01b-home-streak');
  await p.goto(`${BASE}#stats`);
  await p.waitForSelector('.badges');
  ok('기록: 実力マップ 34유형·バッジ·直近7日', (await p.$$('.mrow')).length === 34 && (await pageText(p)).includes('実力マップ') && (await p.$$('.badge.on')).length >= 2 && (await pageText(p)).includes('直近7日'));
  await p.click('details summary');
  await shot(p, '06-stats', true);
  await p.goto(`${BASE}#prefs`);
  await p.click('[data-act="daily"][data-n="20"]');
  await p.goto(`${BASE}#home`);
  ok('1日の目標 변경 반영', (await p.textContent('.streak .ring')).includes('/20'));
  for (const r of ['home', 'stats', 'prefs']) { await p.goto(`${BASE}#${r}`); await p.waitForSelector('.nav'); await checkText(p, `${r} (2.1)`); }

  // 7. 저장소 분리: 일본어판 기록은 toeic-trainer-ja에만
  const dbs = await p.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : []));
  const nJa = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('toeic-trainer-ja'); r.onsuccess = () => { const c = r.result.transaction('attempts').objectStore('attempts').count(); c.onsuccess = () => res(c.result); }; }));
  ok('기록은 toeic-trainer-ja DB에 저장', nJa > 0 && !dbs.includes('toeic-trainer'), `${nJa}개, DB ${dbs.join(',')}`);

  // 8. 한국어판과 서비스 워커 캐시 공존
  await p.goto(BASE);
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.waitForSelector('.nav');
  await p.goto(`${ROOT}/toeic/`);
  await p.waitForSelector('[data-act="startRec"]');
  ok('같은 브라우저에서 한국어판 정상 표시', (await p.textContent('h1')).includes('오늘의 RC'));
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForTimeout(500);
  const keys = await p.evaluate(() => caches.keys());
  ok('두 앱 캐시가 서로 지우지 않음', keys.some((k) => k.startsWith('toeicja-')) && keys.some((k) => k.startsWith('toeic900-')), keys.join(','));

  // 9. 오프라인 재실행
  await p.goto(BASE);
  await p.waitForSelector('.nav');
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForSelector('.nav', { timeout: 5000 }).catch(() => {});
  ok('오프라인에서 다시 열림', (await pageText(p)).includes('今日のRC'));
  await ctx.setOffline(false);
  await ctx.close();

  // 10. 작은 화면(375×667)
  const ctx2 = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => errors.push(e.message));
  await p2.goto(BASE);
  await p2.waitForSelector('[data-act="startRec"]');
  await checkText(p2, '375 ホーム');
  await p2.goto(`${BASE}#learn`);
  await p2.click('[data-act="startMulti"]');
  await p2.waitForSelector('.ptabs');
  await checkText(p2, '375 Part 7');
  const m = await p2.evaluate(() => { const b = document.querySelector('.choice'); const r = b.getBoundingClientRect(); return { h: Math.round(r.height), fs: parseFloat(getComputedStyle(b).fontSize) }; });
  ok('375px: 선택지 높이 ≥48px, 글자 ≥16px', m.h >= 48 && m.fs >= 16, JSON.stringify(m));
  await shot(p2, '07-375-p7');
  await ctx2.close();
} catch (e) {
  ok('예외 없이 완료', false, e.stack);
} finally {
  ok('화면 문구: 한글·안내 말투·이모지·가로 넘침 없음', !copyIssues.length, copyIssues.slice(0, 8).join(' | '));
  ok('페이지 오류 없음', !errors.length, errors.slice(0, 5).join(' | '));
  await browser.close();
  server.close();
  const fail = results.filter((r) => !r.pass);
  console.log(`\n${results.length - fail.length}/${results.length} 통과`);
  process.exit(fail.length ? 1 : 0);
}
