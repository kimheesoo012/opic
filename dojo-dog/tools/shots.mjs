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
console.log(tag, 'errors', errors.length, errors.slice(0, 5).join('\n'));
await browser.close();
