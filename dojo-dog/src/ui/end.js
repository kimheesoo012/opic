// 무지개다리 → 추도 화면(마지막 한마디) → 결과(레트로 엔딩 카드)
import * as G from '../engine/core.js';
import { ROLES, ROLE_KO, SEASON_KO, personFor } from '../engine/world.js';
import { resolveKo } from '../engine/text.js';
import { progress } from '../engine/study.js';
import { h, renderJa, renderSpeaker } from './render.js';
import { drawCard } from './card.js';
import { store } from './store.js';
import { dogPortrait, fitCanvas, paint } from './pixel/lcd.js';
import { faceBuf } from './pixel/people.js';
import { lookFor } from './pixel/director.js';

// 좋아하던 자리
function favorite(s) {
  if (G.has(s, 'last_lap')) return { loc: 'room', ko: `${resolveKo('{okami}', { s })}의 무릎 옆`, lap: true };
  if (G.has(s, 'last_engawa')) return { loc: 'room', ko: '햇볕 드는 방' };
  if (G.has(s, 'last_bag')) return { loc: 'dojo', ko: '竹刀袋 옆', bag: true };
  if (G.has(s, 'last_kamidana')) return { loc: 'dojo', ko: '神棚 아래', x: 116 };
  return { loc: 'dojo', ko: '도장 마루 끝' };
}

export function farewellScreen(app, s) {
  const fav = favorite(s);
  const cv = h('canvas', { class: 'lcd-canvas', 'aria-hidden': 'true' });
  const lcdBox = h('div', { class: 'lcd rainbow' }, cv);
  const people = [];
  if (fav.lap) people.push({ role: 'okami', x: 92, pose: 'seiza', casual: true, flip: true });
  const el = h('div', { class: 'screen' },
    h('div', { class: 'scroll' },
      h('h2', { class: 'h', lang: 'ja' }, '虹の橋'),
      h('div', { class: 'device' }, lcdBox),
      h('p', { class: 'ev-text' }, `${SEASON_KO[G.season(s)]}의 저녁. ${s.dog.name}, ${fav.ko}에서 잠들다.`)),
    h('div', { class: 'sheet-foot', style: 'position:static' }, h('button', { class: 'btn primary', type: 'button', onclick: () => app.toMemorial(s) }, 'つぎへ')));
  requestAnimationFrame(() => {
    const l = app.lcdOf(cv, { loc: fav.loc, tod: 'evening', people, dog: { mode: 'stay', pose: 'sleep', x: fav.x ?? 44 }, bubble: null, talkBubble: false }, s.dog, { stage: G.stage(s), season: G.season(s), state: s });
    l.act = 'sleep';
    fitCanvas(cv, 360);
    app.sound.sfx('big');
    setTimeout(() => lcdBox.classList.add('fade'), 300);
  });
  return el;
}

export function memorialScreen(app, s) {
  const mode = app.settings.furigana;
  const born = s.born || new Date().getFullYear();
  const years = Math.floor(s.t / 4);
  const portrait = dogPortrait(h('canvas', { class: 'portrait', 'aria-hidden': 'true' }), s.dog, { pose: 'stand', stage: 'adult', gray: true, pad: 3 });
  // 견생 연표: 큰 일만
  const key = s.hist.filter((x) => !x.brief && (G.EV.get(x.id)?.major || ['milestone', 'sub'].includes(G.EV.get(x.id)?.cat))).slice(0, 14);
  const tl = h('div', { class: 'timeline' }, key.map((x) => h('div', { class: 'tl' }, h('b', null, x.t < 4 ? `${3 + x.t * 3}か月` : `${Math.floor(x.t / 4)}歳`), h('span', null, x.title))));
  const words = s.words.length ? h('div', { class: 'list' }, s.words.map((w) => h('div', { class: 'card' }, h('div', { class: 'note' }, `${w.age}歳`), `“${w.text}”`))) : null;
  // 식구들의 추도 한 줄 (얼굴 도트)
  const kos = [];
  const msgs = h('div', { class: 'lines' }, G.farewell(s).map(([sp, ja, ko]) => {
    const koEl = h('div', { class: 'ko', hidden: true }, resolveKo(ko, { s }));
    kos.push(koEl);
    let face = null;
    if (ROLES.includes(sp)) {
      const lk = lookFor(s, sp);
      const f = faceBuf(lk.look, lk.size === 'kid' ? 'kid' : 'adult');
      const c = h('canvas', { class: 'face', 'aria-hidden': 'true', width: String(f.w), height: String(f.h) });
      paint(c.getContext('2d'), f);
      face = c;
    }
    return h('div', { class: 'line memo' }, face, h('div', null, h('div', { class: 'sp' }, renderSpeaker(sp, s, mode)), h('div', { class: 'ja' }, renderJa(ja, { s, speaker: sp, mode, onWord: (k) => app.openWord(k, null), onGrammar: (k) => app.openGrammar(k, null) })), koEl));
  }));
  let on = false;
  const tbtn = h('button', { class: 'mini-btn', type: 'button', onclick: () => { on = !on; kos.forEach((k) => (k.hidden = !on)); tbtn.textContent = on ? '번역 닫기' : '번역'; } }, '번역');
  const input = h('textarea', { class: 'word-input', id: 'last-word', rows: '3', maxlength: '60', 'aria-label': '마지막 한마디' });
  const done = () => {
    G.finish(s, input.value);
    app.finishLife(s);
  };
  return h('div', { class: 'screen memorial' },
    h('div', { class: 'scroll' },
      h('div', { class: 'memo-frame' }, portrait, h('div', { class: 'memo-name', lang: 'ja' }, s.dog.name), h('div', { class: 'memo-years' }, `${born} — ${born + years}`)),
      h('h3', { class: 'h', lang: 'ja' }, '一生'),
      tl,
      words ? [h('h3', { class: 'h', lang: 'ja' }, '残した言葉'), words] : null,
      h('h3', { class: 'h', lang: 'ja' }, '家族から'),
      msgs,
      h('div', { class: 'tools' }, tbtn),
      h('h3', { class: 'h', lang: 'ja' }, '最後に、この子へ一言'),
      input),
    h('div', { class: 'sheet-foot', style: 'position:static' }, h('button', { class: 'btn primary', type: 'button', onclick: done }, '残す')));
}

export function resultScreen(app, s) {
  const sum = s.summary;
  const srs = store.srs();
  const lifeIds = s.met || [];
  const study = progress(srs, lifeIds);
  const canvas = h('canvas');
  const img = h('img', { class: 'result-img', alt: `${sum.dog.name} 결과 카드` });
  let blobUrl = null;
  drawCard(canvas, s, study).then(() =>
    canvas.toBlob((b) => {
      if (!b) return;
      blobUrl = URL.createObjectURL(b);
      img.src = blobUrl;
    }, 'image/png'));
  const saveImg = async () => {
    const name = `dojoinu-card-${new Date().toISOString().slice(0, 10)}.png`;
    try {
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '道場犬' });
        return;
      }
    } catch {
      /* 공유가 막혀 있으면 내려받기로 */
    }
    const a = h('a', { href: blobUrl || canvas.toDataURL('image/png'), download: name });
    document.body.append(a);
    a.click();
    a.remove();
    app.toast('안 되면 카드를 길게 눌러 저장');
  };
  const people = h('div', { class: 'pair' }, ROLES.map((r) => {
    const c = sum.cast[r];
    return h('div', { class: 'card person' },
      h('div', { class: 'ev-cat' }, ROLE_KO[r]),
      h('h4', null, c.ko),
      c.ach.length ? h('ul', null, c.ach.map((a) => h('li', null, a))) : null,
      h('div', { class: 'epi' }, c.epilogue));
  }));
  return h('div', { class: 'screen' },
    h('div', { class: 'scroll' },
      h('h2', { class: 'h', lang: 'ja' }, 'おしまい'),
      img,
      h('div', { style: 'height:10px' }),
      h('button', { class: 'btn primary', type: 'button', onclick: saveImg }, 'カードを保存'),
      h('div', { class: 'card', style: 'margin-top:12px' },
        h('dl', { class: 'kv' },
          h('dt', null, '称号'), h('dd', null, sum.titles.map((t) => h('span', { class: 'title-badge', title: t.ko }, t.ja))),
          h('dt', null, '견생'), h('dd', null, `${sum.years}년`),
          h('dt', null, 'N2 単語'), h('dd', null, `${study.words} · 익힘 ${study.wordsMastered}`),
          h('dt', null, 'N2 文法'), h('dd', null, `${study.grammar} · 익힘 ${study.grammarMastered}`),
          h('dt', null, '한마디'), h('dd', null, sum.lastWord || '—'))),
      lifeIds.length >= 4 ? h('button', { class: 'btn center', type: 'button', style: 'margin-top:10px', onclick: () => app.startQuiz(lifeIds, 'この一生の復習') }, 'この一生の復習 10問') : null,
      h('h3', { class: 'h', lang: 'ja' }, '家族のその後'),
      people),
    h('div', { class: 'sheet-foot', style: 'position:static' },
      h('button', { class: 'btn center', type: 'button', onclick: () => app.go('title') }, 'タイトルへ')));
}

export { personFor };
