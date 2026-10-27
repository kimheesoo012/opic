// 퀴즈 해설: 선택지마다 「그게 무엇이고 왜 아닌지」를 한 줄씩. 어휘·문법 DB에 있는 내용만 쓴다.
import { VOCAB } from '../data/vocab.js';
import { GRAMMAR } from '../data/grammar.js';

const VOICED = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const HANDAKU = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
const SMALL = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', っ: 'つ' };
const LONG = /^[うい]$|^ー$/;
const POS_KO = { n: '명사', v: '동사', a: 'い형용사', na: 'な형용사', adv: '부사', exp: '표현' };

// 조사 고르기: josa('대칭', '은는') → '대칭은'. 한글은 받침으로, 가나는 ん만 받침으로 본다.
const PAIRS = { 은는: ['은', '는'], 이가: ['이', '가'], 을를: ['을', '를'], 과와: ['과', '와'], 으로로: ['으로', '로'] };
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

// 정답 읽기와 틀린 읽기의 차이를 말로 (공통 앞뒤를 빼고 다른 부분만 본다)
export function readingDiff(right, wrong) {
  let p = 0;
  while (p < right.length && p < wrong.length && right[p] === wrong[p]) p++;
  let s = 0;
  while (s < right.length - p && s < wrong.length - p && right[right.length - 1 - s] === wrong[wrong.length - 1 - s]) s++;
  const a = right.slice(p, right.length - s);
  const b = wrong.slice(p, wrong.length - s);
  if (!a && b) {
    if (b === 'っ') return '없는 촉음(っ)이 붙었다';
    if (LONG.test(b)) return `없는 장음(${b})이 붙었다`;
    return `${josa(q(b), '이가')} 더 들어갔다`;
  }
  if (a && !b) {
    if (a === 'っ') return '촉음(っ)이 빠졌다';
    if (LONG.test(a)) return `장음(${a})이 빠졌다`;
    return `${josa(q(a), '이가')} 빠졌다`;
  }
  if (a.length === 1 && b.length === 1) {
    if (VOICED[a] === b) return `${josa(q(a), '을를')} 탁음 ${josa(q(b), '으로로')} 읽었다 (여기서는 탁음이 되지 않는다)`;
    if (VOICED[b] === a) return `탁음 ${josa(q(a), '을를')} 청음 ${josa(q(b), '으로로')} 읽었다`;
    if (HANDAKU[a] === b || HANDAKU[b] === a || (VOICED[Object.keys(HANDAKU).find((k) => HANDAKU[k] === a)] === b) || (VOICED[Object.keys(HANDAKU).find((k) => HANDAKU[k] === b)] === a)) return `${q(a)}·${q(b)}(반탁음·탁음)를 바꿔 읽었다`;
    if (SMALL[a] === b) return `작은 ${josa(q(a), '을를')} 큰 ${josa(q(b), '으로로')} 읽었다`;
    if (SMALL[b] === a) return `큰 ${josa(q(a), '을를')} 작은 ${josa(q(b), '으로로')} 읽었다`;
    if (LONG.test(a)) return `장음 ${q(a)} 자리를 ${josa(q(b), '으로로')} 읽었다`;
  }
  return `${q(a)} 부분을 ${josa(q(b), '으로로')} 읽었다`;
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
export const gShort = (g) => (g ? [g.m, shortC(g.c)].filter(Boolean).join(' · ') : '');
export const vShort = (k) => {
  const v = VOCAB[k];
  if (!v) return '';
  return k2h(k) === v.r || k === v.r ? v.m : `${v.r} · ${v.m}`;
};
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
