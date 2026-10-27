/* 즉흥 답변 훈련 — 준비하지 않은 질문 대응
   start5   : 질문을 듣고 5초 안에 말 시작하기 (녹음의 소리 크기로 첫 마디까지 걸린 시간 측정)
   twist    : 아는 주제를 다른 관점으로 바꾼 질문
   keywords : 키워드 3개만 보고 말하기
   stall    : 말이 막혔을 때 이어 가는 표현 연습 */
(function (root) {
  'use strict';
  const { util, bank, drills, picker, store, ui, tts, C } = root.OPIC;
  const esc = util.escapeHtml;
  const say = t => tts.speak(t, { voiceName: store.S.settings.voiceName, rate: store.S.settings.rate });

  function freshQuestion(filter) {
    /* 아직 한 번도 안 나온 질문 우선 → 준비하지 않은 질문 */
    const pool = bank.QUESTIONS.filter(q => q.type !== 'intro' && (!filter || filter(q)));
    const fresh = pool.filter(q => !(store.S.qs[q.id] && store.S.qs[q.id].lastAskedAt));
    const src = fresh.length ? fresh : pool;
    return src[Math.floor(Math.random() * src.length)];
  }

  /* 관점 바꾸기: 내가 이미 답해 본 주제에서, 답해 본 적 없는 다른 관점의 질문 */
  function twistPair() {
    const answered = new Set(store.S.recs.map(r => r.questionId).filter(Boolean));
    const known = new Set(Array.from(answered).map(id => bank.byId[id] && bank.byId[id].topic).filter(Boolean));
    picker.surveyTopics(store.S.settings.survey || { picks: [] }).forEach(t => known.add(t));
    let topics = Array.from(known).filter(t => bank.QUESTIONS.some(q => q.topic === t && q.twist));
    if (!topics.length) topics = Array.from(new Set(bank.QUESTIONS.filter(q => q.twist).map(q => q.topic)));
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const base = bank.QUESTIONS.find(q => q.topic === topic && answered.has(q.id) && !q.twist) || bank.QUESTIONS.find(q => q.topic === topic && q.type === 'describe');
    const twists = bank.QUESTIONS.filter(q => q.topic === topic && q.id !== (base && base.id) && !answered.has(q.id) && (q.twist || q.type === 'compare' || q.type === 'past'));
    const tw = twists.find(q => q.twist) || twists[0] || bank.QUESTIONS.find(q => q.topic === topic && q.twist);
    return { base, tw };
  }

  function firstSpeechHtml(rec, limit) {
    const f = rec.audioStats && rec.audioStats.firstSpeechSec;
    if (f == null) return '<p class="muted">소리가 거의 감지되지 않았습니다. 마이크 가까이에서 다시 해 보세요.</p>';
    const ok = f <= limit;
    return `<p class="${ok ? 'good' : 'warn'}"><b>첫 마디까지 ${f.toFixed(1)}초</b> ${ok ? '— 성공!' : `— ${limit}초를 넘었어요. "Let me think…" 같은 표현으로 먼저 입을 떼 보세요.`}</p>
      <p class="muted small">녹음의 소리 크기로 잰 값이라 주변 소음이 크면 다를 수 있어요.</p>`;
  }

  root.OPIC.screens.impromptu = {
    title: '즉흥 답변', parentTab: 'practice',
    async render(el, params) {
      const drill = params[0];
      let qb = null, panel = null;
      const cleanup = async () => { if (qb) qb.destroy(); if (panel) await panel.destroy(); };

      if (!drill) {
        const tries = store.S.recs.filter(r => r.mode === 'start5');
        const okN = tries.filter(r => r.audioStats && r.audioStats.firstSpeechSec != null && r.audioStats.firstSpeechSec <= 5).length;
        el.innerHTML = `<section class="card"><h2>준비하지 않은 질문에 대응하기</h2><p class="muted small">외운 답이 아니라 그 자리에서 말을 시작하고 이어 가는 힘을 기릅니다.</p></section>
          <a class="card link-card" href="#/impromptu/start5"><b>5초 안에 말 시작하기</b><span>질문을 듣고 카운트다운 안에 첫 마디 떼기 · 성공 ${okN}/${tries.length}</span></a>
          <a class="card link-card" href="#/impromptu/twist"><b>관점 바꾸기</b><span>아는 주제를 다른 각도로 묻는 질문 (예: 좋아하는 장소 → 그 장소가 달라진 점)</span></a>
          <a class="card link-card" href="#/impromptu/keywords"><b>키워드 3개만 보고 말하기</b><span>질문 없이 단어 세 개로 이야기 만들기</span></a>
          <a class="card link-card" href="#/impromptu/stall"><b>막혔을 때 이어 가는 표현</b><span>Let me think… / What I mean is… / Anyway, the point is…</span></a>`;
        return;
      }

      if (drill === 'start5' || drill === 'twist') {
        const next = () => root.OPIC.refresh();
        let q, intro = '';
        if (drill === 'start5') {
          q = freshQuestion();
          intro = `<section class="card"><h2>5초 안에 말 시작하기</h2><p class="small">▶로 질문을 들으면 끝나자마자 녹음과 5초 카운트다운이 시작됩니다. 완벽한 문장이 아니어도 괜찮으니 먼저 입을 떼세요.</p></section>`;
        } else {
          const p = twistPair(); q = p.tw;
          intro = `<section class="card"><h2>관점 바꾸기</h2>
            <p class="small">아는 주제: <b>${esc(bank.topicById[q.topic].label)}</b></p>
            ${p.base ? `<details><summary>예전에 받던 질문 보기</summary><p class="qtext small" lang="en">${esc(p.base.text)}</p></details>` : ''}
            <p class="small">이번에는 같은 주제를 <b>다른 각도</b>로 묻습니다. 준비한 답을 그대로 말하지 말고, 질문에 맞게 바꿔 보세요.</p></section>`;
        }
        el.innerHTML = intro + '<div id="qb"></div><div id="after"></div>';
        qb = C.questionBlock(ui.$('#qb', el), q, {
          hideMeta: drill === 'start5', showText: false,
          onPlayStart: () => { if (panel && panel.state() === 'recording') panel.cancel(); },
          onEnd: n => { if (n === 1 && panel.state() === 'idle') panel.start(); }
        });
        panel = C.recorderPanel({
          label: '녹음 시작', countdown: 5,
          getMeta: () => ({ questionId: q.id, mode: drill }),
          onSaved: rec => {
            ui.$('#after', el).innerHTML = `<section class="card">${firstSpeechHtml(rec, 5)}${C.audioStatsHtml(rec)}${C.playerHtml(rec)}
              <div class="row"><button class="btn primary" id="nx">다음 질문 ›</button><a class="btn" href="#/q/${encodeURIComponent(q.id)}?rec=${rec.id}">첨삭 흐름으로</a></div></section>`;
            C.mountPlayers(ui.$('#after', el));
            ui.$('#nx', el).onclick = next;
          }
        });
        return cleanup;
      }

      if (drill === 'keywords') {
        const set = drills.KEYWORD_SETS[Math.floor(Math.random() * drills.KEYWORD_SETS.length)];
        el.innerHTML = `<section class="card"><h2>키워드 3개만 보고 말하기</h2><p class="small">아래 단어 세 개를 모두 넣어 1분 이상 이야기해 보세요. 힌트: <b>${esc(set.hint)}</b></p>
          <div class="kw">${set.kw.map(k => `<span lang="en">${esc(k)}</span>`).join('')}</div>
          <div class="row"><button class="btn" id="prep">15초 준비</button><button class="btn" id="other">다른 키워드</button></div><p class="center big-num" id="prepT"></p></section><div id="after"></div>`;
        let prepTimer = null;
        ui.$('#prep', el).onclick = () => {
          let n = 15; clearInterval(prepTimer); ui.$('#prepT', el).textContent = n;
          prepTimer = setInterval(() => { n--; ui.$('#prepT', el).textContent = n > 0 ? n : '시작!'; if (n <= 0) { clearInterval(prepTimer); if (panel.state() === 'idle') panel.start(); } }, 1000);
        };
        ui.$('#other', el).onclick = () => root.OPIC.refresh();
        panel = C.recorderPanel({
          label: '녹음 시작',
          getMeta: () => ({ questionId: null, promptText: '키워드: ' + set.kw.join(' / '), mode: 'keywords', targets: set.kw.map(k => ({ text: k, source: 'keyword' })) }),
          onSaved: rec => {
            const box = ui.$('#after', el);
            box.innerHTML = '<section class="card" id="kwDetail"></section><div class="row center"><button class="btn primary" id="nx">다른 키워드로 ›</button></div>';
            C.recordingDetail(ui.$('#kwDetail', box), rec, { onDelete: () => { box.innerHTML = ''; } });
            ui.$('#nx', el).onclick = () => root.OPIC.refresh();
          }
        });
        return async () => { clearInterval(prepTimer); await cleanup(); };
      }

      if (drill === 'stall') {
        const q = freshQuestion(x => x.level === 3 || x.cat === 'surprise');
        const picks = util.shuffle(drills.STALL_PHRASES).slice(0, 3);
        el.innerHTML = `<section class="card"><h2>막혔을 때 이어 가는 표현</h2>
          <p class="small">어려운 질문이 나옵니다. 아래 표현 중 <b>최소 2개</b>를 써서 끊기지 않고 1분 이상 이어 가 보세요.</p>
          <ul class="phr">${picks.map(p => `<li><button class="btn small say" data-t="${esc(p.en)}">▶</button><span lang="en"><b>${esc(p.en)}</b></span><span class="muted small">${esc(p.ko)} — ${esc(p.use)}</span></li>`).join('')}</ul></section>
          <div id="qb"></div><div id="after"></div>
          <section class="card"><details><summary>표현 전체 보기 (${drills.STALL_PHRASES.length}개)</summary><ul class="phr">${drills.STALL_PHRASES.map(p => `<li><button class="btn small say" data-t="${esc(p.en)}">▶</button><span lang="en">${esc(p.en)}</span><span class="muted small">${esc(p.ko)} — ${esc(p.use)}</span></li>`).join('')}</ul></details></section>`;
        ui.$$('.say', el).forEach(b => b.onclick = () => say(b.dataset.t));
        qb = C.questionBlock(ui.$('#qb', el), q, {
          showText: false,
          onPlayStart: () => { if (panel && panel.state() === 'recording') panel.cancel(); },
          onEnd: n => { if (n === 1 && panel.state() === 'idle') panel.start(); }
        });
        panel = C.recorderPanel({
          label: '녹음 시작',
          getMeta: () => ({ questionId: q.id, mode: 'stall', targets: picks.map(p => ({ text: p.en, source: 'stall' })) }),
          onSaved: rec => {
            const box = ui.$('#after', el);
            box.innerHTML = '<section class="card" id="stDetail"></section><div class="row center"><button class="btn primary" id="nx">다른 질문 ›</button></div>';
            C.recordingDetail(ui.$('#stDetail', box), rec, {});
            ui.$('#nx', el).onclick = () => root.OPIC.refresh();
            box.scrollIntoView({ behavior: 'smooth' });
          }
        });
        return cleanup;
      }
      el.innerHTML = '<div class="card"><p>알 수 없는 훈련입니다.</p></div>';
    }
  };
})(window);
