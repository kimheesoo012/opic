// LCD 창: 160×96 도트 장면을 캔버스에 그린다. 배경 + 사람 + 개 + 말풍선 + 계절 입자.
import { Buf, C, PAL } from './core.js';
import { bgBuf, BW, BH } from './bg.js';
import { dogFrame, propBuf, bubbleBuf } from './dog.js';
import { personFrame, LOOKS } from './people.js';
import { FLOOR } from './director.js';

const RGB = PAL.map((hex) => (hex ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) : null));

export function paint(ctx, buf, gray = false) {
  const img = ctx.createImageData(buf.w, buf.h);
  const o = img.data;
  for (let i = 0; i < buf.d.length; i++) {
    const c = buf.d[i];
    if (!c) continue;
    let [r, g, b] = RGB[c];
    if (gray) r = g = b = Math.round(r * 0.3 + g * 0.59 + b * 0.11);
    o[i * 4] = r;
    o[i * 4 + 1] = g;
    o[i * 4 + 2] = b;
    o[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

const OUTDOOR = new Set(['street', 'river', 'shrine', 'festival']);
const IDLE_ACTS = {
  indoor: ['stand', 'sniff', 'sit', 'sleep', 'belly', 'kote', 'bag', 'eat'],
  outdoor: ['sniff', 'dig', 'stand', 'sit', 'run'],
  senior: ['sleep', 'sleep', 'stand', 'sit', 'eat'],
  puppy: ['run', 'sleep', 'stand', 'eat', 'step'],
};

export class LCD {
  constructor(canvas) {
    this.c = canvas;
    canvas.width = BW;
    canvas.height = BH;
    this.ctx = canvas.getContext('2d');
    this.buf = new Buf(BW, BH);
    this.plan = { loc: 'dojo', tod: 'day', people: [], dog: { mode: 'wander' } };
    this.season = 'spring';
    this.dog = null;
    this.stage = 'adult';
    this.heavy = false;
    this.speed = 1;
    this.t = 0;
    this.dx = 40;
    this.dir = 1;
    this.act = 'walk';
    this.actUntil = 0;
    this.parts = [];
    this.flagUntil = 0;
    this.barkUntil = 0;
    this.running = false;
    this.lastDraw = 0;
    this.s = null;
    this.onFrame = this.frame.bind(this);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.onFrame);
  }
  stop() {
    this.running = false;
  }
  setPlan(plan, s) {
    const changedLoc = plan.loc !== this.plan.loc;
    this.plan = plan;
    this.s = s;
    if (plan.dog.mode !== 'wander' && plan.dog.x != null) this.dx = plan.dog.x;
    if (changedLoc) this.parts = [];
    this.act = plan.dog.mode === 'wander' ? 'walk' : plan.dog.pose || 'sit';
    this.actUntil = this.t + 3;
    this.draw();
  }
  bark() {
    this.barkUntil = this.t + 1.2;
  }
  flags() {
    this.flagUntil = this.t + 1.6;
  }
  frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.t += dt * Math.min(4, this.speed);
    if (now - this.lastDraw > 90) {
      this.lastDraw = now;
      this.update(dt * Math.min(4, this.speed));
      this.draw();
    }
    requestAnimationFrame(this.onFrame);
  }
  update(dt) {
    if (this.paused) return;
    const p = this.plan;
    if (p.dog.mode !== 'wander') return;
    if (this.t > this.actUntil) {
      if (this.act !== 'walk') {
        this.act = 'walk';
        this.actUntil = this.t + 2 + Math.random() * 3;
      } else {
        const list = this.stage === 'puppy' ? IDLE_ACTS.puppy : this.stage === 'senior' ? IDLE_ACTS.senior : OUTDOOR.has(p.loc) ? IDLE_ACTS.outdoor : IDLE_ACTS.indoor;
        this.act = list[Math.floor(Math.random() * list.length)];
        this.actUntil = this.t + (this.act === 'sleep' || this.act === 'bag' ? 6 : 3) + Math.random() * 2;
      }
    }
    if (this.act === 'walk' || this.act === 'run') {
      const v = (this.act === 'run' ? 26 : this.stage === 'senior' ? 6 : 12) * dt;
      this.dx += this.dir * v;
      if (this.dx > 120) this.dir = -1;
      if (this.dx < 4) this.dir = 1;
    }
  }
  dogPose() {
    if (this.t < this.barkUntil) return 'bark';
    const a = this.act;
    if (a === 'walk') return this.stage === 'senior' ? 'oldwalk' : 'walk';
    if (a === 'bag') return 'sleep';
    if (a === 'step') return 'hesitate';
    return a;
  }
  draw() {
    const b = this.buf;
    const p = this.plan;
    const bg = bgBuf(p.loc, { season: this.season, tod: p.tod, t: this.t });
    b.d.set(bg.d);
    const fl = FLOOR[p.loc] || FLOOR.dojo;
    const f = Math.floor(this.t * 2.5) % 2;
    // 소품
    const pose = this.dogPose();
    const props = [];
    if (this.act === 'bag' && p.dog.mode === 'wander') props.push(['bag', this.dx - 4, fl.dy + 12]);
    if (this.act === 'eat') props.push(['bowl', this.dx + 28, fl.dy + 15]);
    if (this.act === 'kote') props.push(['kote', this.dx + 30, fl.dy + 13]);
    if (this.act === 'step') props.push(['step', this.dx + 26, fl.dy + 15]);
    if (p.loc === 'room' && p.dog.mode === 'stay') props.push(['cushion', this.dx - 2, fl.dy + 15]);
    // 심판
    const ppl = [];
    if (p.judges) {
      const up = this.t < this.flagUntil || (p.flagUp && true) ? 'red' : null;
      ppl.push({ buf: personFrame(LOOKS.judge, { pose: 'stand', casual: true, flags: true, flagUp: up }), x: 64, y: fl.py - 14 });
      ppl.push({ buf: personFrame(LOOKS.judge, { pose: 'stand', casual: true, flags: true, flagUp: up }), x: 22, y: fl.py + 12 });
      ppl.push({ buf: personFrame(LOOKS.judge, { pose: 'stand', casual: true, flags: true, flagUp: up }), x: 112, y: fl.py + 12, flip: true });
    }
    for (const q of p.people) {
      const lk = q.role === '_rival' ? { look: LOOKS.rival, size: 'adult' } : this.lookOf(q.role);
      if (!lk) continue;
      let ps = q.pose || 'stand';
      if (q.anim === 'keiko' || q.anim === 'match') {
        const per = q.anim === 'match' ? 4 : 2.4;
        const ph = (this.t + (q.phase ? per / 2 : 0)) % per;
        ps = ph < per - 1 ? 'kamae' : ph < per - 0.7 ? 'raise' : ph < per - 0.3 ? 'strike' : 'kamae';
        if (q.anim === 'match' && q.phase) ps = 'kamae';
        if (q.anim === 'match' && !q.phase && ps === 'strike') this.flagUntil = Math.max(this.flagUntil, this.t + 1.2);
      }
      const buf = personFrame(lk.look, { pose: ps, bogu: !!q.bogu, casual: !!q.casual, f, size: lk.size, mark: q.mark, shinai: q.anim === 'keiko' });
      ppl.push({ buf, x: q.x, y: fl.py + (ps === 'seiza' ? 0 : 0), flip: !!q.flip, talk: q.talk });
    }
    ppl.sort((a, c) => a.y - c.y);
    for (const q of ppl) b.blit(q.buf, Math.round(q.x), q.y, q.flip);
    // 개
    if (this.dog) {
      const d = dogFrame(this.dog, { pose, f, stage: this.stage === 'young' ? 'adult' : this.stage, heavy: this.heavy });
      const flip = p.dog.mode === 'wander' ? this.dir < 0 : false;
      for (const [n, x, y] of props) b.blit(propBuf(n), Math.round(x), y);
      b.blit(d, Math.round(this.dx), fl.dy + (pose === 'sleep' || pose === 'belly' ? 1 : 0), flip);
      // 말풍선
      const bub = this.bubbleKind(pose);
      if (bub) b.blit(bubbleBuf(bub), Math.round(this.dx) + (flip ? 2 : 22), fl.dy - 8);
    }
    const talker = ppl.find((q) => q.talk);
    if (talker && this.plan.talkBubble !== false) b.blit(bubbleBuf(f ? 'note' : '!'), Math.round(talker.x) + 10, talker.y - 6);
    this.particles(b);
    paint(this.ctx, b);
  }
  bubbleKind(pose) {
    if (this.plan.bubble) return this.plan.bubble;
    if (pose === 'sleep') return Math.floor(this.t) % 3 === 0 ? 'z' : null;
    if (pose === 'belly') return 'heart';
    if (pose === 'hesitate') return 'sweat';
    return null;
  }
  lookOf(role) {
    if (!this.s) return null;
    return this.lookFn ? this.lookFn(this.s, role) : null;
  }
  particles(b) {
    const p = this.plan;
    const kind = { spring: 'petal', autumn: 'leaf', winter: 'snow' }[this.season];
    if (!OUTDOOR.has(p.loc) || !kind || p.loc === 'festival') return;
    if (this.parts.length < 18 && Math.random() < 0.35) this.parts.push({ x: Math.random() * BW, y: -2, v: 6 + Math.random() * 6, s: Math.random() * 6, born: this.t });
    for (const q of this.parts) {
      const age = this.t - q.born;
      q.y = -2 + age * q.v;
      const x = Math.round(q.x + Math.sin(age * 2 + q.s) * 4);
      const c = kind === 'petal' ? C.P : kind === 'leaf' ? (q.s > 3 ? C.R : C.T) : C.W;
      b.set(x, Math.round(q.y), c);
      if (kind !== 'snow') b.set(x + 1, Math.round(q.y), c);
    }
    this.parts = this.parts.filter((q) => q.y < BH);
  }
}

// 정지 그림: 개 한 마리(+배경색)를 작은 캔버스에 (타이틀·탄생·추도·카드)
export function dogPortrait(canvas, dog, { pose = 'stand', stage = 'adult', f = 0, heavy = false, gray = false, pad = 2 } = {}) {
  const d = dogFrame(dog, { pose, f, stage, heavy });
  const b = new Buf(d.w + pad * 2, d.h + pad * 2);
  b.blit(d, pad, pad);
  canvas.width = b.w;
  canvas.height = b.h;
  paint(canvas.getContext('2d'), b, gray);
  return canvas;
}

// 캔버스를 기기 픽셀 기준 정수 배율로 맞춘다
export function fitCanvas(cv, maxCss) {
  const dpr = window.devicePixelRatio || 1;
  const avail = Math.min(maxCss, (cv.parentElement?.clientWidth || maxCss) - 4);
  const k = Math.max(1, Math.floor((avail * dpr) / cv.width));
  const w = (k * cv.width) / dpr;
  cv.style.width = w + 'px';
  cv.style.height = (w * cv.height) / cv.width + 'px';
}

