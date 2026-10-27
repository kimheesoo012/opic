// 풀이 화면: 문제 표시 → 응답 → 즉시 해설(또는 끝에 일괄) → 오답 원인 → 다음
import { h, on, toast, sheet, closeSheet, icons } from './ui.js';
import { questionsOf, targetSec, conceptName } from './bank.js';
import { currentItem, makeAttempt, applyAttempt, reviewStepResult, reviewAdvance, summarize, totalQuestions } from './sessions.js';
import { STAGES } from './review.js';
import { CAUSES } from './stats.js';
import { LETTERS, fmtSec, PART_NAMES } from './util.js';

let C;
const P = { unitKey: null, phase: 'answer', chosen: null, startT: 0, audioEndT: 0, ctl: null, line: -1, played: 0, showScript: false, previewLeft: 0, tick: null, lastTick: 0 };

export const TTS_NOTE = '※ 기기 내장 음성 합성(TTS)이라 실제 시험 녹음과 속도·억양·연음이 다릅니다.';

export function initPlayer(ctx) { C = ctx; }

function env() { return { bank: C.bank, state: C.state, rng: C.rng, now: Date.now() }; }
const S = () => C.state.active;
const isLC = (u) => u.part <= 4;
export const ttsOK = () => C.tts.supported && C.tts.hasEnglish();

export function startSession(s) {
  if (!s) { toast('조건에 맞는 문제가 부족합니다.'); return; }
  C.state.active = s;
  C.save(['active']);
  resetUnit();
  C.go('play');
}

function resetUnit() {
  stopAudio();
  P.unitKey = null;
  P.chosen = null;
  P.played = 0;
  P.showScript = false;
}

export function leavePlayer() {
  stopAudio();
  clearInterval(P.tick);
  P.tick = null;
  P.unitKey = null;
}

function stopAudio() {
  if (P.ctl) C.tts.stop();
  P.ctl = null;
  P.line = -1;
}

// ---------- 음성 ----------
function audioLines(unit) {
  const voices = C.tts.assign(unit.speakers || { N: { g: 'f', accent: 'US' } }, C.state.settings.voices || {});
  if (unit.part === 1) return unit.choices.map((c, i) => ({ text: `${LETTERS[i]}. ${c}`, voice: voices.N, pause: 800 }));
  if (unit.part === 2) {
    return [{ text: unit.question, voice: voices.Q, pause: 1000 },
      ...unit.choices.map((c, i) => ({ text: `${LETTERS[i]}. ${c}`, voice: voices.A, pause: 800 }))];
  }
  return unit.script.map((l) => ({ text: l.t, voice: voices[l.s], pause: 350 }));
}

function playUnit(unit, onlyLine = null) {
  if (!ttsOK()) return;
  stopAudio();
  const all = audioLines(unit);
  const lines = onlyLine == null ? all : [all[onlyLine]];
  P.played++;
  P.ctl = C.tts.play(lines, {
    rate: C.state.settings.rate || 1,
    onLine: (i) => { P.line = onlyLine == null ? i : onlyLine; markLine(); },
    onEnd: () => { P.ctl = null; P.line = -1; if (onlyLine == null) P.audioEndT = Date.now(); markLine(); updatePlayBtn(); },
  });
  updatePlayBtn();
}

function markLine() {
  document.querySelectorAll('.script .ln').forEach((el) => el.classList.toggle('on', Number(el.dataset.i) === P.line));
}
function updatePlayBtn() {
  const b = document.querySelector('[data-act="audio"]');
  if (!b) return;
  const s = S();
  const playing = !!P.ctl;
  b.innerHTML = playing ? `${icons.stop}<span>정지</span>` : `${icons.play}<span>${P.played ? '다시 듣기' : '듣기'}</span>`;
  b.disabled = !playing && s && s.feedback === 'end' && P.played >= 1 && !answered(s);
}

function answered(s) {
  const it = currentItem(s);
  if (!it || it.type !== 'unit') return false;
  const unit = C.bank.unitById.get(it.unitId);
  const q = questionsOf(unit)[s.qIdx];
  return !!s.answers[q.id];
}

// ---------- 타이머 ----------
function startTick() {
  clearInterval(P.tick);
  P.lastTick = Date.now();
  P.tick = setInterval(onTick, 1000);
}

function onTick() {
  const s = S();
  if (!s || C.route !== 'play') { clearInterval(P.tick); P.tick = null; return; }
  const now = Date.now();
  const dt = Math.min(5, (now - P.lastTick) / 1000);
  P.lastTick = now;
  if (document.hidden) return;
  s.elapsed += dt;
  const it = currentItem(s);
  const unit = it && it.type === 'unit' ? C.bank.unitById.get(it.unitId) : null;
  if (unit && !isLC(unit) && P.phase !== 'feedback') s.rcElapsed += dt;
  if (P.phase === 'preview') {
    P.previewLeft -= dt;
    const el = document.querySelector('[data-preview-left]');
    if (el) el.textContent = Math.max(0, Math.ceil(P.previewLeft));
    if (P.previewLeft <= 0) { P.phase = 'answer'; render(); playUnit(unit); return; }
  }
  if (s.limitSec && s.rcElapsed >= s.limitSec && unit && !isLC(unit)) {
    s.timeUp = true;
    toast('RC 제한 시간이 끝났습니다. 남은 문항은 미응답으로 처리됩니다.', 3500);
    finish();
    return;
  }
  updateTimer();
  if (Math.round(s.elapsed) % 10 === 0) C.save(['active']);
}

function timerText() {
  const s = S();
  const it = currentItem(s);
  const unit = it && it.type === 'unit' ? C.bank.unitById.get(it.unitId) : null;
  if (unit && (it.timed || s.perQ) && P.phase === 'answer') {
    const q = questionsOf(unit)[s.qIdx];
    const lim = it.timed || targetSec(C.bank, q, unit);
    const left = lim - (Date.now() - P.startT) / 1000;
    return { text: left >= 0 ? fmtSec(left) : `+${fmtSec(-left)}`, warn: left < 5 };
  }
  if (s.limitSec && unit && !isLC(unit)) {
    const left = s.limitSec - s.rcElapsed;
    return { text: fmtSec(left), warn: left < 60 };
  }
  return { text: fmtSec(s.elapsed), warn: false };
}
function updateTimer() {
  const el = document.querySelector('.timer');
  if (!el) return;
  const t = timerText();
  el.textContent = t.text;
  el.classList.toggle('warn', t.warn);
}

// ---------- 렌더 ----------
export function render() {
  const root = document.getElementById('app');
  const s = S();
  if (!s) { C.go('home'); return; }
  const it = currentItem(s);
  if (!it) { finish(); return; }
  if (!P.tick) startTick();
  if (it.type === 'concept') { root.innerHTML = renderConcept(s, it); return; }
  const unit = C.bank.unitById.get(it.unitId);
  if (!unit) { s.cur++; s.qIdx = 0; render(); return; }
  const qs = questionsOf(unit);
  if (s.qIdx >= qs.length) s.qIdx = 0;
  const q = qs[s.qIdx];
  const key = `${s.id}:${s.cur}`;
  const newUnit = P.unitKey !== key;
  if (newUnit) {
    resetUnit();
    P.unitKey = key;
    const anyAnswered = qs.some((x) => s.answers[x.id]);
    if (isLC(unit) && ttsOK() && unit.part >= 3 && C.state.settings.preview && !anyAnswered) {
      P.phase = 'preview';
      P.previewLeft = 12;
    } else P.phase = 'answer';
  }
  const ans = s.answers[q.id];
  if (ans && s.feedback === 'immediate') P.phase = 'feedback';
  else if (P.phase === 'feedback') P.phase = 'answer';
  if (P.phase === 'answer' && (newUnit || P.qKey !== q.id)) { P.startT = Date.now(); P.chosen = ans ? ans.choice : null; }
  P.qKey = q.id;
  root.innerHTML = renderUnit(s, it, unit, q, qs);
  const main = root.querySelector('.sess-main');
  if (main && P.phase === 'feedback' && P.scrollToExp) {
    const ex = root.querySelector('.exp');
    if (ex) main.scrollTop += ex.getBoundingClientRect().top - main.getBoundingClientRect().top - 8;
    P.scrollToExp = false;
  }
  if (newUnit && isLC(unit) && ttsOK() && P.phase === 'answer' && C.state.settings.autoplay !== false && !ans) playUnit(unit);
  updatePlayBtn();
  markLine();
}

function topBar(s) {
  const total = totalQuestions(s, C.bank);
  const done = Object.keys(s.answers).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const t = timerText();
  return `<div class="sess-top">
    <button class="icon-btn" data-act="exitAsk" aria-label="나가기">${icons.close}</button>
    <div class="prog"><div class="xs muted">${h(s.title)} · ${done}/${total || '–'}</div><div class="bar"><i style="width:${pct}%"></i></div></div>
    <div class="timer ${t.warn ? 'warn' : ''}" aria-live="off">${t.text}</div>
  </div>`;
}

function renderConcept(s, it) {
  const c = C.bank.conceptById.get(it.concept) || { name: it.concept, summary: '' };
  const card = C.state.reviews[it.concept];
  return `<div class="sess">${topBar(s)}
    <div class="sess-main">
      <div class="qhead"><span class="tag accent">복습 1단계 · 핵심 개념</span></div>
      ${stageDots(card ? card.stage : 1)}
      <div class="concept-card" style="margin-top:12px"><h3>${h(c.name)}</h3><p>${h(c.summary)}</p></div>
      <p class="small muted">다음 단계: 같은 개념의 쉬운 문제 → 비슷한 선택지가 섞인 어려운 문제 → 제한 시간 문제 → 1·3·7일 뒤 새 문제</p>
    </div>
    <div class="sess-foot"><button class="btn primary block" data-act="conceptOk">개념 확인했어요</button></div></div>`;
}

export function stageDots(stage) {
  let d = '';
  for (let i = 1; i <= 7; i++) d += `<i class="${i <= stage ? 'on' : ''}" title="${STAGES[i].label}"></i>`;
  return `<div class="row xs muted"><div class="stage-dots">${d}</div><span>${h(STAGES[Math.min(stage, 8)].label)}</span></div>`;
}

function linkVocab(text, vocab) {
  let out = h(text);
  if (!vocab || !vocab.length) return out;
  const words = vocab.map((v) => v.w).filter((w) => w && w.length > 2).sort((a, b) => b.length - a.length);
  for (const w of words) {
    const re = new RegExp(`(^|[^A-Za-z>])(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^A-Za-z<]|$)`, 'i');
    out = out.replace(re, (m, pre, word) => `${pre}<button class="w" data-act="word" data-w="${h(w)}">${word}</button>`);
  }
  return out;
}

function allVocab(unit) {
  return questionsOf(unit).flatMap((q) => q.vocab || []);
}

function passageHtml(unit, q, showVocab) {
  const vocab = showVocab ? allVocab(unit) : null;
  return (unit.passages || []).map((p) => {
    let t = linkVocab(p.text, vocab);
    t = t.replace(/\{\{(\d)\}\}/g, (m, n) => `<span class="bk ${Number(n) === q.blank ? 'on' : ''}">(${n})</span>`);
    t = t.replace(/— \[(\d)\] —/g, (m, n) => `<span class="mk">[${n}]</span>`);
    let table = '';
    if (p.table) {
      table = `<table><thead><tr>${p.table.header.map((x) => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${p.table.rows.map((r) => `<tr>${r.map((x) => `<td>${h(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    return `<div class="passage"><div class="ptitle">${h(p.title || p.kind || '')}</div>${t}${table}</div>`;
  }).join('');
}

function graphicHtml(g) {
  if (!g) return '';
  return `<div class="graphic"><div class="gt">${h(g.title || '')}</div><table class="t"><thead><tr>${g.header.map((x) => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${g.rows.map((r) => `<tr>${r.map((x) => `<td>${h(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function scriptLines(unit) {
  if (unit.part === 1) return unit.choices.map((c, i) => ({ s: `(${LETTERS[i]})`, t: c }));
  if (unit.part === 2) return [{ s: 'Q', t: unit.question }, ...unit.choices.map((c, i) => ({ s: `(${LETTERS[i]})`, t: c }))];
  return unit.script.map((l) => ({ s: l.s, t: l.t }));
}

export function scriptHtml(unit, { lineButtons = true, masked = false } = {}) {
  return `<div class="script">${scriptLines(unit).map((l, i) => `<div class="ln" data-i="${i}">
    <span class="sp">${h(l.s)}</span><span class="tx ${masked ? 'masked' : ''}">${h(l.t)}</span>
    ${lineButtons && ttsOK() ? `<button class="play1" data-act="playLine" data-i="${i}" aria-label="이 문장 듣기">▶</button>` : ''}</div>`).join('')}</div>`;
}

function renderUnit(s, it, unit, q, qs) {
  const fb = P.phase === 'feedback';
  const ans = s.answers[q.id];
  const lc = isLC(unit);
  const fallback = lc && !ttsOK();
  let main = '';
  const head = [`Part ${unit.part} ${PART_NAMES[unit.part]}`];
  if (qs.length > 1) head.push(`${s.qIdx + 1}/${qs.length}번`);
  if (it.focus) head.push(`복습 ${it.stage}단계 · ${STAGES[it.stage].label}${it.isNew === false ? ' (같은 문제 재풀이)' : ''}`);
  main += `<div class="qhead">${head.map((x, i) => `<span class="tag ${i === 2 ? 'accent' : ''}">${h(x)}</span>`).join('')}${unit.part >= 5 && !lc ? `<span class="target-time">목표 ${targetSec(C.bank, q, unit)}초</span>` : ''}</div>`;
  if (lc) {
    main += `<p class="tts-note">${TTS_NOTE}</p>`;
    if (fallback) {
      main += `<div class="notice">이 기기에서는 영어 음성 합성을 쓸 수 없어 스크립트를 보며 진행합니다.</div>`;
    } else {
      const rates = [0.8, 1, 1.2].map((r) => `<button data-act="rate" data-r="${r}" aria-pressed="${(C.state.settings.rate || 1) === r}">${r.toFixed(1)}x</button>`).join('');
      const canScript = s.feedback === 'immediate' || fb;
      main += `<div class="player"><button class="btn sm" data-act="audio">${icons.play}<span>듣기</span></button><div class="seg">${rates}</div>
        ${canScript && unit.part >= 3 ? `<button class="btn sm ghost" data-act="toggleScript">${P.showScript ? '스크립트 가리기' : '스크립트 보기'}</button>` : ''}</div>`;
    }
  }
  if (unit.part === 1) main += `<div class="photo" role="img" aria-label="${fb ? h(unit.image.alt) : '사진 묘사 문제 그림'}">${unit.image.svg}</div>`;
  if (unit.graphic) main += graphicHtml(unit.graphic);
  if (P.phase === 'preview') {
    main += `<div class="card"><div class="row between"><b>문제 먼저 읽기</b><span class="tag accent"><span data-preview-left>${Math.ceil(P.previewLeft)}</span>초 뒤 재생</span></div>
      ${qs.map((x, i) => `<p class="small"><b>${i + 1}.</b> ${h(x.question)}<br><span class="muted">${x.choices.map((c, j) => `(${LETTERS[j]}) ${h(c)}`).join(' &nbsp;')}</span></p>`).join('')}</div>`;
    return `<div class="sess">${topBar(s)}<div class="sess-main">${main}</div><div class="sess-foot"><button class="btn primary block" data-act="previewSkip">${icons.play}<span>바로 듣기</span></button></div></div>`;
  }
  if (lc && unit.part >= 3 && (fallback || P.showScript || fb)) main += scriptHtml(unit);
  else if (lc && unit.part <= 2 && fb) main += scriptHtml(unit);
  if (fallback && unit.part === 2 && !fb) main += `<div class="qtext"><b>Q.</b> ${h(unit.question)}</div>`;
  if (unit.part >= 6) main += passageHtml(unit, q, fb);
  let foot = '';
  let qline = '';
  if (unit.part === 5) main += `<div class="qtext">${fb ? linkVocab(q.question, q.vocab).replace(/-{7}/, '<span class="blank"></span>') : h(q.question).replace(/-{7}/, '<span class="blank"></span>')}</div>`;
  if (unit.part >= 3 && unit.part !== 5 && unit.part !== 6) qline = `<div class="qtext" style="font-size:16px"><b>${s.qIdx + 1}.</b> ${h(q.question)}</div>`;
  if (unit.part === 6) qline = `<div class="xs muted">빈칸 (${q.blank})에 알맞은 것${q.type === 'insert' ? ' — 문장 삽입' : ''}</div>`;
  if (unit.part === 7 && q.type === 'insert') qline += `<div class="card small">“${h(q.sentence)}”</div>`;
  const lettersOnly = lc && !fallback && unit.part <= 2;
  const choiceBtns = q.choices.map((c, i) => {
    let cls = 'choice';
    if (fb) { if (i === q.answer) cls += ' right'; else if (ans && ans.choice === i) cls += ' wrong'; }
    else if (P.chosen === i) cls += ' sel';
    return `<button class="${cls}" data-act="choose" data-i="${i}" ${fb ? 'aria-disabled="true"' : ''}><span class="L">${LETTERS[i]}</span>${lettersOnly ? `<span>${LETTERS[i]}</span>` : `<span>${h(c)}</span>`}</button>`;
  }).join('');
  foot += qline + `<div class="choices ${lettersOnly ? `letters ${q.choices.length === 3 ? 'three' : ''}` : ''}">${choiceBtns}</div>`;
  if (fb) {
    main += explainHtml(q, unit, ans, { causeFor: lastAttempt(s, q) });
    foot += `<div class="foot-actions"><button class="btn primary" data-act="next">${isLast(s, qs) ? '결과 보기' : '다음'}</button></div>`;
  } else if (s.feedback === 'end') {
    foot += `<div class="foot-actions"><button class="btn primary" data-act="next" ${P.chosen == null ? 'disabled' : ''}>${isLast(s, qs) ? '제출하고 결과 보기' : '다음'}</button></div>`;
  }
  return `<div class="sess">${topBar(s)}<div class="sess-main">${main}</div><div class="sess-foot">${foot}</div></div>`;
}

function isLast(s, qs) {
  return s.qIdx >= qs.length - 1 && s.cur >= s.items.length - 1 && s.kind !== 'review';
}

function lastAttempt(s, q) {
  const id = s.attemptIds && s.attemptIds[q.id];
  return id ? C.state.attempts.find((a) => a.id === id) : null;
}

export function explainHtml(q, unit, ans, { causeFor = null } = {}) {
  const ok = ans && ans.choice === q.answer;
  const tgt = targetSec(C.bank, q, unit);
  const ex = q.explanation;
  let out = `<div class="exp">`;
  if (ans) {
    out += `<div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? '정답' : '오답'} <span class="small muted" style="font-weight:400">정답 ${LETTERS[q.answer]}${ok ? '' : ` · 내 답 ${LETTERS[ans.choice]}`}${ans.sec && unit.part >= 5 ? ` · ${Math.round(ans.sec)}초 (목표 ${tgt}초)` : ''}</span></div>`;
  } else out += `<div class="verdict bad">미응답 <span class="small muted" style="font-weight:400">정답 ${LETTERS[q.answer]}</span></div>`;
  out += `<div class="xs muted">${h(conceptName(C.bank, q.concept))}${q.tags && q.tags.includes('trap') ? ' · 고난도 함정' : ''}</div>`;
  out += `<p class="why">${h(ex.why)}</p><ul class="traps">`;
  q.choices.forEach((c, i) => {
    out += `<li><b class="${i === q.answer ? 'done-mark' : ''}">${LETTERS[i]}${i === q.answer ? ' ✓' : ''}</b>${h(c)}${i !== q.answer ? `<div class="small muted">${h(ex.traps[i])}</div>` : ''}</li>`;
  });
  out += `</ul>`;
  if (unit.part === 1 && unit.image) out += `<p class="small muted">장면: ${h(unit.image.alt)}</p>`;
  if (q.para && q.para.length) {
    out += `<div class="para"><b>패러프레이즈</b>${q.para.map((p) => `<div>지문: ${h(p.p)}<br>→ 정답: ${h(p.a)}</div>`).join('')}</div>`;
  }
  const vocab = q.vocab || (unit.questions ? questionsOf(unit)[0].vocab : null) || [];
  if (vocab.length) out += `<div class="vocab-row">${vocab.map((v) => `<button class="chip" data-act="word" data-w="${h(v.w)}">${h(v.w)}</button>`).join('')}</div>`;
  if (causeFor && !causeFor.correct) {
    out += `<div class="causes"><div class="small"><b>오답 원인</b> <span class="muted">(탭 한 번)</span></div><div class="chips">${CAUSES.map((c) => `<button class="chip" data-act="cause" data-aid="${causeFor.id}" data-c="${c.id}" aria-pressed="${causeFor.cause === c.id}">${c.label}</button>`).join('')}</div></div>`;
  }
  out += `</div>`;
  return out;
}

// ---------- 동작 ----------
function curRefs() {
  const s = S();
  const it = currentItem(s);
  const unit = C.bank.unitById.get(it.unitId);
  const qs = questionsOf(unit);
  return { s, it, unit, qs, q: qs[s.qIdx] };
}

function record(choice) {
  const { s, unit, q } = curRefs();
  const now = Date.now();
  const from = isLC(unit) && P.audioEndT > P.startT ? P.audioEndT : P.startT;
  const sec = Math.max(0.5, (now - from) / 1000);
  s.answers[q.id] = { choice, sec, at: now };
  const a = makeAttempt(s, unit, q, choice, sec, env());
  (s.attemptIds ||= {})[q.id] = a.id;
  C.store.putAttempt(a);
  applyAttempt(a, env());
  C.save(['active', 'reviews', 'wrongNote', 'studyLog']);
  return a;
}

on('choose', (el) => {
  const s = S();
  if (!s || P.phase !== 'answer') return;
  const i = Number(el.dataset.i);
  if (s.feedback === 'end') {
    P.chosen = i;
    document.querySelectorAll('.choice').forEach((b) => b.classList.toggle('sel', Number(b.dataset.i) === i));
    const nb = document.querySelector('[data-act="next"]');
    if (nb) nb.disabled = false;
    return;
  }
  stopAudio();
  record(i);
  P.phase = 'feedback';
  P.scrollToExp = true;
  render();
});

on('next', () => {
  const s = S();
  if (!s) return;
  const { it, qs, q } = curRefs();
  if (s.feedback === 'end' && !s.answers[q.id]) {
    if (P.chosen == null) return;
    record(P.chosen);
  }
  P.chosen = null;
  if (s.qIdx < qs.length - 1) {
    s.qIdx++;
  } else {
    stopAudio();
    if (s.kind === 'review' && it.focus) {
      const ok = reviewStepResult(s, it, env());
      toast(ok ? '통과 — 다음 단계로' : '한 번 더 — 이전 단계로 돌아갑니다');
      C.save(['reviews']);
    }
    s.cur++;
    s.qIdx = 0;
    if (s.kind === 'review' && s.cur >= s.items.length) reviewAdvance(s, env());
  }
  C.save(['active']);
  if (s.cur >= s.items.length) { finish(); return; }
  render();
  const m = document.querySelector('.sess-main');
  if (m) m.scrollTop = 0;
});

on('conceptOk', () => {
  const s = S();
  const it = currentItem(s);
  reviewStepResult(s, it, env());
  s.cur++;
  s.qIdx = 0;
  if (s.cur >= s.items.length) reviewAdvance(s, env());
  C.save(['active', 'reviews']);
  if (s.cur >= s.items.length) finish(); else render();
});

on('cause', (el) => {
  const a = C.state.attempts.find((x) => x.id === el.dataset.aid);
  if (!a) return;
  a.cause = a.cause === el.dataset.c ? null : el.dataset.c;
  C.store.putAttempt(a);
  const w = C.state.wrongNote[a.qid];
  if (w) { w.cause = a.cause; C.save(['wrongNote']); }
  el.parentElement.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.c === a.cause)));
});

on('audio', () => {
  const s = S();
  if (P.ctl) { stopAudio(); updatePlayBtn(); return; }
  const it = currentItem(s);
  playUnit(C.bank.unitById.get(it.unitId));
});
on('playLine', (el) => {
  const s = S();
  if (C.route === 'play' && s) {
    const it = currentItem(s);
    playUnit(C.bank.unitById.get(it.unitId), Number(el.dataset.i));
  } else if (C.trainUnit) {
    playUnit(C.trainUnit, Number(el.dataset.i));
  }
});
export function playTrainUnit(unit, line = null) { playUnit(unit, line); }
export function stopTrainAudio() { stopAudio(); }

on('rate', (el) => {
  C.state.settings.rate = Number(el.dataset.r);
  C.save(['settings']);
  document.querySelectorAll('[data-act="rate"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
});
on('toggleScript', () => { P.showScript = !P.showScript; render(); });
on('previewSkip', () => {
  const { unit } = curRefs();
  P.phase = 'answer';
  P.startT = Date.now();
  render();
  playUnit(unit);
});

on('exitAsk', () => {
  sheet(`<h3>잠시 나갈까요?</h3><p class="muted small">지금까지 푼 문제는 저장되어 있고, 홈에서 이어서 풀 수 있습니다.</p>
    <div class="stack"><button class="btn primary block" data-act="exitKeep">나가기 (이어서 풀기 가능)</button>
    <button class="btn block" data-act="exitFinish">여기서 끝내고 결과 보기</button>
    <button class="btn ghost block" data-act="closeSheet">계속 풀기</button></div>`);
});
on('exitKeep', () => { closeSheet(); leavePlayer(); C.save(['active']); C.go('home'); });
on('exitFinish', () => { closeSheet(); finish(); });

export function finish() {
  const s = S();
  leavePlayer();
  if (!s) { C.go('home'); return; }
  s.done = true;
  const sum = summarize(s, C.bank);
  C.state.sessions.push({ id: s.id, kind: s.kind, title: s.title, start: s.createdAt, end: Date.now(), n: sum.n, correct: sum.correct, sec: Math.round(sum.sec) });
  if (C.state.sessions.length > 300) C.state.sessions.splice(0, C.state.sessions.length - 300);
  C.lastSession = s;
  C.state.active = null;
  try { sessionStorage.setItem('tt-last', JSON.stringify(s)); } catch { /* 무시 */ }
  C.snapshotScore();
  C.save(['active', 'sessions', 'scoreHistory', 'reviews', 'wrongNote', 'studyLog']);
  C.go('result');
}
