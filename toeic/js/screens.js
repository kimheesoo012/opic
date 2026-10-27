// 복습·기록·설정·훈련·계산 방식 화면
import { C } from './ctx.js';
import { questionsOf, conceptName } from './bank.js';
import { dueCards, STAGES } from './review.js';
import { partStats, weakConcepts, causeDist, retentionStats, CAUSES, todayAttempts, todayStudySec } from './stats.js';
import { newSession } from './sessions.js';
import { pct, dayKey, fmtMin, PART_NAMES, DAY, LETTERS, makeRng } from './util.js';
import { h, on, toast, sheet, closeSheet, copyText, download } from './ui.js';
import { startSession, stageDots, scriptHtml, playTrainUnit, stopTrainAudio, ttsOK, TTS_NOTE } from './player.js';
import { accentOf, ACCENT_LABEL } from './tts.js';
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
  if (!due.length && !later.length) html += `<p class="muted small">틀린 문제가 생기면 그 유형이 여기에 쌓입니다. 개념 → 쉬운 문제 → 어려운 문제 → 제한 시간 → 1·3·7일 뒤 새 문제 순서로 복습합니다.</p>`;
  if (due.length) {
    html += `<button class="btn primary block" data-act="startReview">지금 복습 (${Math.min(due.length, 5)}개 유형)</button>`;
    html += due.map((c) => `<div class="card"><div class="row between"><b>${partOf(c.concept)}${h(conceptName(C.bank, c.concept))}</b><span class="tag accent">지금</span></div>${stageDots(c.stage)}</div>`).join('');
  }
  if (later.length) {
    html += `<h2>예정</h2>` + later.slice(0, 12).map((c) => `<div class="list-item"><div class="grow"><b class="small">${partOf(c.concept)}${h(conceptName(C.bank, c.concept))}</b>${stageDots(c.stage)}</div><span class="tag">${days(c.due - now)}</span></div>`).join('');
  }
  const notes = Object.values(st.wrongNote).sort((a, b) => b.lastT - a.lastT);
  const filter = C.wnFilter || 0;
  const shown = notes.filter((n) => !filter || n.part === filter);
  html += `<h2>오답노트 <span class="muted small">${notes.length}문항</span></h2>
    <div class="row wrap" style="gap:6px">${[0, 1, 2, 3, 4, 5, 6, 7].map((p) => `<button class="chip" data-act="wnFilter" data-p="${p}" aria-pressed="${filter === p}">${p ? `P${p}` : '전체'}</button>`).join('')}</div>`;
  if (shown.length) {
    html += `<button class="btn block" style="margin-top:10px" data-act="wnAll">아직 다시 맞히지 못한 문제 풀기 (${Math.min(shown.filter((n) => !n.rightAfter).length, 10)})</button>`;
    html += shown.slice(0, 40).map((n) => {
      const ref = C.bank.qById.get(n.qid);
      if (!ref) return '';
      const label = ref.unit.part === 1 ? `사진: ${ref.unit.image.alt}` : ref.unit.part === 6 ? `빈칸 (${ref.q.blank})` : ref.q.question;
      return `<div class="list-item"><div class="grow"><div class="xs muted">P${n.part} · ${h(conceptName(C.bank, n.concept))} · 틀림 ${n.wrongCount}${n.rightAfter ? ` · 이후 정답 ${n.rightAfter}` : ''}${n.cause ? ` · ${h(CAUSES.find((c) => c.id === n.cause)?.label || '')}` : ''}</div>
        <div class="small">${h(String(label || '').slice(0, 80))}</div></div><button class="btn sm" data-act="wnOne" data-q="${n.qid}">다시</button></div>`;
    }).join('');
  } else html += `<p class="muted small">해당하는 오답이 없습니다.</p>`;
  const r = retentionStats(st.attempts);
  html += `<h2>복습 효과</h2><div class="card small">같은 문제 다시 맞힘: <b>${r.repeatRight}/${r.repeatTotal}</b><br>같은 개념의 새 문제 맞힘: <b>${r.newRight}/${r.newTotal}</b>
    <p class="xs muted" style="margin:6px 0 0">같은 문제를 다시 맞힌 것(기억)과 새 문제를 맞힌 것(이해)을 따로 기록합니다.</p></div>
    <h2>단어장 <span class="muted small">${Object.keys(st.vocab).length}개</span></h2><a class="btn block" href="#train-vocab">단어장 열기</a></div>`;
  return html;
}
on('startReview', () => {
  const due = dueCards(C.state.reviews, Date.now());
  const s = newSession('review', { concepts: due.slice(0, 5).map((c) => c.concept) }, env());
  if (!s) { toast('지금 복습할 단계가 없습니다.'); return; }
  startSession(s);
});
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
  const lines = [`[토익 훈련 요약] ${dayKey(Date.now())}`];
  lines.push(`오늘 푼 문제: ${today.length}문항${today.length ? ` (정답률 ${pct(today.filter((a) => a.correct).length / today.length)}%)` : ''}, 학습 ${fmtMin(todayStudySec(st.studyLog))}`);
  const ps = partStats(today.length ? today : st.attempts);
  const parts = [1, 2, 3, 4, 5, 6, 7].filter((p) => ps[p].n).map((p) => `P${p} ${pct(ps[p].acc)}%(${ps[p].n})`);
  lines.push(`파트별 정답률${today.length ? '(오늘)' : '(전체)'}: ${parts.join(', ') || '기록 없음'}`);
  const weak = weakConcepts(st.attempts, 3);
  lines.push(`약점 유형: ${weak.length ? weak.map((w) => `${conceptName(C.bank, w.concept)} ${pct(w.acc)}%(${w.n})`).join(', ') : '아직 판단할 기록 부족'}`);
  lines.push(est.enough ? `추정 점수: ${est.total.lo}–${est.total.hi} (추정치, 공식 환산 아님) · 목표 ${st.profile.goal}` : `학습 수준: ${est.level} (데이터 부족) · 목표 ${st.profile.goal}`);
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
    ${[1, 2, 3, 4, 5, 6, 7].map((p) => `<tr><td>P${p} ${PART_NAMES[p]}</td><td class="num">${ps[p].n}</td><td class="num">${ps[p].n ? pct(ps[p].acc) + '%' : '–'}</td><td class="num">${ps[p].avgSec != null ? `${Math.round(ps[p].avgSec)}초${p >= 5 && ps[p].target ? `<div class="xs muted">목표 ${ps[p].target}초</div>` : ''}` : '–'}</td></tr>`).join('')}</tbody></table>
    <p class="xs muted" style="margin:6px 0 0">LC 시간은 음성이 끝난 뒤 답할 때까지의 시간입니다.</p></div>`;
  html += `<div class="card"><h3>자주 틀리는 유형 TOP 3</h3>${weak.length ? weak.map((w, i) => `<div class="list-item"><b>${i + 1}</b><div class="grow">${h(conceptName(C.bank, w.concept))}<div class="xs muted">정답률 ${pct(w.acc)}% · ${w.n}문항${w.avgSec != null ? ` · 평균 ${Math.round(w.avgSec)}초` : ''}</div></div><button class="btn sm" data-act="drillConcept" data-c="${w.concept}">연습</button></div>`).join('') : '<p class="small muted">유형별로 4문항 이상 풀어야 약점으로 판단합니다. 아직 기록이 부족합니다.</p>'}</div>`;
  html += `<div class="card"><h3>오답 원인 분포</h3>${causeTotal ? CAUSES.map((c) => `<div class="dist-row"><span>${c.label}</span><div class="bar"><i style="width:${pct((causes[c.id] || 0) / causeTotal)}%"></i></div><span class="xs muted">${causes[c.id] || 0}</span></div>`).join('') : '<p class="small muted">오답 해설 아래에서 원인을 탭하면 여기에 모입니다.</p>'}</div>`;
  const r = retentionStats(st.attempts);
  html += `<div class="card"><h3>복습 효과</h3><div class="small">같은 문제 다시 맞힘 ${r.repeatRight}/${r.repeatTotal} · 같은 개념 새 문제 맞힘 ${r.newRight}/${r.newTotal}</div></div>`;
  html += `<div class="card"><h3>결과 요약</h3><pre class="small" style="white-space:pre-wrap;margin:0 0 8px">${h(summaryText())}</pre><button class="btn primary block" data-act="copySummary">결과 요약 복사</button></div>`;
  html += `<div class="card"><h3>학습 기록 백업</h3><p class="xs muted" style="margin:0 0 8px">기록은 이 기기의 브라우저에만 저장됩니다. 다른 기기로 옮기거나 백업하려면 내보내세요.</p>
    <div class="row"><button class="btn grow" data-act="exportData">JSON 내보내기</button><button class="btn grow" data-act="importPick">가져오기</button></div>
    <input type="file" accept="application/json,.json" class="hidden" id="importFile" data-change="importFile"></div></div>`;
  return html;
}
on('drillConcept', (el) => startSession(newSession('drill', { concept: el.dataset.c, nQ: 6 }, env())));
on('copySummary', async () => { toast((await copyText(summaryText())) ? '복사했습니다' : '복사하지 못했습니다. 텍스트를 길게 눌러 복사하세요.'); });
on('exportData', async () => {
  const data = C.store.exportData(C.version);
  data.dataVersion = C.dataVersion;
  const text = JSON.stringify(data);
  if (C.embedded) {
    // 미리보기 페이지(Artifact)는 파일 저장이 막혀 있어 클립보드로 대신한다
    const ok = await copyText(text);
    sheet(`<h3>기록 JSON ${ok ? '복사됨' : '복사 실패'}</h3><p class="small">이 미리보기 페이지에서는 파일 저장이 막혀 있어 ${ok ? '클립보드에 복사했습니다. 메모 앱 등에 붙여 넣어 .json 파일로 저장하세요.' : '복사도 실패했습니다. 설치형(GitHub Pages) 버전에서 내보내기를 쓰세요.'}</p><button class="btn block" data-act="closeSheet">닫기</button>`);
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
  sheet(`<h3>기록을 바꿀까요?</h3><p class="small">파일의 기록 ${obj.data.attempts.length}문항(내보낸 날 ${h(String(obj.exportedAt || '').slice(0, 10))})으로 현재 기록 ${C.state.attempts.length}문항을 대체합니다. ${C.embedded ? '이 미리보기에서는 자동 백업 파일을 저장할 수 없으니, 필요하면 먼저 "내보내기"로 현재 기록을 복사해 두세요.' : '현재 기록은 먼저 자동으로 내려받아 둡니다.'}</p>
    <div class="stack"><button class="btn primary block" data-act="importConfirm">바꾸기</button><button class="btn block ghost" data-act="closeSheet">취소</button></div>`);
});
on('importConfirm', async () => {
  const obj = C.pendingImport;
  C.pendingImport = null;
  closeSheet();
  if (!obj) return;
  if (!C.embedded) download(`toeic-trainer-backup-before-import-${Date.now()}.json`, JSON.stringify(C.store.exportData(C.version)));
  const r = await C.store.importData(obj);
  if (!r.ok) { toast('가져오기 실패 — 기존 기록은 그대로입니다.'); return; }
  C.applyTheme();
  toast(`${r.count}문항 기록을 가져왔습니다`);
  C.render();
});

// ---------- 설정 ----------
export function renderSettings() {
  const st = C.state;
  const s = st.settings;
  const voices = C.tts.voices || [];
  const byAcc = {};
  for (const v of voices) (byAcc[accentOf(v)] ||= []).push(v);
  let html = `<div class="page"><h1>설정</h1>
    <div class="card"><div class="row between"><div><h3>목표 점수</h3><div class="small muted">${st.profile.goal}점</div></div><a class="btn sm" href="#goal">바꾸기</a></div></div>
    <div class="card"><h3>듣기 음성</h3><p class="tts-note">${TTS_NOTE}</p>`;
  if (!C.tts.supported) html += `<div class="notice">이 브라우저는 음성 합성을 지원하지 않습니다. LC 문제는 스크립트를 보며 진행됩니다.</div>`;
  else if (!voices.length) html += `<div class="notice">설치된 영어 음성을 찾지 못했습니다. 기기 설정에서 영어 TTS 음성을 설치하면 여기에 나타납니다. 그 전까지 LC는 스크립트로 진행됩니다.</div>`;
  else {
    html += `<p class="small muted">이 기기에 설치된 영어 음성 ${voices.length}개. 화자마다 억양을 다르게 배정합니다(해당 억양 음성이 없으면 다른 음성으로 대체).</p>`;
    for (const acc of ['US', 'GB', 'AU']) {
      const list = byAcc[acc] || [];
      html += `<label class="field"><span>${ACCENT_LABEL[acc]} 억양 화자 ${list.length ? '' : '— 설치된 음성 없음'}</span>
        <div class="row"><select class="grow" data-change="voicePref" data-acc="${acc}" ${list.length ? '' : 'disabled'}><option value="">자동 선택</option>${list.map((v) => `<option value="${h(v.voiceURI)}" ${s.voices && s.voices[acc] === v.voiceURI ? 'selected' : ''}>${h(v.name)} (${h(v.lang)})</option>`).join('')}</select>
        <button class="btn sm" data-act="voiceTest" data-acc="${acc}" ${list.length ? '' : 'disabled'}>테스트</button></div></label>`;
    }
    const others = Object.keys(byAcc).filter((a) => !['US', 'GB', 'AU'].includes(a));
    if (others.length) html += `<p class="xs muted">그 밖의 영어 음성: ${others.map((a) => `${ACCENT_LABEL[a] || a} ${byAcc[a].length}개`).join(', ')}</p>`;
    html += `<p class="xs muted">음성 합성이 오프라인에서 되는지는 기기와 음성 종류에 따라 다릅니다.</p>`;
  }
  html += `<div class="row between" style="margin-top:8px"><span>재생 속도</span><div class="seg">${[0.8, 1, 1.2].map((r) => `<button data-act="rate" data-r="${r}" aria-pressed="${(s.rate || 1) === r}">${r.toFixed(1)}x</button>`).join('')}</div></div>
    <div class="row between" style="margin-top:8px"><span>Part 3·4 문제 먼저 읽기</span><div class="seg"><button data-act="setOpt" data-k="preview" data-v="1" aria-pressed="${!!s.preview}">켜기</button><button data-act="setOpt" data-k="preview" data-v="0" aria-pressed="${!s.preview}">끄기</button></div></div>
    <div class="row between" style="margin-top:8px"><span>LC 자동 재생</span><div class="seg"><button data-act="setOpt" data-k="autoplay" data-v="1" aria-pressed="${s.autoplay !== false}">켜기</button><button data-act="setOpt" data-k="autoplay" data-v="0" aria-pressed="${s.autoplay === false}">끄기</button></div></div></div>
    <div class="card"><h3>화면</h3><div class="seg" style="display:flex">${[['auto', '기기 설정'], ['light', '밝게'], ['dark', '어둡게']].map(([k, l]) => `<button style="flex:1" data-act="theme" data-t="${k}" aria-pressed="${(s.theme || 'auto') === k}">${l}</button>`).join('')}</div></div>
    <div class="card"><h3>데이터</h3><div class="stack"><button class="btn block" data-act="exportData">학습 기록 내보내기 (JSON)</button><button class="btn block" data-act="importPick">학습 기록 가져오기</button><button class="btn block ghost" data-act="resetAsk">모든 기록 지우기</button></div>
      <input type="file" accept="application/json,.json" class="hidden" id="importFile" data-change="importFile"></div>
    <div class="card small"><h3>앱 정보</h3>앱 ${h(C.version)} · 문제은행 ${h(C.dataVersion)}<br>문항 ${[1, 2, 3, 4, 5, 6, 7].map((p) => `P${p} ${C.bank.count(p)}`).join(' · ')} (총 ${[1, 2, 3, 4, 5, 6, 7].reduce((a, p) => a + C.bank.count(p), 0)})<br>저장 방식: ${h(C.store.adapter.kind)}<br><a href="#about">추정 점수 계산 방식과 한계</a>
      <p class="xs muted">모든 문제는 이 앱을 위해 새로 작성했습니다. 실제 시험·교재 문제가 아니며 TOEIC은 ETS의 등록 상표입니다.</p></div></div>`;
  return html;
}
on('voicePref', (el) => {
  const v = C.state.settings.voices || {};
  if (el.value) v[el.dataset.acc] = el.value; else delete v[el.dataset.acc];
  C.state.settings.voices = v;
  C.save(['settings']);
});
on('voiceTest', (el) => {
  const acc = el.dataset.acc;
  playTrainUnit({ part: 4, speakers: { S: { g: 'f', accent: acc } }, script: [{ s: 'S', t: 'Thank you for calling. Your order will be shipped on Friday.' }] });
});
on('setOpt', (el) => { C.state.settings[el.dataset.k] = el.dataset.v === '1'; C.save(['settings']); C.render(); });
on('theme', (el) => { C.state.settings.theme = el.dataset.t; C.save(['settings']); C.applyTheme(); C.render(); });
on('resetAsk', () => sheet(`<h3>모든 기록을 지울까요?</h3><p class="small">풀이 기록, 복습 카드, 단어장, 설정이 모두 지워집니다. 되돌릴 수 없으니 먼저 내보내기를 권합니다.</p>
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
    const texts = [u.question, ...(u.passages || []).map((p) => p.text), ...(u.script || []).map((l) => l.t), ...(u.questions || []).map((q) => q.question)];
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
  stopTrainAudio();
  if (kind === 'listen') return renderListen();
  if (kind === 'para') return renderPara();
  if (kind === 'vocab') return renderVocab();
  return `<div class="page"><p>알 수 없는 훈련</p></div>`;
}

// LC 반복 듣기·받아쓰기
const LT = { mode: 'repeat', masked: false, picks: {}, unitId: null };
function pickListenUnit(prefer = true) {
  const pool = [...(C.bank.byPart[3] || []), ...(C.bank.byPart[4] || [])];
  const missed = new Set(C.state.attempts.filter((a) => a.part >= 3 && a.part <= 4 && (!a.correct || a.cause === 'listen')).map((a) => a.unitId));
  const pref = pool.filter((u) => missed.has(u.id) && u.id !== LT.unitId);
  const list = prefer && pref.length ? pref : pool.filter((u) => u.id !== LT.unitId);
  return C.rng.pick(list);
}
const STOP = new Set(['about', 'there', 'their', 'which', 'would', 'could', 'should', 'these', 'those', 'where', 'while', 'after', 'before', 'because', 'thanks', 'hello']);
function keyword(text) {
  const words = text.match(/[A-Za-z][a-z']+/g) || [];
  const cands = words.filter((w, i) => w.length >= 5 && !STOP.has(w.toLowerCase()) && !(i > 0 && /^[A-Z]/.test(w)));
  if (!cands.length) return null;
  return cands.sort((a, b) => b.length - a.length)[0];
}
function wordOptions(answer, seedStr) {
  let seed = 0;
  for (const ch of seedStr) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = makeRng(seed);
  const pool = new Set();
  for (const u of [...(C.bank.byPart[3] || []), ...(C.bank.byPart[4] || []), ...(C.bank.byPart[2] || [])]) {
    const texts = u.script ? u.script.map((l) => l.t) : [u.question, ...u.choices];
    for (const t of texts) for (const w of t.match(/[a-z][a-z']{3,}/g) || []) pool.add(w);
  }
  const a = answer.toLowerCase();
  let cands = [...pool].filter((w) => w !== a && Math.abs(w.length - a.length) <= 2);
  const same = cands.filter((w) => w[0] === a[0]);
  cands = rng.shuffle(same.length >= 3 ? same : cands).slice(0, 3);
  return rng.shuffle([a, ...cands]);
}
function renderListen() {
  if (!LT.unitId || !C.bank.unitById.get(LT.unitId)) { LT.unitId = pickListenUnit().id; LT.picks = {}; }
  const unit = C.bank.unitById.get(LT.unitId);
  C.trainUnit = unit;
  let html = `<div class="page"><h1>LC 반복 듣기·받아쓰기</h1><p class="tts-note">${TTS_NOTE}</p>
    ${ttsOK() ? '' : '<div class="notice">이 기기에서는 영어 음성 합성을 쓸 수 없어 스크립트 읽기로만 진행됩니다.</div>'}
    <div class="row between wrap" style="gap:8px"><div class="seg"><button data-act="ltMode" data-m="repeat" aria-pressed="${LT.mode === 'repeat'}">반복 듣기</button><button data-act="ltMode" data-m="dict" aria-pressed="${LT.mode === 'dict'}">받아쓰기</button></div>
    <button class="btn sm" data-act="ltNext">다른 대화</button></div>
    <div class="player" style="margin-top:10px"><button class="btn sm" data-act="ltPlayAll" ${ttsOK() ? '' : 'disabled'}>▶ 전체 듣기</button><div class="seg">${[0.8, 1, 1.2].map((r) => `<button data-act="rate" data-r="${r}" aria-pressed="${(C.state.settings.rate || 1) === r}">${r.toFixed(1)}x</button>`).join('')}</div>
    ${LT.mode === 'repeat' ? `<button class="btn sm ghost" data-act="ltMask">${LT.masked ? '스크립트 보이기' : '스크립트 가리기'}</button>` : ''}</div>
    <p class="xs muted">Part ${unit.part} · ${h(unit.id)} — 각 문장 ▶를 눌러 문장 단위로 반복해 들을 수 있습니다.</p>`;
  if (LT.mode === 'repeat') {
    html += scriptHtml(unit, { masked: LT.masked && ttsOK() });
  } else {
    html += `<div class="script">${unit.script.map((l, i) => {
      const kw = keyword(l.t);
      if (!kw) return `<div class="ln" data-i="${i}"><span class="sp">${h(l.s)}</span><span class="tx">${h(l.t)}</span>${ttsOK() ? `<button class="play1" data-act="playLine" data-i="${i}">▶</button>` : ''}</div>`;
      const pick = LT.picks[i];
      const opts = wordOptions(kw, `${unit.id}-${i}`);
      const shown = pick ? h(l.t).replace(new RegExp(`\\b${kw}\\b`), `<b class="${pick === kw.toLowerCase() ? 'done-mark' : ''}" style="${pick === kw.toLowerCase() ? '' : 'color:var(--bad)'}">${h(kw)}</b>`) : h(l.t).replace(new RegExp(`\\b${kw}\\b`), '<span class="blank" style="display:inline-block;min-width:60px;border-bottom:2px solid var(--text)"></span>');
      return `<div class="ln" data-i="${i}"><span class="sp">${h(l.s)}</span><div class="tx">${shown}
        ${pick ? '' : `<div class="row wrap" style="gap:6px;margin-top:6px">${opts.map((o) => `<button class="chip" data-act="ltPick" data-i="${i}" data-w="${h(o)}" data-k="${h(kw.toLowerCase())}">${h(o)}</button>`).join('')}</div>`}</div>
        ${ttsOK() ? `<button class="play1" data-act="playLine" data-i="${i}" aria-label="이 문장 듣기">▶</button>` : ''}</div>`;
    }).join('')}</div>`;
    const done = Object.keys(LT.picks).length;
    const right = Object.entries(LT.picks).filter(([i, w]) => (keyword(unit.script[i].t) || '').toLowerCase() === w).length;
    html += `<p class="small">맞힘 ${right}/${done}</p>`;
  }
  html += `</div>`;
  return html;
}
on('ltMode', (el) => { LT.mode = el.dataset.m; C.render(); });
on('ltMask', () => { LT.masked = !LT.masked; C.render(); });
on('ltNext', () => { LT.unitId = pickListenUnit().id; LT.picks = {}; C.render(); });
on('ltPlayAll', () => playTrainUnit(C.bank.unitById.get(LT.unitId)));
on('ltPick', (el) => {
  LT.picks[el.dataset.i] = el.dataset.w;
  const k = dayKey(Date.now());
  C.state.studyLog[k] = (C.state.studyLog[k] || 0) + 10;
  C.save(['studyLog']);
  C.render();
});

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
  // 선택지는 그 문제의 실제 선택지(비슷한 형태라 정답이 티 나지 않음)
  PT.cur = { item, opts: item.q.choices.slice(), answer: item.q.answer };
  PT.chosen = null;
}
function renderPara() {
  const pool = paraPool();
  if (!PT.cur) newParaQ();
  let html = `<div class="page"><h1>RC 패러프레이즈 훈련</h1>
    <div class="seg"><button data-act="ptMode" data-m="quiz" aria-pressed="${PT.mode === 'quiz'}">퀴즈</button><button data-act="ptMode" data-m="list" aria-pressed="${PT.mode === 'list'}">짝 모아 보기</button></div>`;
  if (PT.mode === 'list') {
    html += `<p class="small muted">지문(대화) 표현 → 정답 표현 ${pool.length}쌍</p>` + pool.map((p) => `<div class="card small"><div class="xs muted">P${p.unit.part} · ${h(conceptName(C.bank, p.q.concept))}</div>${h(p.p)}<br>→ <b>${h(p.a)}</b></div>`).join('');
    return html + '</div>';
  }
  const { item, opts } = PT.cur;
  html += `<p class="small">맞힘 ${PT.right}/${PT.total}</p>
    <div class="card"><div class="xs muted">Part ${item.unit.part} 문제: ${h(item.q.question || '')}</div><p style="font-size:17px;margin:8px 0 0">지문 표현: <b>${h(item.p)}</b></p></div>
    <p class="small muted">이 지문 표현을 바꿔 말한 선택지는?</p><div class="choices">${opts.map((o, i) => {
      let cls = 'choice';
      if (PT.chosen != null) { if (i === PT.cur.answer) cls += ' right'; else if (PT.chosen === i) cls += ' wrong'; }
      return `<button class="${cls}" data-act="ptChoose" data-i="${i}"><span class="L">${LETTERS[i]}</span><span>${h(o)}</span></button>`;
    }).join('')}</div>`;
  if (PT.chosen != null) html += `<div class="card small"><b>짝</b><br>지문: ${h(item.p)}<br>→ 정답 표현: <b>${h(item.a)}</b></div><div class="foot-actions"><button class="btn primary" data-act="ptNext">다음</button></div>`;
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
    html += `<div class="card small">문제 해설의 단어를 탭해 저장하면 여기에 쌓입니다. 지금은 ${list.length}개라 퀴즈를 만들기 어렵습니다.
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
    <p><b>무엇을 쓰나</b><br>최근 90일 풀이 기록의 정답 여부, 문항 난이도(1~5), 풀이 시간, 파트별 성취도. 같은 문제를 다시 푼 기록과 단계별 복습 기록은 제외합니다(기억 효과·약점 집중 편향). 진단·모의고사는 가중치 1, 일반 연습은 0.6.</p>
    <p><b>어떻게 계산하나</b><br>① 섹션(LC/RC)별로 난이도를 반영한 문항반응 모델(찍어서 맞힐 확률 포함)로 능력값의 분포를 구합니다. 많이 푼 파트가 결과를 독점하지 않도록 실제 시험의 파트 비중(예: Part 7은 RC의 54%)으로 가중합니다.<br>
    ② 파트별 능력값은 섹션 능력값 쪽으로 당겨서(수축) 기록이 적은 파트가 튀지 않게 합니다.<br>
    ③ 실제 시험의 파트별 문항 수와 가정한 난이도 분포로 예상 원점수 비율을 구하고, RC는 내 풀이 속도로 75분 안에 못 푸는 문항을 찍는다고 가정해 깎습니다.<br>
    ④ 원점수 비율을 경험적 근사표로 5~495점 섹션 점수로 바꿉니다.<br>
    ⑤ 능력값 분포의 10~90% 구간 + 환산표 오차(±20점) + 풀어 보지 않은 파트 비중만큼 범위를 넓혀 표시합니다. 기록이 적을수록 범위가 넓고, LC 8문항·RC 10문항 미만이거나 섹션 파트 절반 이상을 안 풀었으면 점수 대신 학습 수준만 표시합니다.</p>
    <p><b>최근 실제 점수</b><br>목표 화면에 입력하면(기본값: LC 395 · RC 360) 기록이 적을 때 약한 사전 정보로만 쓰입니다.</p>
    <p><b>한계</b><br>· 검증된 환산 모델이 아닙니다. 문항 난이도는 작성자가 매긴 값이고 실제 응시자 데이터로 보정하지 않았습니다.<br>· 원점수→환산 점수 표는 공식 표가 아니라 근사치입니다.<br>· TTS 음성은 실제 시험 녹음보다 쉽거나 어려울 수 있어 LC 추정 오차가 더 큽니다.<br>· 컨디션, 실제 시험 문제의 난이도 차이는 반영하지 못합니다.<br>따라서 실제 TOEIC 점수를 정확히 예측하지 않으며, 학습 방향을 잡는 참고치로만 쓰세요.</p>
  </div><a class="btn block" href="#stats">기록으로</a></div>`;
}
