/* 기록: 학습량, 30일 달력, 문장 진도, 실수 유형별 정답률, 발음, 자주 틀린 문장, 앞으로의 복습 */
import { S, streak } from '../core/store.js';
import { LESSONS, TAGS, PRON } from '../data/notes.js';
import { CARDS, itemKey, lessonProgress, resolve, parseKey, MODES, PRON_ROWS } from '../core/deck.js';
import { dayNum, dayKey, level } from '../core/srs.js';
import { esc, pct, fmtMin } from './ui.js';
import { levelInfo, nextTitle, skills, overall, lastDays, masteredSeries, weekdayOf, BADGES, FREEZE_MAX } from '../core/game.js';

/* 30일 익힘 수 추이 선 그래프 (SVG) */
function growthSvg(series, W = 320, H = 90) {
  const max = Math.max(5, ...series.map(s => s.m));
  const n = series.length;
  const x = i => 8 + i * (W - 16) / (n - 1), y = v => H - 14 - v / max * (H - 24);
  const pts = series.map((s, i) => `${x(i).toFixed(1)},${y(s.m).toFixed(1)}`);
  const last = series[n - 1];
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="최근 30일 익힌 문장 수">
    <line x1="8" y1="${H - 14}" x2="${W - 8}" y2="${H - 14}" stroke="var(--line)"/>
    <path d="M${pts[0]} L${pts.join(' L')} L${x(n - 1).toFixed(1)},${H - 14} L8,${H - 14} Z" fill="var(--sky)" opacity=".15"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="var(--sky)" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="${x(n - 1).toFixed(1)}" cy="${y(last.m).toFixed(1)}" r="4" fill="var(--blue)"/>
    <text x="${W - 8}" y="${Math.max(10, y(last.m) - 8).toFixed(1)}" text-anchor="end" font-size="12" fill="var(--ink)" font-weight="700">${last.m}</text>
    <text x="8" y="${H - 2}" font-size="10" fill="var(--muted)">30일 전</text><text x="${W - 8}" y="${H - 2}" text-anchor="end" font-size="10" fill="var(--muted)">오늘</text>
  </svg>`;
}

export default {
  title: '기록', tab: 'stats',
  render(view, params, query) {
    const today = dayNum();
    const logs = Object.values(S.log);
    const total = logs.reduce((a, l) => a + l.n, 0);
    const okAll = logs.reduce((a, l) => a + l.ok, 0);
    const ms = logs.reduce((a, l) => a + (l.ms || 0), 0);
    const days = logs.filter(l => l.n > 0).length;

    if (!total) {
      view.innerHTML = `<div class="done-h"><big>▤</big><h2>아직 기록이 없어요</h2><p class="muted">연습을 하면 여기에 학습량, 실수 유형별 정답률, 발음 결과가 쌓여요.</p></div><a class="btn primary block" href="#/s/today">오늘의 학습 시작</a>`;
      return;
    }

    // 30일 달력 (왼쪽 위가 29일 전)
    const cells = [];
    for (let d = today - 29; d <= today; d++) {
      const L = S.log[dayKey(d)];
      const n = L ? L.n : 0;
      const lv = n === 0 ? 0 : n < 10 ? 1 : n < 25 ? 2 : n < 50 ? 3 : 4;
      cells.push(`<i class="l${lv}${d === today ? ' today' : ''}${L && L.frz && !n ? ' frz' : ''}" title="${dayKey(d)} · ${n}문제${L && L.frz ? ' · 휴식권' : ''}"></i>`);
    }

    // 문장 진도 (말하기 기준)
    const lv = { new: 0, learning: 0, review: 0, mastered: 0 };
    CARDS.forEach(c => { lv[level(S.srs[itemKey('speak', c.id)])]++; });
    const C = { new: 'var(--head)', learning: 'var(--warn)', review: 'var(--sky)', mastered: 'var(--good)' };
    const L2 = { new: '처음', learning: '익히는 중', review: '복습 중', mastered: '익힘(21일+)' };

    // 실수 유형
    const tagTotal = {};
    CARDS.forEach(c => c.g.forEach(t => { tagTotal[t] = (tagTotal[t] || 0) + 1; }));
    const tagRows = Object.keys(TAGS).filter(t => t !== 'ok' && t !== 'asr').map(t => ({ t, s: S.tagStats[t], tot: tagTotal[t] || 0 }))
      .sort((a, b) => ((a.s && a.s.n ? a.s.ok / a.s.n : 2) - (b.s && b.s.n ? b.s.ok / b.s.n : 2)));

    // 연습 종류별
    const byMode = {};
    for (const [k, st] of Object.entries(S.srs)) { const t = parseKey(k).type; const b = byMode[t] || (byMode[t] = { n: 0, c: 0, items: 0 }); b.n += st.n; b.c += st.c; b.items++; }

    // 자주 틀린 문제
    const hard = Object.entries(S.srs).filter(([k, st]) => st.l > 0 && resolve(k)).sort((a, b) => (b[1].l - a[1].l) || (a[1].i - b[1].i)).slice(0, 10);

    // 앞으로 7일 복습
    const fc = Array(7).fill(0);
    for (const [k, st] of Object.entries(S.srs)) { if (!st.n || !resolve(k)) continue; const d = Math.max(0, st.d - today); if (d < 7) fc[d]++; }
    const fmax = Math.max(1, ...fc);

    // 발음
    const pronRows = PRON_ROWS.filter(r => S.pron[r.w]).map(r => ({ r, p: S.pron[r.w] })).sort((a, b) => (a.p.ok / a.p.n) - (b.p.ok / b.p.n));
    const prog = lessonProgress(S);

    const li = levelInfo(S.xp), nt = nextTitle(li.level);
    const sk = skills(S).sort((a, b) => b.pct - a.pct);
    const ov = overall(S);
    const d14 = lastDays(S, 14, today);
    const xmax = Math.max(50, ...d14.map(d => d.xp));
    const series = masteredSeries(S, 30, today);
    const gotBadges = BADGES.filter(b => S.badges[b.id]).sort((a, b) => S.badges[b.id] - S.badges[a.id]);
    const lockedBadges = BADGES.filter(b => !S.badges[b.id]);

    view.innerHTML = `
      <div class="xpcard">
        <div class="row"><span class="lvbadge big">Lv.${li.level}</span><div style="flex:1"><b style="font-size:18px">${esc(li.title)}</b><div class="small muted">${S.xp} XP · ${nt ? `레벨 ${nt.level}이 되면 「${esc(nt.title)}」` : '최고 칭호예요'}</div></div></div>
        <div class="meter lv" style="height:10px;margin-top:10px"><i style="width:${li.pct}%"></i></div>
        <div class="tiny muted" style="margin-top:4px">레벨 ${li.level + 1}까지 ${li.need - li.cur} XP · 한 문제 2~12 XP, 새 문장 +4, 3연속부터 +3, 오늘 첫 문제 +10, 목표 달성 +30</div>
      </div>

      <div class="panel" id="skills"><h2>성장</h2>
        <div class="row" style="margin:4px 0 2px"><b>익힌 문장 ${series[series.length - 1].m}개</b><span class="spacer"></span><span class="small muted">30일 전 ${series[0].m}개 → ${series[series.length - 1].m - series[0].m >= 0 ? '+' : ''}${series[series.length - 1].m - series[0].m}</span></div>
        ${growthSvg(series)}
        <div class="row" style="margin:12px 0 2px"><b>최근 14일 XP</b><span class="spacer"></span><span class="small muted">합계 ${d14.reduce((a, d) => a + d.xp, 0)}</span></div>
        <div class="week w14">${d14.map(d => `<div class="wd${d.d === today ? ' today' : ''}${d.frz ? ' frz' : ''}" title="${d.key} · ${d.xp} XP"><i style="height:${Math.round(Math.min(1, d.xp / xmax) * 50)}px"></i><em>${d.d === today ? '오늘' : weekdayOf(d.d)}</em></div>`).join('')}</div>
        <hr class="sep">
        <div class="row"><b>전체 숙련도 ${ov}%</b><span class="spacer"></span><span class="tiny muted">처음 0 · 익히는 중 35 · 복습 중 70 · 익힘 100</span></div>
        <div class="meter lv" style="height:10px;margin:6px 0 10px"><i style="width:${ov}%"></i></div>
        ${sk.map(s => `<div class="tagrow"><a href="#/s/speak?tag=${s.tag}&order=due&n=10" style="text-decoration:none;color:inherit">${esc(s.name)}</a>
            <div class="meter ${s.pct < 25 ? 'bad' : s.pct < 60 ? 'warn' : 'good'}"><i style="width:${s.pct}%"></i></div>
            <span class="v"><b style="color:var(--ink)">${s.pct}%</b> <span class="tiny">${s.mastered}/${s.n}</span></span></div>`).join('')}
        <p class="tiny muted" style="margin:6px 0 0">그 실수 유형이 있던 문장을 얼마나 오래 기억하는지예요. 오른쪽은 익힌 문장 수 / 전체.</p>
      </div>

      <div class="panel" id="badges"><h2>배지 <span class="small muted" style="font-weight:400">${gotBadges.length}/${BADGES.length}</span></h2>
        <div class="badges">${gotBadges.map(b => `<div class="badge-it got"><span class="bi">${b.icon}</span><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join('')}
        ${lockedBadges.map(b => `<div class="badge-it"><span class="bi">${b.icon}</span><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join('')}</div>
      </div>

      <div class="grid2">
        <div class="stat"><b>${total}</b><span>푼 문제 · 정답 ${pct(okAll, total)}%</span></div>
        <div class="stat"><b>${streak(today)}일</b><span>연속 학습 · 총 ${days}일${S.freezes ? ` · 🧊 ${S.freezes}/${FREEZE_MAX}` : ''}</span></div>
        <div class="stat"><b>${fmtMin(ms)}</b><span>연습한 시간</span></div>
        <div class="stat"><b>${lv.mastered}<small style="font-size:14px;color:var(--muted)">/${CARDS.length}</small></b><span>익힌 문장</span></div>
      </div>

      <div class="panel"><h2>최근 30일</h2><div class="heat">${cells.join('')}</div>
        <p class="tiny muted" style="margin:6px 0 0">진할수록 많이 풀었어요 (1~9 · 10~24 · 25~49 · 50+). 테두리가 오늘이에요.</p></div>

      <div class="panel"><h2>문장 진도 <span class="small muted" style="font-weight:400">말하기 카드 기준</span></h2>
        <div class="lvbar">${Object.keys(lv).filter(k => k !== 'new').map(k => `<i style="width:${pct(lv[k], CARDS.length)}%;background:${C[k]}"></i>`).join('')}</div>
        <div class="lvlegend">${Object.keys(lv).map(k => `<span style="--c:${C[k]}">${L2[k]} ${lv[k]}</span>`).join('')}</div>
        <hr class="sep">
        ${LESSONS.map((l, i) => `<div class="tagrow"><a href="#/note/les/${i}" style="text-decoration:none;color:inherit">${esc(l.date)}</a><div class="meter"><i style="width:${pct(prog[i].seen, prog[i].total)}%"></i></div><span class="v">${prog[i].seen}/${prog[i].total}</span></div>`).join('')}
      </div>

      <div class="panel"><h2>실수 유형별 정답률</h2>
        <p class="tiny muted" style="margin:-4px 0 6px">그 유형 실수가 있던 문장을 풀었을 때 맞힌 비율 (낮은 순)</p>
        ${tagRows.map(({ t, s, tot }) => {
          const a = s && s.n ? pct(s.ok, s.n) : null;
          return `<div class="tagrow"><a href="#/s/speak?tag=${t}&order=weak&n=10" style="text-decoration:none;color:inherit">${esc(TAGS[t])}</a>
            <div class="meter ${a == null ? '' : a < 60 ? 'bad' : a < 80 ? 'warn' : 'good'}"><i style="width:${a == null ? 0 : a}%"></i></div>
            <span class="v">${a == null ? `– <span class="tiny">/${tot}</span>` : a + '%'}</span></div>`;
        }).join('')}
      </div>

      <div class="panel"><h2>연습 종류별</h2>
        ${Object.entries(byMode).map(([t, b]) => `<div class="tagrow"><span>${MODES[t].icon} ${esc(MODES[t].short)}</span><div class="meter good"><i style="width:${pct(b.c, b.n)}%"></i></div><span class="v">${pct(b.c, b.n)}%</span></div>`).join('')}
        <p class="tiny muted" style="margin:6px 0 0">${Object.entries(byMode).map(([t, b]) => `${MODES[t].short} ${b.items}문제`).join(' · ')}</p>
      </div>

      <div class="panel"><h2>앞으로 7일 복습</h2>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;align-items:end;height:90px">
          ${fc.map((n, i) => `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;font-size:11.5px;color:var(--muted)"><span>${n}</span><i style="display:block;width:70%;height:${Math.round(n / fmax * 56)}px;min-height:2px;background:var(--blue);border-radius:3px 3px 0 0"></i><span>${i === 0 ? '오늘' : i === 1 ? '내일' : '+' + i}</span></div>`).join('')}
        </div>
      </div>

      ${hard.length ? `<div class="panel"><h2>자주 틀린 문제</h2>
        ${hard.map(([k, st]) => { const it = resolve(k); const tx = it.card ? it.card.f : it.row ? it.row.w : it.pair ? it.pair.join(' / ') : it.phrase ? it.phrase.en : it.pattern.good;
          return `<a class="list-item" href="${it.card ? '#/card/' + esc(it.card.id) : '#/s/one?k=' + encodeURIComponent(k)}"><div class="tx"><span class="en">${esc(tx)}</span><span class="small muted">${esc(MODES[it.type].short)}${it.card ? ' · ' + esc(it.card.lesson.date) : ''}</span></div><span class="badge">${st.l}번</span></a>`; }).join('')}
        <a class="btn block" style="margin-top:10px" href="#/s/keys?keys=${encodeURIComponent(hard.map(h => h[0]).join(','))}&label=${encodeURIComponent('자주 틀린 문제')}">이 ${hard.length}문제 다시 풀기</a></div>` : ''}

      ${pronRows.length ? `<div class="panel"><h2>발음 체크 결과</h2>
        ${pronRows.map(({ r, p }) => `<div class="tagrow"><span class="en" style="font-size:15.5px">${esc(r.w)}</span><div class="meter ${p.ok / p.n < 0.5 ? 'bad' : p.ok / p.n < 0.8 ? 'warn' : 'good'}"><i style="width:${pct(p.ok, p.n)}%"></i></div><span class="v">${p.ok}/${p.n}</span></div>
          ${p.last && p.last[0] && !p.last[0].ok ? `<div class="tiny muted" style="margin:-4px 0 4px">최근: “${esc(p.last[0].h)}”(으)로 들림</div>` : ''}`).join('')}
        <p class="tiny muted" style="margin:6px 0 0">${PRON.reduce((a, g) => a + g.rows.length, 0)}개 중 ${pronRows.length}개 연습</p></div>` : ''}`;
    if (query && query.to) { const t = document.getElementById(query.to); if (t) setTimeout(() => t.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50); }
  }
};
