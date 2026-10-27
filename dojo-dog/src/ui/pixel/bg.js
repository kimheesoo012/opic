// 장소 배경(160×96). 계절과 시간대(낮·저녁·밤)에 따라 색과 소품이 바뀐다.
import { Buf, C } from './core.js';

export const BW = 160;
export const BH = 96;
export const LOCS = ['dojo', 'street', 'river', 'shrine', 'court', 'bath', 'izakaya', 'festival', 'vet', 'room'];

// 밤: 모든 색을 한 단계 어둡게
const DARK = { [C.K]: C.K, [C.D]: C.K, [C.B]: C.D, [C.R]: C.B, [C.T]: C.B, [C.C]: C.T, [C.W]: C.G, [C.G]: C.S, [C.S]: C.K, [C.N]: C.K, [C.L]: C.N, [C.A]: C.L, [C.V]: C.S, [C.Y]: C.T, [C.E]: C.B, [C.P]: C.R };
function darken(b) {
  for (let i = 0; i < b.d.length; i++) if (b.d[i]) b.d[i] = DARK[b.d[i]];
}

// 결정적 의사 난수 (장식 위치용)
function hash(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

function sky(b, x, y, w, h, tod, season) {
  if (tod === 'night') {
    b.rect(x, y, w, h, C.N);
    b.dither(x, y, w, Math.min(4, h), C.N, C.K);
    for (let i = 0; i < (w * h) / 90; i++) b.set(x + Math.floor(hash(i * 7 + 1) * w), y + Math.floor(hash(i * 13 + 5) * h * 0.8), hash(i) > 0.7 ? C.Y : C.W);
    return;
  }
  if (tod === 'evening') {
    const bands = [C.R, C.T, C.Y];
    for (let j = 0; j < h; j++) {
      const k = Math.min(2, Math.floor((j / h) * 3));
      b.rect(x, y + j, w, 1, bands[k]);
    }
    for (let k = 1; k < 3; k++) b.dither(x, y + Math.floor((h * k) / 3) - 1, w, 2, bands[k - 1], bands[k]);
    return;
  }
  b.rect(x, y, w, h, C.A);
  b.dither(x, y, w, Math.min(3, h), season === 'winter' ? C.G : C.L, C.A);
  // 구름
  const cx = x + Math.floor(w * 0.6);
  if (h > 10) b.rect(cx, y + 4, 10, 2, C.W), b.rect(cx + 2, y + 3, 5, 1, C.W);
}

const LEAF = { spring: [C.P, C.W, C.V], summer: [C.V, C.L, C.S], autumn: [C.R, C.T, C.B], winter: [0, 0, 0] };
function tree(b, x, y, season, r = 9) {
  b.rect(x - 1, y, 3, 18, C.D);
  b.line(x, y + 4, x - 5, y - 2, C.D);
  b.line(x, y + 2, x + 6, y - 3, C.D);
  const [c1, c2, c3] = LEAF[season];
  if (!c1) {
    // 겨울: 맨가지에 눈
    b.line(x, y, x, y - 7, C.D);
    b.set(x - 5, y - 3, C.W), b.set(x + 6, y - 4, C.W), b.set(x, y - 8, C.W);
    return;
  }
  b.oval(x, y - 4, r, r - 3, c3 === C.S ? C.S : c3);
  b.oval(x, y - 5, r - 1, r - 4, c1);
  for (let i = 0; i < 14; i++) b.set(x - r + 2 + Math.floor(hash(x * 31 + i) * (2 * r - 3)), y - 9 + Math.floor(hash(x * 17 + i * 3) * 8), c2);
}

function floorBoards(b, y, c1 = C.T, c2 = C.B) {
  b.rect(0, y, BW, BH - y, c1);
  for (let j = y + 3, k = 0; j < BH; j += 4 + k, k++) b.rect(0, j, BW, 1, c2);
  for (let j = y; j < BH; j += 4) for (let i = (j * 7) % 23; i < BW; i += 23 + (j % 3) * 9) b.set(i, j + 1, c2);
  b.rect(0, y, BW, 1, C.B);
}

function snowCap(b, x, y, w) {
  b.rect(x, y, w, 1, C.W);
  for (let i = 0; i < w; i += 3) b.set(x + i, y + 1, C.W);
}

// ───── 장소 ─────
const DRAW = {
  dojo(b, { season, tod }) {
    // 벽: 위 흰 회벽, 아래 나무 판벽
    b.rect(0, 0, BW, 60, C.C);
    b.rect(0, 0, BW, 4, C.B);
    b.rect(0, 34, BW, 26, C.T);
    for (let i = 4; i < BW; i += 12) b.rect(i, 35, 1, 25, C.B);
    b.rect(0, 33, BW, 2, C.B);
    // 창문 (계절이 보인다)
    sky(b, 10, 8, 34, 22, tod, season);
    if (season !== 'winter' || tod !== 'night') tree(b, 30, 24, season, 8);
    if (season === 'winter') b.rect(10, 27, 34, 3, C.W);
    b.rect(9, 7, 36, 1, C.D), b.rect(9, 30, 36, 1, C.D), b.rect(9, 7, 1, 24, C.D), b.rect(44, 7, 1, 24, C.D), b.rect(26, 7, 1, 24, C.D);
    // 名札掛け: 작은 나무패 줄
    b.rect(54, 9, 40, 20, C.B);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 9; i++) b.rect(56 + i * 4, 11 + j * 9, 3, 7, j === 0 && i < 3 ? C.W : C.C), b.set(57 + i * 4, 13 + j * 9, C.K), b.set(57 + i * 4, 15 + j * 9, C.K);
    // 神棚
    b.rect(110, 16, 40, 2, C.D);
    b.rect(118, 8, 24, 8, C.T);
    b.rect(116, 6, 28, 2, C.D);
    b.rect(126, 9, 8, 7, C.B);
    b.rect(129, 9, 2, 7, C.Y);
    b.rect(112, 4, 36, 1, C.K);
    for (let i = 114; i < 148; i += 6) b.set(i, 5, C.W), b.set(i + 1, 6, C.W), b.set(i, 7, C.W);
    b.rect(120, 13, 2, 3, C.V), b.rect(138, 13, 2, 3, C.V);
    // 竹刀掛け
    b.rect(100, 36, 2, 22, C.D);
    b.rect(154, 36, 2, 22, C.D);
    for (let i = 0; i < 6; i++) b.line(106 + i * 8, 38, 106 + i * 8, 57, C.Y), b.set(106 + i * 8, 38, C.E);
    b.rect(100, 38, 56, 1, C.D);
    floorBoards(b, 60);
    if (tod === 'night') {
      darken(b);
      b.rect(30, 1, 24, 2, C.W), b.rect(100, 1, 24, 2, C.W);
    }
  },

  street(b, { season, tod }) {
    sky(b, 0, 0, BW, 24, tod, season);
    // 아케이드 지붕 틀
    for (let i = 0; i < BW; i += 20) b.rect(i, 0, 2, 24, C.G);
    b.rect(0, 0, BW, 2, C.G);
    // 가게들
    const shops = [
      [0, C.E, C.W],
      [40, C.L, C.W],
      [80, C.V, C.Y],
      [120, C.B, C.C],
    ];
    for (const [x, a1, a2] of shops) {
      b.rect(x, 22, 40, 44, C.C);
      b.rect(x, 22, 40, 6, C.D);
      b.rect(x + 4, 23, 32, 4, a2);
      for (let i = 0; i < 40; i += 4) b.rect(x + i, 28, 2, 6, a1), b.rect(x + i + 2, 28, 2, 6, a2);
      b.rect(x + 2, 34, 1, 32, C.B), b.rect(x + 37, 34, 1, 32, C.B);
      // 진열대
      b.rect(x + 5, 52, 30, 3, C.B);
      for (let i = 0; i < 6; i++) b.rect(x + 6 + i * 5, 49, 3, 3, [C.R, C.Y, C.V, C.E, C.T, C.L][(i + x / 40) % 6]);
      b.rect(x + 5, 55, 30, 11, C.T);
      b.rect(x, 38, 40, 10, tod === 'night' ? C.Y : C.W);
      b.rect(x + 3, 40, 34, 6, tod === 'night' ? C.T : C.A);
    }
    // 초롱
    for (let i = 10; i < BW; i += 40) b.rect(i, 12, 4, 6, C.E), b.set(i + 1, 11, C.K), b.set(i + 2, 18, C.K);
    // 길바닥 타일
    b.rect(0, 66, BW, 30, C.G);
    for (let j = 66; j < BW; j += 6) b.rect(0, j, BW, 1, C.S);
    for (let j = 66; j < BH; j += 6) for (let i = (j % 12) * 2; i < BW; i += 12) b.rect(i, j, 1, 6, C.S);
    if (season === 'winter') snowCap(b, 0, 22, BW);
    if (tod === 'night') {
      darken(b);
      for (let i = 10; i < BW; i += 40) b.rect(i, 12, 4, 6, C.Y), b.set(i + 1, 14, C.E), b.set(i + 2, 15, C.E);
      for (const [x] of shops) b.rect(x + 3, 40, 34, 6, C.Y);
    }
  },

  river(b, { season, tod, t = 0 }) {
    sky(b, 0, 0, BW, 40, tod, season);
    // 먼 시가지
    for (let i = 0; i < BW; i += 9) b.rect(i, 30 - Math.floor(hash(i) * 8), 8, 12, tod === 'night' ? C.K : C.G);
    if (tod === 'night') for (let i = 3; i < BW; i += 9) if (hash(i * 3) > 0.4) b.set(i, 33, C.Y);
    // 철교
    b.rect(96, 26, 64, 3, C.S);
    for (let i = 100; i < BW; i += 16) b.rect(i, 29, 3, 13, C.S), b.line(i, 29, i + 8, 26, C.S), b.line(i + 16, 29, i + 8, 26, C.S);
    // 강
    b.rect(0, 40, BW, 12, tod === 'night' ? C.N : C.L);
    const ph = Math.floor(t * 4) % 8;
    for (let j = 42; j < 52; j += 3) for (let i = (j * 5 + ph * 2) % 16; i < BW; i += 16) b.rect(i, j, 4, 1, tod === 'night' ? C.L : C.A);
    // 둑과 풀
    const grass = { spring: C.V, summer: C.V, autumn: C.T, winter: C.B }[season];
    b.rect(0, 52, BW, 44, grass);
    b.dither(0, 52, BW, 2, grass, C.S);
    for (let i = 0; i < 40; i++) b.set(Math.floor(hash(i * 11) * BW), 54 + Math.floor(hash(i * 5) * 10), season === 'spring' ? C.Y : season === 'autumn' ? C.R : C.S);
    // 산책길
    b.rect(0, 70, BW, 10, C.C);
    b.dither(0, 70, BW, 1, C.C, C.T);
    b.dither(0, 79, BW, 1, C.C, C.T);
    if (season === 'winter') {
      b.dither(0, 52, BW, 18, C.W, grass);
      b.rect(0, 80, BW, 16, C.W);
    }
    tree(b, 22, 50, season, 10);
    if (tod === 'night') darken(b);
  },

  shrine(b, { season, tod }) {
    sky(b, 0, 0, BW, 50, tod, season);
    tree(b, 14, 42, season, 12);
    tree(b, 146, 40, season, 12);
    // 사당
    b.rect(96, 26, 44, 4, C.D);
    b.line(92, 30, 100, 22, C.D), b.line(144, 30, 136, 22, C.D);
    b.rect(100, 22, 36, 4, C.D);
    b.rect(100, 30, 36, 20, C.B);
    b.rect(110, 34, 16, 16, C.D);
    b.rect(116, 31, 4, 6, C.Y);
    if (season === 'winter') snowCap(b, 96, 21, 44);
    // 도리이
    const ox = 40;
    b.rect(ox - 4, 14, 40, 3, C.E);
    b.rect(ox - 6, 13, 44, 1, C.K);
    b.rect(ox, 21, 32, 2, C.E);
    b.rect(ox + 3, 17, 3, 46, C.E), b.rect(ox + 26, 17, 3, 46, C.E);
    b.rect(ox + 14, 17, 4, 4, C.K);
    // 자갈과 돌길
    b.rect(0, 50, BW, 46, C.G);
    for (let i = 0; i < 160; i++) b.set(Math.floor(hash(i * 3) * BW), 50 + Math.floor(hash(i * 7 + 1) * 46), hash(i) > 0.5 ? C.W : C.S);
    for (let j = 0; j < 5; j++) {
      const w = 22 + j * 8;
      b.rect(56 - Math.floor(w / 2) + 4 + j * 2, 52 + j * 9, w, 7, C.C);
      b.rect(56 - Math.floor(w / 2) + 4 + j * 2, 58 + j * 9, w, 1, C.T);
    }
    // 석등
    b.rect(146, 52, 6, 3, C.G), b.rect(147, 55, 4, 4, C.S), b.rect(148, 56, 2, 2, tod === 'night' ? C.Y : C.K), b.rect(146, 59, 6, 2, C.G), b.rect(148, 61, 2, 8, C.G), b.rect(145, 69, 8, 3, C.G);
    if (season === 'winter') b.dither(0, 50, BW, 46, C.W, C.G);
    if (tod === 'night') {
      darken(b);
      b.rect(148, 56, 2, 2, C.Y);
      b.rect(116, 31, 4, 6, C.Y);
    }
  },

  court(b, { tod }) {
    // 체육관: 벽, 관중석, 점수판, 현수막(글자 없음)
    b.rect(0, 0, BW, 52, C.G);
    b.rect(0, 0, BW, 6, C.S);
    for (let i = 0; i < BW; i += 16) b.rect(i, 6, 1, 22, C.S);
    b.rect(0, 28, BW, 2, C.S);
    // 관중
    for (let row = 0; row < 3; row++) {
      b.rect(0, 30 + row * 7, BW, 1, C.S);
      for (let i = row * 3; i < BW; i += 6) {
        const c = [C.N, C.K, C.D, C.W, C.R, C.L][Math.floor(hash(i * 13 + row) * 6)];
        b.rect(i, 31 + row * 7, 4, 3, c);
        b.rect(i + 1, 34 + row * 7, 2, 2, C.C);
      }
    }
    b.rect(0, 51, BW, 1, C.K);
    // 점수판
    b.rect(60, 8, 40, 16, C.K);
    b.rect(62, 10, 16, 12, C.S), b.rect(82, 10, 16, 12, C.S);
    b.rect(64, 12, 3, 3, C.E), b.rect(68, 12, 3, 3, C.E), b.rect(84, 12, 3, 3, C.W);
    b.rect(18, 10, 30, 12, C.W), b.rect(18, 10, 30, 2, C.E), b.rect(18, 20, 30, 2, C.E);
    b.rect(112, 10, 30, 12, C.W), b.rect(112, 10, 30, 2, C.N), b.rect(112, 20, 30, 2, C.N);
    // 시합장 마루와 흰 경계선
    floorBoards(b, 52, C.T, C.B);
    b.rect(6, 58, 148, 1, C.W);
    b.rect(2, 92, 156, 1, C.W);
    b.line(6, 58, 2, 92, C.W);
    b.line(153, 58, 157, 92, C.W);
    // 開始線
    b.rect(66, 76, 6, 1, C.W), b.rect(88, 76, 6, 1, C.W);
    b.rect(79, 75, 2, 2, C.W);
    if (tod === 'night') b.rect(0, 0, BW, 2, C.Y);
  },

  bath(b, { tod }) {
    // 목욕탕: 타일 벽, 큰 벽화(이름 없는 산), 탕
    b.rect(0, 0, BW, 66, C.W);
    for (let j = 0; j < 66; j += 6) b.rect(0, j, BW, 1, C.A);
    for (let i = 0; i < BW; i += 6) b.rect(i, 0, 1, 66, C.A);
    b.rect(20, 4, 120, 36, C.A);
    b.rect(20, 4, 120, 6, C.L);
    for (let i = 0; i < 60; i++) {
      b.line(80 - i, 14 + Math.floor(i / 2), 80 + i, 14 + Math.floor(i / 2), C.L);
    }
    b.line(80, 14, 70, 20, C.W), b.line(80, 14, 90, 20, C.W), b.rect(76, 14, 9, 3, C.W);
    b.rect(20, 34, 120, 6, C.V);
    b.dither(20, 32, 120, 2, C.V, C.L);
    b.rect(19, 3, 122, 1, C.B), b.rect(19, 40, 122, 1, C.B);
    // 탕
    b.rect(10, 48, 140, 4, C.T);
    b.rect(10, 52, 140, 14, C.L);
    for (let i = 14; i < 146; i += 9) b.rect(i, 54, 4, 1, C.A);
    b.rect(10, 66, 140, 2, C.T);
    // 김
    for (let i = 0; i < 12; i++) b.set(20 + i * 11, 44 - (i % 3), C.W);
    // 바닥 타일
    b.rect(0, 68, BW, 28, C.G);
    for (let j = 68; j < BH; j += 5) b.rect(0, j, BW, 1, C.W);
    for (let i = 0; i < BW; i += 5) b.rect(i, 68, 1, 28, C.W);
    // 나무 대야
    b.rect(130, 78, 12, 5, C.T), b.rect(130, 78, 12, 1, C.B), b.rect(131, 83, 10, 1, C.B);
    if (tod === 'night') b.rect(0, 0, BW, 1, C.Y);
  },

  izakaya(b) {
    // 이자카야: 늘 밤. 카운터, 술병 선반, 붉은 초롱
    b.rect(0, 0, BW, 60, C.B);
    for (let i = 0; i < BW; i += 10) b.rect(i, 0, 1, 60, C.D);
    b.rect(0, 0, BW, 3, C.D);
    // 선반
    for (const y of [14, 28]) {
      b.rect(30, y, 100, 2, C.D);
      for (let i = 34; i < 128; i += 7) {
        const c = [C.V, C.W, C.N, C.T, C.S][Math.floor(hash(i + y) * 5)];
        b.rect(i, y - 8, 4, 8, c);
        b.rect(i + 1, y - 10, 2, 2, c);
      }
    }
    // 메뉴 나무패 (글자 대신 줄)
    for (let i = 0; i < 6; i++) b.rect(4 + i * 4, 6, 3, 18, C.C), b.rect(5 + i * 4, 9, 1, 10, C.K);
    for (let i = 0; i < 6; i++) b.rect(134 + i * 4, 6, 3, 18, C.C), b.rect(135 + i * 4, 9, 1, 10, C.K);
    // 초롱
    for (const x of [8, 146]) {
      b.oval(x + 3, 40, 4, 6, C.E);
      b.rect(x + 1, 33, 5, 1, C.K), b.rect(x + 1, 47, 5, 1, C.K);
      b.rect(x, 38, 7, 1, C.B), b.rect(x, 42, 7, 1, C.B);
      b.rect(x + 2, 39, 3, 3, C.Y);
    }
    // 카운터
    b.rect(0, 60, BW, 6, C.T);
    b.rect(0, 60, BW, 1, C.C);
    b.rect(0, 66, BW, 30, C.D);
    for (let i = 8; i < BW; i += 32) b.rect(i, 70, 14, 3, C.B), b.rect(i + 6, 73, 2, 23, C.B);
    // 잔과 접시
    b.rect(40, 56, 3, 4, C.W), b.rect(60, 57, 8, 3, C.W), b.rect(62, 56, 4, 1, C.R), b.rect(100, 56, 3, 4, C.Y);
  },

  festival(b, { season }) {
    sky(b, 0, 0, BW, 60, 'night', season);
    // 불꽃 (여름)
    if (season === 'summer') {
      for (let a = 0; a < 16; a++) {
        const r = 9;
        const x = 120 + Math.round(Math.cos((a / 16) * Math.PI * 2) * r);
        const y = 16 + Math.round(Math.sin((a / 16) * Math.PI * 2) * r);
        b.set(x, y, a % 2 ? C.Y : C.P);
        b.set(120 + Math.round(Math.cos((a / 16) * Math.PI * 2) * 5), 16 + Math.round(Math.sin((a / 16) * Math.PI * 2) * 5), C.E);
      }
    }
    // 노점 3채
    for (let k = 0; k < 3; k++) {
      const x = 4 + k * 54;
      const [c1, c2] = [[C.E, C.W], [C.L, C.W], [C.Y, C.E]][k];
      for (let i = 0; i < 48; i += 6) b.rect(x + i, 34, 3, 8, c1), b.rect(x + i + 3, 34, 3, 8, c2);
      b.line(x, 34, x + 47, 34, C.K);
      b.rect(x + 2, 42, 1, 26, C.B), b.rect(x + 45, 42, 1, 26, C.B);
      b.rect(x + 4, 56, 40, 12, C.B);
      b.rect(x + 4, 56, 40, 2, C.T);
      for (let i = 0; i < 5; i++) b.rect(x + 7 + i * 8, 52, 5, 4, [C.P, C.Y, C.R, C.W, C.V][(i + k) % 5]);
      b.rect(x + 6, 44, 36, 6, C.S);
    }
    // 초롱 줄
    b.line(0, 22, 80, 28, C.K);
    b.line(80, 28, BW, 22, C.K);
    for (let i = 4; i < BW; i += 10) {
      const y = i < 80 ? 22 + Math.floor((i * 6) / 80) : 28 - Math.floor(((i - 80) * 6) / 80);
      b.rect(i, y + 1, 4, 5, i % 20 < 10 ? C.E : C.Y);
      b.rect(i + 1, y + 2, 2, 3, C.Y);
    }
    // 바닥
    b.rect(0, 68, BW, 28, C.S);
    for (let i = 0; i < 80; i++) b.set(Math.floor(hash(i * 9) * BW), 68 + Math.floor(hash(i * 4 + 2) * 28), C.G);
  },

  vet(b, { tod }) {
    b.rect(0, 0, BW, 62, C.W);
    b.rect(0, 40, BW, 22, C.A);
    b.rect(0, 40, BW, 1, C.L);
    // 창
    b.rect(10, 8, 30, 22, C.A);
    sky(b, 11, 9, 28, 20, tod, 'summer');
    b.rect(10, 8, 30, 1, C.G), b.rect(10, 29, 30, 1, C.G), b.rect(25, 8, 1, 22, C.G);
    // 발자국 포스터
    b.rect(58, 8, 20, 24, C.C);
    b.oval(68, 22, 4, 3, C.P);
    for (const [x, y] of [[63, 15], [66, 13], [70, 13], [73, 15]]) b.rect(x, y, 2, 2, C.P);
    // 약장
    b.rect(118, 10, 34, 36, C.G);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) b.rect(120 + i * 16, 12 + j * 11, 14, 9, C.A), b.rect(123 + i * 16, 15 + j * 11, 3, 4, [C.W, C.Y, C.P, C.V, C.W, C.L][j * 2 + i]);
    // 진료대
    b.rect(54, 50, 52, 4, C.G);
    b.rect(54, 50, 52, 1, C.W);
    b.rect(60, 54, 3, 14, C.S), b.rect(97, 54, 3, 14, C.S);
    // 바닥
    b.rect(0, 62, BW, 34, C.C);
    for (let j = 62; j < BH; j += 8) b.rect(0, j, BW, 1, C.G);
    for (let j = 62; j < BH; j += 8) for (let i = (j % 16) * 1; i < BW; i += 16) b.rect(i, j, 1, 8, C.G);
  },

  room(b, { season, tod }) {
    // 노견의 방: 다다미, 장지문 창, 방석, 겨울엔 고타쓰
    b.rect(0, 0, BW, 58, C.C);
    b.rect(0, 0, BW, 4, C.B);
    b.rect(0, 56, BW, 2, C.B);
    // 장지문
    sky(b, 84, 6, 70, 46, tod, season);
    tree(b, 130, 46, season, 10);
    for (let j = 6; j < 52; j++) for (let i = 84; i < 154; i++) if ((i - 84) % 10 === 0 || (j - 6) % 9 === 0) b.set(i, j, C.T);
    for (let j = 7; j < 52; j++) for (let i = 85; i < 154; i++) if ((i - 84) % 10 && (j - 6) % 9) b.set(i, j, C.W);
    b.rect(83, 5, 72, 1, C.B), b.rect(83, 52, 72, 1, C.B);
    // 족자
    b.rect(20, 8, 16, 34, C.W), b.rect(19, 8, 18, 2, C.B), b.rect(19, 41, 18, 2, C.B);
    b.rect(27, 14, 2, 20, C.S), b.rect(25, 18, 6, 1, C.S);
    // 다다미
    for (let j = 58; j < BH; j++) for (let i = 0; i < BW; i++) b.set(i, j, (i + j * 3) % 5 === 0 ? C.T : C.Y);
    b.rect(0, 76, BW, 2, C.V), b.rect(78, 58, 2, 18, C.V), b.rect(40, 78, 2, 18, C.V), b.rect(118, 78, 2, 18, C.V);
    // 햇살
    if (tod === 'day') for (let j = 60; j < 74; j++) for (let i = 92 + (j - 60); i < 140 + (j - 60); i += 2) b.set(i + (j % 2), j, C.C);
    if (season === 'winter') {
      b.rect(20, 66, 44, 4, C.E), b.rect(18, 70, 48, 10, C.R), b.rect(18, 70, 48, 1, C.E), b.rect(28, 64, 24, 2, C.D);
    }
    if (tod === 'night') darken(b), b.rect(70, 2, 20, 2, C.Y);
  },
};

// 배경 버퍼를 만든다. 같은 조건이면 캐시해서 다시 쓴다(강물만 시간에 따라 움직임).
const cache = new Map();
export function bgBuf(loc, { season = 'spring', tod = 'day', t = 0 } = {}) {
  const fn = DRAW[loc] || DRAW.dojo;
  const tick = loc === 'river' ? Math.floor(t * 4) % 8 : 0;
  const key = `${loc}|${season}|${tod}|${tick}`;
  if (cache.has(key)) return cache.get(key);
  const b = new Buf(BW, BH);
  fn(b, { season, tod, t: tick / 4 });
  if (cache.size > 60) cache.clear();
  cache.set(key, b);
  return b;
}
