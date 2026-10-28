/* 동기부여 화면: 일일 목표 링·연속 학습·레벨·주간 XP (홈 상단) + 「내 성장」(배지·유형별 숙련도·처음 vs 최근) */
(function (root) {
  'use strict';
  const { util, bank, analysis, xp, store, ui } = root.OPIC;
  const esc = util.escapeHtml;
  const P = {};

  P.ring = function (pct, size, label, sub) {
    const r = 42, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
    return `<svg class="ring" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(label)} ${esc(sub || '')}">
      <circle class="ring-bg" cx="50" cy="50" r="${r}"/>
      ${p > 0 ? `<circle class="ring-fg ${p >= 1 ? 'full' : ''}" cx="50" cy="50" r="${r}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/>` : ''}
      <text x="50" y="${sub ? 49 : 56}" class="ring-t">${esc(label)}</text>${sub ? `<text x="50" y="66" class="ring-s">${esc(sub)}</text>` : ''}</svg>`;
  };

  function weekBars(days, goal, n) {
    const out = [];
    const W = ['일', '월', '화', '수', '목', '금', '토'];
    const vals = [];
    for (let i = n - 1; i >= 0; i--) { const t = Date.now() - i * util.DAY; vals.push({ t, v: days[util.dayKey(t)] || 0 }); }
    const max = Math.max(goal, ...vals.map(x => x.v), 1);
    vals.forEach((x, i) => {
      const h = Math.round((x.v / max) * 100);
      out.push(`<li class="${x.v >= goal ? 'met' : ''} ${i === vals.length - 1 ? 'today' : ''}" title="${new Date(x.t).getMonth() + 1}/${new Date(x.t).getDate()}: ${x.v} XP">
        <span class="wb-v">${x.v || ''}</span><span class="wb-bar"><i style="height:${h}%"></i></span><span class="wb-d">${i === vals.length - 1 ? (n > 7 ? '●' : '오늘') : n > 7 ? new Date(x.t).getDate() : W[new Date(x.t).getDay()]}</span></li>`);
    });
    return `<ol class="weekbars" aria-label="최근 ${n}일 XP">${out.join('')}</ol><p class="muted small wb-legend"><span class="dot-met"></span> 목표(${goal} XP) 달성한 날</p>`;
  }

  /* 홈 상단 카드 */
  P.heroHtml = function () {
    const X = store.S.xp;
    const goal = store.S.settings.dailyGoal || 40;
    const today = X.days[util.dayKey(Date.now())] || 0;
    const st = xp.streakInfo(X, Date.now());
    const lv = xp.levelInfo(X.total);
    const left = Math.max(0, goal - today);
    const msg = today >= goal ? '오늘 목표 달성! 내일도 만나요 🔥'
      : !st.todayDone ? (st.streak ? `오늘 한 문제만 녹음해도 ${st.streak + 1}일 연속이 돼요` : '오늘 첫 문제를 녹음해 연속 학습을 시작해요')
      : `목표까지 ${left} XP — 답변 하나면 충분해요`;
    return `<section class="card hero2">
      <div class="hero-top">
        <div class="ring-wrap">${P.ring(today / goal, 112, `${today}`, `/ ${goal} XP`)}</div>
        <div class="hero-side">
          <div class="flame ${st.todayDone ? 'on' : ''}"><span class="fl-i">🔥</span><b>${st.streak}</b><span>일 연속</span></div>
          ${X.freezes ? `<div class="freeze" title="하루를 쉬어도 연속 학습이 끊기지 않게 지켜 줍니다 (7일 연속마다 1개, 최대 2개)">🧊 보호권 ${X.freezes}</div>` : ''}
          <a class="lv" href="#/progress"><span>Lv.${lv.level} ${esc(lv.name)}</span><span class="lvbar"><i style="width:${Math.round(lv.pct * 100)}%"></i></span><span class="muted small">${lv.into} / ${lv.need} XP</span></a>
        </div>
      </div>
      <p class="hero-msg">${msg}</p>
      ${(X.frozen || []).includes(util.dayKey(Date.now() - util.DAY)) ? '<p class="note small">🧊 어제 쉬었지만 보호권으로 연속 학습을 지켰어요.</p>' : ''}
      ${weekBars(X.days, goal, 7)}
      <a class="link small" href="#/progress">내 성장 · 배지 보기 ›</a>
    </section>`;
  };

  function fmtVal(it, v) {
    if (it.unit === 'sec') return util.fmtDur(v);
    if (it.unit === 'pct') return Math.round(v * 100) + '%';
    return (Math.round(v * 10) / 10).toString();
  }

  root.OPIC.screens.progress = {
    title: '내 성장', parentTab: 'records',
    render(el) {
      const X = store.S.xp;
      const lv = xp.levelInfo(X.total);
      const m = xp.mastery(store.S.recs, store.S.qs, bank.FOCUS_GROUPS, bank.byId);
      const g = xp.growth(store.S.recs, analysis.analyzeTranscript);
      const best = xp.bestStreak(X);
      const st = xp.streakInfo(X, Date.now());
      const got = X.badges || {};
      el.innerHTML = `
        <section class="card lvcard"><div class="lv-big">Lv.${lv.level}</div><div><b>${esc(lv.name)}</b><div class="lvbar big"><i style="width:${Math.round(lv.pct * 100)}%"></i></div>
          <span class="muted small">다음 레벨까지 ${lv.need - lv.into} XP · 총 ${X.total} XP</span></div></section>
        <section class="card"><dl class="stats four"><div><dt>연속 학습</dt><dd>🔥 ${st.streak}일</dd></div><div><dt>최고 기록</dt><dd>${best}일</dd></div>
          <div><dt>목표 달성</dt><dd>${(X.goalDays || []).length}일</dd></div><div><dt>연속 보호권</dt><dd>🧊 ${X.freezes || 0}</dd></div></dl>
          <p class="muted small">레벨·XP는 연습량을 보여 주는 표시이고, OPIc 등급과는 관계없습니다.</p></section>

        <section class="card"><h2>처음 → 최근, 이만큼 늘었어요</h2>
          ${g.ready ? `<ul class="growth">${g.items.map(it => {
            const up = it.b > it.a, same = Math.abs(it.b - it.a) < 1e-9;
            const good = same ? '' : (up === (it.better === 'up') ? 'good' : 'warn');
            return `<li><span class="g-l">${esc(it.label)}</span><span class="g-a">${fmtVal(it, it.a)}</span><span class="g-arrow ${good}">${same ? '→' : up ? '▲' : '▼'}</span><span class="g-b ${good}">${fmtVal(it, it.b)}</span></li>`;
          }).join('')}</ul><p class="muted small">처음 ${g.n}개 답변과 최근 ${g.n}개 답변의 평균 (규칙 기반 측정값, 점수 아님). 단어 수·연결어는 받아쓴 글이 있는 답변만.</p>`
          : `<p class="muted">답변을 ${6 - g.count}개 더 녹음하면 처음과 지금을 비교해 보여 줘요.</p>`}</section>

        <section class="card"><h2>유형별 숙련도</h2>
          <ul class="mastery">${m.map(x => `<li><span class="m-l">${esc(x.label)}</span><span class="m-stars" aria-label="${x.stars}/5">${'★'.repeat(x.stars)}<span class="off">${'★'.repeat(5 - x.stars)}</span></span>
            <span class="m-bar"><i style="width:${Math.round(x.score * 100)}%"></i></span><span class="muted small m-n">${x.questions}문제 · 첨삭 ${x.cycles}</span></li>`).join('')}</ul>
          <p class="muted small">연습한 문제 수(10문제까지) 50% + 자가 체크 달성률 30% + 첨삭 후 다시 답한 문제(3개까지) 20%. 연습 기록에서 계산한 표시예요.</p>
          <a class="btn block" href="#/practice">약한 유형 연습하러 가기</a></section>

        <section class="card"><h2>배지 <span class="badge">${Object.keys(got).length} / ${xp.BADGES.length}</span></h2>
          <ul class="badges">${xp.BADGES.map(b => `<li class="${got[b.id] ? 'got' : ''}" title="${esc(b.desc)}"><span class="b-i">${got[b.id] ? b.icon : '🔒'}</span><b>${esc(b.name)}</b><span class="small muted">${esc(b.desc)}</span></li>`).join('')}</ul></section>

        <section class="card"><h2>최근 14일 XP</h2>${weekBars(X.days, store.S.settings.dailyGoal || 40, 14)}</section>

        <section class="card"><h2>XP 받는 법</h2><ul class="xprules">${xp.RULES.map(([a, b]) => `<li><span>${esc(a)}</span><b>${esc(b)}</b></li>`).join('')}</ul>
          <details><summary>최근 받은 XP</summary><ul class="small xplog">${(X.log || []).slice(0, 30).map(l => `<li>${util.fmtDate(l.at)} · +${l.xp} · ${esc(l.why)}</li>`).join('') || '<li class="muted">아직 없어요</li>'}</ul></details></section>`;
    }
  };

  /* 보상 표시: +XP 말풍선, 목표 달성·레벨 업·배지는 축하 창 */
  let pending = [];
  P.pop = function (n) {
    const d = document.createElement('div');
    d.className = 'xppop';
    d.textContent = `+${n} XP`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1600);
  };
  P.celebrate = function (ev) {
    if (ev.goalReached || ev.levelUp || (ev.badges && ev.badges.length)) pending.push(ev);
    if (ev.freeze) ui.toast('🧊 7일 연속! 연속 보호권 1개를 받았어요.', 3500);
    P.flush();
  };
  /* 시험·녹음 중에는 흐름을 끊지 않도록 미뤘다가 보여 준다 */
  P.flush = async function () {
    if (!pending.length || document.querySelector('.exam-top, .adj-btn') || root.OPIC.recorder.isRecording() || document.querySelector('.modal-wrap')) return;
    const evs = pending; pending = [];
    const goal = evs.find(e => e.goalReached), lvUp = evs.filter(e => e.levelUp).pop();
    const badges = [].concat(...evs.map(e => e.badges || []));
    const st = xp.streakInfo(store.S.xp, Date.now());
    let html = '<div class="celebrate">';
    if (goal) html += `${P.ring(1, 120, '🎯', '목표 달성')}<p><b>오늘 목표 ${goal.goal} XP 달성!</b><br>🔥 ${st.streak}일 연속 학습 중</p>`;
    if (lvUp) html += `<p class="cel-lv">⭐ 레벨 업! <b>Lv.${lvUp.level} ${esc(lvUp.name)}</b></p>`;
    if (badges.length) html += `<ul class="badges small-b">${badges.map(b => `<li class="got"><span class="b-i">${b.icon}</span><b>${esc(b.name)}</b><span class="small muted">${esc(b.desc)}</span></li>`).join('')}</ul>`;
    html += '</div>';
    await ui.modal({ title: goal ? '잘했어요!' : lvUp ? '레벨 업!' : '새 배지!', html, actions: [{ label: '계속하기', value: true, kind: 'primary' }] });
    P.flush();
  };

  root.OPIC.P = P;
})(window);
