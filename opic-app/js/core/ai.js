/* 앱 안에서 바로 AI 첨삭 (Google Gemini API, 사용자가 발급한 키를 이 기기에만 저장)
   녹음 파일을 직접 보내 받아쓰기 + 첨삭 + 다음에 써 볼 표현을 한 번에 받는다.
   - 녹음은 기기에서 16kHz 모노 WAV로 바꿔 보낸다 (아이폰 mp4·안드로이드 webm 모두 같은 형식으로)
   - 모델 이름은 고정하지 않고 키로 받은 모델 목록에서 고른다 (모델 이름이 바뀌어도 동작하게)
   - 키가 없거나 실패해도 기존 「AI 첨삭용 복사」 방식은 그대로 쓸 수 있다 */
(function (root) {
  'use strict';
  const prompt = root.OPIC && root.OPIC.prompt || (typeof require !== 'undefined' ? require('./prompt.js') : null);
  const API = 'https://generativelanguage.googleapis.com/v1beta';
  const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  const MAX_SEC = 8 * 60;

  /* ---------- 순수 로직 (Node 테스트 대상) ---------- */

  /* 모델 목록에서 오디오 첨삭에 쓸 Flash 계열을 고른다: 정식 > 미리보기, 버전 높은 순, lite·tts·live·image 등 제외 */
  function pickModel(models) {
    const ok = (models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name || '').replace(/^models\//, ''))
      .filter(n => /flash/i.test(n) && !/lite|tts|live|image|embedding|audio|thinking|exp|learnlm|vision|8b/i.test(n));
    const ver = n => { const v = (n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1]; return v ? parseFloat(v) : 0; };
    ok.sort((a, b) => (/preview/.test(a) - /preview/.test(b)) || (/latest/.test(a) - /latest/.test(b)) || ver(b) - ver(a) || a.length - b.length);
    return { best: ok[0] || null, candidates: ok };
  }

  /* 사용자가 정한 첨삭 요청문(prompt.TEMPLATE)을 그대로 쓰고, 받아쓰기와 JSON 형식 지시만 덧붙인다 */
  function buildPrompt(o) {
    const base = prompt.buildCoachPrompt({ targetLevel: o.targetLevel, question: o.question, transcript: '(첨부한 녹음 파일 — 먼저 들리는 그대로 받아써 주세요)', durationSec: o.durationSec });
    const targets = (o.targets || []).map(t => t.text || t).filter(Boolean);
    return base + '\n' + [
      '',
      '[진행 방법]',
      '- 먼저 첨부한 녹음을 영어로 들리는 그대로 받아써 주세요. um, uh 같은 군말, 반복, 문법 실수도 고치지 말고 그대로 적어 주세요. 알아들을 수 없는 부분은 (...)로 표시해 주세요.',
      '- 그 받아쓴 글을 학습자 답변으로 보고 위 1~7번을 해 주세요.',
      targets.length ? `- 학습자가 이번 녹음에서 쓰려고 한 표현: ${targets.map(t => `"${t}"`).join(', ')} — 각각 실제로 (비슷한 형태라도) 썼는지 판단해 주세요.` : '',
      '- 아래 JSON 형식으로만 답해 주세요. 설명은 한국어, 영어 표현과 개선 답변은 영어로.',
      '{"transcript": "받아쓴 글", "answered": "1번 평가", "corrections": [{"original": "원래 문장", "corrected": "고친 문장", "reason": "이유"}],',
      ' "flow": "3번 평가", "suggestions": [{"expression": "자연스러운 표현", "meaning": "뜻·쓰임"}], "top3": ["개선점1", "개선점2", "개선점3"],',
      ' "improved": "개선 답변", "nextExpressions": ["표현1", "표현2", "표현3"], "targetsUsed": [{"expression": "표현", "used": true}]}'
    ].filter(l => l !== '').join('\n');
  }

  const SCHEMA = {
    type: 'OBJECT',
    properties: {
      transcript: { type: 'STRING' },
      answered: { type: 'STRING' },
      corrections: { type: 'ARRAY', items: { type: 'OBJECT', properties: { original: { type: 'STRING' }, corrected: { type: 'STRING' }, reason: { type: 'STRING' } } } },
      flow: { type: 'STRING' },
      suggestions: { type: 'ARRAY', items: { type: 'OBJECT', properties: { expression: { type: 'STRING' }, meaning: { type: 'STRING' } } } },
      top3: { type: 'ARRAY', items: { type: 'STRING' } },
      improved: { type: 'STRING' },
      nextExpressions: { type: 'ARRAY', items: { type: 'STRING' } },
      targetsUsed: { type: 'ARRAY', items: { type: 'OBJECT', properties: { expression: { type: 'STRING' }, used: { type: 'BOOLEAN' } } } }
    },
    required: ['transcript', 'answered', 'top3', 'improved', 'nextExpressions']
  };

  function buildBody(promptText, audioB64, mime, withSchema) {
    const gc = { responseMimeType: 'application/json', temperature: 0.4 };
    if (withSchema) gc.responseSchema = SCHEMA;
    return { contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: audioB64 } }, { text: promptText }] }], generationConfig: gc };
  }

  /* 응답 텍스트 → 정리된 결과. 코드 블록·앞뒤 설명이 섞여도 JSON 부분만 읽는다 */
  function parseResult(text) {
    let s = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('AI 응답을 해석하지 못했습니다.');
    const j = JSON.parse(s.slice(a, b + 1));
    const str = v => (typeof v === 'string' ? v.trim() : '');
    const arr = v => (Array.isArray(v) ? v : []);
    const r = {
      transcript: str(j.transcript),
      answered: str(j.answered),
      corrections: arr(j.corrections).map(c => ({ original: str(c && c.original), corrected: str(c && c.corrected), reason: str(c && c.reason) })).filter(c => c.original || c.corrected),
      flow: str(j.flow),
      suggestions: arr(j.suggestions).map(c => ({ expression: str(c && c.expression), meaning: str(c && c.meaning) })).filter(c => c.expression),
      top3: arr(j.top3).map(str).filter(Boolean).slice(0, 3),
      improved: str(j.improved),
      nextExpressions: arr(j.nextExpressions).map(str).filter(Boolean).slice(0, 3),
      targetsUsed: arr(j.targetsUsed).map(t => ({ expression: str(t && t.expression), used: !!(t && t.used) })).filter(t => t.expression)
    };
    if (!r.transcript && !r.improved) throw new Error('AI 응답에 받아쓰기와 개선 답변이 없습니다.');
    return r;
  }

  /* Float32 PCM → 16bit WAV */
  function encodeWav(samples, sampleRate) {
    const n = samples.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return buf;
  }

  /* HTTP 오류 → 사용자 안내 */
  function errorMessage(status, body) {
    const msg = (body && body.error && body.error.message) || '';
    if (status === 400 && /api key|API_KEY/i.test(msg)) return { code: 'key', msg: 'API 키가 올바르지 않습니다. 설정에서 키를 다시 확인해 주세요.' };
    if (status === 401 || status === 403) return { code: 'key', msg: 'API 키로 접근할 수 없습니다(권한 또는 지역 제한). 설정에서 키를 확인해 주세요.' };
    if (status === 404) return { code: 'model', msg: '선택한 AI 모델을 찾을 수 없습니다. 다른 모델로 다시 시도합니다.' };
    if (status === 429) return { code: 'quota', msg: '무료 사용 한도에 걸렸습니다. 1~2분 뒤(일일 한도면 내일) 다시 시도해 주세요.' };
    if (status === 413) return { code: 'size', msg: '녹음이 너무 깁니다.' };
    if (status >= 500) return { code: 'server', msg: 'AI 서버가 잠시 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요.' };
    return { code: 'other', msg: 'AI 첨삭에 실패했습니다' + (msg ? ': ' + msg.slice(0, 160) : '.') };
  }

  const pure = { pickModel, buildPrompt, buildBody, parseResult, encodeWav, errorMessage, SCHEMA, FALLBACK_MODELS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = pure; return; }

  /* ---------- 브라우저 ---------- */
  const { util, bank, store, db } = root.OPIC;
  const jobs = new Map();          // recId → { state: 'running'|'error'|'done', msg }
  const listeners = new Set();
  let queue = Promise.resolve();   // 한 번에 하나씩 (무료 한도 보호)

  function cfg() { return store.S.settings.ai || {}; }
  function enabled() { return !!cfg().key; }
  function setJob(id, j) { if (j) jobs.set(id, j); else jobs.delete(id); listeners.forEach(f => { try { f(id, j); } catch (e) {} }); }

  async function toWav16k(blob) {
    const C = root.AudioContext || root.webkitAudioContext;
    const OC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    const buf = await blob.arrayBuffer();
    const ctx = new C();
    try {
      const audio = await new Promise((res, rej) => { const p = ctx.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); });
      if (audio.duration > MAX_SEC) throw Object.assign(new Error('녹음이 8분보다 길어 AI 첨삭을 보낼 수 없습니다.'), { code: 'size' });
      /* 오래된 Safari는 22050Hz 미만 렌더링을 거부할 수 있어 그때는 22050Hz로 */
      let rate = 16000, off;
      try { off = new OC(1, Math.max(1, Math.ceil(audio.duration * rate)), rate); }
      catch (e) { rate = 22050; off = new OC(1, Math.max(1, Math.ceil(audio.duration * rate)), rate); }
      const src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start(0);
      const out = await off.startRendering();
      return new Blob([encodeWav(out.getChannelData(0), rate)], { type: 'audio/wav' });
    } finally { try { ctx.close(); } catch (e) {} }
  }
  function b64(blob) {
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
  }
  async function fetchJSON(url, opts, timeoutMs) {
    const ac = root.AbortController ? new AbortController() : null;
    const t = ac ? setTimeout(() => ac.abort(), timeoutMs || 90000) : null;
    try {
      const res = await fetch(url, Object.assign({}, opts, ac ? { signal: ac.signal } : {}));
      let body = null; try { body = await res.json(); } catch (e) {}
      return { status: res.status, ok: res.ok, body };
    } catch (e) {
      const offline = navigator.onLine === false;
      throw Object.assign(new Error(offline ? '오프라인입니다. 인터넷에 연결되면 「다시 시도」를 눌러 주세요.' : e && e.name === 'AbortError' ? 'AI 응답이 너무 오래 걸려 중단했습니다. 다시 시도해 주세요.' : '인터넷 연결 문제로 AI에 보내지 못했습니다.'), { code: 'network' });
    } finally { clearTimeout(t); }
  }

  /* 키 확인 + 모델 고르기 */
  async function checkKey(key) {
    const r = await fetchJSON(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } }, 20000);
    if (!r.ok) throw Object.assign(new Error(errorMessage(r.status, r.body).msg), { code: 'key' });
    return pickModel((r.body && r.body.models) || []);
  }

  async function callModel(model, body) {
    return fetchJSON(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg().key }, body: JSON.stringify(body)
    }, 120000);
  }

  async function runReview(rec) {
    const q = bank.byId[rec.questionId];
    const question = rec.promptText || (q && q.text) || '';
    const blob = await db.getAudio(rec.id);
    if (!blob) throw new Error('녹음 파일을 찾을 수 없습니다.');
    let mime = 'audio/wav', data;
    try { data = await b64(await toWav16k(blob)); }
    catch (e) { if (e.code === 'size') throw e; data = await b64(blob); mime = (blob.type || rec.mime || 'audio/webm').split(';')[0]; }
    const promptText = buildPrompt({ targetLevel: store.S.settings.targetLevel, question, durationSec: rec.durationSec, targets: rec.targets });
    let model = cfg().model || FALLBACK_MODELS[0];
    let withSchema = true, r, tries = 0;
    while (tries++ < 4) {
      r = await callModel(model, buildBody(promptText, data, mime, withSchema));
      if (r.ok) break;
      const em = errorMessage(r.status, r.body);
      if (r.status === 400 && withSchema && /schema|response_schema|responseSchema|generation_config/i.test(JSON.stringify(r.body || ''))) { withSchema = false; continue; }
      if (em.code === 'model') {
        /* 모델 이름이 바뀐 경우: 목록에서 다시 골라 한 번 더 */
        const pick = await checkKey(cfg().key).catch(() => null);
        const next = pick && pick.best && pick.best !== model ? pick.best : FALLBACK_MODELS.find(m => m !== model);
        if (!next) throw Object.assign(new Error(em.msg), { code: em.code });
        model = next; await store.setSettings({ ai: Object.assign({}, cfg(), { model }) }); continue;
      }
      if (em.code === 'server' && tries < 2) { await new Promise(res => setTimeout(res, 2500)); continue; }
      throw Object.assign(new Error(em.msg), { code: em.code });
    }
    if (!r || !r.ok) throw new Error('AI 첨삭에 실패했습니다.');
    const cand = r.body && r.body.candidates && r.body.candidates[0];
    const text = cand && cand.content && (cand.content.parts || []).map(p => p.text || '').join('');
    if (!text) throw new Error(cand && cand.finishReason === 'SAFETY' ? 'AI가 이 녹음의 첨삭을 거절했습니다.' : 'AI가 빈 응답을 보냈습니다. 다시 시도해 주세요.');
    const result = parseResult(text);
    return Object.assign(result, { model, at: Date.now() });
  }

  /* 결과 반영: 녹음(받아쓰기·표현 사용) + 문제의 첨삭 저장(→ 3·7일 재도전 예약) */
  async function apply(rec, res) {
    const patch = { aiFeedback: res };
    const manual = rec.transcriptSource === 'manual' || rec.transcriptSource === 'edited';
    if (res.transcript && !manual) { patch.transcript = res.transcript; patch.transcriptSource = 'ai'; }
    if ((rec.targets || []).length && res.targetsUsed.length) {
      const norm = s => String(s).toLowerCase().replace(/[^a-z' ]/g, '').trim();
      patch.targets = rec.targets.map(t => {
        if (t.used !== null && t.used !== undefined) return t;   // 사용자가 직접 체크한 것은 그대로
        const hit = res.targetsUsed.find(u => norm(u.expression) === norm(t.text) || norm(t.text).startsWith(norm(u.expression).slice(0, 12)));
        return hit ? Object.assign({}, t, { used: hit.used, by: 'ai' }) : t;
      });
    }
    await store.updateRecording(rec.id, patch);
    if (rec.questionId && bank.byId[rec.questionId] && (res.nextExpressions.length || res.improved)) {
      const memo = [res.answered && '질문 답변: ' + res.answered, res.top3.length && '개선점 3: ' + res.top3.map((t, i) => `${i + 1}) ${t}`).join(' '), res.flow && '흐름: ' + res.flow].filter(Boolean).join('\n');
      await store.saveFeedback(rec.questionId, { expressions: res.nextExpressions, improved: res.improved, memo, source: 'ai', fromRec: rec.id });
    }
  }

  function review(recId) {
    const rec0 = store.S.recs.find(r => r.id === recId);
    if (!rec0 || !enabled()) return Promise.resolve(null);
    const cur = jobs.get(recId);
    if (cur && cur.state === 'running') return cur.p;
    const p = queue = queue.catch(() => {}).then(async () => {
      const rec = store.S.recs.find(r => r.id === recId);
      if (!rec) return null;
      setJob(recId, { state: 'running', msg: 'AI가 듣고 첨삭하는 중… (보통 10~30초)', p });
      try {
        const res = await runReview(rec);
        await apply(rec, res);
        setJob(recId, { state: 'done' });
        return res;
      } catch (e) {
        setJob(recId, { state: 'error', msg: e.message || String(e), code: e.code });
        return null;
      }
    });
    setJob(recId, { state: 'running', msg: '첨삭 대기 중…', p });
    return p;
  }

  /* 녹음 직후 자동 첨삭 대상 */
  function shouldAuto(rec) {
    return enabled() && cfg().auto !== false && !['exam', 'story-step', 'script'].includes(rec.mode) && (rec.durationSec || 0) >= 3;
  }

  root.OPIC = root.OPIC || {};
  root.OPIC.ai = Object.assign({}, pure, {
    enabled, checkKey, review, shouldAuto, toWav16k,
    job: id => jobs.get(id) || null,
    onJob: f => { listeners.add(f); return () => listeners.delete(f); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
