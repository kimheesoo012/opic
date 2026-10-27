// 기록 집계 (순수 함수)
import { mean, median, groupBy, dayKey, startOfDay, DAY } from './util.js';

export const CAUSES = [
  { id: 'vocab', label: '모르는 어휘' },
  { id: 'grammar', label: '문법' },
  { id: 'evidence', label: '근거 못 찾음' },
  { id: 'time', label: '시간 부족' },
  { id: 'slip', label: '실수' },
  { id: 'trap', label: '함정' },
];

function summarize(list) {
  const n = list.length;
  const correct = list.filter((a) => a.correct).length;
  const timed = list.filter((a) => a.sec > 0 && a.target > 0);
  const causes = {};
  for (const a of list) if (a.cause) causes[a.cause] = (causes[a.cause] || 0) + 1;
  const sorted = list.slice().sort((a, b) => a.t - b.t);
  const recentN = Math.min(6, Math.floor(n / 2));
  const recent = recentN ? sorted.slice(-recentN) : [];
  const prev = recentN ? sorted.slice(0, n - recentN) : [];
  return {
    n,
    correct,
    acc: n ? correct / n : null,
    avgSec: timed.length ? mean(timed.map((a) => a.sec)) : null,
    medRatio: timed.length ? median(timed.map((a) => a.sec / a.target)) : null,
    target: timed.length ? timed[0].target : null,
    overTime: timed.filter((a) => a.sec > a.target).length,
    recentAcc: recent.length ? recent.filter((a) => a.correct).length / recent.length : null,
    prevAcc: prev.length ? prev.filter((a) => a.correct).length / prev.length : null,
    causes,
    lastT: sorted.length ? sorted[sorted.length - 1].t : 0,
  };
}

export function partStats(attempts) {
  const out = {};
  for (let p = 1; p <= 7; p++) out[p] = summarize(attempts.filter((a) => a.part === p));
  return out;
}

export function conceptStats(attempts) {
  const m = new Map();
  for (const [k, list] of groupBy(attempts, (a) => a.concept)) m.set(k, summarize(list));
  return m;
}

export function causeDist(attempts) {
  const c = {};
  for (const a of attempts) if (!a.correct && a.cause) c[a.cause] = (c[a.cause] || 0) + 1;
  return c;
}

export function seenMap(attempts) {
  const m = new Map();
  for (const a of attempts) {
    const s = m.get(a.qid) || { count: 0, lastT: 0, lastCorrect: false, everWrong: false };
    s.count++;
    if (a.t >= s.lastT) { s.lastT = a.t; s.lastCorrect = a.correct; }
    if (!a.correct) s.everWrong = true;
    m.set(a.qid, s);
  }
  return m;
}

// 자주 틀리는 유형 상위 k개. 기록이 적은 유형은 제외(단정하지 않음).
export function weakConcepts(attempts, k = 3, minN = 4) {
  const cs = conceptStats(attempts);
  const list = [];
  for (const [concept, s] of cs) {
    if (s.n < minN) continue;
    // 베이지안 수축: 표본이 적으면 전체 평균 쪽으로 당긴다
    const shrunk = (s.correct + 0.7 * 3) / (s.n + 3);
    list.push({ concept, ...s, shrunk });
  }
  return list.sort((a, b) => a.shrunk - b.shrunk).slice(0, k);
}

// 같은 문제를 다시 맞힘 vs 같은 개념의 새 문제를 맞힘
export function retentionStats(attempts) {
  const r = { repeatRight: 0, repeatTotal: 0, newRight: 0, newTotal: 0 };
  for (const a of attempts) {
    if (a.mode !== 'review' && a.mode !== 'wrongnote') continue;
    if (a.repeat) { r.repeatTotal++; if (a.correct) r.repeatRight++; } else { r.newTotal++; if (a.correct) r.newRight++; }
  }
  return r;
}

export function todayStudySec(studyLog, now = Date.now()) {
  return studyLog[dayKey(now)] || 0;
}

export function todayAttempts(attempts, now = Date.now()) {
  const s = startOfDay(now);
  return attempts.filter((a) => a.t >= s && a.t < s + DAY);
}

// 시간 초과 문제 모음: 마지막 풀이가 목표 시간을 넘긴 문항(최근 것부터)
export function overtimeQids(attempts, now = Date.now()) {
  const last = new Map();
  for (const a of attempts) {
    if (a.mode === 'review' || !a.target) continue;
    const prev = last.get(a.qid);
    if (!prev || a.t >= prev.t) last.set(a.qid, a);
  }
  return [...last.values()].filter((a) => a.sec > a.target && now - a.t < 60 * 86400000).sort((a, b) => b.t - a.t).map((a) => a.qid);
}
