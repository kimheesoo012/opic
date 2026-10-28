// DOM 도우미와 일본어/한국어 텍스트 렌더링
import LINES from '../gen/lines.json';
import { VOCAB } from '../data/vocab.js';
import { GRAMMAR } from '../data/grammar.js';
import { lookup, rubyName, isHardKanji, kanjiLevel, splitJa, splitKo, resolveKo, NAME_PLAIN, nameExplained } from '../engine/text.js';
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
//  3) 고유명사: 점선, 처음 나올 때만 읽기를 달고 그 뒤로는 후리가나 설정을 따른다. → nameUnit
//     자리표시자 값 하나(しらかば町こども剣友会)는 점선 하나. 탭하면 읽기와 누구(무엇)인지 풀이 창.
//     1인칭(私·俺·僕)·숫자·개 이름에는 점선을 긋지 않는다 (NAME_PLAIN).
// it: [표기, 읽기, 수준 코드, N3 밖 한자 여부]. 옛 조각(수준 없음)은 한자 난이도로 판단한다.
const modeOf = (ctx) => (typeof ctx === 'string' ? ctx : ctx && ctx.mode);

// 이 조각에 후리가나를 다는가. 화면(rubyNode)과 「이 장면에서 읽기를 이미 보여 줬나」(확인 문제)가 같은 판단을 쓴다.
// 고유명사(P)는 처음 나올 때만 달리므로 여기서는 다루지 않는다 (nameUnit).
export function rubyShows(it, mode) {
  const [base, reading, code, hk] = it;
  if (!reading || code === 'P') return false;
  return code ? showRuby(mode, code, { hardKanji: !!hk }) : showRuby(mode, isHardKanji(base) ? '2' : '4', { hardKanji: isHardKanji(base) });
}

// 루비 요소. 읽기가 표기보다 길 때 낱말이 벌어지지 않도록 rt가 양옆으로 조금 걸칠 수 있게 한다 (styles.css ruby.rb)
const rubyEl = (base, reading) => h('ruby', { class: 'rb' }, base, h('rt', null, reading));

function rubyNode(it, ctx) {
  const mode = modeOf(ctx);
  const [base, reading, code] = it;
  if (code === 'P' && reading) {
    // 형태소 분석기가 고유명사로 잘못 본 말(日用品의 「日」 등): 눌러도 풀이가 없으니 점선 없이 보통 글자처럼
    const s = ctx && typeof ctx === 'object' ? ctx.s : null;
    if (nameExplained(s, base)) return nameUnit(base, ctx, { reading });
    const lv = String(kanjiLevel(base));
    return rubyShows([base, reading, lv, isHardKanji(base) ? 1 : 0], mode) ? rubyEl(base, reading) : document.createTextNode(base);
  }
  if (!rubyShows(it, mode)) return document.createTextNode(base);
  return rubyEl(base, reading);
}

// 고유명사 바로 뒤의 호칭(鷲尾|先生)은 이름 하나로: 점선·탭이 「鷲尾先生」 한 덩어리
const HONORIFIC = new Set(['先生', 'さん', 'ちゃん', 'くん', '様']);
function joinHonorific(list) {
  const out = [];
  for (const it of list) {
    const prev = out[out.length - 1];
    if (Array.isArray(it) && Array.isArray(prev) && prev[2] === 'P' && prev[1] && HONORIFIC.has(it[0])) out[out.length - 1] = [prev[0] + it[0], prev[1] + (it[1] || it[0]), 'P', prev[3]];
    else out.push(it);
  }
  return out;
}

// 형태소 분석기가 한 낱말을 여러 조각으로 나눈 경우(観客|席, 試合|場, 誕生|日): 이어진 한자 조각에 둘 다 루비를 달 때는
// 루비 하나로 합친다. 따로 달면 긴 읽기가 표기를 밀어내 「観客 席」처럼 낱말이 갈라져 보인다.
const KANJI_ONLY = /^[一-鿿々〆ヶ]+$/;
export function mergeRuby(list, mode) {
  const out = [];
  for (const it of list) {
    const prev = out[out.length - 1];
    const join = Array.isArray(it) && KANJI_ONLY.test(it[0]) && rubyShows(it, mode);
    if (join && prev && prev.merge) {
      prev.base += it[0];
      prev.reading += it[1];
    } else if (join) out.push({ merge: true, base: it[0], reading: it[1] });
    else out.push(it);
  }
  return out;
}

function items(list, ctx) {
  const out = [];
  for (const it of mergeRuby(joinHonorific(list), modeOf(ctx))) {
    if (typeof it === 'string') out.push(document.createTextNode(it));
    else if (Array.isArray(it)) out.push(rubyNode(it, ctx));
    else if (it && it.merge) out.push(rubyEl(it.base, it.reading));
  }
  return out;
}

// 학습 대상(단어·문법) 조각에 후리가나가 하나라도 달렸는가 (확인 문제에서 방금 본 읽기를 묻지 않기 위해)
export const segRubyShown = (sg, mode) => !!sg && Array.isArray(sg.s) && sg.s.some((x) => Array.isArray(x) && rubyShows(x, mode));

// 점선 이름을 눌렀을 때: ctx.onName이 없으면 앱이 정한 기본 동작(풀이 창). 둘 다 없으면 눌러도 아무 일이 없으므로 글은 바깥(문장 번역)으로 넘긴다.
let nameHandler = null;
export function setNameHandler(f) {
  nameHandler = f;
}

// 고유명사 하나 = 점선 하나. 안의 한자 조각에만 루비 (처음 나올 때 또는 설정). meta: { key, prop, reading }
export function nameUnit(value, ctx, meta = {}) {
  const obj = ctx && typeof ctx === 'object' ? ctx : null;
  const mode = modeOf(ctx);
  const seen = obj ? obj.seenNames : null;
  const first = !!seen && !seen.has(value);
  if (seen) seen.add(value);
  const ruby = showRuby(mode, 'P', { first });
  const pieces = meta.reading ? [[value, meta.reading]] : joinNames(rubyName(value));
  const reading = pieces.map((x) => (typeof x === 'string' ? x : x[1])).join('');
  // 단추 안의 글(선택지 등): 이름을 눌러도 그 단추가 눌려야 하므로 점선·탭 없이 읽기만
  if (obj && obj.plainNames) return h('span', { class: 'pn-plain' }, pieces.map((x) => (typeof x === 'string' ? x : ruby ? rubyEl(x[0], x[1]) : x[0])));
  const el = h('span', { class: 'pn', role: 'button', tabindex: '0', 'data-r': reading, 'data-key': meta.key || null }, pieces.map((x) => (typeof x === 'string' ? x : ruby ? rubyEl(x[0], x[1]) : x[0])));
  const fire = (e) => {
    const f = (obj && obj.onName) || nameHandler;
    if (!f) return;
    e.stopPropagation();
    if (e.type === 'keydown') e.preventDefault();
    f({ key: meta.key || null, prop: meta.prop || null, value, reading, speaker: obj ? obj.speaker || null : null }, obj ? obj.s : null);
  };
  el.addEventListener('click', fire);
  el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && fire(e));
  return el;
}

// 점선을 긋지 않는 자리표시자 값: 1인칭은 보통 낱말처럼(수준에 따라) 루비, 개 이름은 고유명사처럼 처음에만 루비
function plainName(value, ctx, key) {
  if (key === 'Y' || !/[一-鿿]/.test(value)) return [document.createTextNode(value)];
  const mode = modeOf(ctx);
  const seen = ctx && typeof ctx === 'object' ? ctx.seenNames : null;
  const first = key === 'N' && !!seen && !seen.has(value);
  if (key === 'N' && seen) seen.add(value);
  return rubyName(value).map((x) => {
    if (typeof x === 'string') return document.createTextNode(x);
    const show = key === 'N' ? showRuby(mode, 'P', { first }) : rubyShows([x[0], x[1], String(kanjiLevel(x[0])), isHardKanji(x[0]) ? 1 : 0], mode);
    return show ? rubyEl(x[0], x[1]) : document.createTextNode(x[0]);
  });
}

// 자리표시자({okami}·{D}·{T}…)를 그린다
export function placeholderNodes(key, prop, ctx) {
  const value = lookup(key, prop || undefined, ctx, 'ja');
  if (!value || value[0] === '{') return [document.createTextNode(value || '')];
  if (NAME_PLAIN.has(key)) return plainName(value, ctx, key);
  return [nameUnit(value, ctx, { key, prop })];
}

// 이름 조각이 바로 이어지면(坂上|剣道場, 坂上|先生) 한 이름으로 합친다: 루비도 탭도 한 덩어리
export function joinNames(parts) {
  const out = [];
  for (const x of parts) {
    const prev = out[out.length - 1];
    if (Array.isArray(x) && Array.isArray(prev)) out[out.length - 1] = [prev[0] + x[0], prev[1] + x[1]];
    else out.push(x);
  }
  return out;
}

// 인명·지명 문자열 하나를 점선 이름 하나로 (처음 나올 때는 읽기를 보이고, 그 뒤로는 설정을 따른다)
export function nameNodes(str, ctx, meta = {}) {
  return [nameUnit(str, ctx, meta)];
}

// 글 덩어리(제목·대사·서술)의 첫 글자를 왼쪽 끝에 맞춘다.
//  - 첫 글자가 루비이고 읽기가 길면 표기가 가운데로 밀려 들여 쓴 것처럼 보인다 → 그 루비만 앞쪽 정렬(ruby.lead)
//  - 여는 괄호(「『（)는 글자 칸의 오른쪽 반에 그려져 들여 쓴 것처럼 보인다 → 반 칸 내어 단다(.hang)
const OPEN_PUNCT = /^[「『（【〈《〔]/;
export function markLead(el) {
  let n = el && el.firstChild;
  while (n) {
    if (n.nodeType === 3) {
      if (!n.nodeValue) {
        n = n.nextSibling;
        continue;
      }
      if (OPEN_PUNCT.test(n.nodeValue)) {
        const rest = n.nodeValue.slice(1);
        const hang = h('span', { class: 'hang' }, n.nodeValue[0]);
        n.parentNode.insertBefore(hang, n);
        if (rest) n.nodeValue = rest;
        else n.remove();
      }
      return el;
    }
    if (n.nodeType !== 1) return el;
    if (n.tagName === 'RUBY') {
      n.classList.add('lead');
      return el;
    }
    // 밑줄 단추·이름·문장 덩어리 안으로 들어간다
    n = n.firstChild;
  }
  return el;
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

// ctx: { s, speaker, mode, onWord(key), onGrammar(key), saved:Set, targets:Set('v:…'|'g:…'),
//        rubySeen:Set — 후리가나를 달아 보여 준 단어·문법 id를 모은다 (장면 뒤 확인 문제가 그 읽기를 묻지 않게) }
export function renderJa(tpl, ctx) {
  // 비어 있으면 빈 칸 (데이터 누락으로 화면이 멈추지 않게)
  const segs = ctx.segs || LINES.lines[tpl] || LINES.ex[tpl] || fallbackSegs(tpl || '');
  const span = h('span', { class: 'ja-text', lang: 'ja' });
  const isTarget = (id) => !ctx.targets || ctx.targets.has(id);
  // 이어진 일반 조각(글자·루비)은 모아서 그린다: 나뉜 한자 조각을 루비 하나로 합치기 위해
  let plain = [];
  const flush = () => {
    if (plain.length) span.append(...items(plain, ctx));
    plain = [];
  };
  for (const sg of segs) {
    if (typeof sg === 'string' || Array.isArray(sg)) {
      plain.push(sg);
      continue;
    }
    flush();
    if (!sg) continue;
    if (ctx.rubySeen && (sg.v || (sg.g && ctx.blankG !== sg.g)) && segRubyShown(sg, ctx.mode)) ctx.rubySeen.add(sg.v ? 'v:' + sg.v : 'g:' + sg.g);
    if (sg.p) span.append(...placeholderNodes(sg.p, sg.q, ctx));
    else if (sg.g) {
      // 문장 빈칸 문제: 이 문법 자리를 비운다
      if (ctx.blankG === sg.g) {
        span.append(h('span', { class: 'q-blank', 'aria-label': '빈칸' }, '（　　）'));
        continue;
      }
      if (!isTarget('g:' + sg.g)) {
        span.append(...items(sg.s, ctx));
        continue;
      }
      const b = h('button', { class: 'gm', type: 'button', 'data-g': sg.g }, items(sg.s, ctx));
      // 해설 창을 열 곳이 없으면(뜻 창 속 예문 등) 탭을 문장 쪽(번역 열기)으로 넘긴다
      b.addEventListener('click', (e) => {
        if (!ctx.onGrammar) return;
        e.stopPropagation();
        ctx.onGrammar(sg.g);
      });
      span.append(b);
    } else if (sg.v && !isTarget('v:' + sg.v)) {
      span.append(...items(sg.s, ctx));
    } else if (sg.v) {
      const b = h('button', { class: 'w' + (ctx.saved && ctx.saved.has(sg.v) ? ' saved' : ''), type: 'button', 'data-k': sg.v }, items(sg.s, ctx));
      b.addEventListener('click', (e) => {
        if (!ctx.onWord) return;
        e.stopPropagation();
        ctx.onWord(sg.v);
      });
      span.append(b);
      ctx.seenWords && ctx.seenWords.add(sg.v);
    }
  }
  flush();
  tightRuby(span);
  return span;
}

// 밑줄 단추·이름 경계 때문에 합치지 못한 루비가 바로 붙어 있으면, 마주 보는 쪽은 rt를 걸치지 않는다 (읽기끼리 겹치지 않게)
function tightRuby(root) {
  let prev = null;
  const walk = (el) => {
    for (const n of el.childNodes) {
      if (n.nodeType === 3) {
        if (n.nodeValue) prev = null;
      } else if (n.nodeType === 1 && n.tagName === 'RUBY') {
        if (prev) {
          prev.classList.add('ne');
          n.classList.add('ns');
        }
        prev = n;
      } else if (n.nodeType === 1) walk(n);
    }
  };
  walk(root);
}

export function renderExample(word, mode) {
  // 예문 조각은 빌드 때 표제어를 키로 만들어 둔다 (src/gen/lines.json ex)
  return renderJa(VOCAB[word].ex, { s: null, mode, segs: LINES.ex[word] || null });
}

export function renderSpeaker(sp, s, mode, ctx = null) {
  if (sp.startsWith('@')) {
    const segs = LINES.speakers[sp.slice(1)];
    return segs ? h('span', { lang: 'ja' }, items(segs, ctx ? { ...ctx, mode } : mode)) : sp.slice(1);
  }
  if (sp === 'dog') return s.dog.name;
  const value = lookup(sp, undefined, { s }, 'ja');
  return h('span', { lang: 'ja' }, value[0] === '{' ? value : nameUnit(value, ctx ? { ...ctx, mode, s: ctx.s || s } : { mode, s }, { key: sp }));
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
    const label = ctx.mode === 'off' ? seg.v : rubyForWord(seg.v, v.r, ctx.mode);
    if (ctx.rubySeen && typeof label !== 'string') ctx.rubySeen.add('v:' + seg.key);
    const b = h('button', { class: 'w term', type: 'button', lang: 'ja' }, label);
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
  return rubyEl(surface, reading);
}

export { resolveKo };
export function plainSegs(tpl, ctx) {
  const segs = LINES.lines[tpl] || fallbackSegs(tpl);
  return segs
    .map((sg) => (typeof sg === 'string' ? sg : Array.isArray(sg) ? sg[0] : sg.p ? lookup(sg.p, sg.q || undefined, ctx, 'ja') : sg.s.map((x) => (Array.isArray(x) ? x[0] : x)).join('')))
    .join('');
}

// 갈래 이름을 줄바꿈할 수 있는 덩어리로: 한국어는 띄어쓰기, 일본어는 「の」「から来た」「・」 뒤
export function catChunks(text) {
  return /[가-힣]/.test(text) ? text.split(' ').filter(Boolean) : text.split(/(?<=の|から来た|・)/).filter(Boolean);
}

// 문장(span)들 가운데 (x, y)에서 가장 가까운 것 (줄 위·아래 거리를 먼저, 같은 줄이면 옆 거리)
export function nearestSpan(spans, x, y) {
  let best = null;
  let bd = Infinity;
  for (const sp of spans) {
    for (const r of sp.getClientRects()) {
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      const d = dy * 4 + dx;
      if (d < bd) {
        bd = d;
        best = sp;
      }
    }
  }
  return best;
}
