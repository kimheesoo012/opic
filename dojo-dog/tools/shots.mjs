// 화면 캡처 검토용: node tools/shots.mjs [url] [w] [h] [theme]  → tools/out/shots/*.png
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://localhost:8765/';
const W = +(process.argv[3] || 390);
const H = +(process.argv[4] || 844);
const theme = process.argv[5] || 'dark';
const out = new URL('./out/shots/', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 3, colorScheme: theme });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(900);
const tag = `${W}x${H}-${theme}`;
const shot = (n) => page.screenshot({ path: `${out}${n}-${tag}.png` });
const overflow = async (n) => {
  const r = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('button, .btn, h2, h3, .lcd-info, .stats')) {
      const b = el.getBoundingClientRect();
      if (b.width && (b.right > innerWidth + 1 || b.left < -1)) bad.push(el.className + ':' + (el.textContent || '').slice(0, 20));
    }
    return { scroll: document.documentElement.scrollWidth > innerWidth, bad };
  });
  if (r.scroll || r.bad.length) console.log(n, 'OVERFLOW', JSON.stringify(r));
};
await shot('01-title');
await overflow('title');
await page.click('text=はじめから');
await page.waitForTimeout(600);
await shot('02-birth');
await overflow('birth');
await page.click('text=この子と生きる');
await page.waitForTimeout(1500);
await shot('03-game');
await overflow('game');
await page.click('.ctl.auto');
await page.waitForTimeout(250);
await shot('04-auto');
await overflow('auto');
await page.click('.auto-panel [data-mode=off]');
for (let i = 0; i < 60; i++) {
  if (await page.$('.foot:not([hidden]) .btn')) break;
  await page.waitForTimeout(250);
}
await page.waitForTimeout(300);
await shot('05-event');
await overflow('event');
// 학습 팝업
await page.evaluate(() => window.__dojoinu.view.togglePause());
const tgt = await page.$('.panel .w, .panel .gm');
if (tgt) {
  await tgt.click();
  await page.waitForTimeout(250);
  await shot('05b-popup');
  await overflow('popup');
  await page.click('.modal .close-btn');
}
// 게임 도중 설정 (메뉴)
await page.click('.ctl[aria-label="메뉴"]');
await page.waitForTimeout(250);
await shot('05c-menu');
await page.click('.modal .btn.primary');
await page.evaluate(() => window.__dojoinu.view.togglePause());
// 학습 집중 모드
await page.evaluate(() => { const a = window.__dojoinu; a.settings.focus = true; a.view.refresh(); });
await page.waitForTimeout(250);
await shot('05e-focus');
await overflow('focus');
await page.evaluate(() => { const a = window.__dojoinu; a.settings.focus = false; a.view.refresh(); });
// 오토 감상 화면: 선택지를 접고 한 줄만
await page.click('.ctl.auto');
await page.click('.auto-panel [data-mode=all]');
for (let i = 0; i < 80; i++) {
  if (await page.$('.auto-line')) break;
  await page.waitForTimeout(250);
}
await shot('05d-auto-calm');
await overflow('auto-calm');
await page.click('.ctl.auto');
await page.click('.auto-panel [data-mode=off]');
// 稽古 장면
await page.evaluate(() => {
  const v = window.__dojoinu.view;
  v.togglePause();
  v.lcd.setPlan({ loc: 'dojo', tod: 'day', people: [{ role: 'shihan', x: 74, anim: 'keiko', bogu: true }, { role: 'kid', x: 104, anim: 'keiko', bogu: true, flip: true, phase: 1 }, { role: 'roshi', x: 132, pose: 'seiza', flip: true }], dog: { mode: 'stay', pose: 'sit', x: 30 } }, v.s);
  v.togglePause();
});
await page.waitForTimeout(700);
await shot('06-keiko');
// 시합: 旗가 올라가는 순간
await page.evaluate(() => {
  const v = window.__dojoinu.view;
  v.lcd.setPlan({ loc: 'court', tod: 'day', people: [{ role: 'kid', x: 58, anim: 'match', bogu: true, mark: 'red' }, { role: '_rival', x: 86, anim: 'match', bogu: true, flip: true, mark: 'white', phase: 1 }], judges: true, dog: { mode: 'peek', pose: 'sniff', x: -9 } }, v.s);
  v.lcd.flags();
  v.big('一本');
});
await page.waitForTimeout(500);
await shot('07-match');
// 復習 퀴즈 (문법)
await page.evaluate(() => window.__dojoinu.startQuiz(['g:ざるを得ない', 'g:に沿って', 'g:をきっかけに', 'g:ものの'], '復習'));
await page.waitForTimeout(400);
await page.click('.q-opt >> nth=0');
await page.waitForTimeout(300);
await shot('08-quiz');
await overflow('quiz');
await page.evaluate(() => window.__dojoinu.go('review'));
await page.waitForTimeout(300);
await shot('09-review');
await overflow('review');
console.log(tag, 'errors', errors.length, errors.slice(0, 5).join('\n'));
await browser.close();
