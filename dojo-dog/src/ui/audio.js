// 소리는 전부 Web Audio로 그 자리에서 합성한다 (녹음 파일 없음). 기본은 꺼짐.
// BGM: 사계절 모두 타이틀(봄)과 같은 가볍고 밝은 장조 5음 뜯는 소리. 계절은 높이·빠르기와 작은 장식음으로만 구분한다.
//  여름=가끔 높은 피리, 가을=조금 느긋하게, 겨울=가끔 높은 종. 무거운 북·저음 지속음·단조 음계는 쓰지 않는다.
const MAJOR5 = [0, 2, 4, 7, 9];
const SCALES = { spring: MAJOR5, summer: MAJOR5, autumn: MAJOR5, winter: MAJOR5 };
const ROOT = { spring: 62, summer: 64, autumn: 60, winter: 65 };
const TEMPO = { spring: 84, summer: 92, autumn: 80, winter: 78 };

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.bgmVol = 0.5;
    this.sfxVol = 0.45;
    this.sfxOn = true;
    this.speed = 1;
    this.season = 'spring';
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.seed = 1;
  }
  ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.bgmBus = this.ctx.createGain();
    this.bgmBus.gain.value = this.bgmVol * 0.5;
    this.bgmBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxVol * 0.6;
    this.sfxBus.connect(this.master);
    return true;
  }
  setOn(v) {
    this.on = v;
    if (v) {
      if (!this.ensure()) return;
      this.ctx.resume?.();
      this.startBgm();
    } else {
      this.stopBgm();
    }
  }
  // 효과음은 BGM보다 작게 (버스 배율 0.6)
  setVolumes(bgm, sfx, sfxOn = true) {
    this.bgmVol = bgm;
    this.sfxVol = sfx;
    this.sfxOn = sfxOn;
    if (this.ctx) {
      this.bgmBus.gain.value = bgm * 0.5;
      this.sfxBus.gain.value = sfx * 0.6;
    }
  }
  setSeason(s) {
    if (this.season !== s) {
      this.season = s;
      this.step = 0;
    }
  }
  rnd() {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  startBgm() {
    if (!this.ctx || this.timer) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 100);
  }
  stopBgm() {
    clearInterval(this.timer);
    this.timer = null;
  }
  schedule() {
    if (!this.on || !this.ctx) return;
    const beat = 60 / TEMPO[this.season] / 2; // 8분음
    while (this.nextTime < this.ctx.currentTime + 0.6) {
      this.playStep(this.nextTime, this.step);
      this.nextTime += beat;
      this.step++;
    }
  }
  playStep(t, i) {
    const s = this.season;
    const sc = SCALES[s];
    const root = ROOT[s];
    const bar = i % 16;
    const pick = (oct = 0) => root + sc[Math.floor(this.rnd() * sc.length)] + 12 * oct;
    // 기본: 타이틀 음악과 같은 뜯는 소리 선율 + 마디 머리의 가벼운 베이스
    if (bar % 2 === 0) this.pluck(t, midi(pick(this.rnd() < 0.3 ? 1 : 0)), 0.16);
    if (bar === 0 || bar === 8) this.pluck(t, midi(root - 12), 0.14, 1.6);
    // 계절 장식 (작게, 가끔)
    if (s === 'summer' && bar % 4 === 3 && this.rnd() < 0.35) this.flute(t, midi(pick(1)), 0.05, 0.35);
    if (s === 'winter' && (bar === 4 || bar === 12) && this.rnd() < 0.6) this.bell(t, midi(pick(1)), 0.05);
  }
  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  pluck(t, f, v, d = 0.9) {
    const c = this.ctx;
    // 뜯는 소리: 삼각파 + 한 옥타브 위 사인을 살짝 (톱니파·노이즈 없음)
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    const g2 = c.createGain();
    o.type = 'triangle';
    o2.type = 'sine';
    o.frequency.value = f;
    o2.frequency.value = f * 2;
    g2.gain.value = 0.18;
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.bgmBus);
    this.env(g, t, 0.005, v, d);
    o.start(t);
    o2.start(t);
    o.stop(t + d + 0.05);
    o2.stop(t + d + 0.05);
  }
  flute(t, f, v, d) {
    const c = this.ctx;
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lg = c.createGain();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    lfo.frequency.value = 5.5;
    lg.gain.value = f * 0.012;
    lfo.connect(lg).connect(o.frequency);
    o.connect(g).connect(this.bgmBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.06);
    g.gain.linearRampToValueAtTime(0.0001, t + d);
    o.start(t);
    lfo.start(t);
    o.stop(t + d + 0.05);
    lfo.stop(t + d + 0.05);
  }


  bell(t, f, v) {
    const c = this.ctx;
    for (const [m, a] of [[1, 1], [2.76, 0.4], [5.4, 0.15]]) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f * m;
      o.connect(g).connect(this.bgmBus);
      this.env(g, t, 0.003, v * a, 2.4 / m + 0.4);
      o.start(t);
      o.stop(t + 3);
    }
  }
  // ───── 효과음 ─────
  // 중요한 순간에만: 竹刀·旗·짖음·큰 사건·클리어. 버튼은 작은 「뿅」. 4배속 이상에서는 자동 효과음을 건너뛴다.
  sfx(kind) {
    if (!this.on || !this.sfxOn || !this.ensure()) return;
    if (this.speed >= 4 && kind !== 'tap') return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const tone = (type, f0, f1, at, v, d) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, at);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + d * 0.8);
      o.connect(g).connect(this.sfxBus);
      this.env(g, at, 0.004, v, d);
      o.start(at);
      o.stop(at + d + 0.05);
    };
    if (kind === 'shinai') {
      // 竹刀가 맞닿는 「탁·탁」: 짧은 나무 소리 두 번 (노이즈 없이 사인 두 개)
      for (const [dt, v] of [[0, 0.5], [0.12, 0.32]]) {
        tone('sine', 1250, 700, t + dt, v, 0.05);
        tone('triangle', 2300, 1500, t + dt, v * 0.25, 0.03);
      }
    } else if (kind === 'flag') {
      // 旗가 올라가는 순간: 짧게 올라가는 두 음
      tone('triangle', midi(76), midi(76), t, 0.3, 0.12);
      tone('triangle', midi(83), midi(83), t + 0.1, 0.3, 0.28);
    } else if (kind === 'bark') {
      // 「왕」: 삼각파 음높이 하강 + 낮은 대역 필터
      for (const dt of [0, 0.2]) {
        const o = c.createOscillator();
        const lp = c.createBiquadFilter();
        const g = c.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(560, t + dt);
        o.frequency.exponentialRampToValueAtTime(300, t + dt + 0.12);
        lp.type = 'lowpass';
        lp.frequency.value = 1600;
        o.connect(lp).connect(g).connect(this.sfxBus);
        this.env(g, t + dt, 0.01, 0.45, 0.13);
        o.start(t + dt);
        o.stop(t + dt + 0.2);
      }
    } else if (kind === 'tap') {
      // 작은 「뿅」
      tone('sine', 620, 980, t, 0.07, 0.07);
    } else if (kind === 'big') {
      // 큰 사건: 부드러운 종 화음
      [0, 7, 12].forEach((n, i) => this.bellTo(this.sfxBus, t + i * 0.06, midi(67 + n), 0.12));
    } else if (kind === 'clear') {
      [0, 4, 7, 12].forEach((n, i) => this.bellTo(this.sfxBus, t + i * 0.11, midi(72 + n), 0.16));
    }
  }
  bellTo(bus, t, f, v) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    o.connect(g).connect(bus);
    this.env(g, t, 0.004, v, 0.6);
    o.start(t);
    o.stop(t + 0.7);
  }
}
