// 문제 고르기: 연습·진단·모의고사 구성 (RC 전용)
import { questionsOf } from './bank.js';
import { mean, TARGETS } from './util.js';

// 난이도 3단계(기본·중급·고급) 가중치. 목표가 높을수록 고급·함정 문제 비중을 높인다.
const GOAL_DIFF = {
  700: [0.55, 0.35, 0.1],
  730: [0.5, 0.38, 0.12],
  800: [0.35, 0.4, 0.25],
  860: [0.25, 0.4, 0.35],
  900: [0.2, 0.4, 0.4],
};
const FLAT = [0.3, 0.4, 0.3];

export function diffWeights(goal) {
  return GOAL_DIFF[goal] || GOAL_DIFF[730];
}
export function trapBonus(goal) {
  const i = Math.max(0, TARGETS.indexOf(goal));
  return 1 + i * 0.25;
}

export const unitDifficulty = (u) => Math.round(mean(questionsOf(u).map((q) => q.difficulty)));
export const unitSize = (u) => questionsOf(u).length;
export const passageCount = (u) => (u.passages || []).length;
export const isMulti = (u) => u.part === 7 && passageCount(u) >= 2;

function weightOf(u, opts, seen) {
  const dw = opts.diff || FLAT;
  let w = dw[unitDifficulty(u) - 1] || 0.05;
  const qs = questionsOf(u);
  if (opts.goal && qs.some((q) => (q.tags || []).includes('trap'))) w *= trapBonus(opts.goal);
  const seenCount = qs.filter((q) => seen && seen.has(q.id)).length;
  if (seenCount) {
    // 본 문제는 덜 나오게. 오래전에 본 문제일수록 조금 더.
    const lastT = Math.max(...qs.map((q) => (seen.get(q.id)?.lastT) || 0));
    const days = ((opts.now || Date.now()) - lastT) / 86400000;
    w *= 0.05 + Math.min(0.25, days / 60);
  }
  if (opts.concept) {
    const hit = qs.filter((q) => q.concept === opts.concept).length;
    if (!hit) return 0;
    w *= hit;
  }
  if (opts.concepts) {
    const hit = qs.filter((q) => opts.concepts.includes(q.concept)).length;
    if (!hit) return 0;
    w *= hit;
  }
  return w;
}

// 가중 비복원 추출로 문항 수(nQ)를 채울 때까지 단위를 고른다.
export function pickUnits(bank, opts, seen, rng) {
  let pool = [];
  const parts = opts.parts || [opts.part];
  for (const p of parts) pool.push(...(bank.byPart[p] || []));
  if (opts.filter) pool = pool.filter(opts.filter);
  if (opts.exclude) pool = pool.filter((u) => !opts.exclude.has(u.id));
  const items = pool.map((u) => ({ u, w: weightOf(u, opts, seen) })).filter((x) => x.w > 0);
  const out = [];
  let count = 0;
  while (count < opts.nQ && items.length) {
    const tot = items.reduce((s, x) => s + x.w, 0);
    let r = rng() * tot;
    let i = 0;
    for (; i < items.length - 1; i++) {
      r -= items[i].w;
      if (r <= 0) break;
    }
    const [x] = items.splice(i, 1);
    out.push(x.u);
    count += unitSize(x.u);
  }
  return out;
}

const single = (u) => !isMulti(u);
const double = (u) => passageCount(u) === 2;
const triple = (u) => passageCount(u) === 3;

// 진단·모의고사 청사진. nQ는 목표 문항 수(세트 크기에 따라 조금 달라질 수 있음).
export const BLUEPRINTS = {
  quick: [{ part: 5, nQ: 12 }, { part: 6, nQ: 8 }, { part: 7, nQ: 9, filter: single }],
  deep: [{ part: 5, nQ: 24 }, { part: 6, nQ: 12 }, { part: 7, nQ: 14, filter: single }, { part: 7, nQ: 5, filter: double }, { part: 7, nQ: 5, filter: triple }],
  half: [{ part: 5, nQ: 15 }, { part: 6, nQ: 8 }, { part: 7, nQ: 15, filter: single }, { part: 7, nQ: 5, filter: double }, { part: 7, nQ: 5, filter: triple }],
  full: [{ part: 5, nQ: 30 }, { part: 6, nQ: 16 }, { part: 7, nQ: 29, filter: single }, { part: 7, nQ: 10, filter: double }, { part: 7, nQ: 15, filter: triple }],
};
// 제한 시간(초)
export const TIME_LIMIT = { quick: 20 * 60, deep: 45 * 60, half: 38 * 60, full: 75 * 60 };

export function buildBlueprint(bank, kind, seen, rng, goal, now = Date.now()) {
  const used = new Set();
  const units = [];
  for (const b of BLUEPRINTS[kind]) {
    const opts = { part: b.part, nQ: b.nQ, filter: b.filter, exclude: used, now, diff: kind === 'half' || kind === 'full' ? diffWeights(goal) : FLAT };
    for (const u of pickUnits(bank, opts, seen, rng)) {
      used.add(u.id);
      units.push(u);
    }
  }
  // 실제 시험처럼 파트 순서, Part 7은 단일 → 이중 → 삼중
  units.sort((a, b) => a.part - b.part || passageCount(a) - passageCount(b));
  return units;
}

export function countQuestions(units) {
  return units.reduce((s, u) => s + unitSize(u), 0);
}
