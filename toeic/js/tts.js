// 브라우저 내장 음성 합성(Web Speech API). 기기에 실제로 설치된 영어 음성만 사용한다.
// 오프라인 동작 여부는 기기·브라우저마다 다르다(일부 음성은 네트워크 음성).

const ACCENT_OF = { 'en-us': 'US', 'en-gb': 'GB', 'en-au': 'AU', 'en-ca': 'CA', 'en-ie': 'IE', 'en-in': 'IN', 'en-nz': 'NZ', 'en-za': 'ZA' };
export const ACCENT_LABEL = { US: '미국', GB: '영국', AU: '호주', CA: '캐나다', IE: '아일랜드', IN: '인도', NZ: '뉴질랜드', ZA: '남아공', EN: '기타 영어' };

const FEMALE = /(female|woman|samantha|karen|moira|tessa|victoria|fiona|serena|kate|susan|zira|hazel|libby|sonia|natasha|catherine|allison|ava|joanna|kimberly|salli|emma|amy|nicole|olivia|aria|jenny|michelle|clara|isla|matilda|tina|veena|google uk english female|google us english)/i;
const MALE = /(male|\bman\b|daniel|alex|fred|\btom\b|oliver|arthur|gordon|\blee\b|rishi|david|mark|george|ryan|william|guy|brian|russell|matthew|justin|joey|christopher|eric|james|thomas|aaron|reed|rocko|google uk english male)/i;

export function accentOf(voice) {
  const l = (voice.lang || '').toLowerCase().replace('_', '-');
  return ACCENT_OF[l.slice(0, 5)] || 'EN';
}

export function genderOf(voice) {
  const n = voice.name || '';
  if (/female/i.test(n)) return 'f';
  if (/\bmale\b/i.test(n)) return 'm';
  if (FEMALE.test(n)) return 'f';
  if (MALE.test(n)) return 'm';
  return null;
}

export function createTTS(win = globalThis) {
  const synth = win.speechSynthesis;
  const supported = !!(synth && win.SpeechSynthesisUtterance);
  let voices = [];
  let current = null; // 재생 중인 컨트롤러

  function load() {
    if (!supported) return [];
    voices = synth.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang || ''));
    return voices;
  }

  async function init() {
    if (!supported) return [];
    load();
    if (voices.length) return voices;
    await new Promise((res) => {
      const done = () => { load(); res(); };
      try { synth.addEventListener('voiceschanged', done, { once: true }); } catch { synth.onvoiceschanged = done; }
      setTimeout(done, 2500);
    });
    return voices;
  }

  // 화자 목록(키 → {g, accent})에 실제 음성을 배정. settings.voices[accent] = voiceURI 로 사용자가 고정 가능.
  function assign(speakers, prefs = {}) {
    const out = {};
    if (!voices.length) return out;
    const used = new Set();
    const keys = Object.keys(speakers || {});
    for (const k of keys) {
      const want = speakers[k] || {};
      const byPref = prefs[want.accent] && voices.find((v) => v.voiceURI === prefs[want.accent]);
      let cands = voices.filter((v) => accentOf(v) === want.accent);
      if (!cands.length) cands = voices.slice();
      const score = (v) => (byPref && v === byPref ? 100 : 0) + (genderOf(v) === want.g ? 10 : genderOf(v) ? -5 : 0) + (used.has(v.voiceURI) ? -20 : 0) + (v.localService ? 2 : 0);
      cands.sort((a, b) => score(b) - score(a));
      const pick = cands[0];
      out[k] = pick;
      used.add(pick.voiceURI);
    }
    // 화자가 둘 이상인데 같은 음성이면, 다른 억양의 음성으로라도 바꿔 구분되게
    if (keys.length > 1) {
      const seen = new Set();
      for (const k of keys) {
        if (seen.has(out[k].voiceURI)) {
          const alt = voices.find((v) => !Object.values(out).includes(v));
          if (alt) out[k] = alt;
        }
        seen.add(out[k].voiceURI);
      }
    }
    return out;
  }

  function stop() {
    if (current) current.cancelled = true;
    current = null;
    if (supported) synth.cancel();
  }

  // lines: [{text, voice, pause}] 를 순서대로 읽는다. 문장 단위라 긴 발화가 끊기는 브라우저 문제도 피한다.
  function play(lines, { rate = 1, onLine, onEnd } = {}) {
    stop();
    const ctl = { cancelled: false };
    current = ctl;
    if (!supported || !lines.length) { onEnd && onEnd(false); return ctl; }
    let i = 0;
    const next = () => {
      if (ctl.cancelled) return;
      if (i >= lines.length) { current = null; onEnd && onEnd(true); return; }
      const ln = lines[i];
      onLine && onLine(i);
      const u = new win.SpeechSynthesisUtterance(ln.text);
      if (ln.voice) { u.voice = ln.voice; u.lang = ln.voice.lang; } else u.lang = 'en-US';
      u.rate = rate;
      let finished = false;
      const fin = () => {
        if (finished) return;
        finished = true;
        i++;
        setTimeout(next, ln.pause ?? 350);
      };
      u.onend = fin;
      u.onerror = fin;
      // 일부 기기에서 onend가 오지 않는 경우를 대비한 안전장치
      const guard = Math.max(4000, (ln.text.length * 110) / rate + 3000);
      setTimeout(() => { if (!finished && !ctl.cancelled && !synth.speaking) fin(); }, guard);
      synth.speak(u);
    };
    next();
    return ctl;
  }

  return {
    supported,
    init,
    get voices() { return voices; },
    hasEnglish: () => voices.length > 0,
    assign,
    play,
    stop,
    speaking: () => !!current,
  };
}
