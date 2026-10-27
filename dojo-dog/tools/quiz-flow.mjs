// 플레이 중 학습 화면 확인: 장면 → 확인 문제 → 답 → 해설 → つづける / 복습 카드 / 감상 모드에서는 나오지 않음
// 사용: node tools/quiz-flow.mjs [url] [w] [h] → tools/out/quiz/*.png
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://localhost:8765/';
const W = +(process.argv[3] || 390);
const H = +(process.argv[4] || 718);
const out = new URL('./out/quiz/', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const tag = `${W}x${H}`;
const problems = [];
const browser = await chromium.launch();

async function play(mode) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  await ctx.addInitScript((mode) => {
    localStorage.setItem('dojoinu.settings', JSON.stringify({ v: 2, speed: 4, auto: false, sound: false, playMode: mode, quizFreq: 'high' }));
    // 예전 견생에서 만나 복습할 때가 된 말 (복습 카드용)
    const past = Date.now() - 3 * 86400000;
    localStorage.setItem('dojoinu.srs', JSON.stringify({ 'g:っこない': { met: past, box: 1, due: past, streak: 0, ok: 1, ng: 1, last: past }, 'v:稽古': { met: past, box: 1, due: past, streak: 1, ok: 1, ng: 0, last: past } }));
  }, mode);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(url);
  await p.click('text=はじめから');
  await p.click('text=この子と生きる');
  // 복습할 말이 있으면 시작 전 「今日の一問」이 먼저 나온다 → 건너뛴다
  await p.waitForFunction(() => document.querySelector('.device') || [...document.querySelectorAll('button')].some((b) => b.textContent === 'スキップ'));
  if (await p.$('text=スキップ')) await p.click('text=スキップ');
  await p.waitForSelector('.device');
  let quizzes = 0;
  let scenes = 0;
  for (let i = 0; i < 400 && quizzes < 2; i++) {
    const st = await p.evaluate(() => ({ phase: window.__dojoinu.state.phase, quiz: window.__dojoinu.view && window.__dojoinu.view.quiz, t: window.__dojoinu.state.t }));
    if (st.quiz) {
      quizzes++;
      const t0 = await p.evaluate(() => [window.__dojoinu.state.t, window.__dojoinu.view.elapsed]);
      await p.screenshot({ path: `${out}${tag}-${mode}-q${quizzes}-a.png` });
      await p.waitForTimeout(800);
      const t1 = await p.evaluate(() => [window.__dojoinu.state.t, window.__dojoinu.view.elapsed]);
      if (t0[0] !== t1[0] || t0[1] !== t1[1]) problems.push(`${mode}: 퀴즈 중에 시간이 흐름`);
      const kind = await p.textContent('.panel .q-kind');
      await p.locator('.panel .q-opt').first().click();
      await p.waitForSelector('.panel .q-explain:not([hidden])');
      await p.screenshot({ path: `${out}${tag}-${mode}-q${quizzes}-b.png` });
      // 가림 검사: つづける와 해설 시작이 화면 안에 있는가
      const vis = await p.evaluate(() => {
        const b = document.querySelector('.foot .btn.primary').getBoundingClientRect();
        return b.bottom <= innerHeight + 1 && b.height >= 47;
      });
      if (!vis) problems.push(`${mode}: つづける가 화면 밖`);
      console.log(`  ${mode} 퀴즈 ${quizzes}: ${kind}`);
      await p.click('.foot .btn.primary');
      continue;
    }
    if (st.phase === 'event') {
      scenes++;
      const open = await p.$('.foot .open-choices');
      if (open) await open.click();
      await p.locator('.foot .btn:not([disabled]) >> visible=true').first().click();
    } else if (st.phase === 'result') {
      await p.click('.foot .btn.primary');
    } else if (st.phase === 'word') {
      await p.locator('.foot .btn').first().click();
    } else {
      await p.evaluate(() => window.__dojoinu.view.skip());
      await p.waitForTimeout(120);
    }
  }
  // 복습 카드: 계절 사이에 (학습 모드에서만)
  await p.waitForFunction(() => window.__dojoinu.state.phase === 'season' && !window.__dojoinu.view.quiz, null, { timeout: 15000 }).catch(() => {});
  const card = await p.evaluate(() => { const v = window.__dojoinu.view; if (v.s.quiz) v.s.quiz.lastCard = -99; return v.set.playMode === 'study' ? v.openQuiz('card') : false; });
  if (card) {
    await p.screenshot({ path: `${out}${tag}-${mode}-card.png` });
    const head = await p.textContent('.panel .ev-cat');
    if (head !== '復習カード') problems.push(`${mode}: 복습 카드 머리글 ${head}`);
    await p.locator('.foot .mini-btn').click(); // 건너뛰기
  }
  console.log(`${tag} ${mode}: 장면 ${scenes}, 확인 문제 ${quizzes}, 복습 카드 ${card ? '나옴' : '없음'}`);
  if (mode === 'watch' && (quizzes || card)) problems.push('감상 모드인데 학습 문제가 나옴');
  if (mode === 'study' && (!quizzes || !card)) problems.push('학습 모드인데 문제가 나오지 않음');
  if (errors.length) problems.push(...errors);
  await ctx.close();
}

await play('study');
await play('watch');
console.log(tag, problems.length ? 'PROBLEMS\n  ' + problems.join('\n  ') : 'ok');
await browser.close();
