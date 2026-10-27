// 후리가나·학습 수준·쉬운 단어 숨기기·고유명사·저장 호환·장기 서사 검사
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VOCAB, REL } from '../src/data/vocab.js';
import { GRAMMAR } from '../src/data/grammar.js';
import { showRuby, allowedLevel, pickTargets, lvCode } from '../src/engine/learn.js';
import { makeQuestion, CONFUSABLE, questionKinds } from '../src/engine/study.js';
import { rubyName } from '../src/engine/text.js';
import { PEOPLE, ROLES } from '../src/engine/world.js';
import * as G from '../src/engine/core.js';
import { processTemplate } from '../tools/gen-lines.mjs';

const LINES = JSON.parse(fs.readFileSync(new URL('../src/gen/lines.json', import.meta.url), 'utf8'));
const N2 = { studyLevel: 'n2', hideEasy: true };

test('어휘 DB: 모든 단어에 읽기·뜻·예문·수준이 있고 읽기는 가나', () => {
  for (const [k, v] of Object.entries(VOCAB)) {
    assert.match(v.r, /^[ぁ-ゖァ-ヶー・]+$/, `${k} 읽기 ${v.r}`);
    assert.ok(v.m && v.ex && v.exk, k);
    assert.ok(['N5', 'N4', 'N3', 'N2', 'N1', '범위 밖'].includes(v.lv), `${k} 수준 ${v.lv}`);
    assert.ok(v.ex.replace(/[[\]]/g, '').includes(k[0]), `${k}: 예문에 단어가 없음`);
  }
});

test('중복 학습 데이터 없음: 어휘 파일끼리 같은 표제어가 없고, 문법 키와 겹치지 않는다', () => {
  const keys = new Map();
  for (const f of ['vocab_general.js', 'vocab_n2.js', 'vocab_kendo.js']) {
    const src = fs.readFileSync(new URL('../src/data/' + f, import.meta.url), 'utf8');
    for (const m of src.matchAll(/^ {2}([^\s:'/]+): \[/gm)) {
      assert.ok(!keys.has(m[1]), `${m[1]}: ${keys.get(m[1])}와 ${f}에 중복`);
      keys.set(m[1], f);
    }
  }
  // 문법과 어휘는 id가 다르다(g: / v:). 같은 글자(例: 以上)가 양쪽에 있어도 서로 다른 항목이다.
  const gsrc = fs.readFileSync(new URL('../src/data/grammar.js', import.meta.url), 'utf8');
  const gkeys = [...gsrc.slice(0, gsrc.indexOf('export const GRAMMAR_KEYS')).matchAll(/^ {2}'?([^\s:']+)'?: \{/gm)].map((m) => m[1]);
  assert.equal(new Set(gkeys).size, gkeys.length, '문법 키 중복');
});

test('관련 표현은 모두 어휘 DB에 있는 말 (읽기·뜻을 보여 줄 수 있다)', () => {
  for (const [k, list] of Object.entries(REL)) for (const w of list) assert.ok(VOCAB[w], `${k} → ${w}`);
});

test('문법 DB: 표현·뜻·접속·차이·주의할 점이 모두 있다', () => {
  for (const [k, g] of Object.entries(GRAMMAR)) for (const f of ['f', 'm', 'c', 'd', 'w']) assert.ok(g[f] && g[f].length >= 3, `${k}.${f}`);
});

test('후리가나 표시 방식', () => {
  // N2 이상 어휘만
  assert.equal(showRuby('n2', '2'), true);
  assert.equal(showRuby('n2', '1'), true);
  assert.equal(showRuby('n2', 'K'), true);
  assert.equal(showRuby('n2', '3'), false);
  assert.equal(showRuby('n2', '4'), false);
  assert.equal(showRuby('n2', '5'), false);
  // 어려운 한자·고유명사만
  assert.equal(showRuby('hard', '3', { hardKanji: true }), true);
  assert.equal(showRuby('hard', '2', { hardKanji: false }), false);
  assert.equal(showRuby('hard', 'P'), true);
  // 항상 / 끄기
  for (const lv of ['5', '3', '2', 'K', 'P']) {
    assert.equal(showRuby('always', lv), true);
    assert.equal(showRuby('off', lv, { first: true }), false);
  }
  // 고유명사: 처음엔 보이고, 그 뒤로는 설정을 따른다
  assert.equal(showRuby('n2', 'P', { first: true }), true);
  assert.equal(showRuby('n2', 'P', { first: false }), false);
});

test('생성된 루비 조각: 쉬운 말은 N2 모드에서 읽기가 숨는다 (今日・ご飯 / 稽古)', () => {
  const segs = processTemplate('今日は稽古が終わったら、みんなでご飯を食べに行こう。', 'test');
  const ruby = (seg) => (Array.isArray(seg) ? [seg] : seg && seg.s ? seg.s.filter(Array.isArray) : []);
  const items = segs.flatMap(ruby);
  const shown = items.filter((it) => showRuby('n2', it[2], { hardKanji: !!it[3] })).map((it) => it[0]);
  assert.ok(shown.includes('稽古'), `稽古 읽기 표시: ${shown}`);
  for (const easy of ['今日', '終', '食', '行', '飯']) assert.ok(!shown.includes(easy), `${easy}에 읽기가 붙음: ${shown}`);
});

test('쉬운 단어 학습 표시 끄기와 학습 수준', () => {
  // N2 학습자: N5·N4는 강조하지 않고, N3·N2·N1은 강조한다
  assert.equal(allowedLevel('5', N2), false);
  assert.equal(allowedLevel('4', N2), false);
  assert.equal(allowedLevel('3', N2), true);
  assert.equal(allowedLevel('2', N2), true);
  assert.equal(allowedLevel('1', N2), true);
  // 끄면 모두 강조
  assert.equal(allowedLevel('5', { studyLevel: 'n2', hideEasy: false }), true);
  // N5~N4 기초 학습자는 기초 단어도 강조
  assert.equal(allowedLevel('5', { studyLevel: 'n5', hideEasy: true }), true);
  // N1 학습자에게 N3은 쉬운 말
  assert.equal(allowedLevel('3', { studyLevel: 'n1', hideEasy: true }), false);
  // 직접 선택
  assert.equal(allowedLevel('4', { studyLevel: 'custom', customLevels: ['4'] }), true);
  assert.equal(allowedLevel('2', { studyLevel: 'custom', customLevels: ['4'] }), false);
  // 실제 장면: 쉬운 낱말은 학습 대상이 되지 않는다
  const segs = [[{ v: '今日', s: ['今日'] }, { v: '稽古', s: ['稽古'] }]];
  const easy = Object.keys(VOCAB).find((k) => VOCAB[k].lv === 'N4');
  const t = pickTargets([[{ v: easy, s: [easy] }, ...segs[0]]], N2);
  assert.ok(!t.includes('v:' + easy), `쉬운 낱말 ${easy}가 대상: ${t}`);
  // 문장에서 낱말 자체는 지워지지 않는다 (대상이 아닐 뿐)
  assert.ok(segs[0].length === 2);
});

test('한 장면의 학습 대상: 보통 3개 이하, 학습 집중 모드 6개 이하, 수준에 맞는 것만', () => {
  for (const segs of Object.values(LINES.lines)) {
    const t = pickTargets([segs], N2);
    assert.ok(t.length <= 3);
    for (const id of t) {
      const code = lvCode(id[0] === 'g' ? GRAMMAR[id.slice(2)].lv : VOCAB[id.slice(2)].lv);
      assert.ok(['3', '2', '1', 'K'].includes(code), `${id} ${code}`);
    }
    assert.ok(pickTargets([segs], { ...N2, focus: true }).length <= 6);
  }
});

test('고유명사 읽기: 모든 인물 이름의 한자에 읽기가 붙는다', () => {
  for (const [id, p] of Object.entries(PEOPLE)) {
    for (const str of [p.s, p.g, p.call, p.c].filter(Boolean)) {
      const parts = rubyName(str);
      const bare = parts.filter((x) => typeof x === 'string').join('');
      assert.ok(!/[一-鿿]/.test(bare.replace(/[先生]/g, '')), `${id}: 「${str}」 읽기 없는 한자 ${bare}`);
      for (const x of parts) if (Array.isArray(x)) assert.match(x[1], /^[ぁ-ゖ]+$/, `${str} ${x}`);
    }
  }
  assert.deepEqual(rubyName('鷲尾先生'), [['鷲尾先生', 'わしおせんせい']]);
});

test('복습 문제: 새 유형(일본어 고르기·문맥·문법 구별)도 정답은 하나, 정답만 튀지 않는다', () => {
  let longest = 0;
  let shortest = 0;
  let total = 0;
  for (const k of Object.keys(VOCAB)) {
    for (const kind of ['word', 'context', 'meaning']) {
      const q = makeQuestion('v:' + k, 'z', null, { kind, hasScene: true });
      assert.equal(q.options.length, 4, `${k} ${kind}`);
      assert.equal(new Set(q.options).size, 4, `${k} ${kind} ${q.options}`);
      if (q.kind === 'word') {
        assert.equal(q.options[q.answer], k);
        // 오답 낱말의 뜻이 정답 뜻과 겹치지 않는다
        const parts = (m) => m.split(/[,，·()（）/]/).map((x) => x.trim()).filter(Boolean);
        for (const o of q.options) if (o !== k) assert.ok(!parts(VOCAB[o].m).some((p) => parts(VOCAB[k].m).includes(p)), `${k}: ${o}`);
      }
      const lens = q.options.map((o) => o.length);
      if (lens[q.answer] > Math.max(...lens.filter((_, i) => i !== q.answer))) longest++;
      if (lens[q.answer] < Math.min(...lens.filter((_, i) => i !== q.answer))) shortest++;
      total++;
    }
  }
  console.log(`  정답이 혼자 가장 긴 문제 ${((longest / total) * 100).toFixed(1)}%, 혼자 가장 짧은 문제 ${((shortest / total) * 100).toFixed(1)}%`);
  assert.ok(longest / total < 0.3 && shortest / total < 0.3);
  for (const k of Object.keys(GRAMMAR)) {
    const q = makeQuestion('g:' + k, 'z', null, { kind: 'gform' });
    assert.equal(new Set(q.options).size, 4, k);
    assert.equal(q.options[q.answer], GRAMMAR[k].f);
    const group = new Set(CONFUSABLE.filter((g) => g.includes(k)).flat());
    for (const o of q.options) if (o !== GRAMMAR[k].f) assert.ok(![...group].some((x) => GRAMMAR[x] && GRAMMAR[x].f === o), `${k}: 헷갈리는 묶음 ${o}`);
  }
});

test('읽기 문제는 진짜 함정이 셋 이상일 때만 낸다', () => {
  for (const k of Object.keys(VOCAB)) {
    if (!questionKinds('v:' + k).includes('reading')) continue;
    const q = makeQuestion('v:' + k, 'r', null, { kind: 'reading' });
    assert.equal(q.kind, 'reading');
    for (const o of q.options) if (o !== VOCAB[k].r) assert.ok(!Object.values(VOCAB).some((v) => v.r === o), `${k}: 오답 ${o}가 다른 낱말의 읽기`);
  }
});

function randomPlay(seed, manualRate) {
  const s = G.newLife({ seed });
  G.beginLife(s);
  let r = 1;
  const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let guard = 0; guard < 4000 && s.phase !== 'farewell'; guard++) {
    if (s.phase === 'season') {
      if (G.hasEvent(s)) G.nextEvent(s);
      else G.endSeason(s);
    } else if (s.phase === 'event') {
      const v = G.view(s);
      const ok = v.choices.filter((c) => c.ok);
      const i = ok.length && rnd() < manualRate ? ok[Math.floor(rnd() * ok.length)].i : G.autoChoice(s);
      G.choose(s, i, false);
    } else if (s.phase === 'result') G.ack(s);
    else if (s.phase === 'word') G.setWord(s, rnd() < manualRate ? '직접 쓴 말' : G.autoWord(s), false);
  }
  return s;
}

test('수동 선택과 오토가 섞인 플레이 120판: 모두 정상 종료, 장기 서사가 중간에 끊기지 않는다', () => {
  const CH = G.debug.CHAPTERS;
  for (let i = 0; i < 120; i++) {
    const s = randomPlay('mix' + i, i % 3 === 0 ? 0.9 : 0.5);
    assert.equal(s.phase, 'farewell', `seed mix${i} 종료 안 됨 (${s.phase}, t=${s.t})`);
    G.finish(s, '고마워');
    assert.ok(s.summary.years >= 10);
    for (const role of ROLES) {
      const list = CH[role] || [];
      const seenIdx = list.map((c, j) => (s.seen[c.id] !== undefined ? j : -1)).filter((j) => j >= 0);
      if (!seenIdx.length) continue;
      const last = Math.max(...seenIdx);
      for (let j = 0; j < last; j++) {
        const c = list[j];
        assert.ok(s.seen[c.id] !== undefined || c.skip || c.chainOnly, `${role}: ${c.id}를 건너뛰고 ${list[last].id}로 감 (seed mix${i})`);
      }
    }
  }
});

test('이어지는 이야기: 앞의 선택이 뒤의 사건을 부른다', () => {
  const s = G.newLife({ seed: 'chain' });
  G.beginLife(s);
  s.t = 12;
  s.queue = ['c_slipper1'];
  G.nextEvent(s);
  G.choose(s, 0, false); // 죽도 가방에 숨긴다 → 다음 계절 c_slipper2
  assert.ok(s.flags.slipper_bag !== undefined);
  assert.ok(s.sched.some((x) => x.id === 'c_slipper2'));
});

test('옛 저장 데이터: 1판 설정·상태를 그대로 불러온다', async () => {
  const { migrateSettings } = await import('../src/ui/store.js');
  const old = migrateSettings({ speed: 4, auto: true, autoMode: 'all', furigana: 'hard', sound: false });
  assert.equal(old.furigana, 'n2');
  assert.equal(old.speed, 4);
  assert.equal(old.studyLevel, 'n2');
  assert.equal(old.hideEasy, true);
  const kept = migrateSettings({ furigana: 'always', v: 2 });
  assert.equal(kept.furigana, 'always');
  const v2hard = migrateSettings({ furigana: 'hard', v: 2 });
  assert.equal(v2hard.furigana, 'hard');
  // 새 필드가 없는 옛 견생 상태도 계속 진행된다
  const s = G.newLife({ seed: 'old' });
  G.beginLife(s);
  delete s.met;
  delete s.seenNames;
  const back = JSON.parse(JSON.stringify(s));
  for (let i = 0; i < 40 && back.phase !== 'farewell'; i++) {
    if (back.phase === 'season') (G.hasEvent(back) ? G.nextEvent(back) : G.endSeason(back));
    else if (back.phase === 'event') G.choose(back, G.autoChoice(back), true);
    else if (back.phase === 'result') G.ack(back);
    else if (back.phase === 'word') G.setWord(back, G.autoWord(back), true);
  }
  assert.ok(back.t > 0);
});
