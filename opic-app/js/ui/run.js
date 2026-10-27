/* 연습 진행 화면: 문제 목록을 차례로 듣고 녹음 (3문제 연습·오늘의 3문제)
   #/practice  : 유형·주제 고르기
   #/run?ids=…&mode=practice|daily */
(function (root) {
  'use strict';
  const { util, bank, picker, store, ui, C } = root.OPIC;
  const esc = util.escapeHtml;

  root.OPIC.screens.practice = {
    title: '3문제 연습', tab: 'practice',
    render(el) {
      const weak = picker.weakGroups(store.S.recs);
      const surveyTopics = picker.surveyTopics(store.S.settings.survey || { picks: [] });
      const topics = bank.TOPICS.filter(t => t.cat !== 'general' && t.id !== 'rp_interviewer');
      el.innerHTML = `
        <section class="card"><h2>유형 집중</h2><p class="muted small">서로 다른 주제에서 같은 유형 3문제. 5~10분.</p>
          <div class="grid2">
            <button class="btn primary" data-focus="${weak[0].id}">약한 유형 자동<br><small>${esc(weak[0].label)}</small></button>
            ${bank.FOCUS_GROUPS.map(g => `<button class="btn" data-focus="${g.id}">${esc(g.label)}<br><small class="muted">연습 ${weak.find(w => w.id === g.id).count}회</small></button>`).join('')}
          </div></section>
        <section class="card"><h2>주제 콤보</h2><p class="muted small">한 주제로 3문제 이어서 (묘사 → 습관 → 과거 경험, 롤플레이는 질문하기 → 문제 해결 → 관련 경험)</p>
          <select id="topicSel" class="full">${['survey', 'surprise', 'roleplay'].map(cat => `<optgroup label="${bank.CAT_LABELS[cat]}">${topics.filter(t => t.cat === cat).map(t => `<option value="${t.id}" ${surveyTopics.includes(t.id) ? '' : ''}>${esc(t.label)}${surveyTopics.includes(t.id) ? ' ★' : ''}</option>`).join('')}</optgroup>`).join('')}</select>
          <button class="btn primary block" id="topicGo">이 주제로 3문제</button>
          <p class="muted small">★ = 모의고사 설문에서 고른 주제</p></section>
        <section class="card"><h2>다른 훈련</h2>
          <div class="grid2"><a class="btn" href="#/impromptu">즉흥 답변</a><a class="btn" href="#/story">과거 경험 이야기</a><a class="btn" href="#/scripts">스크립트 연습</a><a class="btn" href="#/exam">실전 모의고사</a></div></section>`;
      ui.$$('[data-focus]', el).forEach(b => b.onclick = () => {
        const list = picker.practiceSet({ focus: b.dataset.focus }, store.S.qs);
        root.OPIC.go(`#/run?mode=practice&ids=${list.map(q => encodeURIComponent(q.id)).join(',')}`);
      });
      ui.$('#topicGo', el).onclick = () => {
        const list = picker.practiceSet({ topic: ui.$('#topicSel', el).value }, store.S.qs);
        root.OPIC.go(`#/run?mode=practice&ids=${list.map(q => encodeURIComponent(q.id)).join(',')}`);
      };
    }
  };

  root.OPIC.screens.run = {
    title: '연습', parentTab: 'practice',
    async render(el, params, query) {
      const ids = (query.ids || '').split(',').filter(id => bank.byId[id]);
      if (!ids.length) { el.innerHTML = '<div class="card"><p>문제가 없습니다.</p><a class="btn" href="#/practice">연습 고르기</a></div>'; return; }
      const mode = query.mode || 'practice';
      const session = { id: util.uid('ses'), mode, startedAt: Date.now(), status: 'in_progress', questions: ids, items: [] };
      let i = 0, qb = null, panel = null;

      async function show() {
        if (qb) qb.destroy();
        const q = bank.byId[ids[i]];
        el.innerHTML = `<div class="progress"><span>${i + 1} / ${ids.length}</span><div class="pbar"><i style="width:${(i / ids.length) * 100}%"></i></div></div>
          <div id="qb"></div><div id="after"></div>`;
        qb = C.questionBlock(ui.$('#qb', el), q, {
          showText: store.S.settings.showTextPractice,
          onPlayStart: () => { if (panel && panel.state() === 'recording') panel.cancel(); },
          onEnd: n => { if (n === 1 && store.S.settings.autoRecord && panel && panel.state() === 'idle') panel.start(); }
        });
        if (panel) await panel.destroy();
        panel = C.recorderPanel({
          label: '답변 녹음',
          getMeta: () => ({ questionId: q.id, mode, sessionId: session.id }),
          onSaved: rec => {
            session.items.push({ qid: q.id, recId: rec.id });
            store.saveSession(session);
            const a = rec.audioStats || {};
            ui.$('#after', el).innerHTML = `<div class="card saved"><p><b>저장했습니다</b> · ${util.fmtDur(rec.durationSec)} · 말한 비율 ${Math.round((a.speechRatio || 0) * 100)}%</p>
              ${C.playerHtml(rec)}
              <div class="row"><button class="btn primary" id="nextQ">${i + 1 < ids.length ? '다음 문제 ›' : '결과 보기'}</button><button class="btn" id="redo">다시 녹음</button></div>
              <p class="muted small">받아쓰기 수정·AI 첨삭·재답변은 결과 화면의 「첨삭 흐름」에서 이어서 할 수 있어요.</p></div>`;
            C.mountPlayers(ui.$('#after', el));
            ui.$('#nextQ', el).onclick = () => { i++; if (i < ids.length) show(); else finish(); };
            ui.$('#redo', el).onclick = () => { ui.$('#after', el).innerHTML = ''; panel.start(); };
            ui.$('#after', el).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
      }
      async function finish() {
        if (qb) qb.destroy();
        if (panel) { await panel.destroy(); panel = null; }
        session.status = 'done'; session.endedAt = Date.now();
        await store.saveSession(session);
        renderSession(el, session);
      }
      await show();
      return async () => { if (qb) qb.destroy(); if (panel) await panel.destroy(); };
    }
  };

  /* 세션 결과(연습·모의고사 공용) */
  function renderSession(el, session) {
    const K = picker.KIND_LABELS;
    /* 세션 id로 녹음을 모은다 (시간 종료·화면 이동으로 저장된 녹음도 포함) */
    const sesRecs = store.S.recs.filter(r => r.sessionId === session.id).sort((a, b) => a.createdAt - b.createdAt);
    const total = sesRecs.reduce((a, r) => a + (r.durationSec || 0), 0);
    el.innerHTML = `<section class="card"><h2>${session.mode === 'exam' ? '모의고사 결과' : '연습 결과'}</h2>
      <p class="muted">${util.fmtDate(session.startedAt)} · 답변 ${sesRecs.length}개 · 총 ${util.fmtDur(total)}${session.summary ? ' · ' + esc(session.summary) : ''}</p>
      <p class="small">각 문제의 「첨삭 흐름」에서 받아쓰기 확인 → AI 첨삭용 복사 → 개선 답변 저장 → 다시 녹음 → 비교를 이어서 하세요.</p></section>
      ${session.questions.map((qid, n) => {
        const q = bank.byId[qid]; if (!q) return '';
        const its = sesRecs.filter(r => r.questionId === qid);
        const s = store.S.qs[qid];
        return `<section class="card result-item">
          <div class="card-head"><b>Q${n + 1}</b><span class="chips"><span class="chip type">${esc(bank.TYPE_LABELS[q.type])}</span><span class="chip">${esc(bank.topicById[q.topic].label)}</span></span>
            <button class="star ${s && s.review ? 'on' : ''}" data-q="${esc(qid)}" aria-label="복습 지정">★</button></div>
          <details><summary>문제 보기</summary><p class="qtext small" lang="en">${esc(q.text)}</p></details>
          ${its.length ? its.map(r => `${C.playerHtml(r)}<p class="tr small" lang="en">${r.transcript ? esc(r.transcript) : '<span class="muted">받아쓴 글 없음</span>'}</p>`).join('') : '<p class="muted">답변 없음</p>'}
          <a class="btn primary block" href="#/q/${encodeURIComponent(qid)}${its.length ? '?rec=' + its[its.length - 1].id : ''}">첨삭 흐름 이어 가기 ›</a></section>`;
      }).join('')}
      <div class="row center"><a class="btn" href="#/">홈</a><a class="btn" href="#/practice">다른 연습</a></div>`;
    C.mountPlayers(el);
    ui.$$('.star', el).forEach(b => b.onclick = async () => {
      const s = store.q(b.dataset.q); s.review = !s.review; await store.saveQ(s);
      b.classList.toggle('on', s.review);
      ui.toast(s.review ? '복습 지정: 다음 출제 때 다시 나옵니다.' : '복습 지정을 해제했습니다.');
    });
    void K;
  }
  root.OPIC.renderSession = renderSession;

  root.OPIC.screens.session = {
    title: '결과', parentTab: 'records',
    render(el, params) {
      const s = store.S.sessions.find(x => x.id === params[0]);
      if (!s) { el.innerHTML = '<div class="card"><p>기록을 찾을 수 없습니다.</p></div>'; return; }
      renderSession(el, s);
    }
  };
})(window);
