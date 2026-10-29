// 한자 중심 학습: N2 어휘에 나오는 한자 색인, 한자별 읽기 묶음, 한국 한자음 ↔ 음독 대응, 한자 연습 문제.
// 어휘 DB(VOCAB)와 한자 DB(KANJI)에 있는 것만 쓴다 (없는 읽기·뜻을 지어내지 않는다).
import { VOCAB } from '../data/vocab.js';
import { KANJI } from '../data/kanji.js';
import { kanjiSplit, sameReading, pt } from './explain.js';
import { hashSeed, shuffle } from './rng.js';

const IS_K = /[一-龯々]/;
const kanjiOf = (w) => [...new Set([...w].filter((c) => IS_K.test(c) && c !== '々' && KANJI[c]))];

let INDEX = null;
// { 글자: { n2: [N2 단어], all: [모든 단어] } }
export function kanjiIndex() {
  if (INDEX) return INDEX;
  INDEX = {};
  for (const [w, v] of Object.entries(VOCAB)) {
    for (const c of kanjiOf(w)) {
      const e = INDEX[c] || (INDEX[c] = { n2: [], all: [] });
      e.all.push(w);
      if (v.lv === 'N2') e.n2.push(w);
    }
  }
  for (const c of Object.keys(INDEX)) if (!INDEX[c].n2.length) delete INDEX[c];
  return INDEX;
}
// N2 단어 수가 많은 순
export const kanjiList = () => Object.keys(kanjiIndex()).sort((a, b) => kanjiIndex()[b].n2.length - kanjiIndex()[a].n2.length || a.localeCompare(b));

// 한 단어에서 그 한자의 읽기 ('' = 훈독·送り仮名가 섞여 쪼갤 수 없음)
export function readingIn(word, c) {
  const v = VOCAB[word];
  if (!v) return '';
  const p = kanjiSplit(word, v.r).find((x) => x.c === c);
  return (p && p.r) || '';
}
// 읽기마다 단어 묶음: [{ r: 'ほ', words: ['逮捕', ...] }, ..., { r: '', words: [...] }] (N2 단어 먼저, 많은 읽기 먼저)
export function readingGroups(c) {
  const e = kanjiIndex()[c];
  if (!e) return [];
  const by = new Map();
  for (const w of e.all) {
    const r = readingIn(w, c);
    if (!by.has(r)) by.set(r, []);
    by.get(r).push(w);
  }
  const lvRank = (w) => (VOCAB[w].lv === 'N2' ? 0 : 1);
  return [...by].map(([r, words]) => ({ r, words: words.sort((a, b) => lvRank(a) - lvRank(b)) }))
    .sort((a, b) => (!a.r) - (!b.r) || b.words.length - a.words.length);
}

// ── 한국 한자음 ↔ 일본 음독 ──
const ONSET = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const CODA = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const ROW = { か: 'かきくけこがぎぐげごきゃきゅきょ', さ: 'さしすせそざじずぜぞ', た: 'たちつてとだぢづでど', な: 'なにぬねの', は: 'はひふへほばびぶべぼ', ま: 'まみむめも', ら: 'らりるれろ', あ: 'あいうえおやゆよわ' };
const ONSET_ROW = { ㄱ: ['か'], ㅋ: ['か'], ㅎ: ['か'], ㄴ: ['な', 'た'], ㄷ: ['た'], ㅌ: ['た'], ㄹ: ['ら'], ㅁ: ['ま', 'は'], ㅂ: ['は'], ㅍ: ['は'], ㅅ: ['さ'], ㅈ: ['さ', 'た'], ㅊ: ['さ', 'た'], ㅇ: ['あ', 'か'] };
const ROW_KO = { か: 'か', さ: 'さ', た: 'た', な: 'な', は: 'は', ま: 'ま', ら: 'ら', あ: 'あ·や·わ' };
const CODA_END = { ㄱ: [/[くき]$/, 'く·き'], ㄹ: [/[つち]$/, 'つ·ち'], ㅂ: [/う$/, 'う'], ㅇ: [/[うい]$/, 'う·い'], ㄴ: [/ん$/, 'ん'], ㅁ: [/ん$/, 'ん'] };
export function koSound(c) {
  const ko = (KANJI[c] && KANJI[c].ko) || '';
  const s = ko.trim().split(/\s+/).pop() || '';
  return /^[가-힣]$/.test(s) ? s : '';
}
function jamo(s) {
  const n = s.charCodeAt(0) - 0xac00;
  return { on: ONSET[Math.floor(n / 588)], coda: CODA[n % 28] };
}
// 「포 → ほ」처럼 소리가 규칙대로 대응할 때만 설명 한 줄: { ko: '포', r: 'ほ', text } | null
export function koNote(c, r) {
  const s = koSound(c);
  if (!s || !r) return null;
  const { on, coda } = jamo(s);
  const row = (ONSET_ROW[on] || []).find((x) => ROW[x].includes(r[0]));
  if (!row) return null;
  const parts = [`${on} 소리는 ${ROW_KO[row]}행으로 와요`];
  const end = CODA_END[coda];
  if (coda && end) {
    if (!end[0].test(r)) return null;
    parts.push(`받침 ${coda}은 ${end[1]}${pt(end[1], "으로로")} 끝나요`);
  } else if (!coda) {
    if (/[んくきつち]$/.test(r)) return null;
    parts.push(/[うい]$/.test(r) ? '받침이 없으니 장음(う·い)이 붙을 수 있어요' : '받침이 없으니 짧게 끝나요');
  } else return null;
  return { ko: s, r, text: `한국 음 ${s} → ${r}: ${parts.join(', ')}.` };
}

// ── 연습 문제 ──
// 모양이 비슷해 자주 헷갈리는 한자 (N2 어휘에 나오는 것 위주)
export const SHAPE = [
  '捕補浦哺', '険検験剣倹', '績積責債', '偏編遍', '径経軽', '識織職', '復複腹覆', '暑署緒諸', '徴微徹', '貸貨賃',
  '侍待持特', '借措惜', '購講構溝', '適摘滴敵', '抗坑航', '慢漫', '療僚寮', '環還', '栽裁載', '援緩暖', '鋼綱網', '抵低底邸', '飯版販板',
  '拾捨', '援暖緩', '均坪', '績蹟', '幣弊', '募墓幕慕暮', '墳憤噴', '析折祈', '朱株珠', '巡循', '矛予', '陳陣', '粉紛', '績漬', '拡広鉱', '侵浸寝',
].map((g) => [...g].filter((c) => KANJI[c]));
export function lookAlikes(c) {
  return [...new Set(SHAPE.filter((g) => g.includes(c)).flat())].filter((x) => x !== c);
}
const VOICE = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const UNVOICE = Object.fromEntries(Object.entries(VOICE).map(([a, b]) => [b, a]));
const onsOf = (c) => (KANJI[c] && KANJI[c].on) || [];
const wr = (w) => `${w}(${VOCAB[w].r})`;
// 같은 음독을 가진 다른 한자 (N2 색인 안에서)
function sameOnKanji(c, r) {
  return kanjiList().filter((x) => x !== c && onsOf(x).includes(r));
}

// (a) 이 단어에서 이 한자의 읽기
function qReading(c, seed) {
  const words = kanjiIndex()[c].all.filter((w) => readingIn(w, c));
  if (!words.length) return null;
  const n2 = words.filter((w) => VOCAB[w].lv === 'N2');
  const pool = n2.length ? n2 : words;
  const w = pool[hashSeed(seed + c) % pool.length];
  const r = readingIn(w, c);
  const v = VOCAB[w];
  const cand = [];
  const add = (x, why) => { if (x && x !== r && !cand.some((y) => y[0] === x)) cand.push([x, why]); };
  for (const o of onsOf(c)) {
    if (o === r || VOICE[o[0]] + o.slice(1) === r || UNVOICE[o[0]] + o.slice(1) === r || o.slice(0, -1) + 'っ' === r) continue;
    const ex = sameReading(c, o, w, 1)[0];
    add(o, ex ? `${c}${pt(koSound(c) || c, '을를')} ${o}${pt(o, "으로로")} 읽는 건 ${ex.replace('（', '(').replace('）', ')')} 같은 말이에요. 이 단어에서는 ${r}${pt(r, "이에요예요")}.` : `${o}${pt(o, '은는')} ${c}의 다른 음이지만 이 단어에서는 ${r}${pt(r, "으로로")} 읽어요.`);
  }
  if (/[うい]$/.test(r) && r.length > 1) add(r.slice(0, -1), `${c}${pt(koSound(c) || c, '은는')} 여기서 장음까지 넣어 ${r}${pt(r, "으로로")} 읽어요.`);
  else if (!/[んっくきつち]$/.test(r)) add(r + 'う', `장음을 붙이지 않고 짧게 ${r}${pt(r, "으로로")} 읽어요.`);
  if (VOICE[r[0]]) add(VOICE[r[0]] + r.slice(1), `앞 글자가 있어도 탁음이 되지 않고 청음 ${r}${pt(r, "이에요예요")}.`);
  if (UNVOICE[r[0]]) add(UNVOICE[r[0]] + r.slice(1), `이 단어에서는 탁음 ${r}${pt(r, "으로로")} 읽어요.`);
  for (const k of lookAlikes(c)) for (const o of onsOf(k)) add(o, `${o}${pt(o, '은는')} 모양이 비슷한 ${k}(${KANJI[k].ko})의 음이에요. ${c}${pt(koSound(c) || c, '은는')} ${r}${pt(r, "이에요예요")}.`);
  if (/[くきつち]$/.test(r)) add(r.slice(0, -1) + "っ", `뒤 글자와 이어져도 여기서는 촉음이 되지 않고 ${r}${pt(r, "이에요예요")}.`);
  if (/っ$/.test(r)) for (const e of ["く", "つ"]) add(r.slice(0, -1) + e, `뒤 글자 때문에 촉음 ${r}${pt(r, "으로로")} 바뀌어요.`);
  const s = koSound(c);
  if (s) for (const k of kanjiList().filter((x) => x !== c && koSound(x) === s).slice(0, 8)) for (const o of onsOf(k)) add(o, `${o}${pt(o, "은는")} 한국 음이 같은 ${k}(${KANJI[k].ko})의 음이에요. ${c}${pt(s, "은는")} ${r}${pt(r, "이에요예요")}.`);
  if (cand.length < 3) return null;
  const picked = cand.slice(0, 3);
  const opts = shuffle({ rng: hashSeed(seed + 'o' + c) }, [[r, null], ...picked]);
  const answer = opts.findIndex((o) => o[1] === null);
  const note = koNote(c, r);
  const why = opts.map(([o, y]) => y || `${wr(w)}${pt(VOCAB[w].r, '은는')} 「${v.m}」${pt(v.m, "이에요예요")}. ${c}${pt(koSound(c) || c, '을를')} ${r}${pt(r, "으로로")} 읽어요.${note ? ` ${note.text}` : ''}`);
  return { kind: 'reading', c, word: w, prompt: w, options: opts.map((o) => o[0]), answer, why, vkey: w, ex: v.ex ? [v.ex, v.exk || ''] : null };
}

// (b) 뜻 X로 이 한자를 쓰는 말
function qWord(c, seed) {
  const e = kanjiIndex()[c];
  const w = e.n2[hashSeed(seed + 'w' + c) % e.n2.length];
  const v = VOCAB[w];
  const dist = [];
  const add = (x) => { if (x && x !== w && VOCAB[x] && !dist.includes(x) && VOCAB[x].m !== v.m) dist.push(x); };
  e.all.filter((x) => x !== w).forEach(add);
  const r = readingIn(w, c);
  if (dist.length < 3) for (const k of [...lookAlikes(c), ...(r ? sameOnKanji(c, r).slice(0, 4) : [])]) (kanjiIndex()[k] || { n2: [] }).n2.slice(0, 2).forEach(add);
  if (dist.length < 3) return null;
  const picks = shuffle({ rng: hashSeed(seed + 'd' + c) }, dist.slice(0, 6)).slice(0, 3);
  const opts = shuffle({ rng: hashSeed(seed + 'p' + c) }, [w, ...picks]);
  const why = opts.map((o) => (o === w
    ? `${wr(w)}${pt(VOCAB[w].r, '은는')} 「${v.m}」${pt(v.m, "이에요예요")}. ${c}(${KANJI[c].ko})의 뜻이 그대로 들어 있어요.`
    : `${wr(o)}${pt(VOCAB[o] ? VOCAB[o].r : o, '은는')} 「${VOCAB[o].m}」${pt(VOCAB[o].m, '이에요예요')}.${o.includes(c) ? ` ${c}${pt(koSound(c) || c, '을를')} 쓰지만 뜻이 달라요.` : ` ${c}${pt(koSound(c) || c, '이가')} 아니라 ${kanjiOf(o).filter((k) => !w.includes(k)).join('·')}${pt(koSound(kanjiOf(o).filter((k) => !w.includes(k)).pop()) || o, '을를')} 써요.`}`));
  return { kind: 'word', c, word: w, meaning: v.m, options: opts, answer: opts.indexOf(w), why, vkey: w, ex: v.ex ? [v.ex, v.exk || ''] : null };
}

// (c) 훈음 X의 한자 (모양이 비슷한 한자·같은 음 한자 중에서)
function qKanji(c, seed) {
  const ko = KANJI[c].ko;
  const s = koSound(c);
  const dist = [];
  const add = (k) => { if (k !== c && KANJI[k] && KANJI[k].ko && KANJI[k].ko !== ko && !dist.includes(k)) dist.push(k); };
  lookAlikes(c).forEach(add);
  for (const o of onsOf(c)) sameOnKanji(c, o).slice(0, 6).forEach(add);
  if (s) kanjiList().filter((k) => koSound(k) === s).slice(0, 6).forEach(add);
  if (dist.length < 3) return null;
  const shape = lookAlikes(c).filter((k) => dist.includes(k));
  const rest = shuffle({ rng: hashSeed(seed + 'k' + c) }, dist.filter((k) => !shape.includes(k)));
  const opts = shuffle({ rng: hashSeed(seed + 'q' + c) }, [c, ...[...shape, ...rest].slice(0, 3)]);
  const on = (k) => onsOf(k).slice(0, 2).join('·');
  const why = opts.map((k) => (k === c
    ? `${c}${pt(koSound(c) || c, '은는')} 「${ko}」, 음독은 ${on(c) || "없음"}${pt(on(c) || "없음", "이에요예요")}.`
    : `${k}${pt(koSound(k) || k, '은는')} 「${KANJI[k].ko}」${pt(KANJI[k].ko, '이에요예요')}.${shape.includes(k) ? ' 모양이 비슷하니 부수를 잘 보세요.' : onsOf(k).some((o) => onsOf(c).includes(o)) ? ` 음독이 ${onsOf(k).filter((o) => onsOf(c).includes(o))[0]}${pt(onsOf(k).filter((o) => onsOf(c).includes(o))[0], "으로로")} 같아서 헷갈려요.` : ''}`));
  return { kind: 'kanji', c, ko, options: opts, answer: opts.indexOf(c), why };
}

export const Q_KINDS = { reading: qReading, word: qWord, kanji: qKanji };
// 한자 하나로 낼 수 있는 문제 (유형 순서는 seed로 섞는다)
export function kanjiQuestion(c, seed = 'k', kinds = Object.keys(Q_KINDS)) {
  if (!kanjiIndex()[c] || !KANJI[c]) return null;
  for (const k of shuffle({ rng: hashSeed(seed + c) }, [...kinds])) {
    const q = Q_KINDS[k](c, seed);
    if (q) return q;
  }
  return null;
}
// 여러 한자로 n문제 (한 한자만이면 유형별로 한 문제씩 + 다른 단어로 더)
export function kanjiSet(chars, n = 10, seed = 'set') {
  const out = [];
  if (chars.length === 1) {
    const c = chars[0];
    for (let i = 0; out.length < n && i < n * 3; i++) {
      const q = Q_KINDS[Object.keys(Q_KINDS)[i % 3]](c, seed + i);
      if (q && !out.some((x) => x.kind === q.kind && x.options.join() === q.options.join() && x.answer === q.answer)) out.push(q);
    }
    return out;
  }
  for (let i = 0; out.length < n && i < chars.length * 2; i++) {
    const q = kanjiQuestion(chars[i % chars.length], seed + i);
    if (q) out.push(q);
  }
  return out;
}
// 한자 기록 { 글자: { ok, ng, last } } 갱신
export function gradeKanji(rec, c, ok, now = Date.now()) {
  const r = rec[c] || { ok: 0, ng: 0, last: 0 };
  if (ok) r.ok++;
  else r.ng++;
  r.last = now;
  r.lastOk = ok;
  rec[c] = r;
  return rec;
}
// 틀린 한자 (틀린 횟수가 많고 마지막에 틀린 것 먼저)
export const weakKanji = (rec) => Object.entries(rec || {}).filter(([c, r]) => r.ng && KANJI[c]).sort((a, b) => (a[1].lastOk ? 1 : 0) - (b[1].lastOk ? 1 : 0) || (b[1].ng - b[1].ok) - (a[1].ng - a[1].ok) || b[1].last - a[1].last).map(([c]) => c);
// 만난 단어 수가 많은 한자: metIds = ['v:단어', ...]
export function seenKanji(metIds) {
  const cnt = {};
  for (const id of metIds) if (id[0] === 'v') for (const c of kanjiOf(id.slice(2))) if (kanjiIndex()[c]) cnt[c] = (cnt[c] || 0) + 1;
  return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
}
