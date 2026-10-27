// DOM 도우미와 일본어/한국어 텍스트 렌더링
import LINES from '../gen/lines.json';
import { VOCAB } from '../data/vocab.js';
import { GRAMMAR } from '../data/grammar.js';
import { lookup, rubyName, isHardKanji, splitJa, splitKo, resolveKo } from '../engine/text.js';
import { showRuby, lvCode, pickTargets } from '../engine/learn.js';

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

// 표시 규칙은 셋으로 나눠 서로 섞지 않는다.
//  1) 후리가나: 후리가나 설정 × 그 말의 수준 코드로만 정한다 (밑줄 여부와 무관). → rubyNode
//  2) 학습 밑줄: 장면의 학습 대상(sceneTargets)인 단어·문법에만. 단어는 실선, 문법은 물결선. → renderJa
//  3) 고유명사: 점선, 처음 나올 때만 읽기를 달고 그 뒤로는 후리가나 설정을 따른다. 탭하면 읽기. → nameNode
// it: [표기, 읽기, 수준 코드, N3 밖 한자 여부]. 옛 조각(수준 없음)은 한자 난이도로 판단한다.
function rubyNode(it, ctx) {
  const mode = typeof ctx === 'string' ? ctx : ctx && ctx.mode;
  const [base, reading, code, hk] = it;
  if (code === 'P' && reading) return nameNode(base, reading, typeof ctx === 'object' ? ctx : mode);
  const show = code ? showRuby(mode, code, { hardKanji: !!hk }) : showRuby(mode, isHardKanji(base) ? '2' : '4', { hardKanji: isHardKanji(base) });
  if (!show || !reading) return document.createTextNode(base);
  return h('ruby', null, base, h('rt', null, reading));
}

function items(list, ctx) {
  const out = [];
  for (const it of list) {
    if (typeof it === 'string') out.push(document.createTextNode(it));
    else if (Array.isArray(it)) out.push(rubyNode(it, ctx));
  }
  return out;
}

function nameNode(base, reading, ctx) {
  const mode = typeof ctx === 'string' ? ctx : ctx.mode;
  const seen = typeof ctx === 'object' ? ctx.seenNames : null;
  const first = !!seen && !seen.has(base);
  if (seen) seen.add(base);
  const ruby = showRuby(mode, 'P', { first });
  const el = h('span', { class: 'pn', role: 'button', tabindex: '0', 'data-r': reading }, ruby ? h('ruby', null, base, h('rt', null, reading)) : base);
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = typeof ctx === 'object' && ctx.onName;
    if (t) t(base, reading);
  });
  return el;
}

// 인명·지명: 처음 나올 때는 읽기를 보이고, 그 뒤로는 설정을 따른다. 탭하면 읽기를 확인할 수 있다.
export function nameNodes(str, ctx) {
  return rubyName(str).map((x) => (typeof x === 'string' ? document.createTextNode(x) : nameNode(x[0], x[1], ctx)));
}

// 생성된 조각이 없을 때를 위한 대체 (자리표시자·단어 표시만 처리)
function fallbackSegs(tpl) {
  return splitJa(tpl).map((s) => (s.k === 't' ? s.v : s.k === 'p' ? { p: s.key, q: s.prop || '' } : s.k === 'g' ? { g: s.key, s: [s.v] } : VOCAB[s.key] ? { v: s.key, s: [s.v] } : s.v));
}

export { LINES };

// 한 장면의 학습 대상(보통 1~3개, 학습 집중 모드 최대 6개). 고른 학습 수준에 가까운 것부터.
export function sceneTargets(tpls, set = {}) {
  return pickTargets(tpls.map((t) => LINES.lines[t] || []), set);
}

// ctx: { s, speaker, mode, onWord(key), onGrammar(key), saved:Set, targets:Set('v:…'|'g:…') }
export function renderJa(tpl, ctx) {
  const segs = LINES.lines[tpl] || LINES.ex[tpl] || fallbackSegs(tpl);
  const span = h('span', { class: 'ja-text', lang: 'ja' });
  const isTarget = (id) => !ctx.targets || ctx.targets.has(id);
  for (const sg of segs) {
    if (typeof sg === 'string' || Array.isArray(sg)) span.append(...items([sg], ctx));
    else if (sg.p) span.append(...nameNodes(lookup(sg.p, sg.q || undefined, ctx, 'ja'), ctx));
    else if (sg.g) {
      if (!isTarget('g:' + sg.g)) {
        span.append(...items(sg.s, ctx));
        continue;
      }
      const b = h('button', { class: 'gm', type: 'button', 'data-g': sg.g }, items(sg.s, ctx));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        ctx.onGrammar && ctx.onGrammar(sg.g);
      });
      span.append(b);
    } else if (sg.v && !isTarget('v:' + sg.v)) {
      span.append(...items(sg.s, ctx));
    } else if (sg.v) {
      const b = h('button', { class: 'w' + (ctx.saved && ctx.saved.has(sg.v) ? ' saved' : ''), type: 'button', 'data-k': sg.v }, items(sg.s, ctx));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        ctx.onWord && ctx.onWord(sg.v);
      });
      span.append(b);
      ctx.seenWords && ctx.seenWords.add(sg.v);
    }
  }
  return span;
}

export function renderExample(word, mode) {
  return renderJa(VOCAB[word].ex, { s: null, mode });
}

export function renderSpeaker(sp, s, mode, ctx = null) {
  if (sp.startsWith('@')) {
    const segs = LINES.speakers[sp.slice(1)];
    return segs ? h('span', { lang: 'ja' }, items(segs, ctx ? { ...ctx, mode } : mode)) : sp.slice(1);
  }
  if (sp === 'dog') return s.dog.name;
  return h('span', { lang: 'ja' }, nameNodes(lookup(sp, undefined, { s }, 'ja'), ctx ? { ...ctx, mode } : mode));
}

// 한국어 해설: 《용어》는 일본어로 표시하고, 처음 나올 때만 짧은 설명을 붙인다.
export function renderKo(text, ctx) {
  const frag = h('span');
  for (const seg of splitKo(text)) {
    if (seg.k === 't') {
      frag.append(seg.v);
      continue;
    }
    const v = VOCAB[seg.key];
    if (!v) {
      frag.append(seg.v);
      continue;
    }
    const b = h('button', { class: 'w term', type: 'button', lang: 'ja' }, ctx.mode === 'off' ? seg.v : rubyForWord(seg.v, v.r, ctx.mode));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      ctx.onWord && ctx.onWord(seg.key);
    });
    frag.append(b);
    ctx.seenWords && ctx.seenWords.add(seg.key);
    if (ctx.seenTerms && !ctx.seenTerms.has(seg.key)) {
      ctx.seenTerms.add(seg.key);
      ctx.newTerms && ctx.newTerms.push(seg.key);
    }
  }
  return frag;
}

function rubyForWord(surface, reading, mode) {
  const v = VOCAB[surface];
  const show = showRuby(mode, lvCode(v && v.lv) || (isHardKanji(surface) ? '2' : '4'), { hardKanji: isHardKanji(surface) });
  if (!show || !/[一-鿿]/.test(surface)) return surface;
  return h('ruby', null, surface, h('rt', null, reading));
}

export { resolveKo };
export function plainSegs(tpl, ctx) {
  const segs = LINES.lines[tpl] || fallbackSegs(tpl);
  return segs
    .map((sg) => (typeof sg === 'string' ? sg : Array.isArray(sg) ? sg[0] : sg.p ? lookup(sg.p, sg.q || undefined, ctx, 'ja') : sg.s.map((x) => (Array.isArray(x) ? x[0] : x)).join('')))
    .join('');
}
