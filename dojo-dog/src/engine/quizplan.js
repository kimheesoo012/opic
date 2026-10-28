// 플레이 중 학습: 장면 사이 확인 문제 · 복습 카드 · 견생이 끝난 뒤 정리. UI 없이 동작한다(시뮬레이션과 화면이 같은 규칙을 쓴다).
// 게임 진행(사건 순서·관계·능력치)에는 손대지 않는다. 기록은 견생 상태의 s.quiz와 간격 반복 기록(srs)에만 남는다.
import { itemOf, isN2, questionKinds, makeQuestion, grade, mastered, MASTER_STREAK, DAY } from './study.js';
import { hashSeed, rand } from './rng.js';
import { BANK_BY_REF, bankQuestion } from './bankq.js';

// 몇 장면마다 한 문제 (보통: 4~5장면)
export const QUIZ_FREQ = { off: null, low: [8, 10], mid: [4, 5], high: [2, 3] };
export const PLAY_MODES = ['study', 'watch']; // 학습 모드 / 감상 모드
const RECENT_SCENES = 4; // 확인 문제는 최근 네 장면에서 만난 말에서 고른다
const RELEARN_GAP = 2; // 틀린 말은 다른 문제를 두 번 이상 지난 뒤에 다시 (바로 다시 내면 답을 외우게 된다)
const RELEARN_MAX = 2; // 한 견생 안에서 같은 말을 다시 내는 것은 두 번까지
// 복습 카드: 빈도 설정에 따라 계절 간격과 한 견생당 최대 장수 (확인 문제보다 적게)
const CARD = { low: [8, 3], mid: [4, 5], high: [3, 8] };

export function quizLog(s) {
  if (!s.quiz) s.quiz = { scenes: 0, nextAt: 0, asked: [], recent: [], where: {}, lastCard: -99, seed: String(s.seed || '') + (s.born || '') };
  return s.quiz;
}

const span = (freq, h) => {
  const r = QUIZ_FREQ[freq];
  return r ? r[0] + Math.floor(rand(h) * (r[1] - r[0] + 1)) : null;
};

// 학습 집중 모드에서는 한 단계 자주 (낮음→보통, 보통→높음)
const BUMP = { low: 'mid', mid: 'high', high: 'high', off: 'off' };
export const freqOf = (set) => (set.focus ? BUMP[set.quizFreq || 'mid'] : set.quizFreq || 'mid');

export const quizOn = (set) => (set.playMode || 'study') === 'study' && (set.quizFreq || 'mid') !== 'off';

// 일본어 대사가 있는 장면이 하나 끝났다. ids: 그 장면의 학습 대상, where: id → 대사(문맥 문제에 쓴다)
export function noteScene(log, ids, where, set) {
  log.scenes++;
  log.recent.unshift([...ids]);
  log.recent.length = Math.min(log.recent.length, RECENT_SCENES);
  for (const id of ids) if (where[id]) log.where[id] = where[id];
  if (!log.nextAt) {
    const h = { rng: hashSeed(log.seed + 'n' + log.scenes) };
    const n = span(freqOf(set), h);
    if (n) log.nextAt = log.scenes + n;
  }
}

export const sceneQuizDue = (log, set) => quizOn(set) && !!log.nextAt && log.scenes >= log.nextAt;
export function cardDue(log, set, season) {
  const c = CARD[freqOf(set)];
  if (!quizOn(set) || !c) return false;
  const cards = log.asked.filter((a) => a.src === 'card').length;
  return season - log.lastCard >= c[0] && cards < c[1];
}

// 다음 확인 문제 시점을 다시 잡는다 (냈든 못 냈든)
export function reschedule(log, set) {
  const h = { rng: hashSeed(log.seed + 'r' + log.scenes + ':' + log.asked.length) };
  const n = span(freqOf(set), h);
  log.nextAt = n ? log.scenes + n : 0;
}

// 이번 견생에서의 기록
function runState(log, id) {
  const idx = [];
  log.asked.forEach((a, i) => a.id === id && idx.push(i));
  if (!idx.length) return null;
  const last = log.asked[idx[idx.length - 1]];
  return { n: idx.length, last, lastIndex: idx[idx.length - 1], kinds: idx.map((i) => log.asked[i].kind) };
}

// 무엇을 물을까. src: 'scene'(장면 뒤 확인 문제) | 'card'(복습 카드)
// 확인 문제: 이번 견생에서 틀린 말(간격을 둔 뒤) → 전에 틀린 적 있고 복습할 때가 된 말 → 방금 장면들에서 만난 말(아직 불확실) → 그 밖의 복습할 말
// 복습 카드: 이번 견생에서 틀린 말 → 복습할 때가 된 틀린 말 → 불확실한 말 → 그 밖 (장면과 따로, 예전에 만난 말을 다시 불러온다)
// 이번 견생에서 이미 맞힌 말, 익힌 말(두 번 연속 정답)이면서 복습 날짜가 안 된 말은 내지 않는다.
export function pickItem(log, srs, now, src = 'scene', skip = null) {
  const prev = log.asked.length ? log.asked[log.asked.length - 1].id : null;
  const recent = log.recent.flat();
  const pool = new Set([...recent, ...log.asked.map((a) => a.id), ...Object.keys(srs).filter((id) => srs[id].due <= now)]);
  const h = { rng: hashSeed(log.seed + src + log.asked.length + ':' + log.scenes) };
  let best = null;
  for (const id of pool) {
    if (!itemOf(id) || id === prev || (skip && skip.has(id))) continue;
    const r = srs[id];
    const run = runState(log, id);
    let score;
    if (run) {
      // 이번 견생에서 이미 물었다: 틀렸을 때만, 다른 문제를 몇 개 지난 뒤 다시
      if (run.last.ok || run.n > RELEARN_MAX) continue;
      if (log.asked.length - 1 - run.lastIndex < RELEARN_GAP) continue;
      score = 100;
    } else {
      const due = !!r && r.due <= now;
      // 익힌 말(복습일 전)은 다른 후보가 없을 때만 — 방금 장면에서 만난 것으로 (확인 문제 간격을 지키기 위해)
      if (r && mastered(r) && !due) {
        if (src === 'scene' && recent.includes(id)) score = 5 + rand(h) * 3;
        else continue;
        if (!best || score > best.score) best = { id, score };
        continue;
      }
      const weak = !!r && r.ng > 0 && r.streak === 0;
      const unsure = !r || r.streak < MASTER_STREAK;
      const fresh = src === 'scene' && recent.includes(id);
      const peeked = !!r && (r.tr || 0) >= 2 && !mastered(r); // 번역을 자주 본 말 (틀린 것으로는 치지 않는다)
      if (due && weak) score = 80 + Math.min(r.ng, 5) * 2;
      else if (peeked && (due || fresh || src === 'card')) score = 70 + Math.min(r.tr, 5);
      else if (fresh) score = 60 + (isN2(id) ? 10 : 0) + (id[0] === 'g' ? 4 : 0) - recent.indexOf(id) * 0.5;
      else if (due && unsure) score = src === 'card' ? 65 : 45;
      else if (due) score = src === 'card' ? 45 : 30;
      else continue;
    }
    score += rand(h) * 3;
    if (!best || score > best.score) best = { id, score };
  }
  return best ? best.id : null;
}

// 유형 고르기: 같은 말을 다시 낼 때는 지난번과 다른 유형으로 (같은 문제를 외워서 맞히지 않게)
// 처음 만난 직후에는 문장 속 의미부터, 다시 볼 때는 뜻 떠올리기·구별 쪽으로
const FIRST = { v: ['context', 'meaning', 'reading', 'word'], g: ['gblank', 'gcontext', 'gdiff', 'grammar', 'gform'] };
const AGAIN = { v: ['word', 'meaning', 'reading', 'context'], g: ['gdiff', 'gcontext', 'grammar', 'gblank', 'gform'] };
export function chooseKind(id, log, srs, ctx) {
  const avail = questionKinds(id, ctx);
  if (!avail.length) return null;
  const run = runState(log, id);
  const r = srs[id];
  const used = new Set([...(run ? run.kinds : []), ...(r && r.lk ? [r.lk] : [])]);
  const order = (run || (r && r.ok + r.ng > 0) ? AGAIN : FIRST)[id[0]];
  const fresh = order.filter((k) => avail.includes(k) && !used.has(k));
  if (fresh.length) return fresh[0];
  const lastKind = run ? run.last.kind : r && r.lk;
  return order.find((k) => avail.includes(k) && k !== lastKind) || avail[0];
}

// 문제 만들기 (ctx: { hasScene, blank } — 문장은 화면 쪽이 준비한다)
// 문제은행에 그 말을 다루는 문항이 있으면, 다시 묻는 때(이번 견생에서 또는 예전에 푼 적 있음)나 세 번에 한 번은 그것을 낸다.
// 이번 견생에서 이미 낸 문항은 다시 내지 않는다.
export function buildQuestion(id, log, srs, ctx) {
  const seed = log.seed + id + ':' + log.asked.length + ':' + (srs[id] ? srs[id].ok + srs[id].ng : 0);
  const used = new Set(log.asked.map((a) => a.bank).filter(Boolean));
  // 방금 장면에서 후리가나를 보여 준 말은 읽기를 묻지 않는다 (문제은행의 한자 읽기 문항도)
  const items = (BANK_BY_REF[id] || []).filter((q) => !used.has(q.id) && !(ctx.rubyShown && q.type === 'kanji'));
  if (items.length) {
    const r = srs[id];
    const again = !!runState(log, id) || (r && r.ok + r.ng > 0);
    const h = { rng: hashSeed(seed + 'bank') };
    // 이번 견생에서 바로 전에 문제은행으로 물었으면, 다시 물을 때는 다른 유형으로 (못 만들면 문제은행)
    const run = runState(log, id);
    const lastBank = run && run.last.kind === 'bank';
    const pick = () => bankQuestion(id, items[Math.floor(rand(h) * items.length)]);
    // 일본어 몰입 모드에서는 문제은행(일본어 문제)을 먼저 쓴다
    if (!lastBank && (ctx.jaOnly || again || rand(h) < 1 / 3)) return pick();
    if (lastBank) {
      const kind = chooseKind(id, log, srs, ctx);
      return kind ? makeQuestion(id, seed, srs[id], { ...ctx, kind }) : pick();
    }
  }
  const kind = chooseKind(id, log, srs, ctx);
  if (!kind) return null;
  return makeQuestion(id, seed, srs[id], { ...ctx, kind });
}

// 답 기록: 간격 반복에 반영하고(틀리면 내일 다시 · 이번 견생에서도 간격을 두고 한 번 더), 게임 능력치에는 반영하지 않는다
export function recordAnswer(log, srs, q, ok, now, src) {
  const r = grade(srs, q.id, ok, now);
  if (q.kind !== 'bank') r.lk = q.kind;
  log.asked.push({ id: q.id, kind: q.kind, ok, scene: log.scenes, src, ...(q.bankId ? { bank: q.bankId } : {}) });
  return r;
}

// 견생이 끝난 뒤 정리: 만난 N2 어휘·문법, 정답률, 취약 표현, 다음 복습
export function lifeSummary(s, srs, now = Date.now()) {
  const log = s.quiz || { asked: [] };
  const met = (s.met || []).filter((id) => itemOf(id));
  const n2 = met.filter(isN2);
  const asked = log.asked || [];
  const ok = asked.filter((a) => a.ok).length;
  const lastBy = new Map();
  for (const a of asked) lastBy.set(a.id, a);
  // 취약: 이번 견생에서 틀렸고 마지막 답도 틀린 것 → 그다음 여러 번 틀린 것
  const weak = [...lastBy.values()].filter((a) => !a.ok).map((a) => a.id);
  for (const id of met) if (!weak.includes(id) && srs[id] && srs[id].ng >= 2 && srs[id].ng >= srs[id].ok) weak.push(id);
  const ids = [...new Set([...met, ...asked.map((a) => a.id)])].filter((id) => srs[id]);
  // 다음 복습: 틀렸던·불확실한 말을 먼저, 그다음 날짜순
  const shaky = (id) => (srs[id].ng > 0 && srs[id].streak === 0 ? 0 : srs[id].streak < MASTER_STREAK ? 1 : 2);
  const next = ids.filter((id) => !mastered(srs[id]) || srs[id].due - now < 3 * DAY).sort((a, b) => shaky(a) - shaky(b) || srs[a].due - srs[b].due);
  return {
    words: n2.filter((id) => id[0] === 'v'),
    grammar: n2.filter((id) => id[0] === 'g'),
    asked: asked.length,
    ok,
    accuracy: asked.length ? Math.round((ok / asked.length) * 100) : null,
    weak: weak.slice(0, 8),
    next: next.slice(0, 6).map((id) => ({ id, due: srs[id].due })),
    dueTomorrow: ids.filter((id) => srs[id].due - now <= DAY).length,
  };
}
