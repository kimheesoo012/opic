// 「JLPT N2対策」: 어휘 · 문법 · 문제 연습 · 독해 · 청해 · 약점 · 복습.
// 문제를 풀면 문제 기록(qlog)과 그 문제가 가리키는 어휘·문법의 간격 반복 기록(srs)이 함께 바뀐다(복습 시스템은 하나).
// 정답률은 이 앱 문제에서의 기록일 뿐, 실제 시험 합격 가능성을 계산하지 않는다.
import { VOCAB } from '../data/vocab.js';
import { GRAMMAR } from '../data/grammar.js';
import { N2X, N2X_TAG_KO } from '../data/n2/vocab.js';
import { BANK, BANK_TYPES, PASSAGES } from '../data/n2/bank.js';
import READING from '../data/n2/reading.js';
import LISTENING from '../data/n2/listening.js';
import { grade, meet, mastered, itemOf, priorityIds, priorityOf, PRIORITY_KO, DAY } from '../engine/study.js';
import { hashSeed, shuffle } from '../engine/rng.js';
import { h, LINES, renderExample, renderJa } from './render.js';
import { store } from './store.js';
import { modal, saveWord, wordPopup, grammarPopup } from './vocabui.js';

const TABS = [
  ['home', 'ホーム'], ['vocab', '語彙'], ['grammar', '文法'], ['drill', '問題演習'], ['read', '読解'], ['listen', '聴解'], ['weak', '弱点克服'], ['review', '復習'],
];
const READ_KIND = { short: ['短文', '단문'], medium: ['中文', '중문'], long: ['長文', '장문'], integ: ['統合理解', '통합 이해'], claim: ['主張理解', '주장 이해'], info: ['情報検索', '정보 검색'], game: ['ゲームの文書', '게임 속 글'] };
const LISTEN_KIND = { task: ['課題理解', '과제 이해'], point: ['ポイント理解', '포인트 이해'], gist: ['概要理解', '개요 이해'], quick: ['即時応答', '즉시 응답'], integ: ['統合理解', '통합 이해'] };

// N2 어휘 전체: 게임 어휘 DB의 N2 + 시험 대비 DB
export function n2Words() {
  return Object.keys(VOCAB).filter((k) => VOCAB[k].lv === 'N2');
}
export const n2Grammar = () => Object.keys(GRAMMAR).filter((k) => GRAMMAR[k].lv === 'N2');
// 게임 대사에 실제로 나오는 말인가 (빌드 때 만든 색인)
export const inGame = (key) => !!LINES.vidx[key];

const statusOf = (r) => (!r ? 0 : mastered(r) ? 2 : 1);
const STATUS = ['未学習', '学習中', '定着'];
const dateText = (t) => {
  const d = Math.ceil((t - Date.now()) / DAY);
  return d <= 0 ? '今日' : d === 1 ? '明日' : `${d}日後`;
};
// 〔밑줄〕을 밑줄로
export function richQ(text) {
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
const toggleKo = (koEl, label = '訳') => {
  const b = h('button', { class: 'mini-btn', type: 'button', onclick: () => { koEl.hidden = !koEl.hidden; b.textContent = koEl.hidden ? label : '閉じる'; } }, label);
  return b;
};

// 문제 기록
function logAnswer(qid, type, ok, refs = []) {
  const ql = store.qlog();
  const r = ql[qid] || { ok: 0, ng: 0, t: type };
  if (ok) r.ok++;
  else r.ng++;
  r.last = Date.now();
  r.lastOk = ok;
  ql[qid] = r;
  store.saveQlog(ql);
  if (refs.length) {
    const srs = store.srs();
    for (const id of refs) {
      if (!itemOf(id)) continue;
      meet(srs, id);
      grade(srs, id, ok);
    }
    store.saveSrs(srs);
  }
}

// 유형별 정답률
export function typeStats(ql = store.qlog()) {
  const by = {};
  for (const r of Object.values(ql)) {
    const t = r.t || '?';
    by[t] = by[t] || { ok: 0, ng: 0, n: 0 };
    by[t].ok += r.ok;
    by[t].ng += r.ng;
    by[t].n++;
  }
  return by;
}
const pct = (x) => (x && x.ok + x.ng ? Math.round((x.ok / (x.ok + x.ng)) * 100) : null);

// 연습할 문제 고르기: 지난번에 틀린 것 → 아직 안 푼 것 → 오래전에 푼 것
export function pickBank(type, n = 10, seed = String(Date.now())) {
  const ql = store.qlog();
  const pool = BANK.filter((q) => q.type === type);
  const hh = { rng: hashSeed(seed + type) };
  const score = (q) => {
    const r = ql[q.id];
    if (!r) return 1;
    if (!r.lastOk) return 0;
    return 2 + (r.last || 0) / 1e15;
  };
  const shuffled = shuffle(hh, pool);
  return shuffled.sort((a, b) => score(a) - score(b)).slice(0, n);
}

// ───── 화면 ─────
export function n2Screen(app, tab = 'home', arg) {
  const body = h('div', { class: 'n2-body' });
  const tabs = h('div', { class: 'n2-tabs', role: 'tablist' }, TABS.map(([k, label]) => h('button', { type: 'button', role: 'tab', 'aria-pressed': String(k === tab), onclick: () => (k === 'review' ? app.go('review') : app.go('n2', k)) }, label)));
  const view = { home, vocab, grammar, drill, read, listen, weak }[tab] || home;
  view(app, body, arg);
  return h('div', { class: 'screen n2' },
    h('div', { class: 'scroll' }, h('h2', { class: 'h', lang: 'ja' }, 'JLPT N2対策'), tabs, body),
    h('div', { class: 'sheet-foot', style: 'position:static' }, h('button', { class: 'btn center', type: 'button', onclick: () => app.go('title') }, '戻る')));
}

// 홈: 학습 기록 요약 (합격 예측은 하지 않는다)
export function n2Summary() {
  const srs = store.srs();
  const words = n2Words();
  const gram = n2Grammar();
  const met = (ids) => ids.filter((id) => srs[id]).length;
  const fixed = (ids) => ids.filter((id) => mastered(srs[id])).length;
  const wIds = words.map((k) => 'v:' + k);
  const gIds = gram.map((k) => 'g:' + k);
  const ql = store.qlog();
  const all = Object.values(ql);
  const ok = all.reduce((a, r) => a + r.ok, 0);
  const ng = all.reduce((a, r) => a + r.ng, 0);
  return {
    words: words.length, wordsMet: met(wIds), wordsFixed: fixed(wIds),
    grammar: gram.length, grammarMet: met(gIds), grammarFixed: fixed(gIds),
    answered: ok + ng, accuracy: ok + ng ? Math.round((ok / (ok + ng)) * 100) : null,
    review: priorityIds(srs).length,
  };
}

export function n2SummaryBox(app) {
  const s = n2Summary();
  const cell = (label, value, sub) => h('div', null, h('b', null, label), h('span', null, value), sub ? h('small', null, sub) : null);
  return h('button', { class: 'n2-sum', type: 'button', onclick: () => app.go('n2', 'home') },
    h('div', { class: 'n2-sum-head', lang: 'ja' }, 'JLPT N2対策'),
    h('div', { class: 'prog-grid n2-grid' },
      cell('語彙', `${s.wordsMet}/${s.words}`, `定着 ${s.wordsFixed}`),
      cell('文法', `${s.grammarMet}/${s.grammar}`, `定着 ${s.grammarFixed}`),
      cell('問題', String(s.answered), s.accuracy == null ? '—' : `正答 ${s.accuracy}%`),
      cell('復習', String(s.review), '優先')));
}

function home(app, body) {
  const st = typeStats();
  const s = n2Summary();
  const typeRows = Object.entries(BANK_TYPES).map(([t, [ja, ko]]) => {
    const n = BANK.filter((q) => q.type === t).length;
    const p = pct(st[t]);
    return h('button', { class: 'n2-type', type: 'button', disabled: !n, onclick: () => app.go('n2', 'drill', t) },
      h('span', { lang: 'ja' }, ja), h('small', null, ko), h('b', null, `${n}問`), h('em', null, p == null ? '未挑戦' : `${p}%`));
  });
  body.append(
    n2SummaryBox(app),
    h('h3', { class: 'h', lang: 'ja' }, '問題演習'),
    h('div', { class: 'n2-types' }, typeRows),
    h('div', { class: 'row' },
      h('button', { class: 'btn center', type: 'button', onclick: () => app.go('n2', 'read') }, '読解'),
      h('button', { class: 'btn center', type: 'button', onclick: () => app.go('n2', 'listen') }, '聴解')),
    h('button', { class: 'btn primary', type: 'button', style: 'margin-top:10px', onclick: () => app.go('n2', 'weak') }, '弱点克服'));
}

// ───── 어휘 ─────
function vocab(app, body) {
  const srs = store.srs();
  let tag = 'all';
  let set = 'all';
  let st = 'all';
  let q = '';
  let limit = 60;
  const words = n2Words();
  const list = h('div', { class: 'list n2-list' });
  const count = h('div', { class: 'note' });
  const chip = (label, on, fn) => h('button', { class: 'chip-btn', type: 'button', 'aria-pressed': String(on), onclick: fn }, label);
  const filters = h('div', { class: 'n2-filters' });
  const draw = () => {
    filters.replaceChildren(
      h('div', { class: 'chips' }, [['all', '전체'], ...Object.entries(N2X_TAG_KO), ['game', '게임 대사']].map(([k, l]) => chip(l, tag === k, () => { tag = k; limit = 60; draw(); }))),
      h('div', { class: 'chips' },
        [['all', '전부'], ['game', 'ゲーム語彙'], ['exam', '試験語彙']].map(([k, l]) => chip(l, set === k, () => { set = k; limit = 60; draw(); })),
        [['all', '상태 전부'], ['0', STATUS[0]], ['1', STATUS[1]], ['2', STATUS[2]]].map(([k, l]) => chip(l, st === k, () => { st = k; limit = 60; draw(); }))));
    const hits = words.filter((k) => {
      const v = VOCAB[k];
      if (tag === 'game' ? !(!N2X[k] || inGame(k)) : tag !== 'all' && (!N2X[k] || N2X[k].tag !== tag)) return false;
      if (set === 'game' && !inGame(k)) return false;
      if (set === 'exam' && inGame(k)) return false;
      if (st !== 'all' && String(statusOf(srs['v:' + k])) !== st) return false;
      if (q && !(k.includes(q) || v.r.includes(q) || v.m.includes(q))) return false;
      return true;
    });
    count.textContent = `${hits.length}語`;
    list.replaceChildren(...hits.slice(0, limit).map((k) => {
      const v = VOCAB[k];
      const r = srs['v:' + k];
      return h('button', { class: 'n2-row', type: 'button', onclick: () => vocabDetail(app, k) },
        h('span', { class: 'n2-w', lang: 'ja' }, k), h('span', { class: 'n2-r', lang: 'ja' }, v.r), h('span', { class: 'n2-m' }, v.m),
        h('span', { class: 'n2-st s' + statusOf(r) }, STATUS[statusOf(r)] + (r ? ` · ${dateText(r.due)}` : '')));
    }), hits.length > limit ? h('button', { class: 'btn center', type: 'button', onclick: () => { limit += 100; draw(); } }, `もっと見る（残り ${hits.length - limit}）`) : '');
  };
  const search = h('input', { class: 'word-input', type: 'search', placeholder: '検索（漢字・よみ・뜻）', 'aria-label': '검색', oninput: (e) => { q = e.target.value.trim(); limit = 60; draw(); } });
  draw();
  body.append(search, filters, count, list);
}

export function vocabDetail(app, key) {
  const v = VOCAB[key];
  if (!v) return;
  if (!N2X[key]) return wordPopup(app, key, null, app.settings.furigana);
  const srs = store.srs();
  const r = srs['v:' + key];
  const exKo = h('div', { class: 'ko', hidden: true }, v.exk);
  const words = (arr) => (arr && arr.length ? h('span', { lang: 'ja' }, arr.map((w) => (VOCAB[w] ? `${w}（${VOCAB[w].r}）` : w)).join('、')) : '—');
  const add = h('button', { class: 'btn center', type: 'button', disabled: !!r, onclick: () => { const s2 = store.srs(); meet(s2, 'v:' + key); store.saveSrs(s2); add.disabled = true; add.textContent = '복습 목록에 있음'; } }, r ? '복습 목록에 있음' : '복습 목록에 추가');
  modal(app, key,
    h('div', { class: 'v-head' }, h('span', { class: 'v-word', lang: 'ja' }, key), h('span', { class: 'v-read', lang: 'ja' }, `（${v.r}）`)),
    h('dl', { class: 'kv v-kv' },
      h('dt', null, '뜻'), h('dd', null, v.m),
      h('dt', null, '품사'), h('dd', null, ({ n: v.sn ? 'する명사' : '명사', v: '동사', a: 'い형용사', na: 'な형용사', adv: '부사', exp: '표현' })[v.pos] || '—'),
      h('dt', null, '수준'), h('dd', null, 'N2 추정'),
      h('dt', null, '구분'), h('dd', null, `${inGame(key) ? 'ゲーム語彙' : '試験語彙'} · ${N2X_TAG_KO[v.tag] || ''}`),
      h('dt', null, '유의어'), h('dd', null, words(v.syn)),
      h('dt', null, '반의어'), h('dd', null, words(v.ant)),
      h('dt', null, '헷갈리는 말'), h('dd', null, words(v.conf)),
      v.gram && v.gram.length ? [h('dt', null, '관련 문법'), h('dd', null, v.gram.filter((g) => GRAMMAR[g]).map((g) => h('button', { class: 'chip-btn', type: 'button', lang: 'ja', onclick: () => grammarDetail(app, g) }, GRAMMAR[g].f)))] : null,
      h('dt', null, '학습 상태'), h('dd', null, STATUS[statusOf(r)] + (r ? ` (○${r.ok} ×${r.ng})` : '')),
      h('dt', null, '복습일'), h('dd', null, r ? dateText(r.due) : '—')),
    v.note ? h('div', { class: 'v-sec' }, h('div', { class: 'v-note' }, v.note)) : null,
    h('div', { class: 'v-sec' }, h('h4', null, '例文'), h('div', { class: 'line' }, h('div', { class: 'ja', lang: 'ja' }, renderExample(key, app.settings.furigana)), exKo), h('div', { class: 'tools' }, toggleKo(exKo))),
    h('div', { class: 'row' }, add, h('button', { class: 'btn center', type: 'button', onclick: () => { saveWord(key, null); app.toast('단어장에 저장'); } }, '単語帳')));
}

// ───── 문법 ─────
function grammar(app, body) {
  const srs = store.srs();
  let q = '';
  const list = h('div', { class: 'list n2-list' });
  const keys = Object.keys(GRAMMAR).filter((k) => ['N2', 'N3'].includes(GRAMMAR[k].lv));
  const draw = () => list.replaceChildren(...keys.filter((k) => !q || GRAMMAR[k].f.includes(q) || GRAMMAR[k].m.includes(q)).map((k) => {
    const g = GRAMMAR[k];
    const r = srs['g:' + k];
    return h('button', { class: 'n2-row', type: 'button', onclick: () => grammarDetail(app, k) },
      h('span', { class: 'n2-w', lang: 'ja' }, g.f), h('span', { class: 'n2-m' }, g.m), h('span', { class: 'n2-st s' + statusOf(r) }, `${g.lv} · ${STATUS[statusOf(r)]}`));
  }));
  draw();
  body.append(h('input', { class: 'word-input', type: 'search', placeholder: '検索', 'aria-label': '검색', oninput: (e) => { q = e.target.value.trim(); draw(); } }), h('div', { class: 'note' }, `${keys.length}項目 (N2 ${n2Grammar().length})`), list);
}

export function grammarDetail(app, key) {
  const g = GRAMMAR[key];
  if (!g) return;
  if (!g.use && !g.ex) return grammarPopup(app, key, null, app.settings.furigana);
  const srs = store.srs();
  const r = srs['g:' + key];
  const exs = (g.ex || []).map(([ja, ko]) => {
    const k = h('div', { class: 'ko', hidden: true }, ko);
    return h('div', { class: 'line' }, h('div', { class: 'ja', lang: 'ja' }, renderJa(ja, { s: null, mode: app.settings.furigana })), k, h('div', { class: 'tools' }, toggleKo(k)));
  });
  // 연습 문제 (선택지별 해설)
  const practice = h('div', { class: 'v-sec' });
  if (g.q) {
    const [stem, ans, wrong, explain] = g.q;
    const opts = shuffle({ rng: hashSeed(key + Date.now()) }, [ans, ...wrong]);
    const fb = h('div', { class: 'q-explain', hidden: true });
    const btns = opts.map((o) => h('button', { class: 'btn q-opt', type: 'button', lang: 'ja', onclick: () => {
      if (!fb.hidden) return;
      const ok = o === ans;
      btns.forEach((b, i) => opts[i] === ans && b.classList.add('right'));
      if (!ok) btns[opts.indexOf(o)].classList.add('wrong');
      const s2 = store.srs();
      meet(s2, 'g:' + key);
      grade(s2, 'g:' + key, ok);
      store.saveSrs(s2);
      fb.replaceChildren(h('div', { class: ok ? 'ok-mark' : 'ng-mark' }, ok ? '正解' : '不正解'), h('p', null, explain), g.qx ? h('ul', { class: 'why' }, wrong.map((w, i) => h('li', null, h('b', { lang: 'ja' }, w), ` — ${g.qx[i] || ''}`))) : null);
      fb.hidden = false;
    } }, o));
    practice.append(h('h4', null, '練習'), h('div', { class: 'q-prompt long', lang: 'ja' }, stem.replace('＿＿', '（　　）')), h('div', { class: 'btns' }, btns), fb);
  }
  modal(app, g.f,
    h('div', { class: 'v-head' }, h('span', { class: 'v-word', lang: 'ja' }, g.f)),
    h('dl', { class: 'kv v-kv' },
      h('dt', null, '뜻'), h('dd', null, g.m),
      h('dt', null, '접속'), h('dd', null, g.c),
      h('dt', null, '사용 조건'), h('dd', null, g.use || '—'),
      h('dt', null, '문체'), h('dd', null, g.style || '—'),
      h('dt', null, '수준'), h('dd', null, `${g.lv} 추정`),
      h('dt', null, '학습 상태'), h('dd', null, STATUS[statusOf(r)] + (r ? ` · 복습 ${dateText(r.due)}` : ''))),
    h('div', { class: 'v-sec' }, h('h4', null, '비슷한 문법과의 차이'), h('div', { class: 'v-note' }, g.d)),
    g.err || g.w ? h('div', { class: 'v-sec' }, h('h4', null, '자주 하는 실수'), h('div', { class: 'v-note' }, g.err || g.w)) : null,
    exs.length ? h('div', { class: 'v-sec' }, h('h4', null, '例文'), exs) : null,
    practice);
}

// ───── 문제 연습 ─────
function drill(app, body, type) {
  if (!type) {
    body.append(h('div', { class: 'n2-types' }, Object.entries(BANK_TYPES).map(([t, [ja, ko]]) => h('button', { class: 'n2-type', type: 'button', onclick: () => app.go('n2', 'drill', t) }, h('span', { lang: 'ja' }, ja), h('small', null, ko), h('b', null, `${BANK.filter((q) => q.type === t).length}問`)))));
    return;
  }
  runDrill(app, body, pickBank(type, 10), BANK_TYPES[type][0]);
}

// 문제 묶음 풀기 (문제은행 형식). 정답 뒤 선택지마다 해설, 문제문 해석은 「訳」.
export function runDrill(app, body, qs, label, onDone) {
  let i = 0;
  let okN = 0;
  const wrong = [];
  const box = h('div');
  body.replaceChildren(box);
  const show = () => {
    box.replaceChildren();
    if (i >= qs.length) {
      box.append(h('h3', { class: 'h' }, '結果'), h('p', { class: 'big-score' }, `${okN} / ${qs.length}`),
        wrong.length ? h('div', { class: 'list' }, wrong.map((q) => h('div', { class: 'card', lang: 'ja' }, ...richQ(q.q.replace(/\n/g, ' ')), h('div', { class: 'note' }, `正解: ${q.opts[q.a]}`)))) : null,
        wrong.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => runDrill(app, body, [...wrong], label + '・やり直し', onDone) }, '間違いだけ もう一度') : null,
        h('button', { class: 'btn center', type: 'button', style: 'margin-top:8px', onclick: () => (onDone ? onDone() : app.go('n2', 'drill')) }, '戻る'));
      return;
    }
    const q = qs[i];
    const ko = h('div', { class: 'ko', hidden: true }, q.ko || '');
    const fb = h('div', { class: 'q-explain', hidden: true });
    const next = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: () => { i++; show(); } }, i + 1 < qs.length ? '次へ' : '結果');
    let done = false;
    const btns = q.opts.map((o, oi) => h('button', { class: 'btn q-opt', type: 'button', lang: 'ja', onclick: () => {
      if (done) return;
      done = true;
      const ok = oi === q.a;
      if (ok) okN++;
      else wrong.push(q);
      logAnswer(q.id, q.type, ok, q.ref || []);
      btns[q.a].classList.add('right');
      if (!ok) btns[oi].classList.add('wrong');
      fb.replaceChildren(h('div', { class: ok ? 'ok-mark' : 'ng-mark' }, ok ? '正解' : '不正解'),
        h('ul', { class: 'why' }, q.opts.map((op, k) => h('li', { class: k === q.a ? 'ans' : null }, h('b', { lang: 'ja' }, `${k + 1}. ${op}`), ` — ${(q.why || [])[k] || ''}`))),
        (q.ref || []).filter((id) => itemOf(id)).length ? h('div', { class: 'chips' }, q.ref.filter((id) => itemOf(id)).map((id) => h('button', { class: 'chip-btn', type: 'button', lang: 'ja', onclick: () => (id[0] === 'g' ? grammarDetail(app, id.slice(2)) : vocabDetail(app, id.slice(2))) }, id[0] === 'g' ? GRAMMAR[id.slice(2)].f : id.slice(2)))) : null);
      fb.hidden = false;
      next.hidden = false;
      fb.scrollIntoView({ block: 'nearest' });
    } }, `${oi + 1}. ${o}`));
    const passage = q.pid && PASSAGES[q.pid];
    const pko = passage ? h('div', { class: 'ko', hidden: true }, passage.ko) : null;
    box.append(
      h('div', { class: 'kicker' }, `${label} · ${i + 1} / ${qs.length}`),
      h('div', { class: 'q-kind', lang: 'ja' }, (BANK_TYPES[q.type] || [q.type])[0]),
      passage ? h('div', { class: 'card passage', lang: 'ja' }, passage.text.split('\n').map((p) => h('p', null, p)), pko, h('div', { class: 'tools' }, toggleKo(pko, '本文の訳'))) : null,
      h('div', { class: 'q-prompt long', lang: 'ja' }, q.q.split('\n').map((line) => h('div', null, ...richQ(line)))),
      ko, h('div', { class: 'tools' }, toggleKo(ko)),
      h('div', { class: 'btns' }, btns), fb, next);
  };
  show();
}

// ───── 독해 ─────
function read(app, body, id) {
  const p = id && READING.find((x) => x.id === id);
  if (!p) {
    const ql = store.qlog();
    for (const [k, [ja, ko]] of Object.entries(READ_KIND)) {
      const items = READING.filter((x) => x.kind === k);
      if (!items.length) continue;
      body.append(h('h3', { class: 'h' }, `${ja} `, h('small', null, ko)),
        h('div', { class: 'list n2-list' }, items.map((x) => {
          const done = x.qs.filter((_, i) => ql[`${x.id}#${i}`]).length;
          return h('button', { class: 'n2-row', type: 'button', onclick: () => app.go('n2', 'read', x.id) }, h('span', { class: 'n2-w', lang: 'ja' }, x.title), h('span', { class: 'n2-m' }, x.titleKo), h('span', { class: 'n2-st' }, `${done}/${x.qs.length}`));
        })));
    }
    return;
  }
  const paras = (t) => String(t || '').split(/\n\n+/);
  const block = (ja, ko, label) => {
    const jp = paras(ja);
    const kp = paras(ko);
    const aligned = jp.length === kp.length;
    const kos = [];
    const el = h('div', { class: 'card passage', lang: 'ja' }, label ? h('div', { class: 'kicker' }, label) : null, jp.map((x, i) => {
      const k = h('div', { class: 'ko', hidden: true }, aligned ? kp[i] : '');
      kos.push(k);
      return [h('p', null, x.split('\n').map((l, j) => [j ? h('br') : null, l])), k];
    }));
    if (!aligned) {
      const k = h('div', { class: 'ko', hidden: true }, ko);
      kos.push(k);
      el.append(k);
    }
    el.append(h('div', { class: 'tools' }, h('button', { class: 'mini-btn', type: 'button', onclick: (e) => { const on = kos[0].hidden; kos.forEach((k) => (k.hidden = !on)); e.currentTarget.textContent = on ? '閉じる' : '訳'; } }, '訳')));
    return el;
  };
  body.append(h('div', { class: 'kicker' }, `${READ_KIND[p.kind][0]} · ${p.titleKo}`), h('h3', { class: 'h', lang: 'ja' }, p.title),
    block(p.text, p.ko, p.textB ? 'A' : null), p.textB ? block(p.textB, p.koB, 'B') : null);
  const qbox = h('div');
  body.append(qbox);
  runDrill(app, qbox, p.qs.map((x, i) => ({ ...x, id: `${p.id}#${i}`, type: 'read-' + p.kind, ko: x.qKo, ref: [] })), READ_KIND[p.kind][0], () => app.go('n2', 'read'));
}

// ───── 청해 (브라우저 음성 합성) ─────
function voices() {
  try {
    return (window.speechSynthesis && speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang))) || [];
  } catch {
    return [];
  }
}
function speakLines(lines, onEnd) {
  const synth = window.speechSynthesis;
  if (!synth) return false;
  synth.cancel();
  const vs = voices();
  const pickV = (sp) => (vs.length ? vs[(sp === '男' ? 1 : 0) % vs.length] : null);
  lines.forEach(([sp, text], i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    const v = pickV(sp);
    if (v) u.voice = v;
    u.rate = 0.95;
    u.pitch = sp === '男' ? 0.75 : sp === '女' ? 1.25 : 1;
    if (i === lines.length - 1 && onEnd) u.onend = onEnd;
    synth.speak(u);
  });
  return true;
}

function listen(app, body, id) {
  const item = id && LISTENING.find((x) => x.id === id);
  if (!item) {
    body.append(h('p', { class: 'note' }, '음성은 브라우저 읽기 기능이라 실제 시험 음원과 다릅니다.'));
    const ql = store.qlog();
    for (const [k, [ja, ko]] of Object.entries(LISTEN_KIND)) {
      const items = LISTENING.filter((x) => x.kind === k);
      if (!items.length) continue;
      body.append(h('h3', { class: 'h' }, `${ja} `, h('small', null, ko)),
        h('div', { class: 'list n2-list' }, items.map((x) => h('button', { class: 'n2-row', type: 'button', onclick: () => app.go('n2', 'listen', x.id) }, h('span', { class: 'n2-w', lang: 'ja' }, x.title), h('span', { class: 'n2-m' }, x.titleKo), h('span', { class: 'n2-st' }, ql[x.id] ? (ql[x.id].lastOk ? '○' : '×') : '')))));
    }
    return;
  }
  const canSpeak = !!window.speechSynthesis;
  const script = h('div', { class: 'card script', hidden: canSpeak, lang: 'ja' }, item.lines.map(([sp, t], i) => h('div', { class: 'line' }, h('div', { class: 'sp' }, sp), h('div', { class: 'ja' }, t), h('div', { class: 'ko', hidden: true }, (item.ko[i] || [])[1] || ''))));
  const all = [...(item.lead ? [['ナ', item.lead]] : []), ...item.lines, ...(item.kind === 'quick' ? [] : [['ナ', item.q]])];
  const play = h('button', { class: 'btn primary', type: 'button', disabled: !canSpeak, onclick: () => { play.textContent = '再生中…'; speakLines(all, () => (play.textContent = 'もう一度聞く')); } }, canSpeak ? '▶ 聞く' : '음성 합성을 쓸 수 없음');
  const showScript = h('button', { class: 'btn center', type: 'button', onclick: () => { script.hidden = !script.hidden; } }, 'スクリプト');
  const showKo = h('button', { class: 'btn center', type: 'button', onclick: () => { script.hidden = false; script.querySelectorAll('.ko').forEach((k) => (k.hidden = !k.hidden)); } }, '訳');
  const qbox = h('div');
  body.append(h('div', { class: 'kicker' }, `${LISTEN_KIND[item.kind][0]} · ${item.titleKo}`), h('h3', { class: 'h', lang: 'ja' }, item.title),
    item.lead ? h('p', { class: 'q-prompt long', lang: 'ja' }, item.lead) : null,
    h('div', { class: 'row' }, play, showScript, showKo), script, qbox);
  runDrill(app, qbox, [{ id: item.id, type: 'listen-' + item.kind, q: item.kind === 'quick' ? '最もよい返事を選んでください。' : item.q, opts: item.opts, a: item.a, why: item.why, ko: '', ref: [] }], LISTEN_KIND[item.kind][0], () => {
    if (window.speechSynthesis) speechSynthesis.cancel();
    app.go('n2', 'listen');
  });
}

// ───── 약점 ─────
function weak(app, body) {
  const st = typeStats();
  const srs = store.srs();
  const rows = Object.entries(st).filter(([, x]) => x.ok + x.ng >= 3).map(([t, x]) => ({ t, p: pct(x), n: x.ok + x.ng })).sort((a, b) => a.p - b.p);
  const name = (t) => (BANK_TYPES[t] ? BANK_TYPES[t][0] : t.startsWith('read-') ? '読解・' + (READ_KIND[t.slice(5)] || [''])[0] : t.startsWith('listen-') ? '聴解・' + (LISTEN_KIND[t.slice(7)] || [''])[0] : t);
  body.append(h('h3', { class: 'h' }, '유형별 정답률'),
    rows.length ? h('div', { class: 'list' }, rows.map((r) => h('div', { class: 'card weak-row' }, h('span', { lang: 'ja' }, name(r.t)), h('b', null, `${r.p}%`), h('small', null, `${r.n}問`),
      BANK_TYPES[r.t] ? h('button', { class: 'mini-btn', type: 'button', onclick: () => app.go('n2', 'drill', r.t) }, '練習') : null))) : h('p', { class: 'note' }, '3문제 이상 풀면 표시됩니다.'));
  const ids = priorityIds(srs).slice(0, 30);
  const groups = {};
  for (const id of ids) (groups[priorityOf(srs[id])] = groups[priorityOf(srs[id])] || []).push(id);
  body.append(h('h3', { class: 'h' }, '우선 복습할 말'),
    ids.length ? h('div', { class: 'list' }, Object.entries(groups).map(([p, list]) => h('div', { class: 'card' }, h('div', { class: 'kicker' }, PRIORITY_KO[p] || '복습'), h('div', { class: 'chips' }, list.map((id) => {
      const it = itemOf(id);
      return h('button', { class: 'chip-btn', type: 'button', lang: 'ja', onclick: () => (id[0] === 'g' ? grammarDetail(app, it.key) : vocabDetail(app, it.key)) }, it.type === 'g' ? it.f : it.key);
    }))))) : h('p', { class: 'note' }, '아직 없습니다.'),
    ids.length ? h('button', { class: 'btn primary', type: 'button', style: 'margin-top:10px', onclick: () => app.startQuiz(ids.slice(0, 15), '弱点') }, '弱点 15問') : null);
}

export { TABS };
