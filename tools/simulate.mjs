// 시드 기반 자동 시뮬레이션: 가상 학습자 수백 명이 2주 동안 진단 → 추천 → 연습 → 복습을 반복한다.
// 불변 조건(예외 없음, 점수 범위, 복습 단계, 추천 이유 등)을 검사하고 능력-추정 상관을 확인한다.
import fs from 'node:fs';
import path from 'node:path';
// TT_APP=toeic-ja 이면 일본어판 모듈과 문제로 돌린다
const APP = process.env.TT_APP || 'toeic';
const { buildBank, questionsOf, targetSec } = await import(`../${APP}/js/bank.js`);
const { makeRng, DAY, clamp, TARGETS } = await import(`../${APP}/js/util.js`);
const { defaultState } = await import(`../${APP}/js/store.js`);
const { estimate, pCorrect, diffToB, goalGap } = await import(`../${APP}/js/scoring.js`);
const { recommend } = await import(`../${APP}/js/recommend.js`);
const { newSession, reviewAdvance, makeAttempt, applyAttempt, reviewStepResult } = await import(`../${APP}/js/sessions.js`);
const { CAUSES } = await import(`../${APP}/js/stats.js`);
const G = await import(`../${APP}/js/game.js`);

const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), `../${APP}/data`);
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
  let answered = 0;
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
        G.addXp(env.state.game, G.attemptXp(a), a.t);
        answered++;
        answers++;
        check(a.correct === (choice === q.answer), '정답 판정 오류');
      }
      if (s.kind === 'review' && it.focus) reviewStepResult(s, it, env);
    }
    s.cur++;
    if (s.kind === 'review' && s.cur >= s.items.length) reviewAdvance(s, env);
  }
  check(guard < 500, `세션 무한 루프 의심 (${s.kind})`);
  if (answered >= 3) G.addXp(env.state.game, G.XP.session, env.now);
  sessionsRun++;
  kindCount[s.kind] = (kindCount[s.kind] || 0) + 1;
}

for (let run = 0; run < RUNS; run++) {
  const rng = makeRng(1000 + run);
  const state = defaultState();
  state.profile.goal = rng.pick(TARGETS);
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
      // 경험치·연속 기록 불변 조건
      const g = state.game;
      const si = G.streakInfo(g, now);
      check(g.total === Object.values(g.xp).reduce((x, y) => x + y, 0), 'XP 합계 불일치');
      check(si.days <= Object.keys(g.done).length + Object.keys(g.frozen).length && si.days >= (si.doneToday ? 1 : 0), `연속 일수 이상 ${si.days}`);
      check(g.freezes >= 0 && g.freezes <= G.FREEZE_MAX, '휴식권 범위 밖');
      const mm = G.masteryMap(state.attempts);
      check(Object.values(mm).every((m) => m.lv >= 1 && m.lv <= 5), '숙련도 범위 밖');
      G.checkBadges(g, { attempts: state.attempts, sessions: [], mastery: mm });
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
  // 모든 세션 종류를 한 번씩 만들어 구성 검사 (일부 학습자)
  if (run % 10 === 0) {
    const env = { bank, state, rng, now };
    const size = (ss) => ss.items.reduce((t, it) => t + (it.type === 'unit' ? questionsOf(bank.unitById.get(it.unitId)).length : 0), 0);
    const want = { diag: [25, 40], deep: [50, 70], mock: [42, 60], full: [95, 110], speed: [12, 12], p7time: [6, 10] };
    for (const [kind, [lo, hi]] of Object.entries(want)) {
      const ss = newSession(kind, {}, env);
      check(!!ss, `${kind} 세션 생성 실패`);
      if (!ss) continue;
      const n = size(ss);
      check(n >= lo && n <= hi, `${kind} 문항 수 ${n} (기대 ${lo}~${hi})`);
      const units = ss.items.map((it) => bank.unitById.get(it.unitId));
      check(units.every((u) => u.part >= 5), `${kind}에 LC 문항`);
      check(new Set(units.map((u) => u.id)).size === units.length, `${kind} 중복 세트`);
      if (kind === 'full') {
        const byP = {};
        for (const u of units) byP[u.part] = (byP[u.part] || 0) + questionsOf(u).length;
        const multi = units.filter((u) => u.part === 7 && u.passages.length > 1);
        check(byP[5] === 30 && byP[6] === 16, `실전 모의고사 P5/P6 문항 수 ${byP[5]}/${byP[6]}`);
        check(multi.filter((u) => u.passages.length === 2).length === 2 && multi.filter((u) => u.passages.length === 3).length === 3, '실전 모의고사 이중 2·삼중 3세트');
        check(ss.limitSec === 75 * 60, '실전 모의고사 75분');
      }
      if (kind === 'speed') check(ss.perQ === 20 && ss.autoNext, '연속 풀이 20초·자동 넘김');
      if (kind === 'p7time') check(ss.perSet && units.every((u) => u.part === 7), '지문별 시간 훈련 설정');
      kindCount['구성검사:' + kind] = (kindCount['구성검사:' + kind] || 0) + 1;
    }
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

// 연속 기록·휴식권 시나리오: 하루씩 건너뛰는 학습자
for (let run = 0; run < RUNS; run++) {
  const r = makeRng(50000 + run);
  const g = G.newGame();
  g.daily = r.pick(G.DAILY_GOALS);
  let t = Date.UTC(2026, 0, 1, 3);
  for (let day = 0; day < 120; day++, t += DAY) {
    const skip = r() < 0.15 + 0.2 * (run % 3);
    if (!skip) G.addXp(g, r() < 0.8 ? g.daily + r.int(30) : r.int(g.daily), t);
    G.settle(g, t + DAY);
    const si = G.streakInfo(g, t);
    check(si.days <= day + 1 && g.freezes >= 0 && g.freezes <= G.FREEZE_MAX, `휴식권 시나리오 범위 ${si.days} ${g.freezes}`);
    for (const d of Object.keys(g.frozen)) check(!g.done[d] && (g.done[G.shiftDay(d, -1)] || g.frozen[G.shiftDay(d, -1)]), `휴식권 사용 위치 오류 ${d}`);
  }
  check(g.best >= G.streakInfo(g, t).days, '최고 연속 기록 갱신 누락');
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
