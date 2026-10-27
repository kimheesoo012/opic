/* 녹음
   - 코덱: Chrome/Android → audio/webm(opus), iPhone Safari → audio/mp4(aac). 실제 녹음된 형식을 그대로 라벨링
   - 1초마다 조각을 IndexedDB(drafts/chunks)에 저장 → 화면 잠금·앱 전환·전화 수신·강제 종료에도 그때까지 녹음 보존
   - 화면이 가려지거나 마이크가 끊기면 자동으로 정지·저장하고 이유를 알려 준다
   - 녹음 중 화면 꺼짐 방지(Wake Lock, 지원 기기만)
   - 녹음 중 0.1초마다 소리 크기를 기록 → 무음 구간·말한 비율 분석 */
(function (root) {
  'use strict';
  const db = root.OPIC.db;
  const util = root.OPIC.util;
  const FPS = 10;

  let stream = null;
  let audioCtx = null;
  let active = null; // 진행 중 녹음

  function pickMime() {
    let cand = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus'];
    /* Safari(아이폰)는 최신 버전이 webm도 녹음하지만, mp4(AAC)가 아이폰·갤럭시 어디서나 재생되므로 mp4 우선 */
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (/Safari/i.test(ua) && !/Chrome|CriOS|Android|FxiOS|EdgiOS/i.test(ua)) cand = cand.slice(2).concat(cand.slice(0, 2));
    if (root.MediaRecorder && MediaRecorder.isTypeSupported) for (const t of cand) if (MediaRecorder.isTypeSupported(t)) return t;
    return '';
  }
  function extOf(type) {
    if (/mp4|aac|m4a/i.test(type)) return 'm4a';
    if (/ogg/i.test(type)) return 'ogg';
    if (/wav/i.test(type)) return 'wav';
    return 'webm';
  }
  /* 이 기기에서 재생 가능한 형식인지 */
  function canPlay(type) {
    if (!type) return true;
    const a = document.createElement('audio');
    const base = type.split(';')[0];
    return !!(a.canPlayType(type) || a.canPlayType(base) || (base === 'audio/mp4' && a.canPlayType('audio/x-m4a')));
  }

  function environment() {
    const secure = root.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return {
      secure,
      file: location.protocol === 'file:',
      hasGUM: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      hasMR: !!root.MediaRecorder,
      mime: pickMime()
    };
  }
  function supported() { const e = environment(); return e.hasGUM && e.hasMR; }

  function micError(e) {
    const n = e && e.name;
    const env = environment();
    if (!env.hasGUM || !env.hasMR) {
      if (env.file) return { code: 'file', msg: '파일을 직접 연 상태(file://)에서는 브라우저가 마이크를 막습니다. GitHub Pages 주소(https://)나 로컬 서버로 열어 주세요.' };
      if (!env.secure) return { code: 'insecure', msg: '마이크는 HTTPS 주소에서만 쓸 수 있습니다. https:// 주소로 열어 주세요.' };
      return { code: 'unsupported', msg: '이 브라우저는 녹음을 지원하지 않습니다. 아이폰은 Safari, 갤럭시는 Chrome 최신 버전을 써 주세요.' };
    }
    if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError')
      return { code: 'denied', msg: '마이크 권한이 거부되었습니다. 아이폰: 설정 → Safari → 마이크 → 허용(또는 주소창 「aA」 → 웹 사이트 설정). 갤럭시 Chrome: 주소창 왼쪽 아이콘 → 권한 → 마이크 허용. 그 뒤 새로고침해 주세요.' };
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError') return { code: 'nomic', msg: '마이크를 찾을 수 없습니다.' };
    if (n === 'NotReadableError' || n === 'TrackStartError') return { code: 'busy', msg: '다른 앱(통화·녹음 앱 등)이 마이크를 쓰고 있습니다. 그 앱을 닫고 다시 시도해 주세요.' };
    return { code: 'unknown', msg: '마이크를 켜지 못했습니다: ' + (e && (e.message || e.name) || '알 수 없는 오류') };
  }

  async function ensureStream() {
    if (stream && stream.getAudioTracks().some(t => t.readyState === 'live')) return stream;
    if (!supported()) throw micError(null);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) { throw micError(e); }
    return stream;
  }
  /* 첫 터치 때 권한만 미리 받아 두고 마이크는 바로 끈다 */
  async function ensurePermission() {
    await ensureStream();
    releaseStream();
    return true;
  }
  function releaseStream() {
    if (active) return;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }
  function ctx() {
    const C = root.AudioContext || root.webkitAudioContext;
    if (!C) return null;
    if (!audioCtx || audioCtx.state === 'closed') audioCtx = new C();
    return audioCtx;
  }
  /* iOS는 사용자 터치 안에서 AudioContext를 깨워야 한다 */
  function unlock() { const c = ctx(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }

  /* opts: { meta, onTick(sec), onLevel(0..1), onStop(result) }  */
  async function start(opts) {
    if (active) await stop('restart');
    const s = await ensureStream();
    const mime = pickMime();
    let mr;
    try { mr = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s); }
    catch (e) { mr = new MediaRecorder(s); }
    const recId = util.uid('rec');
    const rec = {
      recId, mr, mime: mr.mimeType || mime || '', chunks: [], seq: 0, env: [], startedAt: Date.now(), t0: performance.now(),
      opts: opts || {}, stopped: false, reason: null, saveErrors: 0, wake: null
    };
    active = rec;
    await db.put('drafts', { recId, meta: rec.opts.meta || {}, startedAt: rec.startedAt, mime: rec.mime, env: [] }).catch(() => { rec.saveErrors++; });

    mr.ondataavailable = e => {
      if (!e.data || !e.data.size) return;
      rec.chunks.push(e.data);
      const seq = rec.seq++;
      db.putChunk(recId, seq, e.data).catch(() => { rec.saveErrors++; });
    };
    mr.onerror = () => { stop('error'); };

    /* 소리 크기 측정 */
    const c = ctx();
    if (c) {
      try {
        if (c.state === 'suspended') await c.resume().catch(() => {});
        const src = c.createMediaStreamSource(s);
        const an = c.createAnalyser(); an.fftSize = 1024; src.connect(an);
        const buf = new Float32Array(an.fftSize);
        rec.src = src;
        rec.levelTimer = setInterval(() => {
          an.getFloatTimeDomainData(buf);
          let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          const v = Math.min(255, Math.round(rms * 255 * 4));
          rec.env.push(v);
          rec.opts.onLevel && rec.opts.onLevel(v / 255);
          if (rec.env.length % 50 === 0) db.put('drafts', { recId, meta: rec.opts.meta || {}, startedAt: rec.startedAt, mime: rec.mime, env: rec.env.slice() }).catch(() => {});
        }, 1000 / FPS);
        c.onstatechange = () => { if (c.state === 'interrupted' && active === rec) stop('call'); };
      } catch (e) { /* 측정 실패해도 녹음은 계속 */ }
    }
    rec.tick = setInterval(() => { rec.opts.onTick && rec.opts.onTick((performance.now() - rec.t0) / 1000); }, 250);

    /* 끊김 감지 */
    rec.onVis = () => { if (document.visibilityState === 'hidden') stop('hidden'); };
    rec.onHide = () => stop('hidden');
    document.addEventListener('visibilitychange', rec.onVis);
    root.addEventListener('pagehide', rec.onHide);
    s.getAudioTracks().forEach(t => { t.onended = () => stop('track'); t.onmute = () => { if (active === rec) rec.muted = true; }; });

    try { if (navigator.wakeLock) rec.wake = await navigator.wakeLock.request('screen'); } catch (e) { /* 미지원 */ }

    mr.start(1000);
    return rec;
  }

  const REASONS = {
    hidden: '화면이 꺼지거나 다른 앱으로 전환되어 녹음을 멈추고 저장했습니다.',
    call: '전화 등으로 마이크가 끊겨 녹음을 멈추고 저장했습니다.',
    track: '마이크 연결이 끊겨 녹음을 멈추고 저장했습니다.',
    error: '녹음 중 오류가 나서 그때까지의 녹음을 저장했습니다.'
  };

  function cleanup(rec) {
    clearInterval(rec.levelTimer); clearInterval(rec.tick);
    document.removeEventListener('visibilitychange', rec.onVis);
    root.removeEventListener('pagehide', rec.onHide);
    try { rec.src && rec.src.disconnect(); } catch (e) {}
    try { rec.wake && rec.wake.release(); } catch (e) {}
  }

  /* 정지 → { recId, blob, mime, durationSec, env, reason, interruptedMsg } */
  function stop(reason) {
    const rec = active;
    if (!rec) return Promise.resolve(null);
    if (rec.stopping) return rec.stopping;
    rec.reason = reason || 'user';
    rec.stopping = new Promise(resolve => {
      const durationSec = (performance.now() - rec.t0) / 1000;
      const finish = () => {
        cleanup(rec);
        if (active === rec) active = null;
        /* 녹음이 끝나면 마이크를 바로 놓는다: 아이폰에서 마이크가 켜진 동안 소리가 수화부로만 나오는 문제 방지 */
        releaseStream();
        const blob = rec.chunks.length ? new Blob(rec.chunks, { type: rec.mime || (rec.chunks[0] && rec.chunks[0].type) || '' }) : null;
        const res = { recId: rec.recId, blob, mime: blob ? blob.type : rec.mime, durationSec, env: rec.env, fps: FPS,
          reason: rec.reason, interruptedMsg: REASONS[rec.reason] || null, saveErrors: rec.saveErrors };
        rec.opts.onStop && rec.opts.onStop(res);
        resolve(res);
      };
      if (rec.mr.state === 'inactive') return finish();
      rec.mr.onstop = finish;
      try { rec.mr.requestData && rec.mr.state === 'recording' && rec.mr.requestData(); } catch (e) {}
      try { rec.mr.stop(); } catch (e) { finish(); }
      /* 일부 브라우저가 화면이 가려진 동안 onstop을 늦게 보내면, 조각은 이미 저장돼 있으므로 다음 실행 때 복구된다 */
    });
    return rec.stopping;
  }
  function cancel() {
    const rec = active;
    if (!rec) return Promise.resolve();
    rec.opts.onStop = null;
    return stop('cancel').then(r => db.clearDraft(r.recId).catch(() => {}));
  }
  function isRecording() { return !!active; }

  /* 녹음 파일에서 소리 크기 곡선을 다시 계산 (복구된 녹음 등) */
  async function envelopeFromBlob(blob) {
    const c = ctx();
    if (!c || !blob) return null;
    try {
      const buf = await blob.arrayBuffer();
      const audio = await new Promise((res, rej) => { const p = c.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); });
      const data = audio.getChannelData(0);
      const step = Math.floor(audio.sampleRate / FPS);
      const env = [];
      for (let i = 0; i + step <= data.length; i += step) {
        let sum = 0; for (let j = i; j < i + step; j++) sum += data[j] * data[j];
        env.push(Math.min(255, Math.round(Math.sqrt(sum / step) * 255 * 4)));
      }
      return { env, durationSec: audio.duration };
    } catch (e) { return null; }
  }

  /* 앱 시작 시: 저장되지 못한 녹음(강제 종료 등)을 조각에서 복구 */
  async function recoverDrafts(saveFn) {
    const drafts = await db.all('drafts').catch(() => []);
    const out = [];
    for (const d of drafts) {
      if (active && active.recId === d.recId) continue;
      /* 녹음 id = draft id: 이미 정상 저장됐다면 조각만 정리 */
      const done = await db.get('recordings', d.recId).catch(() => null);
      if (done) { await db.clearDraft(d.recId).catch(() => {}); continue; }
      const chunks = await db.getChunks(d.recId).catch(() => []);
      if (!chunks.length) { await db.clearDraft(d.recId).catch(() => {}); continue; }
      const blob = new Blob(chunks.map(c => c.blob), { type: d.mime || chunks[0].blob.type || '' });
      let env = d.env || [];
      let durationSec = chunks.length; // 1초 단위 조각
      const dec = await envelopeFromBlob(blob);
      if (dec) { env = dec.env; if (isFinite(dec.durationSec) && dec.durationSec > 0) durationSec = dec.durationSec; }
      try {
        await saveFn({ recId: d.recId, blob, mime: blob.type, durationSec, env, fps: FPS, reason: 'recovered', meta: d.meta, startedAt: d.startedAt });
        await db.clearDraft(d.recId);
        out.push(d.recId);
      } catch (e) { /* 저장 공간 부족 등: 조각은 남겨 두고 다음에 다시 시도 */ }
    }
    return out;
  }

  root.OPIC = root.OPIC || {};
  root.OPIC.recorder = { FPS, environment, supported, ensureStream, ensurePermission, releaseStream, unlock, start, stop, cancel, isRecording, recoverDrafts, envelopeFromBlob, extOf, canPlay, pickMime, micError };
})(typeof window !== 'undefined' ? window : globalThis);
