// 일본어 대사 → 루비(후리가나)·학습 단어 조각 생성기.
// 형태소 분석(kuromoji)은 빌드할 때만 쓰고, 결과는 src/gen/lines.json 으로 저장해 게임에 넣는다.
// 실행: node tools/gen-lines.mjs   (결과 검토용 목록: tools/out/ruby-review.txt, tools/out/lemmas.txt)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { collect } from './collect.mjs';
import { VOCAB, ALIAS } from '../src/data/vocab.js';

const require = createRequire(import.meta.url);
const kuromoji = require('kuromoji');
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// 형태소 분석기가 틀리기 쉬운 읽기 (수사+조수사, 검도 용어, 고유한 복합어). 긴 것부터 맞춘다.
const OVR = {
  一本: 'いっぽん', 二本目: 'にほんめ', 一本目: 'いっぽんめ', 五本目: 'ごほんめ', 三本: 'さんぼん', 一本勝負: 'いっぽんしょうぶ', 一本勝ち: 'いっぽんがち',
  一回: 'いっかい', 三回目: 'さんかいめ', 五回目: 'ごかいめ', 一人: 'ひとり', 二人: 'ふたり', 三人: 'さんにん', 一歩: 'いっぽ', 一番: 'いちばん',
  一度: 'いちど', 一生: 'いっしょう', 一句: 'いっく', 一冊: 'いっさつ', 一匹: 'いっぴき', 一週間: 'いっしゅうかん', 二か月: 'にかげつ',
  四十年: 'よんじゅうねん', 二十年間: 'にじゅうねんかん', 十年: 'じゅうねん', 百年: 'ひゃくねん', 一年: 'いちねん', 六時: 'ろくじ', 百円: 'ひゃくえん',
  一次: 'いちじ', 二次: 'にじ', 四票: 'よんひょう', 一級: 'いっきゅう', 一歳: 'いっさい', 三日: 'みっか', 一つ: 'ひとつ', 二つ: 'ふたつ', 三つ: 'みっつ',
  第一号: 'だいいちごう', 第二号: 'だいにごう', 何時: 'なんじ', 五分: 'ごふん', 三十年: 'さんじゅうねん', 三十: 'さんじゅう', 五十: 'ごじゅう',
  初段: 'しょだん', 二段: 'にだん', 三段: 'さんだん', 四段: 'よだん', 五段: 'ごだん', 七段: 'ななだん', 八段: 'はちだん', 段審査: 'だんしんさ', 二段技: 'にだんわざ',
  小手: 'こて', 胴: 'どう', 面: 'めん', 垂: 'たれ', 鍔: 'つば', 礼: 'れい', 蹲踞: 'そんきょ', 残心: 'ざんしん', 切り返し: 'きりかえし', 打ち込み: 'うちこみ',
  元立ち: 'もとだち', 地稽古: 'じげいこ', 掛かり稽古: 'かかりげいこ', 寒稽古: 'かんげいこ', 暑中稽古: 'しょちゅうげいこ', 見取り稽古: 'みとりげいこ',
  出稽古: 'でげいこ', 稽古始め: 'けいこはじめ', 稽古納め: 'けいこおさめ', 合同稽古: 'ごうどうげいこ', 竹刀袋: 'しないぶくろ', 打突部位: 'だとつぶい',
  打突部: 'だとつぶ', 有効打突: 'ゆうこうだとつ', 打突: 'だとつ', 刃筋: 'はすじ', 気剣体一致: 'きけんたいいっち', 出ばな面: 'でばなめん', 出ばな小手: 'でばなこて',
  出小手: 'でごて', 引き面: 'ひきめん', 引き胴: 'ひきどう', 小手返し面: 'こてかえしめん', 鍔迫り合い: 'つばぜりあい', 引き技: 'ひきわざ', 間合い: 'まあい',
  踏み込み: 'ふみこみ', 素振り: 'すぶり', 先鋒: 'せんぽう', 次鋒: 'じほう', 中堅: 'ちゅうけん', 副将: 'ふくしょう', 大将: 'たいしょう', 代表戦: 'だいひょうせん',
  日本剣道形: 'にほんけんどうがた', 上座: 'かみざ', 神前: 'しんぜん', 神棚: 'かみだな', 礼法: 'れいほう', 面紐: 'めんひも', 打ち込み台: 'うちこみだい',
  上段: 'じょうだん', 鏡開き: 'かがみびらき', 鏡餅: 'かがみもち', 錬成会: 'れんせいかい', 学科: 'がっか', 審判: 'しんぱん', 主審: 'しゅしん', 旗: 'はた',
  延長: 'えんちょう', 反則: 'はんそく', 場外: 'じょうがい', 防具: 'ぼうぐ', 手拭い: 'てぬぐい', 袴: 'はかま', 竹刀: 'しない', 木刀: 'ぼくとう',
  師範: 'しはん', 門下生: 'もんかせい', 特練: 'とくれん', 県警: 'けんけい', 一番弟子: 'いちばんでし', 委員長: 'いいんちょう', 町内会長: 'ちょうないかいちょう',
  町内会: 'ちょうないかい', 町内: 'ちょうない', 商店街: 'しょうてんがい', 河川敷: 'かせんじき', 八百屋: 'やおや', 魚屋: 'さかなや', 肉屋: 'にくや',
  古本屋: 'ふるほんや', 写真館: 'しゃしんかん', 殺陣師: 'たてし', 大吉: 'だいきち', 絵馬: 'えま', 見守り: 'みまもり', 年越し: 'としこし', 年越: 'としこ',
  金魚すくい: 'きんぎょすくい', 屋台: 'やたい', お月見団子: 'おつきみだんご', 枕投げ: 'まくらなげ', 干し芋: 'ほしいも', 雑巾がけ: 'ぞうきんがけ',
  当番: 'とうばん', 大盛り: 'おおもり', 別腹: 'べつばら', 板の間: 'いたのま', 胴長: 'どうなが', 剣道部: 'けんどうぶ', 強豪校: 'きょうごうこう',
  一人前: 'いちにんまえ', 看板犬: 'かんばんけん', 道場犬: 'どうじょうけん', 入口: 'いりぐち', 手作り: 'てづくり', 手加減: 'てかげん', 体育室: 'たいいくしつ',
  更衣室: 'こういしつ', 案内係: 'あんないがかり', 共通テスト: 'きょうつうテスト', 煮卵: 'にたまご', 出汁: 'だし', 朝ごはん: 'あさごはん', 夕飯: 'ゆうはん',
  国産: 'こくさん', 和牛: 'わぎゅう', 最終作戦: 'さいしゅうさくせん', 作戦名: 'さくせんめい', 残念会: 'ざんねんかい', 生前: 'せいぜん', 居場所: 'いばしょ',
  泣き虫: 'なきむし', 白髪: 'しらが', 年相応: 'としそうおう', 子犬: 'こいぬ', 老犬: 'ろうけん', 忠犬: 'ちゅうけん', 有名犬: 'ゆうめいけん', 柴犬: 'しばいぬ',
  検査入院: 'けんさにゅういん', 獣医: 'じゅうい', 段差: 'だんさ', 赤字: 'あかじ', 黒字: 'くろじ', 帳簿: 'ちょうぼ', 竹輪: 'ちくわ', 古株: 'ふるかぶ',
  前足: 'まえあし', 右足: 'みぎあし', 左足: 'ひだりあし', 歩幅: 'ほはば', 納屋: 'なや', 弁当: 'べんとう', 毎朝: 'まいあさ', 浴衣: 'ゆかた', 旅館: 'りょかん',
  雰囲気: 'ふんいき', 集合写真: 'しゅうごうしゃしん', 部員: 'ぶいん', 現金: 'げんきん', 幽霊: 'ゆうれい', 諸君: 'しょくん', 本日: 'ほんじつ', 異論: 'いろん',
  貴様: 'きさま', 演説: 'えんぜつ', 味噌汁: 'みそしる', 良心: 'りょうしん', 規則: 'きそく', 四票: 'よんひょう', 民意: 'みんい', 陰謀: 'いんぼう', 一環: 'いっかん',
  左右面: 'さゆうめん', 手首: 'てくび', 一致: 'いっち', 忘年会: 'ぼうねんかい', 年賀状: 'ねんがじょう', 贅沢: 'ぜいたく', 端っこ: 'はじっこ', 度胸: 'どきょう',
  唐揚げ: 'からあげ', 玉ねぎ: 'たまねぎ', 分数: 'ぶんすう', 分母: 'ぶんぼ', 眉毛: 'まゆげ', 立派: 'りっぱ', 二十: 'にじゅう', 三か月: 'さんかげつ',
  婚約者: 'こんやくしゃ', 転勤: 'てんきん', 出世: 'しゅっせ', 部長: 'ぶちょう', 審査員: 'しんさいん', 審査: 'しんさ', 中学生: 'ちゅうがくせい', 高校生: 'こうこうせい',
  小学生: 'しょうがくせい', 気合: 'きあい', 気勢: 'きせい', 構え: 'かまえ', 突き: 'つき', 攻め: 'せめ', 先生: 'せんせい', 委員長通信: 'いいんちょうつうしん',
  見学: 'けんがく', 支配者: 'しはいしゃ', 管轄: 'かんかつ', 張り込み: 'はりこみ', 潮時: 'しおどき', 浪人: 'ろうにん', 二十年: 'にじゅうねん',
  一品: 'いっぴん', 素人: 'しろうと', 親父: 'おやじ', 太鼓: 'たいこ', 主人: 'しゅじん',
  後: 'あと', 主: 'ぬし', この辺: 'このへん', 金: 'かね', 叩け: 'たたけ', 打て: 'うて', 立て: 'たて', 預け: 'あずけ', 正しく: 'ただしく', 日本: 'にほん',
  失くし: 'なくし', 三匹: 'さんびき', 止め: 'やめ', ポルトガル語: 'ポルトガルご', 夜中: 'よなか', 短足: 'たんそく', 九時: 'くじ', 十個: 'じゅっこ',
  百本: 'ひゃっぽん', 剣の道: 'けんのみち', 日本語: 'にほんご', 四日: 'よっか', 一日中: 'いちにちじゅう', 一晩中: 'ひとばんじゅう', 雪道: 'ゆきみち',
  三日間: 'みっかかん', 大掃除: 'おおそうじ', 来させる: 'こさせる', 丼: 'どん', カツ丼: 'かつどん', 臭い: 'くさい',
};
const OVR_KEYS = Object.keys(OVR).sort((a, b) => b.length - a.length);

const kata2hira = (s) => (s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const hasKanji = (s) => /[一-鿿々]/.test(s);

// 표기와 읽기를 맞춰 [한자, 읽기] / 가나 조각으로 나눈다
export function align(surface, reading) {
  if (!hasKanji(surface) || !reading) return [surface];
  const parts = surface.match(/[一-鿿々]+|[^一-鿿々]+/g);
  const re = new RegExp('^' + parts.map((p) => (hasKanji(p) ? '(.+?)' : kata2hira(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('') + '$');
  const m = kata2hira(reading).match(re);
  if (!m) return [[surface, kata2hira(reading)]];
  let g = 1;
  return parts.map((p) => (hasKanji(p) ? [p, m[g++]] : p));
}

function parseTemplate(tpl) {
  // 조각: {k:'t', v} {k:'p', key, prop} {k:'v', v, key, explicit} {k:'o', v, r}
  const out = [];
  const re = /\{([A-Za-z]+)(?:\.([a-z]))?\}|\[([^\]|]+)(?:\|([^\]]+))?\]|〔([^:〕]+):([^〕]+)〕/g;
  let last = 0;
  let m;
  while ((m = re.exec(tpl))) {
    if (m.index > last) out.push({ k: 't', v: tpl.slice(last, m.index) });
    if (m[1]) out.push({ k: 'p', key: m[1], prop: m[2] });
    else if (m[3]) out.push({ k: 'v', v: m[3], key: m[4] || null });
    else out.push({ k: 'o', v: m[5], r: m[6] });
    last = re.lastIndex;
  }
  if (last < tpl.length) out.push({ k: 't', v: tpl.slice(last) });
  return out;
}

const tokenizer = await new Promise((res, rej) =>
  kuromoji.builder({ dicPath: path.join(ROOT, 'node_modules/kuromoji/dict') }).build((e, t) => (e ? rej(e) : res(t)))
);

const review = new Map(); // "표기\t읽기" → {n, sample}
const lemmaUse = new Map(); // 정규화된 키 → {n, surfaces, sample}
const unlinked = new Map();

function tokenizePlain(plain, fixed) {
  // fixed: [{s,e,r}] 강제 읽기 구간. 나머지 구간을 형태소 분석한다.
  const toks = [];
  let pos = 0;
  const runs = [];
  for (const f of fixed.sort((a, b) => a.s - b.s)) {
    if (f.s > pos) runs.push({ s: pos, e: f.s });
    runs.push({ s: f.s, e: f.e, fixed: f });
    pos = f.e;
  }
  if (pos < plain.length) runs.push({ s: pos, e: plain.length });
  for (const r of runs) {
    if (r.fixed) {
      const sf = plain.slice(r.s, r.e);
      toks.push({ s: r.s, e: r.e, surface: sf, reading: r.fixed.r, basic: r.fixed.basic || sf, fixed: true });
      continue;
    }
    let off = r.s;
    for (const t of tokenizer.tokenize(plain.slice(r.s, r.e))) {
      const sf = t.surface_form;
      toks.push({ s: off, e: off + sf.length, surface: sf, reading: t.reading ? kata2hira(t.reading) : null, basic: t.basic_form === '*' ? sf : t.basic_form, pos: t.pos });
      off += sf.length;
    }
  }
  return toks;
}

function rubyItems(toks, s, e, plain) {
  const items = [];
  for (const t of toks) {
    if (t.e <= s || t.s >= e) continue;
    if (t.s < s || t.e > e) {
      items.push(plain.slice(Math.max(s, t.s), Math.min(e, t.e)));
      continue;
    }
    if (hasKanji(t.surface) && t.reading) {
      const key = t.surface + '\t' + t.reading;
      const r = review.get(key) || { n: 0 };
      r.n++;
      review.set(key, r);
    }
    for (const it of align(t.surface, t.reading)) items.push(it);
  }
  // 이웃한 문자열 합치기
  const out = [];
  for (const it of items) {
    if (typeof it === 'string' && typeof out[out.length - 1] === 'string') out[out.length - 1] += it;
    else out.push(it);
  }
  return out;
}

export function processTemplate(tpl, sample) {
  const parts = parseTemplate(tpl);
  let plain = '';
  const spans = [];
  for (const p of parts) {
    const s = plain.length;
    if (p.k === 'p') plain += '〓';
    else plain += p.v;
    spans.push({ ...p, s, e: plain.length });
  }
  const fixed = [];
  for (const sp of spans) if (sp.k === 'o') fixed.push({ s: sp.s, e: sp.e, r: sp.r });
  // 강제 읽기 사전
  const taken = (i) => spans.some((sp) => (sp.k === 'p' || sp.k === 'o') && i >= sp.s && i < sp.e) || fixed.some((f) => i >= f.s && i < f.e);
  for (let i = 0; i < plain.length; ) {
    const k =
      !taken(i) &&
      OVR_KEYS.find(
        (w) =>
          plain.startsWith(w, i) &&
          ![...w].some((_, j) => taken(i + j)) &&
          // 한 글자짜리는 앞뒤가 한자가 아닐 때만 (例: 面을 正面·面白い 안에서는 쓰지 않는다)
          (w.length > 1 || (!hasKanji(plain[i - 1] || '') && !hasKanji(plain[i + 1] || '')))
      );
    if (k) {
      fixed.push({ s: i, e: i + k.length, r: OVR[k] });
      i += k.length;
    } else i++;
  }
  const toks = tokenizePlain(plain, fixed);
  // 학습 단어 구간을 형태소 경계에 맞춰 넓히고, 사전형 키를 정한다
  const vocab = [];
  for (const sp of spans.filter((x) => x.k === 'v')) {
    const over = toks.filter((t) => t.e > sp.s && t.s < sp.e);
    let s = sp.s;
    let e = sp.e;
    let key = sp.key;
    if (over.length === 1 && (over[0].s < sp.s || over[0].e > sp.e)) {
      s = over[0].s;
      e = over[0].e;
      if (!key) key = over[0].basic;
    } else if (over.length) {
      s = Math.min(s, over[0].s);
      e = Math.max(e, over[over.length - 1].e);
      if (!key) key = over.length === 1 ? over[0].basic : plain.slice(s, e);
    }
    if (!key) key = sp.v;
    if (!VOCAB[key] && ALIAS[key]) key = ALIAS[key];
    if (VOCAB[key]) vocab.push({ s, e, key });
    else {
      const u = unlinked.get(key) || { n: 0, surf: new Set(), sample };
      u.n++;
      u.surf.add(plain.slice(s, e));
      unlinked.set(key, u);
    }
    const l = lemmaUse.get(key) || { n: 0, surf: new Set(), sample };
    l.n++;
    l.surf.add(plain.slice(s, e));
    lemmaUse.set(key, l);
  }
  // 겹치는 단어 구간 제거
  vocab.sort((a, b) => a.s - b.s);
  const vv = [];
  for (const v of vocab) if (!vv.length || v.s >= vv[vv.length - 1].e) vv.push(v);
  // 조각 만들기
  const segs = [];
  const phAt = new Map(spans.filter((x) => x.k === 'p').map((x) => [x.s, x]));
  let i = 0;
  const pushText = (s, e) => {
    if (e <= s) return;
    // 자리표시자 위치에서 끊는다
    let a = s;
    for (let j = s; j < e; j++) {
      if (phAt.has(j)) {
        for (const it of rubyItems(toks, a, j, plain)) segs.push(it);
        const p = phAt.get(j);
        segs.push({ p: p.key, q: p.prop || '' });
        a = j + 1;
      }
    }
    for (const it of rubyItems(toks, a, e, plain)) segs.push(it);
  };
  for (const v of vv) {
    pushText(i, v.s);
    segs.push({ v: v.key, s: rubyItems(toks, v.s, v.e, plain) });
    i = v.e;
  }
  pushText(i, plain.length);
  return segs;
}

if (process.argv[1] && process.argv[1].endsWith('gen-lines.mjs')) {
  const { ja, speakers } = collect();
  const lines = {};
  for (const [tpl, where] of ja) lines[tpl] = processTemplate(tpl, where);
  const spk = {};
  for (const sp of speakers) spk[sp] = processTemplate(sp, 'speaker');
  const ex = {};
  for (const [w, v] of Object.entries(VOCAB)) ex[w] = processTemplate(v.ex, 'vocab:' + w);
  fs.mkdirSync(path.join(ROOT, 'src/gen'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'src/gen/lines.json'), JSON.stringify({ lines, speakers: spk, ex }));
  fs.mkdirSync(path.join(ROOT, 'tools/out'), { recursive: true });
  const rv = [...review.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja')).map(([k, v]) => k + '\t' + v.n);
  fs.writeFileSync(path.join(ROOT, 'tools/out/ruby-review.txt'), rv.join('\n'));
  const lm = [...lemmaUse.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => [k, v.n, [...v.surf].join('/'), VOCAB[k] ? 'OK' : '--', v.sample].join('\t'));
  fs.writeFileSync(path.join(ROOT, 'tools/out/lemmas.txt'), lm.join('\n'));
  console.log('templates', ja.size, 'speakers', speakers.size, 'ruby pairs', review.size, 'lemmas', lemmaUse.size, 'linked', [...lemmaUse.keys()].filter((k) => VOCAB[k]).length, 'unlinked', unlinked.size);
}
