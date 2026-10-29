// 漢字 탭: N2 어휘에 나오는 한자 목록 → 한자 풀이(읽기별 단어) → 한자 연습. 해설의 한자 칩을 탭하면 풀이 창이 열린다.
import { VOCAB } from '../data/vocab.js';
import { KANJI } from '../data/kanji.js';
import { h } from './render.js';
import { store } from './store.js';
import { modal, uiJa } from './vocabui.js';
import { explainView, setKanjiHandler } from './explainui.js';
import { mastered } from '../engine/study.js';
import { kanjiIndex, kanjiList, readingGroups, koNote, koSound, kanjiSet, gradeKanji, weakKanji, seenKanji } from '../engine/kanjistudy.js';
import { metEntries } from './studyui.js';

const tt = (ko, ja) => (uiJa() ? ja : ko);
const add = (el, ...kids) => el.append(...kids.flat(Infinity).filter((x) => x != null && x !== false));
const chip = (label, on, fn) => h('button', { class: 'chip-btn', type: 'button', 'aria-pressed': String(on), onclick: fn }, label);
const toKata = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

// 단어의 학습 상태: 2 定着 / 1 学習中 / 0.5 出会った / 0 없음
function wordState(w, srs, met) {
  const r = srs['v:' + w];
  if (r) return mastered(r) ? 2 : 1;
  return met['v:' + w] ? 0.5 : 0;
}
const STATE_LABEL = () => ({ 2: tt('익힘', '定着'), 1: tt('학습 중', '学習中'), 0.5: tt('만남', '出会った') });

// 해설 창이나 다른 화면에서 한자 칩을 탭하면: 같은 풀이를 창으로
setKanjiHandler((c) => {
  const app = globalThis.__dojoinu;
  if (!app || !KANJI[c]) return;
  const box = h('div', { class: 'kj-detail' });
  kanjiDetail(app, box, c, { inModal: true });
  modal(app, c, box);
});

// ───── 탭 ─────
// arg: 없음 → 목록 · 한자 한 글자 → 풀이 · '@seen' / '@weak' / '@<글자>' → 연습
export function kanjiTab(app, body, arg) {
  if (arg && arg[0] === '@') return practice(app, body, arg.slice(1));
  if (arg && kanjiIndex()[arg]) return kanjiDetail(app, body, arg);
  return kanjiListView(app, body);
}

function kanjiListView(app, body) {
  const idx = kanjiIndex();
  const all = kanjiList();
  const srs = store.srs();
  const met = store.met();
  const rec = store.kanji();
  const seen = seenKanji(metEntries(srs, met).map((x) => x.id));
  const seenRank = new Map(seen.map((c, i) => [c, i]));
  const weak = weakKanji(rec);
  let sort = 'count';
  let q = '';
  let limit = 120;
  const list = h('div', { class: 'kj-grid' });
  const count = h('div', { class: 'note' });
  const sorts = h('div', { class: 'chips' });
  const draw = () => {
    sorts.replaceChildren(...[['count', tt('단어 많은 순', '単語が多い順')], ['seen', tt('만난 순', '出会った順')], ['ko', tt('한국 음 순', '韓国音順')]].map(([k, l]) => chip(l, sort === k, () => { sort = k; limit = 120; draw(); })));
    const qh = toHira(q);
    let hits = all.filter((c) => {
      if (!q) return true;
      const k = KANJI[c];
      return c === q || q.includes(c) || k.ko.includes(q) || (qh && k.on.some((o) => o.startsWith(qh)));
    });
    if (sort === 'seen') hits = hits.filter((c) => seenRank.has(c)).sort((a, b) => seenRank.get(a) - seenRank.get(b));
    if (sort === 'ko') hits = [...hits].sort((a, b) => (koSound(a) || '힣').localeCompare(koSound(b) || '힣', 'ko') || idx[b].n2.length - idx[a].n2.length);
    count.textContent = `${hits.length}${tt('자', '字')}` + (sort === 'seen' && !hits.length ? ` · ${tt('장면에서 단어를 만나면 여기에 쌓여요.', '場面で単語に出会うとここにたまる。')}` : '');
    list.replaceChildren(...hits.slice(0, limit).map((c) => {
      const k = KANJI[c];
      const r = rec[c];
      return h('button', { class: 'kj-card' + (r && r.ng && !r.lastOk ? ' ng' : ''), type: 'button', onclick: () => app.go('n2', 'kanji', c), 'aria-label': `${c} ${k.ko}` },
        h('span', { class: 'kj-c', lang: 'ja' }, c),
        h('span', { class: 'kj-ko' }, k.ko),
        h('span', { class: 'kj-on', lang: 'ja' }, k.on.slice(0, 3).map(toKata).join('・') || '—'),
        h('span', { class: 'kj-n' }, `${idx[c].n2.length}${tt('단어', '語')}`));
    }));
    if (hits.length > limit) list.append(h('button', { class: 'btn center kj-more', type: 'button', onclick: () => { limit += 200; draw(); } }, `もっと見る（残り ${hits.length - limit}）`));
  };
  const search = h('input', { class: 'word-input', type: 'search', placeholder: tt('검색（漢字・훈음・よみ）', '検索（漢字・訓音・よみ）'), 'aria-label': '検索', oninput: (e) => { q = e.target.value.trim(); limit = 120; draw(); } });
  draw();
  add(body,
    h('p', { class: 'note' }, tt('N2 단어에 나오는 한자예요. 한자를 누르면 읽기별로 단어가 모여 있어요.', 'N2の単語に出てくる漢字。押すと読み方ごとに単語が並ぶ。')),
    h('div', { class: 'row kj-practice-row' },
      h('button', { class: 'btn primary center', type: 'button', onclick: () => app.go('n2', 'kanji', '@seen') }, tt('많이 본 한자 10', 'よく見た漢字10')),
      h('button', { class: 'btn center', type: 'button', disabled: !weak.length, onclick: () => app.go('n2', 'kanji', '@weak') }, tt(`틀린 한자 ${weak.length}`, `間違えた漢字 ${weak.length}`))),
    search, sorts, count, list);
}

// ───── 한자 풀이 ─────
export function kanjiDetail(app, body, c, { inModal = false } = {}) {
  const k = KANJI[c];
  const groups = readingGroups(c);
  const srs = store.srs();
  const met = store.met();
  const rec = store.kanji()[c];
  const labels = STATE_LABEL();
  const notes = [...new Set(groups.filter((g) => g.r).map((g) => g.r.replace(/っ$/, '')))].map((r) => koNote(c, r)).filter(Boolean);
  const n2n = (kanjiIndex()[c] || { n2: [] }).n2.length;
  add(body,
    h('div', { class: 'kj-head' },
      h('div', { class: 'kj-big', lang: 'ja' }, c),
      h('div', { class: 'kj-meta' },
        h('div', { class: 'kj-hun' }, k.ko),
        h('div', { class: 'kj-ons', lang: 'ja' }, h('span', { class: 'kj-tag' }, tt('음독', '音読み')), k.on.length ? k.on.map((o) => `${o}（${toKata(o)}）`).join('　') : '—'),
        h('div', { class: 'note' }, `N2 ${n2n}${tt('단어', '語')}` + (rec ? ` · ${tt('연습', '練習')} ○${rec.ok} ×${rec.ng}` : '')))),
    notes.length && !uiJa() ? h('div', { class: 'kj-note' }, notes.slice(0, 2).map((n) => h('p', null, n.text))) : null,
    notes.length && uiJa() ? h('p', { class: 'note kj-note' }, notes.slice(0, 2).map((n) => `韓国音 ${n.ko} → ${n.r}`).join(' / ')) : null,
    h('button', { class: 'btn primary center', type: 'button', onclick: () => { if (inModal) { const b = document.querySelector('.modal-back'); if (b) b.remove(); } app.go('n2', 'kanji', '@' + c); } }, tt(`${c} 연습하기`, `「${c}」を練習する`)),
    groups.map((g) => h('section', { class: 'kj-group' },
      h('h3', { class: 'h kj-gh' }, g.r ? h('span', { lang: 'ja' }, `${c} ＝ ${g.r}`) : h('span', null, tt('훈독·기타', '訓読み・その他')), h('small', null, `${g.words.length}${tt('단어', '語')}`)),
      h('div', { class: 'kj-words' }, g.words.map((w) => {
        const v = VOCAB[w];
        const st = wordState(w, srs, met);
        return h('button', { class: 'kj-word' + (st ? ' met' : ''), type: 'button', onclick: () => app.openWord(w, null) },
          h('span', { class: 'kj-ww', lang: 'ja' }, ...[...w].map((ch) => (ch === c ? h('mark', null, ch) : ch))),
          h('span', { class: 'kj-wr', lang: 'ja' }, v.r),
          h('span', { class: 'kj-wm' }, v.m),
          h('span', { class: 'kj-wst' + (st ? ' s' + Math.ceil(st) : '') }, st ? labels[st] : v.lv || ''));
      })))),
    inModal ? null : h('button', { class: 'btn center', type: 'button', style: 'margin-top:12px', onclick: () => app.go('n2', 'kanji') }, tt('한자 목록', '漢字一覧')));
}

// ───── 연습 ─────
const KIND_LABEL = { reading: ['이 단어에서 이 한자의 읽기', 'この語でのこの漢字の読み'], word: ['이 한자를 쓰는 말', 'この漢字を使う語'], kanji: ['훈음에 맞는 한자', '訓音に合う漢字'] };
function practice(app, body, which) {
  let chars;
  let label;
  if (which === 'weak') { chars = weakKanji(store.kanji()).slice(0, 10); label = tt('틀린 한자', '間違えた漢字'); }
  else if (which === 'seen' || !which) {
    chars = seenKanji(metEntries().map((x) => x.id)).slice(0, 10);
    if (chars.length < 10) chars = [...chars, ...kanjiList().filter((c) => !chars.includes(c))].slice(0, 10);
    label = tt('많이 본 한자', 'よく見た漢字');
  } else { chars = [which]; label = which; }
  const qs = kanjiSet(chars, 10, String(Date.now()));
  if (!qs.length) {
    add(body, h('p', { class: 'note' }, tt('이 한자로 낼 수 있는 문제가 아직 없어요.', 'この漢字で出せる問題がまだない。')), h('button', { class: 'btn center', type: 'button', onclick: () => app.go('n2', 'kanji') }, '戻る'));
    return;
  }
  let i = 0;
  let okN = 0;
  const wrong = [];
  const box = h('div', { class: 'kj-quiz' });
  body.replaceChildren(box);
  const show = () => {
    box.replaceChildren();
    if (i >= qs.length) {
      add(box, h('h3', { class: 'h' }, '結果'), h('p', { class: 'big-score' }, `${okN} / ${qs.length}`),
        wrong.length ? h('div', { class: 'chips' }, h('span', { class: 'chips-label' }, tt('틀린 한자', '間違えた漢字')), [...new Set(wrong.map((q) => q.c))].map((c) => h('button', { class: 'chip-btn kj-chip', type: 'button', lang: 'ja', onclick: () => app.go('n2', 'kanji', c) }, c))) : null,
        h('div', { class: 'row', style: 'margin-top:10px' },
          h('button', { class: 'btn primary center', type: 'button', onclick: () => practice(app, body, which) }, tt('한 번 더', 'もう一度')),
          h('button', { class: 'btn center', type: 'button', onclick: () => app.go('n2', 'kanji', chars.length === 1 ? chars[0] : undefined) }, '戻る')));
      return;
    }
    const q = qs[i];
    const fb = h('div', { class: 'q-explain', hidden: true });
    const next = h('button', { class: 'btn primary drill-next', type: 'button', hidden: true, onclick: () => { i++; show(); } }, i + 1 < qs.length ? '次へ' : '結果');
    let done = false;
    const btns = q.options.map((o, oi) => h('button', { class: 'btn q-opt' + (q.kind === 'kanji' ? ' kj-opt' : ''), type: 'button', lang: 'ja', onclick: () => {
      if (done) return;
      done = true;
      const ok = oi === q.answer;
      if (ok) okN++;
      else wrong.push(q);
      store.saveKanji(gradeKanji(store.kanji(), q.c, ok));
      btns[q.answer].classList.add('right');
      if (!ok) btns[oi].classList.add('wrong');
      const ex = explainView(q, oi);
      fb.replaceChildren();
      add(fb, h('div', { class: ok ? 'ok-mark' : 'ng-mark' }, ok ? '正解' : '不正解'), uiJa() ? jaFold(!ok, ex) : ex,
        h('div', { class: 'chips' }, h('button', { class: 'chip-btn kj-chip', type: 'button', lang: 'ja', onclick: () => app.go('n2', 'kanji', q.c) }, `${q.c} ${tt('풀이 보기', 'をくわしく')}`)));
      fb.hidden = false;
      next.hidden = false;
      fb.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } }, o));
    const [ko, ja] = KIND_LABEL[q.kind];
    let prompt;
    if (q.kind === 'reading') prompt = h('div', { class: 'q-prompt kj-prompt', lang: 'ja' }, ...[...q.word].map((ch) => (ch === q.c ? h('mark', null, ch) : ch)), h('div', { class: 'kj-ask' }, `「${q.c}」の読み方は？`));
    else if (q.kind === 'word') prompt = h('div', { class: 'q-prompt kj-prompt' }, h('div', { class: 'kj-mean' }, `「${q.meaning}」`), h('div', { class: 'kj-ask', lang: 'ja' }, `「${q.c}」を使うこの意味の語は？`));
    else prompt = h('div', { class: 'q-prompt kj-prompt' }, h('div', { class: 'kj-mean' }, `「${q.ko}」`), h('div', { class: 'kj-ask', lang: 'ja' }, 'この訓音の漢字は？'));
    add(box,
      h('div', { class: 'kicker' }, `${label} · ${i + 1} / ${qs.length}`),
      h('div', { class: 'q-kind' }, h('span', { lang: 'ja' }, ja), uiJa() ? null : h('small', null, ' ' + ko)),
      prompt, h('div', { class: 'btns' }, btns), fb, next);
  };
  show();
}
// 일본어 모드: 한국어 해설은 「解説」 단추 뒤에 (틀렸을 때는 펼쳐 둔다)
function jaFold(open, kids) {
  const box = h('div', { class: 'q-ko', hidden: !open }, ...kids);
  const b = h('button', { class: 'mini-btn', type: 'button', onclick: () => { box.hidden = !box.hidden; b.textContent = box.hidden ? '解説' : '閉じる'; } }, open ? '閉じる' : '解説');
  return [b, box];
}
