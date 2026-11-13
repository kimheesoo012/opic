// 새 수업 데이터 파일을 notes.js에 합친다: node talk-notes/tools/add-lesson.mjs talk-notes/tools/lesson-1113.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const here = path.dirname(new URL(import.meta.url).pathname);
const notesPath = path.join(here, '../js/data/notes.js');
const N = await import(pathToFileURL(notesPath).href + '?t=' + Date.now());
const A = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const L = A.LESSON;
const LESSONS = N.LESSONS.filter(l => l.id !== L.id).concat([L]);
const SHORT = N.SHORT.slice(0, LESSONS.length - 1).concat([L.date.replace(/(\d+)월 (\d+)일.*/, '$1/$2')]);
const MIST = JSON.parse(JSON.stringify(N.MIST));
for (const [k, exs] of Object.entries(A.MIST_ADD || {})) {
  const m = MIST.find(x => x.k === k); if (!m) throw new Error('MIST ' + k);
  for (const ex of exs) if (!m.ex.some(e => e[1] === ex[1])) m.ex.push(ex);
}
const GROW = N.GROW.concat((A.GROW_ADD || []).filter(g => !N.GROW.some(x => x.h === g.h)));
const PHR = N.PHR.some(g => g[0] === A.PHR_ADD[0]) ? N.PHR : N.PHR.concat([A.PHR_ADD]);
const PRON = JSON.parse(JSON.stringify(N.PRON));
const words = new Set(PRON.flatMap(g => g.rows.map(r => r.w)));
for (const [gi, row] of A.PRON_ADD || []) {
  if (words.has(row.w)) { const r = PRON.flatMap(g => g.rows).find(r => r.w === row.w); for (const d of row.d) if (!r.d.includes(d)) r.d.push(d); for (const h of row.heard) if (!r.heard.includes(h)) r.heard.push(h); continue; }
  PRON[gi].rows.push(row); words.add(row.w);
}
const cardsN = LESSONS.reduce((a, l) => a + l.cards.length, 0);
const out = `/* 영어 회화 교정 노트 원본 데이터 (수업 ${LESSONS.length}회, 문장 ${cardsN}개)
   원본 노트(영어 회화 교정 노트.html)의 내용을 그대로 옮겼다. 고칠 때는 이 파일을 직접 고친다.
   카드 필드: c 상황, o 원문(수업에서 한 말), f 수정, t 수정 해석, e 설명(HTML), n 더 자연스럽게, nk 그 해석, g 실수 태그 */
export const TAGS = ${JSON.stringify(N.TAGS)};
export const SHORT = ${JSON.stringify(SHORT)};
export const MIST = ${JSON.stringify(MIST, null, 1)};
export const GROW = ${JSON.stringify(GROW, null, 1)};
export const PHR = ${JSON.stringify(PHR, null, 1)};
export const PRON = ${JSON.stringify(PRON, null, 1)};
export const LESSONS = ${JSON.stringify(LESSONS)};
`;
fs.writeFileSync(notesPath, out);
console.log('ok lessons', LESSONS.length, 'cards', cardsN, 'new', L.cards.length, 'grow', GROW.length, 'phr', PHR.length, 'pron', PRON.reduce((a, g) => a + g.rows.length, 0), 'patterns', MIST.reduce((a, m) => a + m.ex.length, 0));
