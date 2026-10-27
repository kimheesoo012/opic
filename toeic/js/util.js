// 공용 유틸리티 — DOM에 의존하지 않으므로 Node 테스트에서도 그대로 import 한다.

export const DAY = 24 * 60 * 60 * 1000;

// 시드 기반 난수 (mulberry32). 테스트·시뮬레이션 재현용.
export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (n) => Math.floor(rng() * n);
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.shuffle = (arr) => {
    const a2 = arr.slice();
    for (let i = a2.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a2[i], a2[j]] = [a2[j], a2[i]];
    }
    return a2;
  };
  return rng;
}

export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const sum = (arr) => arr.reduce((s, x) => s + x, 0);
export const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);
export function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export const pct = (x) => Math.round(x * 100);
export const round5 = (x) => Math.round(x / 5) * 5;

export function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtSec(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtMin(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}분`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

export const LETTERS = ['A', 'B', 'C', 'D'];

export const PART_NAMES = { 5: '단문 빈칸', 6: '장문 빈칸', 7: '독해' };

// 실제 시험 RC의 파트별 문항 수 (ETS·IIBC 공개 형식). RC 100문항, 75분.
export const REAL_COUNTS = { 5: 30, 6: 16, 7: 54 };
export const RC_PARTS = [5, 6, 7];
export const RC_LIMIT_SEC = 75 * 60;
// 총점 목표. RC 목표 = 총점 목표 − LC 기준 점수
export const TARGETS = [800, 850, 900, 950, 990];
