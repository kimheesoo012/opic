// 아이콘 그리기: 파란 줄 공책 위 말풍선 + 체크 (Playwright로 SVG → PNG)
const { chromium } = require('playwright');
const path = require('path');
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#1F5FAE"/>
  <g transform="translate(256 256) scale(${pad ? 0.72 : 0.86}) translate(-256 -256)">
    ${[150, 214, 278, 342].map(y => `<rect x="86" y="${y}" width="340" height="6" rx="3" fill="#ffffff" opacity=".16"/>`).join('')}
    <path d="M118 118h276a40 40 0 0 1 40 40v158a40 40 0 0 1-40 40H246l-82 66v-66h-46a40 40 0 0 1-40-40V158a40 40 0 0 1 40-40z" fill="#F4F8FC"/>
    <path d="M178 238l50 50 106-106" fill="none" stroke="#0E7FB8" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
  </g></svg>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const out = path.join(__dirname, '..', 'icons');
  for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 1], ['apple-touch-icon.png', 180, 1]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml,${encodeURIComponent(svg(pad))}" width="${size}" height="${size}">`);
    await p.screenshot({ path: path.join(out, name), omitBackground: !pad });
  }
  await b.close();
  console.log('icons ok');
})();
