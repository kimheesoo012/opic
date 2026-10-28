// 교정 노트 HTML → js/data/notes.js 다시 만들기: node talk-notes/tools/import-note.cjs <노트.html> talk-notes/js/data/notes.js
// (새 수업이 노트에 추가됐을 때. 노트 형식이 같아야 한다)
const fs = require('fs');
const [,, notePath, outPath] = process.argv;
const html = fs.readFileSync(notePath, 'utf8');
const js = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
const head = js.slice(0, js.indexOf('/* 렌더 */'));
const D = new Function(head + '\nreturn {LESSONS,TAGS,SHORT,MIST,GROW,PHR};')();
// 발음 표
const body = html.replace(/<script[\s\S]*?<\/script>/g, '');
const pronSec = body.slice(body.indexOf('<section id="s-pron">'), body.indexOf('</section>', body.indexOf('<section id="s-pron">')));
const strip = s => s.replace(/<[^>]+>/g, '').trim();
const PRON = [];
const re = /<h2>([\s\S]*?)<\/h2>\s*<table>([\s\S]*?)<\/table>(\s*<p[^>]*>([\s\S]*?)<\/p>)?/g;
let m;
while ((m = re.exec(pronSec))) {
  const rows = [...m[2].matchAll(/<tr><td[^>]*>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g)]
    .map(r => ({ w: strip(r[1]), heard: strip(r[2]).split(/,\s*/), d: strip(r[3]).split(/,\s*/) }));
  PRON.push({ h: strip(m[1]), tip: m[4] ? strip(m[4]) : '', rows });
}
const cnt = PRON.reduce((a, g) => a + g.rows.length, 0);
if (!cnt) throw new Error('발음 표를 찾지 못했어요');
const out = `/* 영어 회화 교정 노트 원본 데이터 (수업 ${D.LESSONS.length}회, 문장 ${D.LESSONS.reduce((a, l) => a + l.cards.length, 0)}개)
   원본 노트(영어 회화 교정 노트.html)의 내용을 그대로 옮겼다. 고칠 때는 이 파일을 직접 고친다.
   카드 필드: c 상황, o 원문(수업에서 한 말), f 수정, t 수정 해석, e 설명(HTML), n 더 자연스럽게, nk 그 해석, g 실수 태그 */
export const TAGS = ${JSON.stringify(D.TAGS)};
export const SHORT = ${JSON.stringify(D.SHORT)};
export const MIST = ${JSON.stringify(D.MIST, null, 1)};
export const GROW = ${JSON.stringify(D.GROW, null, 1)};
export const PHR = ${JSON.stringify(D.PHR, null, 1)};
export const PRON = ${JSON.stringify(PRON, null, 1)};
export const LESSONS = ${JSON.stringify(D.LESSONS)};
`;
fs.writeFileSync(outPath, out);
console.log('ok', D.LESSONS.length, PRON.map(g => g.h + ':' + g.rows.length).join(', '), (out.length / 1024 | 0) + 'KB');
