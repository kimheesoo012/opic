// SNS 공유용 결과 카드 (1080×1920, 휴대폰 화면 비율)
import { drawDog } from './dogdraw.js';
import { COATS, HAIRS, PERSONALITIES, REGIONS, DOJOS, SEASON_KO, ROLES, ROLE_KO } from '../engine/world.js';

const W = 1080;
const H = 1920;
const SERIF = "'Shippori Mincho','Hiragino Mincho ProN','Yu Mincho','Noto Serif JP','Noto Serif KR',serif";
const SANS = "'Apple SD Gothic Neo','Noto Sans KR','Hiragino Sans','Noto Sans JP',sans-serif";

function wrap(ctx, text, x, y, maxW, lh, maxLines = 3) {
  const chars = [...String(text)];
  let line = '';
  let n = 0;
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxW && line) {
      n++;
      if (n >= maxLines) {
        ctx.fillText(line.slice(0, -1) + '…', x, y);
        return y + lh;
      }
      ctx.fillText(line, x, y);
      y += lh;
      line = chars[i];
    } else line = test;
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lh;
  }
  return y;
}

export function drawCard(canvas, sum) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  // 배경: 쪽빛 → 히노키
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#121826');
  g.addColorStop(0.55, '#1b2233');
  g.addColorStop(1, '#2a2015');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // 마루 결
  ctx.strokeStyle = 'rgba(201,154,98,0.10)';
  ctx.lineWidth = 2;
  for (let y = 1180; y < H; y += 46) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // 테두리
  ctx.strokeStyle = 'rgba(216,176,122,0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  ctx.fillStyle = '#d8b07a';
  ctx.font = `600 34px ${SANS}`;
  ctx.fillText('道場犬 · 견생 기록', 80, 116);
  ctx.textAlign = 'right';
  ctx.font = `30px ${SANS}`;
  ctx.fillStyle = '#b9b3a6';
  ctx.fillText(sum.world.dojoName, W - 80, 116);
  ctx.textAlign = 'left';

  // 이름
  ctx.fillStyle = '#ece7dc';
  ctx.font = `700 120px ${SERIF}`;
  ctx.fillText(sum.dog.name, 80, 260);
  const coat = COATS.find((c) => c.id === sum.dog.coat);
  const hair = HAIRS.find((c) => c.id === sum.dog.hair);
  const per = PERSONALITIES.find((p) => p.id === sum.dog.per);
  ctx.font = `34px ${SANS}`;
  ctx.fillStyle = '#b9b3a6';
  ctx.fillText(`${coat ? coat.ja : ''} · ${hair ? hair.ja : ''} · ${per ? per.ja : ''}`, 84, 318);
  const region = REGIONS.find((r) => r.id === sum.world.region);
  ctx.fillText(`${region ? region.ja : ''} · ${sum.world.gen > 1 ? `${sum.world.gen}대째 도장견` : '첫 도장견'}`, 84, 366);

  // 견생 기간
  ctx.fillStyle = '#d8b07a';
  ctx.font = `600 46px ${SANS}`;
  ctx.fillText(`견생 ${sum.years}년 ${sum.seasons ? sum.seasons * 3 + '개월' : ''}`.trim(), 84, 440);
  ctx.font = `30px ${SANS}`;
  ctx.fillStyle = '#8b8f9a';
  ctx.fillText(`${SEASON_KO[['spring', 'summer', 'autumn', 'winter'][sum.startSeason]]}에 도장에 와서 ${sum.events}가지 일을 겪었다`, 84, 488);

  // 개 그림
  drawDog(ctx, 560, 720, 3.0, sum.dog, { pose: 'sit', t: 0.3, senior: sum.years >= 10 });

  // 칭호
  let y = 900;
  ctx.font = `600 30px ${SANS}`;
  ctx.fillStyle = '#d8b07a';
  ctx.fillText('칭호', 84, y);
  y += 58;
  ctx.font = `700 54px ${SERIF}`;
  ctx.fillStyle = '#ece7dc';
  for (const t of sum.titles.slice(0, 2)) {
    ctx.fillText(`「${t.ja}」`, 70, y);
    y += 66;
  }
  // 숫자
  y += 10;
  const nums = [
    ['서브스토리', `${sum.subs}개 클리어`],
    ['委員長 작전 저지', `${sum.foiled}회`],
    ['익힌 단어', `${sum.vocab}개`],
  ];
  ctx.font = `30px ${SANS}`;
  nums.forEach(([k, v], i) => {
    const x = 84 + i * 320;
    ctx.fillStyle = '#8b8f9a';
    ctx.fillText(k, x, y);
    ctx.fillStyle = '#ece7dc';
    ctx.font = `700 44px ${SANS}`;
    ctx.fillText(v, x, y + 54);
    ctx.font = `30px ${SANS}`;
  });
  y += 120;
  // 함께한 사람들
  ctx.fillStyle = '#d8b07a';
  ctx.font = `600 30px ${SANS}`;
  ctx.fillText('함께한 사람들', 84, y);
  y += 50;
  for (const r of ROLES) {
    const c = sum.cast[r];
    const best = c.ach.length ? c.ach[c.ach.length - 1] : c.epilogue;
    ctx.fillStyle = '#ece7dc';
    ctx.font = `600 32px ${SANS}`;
    ctx.fillText(c.ko, 84, y);
    ctx.fillStyle = '#b9b3a6';
    ctx.font = `30px ${SANS}`;
    wrap(ctx, best || ROLE_KO[r], 330, y, W - 330 - 84, 38, 1);
    y += 52;
  }
  // 남긴 한마디
  y += 20;
  const word = sum.lastWord || (sum.words.length ? sum.words[sum.words.length - 1].text : '');
  if (word) {
    ctx.fillStyle = '#d8b07a';
    ctx.font = `600 30px ${SANS}`;
    ctx.fillText('남긴 한마디', 84, y);
    y += 56;
    ctx.fillStyle = '#ece7dc';
    ctx.font = `600 44px ${SERIF}`;
    wrap(ctx, `“${word}”`, 84, y, W - 168, 56, 2);
  }
  ctx.fillStyle = '#8b8f9a';
  ctx.font = `26px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('道場犬 — 일본 검도장에 사는 닥스훈트의 견생', W / 2, H - 70);
  ctx.textAlign = 'left';
  return canvas;
}

export { DOJOS };
