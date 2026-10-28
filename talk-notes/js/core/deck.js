/* 노트 데이터 → 연습 문제 목록과 세션 만들기 */
import { LESSONS, TAGS, MIST, PHR, PRON } from '../data/notes.js';
import { makeCloze, sameSentence, shuffle, stripHtml } from './text.js';
import { dayNum, isDue, level } from './srs.js';

export const MODES = {
  speak: { label: '말하기 카드', short: '말하기', icon: '🎙', desc: '상황과 한국어 뜻을 보고 영어로 말해요. 수업에서 한 말·수정문·더 자연스러운 표현과 비교해요.' },
  cloze: { label: '고친 부분 빈칸', short: '빈칸', icon: '🧩', desc: '수업에서 고친 말만 빈칸이에요. 보기에는 정답과 그때 내가 한 말(함정)이 섞여 있어요.' },
  fix: { label: '맞는 문장? 틀린 문장?', short: 'O/X', icon: '⭕', desc: '수업에서 한 말이나 고친 말이 나와요. 그대로 써도 되는지 빠르게 판단해요.' },
  shadow: { label: '듣고 따라 말하기', short: '따라 말하기', icon: '🔁', desc: '자연스러운 표현을 듣고 똑같이 따라 말해요. 문장을 가리고 듣기만 할 수도 있어요.' },
  pron: { label: '발음 체크', short: '발음', icon: '👄', desc: '수업 녹취에서 잘못 인식된 단어를 말해 보고, 음성 인식이 제대로 알아듣는지 확인해요.' },
  pair: { label: '소리 구분 듣기', short: '소리 구분', icon: '👂', desc: 'rice/lice, walk/work처럼 헷갈린 두 단어 중 어느 쪽을 읽었는지 골라요.' },
  phrase: { label: '바로 쓸 표현', short: '표현', icon: '💬', desc: '한국어를 보고 바로 쓸 표현을 영어로 떠올려요.' },
  pattern: { label: '실수 패턴 퀴즈', short: '패턴', icon: '🚩', desc: '반복되는 실수 예문에서 맞는 쪽을 골라요.' }
};

/* ── 카드 ───────────────────────── */
export const CARDS = [];
export const CARD = {};
LESSONS.forEach((l, li) => l.cards.forEach((c, i) => {
  const id = `${l.id}-${i + 1}`;
  const ok = c.g.length === 1 && c.g[0] === 'ok';
  const hasO = !!c.o && !sameSentence(c.o, c.f);
  const card = Object.assign({}, c, { id, li, idx: i, lesson: l, ok, hasO, asr: c.g.includes('asr') });
  CARDS.push(card); CARD[id] = card;
}));

const clozeCache = {};
export function clozeOf(card) {
  if (!(card.id in clozeCache)) clozeCache[card.id] = (card.hasO && !card.asr) ? makeCloze(card.o, card.f) : null;
  return clozeCache[card.id];
}

/* 빈칸 보기가 너무 적으면(정답 1 + 함정 1) 같은 실수 유형의 다른 문장 빈칸 답을 함정으로 더한다 */
export function clozeBank(card, rnd = Math.random) {
  const z = clozeOf(card);
  if (!z) return [];
  const bank = z.bank.slice();
  const need = z.blanks.length + 2 - bank.length;
  if (need > 0) {
    const have = new Set(bank.map(b => b.keys));
    const len = z.blanks[0].keys.split(' ').length;
    const cands = [];
    for (const c of CARDS) {
      if (c.id === card.id || !c.g.some(t => card.g.includes(t))) continue;
      const o = clozeOf(c);
      if (!o) continue;
      for (const b of o.blanks.concat(o.bank.filter(x => !x.correct).map(x => ({ answer: x.text, keys: x.keys })))) {
        const n = b.keys.split(' ').length;
        if (!have.has(b.keys) && Math.abs(n - len) <= 1 && b.answer.length < 30) cands.push(b);
      }
    }
    for (const b of shuffle(cands, rnd).slice(0, need)) { have.add(b.keys); bank.push({ text: b.answer, keys: b.keys, correct: false, extra: true }); }
  }
  return bank;
}

/* ── 발음·소리 구분 ───────────────── */
export const PRON_ROWS = PRON.flatMap((g, gi) => g.rows.map(r => Object.assign({ gi, group: g.h, tip: g.tip }, r)));
/* 소리 구분: 인식된 말이 실제 영어 단어인 짝만 (Ragus, coldsiness 같은 건 제외) */
export const PAIRS = [
  ['rice', 'lice', 'R/L'], ['read', 'lead', 'R/L'], ['raise', 'laze', 'R/L'], ['right', 'light', 'R/L'],
  ['rock', 'lock', 'R/L'], ['grammar', 'glamor', 'R/L'], ['wrongly', 'lonely', 'R/L'], ['world', 'word', 'R/L'],
  ['older', 'order', 'R/L'], ['alone', 'along', '끝소리'], ['walk', 'work', '모음'], ['small', 'smart', '모음'],
  ['false', 'force', '모음'], ['code', 'cold', '모음'], ['had', 'add', '첫소리'], ['live', 'leave', '모음'],
  ['fill', 'feel', '모음'], ['can', "can't", '끝소리'], ['vibe', 'five', '첫소리'], ['genres', 'jungles', '모음'],
  ['sequels', 'secrets', '자음'], ['favorite', 'fabric', '자음'], ['celebrity', 'celebrate', '끝소리']
];

/* ── 표현 ─────────────────────── */
export const PHRASES = PHR.flatMap((g, gi) => g[1].map((p, pi) => ({ id: `${gi}.${pi}`, group: g[0], gi, en: p[0], kr: p[1] })));

/* ── 패턴 예문 ─────────────────── */
export const PATTERNS = MIST.flatMap(m => m.ex.map((x, i) => ({ id: `${m.k}.${i}`, k: m.k, h: m.h, p: m.p, d: x[0], bad: stripHtml(x[1]), good: stripHtml(x[2]) })));

/* ── 문제 하나 ───────────────── */
export function itemKey(type, ref) {
  return ({ speak: 's:', cloze: 'z:', fix: 'x:', shadow: 'h:', pron: 'w:', pair: 'q:', phrase: 'p:', pattern: 'm:' })[type] + ref;
}
export function parseKey(key) {
  const T = { s: 'speak', z: 'cloze', x: 'fix', h: 'shadow', w: 'pron', q: 'pair', p: 'phrase', m: 'pattern' };
  return { type: T[key[0]], ref: key.slice(2) };
}
export function resolve(key) {
  const { type, ref } = parseKey(key);
  if (['speak', 'cloze', 'fix', 'shadow'].includes(type)) {
    const card = CARD[ref];
    if (!card || (type === 'cloze' && !clozeOf(card)) || (type === 'fix' && !(card.o && !card.asr))) return null;
    return { type, key, card };
  }
  if (type === 'pron') { const row = PRON_ROWS.find(r => r.w === ref); return row ? { type, key, row } : null; }
  if (type === 'pair') { const p = PAIRS.find(p => p[0] + '|' + p[1] === ref); return p ? { type, key, pair: p } : null; }
  if (type === 'phrase') { const ph = PHRASES.find(p => p.id === ref); return ph ? { type, key, phrase: ph } : null; }
  if (type === 'pattern') { const pt = PATTERNS.find(p => p.id === ref); return pt ? { type, key, pattern: pt } : null; }
  return null;
}

/* 모드별 전체 문제 (필터 적용) */
export function poolFor(mode, f = {}, S = null) {
  let cards = CARDS;
  if (f.lesson != null && f.lesson !== '') cards = cards.filter(c => c.li === +f.lesson);
  if (f.tag) cards = cards.filter(c => c.g.includes(f.tag));
  if (f.star && S) cards = cards.filter(c => S.stars[c.id]);
  if (f.skipOk) cards = cards.filter(c => !c.ok);
  switch (mode) {
    case 'speak': return cards.map(c => itemKey('speak', c.id));
    case 'shadow': return cards.map(c => itemKey('shadow', c.id));
    case 'cloze': return cards.filter(c => clozeOf(c)).map(c => itemKey('cloze', c.id));
    case 'fix': return cards.filter(c => c.o && !c.asr).map(c => itemKey('fix', c.id));
    case 'pron': return PRON_ROWS.filter(r => f.group == null || f.group === '' || r.gi === +f.group).map(r => itemKey('pron', r.w));
    case 'pair': return PAIRS.filter(p => !f.kind || p[2] === f.kind).map(p => itemKey('pair', p[0] + '|' + p[1]));
    case 'phrase': return PHRASES.filter(p => f.group == null || f.group === '' || p.gi === +f.group).map(p => itemKey('phrase', p.id));
    case 'pattern': return PATTERNS.filter(p => !f.tag || p.k === f.tag).map(p => itemKey('pattern', p.id));
  }
  return [];
}

/* 세션 만들기
   order: 'due'(복습할 것 먼저, 그다음 새것) · 'new'(안 푼 것만) · 'weak'(많이 틀린 것) · 'random' · 'seq'(노트 순서) */
export function buildSession(mode, f, S, { size = 20, order = 'due', newLimit = Infinity, rnd = Math.random } = {}) {
  const pool = poolFor(mode, f, S);
  const today = dayNum();
  const st = k => S.srs[k];
  if (order === 'seq') return pool.slice(0, size);
  if (order === 'random') return shuffle(pool, rnd).slice(0, size);
  if (order === 'weak') {
    const w = pool.filter(k => st(k) && (st(k).l > 0 || st(k).i < 3));
    w.sort((a, b) => (st(b).l - st(a).l) || (st(a).i - st(b).i));
    return w.slice(0, size);
  }
  if (order === 'new') return newOrder(pool.filter(k => !st(k) || !st(k).n), S, rnd).slice(0, size);
  const due = pool.filter(k => isDue(st(k), today)).sort((a, b) => (st(a).d - st(b).d) || (st(b).l - st(a).l));
  const out = due.slice(0, size);
  const fresh = newOrder(pool.filter(k => !st(k) || !st(k).n), S, rnd);
  for (const k of fresh) { if (out.length >= size || newLimit <= 0) break; out.push(k); newLimit--; }
  return shuffleDueFirst(out, due.length, rnd);
}

/* 새 문제 순서: 설정(최근 수업부터·처음 수업부터·약점 태그부터) */
function newOrder(keys, S, rnd) {
  // 수업 때도 맞게 말한 짧은 문장(Thank you 같은)은 뒤로
  const easy = k => { const r = resolve(k); return r && r.card && r.card.ok ? 1 : 0; };
  const sorted = newOrderRaw(keys, S, rnd);
  return sorted.filter(k => !easy(k)).concat(sorted.filter(easy));
}
function newOrderRaw(keys, S, rnd) {
  const ord = (S && S.settings.newOrder) || 'recent';
  const ref = k => resolve(k);
  if (ord === 'random') return shuffle(keys, rnd);
  if (ord === 'weak') {
    const w = tagWeights(S);
    const score = k => { const r = ref(k); return r && r.card ? r.card.g.reduce((s, t) => s + (w[t] || 0), 0) : 0; };
    return keys.slice().sort((a, b) => score(b) - score(a));
  }
  if (ord === 'recent') {
    return keys.slice().sort((a, b) => { const A = ref(a), B = ref(b); return (A && A.card && B && B.card) ? (B.card.li - A.card.li) || (A.card.idx - B.card.idx) : 0; });
  }
  return keys;
}
function shuffleDueFirst(arr, nDue, rnd) {
  // 복습 문제끼리, 새 문제끼리 섞되 복습이 앞쪽에 오도록 (같은 수업 문장이 줄줄이 나오지 않게)
  const d = shuffle(arr.slice(0, nDue), rnd), n = arr.slice(nDue);
  return d.concat(n);
}

/* 태그별 약점 가중치: 내 연습에서 틀린 비율(없으면 노트에서 나온 횟수) */
export function tagWeights(S) {
  const w = {};
  const total = {};
  CARDS.forEach(c => c.g.forEach(t => { total[t] = (total[t] || 0) + 1; }));
  for (const t of Object.keys(TAGS)) {
    if (t === 'ok' || t === 'asr') { w[t] = 0; continue; }
    const s = S && S.tagStats[t];
    const noteRate = (total[t] || 0) / CARDS.length;
    w[t] = s && s.n >= 5 ? (1 - s.ok / s.n) * 0.7 + noteRate * 0.3 : noteRate;
  }
  return w;
}

/* 오늘의 학습: 모든 종류의 복습 + 새 말하기 카드 + 이미 익힌 카드의 변형 문제(빈칸·O/X) */
export function buildToday(S, { size = 20, newLimit = 10, rnd = Math.random } = {}) {
  const today = dayNum();
  const due = Object.entries(S.srs).filter(([k, st]) => isDue(st, today) && resolve(k)).sort((a, b) => (a[1].d - b[1].d) || (b[1].l - a[1].l)).map(([k]) => k);
  const out = shuffle(due.slice(0, size), rnd);
  const newSpeak = newOrder(CARDS.filter(c => !S.srs[itemKey('speak', c.id)]).map(c => itemKey('speak', c.id)), S, rnd);
  // 말하기를 한 번이라도 한 카드의 빈칸·O/X 중 아직 안 푼 것
  const variants = shuffle(CARDS.filter(c => S.srs[itemKey('speak', c.id)]).flatMap(c => {
    const v = [];
    if (clozeOf(c) && !S.srs[itemKey('cloze', c.id)]) v.push(itemKey('cloze', c.id));
    else if (c.o && !c.asr && !S.srs[itemKey('fix', c.id)]) v.push(itemKey('fix', c.id));
    return v;
  }), rnd);
  // 가끔 표현·소리 구분·패턴 새 문제도 끼운다 (새 말하기 4개마다 1개)
  const extras = shuffle(['phrase', 'pair', 'pattern'].flatMap(m => poolFor(m, {}, S).filter(k => !S.srs[k]).slice(0, 40)), rnd);
  let ni = 0, vi = 0, ei = 0;
  while (out.length < size && newLimit > 0 && (ni < newSpeak.length || vi < variants.length)) {
    if (ni < newSpeak.length) { out.push(newSpeak[ni++]); newLimit--; if (ni % 4 === 0 && ei < extras.length && out.length < size) out.push(extras[ei++]); }
    if (out.length < size && vi < variants.length) out.push(variants[vi++]);
  }
  return out;
}

/* ── 통계용 ─────────────────── */
export function lessonProgress(S) {
  return LESSONS.map((l, li) => {
    const cs = CARDS.filter(c => c.li === li);
    const seen = cs.filter(c => S.srs[itemKey('speak', c.id)]).length;
    const mastered = cs.filter(c => level(S.srs[itemKey('speak', c.id)]) === 'mastered').length;
    return { li, total: cs.length, seen, mastered };
  });
}

export function tagCounts(cards = CARDS) {
  const out = {};
  cards.forEach(c => c.g.forEach(t => { out[t] = (out[t] || 0) + 1; }));
  return out;
}

export function search(q, limit = 80) {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  const hit = [];
  for (const c of CARDS) {
    const hay = [c.c, c.o, c.f, c.t, c.n, c.nk, stripHtml(c.e.join(' '))].join(' ').toLowerCase();
    if (hay.includes(s)) { hit.push(c); if (hit.length >= limit) break; }
  }
  return hit;
}
