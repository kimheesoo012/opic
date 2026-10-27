// 자동 테스트: 서로 다른 시드 300개 이상으로 오토 시뮬레이션 + 데이터·어휘 형식 검사 + 소요 시간 계산
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as G from '../src/engine/core.js';
import { ALL_EVENTS } from '../src/data/index.js';
import { VOCAB } from '../src/data/vocab.js';
import { SUB_TITLES } from '../src/data/subs.js';
import { STAT_KEYS, ROLES, personFor } from '../src/engine/world.js';
import { splitJa, splitKo, resolveKo, plainJa } from '../src/engine/text.js';
import { SEASON_MS, AUTO_WORD_MS, eventShowMs, resultShowMs } from '../src/engine/pace.js';
import { collect } from '../tools/collect.mjs';

const SEEDS = 320;
const LINES = JSON.parse(fs.readFileSync(new URL('../src/gen/lines.json', import.meta.url), 'utf8'));

function checkRanges(s, where) {
  for (const k of STAT_KEYS) assert.ok(Number.isInteger(s.st[k]) && s.st[k] >= 0 && s.st[k] <= 100, `${where}: 능력치 ${k}=${s.st[k]}`);
  for (const [k, v] of Object.entries(s.bond)) assert.ok(Number.isInteger(v) && v >= 0 && v <= 100, `${where}: 유대 ${k}=${v}`);
}

// 한 판을 끝까지 오토로 진행하고, 1배속 기준 소요 시간(ms)을 UI와 같은 규칙으로 더한다
function playLife(opts) {
  const s = G.newLife(opts);
  let ms = 0;
  let steps = 0;
  let seasonStarts = 0;
  const perSeason = new Map();
  while (s.phase !== 'ended') {
    steps++;
    assert.ok(steps < 5000, `${opts.seed}: 단계 수 초과 (무한 반복 의심) phase=${s.phase} t=${s.t}`);
    const phase = s.phase;
    if (phase === 'season' && !G.hasEvent(s)) {
      ms += SEASON_MS;
      seasonStarts++;
    }
    if (phase === 'event') ms += eventShowMs(G.view(s));
    if (phase === 'word') ms += AUTO_WORD_MS;
    G.stepAuto(s);
    if (phase === 'event' && s.res) ms += resultShowMs(s.res);
    if (phase === 'event') perSeason.set(s.t, (perSeason.get(s.t) || 0) + 1);
    checkRanges(s, `${opts.seed} t=${s.t}`);
  }
  return { s, ms, steps, seasonStarts, perSeason };
}

const lives = [];
test(`오토 시뮬레이션 ${SEEDS}개 시드: 모든 견생이 정상 종료`, () => {
  for (let i = 0; i < SEEDS; i++) {
    const r = playLife({ seed: 'seed-' + i });
    lives.push(r);
    const { s } = r;
    assert.equal(s.phase, 'ended');
    assert.ok(s.summary && s.summary.titles.length >= 1, '칭호');
    // 닥스훈트의 현실적인 수명 범위 (11~16년)
    assert.ok(s.t >= 44 && s.t <= 66, `수명 ${s.t}계절`);
    // 한 번만 일어나야 하는 이벤트가 두 번 이상 일어나지 않는다
    const count = {};
    for (const h of s.hist) if (!h.brief) count[h.id] = (count[h.id] || 0) + 1;
    for (const [id, n] of Object.entries(count)) {
      const e = G.EV.get(id);
      if (e.once !== false) assert.equal(n, 1, `${id}가 ${n}번 일어남`);
      else if (e.max) assert.ok(n <= e.max, `${id} ${n} > max ${e.max}`);
    }
    // 한 계절에 이벤트가 지나치게 몰리지 않는다
    for (const [t, n] of r.perSeason) assert.ok(n <= 9, `계절 ${t}에 이벤트 ${n}개`);
    // 고비 다섯 번 + 한마디
    for (const m of ['m_1', 'm_3', 'm_7', 'm_10', 'm_last']) assert.ok(s.seen[m] !== undefined, `${m} 누락`);
    assert.ok(s.words.length >= 5, '고비의 한마디');
    // 식구들 결과
    for (const role of ROLES) assert.ok(typeof s.summary.cast[role].epilogue === 'string');
  }
});

test('이어서 살아가는 세계: 3세대까지 정상 종료', () => {
  for (let i = 0; i < 40; i++) {
    let legacy = null;
    for (let gen = 1; gen <= 3; gen++) {
      const { s } = playLife({ seed: `legacy-${i}-${gen}`, world: legacy ? 'continue' : 'new', legacy });
      assert.equal(s.world.gen, gen);
      for (const role of ROLES) assert.ok(personFor(s.cast, role).call, `${gen}세대 ${role}`);
      const people = Object.values(s.cast);
      assert.equal(new Set(people).size, people.length, `${gen}세대: 한 사람이 두 역할`);
      legacy = G.legacyOf(s);
    }
  }
});

test('저장/불러오기: JSON 왕복 후에도 같은 결과', () => {
  const a = G.newLife({ seed: 'roundtrip' });
  const b = G.newLife({ seed: 'roundtrip' });
  let n = 0;
  while (a.phase !== 'ended') {
    G.stepAuto(a);
    const copy = JSON.parse(JSON.stringify(b));
    G.stepAuto(copy);
    Object.assign(b, copy);
    n++;
  }
  assert.equal(JSON.stringify(a.summary), JSON.stringify(b.summary));
  assert.ok(n > 100);
});

test('이벤트 데이터 형식', () => {
  const ids = new Set();
  const referenced = new Set();
  for (const e of ALL_EVENTS) {
    assert.ok(!ids.has(e.id), '중복 id ' + e.id);
    ids.add(e.id);
    // 뺀 장면: 진행 번호를 지키려고 자리만 남긴 것. 절대 나오지 않아야 한다
    if (e.removed) {
      assert.ok(e.skip && e.req && !e.req({}), e.id + ' 뺀 장면은 늘 건너뛴다');
      continue;
    }
    assert.ok(e.title, e.id + ' 제목');
    assert.ok(['daily', 'kendo', 'sub', 'iincho', 'cast', 'milestone', 'hub'].includes(e.cat), e.id + ' 분류');
    for (const c of e.choices || []) {
      assert.ok(c.t && c.tag, `${e.id} 선택지 형식`);
      for (const k of ['next', 'later']) for (const x of [].concat(c[k] || [], (c.check && [].concat(c.check.ok?.[k] || [], c.check.ng?.[k] || [])) || [])) if (typeof x === 'string') referenced.add(x);
      if (c.later) for (const l of Array.isArray(c.later[0]) ? c.later : [c.later]) referenced.add(l[0]);
      for (const br of [c.check?.ok, c.check?.ng]) if (br?.later) for (const l of Array.isArray(br.later[0]) ? br.later : [br.later]) referenced.add(l[0]);
    }
    if (e.brief?.later) referenced.add(e.brief.later[0]);
    if (e.choices && e.choices.length) assert.ok(e.choices.some((c) => !c.req), `${e.id}: 조건 없는 선택지가 하나는 있어야 함`);
    // 선택에 따라 결과가 반드시 달라진다
    if (e.choices && e.choices.length >= 2) {
      const sig = e.choices.map((c) => JSON.stringify([c.fx, c.set, c.cnt, c.ach, c.check && 'check', c.later, c.next, c.pool, c.mini]));
      assert.equal(new Set(sig).size, sig.length, `${e.id}: 효과가 같은 선택지가 있음`);
    }
  }
  for (const r of referenced) assert.ok(ids.has(r), '없는 이벤트 참조: ' + r);
  // 연결로만 열리는 사건은 어딘가에서 참조된다
  const pools = new Set(ALL_EVENTS.flatMap((e) => (e.choices || []).map((c) => c.pool)).filter(Boolean));
  for (const e of ALL_EVENTS.filter((x) => x.chainOnly && !['a_arrive', 'l_intro', 'x_back_vet', 'x_back_vet2', 'i_final'].includes(x.id))) assert.ok(referenced.has(e.id), '도달 불가: ' + e.id);
  for (const e of ALL_EVENTS.filter((x) => x.pool)) assert.ok(pools.has(e.pool), '쓰이지 않는 풀: ' + e.pool);
  for (const e of ALL_EVENTS.filter((x) => x.sub)) assert.ok(SUB_TITLES[e.sub], '서브스토리 제목 없음: ' + e.sub);
  for (const id of Object.keys(SUB_TITLES)) assert.ok(ALL_EVENTS.some((e) => (e.choices || []).some((c) => c.clear === id || c.check?.ok?.clear === id || c.check?.ng?.clear === id)), '클리어되지 않는 서브스토리: ' + id);
});

test('텍스트 자리표시자와 조사, 대사 형식', () => {
  const s = G.newLife({ seed: 'text' });
  const { ja, ko } = collect();
  for (const [tpl, where] of ja) {
    for (const seg of splitJa(tpl)) if (seg.k === 'p') assert.ok(['N', 'P', 'T', 'S', 'SH', 'RV', 'D', 'BG', 'Y', 'I', 'iincho', ...ROLES].includes(seg.key), `${where}: 알 수 없는 자리표시자 {${seg.key}}`);
    assert.ok(!/[{}]/.test(plainJa(tpl, { s })), `${where}: 풀리지 않은 자리표시자 ${tpl}`);
    assert.ok(!/[가-힣]/.test(tpl.replace(/「[^」]*」/g, '')), `${where}: 일본어 대사에 한글이 섞임: ${tpl}`);
  }
  for (const [t, where] of ko) {
    if (typeof t !== 'string') continue;
    const out = resolveKo(t, { s });
    assert.ok(!/\{[A-Za-z]/.test(out), `${where}: 풀리지 않은 자리표시자 ${t}`);
    assert.ok(!/\}(이|가|은|는|을|를)[ .,!?]/.test(t), `${where}: 조사를 자리표시자 밖에 직접 씀: ${t}`);
  }
  for (const e of ALL_EVENTS) {
    const all = [];
    const walk = (ls) => (ls || []).forEach((l) => (Array.isArray(l) ? all.push(l) : l && (walk(l.l), walk(l.else))));
    walk(e.lines);
    for (const c of e.choices || []) walk(c.lines), walk(c.check?.ok?.lines), walk(c.check?.ng?.lines);
    for (const l of all) {
      assert.equal(l.length, 3, `${e.id}: 대사는 [화자, 일본어, 한국어]`);
      assert.ok(l[0].startsWith('@') || l[0] === 'dog' || ROLES.includes(l[0]) || l[0] === 'iincho', `${e.id}: 화자 ${l[0]}`);
    }
  }
});

test('어휘 데이터베이스 형식 (300단어 이상)', () => {
  const keys = Object.keys(VOCAB);
  assert.ok(keys.length >= 300, `어휘 ${keys.length}개`);
  const LV = ['N5', 'N4', 'N3', 'N2', 'N1', '범위 밖'];
  const POS = ['n', 'v', 'a', 'na', 'adv', 'exp'];
  for (const k of keys) {
    const v = VOCAB[k];
    assert.match(v.r, /^[ぁ-んァ-ヶー]+$/, `${k}: 읽기는 가나로만`);
    assert.ok(v.m && /[가-힣]/.test(v.m), `${k}: 한국어 뜻`);
    assert.ok(v.ex && /[ぁ-んァ-ヶ一-龯]/.test(v.ex) && /[。！？」]$/.test(v.ex), `${k}: 일본어 예문 ${v.ex}`);
    assert.ok(v.exk && /[가-힣]/.test(v.exk), `${k}: 예문 번역`);
    assert.ok(LV.includes(v.lv), `${k}: 추정 수준 ${v.lv}`);
    assert.ok(POS.includes(v.pos), `${k}: 품사 ${v.pos}`);
    if (v.k) assert.ok(v.note && /[가-힣]/.test(v.note), `${k}: 검도 용어 설명`);
    // 예문에 표제어(또는 활용 어간)가 들어 있다
    const stem = v.pos === 'v' || v.pos === 'a' ? k.slice(0, Math.max(1, k.length - 1)) : k;
    assert.ok(v.ex.includes(stem) || v.ex.includes(v.r.slice(0, -1)), `${k}: 예문에 단어가 없음 (${v.ex})`);
  }
});

test('대사 조각(루비·학습 단어)이 모든 대사를 덮고, 사전에 없는 단어를 가리키지 않는다', () => {
  const { ja, ko } = collect();
  for (const tpl of ja.keys()) assert.ok(LINES.lines[tpl], '생성되지 않은 대사: ' + tpl + ' (node tools/gen-lines.mjs 실행 필요)');
  const walk = (segs, where) => {
    for (const x of segs) {
      if (x && x.v) assert.ok(VOCAB[x.v], `${where}: 사전에 없는 단어 ${x.v}`);
      if (Array.isArray(x)) assert.match(x[1], /^[ぁ-んァ-ヶー]+$/, `${where}: 읽기 ${x}`);
    }
  };
  for (const [tpl, segs] of Object.entries(LINES.lines)) walk(segs, tpl);
  for (const [w, segs] of Object.entries(LINES.ex)) walk(segs, w);
  for (const [t, where] of ko) if (typeof t === 'string') for (const seg of splitKo(t)) if (seg.k === 'v') assert.ok(VOCAB[seg.key], `${where}: 《${seg.key}》가 사전에 없음`);
  const used = new Set();
  for (const segs of Object.values(LINES.lines)) for (const x of segs) if (x && x.v) used.add(x.v);
  for (const [t] of ko) if (typeof t === 'string') for (const seg of splitKo(t)) if (seg.k === 'v') used.add(seg.key);
  console.log(`  학습 단어로 등장하는 어휘: ${used.size} / ${Object.keys(VOCAB).length}`);
  assert.ok(used.size >= 300, `게임 안에서 탭할 수 있는 단어 ${used.size}개`);
});

test('분량과 소요 시간 보고', () => {
  const cat = (c) => ALL_EVENTS.filter((e) => e.cat === c).length;
  const kendo = ALL_EVENTS.filter((e) => e.cat === 'kendo' || (e.cat === 'cast' && e.kendo)).length;
  const subs = Object.keys(SUB_TITLES).length;
  const iincho = ALL_EVENTS.filter((e) => e.cat === 'iincho').length;
  const daily = cat('daily');
  console.log(`  일상 ${daily}, 검도 장면 ${kendo} (稽古·행사 ${cat('kendo')} + 식구 서사 속 검도 ${kendo - cat('kendo')}), 서브스토리 ${subs}개(${cat('sub')}단계), 委員長 ${iincho}화, 식구 서사 ${cat('cast')}장, 고비 ${cat('milestone')}, 허브 ${cat('hub')}, 어휘 ${Object.keys(VOCAB).length}`);
  assert.ok(daily >= 100 && kendo >= 40 && subs >= 20 && iincho >= 8);
  const mins = lives.map((l) => l.ms / 60000).sort((a, b) => a - b);
  const avg = mins.reduce((a, b) => a + b, 0) / mins.length;
  const ev = lives.reduce((a, l) => a + l.s.evCount, 0) / lives.length;
  const subsAvg = lives.reduce((a, l) => a + l.s.subs.length, 0) / lives.length;
  const seasons = lives.reduce((a, l) => a + l.s.t, 0) / lives.length;
  console.log(`  한 판(오토 全部おまかせ): 평균 ${seasons.toFixed(1)}계절, 이벤트 ${ev.toFixed(0)}개, 서브스토리 클리어 ${subsAvg.toFixed(1)}개`);
  console.log(`  1배속: 평균 ${avg.toFixed(1)}분 (최소 ${mins[0].toFixed(1)}, 최대 ${mins[mins.length - 1].toFixed(1)}) / 16배속: 평균 ${(avg / 16 * 60).toFixed(0)}초`);
  console.log(`  1배속 한 계절 평균 ${(lives.reduce((a, l) => a + l.ms / l.s.t, 0) / lives.length / 1000).toFixed(1)}초`);
  assert.ok(avg >= 12 && avg <= 25, `1배속 평균 ${avg.toFixed(1)}분`);
});

test('삭제한 이벤트(밤 11시의 장부 등) 도중에 저장한 견생도 이어서 할 수 있다', () => {
  const s = G.newLife({ seed: 'repair' });
  G.beginLife(s);
  s.cur = { id: 'o0', t: s.t };
  s.phase = 'event';
  s.queue = ['c_ledger', 'wsc_lunch', ...s.queue];
  s.sched.push({ id: 'c_ledger', t: s.t + 1 });
  const n = G.repairState(s);
  assert.ok(n >= 4, `고친 곳 ${n}`);
  assert.equal(s.phase, 'season');
  assert.ok(!s.queue.includes('c_ledger') && !s.sched.some((x) => x.id === 'c_ledger'));
  for (let i = 0; i < 20000 && s.phase !== 'ended'; i++) G.stepAuto(s);
  assert.equal(s.phase, 'ended');
});
