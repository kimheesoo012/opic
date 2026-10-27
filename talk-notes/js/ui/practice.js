/* 연습: 모드 고르기 → 범위·순서·문제 수 정하기 → 세션 */
import { S } from '../core/store.js';
import { LESSONS, TAGS, PHR, PRON } from '../data/notes.js';
import { MODES, poolFor, resolve } from '../core/deck.js';
import { dayNum, isDue } from '../core/srs.js';
import { $, $$, esc, sheet } from './ui.js';

const ORDER = [['due', '복습 먼저 + 새 문제'], ['new', '안 푼 것만'], ['weak', '자주 틀린 것'], ['random', '무작위'], ['seq', '노트 순서']];
const SIZES = [5, 10, 20, 30, 50];

function counts(mode) {
  const pool = poolFor(mode, {}, S);
  const today = dayNum();
  let due = 0, fresh = 0;
  for (const k of pool) { const st = S.srs[k]; if (!st || !st.n) fresh++; else if (isDue(st, today)) due++; }
  return { total: pool.length, due, fresh };
}

export default {
  title: '연습', tab: 'practice',
  render(view) {
    const today = dayNum();
    const dueAll = Object.entries(S.srs).filter(([k, st]) => isDue(st, today) && resolve(k)).length;
    view.innerHTML = `
      <a class="panel" href="#/s/today" style="display:block;text-decoration:none;color:inherit;border-color:var(--blue)">
        <h2>✦ 오늘의 학습</h2>
        <p class="small muted" style="margin:0">모든 종류의 복습 ${dueAll}개 + 새 문장 + 빈칸·O/X 변형을 섞어서 ${S.settings.sessionSize}문제</p>
      </a>
      <div class="modes">
        ${Object.entries(MODES).map(([m, d]) => {
          const c = counts(m);
          return `<button class="mode" data-m="${m}"><span class="mi">${d.icon}</span><b>${d.label}</b><span>${d.desc}</span><em>${c.total}문제 · 복습 ${c.due} · 새것 ${c.fresh}</em></button>`;
        }).join('')}
      </div>
      <div class="panel" style="margin-top:16px">
        <h3>어떻게 채점하나요?</h3>
        <ul class="small" style="margin:0;padding-left:18px">
          <li>말하기·따라 말하기·표현: 음성 인식 결과를 수정문·자연스러운 표현과 단어 단위로 비교해 추천 평가를 표시해요. 최종 평가는 직접 골라요.</li>
          <li>빈칸·O/X·소리 구분·패턴 퀴즈: 정답이 정해져 있어 자동으로 채점해요.</li>
          <li>발음 체크: 단어를 말하면 음성 인식이 그 단어로 알아들었는지 확인해요(수업 녹취가 잘못 인식된 단어들이에요).</li>
          <li>평가에 따라 다음 복습 날짜가 정해져요(다시 → 오늘 다시, 알맞음 → 1·3·7…일 뒤). 21일 넘게 기억하면 「익힘」이에요.</li>
        </ul>
      </div>`;
    view.addEventListener('click', e => {
      const b = e.target.closest('[data-m]');
      if (b) setup(b.dataset.m);
    });
  }
};

export function setup(mode) {
  const d = MODES[mode];
  const card = ['speak', 'cloze', 'fix', 'shadow'].includes(mode);
  const f = { lesson: '', tag: '', star: '', group: '', kind: '' };
  let order = 'due', n = mode === 'pron' || mode === 'pair' ? 10 : 20;
  const scope = card ? `
    <div class="field"><label>수업</label><select id="f-lesson"><option value="">전체 수업</option>${LESSONS.map((l, i) => `<option value="${i}">${esc(l.date)} · ${esc(l.title)}</option>`).join('')}</select></div>
    <div class="field"><label>실수 유형</label><div class="chips" id="f-tag"><button class="chip on" data-v="">전체</button>${Object.keys(TAGS).map(t => `<button class="chip" data-v="${t}">${esc(TAGS[t])}</button>`).join('')}<button class="chip" data-v="__star">★ 별표만</button></div></div>`
    : mode === 'pron' ? `<div class="field"><label>종류</label><div class="chips" id="f-group"><button class="chip on" data-v="">전체</button>${PRON.map((g, i) => `<button class="chip" data-v="${i}">${esc(g.h)}</button>`).join('')}</div></div>`
    : mode === 'phrase' ? `<div class="field"><label>상황</label><div class="chips" id="f-group"><button class="chip on" data-v="">전체</button>${PHR.map((g, i) => `<button class="chip" data-v="${i}">${esc(g[0])}</button>`).join('')}</div></div>`
    : mode === 'pair' ? `<div class="field"><label>소리</label><div class="chips" id="f-kind"><button class="chip on" data-v="">전체</button>${['R/L', '모음', '끝소리', '첫소리', '자음'].map(k => `<button class="chip" data-v="${k}">${k}</button>`).join('')}</div></div>`
    : mode === 'pattern' ? `<div class="field"><label>실수 유형</label><div class="chips" id="f-tag"><button class="chip on" data-v="">전체</button>${['word', 'art', 'tense', 'prep', 'habit', 'form', 'order', 'comp', 'agree', 'cond', 'ans'].map(t => `<button class="chip" data-v="${t}">${esc(TAGS[t])}</button>`).join('')}</div></div>` : '';
  sheet({
    title: d.icon + ' ' + d.label,
    html: `<p class="small muted" style="margin:-4px 0 8px">${esc(d.desc)}</p>${scope}
      <div class="field"><label>순서</label><div class="chips" id="f-order">${ORDER.map(([k, l]) => `<button class="chip${k === order ? ' on' : ''}" data-v="${k}">${l}</button>`).join('')}</div></div>
      <div class="field"><label>문제 수</label><div class="chips" id="f-n">${SIZES.map(s => `<button class="chip${s === n ? ' on' : ''}" data-v="${s}">${s}</button>`).join('')}</div></div>
      <p class="small" id="f-info"></p>
      <button class="btn primary block" id="f-go">시작</button>`,
    onOpen(el, close) {
      const info = () => {
        const ff = { lesson: f.lesson, tag: f.tag, star: f.star, group: f.group, kind: f.kind };
        const pool = poolFor(mode, ff, S);
        const today = dayNum();
        const due = pool.filter(k => isDue(S.srs[k], today)).length;
        const fresh = pool.filter(k => !S.srs[k] || !S.srs[k].n).length;
        $('#f-info', el).textContent = `고른 범위: ${pool.length}문제 (복습할 것 ${due} · 안 푼 것 ${fresh})`;
        $('#f-go', el).disabled = !pool.length;
      };
      const chipGroup = (id, cb) => {
        const g = $('#' + id, el); if (!g) return;
        g.addEventListener('click', e => {
          const b = e.target.closest('.chip'); if (!b) return;
          $$('.chip', g).forEach(x => x.classList.toggle('on', x === b));
          cb(b.dataset.v); info();
        });
      };
      chipGroup('f-tag', v => { if (v === '__star') { f.star = '1'; f.tag = ''; } else { f.star = ''; f.tag = v; } });
      chipGroup('f-group', v => { f.group = v; });
      chipGroup('f-kind', v => { f.kind = v; });
      chipGroup('f-order', v => { order = v; });
      chipGroup('f-n', v => { n = +v; });
      const ls = $('#f-lesson', el); if (ls) ls.onchange = () => { f.lesson = ls.value; info(); };
      $('#f-go', el).onclick = () => {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(f)) if (v !== '') q.set(k, v);
        q.set('order', order); q.set('n', n);
        close(null);
        location.hash = `#/s/${mode}?${q}`;
      };
      info();
    }
  });
}
