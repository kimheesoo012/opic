// 단어·문법 팝업. DB(vocab_*.js, grammar.js)에 있는 내용만 보여 준다.
import { VOCAB, REL } from '../data/vocab.js';
import { sceneOf, firstSceneOf } from './scenes.js';
import { GRAMMAR } from '../data/grammar.js';
import { h, renderExample, renderJa, renderSpeaker, LINES } from './render.js';
import { store } from './store.js';
import { nameInfo, splitSentJa } from '../engine/text.js';


// 표시 언어 (설정을 직접 읽는다: 팝업은 어느 화면에서나 열린다)
export const uiJa = () => (store.settings().lang || 'ja') === 'ja';

export function levelLabel(lv) {
  return lv === '범위 밖' ? (uiJa() ? '剣道用語' : '검도 용어') : lv;
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
  const info = saved && !opts.blank ? { ...(sceneOf(saved.tpl, s) || {}), ...saved } : firstSceneOf(id, s);
  if (!info || !info.tpl) return null;
  const ko = h('div', { class: 'ko', hidden: true }, info.ko);
  return h('div', null,
    h('div', { class: 'line' }, h('div', { class: 'ja' }, renderJa(info.tpl, { s, speaker: info.role, mode, targets: new Set([id]), blankG: opts.blank ? id.slice(2) : null })), ko),
    opts.noKo ? null : h('div', { class: 'tools' }, koToggle(ko)));
}

function koToggle(koEl) {
  let on = false;
  return h('button', { class: 'mini-btn', type: 'button', onclick: (e) => { on = !on; koEl.hidden = !on; e.currentTarget.textContent = on ? '閉じる' : '訳'; } }, '訳');
}

// 이 문장에서 문법이 붙은 말: 생성기가 만든 접속(例: 勝て（勝つ의 가능형 勝てる의 ます형）)＋문법 표면
export function connText(tpl, key) {
  const sg = (LINES.lines[tpl] || []).find((x) => x && x.g === key);
  if (!sg || !sg.c) return null;
  const surf = sg.s.map((it) => (typeof it === 'string' ? it : it[0])).join('');
  return `${sg.c} ＋ ${surf}`;
}

// 게임 속 문장 (번역은 탭해야 보인다)
function sceneBlock(app, scene, id, mode) {
  const s = app.state || app.refState();
  const info = scene && scene.tpl ? { ...(sceneOf(scene.tpl, s) || {}), ...scene } : firstSceneOf(id, s);
  if (!info || !info.tpl) return null;
  const ko = h('div', { class: 'ko', hidden: true }, info.ko);
  const line = h('div', { class: 'line tap', role: 'button', tabindex: '0', onclick: () => (ko.hidden = !ko.hidden) },
    h('div', { class: 'ja' }, renderJa(info.tpl, { s, speaker: info.role, mode, targets: new Set([id]) })),
    ko);
  return h('div', { class: 'v-sec' }, h('h4', null, 'ゲームの場面'), line);
}

// 접속 설명에서 괄호 속 풀이를 뺀 짧은 꼴
export const shortConn = (c = '') => c.replace(/\s*[（(][^）)]*[）)]/g, '').replace(/\s+\./g, '.').trim();
// 일본어 모드의 접속: 한국어 문법 용어를 일본어로 바꾸고, 한국어 설명이 남은 갈래는 뺀다
const CONN_JA = [['な형용사', 'な形容詞'], ['い형용사', 'い形容詞'], ['형용사', '形容詞'], ['명사', '名詞'], ['동사', '動詞'], ['보통형', '普通形'], ['사전형', '辞書形'], ['가정형', '仮定形'], ['가능형', '可能形'], ['의지형', '意志形'], ['정중형', '丁寧形'], ['의문사', '疑問詞'], ['어간', '語幹'], ['형', '形']];
export function jaConn(c = '') {
  let t = shortConn(c).split(/\.\s/)[0];
  for (const [ko, ja] of CONN_JA) t = t.split(ko).join(ja);
  t = t.replace(/·/g, '・').replace(/([一-龯])\s+(?=[ぁ-んァ-ン一-龯])/g, '$1');
  const parts = t.split(' / ');
  const keep = parts.filter((x) => !/[가-힣]/.test(x));
  return (keep.length ? keep.join(' / ') : parts[0].replace(/\s*[가-힣][가-힣\s・]*/g, '')).trim();
}

// 설명 상자: 제목 + 문장마다 한 줄, 일본어 부분은 일본어 글꼴로 (explainui richKo)
function noteBox(title, text) {
  if (!text) return null;
  const sents = String(text).split(/(?<=[.。요다])\s+/).filter(Boolean);
  return h('div', { class: 'v-note' }, h('b', { class: 'v-note-t' }, title), ...sents.map((t) => h('p', null, richKo(t))));
}

// 길게 읽을 내용은 접어 둔다
function more(...kids) {
  const list = kids.filter(Boolean);
  if (!list.length) return null;
  return h('details', { class: 'v-more' }, h('summary', null, '詳しく'), ...list);
}

// 관련 표현: 사람이 고른 짝(반대말·짝말)만. 같은 한자라는 이유만으로 묶지 않는다.
function related(key) {
  return (REL[key] || []).filter((w) => VOCAB[w]).slice(0, 3);
}

function saveButton(key, scene) {
  const wb = store.wordbook();
  let saved = !!wb[key];
  const ja = uiJa();
  const label = () => (ja ? (saved ? '単語帳に保存済み' : '単語帳に保存') : saved ? '단어장에 저장됨' : '단어장 저장');
  const b = h('button', { class: 'btn center save-btn', type: 'button', 'aria-pressed': String(saved), onclick: () => {
    if (saved) {
      const w = store.wordbook();
      delete w[key];
      store.saveWordbook(w);
    } else saveWord(key, scene);
    saved = !saved;
    b.setAttribute('aria-pressed', String(saved));
    b.textContent = label();
  } }, label());
  return b;
}

export function modal(app, label, ...kids) {
  const close = () => back.remove();
  const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && close() },
    h('div', { class: 'modal', role: 'dialog', 'aria-label': label }, ...kids, h('button', { class: 'btn primary close-btn', type: 'button', onclick: close }, '閉じる')));
  app.root.append(back);
  // 닫기 단추에 초점을 두되, 창은 맨 위(표현·뜻)부터 보이게 한다
  back.querySelector('.close-btn').focus({ preventScroll: true });
  back.querySelector('.modal').scrollTop = 0;
}

// 단어를 탭하면 보이는 창. 저장은 「단어장 저장」을 눌렀을 때만.
export function wordPopup(app, key, scene, mode) {
  const v = VOCAB[key];
  if (!v) return;
  app.onWordSaved && app.onWordSaved(key);
  const exKo = h('div', { class: 'ko', hidden: true }, v.exk);
  const rel = related(key);
  modal(app, key,
    h('div', { class: 'v-head' }, h('span', { class: 'v-word', lang: 'ja' }, key), h('span', { class: 'v-read', lang: 'ja' }, v.r), h('span', { class: 'v-lv' }, levelLabel(v.lv))),
    h('p', { class: 'v-mean' }, v.m),
    sceneBlock(app, scene, 'v:' + key, mode),
    h('div', { class: 'v-sec' }, h('h4', null, '例文'), h('div', { class: 'line tap', role: 'button', tabindex: '0', onclick: () => (exKo.hidden = !exKo.hidden) }, h('div', { class: 'ja' }, renderExample(key, mode)), exKo)),
    more(
      noteBox('메모', v.note),
      rel.length ? h('ul', { class: 'rel' }, rel.map((w) => h('li', null, h('span', { lang: 'ja' }, `${w}（${VOCAB[w].r}）`), ` ${VOCAB[w].m}`))) : null),
    saveButton(key, scene));
}

// 문법 예문 (DB의 첫 예문, 탭하면 번역)
function exampleBlock(ex, mode) {
  if (!ex || !ex[0]) return null;
  const ko = h('div', { class: 'ko', hidden: true }, ex[1] || '');
  return h('div', { class: 'v-sec' }, h('h4', null, '例文'), h('div', { class: 'line tap', role: 'button', tabindex: '0', onclick: () => (ko.hidden = !ko.hidden) }, h('div', { class: 'ja' }, renderJa(ex[0], { s: null, mode, targets: new Set() })), ko));
}

export function grammarPopup(app, key, scene, mode) {
  const g = GRAMMAR[key];
  if (!g) return;
  modal(app, g.f,
    h('div', { class: 'v-head' }, h('span', { class: 'v-word', lang: 'ja' }, g.f), h('span', { class: 'v-lv' }, g.lv)),
    h('p', { class: 'v-mean' }, g.m),
    h('p', { class: 'v-conn' }, uiJa() ? jaConn(g.c) : shortConn(g.c)),
    sceneBlock(app, scene, 'g:' + key, mode),
    exampleBlock(g.ex && g.ex[0], mode),
    more(
      noteBox('비슷한 표현과 차이', g.d),
      noteBox('주의', g.err || g.w)),
    saveButton('g:' + key, scene));
}

export function speakerLabel(sp, s, mode) {
  return renderSpeaker(sp, s, mode);
}

// 점선 이름을 탭하면 보이는 작은 창: 이름·읽기·종류, 누구(무엇)인지, 이름 속 말의 뜻. 내용은 세계 설정에 있는 것만 (src/engine/text.js nameInfo).
// 일본어 모드: 일본어 종류(人物·道場…)·역할과 일본어 소개 아래에 한국어 풀이 (다른 창과 같은 방식)
export function namePopup(app, q, state) {
  const s = state || app.state || app.refState();
  const info = nameInfo(s, q);
  const ja = uiJa();
  const mode = app.settings ? app.settings.furigana : 'always';
  // 일본어 문단: 글자는 문장마다 lines.json의 조각(루비)으로, 배열은 이미 조각
  const jaPara = (items) => h('p', { class: 'pn-desc', lang: 'ja' }, items.flatMap((it) => (Array.isArray(it) ? [renderJa('', { s, mode, targets: new Set(), segs: it })] : splitSentJa(it).map((t) => renderJa(t, { s, mode, targets: new Set() })))));
  const summary = [info.ko, info.roleKo ? (ja && info.roleJa ? `${info.roleKo}(${info.roleJa})` : info.roleKo) : null, info.area, info.label].filter(Boolean).join(' · ');
  modal(app, info.value,
    h('div', { class: 'v-head' },
      h('span', { class: 'v-word pn-word', lang: 'ja' }, info.value),
      info.reading && info.reading !== info.value ? h('span', { class: 'v-read', lang: 'ja' }, info.reading) : null,
      info.kind ? h('span', { class: 'v-lv', lang: ja ? 'ja' : 'ko' }, ja ? info.kindJa : info.kindKo) : null),
    info.full ? h('div', { class: 'pn-full', lang: 'ja' }, info.fullReading ? `${info.full}（${info.fullReading}）` : info.full) : null,
    summary ? h('p', { class: 'v-mean' }, summary) : null,
    ja ? info.jaText.map(jaPara) : null,
    info.koText ? h('p', { class: 'pn-desc ko' }, info.koText) : null,
    ja && info.nowJaText ? jaPara(info.nowJaText) : null,
    info.now ? h('p', { class: 'pn-desc ko' }, info.nowKo) : null,
    info.parts.length ? h('ul', { class: 'pn-parts' }, info.parts.map((x) => h('li', null, h('b', { lang: 'ja' }, x.w), x.r !== x.w ? h('span', { class: 'pn-r', lang: 'ja' }, x.r) : null, h('span', null, x.ko)))) : null,
    !summary && !info.koText && !info.parts.length ? h('p', { class: 'v-mean' }, ja ? '名前（固有名詞）' : '이름(고유명사)') : null);
}
