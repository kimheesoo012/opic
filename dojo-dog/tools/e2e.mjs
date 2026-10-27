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
    if (!localStorage.getItem('dojoinu.settings')) localStorage.setItem('dojoinu.settings', JSON.stringify({ speed: 16, auto: true, autoMode: 'all', furigana: 'hard' }));
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(BASE + 'index.html');
  await p.click('text=はじめから');
  await p.click('text=この子と生きる');
  await p.waitForSelector('.sheet');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('가로 스크롤 없음 (390px)', overflow <= 0, `overflow ${overflow}px`);
  // 학습 단어 탭 → 팝업 → 장면과 함께 저장
  await p.evaluate(() => window.__dojoinu.view.togglePause());
  const w = await p.$('.sheet .w');
  if (w) {
    await w.click();
    await p.waitForSelector('.modal');
    const txt = await p.textContent('.modal');
    ok('단어 탭 → 학습 창', /JLPT/.test(txt) && /이 장면|예문/.test(txt), txt.slice(0, 60).replace(/\s+/g, ' '));
    await p.screenshot({ path: OUT + '/word-popup.png' });
    await p.click('.modal .btn.primary');
  } else ok('단어 탭 → 학습 창', false, '밑줄 단어를 찾지 못함');
  const noPopup = await p.$('.modal');
  ok('탭하지 않으면 학습 창이 뜨지 않음', !noPopup);
  await p.evaluate(() => window.__dojoinu.view.togglePause());
  // 진행 시간 측정 + 중간 이어하기
  const t0 = Date.now();
  await p.waitForTimeout(15000);
  const before = await p.evaluate(() => window.__dojoinu.state.t);
  await p.screenshot({ path: OUT + '/mid-game.png' });
  await p.reload();
  await p.waitForSelector('text=つづきから');
  await p.click('text=つづきから');
  await p.waitForSelector('.hud');
  const after = await p.evaluate(() => window.__dojoinu.state.t);
  ok('이어하기', after === before, `계절 ${before} → ${after}`);
  // 끝까지
  await p.waitForSelector('text=무지개다리', { timeout: 15 * 60 * 1000 });
  const wall = (Date.now() - t0) / 1000;
  const seasons = await p.evaluate(() => (window.__dojoinu.state ? window.__dojoinu.state.t : null));
  ok('16배속 全部おまかせ로 끝까지 진행', true, `실측 ${wall.toFixed(0)}초 (새로고침 포함), ${seasons}계절`);
  await p.screenshot({ path: OUT + '/farewell.png', fullPage: false });
  await p.fill('#last-word', '고마워, 도장의 수호신');
  await p.click('text=남기고 결과 보기');
  await p.waitForSelector('.result-img');
  await p.waitForFunction(() => document.querySelector('.result-img').src.startsWith('blob:'));
  const card = await p.evaluate(async () => {
    const img = document.querySelector('.result-img');
    const r = await fetch(img.src);
    const b = await r.blob();
    const buf = await b.arrayBuffer();
    let s = '';
    const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192));
    return { b64: btoa(s), w: img.naturalWidth, h: img.naturalHeight };
  });
  fs.writeFileSync(OUT + '/result-card.png', Buffer.from(card.b64, 'base64'));
  ok('결과 카드 이미지 생성 (1080×1920)', card.w === 1080 && card.h === 1920, `${card.w}×${card.h}`);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.click('text=이미지 저장')]);
  ok('이미지 저장 버튼 → 내려받기', !!dl, dl ? dl.suggestedFilename() : '내려받기 이벤트 없음');
  await p.screenshot({ path: OUT + '/result.png', fullPage: true });
  // 퀴즈
  const quizBtn = await p.$('text=복습 퀴즈');
  if (quizBtn) {
    await quizBtn.click();
    let answered = 0;
    for (let i = 0; i < 10; i++) {
      const opts = await p.$$('.q-opt');
      if (!opts.length) break;
      // 일부러 몇 개는 틀린다: 첫 문제는 오답을 고른다
      const qn = await p.evaluate(() => [...document.querySelectorAll('.q-opt')].length);
      await opts[i === 0 ? (qn - 1) : 0].click();
      answered++;
      if (i === 2) await p.screenshot({ path: OUT + '/quiz.png' });
      await p.click('text=다음');
    }
    const sumText = await p.textContent('.scroll');
    ok('퀴즈 10문제', answered === 10 && /정답/.test(sumText), `${answered}문제 답함`);
    const retry = await p.$('text=틀린 단어만 다시 풀기');
    if (retry) {
      await retry.click();
      const n = await p.$$eval('.q-opt', (x) => x.length);
      ok('틀린 단어만 다시 풀기', n === 4, `선택지 ${n}개`);
      while (await p.$('.q-opt')) {
        await (await p.$$('.q-opt'))[0].click();
        await p.click('text=다음');
      }
    } else ok('틀린 단어만 다시 풀기', true, '틀린 문제가 없어서 생략');
    await p.click('text=결과 복사');
    const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    ok('결과 복사', /道場犬 단어 복습/.test(clip), clip.split('\n')[0]);
    await p.click('text=돌아가기');
  } else ok('퀴즈 10문제', false, '퀴즈 버튼 없음');
  // 단어장
  await p.click('text=타이틀로');
  await p.click('text=単語帳');
  const cards = await p.$$('.list details');
  ok('단어장에 장면과 함께 저장', cards.length > 0, `${cards.length}개`);
  if (cards.length) {
    await cards[0].click();
    await p.screenshot({ path: OUT + '/wordbook.png' });
  }
  // 도장의 역사 + 이어서 살아가는 세계
  await p.click('text=돌아가기');
  await p.click('text=はじめから');
  const cont = await p.$('text=이어서 살아가는 세계');
  ok('견생 계승: 「이어서 살아가는 세계」 선택지', !!cont);
  if (cont) {
    await cont.click();
    const info = await p.textContent('.card');
    ok('이어지는 세계 설정', /선대/.test(info), info.match(/선대[^.]*\./)?.[0] || '');
    await p.screenshot({ path: OUT + '/birth-continue.png' });
  }
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
  await p.waitForSelector('.hud');
  ok('오프라인에서 새 견생 시작', true);
  await ctx.close();
}

try {
  await run();
  await offline();
} catch (e) {
  ok('예외 없이 완료', false, e.message);
}
await browser.close();
fs.writeFileSync(OUT + '/results.json', JSON.stringify(results, null, 2));
const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} 통과`);
process.exit(fails.length ? 1 : 0);
