// 한자 DB와 한자 분해: 어휘 DB의 모든 한자가 DB에 있고, 음독어는 글자별 읽기로 쪼개지며, 훈독어는 훈음만 나온다
import test from 'node:test';
import assert from 'node:assert/strict';
import { KANJI } from '../src/data/kanji.js';
import { VOCAB } from '../src/data/vocab.js';
import { kanjiSplit, vocabRows } from '../src/engine/explain.js';

test('어휘 DB의 모든 한자가 한자 DB에 있고 훈음이 있다', () => {
  const missing = new Set();
  for (const k of Object.keys(VOCAB)) for (const c of k) if (/[一-龯]/.test(c) && !(KANJI[c] && KANJI[c].ko)) missing.add(c);
  assert.deepEqual([...missing], []);
});

test('음독어는 글자별 읽기로 쪼개진다 (연탁·촉음 포함)', () => {
  assert.deepEqual(kanjiSplit('逮捕', 'たいほ').map((p) => p.r), ['たい', 'ほ']);
  assert.deepEqual(kanjiSplit('学校', 'がっこう').map((p) => p.r), ['がっ', 'こう']);
  assert.equal(kanjiSplit('逮捕', 'たいほ')[1].ko, '잡을 포');
});

test('훈독어·送り仮名가 섞인 말은 훈음만 붙는다', () => {
  const parts = kanjiSplit('見落とす', 'みおとす');
  assert.deepEqual(parts.map((p) => p.c), ['見', '落']);
  assert.ok(parts.every((p) => !p.r && p.ko));
});

test('어휘 DB 음독어의 85% 이상이 한자 DB 음독으로 설명된다', () => {
  let total = 0;
  let ok = 0;
  for (const [k, v] of Object.entries(VOCAB)) {
    if (!/^[一-龯々]+$/.test(k) || v.k) continue;
    total++;
    const parts = kanjiSplit(k, v.r);
    if (parts.length && parts.every((p) => p.r)) ok++;
  }
  assert.ok(ok / total > 0.85, `${ok}/${total}`);
});

test('vocabRows: 한자 줄이 먼저 오고, 없는 말은 빈 배열', () => {
  assert.equal(vocabRows('逮捕')[0].t, '한자');
  assert.deepEqual(vocabRows('없는말'), []);
});
