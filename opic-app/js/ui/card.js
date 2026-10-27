/* 문제 카드: 핵심 학습 흐름
   ① 첫 답변 녹음 → ② 받아쓴 글 확인·수정 → ③ AI 첨삭용 복사 → ④ 개선 표현·개선 답변 저장
   → ⑤ 다시 답변(이번에 써 볼 표현) → ⑥ 나란히 비교 → ⑦ 3일·7일 뒤 재도전 */
(function (root) {
  'use strict';
  const { util, bank, drills, analysis, prompt, picker, store, ui, C } = root.OPIC;
  const esc = util.escapeHtml;

  /* 캘린더 알림 파일(.ics): 서버 없이 휴대폰 캘린더에 재도전 알림을 넣는 방법 */
  function ics(q, retries) {
    const fmt = ts => { const d = new Date(ts); d.setHours(20, 0, 0, 0); return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
    const url = location.href.split('#')[0] + '#/q/' + encodeURIComponent(q.id);
    const ev = retries.filter(r => !r.doneAt).map((r, i) => [
      'BEGIN:VEVENT', `UID:${q.id}-${i}-${r.due}@opic-app`, `DTSTAMP:${fmt(Date.now())}`, `DTSTART:${fmt(r.due)}`,
      'DURATION:PT10M', `SUMMARY:OPIc 재도전 (${r.label})`, `DESCRIPTION:${q.text.replace(/[,;]/g, ' ').slice(0, 200)}\\n${url}`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:OPIc 재도전', 'END:VALARM', 'END:VEVENT'].join('\r\n'));
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//opic-app//KO', ...ev, 'END:VCALENDAR'].join('\r\n');
  }

  root.OPIC.screens.q = {
    title: '첨삭 흐름', parentTab: 'practice',
    async render(el, params, query) {
      const q = bank.byId[params[0]];
      if (!q) { el.innerHTML = '<div class="card"><p>문제를 찾을 수 없습니다.</p><a class="btn" href="#/bank">문제은행</a></div>'; return; }
      let selId = query.rec || null;
      let qb = null, panel = null;
      let chosenTargets = null; // 다시 답변할 때 고른 표현
      let drawCompare = null;

      const recs = () => store.recsFor(q.id).filter(r => r.mode !== 'story-step' && r.mode !== 'script');

      function targetCandidates() {
        const s = store.S.qs[q.id];
        const out = [];
        ((s && s.feedback && s.feedback.expressions) || []).forEach(t => out.push({ text: t, source: 'feedback' }));
        store.suggestNotes(2).forEach(n => out.push({ text: n.corrected, source: 'note:' + n.id, memo: n.original }));
        if (!out.length) (drills.DEFAULT_TARGETS[q.type] || []).forEach(t => out.push({ text: t, source: 'default' }));
        return out;
      }

      function stepState() {
        const list = recs();
        const s = store.S.qs[q.id] || {};
        const first = list[0];
        return [
          !!first,
          !!(first && first.transcript),
          !!s.copiedAt,
          !!(s.feedback && (s.feedback.improved || (s.feedback.expressions || []).length)),
          list.some(r => r.kind === 'after' || r.kind === 'later'),
          !!s.comparedAt,
          (s.retries || []).length > 0 && s.retries.every(r => r.doneAt)
        ];
      }

      function render() {
        const s = store.S.qs[q.id] || {};
        const list = recs();
        if (!selId || !list.find(r => r.id === selId)) selId = list.length ? list[list.length - 1].id : null;
        const steps = stepState();
        const labels = ['첫 답변', '받아쓰기', '첨삭 복사', '첨삭 저장', '다시 답변', '비교', '재도전'];
        const fb = s.feedback;
        const groups = Object.keys(picker.KIND_LABELS).map(k => ({ k, items: list.filter(r => r.kind === k) }));
        const retries = s.retries || [];
        el.innerHTML = `
        <div class="card-head"><span class="chips"><span class="chip type">${esc(bank.TYPE_LABELS[q.type])}</span><span class="chip">${esc(bank.topicById[q.topic].label)}</span></span>
          <button class="star ${s.review ? 'on' : ''}" id="star" aria-label="복습 지정">★</button></div>
        <ol class="stepper">${labels.map((l, i) => `<li class="${steps[i] ? 'done' : ''}">${l}</li>`).join('')}</ol>
        <div id="qb"></div>

        <section class="card" id="recsCard"><div class="card-head"><h2>내 녹음</h2><span class="muted small">${list.length}개</span></div>
          ${list.length ? groups.map(g => `<div class="kind-group"><h4>${picker.KIND_LABELS[g.k]}</h4>${g.items.length ? `<div class="chips wrap">${g.items.map(r =>
            `<button class="chip btnchip ${r.id === selId ? 'on' : ''}" data-rec="${r.id}">${util.fmtDate(r.createdAt)} · ${util.fmtDur(r.durationSec)}</button>`).join('')}</div>` : '<p class="muted small">없음</p>'}</div>`).join('')
            : '<p class="muted">아직 녹음이 없습니다. ▶로 질문을 듣고 아래 버튼으로 첫 답변을 녹음하세요.</p>'}
          <div id="detail"></div></section>

        <section class="card" id="fbCard"><div class="card-head"><h2>첨삭 결과 저장</h2>${fb ? `<span class="muted small">${util.fmtDate(fb.savedAt)}</span>` : ''}</div>
          ${fb && !query.editfb ? `
            ${(fb.expressions || []).length ? `<h4>다음에 써 볼 표현</h4><ul class="exprs">${fb.expressions.map(x => `<li lang="en">${esc(x)} <button class="link add-note" data-x="${esc(x)}">노트에 추가</button></li>`).join('')}</ul>` : ''}
            ${fb.improved ? `<h4>개선 답변</h4><p class="improved" lang="en">${esc(fb.improved).replace(/\n/g, '<br>')}</p>
              <div class="row"><button class="btn small" id="speakImp">▶ 개선 답변 듣기</button><button class="btn small" id="toScript">스크립트로 저장</button></div>` : ''}
            ${fb.memo ? `<details><summary>첨삭 메모</summary><p class="small">${esc(fb.memo).replace(/\n/g, '<br>')}</p></details>` : ''}
            <button class="btn small" id="editFb">수정</button>`
          : `<p class="muted small">AI에게 받은 첨삭에서 「다음 녹음에서 꼭 써 볼 표현」과 「개선 답변」을 붙여 넣으세요. 저장하면 3일·7일 뒤 재도전이 예약됩니다.</p>
            <label class="lbl">다음에 써 볼 표현 <span class="muted small">(한 줄에 하나)</span></label>
            <textarea id="fbExpr" rows="3" lang="en" placeholder="I ended up ...&#10;It turned out that ...&#10;Looking back, ...">${esc(fb ? (fb.expressions || []).join('\n') : '')}</textarea>
            <label class="lbl">개선 답변</label>
            <textarea id="fbImp" rows="6" lang="en" placeholder="AI가 써 준 개선 답변을 붙여 넣으세요.">${esc(fb ? fb.improved || '' : '')}</textarea>
            <label class="lbl">첨삭 메모 <span class="muted small">(선택: 개선점 3개 등)</span></label>
            <textarea id="fbMemo" rows="3" placeholder="가장 중요한 개선점 등">${esc(fb ? fb.memo || '' : '')}</textarea>
            <button class="btn primary block" id="saveFb">첨삭 결과 저장</button>`}
        </section>

        <section class="card" id="retryCard"><h2>다시 답변하기</h2>
          ${list.length ? `<p class="muted small">이번 녹음에서 써 볼 표현을 고르세요 (최대 3개). 녹음 뒤 실제로 썼는지 직접 체크합니다.</p>
          <ul class="pick-targets">${targetCandidates().map((t, i) => `<li><label><input type="checkbox" data-i="${i}" ${(chosenTargets ? chosenTargets.some(c => c.text === t.text) : i < 3) ? 'checked' : ''}>
            <span lang="en">${esc(t.text)}</span> <span class="muted small">${t.source === 'feedback' ? '첨삭' : t.source.startsWith('note:') ? '수업 노트' : '기본 표현'}</span></label></li>`).join('')}</ul>`
          : '<p class="muted small">첫 답변을 먼저 녹음하세요.</p>'}
        </section>

        ${list.length >= 2 ? `<section class="card" id="cmpCard"><h2>나란히 비교</h2>
          <div class="row"><select id="cmpA">${list.map((r, i) => `<option value="${r.id}" ${i === 0 ? 'selected' : ''}>${picker.KIND_LABELS[r.kind]} ${util.fmtDate(r.createdAt)}</option>`).join('')}</select>
          <span>vs</span><select id="cmpB">${list.map((r, i) => `<option value="${r.id}" ${i === list.length - 1 ? 'selected' : ''}>${picker.KIND_LABELS[r.kind]} ${util.fmtDate(r.createdAt)}</option>`).join('')}</select></div>
          <div id="cmpOut"></div></section>` : ''}

        <section class="card"><h2>재도전 일정</h2>
          ${retries.length ? `<ul class="retries">${retries.map(r => `<li class="${r.doneAt ? 'done' : r.due <= Date.now() ? 'due' : ''}">${esc(r.label)} · ${new Date(r.due).toLocaleDateString('ko-KR')} ${r.doneAt ? '✓ 완료' : r.due <= Date.now() ? '— 지금 재도전!' : ''}</li>`).join('')}</ul>
            <button class="btn small" id="icsBtn">캘린더 알림 추가 (.ics)</button><p class="muted small">앱은 서버 없이 동작해 푸시 알림을 보낼 수 없어요. 홈 화면에 「재도전할 문제」로 표시되고, 캘린더 파일로 휴대폰 알림을 받을 수 있습니다.</p>`
            : '<p class="muted small">첨삭 결과를 저장하면 3일·7일 뒤 재도전이 예약됩니다.</p>'}
        </section>`;

        /* 질문 듣기 */
        if (qb) qb.destroy();
        qb = C.questionBlock(ui.$('#qb', el), q, {
          hideMeta: true, showText: store.S.settings.showTextPractice,
          onPlayStart: () => { if (panel && panel.state() === 'recording') panel.cancel(); },
          onEnd: n => { if (n === 1 && store.S.settings.autoRecord && panel && panel.state() === 'idle' && !recs().length) panel.start(); }
        });

        /* 녹음 선택·상세 */
        ui.$$('[data-rec]', el).forEach(b => b.onclick = () => { selId = b.dataset.rec; ui.$$('[data-rec]', el).forEach(x => x.classList.toggle('on', x === b)); showDetail(); });
        showDetail();

        ui.$('#star', el).onclick = async () => { const st = store.q(q.id); st.review = !st.review; await store.saveQ(st); ui.$('#star', el).classList.toggle('on', st.review); ui.toast(st.review ? '복습 지정: 출제에서 다시 나옵니다.' : '복습 지정 해제'); };

        /* 첨삭 저장 */
        const saveFb = ui.$('#saveFb', el);
        if (saveFb) saveFb.onclick = async () => {
          const expressions = prompt.parseExpressions(ui.$('#fbExpr', el).value);
          const improved = ui.$('#fbImp', el).value.trim();
          const memo = ui.$('#fbMemo', el).value.trim();
          if (!expressions.length && !improved) return ui.toast('표현이나 개선 답변 중 하나는 입력해 주세요.');
          const had = !!(store.S.qs[q.id] && store.S.qs[q.id].feedback);
          await store.saveFeedback(q.id, { expressions, improved, memo });
          chosenTargets = null;
          ui.toast(had ? '첨삭 결과를 수정했습니다.' : '저장했습니다. 이제 같은 문제를 다시 녹음해 보세요. 3일·7일 뒤 재도전도 예약했어요.', 3500);
          if (query.editfb) { delete query.editfb; }
          render();
          ui.$('#retryCard', el).scrollIntoView({ behavior: 'smooth' });
        };
        const ef = ui.$('#editFb', el);
        if (ef) ef.onclick = () => { query.editfb = '1'; render(); ui.$('#fbCard', el).scrollIntoView(); };
        ui.$$('.add-note', el).forEach(b => b.onclick = async () => {
          await store.saveNote({ original: '', corrected: b.dataset.x, memo: '첨삭에서 추가 · ' + (bank.topicById[q.topic].label) });
          ui.toast('수업 표현 노트에 추가했습니다. 원래 말한 표현은 노트에서 채워 넣을 수 있어요.');
        });
        const si = ui.$('#speakImp', el);
        if (si) si.onclick = () => root.OPIC.tts.speak(fb.improved, { voiceName: store.S.settings.voiceName, rate: store.S.settings.rate });
        const ts = ui.$('#toScript', el);
        if (ts) ts.onclick = async () => {
          const sc = await store.saveScript({ title: bank.topicById[q.topic].label + ' — ' + bank.TYPE_LABELS[q.type], text: fb.improved, questionId: q.id });
          ui.toast('스크립트로 저장했습니다.'); root.OPIC.go('#/script/' + sc.id);
        };

        /* 다시 답변: 표현 선택 */
        const cands = targetCandidates();
        const readTargets = () => ui.$$('.pick-targets input:checked', el).slice(0, 3).map(cb => cands[+cb.dataset.i]);
        ui.$$('.pick-targets input', el).forEach(cb => cb.onchange = () => {
          if (ui.$$('.pick-targets input:checked', el).length > 3) { cb.checked = false; ui.toast('표현은 3개까지 고를 수 있어요.'); }
          chosenTargets = readTargets();
        });

        /* 비교 */
        const ca = ui.$('#cmpA', el), cb2 = ui.$('#cmpB', el);
        if (ca) {
          const draw = async () => {
            const a = store.S.recs.find(r => r.id === ca.value), b = store.S.recs.find(r => r.id === cb2.value);
            ui.$('#cmpOut', el).innerHTML = a && b ? C.compareHtml(a, b) : '';
            C.mountPlayers(ui.$('#cmpOut', el));
            if (a && b && a.id !== b.id) { const st = store.q(q.id); if (!st.comparedAt) { st.comparedAt = Date.now(); await store.saveQ(st); ui.$$('.stepper li', el)[5].classList.add('done'); } }
          };
          ca.onchange = draw; cb2.onchange = draw; draw();
          drawCompare = draw;
        } else drawCompare = null;

        const ib = ui.$('#icsBtn', el);
        if (ib) ib.onclick = () => ui.download(new Blob([ics(q, retries)], { type: 'text/calendar' }), `opic-retry-${q.id}.ics`);

        /* 하단 녹음 버튼 */
        const hasRecs = list.length > 0;
        if (panel) panel.setLabel(hasRecs ? '다시 답변 녹음' : '첫 답변 녹음');
      }

      function showDetail() {
        const box = ui.$('#detail', el);
        const rec = store.S.recs.find(r => r.id === selId);
        if (!rec) { box.innerHTML = ''; return; }
        C.recordingDetail(box, rec, {
          onDelete: () => { selId = null; render(); },
          onChange: () => { const st = stepState(); ui.$$('.stepper li', el).forEach((li, i) => li.classList.toggle('done', st[i])); if (drawCompare) drawCompare(); }
        });
        /* 첨삭 복사 단계 표시 */
        ui.$('.copy-ai', box).addEventListener('click', async () => {
          const st = store.q(q.id); st.copiedAt = Date.now(); await store.saveQ(st);
          ui.$$('.stepper li', el)[2].classList.add('done');
        });
      }

      render();
      panel = C.recorderPanel({
        label: recs().length ? '다시 답변 녹음' : '첫 답변 녹음',
        getMeta: () => {
          const has = recs().length > 0;
          const targets = has ? (chosenTargets || targetCandidates().slice(0, 3)) : [];
          return { questionId: q.id, mode: 'card', targets };
        },
        onSaved: rec => {
          selId = rec.id;
          /* 노트 표현을 제안한 횟수 기록 (덜 써 본 표현을 다음에 먼저 제안) */
          rec.targets.forEach(t => { if (t.source && t.source.startsWith('note:')) { const n = store.S.notes.find(x => x.id === t.source.slice(5)); if (n) { n.suggested = (n.suggested || 0) + 1; store.saveNote(n); } } });
          ui.toast(rec.targets.length ? '저장했습니다. 아래에서 쓰려던 표현을 실제로 썼는지 체크하세요.' : '저장했습니다. 받아쓴 글을 확인하고 「AI 첨삭용 복사」를 눌러 보세요.', 3500);
          render();
          ui.$('#recsCard', el).scrollIntoView({ behavior: 'smooth' });
        }
      });
      return async () => { if (qb) qb.destroy(); if (panel) await panel.destroy(); };
    }
  };
})(window);
