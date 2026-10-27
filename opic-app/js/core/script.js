/* 스크립트 연습: 문장 나누기, 단계별 가리기, 원문과 말한 내용 비교 */
(function (root) {
  'use strict';
  const util = root.OPIC && root.OPIC.util || (typeof require !== 'undefined' ? require('./util.js') : null);

  const STOP = new Set(('a an the and or but so to of in on at for with from by about as is am are was were be been being ' +
    'i me my you your he him his she her it its we us our they them their this that these those there here do does did ' +
    'have has had not very really just also then than too can could would will should if because when what which who ' +
    "it's i'm don't didn't that's there's one some any lot kind thing things like get got go went").split(/\s+/));

  const LEVELS = [
    { n: 0, label: '1단계 · 전체 보기' },
    { n: 1, label: '2단계 · 절반 가리기' },
    { n: 2, label: '3단계 · 키워드만' },
    { n: 3, label: '4단계 · 첫 단어 + 키워드 1개' },
    { n: 4, label: '5단계 · 모두 가리기' }
  ];

  function splitSentences(text) {
    return String(text || '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || [];
  }
  function isKeyword(w) {
    const c = w.toLowerCase().replace(/[^a-z']/g, '');
    return c.length >= 4 && !STOP.has(c);
  }
  /* 한 문장의 단어들에 표시 여부를 붙인다: {w, show} */
  function maskSentence(sentence, level, seed) {
    const toks = sentence.split(/\s+/).filter(Boolean);
    const rng = util.seededRng(seed + '|' + sentence);
    if (level <= 0) return toks.map(w => ({ w, show: true }));
    if (level >= 4) return toks.map(w => ({ w, show: false }));
    if (level === 1) return toks.map((w, i) => ({ w, show: i % 2 === 0 }));
    const kwIdx = toks.map((w, i) => (isKeyword(w) ? i : -1)).filter(i => i >= 0);
    /* 긴 단어(=내용어)를 우선 키워드로 */
    const ranked = kwIdx.slice().sort((a, b) => toks[b].length - toks[a].length || rng() - 0.5);
    const keep = new Set(ranked.slice(0, level === 2 ? 3 : 1));
    if (level === 3) keep.add(0);
    return toks.map((w, i) => ({ w, show: keep.has(i) }));
  }

  /* 원문과 받아쓴 글을 단어 단위 최장 공통 부분열로 맞춰 본다 */
  function norm(w) { return w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, ''); }
  function compare(original, spoken) {
    const a = String(original || '').split(/\s+/).filter(Boolean);
    const b = String(spoken || '').split(/\s+/).map(norm).filter(Boolean);
    const an = a.map(norm);
    const n = an.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      dp[i][j] = an[i] && an[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const tokens = [];
    const extra = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (an[i] && an[i] === b[j]) { tokens.push({ w: a[i], ok: true }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { tokens.push({ w: a[i], ok: !an[i] }); i++; }
      else { extra.push(b[j]); j++; }
    }
    while (i < n) { tokens.push({ w: a[i], ok: !an[i] }); i++; }
    while (j < m) { extra.push(b[j]); j++; }
    const total = tokens.filter(t => norm(t.w)).length;
    const hit = tokens.filter(t => t.ok && norm(t.w)).length;
    return { tokens, coverage: total ? hit / total : 0, missed: tokens.filter(t => !t.ok).map(t => t.w), extra };
  }

  /* 여러 스크립트를 한꺼번에 붙여 넣을 때: '## 제목' 또는 '제목:' 줄로 나눈다 */
  function parseBulk(text) {
    const lines = String(text || '').split(/\r?\n/);
    const out = [];
    let cur = null;
    lines.forEach(l => {
      const h = l.match(/^\s*(?:#{1,3}\s+(.+)|\[(.+)\]\s*$|제목\s*[:：]\s*(.+))$/);
      if (h) { cur = { title: (h[1] || h[2] || h[3]).trim(), text: '' }; out.push(cur); return; }
      if (!cur) { cur = { title: '가져온 스크립트', text: '' }; out.push(cur); }
      cur.text += l + '\n';
    });
    return out.map(s => ({ title: s.title, text: s.text.trim() })).filter(s => s.text);
  }

  const api = { LEVELS, splitSentences, maskSentence, compare, parseBulk };
  root.OPIC = root.OPIC || {};
  root.OPIC.script = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
