/* 홈: 오늘의 3문제, 재도전 알림, 모드 바로가기 */
(function (root) {
  'use strict';
  const { util, bank, picker, store, ui } = root.OPIC;
  const esc = util.escapeHtml;

  async function todaysThree() {
    const today = util.dayKey(Date.now());
    const cached = store.S.settings.daily;
    if (cached && cached.day === today && cached.items.every(x => bank.byId[x.id])) return cached.items.map(x => ({ q: bank.byId[x.id], why: x.why }));
    const list = picker.dailyThree(store.S.recs, store.S.qs, Date.now());
    await store.setSettings({ daily: { day: today, items: list.map(x => ({ id: x.q.id, why: x.why })) } });
    return list;
  }

  root.OPIC.screens.home = {
    title: 'OPIc 말하기 연습', tab: 'home',
    async render(el) {
      const st = store.stats();
      const S = store.S.settings;
      const daily = await todaysThree();
      const due = picker.dueRetries(store.S.qs, Date.now());
      const doneToday = new Set(store.S.recs.filter(r => util.dayKey(r.createdAt) === util.dayKey(Date.now())).map(r => r.questionId));
      const inProg = store.S.sessions.find(s => s.mode === 'exam' && s.status === 'in_progress');
      const needBackup = st.count >= 3 && Date.now() - (S.lastExportAt || 0) > 7 * util.DAY;
      el.innerHTML = `
      ${root.OPIC.P.heroHtml()}
      ${inProg ? `<a class="card link-card warn-card" href="#/exam?resume=${esc(inProg.id)}"><b>진행 중인 모의고사</b><span>${inProg.cur + 1}번 문제부터 이어서 하기 ›</span></a>` : ''}
      ${needBackup ? `<a class="card link-card warn-card" href="#/records?go=backup"><b>백업할 때가 되었어요</b><span>아이폰 Safari는 오래 쓰지 않은 사이트의 데이터를 지울 수 있어요. 기록을 내보내 두세요 ›</span></a>` : ''}
      <section class="card">
        <div class="card-head"><h2>오늘의 3문제</h2><span class="muted small">약한 유형 위주 자동 추천</span></div>
        <ol class="qlist">${daily.map(x => `<li class="${doneToday.has(x.q.id) ? 'done' : ''}"><a href="#/q/${encodeURIComponent(x.q.id)}">
          <span class="chips"><span class="chip type">${esc(bank.TYPE_LABELS[x.q.type])}</span><span class="chip">${esc(bank.topicById[x.q.topic].label)}</span></span>
          <span class="why">${esc(x.why)}${doneToday.has(x.q.id) ? ' · 오늘 완료' : ''}</span></a></li>`).join('')}</ol>
        <a class="btn primary block" href="#/run?mode=daily&ids=${daily.map(x => encodeURIComponent(x.q.id)).join(',')}">3문제 바로 시작</a>
        <p class="muted small">문제 글은 숨겨져 있어요. 듣고 바로 답해 보세요.</p>
      </section>
      ${due.length ? `<section class="card"><div class="card-head"><h2>재도전할 문제</h2><span class="badge">${due.length}</span></div>
        <ul class="qlist">${due.slice(0, 5).map(d => { const q = bank.byId[d.questionId]; return q ? `<li><a href="#/q/${encodeURIComponent(q.id)}"><span class="chips"><span class="chip warn">${esc(d.label)}</span><span class="chip type">${esc(bank.TYPE_LABELS[q.type])}</span></span><span class="qprev" lang="en">${esc(q.text.slice(0, 70))}…</span></a></li>` : ''; }).join('')}</ul></section>` : ''}
      <section class="tiles">
        <a class="tile accent" href="#/exam"><b>실전 모의고사</b><span>설문 → 난이도 → 12~15문제</span></a>
        <a class="tile" href="#/practice"><b>3문제 연습</b><span>유형 집중 5~10분</span></a>
        <a class="tile" href="#/impromptu"><b>즉흥 답변</b><span>5초 시작 · 관점 바꾸기</span></a>
        <a class="tile" href="#/story"><b>과거 경험 이야기</b><span>배경→사건→감정→결과</span></a>
        <a class="tile" href="#/scripts"><b>스크립트 연습</b><span>가리고 말하기</span></a>
        <a class="tile" href="#/notes"><b>수업 표현 노트</b><span>교정 표현 · 퀴즈</span></a>
        <a class="tile" href="#/bank"><b>문제은행</b><span>${bank.QUESTIONS.length}문항 · 복습 지정</span></a>
        <a class="tile" href="#/guide"><b>시험 구성 · 등급</b><span>연습용 체크리스트</span></a>
      </section>
      <section class="card how">
        <h2>핵심 학습 흐름</h2>
        <ol class="flow"><li>문제 듣고 첫 답변 녹음</li><li>받아쓴 글 확인·수정</li><li>「AI 첨삭용 복사」 → 원하는 AI에 붙여 넣기</li><li>개선 표현·개선 답변을 앱에 저장</li><li>같은 문제 다시 녹음</li><li>첫 답변과 나란히 비교</li><li>3일·7일 뒤 재도전</li></ol>
      </section>`;
    }
  };
})(window);
