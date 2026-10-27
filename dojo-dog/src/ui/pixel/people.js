// 도트 사람(28×32): 剣道着·袴·防具·竹刀, 稽古 동작 2~3프레임. 부위를 칸 단위로 칠한 뒤 외곽선을 두른다.
import { Buf, C } from './core.js';

export const PW = 28;
export const PH = 32;

// 인물별 모습. size: kid/teen/adult, hair: 색, style: short/bun/long/bob/bald, gi: 도복 색
export const LOOKS = {
  washio: { hair: C.W, style: 'short', gi: C.N, beard: true, size: 'adult', casual: { top: C.G } },
  makoto: { hair: C.K, style: 'short', gi: C.N, size: 'adult', casual: { top: C.W } },
  chiharu: { hair: C.D, style: 'bun', gi: C.N, casual: { top: C.R, apron: C.Y }, size: 'adult' },
  hinata: { hair: C.K, style: 'bob', gi: C.W, size: 'kid', casual: { top: C.P } },
  miura: { hair: C.D, style: 'short', gi: C.N, casual: { top: C.S, tie: C.E }, size: 'adult' },
  fumi: { hair: C.G, style: 'bun', gi: C.N, size: 'adult', casual: { top: C.V } },
  sojin: { hair: C.K, style: 'long', gi: C.N, size: 'adult', casual: { top: C.W, tie: C.L } },
  iincho: { hair: C.B, style: 'messy', glasses: true, casual: { top: C.V, band: C.E }, size: 'adult' },
  youta: { hair: C.K, style: 'short', gi: C.W, size: 'kid', casual: { top: C.L } },
  minori: { hair: C.B, style: 'long', gi: C.W, size: 'kid', casual: { top: C.Y } },
  kouhei: { hair: C.K, style: 'short', gi: C.N, casual: { top: C.L, tie: C.N }, size: 'adult' },
  takumi: { hair: C.B, style: 'short', gi: C.N, casual: { top: C.S, tie: C.Y }, size: 'adult' },
  setsuko: { hair: C.G, style: 'bob', gi: C.N, size: 'adult', casual: { top: C.P } },
  kiyo: { hair: C.W, style: 'bun', gi: C.N, size: 'adult', casual: { top: C.B, apron: C.N } },
  dabin: { hair: C.D, style: 'short', gi: C.N, size: 'adult', casual: { top: C.V } },
  haneul: { hair: C.K, style: 'bob', gi: C.N, size: 'adult', casual: { top: C.W, apron: C.S } },
  yuki: { hair: C.K, style: 'long', gi: C.N, casual: { top: C.L, apron: C.W }, size: 'adult' },
  // 이름 없는 사람들
  rival: { hair: C.K, style: 'short', gi: C.N, size: 'adult' },
  shop: { hair: C.K, style: 'short', casual: { top: C.W, apron: C.L, band: C.W }, size: 'adult' },
  judge: { hair: C.K, style: 'short', casual: { top: C.S, tie: C.E }, size: 'adult' },
  child: { hair: C.D, style: 'bob', casual: { top: C.Y }, size: 'kid' },
  elderly: { hair: C.G, style: 'bald', casual: { top: C.B }, size: 'adult' },
};

const SIZES = {
  kid: { head: 7, torso: 6, legs: 7, top: 12 },
  teen: { head: 8, torso: 7, legs: 9, top: 7 },
  adult: { head: 8, torso: 8, legs: 10, top: 4 },
};

/**
 * look: LOOKS 항목, opts: { pose: stand|kamae|raise|strike|seiza|bow|wave, bogu: bool, casual: bool, f, size, flags: 'red'|'white'|'both'|null }
 */
export function personFrame(look, opts = {}) {
  const b = new Buf(PW, PH);
  const z = SIZES[opts.size || look.size || 'adult'];
  const pose = opts.pose || 'stand';
  const bogu = !!opts.bogu;
  const casual = !!opts.casual && look.casual;
  const f = opts.f || 0;
  const gi = look.gi || C.N;
  const hakama = gi === C.W ? C.N : C.N;
  const giShade = gi === C.W ? C.G : C.K;
  const seiza = pose === 'seiza';
  const bow = pose === 'bow';
  const lunge = pose === 'strike';
  const x0 = 8 + (lunge ? 2 : 0) + (bow ? 1 : 0);
  let y = z.top + (seiza ? 9 : 0);
  // ── 하체
  const legTop = y + z.head + z.torso;
  if (seiza) {
    b.rect(x0 - 2, legTop, 12, 4, casual ? C.S : hakama);
    b.rect(x0 - 3, legTop + 3, 4, 2, C.C);
  } else if (casual) {
    b.rect(x0 + 1, legTop, 3, z.legs, C.S);
    b.rect(x0 + 5, legTop, 3, z.legs, C.S);
    b.rect(x0, legTop + z.legs, 4, 1, C.K);
    b.rect(x0 + 5, legTop + z.legs, 4, 1, C.K);
  } else {
    // 袴: 아래로 넓어지는 사다리꼴 + 주름
    for (let j = 0; j < z.legs; j++) {
      const w = 8 + Math.floor((j * 4) / z.legs);
      const sx = x0 + 4 - Math.floor(w / 2) + (lunge ? Math.floor(j / 3) : 0);
      b.rect(sx, legTop + j, w + (lunge ? Math.floor(j / 2) : 0), 1, hakama);
      if (j > 1) b.set(sx + 2, legTop + j, C.K), b.set(sx + w - 3, legTop + j, C.K);
    }
    b.rect(x0 + (lunge ? 8 : 1), legTop + z.legs, 3, 1, C.C);
    b.rect(x0 + (lunge ? -1 : 5), legTop + z.legs, 3, 1, C.C);
  }
  // ── 상체
  const ty = y + z.head;
  if (casual) {
    b.rect(x0, ty, 9, z.torso, look.casual.top);
    if (look.casual.apron) b.rect(x0 + 1, ty + 2, 7, z.torso - 1 + 3, look.casual.apron);
    if (look.casual.tie) b.rect(x0 + 4, ty, 1, 4, look.casual.tie);
    if (look.casual.band) b.rect(x0, ty + 1, 2, 2, look.casual.band);
  } else {
    b.rect(x0, ty, 9, z.torso, gi);
    // 깃(V자)
    b.set(x0 + 3, ty, C.W === gi ? C.G : C.W);
    b.set(x0 + 4, ty + 1, C.W === gi ? C.G : C.W);
    b.set(x0 + 5, ty, C.W === gi ? C.G : C.W);
    b.rect(x0, ty + z.torso - 1, 9, 1, giShade);
  }
  if (bogu && !casual) {
    // 胴(가슴판)과 垂
    b.rect(x0 + 1, ty + 2, 7, z.torso - 2, C.D);
    b.rect(x0 + 2, ty + 2, 5, 1, C.B);
    b.rect(x0, ty + z.torso, 9, 3, C.N);
    b.rect(x0 + 3, ty + z.torso, 3, 3, C.W);
    b.set(x0 + 4, ty + z.torso + 1, C.K);
  }
  // 目印: 시합 때 등에 다는 빨강·하양 끈
  if (opts.mark && !casual) b.rect(x0 - 1, ty + 1, 2, 4, opts.mark === 'red' ? C.E : C.W);
  // ── 머리
  const hx = x0 + 1 + (bow ? 3 : 0);
  const hy = y + (bow ? 3 : 0);
  if (bogu && !casual) {
    // 面: 쇠창살과 面布団
    b.rect(hx - 1, hy, z.head + 1, z.head, C.N);
    b.rect(hx + 2, hy + 2, z.head - 3, z.head - 3, C.G);
    for (let i = hx + 3; i < hx + z.head - 1; i += 2) for (let j = hy + 2; j < hy + z.head - 1; j++) b.set(i, j, C.K);
    b.rect(hx - 2, hy + z.head - 1, z.head + 3, 2, C.N);
    b.set(hx - 2, hy + 2, C.W);
  } else {
    b.rect(hx, hy + 1, z.head, z.head - 1, C.C);
    const hc = look.hair;
    // 머리카락
    if (look.style !== 'bald') b.rect(hx, hy, z.head, 2, hc), b.rect(hx, hy + 2, 2, z.head - 4, hc);
    if (look.style === 'bun') b.rect(hx - 1, hy - 1, 3, 3, hc);
    if (look.style === 'long') b.rect(hx - 1, hy + 2, 3, z.head + 2, hc);
    if (look.style === 'bob') b.rect(hx - 1, hy + 1, 2, z.head - 1, hc), b.rect(hx + z.head - 1, hy + 1, 1, 3, hc);
    if (look.style === 'messy') b.set(hx + 2, hy - 1, hc), b.set(hx + 5, hy - 1, hc), b.set(hx + 7, hy, hc);
    if (look.style === 'bald') b.rect(hx, hy + 2, 1, 3, hc), b.set(hx + 1, hy + 1, hc);
    // 눈·입
    b.set(hx + z.head - 2, hy + 3, C.K);
    if (look.glasses) b.set(hx + z.head - 3, hy + 3, C.K), b.set(hx + z.head - 2, hy + 3, C.A), b.set(hx + z.head - 1, hy + 3, C.K);
    if (look.beard) b.rect(hx + z.head - 3, hy + z.head - 2, 3, 1, C.W);
    else b.set(hx + z.head - 2, hy + z.head - 2, C.R);
    b.set(hx + z.head - 1, hy + 4, C.C);
  }
  b.outline();
  // ── 팔과 竹刀 (외곽선 뒤에 그려서 가늘게 보이게)
  const sh = { x: x0 + 7, y: ty + 1 };
  const hand = bogu && !casual ? C.N : C.C;
  const shinai = C.T;
  if (pose === 'kamae' || (pose === 'stand' && !casual && opts.shinai)) {
    const hxp = sh.x + 3;
    const hyp = ty + z.torso - 2 + (f % 2);
    b.line(sh.x, sh.y, hxp, hyp, gi === C.W ? C.G : gi);
    b.rect(hxp, hyp, 2, 2, hand);
    b.line(hxp + 2, hyp, hxp + 11, hyp - 4 - (f % 2), shinai);
    b.set(hxp + 2, hyp, C.K);
  } else if (pose === 'raise') {
    b.line(sh.x, sh.y, sh.x + 1, hy - 1, gi);
    b.rect(sh.x + 1, hy - 3, 2, 2, hand);
    b.line(sh.x, hy - 3, x0 - 6, hy - 1, shinai);
  } else if (pose === 'strike') {
    b.line(sh.x, sh.y, sh.x + 5, sh.y + 1, gi);
    b.rect(sh.x + 5, sh.y, 2, 2, hand);
    b.line(sh.x + 7, sh.y, PW - 1, sh.y - 3, shinai);
  } else if (pose === 'seiza') {
    b.rect(sh.x - 1, ty + z.torso - 2, 2, 2, hand);
  } else if (pose === 'wave') {
    b.line(sh.x, sh.y, sh.x + 3, sh.y - 4 - (f % 2), casual ? look.casual.top : gi);
    b.rect(sh.x + 3, sh.y - 6 - (f % 2), 2, 2, C.C);
  } else {
    b.rect(sh.x, sh.y, 2, z.torso - 1, casual ? look.casual.top : gi);
    b.rect(sh.x, sh.y + z.torso - 1, 2, 2, hand);
  }
  // 심판 깃발
  if (opts.flags) {
    const up = opts.flagUp;
    const red = C.E;
    const white = C.W;
    // 오른손 빨강, 왼손 하양 (아래로 들고 있다가 하나를 올린다)
    b.line(sh.x + 1, sh.y + 2, sh.x + 4, up === 'red' ? sh.y - 6 : sh.y + 6, C.K);
    b.rect(sh.x + 4, up === 'red' ? sh.y - 9 : sh.y + 6, 3, 3, red);
    b.line(x0 - 1, sh.y + 2, x0 - 4, up === 'white' ? sh.y - 6 : sh.y + 6, C.K);
    b.rect(x0 - 7, up === 'white' ? sh.y - 9 : sh.y + 6, 3, 3, white);
  }
  return b;
}

// 추도 화면·근황용 얼굴 (12×12)
export function faceBuf(look, size = 'adult') {
  const full = personFrame(look, { pose: 'stand', size });
  const z = SIZES[size];
  const out = new Buf(12, 12);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) out.set(x, y, full.get(x + 6, y + z.top - 2));
  return out;
}

export function kidSize(ageYears) {
  // 초등부 아이는 개의 나이에 따라 자란다 (9살에 시작)
  return ageYears < 3.5 ? 'kid' : ageYears < 7 ? 'teen' : 'adult';
}
