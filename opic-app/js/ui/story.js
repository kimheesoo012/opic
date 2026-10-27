/* 과거 경험 이야기 훈련: 배경 → 일어난 일 → 감정 → 결과
   1단계: 틀을 보며 단계별로 따로 녹음
   2단계: 틀을 보며 한 번에 녹음
   3단계: 틀 없이 한 번에 녹음 */
(function (root) {
  'use strict';
  const { util, bank, drills, store, ui, C } = root.OPIC;
  const esc = util.escapeHtml;
  const STAGES = ['1단계 · 단계별 녹음', '2단계 · 틀 보며 한 번에', '3단계 · 틀 없이 한 번에'];

  root.OPIC.screens.story = {
    title: '과거 경험 이야기', parentTab: 'practice',
    async render(el, params, query) {
      const qid = params[0];
      if (!qid) {
        const past = bank.QUESTIONS.filter(q => q.type === 'past');
        const mine = past.filter(q => store.S.qs[q.id] && (store.S.qs[q.id].storyStage || store.S.qs[q.id].review));
        const surveyT = new Set(root.OPIC.picker.surveyTopics(store.S.settings.survey || { picks: [] }));
        const suggest = util.shuffle(past.filter(q => surveyT.has(q.topic) || q.cat === 'surprise')).slice(0, 6);
        const item = q => { const s = store.S.qs[q.id]; return `<li><a href="#/story/${encodeURIComponent(q.id)}"><span class="chips"><span class="chip">${esc(bank.topicById[q.topic].label)}</span>${s && s.storyStage ? `<span class="chip type">${STAGES[Math.min(2, s.storyStage - 1)].split(' ·')[0]} 완료</span>` : ''}</span><span class="qprev" lang="en">${esc(q.text.slice(0, 90))}…</span></a></li>`; };
        el.innerHTML = `<section class="card"><h2>과거 경험을 길고 자연스럽게</h2>
          <ol class="frame">${drills.STORY_STEPS.map(s => `<li><b>${s.ko}</b> <span class="muted small">${esc(s.guide)}</span></li>`).join('')}</ol>
          <p class="small">처음에는 단계별로 따로 녹음하고, 익숙해지면 틀을 보며 한 번에, 마지막에는 틀 없이 한 번에 말합니다.</p></section>
          ${mine.length ? `<section class="card"><h2>이어서 하기</h2><ul class="qlist">${mine.map(item).join('')}</ul></section>` : ''}
          <section class="card"><h2>추천 질문</h2><ul class="qlist">${suggest.map(item).join('')}</ul>
          <a class="btn block" href="#/bank?type=past">과거 경험 질문 전체 보기</a></section>`;
        return;
      }
      const q = bank.byId[qid];
      if (!q) { el.innerHTML = '<div class="card"><p>문제를 찾을 수 없습니다.</p></div>'; return; }
      const s = store.q(q.id);
      let stage = query.stage != null ? +query.stage : Math.min(2, s.storyStage || 0);
      let step = 0;
      let qb = null, panel = null;

      function render() {
        if (qb) qb.destroy();
        const stepRecs = store.recsFor(q.id).filter(r => r.mode === 'story-step');
        const latest = {};
        stepRecs.forEach(r => { latest[r.storyStep] = r; });
        el.innerHTML = `<div class="seg wide" id="stageSeg">${STAGES.map((t, i) => `<button class="${i === stage ? 'on' : ''}" data-s="${i}">${t.split(' · ')[0]}</button>`).join('')}</div>
          <p class="muted small center">${STAGES[stage]}</p>
          <div id="qb"></div>
          ${stage < 2 ? `<ol class="frame big">${drills.STORY_STEPS.map((st, i) => `<li class="${stage === 0 && i === step ? 'cur' : ''} ${latest[st.id] ? 'done' : ''}">
            <b>${st.ko}</b><span class="small">${esc(st.guide)}</span>
            <details ${stage === 0 && i === step ? 'open' : ''}><summary class="small">도움 표현</summary><ul class="small" lang="en">${st.phrases.map(p => `<li>${esc(p)}</li>`).join('')}</ul></details>
            ${stage === 0 && latest[st.id] ? C.playerHtml(latest[st.id]) : ''}</li>`).join('')}</ol>` : '<p class="card small">틀 없이, 배경부터 결과까지 한 번에 이어서 말해 보세요. 끝나면 자가 체크로 네 단계가 다 들어갔는지 확인합니다.</p>'}
          ${stage === 0 && Object.keys(latest).length === 4 ? `<section class="card"><p><b>네 단계를 모두 녹음했어요.</b> 이어서 들어 보고, 2단계(한 번에 말하기)로 넘어가세요.</p><div class="row"><button class="btn" id="playAll">▶ 이어서 듣기</button><button class="btn primary" id="toS2">2단계로 ›</button></div></section>` : ''}
          <div id="after"></div>`;
        C.mountPlayers(el);
        qb = C.questionBlock(ui.$('#qb', el), q, { showText: stage < 2, hideMeta: true });
        ui.$$('#stageSeg button', el).forEach(b => b.onclick = () => { stage = +b.dataset.s; step = 0; render(); setPanel(); });
        ui.$$('.frame.big li', el).forEach((li, i) => li.onclick = e => { if (stage === 0 && !e.target.closest('.player,summary')) { step = i; render(); setPanel(); } });
        const pa = ui.$('#playAll', el);
        if (pa) pa.onclick = () => playSequence(drills.STORY_STEPS.map(st => latest[st.id]));
        const t2 = ui.$('#toS2', el);
        if (t2) t2.onclick = () => { stage = 1; render(); setPanel(); };
      }

      async function playSequence(list) {
        const { db } = root.OPIC;
        for (const r of list) {
          const blob = await db.getAudio(r.id); if (!blob) continue;
          const url = URL.createObjectURL(blob);
          await new Promise(res => { const a = new Audio(url); a.onended = res; a.onerror = res; a.play().catch(res); });
          URL.revokeObjectURL(url);
        }
      }

      async function setPanel() {
        if (panel) await panel.destroy();
        const stepDef = drills.STORY_STEPS[step];
        panel = C.recorderPanel({
          label: stage === 0 ? `「${stepDef.ko}」 녹음` : '이야기 전체 녹음',
          getMeta: () => stage === 0 ? { questionId: q.id, mode: 'story-step', storyStep: drills.STORY_STEPS[step].id, kind: 'first' } : { questionId: q.id, mode: 'story' },
          onSaved: async rec => {
            const st = store.q(q.id);
            if (stage === 0) {
              if (step < 3) { step++; render(); setPanel(); ui.toast('좋아요. 다음 단계로 이어 가세요.'); return; }
              st.storyStage = Math.max(st.storyStage || 0, 1); await store.saveQ(st);
              render(); setPanel(); return;
            }
            st.storyStage = Math.max(st.storyStage || 0, stage + 1); await store.saveQ(st);
            const box = ui.$('#after', el);
            box.innerHTML = `<section class="card" id="stDet"></section><div class="row center">${stage === 1 ? '<button class="btn primary" id="toS3">3단계(틀 없이)로 ›</button>' : ''}<a class="btn" href="#/q/${encodeURIComponent(q.id)}?rec=${rec.id}">첨삭 흐름으로</a></div>`;
            C.recordingDetail(ui.$('#stDet', box), rec, {});
            const b3 = ui.$('#toS3', box); if (b3) b3.onclick = () => { stage = 2; render(); setPanel(); };
            box.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }
      render();
      await setPanel();
      return async () => { if (qb) qb.destroy(); if (panel) await panel.destroy(); };
    }
  };
})(window);
