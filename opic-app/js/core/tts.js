/* 질문 읽기 (Web Speech 음성 합성)
   기존 시뮬레이터의 음성 점수 방식을 가져와 아이폰 고품질(향상된/프리미엄) 음성을 우선하도록 보강했다. */
(function (root) {
  'use strict';
  const synth = root.speechSynthesis;
  let voices = [];
  let listeners = [];

  const BAD = /Compact|Eloquence|Novelty|Albert|Bad News|Good News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Hysterical|Jester|Organ|Pipe|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Kathy|Princess|Grandma|Grandpa|Rocko|Shelley|Flo|Reed|Sandy/i;
  const NICE = /Ava|Allison|Susan|Zoe|Joanna|Jenny|Aria|Nicky|Serena|Samantha|Karen|Moira|Tessa|Evan|Tom|Nathan|Daniel|Kate|Oliver|Stephanie|Libby|Sonia|Ryan|Guy|Emma|Brian/i;
  const remoteOk = typeof location !== 'undefined' && /^https?:$/.test(location.protocol);

  function score(v) {
    const n = (v.name || '') + ' ' + (v.voiceURI || '');
    let s = 0;
    if (/premium/i.test(n)) s += 260;                     // iOS/macOS 프리미엄(내려받은) 음성
    if (/enhanced|향상/i.test(n)) s += 220;               // iOS 향상된 음성
    if (/Natural|Neural/i.test(n)) s += 200;              // Edge/Windows 자연 음성
    if (/siri/i.test(n)) s += 120;
    if (v.localService === false) s += remoteOk ? 70 : -400;
    if (/Google/i.test(n)) s += remoteOk ? 50 : 0;
    if (NICE.test(n)) s += 25;
    if (/en[-_]US/i.test(v.lang)) s += 30; else if (/en[-_]GB/i.test(v.lang)) s += 22; else if (/en[-_](AU|CA|IE|NZ)/i.test(v.lang)) s += 10;
    if (BAD.test(n)) s -= 300;
    if (v.default) s += 5;
    return s;
  }
  function load() {
    if (!synth) return;
    voices = (synth.getVoices() || []).filter(v => /^en/i.test(v.lang)).sort((a, b) => score(b) - score(a));
    listeners.forEach(f => f(voices));
  }
  if (synth) {
    load();
    if ('onvoiceschanged' in synth) synth.onvoiceschanged = load;
    setTimeout(load, 300); setTimeout(load, 1500);
  }

  let seq = 0;
  let keepAlive = null;
  /* speak(text, {voiceName, rate, onStart, onEnd}) → 취소 함수. onEnd(ok) */
  function speak(text, o) {
    o = o || {};
    const my = ++seq;
    if (!synth) { setTimeout(() => o.onEnd && o.onEnd(false), 0); return () => {}; }
    /* 아이폰 Safari는 첫 음성을 터치 처리 안에서 바로 speak() 해야 소리가 난다.
       이미 재생 중일 때만 cancel() 후 잠깐 띄워 Chrome의 cancel 직후 무음 버그를 피한다 */
    const busy = synth.speaking || synth.pending;
    if (busy) synth.cancel();
    clearInterval(keepAlive);
    let done = false, started = false;
    const finish = ok => {
      if (done || my !== seq) return; done = true;
      clearInterval(keepAlive); clearTimeout(guard);
      o.onEnd && o.onEnd(ok);
    };
    const u = new SpeechSynthesisUtterance(text);
    const v = voices.find(x => x.name === o.voiceName) || voices[0];
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
    u.rate = o.rate || 1; u.pitch = 1; u.volume = 1;
    u.onstart = () => { started = true; o.onStart && o.onStart(); };
    u.onend = () => finish(true);
    u.onerror = e => finish(e && e.error === 'interrupted' ? false : started);
    /* 일부 기기(특히 iOS)가 onend를 보내지 않는 문제 대비: 예상 길이 + 여유 시간 뒤 강제 종료 */
    const words = text.split(/\s+/).length;
    const guard = setTimeout(() => { if (!done) { try { synth.cancel(); } catch (e) {} finish(started); } }, (words / 2.3 / (o.rate || 1)) * 1000 + 6000);
    const go = () => {
      if (my !== seq) return;
      try { synth.resume(); } catch (e) {}
      synth.speak(u);
      /* Chrome이 긴 문장을 15초쯤에서 끊는 버그 회피 (안드로이드에서는 pause/resume이 오히려 끊김을 만들어 PC만) */
      if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) keepAlive = setInterval(() => { if (synth.speaking) { synth.pause(); synth.resume(); } }, 10000);
    };
    if (busy) setTimeout(go, 80); else go();
    return () => { if (!done) { done = true; clearTimeout(guard); clearInterval(keepAlive); try { synth.cancel(); } catch (e) {} } };
  }
  function cancel() { seq++; clearInterval(keepAlive); try { synth && synth.cancel(); } catch (e) {} }

  root.OPIC = root.OPIC || {};
  root.OPIC.tts = {
    supported: () => !!synth,
    voices: () => voices,
    best: () => voices[0] || null,
    isHighQuality: v => !!v && score(v) >= 200,
    onVoices: f => { listeners.push(f); if (voices.length) f(voices); },
    speak, cancel, score
  };
})(typeof window !== 'undefined' ? window : globalThis);
