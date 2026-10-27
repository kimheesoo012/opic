// 실제로 읽는 흐름을 화면으로 확인한다: 장면을 띄움 → 대사 끝까지 스크롤 → 「번역」 → 선택 → 다음 장면 시작 위치.
// 사용: node tools/read-flow.mjs [url] [w] [h] [이벤트 id들(쉼표)] [theme]
//  → tools/out/flow/*.png 와 가림·스크롤 측정값
// 주의: Chromium으로 화면 크기만 흉내 낸다. iPhone Safari의 주소창·홈 인디케이터(safe area)는 재현되지 않으므로
//       Safari에서 보이는 높이(예: 375×548, 390×664)를 따로 넣어 확인한다.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.argv[2] || 'http://localhost:8765/';
const W = +(process.argv[3] || 375);
const H = +(process.argv[4] || 667);
const ids = (process.argv[5] || 's0').split(',');
const theme = process.argv[6] || 'light';
const out = new URL('./out/flow/', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const tag = `${W}x${H}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: theme });
await ctx.addInitScript(() => {
  if (!localStorage.getItem('dojoinu.settings')) localStorage.setItem('dojoinu.settings', JSON.stringify({ v: 2, speed: 1, auto: false, furigana: 'n2', studyLevel: 'n2', hideEasy: true, sound: false }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.click('text=はじめから');
await page.click('text=この子と生きる');
await page.waitForSelector('.device .lcd-canvas');
const problems = [];

// 화면 안에서 보이는지: 패널 안(가려지지 않은 영역)에 있는가
const measure = () => page.evaluate(() => {
  const panel = document.querySelector('.panel');
  const foot = document.querySelector('.foot');
  const pr = panel.getBoundingClientRect();
  const fr = foot && !foot.hidden ? foot.getBoundingClientRect() : null;
  const visTop = pr.top;
  const visBottom = Math.min(pr.bottom, fr ? fr.top : innerHeight, innerHeight);
  const lines = [...panel.querySelectorAll('.line')].map((l) => { const r = l.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
  const tr = panel.querySelector('.tools .mini-btn');
  const t = tr && tr.getBoundingClientRect();
  return {
    inner: innerHeight,
    panelH: Math.round(visBottom - visTop),
    footH: fr ? Math.round(fr.height) : 0,
    lcdH: Math.round(document.querySelector('.device').getBoundingClientRect().height),
    topH: Math.round(document.querySelector('.topbar').getBoundingClientRect().height),
    scrollTop: Math.round(panel.scrollTop),
    scrollMax: Math.round(panel.scrollHeight - panel.clientHeight),
    titleVisible: (() => { const h = panel.querySelector('.ev-title'); if (!h) return false; const r = h.getBoundingClientRect(); return r.top >= visTop - 1 && r.bottom <= visBottom + 1; })(),
    lines,
    visTop: Math.round(visTop),
    visBottom: Math.round(visBottom),
    toolBtn: t ? { top: Math.round(t.top), bottom: Math.round(t.bottom) } : null,
    choiceMinH: Math.min(...[...document.querySelectorAll('.foot .btn')].map((b) => b.getBoundingClientRect().height)),
  };
});

// 게임이 스스로 띄운 장면이 있으면 끝까지 넘긴다 (오토와 같은 선택)
const settle = async () => {
  for (let i = 0; i < 40; i++) {
    const ph = await page.evaluate(() => {
      const a = window.__dojoinu;
      const v = a.view;
      if (v.paused) v.togglePause();
      const s = a.state;
      if (s.phase === 'event') v.doChoose(v.autoIdx ?? 0, true);
      else if (s.phase === 'result') v.doAck();
      else if (s.phase === 'word') v.doWord(s.pendingWord.presets[0], true);
      return a.state.phase;
    });
    if (ph === 'season') return;
    await page.waitForTimeout(100);
  }
};

for (const id of ids) {
  // 다음 계절 사건으로 이 이벤트를 넣는다(게임 로직은 그대로). 게임이 같은 순간 제 사건을 띄우면 정리하고 한 번 더.
  let shown = false;
  for (let tries = 0; tries < 3 && !shown; tries++) {
    await settle();
    await page.evaluate((id) => {
      const a = window.__dojoinu;
      if (a.state.phase !== 'season') return;
      delete a.state.seen[id];
      a.state.queue.unshift(id);
      a.view.skip();
    }, id);
    shown = await page.waitForFunction((id) => window.__dojoinu.state.cur && window.__dojoinu.state.cur.id === id && window.__dojoinu.state.phase === 'event', id, { timeout: 8000 }).then(() => true, () => false);
  }
  if (!shown) {
    problems.push(`${id}: 장면을 띄우지 못함`);
    continue;
  }
  await page.evaluate(() => window.__dojoinu.view.togglePause());
  await page.waitForTimeout(300);
  const m0 = await measure();
  await page.screenshot({ path: `${out}${tag}-${id}-1-start.png` });
  if (!m0.titleVisible) problems.push(`${id}: 시작할 때 제목이 보이지 않음 (scrollTop ${m0.scrollTop})`);
  if (m0.panelH < 160) problems.push(`${id}: 본문 칸이 ${m0.panelH}px (선택지 ${m0.footH}px, 도트 창 ${m0.lcdH}px)`);
  // 대사 끝까지 스크롤: 마지막 대사와 「번역」 버튼이 가려지지 않고 보이는가
  await page.evaluate(() => { const p = document.querySelector('.panel'); p.scrollTop = p.scrollHeight; });
  await page.waitForTimeout(150);
  const m1 = await measure();
  await page.screenshot({ path: `${out}${tag}-${id}-2-end.png` });
  const last = m1.lines[m1.lines.length - 1];
  if (last && last.bottom > m1.visBottom + 1) problems.push(`${id}: 마지막 대사 아래가 ${last.bottom - m1.visBottom}px 가려짐`);
  if (m1.toolBtn && m1.toolBtn.bottom > m1.visBottom + 1) problems.push(`${id}: 「번역」 버튼이 가려짐`);
  // 「번역」 → 한국어가 열린 뒤에도 끝까지 보이는가
  const tb = await page.$('.panel .tools .mini-btn');
  if (tb) {
    await tb.click();
    await page.evaluate(() => { const p = document.querySelector('.panel'); p.scrollTop = p.scrollHeight; });
    await page.waitForTimeout(150);
    const m2 = await measure();
    await page.screenshot({ path: `${out}${tag}-${id}-3-ko.png` });
    const l2 = m2.lines[m2.lines.length - 1];
    if (l2 && l2.bottom > m2.visBottom + 1) problems.push(`${id}: 번역을 연 뒤 마지막 대사가 ${l2.bottom - m2.visBottom}px 가려짐`);
  }
  if (m0.choiceMinH < 47.5) problems.push(`${id}: 선택지 높이 ${m0.choiceMinH}px`);
  // 문법 밑줄을 눌러 해설 창: 이 문장의 접속이 보이는가
  const gm = await page.$('.panel .gm');
  if (gm) {
    await gm.click();
    await page.waitForSelector('.modal');
    const conn = await page.$eval('.modal', (m) => (m.querySelector('.v-conn') || {}).textContent || '');
    await page.screenshot({ path: `${out}${tag}-${id}-5-grammar.png` });
    if (!conn) problems.push(`${id}: 문법 창에 「이 문장의 접속」이 없음`);
    else console.log('  ', conn);
    await page.click('.modal .close-btn');
  }
  console.log(id, JSON.stringify({ inner: m0.inner, top: m0.topH, lcd: m0.lcdH, panel: m0.panelH, foot: m0.footH, scrollMax: m1.scrollMax }));
  // 선택 → 결과 화면이 맨 위(제목)부터 보이는가
  await page.evaluate(() => window.__dojoinu.view.togglePause());
  const btn = await page.$('.foot .btn:not([disabled])');
  await btn.click();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__dojoinu.view.togglePause());
  const m3 = await measure();
  await page.screenshot({ path: `${out}${tag}-${id}-4-result.png` });
  if (!m3.titleVisible || m3.scrollTop !== 0) problems.push(`${id}: 선택 뒤 결과 화면이 처음부터 보이지 않음 (scrollTop ${m3.scrollTop})`);
  await page.evaluate(() => window.__dojoinu.view.togglePause());
  await page.click('.foot .btn.primary');
}
console.log(tag, problems.length ? 'PROBLEMS\n  ' + problems.join('\n  ') : 'ok', errors.length ? 'errors ' + errors.join(' | ') : '');
await browser.close();
