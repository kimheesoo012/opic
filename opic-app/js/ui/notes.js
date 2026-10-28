/* 수업 표현 노트: 원래 말한 것 → 교정된 표현 → 메모
   저장한 표현은 문제 카드의 「다시 답변하기」에서 이번에 써 볼 표현으로 제안된다. 4지선다 복습 퀴즈. */
(function (root) {
  'use strict';
  const { util, drills, quiz, store, ui, tts } = root.OPIC;
  const esc = util.escapeHtml;

  function noteForm(n) {
    return `<label class="lbl">원래 말한 것</label><input class="full" id="nO" lang="en" value="${esc(n ? n.original : '')}" placeholder="예: I very like it.">
      <label class="lbl">교정된 표현</label><input class="full" id="nC" lang="en" value="${esc(n ? n.corrected : '')}" placeholder="예: I really like it.">
      <label class="lbl">메모 <span class="muted small">(선택: 뜻, 선생님 설명, 상황)</span></label><textarea id="nM" rows="2">${esc(n ? n.memo : '')}</textarea>`;
  }
  const readForm = w => ({ original: ui.$('#nO', w).value.trim(), corrected: ui.$('#nC', w).value.trim(), memo: ui.$('#nM', w).value.trim() });

  root.OPIC.screens.notes = {
    title: '수업 표현 노트', tab: 'notes',
    render(el, params, query) {
      const term = (query.s || '').toLowerCase();
      const list = store.S.notes.filter(n => !term || (n.original + ' ' + n.corrected + ' ' + n.memo).toLowerCase().includes(term));
      el.innerHTML = `<section class="card"><h2>교정받은 표현 추가</h2>${noteForm(null)}<button class="btn primary block" id="add">노트에 저장</button>
          <p class="muted small">줌 수업이 끝나면 바로 적어 두세요. 다음 연습에서 「이번에 써 볼 표현」으로 제안됩니다.</p></section>
        <section class="card"><div class="row"><a class="btn primary" href="#/quiz" ${store.S.notes.length ? '' : 'aria-disabled="true"'}>복습 퀴즈 (4지선다)</a><input id="srch" class="grow" placeholder="검색" value="${esc(query.s || '')}"></div></section>
        <section><ul class="notes">${list.map(n => `<li class="card" data-id="${n.id}">
          ${n.original ? `<p class="orig" lang="en"><s>${esc(n.original)}</s></p>` : ''}<p class="corr" lang="en"><b>${esc(n.corrected)}</b> <button class="link say" data-t="${esc(n.corrected)}" aria-label="듣기">▶</button></p>
          ${n.memo ? `<p class="muted small">${esc(n.memo)}</p>` : ''}
          <p class="muted small">퀴즈 ${n.quiz ? `${n.quiz.right}✓ ${n.quiz.wrong}✗` : '-'} · 제안 ${n.suggested || 0} · 사용 체크 ${n.used || 0} · ${new Date(n.createdAt).toLocaleDateString('ko-KR')}</p>
          <div class="row"><button class="btn small ed">수정</button><button class="btn small danger dl">삭제</button></div></li>`).join('') || '<li class="card muted">아직 표현이 없습니다.</li>'}</ul></section>`;
      ui.$('#add', el).onclick = async () => {
        const v = readForm(el);
        if (!v.corrected) return ui.toast('교정된 표현을 입력해 주세요.');
        await store.saveNote(v); ui.toast('저장했습니다.'); root.OPIC.refresh();
      };
      let st = null;
      ui.$('#srch', el).oninput = e => { clearTimeout(st); st = setTimeout(() => { history.replaceState(null, '', '#/notes?s=' + encodeURIComponent(e.target.value)); root.OPIC.refresh(); }, 500); };
      ui.$$('.say', el).forEach(b => b.onclick = () => tts.speak(b.dataset.t, { voiceName: store.S.settings.voiceName, rate: store.S.settings.rate }));
      ui.$$('.notes li[data-id]', el).forEach(li => {
        const n = store.S.notes.find(x => x.id === li.dataset.id);
        ui.$('.ed', li).onclick = async () => {
          const v = await ui.modal({ title: '표현 수정', html: noteForm(n), actions: [{ label: '취소', value: null }, { label: '저장', kind: 'primary', value: readForm }] });
          if (v && v.corrected) { await store.saveNote(Object.assign({}, n, v)); root.OPIC.refresh(); }
        };
        ui.$('.dl', li).onclick = async () => { if (await ui.confirmDlg('이 표현을 삭제할까요?', '삭제', true)) { await store.deleteNote(n.id); root.OPIC.refresh(); } };
      });
    }
  };

  root.OPIC.screens.quiz = {
    title: '표현 복습 퀴즈', parentTab: 'notes',
    render(el) {
      if (!store.S.notes.length) { el.innerHTML = '<div class="card"><p>노트에 표현을 먼저 저장해 주세요.</p><a class="btn" href="#/notes">노트로</a></div>'; return; }
      const items = quiz.buildQuiz(store.S.notes, drills.DISTRACTOR_POOL, 10);
      let i = 0, right = 0;
      const wrongs = [];
      function show() {
        if (i >= items.length) {
          if (items.length >= 3) store.award(5, '표현 퀴즈 완료', right === items.length ? { flags: { quizPerfect: true } } : null);
          el.innerHTML = `<section class="card center"><h2>${right} / ${items.length}</h2><p>${right === items.length ? '모두 맞혔어요!' : '틀린 표현은 다음 연습에서 먼저 제안됩니다.'}</p>
            ${wrongs.length ? `<ul class="left">${wrongs.map(w => `<li lang="en"><b>${esc(w.answer)}</b>${w.prompt ? ` <span class="muted">← ${esc(w.prompt)}</span>` : ''}</li>`).join('')}</ul>` : ''}
            <div class="row center"><button class="btn primary" id="again">다시 풀기</button><a class="btn" href="#/notes">노트</a></div></section>`;
          ui.$('#again', el).onclick = () => root.OPIC.refresh();
          return;
        }
        const it = items[i];
        el.innerHTML = `<div class="progress"><span>${i + 1} / ${items.length}</span><div class="pbar"><i style="width:${i / items.length * 100}%"></i></div></div>
          <section class="card"><p class="muted small">${it.prompt ? '수업에서 원래 이렇게 말했어요. 선생님이 고쳐 준 표현은?' : '노트에 저장한 표현은?'}</p>
            ${it.prompt ? `<p class="quiz-prompt" lang="en">${esc(it.prompt)}</p>` : ''}${it.memo ? `<p class="muted small">메모: ${esc(it.memo)}</p>` : ''}
            <div class="opts">${it.options.map((o, k) => `<button class="btn opt" data-k="${k}" lang="en">${esc(o)}</button>`).join('')}</div>
            <div id="fb"></div></section>`;
        ui.$$('.opt', el).forEach(b => b.onclick = async () => {
          const ok = it.options[+b.dataset.k] === it.answer;
          ui.$$('.opt', el).forEach(x => { x.disabled = true; if (it.options[+x.dataset.k] === it.answer) x.classList.add('right'); });
          if (!ok) { b.classList.add('wrong'); wrongs.push(it); } else { right++; store.award(2, '퀴즈 정답'); }
          const n = store.S.notes.find(x => x.id === it.noteId);
          if (n) { n.quiz = n.quiz || { right: 0, wrong: 0 }; n.quiz[ok ? 'right' : 'wrong']++; n.quiz.lastAt = Date.now(); await store.saveNote(n); }
          ui.$('#fb', el).innerHTML = `<p class="${ok ? 'good' : 'warn'}">${ok ? '정답!' : '아쉬워요.'}</p><div class="row"><button class="btn small" id="sayA">▶ 정답 듣기</button><button class="btn primary" id="nx">다음 ›</button></div>`;
          ui.$('#sayA', el).onclick = () => tts.speak(it.answer, { voiceName: store.S.settings.voiceName, rate: store.S.settings.rate });
          ui.$('#nx', el).onclick = () => { i++; show(); };
        });
      }
      show();
    }
  };
})(window);
