// 단어 팝업과 단어장
import { VOCAB } from '../data/vocab.js';
import { h, renderExample, renderJa } from './render.js';
import { store } from './store.js';

const POS = { n: '명사', v: '동사', a: 'い형용사', na: 'な형용사', adv: '부사', exp: '표현' };

export function levelLabel(lv) {
  return lv === '범위 밖' ? 'JLPT 범위 밖(전문어)' : `JLPT ${lv} (추정)`;
}

// 단어를 장면과 함께 단어장에 저장
export function saveWord(key, scene) {
  const wb = store.wordbook();
  const e = wb[key] || { key, at: Date.now(), n: 0, scenes: [] };
  e.n++;
  e.last = Date.now();
  if (scene && !e.scenes.some((x) => x.ja === scene.ja)) {
    e.scenes.unshift(scene);
    e.scenes = e.scenes.slice(0, 3);
  }
  wb[key] = e;
  store.saveWordbook(wb);
  return e;
}

export function wordPopup(app, key, scene, mode) {
  const v = VOCAB[key];
  if (!v) return;
  saveWord(key, scene);
  app.onWordSaved && app.onWordSaved(key);
  let showKo = false;
  const exKo = h('div', { class: 'ko', hidden: true }, v.exk);
  const close = () => back.remove();
  const sceneBox = scene
    ? h('div', { class: 'v-sec' },
        h('h4', null, '이 장면'),
        h('div', { class: 'line' },
          scene.sp ? h('div', { class: 'sp' }, scene.sp) : null,
          scene.tpl ? h('div', { class: 'ja' }, renderJa(scene.tpl, { s: app.state, speaker: scene.role, mode })) : h('div', { class: 'ja', lang: 'ja' }, scene.ja),
          h('div', { class: 'ko' }, scene.ko)),
        h('div', { class: 'note' }, scene.title ? `「${scene.title}」 · ${scene.when || ''}` : ''))
    : null;
  const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && close() },
    h('div', { class: 'modal', role: 'dialog', 'aria-label': key },
      h('div', { class: 'v-word', lang: 'ja' }, key),
      h('div', { class: 'v-read', lang: 'ja' }, v.r),
      h('div', { class: 'v-mean' }, v.m),
      h('div', { class: 'v-meta' }, h('span', { class: 'chip' }, levelLabel(v.lv)), h('span', { class: 'chip' }, POS[v.pos] || ''), v.k ? h('span', { class: 'chip' }, '검도 용어') : null),
      v.note ? h('div', { class: 'v-sec' }, h('h4', null, '설명'), h('div', { class: 'v-note' }, v.note)) : null,
      h('div', { class: 'v-sec' }, h('h4', null, '예문'),
        h('div', { class: 'line' }, h('div', { class: 'ja' }, renderExample(key, mode)), exKo),
        h('div', { class: 'tools' }, h('button', { class: 'icon-btn', type: 'button', onclick: (e) => { showKo = !showKo; exKo.hidden = !showKo; e.currentTarget.textContent = showKo ? '번역 숨기기' : '번역 보기'; } }, '번역 보기'))),
      sceneBox,
      h('p', { class: 'note' }, '단어장에 장면과 함께 저장했어요.'),
      h('button', { class: 'btn primary', type: 'button', onclick: close }, '닫기')));
  app.root.append(back);
  back.querySelector('.btn.primary').focus();
}

export function wordbookScreen(app) {
  const wb = store.wordbook();
  const study = store.study();
  const keys = Object.keys(wb).filter((k) => VOCAB[k]).sort((a, b) => (wb[b].last || 0) - (wb[a].last || 0));
  let q = '';
  const list = h('div', { class: 'list' });
  const draw = () => {
    list.innerHTML = '';
    const ks = keys.filter((k) => !q || k.includes(q) || VOCAB[k].r.includes(q) || VOCAB[k].m.includes(q));
    if (!ks.length) list.append(h('p', { class: 'note' }, keys.length ? '찾는 단어가 없어요.' : '아직 저장한 단어가 없어요. 대사 속 밑줄 단어를 탭하면 장면과 함께 저장돼요.'));
    for (const k of ks) {
      const v = VOCAB[k];
      const e = wb[k];
      const st = study[k];
      const det = h('details', { class: 'card' },
        h('summary', { style: 'cursor:pointer;list-style:none;min-height:40px' },
          h('div', { class: 'row', style: 'justify-content:space-between' },
            h('span', null, h('b', { lang: 'ja', style: 'font-size:20px' }, k), ' ', h('span', { lang: 'ja', class: 'note' }, v.r)),
            h('span', { class: 'note' }, st ? `○${st.ok} ×${st.ng}` : '')),
          h('div', null, v.m)),
        h('div', { class: 'v-meta', style: 'margin-top:6px' }, h('span', { class: 'chip' }, levelLabel(v.lv))),
        ...e.scenes.map((sc) => h('div', { class: 'line', style: 'margin-top:8px' }, sc.sp ? h('div', { class: 'sp' }, sc.sp) : null, h('div', { class: 'ja', lang: 'ja' }, sc.ja), h('div', { class: 'ko' }, sc.ko), h('div', { class: 'note' }, sc.title ? `「${sc.title}」 ${sc.when || ''}` : ''))),
        h('div', { class: 'row', style: 'margin-top:8px' },
          h('button', { class: 'btn center', type: 'button', onclick: () => wordPopup(app, k, null, app.settings.furigana) }, '자세히'),
          h('button', { class: 'btn center danger', type: 'button', onclick: () => { const w = store.wordbook(); delete w[k]; store.saveWordbook(w); keys.splice(keys.indexOf(k), 1); draw(); } }, '삭제')));
      list.append(det);
    }
  };
  draw();
  return h('div', { class: 'screen' },
    h('div', { class: 'scroll' },
      h('h2', { class: 'h' }, '単語帳', h('small', { class: 'note', style: 'margin-left:8px' }, `${keys.length}개`)),
      h('input', { class: 'word-input', type: 'search', id: 'wb-search', placeholder: '단어·읽기·뜻으로 찾기', oninput: (e) => { q = e.target.value.trim(); draw(); } }),
      h('div', { style: 'height:10px' }),
      keys.length >= 4 ? h('button', { class: 'btn primary', type: 'button', onclick: () => app.startQuiz(keys, '단어장 복습') }, '단어장에서 복습 퀴즈') : null,
      h('div', { style: 'height:10px' }),
      list),
    h('div', { class: 'sheet-foot', style: 'position:static' }, h('button', { class: 'btn center', type: 'button', onclick: () => app.go('title') }, '돌아가기')));
}
