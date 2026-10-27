// 복습·기록·설정·훈련·계산 방식 화면
import { C } from './ctx.js';
import { questionsOf, conceptName } from './bank.js';
import { dueCards, STAGES } from './review.js';
import { partStats, weakConcepts, causeDist, retentionStats, CAUSES, todayAttempts, todayStudySec, overtimeQids } from './stats.js';
import { newSession } from './sessions.js';
import { pct, dayKey, fmtMin, PART_NAMES, DAY, LETTERS, RC_PARTS } from './util.js';
import { h, on, toast, sheet, closeSheet, copyText, download } from './ui.js';
import { startSession, stageDots } from './player.js';
import { validateImport } from './store.js';

const env = () => ({ bank: C.bank, state: C.state, rng: C.rng, now: Date.now() });
function partOf(concept) { const c = C.bank.conceptById.get(concept); return c && !c.name.startsWith('Part') ? `P${c.part} · ` : ''; }
function days(ms) { const d = Math.ceil(ms / DAY); return d <= 0 ? '오늘' : `${d}일 뒤`; }

// ---------- 복습 ----------
export function renderReview() {
  const st = C.state;
  const now = Date.now();
  const due = dueCards(st.reviews, now);
  const later = Object.values(st.reviews).filter((c) => c.due > now).sort((a, b) => a.due - b.due);
  let html = `<div class="page"><h1>복습</h1><h2>단계별 복습</h2>`;
  if (!due.length && !later.length) html += `<p class="muted small">틀린 문제의 유형이 여기에 쌓입니다. 순서: 개념 → 쉬운 문제 → 어려운 문제 → 제한 시간 → 1·3·7일 뒤 새 문제.</p>`;
  if (due.length) {
    html += `<button class="btn primary block" data-act="startReview">지금 복습 · ${Math.min(due.length, 5)}개 유형</button>`;
    html += due.map((c) => `<div class="card"><div class="row between"><b>${partOf(c.concept)}${h(conceptName(C.bank, c.concept))}</b><span class="tag accent">지금</span></div>${stageDots(c.stage)}</div>`).join('');
  }
  if (later.length) {
    html += `<h2>예정</h2>` + later.slice(0, 12).map((c) => `<div class="list-item"><div class="grow"><b class="small">${partOf(c.concept)}${h(conceptName(C.bank, c.concept))}</b>${stageDots(c.stage)}</div><span class="tag">${days(c.due - now)}</span></div>`).join('');
  }
  const notes = Object.values(st.wrongNote).sort((a, b) => b.lastT - a.lastT);
  const filter = C.wnFilter || 0;
  const shown = notes.filter((n) => !filter || n.part === filter);
  html += `<h2>오답노트 <span class="muted small">${notes.length}문항</span></h2>
    <div class="row wrap" style="gap:6px">${[0, 5, 6, 7].map((p) => `<button class="chip" data-act="wnFilter" data-p="${p}" aria-pressed="${filter === p}">${p ? `P${p}` : '전체'}</button>`).join('')}</div>`;
  if (shown.length) {
    html += `<button class="btn block" style="margin-top:10px" data-act="wnAll">다시 맞히지 못한 문제 풀기 · ${Math.min(shown.filter((n) => !n.rightAfter).length, 10)}</button>`;
    html += shown.slice(0, 40).map((n) => {
      const ref = C.bank.qById.get(n.qid);
      if (!ref) return '';
      const label = ref.unit.part === 6 ? `빈칸 (${ref.q.blank})` : ref.q.question;
      return `<div class="list-item"><div class="grow"><div class="xs muted">P${n.part} · ${h(conceptName(C.bank, n.concept))} · 틀림 ${n.wrongCount}${n.rightAfter ? ` · 이후 정답 ${n.rightAfter}` : ''}${n.cause ? ` · ${h(CAUSES.find((c) => c.id === n.cause)?.label || '')}` : ''}</div>
        <div class="small">${h(String(label || '').replace(/-{7}/, '___').slice(0, 80))}</div></div><button class="btn sm" data-act="wnOne" data-q="${n.qid}">다시</button></div>`;
    }).join('');
  } else html += `<p class="muted small">해당하는 오답이 없습니다.</p>`;
  const over = overtimeQids(st.attempts);
  html += `<h2>시간 초과 문제 <span class="muted small">${over.length}문항</span></h2>${over.length ? `<button class="btn block" data-act="overtimeStart">시간 안에 다시 풀기 · ${Math.min(over.length, 10)}</button>` : '<p class="muted small">목표 시간을 넘긴 문제가 여기에 모입니다.</p>'}`;
  const r = retentionStats(st.attempts);
  html += `<h2>복습 효과</h2><div class="card small">같은 문제 다시 맞힘 <b>${r.repeatRight}/${r.repeatTotal}</b><br>같은 개념의 새 문제 맞힘 <b>${r.newRight}/${r.newTotal}</b>
    <p class="xs muted" style="margin:6px 0 0">같은 문제는 기억, 새 문제는 이해를 확인합니다. 둘을 따로 기록합니다.</p></div>
    <h2>단어장 <span class="muted small">${Object.keys(st.vocab).length}개</span></h2><a class="btn block" href="#train-vocab">단어장 열기</a></div>`;
  return html;
}
on('startReview', () => {
  const due = dueCards(C.state.reviews, Date.now());
  const s = newSession('review', { concepts: due.slice(0, 5).map((c) => c.concept) }, env());
  if (!s) { toast('지금 복습할 단계가 없습니다.'); return; }
  startSession(s);
});
on('overtimeStart', () => startSession(newSession('overtime', {}, env())));
on('wnFilter', (el) => { C.wnFilter = Number(el.dataset.p); C.render(); });
on('wnOne', (el) => startSession(newSession('wrongnote', { qids: [el.dataset.q] }, env())));
on('wnAll', () => {
  const f = C.wnFilter || 0;
  const qids = Object.values(C.state.wrongNote).filter((n) => !n.rightAfter && (!f || n.part === f)).sort((a, b) => a.lastT - b.lastT).slice(0, 10).map((n) => n.qid);
  if (!qids.length) { toast('모두 한 번 이상 다시 맞혔습니다.'); return; }
  startSession(newSession('wrongnote', { qids }, env()));
});

// ---------- 기록 ----------
function summaryText() {
  const st = C.state;
  const today = todayAttempts(st.attempts);
  const est = C.estimateNow();
  const lines = [`[토익 RC 훈련 요약] ${dayKey(Date.now())}`];
  lines.push(`오늘 푼 문제: ${today.length}문항${today.length ? `, 정답률 ${pct(today.filter((a) => a.correct).length / today.length)}%` : ''}, 학습 ${fmtMin(todayStudySec(st.studyLog))}`);
  const ps = partStats(today.length ? today : st.attempts);
  const parts = RC_PARTS.filter((p) => ps[p].n).map((p) => `P${p} ${pct(ps[p].acc)}% ${ps[p].n}문항`);
  lines.push(`파트별 정답률${today.length ? ' 오늘' : ' 전체'}: ${parts.join(', ') || '기록 없음'}`);
  const weak = weakConcepts(st.attempts, 3);
  lines.push(`약점 유형: ${weak.length ? weak.map((w) => `${conceptName(C.bank, w.concept)} ${pct(w.acc)}% ${w.n}문항`).join(', ') : '판단할 기록 부족'}`);
  lines.push(est.enough ? `RC 추정 점수 범위: ${est.rc.lo}–${est.rc.hi}, 공식 환산 아님 · 목표 ${st.profile.goal}` : `학습 수준: ${est.level}, 데이터 부족 · 목표 ${st.profile.goal}`);
  return lines.join('\n');
}
C.summaryText = summaryText;

export function renderStats() {
  const st = C.state;
  const est = C.estimateNow();
  const ps = partStats(st.attempts);
  const weak = weakConcepts(st.attempts, 3);
  const causes = causeDist(st.attempts);
  const causeTotal = Object.values(causes).reduce((a, b) => a + b, 0);
  let html = `<div class="page"><h1>기록</h1>`;
  // scoreCard는 app.js에 있으므로 간접 호출
  html += C.scoreCardHtml ? C.scoreCardHtml(est) : '';
  html += `<div class="card"><h3>파트별 정답률·풀이 시간</h3><table class="t"><thead><tr><th>파트</th><th class="num">문항</th><th class="num">정답률</th><th class="num">평균</th></tr></thead><tbody>
    ${RC_PARTS.map((p) => `<tr><td>P${p} ${PART_NAMES[p]}</td><td class="num">${ps[p].n}</td><td class="num">${ps[p].n ? pct(ps[p].acc) + '%' : '–'}</td><td class="num">${ps[p].avgSec != null ? `${Math.round(ps[p].avgSec)}초${p >= 5 && ps[p].target ? `<div class="xs muted">목표 ${ps[p].target}초</div>` : ''}` : '–'}</td></tr>`).join('')}</tbody></table></div>`;
  html += `<div class="card"><h3>자주 틀리는 유형 TOP 3</h3>${weak.length ? weak.map((w, i) => `<div class="list-item"><b>${i + 1}</b><div class="grow">${h(conceptName(C.bank, w.concept))}<div class="xs muted">정답률 ${pct(w.acc)}% · ${w.n}문항${w.avgSec != null ? ` · 평균 ${Math.round(w.avgSec)}초` : ''}</div></div><button class="btn sm" data-act="drillConcept" data-c="${w.concept}">연습</button></div>`).join('') : '<p class="small muted">유형당 4문항 이상 풀어야 약점으로 판단합니다.</p>'}</div>`;
  html += `<div class="card"><h3>오답 원인 분포</h3>${causeTotal ? CAUSES.map((c) => `<div class="dist-row"><span>${c.label}</span><div class="bar"><i style="width:${pct((causes[c.id] || 0) / causeTotal)}%"></i></div><span class="xs muted">${causes[c.id] || 0}</span></div>`).join('') : '<p class="small muted">해설 아래에서 고른 오답 원인이 여기에 모입니다.</p>'}</div>`;
  const r = retentionStats(st.attempts);
  html += `<div class="card"><h3>복습 효과</h3><div class="small">같은 문제 다시 맞힘 ${r.repeatRight}/${r.repeatTotal} · 같은 개념 새 문제 맞힘 ${r.newRight}/${r.newTotal}</div></div>`;
  html += `<div class="card"><h3>결과 요약</h3><pre class="small" style="white-space:pre-wrap;margin:0 0 8px">${h(summaryText())}</pre><button class="btn primary block" data-act="copySummary">결과 요약 복사</button></div>`;
  html += `<div class="card"><h3>학습 기록 백업</h3><p class="xs muted" style="margin:0 0 8px">기록은 이 기기 브라우저에만 저장됩니다. 다른 기기로 옮길 때 JSON으로 내보냅니다.</p>
    <div class="row"><button class="btn grow" data-act="exportData">JSON 내보내기</button><button class="btn grow" data-act="importPick">가져오기</button></div>
    <input type="file" accept="application/json,.json" class="hidden" id="importFile" data-change="importFile"></div></div>`;
  return html;
}
on('drillConcept', (el) => startSession(newSession('drill', { concept: el.dataset.c, nQ: 6 }, env())));
on('copySummary', async () => { toast((await copyText(summaryText())) ? '복사했습니다' : '복사하지 못했습니다. 텍스트를 길게 눌러 복사합니다.'); });
on('exportData', async () => {
  const data = C.store.exportData(C.version);
  data.dataVersion = C.dataVersion;
  const text = JSON.stringify(data);
  if (C.embedded) {
    // 미리보기 페이지(Artifact)는 파일 저장이 막혀 있어 클립보드로 대신한다
    const ok = await copyText(text);
    sheet(`<h3>기록 JSON ${ok ? '복사됨' : '복사 실패'}</h3><p class="small">이 페이지는 파일 저장이 막혀 있습니다. ${ok ? '클립보드에 복사했으니 메모 앱에 붙여 넣어 .json으로 저장합니다.' : '복사도 실패했습니다. GitHub Pages 버전에서 내보냅니다.'}</p><button class="btn block" data-act="closeSheet">닫기</button>`);
    return;
  }
  download(`toeic-trainer-${dayKey(Date.now())}.json`, text);
  toast('내보냈습니다');
});
on('importPick', () => document.getElementById('importFile').click());
on('importFile', async (el) => {
  const f = el.files && el.files[0];
  el.value = '';
  if (!f) return;
  let obj;
  try { obj = JSON.parse(await f.text()); } catch { toast('JSON 파일을 읽지 못했습니다. 기존 기록은 그대로입니다.', 3500); return; }
  const errs = validateImport(obj);
  if (errs.length) { sheet(`<h3>가져올 수 없는 파일</h3><p class="small">기존 기록은 바뀌지 않았습니다.</p><ul class="small">${errs.slice(0, 6).map((e) => `<li>${h(e)}</li>`).join('')}</ul><button class="btn block" data-act="closeSheet">닫기</button>`); return; }
  C.pendingImport = obj;
  sheet(`<h3>기록을 바꿀까요?</h3><p class="small">파일의 기록 ${obj.data.attempts.length}문항, 내보낸 날 ${h(String(obj.exportedAt || '').slice(0, 10))}. 현재 기록 ${C.state.attempts.length}문항을 대체합니다. ${C.embedded ? '이 페이지는 자동 백업을 저장할 수 없습니다. 필요하면 먼저 내보내기로 복사해 둡니다.' : '현재 기록은 먼저 파일로 내려받아 둡니다.'}</p>
    <div class="stack"><button class="btn primary block" data-act="importConfirm">바꾸기</button><button class="btn block ghost" data-act="closeSheet">취소</button></div>`);
});
on('importConfirm', async () => {
  const obj = C.pendingImport;
  C.pendingImport = null;
  closeSheet();
  if (!obj) return;
  if (!C.embedded) download(`toeic-trainer-backup-before-import-${Date.now()}.json`, JSON.stringify(C.store.exportData(C.version)));
  const r = await C.store.importData(obj);
  if (!r.ok) { toast('가져오지 못했습니다. 기존 기록은 그대로입니다.'); return; }
  C.applyTheme();
  toast(`${r.count}문항 기록을 가져왔습니다`);
  C.render();
});

// ---------- 설정 ----------
export function renderSettings() {
  const st = C.state;
  const s = st.settings;
  const total = RC_PARTS.reduce((a, p) => a + C.bank.count(p), 0);
  return `<div class="page"><h1>설정</h1>
    <div class="card"><div class="row between"><div><h3>목표 점수</h3><div class="small muted">총점 ${st.profile.goal} · LC 기준 ${st.profile.lcBase}</div></div><a class="btn sm" href="#goal">바꾸기</a></div></div>
    <div class="card"><h3>화면</h3><div class="seg" style="display:flex">${[['auto', '기기 설정'], ['light', '밝게'], ['dark', '어둡게']].map(([k, l]) => `<button style="flex:1" data-act="theme" data-t="${k}" aria-pressed="${(s.theme || 'auto') === k}">${l}</button>`).join('')}</div></div>
    <div class="card"><h3>데이터</h3><div class="stack"><button class="btn block" data-act="exportData">학습 기록 내보내기</button><button class="btn block" data-act="importPick">학습 기록 가져오기</button><button class="btn block ghost" data-act="resetAsk">모든 기록 지우기</button></div>
      <input type="file" accept="application/json,.json" class="hidden" id="importFile" data-change="importFile"></div>
    <div class="card small"><h3>앱 정보</h3>앱 ${h(C.version)} · 문제은행 ${h(C.dataVersion)}<br>${RC_PARTS.map((p) => `Part ${p} ${C.bank.count(p)}문항`).join(' · ')} · 합계 ${total}<br>Part 6 ${(C.bank.byPart[6] || []).length}세트 · Part 7 단일 ${(C.bank.byPart[7] || []).filter((u) => u.passages.length === 1).length}세트, 이중·삼중 ${(C.bank.byPart[7] || []).filter((u) => u.passages.length > 1).length}세트<br>저장 방식 ${h(C.store.adapter.kind)}<br><a href="#about">추정 점수 계산 방식과 한계</a>
      <p class="xs muted">RC 전용 앱입니다. 모든 문제는 이 앱을 위해 새로 작성했고 실제 시험·교재 문제가 아닙니다. TOEIC은 ETS의 등록 상표입니다.</p></div></div>`;
}
on('setOpt', (el) => { C.state.settings[el.dataset.k] = el.dataset.v === '1'; C.save(['settings']); C.render(); });
on('theme', (el) => { C.state.settings.theme = el.dataset.t; C.save(['settings']); C.applyTheme(); C.render(); });
on('resetAsk', () => sheet(`<h3>모든 기록을 지울까요?</h3><p class="small">풀이 기록, 복습 카드, 단어장, 설정이 모두 지워지고 되돌릴 수 없습니다.</p>
  <div class="stack"><button class="btn block" data-act="exportData">먼저 내보내기</button><button class="btn primary block" data-act="resetConfirm">지우기</button><button class="btn ghost block" data-act="closeSheet">취소</button></div>`));
on('resetConfirm', async () => { closeSheet(); await C.store.reset(); C.applyTheme(); toast('기록을 지웠습니다'); C.go('home'); });

// ---------- 단어 ----------
let vocabIndex = null;
function sentenceWith(text, w) {
  if (!text) return null;
  const parts = String(text).replace(/\{\{\d\}\}/g, '____').replace(/— \[\d\] —/g, '').split(/(?<=[.!?])\s+|\n+/);
  const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  return parts.find((p) => re.test(p)) || null;
}
function buildVocabIndex() {
  vocabIndex = new Map();
  for (const u of C.bank.units) {
    const texts = [u.question, ...(u.passages || []).map((p) => p.text), ...(u.questions || []).map((q) => q.question)];
    for (const q of questionsOf(u)) {
      for (const v of q.vocab || []) {
        const key = v.w.toLowerCase();
        if (vocabIndex.has(key)) continue;
        let ctx = null;
        for (const t of [q.question, ...texts]) { ctx = sentenceWith(t, v.w); if (ctx) break; }
        vocabIndex.set(key, { ...v, qid: q.id, ctx: ctx ? ctx.replace(/-{7}/, '______').trim() : null });
      }
    }
  }
  return vocabIndex;
}
export function vocabPool() { return [...(vocabIndex || buildVocabIndex()).values()]; }

on('word', (el) => {
  const idx = vocabIndex || buildVocabIndex();
  const v = idx.get(el.dataset.w.toLowerCase());
  if (!v) return;
  const saved = !!C.state.vocab[v.w.toLowerCase()];
  sheet(`<h3>${h(v.w)} <span class="tag">${h(v.pos || '')}</span></h3><p style="font-size:18px;margin:4px 0 10px">${h(v.m)}</p>
    ${v.ctx ? `<div class="card small"><div class="xs muted">문제 속 문맥</div>${h(v.ctx)}</div>` : ''}${v.ex ? `<div class="card small"><div class="xs muted">예문</div>${h(v.ex)}</div>` : ''}
    <div class="stack"><button class="btn primary block" data-act="saveWord" data-w="${h(v.w)}" ${saved ? 'disabled' : ''}>${saved ? '단어장에 있음' : '단어장에 저장'}</button><button class="btn ghost block" data-act="closeSheet">닫기</button></div>`);
});
on('saveWord', (el) => {
  const v = (vocabIndex || buildVocabIndex()).get(el.dataset.w.toLowerCase());
  if (!v) return;
  C.state.vocab[v.w.toLowerCase()] = { w: v.w, m: v.m, pos: v.pos || '', ctx: v.ctx, qid: v.qid, added: Date.now(), box: 0, due: Date.now(), right: 0, wrong: 0 };
  C.save(['vocab']);
  el.disabled = true;
  el.textContent = '저장했습니다';
});

// ---------- 훈련 ----------
export function renderTrain(kind) {
  if (kind === 'para') return renderPara();
  if (kind === 'vocab') return renderVocab();
  return `<div class="page"><p>알 수 없는 훈련</p></div>`;
}

// 패러프레이즈
const PT = { cur: null, chosen: null, right: 0, total: 0, mode: 'quiz' };
function paraPool() {
  const out = [];
  for (const u of C.bank.units) for (const q of questionsOf(u)) for (const p of q.para || []) out.push({ ...p, q, unit: u });
  return out;
}
function newParaQ() {
  const pool = paraPool();
  const wrongQ = new Set(C.state.attempts.filter((a) => !a.correct).map((a) => a.qid));
  const pref = pool.filter((x) => wrongQ.has(x.q.id));
  const item = C.rng.pick(pref.length && C.rng() < 0.6 ? pref : pool);
  // 선택지는 그 문제의 실제 선택지라 형태가 비슷해 정답이 티 나지 않는다
  PT.cur = { item, opts: item.q.choices.slice(), answer: item.q.answer };
  PT.chosen = null;
}
function renderPara() {
  const pool = paraPool();
  if (!PT.cur) newParaQ();
  let html = `<div class="page"><h1>바꿔 말하기 훈련</h1>
    <div class="seg"><button data-act="ptMode" data-m="quiz" aria-pressed="${PT.mode === 'quiz'}">퀴즈</button><button data-act="ptMode" data-m="list" aria-pressed="${PT.mode === 'list'}">짝 모아 보기</button></div>`;
  if (PT.mode === 'list') {
    html += `<p class="small muted">지문 표현과 정답 표현 ${pool.length}쌍</p>` + pool.map((p) => `<div class="card small"><div class="xs muted">P${p.unit.part} · ${h(conceptName(C.bank, p.q.concept))}</div>${h(p.p)}<br>→ <b>${h(p.a)}</b></div>`).join('');
    return html + '</div>';
  }
  const { item, opts } = PT.cur;
  html += `<p class="small">맞힘 ${PT.right}/${PT.total}</p>
    <div class="card"><div class="xs muted">Part ${item.unit.part} · ${h(item.q.question || '')}</div><p style="font-size:17px;margin:8px 0 0">지문 표현: <b>${h(item.p)}</b></p></div>
    <p class="small muted">이 지문 표현을 바꿔 말한 선택지</p><div class="choices">${opts.map((o, i) => {
      let cls = 'choice';
      if (PT.chosen != null) { if (i === PT.cur.answer) cls += ' right'; else if (PT.chosen === i) cls += ' wrong'; }
      return `<button class="${cls}" data-act="ptChoose" data-i="${i}"><span class="L">${LETTERS[i]}</span><span>${h(o)}</span></button>`;
    }).join('')}</div>`;
  if (PT.chosen != null) html += `<div class="card small"><b>짝</b><br>지문: ${h(item.p)}<br>정답: <b>${h(item.a)}</b></div><div class="foot-actions"><button class="btn primary" data-act="ptNext">다음</button></div>`;
  return html + '</div>';
}
on('ptMode', (el) => { PT.mode = el.dataset.m; C.render(); });
on('ptChoose', (el) => {
  if (PT.chosen != null) return;
  PT.chosen = Number(el.dataset.i);
  PT.total++;
  if (PT.chosen === PT.cur.answer) PT.right++;
  const k = dayKey(Date.now());
  C.state.studyLog[k] = (C.state.studyLog[k] || 0) + 15;
  C.save(['studyLog']);
  C.render();
});
on('ptNext', () => { newParaQ(); C.render(); });

// 단어장
const VT = { mode: 'quiz', cur: null, chosen: null, hideMeaning: false };
const BOX_DAYS = [0, 1, 2, 4, 8, 16, 32];
function vocabOptions(entry) {
  const pool = vocabPool().filter((v) => v.m !== entry.m && v.w.toLowerCase() !== entry.w.toLowerCase());
  const samePos = pool.filter((v) => (v.pos || '') === (entry.pos || ''));
  const close = (samePos.length >= 3 ? samePos : pool).filter((v) => Math.abs(v.m.length - entry.m.length) <= 4);
  const src = close.length >= 3 ? close : samePos.length >= 3 ? samePos : pool;
  const picks = C.rng.shuffle(src).slice(0, 3).map((v) => v.m);
  return C.rng.shuffle([entry.m, ...picks]);
}
function newVocabQ() {
  const now = Date.now();
  const list = Object.values(C.state.vocab);
  if (!list.length) { VT.cur = null; return; }
  const due = list.filter((v) => (v.due || 0) <= now).sort((a, b) => (a.box || 0) - (b.box || 0));
  const entry = due.length ? due[0] : C.rng.pick(list);
  VT.cur = { entry, opts: vocabOptions(entry) };
  VT.chosen = null;
}
function renderVocab() {
  const list = Object.values(C.state.vocab).sort((a, b) => b.added - a.added);
  let html = `<div class="page"><h1>단어장 <span class="muted small">${list.length}개</span></h1>
    <div class="seg"><button data-act="vtMode" data-m="quiz" aria-pressed="${VT.mode === 'quiz'}">퀴즈</button><button data-act="vtMode" data-m="list" aria-pressed="${VT.mode === 'list'}">목록</button></div>`;
  if (list.length < 4) {
    html += `<div class="card small">해설의 단어를 탭해 저장하면 여기에 쌓입니다. 퀴즈는 4개부터 열립니다.
      <button class="btn block" style="margin-top:8px" data-act="vtSeed">틀린 문제의 어휘 자동 추가</button></div>`;
  }
  if (VT.mode === 'list') {
    html += list.map((v) => `<div class="list-item"><div class="grow"><b>${h(v.w)}</b> <span class="tag">${h(v.pos || '')}</span> ${VT.hideMeaning ? '' : `<span>${h(v.m)}</span>`}${v.ctx ? `<div class="xs muted">${h(v.ctx)}</div>` : ''}</div><button class="btn sm ghost" data-act="vtDel" data-w="${h(v.w.toLowerCase())}">삭제</button></div>`).join('');
    html += list.length ? `<button class="btn block ghost" data-act="vtHide">${VT.hideMeaning ? '뜻 보이기' : '뜻 가리기'}</button>` : '';
    return html + '</div>';
  }
  if (list.length < 4) return html + '</div>';
  if (!VT.cur || !C.state.vocab[VT.cur.entry.w.toLowerCase()]) newVocabQ();
  const { entry, opts } = VT.cur;
  html += `<div class="card"><div class="row between"><b style="font-size:22px">${h(entry.w)}</b><span class="tag">${h(entry.pos || '')} · ${entry.box || 0}단계</span></div>${entry.ctx ? `<p class="small muted" style="margin:6px 0 0">${h(entry.ctx)}</p>` : ''}</div>
    <div class="choices">${opts.map((o, i) => {
      let cls = 'choice';
      if (VT.chosen != null) { if (o === entry.m) cls += ' right'; else if (VT.chosen === i) cls += ' wrong'; }
      return `<button class="${cls}" data-act="vtChoose" data-i="${i}"><span class="L">${LETTERS[i]}</span><span>${h(o)}</span></button>`;
    }).join('')}</div>`;
  if (VT.chosen != null) html += `<div class="foot-actions"><button class="btn primary" data-act="vtNext">다음</button></div>`;
  return html + '</div>';
}
on('vtMode', (el) => { VT.mode = el.dataset.m; C.render(); });
on('vtHide', () => { VT.hideMeaning = !VT.hideMeaning; C.render(); });
on('vtDel', (el) => { delete C.state.vocab[el.dataset.w]; C.save(['vocab']); C.render(); });
on('vtSeed', () => {
  const idx = vocabIndex || buildVocabIndex();
  const wrongQ = [...new Set(C.state.attempts.filter((a) => !a.correct).map((a) => a.qid))];
  let added = 0;
  for (const qid of wrongQ) {
    const ref = C.bank.qById.get(qid);
    if (!ref) continue;
    for (const v of ref.q.vocab || []) {
      const key = v.w.toLowerCase();
      if (C.state.vocab[key]) continue;
      const iv = idx.get(key) || v;
      C.state.vocab[key] = { w: v.w, m: v.m, pos: v.pos || '', ctx: iv.ctx || null, qid, added: Date.now(), box: 0, due: Date.now(), right: 0, wrong: 0 };
      added++;
    }
  }
  C.save(['vocab']);
  toast(added ? `${added}개 추가했습니다` : '추가할 어휘가 없습니다. 먼저 문제를 풀어 보세요.');
  C.render();
});
on('vtChoose', (el) => {
  if (VT.chosen != null) return;
  VT.chosen = Number(el.dataset.i);
  const e = C.state.vocab[VT.cur.entry.w.toLowerCase()];
  const ok = VT.cur.opts[VT.chosen] === e.m;
  if (ok) { e.box = Math.min(6, (e.box || 0) + 1); e.right = (e.right || 0) + 1; e.due = Date.now() + BOX_DAYS[e.box] * DAY; } else { e.box = 0; e.wrong = (e.wrong || 0) + 1; e.due = Date.now() + 10 * 60 * 1000; }
  const k = dayKey(Date.now());
  C.state.studyLog[k] = (C.state.studyLog[k] || 0) + 8;
  C.save(['vocab', 'studyLog']);
  C.render();
});
on('vtNext', () => { newVocabQ(); C.render(); });

// ---------- 계산 방식 ----------
export function renderAbout() {
  return `<div class="page"><h1>추정 점수 계산 방식</h1>
  <div class="card small stack">
    <p><b>쓰는 기록</b><br>최근 90일 RC 풀이의 정답 여부, 문항 난이도, 풀이 시간, 파트별 성취도. 같은 문제 재풀이와 단계별 복습 기록은 뺍니다. 진단·모의고사는 가중치 1, 일반 연습은 0.6입니다.</p>
    <p><b>계산 순서</b><br>1. 난이도와 찍어서 맞힐 확률을 넣은 문항반응 모델로 능력값 분포를 구합니다. 실제 시험 파트 비중으로 가중해 많이 푼 파트가 결과를 독점하지 않게 합니다. Part 7은 RC의 54%입니다.<br>
    2. 파트별 능력값은 전체 능력값 쪽으로 당겨 기록이 적은 파트가 튀지 않게 합니다.<br>
    3. 실제 시험 문항 수와 가정한 난이도 분포로 예상 원점수를 구합니다. 내 풀이 속도로 75분 안에 못 푸는 문항은 찍는다고 보고 깎습니다.<br>
    4. 원점수 비율을 근사 환산표로 5~495점으로 바꿉니다.<br>
    5. 능력값 분포의 10~90% 구간에 환산표 오차 20점과 안 풀어 본 파트 비중만큼을 더해 범위로 표시합니다. 15문항 미만이거나 파트 비중 절반 이상을 안 풀었으면 점수 대신 학습 수준만 보여 줍니다.</p>
    <p><b>최근 RC 점수</b><br>목표 화면의 최근 RC 점수는 기록이 적을 때만 약하게 반영됩니다. 기본값은 360입니다.</p>
    <p><b>한계</b><br>검증된 환산 모델이 아닙니다. 난이도는 작성자가 매긴 값이고 응시자 데이터로 보정하지 않았습니다. 환산표도 공식 표가 아닙니다. 실제 점수를 정확히 예측하지 않으며 학습 방향을 잡는 참고치입니다.</p>
  </div><a class="btn block" href="#stats">기록으로</a></div>`;
}
