// 漢字 탭: N2 한자 색인, 읽기별 단어 묶음, 한국 음 대응, 한자 연습 문제(정답 하나·해설 해요체), 탭·해설 칩 연결
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { build } from 'esbuild';
import { VOCAB } from '../src/data/vocab.js';
import { KANJI } from '../src/data/kanji.js';
import { kanjiIndex, kanjiList, readingGroups, koNote, kanjiQuestion, kanjiSet, gradeKanji, weakKanji, seenKanji, Q_KINDS } from '../src/engine/kanjistudy.js';

test('N2 단어의 한자 색인: 단어 수 많은 순, 모든 글자에 훈음', () => {
  const list = kanjiList();
  assert.ok(list.length > 500, String(list.length));
  const idx = kanjiIndex();
  for (let i = 1; i < list.length; i++) assert.ok(idx[list[i - 1]].n2.length >= idx[list[i]].n2.length);
  for (const c of list) {
    assert.ok(KANJI[c].ko, c);
    assert.ok(idx[c].n2.every((w) => VOCAB[w].lv === 'N2' && w.includes(c)));
  }
});

test('읽기별 묶음: 逮捕는 ほ 묶음, 捕まえる는 훈독 묶음', () => {
  const g = readingGroups('捕');
  assert.ok(g.find((x) => x.r === 'ほ').words.includes('逮捕'));
  assert.ok(g.find((x) => x.r === '').words.includes('捕まえる'));
  assert.equal(g[g.length - 1].r, '');
});

test('한국 음 대응 설명: 포→ほ, 학→がく, 맞지 않으면 null', () => {
  assert.match(koNote('捕', 'ほ').text, /포 → ほ/);
  assert.match(koNote('学', 'がく').text, /받침 ㄱ/);
  assert.equal(koNote('捕', 'つかま'), null);
});

test('연습 문제: 세 유형 모두 나오고, 선택지 4개·중복 없음·정답 하나, 해설은 해요체', () => {
  const seen = new Set();
  for (const c of kanjiList().slice(0, 300)) {
    for (const k of Object.keys(Q_KINDS)) {
      const q = Q_KINDS[k](c, 't');
      if (!q) continue;
      seen.add(q.kind);
      assert.equal(q.options.length, 4, `${c} ${k}`);
      assert.equal(new Set(q.options).size, 4, `${c} ${k} ${q.options}`);
      assert.ok(q.answer >= 0 && q.answer < 4);
      assert.equal(q.why.length, 4);
      for (const w of q.why) assert.match(w, /(요|세요)\.$/, `${c} ${k} ${w}`);
      if (k === 'word') assert.ok(q.options[q.answer].includes(c) && q.options.filter((o) => VOCAB[o].m === q.meaning).length === 1);
      if (k === 'kanji') assert.equal(q.options.filter((o) => KANJI[o].ko === q.ko).length, 1);
      if (k === 'reading') assert.ok(q.word.includes(c));
    }
  }
  assert.deepEqual([...seen].sort(), ['kanji', 'reading', 'word']);
  assert.ok(kanjiQuestion('捕'));
  assert.equal(kanjiSet(['捕'], 10, 's').length > 3, true);
  assert.equal(kanjiSet(kanjiList().slice(0, 10), 10, 's').length, 10);
});

test('한자 기록: 틀린 한자가 먼저, 만난 단어로 많이 본 한자', () => {
  const rec = {};
  gradeKanji(rec, '捕', false, 1);
  gradeKanji(rec, '検', true, 2);
  gradeKanji(rec, '観', false, 3);
  assert.deepEqual(weakKanji(rec), ['観', '捕']);
  assert.equal(seenKanji(['v:逮捕', 'v:捕獲', 'v:検討'])[0], '捕');
});

test('N2 메뉴에 漢字 탭, 해설 한자 칩은 탭하면 풀이가 열린다, 저장소에 kanji 기록', async () => {
  const n2 = fs.readFileSync('src/ui/n2ui.js', 'utf8');
  assert.match(n2, /\['kanji', '漢字'\]/);
  assert.match(n2, /kanji: kanjiTab/);
  assert.match(fs.readFileSync('src/ui/explainui.js', 'utf8'), /ex-kj-tap/);
  const st = fs.readFileSync('src/ui/store.js', 'utf8');
  assert.match(st, /kanji\(\) \{/);
  assert.match(st, /'causes', 'kanji'\]/);
  const r = await build({ entryPoints: ['src/ui/kanjiui.js'], bundle: true, write: false, format: 'esm', loader: { '.json': 'json' }, logLevel: 'silent' });
  assert.ok(r.outputFiles[0].text.includes('setKanjiHandler'));
});
