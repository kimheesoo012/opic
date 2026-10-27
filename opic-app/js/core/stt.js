/* 자동 받아쓰기 (선택 기능)
   - 브라우저 음성 인식(Web Speech)이 있을 때만 사용. Chrome은 인식에 인터넷이 필요하다
   - 녹음(MediaRecorder)과 완전히 분리: 인식이 실패해도 녹음·재생·분석은 그대로 동작
   - 자동 받아쓰기는 실제 말과 다를 수 있다(특히 um/uh 같은 군말은 빠지는 경우가 많다) */
(function (root) {
  'use strict';
  const SR = root.SpeechRecognition || root.webkitSpeechRecognition;
  let inst = null;
  let state = null;

  function status() {
    if (!SR) return { ok: false, msg: '이 브라우저는 자동 받아쓰기를 지원하지 않습니다. 받아쓴 글을 직접 입력하거나 붙여 넣어 주세요.' };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, msg: '오프라인 상태라 자동 받아쓰기를 쓸 수 없습니다(인식에 인터넷이 필요). 직접 입력해 주세요.' };
    return { ok: true, msg: '' };
  }

  /* start({onText(final, interim), onError(msg)}) */
  function start(o) {
    stop();
    const st = status();
    if (!st.ok) { o.onError && o.onError(st.msg); return false; }
    try {
      inst = new SR();
      inst.lang = 'en-US'; inst.continuous = true; inst.interimResults = true; inst.maxAlternatives = 1;
    } catch (e) { o.onError && o.onError('자동 받아쓰기를 시작하지 못했습니다.'); return false; }
    state = { final: '', interim: '', running: true, o, restarts: 0 };
    const s = state;
    inst.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) s.final += r[0].transcript.trim() + ' ';
        else interim += r[0].transcript;
      }
      s.interim = interim;
      o.onText && o.onText(s.final.trim(), interim);
    };
    inst.onerror = e => {
      const map = {
        'not-allowed': '자동 받아쓰기 권한이 거부되었습니다. 녹음은 계속됩니다.',
        'service-not-allowed': '이 브라우저에서 자동 받아쓰기를 쓸 수 없습니다. 녹음은 계속됩니다.',
        'network': '인터넷 연결 문제로 자동 받아쓰기가 멈췄습니다. 녹음은 계속됩니다.',
        'audio-capture': '녹음과 동시에 받아쓰기를 할 수 없는 기기입니다. 녹음은 계속됩니다. 받아쓴 글은 직접 입력해 주세요.',
        'language-not-supported': '영어 인식을 지원하지 않는 설정입니다.'
      };
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      s.running = false;
      o.onError && o.onError(map[e.error] || ('자동 받아쓰기 오류: ' + e.error));
    };
    /* 인식이 몇 초 만에 저절로 끝나는 브라우저가 있어, 녹음 중에는 다시 시작 */
    inst.onend = () => {
      if (s.running && s === state && s.restarts < 50) { s.restarts++; try { inst.start(); } catch (e) {} }
    };
    try { inst.start(); } catch (e) { o.onError && o.onError('자동 받아쓰기를 시작하지 못했습니다.'); return false; }
    return true;
  }
  /* 정지 → 최종 텍스트 */
  function stop() {
    const s = state;
    if (!s) return '';
    s.running = false;
    try { inst && inst.stop(); } catch (e) {}
    state = null;
    return (s.final + ' ' + (s.interim || '')).replace(/\s+/g, ' ').trim();
  }

  root.OPIC = root.OPIC || {};
  root.OPIC.stt = { available: () => !!SR, status, start, stop };
})(typeof window !== 'undefined' ? window : globalThis);
