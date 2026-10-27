/* 노트: 원본 교정 노트 내용 전부 (반복되는 실수 · 수업별 문장 · 좋아진 점 · 발음 체크 · 바로 쓸 표현) + 별표·검색 */
import { S, setSetting } from '../core/store.js';
import { LESSONS, TAGS, SHORT, MIST, GROW, PHR, PRON } from '../data/notes.js';
import { CARDS, tagCounts, lessonProgress, search, PATTERNS } from '../core/deck.js';
import { $, $$, esc, safeRich, sayBtn, noteCard, pct } from './ui.js';

const TABS = [['mist', '반복되는 실수'], ['les', '수업별 문장'], ['grow', '좋아진 점'], ['pron', '발음 체크'], ['phr', '바로 쓸 표현'], ['star', '★ 별표'], ['find', '검색']];

export default {
  title: '교정 노트', tab: 'note',
  render(view, params, query) {
    let t = params[0] === 'les' ? 'les' : (query.t || 'mist');
    if (!TABS.some(x => x[0] === t)) t = 'mist';
    const all = CARDS.length;
    view.innerHTML = `<nav class="subtabs" aria-label="노트 메뉴">${TABS.map(([k, l]) => `<a href="#/note?t=${k}" class="${k === t ? 'on' : ''}">${l}</a>`).join('')}</nav>
      <p class="small muted" style="margin:0 0 6px">${esc(LESSONS[0].date)}부터 ${esc(LESSONS[LESSONS.length - 1].date.replace(/ [①②]/, ''))}까지 ${LESSONS.length}개 수업, 내가 한 문장 ${all}개</p>
      <div id="nbody"></div>`;
    const body = $('#nbody', view);
    const R = { mist, les, grow, pron, phr, star, find };
    return R[t](body, params, query);
  }
};

function lesCnt(l, k) { return l.cards.filter(c => c.g.includes(k)).length; }

function mist(el) {
  el.innerHTML = MIST.map(m => {
    const per = LESSONS.map(l => lesCnt(l, m.k));
    const tot = per.reduce((a, b) => a + b, 0);
    const rate = LESSONS.map(l => l.cards.length ? lesCnt(l, m.k) / l.cards.length : 0);
    const mx = Math.max(...rate) || 1;
    const s = S.tagStats[m.k];
    const acc = s && s.n ? pct(s.ok, s.n) : null;
    const npat = PATTERNS.filter(p => p.k === m.k).length;
    return `<div class="mist" id="m-${m.k}"><h3>${esc(m.h)}<span>총 ${tot}회</span></h3>
      <div class="trend" aria-label="수업별 비율">${LESSONS.map((l, i) => `<div class="bar" title="${esc(l.date)} ${per[i]}회"><i style="height:${Math.round(rate[i] / mx * 42)}px"></i><em>${esc(SHORT[i])}</em></div>`).join('')}</div>
      <p>${safeRich(m.p)}</p>
      ${m.ex.map(x => `<div class="ex"><span class="d">${esc(x[0])}</span><div class="en bad">${safeRich(x[1])}</div><div class="en good">${safeRich(x[2])} ${sayBtn(x[2])}</div></div>`).join('')}
      <div class="mymeter">${acc == null ? '<span>아직 이 유형을 연습하지 않았어요</span>' : `<span>내 연습 정답률</span><div class="meter ${acc < 60 ? 'bad' : acc < 80 ? 'warn' : 'good'}"><i style="width:${acc}%"></i></div><b>${acc}%</b>`}</div>
      <div class="cact">
        <a class="btn sm" href="#/s/speak?tag=${m.k}&order=due&n=10">🎙 이 실수 문장 말하기</a>
        <a class="btn sm" href="#/s/cloze?tag=${m.k}&order=due&n=10">🧩 빈칸</a>
        ${npat ? `<a class="btn sm" href="#/s/pattern?tag=${m.k}&order=random&n=${npat}">🚩 예문 퀴즈 ${npat}</a>` : ''}
        <a class="btn sm ghost" href="#/note?t=les&tag=${m.k}">문장 보기</a>
      </div>
    </div>`;
  }).join('') + `<p class="kr">막대는 그 수업 문장 중 해당 실수가 들어간 비율이에요.</p>`;
}

function toggles() {
  return `<div class="toolbar">
    <button class="tog${S.settings.hideKr ? ' on' : ''}" data-tg="hideKr">${S.settings.hideKr ? '해석 보기' : '해석 숨기기'}</button>
    <button class="tog${S.settings.hideN ? ' on' : ''}" data-tg="hideN">${S.settings.hideN ? '자연스러운 표현 보기' : '자연스러운 표현 숨기기'}</button>
  </div>`;
}
function bindToggles(el) {
  const apply = () => { el.classList.toggle('hide-kr', !!S.settings.hideKr); el.classList.toggle('hide-n', !!S.settings.hideN); };
  apply();
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-tg]'); if (!b) return;
    setSetting(b.dataset.tg, !S.settings[b.dataset.tg]);
    apply();
    b.classList.toggle('on', !!S.settings[b.dataset.tg]);
    b.textContent = b.dataset.tg === 'hideKr' ? (S.settings.hideKr ? '해석 보기' : '해석 숨기기') : (S.settings.hideN ? '자연스러운 표현 보기' : '자연스러운 표현 숨기기');
  });
}

function les(el, params, query) {
  // 기본: 가장 최근 수업
  let cur = params[1] != null ? +params[1] : query.tag ? -1 : LESSONS.length - 1;
  if (!(cur >= -1 && cur < LESSONS.length)) cur = LESSONS.length - 1;
  let filt = query.tag || 'all';
  const prog = lessonProgress(S);
  const render = () => {
    const allMode = cur === -1;
    const cards = allMode ? CARDS : CARDS.filter(c => c.li === cur);
    const l = LESSONS[cur];
    const counts = tagCounts(cards);
    const keys = ['all', ...Object.keys(TAGS).filter(k => counts[k])];
    if (!keys.includes(filt)) filt = 'all';
    const shown = cards.filter(c => filt === 'all' || c.g.includes(filt));
    const limit = allMode ? 60 : 999;
    el.innerHTML = `
      <div class="lessons" id="lesbar">
        <a class="les${allMode ? ' on' : ''}" href="#/note/les/-1${filt !== 'all' ? '?tag=' + filt : ''}"><b>전체</b><span>${CARDS.length}문장</span></a>
        ${LESSONS.map((x, i) => `<a class="les${i === cur ? ' on' : ''}" href="#/note/les/${i}" data-i="${i}"><b>${esc(x.date)}</b><span>${esc(x.title)}</span><div class="pg"><i style="width:${pct(prog[i].seen, prog[i].total)}%"></i></div></a>`).join('')}
      </div>
      ${allMode ? `<div class="panel"><h3>전체 수업</h3><p class="small muted" style="margin:0">문장 ${CARDS.length}개 · 실수 유형을 골라 모아 볼 수 있어요.</p></div>`
        : `<div class="panel"><h3>${esc(l.date)} · ${esc(l.title)}</h3><p class="small muted" style="margin:0">${esc(l.meta)} · 문장 ${l.cards.length}개 · 연습 ${prog[cur].seen}개 · 익힘 ${prog[cur].mastered}개${l.note ? '<br>' + esc(l.note) : ''}</p>
          <div class="cact"><a class="btn sm primary" href="#/s/speak?lesson=${cur}&order=due&n=20">🎙 이 수업 말하기</a><a class="btn sm" href="#/s/cloze?lesson=${cur}&order=due&n=15">🧩 빈칸</a><a class="btn sm" href="#/s/fix?lesson=${cur}&order=due&n=15">⭕ O/X</a><a class="btn sm" href="#/s/shadow?lesson=${cur}&order=due&n=15">🔁 따라 말하기</a></div></div>`}
      ${toggles()}
      <div class="chips" id="chips">${keys.map(k => `<button class="chip${k === filt ? ' on' : ''}" data-k="${k}">${k === 'all' ? '전체 ' + cards.length : esc(TAGS[k]) + ' ' + counts[k]}</button>`).join('')}</div>
      ${filt !== 'all' ? `<div class="cact" style="margin:-4px 0 6px"><a class="btn sm" href="#/s/speak?${allMode ? '' : 'lesson=' + cur + '&'}tag=${filt}&order=due&n=15">🎙 「${esc(TAGS[filt])}」 문장 말하기 (${shown.length})</a></div>` : ''}
      <div id="list">${shown.slice(0, limit).map(c => noteCard(c, { showLesson: allMode })).join('') || '<p class="empty">해당하는 문장이 없어요.</p>'}</div>
      ${shown.length > limit ? `<button class="btn block" id="more">${shown.length - limit}개 더 보기</button>` : ''}`;
    const on = $('.les.on', el);
    if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
    const more = $('#more', el);
    if (more) more.onclick = () => { $('#list', el).insertAdjacentHTML('beforeend', shown.slice(limit).map(c => noteCard(c, { showLesson: true })).join('')); more.remove(); };
    if (query.c) { const t = document.getElementById('c-' + query.c); if (t) { t.scrollIntoView({ block: 'center' }); t.style.outline = '2px solid var(--sky)'; } query.c = null; }
  };
  bindToggles(el);
  el.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    filt = b.dataset.k; render();
  });
  render();
}

function grow(el) {
  el.innerHTML = GROW.map(g => `<div class="grow"><h3>${esc(g.h)}</h3><p>${safeRich(g.p)}</p></div>`).join('');
}

function pron(el) {
  el.innerHTML = PRON.map((g, gi) => `
    <div class="sec-h"><h2>${esc(g.h)}</h2><a href="#/s/pron?group=${gi}&order=due&n=${g.rows.length}">연습 ›</a></div>
    <table class="t"><tr><th>말하려던 단어</th><th>인식된 글자</th><th>수업</th><th>내 결과</th></tr>
    ${g.rows.map(r => {
      const p = S.pron[r.w];
      return `<tr><td><span class="en">${esc(r.w)}</span></td><td>${esc(r.heard.join(', '))}</td><td class="small">${esc(r.d.join(', '))}</td>
        <td class="act">${sayBtn(r.w.replace(/[()]/g, ''))} ${p ? `<span class="small ${p.ok / p.n >= 0.7 ? '' : 'muted'}">${p.ok}/${p.n}</span>` : ''}</td></tr>`;
    }).join('')}</table>
    ${g.tip ? `<p class="kr" style="margin-top:8px">${esc(g.tip)}</p>` : ''}`).join('') +
    `<div class="panel"><h3>👂 소리 구분 듣기</h3><p class="small muted" style="margin:0 0 8px">rice/lice, walk/work처럼 위 표의 헷갈린 짝 중 어느 쪽을 읽었는지 골라요.</p><a class="btn sm primary" href="#/s/pair?order=random&n=15">시작</a></div>`;
}

function phr(el) {
  el.innerHTML = PHR.map((g, gi) => `<div class="sec-h"><h2>${esc(g[0])}</h2><a href="#/s/phrase?group=${gi}&order=due&n=${g[1].length}">연습 ›</a></div>` +
    g[1].map(p => `<div class="phr"><div class="tx"><div class="en">${esc(p[0])}</div><div class="kr">${esc(p[1])}</div></div>${sayBtn(p[0])}</div>`).join('')).join('') +
    `<a class="btn block primary" style="margin-top:16px" href="#/s/phrase?order=due&n=20">💬 표현 전체 연습</a>`;
}

function star(el) {
  const ids = Object.keys(S.stars).filter(id => CARDS.some(c => c.id === id)).sort((a, b) => S.stars[b] - S.stars[a]);
  const cards = ids.map(id => CARDS.find(c => c.id === id));
  el.innerHTML = cards.length
    ? `<div class="cact" style="margin-bottom:6px"><a class="btn sm primary" href="#/s/speak?star=1&order=due&n=${Math.min(30, cards.length)}">🎙 별표 문장 말하기 (${cards.length})</a><a class="btn sm" href="#/s/cloze?star=1&order=due&n=20">🧩 빈칸</a></div>${toggles()}<div>${cards.map(c => noteCard(c, { showLesson: true })).join('')}</div>`
    : `<p class="empty">별표한 문장이 없어요.<br>문장 카드 오른쪽 위 ☆를 누르면 여기 모여요.</p>`;
  bindToggles(el);
}

function find(el, params, query) {
  el.innerHTML = `<form class="searchbox" id="sf"><input type="search" id="q" placeholder="영어·한국어 아무 말이나 (예: prepare, 관사)" value="${esc(query.q || '')}" autocomplete="off" enterkeyhint="search"><button class="btn">찾기</button></form>${toggles()}<div id="res"></div>`;
  bindToggles(el);
  const res = $('#res', el), q = $('#q', el);
  const run = () => {
    const v = q.value.trim();
    const hits = search(v, 100);
    res.innerHTML = v.length < 2 ? '<p class="empty">두 글자 이상 입력해 주세요.</p>' : hits.length ? `<p class="small muted">${hits.length >= 100 ? '100개 이상' : hits.length + '개'} 찾았어요</p>` + hits.map(c => noteCard(c, { showLesson: true })).join('') : '<p class="empty">찾는 문장이 없어요.</p>';
    history.replaceState(null, '', '#/note?t=find&q=' + encodeURIComponent(v));
  };
  let tm = null;
  q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(run, 250); });
  $('#sf', el).addEventListener('submit', e => { e.preventDefault(); q.blur(); run(); });
  if (query.q) run(); else setTimeout(() => q.focus(), 50);
}
