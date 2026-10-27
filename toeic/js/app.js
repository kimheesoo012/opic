// 앱 시작·라우팅·홈/학습/결과/목표 화면
import { C } from './ctx.js';
import { buildBank, questionsOf, conceptName } from './bank.js';
import { openStore, idbAdapter, lsAdapter, memoryAdapter } from './store.js';
import { estimate, goalGap, levelLabel } from './scoring.js';
import { recommend } from './recommend.js';
import { newSession, summarize } from './sessions.js';
import { dueCards } from './review.js';
import { partStats, todayAttempts, todayStudySec, conceptStats } from './stats.js';
import { createTTS } from './tts.js';
import { makeRng, dayKey, pct, fmtSec, fmtMin, PART_NAMES, TARGETS, DAY, LETTERS } from './util.js';
import { h, on, toast, sheet, closeSheet, installDispatcher, icons } from './ui.js';
import { initPlayer, startSession, render as renderPlayer, leavePlayer, explainHtml } from './player.js';
import { renderReview, renderStats, renderSettings, renderTrain, renderAbout } from './screens.js';

export const APP_VERSION = '1.0.0';

// ---------- 공용 ----------
C.save = (keys) => { for (const k of keys) C.store.save(k).catch((e) => console.warn('save', k, e)); };
C.estimateNow = () => {
  const since = Date.now() - 90 * DAY;
  return estimate(C.state.attempts.filter((a) => a.t >= since), { baseline: C.state.profile.baseline || undefined });
};
C.snapshotScore = () => {
  if (!C.state.attempts.length) return;
  const est = C.estimateNow();
  const day = dayKey(Date.now());
  const snap = { t: Date.now(), day, lo: est.total.lo, hi: est.total.hi, point: est.total.point, n: est.n, enough: est.enough };
  const hist = C.state.scoreHistory;
  if (hist.length && hist[hist.length - 1].day === day) hist[hist.length - 1] = snap; else hist.push(snap);
  if (hist.length > 120) hist.splice(0, hist.length - 120);
};

function applyTheme() {
  const t = C.state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
C.applyTheme = applyTheme;
C.scoreCardHtml = (est) => scoreCard(est);

const NAV = [['home', '홈', 'home'], ['learn', '학습', 'learn'], ['review', '복습', 'review'], ['stats', '기록', 'stats'], ['prefs', '설정', 'settings']];
function navHtml(active) {
  return `<nav class="nav" aria-label="주 메뉴"><div class="nav-in">${NAV.map(([r, label, ic]) => `<button data-act="nav" data-r="${r}" ${active === r ? 'aria-current="page"' : ''}>${icons[ic]}<span>${label}</span></button>`).join('')}</div></nav>`;
}
on('nav', (el) => C.go(el.dataset.r));
on('go', (el) => C.go(el.dataset.r));

C.go = (route) => {
  if (location.hash !== `#${route}`) location.hash = route;
  else C.render();
};

C.render = () => {
  const route = (location.hash || '#home').slice(1) || 'home';
  C.route = route;
  const root = document.getElementById('app');
  if (route !== 'play') leavePlayer();
  closeSheet();
  if (route === 'play') { renderPlayer(); return; }
  const base = route.split('-')[0];
  let html = '';
  if (base === 'home') html = renderHome();
  else if (base === 'learn') html = renderLearn();
  else if (base === 'result') html = renderResult();
  else if (base === 'goal') html = renderGoal();
  else if (base === 'review') html = renderReview();
  else if (base === 'stats') html = renderStats();
  else if (base === 'prefs') html = renderSettings();
  else if (base === 'train') html = renderTrain(route.split('-')[1]);
  else if (base === 'about') html = renderAbout();
  else html = renderHome();
  const navKey = { result: 'learn', goal: 'home', train: 'learn', about: 'stats' }[base] || base;
  root.innerHTML = html + navHtml(navKey);
  window.scrollTo(0, 0);
  if (C.afterRender) { const f = C.afterRender; C.afterRender = null; f(); }
};

// ---------- 점수 카드 ----------
export function scoreCard(est, { compact = false } = {}) {
  const goal = C.state.profile.goal;
  if (!est || est.n === 0) {
    return `<div class="card"><h3>추정 점수</h3><p class="muted small">아직 기록이 없습니다. 간단 진단을 풀면 파트별 약점과 학습 수준을 보여 드립니다.</p></div>`;
  }
  if (!est.enough) {
    return `<div class="card"><div class="row between"><h3>학습 수준</h3><span class="tag warn">데이터 부족</span></div>
      <div class="score-big">${h(est.level)}</div>
      <p class="small muted">기록 ${est.n}문항 — 점수 범위를 말하기엔 부족해 수준만 표시합니다. 진단을 끝까지 풀면 범위가 나옵니다.</p></div>`;
  }
  const L = est.sections.LC;
  const R = est.sections.RC;
  const gapPts = goal - est.total.point;
  return `<div class="card"><div class="row between"><h3>추정 점수 범위</h3><span class="tag accent">추정</span></div>
    <div class="score-big">${est.total.lo}–${est.total.hi}</div>
    <div class="score-sub">LC ${L.lo}–${L.hi} · RC ${R.lo}–${R.hi} · ${h(est.level)}</div>
    ${compact ? '' : sparkline()}
    <p class="small" style="margin:8px 0 0">${gapPts > 0 ? `목표 <b>${goal}</b>까지 중앙값 기준 약 <b>+${gapPts}점</b>` : `목표 <b>${goal}</b> 근처 — 다음 목표를 올려 보세요`} <a href="#goal" class="small">파트별 차이 보기</a></p>
    <p class="xs muted" style="margin:6px 0 0">검증된 환산 모델이 아니라 문항 난이도·풀이 시간·파트별 성취도로 계산한 범위입니다. <a href="#about">계산 방식</a></p></div>`;
}

function sparkline() {
  const hist = C.state.scoreHistory.filter((x) => x.enough);
  if (hist.length < 2) return '';
  const W = 300;
  const H = 80;
  const ys = hist.flatMap((x) => [x.lo, x.hi]);
  const min = Math.min(...ys) - 20;
  const max = Math.max(...ys) + 20;
  const X = (i) => 6 + (i * (W - 12)) / (hist.length - 1);
  const Y = (v) => H - 6 - ((v - min) * (H - 12)) / (max - min || 1);
  const band = hist.map((x, i) => `${X(i)},${Y(x.hi)}`).join(' ') + ' ' + hist.slice().reverse().map((x, i) => `${X(hist.length - 1 - i)},${Y(x.lo)}`).join(' ');
  const line = hist.map((x, i) => `${X(i)},${Y(x.point)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="추정 점수 범위 추이">
    <polygon points="${band}" fill="var(--accent-soft)"/><polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${hist.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x.point)}" r="2.5" fill="var(--accent)"/>`).join('')}</svg>
    <div class="row between xs muted"><span>${hist[0].day.slice(5)}</span><span>${hist[hist.length - 1].day.slice(5)}</span></div>`;
}

// ---------- 홈 ----------
function courseFor(minutes) {
  const st = C.state;
  const day = dayKey(Date.now());
  const cache = st.profile.course;
  if (cache && cache.day === day && cache.minutes === minutes && !cache.stale) return cache;
  const est = C.estimateNow();
  const rec = recommend({ bank: C.bank, attempts: st.attempts, cards: st.reviews, vocab: st.vocab, wrongNote: st.wrongNote, profile: st.profile, est, minutes });
  const done = cache && cache.day === day ? cache.done || [] : [];
  st.profile.course = { day, minutes, items: rec.course.map((c) => ({ ...c, key: c.kind + JSON.stringify(c.params || {}) })), done };
  C.save(['profile']);
  return st.profile.course;
}
export function markCourseDone(key) {
  const c = C.state.profile.course;
  if (c && key && !c.done.includes(key)) { c.done.push(key); C.save(['profile']); }
}

function renderHome() {
  const st = C.state;
  const est = C.estimateNow();
  const today = todayAttempts(st.attempts);
  const todaySec = todayStudySec(st.studyLog);
  const minutes = st.settings.course || 20;
  const course = courseFor(minutes);
  const due = dueCards(st.reviews, Date.now());
  let html = `<div class="page"><div class="row between"><h1>오늘의 토익</h1><a class="tag accent" href="#goal">목표 ${st.profile.goal}</a></div>`;
  if (st.active) {
    const s = st.active;
    html += `<div class="card"><div class="row"><div class="grow"><h3>이어서 풀기</h3><p class="small muted" style="margin:0">${h(s.title)} · ${Object.keys(s.answers).length}문항 풀이 중</p></div>
      <button class="btn primary" data-act="resume">이어 풀기</button></div></div>`;
  }
  html += `<div class="card"><div class="row between"><div><div class="xs muted">오늘 학습</div><div style="font-size:20px;font-weight:800">${fmtMin(todaySec)}</div></div>
    <div><div class="xs muted">푼 문제</div><div style="font-size:20px;font-weight:800">${today.length}</div></div>
    <div><div class="xs muted">정답률</div><div style="font-size:20px;font-weight:800">${today.length ? pct(today.filter((a) => a.correct).length / today.length) + '%' : '–'}</div></div></div></div>`;
  html += scoreCard(est);
  html += `<h2>오늘의 추천 코스</h2><div class="row between wrap"><div class="seg" role="group" aria-label="코스 길이">${[10, 20, 40].map((m) => `<button data-act="courseLen" data-m="${m}" aria-pressed="${minutes === m}">${m}분</button>`).join('')}</div>
    <button class="btn sm ghost" data-act="courseRefresh">다시 추천</button></div>`;
  course.items.forEach((c, i) => {
    const done = course.done.includes(c.key);
    html += `<div class="card rec"><div class="grow"><b>${done ? '<span class="done-mark">✓</span> ' : ''}${h(c.title)}</b> <span class="tag">${c.minutes}분</span><p>${h(c.reason)}</p></div>
      <button class="btn ${done ? '' : 'primary'} sm" data-act="startRec" data-i="${i}">${done ? '다시' : '시작'}</button></div>`;
  });
  if (due.length) html += `<div class="card"><div class="row"><div class="grow"><h3>복습 대기 ${due.length}개 유형</h3><p class="small muted" style="margin:0">${due.slice(0, 3).map((c) => h(conceptName(C.bank, c.concept))).join(' · ')}</p></div><a class="btn sm" href="#review">복습</a></div></div>`;
  html += `</div>`;
  return html;
}

on('resume', () => C.go('play'));
on('courseLen', (el) => { C.state.settings.course = Number(el.dataset.m); C.save(['settings']); C.render(); });
on('courseRefresh', () => { if (C.state.profile.course) C.state.profile.course.stale = true; C.render(); });

export function startActivity(c) {
  const env = { bank: C.bank, state: C.state, rng: C.rng, now: Date.now() };
  const params = { ...(c.params || {}), recKey: c.key };
  if (C.state.active) {
    sheet(`<h3>풀던 세션이 있습니다</h3><p class="small muted">${h(C.state.active.title)}을(를) 이어서 풀거나, 버리고 새로 시작할 수 있습니다.</p>
      <div class="stack"><button class="btn primary block" data-act="resume">이어서 풀기</button><button class="btn block" data-act="discardAndStart">버리고 새로 시작</button></div>`);
    C.pending = c;
    return;
  }
  if (c.kind === 'para') { markCourseDone(c.key); C.go('train-para'); return; }
  if (c.kind === 'listen') { markCourseDone(c.key); C.go('train-listen'); return; }
  if (c.kind === 'vocab') { markCourseDone(c.key); C.go('train-vocab'); return; }
  const kindMap = { diag: c.params && c.params.kind === 'deep' ? 'deep' : 'diag' };
  const kind = kindMap[c.kind] || c.kind;
  const s = newSession(kind, params, env);
  if (!s) { toast(kind === 'review' ? '지금 복습할 단계가 없습니다.' : '조건에 맞는 문제가 부족합니다.'); return; }
  startSession(s);
}
on('discardAndStart', () => {
  C.state.active = null;
  C.save(['active']);
  closeSheet();
  const c = C.pending;
  C.pending = null;
  if (c) startActivity(c);
});
on('startRec', (el) => startActivity(C.state.profile.course.items[Number(el.dataset.i)]));

// ---------- 학습 허브 ----------
function renderLearn() {
  const ps = partStats(C.state.attempts);
  let html = `<div class="page"><h1>학습</h1>
    <h2>진단</h2>
    <div class="card rec"><div class="grow"><b>간단 진단</b> <span class="tag">15~20분</span><p>전 파트에서 고르게 약 40문항. 약점 파트 파악용.</p></div><button class="btn primary sm" data-act="startKind" data-k="diag">시작</button></div>
    <div class="card rec"><div class="grow"><b>심화 진단</b> <span class="tag">40~60분</span><p>약 79문항. 유형별 실력과 RC 시간 관리까지 분석.</p></div><button class="btn sm" data-act="startKind" data-k="deep">시작</button></div>
    <h2>파트별 연습</h2>`;
  for (let p = 1; p <= 7; p++) {
    const s = ps[p];
    const nQ = { 1: 4, 2: 8, 3: 6, 4: 6, 5: 10, 6: 8, 7: 6 }[p];
    html += `<div class="card rec"><div class="grow"><b>Part ${p}</b> ${PART_NAMES[p]} <span class="tag">${C.bank.count(p)}문항</span>
      <p>${s.n ? `정답률 ${pct(s.acc)}% (${s.n}문항)${s.avgSec != null && p >= 5 ? ` · 평균 ${Math.round(s.avgSec)}초` : ''}` : '아직 기록 없음'}</p></div>
      <div class="stack"><button class="btn primary sm" data-act="startPart" data-p="${p}" data-n="${nQ}">${nQ}문항</button><button class="btn sm ghost" data-act="conceptList" data-p="${p}">유형별</button></div></div>`;
  }
  html += `<h2>실전</h2>
    <div class="card rec"><div class="grow"><b>하프 모의고사</b> <span class="tag">약 60분</span><p>LC 약 49문항 + RC 약 48문항, RC 38분 제한. 끝까지 해설 없이 실전처럼.</p></div><button class="btn primary sm" data-act="startKind" data-k="mock">시작</button></div>
    <div class="card"><b>파트별 시간 제한</b><p class="small muted" style="margin:2px 0 8px">실제 시험 시간 배분 기준. 해설은 끝나고 한꺼번에.</p>
      <div class="stack">
        <button class="btn block" data-act="startTimed" data-p="5" data-n="15" data-l="300">Part 5 · 15문항 · 5분</button>
        <button class="btn block" data-act="startTimed" data-p="6" data-n="8" data-l="360">Part 6 · 2세트 · 6분</button>
        <button class="btn block" data-act="startTimed" data-p="7" data-n="10" data-l="660">Part 7 · 약 10문항 · 11분</button>
        <button class="btn block" data-act="startTimed" data-p="2" data-n="13" data-l="0">Part 2 · 13문항 · 한 번만 듣기</button>
      </div></div>
    <h2>고득점 훈련</h2>
    <div class="card rec"><div class="grow"><b>Part 5 속도 훈련</b><p>시간 초과했던 문제·개념부터, 문항별 카운트다운 연속 풀이.</p></div><button class="btn sm" data-act="startKind" data-k="speed">시작</button></div>
    <div class="card rec"><div class="grow"><b>LC 반복 듣기·받아쓰기</b><p>문장 단위 반복, 스크립트 가리기, 빈칸 단어 고르기.</p></div><a class="btn sm" href="#train-listen">열기</a></div>
    <div class="card rec"><div class="grow"><b>RC 패러프레이즈</b><p>지문 표현 ↔ 정답 표현 짝 맞추기.</p></div><a class="btn sm" href="#train-para">열기</a></div>
    <div class="card rec"><div class="grow"><b>단어장 퀴즈</b><p>문제 속에서 저장한 어휘를 4지선다로.</p></div><a class="btn sm" href="#train-vocab">열기</a></div>
  </div>`;
  return html;
}

function startNew(kind, params) {
  if (C.state.active) { startActivity({ kind, params, key: null }); return; }
  const s = newSession(kind, params, { bank: C.bank, state: C.state, rng: C.rng, now: Date.now() });
  startSession(s);
}
on('startKind', (el) => startNew(el.dataset.k, {}));
on('startPart', (el) => startNew('practice', { part: Number(el.dataset.p), nQ: Number(el.dataset.n) }));
on('startTimed', (el) => {
  const l = Number(el.dataset.l);
  startNew('timed', { part: Number(el.dataset.p), nQ: Number(el.dataset.n), limitSec: l || null, title: el.textContent.trim() });
});
on('startConcept', (el) => { closeSheet(); startNew('drill', { concept: el.dataset.c, nQ: 6 }); });
on('conceptList', (el) => {
  const p = Number(el.dataset.p);
  const cs = conceptStats(C.state.attempts);
  const list = C.bank.concepts.filter((c) => c.part === p);
  sheet(`<h3>Part ${p} 유형별 연습</h3><div>${list.map((c) => {
    const s = cs.get(c.id);
    const n = (C.bank.byConcept.get(c.id) || []).length;
    return `<div class="list-item"><div class="grow"><b>${h(c.name)}</b><div class="xs muted">${n}문항 · ${s ? `정답률 ${pct(s.acc)}% (${s.n})` : '기록 없음'}</div></div><button class="btn sm" data-act="startConcept" data-c="${c.id}" ${n ? '' : 'disabled'}>연습</button></div>`;
  }).join('')}</div><button class="btn block ghost" data-act="closeSheet">닫기</button>`);
});

// ---------- 결과 ----------
function renderResult() {
  let s = C.lastSession;
  if (!s) { try { s = JSON.parse(sessionStorage.getItem('tt-last') || 'null'); } catch { s = null; } }
  if (!s) return `<div class="page"><h1>결과</h1><p class="muted">표시할 결과가 없습니다.</p></div>`;
  const sum = summarize(s, C.bank);
  if (s.params && s.params.recKey) markCourseDone(s.params.recKey);
  let html = `<div class="page"><h1>${h(s.title)} 결과</h1>
    <div class="card"><div class="row between"><div><div class="xs muted">정답</div><div class="score-big">${sum.correct}/${sum.n}</div></div>
    <div><div class="xs muted">정답률</div><div style="font-size:22px;font-weight:800">${sum.n ? pct(sum.correct / sum.n) : 0}%</div></div>
    <div><div class="xs muted">시간</div><div style="font-size:22px;font-weight:800">${fmtSec(s.elapsed)}</div></div></div>
    ${sum.unanswered ? `<p class="small" style="margin:8px 0 0">미응답 ${sum.unanswered}문항${s.timeUp ? ' (RC 제한 시간 종료)' : ''}</p>` : ''}</div>`;
  if (['diag', 'deep', 'mock'].includes(s.kind)) {
    const est = C.estimateNow();
    html += scoreCard(est, { compact: true });
    if (s.kind === 'diag' || s.kind === 'deep') html += `<a class="btn primary block" href="#goal">목표 설정하고 파트별 차이 보기</a>`;
    if (s.kind !== 'diag') {
      const R = est.sections.RC;
      html += `<div class="card"><h3>시간 관리</h3>${[5, 6, 7].map((p) => {
        const info = R.parts[p];
        return `<div class="small">Part ${p}: ${info.timeRatio == null ? '기록 부족' : `목표 시간의 ${pct(info.timeRatio)}%`}</div>`;
      }).join('')}<p class="small muted" style="margin:6px 0 0">${R.unanswered ? `지금 속도로 실제 RC(75분)를 풀면 Part 7에서 약 ${R.unanswered}문항을 못 풀 것으로 추정됩니다.` : '지금 속도면 RC 75분 안에 모두 풀 수 있는 페이스로 추정됩니다.'}</p></div>`;
    }
  }
  if (s.kind === 'deep' || s.kind === 'mock') {
    const byC = {};
    for (const it of s.items) {
      if (it.type !== 'unit') continue;
      const unit = C.bank.unitById.get(it.unitId);
      if (!unit) continue;
      for (const q of questionsOf(unit)) {
        const a = s.answers[q.id];
        if (!a) continue;
        const c = (byC[q.concept] ||= { n: 0, ok: 0, sec: 0, target: C.bank.conceptById.get(q.concept)?.targetSec || 0, part: unit.part });
        c.n++; c.sec += a.sec; if (a.choice === q.answer) c.ok++;
      }
    }
    const rows = Object.entries(byC).filter(([, v]) => v.n >= 2).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n);
    if (rows.length) {
      html += `<div class="card"><h3>유형별 실력 (2문항 이상)</h3><table class="t"><thead><tr><th>유형</th><th class="num">정답률</th><th class="num">평균/목표</th></tr></thead><tbody>${rows.map(([id, v]) => `<tr><td>${h(conceptName(C.bank, id))}</td><td class="num">${pct(v.ok / v.n)}% <span class="muted">(${v.ok}/${v.n})</span></td><td class="num">${v.part >= 5 ? `${Math.round(v.sec / v.n)}/${v.target}초` : '–'}</td></tr>`).join('')}</tbody></table>
        <p class="xs muted" style="margin:6px 0 0">한 번의 진단은 유형당 문항이 적어 참고용입니다. 약점 판단은 누적 기록(유형당 4문항 이상)으로 합니다.</p></div>`;
    }
  }
  html += `<div class="card"><h3>파트별</h3><table class="t"><thead><tr><th>파트</th><th class="num">정답률</th><th class="num">평균 시간</th></tr></thead><tbody>${Object.entries(sum.byPart).map(([p, v]) => `<tr><td>Part ${p} ${PART_NAMES[p]}</td><td class="num">${v.n ? pct(v.correct / v.n) + '%' : '–'} <span class="muted">(${v.correct}/${v.n}${v.unanswered ? `, 미응답 ${v.unanswered}` : ''})</span></td><td class="num">${v.n ? Math.round(v.sec / v.n) + '초' : '–'}</td></tr>`).join('')}</tbody></table></div>`;
  const wrongQs = [];
  for (const it of s.items) {
    if (it.type !== 'unit') continue;
    const unit = C.bank.unitById.get(it.unitId);
    if (!unit) continue;
    for (const q of questionsOf(unit)) {
      const a = s.answers[q.id];
      const slow = s.kind === 'speed' && a && a.sec > (C.bank.conceptById.get(q.concept)?.targetSec || 20);
      if (!a || a.choice !== q.answer || slow) wrongQs.push({ q, unit, a, slow });
    }
  }
  if (wrongQs.length) {
    html += `<h2>${s.feedback === 'end' ? '틀린 문제 해설' : '틀린 문제 다시 보기'} (${wrongQs.length})</h2>`;
    for (const { q, unit, a, slow } of wrongQs) {
      const att = s.attemptIds && s.attemptIds[q.id] ? C.state.attempts.find((x) => x.id === s.attemptIds[q.id]) : null;
      const label = unit.part === 1 ? `사진: ${unit.image.alt}` : unit.part === 6 ? `빈칸 (${q.blank})` : q.question;
      html += `<details class="card"><summary><span class="tag ${slow && a && a.choice === q.answer ? 'warn' : 'bad'}">${slow && a && a.choice === q.answer ? '시간 초과' : a ? '오답' : '미응답'}</span> <span class="small">Part ${unit.part} · ${h(String(label || '').slice(0, 70))}</span></summary>
        ${unit.part === 6 || unit.part === 7 ? `<p class="xs muted">세트 ${h(unit.id)} — 지문은 오답노트에서 다시 풀며 볼 수 있습니다.</p>` : ''}
        ${unit.part >= 3 && unit.part <= 4 ? `<p class="small">${h(q.question)}</p>` : ''}
        ${explainHtml(q, unit, a, { causeFor: att })}</details>`;
    }
    const concepts = [...new Set(wrongQs.filter((w) => !w.a || w.a.choice !== w.q.answer).map((w) => w.q.concept))];
    if (concepts.length) html += `<button class="btn primary block" data-act="reviewConcepts" data-c="${concepts.join(',')}">틀린 유형 단계별 복습 시작 (${concepts.length}개)</button>`;
  } else {
    html += `<p class="muted">틀린 문제가 없습니다.</p>`;
  }
  html += `<div class="stack" style="margin-top:10px"><a class="btn block" href="#home">홈으로</a></div></div>`;
  return html;
}
on('reviewConcepts', (el) => {
  const concepts = el.dataset.c.split(',');
  const s = newSession('review', { concepts }, { bank: C.bank, state: C.state, rng: C.rng, now: Date.now() });
  if (!s) { toast('지금 복습할 단계가 없습니다.'); return; }
  startSession(s);
});

// ---------- 목표 ----------
function renderGoal() {
  const st = C.state;
  const goal = st.profile.goal;
  const est = C.estimateNow();
  const gg = goalGap(est, goal);
  let html = `<div class="page"><h1>목표 설정</h1>
    <p class="small muted">다음 목표를 고르세요. 목표가 높을수록 어려운 함정 문제 비중이 올라갑니다.</p>
    <div class="seg" role="group" aria-label="목표 점수" style="display:flex">${TARGETS.map((t) => `<button style="flex:1" data-act="setGoal" data-g="${t}" aria-pressed="${goal === t}">${t}</button>`).join('')}</div>`;
  html += scoreCard(est, { compact: true });
  if (est.n) {
    html += `<div class="card"><h3>파트별 차이 (목표 ${goal})</h3>
      <p class="xs muted" style="margin:0 0 8px">실제 시험 난이도 분포를 가정했을 때의 정답률 추정. 목표에 필요한 섹션 점수: LC ${gg.want.LC} · RC ${gg.want.RC}</p>
      ${[1, 2, 3, 4, 5, 6, 7].map((p) => {
        const g = gg.parts[p];
        const few = g.n < 4;
        return `<div style="margin:10px 0"><div class="row between small"><span>Part ${p} ${PART_NAMES[p]}</span><span>${few ? '<span class="tag warn">기록 부족</span>' : `${pct(g.now)}% → <b>${pct(g.need)}%</b>`}</span></div>
          <div class="bar"><i style="width:${pct(g.now)}%;${few ? 'opacity:.35' : ''}"></i><b style="left:${pct(g.need)}%"></b></div></div>`;
      }).join('')}
      <p class="xs muted">막대 = 현재 추정, 세로선 = 목표에 필요한 수준. 기록이 적은 파트는 약점으로 단정하지 않습니다.</p></div>`;
  }
  const b = st.profile.baseline || {};
  html += `<div class="card"><h3>최근 실제 점수 (선택)</h3><p class="xs muted" style="margin:0">입력하면 기록이 적을 때 약한 사전 정보로만 쓰고, 풀이 기록이 쌓일수록 영향이 줄어듭니다.</p>
    <div class="row"><label class="field grow"><span>LC</span><input type="number" min="5" max="495" step="5" value="${b.LC || ''}" data-change="baseline" data-k="LC"></label>
    <label class="field grow"><span>RC</span><input type="number" min="5" max="495" step="5" value="${b.RC || ''}" data-change="baseline" data-k="RC"></label></div></div>
    <a class="btn primary block" href="#home">오늘의 학습으로</a></div>`;
  return html;
}
on('setGoal', (el) => {
  C.state.profile.goal = Number(el.dataset.g);
  C.state.profile.onboarded = true;
  if (C.state.profile.course) C.state.profile.course.stale = true;
  C.save(['profile']);
  C.render();
});
on('baseline', (el) => {
  const v = Number(el.value);
  const b = C.state.profile.baseline || {};
  if (v >= 5 && v <= 495) b[el.dataset.k] = v; else delete b[el.dataset.k];
  C.state.profile.baseline = Object.keys(b).length ? b : null;
  C.save(['profile']);
  toast('저장했습니다');
});

// ---------- 시작 ----------
async function loadData() {
  if (window.__TT_DATA__) return window.__TT_DATA__;
  const get = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(`${f} ${r.status}`); return r.json(); });
  const idx = await get('index.json');
  const [concepts, ...files] = await Promise.all([get('concepts.json'), ...idx.files.map(get)]);
  return { version: idx.version, concepts: concepts.concepts, units: files.flatMap((f) => f.units) };
}

async function openBestStore() {
  try { return await openStore(await idbAdapter()); } catch (e) { console.warn('IndexedDB 사용 불가', e); }
  try { localStorage.setItem('tt:probe', '1'); localStorage.removeItem('tt:probe'); return await openStore(lsAdapter()); } catch (e) { console.warn('localStorage 사용 불가', e); }
  toast('이 브라우저에서는 기록이 저장되지 않습니다(사생활 보호 모드 등).', 4000);
  return openStore(memoryAdapter());
}

export async function boot() {
  installDispatcher();
  const root = document.getElementById('app');
  try {
    const data = await loadData();
    C.bank = buildBank(data.units, data.concepts);
    C.dataVersion = data.version;
    if (C.bank.report.errors.length) console.warn('제외된 문항', C.bank.report.errors);
  } catch (e) {
    root.innerHTML = `<div class="page"><h1>문제를 불러오지 못했습니다</h1><p class="muted">${h(e.message)}</p><p class="small">처음 실행은 인터넷 연결이 필요합니다. 한 번 열린 뒤에는 오프라인에서도 실행됩니다.</p></div>`;
    return;
  }
  C.store = await openBestStore();
  C.state = C.store.state;
  C.version = APP_VERSION;
  C.embedded = !!window.__TT_DATA__;
  C.rng = makeRng(Date.now() & 0xffffffff);
  C.tts = createTTS(window);
  applyTheme();
  initPlayer(C);
  window.addEventListener('hashchange', () => C.render());
  C.tts.init().then(() => { if (C.route === 'prefs' || C.route === 'play') C.render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && C.state.active) C.store.save('active'); });
  if (C.state.active && !location.hash) location.hash = 'home';
  C.render();
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && !window.__TT_DATA__) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW 등록 실패', e));
  }
}

boot();
