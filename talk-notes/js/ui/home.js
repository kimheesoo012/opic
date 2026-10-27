/* 오늘: 레벨·XP·연속 학습, 오늘의 학습, 이번 주, 숙련도, 오늘의 표현, 최근 수업 */
import { S, todayLog, streak } from '../core/store.js';
import { LESSONS } from '../data/notes.js';
import { PHRASES, buildToday, lessonProgress, resolve, MODES } from '../core/deck.js';
import { dayNum, isDue } from '../core/srs.js';
import { levelInfo, encouragement, lastDays, weekdayOf, skills, overall, masteredCount, seenCount, STREAK_STEPS, FREEZE_MAX } from '../core/game.js';
import { esc, sayBtn, pct } from './ui.js';

export default {
  title: '회화 교정 노트', tab: 'home',
  render(view) {
    const today = dayNum();
    const L = todayLog();
    const goal = S.settings.goal;
    const newLeft = Math.max(0, S.settings.newPerDay - L.nw);
    const plan = buildToday(S, { size: S.settings.sessionSize, newLimit: newLeft, rnd: () => 0.5 }).length;
    const seen = seenCount(S), mastered = masteredCount(S);
    const st = streak(today);
    const p = Math.min(100, pct(L.n, goal));
    const first = !Object.keys(S.srs).length;
    const li = levelInfo(S.xp);
    const enc = encouragement(S, today);
    const nextStep = STREAK_STEPS.find(x => x > st);
    const week = lastDays(S, 7, today);
    const wmax = Math.max(goal, ...week.map(d => d.n));
    const sk = skills(S).sort((a, b) => a.pct - b.pct);
    const weak = sk.slice(0, 3);
    const ov = overall(S);
    const ph = PHRASES[today % PHRASES.length];
    const prog = lessonProgress(S);
    const r = S.resume && S.resume.keys && S.resume.idx < S.resume.keys.length ? S.resume : null;
    const backupOld = Object.keys(S.srs).length >= 30 && Date.now() - (S.lastBackup || S.created) > 7 * 86400000;

    view.innerHTML = `
    <section class="hero">
      <div class="row" style="align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div class="lvline"><span class="lvbadge">Lv.${li.level}</span><b>${esc(li.title)}</b><span class="spacer"></span><span class="small">${S.xp} XP</span></div>
          <div class="meter hero-m"><i style="width:${li.pct}%"></i></div>
          <div class="tiny" style="opacity:.85;margin-top:3px">다음 레벨까지 ${li.need - li.cur} XP</div>
        </div>
        <div class="ring" style="--p:${p}" aria-label="오늘 목표 ${L.n}/${goal}"><i>${L.n >= goal ? '✓ ' + L.n : L.n + '/' + goal}</i></div>
      </div>
      <div class="enc${enc.urgent ? ' urgent' : ''}"><span>${enc.icon}</span>${esc(enc.text)}</div>
      <div class="nums">
        <div><b>${st >= 7 ? '🔥' : '🕯'} ${st}</b><span>연속 학습일${S.freezes ? ` · 🧊 ${S.freezes}` : ''}</span></div>
        <div><b>${seen}</b><span>말해 본 문장</span></div>
        <div><b>${mastered}</b><span>익힌 문장</span></div>
      </div>
      ${r ? `<a class="btn block" href="#/s/resume" style="margin-bottom:8px">이어서 하기 (${r.idx}/${r.keys.length})</a>` : ''}
      ${plan ? `<a class="btn block" href="#/s/today">${r ? '새로 ' : ''}${first ? '첫 학습 시작' : L.n >= goal ? '더 하기' : '시작하기'} · ${plan}문제</a>`
        : `<a class="btn block" href="#/practice">오늘 할 복습을 다 했어요 · 더 연습하기</a>`}
    </section>

    ${backupOld ? `<div class="panel" style="border-color:var(--warn)"><b>백업한 지 일주일이 지났어요.</b><p class="small muted" style="margin:4px 0 8px">아이폰은 오래 안 쓴 사이트 기록을 지울 수 있어요.</p><a class="btn sm" href="#/settings?backup=1">지금 백업하기</a></div>` : ''}

    <div class="sec-h"><h2>이번 주</h2><a href="#/stats">기록 ›</a></div>
    <div class="panel">
      <div class="week">${week.map(d => `<div class="wd${d.d === today ? ' today' : ''}${d.n >= goal ? ' hit' : ''}${d.frz ? ' frz' : ''}" title="${d.key} · ${d.n}문제 · ${d.xp} XP">
          <span class="v">${d.frz && !d.n ? '🧊' : d.n || ''}</span><i style="height:${Math.round(Math.min(1, d.n / wmax) * 54)}px"></i><em>${weekdayOf(d.d)}</em></div>`).join('')}</div>
      <div class="row small muted" style="margin-top:6px;gap:6px;flex-wrap:wrap"><span>이번 주 ${week.reduce((a, d) => a + d.n, 0)}문제 · ${week.reduce((a, d) => a + d.xp, 0)} XP</span><span class="spacer"></span><span>${nextStep ? `${nextStep}일 연속까지 ${nextStep - st}일` : ''}</span></div>
    </div>

    <div class="sec-h"><h2>실력</h2><a href="#/stats?to=skills">자세히 ›</a></div>
    <div class="panel">
      <div class="row" style="margin-bottom:8px"><div style="flex:1"><b>전체 숙련도 ${ov}%</b><div class="tiny muted">633문장을 얼마나 오래 기억하고 있는지 (익힘 = 21일+)</div></div></div>
      <div class="meter lv" style="height:10px"><i style="width:${ov}%"></i></div>
      <hr class="sep">
      <div class="tiny muted" style="margin-bottom:4px">숙련도가 낮은 실수 유형 3개</div>
      ${weak.map(s => `<div class="weak">
          <div class="nm"><b>${esc(s.name)}</b><span>${s.n}문장 중 ${s.seen}개 말해 봄 · 익힘 ${s.mastered}</span><div class="meter ${s.pct < 25 ? 'bad' : s.pct < 60 ? 'warn' : 'good'}" style="margin-top:5px"><i style="width:${s.pct}%"></i></div></div>
          <div style="text-align:right"><b>${s.pct}%</b><br><a class="btn sm" href="#/s/speak?tag=${s.tag}&order=due&n=10">10문제</a></div>
        </div>`).join('')}
    </div>

    <div class="sec-h"><h2>빠른 연습</h2><a href="#/practice">전체 ›</a></div>
    <div class="modes">
      ${['cloze', 'fix', 'pair'].map(m => `<a class="mode" href="#/s/${m}?order=due&n=10"><span class="mi">${MODES[m].icon}</span><b>${MODES[m].label}</b><span>${MODES[m].desc}</span></a>`).join('')}
    </div>

    <div class="sec-h"><h2>오늘의 표현</h2><a href="#/note?t=phr">더 보기 ›</a></div>
    <div class="phr"><div class="tx"><div class="en">${esc(ph.en)}</div><div class="kr">${esc(ph.kr)} · ${esc(ph.group)}</div></div>${sayBtn(ph.en)}</div>

    <div class="sec-h"><h2>수업</h2><a href="#/note?t=les">전체 ›</a></div>
    ${LESSONS.map((l, i) => ({ l, i })).reverse().slice(0, 4).map(({ l, i }) => {
      const g = prog[i];
      return `<a class="list-item" href="#/note/les/${i}">
        <div class="tx"><b>${esc(l.date)}</b> <span class="muted small">${esc(l.title)}</span>
          <div class="meter" style="margin-top:6px"><i style="width:${pct(g.seen, g.total)}%"></i></div></div>
        <span class="small muted">${g.seen}/${g.total}</span></a>`;
    }).join('')}
    <p class="tiny muted" style="margin-top:20px">기록은 이 기기 브라우저에만 저장돼요. 하루는 새벽 4시에 바뀌어요. 7일 연속마다 휴식권 🧊이 생겨(최대 ${FREEZE_MAX}장) 하루 빼먹어도 연속을 지켜 줘요.</p>`;
  }
};
