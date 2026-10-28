/* 연습 세션: 문제 목록을 하나씩 풀고, 틀린 것은 세션 끝에 한 번 더, 끝나면 요약 */
import { S, record, setResume, todayLog, streak } from '../core/store.js';
import { buildSession, buildToday, resolve, MODES, parseKey } from '../core/deck.js';
import { stt, tts } from '../core/speech.js';
import { MOUNT } from './items.js';
import { $, esc, confirmSheet, pct, fmtMin, toast } from './ui.js';
import { levelInfo, nextTitle, STREAK_STEPS } from '../core/game.js';
import { beep } from '../core/speech.js';

export default {
  title: '연습', parentTab: 'practice', fullscreen: true,
  render(view, params, query) {
    const mode = params[0] || 'today';
    let keys, label;
    let resume = null;
    if (mode === 'resume' && S.resume && S.resume.keys) { resume = S.resume; keys = resume.keys.slice(); label = resume.label; }
    else if (mode === 'today' || mode === 'resume') {
      const L = todayLog();
      keys = buildToday(S, { size: S.settings.sessionSize, newLimit: Math.max(0, S.settings.newPerDay - L.nw) });
      label = '오늘의 학습';
    } else if (mode === 'one') { keys = [query.k]; label = '한 문제'; }
    else if (mode === 'keys') { keys = (query.keys || '').split(',').filter(Boolean); label = query.label || '다시 풀기'; }
    else if (MODES[mode]) {
      keys = buildSession(mode, query, S, { size: +query.n || S.settings.sessionSize, order: query.order || 'due' });
      label = MODES[mode].label;
    } else keys = [];
    keys = keys.filter(k => resolve(k));

    if (!keys.length) {
      view.innerHTML = `<div class="sess-top"><div class="in"><a class="icon-btn" href="#/practice" aria-label="닫기">✕</a><b>${esc(label || '연습')}</b></div></div>
        <div class="done-h"><big>✓</big><h2>지금 풀 문제가 없어요</h2>
        <p class="muted">${query.order === 'weak' ? '자주 틀린 문제가 아직 없어요.' : query.order === 'new' ? '이 범위는 모두 풀어 봤어요.' : '복습할 문제를 다 했어요. 다른 범위나 순서를 골라 보세요.'}</p></div>
        <a class="btn primary block" href="#/practice">연습 고르기</a>`;
      return;
    }

    const state = resume ? { keys, idx: resume.idx, results: resume.results || [], retried: new Set(resume.retried || []), xp: resume.xp || 0, combo: 0, best: resume.best || 0, lvUp: 0, badges: [], events: [] }
      : { keys, idx: 0, results: [], retried: new Set(), xp: 0, combo: 0, best: 0, lvUp: 0, badges: [], events: [] };
    const persist = mode !== 'one';
    const t0 = Date.now();
    let itemStart = Date.now(), off = null;

    view.innerHTML = `<div class="sess-top"><div class="in">
        <button class="icon-btn" id="x" aria-label="그만하기">✕</button>
        <div class="prog"><i id="pg"></i></div><span class="cnt" id="cnt"></span></div></div>
      <div class="q" id="q"></div>`;
    const q = $('#q', view);

    const save = () => {
      if (!persist) return;
      if (state.idx >= state.keys.length) setResume(null);
      else setResume({ keys: state.keys, idx: state.idx, results: state.results, retried: [...state.retried], label, t: Date.now(), xp: state.xp, best: state.best });
    };
    const top = () => {
      $('#pg', view).style.width = pct(state.idx, state.keys.length) + '%';
      $('#cnt', view).textContent = `${Math.min(state.idx + 1, state.keys.length)} / ${state.keys.length}`;
    };
    const show = () => {
      if (off) { try { off(); } catch (e) {} off = null; }
      tts.cancel(); stt.abort();
      top();
      if (state.idx >= state.keys.length) return finish();
      const key = state.keys[state.idx];
      const item = resolve(key);
      q.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'q';
      box.style.minHeight = 'auto'; box.style.flex = '1';
      q.appendChild(box);
      itemStart = Date.now();
      const isRetry = state.results.some(r => r.k === key);
      off = MOUNT[item.type](box, item, (g, info = {}) => {
        if (state.idx >= state.keys.length || state.keys[state.idx] !== key) return;
        state.combo = g >= 2 ? state.combo + 1 : 0;
        if (state.combo > state.best) state.best = state.combo;
        const rw = record(key, g, { ms: Date.now() - itemStart, said: info.said, combo: state.combo });
        state.xp += rw.xp;
        state.results.push({ k: key, g, retry: isRetry, xp: rw.xp });
        if (rw.levelUp) state.lvUp = rw.levelUp;
        if (rw.badges.length) state.badges.push(...rw.badges);
        if (rw.goalHit) state.events.push('goal');
        if (rw.frozen.length) state.events.push('frozen');
        if (rw.freezeGot) state.events.push('freeze');
        if (rw.levelUp) { toast(`🎉 레벨 ${rw.levelUp}! ${esc(levelInfo(S.xp).title)}`, 2600); if (S.settings.sound) beep(true); }
        else if (rw.badges.length) toast(`${rw.badges[0].icon} 배지: ${rw.badges[0].name}`, 2400);
        else if (rw.goalHit) toast('🎯 오늘 목표 달성! +30 XP', 2400);
        else if (state.combo >= 3 && (state.combo === 3 || state.combo === 5 || state.combo % 10 === 0)) toast(`🔥 ${state.combo}연속 정답! +${rw.xp} XP`, 1500);
        else toast(`+${rw.xp} XP`, 900);
        if (g === 0 && !state.retried.has(key)) { state.retried.add(key); state.keys.push(key); }
        state.idx++;
        save();
        window.scrollTo(0, 0);
        show();
      });
      if (isRetry) {
        const k = box.querySelector('.kind');
        if (k) k.insertAdjacentHTML('beforeend', '<span class="badge">다시 한 번</span>');
      }
    };
    const finish = () => {
      setResume(null);
      const first = state.results.filter(r => !r.retry);
      const ok = first.filter(r => r.g >= 2).length;
      const wrong = [...new Set(state.results.filter(r => r.g === 0).map(r => r.k))];
      const byType = {};
      first.forEach(r => { const t = parseKey(r.k).type; const b = byType[t] || (byType[t] = { n: 0, ok: 0 }); b.n++; if (r.g >= 2) b.ok++; });
      const L = todayLog();
      const goal = S.settings.goal;
      const rw0 = { streak: streak() };
      $('#pg', view).style.width = '100%';
      $('#cnt', view).textContent = '끝';
      const li = levelInfo(S.xp);
      const nt = nextTitle(li.level);
      const st = rw0.streak;
      const nextStep = STREAK_STEPS.find(x => x > st);
      q.innerHTML = `<div class="done-h"><big>${pct(ok, first.length) >= 80 ? '🎉' : '👍'}</big><h2>${esc(label)} 끝!</h2>
          <p class="muted">${first.length}문제 중 ${ok}개 맞힘 · ${pct(ok, first.length)}% · ${fmtMin(Date.now() - t0)}</p></div>
        <div class="xpcard">
          <div class="row"><div class="xpbig">+${state.xp} <small>XP</small></div><div class="spacer"></div><div class="small">최고 ${state.best}연속</div></div>
          <div class="row" style="margin-top:8px"><b>레벨 ${li.level} · ${esc(li.title)}</b><span class="spacer"></span><span class="small muted">${li.cur}/${li.need}</span></div>
          <div class="meter lv" style="height:10px"><i style="width:${li.pct}%"></i></div>
          <div class="tiny muted" style="margin-top:4px">${state.lvUp ? `🎉 레벨 ${state.lvUp}에 올랐어요!` : `다음 레벨까지 ${li.need - li.cur} XP${nt ? ` · 레벨 ${nt.level}이 되면 「${nt.title}」` : ''}`}</div>
        </div>
        <div class="panel" style="padding:12px 16px"><div class="row"><span style="font-size:26px">${st >= 7 ? '🔥' : '🕯'}</span><div style="flex:1"><b>연속 ${st}일</b><div class="small muted">${state.events.includes('frozen') ? '휴식권이 어제를 지켜 줬어요 · ' : ''}${nextStep ? `${nextStep}일까지 ${nextStep - st}일 남았어요` : '대단해요!'}${state.events.includes('freeze') ? ' · 휴식권 +1 🧊' : ''}</div></div></div></div>
        ${state.badges.length ? `<div class="panel"><h3>새 배지</h3><div class="badges">${state.badges.map(b => `<div class="badge-it got pop"><span class="bi">${b.icon}</span><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join('')}</div></div>` : ''}
        <div class="grid3">${Object.entries(byType).map(([t, b]) => `<div class="stat"><b>${b.ok}/${b.n}</b><span>${esc(MODES[t].short)}</span></div>`).join('')}</div>
        <div class="panel"><div class="row"><div style="flex:1"><b>오늘 ${L.n}문제 · ${L.xp || 0} XP</b><div class="small muted">하루 목표 ${goal}문제${L.n >= goal ? ' · 달성!' : ` · ${goal - L.n}문제 남음`}</div></div></div>
          <div class="meter good" style="margin-top:8px"><i style="width:${Math.min(100, pct(L.n, goal))}%"></i></div></div>
        ${wrong.length ? `<div class="panel"><h3>틀린 문제 ${wrong.length}개</h3>${wrong.slice(0, 12).map(k => { const it = resolve(k); return `<div class="list-item"><div class="tx"><span class="en">${esc(itemText(it))}</span><span class="small muted">${esc(MODES[it.type].short)}</span></div>${it.card ? `<a class="btn sm" href="#/card/${esc(it.card.id)}">보기</a>` : ''}</div>`; }).join('')}</div>` : ''}
        <div style="display:flex;flex-direction:column;gap:8px;margin:14px 0 30px">
          ${wrong.length ? `<a class="btn primary block" href="#/s/keys?keys=${encodeURIComponent(wrong.join(','))}&label=${encodeURIComponent('틀린 문제 다시')}">틀린 ${wrong.length}문제 다시 풀기</a>` : ''}
          <a class="btn block${wrong.length ? '' : ' primary'}" href="#/s/today">${L.n < goal ? `목표까지 ${goal - L.n}문제 더` : '오늘의 학습 더 하기'}</a>
          <a class="btn block ghost" href="#/">처음 화면</a>
        </div>`;
    };

    $('#x', view).onclick = async () => {
      const left = state.keys.length - state.idx;
      if (state.idx > 0 && left > 0 && persist) {
        if (!await confirmSheet('그만할까요?', `지금까지 푼 ${state.idx}문제 기록은 저장됐어요. 남은 ${left}문제는 처음 화면 「이어서 하기」로 계속할 수 있어요.`, '그만하기')) return;
      }
      if (mode === 'one' && history.length > 1) history.back(); else location.hash = '#/';
    };
    const onKey = e => {
      if (e.target.closest('textarea,input')) return;
      if (/^[1-4]$/.test(e.key)) { const b = q.querySelector(`[data-g="${+e.key - 1}"]`); if (b) b.click(); }
      if (e.key === 'Enter') { const b = q.querySelector('#next'); if (b) b.click(); }
    };
    document.addEventListener('keydown', onKey);
    save();
    show();
    return () => { document.removeEventListener('keydown', onKey); if (off) try { off(); } catch (e) {} stt.abort(); tts.cancel(); };
  }
};

function itemText(it) {
  if (it.card) return it.card.f;
  if (it.row) return it.row.w;
  if (it.pair) return it.pair[0] + ' / ' + it.pair[1];
  if (it.phrase) return it.phrase.en;
  if (it.pattern) return it.pattern.good;
  return '';
}
