// 오늘의 학습 추천 (RC 전용). 정답률·풀이 시간·오답 원인·최근 변화·목표와의 차이를 반영해
// 공부 시간 대비 효과가 큰 활동부터 고른다. 추천마다 이유 한 문장.
import { pct, REAL_COUNTS, PART_NAMES, DAY, RC_PARTS } from './util.js';
import { conceptStats, partStats, causeDist, overtimeQids } from './stats.js';
import { dueCards } from './review.js';
import { goalGap } from './scoring.js';
import { conceptName } from './bank.js';

const MIN_PER_Q = { 5: 0.4, 6: 0.6, 7: 1.1 };
const MIN_N = 4; // 이보다 적게 푼 유형은 약점으로 단정하지 않는다

function conceptShare(bank) {
  const share = new Map();
  for (const [concept, refs] of bank.byConcept) {
    const part = refs[0].unit.part;
    const partTotal = bank.count(part) || 1;
    share.set(concept, { part, realQ: (REAL_COUNTS[part] * refs.length) / partTotal });
  }
  return share;
}

export function recommend(ctx) {
  const { bank, attempts, cards, vocab, wrongNote, profile, est } = ctx;
  const now = ctx.now || Date.now();
  const budget = ctx.minutes || 20;
  const goal = profile.goal || 800;
  const scored = attempts.filter((a) => RC_PARTS.includes(a.part));
  const cands = [];
  const totalN = est.n;

  if (totalN < 15) {
    cands.push({
      kind: 'diag', title: '간단 진단', minutes: 20, score: 1000,
      reason: totalN ? `기록이 ${totalN}문항뿐이라 약점 파트를 판단하기 어려움. 세 파트를 고르게 진단.` : '기록이 없어 약점 파트를 알 수 없음. 세 파트를 고르게 진단.',
      params: { kind: 'quick' },
    });
  }

  const due = dueCards(cards, now);
  if (due.length) {
    const names = due.slice(0, 2).map((c) => conceptName(bank, c.concept)).join(', ');
    cands.push({
      kind: 'review', title: `단계별 복습 ${due.length}개 유형`, minutes: Math.min(due.length, 4) * 3, score: 500 + due.length,
      reason: `틀렸던 ${names}${due.length > 2 ? ' 등' : ''}을 복습할 시기. 새 문제로 다시 확인.`,
      params: { concepts: due.slice(0, 4).map((c) => c.concept) },
    });
  }

  const gg = goalGap(est, goal, profile.lcBase ?? 395);
  const ps = partStats(scored);
  const cs = conceptStats(scored);
  const share = conceptShare(bank);

  if (totalN >= 15) {
    for (const p of RC_PARTS) {
      if (ps[p].n < 6) {
        const nQ = p === 5 ? 8 : p === 6 ? 4 : 5;
        cands.push({
          kind: 'drill', title: `Part ${p} ${PART_NAMES[p]} 기본 연습`, minutes: Math.ceil(nQ * MIN_PER_Q[p]) + 1, score: 30 + REAL_COUNTS[p] / 2,
          reason: `Part ${p} 기록이 ${ps[p].n}문항뿐이라 실력을 판단하기 어려움. 먼저 기록을 모음.`,
          params: { part: p, nQ },
        });
      }
    }
  }

  // 유형별 정확도 훈련
  for (const [concept, s] of cs) {
    const meta = share.get(concept);
    if (!meta || s.n < MIN_N) continue;
    const part = meta.part;
    const need = gg.parts[part] ? gg.parts[part].need : 0.85;
    const shrunk = (s.correct + need * 2) / (s.n + 2);
    const gap = need - shrunk;
    const slow = s.medRatio != null && s.medRatio > 1.3;
    const dropping = s.recentAcc != null && s.prevAcc != null && s.recentAcc < s.prevAcc - 0.2;
    if (gap <= 0.03 && !dropping) continue;
    const nQ = 6;
    const minutes = Math.max(3, Math.round(nQ * MIN_PER_Q[part]));
    const gain = Math.max(0.02, gap) * meta.realQ * 5 * (dropping ? 1.3 : 1);
    let reason = `${conceptName(bank, concept)} 정답률 ${pct(s.acc)}%, ${s.n}문항.`;
    if (slow) reason += ` 평균 ${Math.round(s.avgSec)}초로 목표 ${s.target}초보다 느림.`;
    else if (dropping) reason += ` 최근 ${pct(s.recentAcc)}%로 하락.`;
    else reason += ` RC ${gg.want}점에 필요한 약 ${pct(need)}%보다 낮음.`;
    cands.push({ kind: 'drill', title: `${conceptName(bank, concept)} 집중`, minutes, score: (gain / minutes) * 10, reason, params: { concept, nQ, part } });
  }

  // Part 5: 정확한데 느리면 문제 추가보다 속도 훈련
  const p5 = ps[5];
  if (p5.n >= 8 && p5.acc >= 0.7 && p5.medRatio >= 1.2) {
    const lost = (est.rc.unanswered || 0) * 5 * 0.6 + (p5.medRatio - 1) * 15;
    cands.push({
      kind: 'speed', title: 'Part 5 연속 풀이', minutes: 5, score: (lost / 5) * 10 + 5,
      reason: `Part 5 정답률 ${pct(p5.acc)}%로 정확하지만 문항당 평균 ${Math.round(p5.avgSec)}초. 목표 20초에 맞추는 속도 훈련.`,
      params: { nQ: 12 },
    });
  }

  // Part 7: 시간 여유 + 정답률 낮음 → 패러프레이즈 / 느림 → 지문별 시간 훈련
  const p7 = ps[7];
  const need7 = gg.parts[7] ? gg.parts[7].need : 0.85;
  if (p7.n >= 6 && p7.acc < need7 - 0.05) {
    if (p7.medRatio != null && p7.medRatio <= 1.1) {
      cands.push({
        kind: 'para', title: 'Part 7 패러프레이즈 훈련', minutes: 6, score: (((need7 - p7.acc) * 54 * 5) / 6) * 10,
        reason: `Part 7 시간은 충분하지만 정답률 ${pct(p7.acc)}%. 지문 표현과 정답 표현의 바꿔 말하기 훈련.`,
        params: {},
      });
    } else {
      cands.push({
        kind: 'p7time', title: 'Part 7 지문별 시간 훈련', minutes: 8, score: (((need7 - p7.acc) * 54 * 5) / 8) * 9,
        reason: `Part 7 정답률 ${pct(p7.acc)}%, 목표 시간의 ${pct(p7.medRatio)}%를 씀. 지문마다 정한 시간 안에 근거 찾기.`,
        params: { nQ: 6 },
      });
    }
  }

  // 시간 초과 문제 모음
  const over = overtimeQids(scored, now);
  if (over.length >= 5) {
    cands.push({
      kind: 'overtime', title: `시간 초과 문제 ${Math.min(over.length, 10)}개`, minutes: 5, score: 14 + over.length / 2,
      reason: `목표 시간을 넘긴 문제 ${over.length}개. 제한 시간 안에 다시 풀기.`,
      params: { qids: over.slice(0, 10) },
    });
  }

  // 어휘
  const causes = causeDist(scored);
  const words = Object.values(vocab || {});
  const dueWords = words.filter((w) => (w.due || 0) <= now).length;
  if (words.length >= 4 && (dueWords >= 4 || (causes.vocab || 0) >= 3)) {
    cands.push({
      kind: 'vocab', title: `단어장 복습 ${Math.min(dueWords || words.length, 15)}개`, minutes: 4, score: 15 + (causes.vocab || 0) * 2 + dueWords / 2,
      reason: (causes.vocab || 0) >= 3 ? `오답 원인 중 모르는 어휘 ${causes.vocab}건. 문제에서 저장한 단어 복습.` : `복습할 단어 ${dueWords}개.`,
      params: {},
    });
  }

  // 오답 다시 풀기
  const stale = Object.values(wrongNote || {}).filter((w) => w.rightAfter === 0 && now - (w.lastT || 0) > DAY && RC_PARTS.includes(w.part));
  if (stale.length >= 3) {
    cands.push({
      kind: 'wrongnote', title: `오답 다시 풀기 ${Math.min(stale.length, 8)}문항`, minutes: 5, score: 12 + stale.length / 2,
      reason: `하루 넘게 다시 풀지 않은 오답 ${stale.length}문항. 같은 문제 재풀이로 따로 기록.`,
      params: { qids: stale.slice(0, 8).map((w) => w.qid) },
    });
  }

  if (budget >= 40 && totalN >= 15) {
    cands.push({
      kind: 'timed', title: 'Part 5 실전 15문항 5분', minutes: 6, score: 8,
      reason: '실제 시험 시간 배분대로 풀어 감각 유지.',
      params: { part: 5, nQ: 15, limitSec: 300 },
    });
  }

  if (totalN >= 15) {
    for (const p of [5, 7, 6]) {
      cands.push({
        kind: 'drill', title: `Part ${p} 맞춤 연습`, minutes: p === 7 ? 7 : 5, score: 4 + (p === 5 ? 1 : 0),
        reason: `목표 ${goal}점에 맞춘 난이도 구성. 고급·함정 문제 포함.`,
        params: { part: p, nQ: p === 7 ? 6 : p === 6 ? 8 : 10 },
      });
    }
  }

  cands.sort((a, b) => b.score - a.score);
  const course = [];
  let used = 0;
  const seenKey = new Set();
  for (const c of cands) {
    const key = c.kind + JSON.stringify(c.params);
    if (seenKey.has(key)) continue;
    if (used >= budget) break;
    if (used + c.minutes > budget * 1.25 && course.length) continue;
    course.push(c);
    seenKey.add(key);
    used += c.minutes;
  }
  return { course, candidates: cands, minutes: used };
}
