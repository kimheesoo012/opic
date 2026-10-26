// 문제은행 색인. units(단일 문항 또는 세트)를 받아 조회용 구조를 만든다.
import { validateBank } from './schema.js';

export function questionsOf(unit) {
  return unit.questions ? unit.questions : [unit];
}

export function buildBank(rawUnits, concepts, { dropInvalid = true } = {}) {
  const report = validateBank(rawUnits, concepts);
  const units = dropInvalid ? rawUnits.filter((u) => !report.badUnitIds.has(u.id)) : rawUnits.slice();
  const unitById = new Map();
  const qById = new Map(); // qid -> { q, unit }
  const byPart = {};
  const byConcept = new Map(); // concept -> [{q, unit}]
  for (const u of units) {
    unitById.set(u.id, u);
    (byPart[u.part] ||= []).push(u);
    for (const q of questionsOf(u)) {
      const ref = { q, unit: u };
      qById.set(q.id, ref);
      if (!byConcept.has(q.concept)) byConcept.set(q.concept, []);
      byConcept.get(q.concept).push(ref);
    }
  }
  const conceptById = new Map((concepts || []).map((c) => [c.id, c]));
  const count = (part) => (byPart[part] || []).reduce((s, u) => s + questionsOf(u).length, 0);
  return { units, unitById, qById, byPart, byConcept, conceptById, concepts: concepts || [], report, count };
}

// 문항 목표 풀이 시간(초). 개념에 지정되어 있으면 그것, 아니면 파트 기본값.
export function targetSec(bank, q, unit) {
  const c = bank.conceptById.get(q.concept);
  if (c && c.targetSec) return c.targetSec;
  return { 1: 8, 2: 8, 3: 12, 4: 12, 5: 20, 6: 30, 7: 60 }[unit.part] || 30;
}

export function conceptName(bank, id) {
  const c = bank.conceptById.get(id);
  return c ? c.name : id;
}
