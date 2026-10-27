// 도트 시트 렌더: node tools/sheet.mjs dog|people|bg  → tools/out/sheet-*.png
import fs from 'fs';
import { encodePNG } from './png.mjs';
import { PAL, Buf } from '../src/ui/pixel/core.js';
import { dogFrame, propBuf, bubbleBuf } from '../src/ui/pixel/dog.js';
const which = process.argv[2] || 'dog';
fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
function render(items, cols, scale, name, labelH = 0) {
  const cw = Math.max(...items.map((b) => b.w)) + 2, ch = Math.max(...items.map((b) => b.h)) + 2;
  const rows = Math.ceil(items.length / cols);
  const W = cols * cw * scale, H = rows * ch * scale;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { const y = Math.floor(i / W); const r = Math.floor(y / (ch * scale)); out.set([62 + (r % 2) * 10, 68 + (r % 2) * 10, 84, 255], i * 4); }
  items.forEach((b, k) => {
    const ox = (k % cols) * cw * scale + scale, oy = Math.floor(k / cols) * ch * scale + scale;
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const c = b.d[y * b.w + x]; if (!c) continue;
      const hex = PAL[c]; const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) out.set([...rgb, 255], ((oy + y * scale + j) * W + ox + x * scale + i) * 4);
    }
  });
  const p = new URL(`./out/sheet-${name}.png`, import.meta.url);
  fs.writeFileSync(p, encodePNG(W, H, out));
  console.log(p.pathname, W, H);
}
if (which === 'dog') {
  const poses = ['stand', 'walk', 'run', 'sleep', 'eat', 'bark', 'dig', 'hesitate', 'sniff', 'kote', 'belly', 'oldwalk', 'sit'];
  const items = [];
  for (const pose of poses) for (const f of [0, 1]) items.push(dogFrame({ coat: 'black_tan', hair: 'smooth' }, { pose, f, stage: pose === 'oldwalk' ? 'senior' : 'adult' }));
  render(items, 6, 8, 'dog-poses');
  const coats = ['black_tan', 'red', 'choco_tan', 'cream', 'dapple', 'wildboar'];
  const it2 = [];
  for (const coat of coats) for (const hair of ['smooth', 'long', 'wire']) it2.push(dogFrame({ coat, hair }, { pose: 'stand' }));
  for (const coat of coats) it2.push(dogFrame({ coat, hair: 'smooth' }, { pose: 'stand', stage: 'puppy' }), dogFrame({ coat, hair: 'smooth' }, { pose: 'walk', f: 1, stage: 'puppy' }), dogFrame({ coat, hair: 'long' }, { pose: 'stand', stage: 'senior', heavy: true }));
  render(it2, 6, 6, 'dog-coats');
  render(['bowl', 'bag', 'kote', 'men', 'step', 'cushion', 'dirt'].map(propBuf).concat(['!', '?', 'heart', 'note', 'z', 'sweat', 'flag'].map(bubbleBuf)), 7, 8, 'props');
}
if (which === 'people') {
  const { personFrame, faceBuf, LOOKS } = await import('../src/ui/pixel/people.js');
  const items = [];
  for (const k of ['washio', 'makoto', 'chiharu', 'hinata', 'miura', 'fumi', 'sojin', 'iincho']) items.push(personFrame(LOOKS[k], { pose: 'stand' }), personFrame(LOOKS[k], { pose: 'stand', casual: true }));
  for (const pose of ['kamae', 'raise', 'strike', 'seiza', 'bow']) items.push(personFrame(LOOKS.makoto, { pose, bogu: pose !== 'bow' && pose !== 'seiza' }));
  items.push(personFrame(LOOKS.hinata, { pose: 'kamae', bogu: true, size: 'kid' }), personFrame(LOOKS.hinata, { pose: 'stand', size: 'teen' }), personFrame(LOOKS.hinata, { pose: 'stand', size: 'adult' }));
  items.push(personFrame(LOOKS.judge, { pose: 'stand', casual: true, flags: true }), personFrame(LOOKS.judge, { pose: 'stand', casual: true, flags: true, flagUp: 'red' }), personFrame(LOOKS.shop, { pose: 'wave', casual: true }));
  render(items, 8, 6, 'people');
  render(['washio', 'makoto', 'chiharu', 'hinata', 'miura', 'fumi', 'sojin', 'iincho'].map((k) => faceBuf(LOOKS[k], LOOKS[k].size)), 8, 10, 'faces');
}
if (which === 'bg') {
  const { bgBuf, LOCS } = await import('../src/ui/pixel/bg.js');
  const variants = [['spring', 'day'], ['summer', 'evening'], ['autumn', 'day'], ['winter', 'night']];
  for (const [part, locs] of [['bg1', LOCS.slice(0, 5)], ['bg2', LOCS.slice(5)]]) {
    const items = [];
    for (const loc of locs) for (const [season, tod] of variants) items.push(bgBuf(loc, { season, tod }));
    render(items, 4, 2, part);
  }
}
if (which === 'scene') {
  const { LCD } = await import('../src/ui/pixel/lcd.js');
  const { lookFor } = await import('../src/ui/pixel/director.js');
  const G = await import('../src/engine/core.js');
  const fakeCanvas = { getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) };
  globalThis.performance ??= { now: () => Date.now() };
  const s = G.newLife({ seed: 'sheet1' });
  G.beginLife(s);
  s.t = 20;
  const plans = [
    [{ loc: 'dojo', tod: 'day', people: [{ role: 'shihan', x: 74, anim: 'keiko', bogu: true }, { role: 'kid', x: 104, anim: 'keiko', bogu: true, flip: true, phase: 1 }, { role: 'roshi', x: 132, pose: 'seiza', flip: true }], dog: { mode: 'stay', pose: 'stand', x: 30 } }, 'spring', 0.3],
    [{ loc: 'dojo', tod: 'day', people: [{ role: 'shihan', x: 74, anim: 'keiko', bogu: true }, { role: 'kid', x: 104, anim: 'keiko', bogu: true, flip: true, phase: 1 }, { role: 'roshi', x: 132, pose: 'seiza', flip: true }], dog: { mode: 'stay', pose: 'stand', x: 30 } }, 'spring', 1.6],
    [{ loc: 'court', tod: 'day', people: [{ role: 'kid', x: 58, anim: 'match', bogu: true, mark: 'red' }, { role: '_rival', x: 86, anim: 'match', bogu: true, flip: true, mark: 'white', phase: 1 }], judges: true, dog: { mode: 'peek', pose: 'sniff', x: -9 } }, 'summer', 0.5],
    [{ loc: 'court', tod: 'day', people: [{ role: 'kid', x: 58, anim: 'match', bogu: true, mark: 'red' }, { role: '_rival', x: 86, anim: 'match', bogu: true, flip: true, mark: 'white', phase: 1 }], judges: true, dog: { mode: 'peek', pose: 'sniff', x: -9 } }, 'summer', 3.5],
    [{ loc: 'vet', tod: 'day', people: [{ role: 'okami', x: 100, pose: 'stand', flip: true, casual: true, talk: true }], dog: { mode: 'stay', pose: 'sit', x: 58 } }, 'autumn', 0.2],
    [{ loc: 'room', tod: 'evening', people: [{ role: 'okami', x: 96, pose: 'seiza', casual: true, flip: true }], dog: { mode: 'stay', pose: 'sleep', x: 44 } }, 'winter', 0.2],
    [{ loc: 'street', tod: 'day', people: [{ role: 'iincho', x: 80, pose: 'stand', flip: true, casual: true, talk: true }, { role: 'worker', x: 106, pose: 'stand', flip: true, casual: true }], dog: { mode: 'stay', pose: 'bark', x: 36 }, bubble: '?' }, 'autumn', 0.2],
    [{ loc: 'river', tod: 'evening', people: [{ role: 'kor', x: 80, pose: 'wave', flip: true, casual: true }], dog: { mode: 'stay', pose: 'run', x: 30 } }, 'spring', 0.2],
    [{ loc: 'izakaya', tod: 'night', people: [{ role: 'worker', x: 70, flip: true, casual: true }, { role: 'elder', x: 96, flip: true, casual: true }], dog: { mode: 'stay', pose: 'belly', x: 26 } }, 'winter', 0.2],
    [{ loc: 'festival', tod: 'night', people: [{ role: 'kid', x: 80, flip: true, casual: true }], dog: { mode: 'stay', pose: 'stand', x: 40 } }, 'summer', 0.2],
  ];
  const items = [];
  for (const [plan, season, t] of plans) {
    const l = new LCD(fakeCanvas);
    l.lookFn = lookFor;
    l.dog = s.dog;
    l.season = season;
    l.setPlan(plan, s);
    l.t = t;
    l.draw();
    const b = new Buf(l.buf.w, l.buf.h); b.d.set(l.buf.d); items.push(b);
  }
  render(items, 2, 3, 'scenes');
}
