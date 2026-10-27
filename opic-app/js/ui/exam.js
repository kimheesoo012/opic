/* 실전 모의고사
   Background Survey → Self Assessment → 장비 점검 → 1차 세션(1~7번) → 난이도 재조정 → 2차 세션 → 결과
   - Self Assessment 1·2단계 12문항, 3~6단계 15문항 / 전체 40분
   - 질문은 음성으로만(글은 기본 숨김), 질문이 끝나면 자동 녹음, 다시 듣기는 질문이 끝난 뒤 5초 안에 1회
   - 진행 상황을 계속 저장 → 앱이 닫혀도 홈에서 이어서 하기 */
(function (root) {
  'use strict';
  const { util, bank, survey, picker, store, ui, recorder, tts, C } = root.OPIC;
  const esc = util.escapeHtml;
  const EXAM_SEC = 40 * 60;

  function presets() { return (store.S.settings.presets || survey.SEED_PRESETS).slice(); }

  root.OPIC.screens.exam = {
    title: '실전 모의고사', parentTab: 'practice',
    async render(el, params, query) {
      let ses = null;
      if (query.resume) ses = store.S.sessions.find(s => s.id === query.resume && s.status === 'in_progress');
      let cleanupRun = null;
      const sv = Object.assign({ job: null, student: null, home: null, picks: [] }, store.S.settings.survey || {});
      let sa = store.S.settings.saLevel || 4;

      /* ───── 1. Background Survey ───── */
      function stageSurvey() {
        const groups = [['leisure', '여가 활동 (두 개 이상)'], ['hobby', '취미·관심사 (한 개 이상)'], ['sport', '운동 (한 개 이상)'], ['travel', '휴가·출장 (한 개 이상)']];
        const radio = (key, label) => `<fieldset class="sv"><legend>${label}</legend>${survey.SURVEY[key].map(([id, l]) =>
          `<label class="opt"><input type="radio" name="sv-${key}" value="${id}" ${sv[key] === id ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>`;
        el.innerHTML = `<div class="steps"><span class="on">설문</span><span>자가 평가</span><span>점검</span><span>시험</span></div>
          <section class="card"><h2>Background Survey</h2>
            <p class="muted small">실제 시험처럼 고른 주제에서 문제가 나옵니다. Part 4는 합쳐서 12개 이상 골라야 해요.</p>
            <div class="chips wrap" id="presetChips">${presets().map((p, i) => `<button class="chip btnchip" data-p="${i}">${esc(p.name)}</button>`).join('')}</div>
          </section>
          <section class="card">${radio('job', 'Part 1. 현재 어느 분야에 종사하고 계십니까?')}${radio('student', 'Part 2. 현재 학생입니까?')}${radio('home', 'Part 3. 현재 어디에 살고 계십니까?')}</section>
          <section class="card"><h3>Part 4</h3>${groups.map(([key, label]) => `<fieldset class="sv"><legend>${label}</legend><div class="grid2">${survey.SURVEY[key].map(([id, l]) =>
            `<label class="opt"><input type="checkbox" value="${id}" ${sv.picks.includes(id) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></fieldset>`).join('')}</section>
          <div class="sticky-foot"><span id="svCount"></span><button class="btn" id="svSave">세트로 저장</button><button class="btn primary" id="svNext">다음 ›</button></div>`;
        const update = () => {
          sv.job = (ui.$('input[name=sv-job]:checked', el) || {}).value || null;
          sv.student = (ui.$('input[name=sv-student]:checked', el) || {}).value || null;
          sv.home = (ui.$('input[name=sv-home]:checked', el) || {}).value || null;
          sv.picks = ui.$$('input[type=checkbox]:checked', el).map(x => x.value);
          const ok = sv.job && sv.student && sv.home && sv.picks.length >= 12;
          ui.$('#svCount', el).textContent = `Part 4: ${sv.picks.length} / 12개 이상`;
          ui.$('#svNext', el).disabled = !ok;
        };
        el.onchange = update; update();
        ui.$$('[data-p]', el).forEach(b => b.onclick = () => {
          const p = presets()[+b.dataset.p];
          Object.assign(sv, { job: p.job, student: p.student, home: p.home, picks: p.picks.slice() });
          stageSurvey(); ui.toast(`「${p.name}」 적용`);
        });
        ui.$('#svSave', el).onclick = async () => {
          update();
          const name = await ui.modal({ title: '설문 세트 저장', html: '<input class="full" id="pname" placeholder="세트 이름">', actions: [{ label: '취소', value: null }, { label: '저장', kind: 'primary', value: w => ui.$('#pname', w).value.trim() }] });
          if (!name) return;
          const list = presets().filter(p => p.name !== name).concat([{ name, job: sv.job, student: sv.student, home: sv.home, picks: sv.picks.slice() }]);
          await store.setSettings({ presets: list }); stageSurvey(); ui.toast('세트를 저장했습니다.');
        };
        ui.$('#svNext', el).onclick = async () => { el.onchange = null; await store.setSettings({ survey: Object.assign({}, sv) }); stageSA(); };
      }

      /* ───── 2. Self Assessment ───── */
      function stageSA() {
        el.innerHTML = `<div class="steps"><span class="done">설문</span><span class="on">자가 평가</span><span>점검</span><span>시험</span></div>
          <section class="card"><h2>Self Assessment</h2><p class="muted small">고른 단계에 따라 문제 난이도와 개수가 달라집니다 (1·2단계 12문항, 3~6단계 15문항). IH 목표라면 보통 4~5단계, AL 목표라면 5~6단계를 고릅니다.</p>
          ${survey.SA_LEVELS.map((t, i) => `<label class="sa ${sa === i + 1 ? 'on' : ''}"><input type="radio" name="sa" value="${i + 1}" ${sa === i + 1 ? 'checked' : ''}>
            <span class="sa-n">${i + 1}</span><span class="sa-t">${esc(t)}</span><button type="button" class="link sa-play" data-i="${i}">예시 듣기</button></label>`).join('')}</section>
          <div class="sticky-foot"><button class="btn" id="saBack">‹ 설문</button><button class="btn primary" id="saNext">다음 ›</button></div>`;
        ui.$$('input[name=sa]', el).forEach(r => r.onchange = () => { sa = +r.value; ui.$$('.sa', el).forEach(x => x.classList.toggle('on', x.contains(r))); });
        ui.$$('.sa-play', el).forEach(b => b.onclick = e => { e.preventDefault(); tts.speak(survey.SA_SAMPLES[+b.dataset.i], { voiceName: store.S.settings.voiceName, rate: store.S.settings.rate }); });
        ui.$('#saBack', el).onclick = stageSurvey;
        ui.$('#saNext', el).onclick = async () => { await store.setSettings({ saLevel: sa }); stageCheck(); };
      }

      /* ───── 3. 장비 점검 ───── */
      function stageCheck() {
        const n = picker.examLength(sa);
        const env = recorder.environment();
        el.innerHTML = `<div class="steps"><span class="done">설문</span><span class="done">자가 평가</span><span class="on">점검</span><span>시험</span></div>
          <section class="card"><h2>시험 안내</h2><ul class="dots">
            <li>문제 <b>${n}개</b>, 전체 <b>40분</b>. 1번은 자기소개입니다.</li>
            <li>질문은 음성으로만 나오고 글은 숨겨져 있어요. 질문이 끝나면 <b>자동으로 녹음</b>이 시작됩니다.</li>
            <li>다시 듣기는 질문이 끝난 뒤 <b>5초 안에 한 번만</b> 가능하고, 누르면 진행 중이던 녹음은 지워집니다.</li>
            <li>7번까지 답하면 남은 문제의 난이도를 다시 고릅니다 (쉽게 / 비슷하게 / 어렵게).</li>
            <li>문항당 2분 안팎을 목표로, 답변을 마치면 「답변 끝내기」를 누르세요. 이전 문제로는 돌아갈 수 없습니다.</li>
            <li class="muted">공식 시험 화면·캐릭터가 아닌 연습용 화면입니다. 실제 출제 조합은 회차마다 다릅니다.</li></ul></section>
          <section class="card"><h2>장비 점검</h2>
            <button class="btn block" id="spk">🔊 스피커 점검</button>
            <button class="btn block" id="mic" ${env.hasGUM && env.hasMR ? '' : 'disabled'}>🎙 마이크 권한 확인</button>
            <p class="small muted" id="chkMsg">${env.hasGUM && env.hasMR ? '' : esc(recorder.micError(null).msg)}</p></section>
          <div class="sticky-foot"><button class="btn" id="ckBack">‹ 자가 평가</button><button class="btn primary" id="begin">시험 시작</button></div>`;
        ui.$('#spk', el).onclick = () => { recorder.unlock(); tts.speak('This is a speaker test. If you can hear this clearly, your speaker is working.', { voiceName: store.S.settings.voiceName, rate: store.S.settings.rate }); };
        ui.$('#mic', el).onclick = async () => {
          try { await recorder.ensurePermission(); ui.$('#chkMsg', el).textContent = '마이크 권한이 허용되어 있습니다.'; }
          catch (e) { ui.$('#chkMsg', el).textContent = e.msg || String(e); }
        };
        ui.$('#ckBack', el).onclick = stageSA;
        ui.$('#begin', el).onclick = async () => {
          const s1 = picker.buildSession1(sv, sa, store.S.qs);
          ses = { id: util.uid('exam'), mode: 'exam', status: 'in_progress', startedAt: Date.now(), survey: Object.assign({}, sv), sa,
            plan: s1.plan, questions: s1.questions.map(q => q.id), cur: 0, adjust: null, items: [], timeLeft: EXAM_SEC };
          await store.saveSession(ses);
          stageRun();
        };
      }

      /* ───── 4. 시험 진행 ───── */
      function stageRun() {
        let qb = null, panel = null, timerId = null, ended = false;
        const total = ses.plan.total;
        function tickTimer() {
          ses.timeLeft = Math.max(0, ses.timeLeft - 1);
          const t = ui.$('#examTimer', el);
          if (t) { t.textContent = util.fmtClock(ses.timeLeft); t.classList.toggle('warn', ses.timeLeft <= 600); t.classList.toggle('danger', ses.timeLeft <= 300); }
          if (ses.timeLeft % 5 === 0) store.saveSession(ses);
          if (ses.timeLeft <= 0) { ui.toast('시험 시간이 끝났습니다.'); finishExam(true); }
        }
        async function teardown() {
          clearInterval(timerId);
          if (qb) { qb.destroy(); qb = null; }
          if (panel) { const p = panel; panel = null; await p.destroy(); }
        }
        async function finishExam(timeout) {
          if (ended) return; ended = true;
          await teardown();
          ses.status = 'done'; ses.endedAt = Date.now();
          const adjL = { easier: '쉬운 질문', same: '비슷한 질문', harder: '어려운 질문' }[ses.adjust] || '-';
          ses.summary = `난이도 ${ses.sa} · 재조정 ${adjL} · ${ses.items.length}/${total}문항 답변 · 사용 ${util.fmtClock(EXAM_SEC - ses.timeLeft)}${timeout ? ' (시간 종료)' : ''}`;
          await store.saveSession(ses);
          if (store.S.recs.filter(r => r.sessionId === ses.id).length >= 5) await store.award(30, '모의고사 완주');
          cleanupRun = null;
          root.OPIC.renderSession(el, ses);
          root.OPIC.P.flush();
        }
        async function next() {
          ses.cur++;
          await store.saveSession(ses);
          if (ses.cur === 7 && !ses.adjust) { await teardown(); cleanupRun = null; return stageAdjust(); }
          if (ses.cur >= ses.questions.length) return finishExam(false);
          showQ();
        }
        async function showQ() {
          if (qb) qb.destroy();
          const q = bank.byId[ses.questions[ses.cur]];
          if (!q) return next();
          el.innerHTML = `<div class="exam-top"><b>Question ${ses.cur + 1} of ${total}</b><span>남은 시간 <b id="examTimer">${util.fmtClock(ses.timeLeft)}</b></span></div>
            <div class="qgrid">${Array.from({ length: total }, (_, i) => `<span class="${i < ses.cur ? 'done' : i === ses.cur ? 'cur' : ''}">${i + 1}</span>`).join('')}</div>
            <div id="qb"></div>
            <div class="row center exam-foot"><button class="btn small" id="skipQ">답하지 않고 넘어가기</button><button class="btn small danger" id="quitE">여기까지 저장하고 끝내기</button></div>`;
          qb = C.questionBlock(ui.$('#qb', el), q, {
            exam: true, hideMeta: true, label: '',
            onPlayStart: isReplay => { if (isReplay && panel) panel.cancel(); },
            onEnd: () => { if (panel && panel.state() === 'idle') panel.start(); }
          });
          if (!panel) {
            panel = C.recorderPanel({
              label: '녹음 시작',
              getMeta: () => ({ questionId: ses.questions[ses.cur], mode: 'exam', sessionId: ses.id }),
              onSaved: async rec => {
                if (qb) qb.stopReplayWindow();
                ses.items.push({ qid: rec.questionId, recId: rec.id });
                await next();
              }
            });
          }
          ui.$('#skipQ', el).onclick = async () => {
            if (panel.state() === 'recording') return ui.toast('녹음 중입니다. 「답변 끝내기」를 눌러 주세요.');
            if (await ui.confirmDlg('이 문제를 답하지 않고 넘어갈까요?')) next();
          };
          ui.$('#quitE', el).onclick = async () => {
            if (!await ui.confirmDlg('지금까지의 답변만 저장하고 결과를 볼까요?\n(녹음 중이면 그 녹음도 저장합니다)')) return;
            if (panel && panel.state() === 'recording') { const p = panel; panel = null; await p.destroy(); }
            finishExam(false);
          };
        }
        timerId = setInterval(tickTimer, 1000);
        showQ();
        cleanupRun = async () => { await teardown(); await store.saveSession(ses); };
      }

      /* ───── 5. 난이도 재조정 ───── */
      function stageAdjust() {
        el.innerHTML = `<section class="card"><h2>난이도 재조정</h2><p>1차 세션이 끝났습니다. 남은 문제의 난이도를 골라 주세요.</p>
          <div class="adj">${[['easier', '쉬운 질문', '지금보다 쉬운 질문'], ['same', '비슷한 질문', '지금과 비슷한 수준'], ['harder', '어려운 질문', '비교·사회 이슈 등 더 어려운 질문']].map(([k, t, d]) =>
            `<button class="btn adj-btn" data-a="${k}"><b>${t}</b><br><small>${d}</small></button>`).join('')}</div>
          <p class="muted small">남은 시간 ${util.fmtClock(ses.timeLeft)} (재조정 화면에서도 시간은 흐르지 않게 했어요)</p></section>`;
        ui.$$('[data-a]', el).forEach(b => b.onclick = async () => {
          ses.adjust = b.dataset.a;
          const s2 = picker.buildSession2(ses.plan, ses.adjust, store.S.qs);
          ses.questions = ses.questions.slice(0, 7).concat(s2.map(q => q.id));
          await store.saveSession(ses);
          stageRun();
        });
      }

      if (ses) { if (ses.cur === 7 && !ses.adjust) stageAdjust(); else stageRun(); }
      else stageSurvey();
      return async () => { if (cleanupRun) await cleanupRun(); };
    }
  };
})(window);
