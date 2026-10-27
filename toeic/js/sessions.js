// 풀이 세션 구성·채점·기록 (DOM 없음 → 시뮬레이션 테스트에서도 사용)
import { questionsOf, targetSec, unitTarget } from './bank.js';
import { pickUnits, buildBlueprint, diffWeights, TIME_LIMIT, unitSize, isMulti } from './selection.js';
import { seenMap, overtimeQids } from './stats.js';
import { onWrong, onStepResult, postpone, pickReviewItem, stepKind, focusQuestions, updateWrongNote } from './review.js';
import { uid, dayKey, PART_NAMES } from './util.js';

export const MODE_OF = {
  practice: 'practice', drill: 'practice', diag: 'diag', deep: 'deep', mock: 'mock', full: 'full',
  timed: 'timed', speed: 'speed', p7time: 'timed', overtime: 'overtime', review: 'review', wrongnote: 'wrongnote',
};
const END_FEEDBACK = new Set(['diag', 'deep', 'mock', 'full', 'timed', 'speed', 'p7time']);
const BP = { diag: 'quick', deep: 'deep', mock: 'half', full: 'full' };
const TITLES = { diag: '간단 진단', deep: '심화 진단', mock: '하프 모의고사', full: 'RC 실전 모의고사' };

function unitItems(units, extra = {}) {
  return units.map((u) => ({ type: 'unit', unitId: u.id, ...extra }));
}

function unitsOfQids(bank, qids) {
  const units = [];
  const seen = new Set();
  for (const id of qids) {
    const ref = bank.qById.get(id);
    if (ref && !seen.has(ref.unit.id)) { units.push(ref.unit); seen.add(ref.unit.id); }
  }
  return units;
}

// kind별 세션 생성. 반환 null이면 문제 부족.
export function newSession(kind, params, env) {
  const { bank, state, rng } = env;
  const now = env.now || Date.now();
  const seen = seenMap(state.attempts);
  const goal = state.profile.goal;
  params = params || {};
  let items = [];
  let title = '';
  let limitSec = null;
  let perQ = null; // 문항별 카운트다운(초)
  let autoNext = false; // 시간이 다 되면 다음 문항으로
  let perSet = false; // Part 7 지문별 목표 시간 카운트다운
  if (BP[kind]) {
    const units = buildBlueprint(bank, BP[kind], seen, rng, goal, now);
    items = unitItems(units);
    limitSec = TIME_LIMIT[BP[kind]];
    title = TITLES[kind];
  } else if (kind === 'practice' || kind === 'drill' || kind === 'timed') {
    const parts = params.parts || (params.part ? [params.part] : null);
    const opts = { parts: parts || [5], nQ: params.nQ || 10, diff: diffWeights(goal), goal, now, concept: params.concept };
    if (params.concept && !params.part) {
      const ref = (bank.byConcept.get(params.concept) || [])[0];
      if (ref) opts.parts = [ref.unit.part];
    }
    if (params.multi) opts.filter = isMulti;
    items = unitItems(pickUnits(bank, opts, seen, rng));
    if (kind === 'timed') limitSec = params.limitSec || null;
    title = params.title || (params.concept ? `${bank.conceptById.get(params.concept)?.name || params.concept} 집중`
      : parts && parts.length === 1 ? `Part ${parts[0]} ${PART_NAMES[parts[0]]}` : '맞춤 연습');
  } else if (kind === 'speed') {
    // Part 5 연속 풀이: 문항당 20초, 시간이 다 되면 다음 문항. 시간 초과했던 문제·개념부터.
    const nQ = params.nQ || 12;
    const over = overtimeQids(state.attempts.filter((a) => a.part === 5), now);
    const slowConcepts = [...new Set(state.attempts.filter((a) => a.part === 5 && a.sec > a.target).map((a) => a.concept))];
    const used = new Set();
    const units = [];
    for (const u of rng.shuffle(unitsOfQids(bank, over)).slice(0, Math.ceil(nQ / 3))) { units.push(u); used.add(u.id); }
    if (slowConcepts.length) {
      for (const u of pickUnits(bank, { part: 5, nQ: Math.ceil((nQ - units.length) / 2), concepts: slowConcepts, exclude: used, now }, seen, rng)) { units.push(u); used.add(u.id); }
    }
    if (units.length < nQ) units.push(...pickUnits(bank, { part: 5, nQ: nQ - units.length, exclude: used, diff: diffWeights(goal), now }, seen, rng));
    items = unitItems(rng.shuffle(units));
    perQ = 20;
    autoNext = true;
    title = 'Part 5 연속 풀이';
  } else if (kind === 'p7time') {
    const units = pickUnits(bank, { part: 7, nQ: params.nQ || 6, diff: diffWeights(goal), goal, now, filter: params.multi ? isMulti : null }, seen, rng);
    items = unitItems(units);
    perSet = true;
    title = 'Part 7 지문별 시간 훈련';
  } else if (kind === 'overtime') {
    const qids = params.qids || overtimeQids(state.attempts, now).slice(0, 10);
    items = unitItems(unitsOfQids(bank, qids));
    perSet = true;
    title = '시간 초과 문제 다시 풀기';
  } else if (kind === 'wrongnote') {
    items = unitItems(unitsOfQids(bank, params.qids || []));
    title = '오답 다시 풀기';
  } else if (kind === 'review') {
    title = '단계별 복습';
  }
  const s = {
    id: uid('s'), kind, mode: MODE_OF[kind], title, params, items, cur: 0, qIdx: 0,
    answers: {}, feedback: END_FEEDBACK.has(kind) ? 'end' : 'immediate',
    createdAt: now, elapsed: 0, limitSec, perQ, autoNext, perSet, setElapsed: {}, done: false, timeUp: false,
  };
  if (kind === 'review') {
    s.review = { queue: (params.concepts || []).slice(), idx: 0, steps: 0, excl: [] };
    reviewAdvance(s, env);
  }
  if (!s.items.length) return null;
  return s;
}

export function currentItem(s) {
  return s.items[s.cur] || null;
}

// 문항 카운트다운 한도(초). 없으면 null.
export function questionLimit(s, it, unit, q, bank) {
  if (it.timed) return it.timed;
  if (s.perQ) return s.perQ;
  return null;
}
// 세트 카운트다운 한도(초). 없으면 null.
export function setLimit(s, unit) {
  if (s.perSet && unit.part >= 6) return unitTarget(unit);
  return null;
}

// 복습 세션: 다음 단계를 items에 추가. 더 없으면 false
export function reviewAdvance(s, env) {
  const { bank, state, rng } = env;
  const now = env.now || Date.now();
  const r = s.review;
  const cards = state.reviews;
  const seen = seenMap(state.attempts);
  while (r.idx < r.queue.length) {
    const card = cards[r.queue[r.idx]];
    const moveOn = () => { r.idx++; r.steps = 0; };
    if (!card) { moveOn(); continue; }
    if (card.due > now) { moveOn(); continue; }
    if (r.steps >= 6) { postpone(card, now); moveOn(); continue; }
    const kind = stepKind(card);
    r.steps++;
    if (kind === 'concept') {
      s.items.push({ type: 'concept', concept: card.concept, stage: card.stage });
      return true;
    }
    const pick = pickReviewItem(bank, card, seen, rng, r.excl);
    if (!pick) { postpone(card, now); moveOn(); continue; }
    r.excl.push(...questionsOf(pick.unit).map((q) => q.id));
    s.items.push({
      type: 'unit', unitId: pick.unit.id, focus: card.concept, stage: card.stage, isNew: pick.isNew,
      timed: card.stage === 4 ? targetSec(bank, pick.q, pick.unit) : null,
    });
    return true;
  }
  return false;
}

// 답안 기록 → attempt 객체 (저장은 호출 측). choice가 -1이면 시간 초과 미응답.
export function makeAttempt(s, unit, q, choice, sec, env, extra = {}) {
  const { bank, state } = env;
  const now = env.now || Date.now();
  const item = currentItem(s) || {};
  const seenBefore = state.attempts.some((a) => a.qid === q.id && a.sessionId !== s.id);
  return {
    id: uid('a'), t: now, qid: q.id, unitId: unit.id, part: unit.part, concept: q.concept, type: q.type,
    difficulty: q.difficulty, correct: choice === q.answer, choice, sec: Math.round(sec * 10) / 10,
    target: targetSec(bank, q, unit), mode: s.mode, sessionId: s.id, repeat: seenBefore,
    cause: choice === -1 ? 'time' : null, reviewStage: item.focus === q.concept ? item.stage : null, ...extra,
  };
}

// 저장 후 부수 효과: 오답노트·복습 카드·학습 시간
export function applyAttempt(a, env) {
  const { state } = env;
  const now = env.now || Date.now();
  updateWrongNote(state.wrongNote, a);
  if (!a.correct && a.reviewStage == null) onWrong(state.reviews, a.concept, a.qid, now);
  const k = dayKey(a.t);
  state.studyLog[k] = (state.studyLog[k] || 0) + Math.min(a.sec || 0, 180);
}

// 복습 단계 결과 판정 (세트는 해당 개념 문항 모두 정답이어야 통과)
export function reviewStepResult(s, item, env) {
  const { bank, state } = env;
  const now = env.now || Date.now();
  const card = state.reviews[item.focus || item.concept];
  if (!card) return null;
  if (item.type === 'concept') {
    onStepResult(card, true, now);
    return true;
  }
  const unit = bank.unitById.get(item.unitId);
  const fq = focusQuestions(unit, item.focus);
  const ok = fq.every((q) => {
    const ans = s.answers[q.id];
    if (!ans || ans.choice !== q.answer) return false;
    if (item.timed && ans.sec > item.timed) return false;
    return true;
  });
  onStepResult(card, ok, now, { qid: fq[0] && fq[0].id, isNew: item.isNew });
  return ok;
}

export function summarize(s, bank) {
  const byPart = {};
  let n = 0;
  let correct = 0;
  let sec = 0;
  let over = 0;
  const wrong = [];
  let unanswered = 0;
  for (const it of s.items) {
    if (it.type !== 'unit') continue;
    const unit = bank.unitById.get(it.unitId);
    if (!unit) continue;
    for (const q of questionsOf(unit)) {
      const a = s.answers[q.id];
      const p = (byPart[unit.part] ||= { n: 0, correct: 0, sec: 0, unanswered: 0, over: 0 });
      if (!a) { p.unanswered++; unanswered++; continue; }
      p.n++; n++;
      p.sec += a.sec; sec += a.sec;
      if (a.sec > targetSec(bank, q, unit)) { p.over++; over++; }
      if (a.choice === q.answer) { p.correct++; correct++; } else wrong.push({ qid: q.id, unitId: unit.id });
    }
  }
  return { n, correct, sec, byPart, wrong, unanswered, over };
}

export function totalQuestions(s, bank) {
  return s.items.reduce((sum, it) => (it.type === 'unit' && bank.unitById.get(it.unitId) ? sum + unitSize(bank.unitById.get(it.unitId)) : sum), 0);
}
