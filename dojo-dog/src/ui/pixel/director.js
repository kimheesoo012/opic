// 장면 연출: 게임 상태와 이벤트를 보고 장소·시간대·등장인물·개의 동작을 정한다. (그리기는 lcd.js)
import * as G from '../../engine/core.js';
import { ROLES } from '../../engine/world.js';
import { LOOKS, kidSize } from './people.js';
import { C } from './core.js';

// 장소별 발 위치: py = 사람 윗변, dy = 개 윗변
export const FLOOR = {
  dojo: { py: 52, dy: 70 },
  street: { py: 50, dy: 70 },
  river: { py: 44, dy: 61 },
  shrine: { py: 52, dy: 72 },
  court: { py: 46, dy: 74 },
  bath: { py: 50, dy: 70 },
  izakaya: { py: 50, dy: 72 },
  festival: { py: 52, dy: 72 },
  vet: { py: 50, dy: 31 },
  room: { py: 52, dy: 70 },
};

// 이벤트 글에서 장소를 고르는 낱말 (앞쪽이 우선)
const LOC_WORDS = [
  ['vet', ['동물병원', '병원', '獣医', '病院', '수의사', '진찰']],
  ['court', ['대회', '시합', '試合', '大会', '審査', '심사', '杯', 'インターハイ', '승단', '決勝', '결승', '団体戦', '단체전']],
  ['bath', ['銭湯', '목욕탕', 'お風呂']],
  ['izakaya', ['居酒屋', '이자카야', '술자리', '飲み会', '회식', '打ち上げ', '뒤풀이', '忘年会', '송년회']],
  ['festival', ['祭り', '축제', '마쓰리', '花火', '불꽃', '盆踊り', '야타이', '屋台']],
  ['shrine', ['神社', '신사', '初詣', '참배', 'お参り', '鳥居']],
  ['river', ['河川敷', '강변', '강가', '둑', '土手', '川']],
  ['street', ['商店街', '상점가', '가게', 'コロッケ', '정육점', '八百屋', '편의점', '카페', '노래방', 'カラオケ']],
];
const NIGHT_WORDS = ['夜', '밤', '저녁 稽古', '夜稽古', '居酒屋', '이자카야', '술자리', '축제', '祭り', '花火', '불꽃'];

const textCache = new Map();
function evText(ev) {
  if (textCache.has(ev.id)) return textCache.get(ev.id);
  const parts = [ev.title, ev.text, ...(ev.lines || []).map((l) => l[1] + l[2])];
  const t = parts.filter((x) => typeof x === 'string').join(' ');
  textCache.set(ev.id, t);
  return t;
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

export function locFor(ev, s) {
  if (!ev) return 'dojo';
  const t = evText(ev);
  for (const [loc, words] of LOC_WORDS) if (words.some((w) => t.includes(w))) return loc;
  if (ev.id === 'h_walk' || ev.pool === 'walk' || /^w_|^dw_/.test(ev.id)) return ['river', 'street', 'shrine'][Math.floor(hashStr(ev.id) * 3)];
  if (ev.cat === 'iincho') return 'street';
  if (G.stage(s) === 'senior' && ev.cat !== 'kendo' && hashStr(ev.id) < 0.4) return 'room';
  return 'dojo';
}

export function isMatch(ev) {
  if (!ev) return false;
  const t = evText(ev);
  return ['試合', '大会', '杯', 'インターハイ', '決勝', '시합', '대회', '결승', '団体戦'].some((w) => t.includes(w));
}

export function todFor(ev, frac) {
  if (ev) {
    const t = evText(ev);
    if (NIGHT_WORDS.some((w) => t.includes(w))) return 'night';
  }
  return frac < 0.55 ? 'day' : frac < 0.8 ? 'evening' : 'night';
}

export function gone(s, role) {
  return (role === 'roshi' && G.has(s, 'roshi_gone')) || (role === 'kor' && G.has(s, 'kor_left'));
}

// 역할 → 도트 모습
export function lookFor(s, role) {
  const id = s.cast[role];
  if (role === 'iincho') return { look: LOOKS.iincho, size: 'adult' };
  const base = LOOKS[id] || LOOKS.makoto;
  let look = base;
  if (role === 'roshi' && id !== 'washio') look = { ...base, hair: C.G };
  const size = role === 'kid' ? kidSize(G.ageY(s)) : base.size === 'kid' ? 'adult' : base.size;
  return { look, size };
}

function speakersOf(lines) {
  const out = [];
  for (const l of lines || []) {
    const sp = l[0];
    if ((ROLES.includes(sp) || sp === 'iincho') && !out.includes(sp)) out.push(sp);
  }
  return out;
}

// 계절이 바뀔 때 고르는 평소 장면
export function idlePlan(s, frac = 0) {
  const roles = ROLES.filter((r) => !gone(s, r));
  const seed = hashStr(`${s.seed}:${s.t}`);
  const senior = G.stage(s) === 'senior';
  const loc = senior && seed < 0.35 ? 'room' : seed > 0.85 ? 'river' : 'dojo';
  const plan = { loc, tod: todFor(null, frac), people: [], dog: { mode: 'wander' }, match: false };
  if (loc === 'dojo') {
    // 稽古하는 두 사람과, 있으면 노사범이 正座로 지켜본다
    const fighters = roles.filter((r) => r !== 'okami' && r !== 'roshi');
    const a = fighters[Math.floor(seed * fighters.length) % fighters.length];
    const b = fighters[(Math.floor(seed * fighters.length) + 1 + Math.floor(seed * 7)) % fighters.length];
    if (a) plan.people.push({ role: a, x: 74, anim: 'keiko', bogu: true });
    if (b && b !== a) plan.people.push({ role: b, x: 104, anim: 'keiko', bogu: true, flip: true, phase: 1 });
    if (roles.includes('roshi')) plan.people.push({ role: 'roshi', x: 132, pose: 'seiza', flip: true });
  } else if (loc === 'room') {
    if (roles.includes('okami')) plan.people.push({ role: 'okami', x: 96, pose: 'seiza', casual: true, flip: true });
    plan.dog = { mode: 'stay', pose: 'sleep', x: 44 };
  } else {
    plan.people.push({ role: roles.includes('okami') ? 'okami' : roles[0], x: 70, pose: 'stand', casual: true, walk: true });
  }
  return plan;
}

// 이벤트 장면
export function eventPlan(s, v, frac = 0) {
  const ev = G.EV.get(v.id);
  const loc = locFor(ev, s);
  const match = loc === 'court' && isMatch(ev);
  const tod = loc === 'izakaya' || loc === 'festival' ? 'night' : loc === 'court' || loc === 'vet' || loc === 'bath' ? 'day' : todFor(ev, frac);
  const plan = { loc, tod, people: [], dog: { mode: 'stay', pose: 'sit', x: 36 }, match, big: v.major ? bigText(ev) : null };
  let who = speakersOf(v.lines);
  if (v.who && !who.includes(v.who)) who.unshift(v.who);
  if (ev.cat === 'iincho' && !who.includes('iincho')) who.unshift('iincho');
  who = who.filter((r) => r === 'iincho' || !gone(s, r) || (v.lines || []).some((l) => l[0] === r));
  const kendo = ev.cat === 'kendo' || ev.kendo;
  if (match) {
    plan.dog = { mode: 'peek', pose: 'sniff', x: -9 };
    plan.people.push({ role: who[0] || 'kid', x: 58, anim: 'match', bogu: true, mark: 'red' });
    plan.people.push({ role: '_rival', x: 86, anim: 'match', bogu: true, flip: true, mark: 'white', phase: 1 });
    plan.judges = true;
    return plan;
  }
  const outside = loc !== 'dojo' && loc !== 'room';
  who.slice(0, 3).forEach((r, i) => {
    const p = { role: r, x: 72 + i * 26, pose: 'stand', flip: true, casual: outside || loc === 'room' };
    if (loc === 'dojo' && kendo && r !== 'okami' && i < 2) Object.assign(p, { anim: 'keiko', bogu: i === 0 ? false : true, flip: true });
    if (loc === 'room' && i === 0) p.pose = 'seiza';
    plan.people.push(p);
  });
  if (loc === 'vet') plan.dog = { mode: 'stay', pose: 'sit', x: 58 };
  if (plan.people[0]) plan.people[0].talk = true;
  plan.bubble = v.major ? '!' : ev.cat === 'iincho' ? '?' : null;
  return plan;
}

const BIG_MS = { m_1: '一歳', m_3: '三歳', m_7: '七歳', m_10: '十歳', m_last: '最後の一年' };
function bigText(ev) {
  if (BIG_MS[ev.id]) return BIG_MS[ev.id];
  const t = evText(ev);
  if (['審査', '심사', '승단'].some((w) => t.includes(w))) return '審査';
  if (isMatch(ev)) return '試合';
  if (ev.cat === 'sub') return 'サブストーリー';
  if (ev.cat === 'iincho') return '委員長';
  return '大事な日';
}
