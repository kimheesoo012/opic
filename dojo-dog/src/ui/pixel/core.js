// 도트 그림 핵심: 16색 팔레트, 색 번호 버퍼, 스탬프·도형·외곽선. DOM을 쓰지 않는다(노드에서도 시트를 뽑을 수 있게).

// 0 = 투명. 1~16 = 팔레트
export const PAL = [
  null,
  '#16161d', // 1 K 먹색(외곽선)
  '#3b2a26', // 2 D 짙은 갈색
  '#7a4a2c', // 3 B 갈색
  '#b8643a', // 4 R 적갈색
  '#e0a060', // 5 T 황갈색(탄, 밝은 나무)
  '#f2d3a0', // 6 C 크림(피부)
  '#f4f1e8', // 7 W 흰색
  '#a3a3ad', // 8 G 회색
  '#3f4254', // 9 S 슬레이트(검정 털)
  '#2a3c70', // 10 N 쪽빛(도복)
  '#5b86c6', // 11 L 파랑
  '#a9d6ee', // 12 A 하늘
  '#4a8c4e', // 13 V 초록
  '#e8c447', // 14 Y 노랑
  '#c63a3f', // 15 E 빨강(깃발)
  '#f2a7b5', // 16 P 분홍
];
export const C = { K: 1, D: 2, B: 3, R: 4, T: 5, C: 6, W: 7, G: 8, S: 9, N: 10, L: 11, A: 12, V: 13, Y: 14, E: 15, P: 16 };

export class Buf {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8Array(w * h);
  }
  get(x, y) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x];
  }
  set(x, y, c) {
    if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  // 바둑판 디더링
  dither(x, y, w, h, c1, c2) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, (x + i + y + j) % 2 ? c2 : c1);
  }
  line(x0, y0, x1, y1, c) {
    let dx = Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  oval(cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) this.set(cx + x, cy + y, c);
  }
  // 글자 지도(ASCII)를 찍는다. map: 문자 → 색 번호. '.'과 공백은 투명.
  stamp(art, x, y, map, flip = false) {
    const w = Math.max(...art.map((r) => r.length));
    for (let j = 0; j < art.length; j++) {
      const row = art[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const c = map[ch];
        if (c === undefined) continue;
        this.set(flip ? x + (w - 1 - i) : x + i, y + j, c);
      }
    }
  }
  blit(src, x, y, flip = false, recolor = null) {
    for (let j = 0; j < src.h; j++)
      for (let i = 0; i < src.w; i++) {
        let c = src.d[j * src.w + i];
        if (!c) continue;
        if (recolor) c = recolor[c] ?? c;
        this.set(flip ? x + (src.w - 1 - i) : x + i, y + j, c);
      }
  }
  // 투명 픽셀 중 그림과 맞닿은 곳에 외곽선
  outline(c = C.K) {
    const add = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const v = this.get(x + dx, y + dy); return v && v !== c; })) add.push([x, y]);
      }
    for (const [x, y] of add) this.set(x, y, c);
    return this;
  }
}

// 버퍼 → RGBA (canvas ImageData나 PNG에 쓴다). gray=true면 흑백
export function toRGBA(buf, gray = false, pal = PAL) {
  const out = new Uint8ClampedArray(buf.w * buf.h * 4);
  for (let i = 0; i < buf.d.length; i++) {
    const c = buf.d[i];
    if (!c) continue;
    const hex = pal[c];
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    if (gray) r = g = b = Math.round(r * 0.3 + g * 0.59 + b * 0.11);
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = 255;
  }
  return out;
}
