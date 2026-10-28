// 퀴즈 해설 화면 조각: 고른 답(틀렸을 때) → 정답 → 나머지 선택지(한 줄씩) → 「자세히」(접속·차이·주의·예문, 접혀 있음) → 문제 번역
import { h } from './render.js';

const JA = /[ぁ-んァ-ン一-龯]/;
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 해설이 선택지 글자로 시작하면(「にわたって는 …」) 그 부분은 화면이 이미 보여 주므로 뺀다
function trimHead(text, opt) {
  let t = String(text || '').replace(/^정답[.。]\s*/, '').replace(/^정답\s*\(([^)]*)\)[.。]?\s*/, '$1. ').trim();
  const bare = String(opt).replace(/^～/, '').replace(/^\d+\.\s*/, '');
  if (bare) t = t.replace(new RegExp(`^「?～?${esc(bare)}」?\\s*(는|은|이|가|를|을|의)?\\s+`), '');
  return t;
}

// q: { options, answer, why?, more?, explain?, ko? } · pick: 고른 선택지 번호 · numbered: 「1. 」 붙이기
export function explainView(q, pick, { numbered = false, ko = true } = {}) {
  const why = q.options.map((o, i) => trimHead((q.why || [])[i], o));
  const label = (i) => h('b', { lang: JA.test(q.options[i]) ? 'ja' : null }, (numbered ? `${i + 1}. ` : '') + q.options[i]);
  const box = (cls, tag, i, text) => h('div', { class: 'ex-box ' + cls }, h('div', { class: 'ex-head' }, h('span', { class: 'ex-tag' }, tag), label(i)), text ? h('p', null, text) : null);
  const out = [];
  if (pick != null && pick !== q.answer) out.push(box('ex-pick', '고른 답', pick, why[pick]));
  // 정답 칸에서는 「다른 선택지는 맞지 않는다」 문장을 뺀다 (아래 목록이 선택지마다 따로 설명한다)
  let ansText = why[q.answer] || trimHead(q.explain, q.options[q.answer]);
  if (why.filter(Boolean).length >= 3) {
    const kept = ansText.split(/(?<=[.。])\s+/).filter((x) => !/(맞지 않|어울리지 않|성립하지 않)/.test(x));
    if (kept.length) ansText = kept.join(' ');
  }
  out.push(box('ex-ans', '정답', q.answer, ansText));
  const others = q.options.map((_, i) => i).filter((i) => i !== q.answer && i !== pick && why[i]);
  if (others.length) out.push(h('ul', { class: 'ex-others' }, others.map((i) => h('li', null, label(i), h('span', null, why[i])))));
  if (q.more && q.more.length) out.push(h('details', { class: 'ex-more' }, h('summary', null, '자세히'), q.more.map((m) => h('p', null, m))));
  if (ko && q.ko) out.push(h('p', { class: 'ex-ko' }, q.ko));
  return out;
}
