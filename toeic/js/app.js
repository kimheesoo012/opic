// 앱 시작·라우팅·홈/학습/결과/목표 화면 (RC 전용)
import { C } from './ctx.js';
import { buildBank, questionsOf, conceptName, targetSec } from './bank.js';
import { openStore, idbAdapter, lsAdapter, memoryAdapter } from './store.js';
import { estimate, goalGap, rcGoal } from './scoring.js';
import { recommend } from './recommend.js';
import { newSession, summarize } from './sessions.js';
import { dueCards } from './review.js';
import { partStats, todayAttempts, todayStudySec, conceptStats, overtimeQids } from './stats.js';
import { makeRng, dayKey, pct, fmtSec, fmtMin, PART_NAMES, TARGETS, DAY, RC_PARTS } from './util.js';
import { h, on, toast, sheet, closeSheet, installDispatcher, icons } from './ui.js';
import { addXp, streakInfo, settle, levelOf, backfill, masteryMap, MASTERY_LABELS, BADGES, shiftDay } from './game.js';
import { play } from './sound.js';
import { initPlayer, startSession, render as renderPlayer, leavePlayer, explainHtml, passageStudyHtml } from './player.js';
import { renderReview, renderStats, renderSettings, renderTrain, renderAbout } from './screens.js';

export const APP_VERSION = '2.3.0';

// ---------- 공용 ----------
C.save = (keys) => { for (const k of keys) C.store.save(k).catch((e) => console.warn('save', k, e)); };
C.estimateNow = () => {
  const since = Date.now() - 90 * DAY;
  return estimate(C.state.attempts.filter((a) => a.t >= since), { baseline: C.state.profile.rcScore || undefined });
};
C.snapshotScore = () => {
  if (!C.state.attempts.some((a) => RC_PARTS.includes(a.part))) return;
  const est = C.estimateNow();
  const day = dayKey(Date.now());
  const snap = { t: Date.now(), day, lo: est.rc.lo, hi: est.rc.hi, point: est.rc.point, n: est.n, enough: est.enough, rc: true };
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

// 경험치 지급: 하루 목표·레벨업은 바로 알리고, 진행 중 세션에도 쌓는다
C.award = (amount) => {
  if (!amount) return null;
  const ev = addXp(C.state.game, amount);
  const s = C.state.active;
  if (s) {
    s.xp = (s.xp || 0) + amount;
    if (ev.goalReached) s.goalHit = ev.streak;
    if (ev.levelUp) s.levelUp = ev.levelUp;
    if (ev.freezeEarned) s.freezeEarned = true;
  }
  C.save(s ? ['game', 'active'] : ['game']);
  // 해설을 끝에 보는 시험형 세션은 풀이 중 알림 없이 결과 화면에서 보여 준다
  if (s && s.feedback === 'end') return ev;
  if (ev.goalReached) { toast(`오늘 목표 달성 · 연속 ${ev.streak}일`, 3000); play('goal', C.state.settings.sound); } else if (ev.levelUp) { toast(`레벨 ${ev.levelUp} 달성`, 3000); play('level', C.state.settings.sound); }
  return ev;
};
C.mastery = () => masteryMap(C.state.attempts, C.maxDiff);

const WD = ['일', '월', '화', '수', '목', '금', '토'];
export const weekday = (d) => WD[new Date(`${d}T12:00`).getDay()];
export function ringHtml(xp, daily) {
  const p = Math.min(100, pct(xp / daily));
  return `<div class="ring ${xp >= daily ? 'full' : ''}" style="--p:${p}" role="img" aria-label="오늘 ${xp}/${daily} XP"><div><b>${xp}</b><small>/${daily} XP</small></div></div>`;
}
export function levelHtml(total) {
  const L = levelOf(total);
  return `<div class="lv"><span class="tag accent">Lv.${L.level}</span><div class="bar grow"><i style="width:${pct(L.into / L.need)}%"></i></div><span class="xs muted">${L.into}/${L.need} XP</span></div>`;
}

function streakCard() {
  const g = C.state.game;
  if (settle(g).length) C.save(['game']);
  const si = streakInfo(g);
  const today = dayKey(Date.now());
  const mon = shiftDay(today, -((new Date().getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(mon, i));
  const left = Math.max(0, g.daily - si.todayXp);
  const msg = si.doneToday ? `오늘 목표 달성. 내일도 채우면 ${si.days + 1}일 연속.`
    : si.days ? `${left} XP 더 채우면 ${si.days + 1}일 연속. 약 ${Math.ceil(left / 10)}문항.`
      : `오늘 ${left} XP를 채우면 연속 1일째. 약 ${Math.ceil(left / 10)}문항.`;
  return `<div class="card streak">
    <div class="row between">
      <div class="row" style="gap:10px"><span class="flame ${si.days ? 'on' : ''}">${icons.flame}</span><div><div class="streak-n">${si.days}일 연속</div><div class="xs muted">최고 ${Math.max(g.best, si.days)}일${g.freezes ? ` · 휴식권 ${g.freezes}` : ''}</div></div></div>
      ${ringHtml(si.todayXp, g.daily)}
    </div>
    <div class="week">${week.map((d) => `<div class="wd ${g.done[d] ? 'done' : g.frozen[d] ? 'frz' : ''} ${d === today ? 'today' : ''}"><i>${g.done[d] ? icons.flame : g.frozen[d] ? icons.snow : ''}</i><span>${weekday(d)}</span></div>`).join('')}</div>
    <p class="small" style="margin:8px 0 0">${msg}</p>
    ${levelHtml(g.total)}
    ${si.doneToday ? '' : '<button class="btn primary block" style="margin-top:10px" data-act="quick">빠른 5문항</button>'}
  </div>`;
}
on('quick', () => startNew('practice', { part: 5, nQ: 5, title: '빠른 5문항' }));

// 결과 화면 보상: 얻은 XP, 목표·연속, 레벨, 숙련도 상승, 새 배지
function rewardCard(s) {
  const g = C.state.game;
  const si = streakInfo(g);
  const gain = s.gain || {};
  const rows = [];
  if (s.goalHit) rows.push(`<div class="rw"><span class="flame on">${icons.flame}</span><b>오늘 목표 달성 · 연속 ${s.goalHit}일</b></div>`);
  else rows.push(`<div class="rw small muted">${si.doneToday ? `오늘 목표 달성 · 연속 ${si.days}일` : `오늘 목표까지 ${Math.max(0, g.daily - si.todayXp)} XP`}</div>`);
  if (s.freezeEarned) rows.push(`<div class="rw">${icons.snow}<span>휴식권 1개 획득. 하루 빠져도 연속 기록 유지.</span></div>`);
  if (s.levelUp) rows.push(`<div class="rw">${icons.bolt}<b>레벨 ${s.levelUp} 달성</b></div>`);
  for (const m of gain.mastery || []) rows.push(`<div class="rw">${icons.star}<span>${h(conceptName(C.bank, m.c))} <b>${MASTERY_LABELS[m.from]} → ${MASTERY_LABELS[m.to]}</b></span></div>`);
  for (const id of gain.badges || []) {
    const b = BADGES.find((x) => x.id === id);
    if (b) rows.push(`<div class="rw new-badge">${icons[b.icon]}<span>배지 <b>${h(b.label)}</b> · ${h(b.desc)}</span></div>`);
  }
  return `<div class="card reward"><div class="row between"><div><div class="xs muted">이번 학습</div><div class="xp-big">+${s.xp || 0} XP</div></div>${ringHtml(si.todayXp, g.daily)}</div>${rows.join('')}${levelHtml(g.total)}</div>`;
}

const NAV = [['home', '홈', 'home'], ['learn', '학습', 'learn'], ['review', '복습', 'review'], ['stats', '기록', 'stats'], ['prefs', '설정', 'settings']];
function navHtml(active) {
  return `<nav class="nav" aria-label="주 메뉴"><div class="nav-in">${NAV.map(([r, label, ic]) => `<button data-act="nav" data-r="${r}" ${active === r ? 'aria-current="page"' : ''}>${icons[ic]}<span>${label}</span></button>`).join('')}</div></nav>`;
}
on('nav', (el) => C.go(el.dataset.r));

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
};

// ---------- 점수 카드 ----------
export function scoreCard(est, { compact = false } = {}) {
  const p = C.state.profile;
  const g = rcGoal(p.goal, p.lcBase);
  if (!est || est.n === 0) {
    return `<div class="card"><h3>RC 추정 점수</h3><p class="muted small">기록이 없습니다. 간단 진단을 풀면 파트별 약점과 학습 수준이 나옵니다.</p></div>`;
  }
  if (!est.enough) {
    return `<div class="card"><div class="row between"><h3>학습 수준</h3><span class="tag warn">데이터 부족</span></div>
      <div class="score-big">${h(est.level)}</div>
      <p class="small muted">기록 ${est.n}문항. 점수 범위를 내기엔 부족해 수준만 표시합니다.</p></div>`;
  }
  const R = est.rc;
  const gap = g.want - R.point;
  return `<div class="card"><div class="row between"><h3>RC 추정 점수 범위</h3><span class="tag accent">추정</span></div>
    <div class="score-big">${R.lo}–${R.hi}</div>
    <div class="score-sub">중앙값 ${R.point} · ${h(est.level)}</div>
    ${compact ? '' : sparkline()}
    <p class="small" style="margin:8px 0 0">${gap > 0 ? `RC 목표 <b>${g.want}</b>까지 약 <b>+${gap}점</b>` : `RC 목표 <b>${g.want}</b> 도달권`} · <a href="#goal">파트별 차이</a></p>
    <p class="xs muted" style="margin:6px 0 0">검증된 환산 모델이 아닌 추정치입니다. <a href="#about">계산 방식</a></p></div>`;
}

function sparkline() {
  const hist = C.state.scoreHistory.filter((x) => x.enough && x.rc);
  if (hist.length < 2) return '';
  const W = 300;
  const H = 80;
  const ys = hist.flatMap((x) => [x.lo, x.hi]);
  const min = Math.min(...ys) - 10;
  const max = Math.max(...ys) + 10;
  const X = (i) => 6 + (i * (W - 12)) / (hist.length - 1);
  const Y = (v) => H - 6 - ((v - min) * (H - 12)) / (max - min || 1);
  const band = hist.map((x, i) => `${X(i)},${Y(x.hi)}`).join(' ') + ' ' + hist.slice().reverse().map((x, i) => `${X(hist.length - 1 - i)},${Y(x.lo)}`).join(' ');
  const line = hist.map((x, i) => `${X(i)},${Y(x.point)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="RC 추정 점수 추이">
    <polygon points="${band}" fill="var(--accent-soft)"/><polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${hist.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x.point)}" r="2.5" fill="var(--accent)"/>`).join('')}</svg>
    <div class="row between xs muted"><span>${hist[0].day.slice(5)}</span><span>${hist[hist.length - 1].day.slice(5)}</span></div>`;
}

// ---------- 홈 ----------
function courseFor(minutes) {
  const st = C.state;
  const day = dayKey(Date.now());
  const cache = st.profile.course;
  if (cache && cache.day === day && cache.minutes === minutes && !cache.stale && cache.v === 2) return cache;
  const est = C.estimateNow();
  const rec = recommend({ bank: C.bank, attempts: st.attempts, cards: st.reviews, vocab: st.vocab, wrongNote: st.wrongNote, profile: st.profile, est, minutes });
  const done = cache && cache.day === day ? cache.done || [] : [];
  st.profile.course = { v: 2, day, minutes, items: rec.course.map((c) => ({ ...c, key: c.kind + JSON.stringify(c.params || {}) })), done };
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
  let html = `<div class="page"><div class="row between"><h1>오늘의 RC</h1><a class="tag accent" href="#goal">목표 ${st.profile.goal}</a></div>`;
  html += streakCard();
  if (st.active) {
    const s = st.active;
    html += `<div class="card"><div class="row"><div class="grow"><h3>이어서 풀기</h3><p class="small muted" style="margin:0">${h(s.title)} · ${Object.keys(s.answers).length}문항 풀이 중</p></div>
      <button class="btn primary" data-act="resume">이어 풀기</button></div></div>`;
  }
  html += `<div class="card"><div class="row between"><div><div class="xs muted">오늘 학습</div><div class="stat">${fmtMin(todaySec)}</div></div>
    <div><div class="xs muted">푼 문제</div><div class="stat">${today.length}</div></div>
    <div><div class="xs muted">정답률</div><div class="stat">${today.length ? pct(today.filter((a) => a.correct).length / today.length) + '%' : '–'}</div></div></div></div>`;
  html += scoreCard(est);
  html += `<h2>오늘의 추천</h2><div class="row between wrap"><div class="seg" role="group" aria-label="코스 길이">${[10, 20, 40].map((m) => `<button data-act="courseLen" data-m="${m}" aria-pressed="${minutes === m}">${m}분</button>`).join('')}</div>
    <button class="btn sm ghost" data-act="courseRefresh">다시 추천</button></div>`;
  course.items.forEach((c, i) => {
    const done = course.done.includes(c.key);
    html += `<div class="card rec"><div class="grow"><b>${h(c.title)}</b>${done ? ' <span class="tag ok">완료</span>' : ''} <span class="tag">${c.minutes}분</span><p>${h(c.reason)}</p></div>
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
    sheet(`<h3>풀던 세션이 있습니다</h3><p class="small muted">${h(C.state.active.title)}. 이어서 풀거나 버리고 새로 시작합니다.</p>
      <div class="stack"><button class="btn primary block" data-act="resume">이어서 풀기</button><button class="btn block" data-act="discardAndStart">버리고 새로 시작</button></div>`);
    C.pending = c;
    return;
  }
  if (c.kind === 'para') { markCourseDone(c.key); C.go('train-para'); return; }
  if (c.kind === 'vocab') { markCourseDone(c.key); C.go('train-vocab'); return; }
  const kind = c.kind === 'diag' && c.params && c.params.kind === 'deep' ? 'deep' : c.kind;
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

// ---------- 학습 ----------
function row(title, tag, desc, act, attrs, primary = false) {
  return `<div class="card rec"><div class="grow"><b>${title}</b>${tag ? ` <span class="tag">${tag}</span>` : ''}<p>${desc}</p></div><button class="btn sm ${primary ? 'primary' : ''}" data-act="${act}" ${attrs}>시작</button></div>`;
}

function renderLearn() {
  const ps = partStats(C.state.attempts);
  const over = overtimeQids(C.state.attempts).length;
  let html = `<div class="page"><h1>학습</h1><h2>진단</h2>
    ${row('간단 진단', '20분', '세 파트에서 약 30문항. 약점 파트 파악.', 'startKind', 'data-k="diag"', true)}
    ${row('심화 진단', '45분', '약 60문항, 이중·삼중 지문 포함. 유형별 실력과 시간 관리 분석.', 'startKind', 'data-k="deep"')}
    <h2>파트별 연습</h2>`;
  for (const p of RC_PARTS) {
    const s = ps[p];
    const nQ = { 5: 10, 6: 8, 7: 6 }[p];
    html += `<div class="card rec"><div class="grow"><b>Part ${p}</b> ${PART_NAMES[p]} <span class="tag">${C.bank.count(p)}문항</span>
      <p>${s.n ? `정답률 ${pct(s.acc)}% · ${s.n}문항${s.avgSec != null ? ` · 평균 ${Math.round(s.avgSec)}초` : ''}` : '기록 없음'}</p></div>
      <div class="stack"><button class="btn primary sm" data-act="startPart" data-p="${p}" data-n="${nQ}">${nQ}문항</button><button class="btn sm ghost" data-act="conceptList" data-p="${p}">유형별</button></div></div>`;
  }
  html += `<div class="card rec"><div class="grow"><b>Part 7 이중·삼중 지문</b> <span class="tag">${(C.bank.byPart[7] || []).filter((u) => u.passages.length > 1).length}세트</span><p>지문 사이 정보를 연결하는 연계 문제.</p></div><button class="btn sm" data-act="startMulti">2세트</button></div>
    <h2>속도 훈련</h2>
    ${row('Part 5 연속 풀이', '12문항', '문항당 20초. 시간이 다 되면 다음 문항으로 넘어갑니다.', 'startKind', 'data-k="speed"', true)}
    ${row('Part 7 지문별 시간 훈련', '2~3세트', '지문 길이로 정한 목표 시간 안에 풀기.', 'startKind', 'data-k="p7time"')}
    ${row('시간 초과 문제 모음', `${over}문항`, '목표 시간을 넘겼던 문제를 시간 안에 다시 풀기.', 'startKind', `data-k="overtime" ${over ? '' : 'disabled'}`)}
    <h2>실전</h2>
    ${row('RC 실전 모의고사', '75분', '100문항. Part 5 30, Part 6 16, Part 7 54. 해설은 끝나고.', 'startKind', 'data-k="full"', true)}
    ${row('하프 모의고사', '38분', '약 50문항. 해설은 끝나고.', 'startKind', 'data-k="mock"')}
    <div class="card"><b>파트별 시간 제한</b><div class="stack" style="margin-top:8px">
      <button class="btn block" data-act="startTimed" data-p="5" data-n="15" data-l="300">Part 5 · 15문항 · 5분</button>
      <button class="btn block" data-act="startTimed" data-p="6" data-n="8" data-l="240">Part 6 · 2세트 · 4분</button>
      <button class="btn block" data-act="startTimed" data-p="7" data-n="10" data-l="660">Part 7 · 약 10문항 · 11분</button>
    </div></div>
    <h2>독해·어휘</h2>
    <div class="card rec"><div class="grow"><b>바꿔 말하기 훈련</b><p>지문 표현과 정답 표현을 짝지어 보기.</p></div><a class="btn sm" href="#train-para">열기</a></div>
    <div class="card rec"><div class="grow"><b>단어장</b><p>문제에서 저장한 어휘를 4지선다로 복습.</p></div><a class="btn sm" href="#train-vocab">열기</a></div>
  </div>`;
  return html;
}

function startNew(kind, params) {
  if (C.state.active) { startActivity({ kind, params, key: null }); return; }
  startSession(newSession(kind, params, { bank: C.bank, state: C.state, rng: C.rng, now: Date.now() }));
}
on('startKind', (el) => startNew(el.dataset.k, {}));
on('startPart', (el) => startNew('practice', { part: Number(el.dataset.p), nQ: Number(el.dataset.n) }));
on('startMulti', () => startNew('practice', { part: 7, nQ: 10, multi: true, title: 'Part 7 이중·삼중 지문' }));
on('startTimed', (el) => startNew('timed', { part: Number(el.dataset.p), nQ: Number(el.dataset.n), limitSec: Number(el.dataset.l), title: el.textContent.trim() }));
on('startConcept', (el) => { closeSheet(); startNew('drill', { concept: el.dataset.c, nQ: 6 }); });
on('conceptList', (el) => {
  const p = Number(el.dataset.p);
  const cs = conceptStats(C.state.attempts);
  const list = C.bank.concepts.filter((c) => c.part === p);
  sheet(`<h3>Part ${p} 유형별 연습</h3><div>${list.map((c) => {
    const s = cs.get(c.id);
    const n = (C.bank.byConcept.get(c.id) || []).length;
    return `<div class="list-item"><div class="grow"><b>${h(c.name)}</b><div class="xs muted">${n}문항 · ${s ? `정답률 ${pct(s.acc)}%, ${s.n}문항 풀이` : '기록 없음'}</div></div><button class="btn sm" data-act="startConcept" data-c="${c.id}" ${n ? '' : 'disabled'}>연습</button></div>`;
  }).join('')}</div><button class="btn block ghost" data-act="closeSheet">닫기</button>`);
});

// ---------- 결과 ----------
function renderResult() {
  let s = C.lastSession;
  if (!s) { try { s = JSON.parse(sessionStorage.getItem('tt-last') || 'null'); } catch { s = null; } }
  if (!s) return `<div class="page"><h1>결과</h1><p class="muted">표시할 결과가 없습니다.</p></div>`;
  const sum = summarize(s, C.bank);
  if (s.params && s.params.recKey) markCourseDone(s.params.recKey);
  let html = `<div class="page"><h1>${h(s.title)} 결과</h1>${rewardCard(s)}
    <div class="card"><div class="row between"><div><div class="xs muted">정답</div><div class="score-big">${sum.correct}/${sum.n}</div></div>
    <div><div class="xs muted">정답률</div><div class="stat">${sum.n ? pct(sum.correct / sum.n) : 0}%</div></div>
    <div><div class="xs muted">시간</div><div class="stat">${fmtSec(s.elapsed)}</div></div></div>
    <p class="small" style="margin:8px 0 0">목표 시간 초과 ${sum.over}문항${sum.unanswered ? ` · 미응답 ${sum.unanswered}문항${s.timeUp ? ', 제한 시간 종료' : ''}` : ''}</p></div>`;
  if (['diag', 'deep', 'mock', 'full'].includes(s.kind)) {
    const est = C.estimateNow();
    html += scoreCard(est, { compact: true });
    if (s.kind === 'diag' || s.kind === 'deep') html += `<a class="btn primary block" href="#goal">목표와 파트별 차이 보기</a>`;
    if (s.kind !== 'diag') {
      const R = est.rc;
      html += `<div class="card"><h3>시간 관리</h3>${RC_PARTS.map((p) => {
        const info = R.parts[p];
        return `<div class="small">Part ${p}: ${info.timeRatio == null ? '기록 부족' : `목표 시간의 ${pct(info.timeRatio)}%`}</div>`;
      }).join('')}<p class="small muted" style="margin:6px 0 0">${R.unanswered ? `이 속도라면 실제 RC 75분 안에 Part 7 약 ${R.unanswered}문항을 못 풀 것으로 추정.` : '이 속도라면 RC 75분 안에 모두 풀 수 있는 페이스.'}</p></div>`;
      html += conceptTable(s);
    }
  }
  html += `<div class="card"><h3>파트별</h3><table class="t"><thead><tr><th>파트</th><th class="num">정답률</th><th class="num">평균</th><th class="num">초과</th></tr></thead><tbody>${Object.entries(sum.byPart).map(([p, v]) => `<tr><td>Part ${p}</td><td class="num">${v.n ? pct(v.correct / v.n) + '%' : '–'} <span class="muted">${v.correct}/${v.n}</span></td><td class="num">${v.n ? Math.round(v.sec / v.n) + '초' : '–'}</td><td class="num">${v.over}</td></tr>`).join('')}</tbody></table></div>`;
  const wrongQs = [];
  for (const it of s.items) {
    if (it.type !== 'unit') continue;
    const unit = C.bank.unitById.get(it.unitId);
    if (!unit) continue;
    for (const q of questionsOf(unit)) {
      const a = s.answers[q.id];
      const slow = a && a.choice === q.answer && a.sec > targetSec(C.bank, q, unit) && ['speed', 'p7time', 'overtime', 'timed'].includes(s.kind);
      if (!a || a.choice !== q.answer || slow) wrongQs.push({ q, unit, a, slow });
    }
  }
  if (wrongQs.length) {
    html += `<h2>다시 볼 문제 ${wrongQs.length}</h2>`;
    for (const { q, unit, a, slow } of wrongQs) {
      const att = s.attemptIds && s.attemptIds[q.id] ? C.state.attempts.find((x) => x.id === s.attemptIds[q.id]) : null;
      const tag = slow ? ['warn', '시간 초과'] : !a ? ['bad', '미응답'] : a.choice === -1 ? ['bad', '시간 초과'] : ['bad', '오답'];
      const label = unit.part === 6 ? `빈칸 (${q.blank})` : q.question;
      html += `<details class="card"><summary><span class="tag ${tag[0]}">${tag[1]}</span> <span class="small">Part ${unit.part} · ${h(String(label || '').replace(/-{7}/, '___').slice(0, 70))}</span></summary>
        ${unit.part >= 6 ? `<details class="pt-det"><summary class="small">지문과 해석</summary>${passageStudyHtml(unit, q)}</details>` : ''}
        ${explainHtml(q, unit, a, { causeFor: att, inPlay: false })}</details>`;
    }
    const concepts = [...new Set(wrongQs.filter((w) => !w.a || w.a.choice !== w.q.answer).map((w) => w.q.concept))];
    if (concepts.length) html += `<button class="btn primary block" data-act="reviewConcepts" data-c="${concepts.join(',')}">틀린 유형 단계별 복습 · ${concepts.length}개</button>`;
  } else {
    html += `<p class="muted">틀린 문제가 없습니다.</p>`;
  }
  html += `<div class="stack" style="margin-top:10px"><a class="btn block" href="#home">홈으로</a></div></div>`;
  return html;
}

function conceptTable(s) {
  const byC = {};
  for (const it of s.items) {
    if (it.type !== 'unit') continue;
    const unit = C.bank.unitById.get(it.unitId);
    if (!unit) continue;
    for (const q of questionsOf(unit)) {
      const a = s.answers[q.id];
      if (!a) continue;
      const c = (byC[q.concept] ||= { n: 0, ok: 0, sec: 0, target: 0 });
      c.n++; c.sec += a.sec; c.target += targetSec(C.bank, q, unit);
      if (a.choice === q.answer) c.ok++;
    }
  }
  const rows = Object.entries(byC).filter(([, v]) => v.n >= 2).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n);
  if (!rows.length) return '';
  return `<div class="card"><h3>유형별 실력</h3><table class="t"><thead><tr><th>유형</th><th class="num">정답률</th><th class="num">평균/목표</th></tr></thead><tbody>${rows.map(([id, v]) => `<tr><td>${h(conceptName(C.bank, id))}</td><td class="num">${pct(v.ok / v.n)}% <span class="muted">${v.ok}/${v.n}</span></td><td class="num">${Math.round(v.sec / v.n)}/${Math.round(v.target / v.n)}초</td></tr>`).join('')}</tbody></table>
    <p class="xs muted" style="margin:6px 0 0">2문항 이상 나온 유형만. 약점 판단은 유형당 4문항 이상 누적 기록으로 합니다.</p></div>`;
}

on('reviewConcepts', (el) => {
  const s = newSession('review', { concepts: el.dataset.c.split(',') }, { bank: C.bank, state: C.state, rng: C.rng, now: Date.now() });
  if (!s) { toast('지금 복습할 단계가 없습니다.'); return; }
  startSession(s);
});

// ---------- 목표 ----------
function renderGoal() {
  const p = C.state.profile;
  const est = C.estimateNow();
  const gg = goalGap(est, p.goal, p.lcBase);
  let html = `<div class="page"><h1>목표 설정</h1>
    <p class="small muted">총점 목표를 고르면 LC 기준 점수를 뺀 만큼이 RC 목표가 됩니다. 목표가 높을수록 고급·함정 문제 비중이 올라갑니다.</p>
    <div class="seg" role="group" aria-label="목표 점수" style="display:flex">${TARGETS.map((t) => `<button style="flex:1" data-act="setGoal" data-g="${t}" aria-pressed="${p.goal === t}">${t}</button>`).join('')}</div>
    <div class="card"><div class="row between"><span>RC 목표</span><b style="font-size:22px">${gg.want}</b></div>
      <p class="xs muted" style="margin:4px 0 0">${p.goal} − LC ${p.lcBase}${gg.overflow ? ` · RC 만점으로도 ${gg.overflow}점 부족. LC도 올려야 하는 목표.` : ''}</p></div>`;
  html += scoreCard(est, { compact: true });
  if (est.n) {
    html += `<div class="card"><h3>파트별 차이</h3>
      <p class="xs muted" style="margin:0 0 8px">실제 시험 난이도 분포를 가정한 정답률 추정. 막대는 현재, 세로선은 RC ${gg.want}점에 필요한 수준.</p>
      ${RC_PARTS.map((pp) => {
        const g = gg.parts[pp];
        const few = g.n < 4;
        return `<div style="margin:10px 0"><div class="row between small"><span>Part ${pp} ${PART_NAMES[pp]}</span><span>${few ? '<span class="tag warn">기록 부족</span>' : `${pct(g.now)}% → <b>${pct(g.need)}%</b>`}</span></div>
          <div class="bar"><i style="width:${pct(g.now)}%;${few ? 'opacity:.35' : ''}"></i><b style="left:${pct(g.need)}%"></b></div></div>`;
      }).join('')}</div>`;
  }
  html += `<div class="card"><h3>기준 점수</h3>
    <div class="row"><label class="field grow"><span>LC 기준 점수</span><input id="lcBase" type="number" min="5" max="495" step="5" value="${p.lcBase ?? ''}" data-change="profNum" data-k="lcBase"></label>
    <label class="field grow"><span>최근 RC 점수</span><input id="rcScore" type="number" min="5" max="495" step="5" value="${p.rcScore ?? ''}" data-change="profNum" data-k="rcScore"></label></div>
    <p class="xs muted" style="margin:0">LC 기준 점수는 RC 목표 계산에만 씁니다. 최근 RC 점수는 기록이 적을 때만 추정에 약하게 반영됩니다.</p></div>
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
on('profNum', (el) => {
  const v = Number(el.value);
  if (v >= 5 && v <= 495) C.state.profile[el.dataset.k] = Math.round(v / 5) * 5; else C.state.profile[el.dataset.k] = el.dataset.k === 'lcBase' ? 0 : null;
  if (C.state.profile.course) C.state.profile.course.stale = true;
  C.save(['profile']);
  C.render();
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
  toast('이 브라우저에서는 기록이 저장되지 않습니다.', 4000);
  return openStore(memoryAdapter());
}

// 2.0 이전 기록에는 경험치가 없으니 풀이 기록으로 다시 계산한다
C.ensureGame = () => {
  const g = C.state.game;
  if (!g.total && !g.settled && (C.state.attempts.length || C.state.sessions.length)) backfill(g, C.state.attempts, C.state.sessions);
  settle(g);
};

// 1.x 기록 호환: LC/RC 기준 점수, LC 진행 중 세션 정리
function migrate(st) {
  const p = st.profile;
  if (p.baseline && typeof p.baseline === 'object') {
    if (p.rcScore == null && p.baseline.RC) p.rcScore = p.baseline.RC;
    if (p.lcBase == null && p.baseline.LC) p.lcBase = p.baseline.LC;
    delete p.baseline;
  }
  if (p.lcBase == null) p.lcBase = 395;
  if (st.active && st.active.items.some((it) => it.type === 'unit' && !C.bank.unitById.get(it.unitId))) st.active = null;
  st.scoreHistory = st.scoreHistory.filter((x) => x.rc);
  for (const [k, c] of Object.entries(st.reviews)) if (!C.bank.byConcept.has(c.concept)) delete st.reviews[k];
  for (const [k, w] of Object.entries(st.wrongNote)) if (!C.bank.qById.has(w.qid)) delete st.wrongNote[k];
  if (!st.active) st.active = null;
  C.ensureGame();
  C.save(['profile', 'active', 'scoreHistory', 'reviews', 'wrongNote', 'game']);
}

export async function boot() {
  installDispatcher();
  const root = document.getElementById('app');
  try {
    const data = await loadData();
    C.bank = buildBank(data.units, data.concepts);
    C.maxDiff = {};
    for (const [c, refs] of C.bank.byConcept) C.maxDiff[c] = Math.max(...refs.map((r) => r.q.difficulty));
    C.dataVersion = data.version;
    if (C.bank.report.errors.length) console.warn('제외된 문항', C.bank.report.errors);
  } catch (e) {
    root.innerHTML = `<div class="page"><h1>문제를 불러오지 못했습니다</h1><p class="muted">${h(e.message)}</p><p class="small">처음 실행에는 인터넷 연결이 필요합니다. 한 번 열린 뒤에는 오프라인에서도 실행됩니다.</p></div>`;
    return;
  }
  C.store = await openBestStore();
  C.state = C.store.state;
  C.version = APP_VERSION;
  C.embedded = !!window.__TT_DATA__;
  C.rng = makeRng(Date.now() & 0xffffffff);
  migrate(C.state);
  applyTheme();
  initPlayer(C);
  window.addEventListener('hashchange', () => C.render());
  document.addEventListener('visibilitychange', () => { if (document.hidden && C.state.active) C.store.save('active'); });
  C.render();
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && !C.embedded) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW 등록 실패', e));
  }
}

boot();
