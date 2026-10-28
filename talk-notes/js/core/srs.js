/* 간격 반복 (SM-2를 단순화)
   상태 {r: 연속 성공 횟수, i: 간격(일), e: 쉬움 계수, d: 다음 날짜(일 번호), l: 틀린 횟수, n: 푼 횟수, c: 맞힌 횟수, t: 마지막 시각}
   평가 0 다시 · 1 어려움 · 2 알맞음 · 3 쉬움 */

export const GRADES = [
  { g: 0, label: '다시', key: 'again' },
  { g: 1, label: '어려움', key: 'hard' },
  { g: 2, label: '알맞음', key: 'good' },
  { g: 3, label: '쉬움', key: 'easy' }
];
export const MASTER_DAYS = 21;

/* 기기 시간대 기준 날짜 번호 (자정이 아니라 새벽 4시에 하루가 바뀐다: 밤늦게 공부해도 같은 날) */
export function dayNum(ts = Date.now()) {
  const d = new Date(ts - 4 * 3600 * 1000);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}
export function dayKey(n) {
  const d = new Date(n * 86400000);
  return d.toISOString().slice(0, 10);
}

export function fresh() { return { r: 0, i: 0, e: 2.5, d: 0, l: 0, n: 0, c: 0, t: 0 }; }

/* 다음 간격(일) 미리 계산 — 버튼에 표시 */
export function nextInterval(st, g) {
  st = st || fresh();
  if (g === 0) return 0;
  const r = st.r + 1;
  if (r === 1) return [0, 1, 1, 3][g];
  if (r === 2) return [0, 2, 3, 6][g];
  const mult = g === 1 ? 1.2 : g === 2 ? st.e : st.e * 1.3;
  return Math.max(st.i + 1, Math.round(st.i * mult));
}

export function grade(st, g, now = Date.now()) {
  const s = Object.assign(fresh(), st || {});
  const i = nextInterval(s, g);
  s.n++; s.t = now;
  if (g === 0) { s.l++; s.r = 0; s.i = 0; s.e = Math.max(1.3, s.e - 0.2); }
  else {
    s.c++; s.r++; s.i = i;
    if (g === 1) s.e = Math.max(1.3, s.e - 0.15);
    if (g === 3) s.e = Math.min(3.2, s.e + 0.15);
  }
  s.d = dayNum(now) + s.i;
  return s;
}

export function isDue(st, today = dayNum()) { return !!st && st.n > 0 && st.d <= today; }
export function isMastered(st) { return !!st && st.i >= MASTER_DAYS; }
export function level(st) {
  if (!st || !st.n) return 'new';
  if (st.i >= MASTER_DAYS) return 'mastered';
  if (st.i >= 3) return 'review';
  return 'learning';
}
export const LEVEL_LABEL = { new: '처음', learning: '익히는 중', review: '복습 중', mastered: '익힘' };

export function intervalLabel(days) {
  if (days <= 0) return '오늘 다시';
  if (days === 1) return '내일';
  if (days < 30) return days + '일 뒤';
  if (days < 365) return Math.round(days / 30) + '달 뒤';
  return Math.round(days / 365 * 10) / 10 + '년 뒤';
}

/* 자동 채점 점수(0~1)를 추천 평가로 */
export function suggestGrade(score) {
  if (score >= 0.95) return 3;
  if (score >= 0.8) return 2;
  if (score >= 0.6) return 1;
  return 0;
}
