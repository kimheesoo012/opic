// 글 품질 검사 (docs/STYLE.md): 지저분한 표현, 검도 전문 용어 과다, 오글거리는 상투구, 직역 대명사,
// N2 항목이 없는 장면, 없는 문법 키, 너무 긴 선택지.
// 사용: node tools/style-check.mjs [파일 이름 …]  (없으면 전부)  --all 경고 없는 이벤트도 표시
import { pathToFileURL } from 'url';
import path from 'path';
import { attachJa } from '../src/data/ja/index.js';
import { VOCAB } from '../src/data/vocab.js';
import { GRAMMAR } from '../src/data/grammar.js';

const args = process.argv.slice(2);
const files = args.filter((x) => !x.startsWith('--'));
const ALL = [
  'cast_elder', 'cast_kid', 'cast_kor', 'cast_okami', 'cast_roshi', 'cast_shihan', 'cast_worker',
  'chains', 'core_events', 'daily_beside', 'daily_life', 'daily_life2', 'daily_walk', 'iincho', 'kendo', 'subs',
];

// 검도 전문 용어: 이야기 이해에 꼭 필요하지 않으면 일상어로 바꾼다 (竹刀·防具·面·小手·胴·稽古·試合·大会·審査·段·礼·素振り·一本은 기본어로 허용)
const KENDO = ['元立ち', '打ち込み', '切り返し', '地稽古', '掛かり稽古', '蹲踞', '残心', '攻め', '出ばな', '気剣体一致', '打突', '中段', '上段', '鍔迫り', '引き面', '引き胴', '抜き胴', '返し胴', 'すり足', '踏み込み', '足さばき', '間合い', '剣先', '一足一刀', '合議', '日本剣道形', '太刀', '先革', '垂れ', '胴紐', '面紐', '見取り稽古', '構え', '正眼', '発声', '気合', '残身', '捨て身', '相面', '面返し'];
const GROSS = [/臭/, /くさい/, /酸っぱ/, /よだれ/, /唾/, /吐/, /うんち/, /おしっこ/, /鼻水/, /げっぷ/, /おなら/, /냄새나/, /시큼/, /구린/, /구리다/, /(^|[^아])침이 /, /(^|[^아])침에 /, /침 범벅/, /땀 냄새/, /똥/, /오줌/, /토했/, /토하/, /콧물/, /방귀/, /발 냄새/];
const CRINGE = [/베테랑/, /ベテラン/, /노련한 개/, /웃음이 번/, /笑いが広が/, /(모두|다들) (웃었|박수)/, /みんな(が)?(笑|拍手)/, /사냥개/, /猟犬/, /제일 좋은 냄새/, /いちばんいいにおい/, /깨달았다/, /気づいたのだ/, /배웠다\./, /소중한 것/, /大切なこと/, /마음이 (따뜻|뭉클)/, /心が温/, /그것이 .*것을/, /のだった。$/];
const PRONOUN = [/그는 /, /그녀/, /그의 /, /彼の/, /彼女/, /당신/];

const N2V = Object.keys(VOCAB).filter((k) => VOCAB[k].lv === 'N2' && k.length >= 2);
const plainJa = (t) => String(t || '').replace(/\[([^\]|]+)(\|[^\]]*)?\]/g, '$1').replace(/〘([^|〙]+)\|[^〙]*〙/g, '$1').replace(/〔([^:〕]+):[^〕]*〕/g, '$1');

const out = [];
let total = 0;
let noN2 = 0;
const counts = { gross: 0, kendo: 0, cringe: 0, pronoun: 0, gkey: 0, long: 0 };
for (const f of files.length ? files : ALL) {
  const ko = (await import(pathToFileURL(path.resolve('src/data', f + '.js')).href)).default;
  const ja = (await import(pathToFileURL(path.resolve('src/data/ja', f + '.js')).href)).default;
  for (const e of ko) {
    if (e.removed) continue;
    attachJa(e, ja[e.id]);
    total++;
    const jaTexts = [];
    const koTexts = [];
    const gkeys = [];
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o) && typeof o[0] === 'string' && typeof o[1] === 'string' && o.length === 3) {
        jaTexts.push(plainJa(o[1]));
        koTexts.push(o[2]);
        for (const m of o[1].matchAll(/〘[^|〙]+\|([^〙]+)〙/g)) gkeys.push(m[1]);
        return;
      }
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'function') continue;
        if (typeof v === 'string') {
          if (k.endsWith('Ja')) jaTexts.push(plainJa(v));
          else if (/[가-힣]/.test(v)) koTexts.push(v);
        } else walk(v);
      }
    };
    walk(e);
    const jaAll = jaTexts.join('\n');
    const koAll = koTexts.join('\n');
    const warn = [];
    for (const re of GROSS) if (re.test(jaAll) || re.test(koAll)) { warn.push('지저분: ' + re.source); counts.gross++; }
    const kh = KENDO.filter((t) => jaAll.includes(t));
    const koTerms = (koAll.match(/《[^》]+》/g) || []).length;
    if (kh.length >= 2 || koTerms >= 3) { warn.push(`검도 용어: ${kh.join('·')}${koTerms ? ` (한국어 《》 ${koTerms}개)` : ''}`); counts.kendo++; }
    for (const re of CRINGE) if (re.test(jaAll) || re.test(koAll)) { warn.push('상투구: ' + re.source); counts.cringe++; }
    for (const re of PRONOUN) if (re.test(jaAll) || re.test(koAll)) { warn.push('직역 대명사: ' + re.source); counts.pronoun++; }
    for (const k of gkeys) if (!GRAMMAR[k]) { warn.push('없는 문법 키: ' + k); counts.gkey++; }
    const hasN2 = gkeys.some((k) => GRAMMAR[k] && ['N2', 'N1'].includes(GRAMMAR[k].lv)) || N2V.some((k) => jaAll.includes(k));
    if (!hasN2) { warn.push('N2 항목 없음'); noN2++; }
    for (const c of e.choices || []) if (c.t && c.t.length > 24) { warn.push(`긴 선택지(${c.t.length}자): ${c.t}`); counts.long++; }
    if (warn.length || args.includes('--all')) out.push(`${f} ${e.id}: ${warn.join(' / ') || 'OK'}`);
  }
}
console.log(out.join('\n'));
console.log(`\n이벤트 ${total}개 · N2 항목 없음 ${noN2}개 (${Math.round((noN2 / total) * 100)}%) · 지저분 ${counts.gross} · 검도 용어 과다 ${counts.kendo} · 상투구 ${counts.cringe} · 직역 대명사 ${counts.pronoun} · 없는 문법 키 ${counts.gkey} · 긴 선택지 ${counts.long}`);
