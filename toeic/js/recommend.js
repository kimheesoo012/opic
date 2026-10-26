// 오늘의 학습 추천. 정답률·풀이 시간·오답 원인·최근 변화·목표와의 차이를 반영해
// "공부 시간 대비 예상 효과"가 큰 활동부터 고른다. 추천마다 이유 한 문장.
import { pct, REAL_COUNTS, LC_PARTS, PART_NAMES, DAY } from './util.js';
import { conceptStats, partStats, causeDist } from './stats.js';
import { dueCards } from './review.js';
import { goalGap } from './scoring.js';
import { conceptName } from './bank.js';

const MIN_PER_Q = { 1: 0.4, 2: 0.35, 3: 0.6, 4: 0.6, 5: 0.4, 6: 0.6, 7: 1.1 };
const MIN_N = 4; // 이보다 적게 푼 유형은 약점이라고 단정하지 않는다

function conceptShare(bank) {
  // 파트 안에서 개념이 차지하는 비중(은행 기준 근사) → 실제 시험 출제 수 추정
  const share = new Map();
  for (const [concept, refs] of bank.byConcept) {
    const part = refs[0].unit.part;
    const partTotal = bank.count(part) || 1;
    share.set(concept, { part, realQ: (REAL_COUNTS[part] * refs.length) / partTotal, size: refs.length });
  }
  return share;
}

export function recommend(ctx) {
  const { bank, attempts, cards, vocab, wrongNote, profile, est } = ctx;
  const now = ctx.now || Date.now();
  const budget = ctx.minutes || 20;
  const goal = profile.goal || 850;
  const scored = attempts.filter((a) => a.mode !== 'vocab');
  const cands = [];
  const totalN = est.n;

  // 0) 기록이 거의 없으면 진단부터
  if (totalN < 15) {
    cands.push({
      kind: 'diag', title: '간단 진단 (약 20분)', minutes: 20, score: 1000,
      reason: totalN ? `지금까지 ${totalN}문항만 기록되어 약점 파트를 판단하기 어려움 — 전 파트 고르게 진단` : '아직 기록이 없어 약점 파트를 알 수 없음 — 전 파트를 고르게 푸는 진단부터',
      params: { kind: 'quick' },
    });
  }

  // 1) 복습 시기 도래
  const due = dueCards(cards, now);
  if (due.length) {
    const names = due.slice(0, 2).map((c) => conceptName(bank, c.concept)).join(', ');
    cands.push({
      kind: 'review', title: `단계별 복습 ${due.length}개 유형`, minutes: Math.min(due.length, 4) * 3, score: 500 + due.length,
      reason: `틀렸던 유형(${names}${due.length > 2 ? ' 등' : ''})을 복습할 시기 — 잊기 전에 새 문제로 확인`,
      params: { concepts: due.slice(0, 4).map((c) => c.concept) },
    });
  }

  const gg = goalGap(est, goal);
  const ps = partStats(scored);
  const cs = conceptStats(scored);
  const share = conceptShare(bank);

  // 2) 기록 부족 파트 → 데이터 수집 (단정 금지)
  if (totalN >= 15) {
    for (let p = 1; p <= 7; p++) {
      if (ps[p].n < 6) {
        const nQ = p >= 3 && p !== 5 ? (p === 7 ? 4 : 3) : 6;
        cands.push({
          kind: 'drill', title: `Part ${p} ${PART_NAMES[p]} 맛보기`, minutes: Math.ceil(nQ * MIN_PER_Q[p]) + 1,
          score: 30 + REAL_COUNTS[p] / 2,
          reason: `Part ${p} 기록이 ${ps[p].n}문항뿐이라 실력을 판단하기 어려움 — 먼저 데이터 수집`,
          params: { part: p, nQ },
        });
      }
    }
  }

  // 3) 유형별 정확도 훈련
  for (const [concept, s] of cs) {
    const meta = share.get(concept);
    if (!meta || s.n < MIN_N) continue;
    const part = meta.part;
    const need = gg.parts[part] ? gg.parts[part].need : 0.85;
    const shrunk = (s.correct + need * 2) / (s.n + 2);
    const gap = need - shrunk;
    const slow = s.medRatio != null && s.medRatio > 1.3 && part >= 5;
    const dropping = s.recentAcc != null && s.prevAcc != null && s.recentAcc < s.prevAcc - 0.2;
    if (gap <= 0.03 && !dropping) continue;
    const nQ = part >= 6 || part === 3 || part === 4 ? 6 : 6;
    const minutes = Math.max(3, Math.round(nQ * MIN_PER_Q[part]));
    let gain = Math.max(0.02, gap) * meta.realQ * 5 * (dropping ? 1.3 : 1);
    let reason = `${conceptName(bank, concept)} 정답률 ${pct(s.acc)}%(${s.n}문항)`;
    if (slow) reason += `, 평균 ${Math.round(s.avgSec)}초로 목표(${s.target}초)보다 느림`;
    else if (dropping) reason += `, 최근 ${pct(s.recentAcc)}%로 하락`;
    else reason += ` — 목표 ${goal}점에 필요한 수준(약 ${pct(need)}%)보다 낮음`;
    cands.push({ kind: 'drill', title: `${conceptName(bank, concept)} 집중`, minutes, score: gain / minutes * 10, reason, params: { concept, nQ, part } });
  }

  // 4) Part 5 속도 훈련: 정확한데 느릴 때는 문제 추가보다 속도
  const p5 = ps[5];
  if (p5.n >= 8 && p5.acc >= 0.7 && p5.medRatio >= 1.2) {
    const lost = (est.sections.RC.unanswered || 0) * 5 * 0.6 + (p5.medRatio - 1) * 15;
    cands.push({
      kind: 'speed', title: 'Part 5 속도 훈련', minutes: 6, score: (lost / 6) * 10 + 5,
      reason: `Part 5 정답률 ${pct(p5.acc)}%로 정확하지만 문항당 평균 ${Math.round(p5.avgSec)}초(목표 ${p5.target}초) — 문법 문제 추가보다 속도 훈련`,
      params: { nQ: 10 },
    });
  }

  // 5) Part 7: 시간 여유 + 정답률 낮음 → 정확도·패러프레이즈 / 느림 → 시간 제한 세트
  const p7 = ps[7];
  const need7 = gg.parts[7] ? gg.parts[7].need : 0.85;
  if (p7.n >= 6 && p7.acc < need7 - 0.05) {
    if (p7.medRatio != null && p7.medRatio <= 1.1) {
      cands.push({
        kind: 'para', title: 'Part 7 패러프레이즈 훈련', minutes: 6, score: ((need7 - p7.acc) * 54 * 5 / 6) * 10,
        reason: `Part 7 시간은 충분(목표의 ${pct(p7.medRatio)}%)한데 정답률 ${pct(p7.acc)}% — 지문 표현과 정답 표현 바꿔 말하기 훈련`,
        params: {},
      });
    } else {
      cands.push({
        kind: 'timed', title: 'Part 7 시간 제한 세트', minutes: 8, score: ((need7 - p7.acc) * 54 * 5 / 8) * 9,
        reason: `Part 7 정답률 ${pct(p7.acc)}%, 문항당 평균 ${Math.round(p7.avgSec)}초로 목표(60초)보다 느림 — 제한 시간 안에서 근거 찾기`,
        params: { part: 7, nQ: 6, limitSec: 6 * 60 },
      });
    }
  }

  // 6) LC: '못 들음' 원인이 많으면 반복 듣기·받아쓰기
  const lcWrong = scored.filter((a) => LC_PARTS.includes(a.part) && !a.correct);
  const listenN = lcWrong.filter((a) => a.cause === 'listen').length;
  if (listenN >= 3 && listenN / Math.max(1, lcWrong.filter((a) => a.cause).length) >= 0.3) {
    cands.push({
      kind: 'listen', title: 'LC 문장 반복 듣기·받아쓰기', minutes: 6, score: 25 + listenN,
      reason: `LC 오답 원인 중 '못 들음'이 ${listenN}건 — 문장 단위 반복 듣기와 빈칸 받아쓰기`,
      params: {},
    });
  }

  // 7) 어휘
  const causes = causeDist(scored);
  const words = Object.values(vocab || {});
  const dueWords = words.filter((w) => (w.due || 0) <= now).length;
  if (words.length >= 4 && (dueWords >= 4 || (causes.vocab || 0) >= 3)) {
    cands.push({
      kind: 'vocab', title: `단어장 복습 ${Math.min(dueWords || words.length, 15)}개`, minutes: 4, score: 15 + (causes.vocab || 0) * 2 + dueWords / 2,
      reason: (causes.vocab || 0) >= 3 ? `오답 원인 '모르는 어휘' ${causes.vocab}건 — 문제 속에서 저장한 단어 복습` : `복습 시기가 된 단어 ${dueWords}개`,
      params: {},
    });
  }

  // 8) 오답 다시 풀기(같은 문제)
  const stale = Object.values(wrongNote || {}).filter((w) => w.rightAfter === 0 && now - (w.lastT || 0) > DAY);
  if (stale.length >= 3) {
    cands.push({
      kind: 'wrongnote', title: `오답 다시 풀기 ${Math.min(stale.length, 8)}문항`, minutes: 5, score: 12 + stale.length / 2,
      reason: `하루 넘게 다시 풀지 않은 오답 ${stale.length}문항 — 같은 문제 재확인(새 문제 복습과 따로 기록)`,
      params: { qids: stale.slice(0, 8).map((w) => w.qid) },
    });
  }

  // 9) 40분 코스: 실전 감각용 시간 제한 파트
  if (budget >= 40 && totalN >= 15) {
    cands.push({
      kind: 'timed', title: 'Part 5 실전 15문항 (5분)', minutes: 6, score: 8,
      reason: '실제 시험처럼 시간 제한 안에서 풀어 보는 연습 — 시간 배분 감각 유지',
      params: { part: 5, nQ: 15, limitSec: 5 * 60 },
    });
  }

  // 기본 보충: RC 비중을 높게 (RC가 LC보다 낮음)
  if (totalN >= 15) {
    const rcFill = [5, 7, 6].map((p) => ({
      kind: 'drill', title: `Part ${p} 맞춤 연습`, minutes: p === 7 ? 7 : 5, score: 4 + (p === 5 ? 1 : 0),
      reason: `RC 비중을 높인 기본 연습 — 목표 ${goal}점에 맞춘 난이도(어려운 함정 문제 포함)`,
      params: { part: p, nQ: p === 7 ? 6 : p === 6 ? 8 : 10 },
    }));
    cands.push(...rcFill, {
      kind: 'drill', title: 'Part 2·3 맞춤 연습', minutes: 5, score: 3,
      reason: `LC 감각 유지 — 간접 응답·화자 의도 같은 고득점 함정 포함`,
      params: { parts: [2, 3], nQ: 8 },
    });
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
