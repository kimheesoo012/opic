// 짧은 효과음 (Web Audio). 설정에서 끌 수 있고, 재생 실패는 무시한다.
let ctx = null;
const NOTES = {
  right: [[660, 0, 0.09], [880, 0.08, 0.12]],
  wrong: [[220, 0, 0.16]],
  goal: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.18]],
  level: [[392, 0, 0.08], [523, 0.08, 0.08], [659, 0.16, 0.08], [1046, 0.24, 0.2]],
};

export function play(kind, enabled = true) {
  if (!enabled || !NOTES[kind]) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    for (const [f, at, dur] of NOTES[kind]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === 'wrong' ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + at);
      o.stop(t0 + at + dur + 0.02);
    }
  } catch { /* 소리 없이 진행 */ }
}
