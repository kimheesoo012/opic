// 게임 진행 로직. DOM을 전혀 모르고, 상태(state)는 JSON으로 저장 가능한 순수 객체다.
import { rand, rint, chance, pick, weighted, hashSeed, shuffle } from './rng.js';
import {
  SEASONS, STAT_KEYS, PERSONALITIES, COATS, HAIRS, DOG_NAMES, REGIONS, DOJOS, GEN1, ROLES,
  stageOf, nextGeneration, personFor,
} from './world.js';
import { resolveKo } from './text.js';
import { ALL_EVENTS } from '../data/index.js';
import { TITLES } from '../data/titles.js';
import { farewellLines, castEpilogue } from '../data/farewell.js';
import { CONTINUED_JA } from '../data/ja/misc.js';

export const EV = new Map();
for (const e of ALL_EVENTS) {
  if (EV.has(e.id)) throw new Error('중복 이벤트 id: ' + e.id);
  EV.set(e.id, e);
}
const CHAPTERS = {};
for (const e of ALL_EVENTS) {
  if (e.cat === 'cast' && typeof e.ch === 'number') (CHAPTERS[e.who] ||= []).push(e);
}
for (const k in CHAPTERS) CHAPTERS[k].sort((a, b) => a.ch - b.ch);
const IINCHO = ALL_EVENTS.filter((e) => e.cat === 'iincho' && e.ep && !e.final).sort((a, b) => a.ep - b.ep);
const POOLABLE = ALL_EVENTS.filter((e) => !e.chainOnly && ['daily', 'kendo', 'sub'].includes(e.cat) && !e.pool);
const HUBS = ALL_EVENTS.filter((e) => e.cat === 'hub');

export const MILESTONE_T = { 4: 'm_1', 12: 'm_3', 28: 'm_7', 40: 'm_10' };
const MAX_EVENTS_PER_SEASON = 4;

// 능력치 균형. 이벤트마다 효과를 고치지 않고 엔진에서 한 번에 다룬다 (test/balance.test.mjs가 결과를 잰다).
//  softTop/softBottom: 끝(100/0)에서 이만큼 안쪽부터 같은 효과도 덜 움직인다. 끝이 아니면 최소 1은 움직인다.
//  drift: 계절마다 타고난 성격(태어날 때의 값) 쪽으로 돌아가는 비율. 높이 올라간 값일수록 더 끌려 내려온다.
export const BALANCE = {
  softTop: 40,
  softBottom: 20,
  drift: { soc: 0.02, brave: 0.02, mis: 0.02 },
  // 식구 서사: 이만큼(년) 밀린 장은 그 계절의 두 번째 장으로 들어갈 수 있다
  secondChapterLate: 0.5,
};

// ───────── 생성 ─────────
export function newLife(opts = {}) {
  const seed = opts.seed ?? String(Date.now());
  const s = {
    v: 3,
    seed: String(seed),
    rng: hashSeed(seed),
    t: 0,
    phase: 'birth',
    flags: {},
    cnt: {},
    seen: {},
    sched: [],
    queue: [],
    cur: null,
    res: null,
    hist: [],
    ach: {},
    news: {},
    words: [],
    subs: [],
    foiled: 0,
    iinchoEp: 0,
    iinchoMet: false,
    castCh: {},
    vocab: [],
    lastWord: '',
    log: [],
    evCount: 0,
    autoPicks: 0,
  };
  const legacy = opts.legacy || null;
  const continueWorld = !!(legacy && opts.world === 'continue');
  const region = continueWorld ? REGIONS.find((r) => r.id === legacy.region) : pick(s, REGIONS);
  const dojo = continueWorld ? DOJOS.find((d) => d.id === legacy.dojo) : pick(s, DOJOS);
  const gen = continueWorld ? legacy.gen + 1 : 1;
  s.world = {
    region,
    dojo,
    gen,
    dojoName: dojo.id === 'kids' ? region.town + dojo.name : dojo.name,
    dojoNameKo: dojo.id === 'kids' ? region.townKo + ' ' + dojo.nameKo : dojo.nameKo,
    continued: continueWorld,
    prevDojoState: continueWorld ? legacy.dojoState : null,
    yearsLater: continueWorld ? 14 + rint(s, 0, 4) : 0,
  };
  s.cast = continueWorld ? nextGeneration(legacy.cast, gen) : { ...GEN1 };
  s.prevDog = continueWorld ? legacy.dog : null;

  const per = opts.personality ? PERSONALITIES.find((p) => p.id === opts.personality) : pick(s, PERSONALITIES);
  const nm = pick(s, DOG_NAMES);
  s.dog = {
    name: opts.name || nm[0],
    nameKo: opts.nameKo || opts.name || nm[1],
    coat: pick(s, COATS).id,
    hair: pick(s, HAIRS).id,
    per: per.id,
  };
  s.startSeason = rint(s, 0, 3);
  // 닥스훈트 수명: 12~15년 + 0~3계절. 9살 때 건강 상태로 조금 달라진다.
  s.life = 4 * (12 + Math.floor(rand(s) * rand(s) * 4.0)) + rint(s, 0, 3);
  const st = { hap: 55, hea: 70, back: 70, soc: 45, brave: 45, mis: 45 };
  for (const [k, v] of Object.entries(per.st)) st[k] += v;
  for (const [k, v] of Object.entries(dojo.st)) st[k] += v;
  for (const k of STAT_KEYS) st[k] = clamp(st[k] + rint(s, -5, 5));
  s.st = st;
  // 타고난 성격: 계절이 지나면 능력치가 조금씩 이 값 쪽으로 돌아온다
  s.base = { ...st };
  s.stf = {};
  s.bond = { roshi: 15, shihan: 25, okami: 35, kid: 20, worker: 15, elder: 15, kor: 15, iincho: 0 };
  for (const r of ROLES) {
    s.ach[r] = [];
    s.castCh[r] = 0;
  }
  s.ach.iincho = [];
  s.news = initialNews(s);
  s.newsJa = initialNews(s, true);
  return s;
}

function initialNews(s, ja = false) {
  const n = {};
  for (const r of ROLES) {
    const p = personFor(s.cast, r);
    n[r] = ja ? p.descJa || null : p.desc;
  }
  if (s.world.continued) {
    n.roshi = ja ? CONTINUED_JA.roshi : '전 사범. 이제는 뒤에서 도장을 지켜본다.';
    n.shihan = ja ? CONTINUED_JA.shihan : '예전에 이 도장에서 울던 아이. 지금은 사범.';
  }
  return n;
}

export function rerollDog(s) {
  const per = pick(s, PERSONALITIES);
  const nm = pick(s, DOG_NAMES);
  s.dog = { name: nm[0], nameKo: nm[1], coat: pick(s, COATS).id, hair: pick(s, HAIRS).id, per: per.id };
  return s;
}

export function beginLife(s) {
  s.phase = 'season';
  if (s.world.continued) s.queue.push('l_intro');
  else s.queue.push('a_arrive');
  buildSeason(s, true);
  return s;
}

// ───────── 조회 도우미 ─────────
export const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

// 이벤트 효과 v가 지금 값 x를 실제로 얼마나 움직이는지. 100(또는 0)에 가까울수록 덜 움직이지만,
// 끝에 닿지 않았다면 +2 같은 작은 효과도 적어도 1은 보인다.
export function statDelta(x, v) {
  if (!v) return 0;
  const up = v > 0;
  const room = up ? 100 - x : x;
  if (room <= 0) return 0;
  const k = Math.min(1, room / (up ? BALANCE.softTop : BALANCE.softBottom));
  const d = Math.min(room, Math.max(1, Math.round(Math.abs(v) * k)));
  return up ? d : -d;
}

// 예전 저장 데이터에는 타고난 값이 없다: 성격·도장에서 다시 계산한다 (무작위 몫은 빼고)
function baseOf(s) {
  if (!s.base) {
    const per = PERSONALITIES.find((p) => p.id === s.dog.per) || { st: {} };
    const b = { hap: 55, hea: 70, back: 70, soc: 45, brave: 45, mis: 45 };
    for (const [k, v] of Object.entries(per.st)) b[k] += v;
    for (const [k, v] of Object.entries((s.world.dojo && s.world.dojo.st) || {})) b[k] += v;
    for (const k of STAT_KEYS) b[k] = clamp(b[k]);
    s.base = b;
  }
  if (!s.stf) s.stf = {};
  return s.base;
}
export const ageY = (s) => s.t / 4;
export const season = (s) => SEASONS[(s.startSeason + s.t) % 4];
export const yearNo = (s) => Math.floor((s.startSeason + s.t) / 4) + 1;
export const stage = (s) => stageOf(ageY(s));
export const has = (s, f) => s.flags[f] !== undefined;
export const isLastYear = (s) => s.t >= s.life - 4;

function condOk(s, c) {
  if (c === undefined) return true;
  if (typeof c === 'function') return !!c(s);
  if (typeof c === 'string') return c[0] === '!' ? !has(s, c.slice(1)) : has(s, c);
  if (Array.isArray(c)) return c.every((x) => condOk(s, x));
  return true;
}

export function eligible(s, e, ignoreChain = false) {
  if (!e) return false;
  if (e.chainOnly && !ignoreChain) return false;
  const once = e.once !== false;
  if (once && s.seen[e.id] !== undefined) return false;
  if (!once) {
    if (e.cd && s.seen[e.id] !== undefined && s.t - s.seen[e.id] < e.cd) return false;
    if (e.max && (s.cnt['ev_' + e.id] || 0) >= e.max) return false;
  }
  const a = ageY(s);
  if (e.minAge !== undefined && a < e.minAge) return false;
  if (e.maxAge !== undefined && a >= e.maxAge) return false;
  if (e.stage && !e.stage.includes(stage(s))) return false;
  if (e.season && !e.season.includes(season(s))) return false;
  if (e.region && !e.region.includes(s.world.region.id)) return false;
  if (e.dojo && !e.dojo.includes(s.world.dojo.id)) return false;
  if (e.legacy && !s.world.continued) return false;
  if (e.notLast && isLastYear(s)) return false;
  if (!condOk(s, e.req)) return false;
  return true;
}

// ───────── 계절 구성 ─────────
function buildSeason(s, first = false) {
  const q = s.queue;
  const t = s.t;
  const a = ageY(s);
  // 1) 고비 (1, 3, 7, 10살, 마지막 해)
  if (MILESTONE_T[t]) q.push(MILESTONE_T[t]);
  if (t === s.life - 4) q.push('m_last');
  // 2) 예약된 후속 사건
  const due = s.sched.filter((x) => x.t <= t);
  s.sched = s.sched.filter((x) => x.t > t);
  for (const d of due) if (EV.has(d.id) && eligible(s, EV.get(d.id), true)) q.push(d.id);
  // 3) 도장 식구들의 장기 서사: 사람마다 장 순서는 지키고, 누구 이야기가 먼저 열릴지는 견생마다 다르다
  const ready = [];
  for (const role of ROLES) {
    const list = CHAPTERS[role] || [];
    const ch = list[s.castCh[role]];
    if (!ch) continue;
    const at = chapterAt(s, ch);
    if (a < at) continue;
    if (!condOk(s, ch.req)) {
      if (ch.skip) {
        s.castCh[role]++;
      }
      continue;
    }
    const deep = ch.deep === undefined || s.bond[role] >= ch.deep;
    if (!deep) {
      applyBrief(s, ch);
      s.castCh[role]++;
    } else if (!q.includes(ch.id)) {
      // 오래 기다린 장일수록 먼저. 비슷하면 무작위
      ready.push({ role, ch, late: a - at, key: a - at + rand(s) * 0.75 });
    }
  }
  ready.sort((x, y) => y.key - x.key);
  let deepCount = 0;
  for (const r of ready) {
    // 한 계절에 한 장. 밀린 장이 있으면 두 장까지, 아주 오래 밀린 장은 몇 장이든
    if (deepCount > 0 && !(deepCount === 1 && r.late >= BALANCE.secondChapterLate) && r.late < 1.5) continue;
    q.push(r.ch.id);
    s.castCh[r.role]++;
    deepCount++;
  }
  // 4) 委員長
  const next = IINCHO[s.iinchoEp];
  if (next && !first && !isLastYear(s) && eligible(s, next, true) && chance(s, 0.17)) q.push(next.id);
  // 마지막 해: 委員長을 세 번 이상 만났다면 최종 작전
  if (isLastYear(s) && s.iinchoEp >= 3 && s.seen.i_final === undefined && t === s.life - 3) q.push('i_final');
  // 5) 일상·검도·서브스토리
  let want = q.length >= 3 ? 0 : q.length === 2 ? (chance(s, 0.25) ? 1 : 0) : q.length === 1 ? (chance(s, 0.7) ? 1 : 0) : chance(s, 0.45) ? 2 : 1;
  if (first) want = Math.min(want, 1);
  const sea = season(s);
  for (let i = 0; i < want; i++) {
    const cands = POOLABLE.filter((e) => eligible(s, e) && !q.includes(e.id));
    const e = weighted(s, cands, (x) => poolWeight(s, x, sea));
    if (!e) break;
    q.push(e.id);
  }
  // 6) 허브: 산책 코스 고르기 / 누구 옆에
  if (!first && q.length < 3 && chance(s, 0.22)) {
    const h = weighted(s, HUBS.filter((e) => eligible(s, e)), (x) => x.w ?? 1);
    if (h) q.push(h.id);
  }
  while (q.length > MAX_EVENTS_PER_SEASON) {
    // 우선순위 낮은 일상부터 다음 계절로 미룬다
    const idx = q.findLastIndex((id) => EV.get(id).cat === 'daily' || EV.get(id).cat === 'hub');
    if (idx < 0) break;
    q.splice(idx, 1);
  }
  // 한 계절 안의 순서도 섞는다. 맨 앞의 도착·생일(고비)만 그대로 둔다.
  let head = 0;
  while (head < q.length && (EV.get(q[head])?.cat === 'milestone' || q[head] === 'a_arrive' || q[head] === 'l_intro')) head++;
  if (q.length - head > 1) q.splice(head, q.length - head, ...shuffle(s, q.slice(head)));
}

// 식구 서사의 장이 열리는 나이: 견생마다 한 계절 앞당겨지거나 두 계절까지 늦어진다 (시드로 정해지므로 저장이 필요 없다).
// 같은 사람·같은 나이의 갈림길 장(o5a/o5b/o5c 등)은 함께 움직인다. 생후 반년 안의 장은 앞당기지 않고, 9살 이후의 장은 늦추지 않는다.
// 다른 사람의 장과 순서가 꼭 맞아야 하는 장은 데이터에 fixedAt: true 를 달면 원래 나이에 고정된다.
export function chapterAt(s, ch) {
  if (ch.fixedAt) return ch.at;
  const r = rand({ rng: hashSeed(s.seed + '|' + ch.who + '|' + ch.at) });
  const lo = ch.at <= 0.5 ? 0 : -1;
  const hi = ch.at >= 9 ? 0 : 2;
  return ch.at + (lo + Math.floor(r * (hi - lo + 1))) * 0.25;
}

function poolWeight(s, e, sea) {
  let w = e.w ?? 1;
  if (e.cat === 'kendo') w *= 0.9;
  if (e.cat === 'sub') w *= 0.68;
  // 큰 사건, 늘그막에만 있는 장면, 곧 지나가 버릴 장면은 일상 더미에 묻히지 않게
  if (e.major && e.cat !== 'sub') w *= 3;
  if ((e.minAge ?? 0) >= 9 || (e.stage && e.stage.every((x) => x === 'senior'))) w *= 4;
  else if ((e.minAge ?? 0) >= 7) w *= 2.5;
  if (e.maxAge !== undefined && e.maxAge - ageY(s) <= 1) w *= 2;
  if (e.cal && e.season && e.season.includes(sea)) w *= 3;
  if (e.gag) w *= 0.5 + s.st.mis / 80;
  if (e.brave) w *= 0.5 + s.st.brave / 80;
  if (e.social) w *= 0.5 + s.st.soc / 80;
  if (e.wantBond) w *= 0.4 + s.bond[e.wantBond] / 60;
  return w;
}

function applyBrief(s, ch) {
  const b = ch.brief || {};
  const out = applyOutcome(s, { ...b, fx: b.fx }, ch, true);
  s.seen[ch.id] = s.t;
  s.log.push({ t: s.t, kind: 'news', who: ch.who, text: out.res || resolveKo(b.news ? Object.values(b.news)[0] : '', { s }), textJa: out.resJa || (b.newsJa ? Object.values(b.newsJa)[0] : null) });
  s.hist.push({ t: s.t, id: ch.id, title: ch.title, titleJa: ch.titleJa || jaOnly(ch.title), brief: true });
}

// 저장 데이터 복구: 빠진(삭제·빈 자리) 이벤트를 가리키는 진행 중 장면·대기열·예약을 정리한다.
// (예: 「밤 11시의 장부」 도중에 저장한 견생을 불러올 때)
export function repairState(s) {
  const gone = (id) => !EV.has(id) || EV.get(id).removed;
  let fixed = 0;
  if (s.cur && gone(s.cur.id)) {
    s.cur = null;
    if (s.phase === 'event') s.phase = 'season';
    fixed++;
  }
  if (s.res && s.res.id && gone(s.res.id) && s.phase === 'result') {
    s.res = null;
    s.phase = 'season';
    fixed++;
  }
  const q0 = s.queue.length;
  s.queue = s.queue.filter((id) => !gone(id));
  const k0 = s.sched.length;
  s.sched = s.sched.filter((x) => !gone(x.id));
  return fixed + (q0 - s.queue.length) + (k0 - s.sched.length);
}

// ───────── 이벤트 진행 ─────────
export function hasEvent(s) {
  return s.phase === 'season' && s.queue.length > 0;
}

export function nextEvent(s) {
  while (s.queue.length) {
    const id = s.queue.shift();
    const e = EV.get(id);
    if (!e) continue;
    if (s.seen[id] !== undefined && e.once !== false && e.cat !== 'milestone') continue;
    s.cur = { id, t: s.t };
    s.phase = 'event';
    s.seen[id] = s.t;
    s.cnt['ev_' + id] = (s.cnt['ev_' + id] || 0) + 1;
    s.evCount++;
    if (e.cat === 'iincho') {
      s.iinchoMet = true;
      if (e.ep) s.iinchoEp = Math.max(s.iinchoEp, IINCHO.indexOf(e) + 1);
    }
    if (e.onShow) applyOutcome(s, e.onShow, e, true);
    return view(s);
  }
  return null;
}

function flatLines(s, lines) {
  const out = [];
  for (const l of lines || []) {
    if (Array.isArray(l)) out.push(l);
    else if (l && condOk(s, l.if)) out.push(...flatLines(s, l.l));
    else if (l && l.else) out.push(...flatLines(s, l.else));
  }
  return out;
}

// 한글이 없는 글(「{kid}」처럼 이름만 있는 선택지 등)은 일본어로도 그대로 쓸 수 있다
const jaOnly = (t) => (t && !/[가-힣]/.test(t) ? t : null);

function flatText(s, t) {
  if (!t) return '';
  if (typeof t === 'function') return t(s) || '';
  if (Array.isArray(t)) return t.map((x) => (typeof x === 'string' ? x : condOk(s, x.if) ? x.v : x.else || '')).filter(Boolean).join('\n');
  return t;
}

export function choiceAvailable(s, c) {
  return condOk(s, c.req);
}

export function view(s) {
  if (!s.cur) return null;
  const e = EV.get(s.cur.id);
  const ctx = { s };
  const choices = (e.choices || []).map((c, i) => ({ i, t: resolveKo(flatText(s, c.t), ctx), tJa: flatText(s, c.tJa) || jaOnly(flatText(s, c.t)), tag: c.tag, mini: c.mini, ok: choiceAvailable(s, c), why: c.why || '', whyJa: c.whyJa || null }));
  return {
    id: e.id,
    cat: e.cat,
    who: e.who,
    title: resolveKo(e.title, ctx),
    // 일본어는 템플릿 그대로 (자리표시자·후리가나는 화면이 처리한다)
    titleJa: e.titleJa || jaOnly(e.title),
    text: resolveKo(flatText(s, e.text), ctx),
    textJa: flatText(s, e.textJa) || null,
    lines: flatLines(s, e.lines),
    choices: choices.filter((c) => c.ok || c.why),
    major: !!(e.major || e.cat === 'milestone'),
    word: e.word || null,
    sub: e.sub || null,
    mini: e.mini || null,
  };
}

// 성격과 능력치에 맞게 자동 선택
export function autoChoice(s) {
  const e = EV.get(s.cur.id);
  const cs = (e.choices || []).map((c, i) => ({ c, i })).filter((x) => choiceAvailable(s, x.c));
  if (!cs.length) return -1;
  if (e.mini) {
    // 미니게임: 사회성과 장난기로 결과를 정한다
    const p = (s.st.soc + s.st.mis) / 200;
    const r = rand(s);
    const want = r < p * 0.55 ? 'great' : r < p * 0.55 + 0.45 ? 'ok' : 'bad';
    const hit = cs.find((x) => x.c.mini === want);
    return (hit || cs[0]).i;
  }
  const per = PERSONALITIES.find((p) => p.id === s.dog.per);
  let best = cs[0];
  let bestScore = -1;
  for (const x of cs) {
    let w = per.tags[x.c.tag] ?? 1;
    if (x.c.tag === 'play') w *= 0.7 + s.st.mis / 100;
    if (x.c.tag === 'brave') w *= 0.6 + s.st.brave / 100;
    if (x.c.tag === 'sweet' && s.st.hap < 40) w *= 1.4;
    if (x.c.tag === 'social') w *= 0.7 + s.st.soc / 120;
    if (x.c.risk && s.st.back < 40) w *= 0.6;
    const score = w * (0.55 + rand(s) * 0.9);
    if (score > bestScore) {
      bestScore = score;
      best = x;
    }
  }
  return best.i;
}

export function choose(s, i, auto = false) {
  const e = EV.get(s.cur.id);
  const c = i >= 0 && e.choices ? e.choices[i] : null;
  if (c && !choiceAvailable(s, c)) throw new Error('선택할 수 없는 선택지');
  const before = snapshot(s);
  const out = applyOutcome(s, c || e, e, false);
  if (auto && c) s.autoPicks++;
  const after = snapshot(s);
  s.res = {
    id: e.id,
    choice: c ? resolveKo(flatText(s, c.t), { s }) : null,
    choiceJa: c ? flatText(s, c.tJa) || jaOnly(flatText(s, c.t)) : null,
    auto,
    res: out.res,
    resJa: out.resJa || null,
    notesJa: out.notesJa,
    lines: out.lines,
    delta: diff(before, after),
    notes: out.notes,
    clear: out.clear,
    foil: out.foil,
    word: e.word || null,
  };
  s.hist.push({ t: s.t, id: e.id, title: resolveKo(e.title, { s }), titleJa: e.titleJa || jaOnly(e.title), choice: s.res.choice, choiceJa: s.res.choiceJa, auto });
  s.phase = 'result';
  return s.res;
}

export function ack(s) {
  const r = s.res;
  s.cur = null;
  s.res = null;
  if (r && r.word) {
    s.phase = 'word';
    s.pendingWord = { id: r.id, q: r.word.q, presets: r.word.presets, qJa: r.word.qJa || null, presetsJa: r.word.presetsJa || null };
    return s;
  }
  s.phase = 'season';
  return s;
}

export function setWord(s, text, auto = false) {
  const w = s.pendingWord;
  const clean = String(text || '').trim().slice(0, 40);
  const text0 = clean || w.presets[0];
  // 고른 말이 준비된 한마디면 짝이 되는 일본어/한국어도 남긴다
  const pj = w.presetsJa || [];
  let i = w.presets.indexOf(text0);
  if (i < 0) i = pj.indexOf(text0);
  const entry = { t: s.t, age: Math.floor(ageY(s)), id: w.id, q: w.q, text: i >= 0 ? w.presets[i] : text0, auto };
  if (i >= 0 && pj[i]) entry.textJa = pj[i];
  else if (!/[가-힣]/.test(text0)) entry.textJa = text0;
  s.words.push(entry);
  s.pendingWord = null;
  s.phase = 'season';
  return s;
}

export function autoWord(s) {
  const w = s.pendingWord;
  const per = s.dog.per;
  const idx = (hashSeed(per + w.id + s.seed) >>> 0) % w.presets.length;
  return w.presets[idx];
}

// 계절 끝: 시간 경과에 따른 변화와 다음 계절 준비
export function endSeason(s) {
  if (s.phase !== 'season') throw new Error('계절을 끝낼 수 없는 상태: ' + s.phase);
  // 남은 이벤트는 다음 계절로 넘기지 않고 버린다 (고비/예약 사건은 다시 넣는다)
  for (const id of s.queue) {
    const e = EV.get(id);
    if (e && (e.cat === 'cast' || e.cat === 'milestone' || e.chainOnly)) s.sched.push({ id, t: s.t + 1 });
  }
  s.queue = [];
  passive(s);
  s.t++;
  if (s.t === 36) s.life = Math.max(s.t + 8, s.life + Math.max(-3, Math.min(3, Math.round((s.st.hea - 60) / 15))));
  if (s.t >= s.life) {
    s.phase = 'farewell';
    return s;
  }
  buildSeason(s);
  return s;
}

function passive(s) {
  const a = ageY(s);
  const st = s.st;
  if (a >= 10) {
    st.hea -= rint(s, 0, 2) + (a >= 12 ? 1 : 0);
    if (s.t % 2 === 0) st.back -= 1;
  } else if (a >= 7 && s.t % 2 === 0) {
    st.hea -= 1;
  }
  if (has(s, 'back_care')) st.back += 2;
  st.hap += st.hap < 55 ? 1 : st.hap > 75 ? -1 : 0;
  if (st.hea < 25) st.hap -= 1;
  if (a < 3 && s.t % 2 === 1) st.mis += 1;
  if (a >= 9 && s.t % 3 === 0) st.mis -= 1;
  // 성격 쪽으로 천천히 돌아온다: 멀리 올라간 값일수록 많이. 소수점 몫은 모아 두었다가 1이 되면 움직인다.
  const base = baseOf(s);
  for (const [k, rate] of Object.entries(BALANCE.drift)) {
    const f = (s.stf[k] || 0) + (base[k] - st[k]) * rate;
    const n = Math.trunc(f);
    st[k] += n;
    s.stf[k] = Math.round((f - n) * 1000) / 1000;
  }
  for (const k of STAT_KEYS) st[k] = clamp(st[k]);
  if (has(s, 'back_care') && s.t - s.flags.back_care > 6) delete s.flags.back_care;
}

// ───────── 효과 적용 ─────────
function applyOutcome(s, o, e, silent) {
  const out = { res: '', resJa: '', lines: [], notes: [], notesJa: [], clear: null, foil: false };
  const addJa = (t) => {
    if (t) out.resJa += (out.resJa ? '\n' : '') + t;
  };
  if (!o) return out;
  let node = o;
  const ctx = { s };
  const merge = (n) => {
    if (n.fx) {
      const fx = typeof n.fx === 'function' ? n.fx(s) : n.fx;
      for (const [k, v0] of Object.entries(fx)) {
        let v = v0;
        if (k.startsWith('b_')) {
          const r = k.slice(2);
          if (v > 0) v = Math.max(1, Math.round(v * (0.75 + s.st.soc / 200)));
          s.bond[r] = clamp((s.bond[r] ?? 0) + v);
        } else if (k in s.st) {
          s.st[k] = clamp(s.st[k] + statDelta(s.st[k], v));
        }
      }
    }
    for (const f of [].concat(n.set || [])) if (s.flags[f] === undefined) s.flags[f] = s.t;
    for (const f of [].concat(n.unset || [])) delete s.flags[f];
    for (const c of [].concat(n.cnt || [])) s.cnt[c] = (s.cnt[c] || 0) + 1;
    if (n.ach) {
      const list = Array.isArray(n.ach[0]) ? n.ach : [n.ach];
      const listJa = n.achJa ? (Array.isArray(n.achJa[0]) ? n.achJa : [n.achJa]) : [];
      list.forEach(([role, text], i) => s.ach[role].push({ t: s.t, text: resolveKo(text, ctx), textJa: listJa[i] ? listJa[i][1] : null }));
    }
    if (n.news) for (const [role, text] of Object.entries(n.news)) {
      s.news[role] = resolveKo(text, ctx);
      s.newsJa = s.newsJa || {};
      s.newsJa[role] = n.newsJa ? n.newsJa[role] || null : null;
    }
    if (n.foil) {
      s.foiled++;
      out.foil = true;
    }
    if (n.clear) {
      if (!s.subs.includes(n.clear)) s.subs.push(n.clear);
      out.clear = n.clear;
    }
    if (n.risk) {
      const p = n.risk * (1.6 - s.st.back / 100);
      if (chance(s, p) && !s.sched.some((x) => x.id === 'x_back_vet') && s.seen.x_back_vet === undefined) {
        s.sched.push({ id: 'x_back_vet', t: s.t + 1 });
        s.st.back = clamp(s.st.back - 6);
        out.notes.push('허리가 조금 이상한 것 같다…');
        out.notesJa.push('腰が少しおかしい気がする……。');
      } else if (chance(s, p) && s.seen.x_back_vet !== undefined && !s.sched.some((x) => x.id === 'x_back_vet2') && s.seen.x_back_vet2 === undefined && ageY(s) >= 5) {
        s.sched.push({ id: 'x_back_vet2', t: s.t + 1 });
        s.st.back = clamp(s.st.back - 6);
        out.notes.push('또 허리가 뻐근하다. 계단을 조심하자.');
        out.notesJa.push('また腰が重い。階段に気をつけよう。');
      }
    }
    if (n.next) s.queue.unshift(...[].concat(n.next).filter((id) => EV.has(id)));
    if (n.later) {
      const list = Array.isArray(n.later[0]) ? n.later : [n.later];
      for (const [id, d] of list) if (EV.has(id)) s.sched.push({ id, t: s.t + d });
    }
    if (n.pool) {
      const cands = ALL_EVENTS.filter((x) => x.pool === n.pool && eligible(s, x, true));
      const pickE = weighted(s, cands, (x) => x.w ?? 1);
      if (pickE) s.queue.unshift(pickE.id);
      else if (n.poolEmpty) {
        out.res += (out.res ? '\n' : '') + resolveKo(n.poolEmpty, ctx);
        addJa(n.poolEmptyJa);
      }
    }
    if (n.res) {
      out.res += (out.res ? '\n' : '') + resolveKo(flatText(s, n.res), ctx);
      addJa(flatText(s, n.resJa));
    }
    if (n.lines) out.lines.push(...flatLines(s, n.lines));
  };
  merge(node);
  if (node.check) {
    const ck = node.check;
    const stat = ck.st.startsWith('b_') ? s.bond[ck.st.slice(2)] : s.st[ck.st];
    const dc = typeof ck.dc === 'function' ? ck.dc(s) : ck.dc;
    const p = Math.max(0.1, Math.min(0.92, 0.5 + (stat - dc) / 60));
    const ok = rand(s) < p;
    const branch = ok ? ck.ok : ck.ng;
    if (branch) merge(branch);
    if (!silent) {
      out.notes.push(ok ? '성공' : '실패');
      out.notesJa.push(ok ? '成功' : '失敗');
    }
  }
  return out;
}

function snapshot(s) {
  return { st: { ...s.st }, bond: { ...s.bond } };
}
function diff(a, b) {
  const d = [];
  for (const k of STAT_KEYS) if (a.st[k] !== b.st[k]) d.push({ k, v: b.st[k] - a.st[k] });
  for (const k of Object.keys(b.bond)) if (a.bond[k] !== b.bond[k]) d.push({ k: 'b_' + k, v: b.bond[k] - a.bond[k] });
  return d;
}

// ───────── 마지막 ─────────
export function farewell(s) {
  return farewellLines(s);
}

export function finish(s, lastWord) {
  s.lastWord = String(lastWord || '').trim().slice(0, 60);
  s.phase = 'ended';
  s.summary = summarize(s);
  return s.summary;
}

export function titlesOf(s) {
  const got = TITLES.filter((t) => {
    try {
      return t.cond(s);
    } catch {
      return false;
    }
  });
  got.sort((a, b) => b.p - a.p);
  return got.map((t) => ({ id: t.id, ja: t.ja, ko: t.ko }));
}

// 견생 연표(「一生」)에 올릴 큰 일. 앞에서부터 자르면 다섯 살 무렵에서 끝나 버리므로
// 나이대(0~2, 3~5, 6~9, 10~)마다 몫을 나누고, 같은 나이대 안에서는 서로 떨어진 일을 고른다.
//  - 맨 처음(도장에 온 날)과 마지막 해의 고비는 늘 넣는다
//  - 서브스토리는 한 이야기에 한 줄(마지막으로 본 장면)
//  - 생일 고비는 그 나이대에 올릴 일이 모자랄 때만
export const TIMELINE_BANDS = [0, 3, 6, 10];
// 이 견생에만 있었던 일(갈림길 장, 우연히 만난 큰 사건, 동네 이야기)을 누구에게나 오는 장보다 조금 앞에 둔다
function keyPriority(e) {
  if (e.cat === 'milestone') return 0.5;
  if (e.cat === 'cast') return e.req || e.chainOnly ? 3.5 : 3;
  if (e.cat === 'sub') return e.major ? 3.5 : 3;
  return 3.5;
}
export function lifeTimeline(s, max = 14) {
  const isKey = (e) => e && (e.major || e.cat === 'milestone' || e.cat === 'sub');
  const cand = [];
  const lastOfSub = new Map();
  s.hist.forEach((x, i) => {
    if (x.brief) return;
    const e = EV.get(x.id);
    if (!isKey(e)) return;
    const c = { x, i, t: x.t, e, pri: keyPriority(e) };
    if (e.sub) {
      const prev = lastOfSub.get(e.sub);
      if (prev) prev.drop = true;
      lastOfSub.set(e.sub, c);
    }
    cand.push(c);
  });
  const pool = cand.filter((c) => !c.drop);
  if (!pool.length) return [];
  const chosen = new Set();
  const take = (c) => c && chosen.add(c);
  take(pool[0]);
  if (max > 1) take(pool.find((c) => c.x.id === 'm_last'));
  const bandOf = (t) => {
    let b = 0;
    TIMELINE_BANDS.forEach((from, k) => {
      if (t / 4 >= from) b = k;
    });
    return b;
  };
  const gap = (c) => {
    let g = 99;
    for (const o of chosen) g = Math.min(g, Math.abs(o.t - c.t));
    return g;
  };
  // 점수: 큰 일일수록, 이미 고른 일과 떨어져 있을수록 (계절 8개 거리까지)
  const best = (list) => {
    let top = null;
    let ts = -1;
    for (const c of list) {
      if (chosen.has(c)) continue;
      const sc = c.pri * 4 + Math.min(gap(c), 8);
      if (sc > ts) {
        ts = sc;
        top = c;
      }
    }
    return top;
  };
  const nb = TIMELINE_BANDS.length;
  const room = Math.max(0, max - chosen.size);
  const bands = Array.from({ length: nb }, (_, k) => pool.filter((c) => bandOf(c.t) === k));
  // 나이대별 몫: 고르게 나누고, 남는 자리는 뒤쪽 나이대부터
  const quota = bands.map(() => Math.floor(room / nb));
  for (let k = nb - 1, r = room - quota[0] * nb; r > 0; k--, r--) quota[k]++;
  for (let k = 0; k < nb; k++) {
    for (let n = 0; n < quota[k]; n++) {
      const c = best(bands[k].filter((x) => x.pri >= 1)) || best(bands[k]);
      if (!c) break;
      take(c);
    }
  }
  // 나이대에 일이 모자라 남은 자리는 전체에서
  while (chosen.size < max) {
    const c = best(pool.filter((x) => x.pri >= 1)) || best(pool);
    if (!c) break;
    take(c);
  }
  return [...chosen].sort((p, q) => p.i - q.i).map((c) => c.x);
}

export function summarize(s) {
  const titles = titlesOf(s);
  const cast = {};
  for (const r of ROLES) {
    const p = personFor(s.cast, r);
    cast[r] = {
      id: p.id, name: p.s ? p.s + ' ' + p.g : p.g, ko: p.ko, call: p.call, bond: s.bond[r],
      ach: s.ach[r].map((x) => x.text), achJa: s.ach[r].map((x) => x.textJa || x.text),
      status: s.news[r], statusJa: (s.newsJa || {})[r] || null,
      epilogue: resolveKo(castEpilogue(s, r), { s }), epilogueJa: castEpilogue(s, r, true),
    };
  }
  return {
    dog: { ...s.dog },
    life: s.t,
    years: Math.floor(s.t / 4),
    seasons: s.t % 4,
    startSeason: s.startSeason,
    world: { region: s.world.region.id, dojo: s.world.dojo.id, dojoName: s.world.dojoName, gen: s.world.gen },
    cast,
    subs: s.subs.length,
    foiled: s.foiled,
    iinchoMet: s.iinchoMet,
    words: s.words,
    lastWord: s.lastWord,
    titles,
    vocab: s.vocab.length,
    stats: { ...s.st },
    events: s.evCount,
    dojoState: dojoState(s),
    timeline: lifeTimeline(s).map((x) => ({ t: x.t, id: x.id, title: x.title, titleJa: x.titleJa || null })),
  };
}

export function dojoState(s) {
  if (has(s, 'dojo_saved')) return 'saved';
  if (has(s, 'dojo_moved')) return 'moved';
  if (has(s, 'dojo_kominkan')) return 'kominkan';
  return 'saved';
}

// 이어지는 세계를 위한 기록
export function legacyOf(s) {
  return {
    region: s.world.region.id,
    dojo: s.world.dojo.id,
    gen: s.world.gen,
    cast: { ...s.cast },
    dog: { name: s.dog.name, nameKo: s.dog.nameKo, coat: s.dog.coat, hair: s.dog.hair },
    dojoState: dojoState(s),
    title: (titlesOf(s)[0] || {}).ja || '',
  };
}

// 테스트·오토용: 지금 상태에서 할 일을 한 단계 진행
export function stepAuto(s, mode = 'all') {
  switch (s.phase) {
    case 'birth':
      return beginLife(s);
    case 'season':
      if (hasEvent(s)) return nextEvent(s);
      return endSeason(s);
    case 'event':
      return choose(s, autoChoice(s), true);
    case 'result':
      return ack(s);
    case 'word':
      return setWord(s, autoWord(s), true);
    case 'farewell':
      return finish(s, '');
    default:
      return null;
  }
}

export { ROLES, personFor };
export const debug = { CHAPTERS, IINCHO, POOLABLE, HUBS };
