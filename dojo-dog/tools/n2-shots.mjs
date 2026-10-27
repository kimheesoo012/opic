// JLPT N2対策 화면을 폭별로 찍고, 가로 넘침·잘림을 잰다.
// 사용: node tools/n2-shots.mjs [url] → tools/out/n2/*.png
// Chromium으로 화면 크기만 흉내 낸다 (실제 iPhone Safari 아님).
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://127.0.0.1:8765/';
const out = new URL('./out/n2/', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const problems = [];
for (const [W, H] of [[360, 640], [375, 667], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('dojoinu.settings', JSON.stringify({ v: 2, speed: 1, auto: false, furigana: 'n2', studyLevel: 'n2', hideEasy: true, sound: false })));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  const shot = async (name) => {
    const over = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const bad = [...document.querySelectorAll('.screen *, .modal *')].filter((el) => !el.closest('.n2-tabs')).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1); }).slice(0, 3).map((el) => el.className || el.tagName);
      return { scrollW: document.documentElement.scrollWidth, w, bad };
    });
    if (over.scrollW > over.w || over.bad.length) problems.push(`${W} ${name}: 가로 넘침 ${JSON.stringify(over)}`);
    await page.screenshot({ path: `${out}${W}-${name}.png` });
  };
  await shot('0-title');
  await page.click('.n2-sum');
  await shot('1-home');
  await page.click('.n2-tabs button:has-text("語彙")');
  await shot('2-vocab');
  await page.click('.n2-row >> nth=0');
  await shot('3-vocab-detail');
  await page.click('.modal .close-btn');
  await page.click('.n2-tabs button:has-text("文法")');
  await page.fill('input[type=search]', 'を通じて');
  await page.click('.n2-row >> nth=0');
  await shot('4-grammar-detail');
  await page.click('.modal .close-btn');
  await page.click('.n2-tabs button:has-text("問題演習")');
  await page.click('.n2-type >> nth=2');
  await shot('5-drill');
  await page.click('.q-opt >> nth=0');
  await shot('6-drill-answer');
  await page.click('.n2-tabs button:has-text("読解")');
  await page.click('.n2-row >> nth=0');
  await shot('7-reading');
  await page.click('.n2-tabs button:has-text("聴解")');
  await page.click('.n2-row >> nth=0');
  await shot('8-listening');
  await page.click('.n2-tabs button:has-text("弱点克服")');
  await shot('9-weak');
  if (errors.length) problems.push(`${W}: ${errors.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(problems.length ? problems.join('\n') : '문제 없음');
