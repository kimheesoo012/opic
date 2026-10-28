// 플레이 중 확인 문제 · 복습 카드. 게임 칸(이야기 자리)에 그대로 그리고, 답하는 동안 시간은 멈춘다.
// 맞히든 틀리든 게임 능력치·이야기에는 영향이 없다. 기록은 간격 반복(srs)과 이번 견생의 학습 기록에만 남는다.
import { h, renderJa, LINES } from './render.js';
import { sceneOf } from './scenes.js';
import { blankOf } from '../engine/study.js';
import { pickItem, buildQuestion, recordAnswer } from '../engine/quizplan.js';
import { store } from './store.js';
import { BANK_TYPES } from '../data/n2/bank.js';
import { richQ } from './n2ui.js';
import { explainView } from './explainui.js';
import { errorCause } from '../engine/explain.js';

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
// jaOnly: 일본어 몰입 모드 — 일본어만으로 풀 수 있는 문제만 (못 만들면 다른 말을 몇 번 더 고른다)
export function planQuiz(log, src, now = Date.now(), jaOnly = false) {
  const srs = store.srs();
  const skip = new Set();
  for (let i = 0; i < 6; i++) {
    const id = pickItem(log, srs, now, src, skip);
    if (!id) return null;
    const tpl = sentenceFor(id, log);
    const q = buildQuestion(id, log, srs, { hasScene: !!tpl, blank: blankFor(id, tpl), jaOnly });
    if (q && q.answer >= 0) return { q, tpl };
    skip.add(id);
  }
  return null;
}

// 일본어 모드의 유형 이름 (「読み — 읽기 고르기」의 앞부분만)
export const kindName = (q, ja) => {
  const full = q.kind === 'bank' ? `${BANK_TYPES[q.btype][0]} — ${BANK_TYPES[q.btype][1]}` : KIND_LABEL[q.kind] || '';
  return ja ? full.split(' — ')[0] : full;
};

// panel·foot에 문제를 그린다. done(answered)는 「つづける」·「건너뛰기」에서 부른다.
export function renderQuiz(app, view, { q, tpl }, src, log, done) {
  const s = view.s;
  const mode = app.settings.furigana;
  const ja = (app.settings.lang || 'ja') === 'ja';
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
  if (ja && q.kind === 'gblank') q.prompt = '（　）に入る言葉';
  let answered = false;
  const next = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: () => done(true) }, 'つづける');
  const skip = h('button', { class: 'mini-btn', type: 'button', onclick: () => done(false) }, ja ? 'スキップ' : '건너뛰기');
  const opts = q.options.map((o, i) => h('button', { class: 'btn q-opt', type: 'button', lang: koOpts ? 'ko' : 'ja', onclick: (e) => {
    if (answered) return;
    answered = true;
    const ok = i === q.answer;
    const srs = store.srs();
    recordAnswer(log, srs, q, ok, Date.now(), src);
    store.saveSrs(srs);
    if (q.bankId) {
      const ql = store.qlog();
      const r = ql[q.bankId] || { ok: 0, ng: 0, t: q.btype };
      r[ok ? 'ok' : 'ng']++;
      r.last = Date.now();
      r.lastOk = ok;
      ql[q.bankId] = r;
      store.saveQlog(ql);
    }
    if (!ok && q.bankId) store.addCause(errorCause(q, i), q.bankId);
    view.save();
    e.currentTarget.classList.add(ok ? 'right' : 'wrong');
    opts[q.answer].classList.add('right');
    opts.forEach((b) => b.setAttribute('aria-disabled', 'true'));
    // 해설(한국어)과 문장 번역: 한국어 모드이거나 틀렸을 때는 바로 펼치고, 일본어 모드에서 맞혔을 때는 「解説」을 눌렀을 때만
    const shut = ja && ok;
    const explain = h('div', { class: 'q-ko', hidden: shut }, explainView(q, i));
    if (scene && !shut) ko.hidden = false;
    fb.replaceChildren(...[
      h('div', { class: ok ? 'ok-mark' : 'ng-mark' }, ok ? '正解' : '不正解'),
      ja ? h('button', { class: 'mini-btn', type: 'button', onclick: (ev) => { explain.hidden = !explain.hidden; if (scene) ko.hidden = explain.hidden; ev.currentTarget.textContent = explain.hidden ? '解説' : '閉じる'; } }, shut ? '解説' : '閉じる') : null,
      explain,
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
    h('div', { class: 'q-kind' }, kindName(q, ja)),
    line,
    q.prompt ? h('div', { class: 'q-prompt' + (koPrompt ? ' ko' : '') + (q.kind === 'grammar' || q.kind === 'bank' ? ' long' : ''), lang: koPrompt ? 'ko' : 'ja' }, q.kind === 'bank' ? richQ(q.prompt) : q.prompt) : null,
    h('div', { class: 'btns' }, opts),
    fb,
  ].filter(Boolean));
  view.foot.hidden = false;
  view.foot.replaceChildren(h('div', { class: 'dog-acts' }, next, skip));
}
