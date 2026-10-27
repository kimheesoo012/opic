// 휴대폰 화면(390×844)에서 실제 브라우저로 전체 흐름 확인:
// 진단 → 결과 → 목표 → 추천 학습(오답 원인 선택) → 단계별 복습 → 결과 요약 복사 → 중간 종료 후 복원
// → 내보내기/잘못된 가져오기 보호 → 서비스 워커로 오프라인 실행. TTS는 가짜 음성으로 한 번, 음성 없음으로 한 번.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 8790;
const BASE = `http://localhost:${PORT}/toeic/`;
const shotDir = process.env.SHOTS || path.resolve('dist/shots');
fs.mkdirSync(shotDir, { recursive: true });
const results = [];
const ok = (name, cond, detail = '') => { results.push({ name, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

// 가짜 Web Speech: 미국/영국/호주 음성 3개, speak()는 짧게 기다렸다 onend
const FAKE_TTS = `
(() => {
  const voices = [
    { name: 'Fake Samantha', lang: 'en-US', voiceURI: 'fake-us', localService: true, default: true },
    { name: 'Fake Daniel', lang: 'en-GB', voiceURI: 'fake-gb', localService: true },
    { name: 'Fake Karen', lang: 'en-AU', voiceURI: 'fake-au', localService: true },
    { name: 'Fake Yuna', lang: 'ko-KR', voiceURI: 'fake-ko', localService: true },
  ];
  window.__spoken = [];
  class U { constructor(t) { this.text = t; } }
  const synth = { speaking: false, getVoices: () => voices, addEventListener() {}, cancel() { this.speaking = false; },
    speak(u) { this.speaking = true; window.__spoken.push({ text: u.text, voice: u.voice && u.voice.voiceURI, rate: u.rate }); setTimeout(() => { this.speaking = false; u.onend && u.onend(); }, 20); } };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = U;
})();`;
const NO_TTS = `(() => { try { delete window.speechSynthesis; } catch {} Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); window.SpeechSynthesisUtterance = undefined; })();`;

async function answerLoop(p, { maxSteps = 400, wrongRate = 0.4, causeRate = 0.8, stopAt = null } = {}) {
  let answered = 0;
  for (let i = 0; i < maxSteps; i++) {
    const hash = await p.evaluate(() => location.hash);
    if (hash !== '#play') return answered;
    if (stopAt != null && answered >= stopAt) return answered;
    if (await p.$('[data-act="previewSkip"]')) { await p.click('[data-act="previewSkip"]'); continue; }
    if (await p.$('[data-act="conceptOk"]')) { await p.click('[data-act="conceptOk"]'); continue; }
    const fresh = await p.$$('.choice[data-act="choose"]:not(.right):not(.wrong)');
    const fb = await p.$('.exp');
    if (fresh.length && !fb) {
      const idx = Math.random() < wrongRate ? Math.floor(Math.random() * fresh.length) : null;
      if (idx != null) await fresh[idx].click();
      else await fresh[0].click();
      answered++;
    }
    const cause = await p.$$('[data-act="cause"]');
    if (cause.length && Math.random() < causeRate) {
      const pressed = await p.$('[data-act="cause"][aria-pressed="true"]');
      if (!pressed) await cause[Math.floor(Math.random() * cause.length)].click();
    }
    const next = await p.$('[data-act="next"]:not([disabled])');
    if (next) await next.click();
    await p.waitForTimeout(15);
  }
  return answered;
}

const server = await serve(PORT);
const browser = await chromium.launch();
const errors = [];
try {
  // ===== 1. 가짜 TTS로 전체 흐름 =====
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(FAKE_TTS);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(BASE);
  await p.waitForSelector('[data-act="startRec"]');
  ok('홈 화면 표시 + 첫 추천은 진단', (await p.textContent('.rec')).includes('진단'));
  await p.screenshot({ path: `${shotDir}/01-home.png` });

  // 버튼 크기·글자 크기 점검(선택지 48px 이상, 16px 이상)
  await p.click('[data-act="startRec"]');
  await p.waitForSelector('.sess');
  await p.screenshot({ path: `${shotDir}/02-diag-first.png` });
  // 진단 진행
  let lcSeen = false;
  let checkedSizes = false;
  for (let i = 0; i < 400; i++) {
    if ((await p.evaluate(() => location.hash)) !== '#play') break;
    if (await p.$('[data-act="previewSkip"]')) { await p.screenshot({ path: `${shotDir}/03-p3-preview.png` }); await p.click('[data-act="previewSkip"]'); continue; }
    if (!lcSeen && await p.$('.tts-note')) { lcSeen = true; await p.screenshot({ path: `${shotDir}/03-lc.png` }); }
    const ch = await p.$$('.choice[data-act="choose"]');
    if (ch.length && !checkedSizes) {
      const m = await p.evaluate(() => { const b = document.querySelector('.choice'); const r = b.getBoundingClientRect(); return { h: r.height, fs: parseFloat(getComputedStyle(b).fontSize), bottom: r.bottom, vh: innerHeight }; });
      ok('선택지 버튼 높이 ≥48px, 글자 ≥16px, 화면 아래쪽', m.h >= 48 && m.fs >= 16 && m.bottom > m.vh * 0.5, JSON.stringify(m));
      checkedSizes = true;
    }
    if (ch.length) await ch[Math.floor(Math.random() * ch.length)].click();
    const next = await p.$('[data-act="next"]:not([disabled])');
    if (next) await next.click();
  }
  await p.waitForSelector('h1');
  ok('간단 진단 완료 → 결과 화면', (await p.evaluate(() => location.hash)) === '#result');
  const spoken = await p.evaluate(() => window.__spoken);
  const vset = new Set(spoken.map((s) => s.voice));
  ok('LC 음성 재생(설치된 영어 음성만 사용)', spoken.length > 0 && !vset.has('fake-ko'), `발화 ${spoken.length}개, 음성 ${[...vset].join(',')}`);
  ok('화자별로 다른 억양 음성 배정', vset.size >= 2);
  await p.screenshot({ path: `${shotDir}/04-diag-result.png`, fullPage: true });
  const resultText = await p.textContent('#app');
  ok('진단 결과에 범위(추정) 또는 학습 수준 표시', /추정 점수 범위|학습 수준/.test(resultText) && /추정|데이터 부족/.test(resultText));
  ok('진단 결과에 틀린 문제 해설(오답별 함정) 포함', (await p.$$('details.card')).length > 0);

  // 목표 설정
  await p.click('a[href="#goal"]');
  await p.waitForSelector('[data-act="setGoal"]');
  await p.click('[data-act="setGoal"][data-g="900"]');
  await p.waitForTimeout(100);
  ok('목표 900 선택 + 파트별 차이 표시', (await p.textContent('#app')).includes('파트별 차이 (목표 900)'));
  await p.screenshot({ path: `${shotDir}/05-goal.png`, fullPage: true });

  // 홈 추천 코스
  await p.goto(BASE + '#home');
  await p.waitForSelector('[data-act="startRec"]');
  const recs = await p.$$eval('.rec', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  ok('추천 코스에 이유 문장 표시', recs.length >= 1 && recs.every((r) => r.length > 20), recs.slice(0, 3).join(' | '));
  await p.screenshot({ path: `${shotDir}/06-home-after-diag.png`, fullPage: true });

  // 파트 5 연습 (즉시 해설 + 오답 원인)
  await p.goto(BASE + '#learn');
  await p.click('[data-act="startPart"][data-p="5"]');
  await p.waitForSelector('.sess');
  const fresh = await p.$$('.choice[data-act="choose"]');
  // 일부러 오답 고르기: 정답을 알 수 없으므로 두 번째를 고른 뒤 결과 확인
  await fresh[1].click();
  await p.waitForSelector('.exp');
  const expText = await p.textContent('.exp');
  ok('즉시 해설: 정답 이유 + 선택지별 설명', /정답|오답/.test(expText) && (await p.$$('.exp ul.traps li')).length === 4);
  if (await p.$('[data-act="cause"]')) {
    await p.click('[data-act="cause"][data-c="grammar"]');
    ok('오답 원인 탭 한 번으로 선택', await p.$('[data-act="cause"][data-c="grammar"][aria-pressed="true"]'));
  }
  await p.screenshot({ path: `${shotDir}/07-p5-feedback.png`, fullPage: false });
  // 어휘 탭 → 단어장 저장
  const wbtn = await p.$('.exp [data-act="word"]');
  if (wbtn) {
    await wbtn.click();
    await p.waitForSelector('.sheet');
    await p.screenshot({ path: `${shotDir}/08-word-sheet.png` });
    await p.click('[data-act="saveWord"]');
    await p.click('[data-act="closeSheet"]');
    ok('문제 속 어휘 탭 → 뜻·문맥 → 단어장 저장', true);
  }
  await p.click('[data-act="next"]');
  await answerLoop(p, { stopAt: 3 });
  // 중간에 나가기(새로고침) → 복원
  const before = await p.evaluate(() => document.querySelector('.prog .xs').textContent);
  await p.goto('about:blank');
  await p.goto(BASE); // 앱을 닫았다가 다시 여는 상황(시작 URL)
  await p.waitForSelector('[data-act="resume"]');
  ok('풀다가 나가도 홈에 이어서 풀기 표시', true);
  await p.click('[data-act="resume"]');
  await p.waitForSelector('.sess');
  const after = await p.evaluate(() => document.querySelector('.prog .xs').textContent);
  ok('이어서 풀기: 진행 상태 복원', before.split('·')[1].trim() === after.split('·')[1].trim(), `${before} → ${after}`);
  await answerLoop(p, {});
  ok('연습 세션 완료', (await p.evaluate(() => location.hash)) === '#result');

  // 단계별 복습
  await p.goto(BASE + '#review');
  await p.waitForSelector('h1');
  if (await p.$('[data-act="startReview"]')) {
    await p.click('[data-act="startReview"]');
    await p.waitForSelector('.sess');
    const hasConcept = !!(await p.$('[data-act="conceptOk"]'));
    await p.screenshot({ path: `${shotDir}/09-review-concept.png` });
    ok('복습 1단계: 핵심 개념 카드', hasConcept);
    await answerLoop(p, { wrongRate: 0.2 });
    ok('단계별 복습 세션 완료', (await p.evaluate(() => location.hash)) === '#result');
    await p.goto(BASE + '#review');
    await p.screenshot({ path: `${shotDir}/10-review-hub.png`, fullPage: true });
  } else ok('복습 카드 생성', false, '복습 대기 없음');

  // 하프 모의고사 일부 + 결과(RC 시간 제한 표시)
  await p.goto(BASE + '#learn');
  await p.click('[data-act="startKind"][data-k="mock"]');
  await p.waitForSelector('.sess');
  const total = await p.evaluate(() => document.querySelector('.prog .xs').textContent);
  ok('하프 모의고사 약 100문항 구성', /\/(9\d|10\d)$/.test(total.trim()), total);
  await answerLoop(p, { stopAt: 5 });
  await p.click('[data-act="exitAsk"]');
  await p.click('[data-act="exitFinish"]');
  await p.waitForSelector('h1');
  ok('모의고사 중간 종료 → 결과(미응답 표시)', (await p.textContent('#app')).includes('미응답'));

  // 심화 진단: 유형별 실력 + 시간 관리 분석
  await p.goto(BASE + '#learn');
  await p.click('[data-act="startKind"][data-k="deep"]');
  await p.waitForSelector('.sess');
  const deepTotal = await p.evaluate(() => document.querySelector('.prog .xs').textContent);
  await answerLoop(p, { maxSteps: 600 });
  const deepText = await p.textContent('#app');
  ok('심화 진단 완료 → 유형별 실력·시간 관리 표시', deepText.includes('유형별 실력') && deepText.includes('시간 관리'), deepTotal);
  await p.screenshot({ path: `${shotDir}/11b-deep-result.png`, fullPage: true });

  // 기록 화면 + 결과 요약 복사
  await p.goto(BASE + '#stats');
  await p.waitForSelector('[data-act="copySummary"]');
  await p.click('[data-act="copySummary"]');
  await p.waitForTimeout(200);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok('결과 요약 복사(문제 수·파트별 정답률·약점 유형)', clip.includes('[토익 훈련 요약]') && clip.includes('파트별 정답률') && clip.includes('약점 유형'), clip.split('\n').slice(0, 3).join(' / '));
  await p.screenshot({ path: `${shotDir}/11-stats.png`, fullPage: true });

  // 내보내기
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="exportData"]')]);
  const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  const nAttempts = exported.data.attempts.length;
  ok('기록 JSON 내보내기(버전 포함)', exported.app === 'toeic-trainer' && exported.schema === 1 && nAttempts > 0, `${nAttempts}개 기록`);
  // 잘못된 파일 가져오기 → 기존 기록 유지
  const badPath = path.join(shotDir, 'bad.json');
  fs.writeFileSync(badPath, JSON.stringify({ app: 'other', data: {} }));
  await p.setInputFiles('#importFile', badPath);
  await p.waitForSelector('.sheet');
  const sheetText = await p.textContent('.sheet');
  await p.click('.sheet [data-act="closeSheet"]');
  const countAfterBad = await p.evaluate(async () => (await new Promise((res) => { const r = indexedDB.open('toeic-trainer'); r.onsuccess = () => { const t = r.result.transaction('attempts'); const q = t.objectStore('attempts').count(); q.onsuccess = () => res(q.result); }; })));
  ok('잘못된 파일이면 거부하고 기존 기록 보호', sheetText.includes('가져올 수 없는') && countAfterBad === nAttempts, `${countAfterBad}/${nAttempts}`);
  // 올바른 파일 가져오기
  const goodPath = path.join(shotDir, 'good.json');
  fs.writeFileSync(goodPath, JSON.stringify(exported));
  await p.setInputFiles('#importFile', goodPath);
  await p.waitForSelector('[data-act="importConfirm"]');
  await Promise.all([p.waitForEvent('download'), p.click('[data-act="importConfirm"]')]);
  await p.waitForTimeout(300);
  ok('올바른 파일 가져오기', (await p.textContent('.toast')).includes('가져왔습니다'));

  // 훈련 화면들
  for (const t of ['listen', 'para', 'vocab']) {
    await p.goto(BASE + '#train-' + t);
    await p.waitForSelector('h1');
    await p.screenshot({ path: `${shotDir}/12-train-${t}.png`, fullPage: true });
  }
  await p.goto(BASE + '#train-listen');
  await p.click('[data-act="ltMode"][data-m="dict"]');
  const pick = await p.$('[data-act="ltPick"]');
  if (pick) await pick.click();
  ok('LC 받아쓰기(빈칸 단어 고르기)', (await p.textContent('#app')).includes('맞힘 1/1') || (await p.textContent('#app')).includes('맞힘 0/1'));
  await p.goto(BASE + '#train-para');
  await p.click('[data-act="ptChoose"]');
  ok('패러프레이즈 퀴즈', (await p.textContent('#app')).includes('맞힘'));
  await p.goto(BASE + '#train-vocab');
  if (await p.$('[data-act="vtSeed"]')) await p.click('[data-act="vtSeed"]');
  if (await p.$('[data-act="vtChoose"]')) { await p.click('[data-act="vtChoose"]'); ok('단어장 4지선다 복습', !!(await p.$('.choice.right'))); }
  await p.goto(BASE + '#prefs');
  await p.waitForSelector('select[data-acc="US"]');
  const opts = await p.$$eval('select option', (os) => os.map((o) => o.textContent));
  ok('설정: 실제 설치된 영어 음성만 목록에 표시', !opts.some((o) => o.includes('ko-KR')) && opts.some((o) => o.includes('en-GB')));
  await p.screenshot({ path: `${shotDir}/13-settings.png`, fullPage: true });

  // 다크 모드
  await p.click('[data-act="theme"][data-t="dark"]');
  await p.goto(BASE + '#learn');
  await p.screenshot({ path: `${shotDir}/14-dark-learn.png` });
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok('다크 모드', bg === 'rgb(15, 18, 22)', bg);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok('가로 스크롤 없음', !overflow);

  // 오프라인
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForTimeout(500);
  await ctx.setOffline(true);
  await p.goto(BASE + '#home', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await p.reload().catch(() => {});
  await p.waitForSelector('[data-act="nav"]', { timeout: 8000 }).catch(() => {});
  const offText = await p.textContent('#app').catch(() => '');
  ok('오프라인에서 앱 실행(서비스 워커 캐시)', offText.includes('오늘의 토익'));
  await p.goto(BASE + '#learn').catch(() => {});
  await p.click('[data-act="startPart"][data-p="7"]').catch(() => {});
  await p.waitForSelector('.sess', { timeout: 5000 }).catch(() => {});
  ok('오프라인에서 문제 풀이', !!(await p.$('.passage')));
  await p.screenshot({ path: `${shotDir}/15-offline-p7.png` });
  await ctx.setOffline(false);
  await ctx.close();

  // ===== 2. 음성 합성 없는 기기: 스크립트로 진행 =====
  const ctx2 = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await ctx2.addInitScript(NO_TTS);
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => errors.push('[noTTS] ' + e.message));
  await p2.goto(BASE + '#learn');
  await p2.waitForSelector('[data-act="startPart"][data-p="3"]');
  await p2.click('[data-act="startPart"][data-p="3"]');
  await p2.waitForSelector('.sess');
  const t2 = await p2.textContent('.sess-main');
  ok('TTS 없는 기기: 안내 + 스크립트 표시', t2.includes('스크립트를 보며') && !!(await p2.$('.script')));
  await p2.screenshot({ path: `${shotDir}/16-no-tts-p3.png` });
  await answerLoop(p2, {});
  ok('TTS 없이 LC 세션 완료', (await p2.evaluate(() => location.hash)) === '#result');
  await p2.goto(BASE + '#learn');
  await p2.click('[data-act="startPart"][data-p="1"]');
  await p2.waitForSelector('.photo svg');
  await p2.screenshot({ path: `${shotDir}/17-no-tts-p1.png` });
  ok('Part 1 SVG 그림 + 문장 선택지(스크립트 모드)', (await p2.$$('.choice')).length === 4);
  await ctx2.close();
} catch (e) {
  ok('예외 없이 실행', false, e.stack);
} finally {
  await browser.close();
  server.close();
}
ok('페이지 오류 없음', errors.length === 0, errors.slice(0, 5).join(' | '));
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
fs.writeFileSync(path.join(shotDir, 'e2e-results.json'), JSON.stringify(results, null, 1));
process.exit(failed.length ? 1 : 0);
