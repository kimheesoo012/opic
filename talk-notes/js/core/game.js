/* 동기부여: XP·레벨, 연속 학습(휴식권), 배지, 실수 유형별 숙련도, 성장 그래프용 집계
   계산만 한다. 저장은 store.js */
import { CARDS, PRON_ROWS, itemKey, resolve } from './deck.js';
import { TAGS, LESSONS } from '../data/notes.js';
import { dayNum, dayKey, level } from './srs.js';

/* ── XP ─────────────────── */
export const XP = { again: 2, hard: 5, good: 10, easy: 12, newBonus: 4, comboBonus: 3, goalBonus: 30, firstOfDay: 10 };
export function xpFor(g, { wasNew = false, combo = 0 } = {}) {
  let x = [XP.again, XP.hard, XP.good, XP.easy][g] || 0;
  if (wasNew && g >= 1) x += XP.newBonus;
  if (g >= 2 && combo >= 3) x += XP.comboBonus;          // 3연속부터 보너스
  return x;
}

/* 레벨: L에서 L+1로 가는 데 필요한 누적 XP = 50·L·(L+1). 하루 20문제(약 200XP)면 첫날 2레벨, 5일째 5레벨, 한 달쯤 10레벨 */
export function levelOf(xp) {
  let L = 1;
  while (xp >= 50 * L * (L + 1)) L++;
  return L;
}
export function levelInfo(xp) {
  const L = levelOf(xp);
  const from = L === 1 ? 0 : 50 * (L - 1) * L, to = 50 * L * (L + 1);
  return { level: L, title: titleFor(L), from, to, cur: xp - from, need: to - from, pct: Math.min(100, Math.round((xp - from) / (to - from) * 100)) };
}
const TITLES = [[1, '새싹'], [3, '수강생'], [5, '말문 트임'], [8, '스몰토커'], [12, '수다쟁이'], [16, '대화 선수'], [20, '네이티브 느낌'], [30, '회화 마스터']];
export function titleFor(L) { let t = TITLES[0][1]; for (const [l, n] of TITLES) if (L >= l) t = n; return t; }
export function nextTitle(L) { for (const [l, n] of TITLES) if (l > L) return { level: l, title: n }; return null; }

/* ── 연속 학습 ─────────────────── */
/* 그날 공부했거나(n>0) 휴식권으로 지켜진 날(frz)이면 이어진 날 */
export function activeDay(S, d) { const L = S.log[dayKey(d)]; return !!L && (L.n > 0 || L.frz); }
export function streakOn(S, today = dayNum()) {
  let n = 0;
  for (let d = today; d > today - 3650; d--) {
    if (activeDay(S, d)) n++;
    else if (d === today) continue;   // 오늘 아직 안 했어도 어제까지 이어졌으면 유지
    else break;
  }
  return n;
}
/* 어제를 빼먹었는데 휴식권이 있으면 자동으로 써서 연속을 지킨다. 오늘 첫 문제를 풀 때 부른다.
   빼먹은 날 수가 휴식권 수 이하이고, 그 전에 이어 오던 연속이 있을 때만 */
export function applyFreeze(S, today = dayNum()) {
  if (activeDay(S, today - 1)) return [];
  let gap = 0;
  while (gap < FREEZE_MAX && !activeDay(S, today - 1 - gap)) gap++;
  if (gap >= FREEZE_MAX && !activeDay(S, today - 1 - gap)) return [];   // 너무 오래 쉬었다
  if (!activeDay(S, today - 1 - gap)) return [];                        // 지킬 연속이 없다
  if ((S.freezes || 0) < gap) return [];
  const used = [];
  for (let d = today - 1; d > today - 1 - gap; d--) {
    S.log[dayKey(d)] = Object.assign(S.log[dayKey(d)] || { n: 0, ok: 0, nw: 0, ms: 0, modes: {} }, { frz: true });
    used.push(dayKey(d));
  }
  S.freezes -= gap;
  return used;
}
export const FREEZE_MAX = 2;
export const FREEZE_EVERY = 7;   // 7일 연속마다 휴식권 1장

export const STREAK_STEPS = [3, 7, 14, 30, 60, 100, 200, 365];

/* ── 숙련도 (실수 유형별 0~100) ───────────────────
   그 유형 실수가 있던 문장들의 말하기 카드 상태를 가중 평균: 처음 0 · 익히는 중 0.35 · 복습 중 0.7 · 익힘 1 */
const LV_W = { new: 0, learning: 0.35, review: 0.7, mastered: 1 };
export function skillOf(S, tag) {
  const cs = CARDS.filter(c => c.g.includes(tag));
  if (!cs.length) return { pct: 0, n: 0, mastered: 0, seen: 0 };
  let sum = 0, mastered = 0, seen = 0;
  for (const c of cs) { const lv = level(S.srs[itemKey('speak', c.id)]); sum += LV_W[lv]; if (lv === 'mastered') mastered++; if (lv !== 'new') seen++; }
  return { pct: Math.round(sum / cs.length * 100), n: cs.length, mastered, seen };
}
export function skills(S) {
  return Object.keys(TAGS).filter(t => t !== 'ok' && t !== 'asr').map(t => Object.assign({ tag: t, name: TAGS[t] }, skillOf(S, t)));
}
/* 전체 실력 점수 0~100: 모든 말하기 카드 숙련도 평균 */
export function overall(S) {
  let sum = 0;
  for (const c of CARDS) sum += LV_W[level(S.srs[itemKey('speak', c.id)])];
  return Math.round(sum / CARDS.length * 100);
}
export function masteredCount(S) { let n = 0; for (const c of CARDS) if (level(S.srs[itemKey('speak', c.id)]) === 'mastered') n++; return n; }
export function seenCount(S) { let n = 0; for (const c of CARDS) if (S.srs[itemKey('speak', c.id)]) n++; return n; }

/* ── 배지 ─────────────────── */
const lessonSeen = (S, li) => CARDS.filter(c => c.li === li).every(c => S.srs[itemKey('speak', c.id)]);
const lessonMastered = (S, li) => CARDS.filter(c => c.li === li).every(c => level(S.srs[itemKey('speak', c.id)]) === 'mastered');
const daysWithGoal = S => Object.values(S.log).filter(l => l.n >= (S.settings.goal || 30)).length;
const totalN = S => Object.values(S.log).reduce((a, l) => a + l.n, 0);
export const BADGES = [
  { id: 'first', icon: '🌱', name: '첫걸음', desc: '첫 문제를 풀었어요', check: S => totalN(S) >= 1 },
  { id: 'goal1', icon: '🎯', name: '오늘 목표 달성', desc: '하루 목표를 처음 채웠어요', check: S => daysWithGoal(S) >= 1 },
  { id: 'goal7', icon: '🎯', name: '목표 7번', desc: '하루 목표를 7일 채웠어요', check: S => daysWithGoal(S) >= 7 },
  { id: 'goal30', icon: '🏹', name: '목표 30번', desc: '하루 목표를 30일 채웠어요', check: S => daysWithGoal(S) >= 30 },
  ...[3, 7, 14, 30, 60, 100].map(n => ({ id: 'streak' + n, icon: n >= 30 ? '🔥' : '🕯', name: `${n}일 연속`, desc: `${n}일 연속으로 공부했어요`, check: S => streakOn(S) >= n })),
  { id: 'seen50', icon: '🗣', name: '문장 50', desc: '수업 문장 50개를 말해 봤어요', check: S => seenCount(S) >= 50 },
  { id: 'seen200', icon: '🗣', name: '문장 200', desc: '수업 문장 200개를 말해 봤어요', check: S => seenCount(S) >= 200 },
  { id: 'seenAll', icon: '📚', name: '노트 한 바퀴', desc: '633문장을 모두 말해 봤어요', check: S => seenCount(S) >= CARDS.length },
  { id: 'master10', icon: '⭐', name: '익힘 10', desc: '21일 넘게 기억한 문장 10개', check: S => masteredCount(S) >= 10 },
  { id: 'master50', icon: '🌟', name: '익힘 50', desc: '21일 넘게 기억한 문장 50개', check: S => masteredCount(S) >= 50 },
  { id: 'master200', icon: '💫', name: '익힘 200', desc: '21일 넘게 기억한 문장 200개', check: S => masteredCount(S) >= 200 },
  { id: 'lesson1', icon: '📖', name: '수업 하나 완주', desc: '한 수업의 문장을 전부 말해 봤어요', check: S => LESSONS.some((l, i) => lessonSeen(S, i)) },
  { id: 'lessonM', icon: '🏅', name: '수업 하나 정복', desc: '한 수업의 문장을 전부 익혔어요', check: S => LESSONS.some((l, i) => lessonMastered(S, i)) },
  { id: 'pron10', icon: '👄', name: '또박또박', desc: '발음 단어 10개를 제대로 인식시켰어요', check: S => Object.values(S.pron).filter(p => p.ok > 0).length >= 10 },
  { id: 'pronAll', icon: '🎤', name: '발음 전부 도전', desc: '발음 단어 36개를 모두 말해 봤어요', check: S => Object.keys(S.pron).length >= PRON_ROWS.length },
  { id: 'acc85', icon: '🎓', name: '약점 극복', desc: '한 실수 유형에서 20문제 이상 풀고 정답률 85%', check: S => Object.values(S.tagStats).some(t => t.n >= 20 && t.ok / t.n >= 0.85) },
  { id: 'skill50', icon: '📈', name: '숙련도 50', desc: '한 실수 유형 숙련도 50% 달성', check: S => skills(S).some(s => s.pct >= 50) },
  { id: 'day100', icon: '⚡', name: '하루 100문제', desc: '하루에 100문제를 풀었어요', check: S => Object.values(S.log).some(l => l.n >= 100) },
  { id: 'combo10', icon: '🔗', name: '10연속 정답', desc: '한 세션에서 10문제 연속으로 맞혔어요', check: S => (S.bestCombo || 0) >= 10 },
  { id: 'lv5', icon: '🥉', name: '레벨 5', desc: '레벨 5에 올랐어요', check: S => levelOf(S.xp || 0) >= 5 },
  { id: 'lv10', icon: '🥈', name: '레벨 10', desc: '레벨 10에 올랐어요', check: S => levelOf(S.xp || 0) >= 10 },
  { id: 'lv20', icon: '🥇', name: '레벨 20', desc: '레벨 20에 올랐어요', check: S => levelOf(S.xp || 0) >= 20 },
  { id: 'backup', icon: '💾', name: '안전하게', desc: '기록을 백업했어요', check: S => !!S.lastBackup },
  { id: 'star10', icon: '⭐', name: '별표 10', desc: '문장 10개에 별표를 했어요', check: S => Object.keys(S.stars).length >= 10 }
];
/* 새로 얻은 배지 목록을 돌려주고 S.badges에 기록 */
export function checkBadges(S, now = Date.now()) {
  S.badges = S.badges || {};
  const got = [];
  for (const b of BADGES) {
    if (S.badges[b.id]) continue;
    let ok = false;
    try { ok = b.check(S); } catch (e) {}
    if (ok) { S.badges[b.id] = now; got.push(b); }
  }
  return got;
}

/* ── 그래프용 ─────────────────── */
/* 최근 n일: [{d, key, n, ok, xp, m(그날 끝 익힘 수), frz}] */
export function lastDays(S, n = 7, today = dayNum()) {
  const out = [];
  for (let d = today - n + 1; d <= today; d++) {
    const L = S.log[dayKey(d)] || {};
    out.push({ d, key: dayKey(d), n: L.n || 0, ok: L.ok || 0, xp: L.xp || 0, m: L.m, frz: !!L.frz, ms: L.ms || 0 });
  }
  return out;
}
/* 익힘 수 추이: 기록 없는 날은 그 전 값을 잇는다 */
export function masteredSeries(S, n = 30, today = dayNum()) {
  const days = lastDays(S, n, today);
  let last = 0;
  const keys = Object.keys(S.log).sort();
  for (const k of keys) { if (k < days[0].key && S.log[k].m != null) last = S.log[k].m; }
  return days.map(x => { if (x.m != null) last = x.m; return { key: x.key, m: last }; });
}
export const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
export function weekdayOf(dayN) { return WEEKDAY[new Date(dayN * 86400000 + 4 * 3600 * 1000 + 12 * 3600 * 1000).getDay()]; }

/* 홈 화면 격려 문구 */
export function encouragement(S, today = dayNum()) {
  const st = streakOn(S, today);
  const didToday = activeDay(S, today) && (S.log[dayKey(today)] || {}).n > 0;
  const yesterday = activeDay(S, today - 1);
  const goal = S.settings.goal || 30;
  const n = (S.log[dayKey(today)] || {}).n || 0;
  if (!Object.keys(S.srs).length) return { icon: '🌱', text: '첫 문제를 풀면 연속 학습이 시작돼요. 하루 몇 문제라도 괜찮아요.' };
  if (didToday && n >= goal) return { icon: '🎉', text: `오늘 목표를 채웠어요. 연속 ${st}일째!` };
  if (didToday) return { icon: '🔥', text: `연속 ${st}일째 · 오늘 ${goal - n}문제 더 풀면 목표 달성이에요.` };
  if (yesterday && st > 0) return { icon: '⏳', text: `연속 ${st}일 · 오늘 안 풀면 끊겨요. 5문제만이라도 해 볼까요?`, urgent: true };
  if (!yesterday && st === 0) {
    const freezes = S.freezes || 0;
    return { icon: '🌤', text: freezes ? '하루 쉬었지만 휴식권이 지켜 줬어요. 오늘 이어 가요.' : '연속이 끊겼어요. 괜찮아요, 오늘 다시 1일부터 시작해요.' };
  }
  return { icon: '👋', text: '오늘도 조금만 해 볼까요?' };
}
