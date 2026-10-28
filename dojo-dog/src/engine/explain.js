// 퀴즈 해설: 선택지마다 「그게 무엇이고 왜 아닌지」를 한 줄씩. 어휘·문법 DB에 있는 내용만 쓴다.
import { VOCAB } from '../data/vocab.js';
import { GRAMMAR } from '../data/grammar.js';

const VOICED = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const HANDAKU = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
const SMALL = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', っ: 'つ' };
const LONG = /^[うい]$|^ー$/;
const POS_KO = { n: '명사', v: '동사', a: 'い형용사', na: 'な형용사', adv: '부사', exp: '표현' };

// 조사 고르기: josa('대칭', '은는') → '대칭은'. 한글은 받침으로, 가나는 ん만 받침으로 본다.
const PAIRS = { 은는: ['은', '는'], 이가: ['이', '가'], 을를: ['을', '를'], 과와: ['과', '와'], 으로로: ['으로', '로'], 이에요예요: ['이에요', '예요'], 이라는라는: ['이라는', '라는'] };
export function josa(word, pair) {
  const w = String(word).replace(/[\s」』)）\].,、。]+$/, '');
  const c = w[w.length - 1] || '';
  let bat = false;
  let rieul = false;
  if (/[가-힣]/.test(c)) {
    const t = (c.charCodeAt(0) - 0xac00) % 28;
    bat = t !== 0;
    rieul = t === 8;
  } else if (/[んン]/.test(c)) bat = true;
  const [a, b] = PAIRS[pair];
  if (pair === '으로로' && rieul) return word + b;
  return word + (bat ? a : b);
}
const q = (t) => `「${t}」`;
// 조사만: pt('파악', '이라는라는') → '이라는'
export const pt = (word, pair) => josa(word, pair).slice(String(word).length);

// 정답 읽기와 틀린 읽기의 차이를 말로 (공통 앞뒤를 빼고 다른 부분만 본다). 틀린 사람에게 말해 주듯 쓴다.
export function readingDiff(right, wrong) {
  let p = 0;
  while (p < right.length && p < wrong.length && right[p] === wrong[p]) p++;
  let s = 0;
  while (s < right.length - p && s < wrong.length - p && right[right.length - 1 - s] === wrong[wrong.length - 1 - s]) s++;
  const a = right.slice(p, right.length - s);
  const b = wrong.slice(p, wrong.length - s);
  let before = right.slice(Math.max(0, p - 1), p);
  if (/[ゃゅょ]/.test(before) && p >= 2) before = right.slice(p - 2, p);
  if (!a && b) {
    if (b === 'っ') return `${before ? before + ' 뒤에 ' : ''}촉음 っ가 들어갈 자리가 아니에요. 끊지 않고 이어서 읽어요.`;
    if (LONG.test(b)) return `${before ? before + '는 ' : ''}길게 늘이지 않고 짧게 읽어요. 장음 ${b}가 붙지 않아요.`;
    return `${josa(b, '이가')} 더 들어간 읽기예요.`;
  }
  if (a && !b) {
    if (a === 'っ') return `${before ? before + ' 뒤에 ' : ''}촉음 っ가 들어가요. 한 박자 끊어서 읽어요.`;
    if (LONG.test(a)) return `${before ? before + '는 ' : ''}장음이라서 ${before}${a}로 길게 읽어요. ${a}가 빠지면 다른 말이 돼요.`;
    return `${josa(a, '이가')} 빠진 읽기예요.`;
  }
  if (a.length === 1 && b.length === 1) {
    if (VOICED[a] === b) return `여기서는 ${a}가 탁음이 되지 않아요. ${b}가 아니라 ${a}로 읽어요.`;
    if (VOICED[b] === a) return `여기서는 ${b}가 탁음이 돼서 ${a}로 읽어요.`;
    if (HANDAKU[a] === b || HANDAKU[b] === a || (VOICED[Object.keys(HANDAKU).find((k) => HANDAKU[k] === a)] === b) || (VOICED[Object.keys(HANDAKU).find((k) => HANDAKU[k] === b)] === a)) return `${a}와 ${b}가 헷갈리기 쉬워요. 여기서는 ${a}예요.`;
    if (SMALL[a] === b) return `작은 ${a}예요. 큰 ${b}로 읽으면 박자가 하나 늘어서 다른 말이 돼요.`;
    if (SMALL[b] === a) return `큰 ${a}예요. 작은 ${b}로 읽으면 박자가 줄어서 다른 말이 돼요.`;
    if (LONG.test(a)) return `${before}${a}로 길게 늘여 읽는 자리예요. ${b}가 아니에요.`;
  }
  return `${a} 자리를 ${josa(b, '으로로')} 잘못 읽은 거예요.`;
}

// 읽기가 표기와 같으면(가타카나어 등) 읽기를 붙이지 않는다
const k2h = (t) => t.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
export const withReading = (k) => (VOCAB[k] && k2h(k) !== VOCAB[k].r && k !== VOCAB[k].r ? `${k}（${VOCAB[k].r}）` : k);
export const vocabLine = (k) => (VOCAB[k] ? `${withReading(k)} = ${VOCAB[k].m}` : k);
// 대사 표시 기호를 뺀 글자
const plain = (t = '') => String(t).replace(/\[([^\]|]+)(\|[^\]]*)?\]/g, '$1').replace(/〘([^|〙]+)\|[^〙]*〙/g, '$1').replace(/〔([^:〕]+):[^〕]*〕/g, '$1');
const shortC = (c = '') => c.replace(/\s*[（(][^）)]*[）)]/g, '').split(' / ')[0].split(/\.\s/)[0].trim();
// 해설 한 줄용 짧은 꼴: 문법은 「뜻 · 접속」, 어휘는 「읽기 · 뜻」 (선택지 글자는 화면이 따로 보여 주므로 되풀이하지 않는다)
export const shortConnOf = (g) => shortC(g.c || '');
// 문법 한 줄: 「~할 리가 없다」라는 뜻이에요. 접속은 동사 ます형＋っこない예요.
export const gShort = (g) => (g ? `「${g.m}」${pt(g.m, '이라는라는')} 뜻이에요.${shortC(g.c) ? ` 접속은 ${shortC(g.c)}${pt(shortC(g.c), '이에요예요')}.` : ''}` : '');
// 어휘 한 줄: ○○라고 읽고, 「뜻」이라는 뜻이에요. (가타카나어는 읽기 생략)
export const vShort = (k) => {
  const v = VOCAB[k];
  if (!v) return '';
  const noRead = k2h(k) === v.r || k === v.r;
  return noRead ? `「${v.m}」${pt(v.m, '이라는라는')} 뜻이에요.` : `${v.r}라고 읽고, 「${v.m}」${pt(v.m, '이라는라는')} 뜻이에요.`;
};
// 예문 [ja, ko]
export const vocabEx = (k) => (VOCAB[k] && VOCAB[k].ex ? [VOCAB[k].ex, VOCAB[k].exk || ''] : null);
export const grammarEx = (k) => (GRAMMAR[k] && Array.isArray(GRAMMAR[k].ex) && GRAMMAR[k].ex[0] ? [plain(GRAMMAR[k].ex[0][0]), GRAMMAR[k].ex[0][1]] : null);
// 「わけがない」 같은 형태로 문법 항목 찾기
export function grammarByForm(form) {
  if (GRAMMAR[form]) return { key: form, ...GRAMMAR[form] };
  const bare = form.replace(/^～/, '');
  for (const [k, g] of Object.entries(GRAMMAR)) if (g.f.replace(/^～/, '').split('・').includes(bare)) return { key: k, ...g };
  return null;
}
export const grammarLine = (g) => (g ? `「${g.f}」 = ${g.m}${g.c ? ` (접속: ${shortC(g.c)})` : ''}` : '');

// 어휘 문제의 덧붙임: 품사·예문
export function vocabMore(key) {
  const v = VOCAB[key];
  if (!v) return [];
  return [
    POS_KO[v.pos] ? `품사: ${v.sn ? 'する명사' : POS_KO[v.pos]}` : null,
    v.ex ? `예문: ${v.ex}${v.exk ? ` — ${v.exk}` : ''}` : null,
    v.note ? v.note : null,
  ].filter(Boolean);
}
// 문법 문제의 덧붙임: 접속·차이·주의·예문
export function grammarMore(key) {
  const g = GRAMMAR[key];
  if (!g) return [];
  const ex = Array.isArray(g.ex) && g.ex[0];
  return [
    g.c ? `접속: ${g.c}` : null,
    g.d ? `비슷한 표현과의 차이: ${g.d}` : null,
    g.err || g.w ? `주의: ${g.err || g.w}` : null,
    ex ? `예문: ${plain(ex[0])} — ${ex[1]}` : null,
  ].filter(Boolean);
}
