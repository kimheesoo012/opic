// 퀴즈 해설 화면 조각: 고른 답(틀렸을 때) → 정답(설명·예문·문장 뜻) → 나머지 선택지(한 줄씩) → 「자세히」(접속·차이·주의, 접혀 있음)
import { h } from './render.js';
import { vocabRows, errorCause, filledSentence, CAUSES } from '../engine/explain.js';

// 해설의 한자 칩을 탭하면 그 한자 풀이를 연다 (kanjiui가 등록한다)
let onKanji = null;
export const setKanjiHandler = (f) => { onKanji = f; };

// 한자 칩 하나: 逮 たい 잡을 체 (탭하면 한자 풀이)
function kjChip(p) {
  const kids = [h('b', { lang: 'ja' }, p.c), p.r ? h('span', { class: 'ex-kj-r', lang: 'ja' }, p.r) : null, h('span', { class: 'ex-kj-ko' }, p.ko)];
  return onKanji ? h('button', { class: 'ex-kj-one ex-kj-tap', type: 'button', 'aria-label': `${p.c} ${p.ko}`, onclick: () => onKanji(p.c) }, ...kids) : h('span', { class: 'ex-kj-one' }, ...kids);
}

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

// 해설 순서: ① 왜 틀렸나(고른 답·원인) → ② 정답과 정답을 채운 문제문·해석, 한두 줄 근거 → ③ 「자세히」(한자·예문·다른 선택지·접속 등, 접혀 있음)
// q: { options, answer, why?, ex?: [ja, ko], more?, explain?, ko?, prompt?, btype?, full?, vkey? } · pick: 고른 선택지 번호 · numbered: 「1. 」 붙이기
export function explainView(q, pick, { numbered = false, ko = true } = {}) {
  const why = q.options.map((o, i) => trimHead((q.why || [])[i], o));
  const label = (i) => h('b', { class: 'ex-opt', lang: JA.test(q.options[i]) ? 'ja' : null }, (numbered ? `${i + 1}. ` : '') + q.options[i]);
  const wrongPick = pick != null && pick !== q.answer;
  const out = [];
  // ① 고른 답이 왜 틀렸나
  if (wrongPick) {
    const cause = errorCause(q, pick);
    out.push(h('div', { class: 'ex-box ex-pick' },
      h('div', { class: 'ex-head' }, h('span', { class: 'ex-tag' }, '고른 답'), label(pick), cause ? h('span', { class: 'ex-cause' }, CAUSES[cause][0]) : null),
      why[pick] ? h('p', null, richKo(why[pick])) : null));
  }
  // ② 정답: 정답을 채운 문제문 + 해석 + 짧은 근거
  let ansText = why[q.answer] || trimHead(q.explain, q.options[q.answer]);
  if (why.filter(Boolean).length >= 3) {
    const kept = ansText.split(/(?<=[.。요])\s+/).filter((x) => !/(맞지 않|어울리지 않|성립하지 않)/.test(x));
    if (kept.length) ansText = kept.join(' ');
  }
  const sent = filledSentence(q);
  const ans = [];
  if (sent) ans.push(h('div', { class: 'ex-sent', lang: 'ja' }, sent[0], sent[1] ? h('mark', null, sent[1]) : null, sent[2]));
  if (ko && q.ko && sent) ans.push(h('div', { class: 'ex-sent-ko' }, q.ko));
  if (ansText) ans.push(h('p', null, richKo(ansText)));
  if (ko && q.ko && !sent) ans.push(h('p', { class: 'ex-ko' }, h('span', { class: 'ex-ko-tag' }, '문장 뜻'), q.ko));
  out.push(h('div', { class: 'ex-box ex-ans' }, h('div', { class: 'ex-head' }, h('span', { class: 'ex-tag' }, '정답'), label(q.answer)), ...ans));
  // ③ 자세히: 한자 분해·같은 읽기·비슷한 말, 예문, 다른 선택지, 접속·차이
  const more = [];
  if (q.vkey) {
    const readingQ = q.kind === 'reading' || q.btype === 'kanji' || q.btype === 'hyoki';
    const rows = vocabRows(q.vkey, { kanji: true, rel: true }).filter((r) => r.t !== '같은 읽기' || readingQ);
    if (rows.length) more.push(h('div', { class: 'ex-rows' }, rows.map((r) => h('div', { class: 'ex-row' }, h('span', { class: 'ex-row-t' }, r.t), r.parts
      ? h('span', { class: 'ex-kj' }, r.parts.flatMap((p, i) => [i ? h('span', { class: 'ex-kj-plus' }, '＋') : null, kjChip(p)]))
      : h('span', { class: 'ex-row-v' }, r.ja.map((t, i) => h('span', { lang: 'ja' }, (i ? ' · ' : '') + t)))))));
  }
  if (q.ex && q.ex[0]) more.push(h('div', { class: 'ex-ex' }, h('span', { lang: 'ja' }, q.ex[0]), q.ex[1] ? h('span', { class: 'ex-ex-ko' }, q.ex[1]) : null));
  const others = q.options.map((_, i) => i).filter((i) => i !== q.answer && i !== pick && why[i]);
  if (others.length) more.push(h('ul', { class: 'ex-others' }, others.map((i) => h('li', null, label(i), h('span', null, richKo(why[i]))))));
  if (q.more && q.more.length) more.push(...q.more.map((m) => h('p', { class: 'ex-more-p' }, richKo(m))));
  if (more.length) out.push(h('details', { class: 'ex-more' }, h('summary', null, others.length ? '자세히 · 다른 선택지' : '자세히'), ...more));
  return out;
}
