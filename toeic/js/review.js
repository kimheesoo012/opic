// 유형(개념) 단위 단계별 복습.
// 1 핵심 개념 → 2 쉬운 문제 → 3 비슷한 선택지가 섞인 어려운 문제 → 4 제한 시간 →
// 5 1일 뒤 새 문제 → 6 3일 뒤 새 문제 → 7 7일 뒤 새 문제 → 8 유지(21일·30일 간격으로 계속 확인)
import { DAY } from './util.js';
import { questionsOf } from './bank.js';

export const STAGES = {
  1: { kind: 'concept', label: '핵심 개념' },
  2: { kind: 'easy', label: '쉬운 문제' },
  3: { kind: 'hard', label: '어려운 문제' },
  4: { kind: 'timed', label: '제한 시간' },
  5: { kind: 'spaced', label: '1일 뒤 확인' },
  6: { kind: 'spaced', label: '3일 뒤 확인' },
  7: { kind: 'spaced', label: '7일 뒤 확인' },
  8: { kind: 'spaced', label: '유지 확인' },
};
const NEXT_DELAY = { 4: 1 * DAY, 5: 3 * DAY, 6: 7 * DAY, 7: 21 * DAY, 8: 30 * DAY };

export function newCard(concept, now) {
  return { concept, stage: 1, due: now, createdAt: now, updatedAt: now, wrongQids: [], history: [], lapses: 0 };
}

// 문제를 틀렸을 때 호출. 카드가 없으면 만들고, 이미 간격 복습 단계라면 처음부터 다시.
export function onWrong(cards, concept, qid, now) {
  let c = cards[concept];
  if (!c) {
    c = newCard(concept, now);
    cards[concept] = c;
  } else if (c.stage >= 5) {
    c.stage = 1;
    c.due = now;
    c.lapses++;
  } else {
    c.due = Math.min(c.due, now);
  }
  if (qid && !c.wrongQids.includes(qid)) c.wrongQids.push(qid);
  c.updatedAt = now;
  return c;
}

export function dueCards(cards, now) {
  return Object.values(cards).filter((c) => c.due <= now).sort((a, b) => a.due - b.due || a.stage - b.stage);
}

export function stepKind(card) {
  return STAGES[card.stage].kind;
}

// 단계 결과 반영. ok: 정답(제한 시간 단계는 시간 안에 정답).
export function onStepResult(card, ok, now, info = {}) {
  const from = card.stage;
  card.history.push({ t: now, stage: from, ok, qid: info.qid || null, isNew: info.isNew ?? null });
  if (card.history.length > 60) card.history.splice(0, card.history.length - 60);
  if (from === 1) {
    card.stage = 2;
    card.due = now;
  } else if (from <= 4) {
    if (ok) {
      card.stage = from + 1;
      card.due = from === 4 ? now + NEXT_DELAY[4] : now;
    } else {
      card.stage = from === 2 ? 1 : from - 1;
      card.due = now;
    }
  } else {
    if (ok) {
      card.stage = Math.min(8, from + 1);
      card.due = now + NEXT_DELAY[from];
    } else {
      card.stage = 1;
      card.due = now;
      card.lapses++;
    }
  }
  card.updatedAt = now;
  return card;
}

// 한 세션에서 같은 카드를 너무 오래 붙잡지 않도록: 남은 단계는 내일로 미룬다.
export function postpone(card, now) {
  card.due = now + DAY;
  card.updatedAt = now;
}

// 복습 단계에 맞는 문제(단위) 고르기.
// seen: Map(qid -> {count,lastT}). 반환: {unit, q, isNew} 또는 null
export function pickReviewItem(bank, card, seen, rng, excludeQids = []) {
  const kind = stepKind(card);
  if (kind === 'concept') return null;
  const refs = (bank.byConcept.get(card.concept) || []).filter((r) => !excludeQids.includes(r.q.id));
  if (!refs.length) return null;
  const isSeen = (r) => seen.has(r.q.id);
  let pool;
  if (kind === 'easy') {
    pool = refs.filter((r) => r.q.difficulty <= 2);
    if (!pool.length) pool = refs.filter((r) => r.q.difficulty <= 3);
  } else if (kind === 'hard') {
    pool = refs.filter((r) => r.q.difficulty >= 4 || (r.q.difficulty >= 3 && (r.q.tags || []).includes('trap')));
    if (!pool.length) pool = refs.filter((r) => r.q.difficulty >= 3);
  } else {
    pool = refs;
  }
  if (!pool.length) pool = refs;
  // 틀렸던 그 문제는 간격 복습에서 피한다(새 문제로 확인)
  const notWrong = pool.filter((r) => !card.wrongQids.includes(r.q.id));
  if (notWrong.length) pool = notWrong;
  const fresh = pool.filter((r) => !isSeen(r));
  if (fresh.length) {
    const r = rng.pick(fresh);
    return { unit: r.unit, q: r.q, isNew: true };
  }
  // 새 문제가 없으면 가장 오래전에 본 문제 → '같은 문제 재풀이'로 기록
  const old = pool.slice().sort((a, b) => (seen.get(a.q.id)?.lastT || 0) - (seen.get(b.q.id)?.lastT || 0));
  const r = old[0];
  return { unit: r.unit, q: r.q, isNew: false };
}

// 세트 문항(Part 3·4·6·7)의 경우 해당 개념 문항만 통과 판정에 쓴다.
export function focusQuestions(unit, concept) {
  return questionsOf(unit).filter((q) => q.concept === concept);
}

// 오답노트(문항 단위) 갱신
export function updateWrongNote(note, attempt) {
  const e = note[attempt.qid];
  if (!attempt.correct) {
    const n = e || { qid: attempt.qid, part: attempt.part, concept: attempt.concept, firstT: attempt.t, wrongCount: 0, rightAfter: 0 };
    n.wrongCount++;
    n.rightAfter = 0;
    n.lastT = attempt.t;
    n.cause = attempt.cause || n.cause || null;
    note[attempt.qid] = n;
  } else if (e) {
    e.rightAfter++;
    e.lastT = attempt.t;
  }
}
