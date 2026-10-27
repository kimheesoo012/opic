// 문제은행 형식 검사. 앱 시작 시(문제가 있는 항목은 제외)와 Node 테스트에서 함께 쓴다.

const SINGLE_PARTS = [1, 2, 5];
const SET_PARTS = [3, 4, 6, 7];

export function normText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/-{3,}/g, ' blank ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(s) {
  return new Set(normText(s).split(' ').filter((w) => w.length > 2));
}

export function jaccard(a, b) {
  const A = wordSet(a);
  const B = wordSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

function isStr(x, min = 1) {
  return typeof x === 'string' && x.trim().length >= min;
}

// 한 문항 검사. errs 배열에 메시지를 추가한다.
export function validateQuestion(q, unit, conceptIds, errs) {
  const where = `${q && q.id ? q.id : unit.id}`;
  const e = (m) => errs.push(`${where}: ${m}`);
  if (!q || typeof q !== 'object') return e('문항 객체 없음');
  if (!isStr(q.id)) e('id 누락');
  if (!isStr(q.type)) e('type 누락');
  if (!isStr(q.concept)) e('concept 누락');
  else if (conceptIds && !conceptIds.has(q.concept)) e(`알 수 없는 concept ${q.concept}`);
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 3) e('difficulty는 1~3 정수');
  const nChoices = unit.part === 2 ? 3 : 4;
  if (!Array.isArray(q.choices) || q.choices.length !== nChoices) {
    e(`선택지는 ${nChoices}개여야 함`);
  } else {
    if (q.choices.some((c) => !isStr(c))) e('빈 선택지');
    const normed = q.choices.map((c) => normText(c));
    if (new Set(normed).size !== normed.length) e('중복 선택지');
  }
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= nChoices) e('정답 인덱스가 선택지 범위 밖');
  const ex = q.explanation;
  if (!ex || !isStr(ex.why, 15)) e('정답 해설(why) 부족');
  if (!ex || !Array.isArray(ex.traps) || ex.traps.length !== nChoices) {
    e('오답별 해설(traps) 개수 불일치');
  } else {
    ex.traps.forEach((t, i) => {
      if (i === q.answer) {
        if (t !== null) e('정답 위치의 traps는 null이어야 함');
      } else if (!isStr(t, 8)) e(`오답 ${'ABCD'[i]} 해설 누락`);
    });
  }
  if (q.vocab !== undefined) {
    if (!Array.isArray(q.vocab)) e('vocab은 배열');
    else q.vocab.forEach((v) => { if (!v || !isStr(v.w) || !isStr(v.m)) e('vocab 항목에 w/m 누락'); });
  }
  if (q.para !== undefined) {
    if (!Array.isArray(q.para)) e('para는 배열');
    else q.para.forEach((p) => { if (!p || !isStr(p.p) || !isStr(p.a)) e('para 항목에 p/a 누락'); });
  }
  if ([5, 7].includes(unit.part) || (unit.part >= 3 && unit.part <= 4)) {
    if (!isStr(q.question)) e('문제 문장 누락');
  }
  if (unit.part === 5 && isStr(q.question) && !q.question.includes('-------')) e('Part 5 빈칸(-------) 없음');
  if (unit.part === 6) {
    if (!Number.isInteger(q.blank)) e('Part 6 문항에 blank 번호 없음');
  }
  if (unit.part === 7 && q.type === 'insert') {
    if (!isStr(q.sentence)) e('문장 삽입 문항에 sentence 없음');
  }
  if ((unit.part === 3 || unit.part === 4) && q.type === 'graphic' && !unit.graphic) e('시각 자료 문항인데 graphic 없음');
}

export function validateUnit(u, conceptIds) {
  const errs = [];
  const e = (m) => errs.push(`${u && u.id}: ${m}`);
  if (!u || typeof u !== 'object') return ['unit 없음'];
  if (!isStr(u.id)) e('id 누락');
  if (![1, 2, 3, 4, 5, 6, 7].includes(u.part)) e('part 범위 오류');
  if (SINGLE_PARTS.includes(u.part)) {
    validateQuestion(u, u, conceptIds, errs);
    if (u.part === 1) {
      if (!u.image || !isStr(u.image.svg) || !u.image.svg.trim().startsWith('<svg')) e('Part 1 SVG 없음');
      if (!u.image || !isStr(u.image.alt)) e('Part 1 장면 설명(alt) 없음');
    }
    if (u.part === 2) {
      if (!isStr(u.question)) e('Part 2 질문 문장 없음');
    }
  } else if (SET_PARTS.includes(u.part)) {
    if (!Array.isArray(u.questions) || !u.questions.length) return [...errs, `${u.id}: questions 없음`];
    if ((u.part === 3 || u.part === 4) && u.questions.length !== 3) e('Part 3/4 세트는 3문항');
    if (u.part === 6 && u.questions.length !== 4) e('Part 6 세트는 4문항');
    if (u.part === 3 || u.part === 4) {
      if (!Array.isArray(u.script) || u.script.length < 2) e('스크립트 없음');
      else {
        const sp = u.speakers || {};
        u.script.forEach((l, i) => {
          if (!l || !isStr(l.t)) e(`스크립트 ${i}행 비어 있음`);
          else if (!sp[l.s]) e(`스크립트 ${i}행 화자 ${l.s} 정보 없음`);
        });
      }
    }
    if (u.part === 6 || u.part === 7) {
      if (!Array.isArray(u.passages) || !u.passages.length || u.passages.some((p) => !isStr(p.text, 40))) e('지문 없음');
    }
    if (u.part === 6 && Array.isArray(u.passages)) {
      const text = u.passages.map((p) => p.text).join('\n');
      u.questions.forEach((q) => {
        if (Number.isInteger(q.blank) && !text.includes(`{{${q.blank}}}`)) e(`지문에 {{${q.blank}}} 표시 없음`);
      });
    }
    if (u.part === 7 && Array.isArray(u.passages)) {
      const n = u.passages.length;
      if (n > 3) e('지문은 최대 3개');
      if (n >= 2 && u.questions.length !== 5) e('이중·삼중 지문 세트는 5문항');
      if (n === 1 && (u.questions.length < 2 || u.questions.length > 4)) e('단일 지문 세트는 2~4문항');
      const text = u.passages.map((p) => p.text).join('\n');
      if (u.questions.some((q) => q.type === 'insert')) {
        for (const m of ['[1]', '[2]', '[3]', '[4]']) if (!text.includes(m)) e(`문장 삽입 위치 ${m} 없음`);
      }
    }
    const qids = new Set();
    u.questions.forEach((q) => {
      if (qids.has(q.id)) e(`세트 내 중복 문항 id ${q.id}`);
      qids.add(q.id);
      validateQuestion(q, u, conceptIds, errs);
    });
  }
  return errs;
}

// 전체 은행 검사: 형식 + id 중복 + (거의) 같은 문제 중복
export function validateBank(units, concepts) {
  const conceptIds = new Set((concepts || []).map((c) => c.id));
  const errors = [];
  const warnings = [];
  const unitIds = new Set();
  const qIds = new Set();
  const bad = new Set();
  for (const u of units) {
    const errs = validateUnit(u, conceptIds);
    if (unitIds.has(u.id)) errs.push(`${u.id}: unit id 중복`);
    unitIds.add(u.id);
    const qs = u.questions || [u];
    for (const q of qs) {
      if (u.questions) {
        if (qIds.has(q.id)) errs.push(`${q.id}: 문항 id 중복`);
        qIds.add(q.id);
      }
    }
    if (errs.length) {
      bad.add(u.id);
      errors.push(...errs);
    }
  }
  // 중복 문제 검사: 같은 파트의 문제 문장/지문이 (거의) 같으면 중복으로 본다.
  const textOf = (u) => {
    if (u.part === 1) return (u.choices || []).join(' ');
    if (u.part === 2 || u.part === 5) return u.question;
    if (u.part === 3 || u.part === 4) return (u.script || []).map((l) => l.t).join(' ');
    return (u.passages || []).map((p) => p.text).join(' ');
  };
  const byPart = {};
  for (const u of units) (byPart[u.part] ||= []).push(u);
  for (const part of Object.keys(byPart)) {
    const list = byPart[part];
    const limit = Number(part) === 2 ? 0.75 : 0.7;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = textOf(list[i]);
        const b = textOf(list[j]);
        if (normText(a) === normText(b)) {
          errors.push(`${list[i].id} / ${list[j].id}: 같은 문제`);
          bad.add(list[j].id);
        } else {
          const sim = jaccard(a, b);
          if (sim >= limit) {
            errors.push(`${list[i].id} / ${list[j].id}: 같은 문장 틀 의심 (유사도 ${sim.toFixed(2)})`);
            bad.add(list[j].id);
          } else if (sim >= 0.5) warnings.push(`${list[i].id} / ${list[j].id}: 유사도 ${sim.toFixed(2)}`);
        }
      }
    }
  }
  return { errors, warnings, badUnitIds: bad };
}
