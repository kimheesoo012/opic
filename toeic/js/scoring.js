// RC 추정 점수.
// 검증된 환산 모델이 아니다. 문항 난이도(1~3), 정답 여부, 풀이 시간, 파트별 성취도를 반영한
// 단순 문항반응 모델과 경험적 환산표로 "범위"를 계산한다.
import { clamp, median, round5, REAL_COUNTS, RC_PARTS, RC_LIMIT_SEC } from './util.js';

const GRID = [];
for (let t = -4; t <= 4.0001; t += 0.05) GRID.push(+t.toFixed(2));

export const diffToB = (d) => (d - 2) * 1.1;
const GUESS = 0.25;

export function pCorrect(theta, b) {
  return GUESS + (1 - GUESS) / (1 + Math.exp(-1.3 * (theta - b)));
}

// 실제 시험의 난이도 분포 가정(이 앱의 3단계 기준). 보정 데이터가 없는 가정값.
const REAL_DIFF_DIST = [[1, 0.3], [2, 0.42], [3, 0.28]];

export function expectedAcc(theta) {
  let s = 0;
  for (const [d, w] of REAL_DIFF_DIST) s += w * pCorrect(theta, diffToB(d));
  return s;
}

// RC 원점수 비율 → 환산 점수 (경험적 근사표, 공식 환산표 아님)
const MAP = [[0, 5], [0.2, 25], [0.3, 75], [0.4, 130], [0.5, 190], [0.6, 250], [0.7, 310], [0.8, 375], [0.88, 430], [0.94, 470], [0.98, 495], [1, 495]];

export function rawToScaled(p) {
  p = clamp(p, 0, 1);
  for (let i = 1; i < MAP.length; i++) {
    if (p <= MAP[i][0]) {
      const [x0, y0] = MAP[i - 1];
      const [x1, y1] = MAP[i];
      return y0 + ((p - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 495;
}

export function scaledToRaw(score) {
  score = clamp(score, 5, 495);
  for (let i = 1; i < MAP.length; i++) {
    if (score <= MAP[i][1]) {
      const [x0, y0] = MAP[i - 1];
      const [x1, y1] = MAP[i];
      return y1 === y0 ? x0 : x0 + ((score - y0) / (y1 - y0)) * (x1 - x0);
    }
  }
  return 1;
}

const TOTAL_Q = RC_PARTS.reduce((s, p) => s + REAL_COUNTS[p], 0);
const DEFAULT_TARGET = { 5: 20, 6: 30, 7: 61 };

// 파트별 능력값으로 실제 RC 원점수 비율을 예상. 75분 안에 못 푸는 문항은 찍는다고 가정.
function projectRaw(thetaByPart, ratioByPart) {
  let correct = 0;
  for (const p of RC_PARTS) correct += REAL_COUNTS[p] * expectedAcc(thetaByPart[p]);
  let need = 0;
  for (const p of RC_PARTS) need += REAL_COUNTS[p] * DEFAULT_TARGET[p] * ratioByPart[p];
  const over = need - RC_LIMIT_SEC;
  let unanswered = 0;
  if (over > 0) {
    unanswered = Math.min(REAL_COUNTS[7], over / (DEFAULT_TARGET[7] * ratioByPart[7]));
    correct -= unanswered * (expectedAcc(thetaByPart[7]) - GUESS);
  }
  return { raw: correct / TOTAL_Q, unanswered };
}

function gridPosterior(items, priorMean, priorSd) {
  const logs = GRID.map((t) => -0.5 * ((t - priorMean) / priorSd) ** 2);
  for (const it of items) {
    const b = diffToB(it.difficulty);
    for (let i = 0; i < GRID.length; i++) {
      const p = pCorrect(GRID[i], b);
      logs[i] += it.w * (it.correct ? Math.log(p) : Math.log(1 - p));
    }
  }
  const mx = Math.max(...logs);
  const ps = logs.map((l) => Math.exp(l - mx));
  const z = ps.reduce((s, x) => s + x, 0);
  const post = ps.map((x) => x / z);
  let m = 0;
  for (let i = 0; i < GRID.length; i++) m += post[i] * GRID[i];
  let v = 0;
  for (let i = 0; i < GRID.length; i++) v += post[i] * (GRID[i] - m) ** 2;
  const q = (p) => {
    let c = 0;
    for (let i = 0; i < GRID.length; i++) {
      c += post[i];
      if (c >= p) return GRID[i];
    }
    return GRID[GRID.length - 1];
  };
  return { mean: m, sd: Math.sqrt(v), q10: q(0.1), q90: q(0.9) };
}

export function thetaForScaled(score) {
  const target = scaledToRaw(score);
  let lo = -4;
  let hi = 4;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (expectedAcc(mid) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const MODE_W = { diag: 1, deep: 1, mock: 1, full: 1, timed: 1, practice: 0.6, speed: 0.6, overtime: 0.6 };

// attempts: [{part, difficulty, correct, sec, target, mode, repeat}]
// opts.baseline: 최근 실제 RC 점수(있으면 약한 사전 정보)
export function estimate(attempts, opts = {}) {
  const items = attempts.filter((a) => !a.repeat && MODE_W[a.mode] !== undefined && RC_PARTS.includes(a.part));
  const priorMean = opts.baseline ? thetaForScaled(opts.baseline) : 0;
  const priorSd = opts.baseline ? 1.0 : 1.2;
  // 많이 푼 파트가 결과를 독점하지 않도록 실제 시험 파트 비중으로 가중
  const byPart = {};
  for (const p of RC_PARTS) byPart[p] = items.filter((a) => a.part === p);
  const present = RC_PARTS.filter((p) => byPart[p].length);
  const shareTotal = present.reduce((s, p) => s + REAL_COUNTS[p], 0) || 1;
  const weighted = [];
  for (const p of present) {
    const k = ((REAL_COUNTS[p] / shareTotal) * items.length) / byPart[p].length;
    for (const a of byPart[p]) weighted.push({ ...a, w: k * (MODE_W[a.mode] ?? 0.6) });
  }
  const post = gridPosterior(weighted, priorMean, priorSd);
  const parts = {};
  const tPoint = {};
  const tLo = {};
  const tHi = {};
  const ratio = {};
  for (const p of RC_PARTS) {
    const its = byPart[p];
    // 파트별 성취도: 섹션 능력값 쪽으로 수축한 파트 능력값
    const pp = gridPosterior(its.map((a) => ({ ...a, w: MODE_W[a.mode] ?? 0.6 })), post.mean, 0.6);
    const shift = pp.mean - post.mean;
    tPoint[p] = pp.mean;
    tLo[p] = post.q10 + shift;
    tHi[p] = post.q90 + shift;
    const timed = its.filter((a) => a.sec > 0 && a.target > 0);
    ratio[p] = timed.length >= 3 ? clamp(median(timed.map((a) => a.sec / a.target)), 0.4, 3) : 1;
    parts[p] = {
      n: its.length,
      acc: its.length ? its.filter((a) => a.correct).length / its.length : null,
      timeRatio: timed.length >= 3 ? ratio[p] : null,
      theta: pp.mean,
      expAcc: expectedAcc(pp.mean),
    };
  }
  const mid = projectRaw(tPoint, ratio);
  const lo = projectRaw(tLo, ratio);
  const hi = projectRaw(tHi, ratio);
  // 풀어 본 파트 비중이 낮을수록, 문항 수가 적을수록 범위를 넓힌다. 환산표 오차 ±20점.
  const coverage = RC_PARTS.reduce((s, p) => s + (byPart[p].length >= 2 ? REAL_COUNTS[p] : 0), 0) / TOTAL_Q;
  const extra = 20 + (1 - coverage) * 60 + Math.max(0, 20 - items.length) * 3;
  const point = clamp(round5(rawToScaled(mid.raw)), 5, 495);
  const rc = {
    n: items.length,
    theta: post.mean,
    sd: post.sd,
    coverage,
    point,
    lo: clamp(round5(rawToScaled(lo.raw) - extra), 5, 495),
    hi: clamp(round5(rawToScaled(hi.raw) + extra), 5, 495),
    unanswered: Math.round(mid.unanswered),
    parts,
  };
  rc.lo = Math.min(rc.lo, point);
  rc.hi = Math.max(rc.hi, point);
  return { n: items.length, rc, enough: rc.n >= 15 && coverage >= 0.5, level: levelLabel(point) };
}

export function levelLabel(rc) {
  if (rc < 300) return 'RC 300 도전 단계';
  if (rc < 350) return 'RC 350 도전 단계';
  if (rc < 400) return 'RC 400 도전 단계';
  if (rc < 450) return 'RC 450 도전 단계';
  return 'RC 만점 도전 단계';
}

// 총점 목표 → RC 목표(= 목표 − LC 기준 점수, 최대 495)와 파트별 필요 정답률
export function rcGoal(goal, lcBase) {
  const want = goal - (lcBase || 0);
  return { want: clamp(round5(want), 5, 495), overflow: Math.max(0, want - 495) };
}

export function goalGap(est, goal, lcBase) {
  const g = rcGoal(goal, lcBase);
  const tWant = thetaForScaled(g.want);
  const need = expectedAcc(tWant);
  const parts = {};
  for (const p of RC_PARTS) {
    const info = est.rc.parts[p];
    parts[p] = { now: info.expAcc, need: Math.max(need, Math.min(info.expAcc, 1)), n: info.n, diff: Math.max(0, need - info.expAcc) };
  }
  return { want: g.want, overflow: g.overflow, gap: Math.max(0, g.want - est.rc.point), parts };
}
