/* 녹음 분석 — 서버 없이 가능한 범위
   1) 오디오 에너지(녹음 중 측정): 답변 길이, 무음 구간, 말한 시간 비율, 첫 발화까지 걸린 시간
   2) 받아쓴 글이 있을 때 규칙 기반 분석: 단어 수, 분당 단어 수, 군말, 반복, 연결어, 과거 시제·시간 표현
   점수나 등급 추정은 하지 않는다. */
(function (root) {
  'use strict';

  /* ---------- 오디오 에너지 ---------- */
  /* env: 0~255 정수 배열(초당 fps개), 반환 값은 초 단위 */
  function analyzeEnvelope(env, fps, opts) {
    fps = fps || 10;
    const o = Object.assign({ minPause: 1.5 }, opts);
    const n = env ? env.length : 0;
    const total = n / fps;
    if (!n) return { totalSec: 0, speechSec: 0, silenceSec: 0, speechRatio: 0, pauses: [], longPauses: 0, longestPause: 0, firstSpeechSec: null, threshold: 0 };
    const sorted = Array.from(env).sort((a, b) => a - b);
    const floor = sorted[Math.floor(n * 0.15)];
    const peak = sorted[Math.floor(n * 0.95)];
    /* 잡음 바닥과 큰 소리 사이 25% 지점 — 조용한 방·시끄러운 곳 모두에서 쓸 수 있게 상대값으로 */
    const threshold = Math.max(6, floor + (peak - floor) * 0.25);
    const voiced = Array.from(env, v => v >= threshold);
    /* 200ms 미만의 짧은 끊김은 말하는 중으로 본다 */
    const bridge = Math.max(1, Math.round(fps * 0.2));
    for (let i = 0; i < n; i++) {
      if (!voiced[i]) {
        let j = i; while (j < n && !voiced[j]) j++;
        if (i > 0 && j < n && j - i <= bridge) for (let k = i; k < j; k++) voiced[k] = true;
        i = j;
      }
    }
    let speechFrames = 0, firstSpeech = null;
    const pauses = [];
    for (let i = 0; i < n; i++) {
      if (voiced[i]) { speechFrames++; if (firstSpeech === null) firstSpeech = i; continue; }
      let j = i; while (j < n && !voiced[j]) j++;
      const len = (j - i) / fps;
      /* 맨 앞(말 시작 전)과 맨 뒤(말 끝난 후)는 '중간 무음'에서 제외 */
      if (i > 0 && j < n && len >= o.minPause && firstSpeech !== null) pauses.push({ start: i / fps, len });
      i = j - 1;
    }
    const speechSec = speechFrames / fps;
    return {
      totalSec: total,
      speechSec,
      silenceSec: total - speechSec,
      speechRatio: total ? speechSec / total : 0,
      pauses,
      longPauses: pauses.filter(p => p.len >= 3).length,
      longestPause: pauses.reduce((m, p) => Math.max(m, p.len), 0),
      firstSpeechSec: firstSpeech === null ? null : firstSpeech / fps,
      threshold
    };
  }

  /* ---------- 글 분석 ---------- */
  const STOP = new Set(('a an the and or but so to of in on at for with from by about as is am are was were be been being ' +
    'i me my mine you your he him his she her it its we us our they them their this that these those there here ' +
    'do does did have has had not no yes very really just also then than too can could would will should ' +
    "it's i'm don't didn't that's there's what when where who why how which if because um uh like go went get got " +
    "some any one two lot lots kind thing things way more most much many so well really pretty okay oh yeah").split(/\s+/));

  const FILLER_PATTERNS = [
    ['um', /\b(?:um+|umm+|erm+|hmm+|mm+)\b/g],
    ['uh', /\b(?:uh+|er+|ah+)\b/g],
    ['you know', /\byou know\b(?!\s+(?:what|how|that|the|about|if|when|where|why|who))/g],
    ['I mean', /\bi mean\b/g]
  ];
  /* 'like'는 '좋아하다'와 구분하기 어려워 대표적인 군말 위치만 센다 (쉼표 앞뒤, was/is/it's 뒤, 반복) */
  const LIKE_FILLER = /(?:,\s*like\b|\blike\s*,|\b(?:was|is|it's|were|and|but|so)\s+like\s+(?!to\b|that\b|this\b|it\b|a\b|the\b)|\blike\s+like\b)/g;

  const CONNECTORS = {
    seq: { ko: '순서', list: ['first of all', 'first', 'at first', 'then', 'after that', 'afterwards', 'next', 'later', 'finally', 'eventually', 'in the end', 'before that', 'meanwhile', 'while', 'as soon as'] },
    cause: { ko: '이유·결과', list: ['because', 'since', "that's why", 'that is why', 'as a result', 'therefore', 'so that', 'so'] },
    contrast: { ko: '대조', list: ['but', 'however', 'although', 'even though', 'though', 'on the other hand', 'whereas', 'instead', 'still'] },
    add: { ko: '추가', list: ['also', 'plus', 'besides', 'in addition', 'moreover', 'not only', 'as well'] },
    example: { ko: '예시', list: ['for example', 'for instance', 'such as'] },
    wrap: { ko: '정리', list: ['anyway', 'overall', 'all in all', 'to sum up', 'basically', 'in short', 'long story short'] }
  };

  const IRREGULAR_PAST = new Set(('was were went had did saw made took got came said told thought felt found gave knew left met bought ' +
    'brought ate drank wrote ran began became kept lost paid sat spent stood understood woke won wore chose caught taught fell forgot ' +
    'heard held built sent slept drove rode flew broke spoke sang swam threw grew drew hid meant sold shot stole led lent fought ' +
    "sought swung stuck dug fed bit froze hung lay rang rose shook sank slid spun sprang stung struck tore wept wound " +
    "didn't wasn't weren't couldn't hadn't").split(/\s+/));
  /* -ed로 끝나지만 과거 동사가 아닌 흔한 단어 */
  const ED_EXCLUDE = new Set(('bed red need speed seed feed weed indeed hundred shed fed led sled breed greed proceed exceed succeed ' +
    'interested excited tired bored surprised scared worried crowded relaxed embarrassed disappointed satisfied amazed confused ' +
    'stressed married talented detailed limited advanced experienced crowded used naked wicked sacred kindred').split(/\s+/));

  const TIME_PATTERNS = [
    /\blast (?:year|week|month|summer|winter|spring|fall|autumn|weekend|night|semester|time|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g,
    /\b(?:\d+|a|one|two|three|four|five|six|seven|eight|nine|ten|a few|a couple of|several|many) (?:years?|months?|weeks?|days?|hours?) ago\b/g,
    /\ba (?:long )?while ago\b/g,
    /\bwhen i was\b/g, /\bwhen we were\b/g, /\byesterday\b/g, /\bback then\b/g, /\bat that time\b/g,
    /\bafter that\b/g, /\bin (?:19|20)\d\d\b/g, /\bused to\b/g, /\bthe other day\b/g, /\bthe first time\b/g,
    /\bthat (?:day|night|morning|evening|summer|year)\b/g, /\bin the end\b/g, /\bwhen i first\b/g, /\bonce,/g
  ];

  function normalize(text) {
    return String(text || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  }
  function words(text) {
    return (normalize(text).match(/[a-z]+(?:'[a-z]+)?/g) || []);
  }
  function countPhrase(norm, phrase) {
    const re = new RegExp('(?:^|[^a-z\'])' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+') + '(?=$|[^a-z\'])', 'g');
    return (norm.match(re) || []).length;
  }

  function analyzeTranscript(text, durationSec) {
    const norm = normalize(text);
    const w = words(text);
    const wordCount = w.length;
    const res = { wordCount, wpm: null, sentences: 0, fillers: { total: 0, items: {} }, repeats: [], stutters: 0,
      connectors: { total: 0, distinct: [], groups: {} }, past: { verbCount: 0, verbs: [], timeExpr: [] } };
    if (!wordCount) return res;
    if (durationSec && durationSec >= 5) res.wpm = Math.round(wordCount / (durationSec / 60));
    res.sentences = (String(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).filter(s => s.trim()).length;

    FILLER_PATTERNS.forEach(([k, re]) => {
      const c = (norm.match(re) || []).length;
      if (c) { res.fillers.items[k] = c; res.fillers.total += c; }
    });
    const likeC = (norm.match(LIKE_FILLER) || []).length;
    if (likeC) { res.fillers.items.like = likeC; res.fillers.total += likeC; }

    /* 같은 단어 반복 (내용어 3회 이상) + 바로 이어서 같은 단어 반복(I I, the the) */
    const freq = {};
    w.forEach(x => { if (!STOP.has(x) && x.length > 2) freq[x] = (freq[x] || 0) + 1; });
    const minRep = wordCount > 150 ? 4 : 3;
    res.repeats = Object.keys(freq).filter(k => freq[k] >= minRep).sort((a, b) => freq[b] - freq[a]).slice(0, 6).map(k => ({ word: k, count: freq[k] }));
    for (let i = 1; i < w.length; i++) if (w[i] === w[i - 1]) res.stutters++;

    /* 연결어 — 긴 표현부터 세고 그 부분을 지워서 겹쳐 세지 않게 */
    let rest = norm;
    Object.keys(CONNECTORS).forEach(g => {
      const found = [];
      CONNECTORS[g].list.slice().sort((a, b) => b.length - a.length).forEach(p => {
        const c = countPhrase(rest, p);
        if (c) {
          found.push({ phrase: p, count: c });
          res.connectors.total += c;
          const re = new RegExp('(^|[^a-z\'])' + p.replace(/ /g, '\\s+') + '(?=$|[^a-z\'])', 'g');
          rest = rest.replace(re, '$1 # ');
        }
      });
      res.connectors.groups[g] = found;
      found.forEach(f => res.connectors.distinct.push(f.phrase));
    });

    /* 과거 시제 */
    const verbs = {};
    w.forEach(x => {
      let isPast = IRREGULAR_PAST.has(x);
      if (!isPast && x.length > 4 && x.endsWith('ed') && !ED_EXCLUDE.has(x) && !x.endsWith('eed')) isPast = true;
      if (isPast) verbs[x] = (verbs[x] || 0) + 1;
    });
    res.past.verbCount = Object.values(verbs).reduce((a, b) => a + b, 0);
    res.past.verbs = Object.keys(verbs).sort((a, b) => verbs[b] - verbs[a]).slice(0, 10);
    const te = new Set();
    TIME_PATTERNS.forEach(re => { (norm.match(re) || []).forEach(m => te.add(m.replace(/,$/, '').trim())); });
    res.past.timeExpr = Array.from(te);
    return res;
  }

  /* 목표 표현이 받아쓴 글에 들어 있는지 '힌트'로만 확인 (최종 체크는 사용자가) */
  function containsExpression(transcript, expr) {
    const t = ' ' + words(transcript).join(' ') + ' ';
    const core = words(String(expr).replace(/\.\.\.|…|\(.*?\)/g, ' '));
    if (!core.length) return false;
    /* 앞부분 핵심 4단어까지가 순서대로 들어 있으면 사용한 것으로 추정 */
    const key = core.slice(0, Math.min(4, core.length)).join(' ');
    return t.includes(' ' + key + ' ');
  }

  const api = { analyzeEnvelope, analyzeTranscript, containsExpression, words, CONNECTORS };
  root.OPIC = root.OPIC || {};
  root.OPIC.analysis = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
