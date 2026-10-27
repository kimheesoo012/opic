// 플레이 중 확인 문제 · 복습 카드. 게임 칸(이야기 자리)에 그대로 그리고, 답하는 동안 시간은 멈춘다.
// 맞히든 틀리든 게임 능력치·이야기에는 영향이 없다. 기록은 간격 반복(srs)과 이번 견생의 학습 기록에만 남는다.
import { h, renderJa, LINES } from './render.js';
import { sceneOf } from './scenes.js';
import { blankOf } from '../engine/study.js';
import { pickItem, buildQuestion, recordAnswer } from '../engine/quizplan.js';
import { store } from './store.js';

export const KIND_LABEL = {
  reading: '読み — 읽기 고르기',
  meaning: '意味 — 뜻 고르기',
  word: '単語 — 일본어 고르기',
  context: '文脈 — 이 문장에서의 뜻',
  grammar: '文法 — 빈칸 채우기',
  gform: '文法 — 뜻에 맞는 표현',
  gblank: '文法 — 게임 속 문장의 빈칸',
  gcontext: '文脈 — 문장 속 문법의 뜻',
  gdiff: '文法 — 비슷한 표현 구별',
};

// 이 말의 문장: 이번 견생에서 만난 대사 → 없으면 처음 나오는 대사
export function sentenceFor(id, log) {
  const tpl = (log && log.where[id]) || (id[0] === 'g' ? LINES.gidx[id.slice(2)] : LINES.vidx[id.slice(2)])?.tpl || null;
  return tpl && LINES.lines[tpl] ? tpl : null;
}
export const blankFor = (id, tpl) => (id[0] === 'g' && tpl ? blankOf(LINES.lines[tpl], id.slice(2)) : null);

// 문제를 하나 만든다 (없으면 null)
export function planQuiz(log, src, now = Date.now()) {
  const srs = store.srs();
  const id = pickItem(log, srs, now, src);
  if (!id) return null;
  const tpl = sentenceFor(id, log);
  const q = buildQuestion(id, log, srs, { hasScene: !!tpl, blank: blankFor(id, tpl) });
  return q && q.answer >= 0 ? { q, tpl } : null;
}

// panel·foot에 문제를 그린다. done(answered)는 「つづける」·「건너뛰기」에서 부른다.
export function renderQuiz(app, view, { q, tpl }, src, log, done) {
  const s = view.s;
  const mode = app.settings.furigana;
  const id = q.id;
  const key = id.slice(2);
  const scene = tpl ? sceneOf(tpl, s) : null;
  const showLine = tpl && (q.kind === 'context' || q.kind === 'gcontext' || q.kind === 'gblank');
  const ko = h('div', { class: 'ko', hidden: true }, scene ? scene.ko : '');
  const line = showLine
    ? h('div', { class: 'line q-line' },
      h('div', { class: 'ja' }, renderJa(tpl, { s, speaker: scene && scene.role, mode, targets: new Set([id]), blankG: q.kind === 'gblank' ? key : null })),
      ko)
    : null;
  const fb = h('div', { class: 'q-explain', hidden: true, 'aria-live': 'polite' });
  const koOpts = q.kind === 'meaning' || q.kind === 'context' || q.kind === 'gcontext';
  const koPrompt = ['word', 'gform', 'gdiff', 'gblank', 'gcontext'].includes(q.kind);
  if (q.kind === 'gcontext' && tpl) {
    const sg = (LINES.lines[tpl] || []).find((x) => x && x.g === key);
    const surface = sg ? sg.s.map((x) => (typeof x === 'string' ? x : x[0])).join('') : '';
    const base = q.label.replace(/^～/, '');
    if (surface && surface !== base) q.prompt = `밑줄 친 「${surface}」(= ${base})의 뜻`;
  }
  let answered = false;
  const next = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: () => done(true) }, 'つづける');
  const skip = h('button', { class: 'mini-btn', type: 'button', onclick: () => done(false) }, '건너뛰기');
  const opts = q.options.map((o, i) => h('button', { class: 'btn q-opt', type: 'button', lang: koOpts ? 'ko' : 'ja', onclick: (e) => {
    if (answered) return;
    answered = true;
    const ok = i === q.answer;
    const srs = store.srs();
    recordAnswer(log, srs, q, ok, Date.now(), src);
    store.saveSrs(srs);
    view.save();
    e.currentTarget.classList.add(ok ? 'right' : 'wrong');
    opts[q.answer].classList.add('right');
    opts.forEach((b) => b.setAttribute('aria-disabled', 'true'));
    if (scene) ko.hidden = false;
    fb.replaceChildren(...[
      h('div', { class: ok ? 'ok-mark' : 'ng-mark' }, ok ? '正解' : '不正解'),
      h('p', null, q.explain),
      ok ? null : h('p', { class: 'note' }, '복습 목록에 넣었어요. 몇 문제 뒤에 다른 형태로 한 번 더 나옵니다.'),
    ].filter(Boolean));
    fb.hidden = false;
    skip.remove();
    next.hidden = false;
    next.focus({ preventScroll: true });
    fb.scrollIntoView({ block: 'nearest' });
  } }, o));
  // replaceChildren은 null을 「null」 글자로 넣으므로 빈 칸은 걸러 낸다
  view.panel.replaceChildren(...[
    h('div', { class: 'ev-cat' }, src === 'card' ? '復習カード' : 'ちょっと確認'),
    h('div', { class: 'q-kind' }, KIND_LABEL[q.kind] || ''),
    h('p', { class: 'note small q-why' }, src === 'card' ? '전에 만난 말을 다시 꺼내 봅니다. 게임 진행에는 영향이 없어요.' : '방금 장면에 나온 말이에요. 틀려도 게임에는 영향이 없어요.'),
    line,
    q.prompt ? h('div', { class: 'q-prompt' + (koPrompt ? ' ko' : '') + (q.kind === 'grammar' ? ' long' : ''), lang: koPrompt ? 'ko' : 'ja' }, q.prompt) : null,
    h('div', { class: 'btns' }, opts),
    fb,
  ].filter(Boolean));
  view.foot.hidden = false;
  view.foot.replaceChildren(h('div', { class: 'dog-acts' }, next, skip));
}
