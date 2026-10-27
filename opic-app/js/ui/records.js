/* 기록: 학습 통계, 저장 공간 관리(녹음별 크기·선택 삭제·내보내기), 백업(JSON 내보내기·가져오기) */
(function (root) {
  'use strict';
  const { util, bank, picker, recorder, store, db, ui, C } = root.OPIC;
  const esc = util.escapeHtml;

  function trendSvg(weeks) {
    const pts = weeks.map((w, i) => ({ i, v: w.avg, n: w.count, end: w.end }));
    const vals = pts.filter(p => p.v != null).map(p => p.v);
    if (vals.length < 1) return '<p class="muted small">녹음이 쌓이면 주별 평균 답변 길이가 여기에 그려집니다.</p>';
    const W = 320, H = 120, P = 26;
    const max = Math.max(60, ...vals) * 1.1;
    const x = i => P + (i * (W - P - 8)) / (weeks.length - 1);
    const y = v => H - 20 - (v / max) * (H - 34);
    const seg = [];
    let cur = [];
    pts.forEach(p => { if (p.v == null) { if (cur.length) seg.push(cur); cur = []; } else cur.push(p); });
    if (cur.length) seg.push(cur);
    const lab = ts => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`; };
    return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 8주 주별 평균 답변 길이">
      <line class="axis" x1="${P}" y1="${H - 20}" x2="${W - 4}" y2="${H - 20}"/>
      <line class="grid" x1="${P}" y1="${y(60)}" x2="${W - 4}" y2="${y(60)}"/><text class="tick" x="${P - 4}" y="${y(60) + 4}" text-anchor="end">1분</text>
      ${max > 130 ? `<line class="grid" x1="${P}" y1="${y(120)}" x2="${W - 4}" y2="${y(120)}"/><text class="tick" x="${P - 4}" y="${y(120) + 4}" text-anchor="end">2분</text>` : ''}
      ${seg.map(s => `<polyline class="line" points="${s.map(p => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}"/>`).join('')}
      ${pts.filter(p => p.v != null).map(p => `<g class="pt"><circle class="hit" cx="${x(p.i)}" cy="${y(p.v)}" r="12"/><circle class="dotm" cx="${x(p.i)}" cy="${y(p.v)}" r="4"/><title>${lab(p.end)} 주: 평균 ${util.fmtDur(p.v)} (${p.n}개)</title></g>`).join('')}
      ${pts.filter((p, i) => i % 2 === 1).map(p => `<text class="tick" x="${x(p.i)}" y="${H - 5}" text-anchor="middle">${lab(p.end)}</text>`).join('')}
    </svg>`;
  }

  root.OPIC.screens.records = {
    title: '기록', tab: 'records',
    async render(el, params, query) {
      const st = store.stats();
      const S = store.S.settings;
      const maxG = Math.max(1, ...Object.values(st.byGroup));
      let est = null;
      try { est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch (e) {}
      let persisted = null;
      try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (e) {}
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const recs = store.S.recs;
      el.innerHTML = `
      <section class="card"><h2>학습 기록</h2>
        <dl class="stats four"><div><dt>연속 학습</dt><dd>${st.streak}일</dd></div><div><dt>학습한 날</dt><dd>${st.studyDays}일</dd></div>
          <div><dt>총 녹음 시간</dt><dd>${util.fmtDur(st.totalSec)}</dd></div><div><dt>평균 답변 길이</dt><dd>${util.fmtDur(st.avgSec)}</dd></div></dl>
        <h3>유형별 연습 횟수</h3>
        <ul class="hbars">${bank.FOCUS_GROUPS.map(g => `<li title="${esc(g.label)}: ${st.byGroup[g.id]}회"><span class="hb-l">${esc(g.label)}</span><span class="hb-t"><i style="width:${(st.byGroup[g.id] / maxG) * 100}%"></i></span><span class="hb-v">${st.byGroup[g.id]}</span></li>`).join('')}</ul>
        <h3>주별 평균 답변 길이</h3>${trendSvg(st.weeks)}
        <button class="btn block" id="copySum">결과 요약 복사</button></section>

      <section class="card"><h2>모의고사·연습 세션</h2>
        ${store.S.sessions.length ? `<ul class="qlist">${store.S.sessions.slice(0, 15).map(s => `<li><a href="${s.status === 'in_progress' && s.mode === 'exam' ? '#/exam?resume=' + s.id : '#/session/' + s.id}">
          <span class="chips"><span class="chip ${s.mode === 'exam' ? 'warn' : ''}">${s.mode === 'exam' ? '모의고사' : s.mode === 'daily' ? '오늘의 3문제' : '연습'}</span>${s.status === 'in_progress' ? '<span class="chip">진행 중</span>' : ''}</span>
          <span class="qprev">${util.fmtDate(s.startedAt)} · ${s.questions.length}문제${s.summary ? ' · ' + esc(s.summary) : ''}</span></a></li>`).join('')}</ul>` : '<p class="muted">아직 없습니다.</p>'}</section>

      <section class="card" id="storage"><h2>저장 공간</h2>
        <p>녹음 ${recs.length}개 · <b>${util.fmtBytes(st.bytes)}</b>${est && est.quota ? ` · 이 사이트 전체 사용량 ${util.fmtBytes(est.usage)} / 사용 가능 약 ${util.fmtBytes(est.quota)}` : ''}</p>
        <p class="small">${persisted ? '이 기기에 「지우지 않음」으로 보관 중입니다.' : '브라우저가 공간이 부족할 때 데이터를 지울 수 있는 상태입니다.'} ${persisted === false && navigator.storage && navigator.storage.persist ? '<button class="btn small" id="persist">보관 요청</button>' : ''}</p>
        ${isIOS ? '<p class="note small">아이폰 Safari는 한동안 열지 않은 사이트의 저장 데이터를 지울 수 있어요. <b>공유 → 홈 화면에 추가</b>로 설치해서 쓰고, 중요한 녹음과 기록은 일주일에 한 번 아래 「백업」으로 내보내 두세요.</p>' : ''}
        <div class="row"><button class="btn small" id="selOld">30일 지난 녹음 선택</button><button class="btn small" id="selNone">선택 해제</button></div>
        <ul class="reclist">${recs.map(r => { const q = bank.byId[r.questionId]; return `<li><label><input type="checkbox" value="${r.id}">
          <span class="rl-main"><span class="small">${util.fmtDate(r.createdAt)} · ${util.fmtDur(r.durationSec)} · <b>${util.fmtBytes(r.size)}</b>${r.mime ? ' · ' + esc(recorder.extOf(r.mime)) : ''}</span>
          <span class="muted small">${q ? esc(bank.topicById[q.topic].label) + ' · ' + esc(bank.TYPE_LABELS[q.type]) + ' · ' + picker.KIND_LABELS[r.kind] : esc(r.promptText || r.mode)}</span></span></label>
          ${q ? `<a class="link small" href="#/q/${encodeURIComponent(q.id)}?rec=${r.id}">열기</a>` : `<button class="link small open-rec" data-id="${r.id}">열기</button>`}</li>`; }).join('') || '<li class="muted">녹음이 없습니다.</li>'}</ul>
        <div class="sticky-foot" id="selBar" hidden><span id="selInfo"></span><button class="btn" id="expSel">오디오 내보내기</button><button class="btn danger" id="delSel">삭제</button></div>
      </section>

      <section class="card" id="backup"><h2>백업</h2>
        <p class="small">마지막 내보내기: ${S.lastExportAt ? new Date(S.lastExportAt).toLocaleString('ko-KR') : '없음'}</p>
        <label class="opt"><input type="checkbox" id="withAudio"> 녹음 오디오도 포함 (파일이 커집니다: 약 ${util.fmtBytes(st.bytes * 1.35)})</label>
        <button class="btn primary block" id="exp">기록 JSON 내보내기</button>
        <label class="btn block">기록 JSON 가져오기<input type="file" id="imp" accept="application/json,.json" hidden></label>
        <p class="muted small">가져오기는 기존 기록에 합쳐집니다. 버전이 맞지 않거나 손상된 파일이면 아무것도 바꾸지 않습니다.</p></section>`;

      ui.$('#copySum', el).onclick = () => {
        const lines = [`OPIc 연습 요약 (${util.dayKey(Date.now())})`, `목표 ${S.targetLevel} · 연속 ${st.streak}일 · 학습한 날 ${st.studyDays}일`,
          `녹음 ${st.count}개 · 총 ${util.fmtDur(st.totalSec)} · 평균 답변 ${util.fmtDur(st.avgSec)}`,
          '유형별: ' + bank.FOCUS_GROUPS.map(g => `${g.label} ${st.byGroup[g.id]}`).join(', '),
          '최근 주별 평균 답변 길이: ' + st.weeks.filter(w => w.avg != null).map(w => `${new Date(w.end).getMonth() + 1}/${new Date(w.end).getDate()} ${util.fmtDur(w.avg)}`).join(', '),
          `수업 표현 노트 ${store.S.notes.length}개 · 스크립트 ${store.S.scripts.length}개`];
        ui.copyText(lines.join('\n'));
      };
      const pb = ui.$('#persist', el);
      if (pb) pb.onclick = async () => { const ok = await navigator.storage.persist().catch(() => false); ui.toast(ok ? '보관 요청이 승인되었습니다.' : '브라우저가 요청을 거절했습니다. 홈 화면에 설치하면 승인될 수 있어요.'); root.OPIC.refresh(); };

      const boxes = () => ui.$$('.reclist input:checked', el);
      const upd = () => {
        const sel = boxes(); const bytes = sel.reduce((a, b) => a + (((store.S.recs.find(r => r.id === b.value) || {}).size) || 0), 0);
        ui.$('#selBar', el).hidden = !sel.length; ui.$('#selInfo', el).textContent = `${sel.length}개 · ${util.fmtBytes(bytes)}`;
      };
      ui.$('.reclist', el).onchange = upd;
      ui.$('#selOld', el).onclick = () => { const lim = Date.now() - 30 * util.DAY; ui.$$('.reclist input', el).forEach(cb => { const r = store.S.recs.find(x => x.id === cb.value); cb.checked = r && r.createdAt < lim; }); upd(); };
      ui.$('#selNone', el).onclick = () => { ui.$$('.reclist input', el).forEach(cb => { cb.checked = false; }); upd(); };
      ui.$('#expSel', el).onclick = async () => {
        const files = [];
        for (const cb of boxes()) { const r = store.S.recs.find(x => x.id === cb.value); const b = await db.getAudio(r.id); if (b) files.push({ blob: b, name: ui.fileName(r, recorder.extOf(b.type || r.mime)) }); }
        if (files.length) ui.shareOrDownload(files);
      };
      ui.$('#delSel', el).onclick = async () => {
        const ids = boxes().map(cb => cb.value);
        if (!await ui.confirmDlg(`녹음 ${ids.length}개를 삭제할까요? 받아쓴 글과 자가 체크도 함께 지워집니다.\n먼저 「오디오 내보내기」로 저장해 두는 것을 추천해요.`, '삭제', true)) return;
        await store.deleteRecordings(ids); ui.toast('삭제했습니다.'); root.OPIC.refresh();
      };
      ui.$$('.open-rec', el).forEach(b => b.onclick = () => {
        const rec = store.S.recs.find(r => r.id === b.dataset.id);
        ui.modal({ title: '녹음', html: '<div id="mrd"></div>', onMount: w => C.recordingDetail(ui.$('#mrd', w), rec, { showPrompt: true, onDelete: () => { ui.$$('.modal-wrap').forEach(m => m.remove()); root.OPIC.refresh(); } }) });
      });

      ui.$('#exp', el).onclick = async () => {
        const btn = ui.$('#exp', el); btn.disabled = true;
        try {
          const withAudio = ui.$('#withAudio', el).checked;
          const data = await store.exportJSON(withAudio, (n, t) => { btn.textContent = `오디오 변환 중 ${n}/${t}…`; });
          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
          await ui.shareOrDownload([{ blob, name: `opic-backup-${util.dayKey(Date.now())}${withAudio ? '-audio' : ''}.json` }]);
          await store.setSettings({ lastExportAt: Date.now() });
          ui.toast('내보냈습니다. 파일 앱이나 클라우드에 보관하세요.');
        } catch (e) { ui.toast('내보내지 못했습니다: ' + (e.message || e)); }
        btn.disabled = false; btn.textContent = '기록 JSON 내보내기';
      };
      ui.$('#imp', el).onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        const text = await f.text().catch(() => null);
        const res = text == null ? { ok: false, errors: ['파일을 읽을 수 없습니다.'] } : await store.importJSON(text);
        e.target.value = '';
        if (!res.ok) return ui.modal({ title: '가져오지 못했습니다', html: `<ul>${res.errors.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="muted">기존 기록은 그대로입니다.</p>` });
        ui.modal({ title: '가져왔습니다', html: `<p>녹음 ${res.counts.recordings || 0} · 노트 ${res.counts.notes || 0} · 스크립트 ${res.counts.scripts || 0} · 세션 ${res.counts.sessions || 0}${res.counts.audio != null ? ` · 오디오 ${res.counts.audio}` : ' (오디오 미포함)'}</p>` });
        root.OPIC.refresh();
      };
      if (query.go === 'backup') setTimeout(() => ui.$('#backup', el).scrollIntoView(), 50);
    }
  };
})(window);
