// 한 판을 사람처럼 끝까지 해 보고 기록을 남긴다: 장면 순서·반복·문제·오류·화면 넘침·스크린샷.
// 사용: node tools/playtest.mjs [url] [lang=ja|ko] [폭=384] [높이=832] [manual=0|1] [out=tools/out/play] [speed=16]
// manual=1: 오토를 「大事な場面だけ止まる」로 두고, 멈추면 선택지를 무작위로 고른다(미니게임도 탭).
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , url = 'http://127.0.0.1:8765/', lang = 'ja', W = '384', H = '832', manual = '0', out = 'tools/out/play', speed = '16'] = process.argv;
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +W, height: +H }, isMobile: true, hasTouch: true });
await ctx.addInitScript(([lang, manual, speed]) => localStorage.setItem('dojoinu.settings', JSON.stringify({ v: 2, lang, speed: +speed, auto: true, autoMode: manual === '1' ? 'major' : 'all', furigana: 'always', studyLevel: 'n2', hideEasy: true, sound: false, playMode: 'study', quizFreq: 'mid' })), [lang, manual, speed]);
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const t0 = Date.now();
await p.goto(url);
await p.click('text=はじめから');
await p.click('text=この子と生きる');
const log = [];
const overflow = new Set();
let last = '';
let shots = 0;
const rnd = (n) => Math.floor(Math.random() * n);
for (let i = 0; i < 6000; i++) {
  const st = await p.evaluate(() => {
    const a = window.__dojoinu;
    const s = a.state;
    return { cur: a.cur, ph: s && s.phase, ev: s && s.cur && s.cur.id, t: s && s.t };
  });
  if (st.cur === 'game' && (st.ph === 'event' || st.ph === 'result' || st.ph === 'word')) {
    const view = await p.evaluate(() => {
      const el = document.querySelector('.panel');
      const c = el.cloneNode(true);
      c.querySelectorAll('rt,[hidden]').forEach((x) => x.remove());
      const text = c.innerText.replace(/\n{2,}/g, '\n').trim();
      // 화면 밖으로 나가거나 잘리는 글자
      const bad = [];
      for (const e of document.querySelectorAll('#app *')) {
        const r = e.getBoundingClientRect();
        if (!r.width || e.closest('[hidden]')) continue;
        const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (own && r.right > innerWidth + 1 && !e.closest('.seg.speeds,.n2-tabs,.chips')) bad.push((e.className || e.tagName) + ':' + e.textContent.trim().slice(0, 20));
      }
      const quiz = !!document.querySelector('.panel .q-opt');
      return { text, bad, quiz };
    });
    const key = st.ph + '|' + view.text;
    if (key !== last) {
      log.push({ t: st.t, ph: st.ph, ev: st.ev, quiz: view.quiz, text: view.text.slice(0, 600) });
      last = key;
      view.bad.forEach((x) => overflow.add(x));
      if (log.length % 25 === 1 && shots < 12) await p.screenshot({ path: `${out}/s${String(++shots).padStart(2, '0')}.png` });
    }
  }
  // 퀴즈: 가끔 일부러 틀린다
  const q = await p.$$('.panel .q-opt');
  if (q.length) {
    await q[rnd(q.length)].click().catch(() => {});
    if (shots < 14 && (await p.$('.ex-pick'))) await p.screenshot({ path: `${out}/q${String(++shots).padStart(2, '0')}.png` });
    const go = await p.$('.foot .btn.primary');
    if (go) await go.click().catch(() => {});
  }
  if (manual === '1' && st.cur === 'game') {
    const open = await p.$('.open-choices');
    if (open) await open.click().catch(() => {});
    const rows = await p.$$('.foot .choice-row:not([hidden]) .btn:not([disabled])');
    if (rows.length) await rows[rnd(rows.length)].click().catch(() => {});
    const drum = await p.$('.drum');
    if (drum) for (let k = 0; k < 14; k++) { await drum.click().catch(() => {}); await p.waitForTimeout(300); }
    const preset = await p.$$('.foot .btn:not(.primary)');
    if (st.ph === 'word' && preset.length) await preset[rnd(preset.length)].click().catch(() => {});
    const next = await p.$('.foot .btn.primary:not(.open-choices)');
    if (next && st.ph === 'result') await next.click().catch(() => {});
  }
  if (st.cur === 'farewell') { log.push({ ph: 'farewell', text: (await p.evaluate(() => document.querySelector('.screen').innerText)).slice(0, 1500) }); await p.click('text=つぎへ').catch(() => {}); }
  if (st.cur === 'memorial') { await p.screenshot({ path: `${out}/memorial.png`, fullPage: true }); await p.click('text=残す').catch(() => {}); }
  if (st.cur === 'result') {
    await p.screenshot({ path: `${out}/result.png`, fullPage: true });
    log.push({ ph: 'end', text: (await p.evaluate(() => document.querySelector('.screen').innerText)).slice(0, 3000) });
    break;
  }
  await p.waitForTimeout(120);
}
const evs = log.filter((x) => x.ph === 'event' && x.ev);
const byId = {};
for (const e of evs) byId[e.ev] = (byId[e.ev] || 0) + 1;
const summary = {
  wallSec: Math.round((Date.now() - t0) / 1000),
  years: Math.floor((log.filter((x) => x.t != null).pop() || {}).t / 4),
  scenes: evs.length,
  uniqueEvents: Object.keys(byId).length,
  repeats: Object.entries(byId).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]),
  quizzes: log.filter((x) => x.quiz).length,
  errors: [...new Set(errors)],
  overflow: [...overflow],
};
fs.writeFileSync(`${out}/log.json`, JSON.stringify({ summary, log }, null, 1));
console.log(JSON.stringify(summary, null, 1));
await b.close();
