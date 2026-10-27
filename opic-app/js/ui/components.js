/* 재사용 부품: 질문 듣기, 녹음 버튼(하단 고정), 재생기, 녹음 상세(받아쓰기·분석·자가 체크·표현 체크), 비교표 */
(function (root) {
  'use strict';
  const { util, bank, drills, analysis, prompt, picker, recorder, tts, stt, store, db, ui } = root.OPIC;
  const esc = util.escapeHtml;
  const C = {};

  /* ───────── 질문 듣기 ─────────
     exam=true: 실제 시험 규칙(질문이 끝난 뒤 5초 안에 1회만 다시 듣기) */
  C.questionBlock = function (el, q, o) {
    o = o || {};
    const S = store.S.settings;
    const text = q.text;
    let listens = 0, cancelSpeak = null, replayTimer = null, replayLeft = 0, playing = false;
    const meta = o.hideMeta ? '' : `<div class="chips"><span class="chip">${esc(bank.topicById[q.topic] ? bank.topicById[q.topic].label : (q.topicLabel || ''))}</span>${q.type ? `<span class="chip type">${esc(bank.TYPE_LABELS[q.type] || q.type)}</span>` : ''}</div>`;
    el.innerHTML = `<div class="qblock">
      ${o.label ? `<div class="qlabel">${esc(o.label)}</div>` : ''}${meta}
      <button class="play-big" type="button" aria-label="질문 듣기"><span class="ico">▶</span><span class="lbl">질문 듣기</span></button>
      <div class="qstatus" aria-live="polite">${o.exam ? '▶를 눌러 질문을 들으세요. 질문이 끝나면 녹음이 시작됩니다. 다시 듣기는 질문이 끝난 뒤 5초 안에 한 번만 가능합니다.' : '▶를 눌러 질문을 들으세요.'}</div>
      <button class="link toggle-text" type="button">${o.showText ? '문제 글 숨기기' : '문제 글 보기'}</button>
      <p class="qtext" lang="en" ${o.showText ? '' : 'hidden'}>${esc(text)}</p>
    </div>`;
    const btn = ui.$('.play-big', el), status = ui.$('.qstatus', el), tBtn = ui.$('.toggle-text', el), tP = ui.$('.qtext', el);
    tBtn.onclick = () => { tP.hidden = !tP.hidden; tBtn.textContent = tP.hidden ? '문제 글 보기' : '문제 글 숨기기'; };
    function setBtn(label, ico, disabled) { ui.$('.lbl', btn).textContent = label; ui.$('.ico', btn).textContent = ico; btn.disabled = !!disabled; }
    function play() {
      if (playing) return;
      if (o.exam && listens >= 2) return;
      if (o.exam && listens === 1 && replayLeft <= 0) return;
      clearInterval(replayTimer); replayLeft = 0;
      recorder.unlock();
      listens++;
      playing = true;
      const isReplay = listens > 1;
      o.onPlayStart && o.onPlayStart(isReplay);
      setBtn(isReplay ? '다시 듣는 중…' : '듣는 중…', '♪', true);
      status.textContent = isReplay ? '질문을 다시 듣고 있습니다.' : '질문을 듣고 있습니다.';
      if (listens === 1) store.markAsked(q.id);
      cancelSpeak = tts.speak(text, {
        voiceName: S.voiceName, rate: S.rate,
        onEnd: ok => {
          playing = false;
          if (!ok && !tts.supported()) status.textContent = '이 기기에서 음성 합성을 쓸 수 없습니다. 「문제 글 보기」로 읽어 주세요.';
          if (o.exam) {
            if (listens === 1) {
              replayLeft = 5;
              const show = () => { setBtn(`다시 듣기 (${replayLeft}초)`, '↻', false); };
              show();
              replayTimer = setInterval(() => { replayLeft--; if (replayLeft <= 0) { clearInterval(replayTimer); setBtn('다시 듣기 끝', '✓', true); } else show(); }, 1000);
            } else setBtn('다시 듣기 끝', '✓', true);
            status.textContent = '녹음 중입니다. 답변을 마치면 아래 버튼을 누르세요.';
          } else {
            setBtn('다시 듣기', '↻', false);
            status.textContent = '질문이 끝났습니다.';
          }
          o.onEnd && o.onEnd(listens);
        }
      });
    }
    btn.onclick = play;
    return {
      play,
      listens: () => listens,
      stopReplayWindow() { clearInterval(replayTimer); if (o.exam && listens >= 1) setBtn('다시 듣기 끝', '✓', true); },
      destroy() { clearInterval(replayTimer); if (cancelSpeak) cancelSpeak(); tts.cancel(); }
    };
  };

  /* ───────── 하단 녹음 버튼 ─────────
     o: { getMeta(), onSaved(rec), onStart(), countdown: 초(즉흥 5초 훈련), label } */
  C.recorderPanel = function (o) {
    o = o || {};
    const S = store.S.settings;
    const d = ui.dock(`<div class="dock-inner">
      <div class="live-text" hidden aria-live="polite"></div>
      <div class="countdown" hidden></div>
      <div class="rec-row"><span class="rec-timer">00:00</span><div class="meter" aria-hidden="true"><i></i></div><span class="rec-state">대기</span></div>
      <button class="rec-btn" type="button"><span class="dot"></span><span class="lbl">${esc(o.label || '녹음 시작')}</span></button>
      <div class="rec-hint">${S.stt ? '자동 받아쓰기 켜짐 (설정에서 끄기)' : '자동 받아쓰기 꺼짐 — 받아쓴 글은 녹음 뒤 직접 입력할 수 있어요'}</div>
    </div>`);
    const btn = ui.$('.rec-btn', d), timer = ui.$('.rec-timer', d), meter = ui.$('.meter i', d), stateEl = ui.$('.rec-state', d),
      live = ui.$('.live-text', d), cd = ui.$('.countdown', d), hint = ui.$('.rec-hint', d);
    let st = 'idle', sttOn = false, sttText = '', cdTimer = null, destroyed = false, pending = null;

    function set(s) {
      st = s;
      d.dataset.state = s;
      const L = { idle: o.label || '녹음 시작', starting: '마이크 준비 중…', recording: '답변 끝내기', saving: '저장 중…' };
      ui.$('.lbl', btn).textContent = L[s];
      stateEl.textContent = { idle: '대기', starting: '준비', recording: '녹음 중', saving: '저장' }[s];
      btn.disabled = s === 'starting' || s === 'saving';
    }
    set('idle');

    async function handle(res) {
      clearInterval(cdTimer); cd.hidden = true;
      const text = sttOn ? stt.stop() : '';
      sttOn = false;
      meter.style.width = '0';
      if (destroyed && !res) return;
      if (!res || !res.blob || res.durationSec < 0.6) {
        set('idle');
        if (res) db.clearDraft(res.recId).catch(() => {});
        ui.toast('녹음이 너무 짧아 저장하지 않았습니다.');
        return;
      }
      set('saving');
      const meta = Object.assign({}, o.getMeta ? o.getMeta() : {}, { transcript: text || sttText, transcriptSource: 'auto' });
      try {
        const rec = await store.saveRecording(res, meta);
        await db.clearDraft(res.recId).catch(() => {});
        if (res.interruptedMsg) ui.modal({ title: '녹음이 중단되었습니다', html: `<p>${esc(res.interruptedMsg)}</p><p class="muted">녹음 길이: ${util.fmtDur(res.durationSec)} — 손상 없이 저장되었습니다.</p>` });
        set('idle');
        if (!destroyed) o.onSaved && o.onSaved(rec, res);
      } catch (e) {
        set('idle');
        const r = await ui.modal({ title: '저장하지 못했습니다', html: `<p>${esc(e.message || e)}</p><p class="muted">방금 녹음은 아직 기기 메모리에 있습니다. 파일로 저장해 두세요.</p>`,
          actions: [{ label: '닫기', value: false }, { label: '파일로 저장', value: true, kind: 'primary' }] });
        if (r) ui.download(res.blob, `opic_unsaved_${Date.now()}.${recorder.extOf(res.mime)}`);
      }
    }

    async function start() {
      if (st !== 'idle') return;
      recorder.unlock();
      set('starting');
      sttText = '';
      try {
        await recorder.start({
          meta: o.getMeta ? o.getMeta() : {},
          onTick: s => { timer.textContent = util.fmtClock(s); },
          onLevel: v => { meter.style.width = Math.min(100, Math.round(v * 220)) + '%'; },
          onStop: res => { pending = handle(res); }
        });
      } catch (e) {
        set('idle');
        ui.modal({ title: '마이크를 쓸 수 없습니다', html: `<p>${esc(e.msg || e.message || String(e))}</p><p class="muted">녹음 없이도 질문 듣기와 받아쓴 글 직접 입력, 자가 체크는 쓸 수 있습니다.</p>` });
        o.onError && o.onError(e);
        return false;
      }
      set('recording');
      timer.textContent = '00:00';
      if (S.stt) {
        const ok = stt.start({
          onText: (fin, interim) => { sttText = fin; live.hidden = false; live.innerHTML = esc(fin) + ' <span class="interim">' + esc(interim) + '</span>'; },
          onError: msg => { hint.textContent = msg; sttOn = false; }
        });
        sttOn = ok;
        if (ok) { live.hidden = false; live.innerHTML = '<span class="interim">듣고 있어요… (자동 받아쓰기는 실제 말과 다를 수 있어요)</span>'; }
      }
      if (o.countdown) {
        let n = o.countdown;
        cd.hidden = false; cd.textContent = `${n}초 안에 말을 시작하세요`;
        cdTimer = setInterval(() => { n--; if (n <= 0) { clearInterval(cdTimer); cd.textContent = '계속 말하세요!'; setTimeout(() => { cd.hidden = true; }, 1200); } else cd.textContent = `${n}초 안에 말을 시작하세요`; }, 1000);
      }
      o.onStart && o.onStart();
      return true;
    }
    function stop() { if (st === 'recording') { set('saving'); recorder.stop('user'); } }
    /* 저장하지 않고 버림 (시험에서 다시 듣기를 누르면 진행 중 녹음은 폐기) */
    async function cancel() {
      if (st !== 'recording') return;
      clearInterval(cdTimer); cd.hidden = true;
      if (sttOn) { stt.stop(); sttOn = false; }
      await recorder.cancel();
      meter.style.width = '0'; timer.textContent = '00:00'; live.hidden = true;
      set('idle');
    }
    btn.onclick = () => { if (st === 'idle') start(); else if (st === 'recording') stop(); };
    return {
      start, stop, cancel,
      state: () => st,
      setLabel(l) { o.label = l; if (st === 'idle') ui.$('.lbl', btn).textContent = l; },
      async destroy() {
        destroyed = true; clearInterval(cdTimer);
        if (st === 'recording') { await recorder.stop('user'); }
        if (pending) await pending.catch(() => {});
        if (sttOn) stt.stop();
        ui.dock('');
      }
    };
  };

  /* ───────── 재생기 ───────── */
  let current = null; // { audio, el, url }
  function stopCurrent() {
    if (!current) return;
    try { current.audio.pause(); } catch (e) {}
    current.el.classList.remove('playing');
    ui.$('.pbtn', current.el).textContent = '▶';
    URL.revokeObjectURL(current.url);
    current = null;
  }
  C.playerHtml = function (rec) {
    return `<div class="player" data-rec="${esc(rec.id)}"><button class="pbtn" type="button" aria-label="재생">▶</button><div class="pbar"><i></i></div><span class="ptime">0:00 / ${util.fmtClock(rec.durationSec).replace(/^0/, '')}</span></div>`;
  };
  C.mountPlayers = function (el) {
    ui.$$('.player', el).forEach(p => {
      if (p.dataset.bound) return; p.dataset.bound = '1';
      const btn = ui.$('.pbtn', p), bar = ui.$('.pbar i', p), time = ui.$('.ptime', p);
      const rec = store.S.recs.find(r => r.id === p.dataset.rec);
      if (!rec) return;
      btn.onclick = async () => {
        if (current && current.el === p) {
          if (current.audio.paused) { current.audio.play(); btn.textContent = '❚❚'; } else { current.audio.pause(); btn.textContent = '▶'; }
          return;
        }
        stopCurrent();
        tts.cancel();
        if (recorder.isRecording()) { ui.toast('녹음 중에는 재생할 수 없습니다.'); return; }
        const blob = await db.getAudio(rec.id);
        if (!blob) { ui.toast('오디오 파일을 찾을 수 없습니다.'); return; }
        if (!recorder.canPlay(blob.type || rec.mime)) {
          const r = await ui.modal({ title: '이 기기에서 재생할 수 없는 형식', html: `<p>이 녹음은 <b>${esc(blob.type || rec.mime)}</b> 형식입니다. 다른 기기(예: 갤럭시 Chrome)에서 만든 녹음은 아이폰 Safari에서 재생되지 않을 수 있습니다.</p><p>파일로 내보내 다른 앱에서 재생해 주세요.</p>`,
            actions: [{ label: '닫기', value: false }, { label: '파일로 내보내기', value: true, kind: 'primary' }] });
          if (r) ui.shareOrDownload([{ blob, name: ui.fileName(rec, recorder.extOf(blob.type)) }]);
          return;
        }
        const url = URL.createObjectURL(blob);
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = url;
        current = { audio, el: p, url };
        p.classList.add('playing');
        btn.textContent = '❚❚';
        const total = rec.durationSec || 0;
        audio.ontimeupdate = () => {
          const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : total;
          bar.style.width = Math.min(100, (audio.currentTime / (dur || 1)) * 100) + '%';
          time.textContent = `${util.fmtClock(audio.currentTime).replace(/^0/, '')} / ${util.fmtClock(dur).replace(/^0/, '')}`;
        };
        audio.onended = () => { bar.style.width = '100%'; stopCurrent(); };
        audio.onerror = () => { stopCurrent(); ui.toast('재생 중 오류가 났습니다. 「내보내기」로 파일을 저장해 다른 앱에서 들어 보세요.'); };
        try { await audio.play(); } catch (e) { stopCurrent(); ui.toast('재생을 시작하지 못했습니다. 한 번 더 눌러 주세요.'); }
      };
    });
  };
  C.stopPlayback = stopCurrent;

  /* ───────── 분석 표시 ───────── */
  C.audioStatsHtml = function (rec) {
    const a = rec.audioStats || {};
    const ratio = a.speechRatio != null ? Math.round(a.speechRatio * 100) + '%' : '-';
    return `<dl class="stats">
      <div><dt>답변 길이</dt><dd>${util.fmtDur(rec.durationSec)}</dd></div>
      <div><dt>말한 시간 비율</dt><dd>${ratio}</dd></div>
      <div><dt>중간 무음 (1.5초+)</dt><dd>${(a.pauses || []).length}회</dd></div>
      <div><dt>가장 긴 무음</dt><dd>${a.longestPause ? a.longestPause.toFixed(1) + '초' : '-'}</dd></div>
      <div><dt>첫 마디까지</dt><dd>${a.firstSpeechSec != null ? a.firstSpeechSec.toFixed(1) + '초' : '-'}</dd></div>
    </dl>${rec.env && rec.env.length ? C.envSvg(rec) : ''}`;
  };
  /* 소리 크기 막대(무음 구간 표시) */
  C.envSvg = function (rec) {
    const env = rec.env, n = env.length, W = 300, H = 36;
    const step = Math.max(1, Math.ceil(n / 150));
    const bars = [];
    for (let i = 0, x = 0; i < n; i += step, x++) {
      let m = 0; for (let j = i; j < Math.min(n, i + step); j++) m = Math.max(m, env[j]);
      const h = Math.max(1, Math.round((m / 255) * H));
      bars.push(`<rect x="${(x * W / Math.ceil(n / step)).toFixed(1)}" y="${H - h}" width="${Math.max(1, W / Math.ceil(n / step) - 0.6).toFixed(1)}" height="${h}"/>`);
    }
    const pauses = ((rec.audioStats || {}).pauses || []).map(p => `<rect class="pause" x="${(p.start * rec.fps / n * W).toFixed(1)}" y="0" width="${(p.len * rec.fps / n * W).toFixed(1)}" height="${H}"/>`).join('');
    return `<svg class="env" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="소리 크기 그래프, 빗금 부분이 1.5초 이상 무음">${pauses}<g class="bars">${bars.join('')}</g></svg>`;
  };

  C.ruleAnalysisHtml = function (rec, q) {
    const tr = (rec.transcript || '').trim();
    if (!tr) return `<p class="muted">받아쓴 글이 있으면 단어 수·분당 단어 수·군말·반복·연결어·과거 시제를 규칙으로 세어 봅니다.</p>`;
    const r = analysis.analyzeTranscript(tr, rec.durationSec);
    const fill = Object.keys(r.fillers.items).map(k => `${esc(k)} ${r.fillers.items[k]}`).join(', ') || '없음';
    const conn = Object.keys(r.connectors.groups).filter(g => r.connectors.groups[g].length)
      .map(g => `<span class="tag">${analysis.CONNECTORS[g].ko}: ${r.connectors.groups[g].map(x => esc(x.phrase) + (x.count > 1 ? '×' + x.count : '')).join(', ')}</span>`).join(' ') || '<span class="muted">없음</span>';
    const isPast = q && q.type === 'past';
    const pastWarn = isPast && r.past.verbCount < 3 ? '<p class="warn">과거 경험 질문인데 과거 시제 동사가 거의 보이지 않습니다. (받아쓰기 오류일 수도 있어요)</p>' : '';
    return `<dl class="stats">
        <div><dt>단어 수</dt><dd>${r.wordCount}</dd></div>
        <div><dt>분당 단어 수</dt><dd>${r.wpm != null ? r.wpm : '-'}</dd></div>
        <div><dt>군말</dt><dd>${r.fillers.total}회</dd></div>
        <div><dt>연결어</dt><dd>${r.connectors.total}회 · ${r.connectors.distinct.length}종류</dd></div>
      </dl>
      <p><b>군말</b> ${fill}${rec.transcriptSource === 'auto' ? ' <span class="muted">(자동 받아쓰기는 um·uh를 빼는 경우가 많아 실제보다 적게 나올 수 있어요)</span>' : ''}</p>
      <p><b>반복된 단어</b> ${r.repeats.length ? r.repeats.map(x => `${esc(x.word)}×${x.count}`).join(', ') : '없음'}${r.stutters ? ` · 같은 단어 연속 ${r.stutters}회` : ''}</p>
      <p><b>연결어</b> ${conn}</p>
      <p><b>과거 시제 동사</b> ${r.past.verbCount}개${r.past.verbs.length ? ' (' + r.past.verbs.map(esc).join(', ') + ')' : ''}<br><b>시간 표현</b> ${r.past.timeExpr.length ? r.past.timeExpr.map(esc).join(', ') : '없음'}</p>
      ${pastWarn}`;
  };

  C.selfCheckItems = function (q) {
    const t = q ? (q.type || 'describe') : 'past';
    return drills.SELF_CHECK_COMMON.concat(drills.SELF_CHECK_BY_TYPE[t] || []);
  };

  /* ───────── 녹음 상세 ───────── */
  C.recordingDetail = function (el, rec, o) {
    o = o || {};
    const q = bank.byId[rec.questionId];
    const items = C.selfCheckItems(q);
    const sc = rec.selfCheck || {};
    const srcLabel = { auto: '자동 받아쓰기', manual: '직접 입력', edited: '자동 + 직접 수정', none: '없음' }[rec.transcriptSource || 'none'];
    const kindSel = q ? `<select class="kind-sel" aria-label="녹음 구분">${Object.keys(picker.KIND_LABELS).map(k => `<option value="${k}" ${rec.kind === k ? 'selected' : ''}>${picker.KIND_LABELS[k]}</option>`).join('')}</select>` : '';
    el.innerHTML = `<div class="rec-detail">
      <div class="rd-head">${kindSel}<span class="muted">${util.fmtDate(rec.createdAt)} · ${util.fmtBytes(rec.size)}</span></div>
      ${rec.interrupted ? `<p class="note">${rec.recovered ? '앱이 종료되기 전 녹음을 복구했습니다.' : '녹음이 중간에 끊겨 그때까지 저장했습니다.'}</p>` : ''}
      ${o.showPrompt && rec.promptText ? `<p class="qtext small" lang="en">${esc(rec.promptText)}</p>` : ''}
      ${C.playerHtml(rec)}
      <section><h3>녹음 분석 <span class="badge">항상</span></h3>${C.audioStatsHtml(rec)}</section>
      <section><h3>받아쓴 글 <span class="badge">${srcLabel}</span></h3>
        ${rec.transcriptSource === 'auto' || rec.transcriptSource === 'edited' ? '<p class="muted small">자동 받아쓰기는 실제로 한 말과 다를 수 있어요. 녹음을 들으며 고친 뒤 복사하세요.</p>' : ''}
        <textarea class="tr-edit" lang="en" rows="5" placeholder="받아쓴 글이 없습니다. 녹음을 들으며 직접 입력하거나, 다른 앱에서 만든 받아쓴 글을 붙여 넣으세요. (없어도 녹음·재생·자가 체크·복습은 그대로 됩니다)">${esc(rec.transcript || '')}</textarea>
        <div class="row"><button class="btn small save-tr" type="button">받아쓴 글 저장</button><span class="muted small tr-msg"></span></div>
      </section>
      <section><h3>자동 분석 <span class="badge">규칙 기반</span></h3><div class="rule-box">${C.ruleAnalysisHtml(rec, q)}</div>
        <p class="muted small">단어 수·연결어 개수만으로 등급을 판단할 수 없습니다. 점수가 아니라 다음 녹음에서 볼 참고 숫자예요.</p></section>
      ${(rec.targets || []).length ? `<section><h3>이번에 쓰려던 표현 <span class="badge">직접 체크</span></h3><ul class="targets">${rec.targets.map((t, i) => {
        const hintUsed = rec.transcript && analysis.containsExpression(rec.transcript, t.text);
        return `<li><span lang="en">${esc(t.text)}</span>${hintUsed ? '<span class="hint-found">받아쓴 글에서 발견</span>' : ''}<div class="seg" data-i="${i}">
          <button type="button" data-v="1" class="${t.used === true ? 'on' : ''}">썼다</button><button type="button" data-v="0" class="${t.used === false ? 'on' : ''}">못 썼다</button></div></li>`;
      }).join('')}</ul></section>` : ''}
      <section><h3>자가 체크 <span class="badge">자가 평가</span></h3><ul class="checks">${items.map(it =>
        `<li><label><input type="checkbox" data-id="${it.id}" ${sc[it.id] ? 'checked' : ''}> ${esc(it.t)}</label></li>`).join('')}</ul></section>
      <div class="actions">
        <button class="btn primary copy-ai" type="button">AI 첨삭용 복사</button>
        <button class="btn export" type="button">오디오 내보내기</button>
        <button class="btn danger del" type="button">삭제</button>
      </div></div>`;
    C.mountPlayers(el);
    const ta = ui.$('.tr-edit', el), msg = ui.$('.tr-msg', el);
    let saveT = null;
    const saveTr = async () => {
      const v = ta.value.trim();
      if (v === (rec.transcript || '')) return;
      const src = !v ? 'none' : (rec.transcriptSource === 'auto' || rec.transcriptSource === 'edited') ? 'edited' : 'manual';
      await store.updateRecording(rec.id, { transcript: v, transcriptSource: src });
      msg.textContent = '저장됨';
      ui.$('.rule-box', el).innerHTML = C.ruleAnalysisHtml(rec, q);
      o.onChange && o.onChange(rec);
    };
    ta.addEventListener('input', () => { msg.textContent = ''; clearTimeout(saveT); saveT = setTimeout(saveTr, 1200); });
    ta.addEventListener('blur', saveTr);
    ui.$('.save-tr', el).onclick = saveTr;
    const ks = ui.$('.kind-sel', el);
    if (ks) ks.onchange = async () => { await store.updateRecording(rec.id, { kind: ks.value }); o.onChange && o.onChange(rec); };
    ui.$$('.checks input', el).forEach(cb => cb.onchange = async () => {
      const s = Object.assign({}, rec.selfCheck || {}); s[cb.dataset.id] = cb.checked;
      await store.updateRecording(rec.id, { selfCheck: s });
      o.onChange && o.onChange(rec);
    });
    ui.$$('.targets .seg', el).forEach(seg => seg.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      const i = +seg.dataset.i;
      const t = rec.targets.slice(); const val = b.dataset.v === '1';
      const wasUsed = t[i].used === true;
      t[i] = Object.assign({}, t[i], { used: t[i].used === val ? null : val });
      await store.updateRecording(rec.id, { targets: t });
      ui.$$('button', seg).forEach(x => x.classList.toggle('on', t[i].used !== null && (x.dataset.v === '1') === t[i].used));
      /* 노트 표현을 썼으면 노트 통계에 반영 */
      if (t[i].source && t[i].source.startsWith('note:')) {
        const n = store.S.notes.find(x => x.id === t[i].source.slice(5));
        /* '썼다'로 바뀔 때만 +1, '썼다'를 취소하면 -1 (여러 번 눌러도 부풀지 않게) */
        const delta = (t[i].used === true ? 1 : 0) - (wasUsed ? 1 : 0);
        if (n && delta) { n.used = Math.max(0, (n.used || 0) + delta); store.saveNote(n); }
      }
      o.onChange && o.onChange(rec);
    });
    ui.$('.copy-ai', el).onclick = async () => {
      await saveTr();
      const text = prompt.buildCoachPrompt({ targetLevel: store.S.settings.targetLevel, question: rec.promptText || (q && q.text) || '', transcript: rec.transcript, durationSec: rec.durationSec });
      if (!rec.transcript) ui.toast('받아쓴 글 없이 복사합니다. AI가 내용을 볼 수 있도록 받아쓴 글을 넣는 것을 추천해요.', 3500);
      ui.copyText(text);
    };
    ui.$('.export', el).onclick = async () => {
      const blob = await db.getAudio(rec.id);
      if (!blob) return ui.toast('오디오 파일이 없습니다.');
      ui.shareOrDownload([{ blob, name: ui.fileName(rec, recorder.extOf(blob.type || rec.mime)) }]);
    };
    ui.$('.del', el).onclick = async () => {
      if (!await ui.confirmDlg('이 녹음을 삭제할까요? 되돌릴 수 없습니다.', '삭제', true)) return;
      stopCurrent();
      await store.deleteRecordings([rec.id]);
      ui.toast('삭제했습니다.');
      o.onDelete && o.onDelete(rec);
    };
  };

  /* ───────── 두 녹음 비교 ───────── */
  C.compareHtml = function (a, b) {
    const q = bank.byId[a.questionId];
    const items = C.selfCheckItems(q);
    const ra = analysis.analyzeTranscript(a.transcript || '', a.durationSec);
    const rb = analysis.analyzeTranscript(b.transcript || '', b.durationSec);
    const scCount = r => items.filter(it => (r.selfCheck || {})[it.id]).length;
    const tgt = r => { const t = r.targets || []; return t.length ? `${t.filter(x => x.used === true).length} / ${t.length}` : '-'; };
    const pct = x => x != null ? Math.round(x * 100) + '%' : '-';
    const has = r => !!(r.transcript || '').trim();
    const row = (label, va, vb, better) => `<tr><th>${label}</th><td>${va}</td><td class="${better ? 'up' : ''}">${vb}</td></tr>`;
    const K = picker.KIND_LABELS;
    return `<table class="cmp"><thead><tr><th></th><th>${K[a.kind] || ''}<br><span class="muted small">${util.fmtDate(a.createdAt)}</span></th><th>${K[b.kind] || ''}<br><span class="muted small">${util.fmtDate(b.createdAt)}</span></th></tr></thead><tbody>
      ${row('답변 길이', util.fmtDur(a.durationSec), util.fmtDur(b.durationSec), b.durationSec > a.durationSec)}
      ${row('말한 시간 비율', pct(a.audioStats && a.audioStats.speechRatio), pct(b.audioStats && b.audioStats.speechRatio), (b.audioStats || {}).speechRatio > (a.audioStats || {}).speechRatio)}
      ${row('중간 무음', ((a.audioStats || {}).pauses || []).length + '회', ((b.audioStats || {}).pauses || []).length + '회', false)}
      ${row('단어 수', has(a) ? ra.wordCount : '-', has(b) ? rb.wordCount : '-', has(a) && has(b) && rb.wordCount > ra.wordCount)}
      ${row('연결어 종류', has(a) ? ra.connectors.distinct.length : '-', has(b) ? rb.connectors.distinct.length : '-', has(a) && has(b) && rb.connectors.distinct.length > ra.connectors.distinct.length)}
      ${row('과거 시제 동사', has(a) ? ra.past.verbCount : '-', has(b) ? rb.past.verbCount : '-', false)}
      ${row('군말', has(a) ? ra.fillers.total : '-', has(b) ? rb.fillers.total : '-', false)}
      ${row('자가 체크', `${scCount(a)} / ${items.length}`, `${scCount(b)} / ${items.length}`, scCount(b) > scCount(a))}
      ${row('쓰려던 표현 사용', tgt(a), tgt(b), false)}
    </tbody></table>
    <p class="muted small">숫자는 규칙 기반 참고값이며 점수가 아닙니다. 초록색은 '늘어난 값' 표시일 뿐 더 좋다는 판정이 아니에요.</p>
    <div class="cmp-tr"><div><h4>${K[a.kind] || 'A'}</h4>${C.playerHtml(a)}<p lang="en" class="tr">${has(a) ? esc(a.transcript) : '<span class="muted">받아쓴 글 없음</span>'}</p></div>
      <div><h4>${K[b.kind] || 'B'}</h4>${C.playerHtml(b)}<p lang="en" class="tr">${has(b) ? esc(b.transcript) : '<span class="muted">받아쓴 글 없음</span>'}</p></div></div>`;
  };

  root.OPIC.C = C;
})(window);
