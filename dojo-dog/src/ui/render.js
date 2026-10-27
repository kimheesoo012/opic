// DOM 도우미와 일본어/한국어 텍스트 렌더링
import LINES from '../gen/lines.json';
import { VOCAB } from '../data/vocab.js';
import { lookup, rubyName, isHardKanji, splitJa, splitKo, resolveKo } from '../engine/text.js';

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

function rubyNode(base, reading, mode) {
  const show = mode === 'always' || (mode === 'hard' && isHardKanji(base));
  if (!show || !reading) return document.createTextNode(base);
  return h('ruby', null, base, h('rt', null, reading));
}

function items(list, mode) {
  const out = [];
  for (const it of list) {
    if (typeof it === 'string') out.push(document.createTextNode(it));
    else if (Array.isArray(it)) out.push(rubyNode(it[0], it[1], mode));
  }
  return out;
}

function nameNodes(str, mode) {
  return rubyName(str).map((x) => (typeof x === 'string' ? document.createTextNode(x) : rubyNode(x[0], x[1], mode)));
}

// 생성된 조각이 없을 때를 위한 대체 (자리표시자·단어 표시만 처리)
function fallbackSegs(tpl) {
  return splitJa(tpl).map((s) => (s.k === 't' ? s.v : s.k === 'p' ? { p: s.key, q: s.prop || '' } : VOCAB[s.key] ? { v: s.key, s: [s.v] } : s.v));
}

// ctx: { s, speaker, mode, onWord(key, surfaceText), saved:Set }
export function renderJa(tpl, ctx) {
  const segs = LINES.lines[tpl] || LINES.ex[tpl] || fallbackSegs(tpl);
  const span = h('span', { class: 'ja-text', lang: 'ja' });
  for (const sg of segs) {
    if (typeof sg === 'string' || Array.isArray(sg)) span.append(...items([sg], ctx.mode));
    else if (sg.p) span.append(...nameNodes(lookup(sg.p, sg.q || undefined, ctx, 'ja'), ctx.mode));
    else if (sg.v) {
      const b = h('button', { class: 'w' + (ctx.saved && ctx.saved.has(sg.v) ? ' saved' : ''), type: 'button', 'data-k': sg.v }, items(sg.s, ctx.mode));
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

export function renderSpeaker(sp, s, mode) {
  if (sp.startsWith('@')) {
    const segs = LINES.speakers[sp.slice(1)];
    return segs ? h('span', { lang: 'ja' }, items(segs, mode)) : sp.slice(1);
  }
  if (sp === 'dog') return s.dog.name;
  return h('span', { lang: 'ja' }, nameNodes(lookup(sp, undefined, { s }, 'ja'), mode));
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
    if (v.note && ctx.seenTerms && !ctx.seenTerms.has(seg.key)) {
      ctx.seenTerms.add(seg.key);
      ctx.newTerms && ctx.newTerms.push(seg.key);
      frag.append(h('span', { class: 'term-note' }, `(${v.note})`));
    }
  }
  return frag;
}

function rubyForWord(surface, reading, mode) {
  const segs = LINES.ex[surface] ? null : null;
  void segs;
  const show = mode === 'always' || (mode === 'hard' && isHardKanji(surface));
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
