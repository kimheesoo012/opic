// 풀이 화면: 문제 표시 → 응답 → 즉시 해설(또는 끝에 일괄) → 오답 원인 → 다음
import { h, on, toast, sheet, closeSheet, icons } from './ui.js';
import { questionsOf, targetSec, unitTarget, conceptName, LEVELS } from './bank.js';
import { currentItem, makeAttempt, applyAttempt, reviewStepResult, reviewAdvance, summarize, totalQuestions, questionLimit, setLimit } from './sessions.js';
import { STAGES } from './review.js';
import { CAUSES } from './stats.js';
import { LETTERS, fmtSec, PART_NAMES } from './util.js';
import { XP, attemptXp, masteryLevels, checkBadges } from './game.js';
import { play } from './sound.js';

let C;
const P = { unitKey: null, qKey: null, phase: 'answer', chosen: null, startT: 0, tick: null, lastTick: 0, tab: 0, wide: false, scrollToExp: false };

export function initPlayer(ctx) { C = ctx; }

function env() { return { bank: C.bank, state: C.state, rng: C.rng, now: Date.now() }; }
const S = () => C.state.active;

export function startSession(s) {
  if (!s) { toast('条件に合う問題が足りません。'); return; }
  // 풀던 세션을 말없이 덮어쓰지 않는다
  const cur = C.state.active;
  if (cur && cur.id !== s.id && Object.keys(cur.answers).length) {
    C.pendingSession = s;
    sheet(`<h3>途中のセッションがあります</h3><p class="small muted">${h(cur.title)}。続きから解くか、破棄して新しく始めます。</p>
      <div class="stack"><button class="btn primary block" data-act="resume">続きから解く</button><button class="btn block" data-act="discardAndStartPending">破棄して新しく始める</button></div>`);
    return;
  }
  // 끝난 뒤 숙련도 변화를 보여 주려고 시작 시점 단계를 남긴다
  if (!s.m0) s.m0 = masteryLevels(C.mastery());
  s.xp ||= 0;
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
    toast('制限時間が終わりました。残りの問題は未回答になります。', 3500);
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
      return { label: '1問', text: left >= 0 ? fmtSec(left) : `+${fmtSec(-left)}`, warn: left < 5 };
    }
    const sl = setLimit(s, unit);
    if (sl) {
      const left = sl - (s.setElapsed[unit.id] || 0);
      return { label: '文書', text: left >= 0 ? fmtSec(left) : `+${fmtSec(-left)}`, warn: left < 15 };
    }
  }
  if (s.limitSec) {
    const left = s.limitSec - s.elapsed;
    return { label: '残り時間', text: fmtSec(left), warn: left < 120 };
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
  if (P.phase === 'feedback' && P.evKey !== q.id && (unit.passages || []).length > 1 && q.evidence) {
    const i = unit.passages.findIndex((p) => evidenceIn(p, q.evidence));
    if (i >= 0) P.tab = i;
    P.evKey = q.id;
  }
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
    <button class="icon-btn" data-act="exitAsk" aria-label="終了">${icons.close}</button>
    <div class="prog"><div class="xs muted">${h(s.title)} · ${done}/${total || '–'}</div><div class="bar"><i style="width:${pct}%"></i></div></div>
    <div class="timer ${t.warn ? 'warn' : ''}"><small>${t.label}</small><b>${t.text}</b></div>
  </div>`;
}

function renderConcept(s, it) {
  const c = C.bank.conceptById.get(it.concept) || { name: it.concept, summary: '' };
  const card = C.state.reviews[it.concept];
  return `<div class="sess">${topBar(s)}
    <div class="sess-main">
      <div class="qhead"><span class="tag accent">復習ステップ1・要点</span></div>
      ${stageDots(card ? card.stage : 1)}
      <div class="concept-card" style="margin-top:12px"><h3>${h(c.name)}</h3><p>${h(c.summary)}</p></div>
      <p class="small muted">次: やさしい問題 → 難しい問題 → 制限時間つきの問題 → 1・3・7日後に新しい問題</p>
    </div>
    <div class="sess-foot"><button class="btn primary block" data-act="conceptOk">確認</button></div></div>`;
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

const evRe = (e) => new RegExp(e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
const normT = (x) => String(x).replace(/\s+/g, ' ').trim().toLowerCase();
function markEvidence(text, evidence) {
  let out = text;
  for (const e of evidence || []) {
    const m = out.match(evRe(e));
    if (m) out = out.slice(0, m.index) + '\u0001' + m[0] + '\u0002' + out.slice(m.index + m[0].length);
  }
  return out;
}
export function evidenceIn(p, evidence) {
  if (!evidence || !evidence.length) return false;
  if (evRe(evidence[0]).test(p.text)) return true;
  if (p.table) return [...p.table.header, ...p.table.rows.flat()].some((x) => evidence.some((e) => normT(e) === normT(x)));
  return false;
}

function oneProse(p, q, vocab, evidence) {
  const cellHit = (x) => evidence && evidence.some((e) => normT(e) === normT(x)); // 표는 칸 전체가 근거와 같을 때만
  let t = linkVocab(evidence ? markEvidence(p.text, evidence) : p.text, vocab).replace(/\u0001/g, '<mark class="ev">').replace(/\u0002/g, '</mark>');
  t = t.replace(/\{\{(\d)\}\}/g, (m, n) => `<span class="bk ${Number(n) === q.blank ? 'on' : ''}">(${n})</span>`);
  t = t.replace(/— \[(\d)\] —/g, (m, n) => `<span class="mk">[${n}]</span>`);
  let table = '';
  if (p.table) {
    table = `<div class="tbl"><table><thead><tr>${p.table.header.map((x) => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${p.table.rows.map((r) => `<tr>${r.map((x) => `<td class="${cellHit(x) ? 'ev' : ''}">${h(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  return `<div class="passage"><div class="ptitle">${h(p.title || p.kind || '')}</div>${t}${table}</div>`;
}

function passageHtml(unit, q, showVocab) {
  const vocab = showVocab ? allVocab(unit) : null;
  const ev = showVocab ? q.evidence : null; // 해설을 볼 때만 근거 문장 강조
  const ps = unit.passages || [];
  if (ps.length < 2) return ps.map((p) => oneProse(p, q, vocab, ev)).join('');
  const tab = Math.min(P.tab, ps.length - 1);
  return `<div class="ptabs" role="tablist">${ps.map((p, i) => `<button role="tab" data-act="ptab" data-i="${i}" aria-selected="${i === tab}">${i + 1}. ${h(p.title || p.kind)}</button>`).join('')}</div>
    ${oneProse(ps[tab], q, vocab, ev)}`;
}

function renderUnit(s, it, unit, q, qs) {
  const fb = P.phase === 'feedback';
  const ans = s.answers[q.id];
  let main = '';
  const head = [`Part ${unit.part}`];
  if (qs.length > 1) head.push(`${s.qIdx + 1}/${qs.length}問目`);
  if (it.focus) head.push(`復習ステップ${it.stage}・${STAGES[it.stage].label}${it.isNew === false ? '・同じ問題' : ''}`);
  const tgt = unit.part === 5 ? `目標${targetSec(C.bank, q, unit)}秒` : `文書の目標${fmtSec(unitTarget(unit))}・経過<span data-set-elapsed>${fmtSec(s.setElapsed[unit.id] || 0)}</span>`;
  main += `<div class="qhead">${head.map((x, i) => `<span class="tag ${i === 2 ? 'accent' : ''}">${h(x)}</span>`).join('')}<span class="target-time">${tgt}</span></div>`;
  if (unit.part >= 6) main += passageHtml(unit, q, fb);
  if (unit.part === 5) {
    const text = fb ? linkVocab(q.question, q.vocab) : h(q.question);
    main += `<div class="qtext">${text.replace(/-{7}/, '<span class="blank"></span>')}</div>`;
  }
  let qline = '';
  if (unit.part === 7) qline = `<div class="qtext qq"><b>${s.qIdx + 1}.</b> ${h(q.question)}</div>`;
  if (unit.part === 6) qline = `<div class="xs muted">空所(${q.blank})${q.type === 'insert' ? '・文挿入' : ''}</div>`;
  if (unit.part === 7 && q.type === 'insert') qline += `<div class="card small sentence">“${h(q.sentence)}”</div>`;
  const choiceBtns = q.choices.map((c, i) => {
    let cls = 'choice';
    if (fb) { if (i === q.answer) cls += ' right'; else if (ans && ans.choice === i) cls += ' wrong'; }
    else if (P.chosen === i) cls += ' sel';
    return `<button class="${cls}" data-act="choose" data-i="${i}" ${fb ? 'aria-disabled="true"' : ''}><span class="L">${LETTERS[i]}</span><span>${h(c)}</span></button>`;
  }).join('');
  const multiQ = qs.length > 1 ? `<div class="qnav">${qs.map((x, i) => `<span class="${i === s.qIdx ? 'on' : s.answers[x.id] ? 'done' : ''}">${i + 1}</span>`).join('')}${unit.part >= 6 ? `<button class="btn sm ghost" data-act="wide">${P.wide ? '問題を大きく' : '本文を大きく'}</button>` : ''}</div>` : '';
  let foot = multiQ + qline + `<div class="choices">${choiceBtns}</div>`;
  if (fb) {
    main += explainHtml(q, unit, ans, { causeFor: lastAttempt(s, q) });
    foot += `<div class="foot-actions"><button class="btn primary" data-act="next">${isLast(s, qs) ? '結果を見る' : '次へ'}</button></div>`;
  } else if (s.feedback === 'end' && !s.autoNext) {
    foot += `<div class="foot-actions"><button class="btn primary" data-act="next" ${P.chosen == null ? 'disabled' : ''}>${isLast(s, qs) ? '提出' : '次へ'}</button></div>`;
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

// 해설 본문에서 정답 단어를 굵게 (Part 5·6)
function boldAnswer(text, answer) {
  const esc = h(text);
  if (!answer || answer.length < 2 || answer.split(' ').length > 4) return esc;
  const re = new RegExp(`(^|[^A-Za-z])(${h(answer).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^A-Za-z]|$)`, 'g');
  return esc.replace(re, '$1<b>$2</b>');
}
const sec = (label, body, cls = '') => `<div class="sec ${cls}"><div class="lbl">${label}</div>${body}</div>`;

export function explainHtml(q, unit, ans, { causeFor = null, inPlay = true } = {}) {
  const ok = ans && ans.choice === q.answer;
  const tgt = targetSec(C.bank, q, unit);
  const ex = q.explanation;
  const concept = C.bank.conceptById.get(q.concept);
  let out = `<div class="exp">`;
  if (ans && ans.choice === -1) out += `<div class="verdict bad">時間切れ <span class="small muted">正解 ${LETTERS[q.answer]}</span></div>`;
  else if (ans) {
    out += `<div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? '正解' : '不正解'}${ans.xp ? ` <span class="xp-pop">+${ans.xp} XP</span>` : ''} <span class="small muted">${ok ? LETTERS[q.answer] : `正解 ${LETTERS[q.answer]}・自分の答え ${LETTERS[ans.choice]}`}・${Math.round(ans.sec)}秒・目標${tgt}秒</span></div>`;
  } else out += `<div class="verdict bad">未回答 <span class="small muted">正解 ${LETTERS[q.answer]}</span></div>`;
  out += `<div class="xs muted">${h(concept ? concept.name : q.concept)}・${LEVELS[q.difficulty]}${q.tags && q.tags.includes('trap') ? '・ひっかけ' : ''}</div>`;
  const answer = q.choices[q.answer];
  if (unit.part === 7 && q.trans) out += `<div class="qtr"><span class="lbl">設問</span>${h(q.trans)}</div>`;
  out += sec('正解の理由', `<p class="why">${unit.part === 7 ? h(ex.why) : boldAnswer(ex.why, answer)}</p>`);
  if (unit.part === 5 && q.trans) out += sec('訳', `<p class="en">${h(q.question).replace(/-{7}/, `<b>${h(answer)}</b>`)}</p><p class="tr">${h(q.trans)}</p>`, 'trans');
  if (unit.part === 6 && q.trans) out += sec(q.type === 'insert' ? '挿入文の訳' : '空所の文の訳', `${q.type === 'insert' ? `<p class="en">${h(answer)}</p>` : ''}<p class="tr">${h(q.trans)}</p>`, 'trans');
  if (unit.part === 7 && q.evidence && q.evidence.length) out += sec('根拠の文', `${q.evidence.map((e) => `<p class="en">“${h(e)}”</p>`).join('')}${inPlay ? '<button class="btn sm ghost" data-act="scrollEv">本文で見る</button>' : ''}`, 'ev');
  if (concept && concept.tip) out += `<p class="tip"><b>ポイント</b> ${h(concept.tip)}</p>`;
  out += `<div class="lbl">選択肢</div><ul class="traps">`;
  q.choices.forEach((c, i) => {
    out += `<li><b class="${i === q.answer ? 'done-mark' : ''}">${LETTERS[i]}</b>${i === q.answer ? '<span class="tag ok">正解</span> ' : ''}<span class="ch">${h(c)}</span>${i !== q.answer ? `<div class="small muted">${h(ex.traps[i])}</div>` : ''}</li>`;
  });
  out += `</ul>`;
  if (q.para && q.para.length) {
    out += `<div class="para"><b>言い換え</b>${q.para.map((p) => `<div>本文: ${h(p.p)}<br>正解: ${h(p.a)}</div>`).join('')}</div>`;
  }
  const vocab = q.vocab || [];
  if (vocab.length) out += `<div class="vocab-row">${vocab.map((v) => `<button class="chip" data-act="word" data-w="${h(v.w)}">${h(v.w)}</button>`).join('')}</div>`;
  if (causeFor && !causeFor.correct) {
    out += `<div class="causes"><div class="small"><b>ミスの原因</b></div><div class="chips">${CAUSES.map((c) => `<button class="chip" data-act="cause" data-aid="${causeFor.id}" data-c="${c.id}" aria-pressed="${causeFor.cause === c.id}">${c.label}</button>`).join('')}</div></div>`;
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
  const xp = attemptXp(a);
  s.answers[q.id].xp = xp;
  C.award(xp);
  if (s.feedback === 'immediate' && choice !== -1) play(a.correct ? 'right' : 'wrong', C.state.settings.sound);
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
      if (ok) { C.state.game.reviewPasses = (C.state.game.reviewPasses || 0) + 1; C.award(XP.reviewPass); }
      toast(ok ? `クリア +${XP.reviewPass} XP。次のステップへ。` : 'もう一度。前のステップへ。');
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
  C.award(XP.concept);
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
on('scrollEv', () => {
  const m = document.querySelector('.sess-main mark.ev, .sess-main td.ev');
  if (!m) { toast('この文書には強調する文がありません。'); return; }
  m.scrollIntoView({ block: 'center', behavior: 'smooth' });
});

on('exitAsk', () => {
  sheet(`<h3>中断しますか？</h3><p class="muted small">解いた問題は保存されていて、ホームから続きを解けます。</p>
    <div class="stack"><button class="btn primary block" data-act="exitKeep">中断する</button>
    <button class="btn block" data-act="exitFinish">ここで終えて結果を見る</button>
    <button class="btn ghost block" data-act="closeSheet">続ける</button></div>`);
});
on('discardAndStartPending', () => {
  const s = C.pendingSession;
  C.pendingSession = null;
  C.state.active = null;
  closeSheet();
  startSession(s);
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
  // 완료 보너스, 숙련도 상승, 새 배지
  if (sum.n >= 3) C.award(XP.session);
  if (sum.n >= 10 && sum.correct === sum.n) C.award(XP.perfect);
  const mNow = C.mastery();
  const ups = s.m0 ? Object.entries(mNow).filter(([c, m]) => m.lv >= 2 && m.lv > (s.m0[c] || 0)).map(([c, m]) => ({ c, from: s.m0[c] || 0, to: m.lv })).sort((a, b) => b.to - a.to).slice(0, 5) : [];
  const badges = checkBadges(C.state.game, { attempts: C.state.attempts, sessions: C.state.sessions, mastery: mNow, last: { kind: s.kind, n: sum.n, correct: sum.correct } });
  if (badges.length && !s.goalHit && !s.levelUp) play('level', C.state.settings.sound);
  s.gain = { mastery: ups, badges };
  C.lastSession = s;
  C.state.active = null;
  try { sessionStorage.setItem('ttja-last', JSON.stringify(s)); } catch { /* 무시 */ }
  C.snapshotScore();
  C.save(['active', 'sessions', 'scoreHistory', 'reviews', 'wrongNote', 'studyLog', 'game']);
  C.go('result');
}
