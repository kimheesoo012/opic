// 앱 아이콘과 링크 미리보기 그림(og:image)을 게임 속 도트 그림으로 만든다.
// 실행: node tools/og.mjs  → public/icons/*.png (빌드가 icons/ 로 복사한다)
import fs from 'fs';
import { encodePNG } from './png.mjs';
import { PAL, Buf } from '../src/ui/pixel/core.js';
import { dogFrame } from '../src/ui/pixel/dog.js';
import { bgBuf } from '../src/ui/pixel/bg.js';
import { personFrame, LOOKS } from '../src/ui/pixel/people.js';

const OUT = new URL('../public/icons/', import.meta.url);
const rgb = (c) => [1, 3, 5].map((i) => parseInt(PAL[c].slice(i, i + 2), 16));

// 도장(봄 낮) + 닥스훈트 + 사범
const scene = new Buf(160, 96);
scene.d.set(bgBuf('dojo', { season: 'spring', tod: 'day', t: 0 }).d);
const sh = personFrame(LOOKS.makoto, { pose: 'stand' });
scene.blit(sh, 104, 90 - sh.h, true);
const dog = dogFrame({ coat: 'black_tan', hair: 'smooth' }, { pose: 'stand', f: 0 });
scene.blit(dog, 62, 90 - dog.h);

// buf의 (x, y, w, h) 부분을 scale배로 키워 W×H 캔버스 가운데에 놓는다 (남는 곳은 bgColor)
function render(name, x0, y0, w, h, scale, W = w * scale, H = h * scale, bgColor = [17, 21, 29]) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) out.set([...bgColor, 255], i * 4);
  const ox = Math.round((W - w * scale) / 2);
  const oy = Math.round((H - h * scale) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = scene.get(x0 + x, y0 + y);
    if (!c) continue;
    const col = [...rgb(c), 255];
    for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) {
      const px = ox + x * scale + i;
      const py = oy + y * scale + j;
      if (px >= 0 && py >= 0 && px < W && py < H) out.set(col, (py * W + px) * 4);
    }
  }
  fs.writeFileSync(new URL(name, OUT), encodePNG(W, H, out));
  console.log(name, W, H);
}

// 아이콘: 개를 크게 (개 가운데 (78, 80) 둘레를 잘라 키우고, 넘치는 가장자리는 버린다)
const cx = 62 + 16;
render('favicon-64.png', cx - 14, 96 - 32, 32, 32, 2);
render('icon-192.png', cx - 20, 56, 40, 40, 5, 192, 192);
render('icon-512.png', cx - 20, 56, 40, 40, 13, 512, 512);
render('apple-touch-icon.png', cx - 18, 60, 36, 36, 5);
// 마스커블: 가장자리가 잘려도 개가 남게 조금 넓게
render('maskable-512.png', cx - 26, 44, 52, 52, 10, 512, 512);
// 링크 미리보기 1200×630: 장면을 8배로 (위 14줄은 빼고, 좌우 조금 잘림 — 개와 사람은 가운데)
render('og.png', 0, 14, 160, 80, 8, 1200, 630);
