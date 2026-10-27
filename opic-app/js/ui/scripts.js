/* 스크립트 연습: 내 답변 스크립트 저장 → 문장 단위로 가리고 키워드만 보며 말하기 → 녹음 → 원문과 비교
   가리는 양을 단계별로 늘린다 (전체 → 절반 → 키워드 → 첫 단어+키워드 1개 → 전부) */
(function (root) {
  'use strict';
  const { util, bank, script, store, ui, C } = root.OPIC;
  const esc = util.escapeHtml;

  function readFile(file) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsText(file); }); }

  root.OPIC.screens.scripts = {
    title: '스크립트 연습', parentTab: 'practice',
    render(el) {
      const fbList = Object.values(store.S.qs).filter(s => s.feedback && s.feedback.improved && !store.S.scripts.some(sc => sc.questionId === s.qid && sc.text === s.feedback.improved));
      el.innerHTML = `<section class="card"><div class="row"><a class="btn primary" href="#/script/new">＋ 새 스크립트</a><button class="btn" id="bulk">붙여 넣어 가져오기</button>
          <label class="btn">텍스트 파일<input type="file" id="file" accept=".txt,.md,text/plain" hidden></label></div>
          ${fbList.length ? `<button class="btn block" id="fromFb">첨삭받은 개선 답변 ${fbList.length}개 가져오기</button>` : ''}
          <p class="muted small">여러 개를 한 번에 붙여 넣을 때는 각 스크립트 앞에 <code>## 제목</code> 줄을 넣으세요.</p></section>
        ${store.S.scripts.length ? store.S.scripts.map(sc => {
          const last = (sc.attempts || []).slice(-1)[0];
          return `<a class="card link-card" href="#/script/${sc.id}"><b>${esc(sc.title || '제목 없음')}</b>
            <span>${script.LEVELS[sc.level || 0].label}${last && last.coverage != null ? ` · 최근 일치율 ${Math.round(last.coverage * 100)}%` : ''} · ${script.splitSentences(sc.text).length}문장</span></a>`;
        }).join('') : '<section class="card"><p class="muted">저장된 스크립트가 없습니다. 영국인 선생님과 다듬은 답변이나 첨삭받은 개선 답변을 넣어 보세요.</p></section>'}`;
      const addMany = async list => { for (const s of list) await store.saveScript(s); ui.toast(`${list.length}개 스크립트를 가져왔습니다.`); root.OPIC.refresh(); };
      ui.$('#bulk', el).onclick = async () => {
        const text = await ui.modal({ title: '스크립트 붙여 넣기', html: '<textarea id="bulkT" rows="10" lang="en" placeholder="## 좋아하는 카페\nMy favorite cafe is ...\n\n## 지난 여행\nLast summer, ..."></textarea>',
          actions: [{ label: '취소', value: null }, { label: '가져오기', kind: 'primary', value: w => ui.$('#bulkT', w).value }] });
        if (!text) return;
        const list = script.parseBulk(text);
        if (!list.length) return ui.toast('가져올 내용이 없습니다.');
        addMany(list);
      };
      ui.$('#file', el).onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try { const list = script.parseBulk(await readFile(f)); if (!list.length) throw new Error('empty'); addMany(list.map(s => Object.assign(s, { title: s.title === '가져온 스크립트' ? f.name.replace(/\.\w+$/, '') : s.title }))); }
        catch (err) { ui.toast('파일을 읽지 못했습니다. UTF-8 텍스트 파일인지 확인해 주세요.'); }
      };
      const ff = ui.$('#fromFb', el);
      if (ff) ff.onclick = () => addMany(fbList.map(s => { const q = bank.byId[s.qid]; return { title: q ? `${bank.topicById[q.topic].label} — ${bank.TYPE_LABELS[q.type]}` : '개선 답변', text: s.feedback.improved, questionId: s.qid }; }));
    }
  };

  root.OPIC.screens.script = {
    title: '스크립트', parentTab: 'practice',
    async render(el, params) {
      let sc = params[0] === 'new' ? null : store.S.scripts.find(s => s.id === params[0]);
      if (params[0] !== 'new' && !sc) { el.innerHTML = '<div class="card"><p>스크립트를 찾을 수 없습니다.</p></div>'; return; }
      let panel = null;
      let peek = new Set();
      let seed = String(Date.now());

      function edit() {
        if (panel) { panel.destroy(); panel = null; }
        const qs = bank.QUESTIONS.filter(q => q.type !== 'intro');
        el.innerHTML = `<section class="card"><label class="lbl">제목</label><input class="full" id="t" value="${esc(sc ? sc.title : '')}" placeholder="예: 좋아하는 카페 묘사">
          <label class="lbl">연결할 문제 <span class="muted small">(선택)</span></label>
          <select id="qsel" class="full"><option value="">없음</option>${qs.map(q => `<option value="${q.id}" ${sc && sc.questionId === q.id ? 'selected' : ''}>${esc(bank.topicById[q.topic].label)} · ${esc(bank.TYPE_LABELS[q.type])} — ${esc(q.text.slice(0, 50))}</option>`).join('')}</select>
          <label class="lbl">스크립트 (영어)</label><textarea id="x" rows="12" lang="en" placeholder="내 답변 스크립트를 입력하거나 붙여 넣으세요.">${esc(sc ? sc.text : '')}</textarea>
          <div class="row"><button class="btn primary" id="save">저장</button>${sc ? '<button class="btn" id="cancel">취소</button><button class="btn danger" id="del">삭제</button>' : ''}</div></section>`;
        ui.$('#save', el).onclick = async () => {
          const text = ui.$('#x', el).value.trim();
          if (!text) return ui.toast('스크립트를 입력해 주세요.');
          sc = await store.saveScript(Object.assign({}, sc || {}, { title: ui.$('#t', el).value.trim() || '제목 없음', text, questionId: ui.$('#qsel', el).value || null }));
          if (params[0] === 'new') { history.replaceState(null, '', '#/script/' + sc.id); params[0] = sc.id; }
          ui.toast('저장했습니다.'); practice();
        };
        const c = ui.$('#cancel', el); if (c) c.onclick = practice;
        const d = ui.$('#del', el); if (d) d.onclick = async () => { if (await ui.confirmDlg('이 스크립트를 삭제할까요?', '삭제', true)) { await store.deleteScript(sc.id); root.OPIC.go('#/scripts'); } };
      }

      function practice() {
        const sents = script.splitSentences(sc.text);
        const lv = sc.level || 0;
        const q = sc.questionId && bank.byId[sc.questionId];
        el.innerHTML = `<div class="card-head"><h2>${esc(sc.title)}</h2><button class="btn small" id="edit">편집</button></div>
          ${q ? `<details><summary>연결된 문제</summary><p class="qtext small" lang="en">${esc(q.text)}</p><button class="btn small" id="sayQ">▶ 질문 듣기</button></details>` : ''}
          <div class="seg wide" id="lvSeg">${script.LEVELS.map(l => `<button class="${l.n === lv ? 'on' : ''}" data-l="${l.n}">${l.n + 1}</button>`).join('')}</div>
          <p class="muted small center">${script.LEVELS[lv].label} · 가려진 문장은 눌러서 잠깐 볼 수 있어요</p>
          <ol class="sents" lang="en">${sents.map((s, i) => `<li data-i="${i}" class="${peek.has(i) ? 'peek' : ''}">${(peek.has(i) ? script.maskSentence(s, 0, seed) : script.maskSentence(s, lv, seed)).map(t => t.show ? `<span>${esc(t.w)}</span>` : `<span class="hid">${esc(t.w.replace(/[A-Za-z]/g, '·'))}</span>`).join(' ')}</li>`).join('')}</ol>
          <div class="row center"><button class="btn small" id="reshuffle">키워드 다시 고르기</button></div>
          <div id="after"></div>
          ${(sc.attempts || []).length ? `<section class="card"><h3>지난 연습</h3><ul class="small">${sc.attempts.slice(-6).reverse().map(a => `<li>${util.fmtDate(a.at)} · ${script.LEVELS[a.level].label}${a.coverage != null ? ` · 일치율 ${Math.round(a.coverage * 100)}%` : ''}</li>`).join('')}</ul></section>` : ''}`;
        ui.$('#edit', el).onclick = edit;
        const sq = ui.$('#sayQ', el); if (sq) sq.onclick = () => root.OPIC.tts.speak(q.text, { voiceName: store.S.settings.voiceName, rate: store.S.settings.rate });
        ui.$$('#lvSeg button', el).forEach(b => b.onclick = async () => { sc = await store.saveScript(Object.assign({}, sc, { level: +b.dataset.l })); peek.clear(); practice(); });
        ui.$('#reshuffle', el).onclick = () => { seed = String(Date.now()); practice(); };
        ui.$$('.sents li', el).forEach(li => li.onclick = () => {
          const i = +li.dataset.i; peek.add(i); practice();
          setTimeout(() => { peek.delete(i); if (document.body.dataset.screen === 'script' && !ui.$('#after .cmp-script', el)) practice(); }, 2500);
        });
        if (!panel) panel = C.recorderPanel({
          label: '외워서 말하기 녹음',
          getMeta: () => ({ questionId: sc.questionId || null, promptText: sc.questionId ? '' : '스크립트: ' + sc.title, mode: 'script', scriptId: sc.id, kind: 'first' }),
          onSaved: rec => showResult(rec)
        });
      }

      const scriptXp = new Set();
      function scriptReward(cov, recId) {
        if (cov != null && cov >= 0.8 && !scriptXp.has(recId)) { scriptXp.add(recId); store.award(5, '스크립트 일치율 80%+', { flags: { script80: true } }); }
      }
      function showResult(rec) {
        const box = ui.$('#after', el);
        const draw = () => {
          const tr = (rec.transcript || '').trim();
          const cmp = tr ? script.compare(sc.text, tr) : null;
          box.innerHTML = `<section class="card cmp-script"><h3>원문과 비교</h3>${C.playerHtml(rec)}
            <label class="lbl">내가 말한 내용 <span class="muted small">(자동 받아쓰기는 실제와 다를 수 있어요 — 들으며 고쳐 주세요)</span></label>
            <textarea id="spk" rows="4" lang="en" placeholder="받아쓴 글이 없으면 직접 입력하세요. 비워 두어도 녹음은 저장됩니다.">${esc(tr)}</textarea>
            <button class="btn small" id="doCmp">비교하기</button>
            ${cmp ? `<p><b>원문 단어 일치율 ${Math.round(cmp.coverage * 100)}%</b> <span class="muted small">(규칙 기반 · 순서대로 맞춘 단어 비율)</span></p>
              <p class="diff" lang="en">${cmp.tokens.map(t => t.ok ? esc(t.w) : `<mark>${esc(t.w)}</mark>`).join(' ')}</p>
              <p class="muted small">노란색 = 빠뜨렸거나 다르게 말한 부분${cmp.extra.length ? ` · 원문에 없던 말: ${esc(cmp.extra.slice(0, 15).join(' '))}` : ''}</p>
              ${cmp.coverage >= 0.8 && (sc.level || 0) < 4 ? '<button class="btn primary block" id="lvUp">잘했어요! 가리는 양 늘리기 ›</button>' : ''}` : ''}</section>`;
          C.mountPlayers(box);
          ui.$('#doCmp', box).onclick = async () => {
            const v = ui.$('#spk', box).value.trim();
            await store.updateRecording(rec.id, { transcript: v, transcriptSource: v ? (rec.transcriptSource === 'auto' ? 'edited' : 'manual') : 'none' });
            const c2 = v ? script.compare(sc.text, v) : null;
            const attempts = (sc.attempts || []).filter(a => a.recId !== rec.id).concat([{ at: rec.createdAt, level: sc.level || 0, coverage: c2 ? c2.coverage : null, recId: rec.id }]);
            sc = await store.saveScript(Object.assign({}, sc, { attempts }));
            scriptReward(c2 && c2.coverage, rec.id);
            draw();
          };
          const up = ui.$('#lvUp', box);
          if (up) up.onclick = async () => { sc = await store.saveScript(Object.assign({}, sc, { level: Math.min(4, (sc.level || 0) + 1) })); practice(); };
        };
        const attempts = (sc.attempts || []).concat([{ at: rec.createdAt, level: sc.level || 0, coverage: rec.transcript ? script.compare(sc.text, rec.transcript).coverage : null, recId: rec.id }]);
        store.saveScript(Object.assign({}, sc, { attempts })).then(s => { sc = s; });
        scriptReward(attempts[attempts.length - 1].coverage, rec.id);
        draw();
        box.scrollIntoView({ behavior: 'smooth' });
      }

      if (sc) practice(); else edit();
      return async () => { if (panel) await panel.destroy(); };
    }
  };
})(window);
