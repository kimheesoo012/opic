/* 수업 표현 노트 4지선다 복습 퀴즈
   정답이 티 나지 않도록:
   - 오답은 정답과 비슷한 길이·형태로 만든다 (정답을 살짝 틀리게 바꾼 문장 2개 + 다른 노트/보충 표현 1개)
   - 모든 보기의 대소문자·끝 문장부호를 똑같이 맞춘다
   - 문제에 보여 주는 '원래 말한 표현'과 똑같은 보기는 넣지 않는다 */
(function (root) {
  'use strict';
  const util = root.OPIC && root.OPIC.util || (typeof require !== 'undefined' ? require('./util.js') : null);

  function canon(s) {
    s = String(s || '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
  function key(s) { return canon(s).toLowerCase().replace(/[^a-z' ]/g, ''); }

  const PREPS = ['in', 'on', 'at', 'to', 'for', 'with', 'about', 'of', 'from', 'by'];
  /* 학습자가 자주 틀리는 짝 (시제만 바뀌어 맞는 문장이 되는 변형은 정답이 둘이 되므로 넣지 않는다) */
  const SWAPS = [
    [/\bmuch\b/i, 'many'], [/\bmany\b/i, 'much'], [/\bfew\b/i, 'little'], [/\bsince\b/i, 'for'],
    [/\bused to\b/i, 'use to'], [/\bended up\b/i, 'ended up to'], [/\blooking forward to\b/i, 'looking forward'],
    [/\bget used to\b/i, 'used to'], [/\bmake\b/i, 'do'], [/\bsay\b/i, 'tell'], [/\btell\b/i, 'say'],
    [/\bborrow\b/i, 'lend'], [/\blend\b/i, 'borrow'], [/\bfun\b/i, 'funny'], [/\binteresting\b/i, 'interested'],
    [/\binterested\b/i, 'interesting'], [/\bbored\b/i, 'boring'], [/\bexcited\b/i, 'exciting'], [/\bvery\b/i, 'very much']
  ];

  /* 정답 문장을 그럴듯하게 틀리게 바꾼 후보들 */
  function mutations(text, rng) {
    const base = canon(text);
    const out = new Set();
    const wordsArr = base.split(' ');
    /* 전치사 바꾸기 */
    wordsArr.forEach((w, i) => {
      const lw = w.toLowerCase();
      if (PREPS.includes(lw)) {
        const alt = util.shuffle(PREPS.filter(p => p !== lw), rng).slice(0, 2);
        alt.forEach(a => { const c = wordsArr.slice(); c[i] = a; out.add(c.join(' ')); });
      }
    });
    SWAPS.forEach(([re, rep]) => { if (re.test(base)) out.add(base.replace(re, rep)); });
    /* 관사 빼기 */
    if (/\b(a|an|the) /i.test(base)) out.add(base.replace(/\b(a|an|the) /i, ''));
    /* 이웃한 두 단어 순서 바꾸기, 수 일치 틀리게 하기 */
    for (let i = 1; i < wordsArr.length - 1; i++) {
      const c = wordsArr.slice(); [c[i], c[i + 1]] = [c[i + 1], c[i]]; out.add(c.join(' '));
    }
    wordsArr.forEach((w, i) => {
      const lw = w.toLowerCase().replace(/[^a-z]/g, '');
      if (i === 0 || lw.length < 3 || PREPS.includes(lw) || /(ed|ing|ly|s)$/.test(lw) || /^(the|and|but|very|really|it's|this|that|there|here)$/.test(lw)) return;
      const c = wordsArr.slice(); c[i] = lw + (/(sh|ch|x)$/.test(lw) ? 'es' : 's'); out.add(c.join(' '));
    });
    return util.shuffle(Array.from(out).map(canon).filter(s => s && key(s) !== key(base)), rng);
  }

  /* notes: [{id, original, corrected, memo}] → [{noteId, prompt, memo, options:[...], answer}] */
  function buildQuiz(notes, pool, count, rng) {
    rng = rng || Math.random;
    const usable = notes.filter(n => n.corrected && n.corrected.trim());
    const picked = util.shuffle(usable, rng).slice(0, count || 10);
    return picked.map(n => {
      const answer = canon(n.corrected);
      const used = new Set([key(answer), key(n.original)]);
      const opts = [answer];
      const add = s => { const c = canon(s); const k = key(c); if (c && !used.has(k)) { used.add(k); opts.push(c); return true; } return false; };
      const muts = mutations(n.corrected, rng);
      for (const m of muts) { if (opts.length >= 3) break; add(m); }
      const len = answer.length;
      const others = usable.filter(o => o.id !== n.id).map(o => o.corrected)
        .concat(pool || [])
        .sort((a, b) => Math.abs(a.length - len) - Math.abs(b.length - len));
      /* 길이가 비슷한 후보 중 하나를 무작위로 (항상 같은 오답이 나오지 않게) */
      const near = util.shuffle(others.slice(0, 6), rng);
      for (const o of near.concat(others)) { if (opts.length >= 4) break; add(o); }
      return { noteId: n.id, prompt: n.original, memo: n.memo || '', options: util.shuffle(opts, rng), answer };
    });
  }

  const api = { buildQuiz, mutations, canon };
  root.OPIC = root.OPIC || {};
  root.OPIC.quiz = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
