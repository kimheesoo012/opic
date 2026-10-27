// 1배속·오토(全部おまかせ)로 한 판을 실제 시간으로 끝까지 돌려 걸린 시간을 잰다.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/';
const speed = Number(process.argv[3] || 1);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript((sp) => localStorage.setItem('dojoinu.settings', JSON.stringify({ speed: sp, auto: true, autoMode: 'all', furigana: 'hard' })), speed);
const p = await ctx.newPage();
await p.goto(BASE + 'index.html');
await p.click('text=はじめから');
await p.click('text=この子と生きる');
const t0 = Date.now();
await p.waitForSelector('text=무지개다리', { timeout: 60 * 60 * 1000 });
const sec = (Date.now() - t0) / 1000;
const seasons = await p.evaluate(() => window.__dojoinu.state?.t ?? null);
console.log(`${speed}x 실측: ${(sec / 60).toFixed(1)}분 (${sec.toFixed(0)}초), ${seasons}계절`);
await b.close();
