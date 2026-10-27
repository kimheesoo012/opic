/* 기록: 학습량, 30일 달력, 문장 진도, 실수 유형별 정답률, 발음, 자주 틀린 문장, 앞으로의 복습 */
import { S, streak } from '../core/store.js';
import { LESSONS, TAGS, PRON } from '../data/notes.js';
import { CARDS, itemKey, lessonProgress, resolve, parseKey, MODES, PRON_ROWS } from '../core/deck.js';
import { dayNum, dayKey, level } from '../core/srs.js';
import { esc, pct, fmtMin } from './ui.js';

export default {
  title: '기록', tab: 'stats',
  render(view) {
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
      cells.push(`<i class="l${lv}${d === today ? ' today' : ''}" title="${dayKey(d)} · ${n}문제"></i>`);
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

    view.innerHTML = `
      <div class="grid2">
        <div class="stat"><b>${total}</b><span>푼 문제 · 정답 ${pct(okAll, total)}%</span></div>
        <div class="stat"><b>${streak(today)}일</b><span>연속 학습 · 총 ${days}일</span></div>
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
  }
};
