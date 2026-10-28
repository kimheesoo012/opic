// 화면 흐름의 규칙(UI 모듈 안의 순수 함수): 복습 수, 나이 표기, 「家族から」 묶기, 다시 풀기 문제, 만남·복습 등록.
// UI 모듈은 lines.json을 import하므로 esbuild로 한 파일로 묶어서 불러온다 (DOM은 함수를 부를 때만 쓰므로 Node에서도 불러올 수 있다).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import * as G from '../src/engine/core.js';
import { makeQuestion, questionKinds, JA_ONLY_KINDS, DAY } from '../src/engine/study.js';
import { VOCAB } from '../src/data/vocab.js';
import { GRAMMAR } from '../src/data/grammar.js';
import { ROLES } from '../src/engine/world.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const entry = `export * from './src/ui/studyui.js'; export { ageLabel, familyLines } from './src/ui/end.js'; export { store } from './src/ui/store.js';`;
const built = await esbuild.build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'js' }, bundle: true, format: 'esm', platform: 'neutral', write: false, loader: { '.json': 'json' }, logLevel: 'silent' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-flow-'));
const file = path.join(dir, 'flow-bundle.mjs');
fs.writeFileSync(file, built.outputFiles[0].text);
const F = await import(pathToFileURL(file).href);
process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));

const rec = (due, extra = {}) => ({ met: 0, box: 0, due, streak: 0, ok: 0, ng: 0, last: 0, ...extra });

test('reviewCounts: 오늘(기한 지남)·내일까지·전체를 한 번에 센다', () => {
  const now = new Date(2026, 9, 28, 20, 0).getTime();
  const srs = {
    'v:稽古': rec(now - 1000),
    'v:曖昧': rec(now),
    'g:ざるを得ない': rec(now + DAY), // 내일 저녁: 내일부터
    'v:誤解': rec(new Date(2026, 9, 29, 23, 59).getTime()), // 내일 밤
    'v:把握': rec(new Date(2026, 9, 30, 0, 1).getTime()), // 모레: 어느 쪽도 아님
    'v:없는말': rec(now - 1000), // 사전에 없는 말은 세지 않는다
  };
  assert.deepEqual(F.reviewCounts(srs, now), { today: 2, tomorrow: 2, total: 5 });
  assert.deepEqual(F.reviewCounts({}, now), { today: 0, tomorrow: 0, total: 0 });
});

test('ageLabel: 1살 전은 개월, 단계(子犬)와 어긋나지 않는다', () => {
  assert.equal(F.ageLabel(0, true), '生後3か月');
  assert.equal(F.ageLabel(3, true), '生後12か月');
  assert.equal(F.ageLabel(3, true, true), '12か月');
  assert.equal(F.ageLabel(4, true), '1歳');
  assert.equal(F.ageLabel(3, false), '생후 12개월');
  assert.equal(F.ageLabel(9, false), '2살');
  const s = G.newLife({ seed: 'age' });
  for (let t = 0; t < 64; t++) {
    s.t = t;
    const months = /か月/.test(F.ageLabel(t, true));
    assert.equal(months, G.stage(s) === 'puppy', `t=${t}: ${F.ageLabel(t, true)} / ${G.stage(s)}`);
    assert.ok(!/^0歳|^0살/.test(F.ageLabel(t, true)) && !/^0살/.test(F.ageLabel(t, false)), `t=${t}: 0살 표기`);
  }
});

test('familyLines: 한 사람은 한 칸 (노사범이 떠난 판의 도장 살림 담당 등), 말은 빠짐없이', () => {
  let merged = 0;
  for (let i = 0; i < 120; i++) {
    const s = G.newLife({ seed: 'fam-' + i });
    let n = 0;
    while (s.phase !== 'farewell' && n++ < 6000) G.stepAuto(s);
    const lines = G.farewell(s);
    const fam = F.familyLines(s, lines);
    const people = fam.map((x) => x.person);
    assert.equal(new Set(people).size, people.length, `seed ${i}: 같은 사람이 두 칸`);
    assert.equal(fam.reduce((a, x) => a + x.lines.length, 0), lines.length, `seed ${i}: 빠진 말`);
    for (const x of fam) assert.ok(ROLES.includes(x.sp) || x.sp === 'iincho', `seed ${i}: 알 수 없는 화자 ${x.sp}`);
    if (fam.some((x) => x.lines.length > 1)) merged++;
  }
  assert.ok(merged > 0, '두 말을 한 칸에 모은 판이 하나도 없다 (재현 시드가 사라졌나)');
  // 같은 역할이 아니어도 같은 사람이면 한 칸
  const s = G.newLife({ seed: 'fam-x' });
  s.cast = { ...s.cast, kid: s.cast.shihan };
  const fam = F.familyLines(s, [['shihan', 'a', 'a'], ['kid', 'b', 'b'], ['iincho', 'c', 'c']]);
  assert.equal(fam.length, 2);
  assert.deepEqual(fam[0].lines.map((l) => l[0]), ['a', 'b']);
});

test('retryQuestion: 바로 전과 같은 유형·같은 문제문을 내지 않고, 다른 유형이 있으면 다른 유형으로', () => {
  const ids = [
    ...Object.keys(VOCAB).filter((k) => VOCAB[k].lv === 'N2').slice(0, 150).map((k) => 'v:' + k),
    ...Object.keys(GRAMMAR).map((k) => 'g:' + k),
  ];
  let held = 0;
  for (const ja of [true, false]) {
    for (const id of ids) {
      const first = makeQuestion(id, 'r1' + id, null, { jaOnly: ja }) || makeQuestion(id, 'r1' + id, null, {});
      if (!first) continue;
      const hist = [first];
      for (let round = 2; round <= 4; round++) {
        const q = F.retryQuestion(id, hist, `seed-${round}-${id}`, { ja });
        const prev = hist[hist.length - 1];
        if (!q) {
          held++;
          // 다른 문제를 만들 수 없을 때만 null: 다른 유형이 정말 없다
          assert.ok(questionKinds(id, {}).every((k) => k === prev.kind), `${id}: 다른 유형이 있는데 null`);
          break;
        }
        assert.ok(!(q.kind === prev.kind && q.prompt === prev.prompt && (q.bankId || null) === (prev.bankId || null)), `${id}: 같은 문제 연속 (${q.kind})`);
        const others = questionKinds(id, {}).filter((k) => k !== prev.kind);
        if (others.length) assert.notEqual(F.kindKey(q), F.kindKey(prev), `${id}: 다른 유형이 있는데 같은 유형 ${F.kindKey(q)}`);
        hist.push(q);
      }
    }
  }
  // 일본어 모드: 일본어만으로 풀 수 있는 유형이 남아 있으면 그것부터
  const id = 'v:' + Object.keys(VOCAB).find((k) => VOCAB[k].lv === 'N2' && questionKinds('v:' + k, { jaOnly: true }).includes('reading'));
  const q = F.retryQuestion(id, [makeQuestion(id, 's', null, { kind: 'meaning' })], 'x', { ja: true });
  assert.ok(JA_ONLY_KINDS.has(q.kind) || q.kind === 'bank', `${id}: 일본어 모드인데 ${q.kind}`);
  assert.ok(held < ids.length, '대부분은 다시 낼 수 있어야 한다');
});

test('만남은 met에만, 직접 건드린 말만 srs에 (뜻 창·번역·문제)', () => {
  F.store.resetAll();
  const s = { met: [] };
  F.recordMet(['v:稽古', 'g:ざるを得ない', 'v:없는말'], s, 1000);
  assert.deepEqual(Object.keys(F.store.met()).sort(), ['g:ざるを得ない', 'v:稽古']);
  assert.deepEqual(s.met, ['v:稽古', 'g:ざるを得ない']);
  assert.deepEqual(F.store.srs(), {}, '만나기만 한 말은 복습 목록에 넣지 않는다');
  // 만난 말 목록·만난 수는 srs가 비어도 센다
  const metIds = F.metEntries(F.store.srs(), F.store.met()).map((x) => x.id);
  assert.deepEqual(metIds.sort(), ['g:ざるを得ない', 'v:稽古']);
  // 뜻 창을 열었다 → 등록 (다음 날 복습)
  assert.equal(F.engage(['v:稽古'], {}, 5000), true);
  assert.equal(F.store.srs()['v:稽古'].due, 5000 + DAY);
  assert.equal(F.engage(['v:稽古'], {}, 6000), false, '두 번 등록하지 않는다');
  // 번역을 열었다 → 문장의 학습 대상 등록 + 번역 확인 횟수
  F.engage(['g:ざるを得ない'], { tr: ['g:ざるを得ない', 'v:稽古', 'v:曖昧'] }, 7000);
  const srs = F.store.srs();
  assert.equal(srs['g:ざるを得ない'].tr, 1);
  assert.equal(srs['v:稽古'].tr, 1);
  assert.ok(!srs['v:曖昧'], '번역만 센 말(학습 대상 아님)은 등록하지 않는다');
  // 만난 목록은 최근 순
  F.recordMet(['v:曖昧'], null, 9000);
  assert.equal(F.metEntries(F.store.srs(), F.store.met())[0].id, 'v:曖昧');
  F.store.resetAll();
});

test('metProgress: 이번 견생에서 만난 N2 수는 복습 기록이 없어도 센다', () => {
  const n2v = Object.keys(VOCAB).filter((k) => VOCAB[k].lv === 'N2').slice(0, 3).map((k) => 'v:' + k);
  const n2g = Object.keys(GRAMMAR).filter((k) => GRAMMAR[k].lv === 'N2').slice(0, 2).map((k) => 'g:' + k);
  const srs = { [n2v[0]]: rec(0, { streak: 2 }) };
  const p = F.metProgress(srs, [...n2v, ...n2g, n2v[0]]);
  assert.deepEqual(p, { words: 3, grammar: 2, wordsMastered: 1, grammarMastered: 0 });
});
