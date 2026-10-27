/* 음성: 읽어 주기(TTS) · 음성 인식(STT) · 녹음
   - TTS 음성 고르기와 iOS·Chrome 버그 회피는 opic-app/js/core/tts.js 방식을 가져왔다
   - 음성 인식은 브라우저 기능(Chrome은 인터넷 필요). 안 되면 직접 입력이나 스스로 평가로 넘어간다 */

/* ── TTS ─────────────────── */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];
const voiceListeners = new Set();
const BAD = /Compact|Eloquence|Novelty|Albert|Bad News|Good News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Hysterical|Jester|Organ|Pipe|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Kathy|Princess|Grandma|Grandpa|Rocko|Shelley|Flo|Reed|Sandy/i;
const NICE = /Ava|Allison|Susan|Zoe|Joanna|Jenny|Aria|Nicky|Serena|Samantha|Karen|Moira|Tessa|Evan|Tom|Nathan|Daniel|Kate|Oliver|Stephanie|Libby|Sonia|Ryan|Guy|Emma|Brian/i;

function voiceScore(v) {
  const n = (v.name || '') + ' ' + (v.voiceURI || '');
  const remoteOk = /^https?:$/.test(location.protocol);
  let s = 0;
  if (/premium/i.test(n)) s += 260;
  if (/enhanced|향상/i.test(n)) s += 220;
  if (/Natural|Neural/i.test(n)) s += 200;
  if (/siri/i.test(n)) s += 120;
  if (v.localService === false) s += remoteOk ? 70 : -400;
  if (/Google/i.test(n)) s += remoteOk ? 50 : 0;
  if (NICE.test(n)) s += 25;
  if (/en[-_]US/i.test(v.lang)) s += 30; else if (/en[-_]GB/i.test(v.lang)) s += 22; else if (/en[-_](AU|CA|IE|NZ)/i.test(v.lang)) s += 10;
  if (BAD.test(n)) s -= 300;
  if (v.default) s += 5;
  return s;
}
function loadVoices() {
  if (!synth) return;
  voices = (synth.getVoices() || []).filter(v => /^en/i.test(v.lang)).sort((a, b) => voiceScore(b) - voiceScore(a));
  voiceListeners.forEach(f => f(voices));
}
if (synth) {
  loadVoices();
  if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices); else synth.onvoiceschanged = loadVoices;
  setTimeout(loadVoices, 300); setTimeout(loadVoices, 1500);
}

let seq = 0, keepAlive = null;
export const tts = {
  supported: () => !!synth,
  voices: () => voices,
  onVoices(f) { voiceListeners.add(f); if (voices.length) f(voices); return () => voiceListeners.delete(f); },
  isGood: v => !!v && voiceScore(v) >= 200,
  /* speak(text, {voice, rate}) → Promise<boolean> (끝까지 읽었는지) */
  speak(text, o = {}) {
    return new Promise(resolve => {
      const my = ++seq;
      if (!synth || !text) return resolve(false);
      try { synth.cancel(); } catch (e) {}
      clearInterval(keepAlive);
      let done = false, started = false, guard = null;
      const finish = ok => { if (done) return; done = true; clearInterval(keepAlive); clearTimeout(guard); resolve(ok); };
      const u = new SpeechSynthesisUtterance(text);
      const v = voices.find(x => x.name === o.voice) || voices[0];
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
      u.rate = o.rate || 1;
      u.onstart = () => { started = true; o.onStart && o.onStart(); };
      u.onend = () => finish(true);
      u.onerror = e => finish(e && e.error === 'interrupted' ? false : started);
      const words = text.split(/\s+/).length;
      guard = setTimeout(() => { if (!done) { try { synth.cancel(); } catch (e) {} finish(started); } }, (words / 2.3 / (o.rate || 1)) * 1000 + 6000);
      setTimeout(() => {
        if (my !== seq) return finish(false);
        synth.speak(u);
        if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) keepAlive = setInterval(() => { if (synth.speaking) { synth.pause(); synth.resume(); } }, 10000);
      }, 60);
    });
  },
  cancel() { seq++; clearInterval(keepAlive); try { synth && synth.cancel(); } catch (e) {} }
};

/* ── STT ─────────────────── */
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
let recog = null;
const STT_ERR = {
  'not-allowed': '마이크(음성 인식) 권한이 거부됐어요. 브라우저 설정에서 마이크를 허용해 주세요.',
  'service-not-allowed': '이 브라우저에서는 음성 인식을 쓸 수 없어요. 직접 입력하거나 스스로 평가해 주세요.',
  'network': '인터넷 연결 문제로 음성 인식이 멈췄어요. (Chrome 음성 인식은 인터넷이 필요해요)',
  'audio-capture': '마이크를 쓸 수 없어요. 녹음과 음성 인식을 같이 못 쓰는 기기라면 설정에서 녹음을 꺼 주세요.',
  'language-not-supported': '영어 음성 인식을 지원하지 않아요.'
};
export const stt = {
  available: () => !!SR,
  status() {
    if (!SR) return { ok: false, msg: '이 브라우저는 음성 인식을 지원하지 않아요. 직접 입력하거나 소리 내어 말한 뒤 스스로 평가해 주세요.' };
    if (navigator.onLine === false) return { ok: false, msg: '오프라인이라 음성 인식을 쓸 수 없어요. 직접 입력하거나 스스로 평가해 주세요.' };
    return { ok: true, msg: '' };
  },
  /* start({continuous, alts, onText(final, interim), onEnd(final, alternatives), onError(msg)}) → stop 함수 */
  start(o = {}) {
    stt.abort();
    const st = stt.status();
    if (!st.ok) { o.onError && o.onError(st.msg); return null; }
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = true; r.continuous = !!o.continuous; r.maxAlternatives = o.alts || 1;
    const s = { final: '', alts: [], interim: '', running: true, stopped: false, restarts: 0 };
    recog = { r, s };
    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          s.final += res[0].transcript.trim() + ' ';
          for (let a = 0; a < res.length; a++) s.alts.push(res[a].transcript.trim());
        } else interim += res[0].transcript;
      }
      s.interim = interim;
      o.onText && o.onText(s.final.trim(), interim);
    };
    r.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      s.running = false;
      o.onError && o.onError(STT_ERR[e.error] || ('음성 인식 오류: ' + e.error));
    };
    r.onend = () => {
      // 말하기 전에 저절로 끝나 버리는 브라우저가 있어, 아직 들은 말이 없으면 다시 시작한다.
      // 말한 뒤 끝났으면(말을 멈춤) 그대로 답으로 쓴다
      if (o.continuous && s.running && !s.stopped && !s.final.trim() && s.restarts < 8) { s.restarts++; try { r.start(); return; } catch (e) {} }
      s.running = false;
      if (recog && recog.r === r) recog = null;
      const text = (s.final + ' ' + s.interim).replace(/\s+/g, ' ').trim();
      if (s.interim) s.alts.push(s.interim.trim());
      o.onEnd && o.onEnd(text, s.alts);
    };
    try { r.start(); } catch (e) { o.onError && o.onError('음성 인식을 시작하지 못했어요.'); return null; }
    return () => { s.stopped = true; try { r.stop(); } catch (e) {} };
  },
  abort() { if (recog) { recog.s.stopped = true; recog.s.running = false; try { recog.r.abort(); } catch (e) {} recog = null; } }
};

/* ── 녹음 ─────────────────── */
function pickMime() {
  let cand = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac'];
  const ua = navigator.userAgent || '';
  if (/Safari/i.test(ua) && !/Chrome|CriOS|Android|FxiOS|EdgiOS/i.test(ua)) cand = cand.slice(2).concat(cand.slice(0, 2));
  if (window.MediaRecorder && MediaRecorder.isTypeSupported) for (const t of cand) if (MediaRecorder.isTypeSupported(t)) return t;
  return '';
}
export function micMessage(e) {
  const n = e && e.name;
  if (location.protocol === 'file:') return '파일을 직접 연 상태에서는 마이크를 쓸 수 없어요. https 주소로 열어 주세요.';
  if (!window.isSecureContext) return '마이크는 https 주소에서만 쓸 수 있어요.';
  if (!navigator.mediaDevices || !window.MediaRecorder) return '이 브라우저는 녹음을 지원하지 않아요.';
  if (n === 'NotAllowedError' || n === 'SecurityError') return '마이크 권한이 거부됐어요. 아이폰: 설정 → Safari → 마이크 허용, 갤럭시 Chrome: 주소창 왼쪽 아이콘 → 권한 → 마이크.';
  if (n === 'NotFoundError') return '마이크를 찾을 수 없어요.';
  if (n === 'NotReadableError') return '다른 앱이 마이크를 쓰고 있어요.';
  return '마이크를 켜지 못했어요.';
}
export const recorder = {
  supported: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder),
  /* start() → {stop(): Promise<Blob|null>} */
  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = pickMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.start(500);
    const t0 = Date.now();
    return {
      stop: () => new Promise(res => {
        const end = () => { stream.getTracks().forEach(t => t.stop()); res(chunks.length && Date.now() - t0 > 400 ? new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' }) : null); };
        if (mr.state === 'inactive') return end();
        mr.onstop = end;
        try { mr.stop(); } catch (e) { end(); }
      })
    };
  }
};

/* 짧은 효과음 (맞음/틀림) — 오디오 파일 없이 */
let actx = null;
export function beep(ok) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    const t = actx.currentTime;
    o.frequency.setValueAtTime(ok ? 660 : 220, t);
    if (ok) o.frequency.setValueAtTime(880, t + 0.08);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.26);
  } catch (e) {}
}
