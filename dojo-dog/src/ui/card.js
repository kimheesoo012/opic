// 결과 카드 (1080×1920): 레트로 엔딩 화면. 가장 건강했던 때의 개와 식구들, 칭호, 견생, 학습 기록, 마지막 한마디.
import { Buf } from './pixel/core.js';
import { bgBuf } from './pixel/bg.js';
import { dogFrame } from './pixel/dog.js';
import { personFrame, faceBuf } from './pixel/people.js';
import { lookFor } from './pixel/director.js';
import { paint } from './pixel/lcd.js';
import { ROLES } from '../engine/world.js';

const W = 1080;
const H = 1920;
const PIX = "'DotGothic16', 'Noto Sans JP', 'Noto Sans KR', monospace";
const BODY = "'Noto Sans KR', 'Apple SD Gothic Neo', 'Noto Sans JP', 'Hiragino Sans', sans-serif";
const C = { bg: '#141a2b', frame: '#e8c447', ink: '#f4f1e8', sub: '#a9d6ee', mute: '#a3a3ad', red: '#c63a3f' };

function wrap(ctx, text, x, y, maxW, lh, maxLines = 2) {
  const chars = [...String(text)];
  let line = '';
  let n = 0;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      n++;
      if (n >= maxLines) {
        ctx.fillText(line.slice(0, -1) + '…', x, y);
        return y + lh;
      }
      ctx.fillText(line, x, y);
      y += lh;
      line = ch;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

function blitScaled(ctx, buf, x, y, k, gray = false) {
  const c = document.createElement('canvas');
  c.width = buf.w;
  c.height = buf.h;
  paint(c.getContext('2d'), buf, gray);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, x, y, buf.w * k, buf.h * k);
}

// 도트 테두리
function pixelFrame(ctx, x, y, w, h, k = 6) {
  ctx.fillStyle = C.frame;
  ctx.fillRect(x, y, w, k);
  ctx.fillRect(x, y + h - k, w, k);
  ctx.fillRect(x, y, k, h);
  ctx.fillRect(x + w - k, y, k, h);
  ctx.fillStyle = C.bg;
  for (const [cx, cy] of [[x, y], [x + w - k, y], [x, y + h - k], [x + w - k, y + h - k]]) ctx.fillRect(cx, cy, k, k);
}

// 엔딩 장면: 도장 배경 + 식구들 + 가운데 개
export function endingScene(s) {
  const b = new Buf(160, 96);
  b.d.set(bgBuf('dojo', { season: 'spring', tod: 'day' }).d);
  const roles = ROLES.filter((r) => r !== 'roshi' || !s.flags.roshi_gone);
  const xs = [4, 26, 104, 126, 48, 82, 140];
  roles.slice(0, 7).forEach((r, i) => {
    const lk = lookFor(s, r);
    b.blit(personFrame(lk.look, { pose: i % 3 === 2 ? 'wave' : 'stand', size: lk.size, casual: r === 'okami' }), xs[i], i >= 4 ? 44 : 52, i % 2 === 1);
  });
  b.blit(dogFrame(s.dog, { pose: 'stand', stage: 'adult', f: 1 }), 64, 72);
  return b;
}

export async function drawCard(canvas, s, study) {
  const sum = s.summary;
  try {
    await Promise.race([document.fonts.load(`40px ${PIX}`), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* 글꼴이 없어도 그린다 */
  }
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  // 스캔라인
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
  pixelFrame(ctx, 30, 30, W - 60, H - 60, 8);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.frame;
  ctx.font = `48px ${PIX}`;
  ctx.textAlign = 'center';
  ctx.fillText('道場犬', W / 2, 120);
  ctx.fillStyle = C.mute;
  ctx.font = `30px ${PIX}`;
  ctx.fillText(sum.world.dojoName, W / 2, 168);

  // 장면 (×6)
  const k = 6;
  const sx = (W - 160 * k) / 2;
  const sy = 200;
  blitScaled(ctx, endingScene(s), sx, sy, k);
  pixelFrame(ctx, sx - 12, sy - 12, 160 * k + 24, 96 * k + 24, 6);

  // 이름과 칭호
  let y = sy + 96 * k + 100;
  ctx.fillStyle = C.ink;
  ctx.font = `84px ${PIX}`;
  ctx.fillText(sum.dog.name, W / 2, y);
  y += 64;
  const born = s.born || new Date().getFullYear();
  ctx.fillStyle = C.sub;
  ctx.font = `36px ${PIX}`;
  ctx.fillText(`${born} — ${born + sum.years}　${sum.years}年${sum.seasons ? sum.seasons * 3 + 'か月' : ''}`, W / 2, y);
  y += 72;
  const title = sum.titles[0];
  if (title) {
    ctx.fillStyle = C.frame;
    ctx.font = `52px ${PIX}`;
    ctx.fillText(`「${title.ja}」`, W / 2, y);
    y += 40;
  }

  // 식구들의 성과
  y += 30;
  ctx.textAlign = 'left';
  for (const r of ROLES) {
    const c = sum.cast[r];
    const lk = lookFor(s, r);
    blitScaled(ctx, faceBuf(lk.look, lk.size === 'kid' ? 'kid' : 'adult'), 90, y - 44, 4);
    ctx.fillStyle = C.ink;
    ctx.font = `30px ${BODY}`;
    ctx.fillText(c.ko, 160, y - 14);
    ctx.fillStyle = C.mute;
    ctx.font = `26px ${BODY}`;
    wrap(ctx, c.ach.length ? c.ach[c.ach.length - 1] : c.epilogue, 160, y + 20, W - 260, 32, 1);
    y += 84;
  }

  // 이번 견생의 N2
  y += 10;
  ctx.fillStyle = C.frame;
  ctx.font = `34px ${PIX}`;
  ctx.fillText('N2', 90, y);
  ctx.fillStyle = C.ink;
  ctx.font = `30px ${PIX}`;
  ctx.fillText(`単語 ${study.words}（${study.wordsMastered}）　文法 ${study.grammar}（${study.grammarMastered}）`, 160, y);
  ctx.fillStyle = C.mute;
  ctx.font = `24px ${BODY}`;
  ctx.fillText('만난 수(익힘)', 160, y + 36);
  y += 100;

  // 마지막 한마디
  const word = sum.lastWord || (sum.words.length ? sum.words[sum.words.length - 1].text : '');
  if (word) {
    ctx.fillStyle = C.ink;
    ctx.font = `40px ${BODY}`;
    ctx.textAlign = 'center';
    wrap(ctx, `“${word}”`, W / 2, Math.min(y, H - 150), W - 200, 52, 2);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = C.mute;
  ctx.font = `26px ${PIX}`;
  ctx.fillText('おしまい', W / 2, H - 70);
  ctx.textAlign = 'left';
  return canvas;
}
