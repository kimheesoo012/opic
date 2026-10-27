/* 앱 상태: IndexedDB 위의 얇은 계층. 메타데이터는 메모리에 캐시하고, 오디오는 필요할 때만 읽는다. */
(function (root) {
  'use strict';
  const { db, util, analysis, picker, backup, bank } = root.OPIC;

  const DEFAULT_SETTINGS = {
    targetLevel: 'IH', voiceName: '', rate: 1.0, stt: false, autoRecord: true, theme: 'dark',
    showTextPractice: false, lastExportAt: 0, survey: null, saLevel: 4, presets: null, installHintClosed: false
  };

  const S = {
    settings: Object.assign({}, DEFAULT_SETTINGS),
    qs: {},          // qid → 문제 상태
    recs: [],        // 녹음 메타(최신순)
    notes: [],
    scripts: [],
    sessions: [],
    recovered: [],
    listeners: new Set()
  };

  function emit() { S.listeners.forEach(f => { try { f(); } catch (e) {} }); }

  async function init() {
    await db.open();
    const [settings, qsArr, recs, notes, scripts, sessions] = await Promise.all([
      db.kvGet('settings', null), db.all('qstate'), db.all('recordings'), db.all('notes'), db.all('scripts'), db.all('sessions')
    ]);
    S.settings = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    S.qs = {}; qsArr.forEach(q => { S.qs[q.qid] = q; });
    S.recs = recs.sort((a, b) => b.createdAt - a.createdAt);
    S.notes = notes.sort((a, b) => b.createdAt - a.createdAt);
    S.scripts = scripts.sort((a, b) => b.updatedAt - a.updatedAt);
    S.sessions = sessions.sort((a, b) => b.startedAt - a.startedAt);
    /* 강제 종료 등으로 저장 못 한 녹음 복구 */
    S.recovered = await root.OPIC.recorder.recoverDrafts(async r => {
      const m = r.meta || {};
      await saveRecording(r, Object.assign({}, m, { recovered: true, createdAt: r.startedAt }));
    }).catch(() => []);
  }

  async function setSettings(patch) {
    Object.assign(S.settings, patch);
    await db.kvSet('settings', S.settings);
    emit();
  }

  function q(qid) {
    if (!S.qs[qid]) S.qs[qid] = { qid, lastAskedAt: 0, timesAsked: 0, review: false, feedback: null, retries: [], storyStage: 0 };
    return S.qs[qid];
  }
  async function saveQ(s) { S.qs[s.qid] = s; await db.put('qstate', s); emit(); }

  /* 질문을 출제했을 때(들었을 때) 기록 → 반복 출제 방지 */
  async function markAsked(qid) {
    if (!qid || !bank.byId[qid]) return;
    const s = q(qid);
    s.lastAskedAt = Date.now(); s.timesAsked = (s.timesAsked || 0) + 1;
    await saveQ(s);
  }

  /* 녹음 저장: r = recorder 결과, meta = { questionId, promptText, mode, kind?, sessionId, targets, storyStep, scriptId, transcript, transcriptSource } */
  async function saveRecording(r, meta) {
    if (!r.blob || !r.blob.size) throw new Error('녹음된 소리가 없습니다.');
    const now = meta.createdAt || Date.now();
    const qid = meta.questionId || null;
    const s = qid && bank.byId[qid] ? q(qid) : null;
    const env = Array.from(r.env || []);
    const rec = {
      id: r.recId || util.uid('rec'),
      questionId: qid,
      promptText: meta.promptText || (qid && bank.byId[qid] ? bank.byId[qid].text : ''),
      mode: meta.mode || 'practice',
      kind: meta.kind || (s ? picker.recordingKind(s, now) : 'first'),
      sessionId: meta.sessionId || null,
      scriptId: meta.scriptId || null,
      storyStep: meta.storyStep || null,
      createdAt: now,
      durationSec: Math.round((r.durationSec || 0) * 10) / 10,
      mime: r.mime || (r.blob && r.blob.type) || '',
      size: r.blob.size,
      env, fps: r.fps || 10,
      audioStats: analysis.analyzeEnvelope(env, r.fps || 10),
      transcript: meta.transcript || '',
      transcriptSource: meta.transcript ? (meta.transcriptSource || 'auto') : 'none',
      selfCheck: {},
      targets: (meta.targets || []).map(t => ({ text: t.text || t, source: t.source || '', used: null })),
      interrupted: r.reason && r.reason !== 'user' ? r.reason : null,
      recovered: !!meta.recovered,
      starred: false
    };
    delete rec.audioStats.threshold;
    await db.saveRecording(rec, r.blob);
    S.recs = [rec].concat(S.recs.filter(x => x.id !== rec.id));
    if (s) {
      s.lastAskedAt = Math.max(s.lastAskedAt || 0, now);
      if (s.feedback) picker.markRetryDone(s, now);
      await saveQ(s);
    }
    emit();
    return rec;
  }
  async function updateRecording(id, patch) {
    const rec = S.recs.find(x => x.id === id);
    if (!rec) return null;
    Object.assign(rec, patch);
    await db.put('recordings', rec);
    emit();
    return rec;
  }
  async function deleteRecordings(ids) {
    for (const id of ids) await db.deleteRecording(id);
    const set = new Set(ids);
    S.recs = S.recs.filter(r => !set.has(r.id));
    emit();
  }
  function recsFor(qid) { return S.recs.filter(r => r.questionId === qid).sort((a, b) => a.createdAt - b.createdAt); }

  /* 첨삭 결과 저장 → 3일·7일 재도전 예약 */
  async function saveFeedback(qid, fb) {
    const s = q(qid);
    const isNew = !s.feedback;
    s.feedback = Object.assign({}, s.feedback || {}, fb, { savedAt: (s.feedback && s.feedback.savedAt) || Date.now(), updatedAt: Date.now() });
    if (isNew || !(s.retries || []).length) s.retries = picker.scheduleRetries(s.feedback.savedAt);
    await saveQ(s);
    return s;
  }

  /* 노트 */
  async function saveNote(n) {
    const now = Date.now();
    const note = Object.assign({ id: util.uid('note'), createdAt: now, original: '', corrected: '', memo: '', quiz: { right: 0, wrong: 0, lastAt: 0 }, suggested: 0, used: 0 }, n, { updatedAt: now });
    await db.put('notes', note);
    S.notes = [note].concat(S.notes.filter(x => x.id !== note.id)).sort((a, b) => b.createdAt - a.createdAt);
    emit();
    return note;
  }
  async function deleteNote(id) { await db.del('notes', id); S.notes = S.notes.filter(n => n.id !== id); emit(); }

  /* 다음 연습에서 써 볼 노트 표현 제안: 덜 써 본 것, 퀴즈에서 틀린 것 우선 */
  function suggestNotes(n) {
    return S.notes.slice().sort((a, b) => {
      const sa = (a.used || 0) * 2 - (a.quiz ? a.quiz.wrong : 0) + (a.suggested || 0) * 0.3;
      const sb = (b.used || 0) * 2 - (b.quiz ? b.quiz.wrong : 0) + (b.suggested || 0) * 0.3;
      return sa - sb || b.createdAt - a.createdAt;
    }).slice(0, n || 2);
  }

  /* 스크립트 */
  async function saveScript(sc) {
    const now = Date.now();
    const s = Object.assign({ id: util.uid('scr'), createdAt: now, title: '', text: '', questionId: null, level: 0, attempts: [] }, sc, { updatedAt: now });
    await db.put('scripts', s);
    S.scripts = [s].concat(S.scripts.filter(x => x.id !== s.id));
    emit();
    return s;
  }
  async function deleteScript(id) { await db.del('scripts', id); S.scripts = S.scripts.filter(s => s.id !== id); emit(); }

  /* 세션(모의고사·연습 묶음) */
  async function saveSession(ss) {
    await db.put('sessions', ss);
    S.sessions = [ss].concat(S.sessions.filter(x => x.id !== ss.id)).sort((a, b) => b.startedAt - a.startedAt);
    emit();
    return ss;
  }

  /* ---------- 통계 ---------- */
  function stats(now) {
    now = now || Date.now();
    const answers = S.recs;
    const days = answers.map(r => util.dayKey(r.createdAt));
    const totalSec = answers.reduce((a, r) => a + (r.durationSec || 0), 0);
    const byGroup = {};
    bank.FOCUS_GROUPS.forEach(g => { byGroup[g.id] = 0; });
    answers.forEach(r => { const qq = bank.byId[r.questionId]; if (qq) bank.FOCUS_GROUPS.forEach(g => { if (g.match(qq)) byGroup[g.id]++; }); });
    /* 주별 평균 답변 길이(최근 8주) */
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const end = now - i * 7 * util.DAY, startW = end - 7 * util.DAY;
      const list = answers.filter(r => r.createdAt > startW && r.createdAt <= end && r.mode !== 'story-step' && (r.durationSec || 0) >= 5);
      weeks.push({ end, count: list.length, avg: list.length ? list.reduce((a, r) => a + r.durationSec, 0) / list.length : null });
    }
    return {
      streak: util.streak(days, now), studyDays: new Set(days).size, count: answers.length, totalSec, byGroup, weeks,
      avgSec: answers.length ? totalSec / answers.length : 0,
      bytes: answers.reduce((a, r) => a + (r.size || 0), 0)
    };
  }

  /* ---------- 내보내기·가져오기 ---------- */
  function blobToB64(blob) {
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
  }
  function b64ToBlob(b64, type) {
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: type || '' });
  }
  async function exportJSON(includeAudio, onProgress) {
    const kv = (await db.all('kv'));
    const data = { recordings: S.recs, qstate: Object.values(S.qs), notes: S.notes, scripts: S.scripts, sessions: S.sessions, kv };
    if (includeAudio) {
      data.audio = [];
      for (let i = 0; i < S.recs.length; i++) {
        const r = S.recs[i];
        const blob = await db.getAudio(r.id);
        if (blob) data.audio.push({ id: r.id, type: blob.type, data: await blobToB64(blob) });
        onProgress && onProgress(i + 1, S.recs.length);
      }
    }
    return { format: backup.FORMAT, version: backup.VERSION, app: 'opic-app', exportedAt: new Date().toISOString(), includesAudio: !!includeAudio, data };
  }
  /* 검사 → 한 트랜잭션으로 합치기. 실패하면 기존 기록은 그대로 */
  async function importJSON(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, errors: ['JSON 파일을 읽을 수 없습니다. 파일이 손상되었거나 다른 형식입니다.'] }; }
    const v = backup.validateBackup(obj);
    if (!v.ok) return v;
    let audioList = [];
    try { audioList = (obj.data.audio || []).map(a => ({ id: a.id, blob: b64ToBlob(a.data, a.type) })); }
    catch (e) { return { ok: false, errors: ['녹음 데이터를 해석하지 못했습니다. 아무것도 바꾸지 않았습니다.'] }; }
    /* 설정(kv.settings)은 현재 기기 값을 유지하고 나머지만 합친다 */
    const data = Object.assign({}, obj.data, { kv: (obj.data.kv || []).filter(x => x.k !== 'settings') });
    try { await db.importAll(data, audioList); }
    catch (e) { return { ok: false, errors: [(e && e.message) || '저장 중 오류', '가져오기를 취소했습니다. 기존 기록은 그대로입니다.'] }; }
    await init();
    emit();
    return { ok: true, counts: v.counts };
  }

  root.OPIC = root.OPIC || {};
  root.OPIC.store = {
    S, init, setSettings, q, saveQ, markAsked, saveRecording, updateRecording, deleteRecordings, recsFor, saveFeedback,
    saveNote, deleteNote, suggestNotes, saveScript, deleteScript, saveSession, stats, exportJSON, importJSON,
    onChange: f => { S.listeners.add(f); return () => S.listeners.delete(f); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
