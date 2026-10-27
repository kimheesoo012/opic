/* 문장 카드 자세히: 노트 내용 전부 + 연습별 진도 + 내 마지막 답·녹음 + 메모 + 앞뒤 문장 */
import { S, setMemo, rec } from '../core/store.js';
import { CARD, CARDS, clozeOf, itemKey, MODES } from '../core/deck.js';
import { level, LEVEL_LABEL, dayNum, intervalLabel } from '../core/srs.js';
import { $, esc, noteCard, sheet, toast } from './ui.js';

export default {
  title: '문장 카드', parentTab: 'note',
  async render(view, params) {
    const c = CARD[params[0]];
    if (!c) { view.innerHTML = '<p class="empty">문장을 찾지 못했어요.</p><a class="btn block" href="#/note?t=les">노트로</a>'; return; }
    const inLesson = CARDS.filter(x => x.li === c.li);
    const prev = inLesson[c.idx - 1], next = inLesson[c.idx + 1];
    const types = ['speak', 'shadow'].concat(clozeOf(c) ? ['cloze'] : []).concat(c.o && !c.asr ? ['fix'] : []);
    const today = dayNum();
    const rows = types.map(t => {
      const k = itemKey(t, c.id), st = S.srs[k], lv = level(st);
      const said = S.said[k];
      return `<div class="list-item">
        <div class="tx"><b>${MODES[t].icon} ${esc(MODES[t].label)}</b>
          <span class="small muted" style="display:block">${st ? `${LEVEL_LABEL[lv]} · ${st.c}/${st.n}번 맞힘 · 다음 복습 ${intervalLabel(st.d - today)}` : '아직 안 풀었어요'}</span>
          ${said ? `<span class="small" style="display:block">내 마지막 답: <span class="en" style="font-size:14.5px">${esc(said.s)}</span></span>` : ''}
          <div id="rp-${t}"></div></div>
        <a class="btn sm" href="#/s/one?k=${encodeURIComponent(k)}">풀기</a></div>`;
    }).join('');
    view.innerHTML = `
      <p class="small muted" style="margin:0">${esc(c.lesson.date)} · ${esc(c.lesson.title)} · ${c.idx + 1}/${inLesson.length}번째 문장</p>
      ${noteCard(c, { actions: false })}
      <div class="cact"><button class="btn sm" id="memo">📝 ${S.memos[c.id] ? '메모 고치기' : '메모 쓰기'}</button><a class="btn sm" href="#/note/les/${c.li}?c=${encodeURIComponent(c.id)}">노트에서 보기</a></div>
      <div class="sec-h"><h2>이 문장 연습</h2></div>
      <div class="panel" style="padding:4px 16px">${rows}</div>
      <div class="grid2" style="margin-top:14px">
        ${prev ? `<a class="btn" href="#/card/${esc(prev.id)}">‹ 앞 문장</a>` : '<span></span>'}
        ${next ? `<a class="btn" href="#/card/${esc(next.id)}">다음 문장 ›</a>` : '<span></span>'}
      </div>`;
    // 녹음이 있으면 재생 칸
    const urls = [];
    for (const t of types) {
      const r = await rec.get(itemKey(t, c.id));
      if (r && r.blob) { const u = URL.createObjectURL(r.blob); urls.push(u); const h = $('#rp-' + t, view); if (h) h.innerHTML = `<audio controls src="${u}" preload="metadata" style="height:34px;max-width:100%;margin-top:4px"></audio>`; }
    }
    $('#memo', view).onclick = () => sheet({
      title: '내 메모',
      html: `<p class="small muted" style="margin-top:-6px">${esc(c.f)}</p><textarea id="mt" placeholder="헷갈린 점, 비슷한 표현, 다음 수업에서 물어볼 것…">${esc(S.memos[c.id] || '')}</textarea>
        <div class="grid2" style="margin-top:10px"><button class="btn" data-close="cancel">취소</button><button class="btn primary" id="msave">저장</button></div>`,
      onOpen(el, close) {
        $('#mt', el).focus();
        $('#msave', el).onclick = () => { setMemo(c.id, $('#mt', el).value); close('saved'); toast('메모를 저장했어요'); window.TN.refresh(); };
      }
    });
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }
};
