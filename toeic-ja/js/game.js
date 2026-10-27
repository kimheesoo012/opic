// 학습 동기: 경험치(XP), 하루 목표, 연속 학습일, 휴식권, 레벨, 유형별 숙련도, 배지 (DOM 없음)
import { dayKey, median } from './util.js';

// 문항당 XP. 같은 문제를 다시 푼 것은 절반.
export const XP = { right: 10, wrong: 2, repeatRight: 5, repeatWrong: 1, reviewPass: 5, concept: 2, session: 5, perfect: 10, drill: 2 };
export const DAILY_GOALS = [20, 50, 100, 150];
export const FREEZE_MAX = 2;

export function newGame() {
  return { v: 1, daily: 50, xp: {}, done: {}, frozen: {}, freezes: 0, total: 0, best: 0, milestone: 0, badges: {}, reviewPasses: 0, settled: null };
}

export function shiftDay(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n, 12).getTime());
}
const kept = (g, day) => !!(g.done[day] || g.frozen[day]);

// 오늘 목표를 아직 못 채웠어도 어제까지 이어졌으면 연속 기록은 유지된다
export function streakInfo(g, now = Date.now()) {
  const today = dayKey(now);
  let d = kept(g, today) ? today : shiftDay(today, -1);
  let days = 0;
  while (kept(g, d) && days < 5000) { days++; d = shiftDay(d, -1); }
  return { days, doneToday: !!g.done[today], todayXp: g.xp[today] || 0, daily: g.daily, freezes: g.freezes };
}

// 지난 날 중 목표를 못 채운 날: 연속 기록을 지킬 수 있을 때만 휴식권을 쓴다
export function settle(g, now = Date.now()) {
  const yest = shiftDay(dayKey(now), -1);
  let d = g.settled ? shiftDay(g.settled, 1) : yest;
  const used = [];
  let guard = 0;
  while (d <= yest && guard++ < 1000) {
    if (kept(g, d)) { d = shiftDay(d, 1); continue; }
    let end = d;
    while (shiftDay(end, 1) <= yest && !kept(g, shiftDay(end, 1))) end = shiftDay(end, 1);
    const run = [];
    for (let x = d; x <= end; x = shiftDay(x, 1)) run.push(x);
    if (kept(g, shiftDay(d, -1)) && run.length <= g.freezes) {
      for (const x of run) { g.frozen[x] = 1; used.push(x); }
      g.freezes -= run.length;
    }
    d = shiftDay(end, 1);
  }
  if (!g.settled || yest > g.settled) g.settled = yest;
  return used;
}

// 레벨 L에서 L+1까지 100 + 50(L−1) XP
export function levelOf(total) {
  let level = 1;
  let base = 0;
  let need = 100;
  while (total >= base + need) { base += need; level++; need = 100 + 50 * (level - 1); }
  return { level, into: total - base, need };
}

function markDone(g, day, now, ev) {
  if (g.done[day] || (g.xp[day] || 0) < g.daily) return;
  g.done[day] = 1;
  ev.goalReached = true;
  const s = streakInfo(g, now).days;
  ev.streak = s;
  if (s > g.best) g.best = s;
  if (s >= 7 && s % 7 === 0 && s > g.milestone) {
    g.milestone = s;
    if (g.freezes < FREEZE_MAX) { g.freezes++; ev.freezeEarned = true; }
  }
}

export function addXp(g, amount, now = Date.now()) {
  settle(g, now);
  const day = dayKey(now);
  const lv0 = levelOf(g.total).level;
  g.xp[day] = (g.xp[day] || 0) + amount;
  g.total += amount;
  const ev = { amount, goalReached: false, streak: null, freezeEarned: false, levelUp: null };
  markDone(g, day, now, ev);
  const lv1 = levelOf(g.total).level;
  if (lv1 > lv0) ev.levelUp = lv1;
  return ev;
}

export function setDaily(g, n, now = Date.now()) {
  g.daily = n;
  const ev = { goalReached: false };
  markDone(g, dayKey(now), now, ev);
  return ev;
}

export function attemptXp(a) {
  if (a.choice === -1) return 0;
  if (a.repeat) return a.correct ? XP.repeatRight : XP.repeatWrong;
  return a.correct ? XP.right : XP.wrong;
}

// 이전 버전 기록에서 XP·목표 달성일을 다시 계산 (휴식권은 소급하지 않음)
export function backfill(g, attempts, sessions, now = Date.now()) {
  for (const a of attempts) {
    const day = dayKey(a.t);
    const x = attemptXp(a);
    g.xp[day] = (g.xp[day] || 0) + x;
    g.total += x;
  }
  for (const s of sessions || []) {
    if (!s.n) continue;
    const day = dayKey(s.end || s.start);
    g.xp[day] = (g.xp[day] || 0) + XP.session;
    g.total += XP.session;
  }
  const days = Object.keys(g.xp).sort();
  let run = 0;
  let prev = null;
  for (const d of days) {
    if (g.xp[d] < g.daily) { run = 0; prev = d; continue; }
    g.done[d] = 1;
    run = prev && shiftDay(prev, 1) === d && g.done[prev] ? run + 1 : 1;
    if (run > g.best) g.best = run;
    prev = d;
  }
  g.settled = shiftDay(dayKey(now), -1);
  return g;
}

// ---- 유형별 숙련도 0~5 ----
export const MASTERY_LABELS = ['未学習', '入門', '基礎', '習得中', '得意', 'マスター'];

// maxDiff: 유형별 가장 어려운 문항 난이도(은행 기준). 없으면 3.
export function masteryMap(attempts, maxDiff = {}) {
  const by = {};
  for (const a of attempts) {
    if (a.choice === undefined || !a.concept) continue;
    (by[a.concept] ||= []).push(a);
  }
  const out = {};
  for (const [c, list] of Object.entries(by)) out[c] = masteryOf(list, maxDiff[c] || 3);
  return out;
}

function masteryOf(list, maxD) {
  list.sort((x, y) => x.t - y.t);
  const distinct = new Set(list.map((a) => a.qid)).size;
  const recent = list.slice(-10);
  const acc = recent.filter((a) => a.correct).length / recent.length;
  const hard2 = list.some((a) => a.correct && a.difficulty >= Math.min(2, maxD));
  const hard3 = list.some((a) => a.correct && a.difficulty >= Math.min(3, maxD));
  const timed = recent.filter((a) => a.correct && a.target > 0 && a.sec > 0);
  const fast = timed.length >= 3 && median(timed.map((a) => a.sec / a.target)) <= 1.1;
  let lv = 1;
  if (distinct >= 2 && acc >= 0.5) lv = 2;
  if (lv === 2 && distinct >= 4 && acc >= 0.7) lv = 3;
  if (lv === 3 && distinct >= 6 && acc >= 0.8 && hard2) lv = 4;
  if (lv === 4 && distinct >= 8 && acc >= 0.85 && hard3 && fast) lv = 5;
  return { lv, n: list.length, distinct, acc };
}

export function masteryLevels(map) {
  const out = {};
  for (const [c, m] of Object.entries(map)) out[c] = m.lv;
  return out;
}

// ---- 배지 ----
export const BADGES = [
  { id: 'first', icon: 'star', label: 'はじめの一歩', desc: '最初のセッション完了' },
  { id: 'goal1', icon: 'target', label: '初目標', desc: '1日の目標を初めて達成' },
  { id: 'streak3', icon: 'flame', label: '3日連続', desc: '3日連続で目標達成' },
  { id: 'streak7', icon: 'flame', label: '7日連続', desc: '7日連続で目標達成' },
  { id: 'streak30', icon: 'flame', label: '30日連続', desc: '30日連続で目標達成' },
  { id: 'q100', icon: 'book', label: '100問', desc: '累計100問解答' },
  { id: 'q500', icon: 'book', label: '500問', desc: '累計500問解答' },
  { id: 'perfect', icon: 'crown', label: '満点', desc: '10問以上のセッションで満点' },
  { id: 'master1', icon: 'medal', label: '初マスター', desc: 'タイプを1つマスター' },
  { id: 'master10', icon: 'medal', label: 'マスター10', desc: '10タイプをマスター' },
  { id: 'review10', icon: 'review', label: '復習10ステップ', desc: 'ステップ復習を10回クリア' },
  { id: 'full', icon: 'trophy', label: '本番模試完走', desc: 'RC本番模試を完走' },
];

// ctx: { attempts, sessions, mastery, last } — 새로 얻은 배지 id 목록을 돌려준다
export function checkBadges(g, ctx, now = Date.now()) {
  const s = streakInfo(g, now).days;
  const best = Math.max(g.best, s);
  const masters = Object.values(ctx.mastery || {}).filter((m) => m.lv >= 5).length;
  const last = ctx.last;
  const cond = {
    first: (ctx.sessions || []).length > 0,
    goal1: Object.keys(g.done).length > 0,
    streak3: best >= 3,
    streak7: best >= 7,
    streak30: best >= 30,
    q100: ctx.attempts.length >= 100,
    q500: ctx.attempts.length >= 500,
    perfect: !!(last && last.n >= 10 && last.correct === last.n),
    master1: masters >= 1,
    master10: masters >= 10,
    review10: g.reviewPasses >= 10,
    full: !!(last && last.kind === 'full' && last.n >= 90) || !!(ctx.sessions || []).some((x) => x.kind === 'full' && x.n >= 90),
  };
  const got = [];
  for (const b of BADGES) if (cond[b.id] && !g.badges[b.id]) { g.badges[b.id] = now; got.push(b.id); }
  return got;
}
