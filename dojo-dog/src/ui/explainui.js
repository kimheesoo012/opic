// 퀴즈 해설 화면 조각: 고른 답(틀렸을 때) → 정답(설명·예문·문장 뜻) → 나머지 선택지(한 줄씩) → 「자세히」(접속·차이·주의, 접혀 있음)
import { h } from './render.js';

const JA = /[ぁ-んァ-ン一-龯]/;
// 설명 속 일본어 덩어리(읽기 괄호 포함)를 따로 묶어 글꼴로 구분한다: 「捕는 ほ예요」 → 捕·ほ가 일본어 글꼴
const JA_RUN = /[ぁ-ゖァ-ヺー一-龯々〆〇]+(?:[（(][ぁ-ゖァ-ヺー]+[）)])?/g;
export function richKo(text) {
  const t = String(text || '').replace(/「([^」]*)」/g, '$1');
  const out = [];
  let last = 0;
  for (const m of t.matchAll(JA_RUN)) {
    if (m.index > last) out.push(t.slice(last, m.index));
    out.push(h('span', { class: 'jw', lang: 'ja' }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < t.length) out.push(t.slice(last));
  return out;
}

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 머리말(「정답.」「오답.」「○○ 함정.」)과, 선택지 글자를 그대로 되풀이한 첫머리를 뺀다
function trimHead(text, opt) {
  let t = String(text || '').replace(/^(정답|오답)[.。]\s*/, '').replace(/^정답\s*\(([^)]*)\)[.。]?\s*/, '$1. ').replace(/^[^.。]{0,12}함정[.。]\s*/, '').trim();
  const bare = String(opt).replace(/^～/, '').replace(/^\d+\.\s*/, '');
  if (bare) t = t.replace(new RegExp(`^「?～?${esc(bare)}」?\\s*(는|은|이|가|를|을|의)?\\s+`), '');
  return t;
}

// q: { options, answer, why?, ex?: [ja, ko], more?, explain?, ko? } · pick: 고른 선택지 번호 · numbered: 「1. 」 붙이기
export function explainView(q, pick, { numbered = false, ko = true } = {}) {
  const why = q.options.map((o, i) => trimHead((q.why || [])[i], o));
  const label = (i) => h('b', { class: 'ex-opt', lang: JA.test(q.options[i]) ? 'ja' : null }, (numbered ? `${i + 1}. ` : '') + q.options[i]);
  const box = (cls, tag, i, text, extra = []) => h('div', { class: 'ex-box ' + cls }, h('div', { class: 'ex-head' }, h('span', { class: 'ex-tag' }, tag), label(i)), text ? h('p', null, richKo(text)) : null, ...extra);
  const out = [];
  if (pick != null && pick !== q.answer) out.push(box('ex-pick', '고른 답', pick, why[pick]));
  // 정답 칸: 설명 + 예문 + 이 문제 문장의 뜻. 다른 선택지 이야기(「…는 맞지 않는다」)는 아래 목록과 겹치므로 뺀다
  let ansText = why[q.answer] || trimHead(q.explain, q.options[q.answer]);
  if (why.filter(Boolean).length >= 3) {
    const kept = ansText.split(/(?<=[.。요])\s+/).filter((x) => !/(맞지 않|어울리지 않|성립하지 않)/.test(x));
    if (kept.length) ansText = kept.join(' ');
  }
  const extra = [];
  if (q.ex && q.ex[0]) extra.push(h('div', { class: 'ex-ex' }, h('span', { lang: 'ja' }, q.ex[0]), q.ex[1] ? h('span', { class: 'ex-ex-ko' }, q.ex[1]) : null));
  if (ko && q.ko) extra.push(h('p', { class: 'ex-ko' }, h('span', { class: 'ex-ko-tag' }, '문장 뜻'), q.ko));
  out.push(box('ex-ans', '정답', q.answer, ansText, extra));
  const others = q.options.map((_, i) => i).filter((i) => i !== q.answer && i !== pick && why[i]);
  if (others.length) out.push(h('ul', { class: 'ex-others' }, others.map((i) => h('li', null, label(i), h('span', null, richKo(why[i]))))));
  if (q.more && q.more.length) out.push(h('details', { class: 'ex-more' }, h('summary', null, '자세히'), q.more.map((m) => h('p', null, richKo(m)))));
  return out;
}
