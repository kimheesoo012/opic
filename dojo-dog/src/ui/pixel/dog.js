// 도트 닥스훈트. 32×20 칸에 부위(머리·몸·다리·꼬리)를 글자 지도로 찍어 프레임을 만든다.
// 글자: o 외곽선, h 밝은 털, b 털, s 그늘, x 먼 쪽 다리, t 탄(눈썹·주둥이·가슴·발), n 코, e 눈, m 입속, g 흰 털(노견), f 장모 깃털, w 와이어 수염
import { Buf, C } from './core.js';

export const DW = 32;
export const DH = 20;

const COAT = {
  black_tan: { o: C.K, h: C.G, b: C.S, s: C.K, x: C.K, t: C.R, f: C.K, w: C.G },
  red: { o: C.K, h: C.T, b: C.R, s: C.B, x: C.B, t: C.R, f: C.B, w: C.B },
  choco_tan: { o: C.K, h: C.B, b: C.D, s: C.K, x: C.K, t: C.T, f: C.D, w: C.B },
  cream: { o: C.B, h: C.W, b: C.C, s: C.T, x: C.T, t: C.C, f: C.T, w: C.T },
  dapple: { o: C.K, h: C.W, b: C.G, s: C.S, x: C.S, t: C.R, f: C.S, w: C.W },
  wildboar: { o: C.K, h: C.R, b: C.B, s: C.D, x: C.D, t: C.T, f: C.D, w: C.T },
};
const FIXED = { n: C.K, e: C.K, m: C.E, g: C.G, W: C.W, z: C.A };

// ───── 성견 ─────
const BODY = [
  '...oooooooooooooooo...',
  '..ohhhhhhhhhhhhhhhhoo.',
  '.obbbbbbbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbbbbbtbo',
  'osbbbbbbbbbbbbbbbbttbo',
  '.ossssssssssssssssssso',
  '..oooooooooooooooooo..',
];
const BODY_HEAVY = [
  '...oooooooooooooooo...',
  '..ohhhhhhhhhhhhhhhhoo.',
  '.obbbbbbbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbbbbbtbo',
  'obbbbbbbbbbbbbbbbbttbo',
  'osbbbbbbbbbbbbbbbbbbso',
  '.ossssssssssssssssssso',
  '..oooooooooooooooooo..',
];
const HEAD = [
  '..oooo........',
  '.ohhhhoo......',
  'ohbbbbbboo....',
  'obbbbbtbbboo..',
  'obbbbbebbbbbo.',
  'osssbbbbbbbbbo',
  'osssbbbbbbbbnn',
  'osssobtttttton',
  'osssoottttoo..',
  'ossso.oooo....',
  '.osso.........',
  '..oo..........',
];
const HEAD_BARK = [
  '..oooo........',
  '.ohhhhoo......',
  'ohbbbbbboo....',
  'obbbbbtbbboo..',
  'obbbbbebbbbbo.',
  'osssbbbbbbbbbo',
  'osssbbbbbbbbnn',
  'osssobttooommo',
  'osssootttttto.',
  'ossso.ooooo...',
  '.osso.........',
  '..oo..........',
];
const HEAD_SLEEP = [
  '..............',
  '..oooo........',
  '.ohhhhoo......',
  'ohbbbbbboo....',
  'obbbbboobbbo..',
  'osssbbbbbbbbbo',
  'osssbbbbbbbbnn',
  'osssobtttttton',
  'ossssoooooooo.',
  '.oooo.........',
  '..............',
  '..............',
];
// 머리를 내린 자세(먹기·냄새 맡기·땅 파기)
const HEAD_DOWN = [
  '..oooo........',
  '.ohhhhoo......',
  'ohbbbbbbo.....',
  'obbbbtbbbo....',
  'osbbbebbbbo...',
  'ossbbbbbbbbo..',
  'osssbbbbbbbbo.',
  'osssobbbbbbbbo',
  'osssoobtttttbo',
  'ossso.ottttton',
  '.osso..ooooonn',
  '..oo..........',
];

const LEG = ['.bb.', 'obbo', 'obbo', 'otto', 'oooo'];
const LEG_FAR = ['.xx.', 'oxxo', 'oxxo', 'otto', 'oooo'];
const LEG_UP = ['.bb.', 'obbo', 'otto', 'oooo'];
const LEG_UP_FAR = ['.xx.', 'oxxo', 'otto', 'oooo'];
const LEG_FOLD = ['.bbbb.', 'obbbbo', 'oottoo', '.oooo.'];
// 앞발로 파기
const LEG_DIG = ['.bb..', 'obbo.', '.obbo', '..oto', '...oo'];

const TAIL = {
  up: [['oo...', 'obo..', '.obo.', '..obo', '...ob'], 0, 2],
  mid: [['oo....', 'obboo.', '.oobbo'], -1, 5],
  down: [['...oo', '..obo', '.obo.', 'obo..', 'oo...'], 0, 8],
  wag: [['.oo...', 'obbo..', '.oobo.', '...obo'], -1, 3],
};

// 장모: 귀·꼬리·배 깃털 / 와이어: 수염·눈썹
function longHair(b, hx, hy, tailKey, bodyY) {
  const f = b._m.f;
  const o = b._m.o;
  // 귀 아래로 늘어진 깃털
  b.stamp(['offfo', 'offfo', 'ofofo', '.o.o.'], hx, hy + 9, { f, o });
  // 배 아래로 늘어진 깃털
  for (let x = 4; x < 22; x++) {
    b.set(x, bodyY + 7, f);
    if (x % 2 === 0) b.set(x, bodyY + 8, f);
    if (x % 4 === 1) b.set(x, bodyY + 8, o);
  }
  // 꼬리 깃털
  const tp = TAIL[tailKey];
  if (tp) b.stamp(['f.f.', '.ff.', 'f..f'], tp[1] + 1, tp[2] + (bodyY - 6) + 1, { f });
}
function wireHair(b, hx, hy) {
  b.stamp(['ww.', 'www'], hx + 9, hy + 9, { w: b._m.w });
  b.stamp(['ww'], hx + 5, hy + 2, { w: b._m.w });
}

/**
 * dog: {coat, hair}, opts: { stage:'puppy'|'young'|'adult'|'senior', pose, f(프레임), heavy }
 * pose: stand | breathe | walk | run | sleep | eat | bark | dig | hesitate | sniff | kote | belly | oldwalk | sit
 */
export function dogFrame(dog, opts = {}) {
  const b = new Buf(DW, DH);
  const m = { ...(COAT[dog.coat] || COAT.black_tan), ...FIXED };
  b._m = m;
  const pose = opts.pose || 'stand';
  const f = opts.f || 0;
  const stage = opts.stage || 'adult';
  if (stage === 'puppy') return puppyFrame(b, m, pose, f, dog);
  if (pose === 'belly') return bellyFrame(b, m, f, dog, stage);

  let bodyY = 6;
  let headX = 18;
  let headY = 0;
  let head = HEAD;
  let tail = 'mid';
  let legs = 'stand';
  const heavy = !!opts.heavy;
  if (pose === 'breathe' || pose === 'stand') {
    if (f % 2) bodyY += 0;
    tail = f % 2 ? 'wag' : 'mid';
  }
  if (pose === 'walk' || pose === 'oldwalk') {
    legs = f % 2 ? 'walkA' : 'walkB';
    tail = pose === 'oldwalk' ? 'down' : f % 2 ? 'up' : 'wag';
    if (pose === 'oldwalk') headY = 1;
  }
  if (pose === 'run') {
    legs = f % 2 ? 'runA' : 'runB';
    tail = 'up';
    bodyY = f % 2 ? 5 : 6;
    headY = bodyY - 6;
  }
  if (pose === 'sleep') {
    legs = 'fold';
    head = HEAD_SLEEP;
    tail = 'down';
    bodyY = 8;
    headY = 4 + (f % 2);
    headX = 17;
  }
  if (pose === 'sit') {
    legs = 'sit';
    tail = 'down';
  }
  if (pose === 'eat' || pose === 'sniff') {
    head = HEAD_DOWN;
    headY = 5 + (f % 2);
    headX = 18;
    tail = pose === 'eat' ? (f % 2 ? 'wag' : 'mid') : 'up';
  }
  if (pose === 'dig') {
    head = HEAD_DOWN;
    headY = 5;
    legs = f % 2 ? 'digA' : 'digB';
    tail = 'up';
  }
  if (pose === 'bark') {
    head = f % 2 ? HEAD_BARK : HEAD;
    headY = f % 2 ? -1 : 0;
    tail = 'up';
  }
  if (pose === 'hesitate') {
    headY = f % 2 ? -1 : 0;
    tail = 'down';
  }
  if (pose === 'kote') {
    head = f % 2 ? HEAD_DOWN : HEAD;
    headY = f % 2 ? 5 : 1;
    tail = 'wag';
    legs = f % 2 ? 'walkA' : 'stand';
  }
  if (stage === 'senior' && pose !== 'sleep') headY += 1;

  // 먼 쪽 다리 → 꼬리 → 몸 → 가까운 다리 → 머리
  const ly = bodyY + 7;
  const L = {
    stand: [[4, LEG_FAR], [17, LEG_FAR], [7, LEG], [20, LEG]],
    walkA: [[3, LEG_FAR], [18, LEG_FAR], [8, LEG_UP], [20, LEG]],
    walkB: [[5, LEG_FAR], [16, LEG_FAR], [6, LEG], [21, LEG_UP]],
    runA: [[2, LEG_UP_FAR], [19, LEG_UP_FAR], [5, LEG_UP], [22, LEG_UP]],
    runB: [[6, LEG_FAR], [16, LEG_FAR], [9, LEG], [19, LEG]],
    fold: [[4, LEG_FOLD], [17, LEG_FOLD]],
    sit: [[3, LEG_FOLD], [17, LEG_FAR], [20, LEG]],
    digA: [[4, LEG_FAR], [6, LEG], [18, LEG_DIG], [21, LEG]],
    digB: [[4, LEG_FAR], [6, LEG], [19, LEG], [21, LEG_DIG]],
  }[legs];
  for (const [x, art] of L.slice(0, 2)) b.stamp(art, x, ly + (art === LEG_FOLD ? 0 : 0), m);
  const tp = TAIL[tail];
  b.stamp(tp[0], 0 + tp[1], tp[2] + (bodyY - 6), m);
  b.stamp(heavy ? BODY_HEAVY : BODY, 2, bodyY, m);
  if (dog.coat === 'dapple') for (const [x, y] of [[6, 2], [11, 3], [15, 2], [8, 4], [17, 4], [13, 5], [4, 3]]) b.set(2 + x, bodyY + y, C.S);
  for (const [x, art] of L.slice(2)) b.stamp(art, x, ly + (heavy ? 1 : 0), m);
  b.stamp(head, headX, headY + (bodyY - 6), m);
  if (stage === 'senior') {
    // 주둥이 흰 털
    for (let j = 0; j < head.length; j++) for (let i = 0; i < head[j].length; i++) if (head[j][i] === 't' && i > 8) b.set(headX + i, headY + (bodyY - 6) + j, C.G);
  }
  if (dog.hair === 'long') longHair(b, headX, headY + (bodyY - 6), tail, bodyY);
  if (dog.hair === 'wire') wireHair(b, headX, headY + (bodyY - 6));
  if (pose === 'sit') {
    // 앉은 자세: 엉덩이를 내리고 앞을 세운다
    const sb = new Buf(DW, DH);
    sb.blit(b, 0, 0);
    return sb;
  }
  return b;
}

function bellyFrame(b, m, f, dog) {
  // 등을 대고 누워 배를 보인다 (다리 넷이 위로 버둥)
  const k = f % 2;
  const legs = k ? ['..oooo.oooo.....oooo.oooo...', '..otto.otto.....otto.otto...', '..oxxo.obbo.....oxxo.obbo...'] : ['...oooo.oooo.....oooo.oooo..', '...otto.otto.....otto.otto..', '...oxxo.obbo.....oxxo.obbo..'];
  const art = [
    ...legs,
    '.ooooxoooboooooooooxoooboooo',
    'oCCCCCCCCCCCCCCCCCCCCCCChhbo',
    'osCCCCCCCCCCCCCCCCCCCCChbbbo',
    'osbbbbbbbbbbbbbbbbbbbbbbbenn',
    '.osssssssssssssssssssssbbbso',
    '..oooooooooooooooooooooooss.',
    '........................oo..',
  ];
  b.stamp(art, 2, 9, { ...m, C: m.t === m.b ? C.C : m.t });
  b.stamp(['oo.', 'obo', '.oo'], 0, 14, m);
  if (dog.hair === 'long') for (let x = 6; x < 26; x += 2) b.set(x, 18, m.f);
  return b;
}

// ───── 강아지 ─────
const P_BODY = ['..oooooooooo..', '.ohhhhhhhhhhh.', 'obbbbbbbbbbbbo', 'obbbbbbbbbbtbo', '.osssssssssso.', '..oooooooooo..'];
const P_HEAD = [
  '..oooo......',
  '.ohhhhoo....',
  'ohbbbbbboo..',
  'obbbbtbbbbo.',
  'osbbbeebbbbo',
  'ossbbeebbbnn',
  'osssobtttton',
  'osssoottoo..',
  'ossso.oo....',
  '.oso........',
  '..o.........',
];
const P_HEAD_SLEEP = [
  '............',
  '..oooo......',
  '.ohhhhoo....',
  'ohbbbbbbo...',
  'obboobbbbooo',
  'osbbbbbbbttn',
  'ossbbbbbtttn',
  'osssooooooo.',
  '.oooo.......',
];
const P_LEG = ['.bb.', 'obbo', 'otto', 'oooo'];
const P_LEG_FAR = ['.xx.', 'oxxo', 'otto', 'oooo'];
function puppyFrame(b, m, pose, f, dog) {
  const by = pose === 'sleep' ? 12 : 10;
  const tailArt = f % 2 ? ['oo..', 'obo.', '.obo'] : ['....', 'ooo.', 'obbo'];
  if (pose !== 'sleep') {
    const walk = pose === 'walk' || pose === 'run';
    b.stamp(P_LEG_FAR, walk && f % 2 ? 6 : 7, by + 4, m);
    b.stamp(P_LEG_FAR, walk && f % 2 ? 16 : 15, by + 4, m);
  }
  b.stamp(tailArt, 3, by - 1, m);
  b.stamp(P_BODY, 5, by, m);
  if (dog.coat === 'dapple') for (const [x, y] of [[4, 2], [8, 3], [10, 2]]) b.set(5 + x, by + y, C.S);
  if (pose !== 'sleep') {
    const walk = pose === 'walk' || pose === 'run';
    b.stamp(P_LEG, walk && f % 2 ? 10 : 9, by + 4, m);
    b.stamp(P_LEG, walk && f % 2 ? 16 : 17, by + 4, m);
  } else {
    b.stamp(['.bbbb.', 'oottoo', '.oooo.'], 8, by + 4, m);
  }
  const hy = pose === 'sleep' ? by - 3 : pose === 'eat' || pose === 'sniff' || pose === 'dig' ? by - 1 + (f % 2) : by - 7 + (pose === 'bark' ? -(f % 2) : 0);
  b.stamp(pose === 'sleep' ? P_HEAD_SLEEP : P_HEAD, 16, hy, m);
  if (pose === 'bark' && f % 2) b.stamp(['mm'], 25, hy + 7, m);
  if (dog.hair === 'long') b.stamp(['f.f', '.f.'], 17, hy + 10, m);
  if (dog.hair === 'wire') b.stamp(['ww'], 25, hy + 8, m);
  return b;
}

// ───── 소품 ─────
export const PROPS = {
  bowl: { art: ['.oooooo.', 'oTTTTTTo', 'oEEEEEEo', '.oEEEEo.'], map: { o: C.K, T: C.T, E: C.E } },
  bag: {
    art: [
      '..........oooo',
      '.......oooNNNo',
      '....oooNNNNNo.',
      '.oooNNNNNNNo..',
      'oNNNNNNNNoo...',
      'oNNNNNNoo.....',
      '.ooooo........',
    ],
    map: { o: C.K, N: C.N },
  },
  kote: { art: ['.ooo..', 'oNNNo.', 'oNNNNo', 'oBBBBo', 'oBBBo.', '.ooo..'], map: { o: C.K, N: C.N, B: C.B } },
  men: { art: ['..oooo..', '.oGGGGo.', 'oGoGoGGo', 'oGoGoGNo', 'oNNNNNNo', '.oNNNNo.', '..oooo..'], map: { o: C.K, G: C.G, N: C.N } },
  step: { art: ['oooooooooo', 'oTTTTTTTTo', 'oBBBBBBBBo', 'oooooooooo'], map: { o: C.K, T: C.T, B: C.B } },
  cushion: { art: ['.oooooooooo.', 'oEEEEEEEEEEo', 'oEPEEEEEEPEo', '.oooooooooo.'], map: { o: C.K, E: C.E, P: C.P } },
  dirt: { art: ['.B..', 'B.B.', '.BB.'], map: { B: C.B } },
};
export function propBuf(name) {
  const p = PROPS[name];
  const w = Math.max(...p.art.map((r) => r.length));
  const b = new Buf(w, p.art.length);
  b.stamp(p.art, 0, 0, p.map);
  return b;
}

// 머리 위 말풍선 아이콘 (8×8)
export const BUBBLES = {
  '!': ['.oooooo.', 'oWWKWWWo', 'oWWKWWWo', 'oWWKWWWo', 'oWWWWWWo', 'oWWKWWWo', '.oooWoo.', '....o...'],
  '?': ['.oooooo.', 'oWKKKWWo', 'oWWWKWWo', 'oWWKWWWo', 'oWWWWWWo', 'oWWKWWWo', '.oooWoo.', '....o...'],
  heart: ['.oooooo.', 'oWEWEWWo', 'oEEEEEWo', 'oEEEEEWo', 'oWEEEWWo', 'oWWEWWWo', '.oooWoo.', '....o...'],
  note: ['.oooooo.', 'oWWKKKWo', 'oWWKWKWo', 'oWWKWKWo', 'oWKKWKWo', 'oWKKWWWo', '.oooWoo.', '....o...'],
  z: ['.oooooo.', 'oWKKKKWo', 'oWWWKWWo', 'oWWKWWWo', 'oWKWWWWo', 'oWKKKKWo', '.oooWoo.', '....o...'],
  sweat: ['.oooooo.', 'oWWWLWWo', 'oWWLLWWo', 'oWLLLLWo', 'oWLLLLWo', 'oWWLLWWo', '.oooWoo.', '....o...'],
  flag: ['.oooooo.', 'oWKEEEWo', 'oWKEEEWo', 'oWKWWWWo', 'oWKWWWWo', 'oWKWWWWo', '.oooWoo.', '....o...'],
};
export function bubbleBuf(kind) {
  const b = new Buf(8, 8);
  b.stamp(BUBBLES[kind] || BUBBLES['!'], 0, 0, { o: C.K, W: C.W, K: C.K, E: C.E, L: C.L });
  return b;
}
