// 풀이 화면: 문제 표시 → 응답 → 즉시 해설(또는 끝에 일괄) → 오답 원인 → 다음
import { h, on, toast, sheet, closeSheet, icons } from './ui.js';
import { questionsOf, targetSec, unitTarget, conceptName, LEVELS } from './bank.js';
import { currentItem, makeAttempt, applyAttempt, reviewStepResult, reviewAdvance, summarize, totalQuestions, questionLimit, setLimit } from './sessions.js';
import { STAGES } from './review.js';
import { CAUSES } from './stats.js';
import { LETTERS, fmtSec, PART_NAMES } from './util.js';

let C;
const P = { unitKey: null, qKey: null, phase: 'answer', chosen: null, startT: 0, tick: null, lastTick: 0, tab: 0, wide: false, scrollToExp: false };

export function initPlayer(ctx) { C = ctx; }

function env() { return { bank: C.bank, state: C.state, rng: C.rng, now: Date.now() }; }
const S = () => C.state.active;

export function startSession(s) {
  if (!s) { toast('조건에 맞는 문제가 부족합니다.'); return; }
  C.state.active = s;
  C.save(['active']);
  P.unitKey = null;
  C.go('play');
}

export function leavePlayer() {
  clearInterval(P.tick);
  P.tick = null;
  P.unitKey = null;
}

// ---------- 타이머 ----------
function startTick() {
  clearInterval(P.tick);
  P.lastTick = Date.now();
  P.tick = setInterval(onTick, 500);
}

function curUnit(s) {
  const it = currentItem(s);
  return it && it.type === 'unit' ? C.bank.unitById.get(it.unitId) : null;
}

function onTick() {
  const s = S();
  if (!s || C.route !== 'play') { clearInterval(P.tick); P.tick = null; return; }
  const now = Date.now();
  const dt = Math.min(5, (now - P.lastTick) / 1000);
  P.lastTick = now;
  if (document.hidden) return;
  s.elapsed += dt;
  const unit = curUnit(s);
  if (unit && P.phase !== 'feedback') s.setElapsed[unit.id] = (s.setElapsed[unit.id] || 0) + dt;
  if (s.limitSec && s.elapsed >= s.limitSec) {
    s.timeUp = true;
    toast('제한 시간이 끝났습니다. 남은 문항은 미응답 처리됩니다.', 3500);
    finish();
    return;
  }
  // 연속 풀이: 문항 시간이 다 되면 미응답으로 넘어감
  if (unit && s.autoNext && P.phase === 'answer') {
    const it = currentItem(s);
    const q = questionsOf(unit)[s.qIdx];
    const lim = questionLimit(s, it, unit, q, C.bank);
    if (lim && (now - P.startT) / 1000 >= lim && !s.answers[q.id]) {
      record(-1, lim);
      advance();
      return;
    }
  }
  updateTimer();
  if (Math.round(s.elapsed) % 10 === 0) C.save(['active']);
}

function timerInfo() {
  const s = S();
  const it = currentItem(s);
  const unit = curUnit(s);
  if (unit && P.phase === 'answer') {
    const q = questionsOf(unit)[s.qIdx];
    const lim = questionLimit(s, it, unit, q, C.bank);
    if (lim) {
      const left = lim - (Date.now() - P.startT) / 1000;
      return { label: '문항', text: left >= 0 ? fmtSec(left) : `+${fmtSec(-left)}`, warn: left < 5 };
    }
    const sl = setLimit(s, unit);
    if (sl) {
      const left = sl - (s.setElapsed[unit.id] || 0);
      return { label: '지문', text: left >= 0 ? fmtSec(left) : `+${fmtSec(-left)}`, warn: left < 15 };
    }
  }
  if (s.limitSec) {
    const left = s.limitSec - s.elapsed;
    return { label: '남은 시간', text: fmtSec(left), warn: left < 120 };
  }
  return { label: '', text: fmtSec(s.elapsed), warn: false };
}
function updateTimer() {
  const el = document.querySelector('.timer');
  if (!el) return;
  const t = timerInfo();
  el.querySelector('b').textContent = t.text;
  el.querySelector('small').textContent = t.label;
  el.classList.toggle('warn', t.warn);
  const se = document.querySelector('[data-set-elapsed]');
  const unit = curUnit(S());
  if (se && unit) se.textContent = fmtSec(S().setElapsed[unit.id] || 0);
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
  if (P.unitKey !== key) { P.unitKey = key; P.tab = 0; P.qKey = null; }
  const ans = s.answers[q.id];
  P.phase = ans && s.feedback === 'immediate' ? 'feedback' : 'answer';
  if (P.qKey !== q.id) { P.startT = Date.now(); P.chosen = ans ? ans.choice : null; P.qKey = q.id; }
  root.innerHTML = renderUnit(s, it, unit, q, qs);
  const main = root.querySelector('.sess-main');
  if (main && P.phase === 'feedback' && P.scrollToExp) {
    const ex = root.querySelector('.exp');
    if (ex) main.scrollTop += ex.getBoundingClientRect().top - main.getBoundingClientRect().top - 8;
    P.scrollToExp = false;
  }
}

function topBar(s) {
  const total = totalQuestions(s, C.bank);
  const done = Object.keys(s.answers).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const t = timerInfo();
  return `<div class="sess-top">
    <button class="icon-btn" data-act="exitAsk" aria-label="나가기">${icons.close}</button>
    <div class="prog"><div class="xs muted">${h(s.title)} · ${done}/${total || '–'}</div><div class="bar"><i style="width:${pct}%"></i></div></div>
    <div class="timer ${t.warn ? 'warn' : ''}"><small>${t.label}</small><b>${t.text}</b></div>
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
      <p class="small muted">다음: 쉬운 문제 → 어려운 문제 → 제한 시간 문제 → 1·3·7일 뒤 새 문제</p>
    </div>
    <div class="sess-foot"><button class="btn primary block" data-act="conceptOk">확인</button></div></div>`;
}

export function stageDots(stage) {
  let d = '';
  for (let i = 1; i <= 7; i++) d += `<i class="${i <= stage ? 'on' : ''}"></i>`;
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

const allVocab = (unit) => questionsOf(unit).flatMap((q) => q.vocab || []);

function oneProse(p, q, vocab) {
  let t = linkVocab(p.text, vocab);
  t = t.replace(/\{\{(\d)\}\}/g, (m, n) => `<span class="bk ${Number(n) === q.blank ? 'on' : ''}">(${n})</span>`);
  t = t.replace(/— \[(\d)\] —/g, (m, n) => `<span class="mk">[${n}]</span>`);
  let table = '';
  if (p.table) {
    table = `<div class="tbl"><table><thead><tr>${p.table.header.map((x) => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${p.table.rows.map((r) => `<tr>${r.map((x) => `<td>${h(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  return `<div class="passage"><div class="ptitle">${h(p.title || p.kind || '')}</div>${t}${table}</div>`;
}

function passageHtml(unit, q, showVocab) {
  const vocab = showVocab ? allVocab(unit) : null;
  const ps = unit.passages || [];
  if (ps.length < 2) return ps.map((p) => oneProse(p, q, vocab)).join('');
  const tab = Math.min(P.tab, ps.length - 1);
  return `<div class="ptabs" role="tablist">${ps.map((p, i) => `<button role="tab" data-act="ptab" data-i="${i}" aria-selected="${i === tab}">${i + 1}. ${h(p.title || p.kind)}</button>`).join('')}</div>
    ${oneProse(ps[tab], q, vocab)}`;
}

function renderUnit(s, it, unit, q, qs) {
  const fb = P.phase === 'feedback';
  const ans = s.answers[q.id];
  let main = '';
  const head = [`Part ${unit.part}`];
  if (qs.length > 1) head.push(`${s.qIdx + 1}/${qs.length}번`);
  if (it.focus) head.push(`복습 ${it.stage}단계 · ${STAGES[it.stage].label}${it.isNew === false ? ' · 같은 문제' : ''}`);
  const tgt = unit.part === 5 ? `목표 ${targetSec(C.bank, q, unit)}초` : `지문 목표 ${fmtSec(unitTarget(unit))} · 경과 <span data-set-elapsed>${fmtSec(s.setElapsed[unit.id] || 0)}</span>`;
  main += `<div class="qhead">${head.map((x, i) => `<span class="tag ${i === 2 ? 'accent' : ''}">${h(x)}</span>`).join('')}<span class="target-time">${tgt}</span></div>`;
  if (unit.part >= 6) main += passageHtml(unit, q, fb);
  if (unit.part === 5) {
    const text = fb ? linkVocab(q.question, q.vocab) : h(q.question);
    main += `<div class="qtext">${text.replace(/-{7}/, '<span class="blank"></span>')}</div>`;
  }
  let qline = '';
  if (unit.part === 7) qline = `<div class="qtext qq"><b>${s.qIdx + 1}.</b> ${h(q.question)}</div>`;
  if (unit.part === 6) qline = `<div class="xs muted">빈칸 (${q.blank})${q.type === 'insert' ? ' · 문장 삽입' : ''}</div>`;
  if (unit.part === 7 && q.type === 'insert') qline += `<div class="card small sentence">“${h(q.sentence)}”</div>`;
  const choiceBtns = q.choices.map((c, i) => {
    let cls = 'choice';
    if (fb) { if (i === q.answer) cls += ' right'; else if (ans && ans.choice === i) cls += ' wrong'; }
    else if (P.chosen === i) cls += ' sel';
    return `<button class="${cls}" data-act="choose" data-i="${i}" ${fb ? 'aria-disabled="true"' : ''}><span class="L">${LETTERS[i]}</span><span>${h(c)}</span></button>`;
  }).join('');
  const multiQ = qs.length > 1 ? `<div class="qnav">${qs.map((x, i) => `<span class="${i === s.qIdx ? 'on' : s.answers[x.id] ? 'done' : ''}">${i + 1}</span>`).join('')}${unit.part >= 6 ? `<button class="btn sm ghost" data-act="wide">${P.wide ? '문제 크게' : '지문 크게'}</button>` : ''}</div>` : '';
  let foot = multiQ + qline + `<div class="choices">${choiceBtns}</div>`;
  if (fb) {
    main += explainHtml(q, unit, ans, { causeFor: lastAttempt(s, q) });
    foot += `<div class="foot-actions"><button class="btn primary" data-act="next">${isLast(s, qs) ? '결과 보기' : '다음'}</button></div>`;
  } else if (s.feedback === 'end') {
    foot += `<div class="foot-actions"><button class="btn primary" data-act="next" ${P.chosen == null ? 'disabled' : ''}>${isLast(s, qs) ? '제출' : '다음'}</button></div>`;
  }
  return `<div class="sess">${topBar(s)}<div class="sess-main">${main}</div><div class="sess-foot ${P.wide ? 'narrow' : ''}">${foot}</div></div>`;
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
  const concept = C.bank.conceptById.get(q.concept);
  let out = `<div class="exp">`;
  if (ans && ans.choice === -1) out += `<div class="verdict bad">시간 초과 <span class="small muted">정답 ${LETTERS[q.answer]}</span></div>`;
  else if (ans) {
    out += `<div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? '정답' : '오답'} <span class="small muted">정답 ${LETTERS[q.answer]}${ok ? '' : ` · 내 답 ${LETTERS[ans.choice]}`} · ${Math.round(ans.sec)}초, 목표 ${tgt}초</span></div>`;
  } else out += `<div class="verdict bad">미응답 <span class="small muted">정답 ${LETTERS[q.answer]}</span></div>`;
  out += `<div class="xs muted">${h(concept ? concept.name : q.concept)} · ${LEVELS[q.difficulty]}${q.tags && q.tags.includes('trap') ? ' · 함정' : ''}</div>`;
  out += `<p class="why">${h(ex.why)}</p>`;
  if (concept && concept.tip) out += `<p class="tip"><b>핵심</b> ${h(concept.tip)}</p>`;
  out += `<ul class="traps">`;
  q.choices.forEach((c, i) => {
    out += `<li><b class="${i === q.answer ? 'done-mark' : ''}">${LETTERS[i]}${i === q.answer ? ' ✓' : ''}</b>${h(c)}${i !== q.answer ? `<div class="small muted">${h(ex.traps[i])}</div>` : ''}</li>`;
  });
  out += `</ul>`;
  if (q.para && q.para.length) {
    out += `<div class="para"><b>바꿔 말하기</b>${q.para.map((p) => `<div>지문: ${h(p.p)}<br>정답: ${h(p.a)}</div>`).join('')}</div>`;
  }
  const vocab = q.vocab || [];
  if (vocab.length) out += `<div class="vocab-row">${vocab.map((v) => `<button class="chip" data-act="word" data-w="${h(v.w)}">${h(v.w)}</button>`).join('')}</div>`;
  if (causeFor && !causeFor.correct) {
    out += `<div class="causes"><div class="small"><b>오답 원인</b></div><div class="chips">${CAUSES.map((c) => `<button class="chip" data-act="cause" data-aid="${causeFor.id}" data-c="${c.id}" aria-pressed="${causeFor.cause === c.id}">${c.label}</button>`).join('')}</div></div>`;
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

function record(choice, secOverride = null) {
  const { s, unit, q } = curRefs();
  const now = Date.now();
  const sec = secOverride ?? Math.max(0.5, (now - P.startT) / 1000);
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
    if (s.autoNext) { record(i); advance(); return; } // 연속 풀이는 탭 한 번으로 다음
    P.chosen = i;
    document.querySelectorAll('.choice').forEach((b) => b.classList.toggle('sel', Number(b.dataset.i) === i));
    const nb = document.querySelector('[data-act="next"]');
    if (nb) nb.disabled = false;
    return;
  }
  record(i);
  P.scrollToExp = true;
  render();
});

function advance() {
  const s = S();
  const { it, qs } = curRefs();
  P.chosen = null;
  if (s.qIdx < qs.length - 1) {
    s.qIdx++;
  } else {
    if (s.kind === 'review' && it.focus) {
      const ok = reviewStepResult(s, it, env());
      toast(ok ? '통과. 다음 단계로.' : '다시. 이전 단계로.');
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
  if (m && s.qIdx === 0) m.scrollTop = 0;
}

on('next', () => {
  const s = S();
  if (!s) return;
  const { q } = curRefs();
  if (s.feedback === 'end' && !s.answers[q.id]) {
    if (P.chosen == null) return;
    record(P.chosen);
  }
  advance();
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

on('ptab', (el) => {
  P.tab = Number(el.dataset.i);
  const main = document.querySelector('.sess-main');
  const keep = main ? main.scrollTop : 0;
  render();
  const m = document.querySelector('.sess-main');
  const tabs = document.querySelector('.ptabs');
  if (m && tabs) m.scrollTop = Math.min(keep, tabs.offsetTop);
});
on('wide', () => { P.wide = !P.wide; render(); });

on('exitAsk', () => {
  sheet(`<h3>나갈까요?</h3><p class="muted small">푼 문제는 저장되어 있고 홈에서 이어서 풀 수 있습니다.</p>
    <div class="stack"><button class="btn primary block" data-act="exitKeep">나가기</button>
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
