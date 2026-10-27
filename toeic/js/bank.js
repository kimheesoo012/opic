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

export function wordCount(unit) {
  return (unit.passages || []).reduce((s, p) => {
    let n = (p.text.match(/[A-Za-z0-9$][^\s]*/g) || []).length;
    if (p.table) n += p.table.rows.flat().join(' ').split(/\s+/).length + p.table.header.length;
    return s + n;
  }, 0);
}

// 세트 목표 시간(초). Part 7: 분당 150단어로 지문을 읽고 문항당 25초. Part 6: 문항당 30초.
export function unitTarget(unit) {
  if (unit.part === 7) {
    const sec = (wordCount(unit) / 150) * 60 + 25 * questionsOf(unit).length;
    return Math.max(60, Math.round(sec / 10) * 10);
  }
  if (unit.part === 6) return 30 * questionsOf(unit).length;
  return 20 * questionsOf(unit).length;
}

// 문항 목표 풀이 시간(초)
export function targetSec(bank, q, unit) {
  if (unit.part === 7) return Math.round(unitTarget(unit) / questionsOf(unit).length);
  const c = bank.conceptById.get(q.concept);
  if (c && c.targetSec) return c.targetSec;
  return unit.part === 6 ? 30 : 20;
}

export function conceptName(bank, id) {
  const c = bank.conceptById.get(id);
  return c ? c.name : id;
}

export const LEVELS = { 1: '기본', 2: '중급', 3: '고급' };
