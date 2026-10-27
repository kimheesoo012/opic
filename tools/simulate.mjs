// 시드 기반 자동 시뮬레이션: 가상 학습자 수백 명이 2주 동안 진단 → 추천 → 연습 → 복습을 반복한다.
// 불변 조건(예외 없음, 점수 범위, 복습 단계, 추천 이유 등)을 검사하고 능력-추정 상관을 확인한다.
import fs from 'node:fs';
import path from 'node:path';
import { buildBank, questionsOf, targetSec } from '../toeic/js/bank.js';
import { makeRng, DAY, clamp } from '../toeic/js/util.js';
import { defaultState } from '../toeic/js/store.js';
import { estimate, pCorrect, diffToB, goalGap } from '../toeic/js/scoring.js';
import { recommend } from '../toeic/js/recommend.js';
import { newSession, reviewAdvance, makeAttempt, applyAttempt, reviewStepResult } from '../toeic/js/sessions.js';
import { CAUSES } from '../toeic/js/stats.js';

const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../toeic/data');
const concepts = JSON.parse(fs.readFileSync(path.join(dir, 'concepts.json'))).concepts;
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json')));
const units = idx.files.flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f))).units);
const bank = buildBank(units, concepts);

const RUNS = Number(process.argv[2] || 300);
const DAYS = Number(process.argv[3] || 14);
const fail = [];
const check = (cond, msg) => { if (!cond) fail.push(msg); };
const results = [];
let sessionsRun = 0;
let answers = 0;
const kindCount = {};

function runSession(s, env, learner, rng) {
  let guard = 0;
  while (s.cur < s.items.length && guard++ < 500) {
    const it = s.items[s.cur];
    if (it.type === 'concept') {
      reviewStepResult(s, it, env);
    } else {
      const unit = bank.unitById.get(it.unitId);
      check(!!unit, `unit 없음 ${it.unitId}`);
      for (const q of questionsOf(unit)) {
        const th = learner.ability + (learner.conceptOffset[q.concept] || 0);
        const p = pCorrect(th, diffToB(q.difficulty));
        const tgt = targetSec(bank, q, unit);
        let sec = clamp(tgt * learner.speed * Math.exp((rng() - 0.5) * 0.6), 2, 300);
        let correct = rng() < p;
        let choice = correct ? q.answer : (q.answer + 1 + rng.int(q.choices.length - 1)) % q.choices.length;
        if (s.perQ && s.autoNext && sec > s.perQ) { choice = -1; correct = false; sec = s.perQ; } // 연속 풀이 시간 초과
        s.answers[q.id] = { choice, sec };
        const a = makeAttempt(s, unit, q, choice, sec, env);
        if (!a.correct && rng() < 0.7) a.cause = rng.pick(CAUSES).id;
        env.state.attempts.push(a);
        applyAttempt(a, env);
        answers++;
        check(a.correct === (choice === q.answer), '정답 판정 오류');
      }
      if (s.kind === 'review' && it.focus) reviewStepResult(s, it, env);
    }
    s.cur++;
    if (s.kind === 'review' && s.cur >= s.items.length) reviewAdvance(s, env);
  }
  check(guard < 500, `세션 무한 루프 의심 (${s.kind})`);
  sessionsRun++;
  kindCount[s.kind] = (kindCount[s.kind] || 0) + 1;
}

for (let run = 0; run < RUNS; run++) {
  const rng = makeRng(1000 + run);
  const state = defaultState();
  state.profile.goal = rng.pick([800, 850, 900, 950, 990]);
  if (rng() < 0.5) state.profile.rcScore = null;
  const learner = { ability: (rng() - 0.5) * 3, speed: 0.7 + rng() * 0.9, conceptOffset: {} };
  for (const c of concepts) learner.conceptOffset[c.id] = (rng() - 0.5) * 1.2;
  let now = Date.UTC(2026, 9, 1, 9);
  for (let day = 0; day < DAYS; day++) {
    const env = { bank, state, rng, now };
    try {
      const est = estimate(state.attempts, { baseline: state.profile.rcScore || undefined });
      const R = est.rc;
      check(R.lo <= R.point && R.point <= R.hi, `RC 범위 역전 ${R.lo} ${R.point} ${R.hi}`);
      check(R.lo >= 5 && R.hi <= 495, 'RC 범위 밖');
      check(state.attempts.every((a) => a.part >= 5), 'LC 문항 출제됨');
      const gg = goalGap(est, state.profile.goal, state.profile.lcBase);
      check(gg.gap >= 0 && gg.want <= 495, 'goalGap 이상');
      const minutes = rng.pick([10, 20, 40]);
      const rec = recommend({ bank, attempts: state.attempts, cards: state.reviews, vocab: state.vocab, wrongNote: state.wrongNote, profile: state.profile, est, now, minutes });
      check(rec.course.length > 0, '추천 코스 비어 있음');
      for (const c of rec.course) {
        check(typeof c.reason === 'string' && c.reason.length > 5, `추천 이유 없음 ${c.kind}`);
        check(!/NaN|undefined|null/.test(c.reason + c.title), `추천 문구 이상: ${c.title} / ${c.reason}`);
        let kind = c.kind;
        let params = c.params || {};
        if (kind === 'diag') kind = 'diag';
        else if (kind === 'review') kind = 'review';
        else if (kind === 'drill') kind = 'drill';
        else if (['para', 'vocab'].includes(kind)) continue; // 훈련 화면(세션 아님)
        const s = newSession(kind, params, env);
        if (!s) { check(kind === 'review' || kind === 'wrongnote' || kind === 'overtime', `세션 생성 실패 ${kind} ${JSON.stringify(params)}`); continue; }
        runSession(s, env, learner, rng);
        now += 20 * 60 * 1000;
        env.now = now;
      }
      for (const card of Object.values(state.reviews)) {
        check(card.stage >= 1 && card.stage <= 8, `복습 단계 범위 밖 ${card.stage}`);
        check(Number.isFinite(card.due), '복습 due 오류');
      }
    } catch (e) {
      fail.push(`run ${run} day ${day}: ${e.stack}`);
      break;
    }
    now += DAY;
  }
  const est = estimate(state.attempts);
  results.push({ ability: learner.ability, point: est.rc.point, n: est.n, lo: est.rc.lo, hi: est.rc.hi });
  // 같은 문제 재풀이 표시 검증: repeat=true인 시도는 같은 qid가 이전에 있어야 함
  const firstSeen = new Map();
  for (const a of state.attempts) {
    if (a.repeat) check(firstSeen.has(a.qid) && firstSeen.get(a.qid) !== a.sessionId || firstSeen.has(a.qid), 'repeat 표시 오류');
    if (!firstSeen.has(a.qid)) firstSeen.set(a.qid, a.sessionId);
  }
}

// 순위 상관 (Spearman)
function rank(xs) { const s = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = []; s.forEach(([, i], k) => { r[i] = k; }); return r; }
const ra = rank(results.map((r) => r.ability));
const rp = rank(results.map((r) => r.point));
const n = results.length;
const d2 = ra.reduce((s, x, i) => s + (x - rp[i]) ** 2, 0);
const rho = 1 - (6 * d2) / (n * (n * n - 1));
const coverage = results.filter((r) => r.lo <= r.point && r.point <= r.hi).length / n;
const avgWidth = results.reduce((s, r) => s + (r.hi - r.lo), 0) / n;
check(rho > 0.6, `능력-추정 상관 낮음 ${rho.toFixed(2)}`);

console.log(`학습자 ${RUNS}명 × ${DAYS}일, 세션 ${sessionsRun}개, 응답 ${answers}개`);
console.log('세션 종류:', kindCount);
console.log(`능력-추정 점수 순위 상관 ρ=${rho.toFixed(3)}, 범위 폭 평균 ${avgWidth.toFixed(0)}점, 점추정이 범위 안 ${(coverage * 100).toFixed(0)}%`);
if (fail.length) {
  const uniq = [...new Set(fail)];
  console.log(`실패 ${fail.length}건 (고유 ${uniq.length})`);
  uniq.slice(0, 20).forEach((f) => console.log(' -', f));
  process.exit(1);
}
console.log('모든 불변 조건 통과');
