/* 오늘: 오늘의 학습, 약점, 오늘의 표현, 최근 수업 */
import { S, todayLog, streak } from '../core/store.js';
import { LESSONS, TAGS } from '../data/notes.js';
import { CARDS, PHRASES, buildToday, itemKey, tagWeights, lessonProgress, resolve, MODES } from '../core/deck.js';
import { dayNum, isDue, level } from '../core/srs.js';
import { esc, sayBtn, pct } from './ui.js';

export default {
  title: '회화 교정 노트', tab: 'home',
  render(view) {
    const today = dayNum();
    const L = todayLog();
    const goal = S.settings.goal;
    const due = Object.entries(S.srs).filter(([k, st]) => isDue(st, today) && resolve(k)).length;
    const newLeft = Math.max(0, S.settings.newPerDay - L.nw);
    const plan = buildToday(S, { size: S.settings.sessionSize, newLimit: newLeft, rnd: () => 0.5 }).length;
    const seen = CARDS.filter(c => S.srs[itemKey('speak', c.id)]).length;
    const mastered = CARDS.filter(c => level(S.srs[itemKey('speak', c.id)]) === 'mastered').length;
    const st = streak(today);
    const p = Math.min(100, pct(L.n, goal));
    const first = !Object.keys(S.srs).length;

    const w = tagWeights(S);
    const weak = Object.keys(TAGS).filter(t => t !== 'ok' && t !== 'asr').sort((a, b) => w[b] - w[a]).slice(0, 3);
    const ph = PHRASES[today % PHRASES.length];
    const prog = lessonProgress(S);
    const r = S.resume && S.resume.keys && S.resume.idx < S.resume.keys.length ? S.resume : null;
    const backupOld = Object.keys(S.srs).length >= 30 && Date.now() - (S.lastBackup || S.created) > 7 * 86400000;

    view.innerHTML = `
    <section class="hero">
      <div class="row" style="align-items:flex-start">
        <div style="flex:1">
          <h2>${first ? '내 수업 문장으로 시작해요' : L.n >= goal ? '오늘 목표 달성!' : '오늘의 학습'}</h2>
          <p>${first ? `수업 ${LESSONS.length}회에서 내가 한 문장 ${CARDS.length}개를 말하기·빈칸·발음 연습으로 바꿨어요.` : `복습 ${due}개 · 새 문장 ${Math.min(newLeft, S.settings.sessionSize)}개까지`}</p>
        </div>
        <div class="ring" style="--p:${p}" aria-label="오늘 목표 ${L.n}/${goal}"><i>${L.n >= goal ? '✓ ' + L.n : L.n + '/' + goal}</i></div>
      </div>
      <div class="nums">
        <div><b>${st}</b><span>연속 학습일</span></div>
        <div><b>${seen}</b><span>연습한 문장</span></div>
        <div><b>${mastered}</b><span>익힌 문장</span></div>
      </div>
      ${r ? `<a class="btn block" href="#/s/resume" style="margin-bottom:8px">이어서 하기 (${r.idx}/${r.keys.length})</a>` : ''}
      ${plan ? `<a class="btn block" href="#/s/today">${r ? '새로 ' : ''}${first ? '첫 학습 시작' : '시작하기'} · ${plan}문제</a>`
        : `<a class="btn block" href="#/practice">오늘 할 복습을 다 했어요 · 더 연습하기</a>`}
    </section>

    ${backupOld ? `<div class="panel" style="border-color:var(--warn)"><b>백업한 지 일주일이 지났어요.</b><p class="small muted" style="margin:4px 0 8px">아이폰은 오래 안 쓴 사이트 기록을 지울 수 있어요.</p><a class="btn sm" href="#/settings?backup=1">지금 백업하기</a></div>` : ''}

    <div class="sec-h"><h2>집중할 실수</h2><a href="#/note?t=mist">노트 보기 ›</a></div>
    <div class="panel" style="padding:4px 16px">
      ${weak.map(t => {
        const s = S.tagStats[t];
        const acc = s && s.n ? pct(s.ok, s.n) : null;
        const total = CARDS.filter(c => c.g.includes(t)).length;
        return `<div class="weak">
          <div class="nm"><b>${esc(TAGS[t])}</b><span>노트에 ${total}번 · ${acc == null ? '아직 연습 전' : `내 정답률 ${acc}% (${s.n}문제)`}</span></div>
          <a class="btn sm" href="#/s/speak?tag=${t}&order=due&n=10">10문제</a>
        </div>`;
      }).join('')}
    </div>

    <div class="sec-h"><h2>빠른 연습</h2><a href="#/practice">전체 ›</a></div>
    <div class="modes">
      ${['cloze', 'fix', 'pair'].map(m => `<a class="mode" href="#/s/${m}?order=due&n=10"><span class="mi">${MODES[m].icon}</span><b>${MODES[m].label}</b><span>${MODES[m].desc}</span></a>`).join('')}
    </div>

    <div class="sec-h"><h2>오늘의 표현</h2><a href="#/note?t=phr">더 보기 ›</a></div>
    <div class="phr"><div class="tx"><div class="en">${esc(ph.en)}</div><div class="kr">${esc(ph.kr)} · ${esc(ph.group)}</div></div>${sayBtn(ph.en)}</div>

    <div class="sec-h"><h2>수업</h2><a href="#/note?t=les">전체 ›</a></div>
    ${LESSONS.map((l, li) => ({ l, li })).reverse().slice(0, 4).map(({ l, li }) => {
      const g = prog[li];
      return `<a class="list-item" href="#/note/les/${li}">
        <div class="tx"><b>${esc(l.date)}</b> <span class="muted small">${esc(l.title)}</span>
          <div class="meter" style="margin-top:6px"><i style="width:${pct(g.seen, g.total)}%"></i></div></div>
        <span class="small muted">${g.seen}/${g.total}</span></a>`;
    }).join('')}
    <p class="tiny muted" style="margin-top:20px">기록은 이 기기 브라우저에만 저장돼요. 하루는 새벽 4시에 바뀌어요.</p>`;
  }
};
