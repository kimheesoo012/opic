// 일본어 데이터 검사: 한국어 필드마다 일본어가 있는가, 문장 수가 맞는가(문장 단위 번역)
// 사용: node tools/ja-check.mjs [파일 이름]  (없으면 전부. 파일 이름을 주면 그 파일과 짝 일본어 파일만 따로 읽어 검사한다)
import { pathToFileURL } from 'url';
import path from 'path';
import { splitSentJa, splitSentKo } from '../src/engine/text.js';
import { attachJa } from '../src/data/ja/index.js';
const H = /[가-힣]/;
const only = process.argv.slice(2).filter((x) => !x.startsWith('--'));
let ALL_EVENTS, JA;
if (only.length) {
  ALL_EVENTS = [];
  JA = {};
  for (const f of only) {
    const ko = (await import(pathToFileURL(path.resolve('src/data', f + '.js')).href)).default;
    const ja = (await import(pathToFileURL(path.resolve('src/data/ja', f + '.js')).href)).default;
    const ids = new Set(ko.map((e) => e.id));
    for (const id of Object.keys(ja)) if (!ids.has(id)) console.log('없는 이벤트 id:', id);
    for (const e of ko) attachJa(e, ja[e.id]);
    Object.assign(JA, ja);
    ALL_EVENTS.push(...ko);
  }
} else {
  ({ ALL_EVENTS } = await import('../src/data/index.js'));
  ({ JA } = await import('../src/data/ja/all.js'));
}
// 자리표시({okami}, {N} …)가 한국어와 일본어에서 같은가
const holes = (t) => [...String(t).matchAll(/\{([A-Za-z]+)(?:\.[a-z]+|\|[^}]*)?\}/g)].map((m) => m[1]).sort().join(',');
const holeBad = [];
const hangulJa = [];
const missing = [];
const mismatch = [];
let pairs = 0;
const walk = (o, path) => {
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (k.endsWith('Ja') || ['lines', 'l', 'fx', 'req'].includes(k) || typeof v === 'function') continue;
    if (typeof v === 'string' && H.test(v)) {
      const ja = o[k + 'Ja'];
      if (ja == null) missing.push(path + '.' + k);
      else {
        pairs++;
        if (H.test(ja)) hangulJa.push(path + '.' + k);
        if (holes(v) !== holes(ja)) holeBad.push(`${path}.${k} 한[${holes(v)}] 일[${holes(ja)}]`);
        if (['text', 'res', 'poolEmpty'].includes(k)) {
          const a = splitSentKo(v).length, b = splitSentJa(ja).length;
          if (a !== b) mismatch.push(`${path}.${k} 한${a}/일${b}: ${ja.slice(0, 40)}`);
        }
      }
    } else if (Array.isArray(v) && ['text', 'res'].includes(k) && v.some((x) => x && x.v)) {
      const ja = o[k + 'Ja'];
      if (!ja) missing.push(path + '.' + k + '[]');
      else v.forEach((x, i) => { const kv = typeof x === 'string' ? x : x.v; const jv = typeof ja[i] === 'string' ? ja[i] : ja[i] && ja[i].v; pairs++; if (!jv) missing.push(`${path}.${k}[${i}]`); else if (splitSentKo(kv).length !== splitSentJa(jv).length) mismatch.push(`${path}.${k}[${i}]`); });
    } else if (k === 'ach' && Array.isArray(v)) {
      const list = Array.isArray(v[0]) ? v : [v];
      if (list.some((x) => H.test(x[1] || '')) && !o.achJa) missing.push(path + '.ach');
      else if (o.achJa) pairs++;
    } else if (k === 'news' && v && typeof v === 'object') {
      for (const r of Object.keys(v)) if (H.test(v[r]) && !(o.newsJa && o.newsJa[r])) missing.push(path + '.news.' + r);
      pairs += Object.keys(v).length;
    } else if (k === 'presets' && Array.isArray(v)) {
      if (!o.presetsJa || o.presetsJa.length !== v.length) missing.push(path + '.presets');
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}.${k}[${i}]`));
    else if (typeof v === 'object') walk(v, path + '.' + k);
  }
};
const files = new Map();
for (const e of ALL_EVENTS) {
  if (only.length && !only.some((f) => (e._file || '').includes(f) || JA[e.id] === undefined && false)) { /* 아래에서 거름 */ }
  walk(e, e.id);
}
const filt = (arr) => (only.length ? arr.filter((x) => only.some((f) => x.startsWith(f))) : arr);
console.log('번역 쌍', pairs, '· 빠진 곳', missing.length, '· 문장 수 다름', mismatch.length, '· 자리표시 다름', holeBad.length, '· 일본어에 한글', hangulJa.length);
if (holeBad.length) console.log(holeBad.slice(0, 40).join('\n'));
if (hangulJa.length) console.log(hangulJa.slice(0, 40).join('\n'));
if (process.argv.includes('--list')) console.log(missing.slice(0, 200).join('\n'));
console.log(mismatch.slice(0, 80).join('\n'));
void files; void filt;
