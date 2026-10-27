// 소리는 전부 Web Audio로 그 자리에서 합성한다 (녹음 파일 없음). 기본은 꺼짐.
// 계절 BGM: 봄=요나누키 장음계 뜯는 소리, 여름=축제 북+피리, 가을=미야코부시 음계, 겨울=종소리.
const SCALES = {
  spring: [0, 2, 4, 7, 9], // 장조 5음
  summer: [0, 2, 5, 7, 9], // 요 음계 계열
  autumn: [0, 1, 5, 7, 8], // 미야코부시 (인 음계)
  winter: [0, 3, 5, 7, 10],
};
const ROOT = { spring: 62, summer: 64, autumn: 57, winter: 60 };
const TEMPO = { spring: 84, summer: 104, autumn: 68, winter: 56 };

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.bgmVol = 0.5;
    this.sfxVol = 0.7;
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
    this.sfxBus.gain.value = this.sfxVol;
    this.sfxBus.connect(this.master);
    // 노이즈 버퍼
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
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
  setVolumes(bgm, sfx) {
    this.bgmVol = bgm;
    this.sfxVol = sfx;
    if (this.ctx) {
      this.bgmBus.gain.value = bgm * 0.5;
      this.sfxBus.gain.value = sfx;
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
    if (s === 'spring') {
      if (bar % 2 === 0) this.pluck(t, midi(pick(this.rnd() < 0.3 ? 1 : 0)), 0.16);
      if (bar === 0 || bar === 8) this.pluck(t, midi(root - 12), 0.14, 1.6);
    } else if (s === 'summer') {
      if (bar % 4 === 0) this.taiko(t, bar === 0 ? 0.5 : 0.32);
      if (bar % 4 === 2 && this.rnd() < 0.6) this.taiko(t, 0.18, true);
      if (bar % 2 === 1 && this.rnd() < 0.55) this.flute(t, midi(pick(1)), 0.07, 0.42);
    } else if (s === 'autumn') {
      if (bar % 3 === 0 && this.rnd() < 0.75) this.pluck(t, midi(pick()), 0.15, 1.4);
      if (bar === 0) this.pad(t, midi(root - 12), 0.05, 3.4);
    } else {
      if (bar % 4 === 0 && this.rnd() < 0.8) this.bell(t, midi(pick(1)), 0.1);
      if (bar === 0) this.pad(t, midi(root - 12), 0.04, 4);
    }
  }
  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  pluck(t, f, v, d = 0.9) {
    const c = this.ctx;
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    o.type = 'triangle';
    o2.type = 'sawtooth';
    o.frequency.value = f;
    o2.frequency.value = f * 1.003;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 6, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + d);
    const g2 = c.createGain();
    g2.gain.value = 0.25;
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(lp).connect(this.bgmBus);
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
  taiko(t, v, rim = false) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(rim ? 220 : 110, t);
    o.frequency.exponentialRampToValueAtTime(rim ? 140 : 46, t + 0.25);
    o.connect(g).connect(this.bgmBus);
    this.env(g, t, 0.004, v, rim ? 0.12 : 0.5);
    o.start(t);
    o.stop(t + 0.6);
  }
  pad(t, f, v, d) {
    const c = this.ctx;
    const g = c.createGain();
    g.connect(this.bgmBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + d * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + d);
    for (const m of [1, 1.5, 2.005]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * m;
      o.connect(g);
      o.start(t);
      o.stop(t + d + 0.05);
    }
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
  sfx(kind) {
    if (!this.on || !this.ensure()) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    if (kind === 'shinai') {
      // 竹刀 부딪히는 소리: 짧은 고역 노이즈 두 번 + 딸깍
      for (const [dt, v] of [[0, 0.9], [0.09, 0.55]]) {
        const s = c.createBufferSource();
        s.buffer = this.noise;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2600;
        bp.Q.value = 1.4;
        const g = c.createGain();
        s.connect(bp).connect(g).connect(this.sfxBus);
        this.env(g, t + dt, 0.002, v * 0.6, 0.07);
        s.start(t + dt, Math.random() * 0.5, 0.12);
        const o = c.createOscillator();
        const og = c.createGain();
        o.type = 'square';
        o.frequency.value = 1700;
        o.connect(og).connect(this.sfxBus);
        this.env(og, t + dt, 0.001, v * 0.08, 0.03);
        o.start(t + dt);
        o.stop(t + dt + 0.05);
      }
    } else if (kind === 'step') {
      for (let i = 0; i < 4; i++) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t + i * 0.16);
        o.frequency.exponentialRampToValueAtTime(70, t + i * 0.16 + 0.05);
        o.connect(g).connect(this.sfxBus);
        this.env(g, t + i * 0.16, 0.002, 0.25, 0.06);
        o.start(t + i * 0.16);
        o.stop(t + i * 0.16 + 0.1);
      }
    } else if (kind === 'bark') {
      // 「왕」: 사각파 음높이 하강 + 포먼트 필터
      for (const dt of [0, 0.22]) {
        const o = c.createOscillator();
        const bp = c.createBiquadFilter();
        const g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(620, t + dt);
        o.frequency.exponentialRampToValueAtTime(330, t + dt + 0.12);
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1400, t + dt);
        bp.frequency.exponentialRampToValueAtTime(800, t + dt + 0.12);
        bp.Q.value = 3;
        o.connect(bp).connect(g).connect(this.sfxBus);
        this.env(g, t + dt, 0.01, 0.5, 0.13);
        o.start(t + dt);
        o.stop(t + dt + 0.2);
      }
    } else if (kind === 'tap') {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      o.connect(g).connect(this.sfxBus);
      this.env(g, t, 0.002, 0.08, 0.05);
      o.start(t);
      o.stop(t + 0.08);
    } else if (kind === 'clear') {
      [0, 4, 7, 12].forEach((n, i) => this.bellTo(this.sfxBus, t + i * 0.11, midi(72 + n), 0.18));
    } else if (kind === 'tamb') {
      const s = c.createBufferSource();
      s.buffer = this.noise;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      const g = c.createGain();
      s.connect(hp).connect(g).connect(this.sfxBus);
      this.env(g, t, 0.002, 0.5, 0.16);
      s.start(t, 0, 0.2);
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
