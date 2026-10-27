// 단어·문법 팝업. DB(vocab_*.js, grammar.js)에 있는 내용만 보여 준다.
import { VOCAB } from '../data/vocab.js';
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
    e.scenes.unshift({ ja: scene.ja, ko: scene.ko, sp: scene.sp, title: scene.title, when: scene.when });
    e.scenes = e.scenes.slice(0, 3);
  }
  wb[key] = e;
  store.saveWordbook(wb);
  return e;
}

// 게임 속 첫 장면 (DB 예문과 별개로, 이 말이 처음 나온 대사)
export function firstScene(app, id, mode) {
  const ref = id.startsWith('g:') ? LINES.gidx[id.slice(2)] : LINES.vidx[id.slice(2)];
  if (!ref) return null;
  const s = app.refState();
  return h('div', { class: 'line' }, h('div', { class: 'ja' }, renderJa(ref.tpl, { s, mode, targets: new Set([id]) })));
}

function koToggle(koEl) {
  let on = false;
  return h('button', { class: 'mini-btn', type: 'button', onclick: (e) => { on = !on; koEl.hidden = !on; e.currentTarget.textContent = on ? '번역 닫기' : '번역'; } }, '번역');
}

function sceneBlock(app, scene, mode) {
  if (!scene || !scene.tpl) return null;
  const ko = h('div', { class: 'ko', hidden: true }, scene.ko);
  return h('div', { class: 'v-sec' },
    h('h4', null, 'この場面'),
    h('div', { class: 'line' },
      scene.sp ? h('div', { class: 'sp' }, scene.sp) : null,
      h('div', { class: 'ja' }, renderJa(scene.tpl, { s: app.state || app.refState(), speaker: scene.role, mode })),
      ko),
    h('div', { class: 'tools' }, koToggle(ko)));
}

function modal(app, label, ...kids) {
  const close = () => back.remove();
  const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && close() },
    h('div', { class: 'modal', role: 'dialog', 'aria-label': label }, ...kids, h('button', { class: 'btn primary', type: 'button', onclick: close }, '閉じる')));
  app.root.append(back);
  back.querySelector('.btn.primary').focus();
}

export function wordPopup(app, key, scene, mode) {
  const v = VOCAB[key];
  if (!v) return;
  saveWord(key, scene);
  app.onWordSaved && app.onWordSaved(key);
  const exKo = h('div', { class: 'ko', hidden: true }, v.exk);
  modal(app, key,
    h('div', { class: 'v-word', lang: 'ja' }, key),
    h('div', { class: 'v-read', lang: 'ja' }, v.r),
    h('div', { class: 'v-mean' }, v.m),
    h('div', { class: 'v-meta' }, h('span', { class: 'chip' }, levelLabel(v.lv)), POS[v.pos] ? h('span', { class: 'chip' }, POS[v.pos]) : null),
    v.note ? h('div', { class: 'v-sec' }, h('div', { class: 'v-note' }, v.note)) : null,
    h('div', { class: 'v-sec' }, h('h4', null, '例文'), h('div', { class: 'line' }, h('div', { class: 'ja' }, renderExample(key, mode)), exKo), h('div', { class: 'tools' }, koToggle(exKo))),
    sceneBlock(app, scene, mode));
}

export function grammarPopup(app, key, scene, mode) {
  const g = GRAMMAR[key];
  if (!g) return;
  saveWord('g:' + key, scene);
  const first = firstScene(app, 'g:' + key, mode);
  modal(app, g.f,
    h('div', { class: 'v-word', lang: 'ja' }, g.f),
    h('div', { class: 'v-mean' }, g.m),
    h('div', { class: 'v-meta' }, h('span', { class: 'chip' }, levelLabel(g.lv)), h('span', { class: 'chip' }, '文法')),
    h('div', { class: 'v-sec' }, h('h4', null, '接続'), h('div', { class: 'v-note' }, g.c)),
    h('div', { class: 'v-sec' }, h('h4', null, '違い'), h('div', { class: 'v-note' }, g.d)),
    !scene && first ? h('div', { class: 'v-sec' }, h('h4', null, 'ゲームの例文'), first) : null,
    sceneBlock(app, scene, mode));
}

export function speakerLabel(sp, s, mode) {
  return renderSpeaker(sp, s, mode);
}
