// N2 어휘·문법 DB 검사. 자동 검사는 「형식·중복·읽기 의심」만 잡는다. 통과해도 뜻·예문이 옳다는 보증은 아니다.
// 사용: node tools/n2-check.mjs [vocab_abstract …]   (없으면 전부)  --grammar 문법만
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const kuromoji = require('kuromoji');
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const H = /[가-힣]/;
const HIRA = /^[ぁ-ゖー]+$/;
const KATA = /^[ァ-ヶー・]+$/;
const kata2hira = (s) => (s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const args = process.argv.slice(2);
const only = args.filter((x) => !x.startsWith('--'));
const tok = await new Promise((res, rej) => kuromoji.builder({ dicPath: path.join(ROOT, 'node_modules/kuromoji/dict') }).build((e, t) => (e ? rej(e) : res(t))));

// 기존 어휘(게임용)와 기존 문법
const { GENERAL_VOCAB } = await import(pathToFileURL(path.join(ROOT, 'src/data/vocab_general.js')).href);
const { N2_VOCAB } = await import(pathToFileURL(path.join(ROOT, 'src/data/vocab_n2.js')).href);
const { KENDO_VOCAB } = await import(pathToFileURL(path.join(ROOT, 'src/data/vocab_kendo.js')).href);
const OLD = { ...GENERAL_VOCAB, ...N2_VOCAB, ...KENDO_VOCAB };
const { GRAMMAR } = await import(pathToFileURL(path.join(ROOT, 'src/data/grammar.js')).href);
let NEWG = {};
try { NEWG = (await import(pathToFileURL(path.join(ROOT, 'src/data/n2/grammar_more.js')).href)).default; } catch { /* 아직 없음 */ }
const ALLG = { ...GRAMMAR, ...NEWG };

const POS = new Set(['n', 'sn', 'v', 'a', 'na', 'adv', 'exp', 'kata']);
const FILES = ['abstract', 'society', 'work', 'life', 'verbs', 'adverbs', 'kata', 'confuse'];
const err = [];
const warn = [];
const seen = new Map();
let total = 0;

// 예문 속에서 표제어가 나온 자리의 읽기 (활용형이면 어간까지만 비교)
function readingInSentence(key, r, ex) {
  const toks = tok.tokenize(ex);
  // 기본형이 표제어인 토큰
  const hit = toks.find((t) => t.basic_form === key);
  if (hit) {
    if (!hit.reading) return null;
    const rd = kata2hira(hit.reading);
    if (hit.surface_form === key) return rd === r ? null : rd;
    // 활용: 읽기 앞부분 비교 (끝 한 글자 빼고)
    const stem = r.slice(0, Math.max(1, r.length - 1));
    return rd.startsWith(stem.slice(0, Math.max(1, stem.length - 1))) ? null : rd;
  }
  // 여러 토큰으로 쪼개진 복합어: 표면이 이어지는 구간의 읽기
  const sf = toks.map((t) => t.surface_form);
  for (let i = 0; i < toks.length; i++) {
    let s = '';
    let rd = '';
    for (let j = i; j < toks.length && s.length < key.length + 3; j++) {
      s += sf[j];
      rd += kata2hira(toks[j].reading || toks[j].surface_form);
      if (s === key) return rd === r ? null : rd;
    }
  }
  return undefined; // 못 찾음
}

function keyReading(key) {
  return tok.tokenize(key).map((t) => kata2hira(t.reading || t.surface_form)).join('');
}

if (!args.includes('--grammar')) {
  for (const f of FILES) {
    if (only.length && !only.some((x) => x.replace('vocab_', '') === f)) continue;
    const rows = (await import(pathToFileURL(path.join(ROOT, `src/data/n2/vocab_${f}.js`)).href)).default;
    for (const [i, row] of rows.entries()) {
      total++;
      const at = `${f}#${i} ${row[0]}`;
      if (!Array.isArray(row) || row.length < 6) { err.push(`${at}: 칸 수`); continue; }
      const [key, r, pos, m, ex, exk, x = {}] = row;
      if (!POS.has(pos)) err.push(`${at}: 품사 ${pos}`);
      if (!(HIRA.test(r) || (pos === 'kata' && KATA.test(r)))) err.push(`${at}: 읽기 형식 ${r}`);
      if (!H.test(m)) err.push(`${at}: 뜻에 한국어 없음`);
      if (!H.test(exk)) err.push(`${at}: 예문 해석에 한국어 없음`);
      if (H.test(ex) || !/[。？！]$/.test(ex)) err.push(`${at}: 예문 형식`);
      if (seen.has(key)) err.push(`${at}: 중복 (${seen.get(key)})`);
      seen.set(key, at);
      if (OLD[key]) warn.push(`${at}: 기존 어휘에 이미 있음 (게임 어휘가 우선)`);
      for (const k of ['syn', 'ant', 'conf', 'gram']) if (x[k] && !Array.isArray(x[k])) err.push(`${at}: ${k} 형식`);
      for (const g of x.gram || []) if (!ALLG[g]) warn.push(`${at}: 관련 문법 ${g} 없음`);
      // 예문에 표제어(또는 활용형)가 들어 있는가
      const stem = pos === 'v' || pos === 'a' ? key.slice(0, -1) : pos === 'na' ? key : key;
      if (!ex.includes(stem)) err.push(`${at}: 예문에 표제어 없음`);
      // 읽기: 형태소 분석과 다른 것은 「확인 필요」 (분석기가 틀릴 수도 있다)
      if (pos !== 'kata') {
        const kr = keyReading(key);
        const inEx = readingInSentence(key, r, ex);
        if (kr !== r && inEx !== null) warn.push(`${at}: 읽기 확인 필요 데이터=${r} 분석=${kr}${inEx ? ' 예문=' + inEx : ''}`);
      }
    }
  }
}

if (!only.length || args.includes('--grammar')) {
  const CN = new Set(['noun', 'masu', 'nai', 'te', 'ta', 'dict', 'plain']);
  for (const [k, g] of Object.entries(NEWG)) {
    const at = `grammar ${k}`;
    if (GRAMMAR[k] && !GRAMMAR[k].x) err.push(`${at}: 기존 문법과 중복`);
    for (const f of ['f', 'm', 'c', 'd', 'use', 'style', 'err']) if (!g[f]) err.push(`${at}: ${f} 없음`);
    if (!Array.isArray(g.cn) || !g.cn.length || g.cn.some((c) => !CN.has(c))) err.push(`${at}: cn(접속 분류) 형식`);
    if (!Array.isArray(g.ex) || g.ex.length < 2 || g.ex.some((e) => !Array.isArray(e) || H.test(e[0]) || !H.test(e[1]))) err.push(`${at}: ex 예문 2개 이상 [일, 한]`);
    const q = g.q;
    if (!Array.isArray(q) || q.length < 4 || !q[0].includes('＿＿') || !Array.isArray(q[2]) || q[2].length !== 3 || q[2].includes(q[1])) err.push(`${at}: q 형식`);
    if (g.qx && (!Array.isArray(g.qx) || g.qx.length !== 3)) err.push(`${at}: qx(오답별 해설) 3개`);
    if (!g.qx) err.push(`${at}: qx(오답별 해설) 없음`);
    for (const n of g.near || []) if (!ALLG[n]) warn.push(`${at}: near ${n} 없음`);
    total++;
  }
}
console.log(`검사 ${total}개 · 오류 ${err.length} · 확인 필요 ${warn.length}`);
if (err.length) console.log(err.slice(0, 150).join('\n'));
if (warn.length && !args.includes('--quiet')) console.log(warn.slice(0, 200).join('\n'));
