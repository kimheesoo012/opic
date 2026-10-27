const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.type()+' ' + m.text()); });
  await p.goto(process.argv[2] || 'http://localhost:8765/toeic/');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: process.argv[3] || 'home.png' });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
