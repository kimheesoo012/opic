// 「復習」 화면: 오늘의 복습(간격 반복), 단어장, 만난 말, 今日の一問, 4지선다 퀴즈.
// 만남과 복습 등록 규칙(한곳에서 정한다):
// - 장면에 나온 학습 대상은 「만남」으로만 기록한다(store.met + 이번 견생의 s.met). 이번 견생의 복습·엔딩 정리는 s.met를 쓴다.
// - 간격 반복(srs)에는 직접 건드린 말만 넣는다: 뜻 창을 열었다(openWord·openGrammar, 단어 창은 onWordSaved를 부른다),
//   그 말이 든 문장의 번역을 열었다(noteTranslate), 단어장에 저장했다(저장은 뜻 창 안에서만 된다), 문제를 풀었다(grade가 기록을 만든다).
// - 복습 수는 reviewCounts 하나로 센다: today(지금 풀 것) · tomorrow(내일 안에 기한이 되는 것) · total(복습 목록 전체).
import { VOCAB } from '../data/vocab.js';
import { GRAMMAR } from '../data/grammar.js';
import { dueIds, grade, makeSet, makeQuestion, questionKinds, mastered, itemOf, isN2, reviewGroups, learningStats, blankOf, meet as srsMeet, DAY } from '../engine/study.js';
import { BANK_BY_REF, bankQuestion } from '../engine/bankq.js';
import { hashSeed, rand, shuffle } from '../engine/rng.js';
import { kindName } from './playquiz.js';
import { explainView } from './explainui.js';
import { errorCause } from '../engine/explain.js';
import { h, LINES } from './render.js';
import { store } from './store.js';
import { firstScene, levelLabel, wordPopup } from './vocabui.js';

const today = () => new Date().toISOString().slice(0, 10);
// DOM append는 null을 「null」 글자로 넣으므로 빈 칸을 걸러서 붙인다
const appendAll = (el, ...kids) => el.append(...kids.flat(Infinity).filter((x) => x != null && x !== false));
const isJa = (app) => (app.settings.lang || 'ja') === 'ja';

// ───── 만남과 복습 등록 ─────
// 장면에서 만났다: 만난 기록(견생을 넘어 유지)과 이번 견생의 s.met에만 남긴다. 간격 반복에는 넣지 않는다.
export function recordMet(ids, s, now = Date.now()) {
  const list = (ids || []).filter((id) => itemOf(id));
  if (!list.length) return;
  const log = store.met();
  for (const id of list) log[id] = now;
  store.saveMet(log);
  if (s) {
    s.met = s.met || [];
    for (const id of list) if (!s.met.includes(id)) s.met.push(id);
  }
}

// 직접 건드린 말을 간격 반복에 등록한다(이미 있으면 그대로). tr: 번역을 열어 본 말 → 「번역 확인」 횟수를 센다(오답으로 치지 않는다)
export function engage(ids, { tr = [] } = {}, now = Date.now()) {
  const srs = store.srs();
  let changed = false;
  for (const id of ids || []) changed = srsMeet(srs, id, now) || changed;
  for (const id of tr) {
    if (!srs[id]) continue;
    srs[id].tr = (srs[id].tr || 0) + 1;
    changed = true;
  }
  if (changed) store.saveSrs(srs);
  return changed;
}

// 만난 말 전체(최근 순): 만난 기록 ∪ 간격 반복 기록. 옛 판에서는 만나기만 해도 srs에 들어갔으므로 둘을 합친다.
export function metEntries(srs = store.srs(), log = store.met()) {
  const at = new Map();
  for (const [id, t] of Object.entries(log || {})) at.set(id, t || 0);
  for (const [id, r] of Object.entries(srs || {})) at.set(id, Math.max(at.get(id) || 0, (r && r.met) || 0, (r && r.last) || 0));
  return [...at].filter(([id]) => itemOf(id)).map(([id, t]) => ({ id, at: t })).sort((a, b) => b.at - a.at);
}

// 만난 N2 어휘·문법 수와 그중 익힌 것 (복습 기록이 없어도 만난 것으로 센다)
export function metProgress(srs, ids) {
  const n2 = [...new Set(ids)].filter((id) => itemOf(id) && isN2(id));
  const w = n2.filter((id) => id[0] === 'v');
  const g = n2.filter((id) => id[0] === 'g');
  return {
    words: w.length,
    grammar: g.length,
    wordsMastered: w.filter((id) => mastered(srs[id])).length,
    grammarMastered: g.filter((id) => mastered(srs[id])).length,
  };
}

// 내일이 끝나는 때 (자정 기준, 기기 시각)
const endOfTomorrow = (now) => {
  const d = new Date(now);
  d.setHours(48, 0, 0, 0);
  return d.getTime();
};
// 복습 수: 타이틀·N2 요약·복습 화면·견생 결과가 모두 이 숫자를 쓴다.
// 게임 시간은 빠르지만 복습 날짜는 실제 날짜라서, 한 견생에서 등록한 말은 대개 「내일부터」 복습이 된다.
export function reviewCounts(srs, now = Date.now()) {
  const end = endOfTomorrow(now);
  let todayN = 0;
  let tomorrow = 0;
  let total = 0;
  for (const [id, r] of Object.entries(srs || {})) {
    if (!r || !itemOf(id)) continue;
    total++;
    if (r.due <= now) todayN++;
    else if (r.due <= end) tomorrow++;
  }
  return { today: todayN, tomorrow, total };
}

export function progressBox(srs, ids, ja = true) {
  const p = metProgress(srs, ids || metEntries(srs).map((x) => x.id));
  const m = ja ? '定着' : '익힘';
  return h('div', { class: 'prog-grid' },
    h('div', null, h('b', null, 'N2 単語'), h('span', null, `${p.words}`), h('small', null, `${m} ${p.wordsMastered}`)),
    h('div', null, h('b', null, 'N2 文法'), h('span', null, `${p.grammar}`), h('small', null, `${m} ${p.grammarMastered}`)));
}

function shell(app, title, body, foot) {
  return h('div', { class: 'screen' }, h('div', { class: 'scroll' }, h('h2', { class: 'h' }, title), body), foot ? h('div', { class: 'sheet-foot', style: 'position:static' }, foot) : null);
}

const hasScene = (id) => !!(id[0] === 'g' ? LINES.gidx[id.slice(2)] : LINES.vidx[id.slice(2)]);
// 문장 빈칸: 처음 나오는 대사에서 낼 수 있을 때만
const blankOfFirst = (id) => (id[0] === 'g' && LINES.gidx[id.slice(2)] ? blankOf(LINES.lines[LINES.gidx[id.slice(2)].tpl], id.slice(2)) : null);

// 일본어 학습 기록 (게임 능력치와 섞지 않는다). 「出会った語」를 누르면 만난 말 목록
export function statsBox(app, srs, ja = true) {
  const st = learningStats(srs, store.wordbook());
  const met = metEntries(srs);
  const metWords = met.filter((x) => x.id[0] === 'v').length;
  const metGrammar = met.filter((x) => x.id[0] === 'g').length;
  const cell = (label, value) => h('div', null, h('b', null, label), h('span', null, value));
  return h('div', { class: 'learn-stats' },
    h('button', { class: 'stat-link', type: 'button', onclick: () => app.go('metwords') }, h('b', null, ja ? '出会った語 ›' : '만난 어휘 ›'), h('span', null, String(metWords))),
    cell(ja ? '保存した語' : '저장한 말', String(st.saved)),
    cell(ja ? '定着した文法' : '익힌 문법', `${st.learnedGrammar} / ${metGrammar}`),
    cell(ja ? '正答率' : '정답률', st.accuracy == null ? '—' : `${st.accuracy}%`),
    cell(ja ? '復習リスト' : '복습 목록', String(reviewCounts(srs).total)));
}

// 오늘·내일 복습 줄 (타이틀과 같은 숫자)
export function dueLine(srs, ja = true) {
  const c = reviewCounts(srs);
  return h('div', { class: 'due-line' },
    h('b', null, ja ? '今日の復習' : '오늘의 복습'), h('span', null, `${c.today}`),
    h('small', { class: 'due-next' }, ja ? `明日から復習 ${c.tomorrow}` : `내일부터 복습 ${c.tomorrow}`));
}

export function studyScreen(app, tab = 'review') {
  const srs = store.srs();
  const due = dueIds(srs);
  const ja = isJa(app);
  const tabBtn = (key, screen, label) => h('button', { type: 'button', role: 'tab', 'aria-pressed': String(tab === key), onclick: () => app.go(screen) }, label);
  const tabs = h('div', { class: 'seg tabs', role: 'tablist' },
    tabBtn('review', 'review', '復習'),
    tabBtn('book', 'wordbook', '単語帳'),
    tabBtn('met', 'metwords', ja ? '出会った語' : '만난 말'));
  const body = h('div');
  if (tab === 'review') {
    const met = Object.keys(srs).filter((id) => itemOf(id));
    const g = reviewGroups(srs);
    const row = (label, ids, quizLabel) => h('div', { class: 'review-row' },
      h('span', null, label),
      h('b', null, String(ids.length)),
      h('button', { class: 'mini-btn', type: 'button', disabled: !ids.length, onclick: () => app.startQuiz(ids.slice(0, 15), quizLabel) }, ja ? '解く' : '풀기'));
    const c = reviewCounts(srs);
    body.append(
      statsBox(app, srs, ja),
      dueLine(srs, ja),
      h('div', { class: 'review-rows' },
        row(ja ? '今日の単語' : '오늘 복습할 단어', g.words, '今日の単語'),
        row(ja ? '今日の文法' : '오늘 복습할 문법', g.grammar, '今日の文法'),
        row(ja ? '最近の間違い' : '최근 틀린 항목', g.recentWrong, '最近の間違い'),
        row(ja ? '苦手' : '어려운 항목', g.hard, '苦手')),
      h('div', { class: 'btns', style: 'margin-top:10px' },
        due.length
          ? h('button', { class: 'btn primary', type: 'button', onclick: () => app.startQuiz(due.slice(0, 20), '今日の復習') }, `${ja ? '全部解く' : '전부 풀기'} · ${Math.min(20, due.length)}問`)
          : h('p', { class: 'note' }, ja ? (c.tomorrow ? `今日の復習はなし。明日から ${c.tomorrow}件が復習になる` : '今日の復習はなし') : c.tomorrow ? `오늘 복습할 것은 없어요. 내일부터 ${c.tomorrow}개가 복습에 나와요` : '오늘 복습할 것은 없어요'),
        met.length >= 4 ? h('button', { class: 'btn center', type: 'button', onclick: () => app.startQuiz(met, '練習') }, '練習 10問') : null));
  } else if (tab === 'met') body.append(metList(app, srs));
  else body.append(bookList(app, srs));
  return shell(app, '復習', [tabs, h('div', { style: 'height:12px' }), body], h('button', { class: 'btn center', type: 'button', onclick: () => app.back() }, '戻る'));
}

const openItem = (app, id) => (id[0] === 'g' ? app.openGrammar(id.slice(2), null) : app.openWord(id.slice(2), null));

function bookList(app, srs) {
  const ja = isJa(app);
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
    if (!ks.length) list.append(h('p', { class: 'note' }, ja ? (keys.length ? 'なし' : 'まだ保存した語はない') : keys.length ? '없음' : '저장한 말 없음'));
    for (const k of ks) {
      const g = k.startsWith('g:') ? GRAMMAR[k.slice(2)] : null;
      const v = g ? null : VOCAB[k];
      const id = g ? k : 'v:' + k;
      const r = srs[id];
      list.append(h('button', { class: 'card book-item', type: 'button', onclick: () => (g ? app.openGrammar(k.slice(2), null) : wordPopup(app, k, null, app.settings.furigana)) },
        h('span', { class: 'bi-word', lang: 'ja' }, g ? g.f : k, v ? h('small', { lang: 'ja' }, v.r) : null),
        ja ? null : h('span', { class: 'bi-mean' }, g ? g.m : v.m),
        h('span', { class: 'bi-meta' }, levelLabel((g || v).lv), r ? ` · ○${r.ok} ×${r.ng}${mastered(r) ? (ja ? ' · 定着' : ' · 익힘') : ''}` : '')));
    }
  };
  draw();
  return h('div', null,
    h('input', { class: 'word-input', type: 'search', id: 'wb-search', placeholder: ja ? '検索' : '찾기', 'aria-label': ja ? '検索' : '찾기', oninput: (e) => { q = e.target.value.trim(); draw(); } }),
    h('div', { style: 'height:10px' }),
    keys.length >= 4 ? h('button', { class: 'btn center', type: 'button', onclick: () => app.startQuiz(keys.map((k) => (k.startsWith('g:') ? k : 'v:' + k)), '単語帳') }, '単語帳から 10問') : null,
    h('div', { style: 'height:10px' }),
    list);
}

// 언제 만났나 (오늘·어제·N일 전)
const agoText = (t, ja) => {
  if (!t) return '';
  const d = Math.floor((new Date().setHours(24, 0, 0, 0) - t) / DAY);
  if (ja) return d <= 0 ? '今日' : d === 1 ? '昨日' : `${d}日前`;
  return d <= 0 ? '오늘' : d === 1 ? '어제' : `${d}일 전`;
};

// 만난 말: 장면에서 만난 어휘·문법 전체(최근 순). 탭하면 뜻 창
function metList(app, srs) {
  const ja = isJa(app);
  const all = metEntries(srs);
  const byType = { v: all.filter((x) => x.id[0] === 'v'), g: all.filter((x) => x.id[0] === 'g') };
  let type = 'v';
  let q = '';
  let limit = 60;
  const list = h('div', { class: 'list' });
  const status = (r) => (!r ? (ja ? '復習リスト外' : '복습 목록 밖') : mastered(r) ? (ja ? '定着' : '익힘') : `○${r.ok} ×${r.ng}`);
  const draw = () => {
    list.replaceChildren();
    const rows = byType[type].filter(({ id }) => {
      if (!q) return true;
      const it = itemOf(id);
      return id.includes(q) || (it.r || '').includes(q) || (it.m || '').includes(q) || (it.f || '').includes(q);
    });
    if (!rows.length) list.append(h('p', { class: 'note' }, ja ? (all.length ? 'なし' : 'まだ出会った語はない。ゲームの場面で出会うとここに並ぶ') : all.length ? '없음' : '아직 만난 말이 없어요. 게임 장면에서 만나면 여기에 모여요'));
    for (const { id, at } of rows.slice(0, limit)) {
      const it = itemOf(id);
      const r = srs[id];
      list.append(h('button', { class: 'card book-item met-item', type: 'button', onclick: () => openItem(app, id) },
        h('span', { class: 'bi-word', lang: 'ja' }, it.type === 'g' ? it.f : it.key, it.type === 'v' ? h('small', { lang: 'ja' }, it.r) : null),
        ja ? null : h('span', { class: 'bi-mean' }, it.m),
        h('span', { class: 'bi-meta' }, `${levelLabel(it.lv)} · ${status(r)} · ${agoText(at, ja)}`)));
    }
    if (rows.length > limit) list.append(h('button', { class: 'btn center', type: 'button', onclick: () => { limit += 60; draw(); } }, ja ? `もっと見る（あと ${rows.length - limit}）` : `더 보기 (${rows.length - limit}개 더)`));
  };
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': ja ? '種類' : '종류' },
    [['v', ja ? `語彙 ${byType.v.length}` : `어휘 ${byType.v.length}`], ['g', ja ? `文法 ${byType.g.length}` : `문법 ${byType.g.length}`]].map(([k, label]) => h('button', { type: 'button', 'aria-pressed': String(k === type), onclick: (e) => {
      type = k;
      limit = 60;
      [...seg.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      draw();
    } }, label)));
  draw();
  return h('div', null,
    seg,
    h('div', { style: 'height:8px' }),
    h('input', { class: 'word-input', type: 'search', id: 'met-search', placeholder: ja ? '検索' : '찾기', 'aria-label': ja ? '検索' : '찾기', oninput: (e) => { q = e.target.value.trim(); limit = 60; draw(); } }),
    h('p', { class: 'note' }, ja ? '最近出会った順。タップすると意味が出て、復習リストに入る' : '최근에 만난 순서예요. 누르면 뜻이 나오고 복습 목록에 들어가요'),
    list);
}

// ───── 다시 풀기 ─────
// 다시 물을 때의 유형 순서: 뜻 떠올리기·구별 쪽부터 (처음과 다른 유형으로)
const RETRY_ORDER = { v: ['word', 'meaning', 'reading', 'context'], g: ['gdiff', 'gcontext', 'gblank', 'grammar', 'gform'] };
export const MAX_RETRY = 3;
// 문제 유형 (문제은행 문항은 「漢字読み」「表記」처럼 문항 종류까지 유형으로 본다)
export const kindKey = (q) => (q.kind === 'bank' ? 'bank:' + q.btype : q.kind);

// 틀린 말을 다시 물을 문제. history: 이번 퀴즈에서 그 말로 낸 문제들(마지막이 바로 전 라운드).
// 바로 전과 다른 유형으로, 이번 퀴즈에서 아직 안 낸 유형을 먼저: (일본어 모드) 일본어만으로 풀 수 있는 유형 → 문제은행 문항 → 그 밖의 유형.
// 다른 유형이 하나도 없으면 같은 유형이라도 문제문이 다른 것만. 그것도 없으면 null(이번에는 묻지 않고 다음 복습으로 넘긴다).
// 같은 문제문·같은 유형을 연달아 내지 않는다 (선택지 자리만 외워서 맞히지 않게).
export function retryQuestion(id, history, seed, { srs = {}, ja = false, hasScene: scene = false, blank = null, usedBank = new Set() } = {}) {
  if (!itemOf(id)) return null;
  const hist = Array.isArray(history) ? history : history ? [history] : [];
  const prev = hist[hist.length - 1];
  const prevKey = prev ? kindKey(prev) : null;
  const usedKinds = new Set(hist.map(kindKey));
  const rec = srs[id];
  const ctx = { hasScene: scene, blank };
  const sameAsPrev = (q) => !!prev && q.kind === prev.kind && q.prompt === prev.prompt && (q.bankId || null) === (prev.bankId || null);
  // fresh: 이번 퀴즈에서 아직 안 낸 유형만
  const fromKinds = (jaOnly, fresh) => {
    const avail = questionKinds(id, { ...ctx, jaOnly });
    for (const kind of RETRY_ORDER[id[0]].filter((k) => avail.includes(k) && (!prev || k !== prev.kind) && (!fresh || !usedKinds.has(k)))) {
      const q = makeQuestion(id, seed + kind, rec, { ...ctx, jaOnly, kind });
      if (q && (!prev || q.kind !== prev.kind) && (!fresh || !usedKinds.has(q.kind))) return q;
    }
    return null;
  };
  // 문제은행: 아직 안 낸 문항 중에서, otherType이면 바로 전과 다른 문항 종류만
  const fromBank = (otherType) => {
    const items = (BANK_BY_REF[id] || []).filter((b) => !usedBank.has(b.id) && !hist.some((q) => q.bankId === b.id) && (!otherType || 'bank:' + b.type !== prevKey));
    if (!items.length) return null;
    return bankQuestion(id, items[Math.floor(rand({ rng: hashSeed(seed + 'bank') }) * items.length)]);
  };
  const steps = ja
    ? [() => fromKinds(true, true), () => fromBank(true), () => fromKinds(true, false), () => fromKinds(false, true), () => fromKinds(false, false), () => fromBank(false)]
    : [() => fromKinds(false, true), () => fromBank(true), () => fromKinds(false, false), () => fromBank(false)];
  for (const step of steps) {
    const q = step();
    if (q && !sameAsPrev(q)) return q;
  }
  const q = prev ? makeQuestion(id, seed + 'again', rec, { ...ctx, jaOnly: ja, kind: prev.kind }) : makeQuestion(id, seed, rec, { ...ctx, jaOnly: ja });
  return q && !sameAsPrev(q) ? q : null;
}

// 문제은행 문제문의 〔밑줄〕
function underlined(text) {
  const out = [];
  const re = /〔([^〕]+)〕/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(h('u', { class: 'q-u' }, m[1]));
    last = re.lastIndex;
  }
  out.push(text.slice(last));
  return out;
}

// 퀴즈. opts.daily: 今日の一問(건너뛰기 가능), opts.onDone: 끝난 뒤(또는 그만둘 때) — 퀴즈를 시작한 화면으로
export function quizScreen(app, ids, label, opts = {}) {
  const srs = store.srs();
  const n = opts.n || 10;
  const ja = isJa(app);
  const t = (ko, jt) => (ja ? jt : ko);
  let round = 1;
  // 일본어 모드: 일본어만으로 풀 수 있는 유형만 (그런 문제를 못 만들면 전부 허용)
  const set = (list, seed) => {
    const qj = ja ? makeSet(list, n, seed, srs, hasScene, blankOfFirst, true) : [];
    return qj.length ? qj : makeSet(list, n, seed, srs, hasScene, blankOfFirst);
  };
  let qs = set(ids, label + Date.now());
  let i = 0;
  let wrong = [];
  let held = []; // 다른 문제를 만들 수 없어 이번에 다시 묻지 않은 말 (내일 이후 복습에 나온다)
  const log = [];
  const asked = new Map(); // id → 이번 퀴즈에서 그 말로 낸 문제들 (차례대로)
  const usedBank = new Set();
  const body = h('div', { class: 'scroll' });
  const foot = h('div', { class: 'sheet-foot', style: 'position:static' });
  const el = h('div', { class: 'screen quiz' }, body, foot);
  const leave = () => {
    if (opts.daily) store.saveDailyDone(today());
    return opts.onDone ? opts.onDone() : app.back();
  };
  // 틀린 것만 다시: 말마다 지난번과 다른 문제를 만든다
  const buildRetry = () => {
    const out = [];
    const skipped = [];
    [...new Set(wrong)].forEach((id, k) => {
      const q = retryQuestion(id, asked.get(id), `${label}:${round}:${k}:${Date.now()}`, { srs, ja, hasScene: hasScene(id), blank: blankOfFirst(id), usedBank });
      if (q) out.push(q);
      else skipped.push(id);
    });
    return { qs: shuffle({ rng: hashSeed(label + round + Date.now()) }, out), skipped };
  };
  const show = () => {
    body.replaceChildren();
    foot.replaceChildren();
    if (i >= qs.length) return summary();
    const q = qs[i];
    asked.set(q.id, [...(asked.get(q.id) || []), q]);
    if (q.bankId) usedBank.add(q.bankId);
    // 지금 묻는 말·유형 (점검 도구가 읽는다. 정답은 넣지 않는다)
    Object.assign(el.dataset, { qid: q.id, kind: q.kind, bank: q.bankId || '', round: String(round) });
    let answered = false;
    const fb = h('div', { class: 'q-explain', hidden: true });
    const next = h('button', { class: 'btn primary drill-next', type: 'button', hidden: true, onclick: () => { i++; show(); } }, i + 1 < qs.length ? '次へ' : '結果');
    const koOpts = q.kind === 'meaning' || q.kind === 'context' || q.kind === 'gcontext';
    const opt = q.options.map((o, oi) => h('button', { class: 'btn q-opt', type: 'button', lang: koOpts ? 'ko' : 'ja', onclick: (e) => {
      if (answered) return;
      answered = true;
      const ok = oi === q.answer;
      grade(srs, q.id, ok);
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
      log.push({ q, ok, round, pick: o });
      if (!ok) wrong.push(q.id);
      if (!ok && q.bankId) store.addCause(errorCause(q, oi), q.bankId);
      e.currentTarget.classList.add(ok ? 'right' : 'wrong');
      opt[q.answer].classList.add('right');
      const scene = q.kind === 'context' || q.kind === 'gcontext' ? null : firstScene(app, q.id, app.settings.furigana);
      // 한국어 해설: 일본어 모드에서 맞혔을 때는 「解説」을 눌렀을 때만 (틀리면 바로 펼친다)
      const shut = ja && ok;
      const explain = h('div', { class: 'q-ko', hidden: shut }, explainView(q, oi));
      fb.replaceChildren(...[
        h('div', { class: ok ? 'ok-mark' : 'ng-mark' }, ok ? '正解' : '不正解'),
        ja ? h('button', { class: 'mini-btn', type: 'button', onclick: (ev) => { explain.hidden = !explain.hidden; ev.currentTarget.textContent = explain.hidden ? '解説' : '閉じる'; } }, shut ? '解説' : '閉じる') : null,
        explain,
        scene ? h('div', { class: 'v-sec' }, h('h4', null, 'ゲームの場面'), scene) : null,
      ].filter(Boolean));
      fb.hidden = false;
      next.hidden = false;
      // 해설이 먼저 보이게: 초점만 「다음」에 두고 화면은 해설 시작으로
      next.focus({ preventScroll: true });
      fb.scrollIntoView({ block: 'nearest' });
    } }, o));
    const koPrompt = ['word', 'gform', 'gdiff', 'gblank', 'gcontext'].includes(q.kind);
    // 머리줄(위에 붙어 있다): 어디까지 왔나 + 언제든 그만두기 (今日の一問은 아래 「スキップ」)
    const kicker = h('div', { class: 'kicker' }, `${label} · ${round > 1 ? `やり直し ${round - 1} · ` : ''}${i + 1} / ${qs.length}`);
    appendAll(body,
      opts.daily ? kicker : h('div', { class: 'quiz-head' }, kicker, h('button', { class: 'mini-btn quiz-quit', type: 'button', onclick: leave }, t('그만두기', 'やめる'))),
      h('div', { class: 'q-kind' }, kindName(q, ja)),
      q.kind === 'context' || q.kind === 'gcontext' || q.kind === 'gblank' ? h('div', { class: 'q-context' }, firstScene(app, q.id, app.settings.furigana, { noKo: true, blank: q.kind === 'gblank' })) : null,
      h('div', { class: 'q-prompt' + (q.kind === 'grammar' || q.kind === 'bank' ? ' long' : '') + (koPrompt ? ' ko' : ''), lang: koPrompt ? 'ko' : 'ja' }, ja && q.kind === 'gblank' ? '（　）に入る言葉' : q.kind === 'bank' ? underlined(q.prompt) : q.prompt),
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
      return `${x.ok ? '○' : '×'} ${head}${ja ? '' : ' ' + it.m}`;
    };
    // 다시 풀기는 정해진 횟수까지, 원할 때만 (끝내기는 언제나 할 수 있다)
    const next = wrong.length && round <= MAX_RETRY ? buildRetry() : { qs: [], skipped: [] };
    const rest = [...new Set(wrong)];
    const text = [`道場犬 ${label} ${today()}`, `${first.filter((x) => x.ok).length} / ${first.length}`, ...first.map(line), round > 1 ? `やり直し ${round - 1}回 · 残り ${rest.length}` : ''].filter(Boolean).join('\n');
    const pre = h('textarea', { class: 'word-input', rows: '6', readonly: true, id: 'quiz-result', 'aria-label': ja ? '結果' : '결과' }, text);
    const later = rest.length && !next.qs.length;
    appendAll(body,
      h('h2', { class: 'h' }, round === 1 ? '結果' : `やり直し ${round - 1}`),
      h('p', { class: 'big-score' }, `${okN} / ${thisRound.length}`),
      rest.length ? h('div', { class: 'list' }, rest.map((id) => h('div', { class: 'card' }, line({ q: { id }, ok: false })))) : null,
      held.length ? h('p', { class: 'note' }, t(`다른 문제가 없어서 이번에는 다시 묻지 않은 말 ${held.length}개도 다음 복습에 나와요.`, `別の問題がないので今回は出さなかった語 ${held.length}件も、次の復習で出る。`)) : null,
      later ? h('p', { class: 'note' }, t('틀린 말은 내일부터 복습에 다시 나와요.', '間違えた語は、明日からの復習でまた出る。')) : null,
      pre);
    appendAll(foot,
      next.qs.length ? h('button', { class: round === 1 ? 'btn primary' : 'btn center', type: 'button', onclick: () => { round++; qs = next.qs; held = next.skipped; wrong = []; i = 0; show(); } }, `間違いだけ もう一度 · ${next.qs.length}問`) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn center', type: 'button', onclick: async () => {
          try {
            await navigator.clipboard.writeText(text);
            app.toast(ja ? 'コピーした' : '복사함');
          } catch {
            pre.focus();
            pre.select();
            app.toast(ja ? '選んだ文字をコピーしてください' : '선택한 글자를 복사');
          }
        } }, 'コピー'),
        h('button', { class: round > 1 || !next.qs.length ? 'btn primary' : 'btn center', type: 'button', onclick: leave }, opts.daily ? 'はじめる' : t('끝내기', '終わる'))));
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
