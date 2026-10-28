/* 문장 비교·빈칸 만들기
   - 말한 문장(음성 인식·입력)과 목표 문장을 단어 단위로 맞춰 보고(LCS) 빠진 말·더한 말을 표시한다
   - 빈칸 문제: 수업 원문(o)에는 없고 수정문(f)에만 있는 말을 빈칸으로, 원문에서 빠진 말을 함정 단어로 쓴다 */

export function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
}

const CONTR = [
  [/\bi'm\b/g, 'i am'], [/\bwon't\b/g, 'will not'], [/\bcan't\b/g, 'can not'], [/\bcannot\b/g, 'can not'],
  [/\bshan't\b/g, 'shall not'], [/n't\b/g, ' not'], [/'re\b/g, ' are'], [/'ve\b/g, ' have'], [/'ll\b/g, ' will'],
  [/\b(it|that|what|there|here|he|she|who|where|how|let)'s\b/g, (m, w) => w === 'let' ? 'let us' : w + ' is'],
  [/\bgonna\b/g, 'going to'], [/\bwanna\b/g, 'want to'], [/\bok\b/g, 'okay']
];
const NUM = { '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', '11': 'eleven', '12': 'twelve', '20': 'twenty', '25': 'twenty five', '30': 'thirty', '100': 'hundred' };

/* 비교용 단어 목록: 소문자, 줄임말 풀기, 문장부호 제거 */
export function words(s, { expand = true } = {}) {
  let t = stripHtml(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”]/g, '"');
  t = t.replace(/\[[^\]]*\]/g, ' ');                 // [name] 같은 자리 표시
  if (expand) for (const [re, to] of CONTR) t = t.replace(re, to);
  t = t.replace(/(\d+)\s*%/g, '$1 percent').replace(/[^a-z0-9'\s-]/g, ' ').replace(/(^|\s)['-]+|['-]+(?=\s|$)/g, ' ');
  return t.split(/[\s-]+/).filter(Boolean).flatMap(w => (expand && NUM[w]) ? NUM[w].split(' ') : [w]);
}

/* LCS 정렬 → [{t:'eq'|'del'|'ins', a?, b?}] (a: 말한 쪽, b: 목표 쪽) */
export function align(a, b) {
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: 'eq', a: a[i], b: b[j], i, j }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ t: 'del', a: a[i], i }); i++; }
    else { out.push({ t: 'ins', b: b[j], j }); j++; }
  }
  while (i < n) { out.push({ t: 'del', a: a[i], i }); i++; }
  while (j < m) { out.push({ t: 'ins', b: b[j], j }); j++; }
  return { ops: out, lcs: L[0][0] };
}

/* 0~1 유사도 (F1: 맞힌 단어 / 두 문장 평균 길이) */
export function similarity(said, target) {
  const a = words(said), b = words(target);
  if (!a.length || !b.length) return 0;
  return (2 * align(a, b).lcs) / (a.length + b.length);
}

/* 여러 정답 후보 중 가장 가까운 것 */
export function bestMatch(said, targets) {
  let best = { i: 0, score: 0 };
  targets.forEach((t, i) => { if (!t) return; const s = similarity(said, t); if (s > best.score) best = { i, score: s }; });
  return best;
}

/* 말한 문장 vs 목표 문장 비교 결과: 목표 문장 기준으로 맞은 말(eq)·빠진 말(miss), 말한 문장의 더한 말(extra) */
export function compare(said, target) {
  const a = words(said), b = words(target);
  const { ops, lcs } = align(a, b);
  return {
    ops,
    score: a.length + b.length ? (2 * lcs) / (a.length + b.length) : 0,
    missing: ops.filter(o => o.t === 'ins').map(o => o.b),
    extra: ops.filter(o => o.t === 'del').map(o => o.a)
  };
}

/* 화면 표시용 토큰: 원래 글자(raw)와 비교 키(k). 문장부호는 raw에 붙여 둔다 */
export function displayTokens(s) {
  return stripHtml(s).split(/\s+/).filter(Boolean).map(raw => ({ raw, k: raw.toLowerCase().replace(/[’‘]/g, "'").replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '') }));
}

/* 빈칸 문제 만들기 (원문 o → 수정문 f)
   반환 {parts:[{raw}|{blank:i}], blanks:[{answer, keys}], bank:[{text, keys, correct}]} 또는 null */
export function makeCloze(o, f, maxBlanks = 3) {
  if (!o || !f) return null;
  const all = displayTokens(f);
  const keyed = all.map((t, i) => i).filter(i => all[i].k);    // 비교에 쓰는 토큰의 위치 (한국어·기호만 있는 토큰 제외)
  const ft = keyed.map(i => all[i]);
  const ot = displayTokens(o).filter(t => t.k);
  if (ft.length < 3 || ot.length < 2) return null;
  const { ops } = align(ot.map(t => t.k), ft.map(t => t.k));
  // eq 사이의 바뀐 구간마다: 수정문에 새로 들어간 말(ins) → 빈칸, 원문에서 빠진 말(del) → 함정 단어
  const groups = [];
  let fi = 0, seg = null;
  const close = () => { if (seg && seg.end > seg.start) groups.push(seg); seg = null; };
  for (const op of ops) {
    if (op.t === 'eq') { close(); fi++; continue; }
    if (!seg) seg = { start: fi, end: fi, wrong: [] };
    if (op.t === 'del') seg.wrong.push(ot[op.i].raw.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, ''));
    else { seg.end = ++fi; }
  }
  close();
  const changed = groups.reduce((s, g) => s + g.end - g.start, 0);
  if (!groups.length || groups.length > maxBlanks || changed / ft.length > 0.55) return null;
  // 빈칸이 4단어를 넘으면 너무 어렵다
  if (groups.some(g => g.end - g.start > 4)) return null;
  const parts = [];
  const blanks = [];
  let gi = 0;
  for (let i = 0; i < all.length; i++) {
    const g = groups[gi];
    if (g && i === keyed[g.start]) {
      const last = keyed[g.end - 1];
      const toks = all.slice(i, last + 1);
      const lead = toks[0].raw.match(/^[^A-Za-z0-9']*/)[0];
      const trail = toks[toks.length - 1].raw.match(/[^A-Za-z0-9']*$/)[0];
      const joined = toks.map(t => t.raw).join(' ');
      const answer = joined.slice(lead.length, joined.length - trail.length);
      parts.push({ blank: blanks.length, lead, trail });
      blanks.push({ answer, keys: toks.filter(t => t.k).map(t => t.k).join(' '), wrong: g.wrong.join(' ') });
      i = last; gi++;
    } else parts.push({ raw: all[i].raw });
  }
  const bank = blanks.map(b => ({ text: b.answer, keys: b.keys, correct: true }));
  const seen = new Set(bank.map(b => b.keys));
  for (const b of blanks) {
    const k = b.wrong.toLowerCase();
    if (k && !seen.has(k)) { seen.add(k); bank.push({ text: b.wrong, keys: k, correct: false }); }
  }
  return { parts, blanks, bank };
}

/* 단어 하나 발음 확인: 인식 후보들 중 목표 말이 들어 있는지 */
export function heardWord(target, alternatives) {
  const tk = words(target, { expand: false }).join(' ');
  const variants = new Set([tk, tk.replace(/ /g, ''), tk.replace(/s$/, ''), tk + 's']);
  for (const alt of alternatives) {
    const a = ' ' + words(alt, { expand: false }).join(' ') + ' ';
    for (const v of variants) if (v && a.includes(' ' + v + ' ')) return true;
    if (a.replace(/ /g, '').includes(tk.replace(/ /g, '')) && tk.length >= 5) return true;
  }
  return false;
}

export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* 같은 문장인지(문장부호 무시) */
export function sameSentence(a, b) {
  return words(a, { expand: false }).join(' ') === words(b, { expand: false }).join(' ');
}
