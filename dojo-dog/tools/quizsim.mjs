// 플레이 중 학습(확인 문제·복습 카드) 시뮬레이션: 견생을 여러 번 오토로 돌리며 화면과 같은 규칙(quizplan.js)으로 문제를 낸다.
// 사용: node tools/quizsim.mjs [판 수=40] [빈도=mid]
// 학습자 모형: 처음 보는 말 55%, 맞힐 때마다 +15%p(최대 92%), 이번 견생에서 틀린 직후 다시 볼 때 62%. 문법은 5%p 낮게.
// 판과 판 사이에는 하루가 지난다(간격 반복 기록은 이어진다).
import fs from 'fs';
import * as G from '../src/engine/core.js';
import { pickTargets } from '../src/engine/learn.js';
import { blankOf, DAY, meet } from '../src/engine/study.js';
import { quizLog, noteScene, sceneQuizDue, cardDue, reschedule, pickItem, buildQuestion, recordAnswer, lifeSummary } from '../src/engine/quizplan.js';
import { hashSeed, rand } from '../src/engine/rng.js';

const L = JSON.parse(fs.readFileSync(new URL('../src/gen/lines.json', import.meta.url), 'utf8'));
const RUNS = +(process.argv[2] || 40);
const FREQ = process.argv[3] || 'mid';

export function simulate(runs = RUNS, freq = FREQ, seed = 'qs') {
  const set = { playMode: 'study', quizFreq: freq, studyLevel: 'n2', hideEasy: true };
  const srs = {};
  const h = { rng: hashSeed(seed) };
  let now = Date.UTC(2026, 0, 1);
  const out = [];
  for (let k = 0; k < runs; k++) {
    const s = G.newLife({ seed: seed + k });
    const log = quizLog(s);
    s.met = [];
    let season = s.t;
    const sceneOf = (id) => log.where[id] || (id[0] === 'g' ? L.gidx[id.slice(2)] : L.vidx[id.slice(2)])?.tpl;
    const ask = (src) => {
      const id = pickItem(log, srs, now, src);
      if (!id) return false;
      const tpl = sceneOf(id);
      const q = buildQuestion(id, log, srs, { hasScene: !!tpl, blank: tpl ? blankOf(L.lines[tpl], id.slice(2)) : null });
      if (!q || q.answer < 0) throw new Error('bad question ' + id);
      const r = srs[id];
      const run = log.asked.filter((a) => a.id === id);
      let p = r ? Math.min(0.92, 0.55 + r.streak * 0.15) : 0.55;
      if (run.length && !run[run.length - 1].ok) p = 0.62;
      if (id[0] === 'g') p -= 0.05;
      recordAnswer(log, srs, q, rand(h) < p, now, src);
      now += 20 * 1000;
      return true;
    };
    let scene = null;
    for (let i = 0; i < 20000 && s.phase !== 'ended' && s.phase !== 'farewell'; i++) {
      if (s.phase === 'season' && s.t !== season) {
        season = s.t;
        if (cardDue(log, set, season) && ask('card')) log.lastCard = season;
      }
      if (s.phase === 'event') {
        const lines = G.view(s).lines.map((l) => l[1]);
        scene = { lines };
      }
      if (s.phase === 'result' && scene) {
        const all = [...scene.lines, ...(s.res.lines || []).map((l) => l[1])];
        if (all.length) {
          const ids = pickTargets(all.map((t) => L.lines[t] || []), set);
          const where = {};
          for (const id of ids) where[id] = all.find((t) => (L.lines[t] || []).some((sg) => sg && (sg.g === id.slice(2) || sg.v === id.slice(2))));
          for (const id of ids) if (!s.met.includes(id)) s.met.push(id);
          for (const id of ids) meet(srs, id, now); // 화면과 같이: 장면에서 만나면 간격 반복에 등록(다음 날 복습)
          noteScene(log, ids, where, set);
          if (sceneQuizDue(log, set)) {
            ask('scene');
            reschedule(log, set);
          }
        }
        scene = null;
      }
      G.stepAuto(s);
      now += 9000;
    }
    out.push({ log, sum: lifeSummary(s, srs, now) });
    now += DAY;
  }
  return { out, srs };
}

export function measure(res) {
  const runs = res.out;
  let bank = 0;
  let asks = 0, scene = 0, card = 0, dup = 0, dupNotRelearn = 0, wrong = 0, wrongReasked = 0, wrongReaskedSoon = 0, repeats = 0, kindChanged = 0, scenes = 0;
  runs.forEach(({ log }, k) => {
    scenes += log.scenes;
    const seen = new Map();
    log.asked.forEach((a, i) => {
      asks++;
      if (a.bank) bank++;
      a.src === 'card' ? card++ : scene++;
      if (seen.has(a.id)) {
        dup++;
        const prev = seen.get(a.id);
        if (prev.ok) dupNotRelearn++;
        repeats++;
        if (prev.kind !== a.kind) kindChanged++;
      }
      seen.set(a.id, a);
      if (!a.ok) {
        wrong++;
        if (log.asked.slice(i + 1).some((b) => b.id === a.id)) wrongReasked++;
        else if (runs.slice(k + 1, k + 3).some((r) => r.log.asked.some((b) => b.id === a.id))) wrongReaskedSoon++;
      }
    });
  });
  const n = runs.length;
  return {
    runs: n,
    scenesPerRun: +(scenes / n).toFixed(1),
    quizPerRun: +(asks / n).toFixed(1),
    sceneQuizPerRun: +(scene / n).toFixed(1),
    cardPerRun: +(card / n).toFixed(1),
    scenesPerSceneQuiz: +(scenes / Math.max(1, scene)).toFixed(2),
    duplicateRate: +(dup / Math.max(1, asks)).toFixed(3),
    duplicateAfterCorrect: dupNotRelearn,
    wrongRate: +(wrong / Math.max(1, asks)).toFixed(3),
    wrongReaskedSameRun: +(wrongReasked / Math.max(1, wrong)).toFixed(3),
    wrongReaskedWithin2Runs: +((wrongReasked + wrongReaskedSoon) / Math.max(1, wrong)).toFixed(3),
    repeatKindChanged: +(kindChanged / Math.max(1, repeats)).toFixed(3),
    bankShare: +(bank / Math.max(1, asks)).toFixed(3),
  };
}

if (process.argv[1] && process.argv[1].endsWith('quizsim.mjs')) {
  for (const f of FREQ === 'all' ? ['low', 'mid', 'high'] : [FREQ]) {
    const res = simulate(RUNS, f);
    console.log(f, JSON.stringify(measure(res)));
    const last = res.out[res.out.length - 1].sum;
    console.log('  마지막 판 정리:', JSON.stringify({ N2단어: last.words.length, N2문법: last.grammar.length, 문제: last.asked, 정답률: last.accuracy, 취약: last.weak.length, 내일복습: last.dueTomorrow }));
  }
}
