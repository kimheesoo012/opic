// 퀴즈 해설 화면 조각: 고른 답(틀렸을 때) → 정답 → 나머지 선택지 → 덧붙임(품사·접속·예문) → 문제 번역
import { h } from './render.js';

const JA = /[ぁ-んァ-ン一-龯]/;
// q: { options, answer, why?, more?, explain?, ko? } · pick: 고른 선택지 번호 · numbered: 「1. 」 붙이기
export function explainView(q, pick, { numbered = false, ko = true } = {}) {
  // 「정답」 표시는 칸 제목이 하므로 해설 앞의 「정답.」은 뺀다
  const why = (q.why || []).map((w) => String(w || '').replace(/^정답\.\s*/, ''));
  const label = (i) => {
    const t = (numbered ? `${i + 1}. ` : '') + q.options[i];
    return h('b', { lang: JA.test(q.options[i]) ? 'ja' : null }, t);
  };
  const out = [];
  if (pick != null && pick !== q.answer) {
    out.push(h('div', { class: 'ex-box ex-pick' }, h('span', { class: 'ex-tag ng' }, '고른 답'), label(pick), why[pick] ? h('p', null, why[pick]) : null));
  }
  const ansWhy = why[q.answer] || (q.explain || '').replace(/^정답\.\s*/, '');
  out.push(h('div', { class: 'ex-box ex-ans' }, h('span', { class: 'ex-tag ok' }, '정답'), label(q.answer), ansWhy ? h('p', null, ansWhy) : null));
  const others = q.options.map((_, i) => i).filter((i) => i !== q.answer && i !== pick && why[i]);
  if (others.length) out.push(h('ul', { class: 'why ex-others' }, others.map((i) => h('li', null, label(i), ` — ${why[i]}`))));
  if (q.more && q.more.length) out.push(h('div', { class: 'ex-more' }, q.more.map((m) => h('p', null, m))));
  if (ko && q.ko) out.push(h('p', { class: 'note' }, q.ko));
  return out;
}
