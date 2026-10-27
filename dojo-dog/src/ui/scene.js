// 도장 장면 캔버스: 마루, 神棚, 계절 창문, 그리고 개.
import { drawDog, shade } from './dogdraw.js';

export class Scene {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.dog = null;
    this.season = 'spring';
    this.pose = 'walk';
    this.x = 0.3;
    this.dir = 1;
    this.senior = false;
    this.speed = 1;
    this.parts = [];
    this.running = false;
    this.last = 0;
    this.t = 0;
    this.barkUntil = 0;
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
  bark() {
    this.barkUntil = this.t + 1.2;
  }
  resize() {
    const r = this.c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (this.c.width !== w || this.c.height !== h) {
      this.c.width = w;
      this.c.height = h;
    }
    return { w, h, dpr };
  }
  frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.draw(dt);
    requestAnimationFrame(this.onFrame);
  }
  draw(dt) {
    const { w, h, dpr } = this.resize();
    const ctx = this.ctx;
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue(n).trim() || '#888';
    const floorY = h * 0.72;
    // 벽
    const wall = v('--bg2');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);
    // 창문 (계절)
    const win = { x: w * 0.06, y: h * 0.1, w: w * 0.34, h: h * 0.36 };
    const sky = { spring: ['#f5d7de', '#c9dff2'], summer: ['#8fd3f0', '#d9f2e8'], autumn: ['#f2c38a', '#e8dcc6'], winter: ['#b8c7dc', '#e9eef5'] }[this.season];
    const g = ctx.createLinearGradient(0, win.y, 0, win.y + win.h);
    g.addColorStop(0, sky[0]);
    g.addColorStop(1, sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(win.x, win.y, win.w, win.h);
    ctx.strokeStyle = v('--wood2');
    ctx.lineWidth = 6 * dpr;
    ctx.strokeRect(win.x, win.y, win.w, win.h);
    ctx.lineWidth = 3 * dpr;
    ctx.beginPath();
    ctx.moveTo(win.x + win.w / 2, win.y);
    ctx.lineTo(win.x + win.w / 2, win.y + win.h);
    ctx.moveTo(win.x, win.y + win.h / 2);
    ctx.lineTo(win.x + win.w, win.y + win.h / 2);
    ctx.stroke();
    // 계절 입자
    this.particles(ctx, win, dt, dpr);
    // 神棚
    const kx = w * 0.62;
    const ky = h * 0.12;
    ctx.fillStyle = v('--wood');
    ctx.fillRect(kx, ky + 26 * dpr, w * 0.3, 6 * dpr);
    ctx.fillStyle = shade(v('--wood').startsWith('#') ? v('--wood') : '#c99a62', -0.2);
    ctx.beginPath();
    ctx.moveTo(kx + w * 0.07, ky + 26 * dpr);
    ctx.lineTo(kx + w * 0.15, ky + 4 * dpr);
    ctx.lineTo(kx + w * 0.23, ky + 26 * dpr);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f1efe9';
    ctx.fillRect(kx + w * 0.13, ky + 12 * dpr, w * 0.04, 12 * dpr);
    // 竹刀 걸이
    ctx.strokeStyle = v('--wood');
    ctx.lineWidth = 3 * dpr;
    for (let i = 0; i < 5; i++) {
      const sx = w * 0.64 + i * 12 * dpr;
      ctx.beginPath();
      ctx.moveTo(sx, h * 0.3);
      ctx.lineTo(sx + 6 * dpr, floorY - 6 * dpr);
      ctx.stroke();
    }
    // 마루
    const fg = ctx.createLinearGradient(0, floorY, 0, h);
    fg.addColorStop(0, v('--wood'));
    fg.addColorStop(1, v('--wood2'));
    ctx.fillStyle = fg;
    ctx.fillRect(0, floorY, w, h - floorY);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1 * dpr;
    for (let i = 1; i < 5; i++) {
      const y = floorY + ((h - floorY) * i) / 5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // 계절 색조
    ctx.fillStyle = v('--tint');
    ctx.fillRect(0, 0, w, h);
    // 개
    if (!this.dog) return;
    const scale = Math.min(w / 520, h / 260) * 1.05;
    let pose = this.pose;
    if (this.t < this.barkUntil) pose = 'bark';
    if (pose === 'walk') {
      const sp = (this.senior ? 0.035 : 0.07) * Math.min(4, this.speed);
      this.x += this.dir * sp * dt;
      if (this.x > 0.8) this.dir = -1;
      if (this.x < 0.2) this.dir = 1;
    }
    drawDog(ctx, w * this.x, floorY + 6 * dpr, scale, this.dog, { pose, t: this.t, senior: this.senior, flip: this.dir < 0 });
  }
  particles(ctx, win, dt, dpr) {
    const kind = { spring: 'petal', summer: 'sun', autumn: 'leaf', winter: 'snow' }[this.season];
    if (kind === 'sun') {
      ctx.fillStyle = 'rgba(255,240,180,0.9)';
      ctx.beginPath();
      ctx.arc(win.x + win.w * 0.75, win.y + win.h * 0.28, 12 * dpr, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (this.parts.length < 14 && Math.random() < dt * 6) this.parts.push({ x: Math.random(), y: -0.05, v: 0.08 + Math.random() * 0.1, s: Math.random() });
    ctx.save();
    ctx.beginPath();
    ctx.rect(win.x, win.y, win.w, win.h);
    ctx.clip();
    for (const p of this.parts) {
      p.y += p.v * dt;
      p.x += Math.sin((this.t + p.s * 10) * 2) * 0.002;
      const px = win.x + p.x * win.w;
      const py = win.y + p.y * win.h;
      ctx.fillStyle = kind === 'petal' ? '#f3a9bd' : kind === 'leaf' ? (p.s > 0.5 ? '#d9772f' : '#b5462a') : '#ffffff';
      ctx.beginPath();
      ctx.ellipse(px, py, (kind === 'snow' ? 2.5 : 4) * dpr, (kind === 'snow' ? 2.5 : 2.4) * dpr, p.s * 3 + this.t, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    this.parts = this.parts.filter((p) => p.y < 1.05);
  }
}
