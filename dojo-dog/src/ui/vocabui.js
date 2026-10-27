// 단어·문법 팝업. DB(vocab_*.js, grammar.js)에 있는 내용만 보여 준다.
import { VOCAB, REL } from '../data/vocab.js';
import { sceneOf, firstSceneOf } from './scenes.js';
import { GRAMMAR } from '../data/grammar.js';
import { h, renderExample, renderJa, renderSpeaker, LINES } from './render.js';
import { store } from './store.js';

const POS = { n: '명사', v: '동사', a: 'い형용사', na: 'な형용사', adv: '부사', exp: '표현' };

export function levelLabel(lv) {
  return lv === '범위 밖' ? '검도 용어' : `${lv} 추정`;
}

// 단어장: { 'key' | 'g:key': { key, at, n, last, scenes: [{ja, ko, sp, title, when}] } }
export function saveWord(key, scene) {
  const wb = store.wordbook();
  const e = wb[key] || { key, at: Date.now(), n: 0, scenes: [] };
  e.n++;
  e.last = Date.now();
  if (scene && scene.ja && !e.scenes.some((x) => x.ja === scene.ja)) {
    e.scenes.unshift({ ja: scene.ja, ko: scene.ko, sp: scene.sp, title: scene.title, when: scene.when, tpl: scene.tpl, role: scene.role });
    e.scenes = e.scenes.slice(0, 3);
  }
  wb[key] = e;
  store.saveWordbook(wb);
  return e;
}

// 게임 속 첫 장면 (DB 예문과 별개로, 이 말이 처음 나온 대사)
// 복습 해설용: 이 말을 만난 장면(단어장에 저장된 장면 → 없으면 처음 나온 대사)의 문장·해석·상황
export function firstScene(app, id, mode, opts = {}) {
  const s = app.state || app.refState();
  const wb = store.wordbook()[id[0] === 'g' ? id : id.slice(2)];
  const saved = wb && wb.scenes && wb.scenes.find((x) => x.tpl);
  const info = saved ? { ...(sceneOf(saved.tpl, s) || {}), ...saved } : firstSceneOf(id, s);
  if (!info || !info.tpl) return null;
  const ko = h('div', { class: 'ko', hidden: true }, info.ko);
  return h('div', null,
    h('div', { class: 'line' }, h('div', { class: 'ja' }, renderJa(info.tpl, { s, speaker: info.role, mode, targets: new Set([id]) })), ko),
    h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'note' }, info.situation || ''), opts.noKo ? null : koToggle(ko)));
}

function koToggle(koEl) {
  let on = false;
  return h('button', { class: 'mini-btn', type: 'button', onclick: (e) => { on = !on; koEl.hidden = !on; e.currentTarget.textContent = on ? '번역 닫기' : '번역'; } }, '번역');
}

// 게임 속 문장 · 해석 · 상황
function sceneBlock(app, scene, id, mode) {
  const s = app.state || app.refState();
  const info = scene && scene.tpl ? { ...(sceneOf(scene.tpl, s) || {}), ...scene } : firstSceneOf(id, s);
  if (!info || !info.tpl) return null;
  const situ = info.situation || (sceneOf(info.tpl, s) || {}).situation;
  return h('div', { class: 'v-sec' },
    h('h4', null, '게임 속 문장'),
    h('div', { class: 'line' },
      h('div', { class: 'ja' }, renderJa(info.tpl, { s, speaker: info.role, mode, targets: new Set([id]) })),
      h('div', { class: 'ko' }, info.ko)),
    situ ? h('div', { class: 'note' }, situ) : null);
}

// 관련 표현: 사람이 고른 짝(반대말·짝말)만. 같은 한자라는 이유만으로 묶지 않는다.
function related(key) {
  return (REL[key] || []).filter((w) => VOCAB[w]).slice(0, 3);
}

function saveButton(key, scene) {
  const wb = store.wordbook();
  let saved = !!wb[key];
  const b = h('button', { class: 'btn center save-btn', type: 'button', 'aria-pressed': String(saved), onclick: () => {
    if (saved) {
      const w = store.wordbook();
      delete w[key];
      store.saveWordbook(w);
    } else saveWord(key, scene);
    saved = !saved;
    b.setAttribute('aria-pressed', String(saved));
    b.textContent = saved ? '단어장에 저장됨' : '단어장 저장';
  } }, saved ? '단어장에 저장됨' : '단어장 저장');
  return b;
}

function modal(app, label, ...kids) {
  const close = () => back.remove();
  const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && close() },
    h('div', { class: 'modal', role: 'dialog', 'aria-label': label }, ...kids, h('button', { class: 'btn primary close-btn', type: 'button', onclick: close }, '閉じる')));
  app.root.append(back);
  back.querySelector('.close-btn').focus();
}

// 단어를 탭하면 보이는 창. 저장은 「단어장 저장」을 눌렀을 때만.
export function wordPopup(app, key, scene, mode) {
  const v = VOCAB[key];
  if (!v) return;
  app.onWordSaved && app.onWordSaved(key);
  const exKo = h('div', { class: 'ko', hidden: true }, v.exk);
  const rel = related(key);
  modal(app, key,
    h('div', { class: 'v-head' }, h('span', { class: 'v-word', lang: 'ja' }, key), h('span', { class: 'v-read', lang: 'ja' }, `（${v.r}）`)),
    h('dl', { class: 'kv v-kv' },
      h('dt', null, '뜻'), h('dd', null, v.m),
      h('dt', null, '품사'), h('dd', null, POS[v.pos] || '—'),
      h('dt', null, '수준'), h('dd', null, levelLabel(v.lv))),
    v.note ? h('div', { class: 'v-sec' }, h('div', { class: 'v-note' }, v.note)) : null,
    sceneBlock(app, scene, 'v:' + key, mode),
    rel.length ? h('div', { class: 'v-sec' }, h('h4', null, '관련 표현'), h('ul', { class: 'rel' }, rel.map((w) => h('li', null, h('span', { lang: 'ja' }, `${w}（${VOCAB[w].r}）`), ` — ${VOCAB[w].m}`)))) : null,
    h('div', { class: 'v-sec' }, h('h4', null, '例文'), h('div', { class: 'line' }, h('div', { class: 'ja' }, renderExample(key, mode)), exKo), h('div', { class: 'tools' }, koToggle(exKo))),
    saveButton(key, scene));
}

export function grammarPopup(app, key, scene, mode) {
  const g = GRAMMAR[key];
  if (!g) return;
  modal(app, g.f,
    h('div', { class: 'v-head' }, h('span', { class: 'v-word', lang: 'ja' }, g.f)),
    h('dl', { class: 'kv v-kv' },
      h('dt', null, '뜻'), h('dd', null, g.m),
      h('dt', null, '접속'), h('dd', null, g.c),
      h('dt', null, '수준'), h('dd', null, levelLabel(g.lv))),
    sceneBlock(app, scene, 'g:' + key, mode),
    h('div', { class: 'v-sec' }, h('h4', null, '비슷한 문법과의 차이'), h('div', { class: 'v-note' }, g.d)),
    h('div', { class: 'v-sec' }, h('h4', null, '주의할 점'), h('div', { class: 'v-note' }, g.w)),
    saveButton('g:' + key, scene));
}

export function speakerLabel(sp, s, mode) {
  return renderSpeaker(sp, s, mode);
}
