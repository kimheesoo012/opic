// 이야기 연결 검사: 후속 예약(later/next)·seen(id)·플래그 읽기가 실제로 있는 이벤트·설정된 플래그를 가리키는가.
// 사용: node tools/story-check.mjs
import fs from 'fs';
import path from 'path';
import { ALL_EVENTS } from '../src/data/index.js';

const ids = new Map(ALL_EVENTS.map((e) => [e.id, e]));
const live = (id) => ids.has(id) && !ids.get(id).removed;
const problems = [];
const setFlags = new Set();
const walk = (o, ev) => {
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'set') [].concat(v).forEach((f) => setFlags.add(f));
    if ((k === 'later' || k === 'next') && v) {
      const target = Array.isArray(v) ? v[0] : typeof v === 'object' ? v.id : v;
      if (typeof target === 'string' && !live(target)) problems.push(`${ev}: ${k} → 없는 이벤트 ${target}`);
    }
    if (typeof v === 'object') walk(v, ev);
  }
};
for (const e of ALL_EVENTS) if (!e.removed) walk(e, e.id);
// 소스에서 플래그·이벤트 읽기를 모은다 (함수 안의 조건까지)
const src = ['src/data', 'src/engine', 'src/ui'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.js')).map((f) => path.join(d, f)));
src.push(...fs.readdirSync('src/data/ja').map((f) => path.join('src/data/ja', f)));
const text = src.map((f) => [f, fs.readFileSync(f, 'utf8')]);
const reads = new Map();
const add = (f, where) => { if (!reads.has(f)) reads.set(f, new Set()); reads.get(f).add(where); };
for (const [f, t] of text) {
  for (const m of t.matchAll(/flags\.([a-z0-9_]+)|has\(s, '([a-z0-9_]+)'\)|\b(?:if|req): '!?([a-z0-9_]+)'/g)) add(m[1] || m[2] || m[3], f);
  for (const m of t.matchAll(/seen\(s, '([a-z0-9_]+)'\)|s\.seen\.([a-z0-9_]+)/g)) {
    const id = m[1] || m[2];
    if (!live(id)) problems.push(`${f}: seen → 없는/뺀 이벤트 ${id}`);
  }
}
// 엔진이 직접 세우는 플래그
const engineSet = new Set();
for (const [, t] of text) for (const m of t.matchAll(/flags\.([a-z0-9_]+)\s*=|flags\[['"]([a-z0-9_]+)['"]\]\s*=/g)) engineSet.add(m[1] || m[2]);
for (const [f, where] of reads) if (!setFlags.has(f) && !engineSet.has(f)) problems.push(`플래그 ${f}: 읽지만 세우는 곳이 없음 (${[...where].join(', ')})`);
console.log(`이벤트 ${ALL_EVENTS.filter((e) => !e.removed).length}개 · 세우는 플래그 ${setFlags.size}개 · 읽는 플래그 ${reads.size}개 · 문제 ${problems.length}`);
if (problems.length) console.log(problems.join('\n'));
process.exitCode = problems.length ? 1 : 0;
