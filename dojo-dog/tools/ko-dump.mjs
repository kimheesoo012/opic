// 번역 작업표: 데이터 파일 하나의 한국어를 일본어 데이터(src/data/ja/*.js)와 같은 모양으로 뽑는다.
// 사용: node tools/ko-dump.mjs cast_shihan  → 표준 출력
import { pathToFileURL } from 'url';
import path from 'path';

const H = /[가-힣]/;
const name = process.argv[2];
const mod = await import(pathToFileURL(path.resolve('src/data', name + '.js')).href);
const events = mod.default;

// 한국어가 든 필드만 남긴다 (같은 모양)
function pick(o) {
  if (typeof o === 'string') return H.test(o) ? o : undefined;
  if (Array.isArray(o)) {
    const arr = o.map((x) => (x && typeof x === 'object' && !Array.isArray(x) && 'v' in x ? pick(x.v) : pick(x)));
    return arr.some((x) => x !== undefined) ? arr : undefined;
  }
  if (o && typeof o === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(o)) {
      if (['lines', 'l', 'if', 'req', 'fx', 'set', 'unset', 'tag', 'id', 'cat', 'who', 'later', 'next', 'pool', 'cnt', 'risk', 'mini', 'clear', 'foil', 'check_st'].includes(k)) continue;
      if (typeof v === 'function') continue;
      const p = pick(v);
      if (p !== undefined) r[k] = p;
    }
    return Object.keys(r).length ? r : undefined;
  }
  return undefined;
}

const lit = (v, ind = '') => {
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  if (v === undefined) return 'null';
  if (Array.isArray(v)) {
    // [역할, 문장] 꼴(ach)은 한 줄로
    if (v.length === 2 && typeof v[0] === 'string' && !H.test(v[0])) return '[' + v.map((x) => lit(x)).join(', ') + ']';
    if (v.every((x) => typeof x === 'string' || x === undefined) && v.join('').length < 60) return '[' + v.map((x) => lit(x)).join(', ') + ']';
    return '[\n' + v.map((x) => ind + '  ' + lit(x, ind + '  ')).join(',\n') + ',\n' + ind + ']';
  }
  return '{ ' + Object.entries(v).map(([k, x]) => k + ': ' + lit(x, ind + '  ')).join(', ') + ' }';
};

for (const e of events) {
  const p = pick(e);
  if (!p) continue;
  const lines = (e.lines || []).filter(Array.isArray).map((l) => l[0] + ':' + l[1].replace(/\[([^\]|]+)(\|[^\]]*)?\]/g, '$1').replace(/〘([^|]+)\|[^〙]+〙/g, '$1')).join(' / ');
  console.log(`  // ${lines.slice(0, 160)}`);
  console.log(`  ${e.id}: {`);
  for (const [k, v] of Object.entries(p)) {
    if (k === 'choices') {
      console.log('    choices: [');
      for (const c of v) console.log('      ' + (c ? lit(c, '      ') : 'null') + ',');
      console.log('    ],');
    } else console.log(`    ${k}: ${lit(v, '    ')},`);
  }
  console.log('  },');
}
