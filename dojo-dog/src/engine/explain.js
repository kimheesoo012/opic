// 퀴즈 해설: 선택지마다 「그게 무엇이고 왜 아닌지」를 한 줄씩. 어휘·문법 DB에 있는 내용만 쓴다.
import { VOCAB } from '../data/vocab.js';
import { GRAMMAR } from '../data/grammar.js';
import { KANJI } from '../data/kanji.js';

const VOICED = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const HANDAKU = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
const SMALL = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', っ: 'つ' };
const LONG = /^[うい]$|^ー$/;
const POS_KO = { n: '명사', v: '동사', a: 'い형용사', na: 'な형용사', adv: '부사', exp: '표현' };

// 조사 고르기: josa('대칭', '은는') → '대칭은'. 한글은 받침으로, 가나는 ん만 받침으로 본다.
const PAIRS = { 은는: ['은', '는'], 이가: ['이', '가'], 을를: ['을', '를'], 과와: ['과', '와'], 으로로: ['으로', '로'], 이에요예요: ['이에요', '예요'], 이라는라는: ['이라는', '라는'], 이라고라고: ['이라고', '라고'], 이라서라서: ['이라서', '라서'], 이랑랑: ['이랑', '랑'] };
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
// word가 있으면(한자어) 어느 한자의 읽기가 달랐는지 짚어 준다: 「力는 りき가 아니라 りょく로 읽어요.」
const UNVOICED = Object.fromEntries([...Object.entries(VOICED), ...Object.entries(HANDAKU)].map(([a, b]) => [b, a]));
const seion = (t) => [...t].map((c) => UNVOICED[c] || c).join('');
const LONG_TAIL = /[うい]$/;
const E_ROW = 'えけせてねへめれげぜでべぺ';
const OU_ROW = 'おこそとのほもよろごぞどぼぽょうくすつぬふむゆるぐずぶぷゅ';
// 긴 읽기(こう)에서 장음을 뗀 꼴이 짧은 읽기(こ)인가
const longOf = (short, long) => long.length === short.length + 1 && long.startsWith(short) && LONG_TAIL.test(long) && (long.endsWith('う') ? OU_ROW.includes(short[short.length - 1]) : E_ROW.includes(short[short.length - 1]));
function diffParts(right, wrong) {
  let p = 0;
  while (p < right.length && p < wrong.length && right[p] === wrong[p]) p++;
  // 요음·촉음 한가운데서 갈리면 앞 글자까지 묶어서 본다 (「ょく」가 아니라 「りょく」)
  if (p > 0 && (/[ゃゅょ]/.test(right[p] || '') || /[ゃゅょ]/.test(wrong[p] || ''))) p--;
  let s = 0;
  while (s < right.length - p && s < wrong.length - p && right[right.length - 1 - s] === wrong[wrong.length - 1 - s]) s++;
  return { p, s, a: right.slice(p, right.length - s), b: wrong.slice(p, wrong.length - s) };
}
export function readingDiff(right, wrong, word = '') {
  const { p, s, a, b } = diffParts(right, wrong);
  let before = right.slice(Math.max(0, p - 1), p);
  if (/[ゃゅょ]/.test(before) && p >= 2) before = right.slice(p - 2, p);
  const atEnd = s === 0;
  const whole = josa(right, '이라고라고');
  // 한자어면 어느 글자의 읽기가 달랐는지 (다른 음독·청탁·장단·요음·촉음)
  const byKanji = () => {
    const hit = word ? kanjiAt(word, right, p, right.length - s) : null;
    if (!hit) return '';
    const { c: ch, r } = hit;
    const w = wrong.slice(hit.start, hit.start + r.length + (b.length - a.length));
    if (!w || w === r) return '';
    const on = (KANJI[ch] && KANJI[ch].on) || [];
    // 한자 뒤의 조사는 한국 한자음(쇠 금 → 금)으로 고른다: 金은·者는
    const ko = (KANJI[ch] && KANJI[ch].ko) || '';
    const kpt = (pair) => pt(ko ? ko.slice(-1) : ch, pair);
    const big = (t) => t.replace(/[ゃゅょ]/g, (m) => SMALL[m]);
    if (seion(w) === seion(r)) return `${ch}${kpt('은는')} ${josa(w, '이가')} 아니라 ${josa(r, '이에요예요')}.`;
    if (big(r) === w) return `${ch}${kpt('은는')} ${josa(r, '이에요예요')}. 작은 ${r.match(/[ゃゅょ]/)[0]}.`;
    if (big(w) === r) return `${ch}${kpt('은는')} ${josa(r, '이에요예요')}. 큰 글자로 읽어요.`;
    if (r.endsWith('っ') && /[くつちき]$/.test(w) && seion(w.slice(0, -1)) === seion(r.slice(0, -1))) return `${ch}${kpt('은는')} 여기서 촉음이 돼 ${josa(r, '이에요예요')}.`;
    if (w.endsWith('っ') && /[くつちき]$/.test(r) && seion(r.slice(0, -1)) === seion(w.slice(0, -1))) return `${ch}${kpt('은는')} ${josa(r, '이에요예요')}. 촉음으로 줄지 않아요.`;
    if (longOf(w, r)) return `${ch}${kpt('은는')} 장음 ${josa(r, '이에요예요')}.`;
    if (longOf(r, w)) return `${ch}${kpt('은는')} 장음 없이 ${josa(r, '이에요예요')}.`;
    if (on.includes(w) || on.includes(seion(w))) return `${w}도 ${ch}의 음독이지만 이 말에서는 ${josa(r, '이에요예요')}.`;
    return `${ch}${kpt('은는')} ${josa(r, '이에요예요')}.`;
  };
  if (!a && b) {
    if (b === 'っ') return `촉음 っ가 없어요. ${whole} 읽어요.`;
    if (b === 'ん') return atEnd ? `끝에 ん이 없어요. ${whole} 읽어요.` : `ん이 없어요. ${whole} 읽어요.`;
    if (LONG_TAIL.test(b) && b.length === 1) return `장음 ${josa(b, '이가')} 없어요. ${whole} 읽어요.`;
    return byKanji() || `${josa(b, '이가')} 더 붙었어요. ${whole} 읽어요.`;
  }
  if (a && !b) {
    if (a === 'っ') return `촉음 っ가 빠졌어요. ${whole} 읽어요.`;
    if (a === 'ん') return atEnd ? `마지막 ん이 빠졌어요. ${whole} ん까지 읽어요.` : `${before} 뒤에 ん이 들어가요. ${whole} 읽어요.`;
    if (LONG_TAIL.test(a) && a.length === 1) return `장음 ${josa(a, '이가')} 빠졌어요. ${whole} 읽어요.`;
    return byKanji() || `${josa(a, '이가')} 빠졌어요. ${whole} 읽어요.`;
  }
  if (a.length === 1 && b.length === 1) {
    // 한자어는 글자를 짚어 말한다 (같은 종류의 오답이 둘이어도 설명이 달라진다)
    const kj = byKanji();
    if (kj) return kj;
    if (VOICED[a] === b) return `탁음이 아니라 ${a}예요. ${whole} 읽어요.`;
    if (VOICED[b] === a) return `여기서는 탁음 ${a}예요. ${whole} 읽어요.`;
    if (HANDAKU[a] === b || HANDAKU[b] === a || seion(a) === seion(b)) return `${b}가 아니라 ${a}예요. ${whole} 읽어요.`;
    if (SMALL[a] === b) return `작은 ${a}예요. ${whole} 읽어요.`;
    if (SMALL[b] === a) return `큰 ${a}예요. ${whole} 읽어요.`;
    if (LONG_TAIL.test(a)) return `장음 ${before}${a}예요. ${whole} 읽어요.`;
  }
  return byKanji() || `${whole} 읽어요.`;
}
// right의 [from, to) 구간을 덮는 한자 하나 (kanjiSplit으로 음독을 쪼갤 수 있을 때만)
function kanjiAt(word, right, from, to) {
  const parts = kanjiSplit(word, right);
  if (!parts.length || parts.some((x) => !x.r)) return null;
  let at = 0;
  for (const x of parts) {
    const end = at + x.r.length;
    if (from >= at && to <= end && (to > from || from < end)) return { ...x, start: at };
    if (from >= at && from < end && to > end) return null; // 두 글자에 걸쳐 다르다
    at = end;
  }
  return null;
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
  return noRead ? `「${v.m}」${pt(v.m, '이라는라는')} 뜻이에요.` : `${josa(v.r, '이라고라고')} 읽고, 「${v.m}」${pt(v.m, '이라는라는')} 뜻이에요.`;
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

// ---- 한자 분해 (읽기·표기 문제의 정답 해설용) ----
const IS_KANJI = /[一-龯]/;
const dakuOf = (k) => VOICED[k] || HANDAKU[k] || k;
// 음독이 word의 reading 안에 어떻게 들어갔는지 찾는다: 연탁(か→が)·촉음(く/つ→っ)·장음 생략까지 허용. 못 찾으면 null
function matchOn(on, rest) {
  for (const o of on) {
    const cands = [o];
    if (VOICED[o[0]] || HANDAKU[o[0]]) cands.push(VOICED[o[0]] ? VOICED[o[0]] + o.slice(1) : null, HANDAKU[o[0]] ? HANDAKU[o[0]] + o.slice(1) : null);
    if (/[くつち]$/.test(o)) cands.push(o.slice(0, -1) + 'っ');
    for (const c of cands.filter(Boolean)) if (rest.startsWith(c)) return c;
  }
  return null;
}
// kanjiSplit('逮捕', 'たいほ') → [{ c: '逮', r: 'たい', ko: '잡을 체' }, { c: '捕', r: 'ほ', ko: '잡을 포' }]. 음독으로 안 맞으면 r 없이 훈음만.
export function kanjiSplit(word, reading = '') {
  const chars = [...String(word)];
  if (!chars.some((c) => IS_KANJI.test(c))) return [];
  const rows = chars.map((c) => ({ c, r: '', ko: (KANJI[c] && KANJI[c].ko) || '' })).filter((x) => IS_KANJI.test(x.c) || x.c === '々');
  if (!rows.every((x) => x.ko)) return rows.filter((x) => x.ko);
  // 모두 한자인 음독어만 읽기를 쪼갠다 (訓読み나 送り仮名가 섞이면 훈음만)
  if (chars.every((c) => IS_KANJI.test(c) || c === '々') && reading) {
    let rest = reading;
    const rs = [];
    for (let i = 0; i < chars.length; i++) {
      const base = chars[i] === '々' ? chars[i - 1] : chars[i];
      const m = matchOn((KANJI[base] && KANJI[base].on) || [], rest);
      if (!m) { rs.length = 0; break; }
      rs.push(m);
      rest = rest.slice(m.length);
    }
    if (rs.length === chars.length && !rest) rs.forEach((r, i) => { rows[i].r = r; });
  }
  return rows;
}
// 같은 글자를 같은 음으로 읽는 다른 말 (어휘 DB에서), 최대 n개: sameReading('捕', 'ほ', '逮捕') → ['捕獲（ほかく）']
export function sameReading(c, r, exclude, n = 2) {
  if (!c || !r) return [];
  const out = [];
  for (const [k, v] of Object.entries(VOCAB)) {
    if (k === exclude || !k.includes(c) || v.k) continue;
    const parts = kanjiSplit(k, v.r);
    if (parts.some((p) => p.c === c && p.r === r)) out.push(`${k}（${v.r}）`);
    if (out.length >= n) break;
  }
  return out;
}
// 어휘 정답 칸에 덧붙이는 줄들: [{ t: 제목, ja: [...], ko: '' }]
//  한자: 逮 たい 잡을 체 ＋ 捕 ほ 잡을 포 / 같은 읽기: 捕獲（ほかく） / 비슷한 말·반대말·헷갈리는 말 (DB에 있을 때)
export function vocabRows(key, { kanji = true, rel = true } = {}) {
  const v = VOCAB[key];
  if (!v) return [];
  const rows = [];
  if (kanji) {
    const parts = kanjiSplit(key, v.r);
    if (parts.length) {
      rows.push({ t: '한자', parts });
      const same = [];
      for (const p of parts) if (p.r) for (const w of sameReading(p.c, p.r, key, 1)) same.push(`${p.c}＝${w}`);
      if (same.length) rows.push({ t: '같은 읽기', ja: same.slice(0, 3) });
    }
  }
  if (rel) {
    const line = (ks) => (ks || []).filter((k) => VOCAB[k]).slice(0, 3).map((k) => `${withReading(k)} ${VOCAB[k].m}`);
    const syn = line(v.syn);
    const ant = line(v.ant);
    const conf = line(v.conf);
    if (syn.length) rows.push({ t: '비슷한 말', ja: syn });
    if (ant.length) rows.push({ t: '반대말', ja: ant });
    if (conf.length) rows.push({ t: '헷갈리는 말', ja: conf });
  }
  return rows;
}

// ---- 틀린 원인 (복습·약점 분석용) ----
// 원인 키 → [한국어, 일본어]
export const CAUSES = {
  long: ['장음 혼동', '長音'],
  voice: ['탁음 혼동', '清音・濁音'],
  sokuon: ['촉음 혼동', '促音'],
  youon: ['요음 혼동', '拗音'],
  on: ['다른 음독', '音読みの取り違え'],
  shape: ['비슷한 한자', '似た漢字'],
  affix: ['접두어·접미어', '接頭語・接尾語'],
  vocab: ['어휘 뜻·쓰임', '語の意味・使い方'],
  grammar: ['문법 뜻·접속', '文法の意味・接続'],
  order: ['어순', '語順'],
};
// 읽기 두 개의 차이로 원인을 고른다: readingCause('かじょう', 'かじょ') → 'long'
export function readingCause(right, wrong) {
  const { a, b } = diffParts(right, wrong);
  const one = (x) => x.length === 1;
  const drop = (x, re) => x.replace(re, '');
  if ((!a && b === 'っ') || (!b && a === 'っ') || (one(a) && one(b) && (a === 'っ' || b === 'っ')) || drop(a, /っ/g) === drop(b, /っ/g)) return 'sokuon';
  if ((!a && LONG.test(b)) || (!b && LONG.test(a)) || (one(a) && one(b) && (a === 'ー' || b === 'ー')) || longOf(a, b) || longOf(b, a)) return 'long';
  if (seion(a) === seion(b)) return 'voice';
  const big = (t) => t.replace(/[ゃゅょ]/g, (m) => SMALL[m]);
  if ((one(a) && one(b) && (SMALL[a] === b || SMALL[b] === a)) || big(a) === b || big(b) === a) return 'youon';
  if (/[ゃゅょ]/.test(a) !== /[ゃゅょ]/.test(b) && a.replace(/[ゃゅょ]/g, '').length && Math.abs(a.length - b.length) <= 1) {
    const strip = (x) => x.replace(/[きしちにひみりぎじびぴ]([ゃゅょ])/g, '$1');
    if (strip(a) === strip(b) || a.replace(/[ゃゅょ]/g, '') === b.replace(/[ゃゅょ]/g, '')) return 'youon';
  }
  return 'on';
}
const BTYPE_CAUSE = { hyoki: 'shape', gokei: 'affix', bunmyaku: 'vocab', iikae: 'vocab', yoho: 'vocab', bunpo: 'grammar', kaiwa: 'grammar', bunsho: 'grammar', narabe: 'order' };
// 문제 하나에서 고른 오답의 원인. q: { options, answer, kind?, btype? }
export function errorCause(q, pick) {
  if (pick == null || pick === q.answer) return null;
  const t = q.btype || q.type;
  if (t === 'kanji' || q.kind === 'reading') return readingCause(q.options[q.answer], q.options[pick]);
  if (BTYPE_CAUSE[t]) return BTYPE_CAUSE[t];
  if (/^g/.test(q.kind || '')) return 'grammar';
  if (q.kind) return 'vocab';
  return null;
}
// 정답을 채운 문제문: [앞, 정답, 뒤] (빈칸·밑줄이 없으면 null)
export function filledSentence(q) {
  const t = q.btype || q.type;
  const ans = q.options[q.answer];
  if (t === 'narabe' && q.full) return [q.full, '', ''];
  if (t === 'yoho') return [ans, '', ''];
  const src = String(q.prompt || q.q || '').replace(/\n/g, ' ');
  let m = src.match(/〔([^〕]+)〕/);
  if (m) {
    const word = t === 'hyoki' ? ans : m[1];
    const after = t === 'kanji' ? `（${ans}）` : t === 'iikae' ? ` ≒ ${ans}` : '';
    return [src.slice(0, m.index), word + after, src.slice(m.index + m[0].length)];
  }
  m = src.match(/（[\s　]*）/);
  if (m) return [src.slice(0, m.index), ans, src.slice(m.index + m[0].length)];
  return null;
}
