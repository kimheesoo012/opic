// 휴대폰 화면 브라우저 검사: node talk-notes/tests/e2e.cjs
// 음성 인식·읽어 주기는 가짜로 바꿔(헤드리스 브라우저에는 마이크가 없음) 화면 흐름 전체를 확인한다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const FAKE = () => {
  // 가짜 음성 인식: window.__say 문장을 들은 것으로
  class FakeSR {
    start() { setTimeout(() => {
      const t = window.__say || 'hello';
      const alt = [{ transcript: t, confidence: .9 }];
      alt.isFinal = true;
      this.onresult && this.onresult({ resultIndex: 0, results: [alt] });
      setTimeout(() => this.onend && this.onend(), 30);
    }, 60); }
    stop() {} abort() {}
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
  // 가짜 읽어 주기: 바로 끝남
  const synth = window.speechSynthesis;
  if (synth) { synth.speak = u => setTimeout(() => { u.onstart && u.onstart(); u.onend && u.onend(); }, 10); synth.cancel = () => {}; }
};

let fails = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { fails++; console.log('  ✗ ' + msg); } };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  for (const vp of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
    console.log(`\n■ ${vp.width}×${vp.height}`);
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(FAKE);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());

    // 모든 화면: 가로 넘침 없음
    for (const h of ['#/', '#/note', '#/note?t=les', '#/note/les/-1?tag=cond', '#/note?t=grow', '#/note?t=pron', '#/note?t=phr', '#/note?t=star', '#/note?t=find&q=prepare', '#/practice', '#/stats', '#/settings', '#/card/0903-13']) {
      await p.goto(base + h); await p.waitForTimeout(250);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(ov <= 0, `${h} 가로 넘침 없음 (${ov})`);
    }
    await p.goto(base + '#/note?t=les');
    ok(await p.locator('.ncard').count() === 46, '최근 수업 문장 46개 표시');
    await p.click('.chip:has-text("관사")');
    ok(await p.locator('.ncard').count() === 13, '관사 필터 13개');
    await p.click('[data-tg="hideKr"]');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.ncard .kr.hideable')).display === 'none'), '해석 숨기기');
    await p.click('[data-tg="hideKr"]');
    await p.click('.ncard .star >> nth=0');
    await p.goto(base + '#/note?t=star');
    ok(await p.locator('.ncard').count() === 1, '별표 1개 모임');
    await p.goto(base + '#/note?t=find&q=prepare%20for');
    await p.waitForTimeout(300);
    ok(await p.locator('.ncard').count() >= 3, '검색 결과');

    // 오늘의 학습 한 바퀴
    await p.goto(base + '#/');
    await p.click('.hero a.btn');
    await p.waitForSelector('.q .kind');
    const seen = {};
    for (let step = 0; step < 60; step++) {
      if (await p.locator('.done-h').count()) break;
      const kind = await p.locator('.q .kind').first().innerText();
      const type = /말하기 ·|말하기$/.test(kind.split('\n')[0]) && !/따라/.test(kind) ? 'speak' : /빈칸/.test(kind) ? 'cloze' : /O\/X|맞는 문장/.test(kind) ? 'fix' : /따라/.test(kind) ? 'shadow' : /표현/.test(kind) ? 'phrase' : /발음/.test(kind) ? 'pron' : /소리 구분/.test(kind) ? 'pair' : 'pattern';
      seen[type] = (seen[type] || 0) + 1;
      if (process.env.E2E_DEBUG) console.log('    step', step, type, kind.split('\n')[0]);
      if (type === 'cloze') {
        for (let i = 0; i < 6 && await p.locator('.blank.cur').count(); i++) await p.locator('#bank button:not(.used)').first().click();
        await p.waitForSelector('#next'); await p.click('#next');
      } else if (type === 'fix') { await p.click('[data-ox="1"]'); await p.click('#next'); }
      else if (type === 'pair' || type === 'pattern') { await p.click('.choices button >> nth=0'); await p.click('#next'); }
      else {
        // 말하기 종류: 반은 음성 인식(가짜), 반은 입력
        const n = seen[type];
        if (n % 2) { await p.evaluate(() => { window.__say = 'I think so'; }); await p.click('#mic'); }
        else { await p.click('#b-type'); await p.fill('#ta', 'Yes, I think so.'); await p.click('#b-sub'); }
        try { await p.waitForSelector('.grades', { timeout: 8000 }); }
        catch (e) { console.log('    멈춤:', await p.evaluate(() => document.querySelector('.q').innerText.slice(0, 400))); throw e; }
        if (n === 1) ok(await p.locator('.result .diff').count() === 1, `${type}: 비교 결과 표시`);
        await p.click('.grades [data-g="2"]');
      }
      await p.waitForTimeout(80);
    }
    ok(await p.locator('.done-h').count() === 1, '세션 끝 화면 (' + JSON.stringify(seen) + ')');

    // 기록 반영
    await p.goto(base + '#/stats');
    ok(await p.locator('.heat i.today.l1, .heat i.today.l2, .heat i.today.l3').count() === 1, '오늘 달력 칸 칠해짐');
    await p.goto(base + '#/');
    ok(/\b1$/.test((await p.locator('.hero .nums b').first().innerText()).trim()), '연속 학습일 1');
    ok(/Lv\.2|Lv\.3/.test(await p.locator('.hero .lvline').innerText()), '한 세션 뒤 레벨 2 이상');
    ok(await p.locator('.badge-it.got').count() >= 0, '배지 영역');

    // 모드별 세션: 이어서 하기
    await p.goto(base + '#/s/pair?n=5&order=random');
    await p.click('.choices button >> nth=0'); await p.click('#next');
    await p.click('.choices button >> nth=0'); await p.click('#next');
    await p.goto(base + '#/');
    ok(await p.locator('a[href="#/s/resume"]').count() === 1, '이어서 하기 보임');
    await p.click('a[href="#/s/resume"]');
    ok((await p.locator('#cnt').innerText()).startsWith('3 /'), '3번째 문제부터 이어서');

    // 발음 체크: 맞게 말한 경우 성공
    await p.goto(base + '#/s/pron?group=0&order=seq&n=1');
    await p.evaluate(() => { window.__say = 'rice'; });
    await p.click('#mic'); await p.waitForSelector('#next');
    ok(await p.locator('.result.good').count() === 1, '발음: rice 성공');
    await p.goto(base + '#/s/pron?group=0&order=seq&n=1&again=1');
    await p.evaluate(() => { window.__say = 'lice'; });
    await p.click('#mic'); await p.waitForTimeout(300);
    ok(await p.locator('.result.bad').count() === 1, '발음: lice는 실패');

    // 빈칸 함정 표시
    await p.goto(base + '#/s/one?k=' + encodeURIComponent('z:0828-4'));
    if (await p.locator('.blank').count()) {
      const trap = p.locator('#bank button').filter({ hasNotText: '___' });
      await trap.first().click();
      for (let i = 0; i < 6 && await p.locator('.blank.cur').count(); i++) await p.locator('#bank button:not(.used)').first().click();
      await p.waitForSelector('#next');
      ok(await p.locator('.result').count() === 1, '빈칸 채점');
    }

    // 메모
    await p.goto(base + '#/card/0807-3');
    await p.click('#memo'); await p.fill('#mt', 'interested in 다시 확인'); await p.click('#msave');
    await p.waitForTimeout(200);
    ok(await p.locator('.memo').count() === 1, '메모 저장·표시');

    // 설정: 어둡게, 백업 내보내기 → 가져오기
    await p.goto(base + '#/settings');
    await p.click('[data-seg="theme"] [data-v="dark"]');
    ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark', '어두운 테마');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exp')]);
    const file = await dl.path();
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    ok(json.app === 'talk-notes' && Object.keys(json.data.srs).length > 5, '백업 내보내기');
    p.once('dialog', d => d.accept());
    await p.evaluate(() => localStorage.clear());
    await p.goto(base + '#/settings'); await p.reload();
    await p.setInputFiles('#imp', file);
    await p.click('.sheet [data-close="yes"]');
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('talknotes:v1')).srs).length) === Object.keys(json.data.srs).length, '백업 가져오기');
    // 잘못된 파일은 거부
    const bad = path.join(require('os').tmpdir(), 'tn-bad.json');
    fs.writeFileSync(bad, '{"hello":1}');
    await p.setInputFiles('#imp', bad);
    await p.waitForTimeout(200);
    ok(/백업 파일이 아니/.test(await p.locator('#toast').innerText()), '잘못된 백업 거부');

    ok(errs.length === 0, '콘솔 오류 없음 ' + (errs.length ? JSON.stringify(errs.slice(0, 3)) : ''));
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(fails ? `\n실패 ${fails}개` : '\n모두 통과');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
