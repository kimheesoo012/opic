// 학습 기록과 복습(간격 반복). UI 없이 동작한다.
// 항목 id: 'v:단어' 또는 'g:문법키'. 기록: { met, box, due, streak, ok, ng, last, iv, ef, tr }
// 간격: 처음 세 번은 1·3·7일, 그다음부터는 지난 간격 × 쉬움 계수(ef). 맞히면 ef가 조금 오르고, 틀리면 내려가며 다음 날부터 다시.
// 「번역 보기」(tr)는 틀린 것으로 치지 않는다. 복습 순서를 정할 때만 참고한다.
import { readingDiff, withReading, grammarByForm, gShort, vShort, vocabMore, grammarMore, shortConnOf, vocabEx, grammarEx, pt, josa, kanjiSplit } from './explain.js';
import { VOCAB } from '../data/vocab.js';
import { GRAMMAR } from '../data/grammar.js';
import { KANJI } from '../data/kanji.js';
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
// ins=false: 장음·촉음을 끼워 넣는 규칙은 쓰지 않는다 (훈독어에는 그런 함정이 거의 없다)
// big=false: 작은 ゃゅょ를 큰 글자로 바꾸는 함정은 쓰지 않는다 (가나 규칙만 알면 지워지는 오답)
export function readingTraps(r, { ins = true, big = true } = {}) {
  const out = new Set();
  const chars = [...r];
  chars.forEach((c, i) => {
    const next = chars[i + 1];
    if (c === 'う' && i > 0 && (O_ROW.includes(chars[i - 1]) || U_ROW.includes(chars[i - 1]))) out.add(r.slice(0, i) + r.slice(i + 1));
    if (ins && (O_ROW.includes(c) || U_ROW.includes(c)) && next !== 'う' && next !== 'ゃ' && next !== 'ゅ' && next !== 'ょ' && i < chars.length - 1) out.add(chars.slice(0, i + 1).join('') + 'う' + chars.slice(i + 1).join(''));
    if (i > 0 && VOICE[c]) out.add(chars.slice(0, i).join('') + VOICE[c] + chars.slice(i + 1).join(''));
    if (UNVOICE[c]) out.add(chars.slice(0, i).join('') + UNVOICE[c] + chars.slice(i + 1).join(''));
    if (c === 'っ') out.add(chars.slice(0, i).join('') + chars.slice(i + 1).join(''));
    if (ins && i > 0 && GEMINATE_BEFORE.includes(c) && !'っんーうい'.includes(chars[i - 1])) out.add(chars.slice(0, i).join('') + 'っ' + chars.slice(i).join(''));
    if (big && SMALL[c]) out.add(chars.slice(0, i).join('') + SMALL[c] + chars.slice(i + 1).join(''));
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

const HAS_KANJI = /[一-鿿々]/;
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
// 뜻이 같은 문법 묶음: 한 문제에 둘이 나오면 정답이 둘이 된다 (어느 유형에서든 서로 오답이 될 수 없다)
export const SAME_MEANING = [
  ['に限らず', 'ばかりか', 'のみならず', 'に加えて', 'はもとより', 'をはじめ'], ['以上', 'からには'], ['に際して', 'にあたって'],
  ['につれて', 'に伴って', 'にしたがって', 'とともに'], ['てたまらない', 'てしょうがない'], ['かねない', '恐れがある'], ['わけがない', 'っこない'],
  ['せいか', 'ばかりに', 'ものだから'], ['末に', 'あげく'], ['まみれ', 'だらけ'], ['たとたん', 'かと思うと'], ['かわりに', 'に代わって'],
  ['をもとに', 'に基づいて'], ['を問わず', 'にかかわらず'], ['一方だ', 'ばかりだ'], ['ざるを得ない', 'しかない'], ['に違いない', 'に決まっている'],
  ['わけではない', 'とは限らない'], ['に越したことはない', 'に限る'], ['ないことには', 'てからでないと'], ['だけに', 'だけあって'], ['わりに', 'にしては'],
  ['ことだ', 'べき'], ['ずにはいられない', 'てたまらない'], ['からこそ', 'だけに'], ['といっても', 'からといって'],
];
export const sameGroup = (a, b) => a === b || inSame(SAME_MEANING, a, b);
export const sameMeaning = (a, b) => a === b || inSame(SAME_MEANING, a, b) || meaningClash(GRAMMAR[a].m, GRAMMAR[b].m);
// 데이터의 near(헷갈리는 문법) 표시: 자동으로 고르는 오답에서는 뺀다 (뜻이 같지는 않아도 문제 안에서 정답처럼 보일 수 있다)
const nearField = (a, b) => (GRAMMAR[a].near || []).includes(b) || (GRAMMAR[b].near || []).includes(a);
// 두 문법이 서로 오답이 될 수 없을 만큼 가까운가
export function nearG(a, b) {
  if (a === b) return true;
  return sameMeaning(a, b) || inSame(NEAR, a, b);
}
// 자동으로 오답을 고르는 유형(뜻→형태·비슷한 표현 구별·문맥 속 뜻)에서 오답으로 쓸 수 없는가
const badDistractor = (a, b) => nearG(a, b) || nearField(a, b) || inSame(CONFUSABLE, a, b) && sameMeaning(a, b);
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
const diffMates = (key) => groupOf(key).filter((k) => k !== key && !nearG(key, k) && !nearField(key, k));

// ───── 읽기 오답 ─────
// 한자어는 글자마다 「실제 음독」을 바탕으로 그럴듯한 오답을 만든다: 그 글자의 다른 음독(力 りょく↔りき)·첫소리의 청탁(ぼ↔ほ)·
// 음독 끝의 장단(こ↔こう, しょ↔しょう)·촉음(がく＋こう→がっこう). 가나로 있을 수 없는 꼴(비 い단 뒤의 작은 ゃゅょ, 모음 앞의 っ 등)은 내지 않는다.
const I_ROW = 'きしちにひみりぎじぢびぴ';
const KSTP = 'かきくけこさしすせそたちつてとぱぴぷぺぽ';
const HANDAKU = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
const UNHANDAKU = Object.fromEntries(Object.entries(HANDAKU).map(([a, b]) => [b, a]));
const E_ROW = 'えけせてねへめれげぜでべぺ';
const SEION = (t) => [...t].map((c) => UNVOICE[c] || UNHANDAKU[c] || c).join('');
// 히라가나로 있을 수 있는 꼴인가
export function validKana(t) {
  if (!/^[あ-ゖ]+$/.test(t) || /[ぁぃぅぇぉゎゕゖ]/.test(t)) return false;
  const cs = [...t];
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if ('ゃゅょ'.includes(c) && !(i > 0 && I_ROW.includes(cs[i - 1]))) return false;
    if (c === 'っ' && !(i > 0 && i < cs.length - 1 && KSTP.includes(cs[i + 1]))) return false;
    if (c === 'ん' && i === 0) return false;
  }
  return !/[ゃゅょっ][ゃゅょ]|っっ|うう/.test(t);
}
// 실제로 쓰이는 음독 조각: 한자 DB의 음독 + 어휘 DB의 한자어를 쪼개 얻은 꼴(연탁·촉음 포함)
let MORPH = null;
function morphs() {
  if (MORPH) return MORPH;
  MORPH = new Set();
  for (const k of Object.values(KANJI)) for (const o of k.on) MORPH.add(o);
  for (const [k, v] of Object.entries(VOCAB)) for (const p of kanjiSplit(k, v.r)) if (p.r) MORPH.add(p.r);
  return MORPH;
}
// strict: 청탁을 맞춘 꼴이 아니라 그 꼴 그대로 쓰인 적이 있어야 한다 (장단 바꾼 꼴 — ぶ→ぶう 같은 가짜 장음을 막는다)
const isMorph = (m, strict = false) => {
  const M = morphs();
  if (M.has(m) || (!strict && M.has(SEION(m)))) return true;
  // 촉음 꼴(がっ)은 본디 음독(がく·がつ…)이 있으면 된다
  if (m.endsWith('っ')) return [...'くつちき'].some((e) => M.has(m.slice(0, -1) + e) || M.has(SEION(m.slice(0, -1) + e)));
  return false;
};
let REAL = null;
const realReadings = () => (REAL = REAL || new Set(Object.values(VOCAB).map((v) => v.r)));
// 한자 하나의 읽기 조각을 바꾼 후보들: [새 조각, 원인, 다음 조각 바꿈?]
function morphVariants(part, next) {
  const r = part.r;
  const out = [];
  const on = (KANJI[part.c] && KANJI[part.c].on) || [];
  const first = r[0];
  const voiced = VOICE[SEION(first)] === first || UNHANDAKU[first];
  // 다른 음독 (원래 조각이 연탁이면 같은 탁음을 유지한 꼴도)
  for (const o of on) {
    if (SEION(o) === SEION(r)) continue;
    out.push([o, 'on']);
    if (voiced && VOICE[o[0]]) out.push([VOICE[o[0]] + o.slice(1), 'on']);
  }
  // 첫소리의 청음·탁음·반탁음
  if (VOICE[first]) out.push([VOICE[first] + r.slice(1), 'voice']);
  if (UNVOICE[first]) out.push([UNVOICE[first] + r.slice(1), 'voice']);
  if (HANDAKU[first]) out.push([HANDAKU[first] + r.slice(1), 'voice']);
  if (UNHANDAKU[first]) out.push([UNHANDAKU[first] + r.slice(1), 'voice']);
  // 음독 끝의 장단 (こ↔こう, しょ↔しょう, ゆ↔ゆう, け↔けい)
  const last = r[r.length - 1];
  const prev = r[r.length - 2] || '';
  if (r.length >= 2 && last === 'う' && (O_ROW.includes(prev) || U_ROW.includes(prev))) out.push([r.slice(0, -1), 'long']);
  else if (r.length >= 2 && last === 'い' && E_ROW.includes(prev)) out.push([r.slice(0, -1), 'long']);
  else if (O_ROW.includes(last) || U_ROW.includes(last)) out.push([r + 'う', 'long']);
  else if (E_ROW.includes(last)) out.push([r + 'い', 'long']);
  // 촉음: つ·く·ち·き로 끝나는 음독이 か·さ·た·は(→ぱ)행 앞에서 っ로 줄어드는 것, 또는 그 반대
  if (next && /[つくちき]$/.test(r)) {
    const n0 = next.r[0];
    if (KSTP.includes(n0)) out.push([r.slice(0, -1) + 'っ', 'sokuon']);
    else if (HANDAKU[n0]) out.push([r.slice(0, -1) + 'っ', 'sokuon', HANDAKU[n0] + next.r.slice(1)]);
  }
  if (r.endsWith('っ')) for (const o of on) if (/[つくちき]$/.test(o) && SEION(o.slice(0, -1)) === SEION(r.slice(0, -1))) out.push([(voiced && VOICE[o[0]] ? VOICE[o[0]] + o.slice(1) : o), 'sokuon', next && UNHANDAKU[next.r[0]] ? UNHANDAKU[next.r[0]] + next.r.slice(1) : undefined]);
  return out.filter(([m, cause]) => m !== r && isMorph(m, cause === 'long'));
}
// 한자어의 읽기 오답 후보 전부: [{ r, cause }]
export function readingCandidates(key) {
  const it = VOCAB[key];
  if (!it) return [];
  const parts = kanjiSplit(key, it.r);
  const out = new Map();
  const add = (r, cause, w) => {
    if (r === it.r || out.has(r) || !validKana(r) || realReadings().has(r)) return;
    out.set(r, { r, cause, w });
  };
  if (parts.length && parts.every((p) => p.r) && parts.map((p) => p.r).join('') === it.r) {
    parts.forEach((p, i) => {
      for (const [m, cause, nextR] of morphVariants(p, parts[i + 1])) {
        const rs = parts.map((x) => x.r);
        rs[i] = m;
        if (nextR) rs[i + 1] = nextR;
        add(rs.join(''), cause, 3);
      }
    });
  } else {
    // 음독으로 쪼개지지 않는 말(훈독어·혼합어): 글자 단위 함정 가운데 청탁·ん·장음·촉음 빠짐만 (끼워 넣기·큰 글자 요음은 쓰지 않는다)
    for (const t of readingTraps(it.r, { ins: false, big: false })) add(t, 'trap', 1);
  }
  return [...out.values()];
}
// 읽기 오답 셋: 원인이 겹치지 않게 고른다. 세 개를 못 만들면 읽기 문제를 내지 않는다.
export function readingOptions(key, seed = 'r') {
  if (!VOCAB[key]) return [];
  const h = { rng: hashSeed(seed + key) };
  const cands = shuffle(h, readingCandidates(key)).sort((a, b) => b.w - a.w);
  const picked = [];
  const used = new Set();
  for (const c of cands) {
    if (picked.length >= 3 || used.has(c.cause)) continue;
    picked.push(c);
    used.add(c.cause);
  }
  for (const c of cands) if (picked.length < 3 && !picked.includes(c)) picked.push(c);
  return shuffle(h, picked.map((c) => c.r)).slice(0, 3);
}

// ctx.hasScene: 게임 속 문장이 있는가 / ctx.blank: blankOf()의 결과 (문장 빈칸을 낼 수 있을 때)
// 일본어만으로 풀 수 있는 유형 (일본어 몰입 모드: 한국어 뜻을 고르거나 한국어 문제문을 읽는 유형은 내지 않는다)
export const JA_ONLY_KINDS = new Set(['reading', 'grammar', 'gblank']);

// ctx.rubyShown: 방금 장면에서 그 말의 후리가나를 보여 줬다 → 읽기 문제는 내지 않는다
export function questionKinds(id, ctx = {}) {
  let all = questionKindsAll(id, ctx);
  if (ctx.rubyShown) all = all.filter((k) => k !== 'reading');
  return ctx.jaOnly ? all.filter((k) => JA_ONLY_KINDS.has(k)) : all;
}

function questionKindsAll(id, ctx = {}) {
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
  if (HAS_KANJI.test(key) && HIRA.test(VOCAB[key].r) && readingOptions(key).length >= 3) kinds.unshift('reading');
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
  if (!kinds.length) return null;
  const kind = ctx.kind && kinds.includes(ctx.kind) ? ctx.kind : kinds[((rec ? rec.ok + rec.ng : 0) + Math.floor(rand(h) * 2)) % kinds.length];
  if (kind === 'grammar') {
    const [stem, ans, wrong, explain] = it.q;
    const options = shuffle(h, [ans, ...wrong]);
    const why = options.map((o) => {
      if (o === ans) return explain;
      const i = wrong.indexOf(o);
      const qx = it.qx && it.qx[i];
      const g = grammarByForm(o);
      return qx || (g ? gShort(g) : '');
    });
    return { id, kind, prompt: stem, options, answer: options.indexOf(ans), explain, why, ex: grammarEx(it.key), more: grammarMore(it.key), label: it.f, sub: it.m };
  }
  if (kind === 'gblank') {
    // 게임 속 문장의 빈칸: 같은 접속 형태의 다른 문법 셋 (문장은 화면이 빈칸으로 보여 준다)
    const wrong = blankDistractors(it.key, ctx.blank.cls, h);
    const options = shuffle(h, [ctx.blank.surface, ...wrong.map((k) => blankForm(k, ctx.blank.cls))]);
    const why = options.map((o) => {
      if (o === ctx.blank.surface) return `${gShort(it)} 이 장면의 흐름에 맞는 건 이 뜻이에요.`;
      const k = wrong.find((w) => blankForm(w, ctx.blank.cls) === o);
      return k ? `${gShort(GRAMMAR[k])} 이 장면에서는 그런 뜻이 되지 않아요.` : '';
    });
    return { id, kind, prompt: '（　）에 들어갈 말', options, answer: options.indexOf(ctx.blank.surface), explain: `「${it.f}」 = ${it.m}. 오답: ${wrong.map((k) => `${blankForm(k, ctx.blank.cls)} = ${GRAMMAR[k].m}`).join(' · ')}.`, why, ex: grammarEx(it.key), more: grammarMore(it.key), label: it.f, sub: it.m, blank: true };
  }
  if (kind === 'gcontext' || kind === 'gdiff') {
    // gcontext: 문장 속 밑줄 표현의 뜻 고르기 / gdiff: 뜻을 보고 비슷한 표현 중에서 고르기
    // 오답은 같은 묶음에서 뜻이 분명히 다른 것을 먼저 (쉬운 오답을 피한다), 모자라면 같은 접속의 다른 문법
    const mates = shuffle(h, diffMates(it.key));
    const conn = GCONN[it.key] || [];
    const rest = shuffle(h, Object.keys(GRAMMAR).filter(CORE).filter((k) => !mates.includes(k) && !badDistractor(it.key, k) && !inSame(CONFUSABLE, it.key, k) && (GCONN[k] || []).some((c) => conn.includes(c))));
    const others = shuffle(h, Object.keys(GRAMMAR).filter(CORE).filter((k) => !mates.includes(k) && !rest.includes(k) && !badDistractor(it.key, k) && !inSame(CONFUSABLE, it.key, k)));
    const wrong = [];
    for (const k of [...mates, ...rest, ...others]) {
      if (wrong.length >= 3) break;
      if (badDistractor(it.key, k) || wrong.some((w) => nearG(w, k))) continue;
      wrong.push(k);
    }
    if (kind === 'gcontext') {
      const options = shuffle(h, [it.m, ...wrong.map((k) => GRAMMAR[k].m)]);
      const why = options.map((o) => {
        if (o === it.m) return `이 문장의 ${it.f.replace(/^～/, '')}${pt(it.f, '이가')} 바로 「${it.m}」${pt(it.m, '이라는라는')} 뜻이에요.${shortConnOf(it) ? ` 접속은 ${shortConnOf(it)}${pt(shortConnOf(it), '이에요예요')}.` : ''}`;
        const k = wrong.find((w) => GRAMMAR[w].m === o);
        return k ? `그건 ${GRAMMAR[k].f}의 뜻이에요. 이 문장에는 ${GRAMMAR[k].f.replace(/^～/, '')}${pt(GRAMMAR[k].f, '이가')} 없어요.` : '';
      });
      return { id, kind, prompt: `밑줄 친 「${it.f.replace(/^～/, '')}」의 뜻`, options, answer: options.indexOf(it.m), explain: `「${it.f}」 = ${it.m}. 오답: ${wrong.map((k) => `${GRAMMAR[k].f} = ${GRAMMAR[k].m}`).join(' · ')}.`, why, ex: grammarEx(it.key), more: grammarMore(it.key), label: it.f, sub: it.m, context: true };
    }
    const options = shuffle(h, [it.f, ...wrong.map((k) => GRAMMAR[k].f)]);
    const why = options.map((o) => {
      if (o === it.f) return gShort(it);
      const k = wrong.find((w) => GRAMMAR[w].f === o);
      return k ? gShort(GRAMMAR[k]) : '';
    });
    return { id, kind, prompt: it.m, options, answer: options.indexOf(it.f), explain: `${it.m} → 「${it.f}」. ${it.d} 오답: ${wrong.map((k) => `${GRAMMAR[k].f} = ${GRAMMAR[k].m}`).join(' · ')}.`, why, ex: grammarEx(it.key), more: grammarMore(it.key), label: it.f, sub: it.m };
  }
  if (kind === 'gform') {
    // 문법 표현 구별: 뜻을 보고 형태를 고른다. 비슷한 묶음의 문법은 오답으로 쓰지 않는다.
    const avoid = new Set([it.key, ...groupOf(it.key)]);
    const pool = shuffle(h, Object.entries(GRAMMAR).filter(([k, g]) => CORE(k) && !avoid.has(k) && !badDistractor(it.key, k)));
    const wrong = [];
    for (const [k, g] of pool) {
      if (wrong.length >= 3) break;
      if (wrong.some((w) => groupOf(w.k).includes(k) || meaningClash(w.g.m, g.m))) continue;
      wrong.push({ k, g });
    }
    const options = shuffle(h, [it.f, ...wrong.map((w) => w.g.f)]);
    const why = options.map((o) => {
      if (o === it.f) return gShort(it);
      const w = wrong.find((x) => x.g.f === o);
      return w ? gShort(w.g) : '';
    });
    return { id, kind, prompt: it.m, options, answer: options.indexOf(it.f), explain: `「${it.f}」 = ${it.m}. ${it.d}`, why, ex: grammarEx(it.key), more: grammarMore(it.key), label: it.f, sub: it.m };
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
    const why = options.map((o) => vShort(o));
    return { id, kind, prompt: it.m, options, answer: options.indexOf(key), explain: `${it.m} → 「${key}（${it.r}）」. 오답: ${wrong.map((w) => `${w.k}（${VOCAB[w.k].r}）= ${w.m}`).join(' · ')}.`, why, ex: vocabEx(key), more: vocabMore(key), vkey: key, label: key, sub: it.r };
  }
  if (kind === 'reading') {
    const wrong = readingOptions(key, seed);
    if (wrong.length < 3) return makeQuestion(id, seed, rec, { ...ctx, kind: 'meaning' });
    const options = shuffle(h, [it.r, ...wrong]);
    const why = options.map((o) => (o === it.r ? `${key}${pt(it.r, '은는')} ${josa(it.r, '이라고라고')} 읽어요. 뜻은 「${it.m}」${pt(it.m, '이에요예요')}.` : readingDiff(it.r, o, key)));
    return { id, kind, prompt: key, options, answer: options.indexOf(it.r), explain: `「${key}」의 읽기는 「${it.r}」(${it.m}). 장음(う)·탁음·촉음(っ)·요음(ゃゅょ)이 하나만 달라도 다른 말이 돼요.`, why, ex: vocabEx(key), more: vocabMore(key), vkey: key, label: key, sub: it.r };
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
  const why = options.map((o) => {
    if (o === it.m) return `${withReading(key)}${pt(it.r, '은는')} 「${it.m}」${pt(it.m, '이라는라는')} 뜻이에요.`;
    const w = wrong.find((x) => x.m === o);
    return w ? `${withReading(w.k)}${pt(w.k, '이가')} 「${w.m}」${pt(w.m, '이에요예요')}. 다른 말이에요.` : '';
  });
  return { id, kind, prompt: key, options, answer: options.indexOf(it.m), explain: `「${key}（${it.r}）」 = ${it.m}. 오답: ${wrongNote}.`, why, ex: vocabEx(key), more: vocabMore(key), vkey: key, label: key, sub: it.r, context: kind === 'context' };
}

// hasScene(id): 그 말이 게임 속 장면을 갖고 있는지 / blankFor(id): 문장 빈칸 정보 (없으면 null)
// 유형은 고르게 섞는다: 한 유형이 묶음의 35%(10문제면 4개)를 넘지 않게, 그 항목에 낼 수 있는 유형 가운데 가장 적게 쓴 것을 고른다
export const KIND_CAP = (n) => Math.max(2, Math.ceil(n * 0.35));
export function makeSet(ids, n = 10, seed = 'set', srs = {}, hasScene = () => false, blankFor = () => null, jaOnly = false) {
  const h = { rng: hashSeed(seed) };
  const list = shuffle(h, [...new Set(ids)].filter((id) => itemOf(id)));
  const cap = KIND_CAP(n);
  const count = {};
  const out = [];
  for (let i = 0; i < list.length && out.length < n; i++) {
    const id = list[i];
    const ctx = { hasScene: hasScene(id), blank: blankFor(id), jaOnly };
    const kinds = questionKinds(id, ctx);
    if (!kinds.length) continue;
    const rec = srs[id];
    // 같은 말이 늘 같은 유형으로 나오지 않게 시작점을 돌린다
    const start = ((rec ? rec.ok + rec.ng : 0) + Math.floor(rand(h) * kinds.length)) % kinds.length;
    const rotated = kinds.map((_, j) => kinds[(start + j) % kinds.length]);
    const open = rotated.filter((k) => (count[k] || 0) < cap);
    const kind = (open.length ? open : rotated).reduce((a, b) => ((count[b] || 0) < (count[a] || 0) ? b : a));
    const q = makeQuestion(id, seed + i, rec, { ...ctx, kind });
    if (!q) continue;
    count[q.kind] = (count[q.kind] || 0) + 1;
    out.push(q);
  }
  return out;
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
