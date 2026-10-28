// 문제은행 검사: 형식(선택지 수·정답 범위·필드 누락)·중복·해설 정렬·개념별 새 문제 복습 가능성·파트별 문항 수
import fs from 'node:fs';
import path from 'node:path';
import { validateBank, normText } from '../toeic/js/schema.js';
import { buildBank, questionsOf, unitTarget } from '../toeic/js/bank.js';

const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), `../${process.env.TT_APP || 'toeic'}/data`);
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

// 해석(trans)과 Part 7 근거 문장(evidence): 모든 문항에 있어야 하고, 근거는 지문의 정확한 일부여야 한다
const normT = (x) => String(x).replace(/\s+/g, ' ').trim();
let evN = 0;
for (const u of bank.units) {
  const hay = normT([...(u.passages || []).map((p) => p.text), ...(u.passages || []).filter((p) => p.table).map((p) => [...p.table.header, ...p.table.rows.flat()].join(' '))].join(' '));
  for (const q of questionsOf(u)) {
    if (typeof q.trans !== 'string' || q.trans.trim().length < 5) fails.push(`${q.id}: 해석(trans) 없음`);
    else if (/-{7}|\{\{\d\}\}/.test(q.trans)) fails.push(`${q.id}: 해석에 빈칸 표시가 남아 있음`);
    if (u.part === 7) {
      if (!Array.isArray(q.evidence) || !q.evidence.length) fails.push(`${q.id}: 근거(evidence) 없음`);
      else for (const e of q.evidence) { evN++; if (!hay.includes(normT(e))) fails.push(`${q.id}: 근거가 지문에 없음 "${e.slice(0, 40)}"`); if (/[가-힣]/.test(e)) fails.push(`${q.id}: 근거에 한글`); }
    }
  }
}
console.log(`해석 ${bank.units.reduce((n, u) => n + questionsOf(u).filter((q) => q.trans).length, 0)}개, Part 7 근거 ${evN}개`);
// 짧은 해설(한국어: 정답 이유 45자·오답 해설 16자 미만, 일본어는 글자가 촘촘해 28자·10자)
const JA = /ja$/.test(process.env.TT_APP || '');
const [minWhy, minTrap] = JA ? [28, 10] : [45, 16];
for (const u of bank.units) for (const q of questionsOf(u)) {
  if (q.explanation.why.length < minWhy) fails.push(`${q.id}: 정답 해설이 짧음(${q.explanation.why.length}자)`);
  q.explanation.traps.forEach((t, i) => { if (t && t.length < minTrap) fails.push(`${q.id}: 오답 ${'ABCD'[i]} 해설이 짧음(${t.length}자)`); });
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
const p7 = bank.byPart[7] || [];
const single = p7.filter((u) => u.passages.length === 1).length;
const multi = p7.length - single;
const p6 = bank.byPart[6] || [];
console.log(`세트 수: P6 ${p6.length} (문장 삽입 ${p6.filter((u) => u.questions.some((q) => q.type === 'insert')).length}세트) · P7 ${p7.length} (단일 ${single}, 이중 ${p7.filter((u) => u.passages.length === 2).length}, 삼중 ${p7.filter((u) => u.passages.length === 3).length})`);
const lv = {};
for (const u of bank.units) for (const q of questionsOf(u)) { const k = `P${u.part}`; (lv[k] ||= [0, 0, 0])[q.difficulty - 1]++; }
console.log('난이도 기본/중급/고급:', Object.entries(lv).map(([k, v]) => `${k} ${v.join('/')}`).join(' · '));
const kinds = {};
for (const u of p7) for (const p of u.passages) kinds[p.kind] = (kinds[p.kind] || 0) + 1;
console.log('Part 7 지문 종류:', Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', '));
const tg = p7.map((u) => unitTarget(u));
console.log(`Part 7 지문별 목표 시간: ${Math.min(...tg)}~${Math.max(...tg)}초`);
if (Object.keys(counts).some((p) => Number(p) < 5)) fails.push('LC 문항이 RC 은행에 섞여 있음');
if (p6.length < 25) fails.push(`Part 6 세트 ${p6.length} < 25`);
if (single < 30) fails.push(`Part 7 단일 지문 ${single} < 30`);
if (multi < 15) fails.push(`Part 7 이중·삼중 지문 ${multi} < 15`);
for (const [k, v] of Object.entries(lv)) if (Math.min(...v) < 5) fails.push(`${k} 난이도 단계별 문항 부족 ${v.join('/')}`);
console.log('정답 위치 분포 A/B/C/D:', pos.join(' / '));
console.log(`해설 정렬 검사 ${alignChecked}개 선택지`);
if (counts[5] < 200) fails.push(`Part 5 ${counts[5]}문항 < 200`);
if (total < 300) fails.push(`총 ${total}문항 < 300`);
warn.forEach((w) => console.log('WARN', w));
if (fails.length) { fails.forEach((f) => console.log('FAIL', f)); console.log(`실패 ${fails.length}건`); process.exit(1); }
console.log('문제은행 검사 통과');
