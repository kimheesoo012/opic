// sw.js 다시 만들기: 앱 파일 목록과 내용 해시로 버전을 정한다 (파일을 고치면 꼭 실행)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(path.join(root, d))) {
    const rel = d ? d + '/' + f : f;
    if (['tools', 'tests', 'node_modules', 'sw.js', 'README.md', '.gitignore'].includes(rel)) continue;
    if (fs.statSync(path.join(root, rel)).isDirectory()) walk(rel); else files.push(rel);
  }
})('');
files.sort();
const h = crypto.createHash('sha256');
for (const f of files) h.update(f).update(fs.readFileSync(path.join(root, f)));
const version = 'talk-notes-' + h.digest('hex').slice(0, 10);
const tpl = fs.readFileSync(path.join(__dirname, 'sw.template.js'), 'utf8');
fs.writeFileSync(path.join(root, 'sw.js'), tpl.replace('__VERSION__', version).replace('__ASSETS__', ['./', ...files.map(f => './' + f)].map(f => `  '${f}'`).join(',\n')));
console.log(version, files.length + ' files');
