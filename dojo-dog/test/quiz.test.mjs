// 플레이 중 학습(확인 문제·복습 카드·견생 정리) 검사
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GRAMMAR } from '../src/data/grammar.js';
import { makeQuestion, questionKinds, blankOf, nearG, BLANK_SET, blankNearCheck } from '../src/engine/study.js';
import { quizLog, sceneQuizDue, cardDue, quizOn, lifeSummary, pickItem } from '../src/engine/quizplan.js';
import * as G from '../src/engine/core.js';
import { simulate, measure } from '../tools/quizsim.mjs';
import { migrateSettings } from '../src/ui/store.js';

const LINES = JSON.parse(fs.readFileSync(new URL('../src/gen/lines.json', import.meta.url), 'utf8'));
const surf = (sg) => sg.s.map((x) => (typeof x === 'string' ? x : x[0])).join('');

test('새 문제 유형(문맥 속 문법 뜻·비슷한 표현 구별): 선택지 4개, 정답 하나, 뜻이 가까운 오답 없음', () => {
  for (const k of Object.keys(GRAMMAR)) {
    const id = 'g:' + k;
    for (const kind of ['gcontext', 'gdiff']) {
      if (!questionKinds(id, { hasScene: true }).includes(kind)) continue;
      for (let i = 0; i < 12; i++) {
        const q = makeQuestion(id, 'qt' + i, null, { kind, hasScene: true });
        assert.equal(q.kind, kind);
        assert.equal(q.options.length, 4, `${k} ${kind}`);
        assert.equal(new Set(q.options).size, 4, `${k} ${kind} 중복 선택지`);
        assert.ok(q.answer >= 0);
        // 오답이 정답과 뜻이 가까우면 정답이 둘이 된다
        const keyOf = (o) => Object.keys(GRAMMAR).find((g) => (kind === 'gdiff' ? GRAMMAR[g].f : GRAMMAR[g].m) === o);
        q.options.forEach((o, j) => {
          if (j === q.answer) return;
          const d = keyOf(o);
          assert.ok(d, `${k}: 오답 ${o}`);
          assert.ok(!nearG(k, d), `${k} ${kind}: 뜻이 가까운 오답 ${d}`);
        });
      }
    }
  }
});

test('게임 속 문장 빈칸: 기본 형태로 쓰인 대사만, 오답은 사람이 확인한 목록에서, 정답은 대사의 그 말', () => {
  let n = 0;
  for (const segs of Object.values(LINES.lines)) {
    for (const sg of segs) {
      if (!sg || !sg.g) continue;
      const b = blankOf(segs, sg.g);
      if (!b) continue;
      if (!questionKinds('g:' + sg.g, { blank: b }).includes('gblank')) continue;
      n++;
      const q = makeQuestion('g:' + sg.g, 'b' + n, null, { kind: 'gblank', blank: b });
      assert.equal(q.options[q.answer], surf(sg));
      assert.equal(new Set(q.options).size, 4);
      for (const d of BLANK_SET[sg.g]) assert.ok(!blankNearCheck(sg.g, d), `${sg.g}: ${d}`);
    }
  }
  assert.ok(n >= 60, `빈칸 문제를 낼 수 있는 대사 ${n}`);
  // 「勝て（っこない）」: 가능형 어간 뒤라 같은 ます형 접속의 오답만
  const s0 = LINES.lines['[声]が[小]さい！　そんな声じゃ勝て〘っこない|っこない〙ぞ。もう[一回]！'];
  assert.deepEqual(blankOf(s0, 'っこない'), { surface: 'っこない', cls: 'masu' });
});

test('플레이 중 퀴즈 40판 시뮬레이션: 빈도·중복·오답 재출제', () => {
  const mid = measure(simulate(40, 'mid', 'tq'));
  assert.ok(mid.scenesPerSceneQuiz >= 4 && mid.scenesPerSceneQuiz <= 5.2, `보통: ${mid.scenesPerSceneQuiz}장면마다`);
  assert.equal(mid.duplicateAfterCorrect, 0, '이번 견생에서 맞힌 말을 다시 낸다');
  assert.ok(mid.wrongReaskedSameRun >= 0.6, `틀린 말 같은 견생 재출제 ${mid.wrongReaskedSameRun}`);
  assert.ok(mid.wrongReaskedWithin2Runs >= 0.95, `틀린 말 두 판 안 재출제 ${mid.wrongReaskedWithin2Runs}`);
  assert.ok(mid.repeatKindChanged >= 0.95, `다시 낼 때 유형이 바뀌는 비율 ${mid.repeatKindChanged}`);
  assert.ok(mid.cardPerRun <= 5, `복습 카드 ${mid.cardPerRun}`);
  const low = measure(simulate(15, 'low', 'tq'));
  const high = measure(simulate(15, 'high', 'tq'));
  assert.ok(low.quizPerRun < mid.quizPerRun && mid.quizPerRun < high.quizPerRun);
});

test('틀린 말은 바로 다시 내지 않는다 (다른 문제를 두 개 이상 지난 뒤)', () => {
  const { out } = simulate(20, 'high', 'gap');
  for (const { log } of out) {
    log.asked.forEach((a, i) => {
      const prev = log.asked.slice(0, i).map((b, j) => [b, j]).filter(([b]) => b.id === a.id).pop();
      if (prev) assert.ok(i - prev[1] - 1 >= 2, `${a.id}: ${i - prev[1] - 1}문제 만에 다시`);
    });
  }
});

test('퀴즈는 게임에 영향이 없다: 같은 시드의 견생은 퀴즈를 풀든 안 풀든 똑같이 흘러간다', () => {
  const run = (withQuiz) => {
    const s = G.newLife({ seed: 'noeffect' });
    const srs = {};
    const log = quizLog(s);
    for (let i = 0; i < 4000 && s.phase !== 'ended' && s.phase !== 'farewell'; i++) {
      if (withQuiz && s.phase === 'season') {
        log.recent = [['g:っこない', 'v:稽古']];
        const id = pickItem(log, srs, Date.now(), 'scene');
        if (id) log.asked.push({ id, kind: 'meaning', ok: i % 2 === 0, scene: i, src: 'scene' });
      }
      G.stepAuto(s);
    }
    const { quiz, ...rest } = s;
    return JSON.stringify(rest);
  };
  assert.equal(run(true), run(false));
});

test('감상 모드에서는 퀴즈·복습 카드가 저절로 나오지 않는다', () => {
  const log = { scenes: 10, nextAt: 5, asked: [], lastCard: -99 };
  assert.equal(quizOn({ playMode: 'watch', quizFreq: 'high' }), false);
  assert.equal(sceneQuizDue(log, { playMode: 'watch', quizFreq: 'high' }), false);
  assert.equal(cardDue(log, { playMode: 'watch', quizFreq: 'high' }, 10), false);
  assert.equal(sceneQuizDue(log, { playMode: 'study', quizFreq: 'off' }), false);
  assert.equal(sceneQuizDue(log, { playMode: 'study', quizFreq: 'mid' }), true);
});

test('저장 호환: 예전 설정·견생에는 학습 모드 기본값과 빈 학습 기록이 붙는다', () => {
  const set = migrateSettings({ v: 2, furigana: 'n2', speed: 4 });
  assert.equal(set.playMode, 'study');
  assert.equal(set.quizFreq, 'mid');
  assert.equal(migrateSettings({ playMode: 'zzz', quizFreq: 'x' }).quizFreq, 'mid');
  const old = G.newLife({ seed: 'old' });
  delete old.quiz;
  const log = quizLog(old);
  assert.deepEqual(log.asked, []);
  const sum = lifeSummary({ met: ['g:っこない', 'v:稽古'] }, { 'g:っこない': { met: 0, box: 0, due: 0, streak: 0, ok: 0, ng: 2, last: 0 } });
  assert.equal(sum.grammar.length, 1);
  assert.equal(sum.accuracy, null);
  assert.ok(sum.weak.includes('g:っこない'));
});
