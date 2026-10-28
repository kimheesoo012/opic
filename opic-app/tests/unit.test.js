/* 순수 로직 단위 테스트: node --test opic-app/tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const util = require('../js/core/util.js');
const survey = require('../js/data/survey.js');
const bank = require('../js/data/questions.js');
const drills = require('../js/data/drills.js');
const analysis = require('../js/core/analysis.js');
const prompt = require('../js/core/prompt.js');
const picker = require('../js/core/picker.js');
const quiz = require('../js/core/quiz.js');
const script = require('../js/core/script.js');
const backup = require('../js/core/backup.js');

test('문제은행: id·문장 중복 없음, 모든 유형 존재, 설문 선택지가 모두 주제로 연결', () => {
  const ids = new Set(), texts = new Set();
  bank.QUESTIONS.forEach(q => {
    assert.ok(!ids.has(q.id), 'dup id ' + q.id); ids.add(q.id);
    const t = q.text.toLowerCase(); assert.ok(!texts.has(t), 'dup text ' + q.id); texts.add(t);
    assert.ok(bank.TYPE_LABELS[q.type], 'bad type ' + q.id);
    assert.ok([1, 2, 3].includes(q.level));
    assert.ok(/[?.]$/.test(q.text.trim()), 'ends with punctuation ' + q.id);
    assert.ok(!/\s{2,}/.test(q.text), 'double space ' + q.id);
  });
  Object.keys(bank.TYPE_LABELS).forEach(t => assert.ok(bank.QUESTIONS.some(q => q.type === t), 'missing type ' + t));
  Object.values(survey.SURVEY_TOPIC_MAP).forEach(t => assert.ok(bank.topicById[t], 'no topic ' + t));
  ['leisure', 'hobby', 'sport', 'travel'].forEach(g => survey.SURVEY[g].forEach(([id]) => {
    if (id !== 'nosport') assert.ok(survey.SURVEY_TOPIC_MAP[id], 'unmapped survey option ' + id);
  }));
  assert.ok(bank.QUESTIONS.filter(q => q.cat === 'surprise').length >= 40);
});

test('녹음 에너지 분석: 말한 비율·중간 무음·첫 마디', () => {
  const env = [].concat(Array(20).fill(2), Array(50).fill(120), Array(30).fill(3), Array(40).fill(110), Array(10).fill(2));
  const r = analysis.analyzeEnvelope(env, 10);
  assert.equal(r.totalSec, 15);
  assert.ok(Math.abs(r.speechSec - 9) < 0.3, 'speech ' + r.speechSec);
  assert.equal(r.pauses.length, 1);
  assert.ok(Math.abs(r.pauses[0].len - 3) < 0.2);
  assert.ok(Math.abs(r.firstSpeechSec - 2) < 0.2);
  assert.equal(analysis.analyzeEnvelope([], 10).speechRatio, 0);
});

test('받아쓴 글 규칙 분석: 군말·연결어·과거 시제·시간 표현·반복', () => {
  const t = 'Um, last summer I went to Busan with my friends. Uh, at first it was raining, but after that the weather got better. ' +
    'I mean, we were so excited because we visited the beach, and the beach was beautiful. The beach, like, was amazing. Anyway, in the end we had a great time.';
  const r = analysis.analyzeTranscript(t, 60);
  assert.ok(r.wordCount > 40);
  assert.equal(r.wpm, r.wordCount);
  assert.equal(r.fillers.items.um, 1);
  assert.equal(r.fillers.items.uh, 1);
  assert.equal(r.fillers.items['I mean'], 1);
  assert.ok(r.fillers.items.like >= 1);
  assert.ok(r.connectors.distinct.includes('but'));
  assert.ok(r.connectors.distinct.includes('after that'));
  assert.ok(r.connectors.distinct.includes('anyway'));
  assert.ok(r.connectors.distinct.includes('in the end'));
  assert.ok(r.past.verbCount >= 6);
  assert.ok(r.past.timeExpr.includes('last summer'));
  assert.ok(r.repeats.some(x => x.word === 'beach'));
  /* '좋아하다' like는 군말로 세지 않는다 */
  assert.equal(analysis.analyzeTranscript('I like coffee and I would like to go.', 10).fillers.items.like, undefined);
  assert.equal(analysis.analyzeTranscript('', 10).wordCount, 0);
});

test('목표 표현 사용 힌트', () => {
  assert.ok(analysis.containsExpression('So I ended up staying home all day.', 'I ended up ...'));
  assert.ok(!analysis.containsExpression('I stayed home.', 'Looking back, ...'));
});

test('AI 첨삭 프롬프트: 지정 형식 그대로 + 자리표시자 치환', () => {
  const p = prompt.buildCoachPrompt({ targetLevel: 'AL', question: 'Tell me about a trip.', transcript: 'I went to Jeju.', durationSec: 83 });
  assert.ok(p.startsWith('당신은 영어 OPIc 말하기 코치입니다. 학습자의 현재 수준은 IM1이며, 목표는 AL입니다.'));
  assert.ok(p.includes('[질문] Tell me about a trip.'));
  assert.ok(p.includes('[학습자 답변] I went to Jeju.'));
  assert.ok(p.includes('[답변 시간] 1분 23초'));
  assert.ok(p.includes('7. 다음 녹음에서 꼭 써 볼 표현 3개를 골라 주세요.'));
  assert.ok(!/\{\{/.test(p));
  assert.deepEqual(prompt.parseExpressions('1. I ended up ...\n- It turned out that\n• "Looking back,"\n설명 줄'), ['I ended up ...', 'It turned out that', 'Looking back,']);
});

test('실전 시험 구성: 단계별 문항 수, 1번 자기소개, 중복 없음, 재조정 반영', () => {
  const sv = { job: 'nojob', student: 'no_old', home: 'alone', picks: survey.SEED_PRESETS[0].picks };
  for (const sa of [1, 2, 3, 4, 5, 6]) {
    for (const adj of ['easier', 'same', 'harder']) {
      const rng = util.seededRng(sa + adj);
      const s1 = picker.buildSession1(sv, sa, {}, rng);
      assert.equal(s1.questions.length, 7, `session1 sa${sa}`);
      assert.equal(s1.questions[0].type, 'intro');
      const s2 = picker.buildSession2(s1.plan, adj, {}, rng);
      const all = s1.questions.concat(s2);
      assert.equal(all.length, sa <= 2 ? 12 : 15, `total sa${sa} ${adj}`);
      assert.equal(new Set(all.map(q => q.id)).size, all.length, 'no duplicates');
      if (sa >= 3) assert.ok(s2.some(q => q.type === 'rp_ask'), 'roleplay present');
      if (adj === 'harder' && sa >= 5) assert.ok(s2.slice(-2).every(q => q.level === 3), 'hard finals');
    }
  }
});

test('반복 출제 방지 + 복습 지정 문제는 다시 출제', () => {
  const sv = { job: 'nojob', student: 'no_old', home: 'alone', picks: ['movie', 'cafe'] };
  const qs = {};
  const first = picker.buildSession1(sv, 5, qs, util.seededRng('a')).questions;
  first.forEach(q => { qs[q.id] = { qid: q.id, lastAskedAt: Date.now(), review: false }; });
  const second = picker.buildSession1(sv, 5, qs, util.seededRng('b')).questions;
  const overlap = second.filter(q => first.some(f => f.id === q.id) && q.type !== 'intro');
  assert.equal(overlap.length, 0, 'should prefer unseen questions');
  const target = first[2];
  qs[target.id].review = true;
  const third = picker.practiceSet({ topic: target.topic }, qs, util.seededRng('c'));
  assert.ok(third.some(q => q.id === target.id), 'review-flagged question re-asked');
});

test('재도전 일정(3일·7일)과 녹음 구분', () => {
  const t0 = Date.UTC(2026, 0, 1);
  const r = picker.scheduleRetries(t0);
  assert.equal(r.length, 2);
  assert.equal(r[0].due - t0, 3 * util.DAY);
  assert.equal(r[1].due - t0, 7 * util.DAY);
  const s = { qid: 'x', feedback: { savedAt: t0 }, retries: r };
  assert.equal(picker.recordingKind(null, t0), 'first');
  assert.equal(picker.recordingKind(s, t0 + 3600e3), 'after');
  assert.equal(picker.recordingKind(s, t0 + 3 * util.DAY), 'later');
  assert.equal(picker.dueRetries({ x: s }, t0 + 4 * util.DAY).length, 1);
  picker.markRetryDone(s, t0 + 4 * util.DAY);
  assert.equal(picker.dueRetries({ x: s }, t0 + 4 * util.DAY).length, 0);
  assert.equal(picker.dueRetries({ x: s }, t0 + 8 * util.DAY).length, 1);
});

test('오늘의 3문제: 약한 유형 위주', () => {
  const recs = bank.QUESTIONS.filter(q => q.type === 'describe').slice(0, 10).map((q, i) => ({ id: 'r' + i, questionId: q.id, selfCheck: {} }));
  const weak = picker.weakGroups(recs);
  assert.notEqual(weak[0].id, 'describe');
  const d = picker.dailyThree(recs, {}, Date.now(), util.seededRng('d'));
  assert.equal(d.length, 3);
  assert.ok(d.every(x => x.q.type !== 'describe' || x.why.includes('약한')));
});

test('표현 퀴즈: 보기 4개, 정답 1개, 문제 문장과 같은 보기 없음, 형식 통일', () => {
  const notes = [
    { id: 'n1', original: 'I very like it', corrected: 'I really like it.' },
    { id: 'n2', original: 'I went to there', corrected: 'I went there.' },
    { id: 'n3', original: 'It was very funny time', corrected: 'We had a lot of fun.' }
  ];
  const items = quiz.buildQuiz(notes, drills.DISTRACTOR_POOL, 10, util.seededRng('q'));
  assert.equal(items.length, 3);
  items.forEach(it => {
    assert.equal(it.options.length, 4);
    assert.equal(it.options.filter(o => o === it.answer).length, 1);
    assert.equal(new Set(it.options.map(o => o.toLowerCase())).size, 4);
    it.options.forEach(o => { assert.ok(!/[.!?]$/.test(o)); assert.equal(o[0], o[0].toUpperCase()); });
    assert.ok(!it.options.some(o => o.toLowerCase() === quiz.canon(it.prompt).toLowerCase()));
  });
});

test('스크립트: 문장 나누기, 단계별 가리기, 원문 비교', () => {
  const t = 'My favorite cafe is near my school. It has big windows and comfortable chairs! I go there twice a week.';
  const s = script.splitSentences(t);
  assert.equal(s.length, 3);
  assert.ok(script.maskSentence(s[0], 0, 'x').every(x => x.show));
  assert.ok(script.maskSentence(s[0], 4, 'x').every(x => !x.show));
  const kw = script.maskSentence(s[1], 2, 'x').filter(x => x.show);
  assert.ok(kw.length >= 1 && kw.length <= 3);
  const c = script.compare(t, 'my favorite cafe is near my school it has windows and chairs i go there twice a week');
  assert.ok(c.coverage > 0.85 && c.coverage < 1);
  assert.ok(c.missed.includes('big'));
  const bulk = script.parseBulk('## 카페\nI like cafes.\n\n## 여행\nI went to Jeju.');
  assert.equal(bulk.length, 2);
  assert.equal(bulk[1].title, '여행');
});

test('백업 검증: 올바른 파일 통과, 잘못된 파일 거부', () => {
  const ok = { format: backup.FORMAT, version: 1, data: { recordings: [{ id: 'r1' }], notes: [], qstate: [{ qid: 'a' }], kv: [{ k: 'x', v: 1 }] } };
  assert.ok(backup.validateBackup(ok).ok);
  assert.ok(!backup.validateBackup(null).ok);
  assert.ok(!backup.validateBackup({ format: 'other', version: 1, data: {} }).ok);
  assert.ok(!backup.validateBackup(Object.assign({}, ok, { version: 99 })).ok);
  assert.ok(!backup.validateBackup({ format: backup.FORMAT, version: 1, data: { recordings: [{}] } }).ok);
  assert.ok(!backup.validateBackup({ format: backup.FORMAT, version: 1, data: { recordings: 'x' } }).ok);
  assert.ok(!backup.validateBackup({ format: backup.FORMAT, version: 1, data: { audio: [{ id: 'a', data: '!!!' }] } }).ok);
});

test('연속 학습 일수', () => {
  const now = new Date(2026, 9, 26, 12).getTime();
  const k = d => util.dayKey(now - d * util.DAY);
  assert.equal(util.streak([k(0), k(1), k(2), k(4)], now), 3);
  assert.equal(util.streak([k(1), k(2)], now), 2);
  assert.equal(util.streak([k(3)], now), 0);
});

test('서비스 워커가 앱 파일을 모두 미리 저장', () => {
  const root = path.join(__dirname, '..');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m => m[1]);
  refs.forEach(r => {
    assert.ok(fs.existsSync(path.join(root, r)), 'missing file ' + r);
    assert.ok(sw.includes(`'./${r}'`), 'sw missing ' + r);
  });
});

const xp = require('../js/core/xp.js');

test('XP: 녹음 XP·레벨 구간', () => {
  assert.equal(xp.recordingXP({ durationSec: 20 }), 10);
  assert.equal(xp.recordingXP({ durationSec: 95 }), 16);
  assert.equal(xp.recordingXP({ durationSec: 600 }), 18);
  assert.equal(xp.recordingXP({ durationSec: 1 }), 2);
  assert.equal(xp.recordingXP({ mode: 'story-step', durationSec: 60 }), 4);
  assert.equal(xp.levelInfo(0).level, 1);
  assert.equal(xp.levelInfo(49).level, 1);
  assert.equal(xp.levelInfo(50).level, 2);
  const l = xp.levelInfo(1000 + 450);
  assert.equal(l.level, 9); assert.ok(l.pct > 0 && l.pct < 1);
});

test('연속 학습 보호권: 하루 빠지면 메우고, 보호권보다 길게 빠지면 끊김', () => {
  const now = new Date(2026, 9, 26, 12).getTime();
  const k = d => util.dayKey(now - d * util.DAY);
  const st = { days: { [k(2)]: 20, [k(3)]: 20, [k(4)]: 10 }, frozen: [], freezes: 1 };
  assert.equal(xp.streakInfo(st, now).streak, 0);
  assert.deepEqual(xp.applyFreezes(st, now), [k(1)]);
  assert.equal(st.freezes, 0);
  assert.equal(xp.streakInfo(st, now).streak, 4);
  const st2 = { days: { [k(3)]: 20 }, frozen: [], freezes: 1 };
  assert.deepEqual(xp.applyFreezes(st2, now), []);
  assert.equal(st2.freezes, 1);
  const st3 = { days: { [k(0)]: 5 }, frozen: [], freezes: 0 };
  assert.deepEqual(xp.applyFreezes(st3, now), []);
});

test('7일 연속마다 보호권 1개(최대 2개), 최고 연속 기록', () => {
  const now = new Date(2026, 9, 26, 12).getTime();
  const days = {}; for (let i = 0; i < 7; i++) days[util.dayKey(now - i * util.DAY)] = 10;
  const st = { days, frozen: [], freezes: 0 };
  assert.ok(xp.maybeEarnFreeze(st, now)); assert.equal(st.freezes, 1);
  assert.ok(!xp.maybeEarnFreeze(st, now), '같은 날 두 번 받지 않음');
  assert.equal(xp.bestStreak(st), 7);
});

test('배지·숙련도·성장 비교', () => {
  const qids = bank.QUESTIONS.filter(q => q.type === 'past').slice(0, 8).map(q => q.id);
  const recs = qids.map((id, i) => ({ id: 'r' + i, questionId: id, mode: 'card', kind: i > 5 ? 'after' : 'first', createdAt: 1000 + i * util.DAY,
    durationSec: 30 + i * 15, audioStats: { speechRatio: 0.5 + i * 0.04, pauses: [] }, selfCheck: { bg: true, event: i > 3 },
    transcript: i > 4 ? 'Last year I went there, and then after that we ate, but it was fun because so' : '' }));
  const state = { total: 0, days: {}, badges: {}, flags: {}, goalDays: [] };
  const got = xp.newBadges({ recs, qs: {}, notes: [], sessions: [], state, groups: bank.FOCUS_GROUPS, byId: bank.byId }).map(b => b.id);
  assert.ok(got.includes('first'));
  assert.ok(!got.includes('rec10'));
  const m = xp.mastery(recs, { [qids[6]]: { feedback: { savedAt: 1 } } }, bank.FOCUS_GROUPS, bank.byId);
  const past = m.find(x => x.id === 'past');
  assert.equal(past.questions, 8); assert.equal(past.cycles, 1); assert.ok(past.score > 0.4 && past.score < 1);
  assert.equal(m.find(x => x.id === 'issue').score, 0);
  const g = xp.growth(recs, analysis.analyzeTranscript);
  assert.ok(g.ready);
  const dur = g.items.find(x => x.key === 'dur');
  assert.ok(dur.b > dur.a);
  assert.ok(!xp.growth(recs.slice(0, 3), analysis.analyzeTranscript).ready);
});

test('기존 기록으로 XP 처음 계산', () => {
  const s = xp.backfill([{ createdAt: Date.now(), durationSec: 60, transcript: 'hi' }], { a: { feedback: { savedAt: Date.now() } } }, [{ createdAt: Date.now() }]);
  assert.equal(s.total, 14 + 3 + 10 + 2);
  assert.equal(Object.values(s.days)[0], s.total);
});
