/* 앱 상태: IndexedDB 위의 얇은 계층. 메타데이터는 메모리에 캐시하고, 오디오는 필요할 때만 읽는다. */
(function (root) {
  'use strict';
  const { db, util, analysis, picker, backup, bank, xp } = root.OPIC;

  const DEFAULT_SETTINGS = {
    targetLevel: 'IH', voiceName: '', rate: 1.0, stt: false, autoRecord: true, theme: 'dark',
    showTextPractice: false, lastExportAt: 0, survey: null, saLevel: 4, presets: null, installHintClosed: false,
    dailyGoal: 40, remindTime: '20:00'
  };

  const S = {
    settings: Object.assign({}, DEFAULT_SETTINGS),
    qs: {},          // qid → 문제 상태
    recs: [],        // 녹음 메타(최신순)
    notes: [],
    scripts: [],
    sessions: [],
    recovered: [],
    xp: null,        // XP·연속 학습·배지 상태
    listeners: new Set()
  };
  const awardListeners = new Set();
  let earlyAwards = []; // 앱 시작 중(복구된 녹음 등) 생긴 보상: 화면이 준비되면 다시 알림

  function emit() { S.listeners.forEach(f => { try { f(); } catch (e) {} }); }

  /* ---------- XP ---------- */
  function badgeCtx() {
    return { recs: S.recs, qs: S.qs, notes: S.notes, sessions: S.sessions, state: S.xp, groups: bank.FOCUS_GROUPS, byId: bank.byId };
  }
  function takeNewBadges() {
    const nb = xp.newBadges(badgeCtx());
    nb.forEach(b => { S.xp.badges[b.id] = Date.now(); });
    return nb;
  }
  /* award(n, why, {flags}) → 리스너에 {n, why, goalReached, levelUp, badges, freeze} 전달 */
  async function award(n, why, o) {
    o = o || {};
    const X = S.xp;
    if (!X) return null;
    const now = Date.now(), k = util.dayKey(now);
    const goal = S.settings.dailyGoal || 40;
    const before = X.days[k] || 0;
    const lvBefore = xp.levelInfo(X.total).level;
    if (n > 0) {
      X.days[k] = before + n; X.total += n;
      X.log.unshift({ at: now, xp: n, why }); X.log = X.log.slice(0, 100);
    }
    if (o.flags) X.flags = Object.assign(X.flags || {}, typeof o.flags === 'function' ? o.flags(X.flags || {}) : o.flags);
    const goalReached = n > 0 && before < goal && X.days[k] >= goal;
    if (goalReached && !X.goalDays.includes(k)) X.goalDays.push(k);
    const freeze = n > 0 && xp.maybeEarnFreeze(X, now);
    const badges = takeNewBadges();
    await db.kvSet('xp', X).catch(() => {});
    const lv = xp.levelInfo(X.total);
    const ev = { n, why, goalReached, levelUp: lv.level > lvBefore ? lv : null, badges, freeze, today: X.days[k] || 0, goal };
    if (n > 0 || badges.length) {
      if (!awardListeners.size) earlyAwards.push(ev);
      awardListeners.forEach(f => { try { f(ev); } catch (e) {} });
    }
    emit();
    return ev;
  }
  async function checkBadges() { if (S.xp && xp.newBadges(badgeCtx()).length) await award(0, ''); }

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
    /* XP 상태: 처음이면 기존 기록으로 계산하고, 빠진 날은 연속 보호권으로 메운다 */
    S.xp = await db.kvGet('xp', null);
    if (!S.xp) {
      S.xp = xp.backfill(S.recs, S.qs, S.notes);
      takeNewBadges();
    }
    xp.applyFreezes(S.xp, Date.now());
    await db.kvSet('xp', S.xp).catch(() => {});
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
  async function saveQ(s) { S.qs[s.qid] = s; await db.put('qstate', s); emit(); checkBadges(); }

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
    let retryDone = false;
    if (s) {
      s.lastAskedAt = Math.max(s.lastAskedAt || 0, now);
      if (s.feedback) retryDone = picker.markRetryDone(s, now);
      await saveQ(s);
    }
    emit();
    const label = { exam: '모의고사 답변', 'story-step': '이야기 단계 녹음', story: '이야기 녹음', script: '스크립트 녹음', keywords: '키워드 말하기', stall: '이어 말하기 훈련', start5: '5초 시작 훈련' }[rec.mode] || '답변 녹음';
    let gain = xp.recordingXP(rec);
    const f = rec.audioStats && rec.audioStats.firstSpeechSec;
    const start5ok = rec.mode === 'start5' && f != null && f <= 5;
    if (start5ok) gain += 3;
    if (retryDone) gain += 15;
    await award(gain, retryDone ? '재도전 완료 + ' + label : label, start5ok ? { flags: fl => ({ start5ok: (fl.start5ok || 0) + 1 }) } : null);
    return rec;
  }
  async function updateRecording(id, patch) {
    const rec = S.recs.find(x => x.id === id);
    if (!rec) return null;
    /* 녹음마다 한 번씩만 주는 XP */
    const fl = Object.assign({ tr: false, sc: false, tg: [] }, rec.xpFlags || {});
    let gain = 0;
    const why = [];
    if (patch.transcript && !fl.tr) { fl.tr = true; gain += 3; why.push('받아쓴 글'); }
    if (patch.selfCheck && Object.values(patch.selfCheck).some(Boolean) && !fl.sc) { fl.sc = true; gain += 2; why.push('자가 체크'); }
    if (patch.targets) patch.targets.forEach((t, i) => { if (t.used === true && !fl.tg.includes(i)) { fl.tg.push(i); gain += 3; why.push('표현 사용'); } });
    Object.assign(rec, patch, { xpFlags: fl });
    await db.put('recordings', rec);
    emit();
    if (gain) await award(gain, Array.from(new Set(why)).join(' · '));
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
    if (isNew) await award(10, '첨삭 결과 저장');
    return s;
  }

  /* 노트 */
  async function saveNote(n) {
    const now = Date.now();
    const isNew = !n.id || !S.notes.some(x => x.id === n.id);
    const note = Object.assign({ id: util.uid('note'), createdAt: now, original: '', corrected: '', memo: '', quiz: { right: 0, wrong: 0, lastAt: 0 }, suggested: 0, used: 0 }, n, { updatedAt: now });
    await db.put('notes', note);
    S.notes = [note].concat(S.notes.filter(x => x.id !== note.id)).sort((a, b) => b.createdAt - a.createdAt);
    emit();
    if (isNew) await award(2, '표현 노트 추가');
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
      streak: S.xp ? xp.streakInfo(S.xp, now).streak : util.streak(days, now), studyDays: new Set(days).size, count: answers.length, totalSec, byGroup, weeks,
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
    const data = Object.assign({}, obj.data, { kv: (obj.data.kv || []).filter(x => x.k !== 'settings' && x.k !== 'xp') });
    /* XP는 덮어쓰지 않고 합친다 (날짜별 큰 값, 배지·목표 달성일 합집합) */
    const impXp = ((obj.data.kv || []).find(x => x.k === 'xp') || {}).v;
    if (impXp && impXp.days && S.xp) {
      const m = S.xp;
      Object.keys(impXp.days).forEach(k => { m.days[k] = Math.max(m.days[k] || 0, impXp.days[k] || 0); });
      m.total = Math.max(m.total, impXp.total || 0, Object.values(m.days).reduce((a, b) => a + b, 0));
      m.badges = Object.assign({}, impXp.badges || {}, m.badges);
      m.goalDays = Array.from(new Set(m.goalDays.concat(impXp.goalDays || [])));
      m.frozen = Array.from(new Set((m.frozen || []).concat(impXp.frozen || [])));
      m.flags = Object.assign({}, impXp.flags || {}, m.flags || {});
      m.freezes = Math.max(m.freezes || 0, impXp.freezes || 0);
      data.kv.push({ k: 'xp', v: m });
    }
    try { await db.importAll(data, audioList); }
    catch (e) { return { ok: false, errors: [(e && e.message) || '저장 중 오류', '가져오기를 취소했습니다. 기존 기록은 그대로입니다.'] }; }
    await init();
    emit();
    return { ok: true, counts: v.counts };
  }

  root.OPIC = root.OPIC || {};
  root.OPIC.store = {
    S, init, setSettings, q, saveQ, markAsked, saveRecording, updateRecording, deleteRecordings, recsFor, saveFeedback,
    saveNote, deleteNote, suggestNotes, saveScript, deleteScript, saveSession, stats, exportJSON, importJSON, award, checkBadges,
    onChange: f => { S.listeners.add(f); return () => S.listeners.delete(f); },
    onAward: f => { awardListeners.add(f); const q = earlyAwards; earlyAwards = []; q.forEach(ev => { try { f(ev); } catch (e) {} }); return () => awardListeners.delete(f); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
