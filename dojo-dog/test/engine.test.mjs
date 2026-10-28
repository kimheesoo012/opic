// 문제 엔진 검사: 유형 섞기(L1)·읽기 오답의 그럴듯함(L2)·후리가나를 본 말은 읽기를 묻지 않음(L3)·학습 수준(L5)·읽기 해설(J5)·조사(J6)·문법 오답의 뜻 겹침(J10)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VOCAB } from '../src/data/vocab.js';
import { GRAMMAR } from '../src/data/grammar.js';
import { KANJI } from '../src/data/kanji.js';
import { makeSet, makeQuestion, questionKinds, readingOptions, readingCandidates, validKana, KIND_CAP, sameMeaning, sameGroup, BLANK_SET, blankOf } from '../src/engine/study.js';
import { readingDiff, readingCause, josa, pt, kanjiSplit, grammarByForm, vShort } from '../src/engine/explain.js';
import { chooseKind, buildQuestion } from '../src/engine/quizplan.js';
import { allowedLevel, lvCode, pickTargets } from '../src/engine/learn.js';

const LINES = JSON.parse(fs.readFileSync(new URL('../src/gen/lines.json', import.meta.url), 'utf8'));
const N2 = { studyLevel: 'n2', hideEasy: true };
const KANJI_WORDS = Object.keys(VOCAB).filter((k) => /[一-鿿]/.test(k) && /^[ぁ-ゖ]+$/.test(VOCAB[k].r));
const log = () => ({ scenes: 0, nextAt: 0, asked: [], recent: [], where: {}, lastCard: -99, seed: 't' });

// ───── L1 유형 섞기 ─────
test('L1: 복습 묶음은 한 유형이 35%를 넘지 않고 여러 유형이 섞인다', () => {
  const vids = KANJI_WORDS.filter((k) => questionKinds('v:' + k, { hasScene: true }).includes('reading')).slice(0, 40).map((k) => 'v:' + k);
  const gids = Object.keys(GRAMMAR).filter((k) => !GRAMMAR[k].x).slice(0, 10).map((k) => 'g:' + k);
  for (let s = 0; s < 8; s++) {
    for (const [ids, n] of [[vids, 10], [[...vids.slice(0, 20), ...gids], 10], [vids, 15]]) {
      const qs = makeSet(ids, n, 'bal' + s, {}, () => true);
      assert.equal(qs.length, n);
      const count = {};
      for (const q of qs) count[q.kind] = (count[q.kind] || 0) + 1;
      for (const [k, c] of Object.entries(count)) assert.ok(c <= KIND_CAP(n), `seed ${s}: ${k} ${c}/${n} (${JSON.stringify(count)})`);
      assert.ok(Object.keys(count).length >= 3, `seed ${s}: 유형이 ${Object.keys(count)}뿐`);
    }
  }
  // 읽기만 낼 수 있는 조건(일본어 몰입 + 어휘만)에서는 묶음이 비지 않는다
  assert.ok(makeSet(vids, 10, 'ja', {}, () => false, () => null, true).length === 10);
});

// ───── L2 읽기 오답 ─────
const BIG = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' };
test('L2: 모든 한자 어휘의 읽기 오답은 가나 규칙에 맞고, 정답·다른 낱말의 읽기가 아니며, 큰 글자 요음·ー가 없다', () => {
  const real = new Set(Object.values(VOCAB).map((v) => v.r));
  let withQ = 0;
  let onyomi = 0;
  for (const k of KANJI_WORDS) {
    const r = VOCAB[k].r;
    const opts = readingOptions(k, 'chk');
    assert.ok(opts.length <= 3);
    assert.equal(new Set(opts).size, opts.length, `${k}: 중복 ${opts}`);
    for (const o of opts) {
      assert.ok(validKana(o), `${k}: 있을 수 없는 가나 ${o}`);
      assert.notEqual(o, r, `${k}: 정답이 오답에`);
      assert.ok(!real.has(o), `${k}: ${o}는 다른 낱말의 읽기`);
      assert.ok(!/ー/.test(o), `${k}: ${o}`);
      // 작은 ゃゅょ를 큰 글자로 바꾼 것뿐인 오답은 내지 않는다
      assert.notEqual(o, r.replace(/[ゃゅょ]/g, (m) => BIG[m]), `${k}: 큰 글자 요음 ${o}`);
      // 장음 う·촉음 っ를 아무 데나 끼워 넣은 것(정답에서 글자 하나를 더한 꼴)은 음독 끝의 장음·촉음 자리에서만
      if (o.length === r.length + 1) {
        const i = [...o].findIndex((c, n) => c !== r[n]);
        const ins = o[i];
        if (ins === 'う' || ins === 'っ') {
          const parts = kanjiSplit(k, r);
          const ends = new Set();
          let at = 0;
          for (const p of parts) { at += p.r.length; ends.add(at); }
          assert.ok(ends.has(i) || ends.has(i + 1) || !parts.every((p) => p.r), `${k}: ${o} — ${ins}가 음독 경계가 아닌 자리에`);
        }
      }
    }
    if (questionKinds('v:' + k).includes('reading')) {
      withQ++;
      assert.equal(opts.length, 3);
      const q = makeQuestion('v:' + k, 'r2', null, { kind: 'reading' });
      assert.equal(q.kind, 'reading');
      assert.equal(q.options[q.answer], r);
      assert.equal(new Set(q.options).size, 4);
    }
    const parts = kanjiSplit(k, r);
    if (parts.length && parts.every((p) => p.r)) onyomi++;
  }
  console.log(`  읽기 문제를 낼 수 있는 한자 어휘 ${withQ} / ${KANJI_WORDS.length} (음독어 ${onyomi})`);
  assert.ok(withQ >= 500, `읽기 문제 가능 어휘 ${withQ}`);
});

test('L2: 음독어의 오답은 글자마다 실제 음독에서 나온다 (道場·作戦·協力·初心者·募金·更衣室·無事)', () => {
  const bad = { 初心者: ['しょしんしや'], 道場: ['どうじよう'], 更衣室: ['こういしっつ'], 作戦: ['さっくせん'], 無事: ['ぶうじ'], 思わず: ['おうもわず'] };
  for (const [k, list] of Object.entries(bad)) {
    const all = readingCandidates(k).map((c) => c.r);
    for (const w of list) assert.ok(!all.includes(w), `${k}: ${w}`);
  }
  const cands = (k) => readingCandidates(k).map((c) => c.r);
  assert.ok(cands('道場').includes('とうじょう') && cands('道場').includes('どうじょ'), cands('道場'));
  assert.ok(cands('作戦').includes('させん') && cands('作戦').includes('さっせん'), cands('作戦'));
  assert.ok(cands('協力').includes('きょうりき'), cands('協力'));
  assert.ok(cands('募金').includes('ほきん') && cands('募金').includes('ぼうきん'), cands('募金'));
  assert.ok(cands('更衣室').includes('こいしつ'), cands('更衣室'));
  // 글자마다 쓰인 조각은 한자 DB의 음독(청탁·촉음 변형 포함)이거나 다른 낱말에서 그 글자가 실제로 그렇게 읽힌 것
  const seion = (t) => t.replace(/[がぎぐげござじずぜぞだぢづでどばびぶべぼ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 1)).replace(/[ぱぴぷぺぽ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 2));
  for (const k of ['道場', '作戦', '協力', '初心者', '募金', '更衣室', '一切', '上達', '忘年会']) {
    for (const c of readingCandidates(k)) {
      assert.ok(validKana(c.r), `${k}: ${c.r}`);
      assert.ok(['on', 'voice', 'long', 'sokuon'].includes(c.cause), `${k}: ${c.r} ${c.cause}`);
    }
  }
  assert.ok(seion('ぼ') === 'ほ');
});

test('validKana: 있을 수 없는 가나 꼴을 거른다', () => {
  for (const ok of ['どうじょう', 'がっこう', 'いっさい', 'しゅっぱつ', 'きょうりょく', 'ぼきん']) assert.ok(validKana(ok), ok);
  for (const ng of ['こうしつっ', 'っこう', 'がくっ', 'っあ', 'さっな', 'きゃゅ', 'どーじょう', 'あょ', 'んき', 'まっま', 'いっっ']) assert.ok(!validKana(ng), ng);
  assert.ok(!validKana('どうじょう'.replace('じょ', 'じょょ')));
});

// ───── L3 후리가나를 본 말 ─────
test('L3: rubyShown이면 읽기 유형을 고르지 않는다 (chooseKind·buildQuestion·questionKinds)', () => {
  const ids = KANJI_WORDS.filter((k) => questionKinds('v:' + k).includes('reading')).map((k) => 'v:' + k);
  assert.ok(ids.length > 100);
  for (const id of ids) {
    assert.ok(!questionKinds(id, { rubyShown: true }).includes('reading'), id);
    assert.ok(questionKinds(id, { rubyShown: true }).length >= 1, id);
    // 처음 만난 말(FIRST 순서)·다시 보는 말(AGAIN 순서) 모두, 이미 다른 유형을 다 썼어도 읽기는 안 된다
    for (const srs of [{}, { [id]: { ok: 1, ng: 2, lk: 'meaning', streak: 0, due: 0, box: 0, met: 0, last: 0 } }]) {
      for (const hasScene of [false, true]) {
        const L = log();
        L.asked.push({ id, kind: 'meaning', ok: false, scene: 0, src: 'scene' }, { id, kind: 'word', ok: false, scene: 1, src: 'scene' }, { id, kind: 'context', ok: false, scene: 2, src: 'scene' });
        const kind = chooseKind(id, L, srs, { hasScene, rubyShown: true });
        assert.ok(kind && kind !== 'reading', `${id}: ${kind}`);
        const q = buildQuestion(id, L, srs, { hasScene, rubyShown: true });
        assert.ok(q, id);
        assert.notEqual(q.kind, 'reading', id);
        assert.notEqual(q.btype, 'kanji', `${id}: 문제은행 한자 읽기`);
      }
    }
  }
  // rubyShown이 아니면(같은 조건에서) 읽기도 나온다
  const some = ids.slice(0, 60).filter((id) => {
    const L = log();
    L.asked.push({ id, kind: 'meaning', ok: false, scene: 0, src: 'scene' }, { id, kind: 'word', ok: false, scene: 1, src: 'scene' });
    return chooseKind(id, L, {}, { hasScene: false }) === 'reading';
  });
  assert.ok(some.length > 30, `${some.length}`);
});

// ───── L5 학습 수준 ─────
test('L5: 쉬운 말(道場·作戦·協力·初心者·最後·元気)은 N2 기본 설정에서 학습 대상이 되지 않는다', () => {
  for (const k of ['道場', '作戦', '協力', '初心者', '最後', '元気']) {
    assert.ok(VOCAB[k], k);
    const code = lvCode(VOCAB[k].lv);
    assert.ok(!allowedLevel(code, N2), `${k} ${VOCAB[k].lv} (${code})`);
  }
  assert.equal(VOCAB['道場'].k, 1);
  const segs = [['道場', '作戦', '協力', '初心者', '最後', '元気', '稽古'].map((v) => ({ v, s: [v] }))];
  assert.deepEqual(pickTargets(segs, N2), ['v:稽古']);
  // 모든 대사에서 기본 설정의 학습 대상은 N2·N1 수준뿐
  for (const [tpl, segs] of Object.entries(LINES.lines)) {
    for (const id of pickTargets([segs], N2)) {
      const code = lvCode(id[0] === 'g' ? GRAMMAR[id.slice(2)].lv : VOCAB[id.slice(2)].lv);
      assert.ok(code === '2' || code === '1', `${tpl}: ${id} (${code})`);
    }
  }
});

// ───── J5 읽기 해설 ─────
test('J5: readingDiff — ん·장음·촉음의 빠짐과 덧붙음, 여러 글자 차이를 바르게 말한다', () => {
  const d = (r, w, k) => readingDiff(r, w, k);
  assert.match(d('ぼきん', 'ぼき', '募金'), /^마지막 ん이 빠졌어요\. ぼきん이라고 ん까지 읽어요\.$/);
  assert.ok(!d('ぼきん', 'ぼき').includes('ぼきん이 빠진'));
  assert.match(d('ぼきん', 'ぼきんん'), /ん이 붙지 않아요/);
  assert.match(d('しんぱい', 'しぱい'), /し 뒤에 ん이 들어가요/);
  assert.match(d('しぱい', 'しんぱい'), /ん이 들어가지 않아요/);
  // 장음
  assert.match(d('どうじょう', 'どうじょ', '道場'), /じょ는 장음이라서 じょう로 길게/);
  assert.match(d('ぶじ', 'ぶうじ', '無事'), /ぶ는 길게 늘이지 않고 짧게/);
  assert.match(d('せいざ', 'せざ', '正座'), /せ는 장음이라서 せい로/);
  // 촉음
  assert.match(d('いっさい', 'いさい', '一切'), /い 뒤에 촉음 っ가 들어가요/);
  assert.match(d('さくせん', 'さっせん', '作戦'), /촉음 っ가 들어갈 자리가 아니에요|여기서는 촉음 っ로 줄지 않아요/);
  assert.match(d('がっこう', 'がくこう', '学校'), /がっ로 줄어들어요/);
  // 여러 글자: 다른 음독·요음·청탁
  assert.match(d('きょうりょく', 'きょうりき', '協力'), /^りき도 力의 음독이지만, 이 말에서는 りょく로 읽어요\.$/);
  assert.match(d('しょしんしゃ', 'しょしんしや', '初心者'), /者는 しゃ로 읽어요\. 작은 ゃ라서/);
  assert.match(d('どうじょう', 'とうじょう', '道場'), /^道는 とう가 아니라 どう로 읽어요\. 청음·탁음만 달라요\.$/);
  assert.match(d('どうじょう', 'とうじょう'), /と가 탁음이 돼서 ど로/);
  assert.match(d('ぼきん', 'ぼぎん', '募金'), /^金은 ぎん이 아니라 きん으로 읽어요\. 청음·탁음만 달라요\.$/);
  assert.match(d('さくせん', 'させん', '作戦'), /^さ도 作의 음독이지만, 이 말에서는 さく로 읽어요\.$/);
  // 아무 것에도 안 맞는 차이도 말이 된다
  const g = d('あいうえお', 'あかさえお');
  assert.ok(/읽었어요\. あいうえお라고 읽어요\.$/.test(g), g);
  // 원인 분류
  assert.equal(readingCause('ぼきん', 'ほきん'), 'voice');
  assert.equal(readingCause('どうじょう', 'どうじょ'), 'long');
  assert.equal(readingCause('がっこう', 'がくこう'), 'sokuon');
  assert.equal(readingCause('しょしんしゃ', 'しょしんしや'), 'youon');
  assert.equal(readingCause('きょうりょく', 'きょうりき'), 'on');
  assert.equal(readingCause('きょうりょく', 'ぎょうりょく'), 'voice');
  assert.equal(readingCause('いっさい', 'いちさい'), 'sokuon');
});

test('J5: 모든 읽기 문제의 해설은 「~해요」체로 끝나고 선택지에 맞는 말이 들어 있다', () => {
  for (const k of KANJI_WORDS) {
    if (!questionKinds('v:' + k).includes('reading')) continue;
    const q = makeQuestion('v:' + k, 'why', null, { kind: 'reading' });
    q.options.forEach((o, i) => {
      const w = q.why[i];
      assert.ok(w && !/undefined|null/.test(w), `${k} ${o}: ${w}`);
      assert.match(w, /(요|돼요)\.$/, `${k} ${o}: ${w}`);
      assert.ok(!/읽기예요|함정|오답/.test(w), `${k} ${o}: ${w}`);
      assert.ok(!/  |\s[.,]/.test(w), `${k} ${o}: 띄어쓰기 ${w}`);
    });
  }
});

// ───── J6 조사 ─────
const BAD_JOSA = /[んン](라고|라는|라서|랑|는|가|를|와|로|예요)(?![가-힣])/;
test('J6: ん으로 끝나는 말 뒤의 조사', () => {
  assert.equal(josa('ぼきん', '이라고라고'), 'ぼきん이라고');
  assert.equal(josa('けいこ', '이라고라고'), 'けいこ라고');
  assert.equal(josa('ぼきん', '이라서라서'), 'ぼきん이라서');
  assert.equal(josa('ねこ', '이랑랑'), 'ねこ랑');
  assert.equal(pt('さくせん', '이라고라고'), '이라고');
  assert.match(vShort('募金'), /^ぼきん이라고 읽고, /);
  assert.match(vShort('作戦'), /^さくせん이라고 읽고, /);
  // 생성되는 해설 전부에서 받침 조사 오류·띄어쓰기 오류가 없다
  const texts = [];
  for (const k of Object.keys(VOCAB)) {
    for (const kind of ['reading', 'meaning', 'word', 'context']) {
      if (!questionKinds('v:' + k, { hasScene: true }).includes(kind)) continue;
      const q = makeQuestion('v:' + k, 'j6', null, { kind, hasScene: true });
      texts.push(q.explain, ...q.why);
    }
  }
  for (const k of Object.keys(GRAMMAR)) {
    for (const kind of ['grammar', 'gform', 'gdiff', 'gcontext']) {
      if (!questionKinds('g:' + k, { hasScene: true }).includes(kind)) continue;
      const q = makeQuestion('g:' + k, 'j6', null, { kind, hasScene: true });
      texts.push(q.explain, ...q.why);
    }
  }
  assert.ok(texts.length > 3000);
  for (const t of texts) {
    assert.ok(!BAD_JOSA.test(t), `조사: ${t}`);
    assert.ok(!/  |\s[.,]|^\s|\s$/.test(t), `띄어쓰기: ${JSON.stringify(t)}`);
  }
});

// ───── J10 문법 오답의 뜻 겹침 ─────
test('J10: 모든 문법·유형·시드에서 오답은 정답과 같은 뜻 묶음이 아니다', () => {
  const byM = (m) => Object.keys(GRAMMAR).filter((g) => GRAMMAR[g].m === m);
  const byF = (f) => Object.keys(GRAMMAR).find((g) => GRAMMAR[g].f === f);
  // 같은 뜻 묶음의 보기: に限らず·ばかりか·のみならず / 以上·からには
  assert.ok(sameMeaning('に限らず', 'ばかりか') && sameMeaning('ばかりか', 'のみならず') && sameMeaning('以上', 'からには'));
  assert.ok(!sameMeaning('に限らず', 'ものの'));
  const blankLine = {};
  for (const segs of Object.values(LINES.lines)) for (const sg of segs) if (sg && sg.g && !blankLine[sg.g]) { const b = blankOf(segs, sg.g); if (b) blankLine[sg.g] = b; }
  let n = 0;
  for (const k of Object.keys(GRAMMAR)) {
    const id = 'g:' + k;
    for (let s = 0; s < 6; s++) {
      const ctx = { hasScene: true, blank: blankLine[k] || null };
      for (const kind of questionKinds(id, ctx)) {
        const q = makeQuestion(id, 'j10-' + s, null, { ...ctx, kind });
        assert.equal(q.kind, kind, `${k} ${kind}`);
        assert.equal(new Set(q.options).size, 4, `${k} ${kind}`);
        q.options.forEach((o, i) => {
          if (i === q.answer) return;
          let keys;
          if (kind === 'gcontext') keys = byM(o);
          else if (kind === 'gdiff' || kind === 'gform') keys = [byF(o)].filter(Boolean);
          else if (kind === 'gblank') keys = (BLANK_SET[k] || []).filter((w) => o.startsWith(w.replace(/^～/, '').slice(0, 2)) || o === w || (w === 'どおり' && o === 'とおり'));
          else keys = [grammarByForm(o)?.key].filter(Boolean);
          // 자동으로 고른 오답은 뜻 글자가 겹쳐도 안 되고, 사람이 쓴 문법 빈칸(q)의 오답은 같은 뜻 묶음만 아니면 된다(형태 차이를 묻는 문제)
          const same = kind === 'grammar' ? sameGroup : sameMeaning;
          for (const d of keys) assert.ok(!same(k, d), `${k} ${kind} (seed ${s}): 오답 ${o}(${d})가 정답과 같은 뜻`);
        });
        n++;
      }
    }
  }
  console.log(`  검사한 문법 문제 ${n}`);
  // 사람이 고른 빈칸 오답 목록도 정답과 뜻이 겹치지 않는다
  for (const [k, ws] of Object.entries(BLANK_SET)) for (const w of ws) assert.ok(!sameMeaning(k, w), `BLANK_SET ${k}: ${w}`);
  // 문법 데이터의 빈칸 오답(q)도
  for (const [k, g] of Object.entries(GRAMMAR)) for (const w of g.q[2]) { const d = grammarByForm(w); if (d) assert.ok(!sameGroup(k, d.key), `${k} q: ${w}`); }
});
