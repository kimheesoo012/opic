// 추정 점수 계산.
// 검증된 환산 모델이 아니다. 문항 난이도(1~5), 정답 여부, 풀이 시간, 파트별 성취도를 반영한
// 단순 문항반응(3모수 유사) 모델 + 경험적 환산표로 "범위"를 계산한다.
import { clamp, median, round5, REAL_COUNTS, LC_PARTS, RC_PARTS } from './util.js';

const GRID = [];
for (let t = -4; t <= 4.0001; t += 0.05) GRID.push(+t.toFixed(2));

export const diffToB = (d) => (d - 3) * 0.85;
const guessOf = (part) => (part === 2 ? 1 / 3 : 0.25);

export function pCorrect(theta, b, part) {
  const c = guessOf(part);
  return c + (1 - c) / (1 + Math.exp(-1.3 * (theta - b)));
}

// 실제 시험의 문항 난이도 분포 가정(이 앱 난이도 기준). 보정 데이터가 없으므로 가정값이다.
const REAL_DIFF_DIST = [[1, 0.12], [2, 0.25], [3, 0.3], [4, 0.22], [5, 0.11]];

export function expectedAcc(theta, part) {
  let s = 0;
  for (const [d, w] of REAL_DIFF_DIST) s += w * pCorrect(theta, diffToB(d), part);
  return s;
}

// 원점수 비율 → 환산 점수 (경험적 근사표, 공식 환산표 아님)
const MAP = {
  LC: [[0, 5], [0.2, 35], [0.3, 90], [0.4, 150], [0.5, 215], [0.6, 280], [0.7, 340], [0.8, 400], [0.88, 450], [0.93, 480], [0.96, 495], [1, 495]],
  RC: [[0, 5], [0.2, 25], [0.3, 75], [0.4, 130], [0.5, 190], [0.6, 250], [0.7, 310], [0.8, 375], [0.88, 430], [0.94, 470], [0.98, 495], [1, 495]],
};

export function rawToScaled(section, p) {
  const t = MAP[section];
  p = clamp(p, 0, 1);
  for (let i = 1; i < t.length; i++) {
    if (p <= t[i][0]) {
      const [x0, y0] = t[i - 1];
      const [x1, y1] = t[i];
      return y0 + ((p - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 495;
}

export function scaledToRaw(section, score) {
  const t = MAP[section];
  score = clamp(score, 5, 495);
  for (let i = 1; i < t.length; i++) {
    if (score <= t[i][1]) {
      const [x0, y0] = t[i - 1];
      const [x1, y1] = t[i];
      return y1 === y0 ? x0 : x0 + ((score - y0) / (y1 - y0)) * (x1 - x0);
    }
  }
  return 1;
}

const PARTS = { LC: LC_PARTS, RC: RC_PARTS };
const RC_LIMIT_SEC = 75 * 60;

// 주어진 능력값(파트별 theta)으로 실제 시험 원점수 비율을 예상한다. RC는 시간 초과 시 남는 문항을 찍는다고 가정.
function projectRaw(section, thetaByPart, ratioByPart, targetByPart) {
  const parts = PARTS[section];
  const total = parts.reduce((s, p) => s + REAL_COUNTS[p], 0);
  let correct = 0;
  for (const p of parts) correct += REAL_COUNTS[p] * expectedAcc(thetaByPart[p], p);
  let unanswered = 0;
  if (section === 'RC') {
    let need = 0;
    for (const p of parts) need += REAL_COUNTS[p] * targetByPart[p] * ratioByPart[p];
    const over = need - RC_LIMIT_SEC;
    if (over > 0) {
      unanswered = Math.min(REAL_COUNTS[7], over / (targetByPart[7] * ratioByPart[7]));
      correct -= unanswered * (expectedAcc(thetaByPart[7], 7) - 0.25);
    }
  }
  return { raw: correct / total, unanswered };
}

function gridPosterior(items, priorMean, priorSd) {
  const logs = GRID.map((t) => -0.5 * ((t - priorMean) / priorSd) ** 2);
  for (const it of items) {
    const b = diffToB(it.difficulty);
    for (let i = 0; i < GRID.length; i++) {
      const p = pCorrect(GRID[i], b, it.part);
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

export function thetaForScaled(section, score) {
  const target = scaledToRaw(section, score);
  let lo = -4;
  let hi = 4;
  const parts = PARTS[section];
  const total = parts.reduce((s, p) => s + REAL_COUNTS[p], 0);
  const f = (t) => parts.reduce((s, p) => s + REAL_COUNTS[p] * expectedAcc(t, p), 0) / total;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const MODE_W = { diag: 1, deep: 1, mock: 1, timed: 1, practice: 0.6, speed: 0.6 };

// attempts: [{part, difficulty, correct, sec, target, mode, repeat}]
// opts.baseline: {LC, RC} 최근 실제 점수(있으면 약한 사전 정보로 사용)
export function estimate(attempts, opts = {}) {
  const usable = attempts.filter((a) => !a.repeat && MODE_W[a.mode] !== undefined);
  const out = { n: usable.length, sections: {} };
  for (const section of ['LC', 'RC']) {
    const parts = PARTS[section];
    const items = usable.filter((a) => parts.includes(a.part));
    const priorMean = opts.baseline && opts.baseline[section] ? thetaForScaled(section, opts.baseline[section]) : 0;
    const priorSd = opts.baseline && opts.baseline[section] ? 1.0 : 1.2;
    // 파트 가중치: 실제 시험의 파트 비중대로 (많이 푼 파트가 점수를 독점하지 않도록)
    const byPart = {};
    for (const p of parts) byPart[p] = items.filter((a) => a.part === p);
    const present = parts.filter((p) => byPart[p].length);
    const shareTotal = present.reduce((s, p) => s + REAL_COUNTS[p], 0) || 1;
    const weighted = [];
    for (const p of present) {
      const k = (REAL_COUNTS[p] / shareTotal) * items.length / byPart[p].length;
      for (const a of byPart[p]) weighted.push({ ...a, w: k * (MODE_W[a.mode] ?? 0.6) });
    }
    const post = gridPosterior(weighted, priorMean, priorSd);
    const partInfo = {};
    const thetaPoint = {};
    const thetaLo = {};
    const thetaHi = {};
    const ratio = {};
    const target = {};
    for (const p of parts) {
      const its = byPart[p];
      // 파트별 성취도: 섹션 능력값으로 수축(shrinkage)한 파트 능력값
      const pp = gridPosterior(its.map((a) => ({ ...a, w: MODE_W[a.mode] ?? 0.6 })), post.mean, 0.6);
      const shift = pp.mean - post.mean;
      thetaPoint[p] = pp.mean;
      thetaLo[p] = post.q10 + shift;
      thetaHi[p] = post.q90 + shift;
      const timed = its.filter((a) => a.sec > 0 && a.target > 0);
      ratio[p] = timed.length >= 3 ? clamp(median(timed.map((a) => a.sec / a.target)), 0.4, 3) : 1;
      target[p] = timed.length ? timed[0].target : { 5: 20, 6: 30, 7: 60 }[p] || 10;
      partInfo[p] = {
        n: its.length,
        acc: its.length ? its.filter((a) => a.correct).length / its.length : null,
        timeRatio: timed.length >= 3 ? ratio[p] : null,
        theta: pp.mean,
        expAcc: expectedAcc(pp.mean, p),
      };
    }
    const mid = projectRaw(section, thetaPoint, ratio, target);
    const lo = projectRaw(section, thetaLo, ratio, target);
    const hi = projectRaw(section, thetaHi, ratio, target);
    // 커버리지(풀어 본 파트 비중)가 낮을수록 범위를 더 넓힌다. 환산표 자체 오차로 ±20점 추가.
    const coverage = parts.reduce((s, p) => s + (byPart[p].length >= 2 ? REAL_COUNTS[p] : 0), 0) / parts.reduce((s, p) => s + REAL_COUNTS[p], 0);
    const extra = 20 + (1 - coverage) * 60 + Math.max(0, 15 - items.length) * 3;
    const point = rawToScaled(section, mid.raw);
    out.sections[section] = {
      n: items.length,
      theta: post.mean,
      sd: post.sd,
      coverage,
      point: clamp(round5(point), 5, 495),
      lo: clamp(round5(rawToScaled(section, lo.raw) - extra), 5, 495),
      hi: clamp(round5(rawToScaled(section, hi.raw) + extra), 5, 495),
      unanswered: Math.round(mid.unanswered),
      parts: partInfo,
    };
  }
  const L = out.sections.LC;
  const R = out.sections.RC;
  out.total = { point: L.point + R.point, lo: L.lo + R.lo, hi: L.hi + R.hi };
  out.enough = L.n >= 8 && R.n >= 10 && L.coverage >= 0.5 && R.coverage >= 0.5;
  out.level = levelLabel(out.total.point);
  return out;
}

export function levelLabel(total) {
  if (total < 600) return '기초 다지기 단계';
  if (total < 700) return '700 도전 단계';
  if (total < 800) return '800 도전 단계';
  if (total < 850) return '850 도전 단계';
  if (total < 900) return '900 도전 단계';
  if (total < 950) return '950 도전 단계';
  return '990 도전 단계';
}

// 목표 점수 달성에 필요한 섹션 점수와 파트별 정답률(실제 시험 난이도 분포 기준)
export function goalGap(est, goal) {
  const L = est.sections.LC;
  const R = est.sections.RC;
  const cur = { LC: L.point, RC: R.point };
  const gap = goal - (cur.LC + cur.RC);
  const want = { ...cur };
  if (gap > 0) {
    const roomL = 495 - cur.LC;
    const roomR = 495 - cur.RC;
    let dL = roomL + roomR > 0 ? gap * (roomL / (roomL + roomR)) : 0;
    let dR = gap - dL;
    want.LC = Math.min(495, cur.LC + dL);
    want.RC = Math.min(495, cur.RC + dR);
    const spill = goal - want.LC - want.RC;
    if (spill > 0) {
      if (want.LC < 495) want.LC = Math.min(495, want.LC + spill);
      else want.RC = Math.min(495, want.RC + spill);
    }
  }
  const parts = {};
  for (const section of ['LC', 'RC']) {
    const tWant = thetaForScaled(section, want[section]);
    for (const p of PARTS[section]) {
      const info = est.sections[section].parts[p];
      const need = expectedAcc(tWant, p);
      parts[p] = { now: info.expAcc, need: Math.max(need, info.expAcc), n: info.n, diff: Math.max(0, need - info.expAcc) };
    }
  }
  return { gap: Math.max(0, gap), want: { LC: round5(want.LC), RC: round5(want.RC) }, cur, parts };
}
