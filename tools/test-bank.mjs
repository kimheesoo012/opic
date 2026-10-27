// 문제은행 검사: 형식(선택지 수·정답 범위·필드 누락)·중복·해설 정렬·개념별 새 문제 복습 가능성·파트별 문항 수
import fs from 'node:fs';
import path from 'node:path';
import { validateBank, normText } from '../toeic/js/schema.js';
import { buildBank, questionsOf } from '../toeic/js/bank.js';

const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../toeic/data');
const concepts = JSON.parse(fs.readFileSync(path.join(dir, 'concepts.json'))).concepts;
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json')));
const listed = new Set(idx.files);
const onDisk = fs.readdirSync(dir).filter((f) => /^p\d.*\.json$/.test(f));
const fails = [];
const warn = [];
for (const f of onDisk) if (!listed.has(f)) fails.push(`index.json에 없는 파일 ${f}`);
const units = idx.files.flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f))).units);
const rep = validateBank(units, concepts);
fails.push(...rep.errors);
warn.push(...rep.warnings);

const bank = buildBank(units, concepts);
const counts = {};
for (const u of bank.units) counts[u.part] = (counts[u.part] || 0) + questionsOf(u).length;

// 해설 정렬 검사: 짧은 선택지(단어·구)는 해당 오답 해설이 그 선택지를 언급해야 한다(순서가 밀린 해설 탐지)
const COMMON = new Set(['are', 'the', 'be', 'to', 'will', 'have', 'has', 'was', 'were', 'been', 'is', 'a', 'an', 'of', 'in', 'on', 'at', 'by']);
let alignChecked = 0;
for (const u of bank.units) {
  for (const q of questionsOf(u)) {
    if (![5, 6].includes(u.part) || q.type === 'insert') continue;
    q.choices.forEach((c, i) => {
      if (i === q.answer || c.split(' ').length > 4) return;
      alignChecked++;
      const t = (q.explanation.traps[i] || '').toLowerCase();
      const words = c.toLowerCase().split(/\s+/);
      const hit = t.includes(c.toLowerCase()) || words.some((w) => (w.length >= 4 || (w.length >= 3 && !COMMON.has(w))) && t.includes(w.slice(0, Math.min(4, w.length))));
      if (!hit) fails.push(`${q.id}: 오답 ${'ABCD'[i]}(${c}) 해설이 선택지를 언급하지 않음 — 순서 확인`);
    });
  }
}

// 정답 해설이 정답 선택지를 언급하는지(P5)
for (const u of bank.byPart[5] || []) {
  const c = u.choices[u.answer].toLowerCase();
  const why = u.explanation.why.toLowerCase();
  const ws = c.split(/\s+/);
  const key = ws.filter((w) => !COMMON.has(w));
  const hit = key.length ? key.some((w) => why.includes(w.slice(0, Math.min(4, w.length)))) : new RegExp(`(^|[^a-z])${c}([^a-z]|$)`).test(why);
  if (!hit) fails.push(`${u.id}: 정답 해설에 정답(${c}) 언급 없음`);
}

// 같은 개념의 새 문제로 복습 가능해야 함(개념당 3문항 이상, 쉬운 문제·어려운 문제 각각 존재 권장)
for (const c of concepts) {
  const refs = bank.byConcept.get(c.id) || [];
  if (refs.length < 2) fails.push(`개념 ${c.id}: 문항 ${refs.length}개 — 새 문제 복습 불가`);
  else if (refs.length < 3) warn.push(`개념 ${c.id}: 문항 ${refs.length}개 (3개 이상 권장)`);
}

// 정답 위치 분포(한쪽으로 쏠리면 찍기 요령이 생김)
const pos = [0, 0, 0, 0];
for (const u of bank.units) for (const q of questionsOf(u)) pos[q.answer]++;

// 같은 문장 틀 검사(유사도 0.5 이상 쌍은 경고로 표시)
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log('파트별 문항 수:', counts, '합계', total);
console.log(`세트 수: P3 ${(bank.byPart[3] || []).length} · P4 ${(bank.byPart[4] || []).length} · P6 ${(bank.byPart[6] || []).length} · P7 ${(bank.byPart[7] || []).length} (단일 ${(bank.byPart[7] || []).filter((u) => u.passages.length === 1).length}, 이중 ${(bank.byPart[7] || []).filter((u) => u.passages.length === 2).length}, 삼중 ${(bank.byPart[7] || []).filter((u) => u.passages.length === 3).length})`);
console.log('정답 위치 분포 A/B/C/D:', pos.join(' / '));
console.log(`해설 정렬 검사 ${alignChecked}개 선택지`);
if (counts[5] < 100) fails.push(`Part 5 ${counts[5]}문항 < 100`);
if ((bank.byPart[7] || []).length < 20) fails.push(`Part 7 세트 ${(bank.byPart[7] || []).length} < 20`);
if (total < 300) fails.push(`총 ${total}문항 < 300`);
warn.forEach((w) => console.log('WARN', w));
if (fails.length) { fails.forEach((f) => console.log('FAIL', f)); console.log(`실패 ${fails.length}건`); process.exit(1); }
console.log('문제은행 검사 통과');
