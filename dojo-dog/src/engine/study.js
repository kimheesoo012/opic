// 학습 기록과 복습(간격 반복). UI 없이 동작한다.
// 항목 id: 'v:단어' 또는 'g:문법키'. 기록: { met, box, due, streak, ok, ng, last }
// 간격: 1·3·7·14일. 두 번 연속 맞히면 「익힘」.
import { VOCAB } from '../data/vocab.js';
import { GRAMMAR } from '../data/grammar.js';
import { hashSeed, rand, shuffle } from './rng.js';

export const DAY = 24 * 3600 * 1000;
export const SRS_DAYS = [1, 3, 7, 14];
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

export function grade(srs, id, ok, now = Date.now()) {
  const r = srs[id] || { met: now, box: 0, due: now, streak: 0, ok: 0, ng: 0, last: 0 };
  if (ok) {
    r.ok++;
    r.streak++;
    r.due = now + SRS_DAYS[Math.min(r.box, SRS_DAYS.length - 1)] * DAY;
    r.box = Math.min(r.box + 1, SRS_DAYS.length);
  } else {
    r.ng++;
    r.streak = 0;
    r.box = 0;
    r.due = now + DAY;
  }
  r.last = now;
  srs[id] = r;
  return r;
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
export function questionKinds(id) {
  if (id[0] === 'g') return ['grammar'];
  const key = id.slice(2);
  return KANJI.test(key) && HIRA.test(VOCAB[key].r) ? ['reading', 'meaning'] : ['meaning'];
}

// 한 항목의 문제. rec가 있으면 맞힌·틀린 횟수에 따라 유형을 번갈아 낸다.
export function makeQuestion(id, seed = 'q', rec = null) {
  const it = itemOf(id);
  if (!it) return null;
  const h = { rng: hashSeed(seed + id) };
  const kinds = questionKinds(id);
  const kind = kinds[((rec ? rec.ok + rec.ng : 0) + Math.floor(rand(h) * 2)) % kinds.length];
  if (kind === 'grammar') {
    const [stem, ans, wrong, explain] = it.q;
    const options = shuffle(h, [ans, ...wrong]);
    return { id, kind, prompt: stem, options, answer: options.indexOf(ans), explain, label: it.f, sub: it.m };
  }
  const key = it.key;
  if (kind === 'reading') {
    let traps = shuffle(h, readingTraps(it.r));
    // 함정이 모자라면 길이가 비슷한 다른 단어의 읽기로 채운다
    if (traps.length < 3) {
      const others = shuffle(h, Object.entries(VOCAB).filter(([k, v]) => k !== key && HIRA.test(v.r) && Math.abs(v.r.length - it.r.length) <= 1 && v.r !== it.r).map(([, v]) => v.r));
      traps = [...traps, ...others];
    }
    const wrong = [...new Set(traps)].filter((x) => x !== it.r).slice(0, 3);
    const options = shuffle(h, [it.r, ...wrong]);
    return { id, kind, prompt: key, options, answer: options.indexOf(it.r), explain: `「${key}」은 「${it.r}」. 뜻: ${it.m}. 장음(う)·탁음·촉음(っ)·요음(ゃゅょ)이 하나만 달라도 다른 말이 된다.`, label: key, sub: it.r };
  }
  // 같은 품사·비슷한 길이를 먼저 고른다 (품사가 드물면 다른 품사도)
  const pool = Object.entries(VOCAB)
    .filter(([k, v]) => k !== key && !v.k && v.m !== it.m && !meaningClash(v.m, it.m))
    .map(([k, v]) => ({ k, m: v.m, s: -Math.abs(v.m.length - it.m.length) + rand(h) * 4 + (v.lv === it.lv ? 2 : 0) + (v.pos === it.pos ? 20 : 0) }))
    .sort((a, b) => b.s - a.s);
  const wrong = [];
  for (const c of pool) {
    if (wrong.length >= 3) break;
    if (wrong.some((w) => meaningClash(w.m, c.m))) continue;
    wrong.push(c);
  }
  const options = shuffle(h, [it.m, ...wrong.map((w) => w.m)]);
  const wrongNote = wrong.map((w) => `${w.m} = ${w.k}`).join(' · ');
  return { id, kind, prompt: key, options, answer: options.indexOf(it.m), explain: `「${key}（${it.r}）」 = ${it.m}. 오답: ${wrongNote}.`, label: key, sub: it.r };
}

export function makeSet(ids, n = 10, seed = 'set', srs = {}) {
  const h = { rng: hashSeed(seed) };
  return shuffle(h, [...new Set(ids)].filter((id) => itemOf(id))).slice(0, n).map((id, i) => makeQuestion(id, seed + i, srs[id]));
}
