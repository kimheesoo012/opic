// 일본어 모드에서 화면에 「보이는」 한글을 모두 찾는다 (탭해야 열리는 번역은 hidden이라 잡히지 않는다).
// 사용: node tools/ko-scan.mjs [url] [판 수=2]  → 위치(요소 클래스)별 한글 문구 목록
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://127.0.0.1:8765/';
const RUNS = +(process.argv[3] || 2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('dojoinu.settings', JSON.stringify({ v: 2, lang: 'ja', speed: 16, auto: true, autoMode: 'all', furigana: 'n2', studyLevel: 'n2', hideEasy: true, sound: false, playMode: 'study', quizFreq: 'high' })));
const page = await ctx.newPage();
const found = new Map(); // 문구 → {where, screen, n}
const scan = (screen) => page.evaluate((screen) => {
  const H = /[가-힣]/;
  const out = [];
  const visible = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.hidden) return false;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  };
  const walker = document.createTreeWalker(document.getElementById('app') || document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim();
    if (!t || !H.test(t)) continue;
    const el = n.parentElement;
    if (!visible(el)) continue;
    const path = [];
    for (let e = el; e && path.length < 3 && e.id !== 'app'; e = e.parentElement) path.push(e.className || e.tagName.toLowerCase());
    out.push({ t: t.slice(0, 60), where: path.join(' < ') });
  }
  // aria-label·placeholder도 (스크린리더용이라 보이진 않지만 참고로)
  return out.map((x) => ({ ...x, screen }));
}, screen);
const visits = {};
const scanOrig = scan;
const scanCount = async (screen) => { visits[screen] = (visits[screen] || 0) + 1; return scanOrig(screen); };
const add = (list) => { for (const x of list) { const k = x.screen + '|' + x.where + '|' + x.t; found.set(k, (found.get(k) || 0) + 1); } };

await page.goto(url);
add(await scanCount('title'));
await page.click('text=はじめから');
add(await scanCount('birth'));
await page.click('text=この子と生きる');
await page.waitForSelector('.device .lcd-canvas');
for (let run = 0; run < RUNS; run++) {
  for (let i = 0; i < 2500; i++) {
    const st = await page.evaluate(() => { const a = window.__dojoinu; return { cur: a.cur, phase: a.state && a.state.phase }; });
    add(await scanCount(st.cur === 'game' ? 'game:' + st.phase : st.cur));
    // 퀴즈가 떠 있으면 첫 선택지를 고르고 계속
    const q = await page.$('.panel .q-opt');
    if (q) { await q.click().catch(() => {}); add(await scanCount('quiz-answered')); const go = await page.$('.foot .btn.primary'); if (go) await go.click().catch(() => {}); }
    const skip = await page.$('text=スキップ');
    if (skip) await skip.click().catch(() => {});
    if (st.cur !== 'game') {
      if (st.cur === 'memorial') { await page.click('text=残す').catch(() => {}); continue; }
      if (st.cur === 'result') { add(await scanCount('result')); break; }
      if (st.cur === 'farewell') { await page.click('text=つぎへ').catch(() => {}); continue; }
    }
    await page.waitForTimeout(250);
  }
  if (run < RUNS - 1) { await page.click('text=タイトルへ').catch(() => {}); await page.click('text=はじめから'); await page.click('text=この子と生きる').catch(() => {}); }
}
// 기타 화면
await page.goto(url);
await page.click('.n2-sum').catch(() => {});
add(await scanCount('n2-home'));
await page.goto(url);
await page.click('text=復習').catch(() => {});
add(await scanCount('review'));
await page.goto(url);
await page.click('text=設定').catch(() => {});
add(await scanCount('settings'));
// N2対策의 각 탭과 첫 항목·첫 문제
for (const tab of ['語彙', '文法', '問題演習', '読解', '聴解', '弱点克服']) {
  await page.goto(url);
  await page.click('.n2-sum').catch(() => {});
  await page.click(`.n2-tabs button:has-text("${tab}")`).catch(() => {});
  add(await scanCount('n2:' + tab));
  const first = await page.$('.n2-body .n2-row, .n2-body .n2-type');
  if (first) {
    await first.click().catch(() => {});
    await page.waitForTimeout(150);
    add(await scanCount('n2:' + tab + ':open'));
    const opt = await page.$('.q-opt');
    if (opt) { await opt.click().catch(() => {}); add(await scanCount('n2:' + tab + ':answered')); }
  }
}
// 복습 퀴즈 (練習 10問)
await page.goto(url);
await page.click('text=復習').catch(() => {});
const prac = await page.$('button:has-text("練習")');
if (prac) {
  await prac.click();
  for (let i = 0; i < 10; i++) {
    add(await scanCount('review-quiz'));
    const o = await page.$('.q-opt');
    if (!o) break;
    await o.click().catch(() => {});
    add(await scanCount('review-quiz:answered'));
    const nx = await page.$('.sheet-foot .btn.primary');
    if (nx) await nx.click().catch(() => {});
  }
}
await page.click('.tabs button:has-text("単語帳")').catch(() => {});
add(await scanCount('wordbook'));
await browser.close();
const by = {};
for (const [k, n] of found) { const [screen, where, t] = k.split('|'); (by[screen] = by[screen] || []).push(`${n}× [${where}] ${t}`); }
for (const [s, list] of Object.entries(by)) { console.log(`\n## ${s} (${list.length})`); console.log(list.slice(0, 40).join('\n')); }
console.log('\n# 본 화면: ' + Object.entries(visits).map(([k, n]) => `${k}×${n}`).join(' · '));
