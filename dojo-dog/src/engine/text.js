// 텍스트 템플릿.
//  {key} {key.prop} {key|조사}  : 자리표시자 (개 이름 N, 이전 견 P, 마을 T, 상점가 S, 신사 SH, 강 RV, 도장 D, 역할 이름, 화자 1인칭 I)
//  [표기|어휘키] 또는 [어휘키]   : 일본어 대사 안의 학습 단어 (밑줄)
//  《표기|어휘키》 또는 《어휘키》 : 한국어 해설 안의 일본어 용어 (검도 용어 등)
import { personFor, PEOPLE, PROMOTE, ROLES, ROLE_KO, ROLE_JA } from './world.js';
import { CONTINUED_JA } from '../data/ja/misc.js';
import { KIND, PARTS, PART_KEYS, PERSON_PARTS, PLACES, CONTINUED_KO, JA, KO, KID_STAGE, DOJO_LABEL_CONT } from '../data/proper.js';

const JOSA = {
  은: ['은', '는'], 는: ['은', '는'], 이: ['이', '가'], 가: ['이', '가'], 을: ['을', '를'], 를: ['을', '를'],
  과: ['과', '와'], 와: ['과', '와'], 아: ['아', '야'], 야: ['아', '야'], 이랑: ['이랑', '랑'], 랑: ['이랑', '랑'],
  으로: ['으로', '로'], 로: ['으로', '로'], 이에요: ['이에요', '예요'], 이라고: ['이라고', '라고'], 라고: ['이라고', '라고'], 예요: ['이에요', '예요'], 이나: ['이나', '나'], 나: ['이나', '나'],
  이다: ['이다', '다'], 다: ['이다', '다'], 이었다: ['이었다', '였다'], 였다: ['이었다', '였다'], 이의: ['의', '의'], 의: ['의', '의'],
};

export function josa(word, j) {
  const pair = JOSA[j];
  if (!pair) return word + j;
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return word + pair[0] + '(' + pair[1] + ')';
  const bat = (ch - 0xac00) % 28;
  if (j === '으로' || j === '로') return word + (bat === 0 || bat === 8 ? '로' : '으로');
  return word + (bat ? pair[0] : pair[1]);
}

const PH = /\{([A-Za-z]+)(?:\.([a-z]))?(?:\|([^}]+))?\}/g;

export function lookup(key, prop, ctx, lang) {
  const s = ctx.s;
  const w = s.world;
  const ko = lang === 'ko';
  switch (key) {
    case 'N': return ko ? s.dog.nameKo : s.dog.name;
    case 'P': return ko ? (s.prevDog ? s.prevDog.nameKo : '선대') : (s.prevDog ? s.prevDog.name : '先代');
    case 'T': return ko ? w.region.townKo : w.region.town;
    case 'S': return ko ? w.region.streetKo : w.region.street;
    case 'SH': return ko ? w.region.shrineKo : w.region.shrine;
    case 'RV': return ko ? w.region.riverKo : w.region.river;
    case 'D': return ko ? w.dojoNameKo : w.dojoName;
    case 'BG': return ko ? w.dojo.bgKo : w.dojo.bg;
    case 'Y': return String(w.yearsLater || 0);
    case 'I': {
      const sp = ctx.speaker && s.cast[ctx.speaker] ? personFor(s.cast, ctx.speaker) : null;
      return sp ? sp.I : '私';
    }
    case 'iincho': return ko ? '위원장' : '委員長';
    default: {
      if (!s.cast[key]) return '{' + key + '}';
      const p = personFor(s.cast, key);
      if (ko) return prop === 's' ? p.ks || p.ko : p.ko;
      if (prop === 'g') return p.g;
      if (prop === 's') return p.s || p.g;
      if (prop === 'c') return p.c;
      if (prop === 'f') return p.s ? (/^[ァ-ヶー]+$/.test(p.s) ? p.s + '・' + p.g : p.s + ' ' + p.g) : p.g;
      return p.call;
    }
  }
}

// 한국어 해설: 자리표시자를 풀고, 《용어》는 그대로 둔다 (UI가 처리)
export function resolveKo(tpl, ctx) {
  if (!tpl) return '';
  return tpl.replace(PH, (_, key, prop, j) => {
    const v = lookup(key, prop, ctx, 'ko');
    return j ? josa(v, j) : v;
  });
}

// 일본어 템플릿을 조각으로 나눈다. 루비 생성 도구와 UI가 같은 규칙을 쓴다.
// 반환: [{k:'t', v}, {k:'p', key, prop}, {k:'v', v, key}]
export function splitJa(tpl) {
  const out = [];
  const re = /\{([A-Za-z]+)(?:\.([a-z]))?\}|\[([^\]|]+)(?:\|([^\]]+))?\]|〘([^|〙]+)\|([^〙]+)〙/g;
  let last = 0;
  let m;
  while ((m = re.exec(tpl))) {
    if (m.index > last) out.push({ k: 't', v: tpl.slice(last, m.index) });
    if (m[1]) out.push({ k: 'p', key: m[1], prop: m[2] });
    else if (m[5]) out.push({ k: 'g', v: m[5], key: m[6] });
    else out.push({ k: 'v', v: m[3], key: m[4] || m[3] });
    last = re.lastIndex;
  }
  if (last < tpl.length) out.push({ k: 't', v: tpl.slice(last) });
  return out;
}

export function parseJa(tpl, ctx) {
  return splitJa(tpl).map((seg) => (seg.k === 'p' ? { k: 'n', v: lookup(seg.key, seg.prop, ctx, 'ja') } : seg));
}

export function plainJa(tpl, ctx) {
  return parseJa(tpl, ctx).map((x) => x.v).join('').replace(/〔([^:〕]+):[^〕]+〕/g, '$1');
}

// 문장 나누기: 번역을 문장 단위로 보이기 위해 일본어와 한국어를 같은 규칙으로 나눈다.
// 일본어: 괄호(「」『』（）) 밖의 。！？ 뒤, 「…。」처럼 문장 끝 부호로 닫힌 괄호 뒤, 줄바꿈에서 나눈다.
export function splitSentJa(text) {
  const out = [];
  let buf = '';
  let depth = 0;
  const t = String(text || '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '\n') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += c;
    if ('「『（'.includes(c)) depth++;
    else if ('」』）'.includes(c)) {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && '。！？'.includes(t[i - 1]) && !'。、」とっ'.includes(t[i + 1] || '')) {
        out.push(buf.trim());
        buf = '';
      }
    } else if (depth === 0 && (c === '。' ? !'！？。」』）…'.includes(t[i + 1] || '') : '！？'.includes(c) && /^(　|「|$)/.test(t[i + 1] || ''))) {
      out.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.map((x) => x.replace(/^　+/, ''));
}
// 한국어: 문장 끝 부호(.!?…) 뒤의 빈칸, 「…」로 닫힌 문장 뒤의 빈칸, 줄바꿈에서 나눈다.
export function splitSentKo(text) {
  return String(text || '')
    .split(/\n|(?<=[.!?…]」?)\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// 한국어 해설 속 《용어》 조각
export function splitKo(text) {
  const out = [];
  const re = /《([^》|]+)(?:\|([^》]+))?》/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ k: 't', v: text.slice(last, m.index) });
    out.push({ k: 'v', v: m[1], key: m[2] || m[1] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ k: 't', v: text.slice(last) });
  return out;
}

export function plainKo(text) {
  return splitKo(text).map((x) => x.v).join('');
}

// 이름·지명 읽기 (자리표시자 값에 루비를 달 때 사용)
export const NAME_READ = {
  鷲尾: 'わしお', 源一郎: 'げんいちろう', 坂上: 'さかがみ', 誠: 'まこと', 千春: 'ちはる', 森川: 'もりかわ', 三浦: 'みうら',
  健司: 'けんじ', 松尾: 'まつお', 先生: 'せんせい', 小野寺: 'おのでら', 陽太: 'ようた', 水野: 'みずの', 中村: 'なかむら', 浩平: 'こうへい', 中島: 'なかじま',
  野村: 'のむら', 拓海: 'たくみ', 大塚: 'おおつか', 朝倉: 'あさくら', 委員長: 'いいんちょう',
  灯心館: 'とうしんかん', 剣友会: 'けんゆうかい', 剣道場: 'けんどうじょう', 町: 'ちょう', 村: 'むら', 銀座: 'ぎんざ',
  通り: 'どおり', 稲荷: 'いなり', 天神: 'てんじん', 八幡: 'はちまん', 神社: 'じんじゃ', 鎮守: 'ちんじゅ', 森: 'もり',
  川: 'がわ', 浜: 'はま', 太: 'た', 子: 'こ', 私: 'わたし', 俺: 'おれ', 僕: 'ぼく', 先代: 'せんだい', 元: 'もと',
  県警: 'けんけい', 特練員: 'とくれんいん', 一番弟子: 'いちばんでし', 小学校: 'しょうがっこう', 鷲尾先生: 'わしおせんせい',
};
const NAME_KEYS = Object.keys(NAME_READ).sort((a, b) => b.length - a.length);

// 이름 문자열을 [표기, 읽기] / 문자열 조각으로
export function rubyName(str) {
  const out = [];
  let i = 0;
  let buf = '';
  while (i < str.length) {
    const k = NAME_KEYS.find((key) => str.startsWith(key, i));
    if (k && /[一-鿿]/.test(k)) {
      if (buf) out.push(buf), (buf = '');
      out.push([k, NAME_READ[k]]);
      i += k.length;
    } else {
      buf += str[i++];
    }
  }
  if (buf) out.push(buf);
  return out;
}

// 쉬운 한자(대략 N5~N4). 이 집합 밖의 한자가 들어간 단어에만 「어려운 한자만」 모드에서 후리가나를 단다.
const BASIC =
  '日一国人年大十二本中長出三時行見月後前生五間上東四今金九入学高円子外八六下来気小七山話女北午百書先名川千水半男西電校語土木聞食車何南万毎白天母火右読友左休父雨' +
  '会同事自社発者地業方新場員立開手力問代明動京目通言理体田主題意不作用度強公持野以思家世多正安院心界教文元重近考画海売知道集別物使品計死特私始朝運終台広住真有口少町料工建空急止送切転研足究楽起着店病質待試族銀早映親験英医仕去味写字答夜音注帰古歌買悪図週室歩風紙黒花春赤青館屋色走秋夏習駅洋旅服夕借曜飲肉貸堂鳥飯勉冬昼茶弟牛魚兄犬妹姉漢';
const BASIC_SET = new Set(BASIC + '暑軽池');
// N3 수준으로 흔히 묶이는 한자 (추정). 이 밖의 한자가 들어간 말은 N2 이상으로 본다.
const N3K =
  '政議民連対部合市内相定回選米実関決全表戦経最現調化当約首法性要制治務成期取都和機平加受続進数記初指権支産点報済活原共得解交資予向際勝面告反判認参利組信在件側任引求所次昨論官増係感情投示変打直両式確果容必演歳争談能位置流格疑過局放常状球職与供役構割費付由説難優夫収断石違消神番規術備宅害配警育席訪乗残想声念助労例然限追商葉伝働形景落好退頭負渡失差末守若種美命福望非観察段横深申様財港識呼達良候程満敗値突光路科積他処太客否師登易速存飛殺号単座破除完降責捕危給苦迎園具辞因馬愛富彼未舞亡冷適婦寄込顔類余王返妻背熱宿薬険頼覚船途許抜便留罪努精散静婚喜浮絶幸押倒等老曲払庭徒勤遅居雑招困欠更刻賛抱犯恐息遠戻願絵越欲痛笑互束似列探逃遊迷夢君閉緒折草暮酒悲晴掛到寝暗盗吸陽御歯忘雪吹娘誤洗慣礼窓昔貧怒泳祖杯疲皆鳴腹煙眠怖耳頂箱晩寒髪忙才靴恥偶偉猫幾練習族準備緊張階段濡汗泣震怪我丁寧般暖温焼泊算線星雲谷岩角羽弓矢黄汽刀丸毛戸図鳥麦貝虫竹糸林森畑島湖橋坂皿筆板笛荷湯泉氷波岸陸緑根植農貨鉄器械寺詩章級守由球坂幸福礼練習祭笛勝負箱橋柱泳登局区県府郡駅都道僕誰鼻甘豆血菜傘呂普匹冊号票鍋丼綺麗弱骨芋袋殴汚怒叱喧嘩嫌笑泣歳頃奥様娘息孫姪甥伯叔婆爺坊嬢猫鳩蝉蛙鴨狐狸亀蛇蜂蟻虫菓餅飴麺粉塩糖酢油汁丼皿椀箸匙瓶缶袋箱紐縄釘鍵錠扉棚机椅布団枕畳襖障';
// 흔한 N3 수준 한자 중 위 목록에서 빠져 있던 것 (전수 검토에서 추가)
const N3K_MORE = '簡健康絡厳狭授掃桜興秒薄歴域省護松監督接駐伸乾修刑案候挙研症巻整個依節価司基挑';
const N3K_SET = new Set(N3K + N3K_MORE);
// 사전에 없는 말의 수준 추정: 한자가 모두 기초(N5·N4) → 4, N3까지 → 3, 그 밖 → 2(N2 이상)
// extra: 더 쉬운 한자로 볼 집합 (생성기가 사전의 N3 이하 낱말에서 모은다)
export function kanjiLevel(word, extra = null) {
  let lv = 4;
  for (const ch of word) {
    if (!/[一-鿿]/.test(ch) || BASIC_SET.has(ch)) continue;
    if (N3K_SET.has(ch) || (extra && extra.has(ch))) lv = Math.min(lv, 3);
    else return 2;
  }
  return lv;
}
export function isHardKanji(base) {
  for (const ch of base) if (/[一-鿿]/.test(ch) && !BASIC_SET.has(ch)) return true;
  return false;
}

// ───── 고유명사 풀이 (점선을 눌렀을 때) ─────
// 점선을 긋지 않는 자리표시자: 화자의 1인칭(私·俺·僕…), 숫자, 개 이름, 도장 사범의 이력 문구
export const NAME_PLAIN = new Set(['I', 'Y', 'N', 'BG']);
const PLACE_KEYS = { D: 'dojo', T: 'town', S: 'street', SH: 'shrine', RV: 'river', P: 'prevdog' };

// 이름 전체의 읽기 (한자 조각은 NAME_READ 읽기, 가나는 그대로)
export function nameReading(str) {
  return rubyName(String(str || ''))
    .map((x) => (Array.isArray(x) ? x[1] : x))
    .join('');
}

// 이름 속 뜻이 있는 조각 (剣友会·町·通り·稲荷…). 사람 이름에서는 호칭(先生·さん…)만.
export function nameParts(value, person = false) {
  const out = [];
  const v = String(value || '');
  for (let i = 0; i < v.length; ) {
    const k = PART_KEYS.find((x) => v.startsWith(x, i) && (!person || PERSON_PARTS.has(x)));
    if (!k) {
      i++;
      continue;
    }
    if (!out.some((x) => x.w === k)) out.push({ w: k, r: PARTS[k][0], ko: PARTS[k][1] });
    i += k.length;
  }
  return out;
}

const fullName = (p) => (p.s && p.g ? (/^[ァ-ヶー]+$/.test(p.s) ? `${p.s}・${p.g}` : `${p.s}${p.g}`) : p.g || p.call || '');
const namesOf = (p) => [p.call, p.c, p.g, p.s, fullName(p), p.s && p.g ? `${p.s} ${p.g}` : null].filter(Boolean);

// 자리표시자 키가 없는 이름(대사에 그대로 나온 이름·화면 밖 문장)을 이번 견생의 사람·장소에서 찾는다
function findKey(s, value) {
  if (!s || !value) return null;
  const w = s.world;
  if (w) {
    if (value === w.dojoName) return { key: 'D' };
    const r = w.region || {};
    if (value === r.town) return { key: 'T' };
    if (value === r.street) return { key: 'S' };
    if (value === r.shrine) return { key: 'SH' };
    if (value === r.river) return { key: 'RV' };
  }
  if (s.prevDog && value === s.prevDog.name) return { key: 'P' };
  if (value === '委員長') return { key: 'iincho' };
  for (const role of ROLES) if (s.cast && s.cast[role] && namesOf(personFor(s.cast, role)).includes(value)) return { key: role };
  // 이번 견생에 없는 사람(예: 도장 소개 글 속 鷲尾)
  for (const [id, p] of Object.entries(PEOPLE)) if (id !== 'iincho' && namesOf(p).includes(value)) return { person: id };
  return null;
}

// 풀이 창의 일본어 문장 표기(src/data/proper.js JA)를 renderJa 조각으로: 〔표기|읽기〕 → 루비, 〔표기|읽기|P〕 → 점선 이름, {T} → 자리표시자
export function jaSegs(src, n = null) {
  const t = n == null ? String(src || '') : String(src || '').replace(/%n/g, String(n));
  const out = [];
  const re = /〔([^|〕]+)\|([^|〕]+)(?:\|([^〕]+))?〕|\{([A-Za-z]+)\}/g;
  let last = 0;
  let m;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push(t.slice(last, m.index));
    if (m[1]) out.push([m[1], m[2], m[3] || String(kanjiLevel(m[1])), isHardKanji(m[1]) ? 1 : 0]);
    else out.push({ p: m[4], q: '' });
    last = re.lastIndex;
  }
  if (last < t.length) out.push(t.slice(last));
  return out;
}
const fillKo = (t, n) => t.replace(/%n/g, String(n));
const hasFlag = (s, k) => !!(s && s.flags && s.flags[k] !== undefined);

// 점선 이름의 풀이: { value, reading, kind, kindKo, kindJa, ko(한국어 이름), full/fullReading, role/roleKo/roleJa, label/labelJa, area,
//   desc/descJa(원래 소개), koText(창에 쓰는 한국어 풀이), jaText(일본어 모드 문단: [조각들] — 글자는 lines.json에서 문장을 찾고, 배열은 renderJa 조각),
//   now/nowJa(요즘 근황), parts[] }
// 사람은 이번 견생의 역할(s.cast)과 인물 소개(PEOPLE), 장소는 세계 설정(s.world)에 있는 사실만 쓴다.
export function nameInfo(s, q = {}) {
  const value = String(q.value || '');
  const out = { value, reading: q.reading || nameReading(value), kind: null, ko: null, desc: null, descJa: null, koText: null, jaText: [], parts: [] };
  const found = q.key ? { key: q.key } : findKey(s, value);
  const key = found && found.key;
  const setKind = (k) => Object.assign(out, { kind: k, kindKo: KIND[k][0], kindJa: KIND[k][1] });
  const para = (...xs) => {
    const list = xs.filter((x) => x != null && x !== '');
    if (list.length) out.jaText.push(list);
  };
  if (key && PLACE_KEYS[key] && s && s.world) {
    const w = s.world;
    const r = w.region || {};
    setKind(PLACE_KEYS[key]);
    out.parts = nameParts(value, key === 'P');
    if (key === 'D') {
      // 이어지는 세계: 사람이 바뀌었으니 옛 사범을 말하는 소개는 「앞 세대 때」로
      const cont = w.continued ? DOJO_LABEL_CONT[w.dojo.id] : null;
      const state = hasFlag(s, 'dojo_moved') ? 'moved' : hasFlag(s, 'dojo_kominkan') ? 'kominkan' : w.prevDojoState || null;
      const note = state === 'moved' ? 'dojoMoved' : state === 'kominkan' ? 'dojoKominkan' : null;
      Object.assign(out, { ko: w.dojoNameKo, label: cont ? cont[0] : w.dojo.ko, labelJa: cont ? jaSegs(cont[1]) : w.dojo.labelJa || null, desc: w.dojo.desc, descJa: w.dojo.descJa || null });
      out.koText = (cont ? KO.prevGenDojo : '') + w.dojo.desc + (note ? ' ' + KO[note] : '');
      para(out.labelJa, out.labelJa ? '。' : null);
      para(cont ? jaSegs(JA.prevGenDojo) : null, out.descJa, note ? jaSegs(JA[note]) : null);
    } else if (key === 'T') {
      Object.assign(out, { ko: r.townKo, area: r.ko, desc: r.desc, descJa: r.descJa || null, koText: r.desc || null });
      para(out.descJa);
    } else if (key === 'S') {
      // 거리 이름은 대개 상점가 (한국어 이름에 「상점가」가 붙은 곳)
      const arcade = /상점가/.test(r.streetKo || '');
      setKind(arcade ? 'arcade' : 'street');
      Object.assign(out, { ko: r.streetKo, area: r.ko });
      para(jaSegs(arcade ? JA.arcade : JA.street));
    } else if (key === 'SH') {
      Object.assign(out, { ko: r.shrineKo, area: r.ko });
      para(jaSegs(JA.shrine));
    } else if (key === 'RV') {
      Object.assign(out, { ko: r.riverKo, area: r.ko });
      para(jaSegs(JA.river));
    } else if (key === 'P') {
      const prev = s.prevDog;
      // 무지개다리를 건넌 지: 이번 견생이 시작될 때의 햇수 + 그 뒤로 지난 해
      const years = (w.yearsLater || 0) + Math.floor((s.t || 0) / 4);
      if (prev) {
        Object.assign(out, { ko: prev.nameKo, desc: fillKo(KO.prevDog, years), koText: fillKo(KO.prevDog, years) });
        para(jaSegs(JA.prevDog, years));
      } else {
        // 이름 없는 선대: 종류(先代の犬)와 같은 말을 조각 풀이로 또 쓰지 않는다
        Object.assign(out, { ko: '선대(앞 세대)', desc: KO.prevDogNoName, koText: KO.prevDogNoName, parts: [] });
        para(jaSegs(JA.prevDogNoName));
      }
    }
    return out;
  }
  const role = key && (key === 'iincho' || (s && s.cast && s.cast[key])) ? key : null;
  if (role || (found && found.person)) {
    const p = role === 'iincho' ? { id: 'iincho', ...PEOPLE.iincho } : role ? personFor(s.cast, role) : { id: found.person, ...PEOPLE[found.person] };
    setKind('person');
    const continued = !!(role && s.world && s.world.continued && CONTINUED_KO[role]);
    const promoted = !!(role && PROMOTE[p.id] && PROMOTE[p.id][role]);
    out.ko = p.ko;
    out.full = p.s || p.g ? fullName(p) : null;
    if (out.full === value) out.full = null;
    out.fullReading = out.full ? nameReading(out.full) : null;
    // 가타카나 이름은 읽기가 표기와 같다 (ハン・ソジン（ハン・ソジン） 꼴을 만들지 않게)
    if (out.fullReading === out.full) out.fullReading = null;
    out.role = role;
    out.roleKo = role ? ROLE_KO[role] : null;
    out.roleJa = role ? ROLE_JA[role] : null;
    out.desc = continued ? CONTINUED_KO[role] : p.desc || null;
    out.descJa = continued ? CONTINUED_JA[role] || null : p.descJa || null;
    let descJa = out.descJa;
    // 도장 살림(千春さん)의 소개 「사범의 배우자」는 남편(坂上誠)이 사범일 때만 맞다: 노사범이 되었거나 없는 세대에서는 고쳐 쓴다
    if (role && p.id === 'chiharu' && s.cast) {
      const mk = ROLES.find((r) => s.cast[r] === 'makoto');
      if (mk === 'roshi') {
        out.desc = KO.okamiOfRoshi;
        descJa = [jaSegs(JA.okamiOfRoshi), jaSegs(JA.okamiWork)];
      } else if (mk !== 'shihan') {
        out.desc = KO.okamiWork;
        descJa = [jaSegs(JA.okamiWork)];
      }
    }
    // 초등부 아이는 자란다: 지금 학년(중학교 3.25년·고등학교 6.25년·졸업 9년)과 나이. 소개 글은 처음 만났을 때의 것
    const years = s && typeof s.t === 'number' ? s.t / 4 : 0;
    if (role === 'kid' && !continued && !promoted) {
      const st = KID_STAGE.find(([until]) => years < until);
      out.roleKo = st[1];
      out.roleJa = st[2];
      if (p.age && years >= 1) {
        out.ageNow = p.age + Math.floor(years);
        out.descThen = true;
      }
    }
    // 이번 견생에 없는 사람(이어지는 세계의 도장 소개 속 鷲尾 등)
    const gone = !role && s && s.world && s.world.continued && s.cast && !Object.values(s.cast).includes(p.id);
    out.koText = out.desc ? (gone ? KO.prevGen : '') + (out.descThen ? KO.firstMet : '') + out.desc + (out.ageNow ? ' ' + fillKo(KO.ageNow, out.ageNow) : '') : null;
    if (descJa) para(gone ? jaSegs(JA.prevGen) : null, out.descThen ? jaSegs(JA.firstMet) : null, ...(Array.isArray(descJa) ? descJa : [descJa]), out.ageNow ? jaSegs(JA.ageNow, out.ageNow) : null);
    // 요즘 근황: 이야기에서 바뀐 소식(처음 소개와 다를 때만)
    const news = role && s.news ? s.news[role] : null;
    if (news && news !== out.desc && news !== p.desc && news !== CONTINUED_KO[role]) {
      out.now = news;
      out.nowKo = KO.lately + news;
      out.nowJa = (s.newsJa && s.newsJa[role]) || null;
      out.nowJaText = out.nowJa ? [jaSegs(JA.lately), out.nowJa] : null;
    }
    out.parts = nameParts(value, true);
    return out;
  }
  // 호칭이 붙은 꼴(田中先生)은 호칭을 뗀 이름으로도 찾는다
  const place = PLACES[value] || PLACES[value.replace(/(先生|さん|ちゃん|くん|様)$/, '')];
  if (place) {
    setKind(place[1] === 'person' ? 'person' : place[1]);
    out.ko = place[0];
  }
  out.parts = nameParts(value, !place || place[1] === 'person');
  return out;
}

// 점선을 그을 만한 이름인가: 누르면 종류나 이름 속 말의 뜻이 나오는 것만 (형태소 분석기가 잘못 고유명사로 본 「日」 같은 것은 보통 글자로)
export function nameExplained(s, value) {
  const info = nameInfo(s, { value });
  return !!(info.kind || info.parts.length);
}
