// 휴대폰 화면(390×844, 360×740)에서 실제 브라우저로 RC 앱 전체 흐름 확인
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
const shot = (p, name, full = false) => p.screenshot({ path: `${shotDir}/${name}.png`, fullPage: full });

async function answerLoop(p, { maxSteps = 500, wrongRate = 0.4, causeRate = 0.7, stopAt = null } = {}) {
  let answered = 0;
  for (let i = 0; i < maxSteps; i++) {
    if ((await p.evaluate(() => location.hash)) !== '#play') return answered;
    if (stopAt != null && answered >= stopAt) return answered;
    if (await p.$('[data-act="conceptOk"]')) { await p.click('[data-act="conceptOk"]'); continue; }
    const fresh = await p.$$('.choice[data-act="choose"]:not(.right):not(.wrong)');
    if (fresh.length && !(await p.$('.exp'))) {
      const idx = Math.random() < wrongRate ? Math.floor(Math.random() * fresh.length) : 0;
      await fresh[idx].click();
      answered++;
    }
    const cause = await p.$$('[data-act="cause"]');
    if (cause.length && Math.random() < causeRate && !(await p.$('[data-act="cause"][aria-pressed="true"]'))) await cause[Math.floor(Math.random() * cause.length)].click();
    const next = await p.$('[data-act="next"]:not([disabled])');
    if (next) await next.click();
    await p.waitForTimeout(10);
  }
  return answered;
}
const total = (p) => p.evaluate(() => Number((document.querySelector('.prog .xs').textContent.split('/')[1] || '0').trim()));
const appText = (p) => p.textContent('#app');

// 화면 문구 규칙: 안내 말투·이모지 금지, LC 흔적 없음
const BAD_COPY = /해 보세요|보세요|하세요!|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const LC_WORDS = /Part [1-4]\b|듣기|음성|사진 묘사|질의응답|짧은 대화|짧은 담화/;

const server = await serve(PORT);
const browser = await chromium.launch();
const errors = [];
const copyIssues = [];
async function checkCopy(p, where) {
  const t = await appText(p);
  if (BAD_COPY.test(t)) copyIssues.push(`${where}: ${t.match(BAD_COPY)[0]}`);
  if (LC_WORDS.test(t)) copyIssues.push(`${where}: LC 흔적 "${t.match(LC_WORDS)[0]}"`);
}
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // 1. 홈 → 간단 진단
  await p.goto(BASE);
  await p.waitForSelector('[data-act="startRec"]');
  ok('홈: 첫 추천은 진단', (await p.textContent('.rec')).includes('진단'));
  await checkCopy(p, '홈');
  await shot(p, '01-home');
  await p.click('[data-act="startRec"]');
  await p.waitForSelector('.sess');
  const diagN = await total(p);
  ok('간단 진단 RC 약 30문항', diagN >= 25 && diagN <= 40, `${diagN}문항`);
  const m = await p.evaluate(() => { const b = document.querySelector('.choice'); const r = b.getBoundingClientRect(); return { h: r.height, fs: parseFloat(getComputedStyle(b).fontSize), bottom: r.bottom, vh: innerHeight }; });
  ok('선택지 버튼 높이 ≥48px, 글자 ≥16px, 화면 아래쪽', m.h >= 48 && m.fs >= 16 && m.bottom > m.vh * 0.5, JSON.stringify(m));
  await shot(p, '02-diag-p5');
  await checkCopy(p, '진단 풀이');
  await answerLoop(p);
  ok('간단 진단 완료 → 결과', (await p.evaluate(() => location.hash)) === '#result');
  const rt = await appText(p);
  ok('결과: RC 추정 점수 범위 또는 학습 수준', /RC 추정 점수 범위|학습 수준/.test(rt));
  const xpGain = Number(((await p.textContent('.reward .xp-big')) || '').replace(/\D/g, ''));
  ok('결과: 획득 XP와 첫 배지', xpGain > 0 && (await p.textContent('.reward')).includes('첫 걸음'), `+${xpGain} XP`);
  await checkCopy(p, '진단 결과');
  await shot(p, '03-diag-result', true);

  // 2. 목표
  await p.goto(BASE + '#goal');
  await p.click('[data-act="setGoal"][data-g="850"]');
  await p.waitForTimeout(100);
  const gt = await appText(p);
  ok('목표 850 → RC 목표 455 표시', gt.includes('RC 목표') && gt.includes('455'));
  await p.click('[data-act="setGoal"][data-g="900"]');
  await p.waitForTimeout(100);
  ok('목표 900 → RC 만점으로도 부족 안내', (await appText(p)).includes('LC도 올려야'));
  await shot(p, '04-goal', true);

  // 3. Part 5 연습: 즉시 해설·핵심·오답 원인·어휘
  await p.goto(BASE + '#learn');
  await checkCopy(p, '학습 메뉴');
  await shot(p, '05-learn', true);
  await p.click('[data-act="startPart"][data-p="5"]');
  await p.waitForSelector('.sess');
  const target = await p.textContent('.target-time');
  ok('Part 5 문제당 목표 시간 표시', /목표 20초/.test(target), target);
  await (await p.$$('.choice[data-act="choose"]'))[1].click();
  await p.waitForSelector('.exp');
  ok('즉시 해설: 정답 이유 + 핵심 + 선택지별 함정', (await p.$('.exp .why')) && (await p.$('.exp .tip')) && (await p.$$('.exp ul.traps li')).length === 4);
  if (await p.$('[data-act="cause"]')) {
    await p.click('[data-act="cause"][data-c="grammar"]');
    ok('오답 원인 탭 한 번으로 선택', !!(await p.$('[data-act="cause"][data-c="grammar"][aria-pressed="true"]')));
  }
  await shot(p, '06-p5-feedback');
  const wbtn = await p.$('.exp [data-act="word"]');
  if (wbtn) {
    await wbtn.click();
    await p.waitForSelector('.sheet');
    await p.click('[data-act="saveWord"]');
    await p.click('[data-act="closeSheet"]');
    ok('문제 속 어휘 탭 → 뜻·문맥 → 단어장 저장', true);
  }
  await p.click('[data-act="next"]');
  await answerLoop(p, { stopAt: 3 });
  const before = await p.evaluate(() => document.querySelector('.prog .xs').textContent);
  await p.goto('about:blank');
  await p.goto(BASE);
  await p.waitForSelector('[data-act="resume"]');
  await p.click('[data-act="resume"]');
  await p.waitForSelector('.sess');
  const after = await p.evaluate(() => document.querySelector('.prog .xs').textContent);
  ok('앱을 닫았다 열어도 이어서 풀기', before.split('·')[1].trim() === after.split('·')[1].trim(), `${before} → ${after}`);
  await answerLoop(p);

  // 4. Part 6: 빈칸 강조, 문장 삽입
  await p.goto(BASE + '#learn');
  await p.click('[data-act="startPart"][data-p="6"]');
  await p.waitForSelector('.passage');
  ok('Part 6 현재 빈칸 강조', !!(await p.$('.passage .bk.on')));
  await shot(p, '07-p6');
  await answerLoop(p);

  // 5. Part 7 이중·삼중 지문: 탭 전환, 긴 지문 스크롤, 선택지 고정
  await p.goto(BASE + '#learn');
  await p.click('[data-act="startMulti"]');
  await p.waitForSelector('.ptabs');
  const tabs = await p.$$('[data-act="ptab"]');
  const title1 = await p.textContent('.passage .ptitle');
  await tabs[1].click();
  await p.waitForTimeout(50);
  const title2 = await p.textContent('.passage .ptitle');
  ok('다중 지문 탭 전환', tabs.length >= 2 && title1 !== title2, `${tabs.length}개 탭: ${title1} → ${title2}`);
  await shot(p, '08-p7-multi-tab2');
  // 지문이 화면보다 긴 탭을 찾는다(세트가 무작위라 짧은 탭일 수 있음)
  for (let i = 0; i < tabs.length; i++) {
    const long = await p.evaluate(() => { const mm = document.querySelector('.sess-main'); return mm.scrollHeight > mm.clientHeight; });
    if (long) break;
    const tb = await p.$$('[data-act="ptab"]');
    if (tb[i]) await tb[i].click();
  }
  const geo = await p.evaluate(() => {
    const main = document.querySelector('.sess-main');
    const foot = document.querySelector('.sess-foot');
    main.scrollTop = main.scrollHeight;
    const tabsBox = document.querySelector('.ptabs').getBoundingClientRect();
    return { scrollable: main.scrollHeight > main.clientHeight, footBottom: foot.getBoundingClientRect().bottom, vh: innerHeight, tabsTop: tabsBox.top, mainTop: main.getBoundingClientRect().top };
  });
  ok('긴 지문은 본문만 스크롤, 선택지는 화면 아래에 고정', geo.footBottom <= geo.vh + 1, JSON.stringify(geo));
  ok('스크롤해도 지문 탭이 위에 붙어 있음', geo.tabsTop <= geo.mainTop + 2 && geo.tabsTop >= geo.mainTop - 14, JSON.stringify(geo));
  await shot(p, '09-p7-scrolled');
  const fh1 = await p.evaluate(() => document.querySelector('.sess-foot').getBoundingClientRect().height);
  await p.click('[data-act="wide"]');
  const fh2 = await p.evaluate(() => document.querySelector('.sess-foot').getBoundingClientRect().height);
  ok('지문 크게: 선택지 영역 축소', fh2 <= fh1, `${Math.round(fh1)} → ${Math.round(fh2)}`);
  await p.click('[data-act="wide"]');
  const keptTitle = await p.evaluate(() => document.querySelector('[data-act="ptab"][aria-selected="true"]').textContent);
  await (await p.$$('.choice[data-act="choose"]'))[0].click();
  await p.click('[data-act="next"]');
  ok('다음 문항에서도 선택한 지문 탭 유지', (await p.evaluate(() => document.querySelector('[data-act="ptab"][aria-selected="true"]').textContent)) === keptTitle, keptTitle);
  await answerLoop(p);
  ok('이중·삼중 지문 세션 완료', (await p.evaluate(() => location.hash)) === '#result');

  // 6. Part 7 지문별 시간 훈련
  await p.goto(BASE + '#learn');
  await p.click('[data-act="startKind"][data-k="p7time"]');
  await p.waitForSelector('.sess');
  const tl = await p.textContent('.timer small');
  ok('Part 7 지문별 카운트다운', tl === '지문' && /지문 목표/.test(await p.textContent('.target-time')), tl);
  await shot(p, '10-p7time');
  await answerLoop(p);

  // 7. Part 5 연속 풀이: 20초 지나면 자동으로 다음 문항
  await p.goto(BASE + '#learn');
  await p.clock.install();
  await p.click('[data-act="startKind"][data-k="speed"]');
  await p.waitForSelector('.sess');
  ok('연속 풀이 문항 타이머', (await p.textContent('.timer small')) === '문항');
  await (await p.$$('.choice[data-act="choose"]'))[0].click(); // 탭 한 번으로 다음
  await p.waitForTimeout(50);
  const q2 = await p.evaluate(() => document.querySelector('.prog .xs').textContent);
  await p.clock.runFor(21500);
  await p.waitForTimeout(100);
  const q3 = await p.evaluate(() => document.querySelector('.prog .xs').textContent);
  ok('20초가 지나면 시간 초과로 다음 문항', q2 !== q3, `${q2} → ${q3}`);
  await shot(p, '11-speed');
  await answerLoop(p);
  const st = await appText(p);
  ok('연속 풀이 결과에 시간 초과 표시', st.includes('시간 초과'));
  await shot(p, '12-speed-result', true);
  await p.reload();

  // 8. 시간 초과 문제 모음
  await p.goto(BASE + '#review');
  await p.waitForSelector('h1');
  const ot = await p.$('[data-act="overtimeStart"]');
  ok('복습 화면에 시간 초과 문제 모음', !!ot);
  if (ot) {
    await ot.click();
    await p.waitForSelector('.sess');
    await answerLoop(p);
    ok('시간 초과 문제 다시 풀기 완료', (await p.evaluate(() => location.hash)) === '#result');
  }

  // 9. 단계별 복습
  await p.goto(BASE + '#review');
  await checkCopy(p, '복습');
  if (await p.$('[data-act="startReview"]')) {
    await p.click('[data-act="startReview"]');
    await p.waitForSelector('.sess');
    ok('복습 1단계 핵심 개념 카드', !!(await p.$('[data-act="conceptOk"]')));
    await shot(p, '13-review-concept');
    await answerLoop(p, { wrongRate: 0.2 });
    ok('단계별 복습 완료', (await p.evaluate(() => location.hash)) === '#result');
  } else ok('복습 카드 생성', false);

  // 10. RC 실전 모의고사 100문항
  await p.goto(BASE + '#learn');
  await p.click('[data-act="startKind"][data-k="full"]');
  await p.waitForSelector('.sess');
  const fullN = await total(p);
  ok('RC 실전 모의고사 100문항', fullN >= 98 && fullN <= 104, `${fullN}문항`);
  ok('실전 모의고사 남은 시간 75분', (await p.textContent('.timer small')) === '남은 시간' && (await p.textContent('.timer b')).startsWith('7'));
  await answerLoop(p, { stopAt: 5 });
  await p.click('[data-act="exitAsk"]');
  await p.click('[data-act="exitFinish"]');
  await p.waitForSelector('h1');
  ok('모의고사 중간 종료 → 미응답 표시', (await appText(p)).includes('미응답'));

  // 11. 기록·요약 복사·백업
  await p.goto(BASE + '#stats');
  await checkCopy(p, '기록');
  await p.click('[data-act="copySummary"]');
  await p.waitForTimeout(200);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok('결과 요약 복사', clip.includes('[토익 RC 훈련 요약]') && clip.includes('파트별 정답률') && clip.includes('약점 유형'), clip.split('\n').slice(0, 2).join(' / '));
  await shot(p, '14-stats', true);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="exportData"]')]);
  const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  const nA = exported.data.attempts.length;
  ok('기록 JSON 내보내기', exported.app === 'toeic-trainer' && exported.schema === 1 && nA > 0, `${nA}개`);
  const badPath = path.join(shotDir, 'bad.json');
  fs.writeFileSync(badPath, JSON.stringify({ app: 'other', data: {} }));
  await p.setInputFiles('#importFile', badPath);
  await p.waitForSelector('.sheet');
  const sheetText = await p.textContent('.sheet');
  await p.click('.sheet [data-act="closeSheet"]');
  const cnt = await p.evaluate(async () => new Promise((res) => { const r = indexedDB.open('toeic-trainer'); r.onsuccess = () => { const q = r.result.transaction('attempts').objectStore('attempts').count(); q.onsuccess = () => res(q.result); }; }));
  ok('잘못된 파일은 거부, 기존 기록 유지', sheetText.includes('가져올 수 없는') && cnt === nA, `${cnt}/${nA}`);

  // 11-b. 학습 동기: 연속 기록·XP·레벨·실력 지도·배지·하루 목표
  await p.goto(BASE + '#home');
  await p.waitForSelector('.streak');
  const hs = await p.evaluate(() => ({ days: document.querySelectorAll('.week .wd').length, today: !!document.querySelector('.wd.today'), ring: document.querySelector('.streak .ring').textContent, lv: document.querySelector('.streak .lv').textContent }));
  ok('홈: 연속 기록 카드(요일 7칸, 오늘 표시, XP 고리, 레벨)', hs.days === 7 && hs.today && /XP/.test(hs.ring) && /Lv\.\d/.test(hs.lv), JSON.stringify(hs));
  const g0 = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('toeic-trainer'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('game'); q.onsuccess = () => res(q.result); }; }));
  ok('XP 저장, 하루 목표 달성 → 연속 1일', g0.total > 100 && Object.keys(g0.done).length === 1 && (await p.textContent('.streak-n')).includes('1일 연속'), `총 ${g0.total} XP`);
  await shot(p, '14b-home-streak');
  await p.goto(BASE + '#stats');
  await p.waitForSelector('.badges');
  const mrows = await p.$$('.mrow');
  ok('기록: 실력 지도 34유형, 배지, 최근 7일 XP', mrows.length === 34 && (await p.$$('.badge.on')).length >= 2 && (await p.$$('.xpchart .col')).length === 7, `${mrows.length}유형`);
  await p.click('details summary');
  await mrows[0].click();
  await p.waitForSelector('.sess');
  ok('실력 지도에서 유형 탭 → 그 유형 연습', (await p.textContent('.prog .xs')).includes('집중'));
  await p.click('.choice[data-act="choose"]');
  await p.goto(BASE + '#stats');
  await p.waitForSelector('.badges');
  await p.click('details summary');
  await (await p.$$('.mrow'))[1].click();
  ok('풀던 세션이 있으면 덮어쓰기 전에 확인', ((await p.textContent('.sheet').catch(() => '')) || '').includes('풀던 세션이 있습니다'));
  await p.click('[data-act="discardAndStartPending"]');
  await p.waitForSelector('.sess');
  await p.click('[data-act="exitAsk"]');
  await p.click('[data-act="exitFinish"]');
  await p.goto(BASE + '#prefs');
  await p.click('[data-act="daily"][data-n="150"]');
  await p.goto(BASE + '#home');
  ok('하루 목표 변경 → 홈 고리 반영', (await p.textContent('.streak .ring')).includes('/150'));
  // 2.0 기록(경험치 없음)으로 업데이트한 사용자: 풀이 기록으로 XP를 다시 계산
  await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('toeic-trainer'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').delete('game'); t.oncomplete = res; }; }));
  await p.reload();
  await p.waitForSelector('.streak');
  const g1 = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('toeic-trainer'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('game'); q.onsuccess = () => res(q.result); }; }));
  ok('이전 버전 기록에서 XP·목표 달성일 복원', g1 && g1.total > 0 && Object.keys(g1.done).length === 1, g1 ? `${g1.total} XP` : '없음');

  // 12. 독해·어휘 훈련, 설정, 다크 모드, 가로 스크롤
  for (const r of ['train-para', 'train-vocab', 'prefs', 'about']) {
    await p.goto(BASE + '#' + r);
    await p.waitForSelector('h1');
    await checkCopy(p, r);
  }
  await p.goto(BASE + '#train-para');
  await p.click('[data-act="ptChoose"]');
  ok('바꿔 말하기 퀴즈', (await appText(p)).includes('맞힘 '));
  await p.goto(BASE + '#train-vocab');
  if (await p.$('[data-act="vtSeed"]')) await p.click('[data-act="vtSeed"]');
  if (await p.$('[data-act="vtChoose"]')) { await p.click('[data-act="vtChoose"]'); ok('단어장 4지선다', !!(await p.$('.choice.right'))); }
  await p.goto(BASE + '#prefs');
  await p.click('[data-act="theme"][data-t="dark"]');
  await p.goto(BASE + '#learn');
  await shot(p, '15-dark-learn');
  ok('다크 모드', (await p.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(15, 18, 22)');
  let overflow = [];
  for (const r of ['home', 'learn', 'review', 'stats', 'prefs', 'goal']) {
    await p.goto(BASE + '#' + r);
    await p.waitForSelector('h1');
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) overflow.push(r);
  }
  ok('가로 스크롤 없음', !overflow.length, overflow.join(','));

  // 13. 오프라인
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForTimeout(500);
  await ctx.setOffline(true);
  await p.goto(BASE + '#home', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await p.reload().catch(() => {});
  await p.waitForSelector('[data-act="nav"]', { timeout: 8000 }).catch(() => {});
  ok('오프라인에서 앱 실행', (await appText(p).catch(() => '')).includes('오늘의 RC'));
  await p.goto(BASE + '#learn').catch(() => {});
  await p.click('[data-act="startPart"][data-p="7"]').catch(() => {});
  await p.waitForSelector('.passage', { timeout: 5000 }).catch(() => {});
  ok('오프라인에서 Part 7 풀이', !!(await p.$('.passage')));
  await ctx.setOffline(false);
  await ctx.close();

  // 14. 작은 화면(360×740)에서 삼중 지문
  const ctx2 = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => errors.push('[360] ' + e.message));
  await p2.goto(BASE + '#learn');
  await p2.waitForSelector('[data-act="startMulti"]');
  await p2.click('[data-act="startMulti"]');
  await p2.waitForSelector('.ptabs');
  const g2 = await p2.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 1, tabsOver: document.querySelector('.ptabs').scrollWidth > document.querySelector('.ptabs').clientWidth, foot: document.querySelector('.sess-foot').getBoundingClientRect().bottom <= innerHeight + 1 }));
  ok('360px 화면: 페이지 가로 넘침 없음, 선택지 보임', !g2.over && g2.foot, JSON.stringify(g2));
  await shot(p2, '16-360-multi');
  await ctx2.close();
} catch (e) {
  ok('예외 없이 실행', false, e.stack);
} finally {
  await browser.close();
  server.close();
}
ok('화면 문구 규칙(안내 말투·이모지·LC 흔적 없음)', copyIssues.length === 0, [...new Set(copyIssues)].join(' | '));
ok('페이지 오류 없음', errors.length === 0, errors.slice(0, 5).join(' | '));
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
fs.writeFileSync(path.join(shotDir, 'e2e-results.json'), JSON.stringify(results, null, 1));
process.exit(failed.length ? 1 : 0);
