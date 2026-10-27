/* 화면 공용 도구: 이스케이프, 토스트, 시트, 읽어 주기 버튼, 노트 카드 */
import { S, toggleStar } from '../core/store.js';
import { tts } from '../core/speech.js';
import { TAGS } from '../data/notes.js';
import { itemKey } from '../core/deck.js';
import { level, LEVEL_LABEL } from '../core/srs.js';
import { stripHtml } from '../core/text.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
/* 노트 설명(e)에 들어 있는 <b>만 살리고 나머지 태그는 글자로 */
export function safeRich(s) { return esc(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>'); }

let toastTimer = null;
export function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}

/* 아래에서 올라오는 시트. html 안의 [data-close] 누르면 닫힘. 닫힐 때 resolve(value) */
export function sheet({ title = '', html = '', onOpen } = {}) {
  return new Promise(resolve => {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grip"></div>${title ? `<h2>${esc(title)}</h2>` : ''}${html}</div>`;
    const close = v => { bg.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    bg.addEventListener('click', e => {
      if (e.target === bg) return close(null);
      const c = e.target.closest('[data-close]');
      if (c) close(c.dataset.close);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(bg);
    onOpen && onOpen(bg.firstElementChild, close);
  });
}
export async function confirmSheet(title, text, yes = '확인', danger = false) {
  const r = await sheet({ title, html: `<p>${esc(text)}</p><div class="grid2"><button class="btn" data-close="no">취소</button><button class="btn ${danger ? 'danger' : 'primary'}" data-close="yes">${esc(yes)}</button></div>` });
  return r === 'yes';
}

/* 읽어 주기: <button class="say" data-say="text"> 어디에 있든 동작 */
export function sayBtn(text, label = '듣기') {
  return `<button type="button" class="say" data-say="${esc(stripHtml(text))}" aria-label="${esc(label)}">🔊</button>`;
}
let playingBtn = null;
export async function speak(text, btn, rate) {
  if (playingBtn) playingBtn.classList.remove('playing');
  if (btn && btn === playingBtn) { tts.cancel(); playingBtn = null; return; }
  playingBtn = btn || null;
  if (btn) btn.classList.add('playing');
  const ok = await tts.speak(text, { voice: S.settings.voice, rate: rate || S.settings.rate });
  if (btn) btn.classList.remove('playing');
  if (playingBtn === btn) playingBtn = null;
  if (!ok && !tts.supported()) toast('이 브라우저는 읽어 주기를 지원하지 않아요.');
  return ok;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (b) { e.preventDefault(); speak(b.dataset.say, b); return; }
  const st = e.target.closest('[data-star]');
  if (st) {
    e.preventDefault();
    const on = toggleStar(st.dataset.star);
    $$(`[data-star="${CSS.escape(st.dataset.star)}"]`).forEach(x => { x.classList.toggle('on', on); x.textContent = on ? '★' : '☆'; x.setAttribute('aria-pressed', on); });
    toast(on ? '별표에 넣었어요' : '별표를 뺐어요', 1200);
  }
});

export function starBtn(id) {
  const on = !!S.stars[id];
  return `<button type="button" class="star${on ? ' on' : ''}" data-star="${esc(id)}" aria-label="별표" aria-pressed="${on}">${on ? '★' : '☆'}</button>`;
}

export function tagChip(t, href) {
  const cls = 'tag' + (t === 'ok' ? ' ok' : '');
  return href ? `<a class="${cls}" href="${href}">${esc(TAGS[t] || t)}</a>` : `<span class="${cls}">${esc(TAGS[t] || t)}</span>`;
}

/* 노트 카드 (원본 노트와 같은 구성 + 듣기·별표·연습·내 진도) */
export function noteCard(d, { actions = true, showLesson = false } = {}) {
  const same = d.o && !d.hasO;
  const lv = level(S.srs[itemKey('speak', d.id)]);
  const memo = S.memos[d.id];
  return `<article class="ncard${d.ok ? ' ok' : ''}" id="c-${esc(d.id)}">
   <div class="top"><div class="ctx">${showLesson ? `<a class="tag lv" href="#/note/les/${d.li}?c=${esc(d.id)}">${esc(d.lesson.date)}</a> ` : ''}상황: <b>${esc(d.c)}</b></div>${starBtn(d.id)}</div>
   <div class="nrow o"><div class="lab">원문</div>${d.o ? `<div class="en">${esc(d.o)}</div>` : `<div class="none">원문 녹취 없음</div>`}<div></div></div>
   ${same ? `<div class="nrow f"><div class="lab">해석</div><div class="kr hideable" style="margin-top:3px">${esc(d.t)}</div>${sayBtn(d.f)}</div>`
      : `<div class="nrow f"><div class="lab">수정</div><div><div class="en">${esc(d.f)}</div><div class="kr hideable">${esc(d.t)}</div></div>${sayBtn(d.f)}</div>`}
   <div class="exp"><ul>${d.e.map(x => `<li>${safeRich(x)}</li>`).join('')}</ul></div>
   <div class="nrow n" style="margin-top:10px"><div class="lab">더 자연스럽게</div><div><div class="en">${esc(d.n)}</div><div class="kr hideable">${esc(d.nk)}</div></div>${sayBtn(d.n)}</div>
   <div class="tags">${d.g.map(t => tagChip(t)).join('')}${lv !== 'new' ? `<span class="tag lv ${lv}">${LEVEL_LABEL[lv]}</span>` : ''}</div>
   ${memo ? `<div class="memo">📝 ${esc(memo)}</div>` : ''}
   ${actions ? `<div class="cact"><a class="btn sm" href="#/card/${esc(d.id)}">자세히·메모</a><a class="btn sm" href="#/s/one?k=${encodeURIComponent(itemKey('speak', d.id))}">🎙 이 문장 말하기</a></div>` : ''}
  </article>`;
}

export function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
export function fmtMin(ms) { const m = Math.round(ms / 60000); return m < 60 ? m + '분' : Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; }

export function applyTheme() {
  const t = S.settings.theme;
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = $('meta[name="theme-color"]');
  if (m) m.content = dark ? '#0E1622' : '#F4F8FC';
}
