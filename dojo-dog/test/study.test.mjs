// N2 학습 데이터와 복습 퀴즈 검사
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VOCAB } from '../src/data/vocab.js';
import { GRAMMAR } from '../src/data/grammar.js';
import { ALL_EVENTS } from '../src/data/index.js';
import { makeQuestion, makeSet, meet, grade, dueIds, mastered, progress, readingTraps, DAY, SRS_DAYS } from '../src/engine/study.js';

const LINES = JSON.parse(fs.readFileSync(new URL('../src/gen/lines.json', import.meta.url), 'utf8'));
const HIRA = /^[ぁ-ゖー]+$/;

test('문법 DB 형식: 표기·뜻·접속·차이·수준·빈칸 문제', () => {
  const keys = Object.keys(GRAMMAR);
  assert.ok(keys.length >= 45, `문법 ${keys.length}개`);
  for (const [k, g] of Object.entries(GRAMMAR)) {
    for (const f of ['f', 'm', 'c', 'd', 'lv']) assert.ok(typeof g[f] === 'string' && g[f].length > 1, `${k}.${f}`);
    assert.ok(['N2', 'N3'].includes(g.lv), `${k} 수준`);
    assert.match(g.f, /^～/, `${k} 표기`);
    const [stem, ans, wrong, explain] = g.q;
    assert.equal((stem.match(/＿＿/g) || []).length, 1, `${k}: 빈칸은 하나`);
    assert.ok(/[。？！]$/.test(stem), `${k}: 문장 끝`);
    assert.equal(wrong.length, 3, `${k}: 오답 3개`);
    assert.equal(new Set([ans, ...wrong]).size, 4, `${k}: 선택지 중복`);
    assert.ok(!wrong.includes(ans), `${k}: 오답에 정답`);
    assert.ok(explain.length > 20 && /[가-힣]/.test(explain), `${k}: 해설`);
    // 정답이 이 문법의 형태다 (표기와 두 글자 이상 또는 한자가 겹친다)
    const overlap = [...ans].some((ch, n) => g.f.includes(ans.slice(n, n + 2)) && n < ans.length - 1) || [...ans].some((ch) => /[一-鿿]/.test(ch) && g.f.includes(ch));
    assert.ok(overlap, `${k}: 정답 「${ans}」이 「${g.f}」와 맞지 않음`);
  }
});

test('문법은 모두 게임 대사에 쓰이고, 대사 속 문법 표시는 DB를 가리킨다', () => {
  for (const k of Object.keys(GRAMMAR)) assert.ok(LINES.gidx[k], `대사에 안 나오는 문법: ${k}`);
  for (const [tpl, segs] of Object.entries(LINES.lines)) for (const s of segs) if (s && s.g) assert.ok(GRAMMAR[s.g], `${tpl}: ${s.g}`);
  // 표시한 표면 글자가 원문과 같다 (생성기가 구간을 넓히거나 줄이지 않는다)
  for (const [tpl, segs] of Object.entries(LINES.lines)) {
    const marks = [...tpl.matchAll(/〘([^|〙]+)\|([^〙]+)〙/g)];
    const gs = segs.filter((s) => s && s.g);
    assert.equal(gs.length, marks.length, `문법 표시 수: ${tpl}`);
    gs.forEach((s, i) => {
      const surf = s.s.map((x) => (Array.isArray(x) ? x[0] : x)).join('');
      assert.equal(surf, marks[i][1].replace(/\[([^\]|]+)(\|[^\]]+)?\]/g, '$1'), tpl);
    });
  }
});

test('N2 학습 항목이 들어간 이벤트 비율', () => {
  const linesOf = (e) => {
    const out = [];
    const walk = (ls) => { for (const l of ls || []) { if (Array.isArray(l)) out.push(l[1]); else if (l) { walk(l.l); walk(l.else); } } };
    const wo = (o) => { if (!o) return; walk(o.lines); if (o.check) { wo(o.check.ok); wo(o.check.ng); } };
    walk(e.lines);
    for (const c of e.choices || []) wo(c);
    wo(e.brief);
    return out;
  };
  // 문법을 억지로 넣지 않는다: 짧은 구령·사투리 장면은 학습 항목이 없어도 된다
  const hasN2 = (t) => (LINES.lines[t] || []).some((s) => s && ((s.g && GRAMMAR[s.g].lv === 'N2') || (s.v && VOCAB[s.v] && VOCAB[s.v].lv === 'N2')));
  const hasN3up = (t) => (LINES.lines[t] || []).some((s) => s && (s.g || (s.v && VOCAB[s.v] && ['N3', 'N2', 'N1'].includes(VOCAB[s.v].lv))));
  const evs = ALL_EVENTS.filter((e) => linesOf(e).length);
  const ok = evs.filter((e) => linesOf(e).some(hasN2));
  const ok3 = evs.filter((e) => linesOf(e).some(hasN3up));
  const n2v = new Set();
  const n2g = new Set();
  for (const segs of Object.values(LINES.lines)) for (const s of segs) {
    if (s && s.v && VOCAB[s.v]?.lv === 'N2') n2v.add(s.v);
    if (s && s.g && GRAMMAR[s.g].lv === 'N2') n2g.add(s.g);
  }
  console.log(`  대사가 있는 이벤트 ${evs.length}개 중 N2 항목 포함 ${ok.length}개, N3 이상 항목 포함 ${ok3.length}개 · 대사 속 N2 단어 ${n2v.size}개 · N2 문법 ${n2g.size}개 (N3 복습 문법 ${Object.values(GRAMMAR).filter((g) => g.lv === 'N3').length}개)`);
  // 84%: 사용자 요청으로 N2가 든 장면(r0)을 하나 뺀 뒤 191/225. 문법을 억지로 끼워 넣어 맞추지 않는다
  assert.ok(ok.length / evs.length >= 0.84);
  assert.ok(ok3.length / evs.length >= 0.92);
});

test('읽기 함정은 정답과 다르고 히라가나만', () => {
  for (const [k, v] of Object.entries(VOCAB)) {
    if (!HIRA.test(v.r)) continue;
    for (const t of readingTraps(v.r)) {
      assert.notEqual(t, v.r, k);
      assert.match(t, HIRA, `${k}: ${t}`);
    }
  }
});

test('복습 문제: 모든 항목·유형에서 4지선다, 정답 하나, 중복 없음', () => {
  const ids = [...Object.keys(VOCAB).map((k) => 'v:' + k), ...Object.keys(GRAMMAR).map((k) => 'g:' + k)];
  let n = 0;
  for (const id of ids) {
    for (const rec of [null, { ok: 1, ng: 0 }]) {
      const q = makeQuestion(id, 'seed', rec);
      assert.ok(q, id);
      n++;
      assert.equal(q.options.length, 4, `${id} ${q.kind}`);
      assert.equal(new Set(q.options).size, 4, `${id} ${q.kind}: ${q.options}`);
      assert.ok(q.answer >= 0 && q.answer < 4, id);
      const key = id.slice(2);
      if (q.kind === 'reading') {
        assert.equal(q.options[q.answer], VOCAB[key].r);
        assert.equal(q.options.filter((o) => o === VOCAB[key].r).length, 1);
      }
      if (q.kind === 'meaning') {
        assert.equal(q.options[q.answer], VOCAB[key].m);
        // 오답 뜻이 정답 뜻과 겹치지 않는다 (같은 낱말 조각 없음)
        const parts = (m) => m.split(/[,，·()（）/]/).map((x) => x.trim()).filter(Boolean);
        for (const o of q.options) if (o !== VOCAB[key].m) assert.ok(!parts(o).some((p) => parts(VOCAB[key].m).includes(p)), `${id}: ${o}`);
      }
      if (q.kind === 'grammar') assert.equal(q.options[q.answer], GRAMMAR[key].q[1]);
      assert.ok(q.explain && q.explain.length > 5);
    }
  }
  console.log(`  복습 문제 생성 검사: ${n}개 (단어 ${Object.keys(VOCAB).length} · 문법 ${Object.keys(GRAMMAR).length})`);
  assert.equal(makeSet(ids.slice(0, 30), 10, 'x').length, 10);
});

test('간격 반복: 1·3·7·14일, 두 번 연속 정답이면 익힘, 틀리면 처음부터', () => {
  const srs = {};
  const t0 = Date.UTC(2026, 0, 1);
  assert.ok(meet(srs, 'v:稽古', t0));
  assert.ok(!meet(srs, 'v:稽古', t0), '두 번 등록하지 않는다');
  assert.ok(!meet(srs, 'v:없는말', t0));
  assert.equal(dueIds(srs, t0).length, 0);
  assert.deepEqual(dueIds(srs, t0 + DAY), ['v:稽古']);
  let now = t0 + DAY;
  const gaps = [];
  for (let i = 0; i < 4; i++) {
    const r = grade(srs, 'v:稽古', true, now);
    gaps.push((r.due - now) / DAY);
    now = r.due;
  }
  assert.deepEqual(gaps, SRS_DAYS);
  assert.ok(mastered(srs['v:稽古']));
  grade(srs, 'v:稽古', false, now);
  assert.equal(srs['v:稽古'].streak, 0);
  assert.equal(srs['v:稽古'].due, now + DAY);
  assert.ok(!mastered(srs['v:稽古']));
  meet(srs, 'g:ざるを得ない', t0);
  grade(srs, 'g:ざるを得ない', true, t0);
  grade(srs, 'g:ざるを得ない', true, t0);
  const p = progress(srs);
  assert.equal(p.grammar, 1);
  assert.equal(p.grammarMastered, 1);
});
