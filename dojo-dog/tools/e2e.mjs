// 휴대폰 크기 브라우저에서 끝까지 진행 / 이어하기 / 결과 카드 저장 / 단어장 / 퀴즈 / 오프라인을 확인한다.
// 사용: (dist/pwa 를 http 서버로 띄운 뒤) node tools/e2e.mjs http://localhost:8765/
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || '/tmp/dojo-e2e';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, pass, info = '') => {
  results.push({ name, pass, info });
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : ''));
};

const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] };

async function run() {
  const ctx = await browser.newContext(phone);
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('dojoinu.settings')) localStorage.setItem('dojoinu.settings', JSON.stringify({ speed: 16, auto: true, autoMode: 'major', furigana: 'hard', sound: false, playMode: 'watch' }));
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 6).join(' ')));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(BASE + 'index.html');
  await p.click('text=はじめから');
  await p.click('text=この子と生きる');
  await p.waitForSelector('.device .lcd-canvas');
  await p.waitForSelector('.foot:not([hidden]) .btn', { timeout: 20000 });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('가로 스크롤 없음 (390px)', overflow <= 0, `overflow ${overflow}px`);
  const pix = await p.evaluate(() => getComputedStyle(document.querySelector('.lcd-canvas')).imageRendering);
  ok('LCD 도트 확대 (pixelated)', /pixelated|crisp/.test(pix), pix);
  // 오토 패널: 메인 화면에서 바로 펼쳐진다
  await p.click('.ctl.auto');
  const modes = await p.$$eval('.auto-panel:not([hidden]) .btn', (b) => b.map((x) => x.textContent));
  ok('オート → 아래에 세 가지 방식', modes.join('|') === '大事な場面だけ止まる|全部おまかせ|オートを切る', modes.join('|'));
  await p.screenshot({ path: OUT + '/auto-panel.png' });
  await p.click('.auto-panel [data-mode=all]');
  const cap = await p.textContent('.auto-cap');
  ok('현재 오토 방식 표시', cap === '全部おまかせ', cap);
  // 학습 대상 탭 → 팝업 (탭하지 않으면 뜨지 않음)
  await p.evaluate(() => window.__dojoinu.view.togglePause());
  ok('탭하지 않으면 학습 창이 뜨지 않음', !(await p.$('.modal')));
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    target = await p.$('.panel .w, .panel .gm');
    if (!target) {
      await p.evaluate(() => window.__dojoinu.view.togglePause());
      await p.waitForTimeout(400);
      await p.evaluate(() => window.__dojoinu.view.togglePause());
    }
  }
  if (target) {
    const n = await p.$$eval('.panel .w, .panel .gm', (x) => new Set(x.map((e) => e.dataset.k || e.dataset.g)).size);
    ok('한 장면의 학습 대상 1~3개', n >= 1 && n <= 3, `${n}개`);
    await target.click();
    await p.waitForSelector('.modal');
    const txt = await p.textContent('.modal');
    ok('학습 대상 탭 → 학습 창 (DB 내용·게임 속 문장·저장 버튼)', /N[1-5]|검도 용어|剣道用語/.test(txt) && !/추정/.test(txt) && /例文|～/.test(txt) && /ゲームの場面/.test(txt) && /단어장 저장|単語帳に保存/.test(txt), txt.slice(0, 50).replace(/\s+/g, ' '));
    await p.click('.modal .save-btn');
    ok('「단어장 저장」으로 저장', /저장됨|保存済み/.test(await p.textContent('.modal .save-btn')));
    await p.screenshot({ path: OUT + '/word-popup.png' });
    await p.click('.modal .close-btn');
  } else ok('학습 대상 탭 → 학습 창', false, '밑줄을 찾지 못함');
  // 게임 도중 설정 변경: 후리가나 「항상」 → 읽기가 늘어난다
  const rubyBefore = await p.$$eval('.panel rt', (x) => x.length);
  await p.click('.ctl[aria-label="메뉴"]');
  await p.click('.modal .opt-grid button:has-text("いつも")');
  await p.click('.modal .btn.primary');
  const rubyAfter = await p.$$eval('.panel rt', (x) => x.length);
  ok('게임 도중 후리가나 설정 변경이 바로 반영', rubyAfter > rubyBefore, `${rubyBefore} → ${rubyAfter}`);
  await p.click('.ctl[aria-label="메뉴"]');
  await p.click('.modal .opt-grid button:has-text("N2以上の語だけ")');
  await p.click('.modal .btn.primary');
  await p.evaluate(() => window.__dojoinu.view.togglePause());
  // 진행 + 중간 이어하기
  const t0 = Date.now();
  await p.waitForTimeout(15000);
  // 멈춘 뒤 읽는다 (16배속에서는 읽은 직후 계절이 넘어갈 수 있다)
  const before = await p.evaluate(() => {
    const a = window.__dojoinu;
    if (!a.view.paused) a.view.togglePause();
    a.view.save();
    return a.state.t;
  });
  await p.screenshot({ path: OUT + '/mid-game.png' });
  await p.reload();
  await p.waitForSelector('text=つづきから');
  await p.click('text=つづきから');
  await p.waitForSelector('.device');
  const after = await p.evaluate(() => window.__dojoinu.state.t);
  ok('이어하기', after === before, `계절 ${before} → ${after}`);
  // 끝까지
  await p.waitForSelector('h2:has-text("虹の橋")', { timeout: 15 * 60 * 1000 });
  const wall = (Date.now() - t0) / 1000;
  ok('16배속 全部おまかせ로 끝까지 진행', true, `실측 ${wall.toFixed(0)}초 (새로고침 포함)`);
  await p.waitForTimeout(2500);
  ok('무지개다리: 창이 흐려진다', !!(await p.$('.lcd.rainbow.fade')));
  await p.screenshot({ path: OUT + '/rainbow.png' });
  await p.click('text=つぎへ');
  await p.waitForSelector('.memorial');
  const faces = await p.$$eval('.line.memo canvas.face', (x) => x.length);
  const memoTxt = await p.textContent('.memorial');
  ok('추도 화면: 흑백 초상·연도·가족 한 줄·마지막 한마디', faces >= 3 && /最後に、この子へ一言/.test(memoTxt) && /\d{4} — \d{4}/.test(memoTxt), `얼굴 ${faces}`);
  await p.screenshot({ path: OUT + '/memorial.png', fullPage: true });
  await p.fill('#last-word', '고마워, 도장의 수호신');
  await p.click('text=残す');
  await p.waitForSelector('.result-img');
  await p.waitForFunction(() => document.querySelector('.result-img').src.startsWith('blob:'), null, { timeout: 15000 });
  const card = await p.evaluate(async () => {
    const img = document.querySelector('.result-img');
    const r = await fetch(img.src);
    const u = new Uint8Array(await (await r.blob()).arrayBuffer());
    let s = '';
    for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192));
    return { b64: btoa(s), w: img.naturalWidth, h: img.naturalHeight };
  });
  fs.writeFileSync(OUT + '/result-card.png', Buffer.from(card.b64, 'base64'));
  ok('결과 카드 이미지 (1080×1920)', card.w === 1080 && card.h === 1920, `${card.w}×${card.h}`);
  // 이번 견생의 일본어 정리 (만난 N2 어휘·문법, 퀴즈, 취약 표현, 다음 복습)
  const life = await p.$eval('.life-study', (e) => e.textContent).catch(() => '');
  await p.$eval('.life-study', (e) => e.scrollIntoView({ block: 'start' })).catch(() => {});
  await p.screenshot({ path: OUT + '/life-study.png' });
  ok('견생 정리: 이번 판의 일본어', /出会ったN2語彙/.test(life) && /出会ったN2文法/.test(life) && /クイズ/.test(life), life.slice(0, 60).replace(/\s+/g, ' '));
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.click('text=カードを保存')]);
  ok('カードを保存 → 내려받기', !!dl, dl ? dl.suggestedFilename() : '내려받기 이벤트 없음');
  await p.screenshot({ path: OUT + '/result.png', fullPage: true });
  // 이번 견생 복습
  const quizBtn = await p.$('text=この一生の復習 10問');
  if (quizBtn) {
    await quizBtn.click();
    let answered = 0;
    let explained = 0;
    for (let i = 0; i < 10; i++) {
      const opts = await p.$$('.q-opt');
      if (!opts.length) break;
      await opts[i === 0 ? 3 : 0].click();
      answered++;
      if (await p.$('.q-explain:not([hidden]) p')) explained++;
      if (i === 1) await p.screenshot({ path: OUT + '/quiz.png' });
      await p.click('.sheet-foot .btn.primary');
    }
    const sumText = await p.textContent('.scroll');
    ok('복습 퀴즈 10문제 + 해설', answered === 10 && explained === 10 && /結果/.test(sumText), `${answered}문제, 해설 ${explained}`);
    const retry = await p.$('text=間違いだけ もう一度');
    if (retry) {
      await retry.click();
      const n = await p.$$eval('.q-opt', (x) => x.length);
      ok('틀린 것만 다시', n === 4, `선택지 ${n}개`);
      while (await p.$('.q-opt')) {
        await (await p.$$('.q-opt'))[0].click();
        await p.click('.sheet-foot .btn.primary');
      }
    } else ok('틀린 것만 다시', true, '틀린 문제가 없어서 생략');
    await p.click('text=コピー');
    const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    ok('결과 복사', /道場犬/.test(clip), clip.split('\n')[0]);
    await p.click('.sheet-foot .row .btn:last-child');
  } else ok('복습 퀴즈 10문제 + 해설', false, '버튼 없음');
  await p.click('text=タイトルへ');
  // 간격 반복: 기한을 지난 것으로 만들고 타이틀·復習 탭 확인
  await p.evaluate(() => {
    const srs = JSON.parse(localStorage.getItem('dojoinu.srs') || '{}');
    for (const r of Object.values(srs)) r.due = 0;
    localStorage.setItem('dojoinu.srs', JSON.stringify(srs));
  });
  await p.reload();
  const due = await p.textContent('.study-strip .due span');
  ok('타이틀에 오늘의 복습 수', Number(due) > 0, due);
  await p.screenshot({ path: OUT + '/title.png' });
  await p.click('.study-strip');
  await p.waitForSelector('text=今日の復習');
  await p.screenshot({ path: OUT + '/review.png' });
  await p.click('text=単語帳');
  const book = await p.$$('.book-item');
  ok('単語帳 (탭한 말 저장)', book.length > 0, `${book.length}개`);
  await p.click('text=戻る');
  // 今日の一問 → スキップ → 게임
  await p.click('text=はじめから');
  const cont = await p.$('text=続きの世界');
  ok('견생 계승: 「続きの世界」', !!cont);
  if (cont) {
    await cont.click();
    const info = await p.textContent('.card');
    ok('이어지는 세계 설정', /선대|先代/.test(info), info.match(/(선대|先代).*/)?.[0] || '');
  }
  await p.click('text=この子と生きる');
  await p.waitForSelector('text=今日の一問');
  ok('시작 전 今日の一問', true);
  await p.screenshot({ path: OUT + '/daily.png' });
  await p.click('text=スキップ');
  await p.waitForSelector('.device');
  ok('スキップ → 게임', true);
  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function offline() {
  const ctx = await browser.newContext(phone);
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html');
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForTimeout(800);
  const manifest = await p.evaluate(async () => (await (await fetch('./manifest.webmanifest')).json()).display);
  ok('manifest.webmanifest (standalone)', manifest === 'standalone');
  await ctx.setOffline(true);
  await p.reload();
  const title = await p.textContent('h1').catch(() => '');
  ok('오프라인 실행 (서비스 워커)', /道場犬/.test(title), title.slice(0, 10));
  await p.click('text=はじめから');
  await p.click('text=この子と生きる');
  await p.waitForSelector('.device');
  ok('오프라인에서 새 견생 시작', true);
  await ctx.close();
}

// 1판 저장 데이터(옛 설정·옛 단어장 형식)를 그대로 불러온다
async function legacyData() {
  const ctx = await browser.newContext(phone);
  await ctx.addInitScript(() => {
    if (localStorage.getItem('dojoinu.legacy-test')) return;
    localStorage.setItem('dojoinu.legacy-test', '1');
    localStorage.setItem('dojoinu.settings', JSON.stringify({ speed: 2, auto: true, autoMode: 'major', furigana: 'hard', sound: false, bgm: 0.5, sfx: 0.7, theme: 'system' }));
    localStorage.setItem('dojoinu.wordbook', JSON.stringify({ 稽古: { key: '稽古', at: 1, n: 2, last: 2, scenes: [{ ja: '犬か……。まあ、稽古の邪魔だけはするなよ。', ko: '개라……. 뭐, 연습 방해만 하지 마라.', sp: '坂上先生', title: '도장에 온 날', when: '생후 3개월 봄' }] } }));
    localStorage.setItem('dojoinu.study', JSON.stringify({ 稽古: { ok: 1, ng: 0, last: 1 } }));
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 6).join(' ')));
  await p.goto(BASE + 'index.html');
  const set = await p.evaluate(() => window.__dojoinu.settings);
  ok('옛 설정 이전 (furigana hard → n2, 배속 유지)', set.furigana === 'n2' && set.speed === 2 && set.studyLevel === 'n2', JSON.stringify({ f: set.furigana, sp: set.speed, lv: set.studyLevel }));
  await p.click('text=復習');
  await p.click('.tabs button:has-text("単語帳")');
  const items = await p.$$('.book-item');
  ok('옛 단어장 항목이 보인다', items.length === 1, `${items.length}개`);
  if (items.length) {
    await items[0].click();
    await p.waitForSelector('.modal');
    ok('옛 단어장 항목의 학습 창', /稽古/.test(await p.textContent('.modal')));
  }
  ok('옛 데이터로 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

try {
  await run();
  await legacyData();
  await offline();
} catch (e) {
  ok('예외 없이 완료', false, e.message);
}
await browser.close();
fs.writeFileSync(OUT + '/results.json', JSON.stringify(results, null, 2));
const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} 통과`);
process.exit(fails.length ? 1 : 0);
