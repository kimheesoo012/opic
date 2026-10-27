// N2 문제은행 검사: 형식 · 참조 · 정답 위치 분포 · 읽기/표기(형태소 분석과 대조) · 並べ替え 순서.
// 「정답이 하나뿐인가」「오답이 그럴듯한가」는 자동으로 판정할 수 없다 → 사람이 읽어야 한다 (보고서에 따로 적는다).
// 사용: node tools/bank-check.mjs [bank_vocab_a …]
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const kuromoji = require('kuromoji');
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const imp = async (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { VOCAB } = await imp('src/data/vocab.js');
const { GRAMMAR } = await imp('src/data/grammar.js');
const { BANK_TYPES } = await imp('src/data/n2/bank.js');
const tok = await new Promise((res, rej) => kuromoji.builder({ dicPath: path.join(ROOT, 'node_modules/kuromoji/dict') }).build((e, t) => (e ? rej(e) : res(t))));
const k2h = (s) => (s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const readOf = (s) => tok.tokenize(s).map((t) => k2h(t.reading || t.surface_form)).join('');
const H = /[가-힣]/;
const HIRA = /^[ぁ-ゖー]+$/;
const only = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const files = only.length ? only : ['bank_vocab_a', 'bank_vocab_b', 'bank_grammar'];
const err = [];
const warn = [];
const ids = new Set();
const dist = {};
const count = {};
for (const f of files) {
  const mod = await imp(`src/data/n2/${f}.js`);
  const items = mod.default;
  const PASS = mod.PASSAGES || {};
  for (const q of items) {
    const at = `${f} ${q.id}`;
    if (!q.id || ids.has(q.id)) err.push(`${at}: id 중복/없음`);
    ids.add(q.id);
    if (!BANK_TYPES[q.type]) { err.push(`${at}: 유형 ${q.type}`); continue; }
    count[q.type] = (count[q.type] || 0) + 1;
    dist[q.type] = dist[q.type] || [0, 0, 0, 0];
    const n = q.opts && q.opts.length;
    if (n !== 4) err.push(`${at}: 선택지 ${n}개`);
    if (new Set(q.opts).size !== n) err.push(`${at}: 같은 선택지`);
    if (!(q.a >= 0 && q.a < n)) err.push(`${at}: 정답 번호`);
    else dist[q.type][q.a]++;
    if (!Array.isArray(q.why) || q.why.length !== n || q.why.some((w) => !H.test(w))) err.push(`${at}: why(선택지별 한국어 해설) ${q.why && q.why.length}`);
    if (!H.test(q.ko || '')) err.push(`${at}: ko 해석 없음`);
    if (H.test(q.q) || q.opts.some((o) => H.test(o))) err.push(`${at}: 일본어 칸에 한글`);
    for (const r of q.ref || []) {
      const ok = r[0] === 'v' ? VOCAB[r.slice(2)] : r[0] === 'g' ? GRAMMAR[r.slice(2)] : null;
      if (!ok) warn.push(`${at}: ref ${r} 없음`);
    }
    if (!(q.ref || []).length && !['bunsho'].includes(q.type)) warn.push(`${at}: ref 없음`);
    const under = (q.q.match(/〔([^〕]+)〕/) || [])[1];
    const ans = q.opts[q.a];
    if (q.type === 'kanji') {
      if (!under) err.push(`${at}: 〔밑줄〕 없음`);
      else {
        if (!q.opts.every((o) => HIRA.test(o))) err.push(`${at}: 읽기 선택지가 히라가나가 아님`);
        const v = VOCAB[under];
        if (v && v.r !== ans) err.push(`${at}: 정답 ${ans} ≠ DB 읽기 ${v.r}`);
        const kr = readOf(under);
        if (kr !== ans) warn.push(`${at}: 읽기 확인 ${under} 정답=${ans} 분석=${kr}`);
        for (const o of q.opts) if (o !== ans && Object.entries(VOCAB).some(([k, x]) => x.r === o && k === under)) err.push(`${at}: 오답 ${o}도 그 말의 읽기`);
      }
    }
    if (q.type === 'hyoki') {
      if (!under || !HIRA.test(under)) err.push(`${at}: 〔ひらがな〕 밑줄 없음`);
      else {
        const v = VOCAB[ans];
        if (v && v.r !== under) err.push(`${at}: 정답 ${ans}의 DB 읽기 ${v.r} ≠ 밑줄 ${under}`);
        const kr = readOf(ans);
        if (kr !== under) warn.push(`${at}: 표기 확인 ${under} 정답=${ans} 분석=${kr}`);
        for (const o of q.opts) if (o !== ans && VOCAB[o] && VOCAB[o].r === under) err.push(`${at}: 오답 ${o}도 같은 읽기의 실제 말`);
      }
    }
    if (q.type === 'iikae' && !under) err.push(`${at}: 〔밑줄〕 없음`);
    if (['bunmyaku', 'bunpo', 'kaiwa'].includes(q.type) && !/（\s*）|（　+）/.test(q.q)) err.push(`${at}: （　） 빈칸 없음`);
    if (q.type === 'yoho' && q.opts.some((o) => !/[。？！]$/.test(o))) warn.push(`${at}: 용법 선택지가 문장이 아님`);
    if (q.type === 'narabe') {
      const slots = (q.q.match(/＿＿|★/g) || []);
      const star = slots.indexOf('★');
      if (slots.length !== 4 || star < 0) err.push(`${at}: ＿＿×3 + ★ 이 아님`);
      if (!Array.isArray(q.order) || q.order.length !== 4 || new Set(q.order).size !== 4) err.push(`${at}: order`);
      else {
        if (q.opts[q.order[star]] !== ans) err.push(`${at}: ★자리(${q.opts[q.order[star]]}) ≠ 정답(${ans})`);
        let i = 0;
        const built = q.q.replace(/＿＿|★/g, () => q.opts[q.order[i++]]).replace(/\s|　/g, '');
        if (q.full && built !== q.full.replace(/\s|　/g, '')) err.push(`${at}: 조립 문장 ≠ full\n   ${built}\n   ${q.full}`);
        if (!q.full) err.push(`${at}: full 없음`);
      }
    }
    if (q.type === 'bunsho') {
      if (!q.pid || !PASS[q.pid]) err.push(`${at}: 지문 ${q.pid} 없음`);
      else if (!PASS[q.pid].text.includes(q.q.match(/（\s*\d+\s*）/)?.[0] || '★')) warn.push(`${at}: 지문에 빈칸 번호 ${q.q}`);
    }
  }
  for (const [pid, p] of Object.entries(PASS)) if (H.test(p.text) || !H.test(p.ko || '')) err.push(`${f} 지문 ${pid}: 형식`);
}
console.log('문제', ids.size, JSON.stringify(count));
console.log('정답 위치 분포', JSON.stringify(dist));
console.log(`오류 ${err.length} · 확인 필요 ${warn.length}`);
if (err.length) console.log(err.slice(0, 120).join('\n'));
if (warn.length && !process.argv.includes('--quiet')) console.log(warn.slice(0, 150).join('\n'));
