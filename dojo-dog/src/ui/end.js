// 무지개다리 → 추도 화면(마지막 한마디) → 결과(레트로 엔딩 카드)
import * as G from '../engine/core.js';
import { ROLES, ROLE_KO, ROLE_JA, SEASON_KO, SEASON_JA, personFor } from '../engine/world.js';
import { resolveKo, plainJa } from '../engine/text.js';
import { FAVORITE, farewellJa } from '../data/ja/misc.js';
import { progress, itemOf, DAY } from '../engine/study.js';
import { lifeSummary } from '../engine/quizplan.js';
import { h, renderJa, renderSpeaker } from './render.js';
import { drawCard } from './card.js';
import { store } from './store.js';
import { dogPortrait, fitCanvas, paint } from './pixel/lcd.js';
import { faceBuf } from './pixel/people.js';
import { lookFor } from './pixel/director.js';

const isJa = (app) => (app.settings.lang || 'ja') === 'ja';

// 일본어 한 줄 + 탭하면 한국어 (몰입 모드). 한국어 모드면 한국어만.
function jaKo(app, s, ja, ko, cls = 'ev-text') {
  if (!isJa(app) || !ja) return h('p', { class: cls }, resolveKo(ko || '', { s }));
  const koEl = h('div', { class: 'sent-ko', hidden: true, lang: 'ko' }, resolveKo(ko || '', { s }));
  const p = h('p', { class: cls + ' jp', lang: 'ja', role: 'button', tabindex: '0', 'aria-label': '번역 보기' }, renderJa(ja, { s, mode: app.settings.furigana, onWord: (k) => app.openWord(k, null), onGrammar: (k) => app.openGrammar(k, null) }));
  const toggle = () => {
    koEl.hidden = !koEl.hidden;
    p.classList.toggle('on', !koEl.hidden);
  };
  p.addEventListener('click', toggle);
  p.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle()));
  return h('div', { class: 'narr' }, p, koEl);
}

// 좋아하던 자리
function favorite(s) {
  const f = (key, o) => ({ ...o, key, ko: resolveKo(FAVORITE[key][0], { s }), ja: FAVORITE[key][1] });
  if (G.has(s, 'last_lap')) return f('lap', { loc: 'room', lap: true });
  if (G.has(s, 'last_engawa')) return f('engawa', { loc: 'room' });
  if (G.has(s, 'last_bag')) return f('bag', { loc: 'dojo', bag: true });
  if (G.has(s, 'last_kamidana')) return f('kamidana', { loc: 'dojo', x: 116 });
  return f('dojo', { loc: 'dojo' });
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
      jaKo(app, s, farewellJa(SEASON_JA[G.season(s)], fav.key), `${SEASON_KO[G.season(s)]}의 저녁. ${s.dog.name}, ${fav.ko}에서 잠들다.`)),
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
  const tl = h('div', { class: 'timeline' }, key.map((x) => h('div', { class: 'tl' }, h('b', null, x.t < 4 ? `${3 + x.t * 3}か月` : `${Math.floor(x.t / 4)}歳`), h('span', isJa(app) && x.titleJa ? { lang: 'ja' } : null, isJa(app) && x.titleJa ? plainJa(x.titleJa, { s }) : x.title))));
  const words = s.words.length ? h('div', { class: 'list' }, s.words.map((w) => h('div', { class: 'card' }, h('div', { class: 'note' }, `${w.age}歳`), isJa(app) && w.textJa ? h('span', { lang: 'ja', title: w.text }, `“${w.textJa}”`) : `“${w.text}”`))) : null;
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
  const tbtn = h('button', { class: 'mini-btn', type: 'button', onclick: () => { on = !on; kos.forEach((k) => (k.hidden = !on)); tbtn.textContent = on ? '訳を閉じる' : '訳'; } }, '訳');
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
  const ja = isJa(app);
  const people = h('div', { class: 'pair' }, ROLES.map((r) => {
    const c = sum.cast[r];
    const achJa = c.achJa || c.ach;
    return h('div', { class: 'card person' },
      h('div', { class: 'ev-cat' }, ja ? ROLE_JA[r] : ROLE_KO[r]),
      h('h4', ja ? { lang: 'ja' } : null, ja ? c.call || c.name : c.ko),
      c.ach.length ? h('ul', ja ? { lang: 'ja' } : null, c.ach.map((a, i) => h('li', { title: ja ? a : null }, ja ? plainJa(achJa[i] || a, { s }) : a))) : null,
      ja && c.epilogueJa ? jaKo(app, s, c.epilogueJa, c.epilogue, 'epi') : h('div', { class: 'epi' }, c.epilogue));
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
          h('dt', null, ja ? '一生' : '견생'), h('dd', null, ja ? `${sum.years}年` : `${sum.years}년`),
          h('dt', null, 'N2 単語'), h('dd', null, `${study.words} · ${ja ? '定着' : '익힘'} ${study.wordsMastered}`),
          h('dt', null, 'N2 文法'), h('dd', null, `${study.grammar} · ${ja ? '定着' : '익힘'} ${study.grammarMastered}`),
          h('dt', null, ja ? '一言' : '한마디'), h('dd', null, sum.lastWord || '—'))),
      lifeStudy(app, s, srs),
      lifeIds.length >= 4 ? h('button', { class: 'btn center', type: 'button', style: 'margin-top:10px', onclick: () => app.startQuiz(lifeIds, 'この一生の復習') }, 'この一生の復習 10問') : null,
      h('h3', { class: 'h', lang: 'ja' }, '家族のその後'),
      people),
    h('div', { class: 'sheet-foot', style: 'position:static' },
      h('button', { class: 'btn center', type: 'button', onclick: () => app.go('title') }, 'タイトルへ')));
}

// 이번 견생의 일본어: 만난 N2 어휘·문법, 퀴즈 정답률, 취약 표현, 다음 복습
function lifeStudy(app, s, srs) {
  const L = lifeSummary(s, srs);
  const head = (id) => {
    const it = itemOf(id);
    return it.type === 'g' ? it.f : `${it.key}（${it.r}）`;
  };
  const when = (t) => {
    const d = Math.ceil((t - Date.now()) / DAY);
    return d <= 0 ? '지금' : d === 1 ? '내일' : `${d}일 뒤`;
  };
  const chips = (ids) => h('div', { class: 'chips' }, ids.map((id) => h('span', { class: 'chip', lang: 'ja', title: itemOf(id).m }, head(id))));
  return h('div', { class: 'card life-study', style: 'margin-top:12px' },
    h('h3', { class: 'h', lang: 'ja' }, 'この一生の日本語'),
    h('dl', { class: 'kv' },
      h('dt', null, '만난 N2 어휘'), h('dd', null, `${L.words.length}개`),
      h('dt', null, '만난 N2 문법'), h('dd', null, `${L.grammar.length}개`),
      h('dt', null, '퀴즈'), h('dd', null, L.asked ? `${L.ok} / ${L.asked} 정답 (${L.accuracy}%)` : '이번 견생에서는 풀지 않음'),
      h('dt', null, '내일까지 복습'), h('dd', null, `${L.dueTomorrow}개`)),
    L.grammar.length ? [h('h4', null, '만난 N2 문법'), chips(L.grammar)] : null,
    L.weak.length ? [h('h4', null, '취약 표현'), h('ul', { class: 'weak' }, L.weak.map((id) => h('li', null, h('b', { lang: 'ja' }, head(id)), ` ${itemOf(id).m}`)))] : null,
    L.next.length ? [h('h4', null, '다음 복습 예정'), h('ul', { class: 'weak' }, L.next.map((x) => h('li', null, h('b', { lang: 'ja' }, head(x.id)), ` · ${when(x.due)}`)))] : null,
    L.weak.length ? h('button', { class: 'btn primary', type: 'button', style: 'margin-top:8px', onclick: () => app.startQuiz(L.weak, '약한 표현') }, '약한 표현 복습') : null,
    L.next.length ? h('button', { class: 'btn center', type: 'button', style: 'margin-top:8px', onclick: () => app.startQuiz(L.next.map((x) => x.id), '다음 복습') }, '다음 복습 먼저') : null);
}

export { personFor };
