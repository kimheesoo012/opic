/* 문제 종류별 화면. mount(el, item, done) → 정리 함수
   done(grade 0~3, {said, auto}) 를 부르면 세션이 기록하고 다음 문제로 넘어간다 */
import { S, recordPron, rec } from '../core/store.js';
import { tts, stt, recorder, micMessage, beep } from '../core/speech.js';
import { TAGS } from '../data/notes.js';
import { clozeOf, clozeBank } from '../core/deck.js';
import { compare, bestMatch, heardWord, shuffle } from '../core/text.js';
import { GRADES, nextInterval, intervalLabel, suggestGrade, level, LEVEL_LABEL } from '../core/srs.js';
import { $, $$, esc, safeRich, sayBtn, starBtn, tagChip, speak, toast } from './ui.js';

const sttOn = () => S.settings.stt && stt.available();

/* ── 공용 조각 ─────────────────── */
function kindLine(icon, label, item, extra = '') {
  const st = S.srs[item.key];
  const lv = level(st);
  return `<div class="kind">${icon} ${esc(label)}${extra}<span class="tag lv ${lv}">${lv === 'new' ? '새 문제' : LEVEL_LABEL[lv]}</span>${st && st.l ? `<span class="badge">틀린 적 ${st.l}번</span>` : ''}</div>`;
}

function gradeBar(item, suggested) {
  const st = S.srs[item.key];
  return `<div class="grades" role="group" aria-label="얼마나 잘 말했나요?">${GRADES.map(g => `<button type="button" class="g${g.g}${g.g === suggested ? ' sug' : ''}" data-g="${g.g}">${g.label}<span>${intervalLabel(nextInterval(st, g.g))}</span></button>`).join('')}</div>`;
}
function bindGrades(el, done, said) {
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-g]');
    if (b) done(+b.dataset.g, { said });
  });
}
function nextBtn(label = '다음') { return `<button type="button" class="btn primary block" id="next">${label} ›</button>`; }

/* 말한 문장 비교 표시 (목표 문장 기준: 빠진 말은 빨간 밑줄, 더한 말은 취소선) */
function diffHtml(said, target) {
  const c = compare(said, target);
  const html = c.ops.map(o => o.t === 'eq' ? `<span class="eq">${esc(o.b)}</span>` : o.t === 'ins' ? `<span class="ins" title="빠진 말">${esc(o.b)}</span>` : `<span class="del" title="더한 말">${esc(o.a)}</span>`).join(' ');
  return { html, score: c.score, c };
}
function resultBox(said, targets, labels) {
  const b = bestMatch(said, targets);
  const d = diffHtml(said, targets[b.i]);
  const sc = Math.round(d.score * 100);
  const cls = sc >= 80 ? 'good' : sc >= 60 ? 'mid' : 'bad';
  return {
    score: d.score,
    html: `<div class="result ${cls}">
      <div class="score">${sc >= 95 ? '완벽해요' : sc >= 80 ? '거의 맞았어요' : sc >= 60 ? '절반 넘게 맞았어요' : '다시 해 봐요'} · ${sc}% <span class="small muted" style="font-weight:400">(${esc(labels[b.i])} 기준)</span></div>
      <div class="small muted" style="margin-top:4px">내가 말한 것: <span class="en" style="font-size:15.5px;color:var(--ink)">${esc(said)}</span></div>
      <div class="diff">${d.html}</div>
      <div class="legend"><span class="ins">밑줄</span> 빠뜨린 말 · <span class="del">취소선</span> 더 들어간 말 · 대소문자·문장부호는 안 봐요</div>
    </div>`
  };
}

/* 녹음 재생 칸 */
async function recPlayer(host, key, blob) {
  if (!host) return;
  let b = blob;
  if (!b) { const r = await rec.get(key); b = r && r.blob; }
  if (!b) return;
  const url = URL.createObjectURL(b);
  host.innerHTML = `<div class="recplay"><span class="small muted">내 목소리</span><audio controls src="${url}" preload="metadata" style="height:36px;max-width:100%"></audio></div>`;
}

/* 말하기 입력: 음성 인식(+녹음) / 녹음만 / 직접 입력 / 스스로 확인 */
function answerBox(host, { key, placeholder = '마이크를 누르고 영어로 말해 보세요', onDone, continuous = true }) {
  const useStt = sttOn();
  const canRec = recorder.supported() && (S.settings.record || !useStt);
  host.innerHTML = `
    <div class="answer-area">
      <div class="live empty-live" id="live">${esc(useStt ? placeholder : canRec ? '마이크를 누르고 소리 내어 말해 보세요. 녹음해서 정답과 비교해 들을 수 있어요.' : '소리 내어 말한 뒤 정답을 확인하세요.')}</div>
      ${useStt || canRec ? `<div class="micwrap"><button type="button" class="mic" id="mic" aria-label="말하기 시작">🎙</button><div class="lbl" id="miclbl">눌러서 말하기</div></div>` : ''}
      <div class="alt-acts">
        <button type="button" class="btn sm ghost" id="b-type">Aa 입력하기</button>
        <button type="button" class="btn sm ghost" id="b-self">말했어요 · 정답 보기</button>
      </div>
      <div id="typebox" hidden style="margin-top:8px"><textarea id="ta" placeholder="영어로 입력" autocapitalize="sentences" autocomplete="off" spellcheck="false"></textarea><button type="button" class="btn primary block" id="b-sub" style="margin-top:8px">확인</button></div>
    </div>`;
  const live = $('#live', host), mic = $('#mic', host), lbl = $('#miclbl', host);
  let stopStt = null, recH = null, running = false, finished = false, text = '';
  const finish = async (said, how) => {
    if (finished) return; finished = true;
    let blob = null;
    if (recH) { try { blob = await recH.stop(); } catch (e) {} recH = null; if (blob) rec.put(key, blob).catch(() => {}); }
    onDone({ said: (said || '').trim(), how, blob });
  };
  const setLive = (fin, interim) => {
    live.classList.toggle('empty-live', !fin && !interim);
    live.innerHTML = fin || interim ? `${esc(fin)} <span class="interim">${esc(interim || '')}</span>` : '듣고 있어요… 말해 보세요';
  };
  const stopAll = () => { if (stopStt) { stopStt(); stopStt = null; } };
  if (mic) mic.onclick = async () => {
    if (running) {
      running = false; mic.classList.remove('on'); lbl.textContent = '정리하는 중…';
      if (useStt) stopAll(); else finish('', 'rec');
      return;
    }
    tts.cancel();
    running = true; mic.classList.add('on'); lbl.textContent = '말한 뒤 한 번 더 누르세요';
    if (canRec) { try { recH = await recorder.start(); } catch (e) { recH = null; if (!useStt) { running = false; mic.classList.remove('on'); lbl.textContent = '녹음 안 됨'; toast(micMessage(e), 4000); return; } } }
    if (useStt) {
      setLive('', '');
      stopStt = stt.start({
        continuous,
        onText: (f, i) => { text = f; setLive(f, i); },
        onEnd: (t) => { running = false; mic.classList.remove('on'); if (t) finish(t, 'stt'); else { lbl.textContent = '다시 눌러서 말하기'; live.classList.add('empty-live'); live.textContent = '못 알아들었어요. 다시 말하거나 입력해 주세요.'; if (recH) { recH.stop().then(b => { if (b) rec.put(key, b).catch(() => {}); }); recH = null; } } },
        onError: msg => { running = false; mic.classList.remove('on'); lbl.textContent = '음성 인식 안 됨'; live.classList.add('empty-live'); live.textContent = msg; }
      });
      if (!stopStt) { running = false; mic.classList.remove('on'); }
    } else {
      live.classList.remove('empty-live'); live.textContent = '● 녹음 중… 말한 뒤 마이크를 다시 누르세요';
    }
  };
  $('#b-type', host).onclick = () => { stopAll(); const tb = $('#typebox', host); tb.hidden = false; $('#ta', host).focus(); };
  $('#b-sub', host).onclick = () => { const v = $('#ta', host).value.trim(); if (!v) return $('#ta', host).focus(); finish(v, 'type'); };
  $('#ta', host).addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#b-sub', host).click(); } });
  $('#b-self', host).onclick = () => { stopAll(); finish(text, text ? 'stt' : 'self'); };
  return () => { finished = true; stt.abort(); if (recH) { recH.stop(); recH = null; } };
}

/* 노트 카드 펼침 (수업 원문·수정·설명·자연스럽게) */
function cardReveal(card, { showT = true } = {}) {
  return `<div class="panel reveal-box">
    <div class="nrow o"><div class="lab">수업 때</div>${card.o ? `<div class="en">${esc(card.o)}</div>` : `<div class="none">원문 녹취 없음</div>`}<div></div></div>
    <div class="nrow f"><div class="lab">${card.hasO || !card.o ? '수정' : '정답'}</div><div><div class="en">${esc(card.f)}</div>${showT ? `<div class="kr">${esc(card.t)}</div>` : ''}</div>${sayBtn(card.f)}</div>
    <div class="exp"><ul>${card.e.map(x => `<li>${safeRich(x)}</li>`).join('')}</ul></div>
    <div class="nrow n" style="margin-top:10px"><div class="lab">더 자연스럽게</div><div><div class="en">${esc(card.n)}</div><div class="kr">${esc(card.nk)}</div></div>${sayBtn(card.n)}</div>
    <div class="tags">${card.g.map(t => tagChip(t)).join('')}<span class="spacer"></span><a class="tag lv" href="#/card/${esc(card.id)}" target="_self">${esc(card.lesson.date)} · 카드 보기</a>${starBtn(card.id)}</div>
    <div id="recp"></div>
  </div>`;
}

/* ── 말하기 카드 ───────────────── */
function mountSpeak(el, item, done) {
  const c = item.card;
  el.innerHTML = `
    ${kindLine('🎙', '말하기', item, ` · ${esc(c.lesson.date)}`)}
    <div class="ctxbox">상황: <b>${esc(c.c)}</b></div>
    <div class="prompt">${esc(c.t)}</div>
    <div class="hint" id="hint"><button type="button" class="btn sm ghost" id="b-hint">💡 힌트</button></div>
    <div class="body" id="ans"></div>
    <div class="foot" id="foot"></div>`;
  $('#b-hint', el).onclick = () => {
    const tags = c.g.filter(t => t !== 'ok' && t !== 'asr');
    const first = c.f.split(/\s+/).slice(0, 2).join(' ');
    $('#hint', el).innerHTML = `${tags.length ? `조심할 점: <b>${tags.map(t => esc(TAGS[t])).join(' · ')}</b><br>` : '수업 때도 맞게 말한 문장이에요.<br>'}시작: <span class="en">${esc(first)} …</span>`;
  };
  const off = answerBox($('#ans', el), {
    key: item.key,
    onDone({ said, blob }) {
      const targets = [c.f, c.n];
      const r = said ? resultBox(said, targets, ['수정문', '자연스러운 표현']) : null;
      const sug = r ? suggestGrade(r.score) : -1;
      $('#hint', el).innerHTML = '';
      $('#ans', el).innerHTML = (r ? r.html : '') + cardReveal(c);
      $('#foot', el).innerHTML = `<p class="small muted" style="text-align:center;margin:0 0 6px">${r ? '추천 평가에 테두리가 있어요. 직접 골라 주세요.' : '얼마나 잘 말했나요?'}</p>` + gradeBar(item, sug);
      bindGrades($('#foot', el), done, said);
      recPlayer($('#recp', el), item.key, blob);
      if (S.settings.autoplay) speak(c.f);
      if (r && S.settings.sound) beep(r.score >= 0.8);
    }
  });
  return off;
}

/* ── 빈칸 ─────────────────── */
function mountCloze(el, item, done) {
  const c = item.card;
  const z = clozeOf(c);
  const bank = shuffle(clozeBank(c));
  const fill = Array(z.blanks.length).fill(null); // bank index
  let cur = 0, checked = false;
  el.innerHTML = `
    ${kindLine('🧩', '고친 부분 빈칸', item, ` · ${esc(c.lesson.date)}`)}
    <div class="ctxbox">상황: <b>${esc(c.c)}</b></div>
    <div class="kr" style="font-size:15.5px">${esc(c.t)}</div>
    <div class="cloze" id="cz"></div>
    <div class="small muted">보기를 눌러 빈칸을 순서대로 채우세요. 채운 칸을 누르면 지워져요. 보기에는 수업 때 내가 한 말(함정)도 섞여 있어요.</div>
    <div class="bank" id="bank"></div>
    <div class="body" id="after"></div>
    <div class="foot" id="foot"></div>`;
  const draw = () => {
    $('#cz', el).innerHTML = z.parts.map(p => p.raw != null ? esc(p.raw) : `${esc(p.lead)}<span class="blank${!checked && p.blank === cur ? ' cur' : ''}${checked ? (bank[fill[p.blank]] && bank[fill[p.blank]].keys === z.blanks[p.blank].keys ? ' right' : ' wrongf') : ''}" data-b="${p.blank}">${fill[p.blank] != null ? esc(bank[fill[p.blank]].text) : '&nbsp;'}</span>${esc(p.trail)}`).join(' ');
    $('#bank', el).innerHTML = bank.map((b, bi) => `<button type="button" data-bi="${bi}" class="${fill.includes(bi) ? 'used' : ''}${checked ? (b.correct ? ' ans' : b.extra ? '' : ' trap') : ''}" ${checked ? 'disabled' : ''}>${esc(b.text)}</button>`).join('');
  };
  const check = () => {
    checked = true;
    const right = z.blanks.every((b, i) => fill[i] != null && bank[fill[i]].keys === b.keys);
    draw();
    if (S.settings.sound) beep(right);
    const traps = bank.filter(b => !b.correct && !b.extra).map(b => b.text);
    $('#after', el).innerHTML = `<div class="result ${right ? 'good' : 'bad'}"><div class="score">${right ? '정답이에요' : '정답: ' + z.blanks.map(b => esc(b.answer)).join(' / ')}</div>${traps.length ? `<div class="small" style="margin-top:4px">빨간 보기는 수업 때 내가 한 말이에요: <span class="en" style="font-size:15px">${traps.map(esc).join(' / ')}</span></div>` : ''}</div>` + cardReveal(c);
    $('#foot', el).innerHTML = nextBtn();
    $('#next', el).onclick = () => done(right ? 2 : 0, { auto: true });
    if (S.settings.autoplay) speak(c.f);
  };
  el.addEventListener('click', e => {
    if (checked) return;
    const b = e.target.closest('[data-bi]');
    if (b) {
      const bi = +b.dataset.bi;
      if (fill.includes(bi)) { fill[fill.indexOf(bi)] = null; }
      else { fill[cur] = bi; }
      cur = fill.indexOf(null);
      draw();
      if (cur === -1) setTimeout(check, 250);
      return;
    }
    const bl = e.target.closest('[data-b]');
    if (bl) { const i = +bl.dataset.b; fill[i] = null; cur = i; draw(); }
  });
  draw();
  return () => {};
}

/* ── O/X ─────────────────── */
function mountFix(el, item, done) {
  const c = item.card;
  // 고친 문장이 있으면 반반 확률로 수업 원문(틀림) 또는 수정문(맞음). 맞는 문장(ok) 카드는 언제나 맞음
  const showWrong = c.hasO && !c.ok && Math.random() < 0.55;
  const sentence = showWrong ? c.o : (c.hasO && !c.ok ? c.f : c.o);
  const correct = !showWrong;
  el.innerHTML = `
    ${kindLine('⭕', '맞는 문장? 틀린 문장?', item, ` · ${esc(c.lesson.date)}`)}
    <div class="ctxbox">상황: <b>${esc(c.c)}</b></div>
    <div class="prompt en">${esc(sentence)}</div>
    <div class="small muted">이대로 말해도 자연스러운 영어일까요? (문장부호·대소문자는 빼고 판단)</div>
    <div class="ox"><button type="button" data-ox="1"><big>⭕</big>그대로 OK</button><button type="button" data-ox="0"><big>✕</big>고칠 데 있어요</button></div>
    <div class="body" id="after"></div>
    <div class="foot" id="foot"></div>`;
  let answered = false;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-ox]');
    if (!b || answered) return;
    answered = true;
    const pick = b.dataset.ox === '1';
    const right = pick === correct;
    b.classList.add(right ? 'pick-ok' : 'pick-bad');
    $$('[data-ox]', el).forEach(x => { x.disabled = true; });
    if (S.settings.sound) beep(right);
    $('#after', el).innerHTML = `<div class="result ${right ? 'good' : 'bad'}"><div class="score">${right ? '맞혔어요' : '아쉬워요'} · ${correct ? (showWrong ? '' : c.hasO && !c.ok ? '이건 고친 문장이에요.' : '수업 때도 맞게 말한 문장이에요.') : '이건 수업 때 내가 한 말이에요. 고칠 데가 있어요.'}</div></div>` + cardReveal(c);
    $('#foot', el).innerHTML = nextBtn();
    $('#next', el).onclick = () => done(right ? 2 : 0, { auto: true });
  });
  return () => {};
}

/* ── 따라 말하기 ───────────────── */
function mountShadow(el, item, done) {
  const c = item.card;
  const target = c.n;
  let hidden = !!S.settings.shadowHide;
  el.innerHTML = `
    ${kindLine('🔁', '듣고 따라 말하기', item, ` · ${esc(c.lesson.date)}`)}
    <div class="ctxbox">상황: <b>${esc(c.c)}</b></div>
    <div class="prompt en" id="tx">${hidden ? '<span class="muted small">(문장 가림 · 듣고 따라 하세요)</span>' : esc(target)}</div>
    <div class="kr" id="txk">${hidden ? '' : esc(c.nk)}</div>
    <div class="row wrap" style="margin:10px 0">
      <button type="button" class="btn sm" id="b-play">🔊 듣기</button>
      <button type="button" class="btn sm" id="b-slow">🐢 천천히</button>
      <button type="button" class="btn sm ghost" id="b-hide">${hidden ? '문장 보기' : '문장 가리기'}</button>
    </div>
    <div class="body" id="ans"></div>
    <div class="foot" id="foot"></div>`;
  const play = rate => speak(target, null, rate);
  $('#b-play', el).onclick = () => play();
  $('#b-slow', el).onclick = () => play(0.7);
  $('#b-hide', el).onclick = () => {
    hidden = !hidden; S.settings.shadowHide = hidden;
    $('#tx', el).innerHTML = hidden ? '<span class="muted small">(문장 가림 · 듣고 따라 하세요)</span>' : esc(target);
    $('#txk', el).textContent = hidden ? '' : c.nk;
    $('#b-hide', el).textContent = hidden ? '문장 보기' : '문장 가리기';
  };
  const t = setTimeout(() => play(), 350);
  const off = answerBox($('#ans', el), {
    key: item.key, placeholder: '들은 문장을 똑같이 따라 말해 보세요',
    onDone({ said, blob }) {
      const r = said ? resultBox(said, [target], ['자연스러운 표현']) : null;
      $('#tx', el).textContent = target; $('#txk', el).textContent = c.nk;
      $('#ans', el).innerHTML = (r ? r.html : '') + `<div id="recp"></div><div class="panel"><div class="nrow f"><div class="lab">수정</div><div><div class="en">${esc(c.f)}</div><div class="kr">${esc(c.t)}</div></div>${sayBtn(c.f)}</div></div>`;
      recPlayer($('#recp', el), item.key, blob);
      $('#foot', el).innerHTML = gradeBar(item, r ? suggestGrade(r.score) : -1);
      bindGrades($('#foot', el), done, said);
      if (r && S.settings.sound) beep(r.score >= 0.8);
    }
  });
  return () => { clearTimeout(t); off(); };
}

/* ── 발음 체크 ─────────────────── */
function mountPron(el, item, done) {
  const r = item.row;
  const targets = r.w.replace(/[()]/g, '').split(/\s*\/\s*/).filter(Boolean);
  const say = targets.join(', ');
  const p = S.pron[r.w];
  let tries = 0, success = false;
  el.innerHTML = `
    ${kindLine('👄', '발음 체크 · ' + r.group, item)}
    <div class="bigword">${esc(say)}</div>
    <div class="heard">수업 녹취에서는 <b>${esc(r.heard.join(', '))}</b>(으)로 인식됐어요 · ${esc(r.d.join(', '))}</div>
    ${p ? `<div class="heard small" style="margin-top:4px">지금까지 ${p.ok}/${p.n}번 성공</div>` : ''}
    <div class="row" style="justify-content:center;gap:8px;margin:12px 0">
      <button type="button" class="btn sm" id="b-play">🔊 듣기</button>
      <button type="button" class="btn sm" id="b-slow">🐢 천천히</button>
      ${r.heard[0] && /^[A-Za-z' ]+$/.test(r.heard[0]) ? `<button type="button" class="btn sm ghost" id="b-wrong">🔊 ${esc(r.heard[0])}</button>` : ''}
    </div>
    ${r.tip ? `<div class="panel small" style="margin:6px 0">${esc(r.tip)}</div>` : ''}
    <div class="body" id="ans"></div>
    <div class="foot" id="foot"></div>`;
  $('#b-play', el).onclick = () => speak(say);
  $('#b-slow', el).onclick = () => speak(say, null, 0.6);
  const bw = $('#b-wrong', el); if (bw) bw.onclick = () => speak(r.heard[0]);
  const ans = $('#ans', el), foot = $('#foot', el);
  const finishAuto = () => {
    const g = success ? (tries === 1 ? 2 : 1) : 0;
    foot.innerHTML = nextBtn();
    $('#next', el).onclick = () => done(g, { auto: true });
  };
  if (!sttOn()) {
    ans.innerHTML = `<div class="panel small">음성 인식을 쓸 수 없어서 자동 확인은 안 돼요. 들어 보고 따라 말한 뒤 스스로 평가해 주세요.</div>`;
    foot.innerHTML = gradeBar(item, -1);
    bindGrades(foot, done, '');
    return () => {};
  }
  ans.innerHTML = `<div class="micwrap"><button type="button" class="mic" id="mic" aria-label="말하기">🎙</button><div class="lbl" id="lbl">눌러서 한 번 말하기 (3번까지)</div></div><div id="res"></div>`;
  const mic = $('#mic', el), lbl = $('#lbl', el), res = $('#res', el);
  let stop = null;
  mic.onclick = () => {
    if (stop) { stop(); return; }
    tts.cancel();
    mic.classList.add('on'); lbl.textContent = '듣고 있어요…';
    stop = stt.start({
      continuous: false, alts: 5,
      onEnd: (text, alts) => {
        stop = null; mic.classList.remove('on');
        if (!text) { lbl.textContent = '못 들었어요. 다시 눌러 말해 주세요'; return; }
        tries++;
        const ok = targets.every(t => heardWord(t, alts.length ? alts : [text]));
        recordPron(r.w, ok, text);
        if (S.settings.sound) beep(ok);
        res.insertAdjacentHTML('beforeend', `<div class="result ${ok ? 'good' : 'bad'}"><b>${tries}번째:</b> ${ok ? '✓ 제대로 알아들었어요' : '✕ 다르게 들렸어요'} — <span class="en">${esc(text)}</span></div>`);
        if (ok) success = true;
        if (ok || tries >= 3) { mic.disabled = true; lbl.textContent = ok ? '성공!' : '3번 다 했어요. 들어 보고 다음에 다시 해요'; finishAuto(); }
        else lbl.textContent = `다시 말해 보세요 (${tries}/3)`;
      },
      onError: msg => { stop = null; mic.classList.remove('on'); lbl.textContent = msg; foot.innerHTML = gradeBar(item, -1); bindGrades(foot, done, ''); }
    });
    if (!stop) mic.classList.remove('on');
  };
  return () => { stt.abort(); };
}

/* ── 소리 구분 ─────────────────── */
function mountPair(el, item, done) {
  const [a, b, kind] = item.pair;
  const pick = Math.random() < 0.5 ? a : b;
  const opts = shuffle([a, b]);
  el.innerHTML = `
    ${kindLine('👂', '소리 구분 · ' + kind, item)}
    <div class="prompt" style="text-align:center">어느 쪽을 읽었을까요?</div>
    <div class="listen-big"><button type="button" id="b-play" aria-label="다시 듣기">🔊</button></div>
    <div class="row" style="justify-content:center;gap:8px"><button type="button" class="btn sm ghost" id="b-slow">🐢 천천히</button></div>
    <div class="choices">${opts.map(o => `<button type="button" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>
    <div class="body" id="after"></div>
    <div class="foot" id="foot"></div>`;
  const play = rate => speak(pick, null, rate || 0.85);
  $('#b-play', el).onclick = () => play();
  $('#b-slow', el).onclick = () => play(0.6);
  const t = setTimeout(() => play(), 400);
  let answered = false;
  el.addEventListener('click', e => {
    const bt = e.target.closest('[data-o]');
    if (!bt || answered) return;
    answered = true;
    const right = bt.dataset.o === pick;
    $$('[data-o]', el).forEach(x => { x.disabled = true; if (x.dataset.o === pick) x.classList.add('right'); else if (x === bt) x.classList.add('wrongc'); });
    if (S.settings.sound) beep(right);
    $('#after', el).innerHTML = `<div class="result ${right ? 'good' : 'bad'}"><div class="score">${right ? '맞혔어요' : '정답은 ' + esc(pick)}</div>
      <div class="row" style="margin-top:8px;gap:14px"><span class="en">${esc(a)}</span>${sayBtn(a)}<span class="en">${esc(b)}</span>${sayBtn(b)}</div>
      <div class="small muted" style="margin-top:6px">두 단어를 번갈아 들어 보고 직접 소리 내 보세요.</div></div>`;
    $('#foot', el).innerHTML = nextBtn();
    $('#next', el).onclick = () => done(right ? 2 : 0, { auto: true });
  });
  return () => clearTimeout(t);
}

/* ── 바로 쓸 표현 ───────────────── */
function mountPhrase(el, item, done) {
  const p = item.phrase;
  el.innerHTML = `
    ${kindLine('💬', '표현 · ' + p.group, item)}
    <div class="prompt">${esc(p.kr)}</div>
    <div class="hint">영어로 바로 떠올려 말해 보세요.</div>
    <div class="body" id="ans"></div>
    <div class="foot" id="foot"></div>`;
  const off = answerBox($('#ans', el), {
    key: item.key,
    onDone({ said, blob }) {
      const r = said ? resultBox(said, [p.en], ['표현']) : null;
      $('#ans', el).innerHTML = (r ? r.html : '') + `<div class="phr"><div class="tx"><div class="en">${esc(p.en)}</div><div class="kr">${esc(p.kr)}</div></div>${sayBtn(p.en)}</div><div id="recp"></div>`;
      recPlayer($('#recp', el), item.key, blob);
      $('#foot', el).innerHTML = gradeBar(item, r ? suggestGrade(r.score) : -1);
      bindGrades($('#foot', el), done, said);
      if (S.settings.autoplay) speak(p.en);
    }
  });
  return off;
}

/* ── 패턴 퀴즈 ─────────────────── */
function mountPattern(el, item, done) {
  const p = item.pattern;
  // 예문 속 한국어 괄호(상황 설명)는 보기에서 빼서 따로 보여 준다 — 보기만 보고 답이 드러나지 않게
  const KO = /\s*\(([^)]*[가-힣][^)]*)\)\s*/g;
  const ctx = [...p.bad.matchAll(KO), ...p.good.matchAll(KO)].map(m => m[1]);
  const clean = s => s.replace(KO, ' ').trim();
  const opts = shuffle([{ t: clean(p.good), ok: true }, { t: clean(p.bad), ok: false }]);
  el.innerHTML = `
    ${kindLine('🚩', '실수 패턴 · ' + p.h, item)}
    <div class="prompt">어느 쪽이 맞을까요?</div>
    <div class="small muted">${esc(p.d)} 수업에서 나온 예문이에요.${ctx.length ? ` 상황: <b>${esc([...new Set(ctx)].join(' · '))}</b>` : ''}</div>
    <div class="choices">${opts.map((o, i) => `<button type="button" data-i="${i}">${esc(o.t)}</button>`).join('')}</div>
    <div class="body" id="after"></div>
    <div class="foot" id="foot"></div>`;
  let answered = false;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (!b || answered) return;
    answered = true;
    const o = opts[+b.dataset.i];
    $$('[data-i]', el).forEach(x => { x.disabled = true; const oo = opts[+x.dataset.i]; if (oo.ok) x.classList.add('right'); else if (x === b) x.classList.add('wrongc'); });
    if (S.settings.sound) beep(o.ok);
    $('#after', el).innerHTML = `<div class="result ${o.ok ? 'good' : 'bad'}"><div class="score">${o.ok ? '맞혔어요' : '아쉬워요'}</div></div>
      <div class="mist"><h3>${esc(p.h)}</h3><p>${safeRich(p.p)}</p><div class="ex"><span class="d">${esc(p.d)}</span><div class="en bad">${esc(p.bad)}</div><div class="en good">${esc(p.good)} ${sayBtn(p.good)}</div></div>
      <div class="cact"><a class="btn sm" href="#/note?t=les&tag=${p.k}">이 유형 문장 보기</a></div></div>`;
    $('#foot', el).innerHTML = nextBtn();
    $('#next', el).onclick = () => done(o.ok ? 2 : 0, { auto: true });
  });
  return () => {};
}

export const MOUNT = { speak: mountSpeak, cloze: mountCloze, fix: mountFix, shadow: mountShadow, pron: mountPron, pair: mountPair, phrase: mountPhrase, pattern: mountPattern };
