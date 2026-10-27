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
  const goal = profile.goal || 730;
  const scored = attempts.filter((a) => RC_PARTS.includes(a.part));
  const cands = [];
  const totalN = est.n;

  if (totalN < 15) {
    cands.push({
      kind: 'diag', title: 'クイック診断', minutes: 20, score: 1000,
      reason: totalN ? `記録が${totalN}問だけで、苦手パートはまだ判断できない。3パートをバランスよく診断。` : '記録がなく、苦手パートはまだ分からない。3パートをバランスよく診断。',
      params: { kind: 'quick' },
    });
  }

  const due = dueCards(cards, now);
  if (due.length) {
    const names = due.slice(0, 2).map((c) => conceptName(bank, c.concept)).join(', ');
    cands.push({
      kind: 'review', title: `ステップ復習 ${due.length}タイプ`, minutes: Math.min(due.length, 4) * 3, score: 500 + due.length,
      reason: `間違えた${names}${due.length > 2 ? 'など' : ''}の復習時期。新しい問題で確認。`,
      params: { concepts: due.slice(0, 4).map((c) => c.concept) },
    });
  }

  const gg = goalGap(est, goal, profile.lcBase ?? 350);
  const ps = partStats(scored);
  const cs = conceptStats(scored);
  const share = conceptShare(bank);

  if (totalN >= 15) {
    for (const p of RC_PARTS) {
      if (ps[p].n < 6) {
        const nQ = p === 5 ? 8 : p === 6 ? 4 : 5;
        cands.push({
          kind: 'drill', title: `Part ${p} ${PART_NAMES[p]} 基本練習`, minutes: Math.ceil(nQ * MIN_PER_Q[p]) + 1, score: 30 + REAL_COUNTS[p] / 2,
          reason: `Part ${p}の記録が${ps[p].n}問だけで、実力はまだ判断できない。まず記録を集める。`,
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
    let reason = `${conceptName(bank, concept)} 正答率${pct(s.acc)}%、${s.n}問。`;
    if (slow) reason += `平均${Math.round(s.avgSec)}秒で、目標${s.target}秒より遅い。`;
    else if (dropping) reason += `最近は${pct(s.recentAcc)}%に下がっている。`;
    else reason += `RC ${gg.want}点に必要な約${pct(need)}%より低い。`;
    cands.push({ kind: 'drill', title: `${conceptName(bank, concept)} 集中練習`, minutes, score: (gain / minutes) * 10, reason, params: { concept, nQ, part } });
  }

  // Part 5: 정확한데 느리면 문제 추가보다 속도 훈련
  const p5 = ps[5];
  if (p5.n >= 8 && p5.acc >= 0.7 && p5.medRatio >= 1.2) {
    const lost = (est.rc.unanswered || 0) * 5 * 0.6 + (p5.medRatio - 1) * 15;
    cands.push({
      kind: 'speed', title: 'Part 5 連続解答', minutes: 5, score: (lost / 5) * 10 + 5,
      reason: `Part 5は正答率${pct(p5.acc)}%と正確だが、1問平均${Math.round(p5.avgSec)}秒。目標20秒に合わせるスピード練習。`,
      params: { nQ: 12 },
    });
  }

  // Part 7: 시간 여유 + 정답률 낮음 → 패러프레이즈 / 느림 → 지문별 시간 훈련
  const p7 = ps[7];
  const need7 = gg.parts[7] ? gg.parts[7].need : 0.85;
  if (p7.n >= 6 && p7.acc < need7 - 0.05) {
    if (p7.medRatio != null && p7.medRatio <= 1.1) {
      cands.push({
        kind: 'para', title: 'Part 7 言い換え練習', minutes: 6, score: (((need7 - p7.acc) * 54 * 5) / 6) * 10,
        reason: `Part 7は時間に余裕があるが正答率${pct(p7.acc)}%。本文の表現と正解の表現の言い換え練習。`,
        params: {},
      });
    } else {
      cands.push({
        kind: 'p7time', title: 'Part 7 文書別タイム練習', minutes: 8, score: (((need7 - p7.acc) * 54 * 5) / 8) * 9,
        reason: `Part 7は正答率${pct(p7.acc)}%、目標時間の${pct(p7.medRatio)}%を使っている。文書ごとの制限時間内に根拠を探す。`,
        params: { nQ: 6 },
      });
    }
  }

  // 시간 초과 문제 모음
  const over = overtimeQids(scored, now);
  if (over.length >= 5) {
    cands.push({
      kind: 'overtime', title: `時間オーバー問題 ${Math.min(over.length, 10)}問`, minutes: 5, score: 14 + over.length / 2,
      reason: `目標時間を超えた問題が${over.length}問。制限時間内に解き直す。`,
      params: { qids: over.slice(0, 10) },
    });
  }

  // 어휘
  const causes = causeDist(scored);
  const words = Object.values(vocab || {});
  const dueWords = words.filter((w) => (w.due || 0) <= now).length;
  if (words.length >= 4 && (dueWords >= 4 || (causes.vocab || 0) >= 3)) {
    cands.push({
      kind: 'vocab', title: `単語帳の復習 ${Math.min(dueWords || words.length, 15)}語`, minutes: 4, score: 15 + (causes.vocab || 0) * 2 + dueWords / 2,
      reason: (causes.vocab || 0) >= 3 ? `ミスの原因のうち「知らない単語」が${causes.vocab}件。問題から保存した単語を復習。` : `復習する単語が${dueWords}語。`,
      params: {},
    });
  }

  // 오답 다시 풀기
  const stale = Object.values(wrongNote || {}).filter((w) => w.rightAfter === 0 && now - (w.lastT || 0) > DAY && RC_PARTS.includes(w.part));
  if (stale.length >= 3) {
    cands.push({
      kind: 'wrongnote', title: `間違えた問題の解き直し ${Math.min(stale.length, 8)}問`, minutes: 5, score: 12 + stale.length / 2,
      reason: `1日以上解き直していない問題が${stale.length}問。同じ問題の解き直しとして別に記録。`,
      params: { qids: stale.slice(0, 8).map((w) => w.qid) },
    });
  }

  if (budget >= 40 && totalN >= 15) {
    cands.push({
      kind: 'timed', title: 'Part 5 本番形式 15問5分', minutes: 6, score: 8,
      reason: '本番の時間配分で解いて感覚を保つ。',
      params: { part: 5, nQ: 15, limitSec: 300 },
    });
  }

  if (totalN >= 15) {
    for (const p of [5, 7, 6]) {
      cands.push({
        kind: 'drill', title: `Part ${p} おすすめ練習`, minutes: p === 7 ? 7 : 5, score: 4 + (p === 5 ? 1 : 0),
        reason: `目標${goal}点に合わせた難易度で出題。`,
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
