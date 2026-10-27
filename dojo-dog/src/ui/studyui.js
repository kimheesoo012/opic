// 「復習」 화면: 오늘의 복습(간격 반복), 단어장, 今日の一問, 4지선다 퀴즈.
import { VOCAB } from '../data/vocab.js';
import { GRAMMAR } from '../data/grammar.js';
import { dueIds, grade, makeSet, mastered, progress, itemOf } from '../engine/study.js';
import { h } from './render.js';
import { store } from './store.js';
import { firstScene, levelLabel, wordPopup, grammarPopup } from './vocabui.js';

const today = () => new Date().toISOString().slice(0, 10);

export function progressBox(srs, ids) {
  const p = progress(srs, ids);
  return h('div', { class: 'prog-grid' },
    h('div', null, h('b', null, 'N2 単語'), h('span', null, `${p.words}`), h('small', null, `익힘 ${p.wordsMastered}`)),
    h('div', null, h('b', null, 'N2 文法'), h('span', null, `${p.grammar}`), h('small', null, `익힘 ${p.grammarMastered}`)));
}

function shell(app, title, body, foot) {
  return h('div', { class: 'screen' }, h('div', { class: 'scroll' }, h('h2', { class: 'h' }, title), body), foot ? h('div', { class: 'sheet-foot', style: 'position:static' }, foot) : null);
}

export function studyScreen(app, tab = 'review') {
  const srs = store.srs();
  const due = dueIds(srs);
  const tabs = h('div', { class: 'seg tabs', role: 'tablist' },
    h('button', { type: 'button', role: 'tab', 'aria-pressed': String(tab === 'review'), onclick: () => app.go('review') }, '復習'),
    h('button', { type: 'button', role: 'tab', 'aria-pressed': String(tab === 'book'), onclick: () => app.go('wordbook') }, '単語帳'));
  const body = h('div');
  if (tab === 'review') {
    const met = Object.keys(srs).filter((id) => itemOf(id));
    body.append(
      progressBox(srs),
      h('div', { class: 'due-line' }, h('b', null, '今日の復習'), h('span', null, `${due.length}`)),
      h('div', { class: 'btns' },
        due.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => app.startQuiz(due.slice(0, 20), '今日の復習') }, `はじめる（${Math.min(20, due.length)}問）`) : h('p', { class: 'note' }, '今日の分はなし'),
        met.length >= 4 ? h('button', { class: 'btn center', type: 'button', onclick: () => app.startQuiz(met, '練習') }, '練習 10問') : null));
  } else body.append(bookList(app, srs));
  return shell(app, '復習', [tabs, h('div', { style: 'height:12px' }), body], h('button', { class: 'btn center', type: 'button', onclick: () => app.back() }, '戻る'));
}

function bookList(app, srs) {
  const wb = store.wordbook();
  const keys = Object.keys(wb).filter((k) => (k.startsWith('g:') ? GRAMMAR[k.slice(2)] : VOCAB[k])).sort((a, b) => (wb[b].last || 0) - (wb[a].last || 0));
  let q = '';
  const list = h('div', { class: 'list' });
  const draw = () => {
    list.replaceChildren();
    const match = (k) => {
      if (!q) return true;
      const g = k.startsWith('g:') ? GRAMMAR[k.slice(2)] : null;
      const v = g ? null : VOCAB[k];
      return k.includes(q) || (g ? g.m.includes(q) : v.r.includes(q) || v.m.includes(q));
    };
    const ks = keys.filter(match);
    if (!ks.length) list.append(h('p', { class: 'note' }, keys.length ? '없음' : '저장한 말 없음'));
    for (const k of ks) {
      const g = k.startsWith('g:') ? GRAMMAR[k.slice(2)] : null;
      const v = g ? null : VOCAB[k];
      const id = g ? k : 'v:' + k;
      const r = srs[id];
      list.append(h('button', { class: 'card book-item', type: 'button', onclick: () => (g ? grammarPopup(app, k.slice(2), null, app.settings.furigana) : wordPopup(app, k, null, app.settings.furigana)) },
        h('span', { class: 'bi-word', lang: 'ja' }, g ? g.f : k, v ? h('small', { lang: 'ja' }, v.r) : null),
        h('span', { class: 'bi-mean' }, g ? g.m : v.m),
        h('span', { class: 'bi-meta' }, levelLabel((g || v).lv), r ? ` · ○${r.ok} ×${r.ng}${mastered(r) ? ' · 익힘' : ''}` : '')));
    }
  };
  draw();
  return h('div', null,
    h('input', { class: 'word-input', type: 'search', id: 'wb-search', placeholder: '찾기', 'aria-label': '찾기', oninput: (e) => { q = e.target.value.trim(); draw(); } }),
    h('div', { style: 'height:10px' }),
    keys.length >= 4 ? h('button', { class: 'btn center', type: 'button', onclick: () => app.startQuiz(keys.map((k) => (k.startsWith('g:') ? k : 'v:' + k)), '単語帳') }, '単語帳から 10問') : null,
    h('div', { style: 'height:10px' }),
    list);
}

// 퀴즈. opts.daily: 今日の一問(건너뛰기 가능), opts.onDone: 끝난 뒤
export function quizScreen(app, ids, label, opts = {}) {
  const srs = store.srs();
  const n = opts.n || 10;
  let round = 1;
  let qs = makeSet(ids, n, label + Date.now(), srs);
  let i = 0;
  let wrong = [];
  const log = [];
  const body = h('div', { class: 'scroll' });
  const foot = h('div', { class: 'sheet-foot', style: 'position:static' });
  const el = h('div', { class: 'screen quiz' }, body, foot);
  const KIND = { reading: '読み', meaning: '意味', grammar: '文法' };
  const leave = () => {
    if (opts.daily) store.saveDailyDone(today());
    return opts.onDone ? opts.onDone() : app.back();
  };
  const show = () => {
    body.replaceChildren();
    foot.replaceChildren();
    if (i >= qs.length) return summary();
    const q = qs[i];
    let answered = false;
    const fb = h('div', { class: 'q-explain', hidden: true });
    const next = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: () => { i++; show(); } }, i + 1 < qs.length ? '次へ' : '結果');
    const opt = q.options.map((o, oi) => h('button', { class: 'btn q-opt', type: 'button', lang: q.kind === 'meaning' ? 'ko' : 'ja', onclick: (e) => {
      if (answered) return;
      answered = true;
      const ok = oi === q.answer;
      grade(srs, q.id, ok);
      store.saveSrs(srs);
      log.push({ q, ok, round, pick: o });
      if (!ok) wrong.push(q.id);
      e.currentTarget.classList.add(ok ? 'right' : 'wrong');
      opt[q.answer].classList.add('right');
      const scene = firstScene(app, q.id, app.settings.furigana);
      fb.replaceChildren(
        h('div', { class: ok ? 'ok-mark' : 'ng-mark' }, ok ? '正解' : '不正解'),
        h('p', null, q.explain),
        scene ? h('div', { class: 'v-sec' }, h('h4', null, 'ゲームの場面'), scene) : null);
      fb.hidden = false;
      next.hidden = false;
      next.focus();
    } }, o));
    body.append(
      h('div', { class: 'kicker' }, `${label} · ${round > 1 ? `やり直し ${round - 1} · ` : ''}${i + 1} / ${qs.length}`),
      h('div', { class: 'q-kind' }, KIND[q.kind]),
      h('div', { class: 'q-prompt' + (q.kind === 'grammar' ? ' long' : ''), lang: 'ja' }, q.prompt),
      h('div', { class: 'btns' }, opt),
      fb);
    foot.append(next);
    if (opts.daily) foot.append(h('button', { class: 'btn center', type: 'button', onclick: leave }, 'スキップ'));
  };
  const summary = () => {
    const thisRound = log.filter((x) => x.round === round);
    const okN = thisRound.filter((x) => x.ok).length;
    const first = log.filter((x) => x.round === 1);
    const line = (x) => {
      const it = itemOf(x.q.id);
      const head = it.type === 'g' ? it.f : `${it.key}（${it.r}）`;
      return `${x.ok ? '○' : '×'} ${head} ${it.m}`;
    };
    const text = [`道場犬 ${label} ${today()}`, `${first.filter((x) => x.ok).length} / ${first.length}`, ...first.map(line), round > 1 ? `やり直し ${round - 1}回 · 残り ${new Set(wrong).size}` : ''].filter(Boolean).join('\n');
    const pre = h('textarea', { class: 'word-input', rows: '6', readonly: true, id: 'quiz-result', 'aria-label': '결과' }, text);
    body.append(
      h('h2', { class: 'h' }, round === 1 ? '結果' : `やり直し ${round - 1}`),
      h('p', { class: 'big-score' }, `${okN} / ${thisRound.length}`),
      wrong.length ? h('div', { class: 'list' }, [...new Set(wrong)].map((id) => h('div', { class: 'card' }, line({ q: { id }, ok: false })))) : null,
      pre);
    foot.append(
      wrong.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => { round++; qs = makeSet([...new Set(wrong)], n, label + round + Date.now(), srs); wrong = []; i = 0; show(); } }, '間違いだけ もう一度') : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn center', type: 'button', onclick: async () => {
          try {
            await navigator.clipboard.writeText(text);
            app.toast('복사함');
          } catch {
            pre.focus();
            pre.select();
            app.toast('선택한 글자를 복사');
          }
        } }, 'コピー'),
        h('button', { class: 'btn center', type: 'button', onclick: leave }, opts.daily ? 'はじめる' : '戻る')));
    if (opts.daily) store.saveDailyDone(today());
  };
  show();
  return el;
}

// 시작 전 「今日の一問」: 복습할 것이 있고 오늘 아직 안 풀었을 때만
export function dailyIds() {
  if (store.dailyDone() === today()) return [];
  const srs = store.srs();
  return dueIds(srs).slice(0, 3);
}
