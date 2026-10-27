// 학습 기록과 복습(간격 반복). UI 없이 동작한다.
// 항목 id: 'v:단어' 또는 'g:문법키'. 기록: { met, box, due, streak, ok, ng, last, iv, ef, tr }
// 간격: 처음 세 번은 1·3·7일, 그다음부터는 지난 간격 × 쉬움 계수(ef). 맞히면 ef가 조금 오르고, 틀리면 내려가며 다음 날부터 다시.
// 「번역 보기」(tr)는 틀린 것으로 치지 않는다. 복습 순서를 정할 때만 참고한다.
import { VOCAB } from '../data/vocab.js';
import { GRAMMAR } from '../data/grammar.js';
import { hashSeed, rand, shuffle } from './rng.js';

export const DAY = 24 * 3600 * 1000;
export const SRS_DAYS = [1, 3, 7];
export const EF0 = 2.3;
export const EF_MIN = 1.3;
export const EF_MAX = 3;
export const MASTER_STREAK = 2;

export function itemOf(id) {
  const [t, key] = [id.slice(0, 1), id.slice(2)];
  if (t === 'g') return GRAMMAR[key] ? { type: 'g', key, ...GRAMMAR[key] } : null;
  return VOCAB[key] ? { type: 'v', key, ...VOCAB[key] } : null;
}
export const levelOf = (id) => itemOf(id)?.lv || null;
export const isN2 = (id) => levelOf(id) === 'N2';

// 장면에서 처음 만나면 다음 날 복습 대상이 된다
export function meet(srs, id, now = Date.now()) {
  if (!itemOf(id)) return false;
  if (srs[id]) return false;
  srs[id] = { met: now, box: 0, due: now + DAY, streak: 0, ok: 0, ng: 0, last: 0 };
  return true;
}

// 다음 간격(일). 옛 기록(1·3·7·14일 상자, iv 없음)도 그대로 이어서 쓴다.
export function nextInterval(r) {
  if (r.box < SRS_DAYS.length) return SRS_DAYS[r.box];
  const prev = r.iv || (r.box >= 4 ? 14 : 7);
  return Math.max(prev + 1, Math.round(prev * (r.ef || EF0)));
}

export function grade(srs, id, ok, now = Date.now()) {
  const r = srs[id] || { met: now, box: 0, due: now, streak: 0, ok: 0, ng: 0, last: 0 };
  if (r.ef == null) r.ef = EF0;
  if (ok) {
    r.ok++;
    r.streak++;
    r.iv = nextInterval(r);
    r.due = now + r.iv * DAY;
    r.box = r.box + 1;
    r.ef = Math.min(EF_MAX, Math.round((r.ef + 0.05) * 100) / 100);
  } else {
    r.ng++;
    r.streak = 0;
    r.box = 0;
    r.iv = 1;
    r.due = now + DAY;
    r.ef = Math.max(EF_MIN, Math.round((r.ef - 0.3) * 100) / 100);
  }
  r.last = now;
  srs[id] = r;
  return r;
}

// 복습 우선순위: 최근에 틀림 > 여러 번 틀림 > 번역을 자주 봄 > 오래 복습하지 않음(기한 지남) > 새로 만남
export const PRIORITY_KO = ['최근에 틀림', '여러 번 틀림', '번역을 자주 봄', '오래 복습하지 않음', '새로 만남'];
export function priorityOf(r, now = Date.now()) {
  if (r.ng > 0 && r.streak === 0 && now - r.last < 3 * DAY) return 0;
  if (r.ng >= 2 && r.streak < MASTER_STREAK) return 1;
  if ((r.tr || 0) >= 2 && r.streak < MASTER_STREAK) return 2;
  if (r.ok + r.ng > 0 && r.due <= now) return 3;
  if (r.ok + r.ng === 0) return 4;
  return 5;
}
// 기한이 된 것 + 위 1~3 순위(기한 전이라도)를 우선순위·기한 순으로
export function priorityIds(srs, now = Date.now()) {
  return Object.keys(srs)
    .filter((id) => itemOf(id))
    .map((id) => ({ id, p: priorityOf(srs[id], now), due: srs[id].due }))
    .filter((x) => x.p <= 2 || x.due <= now)
    .sort((a, b) => a.p - b.p || a.due - b.due)
    .map((x) => x.id);
}

export const mastered = (r) => !!r && r.streak >= MASTER_STREAK;

export function dueIds(srs, now = Date.now()) {
  return Object.keys(srs)
    .filter((id) => itemOf(id) && srs[id].due <= now)
    .sort((a, b) => srs[a].due - srs[b].due);
}

export function progress(srs, ids = Object.keys(srs)) {
  const n2 = ids.filter((id) => srs[id] && isN2(id));
  const count = (t) => n2.filter((id) => id[0] === t);
  return {
    words: count('v').length,
    grammar: count('g').length,
    wordsMastered: count('v').filter((id) => mastered(srs[id])).length,
    grammarMastered: count('g').filter((id) => mastered(srs[id])).length,
  };
}

// ───── 문제 만들기 ─────
const HIRA = /^[ぁ-ゖー]+$/;
const VOICE = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const UNVOICE = Object.fromEntries(Object.entries(VOICE).map(([a, b]) => [b, a]));
const O_ROW = 'おこそとのほもよろごぞどぼぽょ';
const U_ROW = 'うくすつぬふむゆるぐずぶぷゅ';
const SMALL = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' };
const GEMINATE_BEFORE = 'かきくけこさしすせそたちつてとぱぴぷぺぽ';

// 시험에 나오는 함정: 장음·탁음·촉음·요음
export function readingTraps(r) {
  const out = new Set();
  const chars = [...r];
  chars.forEach((c, i) => {
    const next = chars[i + 1];
    if (c === 'う' && i > 0 && (O_ROW.includes(chars[i - 1]) || U_ROW.includes(chars[i - 1]))) out.add(r.slice(0, i) + r.slice(i + 1));
    if ((O_ROW.includes(c) || U_ROW.includes(c)) && next !== 'う' && next !== 'ゃ' && next !== 'ゅ' && next !== 'ょ' && i < chars.length - 1) out.add(chars.slice(0, i + 1).join('') + 'う' + chars.slice(i + 1).join(''));
    if (i > 0 && VOICE[c]) out.add(chars.slice(0, i).join('') + VOICE[c] + chars.slice(i + 1).join(''));
    if (UNVOICE[c]) out.add(chars.slice(0, i).join('') + UNVOICE[c] + chars.slice(i + 1).join(''));
    if (c === 'っ') out.add(chars.slice(0, i).join('') + chars.slice(i + 1).join(''));
    if (i > 0 && GEMINATE_BEFORE.includes(c) && !'っんーうい'.includes(chars[i - 1])) out.add(chars.slice(0, i).join('') + 'っ' + chars.slice(i).join(''));
    if (SMALL[c]) out.add(chars.slice(0, i).join('') + SMALL[c] + chars.slice(i + 1).join(''));
    if (c === 'ん' && i > 0) out.add(chars.slice(0, i).join('') + chars.slice(i + 1).join(''));
    if (c === 'い' && i > 0 && 'えけせてねへめれげぜでべ'.includes(chars[i - 1])) out.add(chars.slice(0, i).join('') + chars.slice(i + 1).join(''));
  });
  out.delete(r);
  return [...out].filter((x) => HIRA.test(x) && !x.startsWith('っ') && !/っっ|っん|っう|うう/.test(x));
}

function meaningParts(m) {
  return m.split(/[,，·()（）/]/).map((x) => x.trim()).filter(Boolean);
}
function meaningClash(a, b) {
  const pa = meaningParts(a);
  const pb = meaningParts(b);
  return pa.some((x) => pb.some((y) => x === y || (x.length > 1 && y.includes(x)) || (y.length > 1 && x.includes(y))));
}

const KANJI = /[一-鿿々]/;
// 비슷해서 서로 오답이 될 수 없는 문법 묶음 (「문법 표현 구별」 문제에서 같은 묶음은 오답으로 쓰지 않는다)
export const CONFUSABLE = [
  ['ざるを得ない', 'ずにはいられない', 'ないことには', 'てからでないと'],
  ['わけがない', 'っこない', 'わけではない', 'わけだ', 'に違いない', 'に決まっている'],
  ['からには', '以上', 'からこそ', 'からといって'],
  ['に限らず', 'ばかりか', 'に加えて', 'どころか'],
  ['にもかかわらず', 'ものの', 'ながらも', 'にかかわらず'],
  ['かねない', '恐れがある'],
  ['に限る', 'に越したことはない', 'ほど～はない'],
  ['につれて', 'つつある'],
  ['に際して', 'に先立って'],
  ['てたまらない', 'ずにはいられない'],
];
const groupOf = (k) => CONFUSABLE.filter((g) => g.includes(k)).flat();

// 뜻이 가까워 「뜻 → 형태」·「문맥 속 뜻」 문제에서 서로 오답이 될 수 없는 짝 (뜻 글자가 겹치지 않아도 실제로 헷갈리는 것)
const NEAR = [
  ['に沿って', 'に応じて', 'につれて', 'どおり', 'をもとに', '次第'], ['に限らず', 'ばかりか', 'に加えて', 'どころか', 'にかかわらず'], ['からには', '以上', 'からこそ', 'せいか'],
  ['ざるを得ない', 'ずにはいられない', 'ないことには'], ['ないことには', 'てからでないと'], ['てたまらない', 'ずにはいられない'], ['かねない', '恐れがある', 'がち'],
  ['がち', 'つつある', 'につれて'], ['に決まっている', 'に違いない', 'わけだ'], ['ものの', 'にもかかわらず', 'ながらも', 'にせよ'], ['たところで', 'からといって', 'にせよ'],
  ['に際して', 'に先立って', 'に備えて'], ['わけがない', 'っこない'], ['に限る', 'に越したことはない', 'ほど～はない', 'ものだ'],
];
// 빈칸 문제에서 같은 문장에 들어가도 말이 될 수 있는 짝 (위 NEAR와 CONFUSABLE에 더해)
const BLANK_NEAR = [
  ['に沿って', 'に応じて', 'をもとに', 'をきっかけに'], ['ものだ', 'わけだ'], ['ことはない', 'わけではない'], ['に際して', 'に先立って', 'に備えて'],
  ['というより', 'どころか', 'ばかりか'], ['ようがない', 'っこない', 'わけがない'], ['がち', 'かねない', 'つつある'], ['にせよ', 'にかかわらず'],
  // 게임 대사로 만든 빈칸 76개를 사람이 읽고 찾은 「둘 다 말이 되는」 짝
  ['ものだ', 'に違いない', 'に決まっている'], ['わけにはいかない', 'わけではない', 'わけがない'], ['に越したことはない', 'ものだ'], ['からには', 'にせよ'],
  ['ようがない', 'かねない'], ['ものの', 'からには'], ['に沿って', 'どおり'], ['に先立って', 'からこそ'],
];
const inSame = (groups, a, b) => groups.some((g) => g.includes(a) && g.includes(b));
// 두 문법이 서로 오답이 될 수 없을 만큼 가까운가
export function nearG(a, b) {
  if (a === b) return true;
  return meaningClash(GRAMMAR[a].m, GRAMMAR[b].m) || inSame(NEAR, a, b);
}
const blankNear = (a, b) => nearG(a, b) || inSame(CONFUSABLE, a, b) || inSame(BLANK_NEAR, a, b);

// 문법이 무엇에 붙는가 (빈칸 오답을 같은 접속 형태로 골라 형태만 보고 지울 수 없게)
// noun 명사 / masu ます형 / nai ない형 / te て형 / ta た형 / dict 사전형 / plain 보통형(사전형·た형·형용사 포함)
export const GCONN = {
  ざるを得ない: ['nai'], に違いない: ['plain', 'noun'], わけにはいかない: ['dict'], に沿って: ['noun'], をきっかけに: ['noun'], ものの: ['plain'],
  かねない: ['masu'], わけがない: ['plain'], わけではない: ['plain'], に限らず: ['noun'], どころか: ['plain', 'noun'], に決まっている: ['plain', 'noun'],
  からには: ['plain'], ずにはいられない: ['nai'], せいか: ['plain'], に越したことはない: ['dict'], てたまらない: ['te'], 抜く: ['masu'], っこない: ['masu'],
  ことに: ['ta'], にもかかわらず: ['plain'], どおり: ['noun'], にかかわらず: ['noun'], がち: ['masu', 'noun'], ばかりか: ['plain', 'noun'], かのように: ['plain'],
  にせよ: ['plain'], つつある: ['masu'], 以上: ['plain'], をもとに: ['noun'], に加えて: ['noun'], 'ほど～はない': ['noun'], に限る: ['dict', 'noun'],
  とばかり思う: ['plain'], 恐れがある: ['dict'], 'さえ～ば': ['noun'], ようがない: ['masu'], たところで: ['ta'], に応じて: ['noun'], というより: ['plain', 'noun'],
  に過ぎない: ['plain', 'noun'], てからでないと: ['te'], からこそ: ['plain'], からといって: ['plain'], わけだ: ['plain'], にわたって: ['noun'], に備えて: ['noun'],
  をめぐって: ['noun'], くらいなら: ['dict'], に先立って: ['noun', 'dict'], に際して: ['noun', 'dict'], ながらも: ['masu', 'noun'], につれて: ['dict', 'noun'],
  ないことには: ['nai'], ことはない: ['dict'], 次第: ['noun', 'masu'], ものだ: ['ta', 'dict'],
};
// 보강 문법은 데이터의 cn(접속 분류)을 쓴다
for (const [k, g] of Object.entries(GRAMMAR)) if (!GCONN[k] && g.cn) GCONN[k] = g.cn;
// 자동으로 오답을 고르는 문제(뜻→형태, 비슷한 표현 구별, 문맥 속 뜻)는 오답 검토를 마친 기존 문법끼리만 낸다.
// 보강 문법(x)은 직접 만든 빈칸 문제(q)와 문제은행 문항으로만 묻는다.
const CORE = (k) => GRAMMAR[k] && !GRAMMAR[k].x;

// 생성기가 만든 「이 문장의 접속」 설명(例: 「勝て（勝つ의 가능형 勝てる의 ます형）」)에서 접속 형태를 읽는다
export function connClass(note = '') {
  if (/명사|인용구/.test(note)) return 'noun';
  // 「喜ばない（喜ぶ의 ない형）」처럼 ない까지 붙은 꼴은 보통형이다 (ない형 어간 「認め」와 다르다)
  if (/^[^（]*ない（/.test(note)) return 'plain';
  if (/ます형/.test(note)) return 'masu';
  if (/ない형/.test(note)) return 'nai';
  if (/て형/.test(note)) return 'te';
  if (/た형/.test(note)) return 'ta';
  if (/사전형/.test(note)) return 'dict';
  return 'plain';
}
const fits = (k, cls) => {
  const cs = GCONN[k] || [];
  if (cs.includes(cls)) return true;
  // 보통형을 받는 문법은 사전형·た형 뒤에도 온다
  return cs.includes('plain') && (cls === 'dict' || cls === 'ta');
};
// 문법의 기본 형태 (빈칸에 넣는 꼴). 「ほど～はない」처럼 둘로 나뉜 것은 빈칸으로 내지 않는다
export function headForms(k) {
  return GRAMMAR[k].f.split('・').map((x) => x.replace(/^～/, '').replace(/[(（].*[)）]$/, '')).filter((x) => x && !x.includes('～'));
}
// 게임 속 문장(생성된 조각)에서 이 문법을 빈칸으로 낼 수 있는가: 대사가 기본 형태 그대로 쓰였을 때만
export function blankOf(segs, key) {
  const sg = (segs || []).find((x) => x && x.g === key);
  if (!sg) return null;
  const surface = sg.s.map((x) => (typeof x === 'string' ? x : x[0])).join('');
  if (!headForms(key).includes(surface)) return null;
  return { surface, cls: connClass(sg.c) };
}
// 빈칸에 넣을 꼴: 명사 뒤의 「とおり」는 「どおり」가 된다
export const blankForm = (k, cls) => (k === 'どおり' ? (cls === 'noun' ? 'どおり' : 'とおり') : headForms(k)[0]);
// 문장 빈칸의 오답. 자동으로 고르면 같은 자리에 들어가도 말이 되는 것이 섞여(例: 「〇たちが決める（わけではない）」)
// 게임 대사에서 그 문법이 쓰인 문장을 모두 읽고, 형태는 그럴듯하지만 그 문장들에서 뜻이 맞지 않는 것만 골랐다.
// たところで(「洗っ＋（　）」 뒤에 붙일 오답이 형태부터 깨진다)·ないことには 등 고르지 못한 문법은 빈칸 문제를 내지 않는다.
export const BLANK_SET = {
  ものだ: ['に過ぎない', 'わけがない', 'とばかり思う'], かねない: ['っこない', '抜く', '次第'], をきっかけに: ['をめぐって', 'に限らず', 'にわたって'],
  ながらも: ['せいか', '以上', 'からには'], につれて: ['に先立って', 'くらいなら', '以上'], ことはない: ['に限る', '恐れがある', 'に越したことはない'],
  次第: ['に限る', 'に際して', 'をめぐって'], わけにはいかない: ['に限る', '恐れがある', 'くらいなら'], どころか: ['ものの', 'からといって', '以上'],
  からには: ['にもかかわらず', 'ばかりか', 'というより'], に越したことはない: ['わけにはいかない', '恐れがある', 'くらいなら'], っこない: ['かねない', 'がち', 'つつある'],
  に限らず: ['に沿って', 'をめぐって', 'にわたって'], ことに: ['せいか', 'にもかかわらず', 'ものの'], どおり: ['に限らず', 'にわたって', 'をめぐって'],
  にかかわらず: ['に応じて', 'をめぐって', '次第'], がち: ['っこない', 'ようがない', '抜く'], ばかりか: ['にもかかわらず', 'ものの', 'かのように'],
  にせよ: ['くらいなら', 'に先立って', 'につれて'], つつある: ['っこない', 'ようがない', '抜く'], に沿って: ['をめぐって', 'に限らず', 'にわたって'],
  以上: ['ものの', 'にもかかわらず', 'ばかりか'], をもとに: ['をめぐって', 'に限らず', 'に際して'], に違いない: ['に限る', 'どころか', 'というより'],
  に加えて: ['をもとに', 'をめぐって', 'に沿って'], に限る: ['恐れがある', 'わけにはいかない', 'ことはない'], ようがない: ['がち', 'つつある', '抜く'],
  に応じて: ['に限らず', 'をめぐって', 'に際して'], というより: ['に限らず', 'をめぐって', 'どおり'], にわたって: ['に際して', 'をめぐって', 'に応じて'],
  からこそ: ['ものの', 'にもかかわらず', 'ばかりか'], からといって: ['せいか', 'ばかりか', 'というより'], に過ぎない: ['に限る', 'に決まっている', 'というより'],
  わけだ: ['に過ぎない', 'とばかり思う', 'かのように'], わけではない: ['ものの', 'に過ぎない', 'かのように'], わけがない: ['に限る', 'ことはない', 'くらいなら'],
  に備えて: ['に沿って', 'をめぐって', 'に加えて'], をめぐって: ['をもとに', 'に応じて', 'に限らず'], くらいなら: ['以上', 'に先立って', 'ものの'],
  に先立って: ['くらいなら', 'ものの', 'につれて'], にもかかわらず: ['というより', 'せいか', 'ばかりか'], せいか: ['わけがない', 'ことに', 'かのように'],
  に際して: ['に限らず', 'にわたって', 'をもとに'], 恐れがある: ['ことはない', 'わけにはいかない', 'に越したことはない'],
};
export function blankDistractors(key, cls, h) {
  return shuffle(h, BLANK_SET[key] || []);
}
export const blankNearCheck = blankNear;
// 비슷한 표현 구별: 같은 묶음 안에서 뜻이 분명히 다른 것
const diffMates = (key) => groupOf(key).filter((k) => k !== key && !nearG(key, k));

// 읽기 오답은 시험에 나오는 함정(장음·탁음·촉음·요음)만 쓴다. 세 개를 못 만들면 읽기 문제를 내지 않는다.
export function readingOptions(key, seed = 'r') {
  const it = VOCAB[key];
  const h = { rng: hashSeed(seed + key) };
  const real = new Set(Object.values(VOCAB).map((v) => v.r));
  // 다른 낱말의 실제 읽기와 겹치는 함정은 뺀다 (그것도 정답처럼 보일 수 있으므로)
  return shuffle(h, readingTraps(it.r).filter((x) => !real.has(x))).slice(0, 3);
}

// ctx.hasScene: 게임 속 문장이 있는가 / ctx.blank: blankOf()의 결과 (문장 빈칸을 낼 수 있을 때)
export function questionKinds(id, ctx = {}) {
  if (id[0] === 'g') {
    const key = id.slice(2);
    if (!CORE(key)) return ['grammar'];
    const kinds = ['grammar', 'gform'];
    if (diffMates(key).length) kinds.push('gdiff');
    if (ctx.hasScene) kinds.push('gcontext');
    if (ctx.blank && blankDistractors(key, ctx.blank.cls, { rng: hashSeed('chk' + key) }).length >= 3) kinds.push('gblank');
    return kinds;
  }
  const key = id.slice(2);
  const kinds = ['meaning', 'word'];
  if (KANJI.test(key) && HIRA.test(VOCAB[key].r) && readingOptions(key).length >= 3) kinds.unshift('reading');
  if (ctx.hasScene) kinds.push('context');
  return kinds;
}

// 한 항목의 문제. rec가 있으면 맞힌·틀린 횟수에 따라 유형을 번갈아 낸다.
// 길이가 비슷한 것을 고른다 (정답만 유난히 길거나 짧지 않게)
const lenClose = (a, b) => Math.abs(a.length - b.length) <= Math.max(2, Math.round(a.length * 0.4));

// ctx.kind: 유형을 정해서 낼 때, ctx.hasScene: 게임 속 장면이 있는지
export function makeQuestion(id, seed = 'q', rec = null, ctx = {}) {
  const it = itemOf(id);
  if (!it) return null;
  const h = { rng: hashSeed(seed + id) };
  const kinds = questionKinds(id, ctx);
  const kind = ctx.kind && kinds.includes(ctx.kind) ? ctx.kind : kinds[((rec ? rec.ok + rec.ng : 0) + Math.floor(rand(h) * 2)) % kinds.length];
  if (kind === 'grammar') {
    const [stem, ans, wrong, explain] = it.q;
    const options = shuffle(h, [ans, ...wrong]);
    return { id, kind, prompt: stem, options, answer: options.indexOf(ans), explain, label: it.f, sub: it.m };
  }
  if (kind === 'gblank') {
    // 게임 속 문장의 빈칸: 같은 접속 형태의 다른 문법 셋 (문장은 화면이 빈칸으로 보여 준다)
    const wrong = blankDistractors(it.key, ctx.blank.cls, h);
    const options = shuffle(h, [ctx.blank.surface, ...wrong.map((k) => blankForm(k, ctx.blank.cls))]);
    return { id, kind, prompt: '（　）에 들어갈 말', options, answer: options.indexOf(ctx.blank.surface), explain: `「${it.f}」 = ${it.m}. 오답: ${wrong.map((k) => `${blankForm(k, ctx.blank.cls)} = ${GRAMMAR[k].m}`).join(' · ')}.`, label: it.f, sub: it.m, blank: true };
  }
  if (kind === 'gcontext' || kind === 'gdiff') {
    // gcontext: 문장 속 밑줄 표현의 뜻 고르기 / gdiff: 뜻을 보고 비슷한 표현 중에서 고르기
    // 오답은 같은 묶음에서 뜻이 분명히 다른 것을 먼저 (쉬운 오답을 피한다), 모자라면 같은 접속의 다른 문법
    const mates = shuffle(h, diffMates(it.key));
    const conn = GCONN[it.key] || [];
    const rest = shuffle(h, Object.keys(GRAMMAR).filter(CORE).filter((k) => !mates.includes(k) && !nearG(it.key, k) && !inSame(CONFUSABLE, it.key, k) && (GCONN[k] || []).some((c) => conn.includes(c))));
    const others = shuffle(h, Object.keys(GRAMMAR).filter(CORE).filter((k) => !mates.includes(k) && !rest.includes(k) && !nearG(it.key, k) && !inSame(CONFUSABLE, it.key, k)));
    const wrong = [];
    for (const k of [...mates, ...rest, ...others]) {
      if (wrong.length >= 3) break;
      if (wrong.some((w) => nearG(w, k))) continue;
      wrong.push(k);
    }
    if (kind === 'gcontext') {
      const options = shuffle(h, [it.m, ...wrong.map((k) => GRAMMAR[k].m)]);
      return { id, kind, prompt: `밑줄 친 「${it.f.replace(/^～/, '')}」의 뜻`, options, answer: options.indexOf(it.m), explain: `「${it.f}」 = ${it.m}. 오답: ${wrong.map((k) => `${GRAMMAR[k].f} = ${GRAMMAR[k].m}`).join(' · ')}.`, label: it.f, sub: it.m, context: true };
    }
    const options = shuffle(h, [it.f, ...wrong.map((k) => GRAMMAR[k].f)]);
    return { id, kind, prompt: it.m, options, answer: options.indexOf(it.f), explain: `${it.m} → 「${it.f}」. ${it.d} 오답: ${wrong.map((k) => `${GRAMMAR[k].f} = ${GRAMMAR[k].m}`).join(' · ')}.`, label: it.f, sub: it.m };
  }
  if (kind === 'gform') {
    // 문법 표현 구별: 뜻을 보고 형태를 고른다. 비슷한 묶음의 문법은 오답으로 쓰지 않는다.
    const avoid = new Set([it.key, ...groupOf(it.key)]);
    const pool = shuffle(h, Object.entries(GRAMMAR).filter(([k, g]) => CORE(k) && !avoid.has(k) && !meaningClash(g.m, it.m)));
    const wrong = [];
    for (const [k, g] of pool) {
      if (wrong.length >= 3) break;
      if (wrong.some((w) => groupOf(w.k).includes(k) || meaningClash(w.g.m, g.m))) continue;
      wrong.push({ k, g });
    }
    const options = shuffle(h, [it.f, ...wrong.map((w) => w.g.f)]);
    return { id, kind, prompt: it.m, options, answer: options.indexOf(it.f), explain: `「${it.f}」 = ${it.m}. ${it.d}`, label: it.f, sub: it.m };
  }
  const key = it.key;
  if (kind === 'word') {
    // 한국어 뜻 → 일본어: 같은 품사, 비슷한 길이, 뜻이 겹치지 않는 말
    const pool = Object.entries(VOCAB)
      .filter(([k, v]) => k !== key && !v.k && v.pos === it.pos && lenClose(key, k) && v.r !== it.r && !meaningClash(v.m, it.m))
      .map(([k, v]) => ({ k, m: v.m, s: rand(h) * 4 + (v.lv === it.lv ? 2 : 0) - Math.abs(k.length - key.length) }))
      .sort((a, b) => b.s - a.s);
    const wrong = [];
    for (const c of pool) {
      if (wrong.length >= 3) break;
      if (wrong.some((w) => meaningClash(w.m, c.m))) continue;
      wrong.push(c);
    }
    if (wrong.length < 3) return makeQuestion(id, seed, rec, { ...ctx, kind: 'meaning' });
    const options = shuffle(h, [key, ...wrong.map((w) => w.k)]);
    return { id, kind, prompt: it.m, options, answer: options.indexOf(key), explain: `${it.m} → 「${key}（${it.r}）」. 오답: ${wrong.map((w) => `${w.k}（${VOCAB[w.k].r}）= ${w.m}`).join(' · ')}.`, label: key, sub: it.r };
  }
  if (kind === 'reading') {
    const wrong = readingOptions(key, seed);
    if (wrong.length < 3) return makeQuestion(id, seed, rec, { ...ctx, kind: 'meaning' });
    const options = shuffle(h, [it.r, ...wrong]);
    return { id, kind, prompt: key, options, answer: options.indexOf(it.r), explain: `「${key}」의 읽기는 「${it.r}」(${it.m}). 장음(う)·탁음·촉음(っ)·요음(ゃゅょ)이 하나만 달라도 다른 말이 된다.`, label: key, sub: it.r };
  }
  // 같은 품사·비슷한 길이를 먼저 고른다 (품사가 드물면 다른 품사도)
  const pool = Object.entries(VOCAB)
    .filter(([k, v]) => k !== key && !v.k && v.m !== it.m && !meaningClash(v.m, it.m))
    .map(([k, v]) => ({ k, m: v.m, s: -Math.abs(v.m.length - it.m.length) * 1.5 + rand(h) * 4 + (v.lv === it.lv ? 2 : 0) + (v.pos === it.pos ? 20 : 0) + (lenClose(it.m, v.m) ? 6 : 0) }))
    .sort((a, b) => b.s - a.s);
  const wrong = [];
  for (const c of pool) {
    if (wrong.length >= 3) break;
    if (wrong.some((w) => meaningClash(w.m, c.m))) continue;
    wrong.push(c);
  }
  const options = shuffle(h, [it.m, ...wrong.map((w) => w.m)]);
  const wrongNote = wrong.map((w) => `${w.m} = ${w.k}`).join(' · ');
  // context: 게임 속 문장 안에서 이 말의 뜻 (문장은 화면이 보여 준다)
  return { id, kind, prompt: key, options, answer: options.indexOf(it.m), explain: `「${key}（${it.r}）」 = ${it.m}. 오답: ${wrongNote}.`, label: key, sub: it.r, context: kind === 'context' };
}

// hasScene(id): 그 말이 게임 속 장면을 갖고 있는지 / blankFor(id): 문장 빈칸 정보 (없으면 null)
export function makeSet(ids, n = 10, seed = 'set', srs = {}, hasScene = () => false, blankFor = () => null) {
  const h = { rng: hashSeed(seed) };
  return shuffle(h, [...new Set(ids)].filter((id) => itemOf(id))).slice(0, n).map((id, i) => makeQuestion(id, seed + i, srs[id], { hasScene: hasScene(id), blank: blankFor(id) }));
}

// 복습 화면 묶음: 오늘 단어, 오늘 문법, 최근 틀린 것, 어려운 것
export function reviewGroups(srs, now = Date.now()) {
  const due = dueIds(srs, now);
  const all = Object.keys(srs).filter((id) => itemOf(id));
  return {
    words: due.filter((id) => id[0] === 'v'),
    grammar: due.filter((id) => id[0] === 'g'),
    recentWrong: all.filter((id) => srs[id].ng > 0 && srs[id].streak === 0 && now - srs[id].last < 7 * DAY).sort((a, b) => srs[b].last - srs[a].last),
    hard: all.filter((id) => srs[id].ng >= 2 && srs[id].ng >= srs[id].ok).sort((a, b) => srs[b].ng - srs[a].ng),
  };
}

// 일본어 학습 기록 (게임 능력치와 별개)
export function learningStats(srs, wordbook = {}) {
  const ids = Object.keys(srs).filter((id) => itemOf(id));
  const ok = ids.reduce((a, id) => a + srs[id].ok, 0);
  const ng = ids.reduce((a, id) => a + srs[id].ng, 0);
  return {
    metWords: ids.filter((id) => id[0] === 'v').length,
    metGrammar: ids.filter((id) => id[0] === 'g').length,
    saved: Object.keys(wordbook).length,
    learnedGrammar: ids.filter((id) => id[0] === 'g' && mastered(srs[id])).length,
    accuracy: ok + ng ? Math.round((ok / (ok + ng)) * 100) : null,
    due: dueIds(srs).length,
  };
}
