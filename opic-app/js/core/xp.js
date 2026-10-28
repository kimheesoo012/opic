/* 동기부여: XP·레벨·연속 학습(보호권)·배지·유형별 숙련도·성장 비교 (순수 로직)
   레벨·숙련도는 연습량과 자가 체크를 보여 주는 표시일 뿐 OPIc 등급 예측이 아니다. */
(function (root) {
  'use strict';
  const util = root.OPIC && root.OPIC.util || (typeof require !== 'undefined' ? require('./util.js') : null);
  const DAY = util.DAY;

  /* XP 받는 법 (화면에도 그대로 보여 준다) */
  const RULES = [
    ['답변 녹음', '10 XP + 말한 시간 30초마다 2 XP (최대 +8)'],
    ['과거 경험 단계별 녹음', '단계마다 4 XP'],
    ['받아쓴 글 저장 / 자가 체크', '녹음마다 처음 한 번 3 XP / 2 XP'],
    ['쓰려던 표현을 실제로 씀', '표현마다 3 XP'],
    ['5초 안에 말 시작 성공', '보너스 3 XP'],
    ['첨삭 결과 저장', '10 XP'],
    ['3일·7일 재도전 완료', '15 XP'],
    ['모의고사 완주 (답변 5개 이상)', '30 XP'],
    ['표현 퀴즈 정답 / 10문제 완료', '정답마다 2 XP / 5 XP'],
    ['스크립트 일치율 80% 이상', '5 XP'],
    ['수업 표현 노트 추가', '2 XP']
  ];
  const GOALS = [{ xp: 20, label: '가볍게' }, { xp: 40, label: '보통' }, { xp: 60, label: '열심히' }];

  function recordingXP(rec) {
    if (rec.mode === 'story-step') return 4;
    const dur = rec.durationSec || 0;
    if (dur < 3) return 2;
    return 10 + Math.min(8, Math.floor(dur / 30) * 2);
  }

  /* 레벨: 연습량 표시 */
  const LEVEL_XP = [0, 50, 120, 220, 350, 520, 730, 1000];
  const LEVEL_NAMES = ['첫 마디', '한 문장', '문장 잇기', '이야기 견습생', '이야기꾼', '즉흥 대응러', '문단 스피커', '롱 토커'];
  function levelStart(n) { return n <= LEVEL_XP.length ? LEVEL_XP[n - 1] : LEVEL_XP[LEVEL_XP.length - 1] + (n - LEVEL_XP.length) * 300; }
  function levelInfo(total) {
    let n = 1;
    while (levelStart(n + 1) <= total) n++;
    const cur = levelStart(n), next = levelStart(n + 1);
    return { level: n, name: n <= LEVEL_NAMES.length ? LEVEL_NAMES[n - 1] : `마스터 스피커 ${n - LEVEL_NAMES.length}`, cur, next, into: total - cur, need: next - cur, pct: (total - cur) / (next - cur) };
  }

  /* 연속 학습: XP를 얻은 날 또는 보호권으로 지킨 날이 이어진 수 */
  function activeSet(state) {
    const s = new Set(Object.keys(state.days || {}).filter(k => state.days[k] > 0));
    (state.frozen || []).forEach(k => s.add(k));
    return s;
  }
  function streakInfo(state, now) {
    now = now || Date.now();
    const set = activeSet(state);
    const today = util.dayKey(now);
    const todayDone = !!(state.days && state.days[today] > 0);
    return { streak: util.streak(Array.from(set), now), todayDone };
  }
  /* 앱을 열 때: 어제(또는 그 전까지) 빠진 날을 보호권으로 메운다. 보호권으로 메울 수 없으면 아무것도 하지 않는다 */
  function applyFreezes(state, now) {
    now = now || Date.now();
    if (!state.freezes) return [];
    const set = activeSet(state);
    const gap = [];
    let d = now - DAY;
    while (!set.has(util.dayKey(d)) && gap.length <= state.freezes) { gap.push(util.dayKey(d)); d -= DAY; }
    if (!gap.length || gap.length > state.freezes || !set.has(util.dayKey(d))) return [];
    state.frozen = (state.frozen || []).concat(gap);
    state.freezes -= gap.length;
    return gap;
  }
  /* 연속 7일마다 보호권 1개 (최대 2개) */
  function maybeEarnFreeze(state, now) {
    const { streak } = streakInfo(state, now);
    const today = util.dayKey(now || Date.now());
    state.freezeEarned = state.freezeEarned || [];
    if (streak > 0 && streak % 7 === 0 && !state.freezeEarned.includes(today) && (state.freezes || 0) < 2) {
      state.freezeEarned.push(today);
      state.freezes = (state.freezes || 0) + 1;
      return true;
    }
    return false;
  }

  /* 배지: ctx = { recs, qs, notes, sessions, state, streak, groups(bank.FOCUS_GROUPS), byId } */
  const BADGES = [
    { id: 'first', icon: '🎙', name: '첫 녹음', desc: '첫 답변을 녹음했어요', check: c => c.recs.length >= 1 },
    { id: 'rec10', icon: '🔟', name: '답변 10개', desc: '답변 10개 녹음', check: c => c.answers >= 10 },
    { id: 'rec50', icon: '🏅', name: '답변 50개', desc: '답변 50개 녹음', check: c => c.answers >= 50 },
    { id: 'rec100', icon: '🏆', name: '답변 100개', desc: '답변 100개 녹음', check: c => c.answers >= 100 },
    { id: 'streak3', icon: '🔥', name: '3일 연속', desc: '3일 연속 학습', check: c => c.bestStreak >= 3 },
    { id: 'streak7', icon: '🔥', name: '7일 연속', desc: '7일 연속 학습', check: c => c.bestStreak >= 7 },
    { id: 'streak30', icon: '💎', name: '30일 연속', desc: '30일 연속 학습', check: c => c.bestStreak >= 30 },
    { id: 'goal7', icon: '🎯', name: '목표 달성 7일', desc: '일일 목표를 7번 달성', check: c => (c.state.goalDays || []).length >= 7 },
    { id: 'long2', icon: '⏱', name: '2분 답변', desc: '한 답변을 2분 이상 이어서 말함', check: c => c.recs.some(r => r.mode !== 'story-step' && r.durationSec >= 120) },
    { id: 'loop', icon: '🔁', name: '첨삭 한 바퀴', desc: '첨삭 저장 → 다시 답변 → 비교까지 완료', check: c => Object.values(c.qs).some(s => s.comparedAt && s.feedback) },
    { id: 'retry', icon: '📅', name: '며칠 뒤 재도전', desc: '3일·7일 재도전을 완료', check: c => Object.values(c.qs).some(s => (s.retries || []).some(r => r.doneAt)) },
    { id: 'exam', icon: '📝', name: '모의고사 완주', desc: '실전 모의고사를 끝까지(답변 5개+)', check: c => c.sessions.some(s => s.mode === 'exam' && s.status === 'done' && c.recs.filter(r => r.sessionId === s.id).length >= 5) },
    { id: 'alltypes', icon: '🧭', name: '모든 유형', desc: '묘사·습관·과거·비교·롤플레이·돌발·이슈를 모두 연습', check: c => c.groups.every(g => c.recs.some(r => c.byId[r.questionId] && g.match(c.byId[r.questionId]))) },
    { id: 'start5', icon: '⚡', name: '순발력', desc: '5초 안에 말 시작 5번 성공', check: c => ((c.state.flags || {}).start5ok || 0) >= 5 },
    { id: 'notes10', icon: '📒', name: '표현 수집가', desc: '수업 표현 노트 10개', check: c => c.notes.length >= 10 },
    { id: 'quiz', icon: '✅', name: '퀴즈 만점', desc: '표현 퀴즈를 모두 맞힘', check: c => !!(c.state.flags || {}).quizPerfect },
    { id: 'script', icon: '📜', name: '스크립트 80%', desc: '스크립트 일치율 80% 이상', check: c => !!(c.state.flags || {}).script80 },
    { id: 'lv5', icon: '⭐', name: '레벨 5', desc: '레벨 5 도달', check: c => levelInfo(c.state.total || 0).level >= 5 }
  ];
  function bestStreak(state) {
    const keys = Array.from(activeSet(state)).sort();
    let best = 0, run = 0, prev = null;
    keys.forEach(k => {
      const t = new Date(k + 'T12:00:00').getTime();
      run = prev != null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
      best = Math.max(best, run); prev = t;
    });
    return best;
  }
  function newBadges(ctx) {
    const have = ctx.state.badges || {};
    const c = Object.assign({ answers: ctx.recs.filter(r => r.mode !== 'story-step').length, bestStreak: bestStreak(ctx.state) }, ctx);
    return BADGES.filter(b => !have[b.id] && b.check(c));
  }

  /* 유형별 숙련도 0~1: 연습량(10문제까지) 50% + 자가 체크 달성률 30% + 첨삭 후 다시 답한 문제(3개까지) 20% */
  function mastery(recs, qs, groups, byId) {
    return groups.map(g => {
      const rs = recs.filter(r => r.mode !== 'story-step' && byId[r.questionId] && g.match(byId[r.questionId]));
      const qids = new Set(rs.map(r => r.questionId));
      let checks = 0, done = 0;
      rs.forEach(r => { const v = Object.values(r.selfCheck || {}); checks += v.length; done += v.filter(Boolean).length; });
      const cycles = Array.from(qids).filter(id => qs[id] && qs[id].feedback && rs.some(r => r.questionId === id && r.kind !== 'first')).length;
      const score = Math.min(1, qids.size / 10) * 0.5 + (checks ? done / checks : 0) * 0.3 + Math.min(1, cycles / 3) * 0.2;
      return { id: g.id, label: g.label, count: rs.length, questions: qids.size, cycles, score, stars: Math.round(score * 5) };
    });
  }

  /* 처음 5개 답변 vs 최근 5개 답변 */
  function growth(recs, analyze) {
    const list = recs.filter(r => !['story-step', 'script', 'keywords'].includes(r.mode) && (r.durationSec || 0) >= 5).sort((a, b) => a.createdAt - b.createdAt);
    if (list.length < 6) return { ready: false, count: list.length };
    const n = Math.min(5, Math.floor(list.length / 2));
    const first = list.slice(0, n), last = list.slice(-n);
    const avg = (arr, f) => { const v = arr.map(f).filter(x => x != null && isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const pausesPerMin = r => r.audioStats && r.durationSec ? ((r.audioStats.pauses || []).length / (r.durationSec / 60)) : null;
    const tr = (arr, f) => avg(arr.filter(r => (r.transcript || '').trim()), r => f(analyze(r.transcript, r.durationSec)));
    return {
      ready: true, n,
      items: [
        { key: 'dur', label: '평균 답변 길이', a: avg(first, r => r.durationSec), b: avg(last, r => r.durationSec), unit: 'sec', better: 'up' },
        { key: 'ratio', label: '말한 시간 비율', a: avg(first, r => r.audioStats && r.audioStats.speechRatio), b: avg(last, r => r.audioStats && r.audioStats.speechRatio), unit: 'pct', better: 'up' },
        { key: 'pause', label: '1분당 긴 무음', a: avg(first, pausesPerMin), b: avg(last, pausesPerMin), unit: 'num', better: 'down' },
        { key: 'words', label: '답변당 단어 수', a: tr(first, x => x.wordCount), b: tr(last, x => x.wordCount), unit: 'num', better: 'up' },
        { key: 'conn', label: '연결어 종류', a: tr(first, x => x.connectors.distinct.length), b: tr(last, x => x.connectors.distinct.length), unit: 'num', better: 'up' }
      ].filter(x => x.a != null && x.b != null)
    };
  }

  /* 기존 기록으로 XP를 처음 계산 (업데이트 전부터 쓰던 사용자용) */
  function backfill(recs, qs, notes) {
    const state = { v: 1, total: 0, days: {}, goalDays: [], frozen: [], freezes: 0, freezeEarned: [], badges: {}, flags: {}, log: [] };
    const add = (ts, n) => { const k = util.dayKey(ts); state.days[k] = (state.days[k] || 0) + n; state.total += n; };
    recs.forEach(r => add(r.createdAt, recordingXP(r) + (r.transcript ? 3 : 0)));
    Object.values(qs).forEach(s => { if (s.feedback && s.feedback.savedAt) add(s.feedback.savedAt, 10); });
    notes.forEach(n => add(n.createdAt, 2));
    return state;
  }

  const api = { RULES, GOALS, recordingXP, levelInfo, streakInfo, applyFreezes, maybeEarnFreeze, BADGES, newBadges, bestStreak, mastery, growth, backfill };
  root.OPIC = root.OPIC || {};
  root.OPIC.xp = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
