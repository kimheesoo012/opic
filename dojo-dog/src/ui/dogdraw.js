// 간단한 도형으로 그리는 오리지널 닥스훈트. 화면, 타이틀, 결과 카드가 같이 쓴다.
import { COATS } from '../engine/world.js';

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}
function hashStr(s) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

// dog: {coat, hair, name}, opts: {pose:'walk'|'sit'|'sleep'|'bark'|'stand', t, senior, flip}
export function drawDog(ctx, x, y, scale, dog, opts = {}) {
  const coat = COATS.find((c) => c.id === dog.coat) || COATS[0];
  const pose = opts.pose || 'stand';
  const t = opts.t || 0;
  const long = dog.hair === 'long';
  const wire = dog.hair === 'wire';
  const base = coat.base;
  const tan = coat.tan;
  const dark = shade(base, -0.25);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(opts.flip ? -scale : scale, scale);
  const sleep = pose === 'sleep';
  const sit = pose === 'sit';
  const walk = pose === 'walk';
  const bob = walk ? Math.sin(t * 10) * 1.2 : sleep ? Math.sin(t * 2) * 0.8 : 0;
  ctx.translate(0, bob);

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ell(ctx, 0, 34, 74, 7);

  // 꼬리
  ctx.strokeStyle = base;
  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  const wag = Math.sin(t * (pose === 'bark' ? 18 : 9)) * (sleep ? 2 : 8);
  ctx.beginPath();
  ctx.moveTo(-52, -6);
  ctx.quadraticCurveTo(-74, -18 + wag * 0.4, -84, sleep ? 6 : -30 + wag);
  ctx.stroke();
  if (long) {
    ctx.fillStyle = base;
    ell(ctx, -80, sleep ? 4 : -22 + wag, 8, 16, -0.5);
  }

  // 다리
  const legY = sleep ? 18 : 12;
  const legH = sleep ? 8 : 24;
  const sw = walk ? Math.sin(t * 10) * 6 : 0;
  ctx.fillStyle = dark;
  const legs = sit
    ? [[-40, 0, 1], [-28, 0, 1], [34, sw, 0], [46, -sw, 0]]
    : [[-40, sw, 0], [-28, -sw, 0], [34, -sw, 0], [46, sw, 0]];
  for (const [lx, d, folded] of legs) {
    ctx.save();
    ctx.translate(lx, legY);
    ctx.rotate((d * Math.PI) / 180 * 2);
    if (folded) rrect(ctx, -6, 0, 18, 10, 5);
    else rrect(ctx, -5, 0, 10, legH, 4);
    ctx.fillStyle = tan;
    if (!folded && coat.id !== 'red' && coat.id !== 'cream') rrect(ctx, -5, legH - 6, 10, 6, 3);
    ctx.restore();
    ctx.fillStyle = dark;
  }

  // 몸통
  ctx.fillStyle = base;
  ctx.save();
  if (sit) ctx.rotate(-0.12);
  rrect(ctx, -60, -18, 120, sleep ? 38 : 40, 20);
  ctx.restore();
  // 앉은 자세: 뒷다리 허벅지
  if (sit) {
    ctx.fillStyle = shade(base, -0.08);
    ell(ctx, -40, 10, 20, 16, -0.3);
    ctx.fillStyle = dark;
    rrect(ctx, -52, 18, 26, 9, 4);
  }
  // 대플 반점
  if (coat.spot) {
    const h = hashStr(dog.name || 'x');
    ctx.fillStyle = coat.spot;
    for (let i = 0; i < 9; i++) {
      const sx = -50 + ((h >> (i * 3)) % 96);
      const sy = -12 + ((h >> (i * 2 + 1)) % 24);
      ell(ctx, sx, sy, 5 + (i % 3) * 2, 4 + (i % 2) * 2);
    }
  }
  // 가슴의 탄
  if (coat.id !== 'red' && coat.id !== 'cream') {
    ctx.fillStyle = tan;
    ell(ctx, 50, 8, 12, 9);
  }
  // 장모 배털
  if (long) {
    ctx.fillStyle = base;
    for (let i = -44; i <= 40; i += 12) ell(ctx, i, 20, 7, 6);
  }

  // 머리
  const hx = sleep ? 70 : 64;
  const hy = sleep ? 4 : -26 + (sit ? -6 : 0);
  ctx.fillStyle = base;
  ell(ctx, hx, hy, 22, 18);
  // 주둥이
  const tilt = pose === 'bark' ? -0.15 : 0;
  ctx.save();
  ctx.translate(hx + 20, hy + 6);
  ctx.rotate(tilt);
  ctx.fillStyle = coat.id === 'red' || coat.id === 'cream' ? shade(base, 0.05) : tan;
  if (coat.id === 'black_tan' || coat.id === 'choco_tan' || coat.id === 'dapple') ctx.fillStyle = shade(base, 0.12);
  rrect(ctx, -6, -8, 30, 15, 7);
  if (opts.senior) {
    ctx.fillStyle = 'rgba(230,230,230,0.55)';
    rrect(ctx, 0, -6, 24, 12, 6);
  }
  // 코
  ctx.fillStyle = '#141010';
  ell(ctx, 24, -3, 5, 4);
  // 입
  if (pose === 'bark') {
    ctx.fillStyle = '#5a1f1f';
    ell(ctx, 14, 7, 7, 4);
  }
  // 와이어: 수염
  if (wire) {
    ctx.fillStyle = shade(base, -0.12);
    ctx.beginPath();
    ctx.moveTo(4, 6);
    ctx.quadraticCurveTo(14, 20, 22, 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // 눈
  ctx.fillStyle = '#0d0b0a';
  if (sleep) {
    ctx.strokeStyle = '#0d0b0a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx + 8, hy - 4, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ell(ctx, hx + 9, hy - 5, 3.2, 3.6);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ell(ctx, hx + 10, hy - 6.5, 1, 1);
  }
  // 눈썹(탄 점 / 와이어 덥수룩)
  ctx.fillStyle = wire ? shade(base, 0.25) : tan;
  if (coat.id !== 'red' && coat.id !== 'cream') ell(ctx, hx + 8, hy - 12, wire ? 6 : 3, wire ? 3 : 2);
  // 귀
  ctx.fillStyle = dark;
  const earSw = walk ? Math.sin(t * 10) * 0.12 : 0;
  ctx.save();
  ctx.translate(hx - 6, hy - 8);
  ctx.rotate(0.25 + earSw);
  ell(ctx, 0, 14, 9, long ? 22 : 17);
  if (long) for (let i = 0; i < 4; i++) ell(ctx, -4 + i * 3, 32 + (i % 2) * 3, 4, 6);
  ctx.restore();

  ctx.restore();
  // 잠: Z
  if (sleep) {
    ctx.save();
    ctx.fillStyle = 'rgba(220,220,240,0.8)';
    ctx.font = `${Math.round(14 * scale)}px sans-serif`;
    const zz = (t * 0.8) % 1;
    ctx.globalAlpha = 1 - zz;
    ctx.fillText('z', x + (opts.flip ? -90 : 90) * scale, y - (30 + zz * 30) * scale);
    ctx.restore();
  }
  if (pose === 'bark') {
    ctx.save();
    ctx.fillStyle = 'rgba(240,220,180,0.95)';
    ctx.font = `bold ${Math.round(16 * scale)}px sans-serif`;
    ctx.fillText('わん!', x + (opts.flip ? -150 : 110) * scale, y - 46 * scale);
    ctx.restore();
  }
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  r = f(r);
  g = f(g);
  b = f(b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
