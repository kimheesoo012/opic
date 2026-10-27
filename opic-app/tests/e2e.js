/* 휴대폰 화면 E2E 테스트 (Chromium + 가짜 마이크 장치)
   실행: node opic-app/tests/e2e.js   (opic-app 폴더를 로컬 서버로 띄워서 테스트)
   실제 마이크·사람 목소리·브라우저 음성 인식은 헤드리스 환경에서 검증할 수 없다. */
'use strict';
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS || path.join(ROOT, 'tests', 'screenshots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end('nf'); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

const results = [];
async function step(name, fn) {
  try { await fn(); results.push(['PASS', name]); console.log('PASS', name); }
  catch (e) { results.push(['FAIL', name, e.message]); console.log('FAIL', name, '\n   ', e.message.split('\n')[0]); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    permissions: ['microphone', 'clipboard-read', 'clipboard-write'], acceptDownloads: true
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = n => page.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: false });
  const closeModals = async () => { while (await page.locator('.modal-wrap').count()) { await page.locator('.modal-actions button').last().click(); await page.waitForTimeout(150); } };
  async function record(ms) {
    await page.locator('#dock .rec-btn').click();
    await page.waitForFunction(() => document.querySelector('#dock').dataset.state === 'recording', null, { timeout: 8000 });
    await page.waitForTimeout(ms);
    await page.locator('#dock .rec-btn').click();
    await page.waitForFunction(() => document.querySelector('#dock') && document.querySelector('#dock').dataset.state !== 'saving' && document.querySelector('#dock').dataset.state !== 'recording', null, { timeout: 8000 });
    await page.waitForTimeout(300);
  }

  await step('홈 화면 로드 (휴대폰 390×844, 다크)', async () => {
    await page.goto(base);
    await page.waitForSelector('.hero');
    assert(await page.locator('.qlist li').count() === 3, '오늘의 3문제 3개');
    const fs16 = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    assert(fs16 >= 16, '기본 글자 16px 이상');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert(bg === 'rgb(15, 20, 32)', '다크 배경 ' + bg);
    await shot('01-home');
  });

  const QID = 'movie.p1';
  await step('문제 카드: 질문 듣기 버튼, 문제 글 기본 숨김', async () => {
    await page.goto(base + '#/q/' + QID);
    await page.waitForSelector('.play-big');
    assert(await page.locator('.qtext').first().isHidden(), '문제 글 숨김');
    await page.locator('.toggle-text').click();
    assert(await page.locator('.qtext').first().isVisible(), '보기 누르면 보임');
    const box = await page.locator('#dock .rec-btn').boundingBox();
    assert(box.y > 844 - 180 && box.height >= 70, '녹음 버튼이 화면 아래에 크게 ' + JSON.stringify(box));
    await shot('02-card-empty');
  });

  await step('첫 답변 녹음 → 저장 → 재생', async () => {
    await record(3000);
    await page.waitForSelector('.rec-detail');
    assert(await page.locator('.btnchip[data-rec]').count() === 1, '녹음 1개');
    const dur = await page.locator('.rec-detail .stats dd').first().textContent();
    assert(/[234]초/.test(dur), '길이 표시 ' + dur);
    await page.locator('.rec-detail .pbtn').click();
    await page.waitForTimeout(1200);
    const playing = await page.evaluate(() => document.querySelector('.rec-detail .pbar i').style.width);
    assert(parseFloat(playing) > 0, '재생 진행 ' + playing);
    await page.locator('.rec-detail .pbtn').click();
    await shot('03-card-recorded');
  });

  await step('받아쓴 글 직접 입력·수정 → 규칙 기반 분석', async () => {
    const ta = page.locator('.tr-edit');
    await ta.fill('Um, last year I watched a movie with my friend. At first it was boring, but after that it got really exciting. In the end, we loved it.');
    await page.locator('.save-tr').click();
    await page.waitForFunction(() => document.querySelector('.rule-box').textContent.includes('과거 시제 동사'));
    const txt = await page.locator('.rule-box').textContent();
    assert(txt.includes('last year'), '시간 표현');
    assert(/군말\s*1회/.test(txt), '군말 1회');
  });

  await step('자가 체크 저장', async () => {
    await page.locator('.checks input').first().check();
    await page.waitForTimeout(300);
  });

  await step('AI 첨삭용 복사: 지정 형식', async () => {
    await page.locator('.copy-ai').click();
    await page.waitForTimeout(400);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert(clip.startsWith('당신은 영어 OPIc 말하기 코치입니다.'), '프롬프트 시작');
    assert(clip.includes('목표는 IH입니다'), '목표 등급');
    assert(clip.includes('[학습자 답변] Um, last year'), '답변 포함');
    assert(/\[답변 시간\] \d+초/.test(clip), '답변 시간');
  });

  await step('첨삭 결과 붙여 넣기·저장 → 3일·7일 재도전 예약', async () => {
    await page.locator('#fbExpr').fill('1. It turned out to be ...\n2. I ended up ...\n3. Looking back, ...');
    await page.locator('#fbImp').fill('Last year, I watched a movie with my friend. At first, it was kind of boring, but it turned out to be really exciting.');
    await page.locator('#saveFb').click();
    await page.waitForSelector('.retries li');
    assert(await page.locator('.retries li').count() === 2, '재도전 2개');
    assert(await page.locator('.pick-targets input:checked').count() === 3, '써 볼 표현 3개 선택');
  });

  await step('수업 노트 표현 추가 (다시 답변 때 제안되는지 확인용)', async () => {
    await page.goto(base + '#/notes');
    await page.locator('#nO').fill('I very like it');
    await page.locator('#nC').fill('I really like it.');
    await page.locator('#nM').fill('very는 동사 앞에 못 씀');
    await page.locator('#add').click();
    await page.waitForSelector('.notes .corr');
    await page.goto(base + '#/q/' + QID);
    await page.waitForSelector('.pick-targets');
    const t = await page.locator('.pick-targets').textContent();
    assert(t.includes('I really like it.') && t.includes('수업 노트'), '노트 표현 제안');
  });

  await step('재답변 녹음 → 「피드백 후」 구분 + 쓰려던 표현 체크', async () => {
    await record(2500);
    await page.waitForSelector('.targets li');
    const kind = await page.locator('.kind-sel').inputValue();
    assert(kind === 'after', '구분 ' + kind);
    await page.locator('.targets .seg button[data-v="1"]').first().click();
    await page.waitForTimeout(300);
    assert(await page.locator('.targets .seg button.on').count() === 1, '썼다 체크');
    await shot('04-card-retry');
  });

  await step('첫 답변과 재답변 나란히 비교', async () => {
    await page.waitForSelector('table.cmp');
    const t = await page.locator('table.cmp').textContent();
    assert(t.includes('첫 답변') && t.includes('피드백 후'), '두 구분');
    assert(t.includes('쓰려던 표현 사용') && t.includes('1 / 3'), '표현 사용 1/3');
    await page.locator('#cmpCard').scrollIntoViewIfNeeded();
    await shot('05-compare');
  });

  await step('앱 종료 후 다시 열기 → 기록 복원', async () => {
    await page.close();
    const p2 = await ctx.newPage();
    global.page2 = p2;
    p2.on('pageerror', e => errors.push(String(e.stack || e)));
    await p2.goto(base + '#/q/' + QID);
    await p2.waitForSelector('.btnchip[data-rec]');
    const nrec = await p2.locator('.btnchip[data-rec]').count();
    assert(nrec === 2, '녹음 2개 유지 ' + nrec);
    assert((await p2.locator('#fbCard').textContent()).includes('I ended up'), '첨삭 유지');
    assert(await p2.locator('.stepper li.done').count() >= 6, '진행 단계 유지');
    const blobOk = await p2.evaluate(async () => { const r = OPIC.store.S.recs[0]; const b = await OPIC.db.getAudio(r.id); return b && b.size > 1000; });
    assert(blobOk, '오디오 파일 유지');
    global.page2 = p2;
  });
  const p = global.page2;

  await step('녹음 중 화면 전환(visibility hidden) → 자동 정지·저장', async () => {
    await p.goto(base + '#/q/cafe.d1');
    await p.waitForSelector('#dock .rec-btn');
    await p.locator('#dock .rec-btn').click();
    await p.waitForFunction(() => document.querySelector('#dock').dataset.state === 'recording');
    await p.waitForTimeout(2200);
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForSelector('.modal-wrap');
    const m = await p.locator('.modal').textContent();
    assert(m.includes('다른 앱으로 전환'), '안내 ' + m);
    await p.evaluate(() => { delete document.visibilityState; });
    const rec = await p.evaluate(() => OPIC.store.S.recs.find(r => r.questionId === 'cafe.d1'));
    assert(rec && rec.interrupted === 'hidden' && rec.durationSec >= 2, '끊긴 녹음 저장');
    await p.locator('.modal-actions button').click();
  });

  await step('녹음 중 앱 강제 종료 → 다시 열면 조각에서 복구', async () => {
    await p.goto(base + '#/q/park.d1');
    await p.waitForSelector('#dock .rec-btn');
    await p.locator('#dock .rec-btn').click();
    await p.waitForFunction(() => document.querySelector('#dock').dataset.state === 'recording');
    await p.waitForTimeout(3500);
    /* 저장 과정 없이 페이지를 버린다 (강제 종료 흉내) */
    await p.evaluate(() => { window.removeEventListener('pagehide', () => {}); });
    const p3 = await ctx.newPage();
    global.page3 = p3;
    await p.close({ runBeforeUnload: false });
    p3.on('pageerror', e => errors.push(String(e.stack || e)));
    await p3.goto(base);
    await p3.waitForSelector('.hero');
    await p3.waitForTimeout(800);
    const rec = await p3.evaluate(() => OPIC.store.S.recs.find(r => r.questionId === 'park.d1'));
    assert(rec, '복구된 녹음 존재');
    const b = await p3.evaluate(async id => { const x = await OPIC.db.getAudio(id); return x ? x.size : 0; }, rec.id);
    assert(b > 1000, '복구 오디오 크기 ' + b);
    const drafts = await p3.evaluate(() => OPIC.db.all('drafts'));
    assert(drafts.length === 0, '임시 조각 정리');
    await p3.waitForSelector('.modal');
    assert((await p3.locator('.modal').textContent()).includes('복구'), '복구 안내');
    await p3.locator('.modal-actions button').click();
    global.page3 = p3;
  });
  const q = global.page3;

  await step('3문제 연습: 유형 집중 → 녹음 → 다음 → 결과', async () => {
    await q.goto(base + '#/practice');
    await q.waitForSelector('[data-focus="past"]');
    await q.locator('[data-focus="past"]').click();
    await q.waitForSelector('.progress');
    for (let i = 0; i < 3; i++) {
      await q.locator('#dock .rec-btn').click();
      await q.waitForFunction(() => document.querySelector('#dock').dataset.state === 'recording');
      await q.waitForTimeout(1200);
      await q.locator('#dock .rec-btn').click();
      await q.waitForSelector('#nextQ');
      await q.locator('#nextQ').click();
    }
    await q.waitForSelector('.result-item');
    assert(await q.locator('.result-item').count() === 3, '결과 3개');
    await q.screenshot({ path: path.join(SHOTS, '06-practice-result.png') });
  });

  await step('즉흥: 5초 시작 훈련 (첫 마디까지 측정)', async () => {
    await q.goto(base + '#/impromptu/start5');
    await q.waitForSelector('#dock .rec-btn');
    await q.locator('#dock .rec-btn').click();
    await q.waitForFunction(() => document.querySelector('#dock').dataset.state === 'recording');
    assert(await q.locator('.countdown').isVisible(), '카운트다운');
    await q.waitForTimeout(1500);
    await q.locator('#dock .rec-btn').click();
    await q.waitForSelector('#nx');
    const t = await q.locator('#after').textContent();
    assert(t.includes('첫 마디까지') || t.includes('감지되지'), '첫 마디 결과');
  });

  await step('과거 경험 훈련: 1단계 4개 단계 녹음', async () => {
    await q.goto(base + '#/story/movie.p1');
    await q.waitForSelector('.frame.big');
    for (let i = 0; i < 4; i++) {
      await q.locator('#dock .rec-btn').click();
      await q.waitForFunction(() => document.querySelector('#dock').dataset.state === 'recording');
      await q.waitForTimeout(900);
      await q.locator('#dock .rec-btn').click();
      await q.waitForFunction(() => document.querySelector('#dock').dataset.state === 'idle');
      await q.waitForTimeout(300);
    }
    await q.waitForSelector('#toS2');
    await q.screenshot({ path: path.join(SHOTS, '07-story.png') });
  });

  await step('스크립트 연습: 저장 → 가리기 단계 → 녹음 → 원문 비교', async () => {
    await q.goto(base + '#/script/new');
    await q.locator('#t').fill('좋아하는 카페');
    await q.locator('#x').fill('My favorite cafe is near my school. It has big windows and comfortable chairs. I go there twice a week.');
    await q.locator('#save').click();
    await q.waitForSelector('.sents');
    await q.locator('#lvSeg button[data-l="2"]').click();
    await q.waitForSelector('.sents .hid');
    await q.locator('#dock .rec-btn').click();
    await q.waitForFunction(() => document.querySelector('#dock').dataset.state === 'recording');
    await q.waitForTimeout(1000);
    await q.locator('#dock .rec-btn').click();
    await q.waitForSelector('#spk');
    await q.locator('#spk').fill('my favorite cafe is near my school it has windows and chairs');
    await q.locator('#doCmp').click();
    await q.waitForSelector('.diff mark');
    await q.screenshot({ path: path.join(SHOTS, '08-script.png') });
  });

  await step('표현 노트 퀴즈 (4지선다)', async () => {
    await q.goto(base + '#/notes');
    for (const [o, c] of [['I went to there', 'I went there.'], ['It was very funny time', 'We had a lot of fun.']]) {
      await q.locator('#nO').fill(o); await q.locator('#nC').fill(c); await q.locator('#add').click(); await q.waitForTimeout(200);
    }
    await q.goto(base + '#/quiz');
    await q.waitForSelector('.opts .btn');
    assert(await q.locator('.opts .btn').count() === 4, '보기 4개');
    await q.screenshot({ path: path.join(SHOTS, '09-quiz.png') });
    await q.locator('.opts .btn').first().click();
    await q.waitForSelector('#nx');
  });

  await step('실전 모의고사: 설문 세트 → 자가 평가 5 → 1번 녹음 → 7번 후 난이도 재조정 → 15문항', async () => {
    await q.goto(base + '#/exam');
    await q.waitForSelector('[data-p="0"]');
    await q.locator('[data-p="0"]').click();
    await q.locator('#svNext').click();
    await q.locator('.sa').nth(4).click();
    await q.locator('#saNext').click();
    await q.waitForSelector('#begin');
    await q.screenshot({ path: path.join(SHOTS, '10-exam-guide.png') });
    await q.locator('#begin').click();
    await q.waitForSelector('.exam-top');
    assert((await q.locator('.exam-top').textContent()).includes('Question 1 of 15'), '15문항');
    assert(await q.locator('.qtext').isHidden(), '문제 글 숨김');
    await q.screenshot({ path: path.join(SHOTS, '11-exam-q1.png') });
    await q.locator('#dock .rec-btn').click();
    await q.waitForFunction(() => document.querySelector('#dock').dataset.state === 'recording');
    await q.waitForTimeout(1200);
    await q.locator('#dock .rec-btn').click();
    await q.waitForFunction(() => document.querySelector('.exam-top') && document.querySelector('.exam-top').textContent.includes('Question 2'));
    for (let i = 2; i <= 7; i++) {
      await q.locator('#skipQ').click();
      await q.locator('.modal-actions .primary').click();
      await q.waitForTimeout(150);
    }
    await q.waitForSelector('.adj-btn');
    await q.locator('[data-a="harder"]').click();
    await q.waitForSelector('.exam-top');
    assert((await q.locator('.exam-top').textContent()).includes('Question 8 of 15'), '8번');
    const n = await q.evaluate(() => OPIC.store.S.sessions.find(s => s.mode === 'exam').questions.length);
    assert(n === 15, '문항 ' + n);
    await q.locator('#quitE').click();
    await q.locator('.modal-actions .primary').click();
    await q.waitForSelector('.result-item');
    assert(await q.locator('.result-item .player').count() === 1, '녹음 1개 결과');
  });

  await step('기록 화면: 통계·저장 공간·선택 삭제 UI', async () => {
    await q.goto(base + '#/records');
    await q.waitForSelector('.hbars');
    assert(await q.locator('.reclist li').count() >= 10, '녹음 목록');
    await q.locator('.reclist input').first().check();
    assert(await q.locator('#selBar').isVisible(), '선택 바');
    await q.screenshot({ path: path.join(SHOTS, '12-records.png') });
  });

  let backupFile = null;
  await step('기록 JSON 내보내기 (오디오 포함)', async () => {
    await q.locator('#withAudio').check();
    const [dl] = await Promise.all([q.waitForEvent('download'), q.locator('#exp').click()]);
    backupFile = path.join(SHOTS, 'backup.json');
    await dl.saveAs(backupFile);
    const j = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    assert(j.format === 'opic-practice-backup' && j.version === 1, '형식·버전');
    assert(j.data.audio.length === j.data.recordings.length, '오디오 포함');
  });

  await step('잘못된 파일 가져오기 → 거부, 기존 기록 보호', async () => {
    const before = await q.evaluate(() => OPIC.store.S.recs.length);
    const bad = path.join(SHOTS, 'bad.json');
    fs.writeFileSync(bad, JSON.stringify({ format: 'opic-practice-backup', version: 1, data: { recordings: [{ nope: 1 }] } }));
    await q.locator('#imp').setInputFiles(bad);
    await q.waitForSelector('.modal');
    assert((await q.locator('.modal').last().textContent()).includes('가져오지 못했습니다'), '거부 안내');
    await q.locator('.modal-actions button').click();
    fs.writeFileSync(bad, '{ not json');
    await q.locator('#imp').setInputFiles(bad);
    await q.waitForSelector('.modal');
    await q.locator('.modal-actions button').click();
    const after = await q.evaluate(() => OPIC.store.S.recs.length);
    assert(before === after, '기록 수 유지');
  });

  await step('다른 기기로 옮기기: 빈 브라우저에 백업 가져오기 → 녹음 재생 가능', async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const r = await ctx2.newPage();
    await r.goto(base + '#/records');
    await r.waitForSelector('#imp', { state: 'attached' });
    await r.locator('#imp').setInputFiles(backupFile);
    await r.waitForSelector('.modal');
    assert((await r.locator('.modal').textContent()).includes('가져왔습니다'), '가져오기 성공');
    const ok = await r.evaluate(async () => { const rec = OPIC.store.S.recs[0]; const b = await OPIC.db.getAudio(rec.id); return OPIC.store.S.recs.length > 5 && b && b.size > 500; });
    assert(ok, '녹음·오디오 복원');
    await ctx2.close();
  });

  await step('설정: 음성 선택·속도 0.8/1.0·라이트 모드', async () => {
    await q.goto(base + '#/settings');
    await q.waitForSelector('#rate');
    await q.locator('#rate button[data-v="0.8"]').click();
    assert(await q.evaluate(() => OPIC.store.S.settings.rate) === 0.8, '속도');
    await q.screenshot({ path: path.join(SHOTS, '13-settings.png') });
    await q.locator('#theme button[data-v="light"]').click();
    await q.waitForTimeout(300);
    assert(await q.evaluate(() => document.documentElement.dataset.theme) === 'light', '라이트');
    await q.goto(base);
    await q.waitForSelector('.hero');
    await q.screenshot({ path: path.join(SHOTS, '14-home-light.png') });
    await q.goto(base + '#/settings'); await q.waitForSelector('#theme');
    await q.locator('#theme button[data-v="dark"]').click();
  });

  await step('PWA: 서비스 워커 등록 후 오프라인에서 열기', async () => {
    await q.goto(base);
    await q.evaluate(() => navigator.serviceWorker.ready);
    await q.reload();
    await q.waitForSelector('.hero');
    await ctx.setOffline(true);
    await q.reload();
    await q.waitForSelector('.hero', { timeout: 8000 });
    await q.goto(base + '#/bank');
    await q.waitForSelector('.bankl li');
    await ctx.setOffline(false);
  });

  await step('가로 스크롤 없음 (모든 주요 화면)', async () => {
    for (const h of ['', '#/practice', '#/q/movie.p1', '#/impromptu', '#/story', '#/scripts', '#/notes', '#/records', '#/bank', '#/settings', '#/guide', '#/exam']) {
      await q.goto(base + h);
      await q.waitForTimeout(250);
      const w = await q.evaluate(() => document.documentElement.scrollWidth);
      assert(w <= 391, `${h || 'home'} scrollWidth ${w}`);
    }
  });

  await step('콘솔·페이지 오류 없음', async () => {
    const real = errors.filter(e => !/favicon|ERR_INTERNET_DISCONNECTED|net::ERR/.test(e));
    assert(!real.length, real.join('\n'));
  });

  await browser.close();
  srv.close();
  const fail = results.filter(r => r[0] === 'FAIL');
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
