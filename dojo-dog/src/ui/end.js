// 마지막 인사 → 결과(견생과 식구들의 인생 나란히) → 결과 카드 → 단어 복습 퀴즈
import * as G from '../engine/core.js';
import { makeQuiz } from '../engine/quiz.js';
import { VOCAB } from '../data/vocab.js';
import { ROLES, ROLE_KO, SEASON_KO } from '../engine/world.js';
import { resolveKo } from '../engine/text.js';
import { h, renderJa, renderSpeaker } from './render.js';
import { drawCard } from './card.js';
import { store } from './store.js';
import { levelLabel } from './vocabui.js';

export function farewellScreen(app, s) {
  const lines = G.farewell(s);
  const mode = app.settings.furigana;
  const kos = [];
  const box = h('div', { class: 'lines' });
  for (const [sp, ja, ko] of lines) {
    const koEl = h('div', { class: 'ko', hidden: true }, resolveKo(ko, { s }));
    kos.push(koEl);
    box.append(h('div', { class: 'line' }, h('div', { class: 'sp' }, renderSpeaker(sp, s, mode)), h('div', { class: 'ja' }, renderJa(ja, { s, speaker: sp, mode, onWord: (k) => app.openWord(k, { tpl: ja, role: sp, ja: '', ko: resolveKo(ko, { s }), sp: '', title: '마지막 인사', when: '' }) })), koEl));
  }
  let on = false;
  const tbtn = h('button', { class: 'icon-btn', type: 'button', onclick: () => { on = !on; kos.forEach((k) => (k.hidden = !on)); tbtn.textContent = on ? '번역 숨기기' : '번역 보기'; } }, '번역 보기');
  const input = h('textarea', { class: 'word-input', id: 'last-word', rows: '3', maxlength: '60', placeholder: `${s.dog.nameKo}에게 (60자까지, 비워 둬도 돼요)` });
  const place = G.has(s, 'last_kamidana') ? '神棚 아래' : G.has(s, 'last_lap') ? `${resolveKo('{okami}', { s })}의 무릎 위` : G.has(s, 'last_engawa') ? '햇볕 드는 툇마루' : G.has(s, 'last_bag') ? '竹刀袋 속' : '도장 마루 끝';
  const done = () => {
    G.finish(s, input.value);
    app.finishLife(s);
  };
  return h('div', { class: 'screen' },
    h('div', { class: 'scroll' },
      h('div', { class: 'kicker' }, '虹の橋'),
      h('h2', { class: 'h' }, `${s.dog.nameKo}, 무지개다리를 건너다`),
      h('p', null, `${SEASON_KO[G.season(s)]}의 어느 저녁. 稽古가 끝나고 모두가 黙想을 마쳤을 때, ${s.dog.nameKo}${josaUn(s.dog.nameKo)} ${place}에서 조용히 잠들어 있었다. 숨소리는 마지막까지 고르고 편안했다. 그날 도장에는 稽古 대신, 모두가 한 사람씩 다가와 말을 걸었다.`),
      box,
      h('div', { class: 'tools' }, tbtn),
      h('h3', { class: 'h' }, '마지막으로, 이 아이에게 한마디'),
      input),
    h('div', { class: 'sheet-foot', style: 'position:static' }, h('button', { class: 'btn primary', type: 'button', onclick: done }, '남기고 결과 보기')));
}

function josaUn(name) {
  const c = name.charCodeAt(name.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '은(는)';
  return (c - 0xac00) % 28 ? '은' : '는';
}

export function resultScreen(app, s) {
  const sum = s.summary;
  const canvas = h('canvas');
  drawCard(canvas, sum);
  const img = h('img', { class: 'result-img', alt: `${sum.dog.name}의 결과 카드` });
  let blobUrl = null;
  canvas.toBlob((b) => {
    if (!b) return;
    blobUrl = URL.createObjectURL(b);
    img.src = blobUrl;
  }, 'image/png');
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
    app.toast('저장이 안 되면 카드 이미지를 길게 눌러 저장하세요.');
  };
  // 견생 연표: 주요 사건만
  const key = s.hist.filter((x) => !x.brief && (G.EV.get(x.id)?.major || ['milestone', 'sub'].includes(G.EV.get(x.id)?.cat)));
  const tl = h('div', { class: 'timeline' }, key.slice(0, 40).map((x) => h('div', { class: 'tl' }, h('b', null, x.t < 4 ? `${3 + x.t * 3}개월` : `${Math.floor(x.t / 4)}살`), h('span', null, x.title, x.choice ? h('span', { class: 'note' }, ` — ${x.choice}`) : null))));
  const people = h('div', { class: 'pair' }, ROLES.map((r) => {
    const c = sum.cast[r];
    return h('div', { class: 'card person' },
      h('div', { class: 'ev-cat' }, ROLE_KO[r]),
      h('h4', null, c.ko, h('span', { class: 'note', lang: 'ja', style: 'margin-left:6px;font-weight:400' }, c.name)),
      c.ach.length ? h('ul', null, c.ach.map((a) => h('li', null, a))) : h('p', { class: 'note' }, '함께한 시간은 짧았다.'),
      h('div', { class: 'epi' }, c.epilogue));
  }));
  const words = h('div', { class: 'list' }, sum.words.map((w) => h('div', { class: 'card' }, h('div', { class: 'note' }, `${w.age}살 · ${resolveKo(w.q, { s })}${w.auto ? ' (オート)' : ''}`), h('div', null, `“${w.text}”`))));
  const lifeVocab = [...new Set(s.vocab)].filter((k) => VOCAB[k]);
  const vlist = h('div', { class: 'list' }, lifeVocab.length ? lifeVocab.map((k) => h('div', { class: 'card row', style: 'justify-content:space-between' }, h('span', null, h('b', { lang: 'ja' }, k), ' ', h('span', { class: 'note', lang: 'ja' }, VOCAB[k].r)), h('span', { class: 'note' }, VOCAB[k].m))) : h('p', { class: 'note' }, '이번 견생에서 저장한 단어가 없어요. 다음 견생에서는 밑줄 단어를 탭해 보세요.'));
  const quizKeys = lifeVocab.length >= 4 ? lifeVocab : [...new Set([...lifeVocab, ...Object.keys(store.wordbook()), ...(s.seenWords || [])])].filter((k) => VOCAB[k]);
  return h('div', { class: 'screen' },
    h('div', { class: 'scroll' },
      h('div', { class: 'kicker' }, '견생 결과'),
      h('h2', { class: 'h' }, `${sum.dog.name}의 ${sum.years}년`),
      h('div', null, sum.titles.map((t) => h('span', { class: 'title-badge', title: t.ko }, t.ja))),
      h('dl', { class: 'kv', style: 'margin:10px 0' },
        h('dt', null, '도장'), h('dd', null, sum.world.dojoName + (sum.world.gen > 1 ? ` (${sum.world.gen}대째)` : '')),
        h('dt', null, '서브스토리'), h('dd', null, `${sum.subs}개 클리어`),
        h('dt', null, '委員長 작전 저지'), h('dd', null, `${sum.foiled}회`),
        h('dt', null, '이번에 익힌 단어'), h('dd', null, `${sum.vocab}개`),
        h('dt', null, '남긴 한마디'), h('dd', null, sum.lastWord || '—')),
      h('h3', { class: 'h' }, '결과 카드'),
      img,
      h('div', { style: 'height:10px' }),
      h('button', { class: 'btn primary', type: 'button', onclick: saveImg }, '이미지 저장'),
      h('p', { class: 'note' }, '저장이 안 되는 환경에서는 카드 이미지를 길게 눌러 저장할 수 있어요.'),
      h('h3', { class: 'h' }, '견생과 식구들의 인생'),
      h('div', { class: 'card' }, h('div', { class: 'ev-cat' }, `${sum.dog.name}의 견생`), tl),
      h('div', { style: 'height:10px' }),
      people,
      sum.words.length ? [h('h3', { class: 'h' }, '고비마다 남긴 말'), words] : null,
      h('h3', { class: 'h' }, '이번 견생에서 저장한 단어'),
      vlist,
      h('div', { style: 'height:12px' }),
      quizKeys.length >= 4 ? h('button', { class: 'btn primary', type: 'button', onclick: () => app.startQuiz(quizKeys, `${sum.dog.name}의 견생 복습`) }, '4지선다 복습 퀴즈 (10문제)') : h('p', { class: 'note' }, '퀴즈를 하려면 단어가 4개 이상 필요해요.')),
    h('div', { class: 'sheet-foot', style: 'position:static' },
      h('button', { class: 'btn center', type: 'button', onclick: () => app.go('title') }, '타이틀로 (다음 견생)')));
}

export function quizScreen(app, keys, label) {
  const study = store.study();
  let round = 1;
  let qs = makeQuiz(keys, VOCAB, 10, label + Date.now());
  let i = 0;
  let wrong = [];
  const log = [];
  const body = h('div', { class: 'scroll' });
  const el = h('div', { class: 'screen' }, body);
  const record = (key, ok) => {
    const r = study[key] || { ok: 0, ng: 0 };
    ok ? r.ok++ : r.ng++;
    r.last = Date.now();
    study[key] = r;
    store.saveStudy(study);
  };
  const show = () => {
    body.innerHTML = '';
    if (i >= qs.length) return summary();
    const q = qs[i];
    const kindLabel = q.kind === 'meaning' ? '뜻을 고르세요' : q.kind === 'reading' ? '읽는 법을 고르세요' : '이 뜻의 단어를 고르세요';
    let answered = false;
    const opts = q.options.map((o, oi) => h('button', { class: 'btn q-opt', type: 'button', lang: q.kind === 'meaning' ? 'ko' : 'ja', onclick: (e) => {
      if (answered) return;
      answered = true;
      const ok = oi === q.answer;
      record(q.key, ok);
      log.push({ key: q.key, ok, round });
      if (!ok) wrong.push(q.key);
      e.currentTarget.classList.add(ok ? 'right' : 'wrong');
      opts[q.answer].classList.add('right');
      next.hidden = false;
      fb.textContent = ok ? '정답!' : `정답: ${q.options[q.answer].label}`;
      next.focus();
    } }, o.label));
    const fb = h('p', { class: 'note', 'aria-live': 'polite' });
    const v = VOCAB[q.key];
    const next = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: () => { i++; show(); } }, '다음');
    body.append(
      h('div', { class: 'kicker' }, `${label} · ${round > 1 ? `틀린 단어 다시 (${round}회차)` : '복습 퀴즈'} · ${i + 1} / ${qs.length}`),
      h('p', { class: 'note' }, kindLabel),
      h('div', { class: 'q-prompt' + (q.kind === 'word' ? ' ko' : ''), lang: q.kind === 'word' ? 'ko' : 'ja' }, q.prompt),
      h('p', { class: 'note', style: 'text-align:center' }, levelLabel(v.lv)),
      h('div', { class: 'btns' }, opts),
      fb,
      next);
  };
  const summary = () => {
    const thisRound = log.filter((x) => x.round === round);
    const okN = thisRound.filter((x) => x.ok).length;
    const firstRound = log.filter((x) => x.round === 1);
    const text = [`道場犬 단어 복습 — ${label}`, `1회차: ${firstRound.filter((x) => x.ok).length} / ${firstRound.length}`, ...log.filter((x) => x.round === 1).map((x) => `${x.ok ? '○' : '×'} ${x.key}（${VOCAB[x.key].r}）${VOCAB[x.key].m}`), round > 1 ? `다시 풀기 ${round - 1}회 후 남은 오답: ${wrong.length}` : ''].filter(Boolean).join('\n');
    const pre = h('textarea', { class: 'word-input', rows: '8', readonly: true, id: 'quiz-result' }, text);
    body.append(
      h('h2', { class: 'h' }, round === 1 ? '복습 결과' : `다시 풀기 ${round - 1}회차 결과`),
      h('p', null, `${okN} / ${thisRound.length} 정답`),
      wrong.length ? h('div', { class: 'list' }, [...new Set(wrong)].map((k) => h('div', { class: 'card' }, h('b', { lang: 'ja' }, k), ' ', h('span', { class: 'note', lang: 'ja' }, VOCAB[k].r), ' — ', VOCAB[k].m))) : h('p', null, '모두 맞혔어요!'),
      h('div', { class: 'btns', style: 'margin-top:12px' },
        wrong.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => { round++; qs = makeQuiz([...new Set(wrong)], VOCAB, 10, label + round + Date.now()); wrong = []; i = 0; show(); } }, '틀린 단어만 다시 풀기') : null,
        h('button', { class: 'btn', type: 'button', onclick: async () => {
          try {
            await navigator.clipboard.writeText(text);
            app.toast('결과를 복사했어요.');
          } catch {
            pre.focus();
            pre.select();
            app.toast('복사가 막혀 있어요. 선택된 글자를 직접 복사하세요.');
          }
        } }, '결과 복사'),
        pre,
        h('button', { class: 'btn center', type: 'button', onclick: () => app.back() }, '돌아가기')));
  };
  show();
  return el;
}
