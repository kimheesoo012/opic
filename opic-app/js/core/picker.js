/* 문제 선택·실전 시험 구성·재도전 일정
   qs: { [questionId]: { lastAskedAt, timesAsked, review, feedback:{savedAt,...}, retries:[{due,label,doneAt}] } } */
(function (root) {
  'use strict';
  const bank = root.OPIC && root.OPIC.bank || (typeof require !== 'undefined' ? require('../data/questions.js') : null);
  const survey = root.OPIC && root.OPIC.survey || (typeof require !== 'undefined' ? require('../data/survey.js') : null);
  const util = root.OPIC && root.OPIC.util || (typeof require !== 'undefined' ? require('./util.js') : null);
  const DAY = util.DAY;

  /* 같은 질문을 반복 출제하지 않는다. 단, 사용자가 '복습 지정'한 질문은 우선 출제 */
  function priority(q, qs, rng) {
    const s = qs[q.id];
    if (s && s.review) return 0 + rng() * 0.01;
    if (!s || !s.lastAskedAt) return 1 + rng() * 0.5;
    return 2 + (1 - Math.min(1, (Date.now() - s.lastAskedAt) / (60 * DAY))) + rng() * 0.01;
  }
  function pickFrom(cands, qs, used, rng) {
    const avail = cands.filter(q => !used.has(q.id));
    if (!avail.length) return null;
    avail.sort((a, b) => priority(a, qs, rng) - priority(b, qs, rng));
    const q = avail[0];
    used.add(q.id);
    return q;
  }

  function surveyTopics(sv) {
    const set = new Set();
    (sv.picks || []).forEach(p => { const t = survey.SURVEY_TOPIC_MAP[p]; if (t) set.add(t); });
    const list = Array.from(set);
    if (sv.home && sv.home !== 'barracks') list.push('home');
    if (sv.student === 'yes') list.push('school');
    if (sv.job && sv.job !== 'nojob' && sv.job !== 'military') list.push('work');
    return list;
  }

  /* 한 주제에서 유형 패턴대로 3문제 콤보를 만든다. pattern 원소는 유형 배열(앞쪽 우선) */
  function comboFromTopic(topicId, pattern, qs, used, rng, levelRange) {
    const lv = levelRange || [1, 3];
    const pool = bank.QUESTIONS.filter(q => q.topic === topicId && q.level >= lv[0] && q.level <= lv[1]);
    const out = [];
    pattern.forEach(types => {
      let q = null;
      for (const t of types) { q = pickFrom(pool.filter(x => x.type === t), qs, used, rng); if (q) break; }
      if (!q) q = pickFrom(bank.QUESTIONS.filter(x => x.topic === topicId), qs, used, rng);
      if (q) out.push(q);
    });
    return out;
  }
  function topicScore(topicId, qs) {
    /* 최근에 덜 나온 주제부터 */
    const qsOfTopic = bank.QUESTIONS.filter(q => q.topic === topicId);
    const last = Math.max(0, ...qsOfTopic.map(q => (qs[q.id] && qs[q.id].lastAskedAt) || 0));
    const review = qsOfTopic.some(q => qs[q.id] && qs[q.id].review);
    return review ? -1 : last;
  }
  function chooseTopics(cands, n, qs, rng, exclude) {
    const ex = exclude || new Set();
    const list = util.shuffle(cands.filter(t => !ex.has(t)), rng);
    list.sort((a, b) => topicScore(a, qs) - topicScore(b, qs));
    return list.slice(0, n);
  }

  function examLength(sa) { return sa <= 2 ? 12 : 15; }
  function levelBand(sa) { return sa <= 2 ? [1, 1] : sa <= 4 ? [1, 2] : [1, 3]; }

  const P_BASIC = [['describe'], ['routine', 'describe'], ['past']];
  const P_EASY = [['describe'], ['routine'], ['past', 'describe']];
  const P_HARD = [['describe', 'compare'], ['compare', 'past'], ['issue', 'past', 'compare']];

  /* 1차 세션(1~7번): 자기소개 → 설문 주제 콤보 → (5~6단계) 돌발 콤보 / (1~4단계) 두 번째 설문 콤보 */
  function buildSession1(sv, sa, qs, rng) {
    rng = rng || Math.random;
    const used = new Set();
    const topics = surveyTopics(sv);
    const surveyCands = topics.length >= 2 ? topics : topics.concat(['home', 'movie', 'cafe'].filter(t => !topics.includes(t)));
    const surpriseCands = bank.TOPICS.filter(t => t.cat === 'surprise').map(t => t.id);
    const chosen = chooseTopics(surveyCands, 2, qs, rng);
    const surprise = chooseTopics(surpriseCands, 2, qs, rng);
    const band = levelBand(sa);
    const plan = { sa, total: examLength(sa), topicA: chosen[0], topicB: chosen[1] || chosen[0], surprise: surprise[0], surprise2: surprise[1], used: [] };
    const q = [];
    q.push(pickFrom(bank.QUESTIONS.filter(x => x.type === 'intro'), qs, used, rng));
    q.push(...comboFromTopic(plan.topicA, sa <= 2 ? P_EASY : P_BASIC, qs, used, rng, band));
    if (sa >= 5) q.push(...comboFromTopic(plan.surprise, P_BASIC, qs, used, rng, band));
    else q.push(...comboFromTopic(sa <= 2 ? plan.surprise : plan.topicB, P_EASY, qs, used, rng, [1, 2]));
    plan.used = Array.from(used);
    return { plan, questions: q.filter(Boolean) };
  }

  /* 2차 세션(8번~): 난이도 재조정 결과(easier/same/harder)에 따라 구성 */
  function buildSession2(plan, adjust, qs, rng) {
    rng = rng || Math.random;
    const used = new Set(plan.used);
    const sa = plan.sa;
    const q = [];
    const rpSets = bank.TOPICS.filter(t => t.cat === 'roleplay' && t.id !== 'rp_interviewer').map(t => t.id);
    const rp = chooseTopics(rpSets, 1, qs, rng)[0];
    const rpPool = bank.QUESTIONS.filter(x => x.topic === rp);
    const interviewer = bank.QUESTIONS.filter(x => x.topic === 'rp_interviewer');
    const issuePool = bank.QUESTIONS.filter(x => x.level === 3 && (x.type === 'issue' || x.type === 'compare'));

    /* 8~10번 */
    /* 1차에서 안 쓴 쪽: 5~6단계·1~2단계는 두 번째 설문 주제, 3~4단계는 돌발 주제 */
    const next = (sa >= 5 || sa <= 2) ? plan.topicB : plan.surprise;
    if (adjust === 'easier') {
      const easyTopic = chooseTopics(['s_family', 's_weekend', 's_food'], 1, qs, rng)[0];
      q.push(...comboFromTopic(easyTopic, P_EASY, qs, used, rng, [1, 1]));
    } else if (adjust === 'harder') {
      q.push(...comboFromTopic(next, P_HARD, qs, used, rng, [1, 3]));
    } else {
      q.push(...comboFromTopic(next, P_BASIC, qs, used, rng, levelBand(sa)));
    }

    if (plan.total === 12) {
      /* 1·2단계: 롤플레이 질문하기 2문제 */
      q.push(pickFrom(rpPool.filter(x => x.type === 'rp_ask'), qs, used, rng));
      q.push(pickFrom(interviewer, qs, used, rng));
      return q.filter(Boolean);
    }
    /* 11~13번: 롤플레이 (질문하기 → 문제 해결 → 관련 경험) */
    q.push(pickFrom(rpPool.filter(x => x.type === 'rp_ask'), qs, used, rng));
    if (adjust === 'easier' && sa <= 4) q.push(pickFrom(interviewer, qs, used, rng));
    else q.push(pickFrom(rpPool.filter(x => x.type === 'rp_solve'), qs, used, rng));
    q.push(pickFrom(rpPool.filter(x => x.type === 'past'), qs, used, rng));

    /* 14~15번 */
    if (adjust === 'easier') {
      q.push(pickFrom(bank.QUESTIONS.filter(x => x.cat === 'surprise' && x.level === 1 && x.type === 'describe'), qs, used, rng));
      q.push(pickFrom(interviewer, qs, used, rng));
    } else if (sa <= 4 && adjust !== 'harder') {
      q.push(pickFrom(bank.QUESTIONS.filter(x => x.type === 'compare' && x.level === 2), qs, used, rng));
      q.push(pickFrom(interviewer, qs, used, rng));
    } else {
      q.push(pickFrom(issuePool.filter(x => x.type === 'compare'), qs, used, rng));
      q.push(pickFrom(issuePool.filter(x => x.type === 'issue'), qs, used, rng));
    }
    return q.filter(Boolean);
  }

  /* 짧은 연습: 유형 집중(서로 다른 주제 3문제) 또는 주제 콤보(같은 주제 3문제) */
  function practiceSet(o, qs, rng) {
    rng = rng || Math.random;
    const used = new Set();
    if (o.topic) return comboFromTopic(o.topic, o.topic.startsWith('rp_') ? [['rp_ask'], ['rp_solve', 'rp_ask'], ['past']] : P_BASIC, qs, used, rng);
    const g = bank.FOCUS_GROUPS.find(x => x.id === o.focus) || bank.FOCUS_GROUPS[0];
    const pool = bank.QUESTIONS.filter(g.match);
    if (g.id === 'roleplay') {
      const set = chooseTopics(bank.TOPICS.filter(t => t.cat === 'roleplay' && t.id !== 'rp_interviewer').map(t => t.id), 1, qs, rng)[0];
      return comboFromTopic(set, [['rp_ask'], ['rp_solve'], ['past']], qs, used, rng);
    }
    const out = [];
    const topicsUsed = new Set();
    for (let i = 0; i < 3; i++) {
      const q = pickFrom(pool.filter(x => !topicsUsed.has(x.topic)), qs, used, rng) || pickFrom(pool, qs, used, rng);
      if (!q) break;
      topicsUsed.add(q.topic);
      out.push(q);
    }
    return out;
  }

  /* 유형별 연습 횟수 → 약한 유형(연습이 적거나 자가 체크 달성률이 낮은 유형) */
  function weakGroups(recs) {
    const stat = {};
    bank.FOCUS_GROUPS.forEach(g => { stat[g.id] = { id: g.id, label: g.label, count: 0, checks: 0, checked: 0 }; });
    recs.forEach(r => {
      const q = bank.byId[r.questionId];
      if (!q) return;
      bank.FOCUS_GROUPS.forEach(g => {
        if (!g.match(q)) return;
        const s = stat[g.id];
        s.count++;
        const sc = r.selfCheck || {};
        const vals = Object.values(sc);
        s.checks += vals.length; s.checked += vals.filter(Boolean).length;
      });
    });
    return Object.values(stat).map(s => Object.assign(s, { rate: s.checks ? s.checked / s.checks : null }))
      .sort((a, b) => (a.count - b.count) || ((a.rate == null ? 0 : a.rate) - (b.rate == null ? 0 : b.rate)));
  }

  /* 오늘의 3문제: 재도전 예정 문제 먼저, 나머지는 약한 유형에서 */
  function dailyThree(recs, qs, now, rng) {
    rng = rng || Math.random;
    const out = [];
    const used = new Set();
    dueRetries(qs, now).slice(0, 2).forEach(d => { const q = bank.byId[d.questionId]; if (q) { out.push({ q, why: `재도전 (${d.label})` }); used.add(q.id); } });
    const weak = weakGroups(recs);
    let gi = 0;
    while (out.length < 3 && gi < weak.length * 2) {
      const g = bank.FOCUS_GROUPS.find(x => x.id === weak[gi % weak.length].id);
      const q = pickFrom(bank.QUESTIONS.filter(g.match), qs, used, rng);
      if (q) out.push({ q, why: `약한 유형: ${g.label}` });
      gi++;
    }
    return out;
  }

  /* 첨삭 저장 후 3일·7일 뒤 재도전 */
  function scheduleRetries(savedAt) {
    return [{ due: savedAt + 3 * DAY, label: '3일 뒤', doneAt: null }, { due: savedAt + 7 * DAY, label: '7일 뒤', doneAt: null }];
  }
  function dueRetries(qs, now) {
    now = now || Date.now();
    const out = [];
    Object.keys(qs).forEach(id => {
      const s = qs[id];
      (s.retries || []).forEach(r => { if (!r.doneAt && r.due <= now) out.push({ questionId: id, label: r.label, due: r.due }); });
    });
    return out.sort((a, b) => a.due - b.due);
  }
  function upcomingRetries(qs, now) {
    now = now || Date.now();
    const out = [];
    Object.keys(qs).forEach(id => (qs[id].retries || []).forEach(r => { if (!r.doneAt && r.due > now) out.push({ questionId: id, label: r.label, due: r.due }); }));
    return out.sort((a, b) => a.due - b.due);
  }
  /* 재녹음 시 해당 시점의 재도전 항목을 완료 처리 */
  function markRetryDone(s, now) {
    now = now || Date.now();
    let changed = false;
    (s.retries || []).forEach(r => { if (!r.doneAt && r.due <= now) { r.doneAt = now; changed = true; } });
    return changed;
  }

  /* 녹음 구분: 첫 답변 / 피드백 후 / 며칠 뒤 */
  const KIND_LABELS = { first: '첫 답변', after: '피드백 후', later: '며칠 뒤' };
  function recordingKind(s, now) {
    now = now || Date.now();
    if (!s || !s.feedback || !s.feedback.savedAt) return 'first';
    return now - s.feedback.savedAt >= 2 * DAY ? 'later' : 'after';
  }

  const api = { surveyTopics, buildSession1, buildSession2, examLength, practiceSet, weakGroups, dailyThree,
    scheduleRetries, dueRetries, upcomingRetries, markRetryDone, recordingKind, KIND_LABELS, comboFromTopic };
  root.OPIC = root.OPIC || {};
  root.OPIC.picker = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
