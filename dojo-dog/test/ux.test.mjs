// 휴대폰 화면 사용성 검사: 점선 이름(고유명사) 한 덩어리·풀이, 탭이 문장 번역으로 넘어가는지, 표시 안내 보기 글자
// 브라우저 없이 돌리기 위해 esbuild로 묶고(lines.json 포함), 아주 작은 DOM 흉내를 쓴다 (test/game.test.mjs와 같은 방식, 이벤트 전달을 더했다).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import * as G from '../src/engine/core.js';
import { nameInfo, nameParts, nameReading, NAME_PLAIN, jaSegs, nameExplained } from '../src/engine/text.js';
import { PARTS, PLACES, KIND, KO, JA, KID_STAGE, DOJO_LABEL_CONT } from '../src/data/proper.js';
import { REGIONS, DOJOS, PEOPLE, ROLES, ROLE_JA, ROLE_KO, personFor } from '../src/engine/world.js';
import { maxTargets } from '../src/engine/learn.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ── 작은 DOM 흉내: render.js·help.js가 쓰는 만큼 + 클릭 전달(stopPropagation)
class Node {
  constructor() {
    this.parentNode = null;
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
}
class Text extends Node {
  constructor(v) {
    super();
    this.nodeType = 3;
    this.nodeValue = String(v);
  }
  get textContent() {
    return this.nodeValue;
  }
}
class Element extends Node {
  constructor(tag) {
    super();
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.childNodes = [];
    this.attrs = {};
    this.style = {};
    this.className = '';
    this.listeners = {};
    const self = this;
    this.classList = {
      add: (c) => (self.className = [...new Set([...self.className.split(' ').filter(Boolean), c])].join(' ')),
      contains: (c) => self.className.split(' ').includes(c),
    };
  }
  get firstChild() {
    return this.childNodes[0] || null;
  }
  get nextSibling() {
    return null;
  }
  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }
  append(...ns) {
    for (const n of ns) {
      const node = n instanceof Node ? n : new Text(n);
      node.remove();
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }
  insertBefore(n, ref) {
    n.remove();
    n.parentNode = this;
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i < 0) this.childNodes.push(n);
    else this.childNodes.splice(i, 0, n);
    return n;
  }
  removeChild(n) {
    const i = this.childNodes.indexOf(n);
    if (i >= 0) this.childNodes.splice(i, 1);
    n.parentNode = null;
    return n;
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  getAttribute(k) {
    return k in this.attrs ? this.attrs[k] : null;
  }
  addEventListener(t, f) {
    (this.listeners[t] = this.listeners[t] || []).push(f);
  }
  get textContent() {
    return this.childNodes.map((n) => n.textContent).join('');
  }
  all(sel) {
    const out = [];
    const want = (el) => (sel[0] === '.' ? el.classList.contains(sel.slice(1)) : el.tagName === sel.toUpperCase());
    const walk = (el) => {
      for (const c of el.children) {
        if (want(c)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
}
// 클릭을 대상에서 위로 전달한다. 누가 멈췄는지(stopPropagation) 알 수 있게 거쳐 간 요소를 돌려준다.
function click(el) {
  const ev = { type: 'click', target: el, stopped: false, stopPropagation() { this.stopped = true; }, preventDefault() {} };
  const reached = [];
  for (let n = el; n && !ev.stopped; n = n.parentNode) {
    reached.push(n);
    for (const f of n.listeners['click'] || []) f({ ...ev, currentTarget: n, stopPropagation: () => (ev.stopped = true), preventDefault() {} });
  }
  return reached;
}
globalThis.Node = Node;
globalThis.document = { createElement: (t) => new Element(t), createTextNode: (v) => new Text(v) };

let R; // render.js + help.js
before(async () => {
  const entry = "export * from './src/ui/render.js'; export { legendView, MARKS, TAPS, tapsFor, SETTING_DESC } from './src/ui/help.js';";
  const out = await esbuild.build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'js' }, bundle: true, format: 'esm', platform: 'neutral', write: false, loader: { '.json': 'json' }, logLevel: 'silent' });
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-ux-test-')), 'bundle.mjs');
  fs.writeFileSync(file, out.outputFiles[0].text);
  R = await import(pathToFileURL(file).href);
});

const life = (seed = 'ux') => {
  const s = G.newLife({ seed });
  G.beginLife(s);
  return s;
};
const rubies = (el) => el.all('ruby').map((r) => [r.childNodes.filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(''), r.all('rt').map((x) => x.textContent).join('')]);

test('T2: 자리표시자 값 하나는 점선 하나 (しらかば町こども剣友会), 안의 한자 조각에만 루비', () => {
  const s = life();
  s.world.dojoName = 'しらかば町こども剣友会';
  const el = R.renderJa('x', { s, mode: 'always', segs: ['ようこそ', { p: 'D' }, 'へ'] });
  const pn = el.all('.pn');
  assert.equal(pn.length, 1);
  assert.equal(pn[0].textContent.replace(/ちょう|けんゆうかい/g, ''), 'しらかば町こども剣友会');
  assert.equal(pn[0].getAttribute('data-r'), 'しらかばちょうこどもけんゆうかい');
  assert.equal(pn[0].getAttribute('data-key'), 'D');
  assert.deepEqual(rubies(pn[0]), [['町', 'ちょう'], ['剣友会', 'けんゆうかい']]);
  // 사람 이름은 점선 없이(루비만), 장소 자리표시자 하나마다 점선 정확히 하나
  for (const role of ['okami', 'shihan', 'kid', 'kor']) {
    const e2 = R.renderJa('x', { s, mode: 'n2', segs: [{ p: role }, 'さん、', { p: 'T' }] });
    assert.equal(e2.all('.pn').length, 1, role);
    assert.equal(e2.all('.pn')[0].getAttribute('data-key'), 'T', role);
  }
});

test('T2: 1인칭(私·俺·僕)·숫자·개 이름에는 점선을 긋지 않는다', () => {
  const s = life();
  assert.deepEqual([...NAME_PLAIN].sort(), ['BG', 'I', 'N', 'Y']);
  const sp = ROLES.find((r) => /[一-鿿]/.test(personFor(s.cast, r).I)); // 俺·私 같은 한자 1인칭을 쓰는 사람
  const I = personFor(s.cast, sp).I;
  const el = R.renderJa('x', { s, speaker: sp, mode: 'always', segs: [{ p: 'I' }, 'は', { p: 'N' }, 'と', { p: 'Y' }, '年'] });
  assert.equal(el.all('.pn').length, 0);
  assert.ok(el.textContent.includes(s.dog.name));
  // 1인칭 한자에는 후리가나 설정(항상)에 따라 읽기만 단다
  assert.ok(rubies(el).some(([b]) => b === I), `${I} 읽기`);
  // 「N2 이상만」에서는 쉬운 1인칭(私: 기초 한자)에 읽기를 달지 않는다
  const watashi = ROLES.find((r) => personFor(s.cast, r).I === '私');
  const el2 = R.renderJa('x', { s, speaker: watashi, mode: 'n2', segs: [{ p: 'I' }, 'は'] });
  assert.equal(el2.textContent, '私は');
  assert.equal(rubies(el2).length, 0);
});

test('T2: 사람 이름(화자 포함)에는 점선·탭이 없다', () => {
  const s = life();
  let got = null;
  const el = R.renderSpeaker('okami', s, 'always', { s, mode: 'always', onName: (q) => (got = q) });
  assert.equal(el.all('.pn').length, 0);
  assert.ok(el.textContent.includes(personFor(s.cast, 'okami').call.replace(/[一-鿿]+/g, '')));
  assert.equal(got, null);
});

test('T2: 처리기가 없을 때는 기본 처리기(앱의 풀이 창), 그것도 없으면 탭을 문장 쪽으로 넘긴다', () => {
  const s = life();
  const wrap = document.createElement('div');
  let toggled = 0;
  wrap.addEventListener('click', () => toggled++);
  wrap.append(R.renderJa('x', { s, mode: 'always', segs: [{ p: 'D' }, 'に来た。'] }));
  click(wrap.all('.pn')[0]);
  assert.equal(toggled, 1, '처리기가 없으면 번역 쪽으로');
  let seen = null;
  R.setNameHandler((q, st) => (seen = [q.key, st]));
  click(wrap.all('.pn')[0]);
  assert.equal(toggled, 1, '기본 처리기가 있으면 거기서 멈춘다');
  assert.deepEqual(seen, ['D', s]);
  R.setNameHandler(null);
});

test('T1: 해설 창이 없는 곳(뜻 창 속 예문 등)의 밑줄 단어를 눌러도 문장 번역이 열린다', () => {
  const segs = [{ v: '稽古', s: [['稽古', 'けいこ', 'K', 0]] }, 'の時間だ。'];
  const wrap = document.createElement('div');
  let toggled = 0;
  wrap.addEventListener('click', () => toggled++);
  wrap.append(R.renderJa('x', { s: null, mode: 'always', segs }));
  click(wrap.all('.w')[0]);
  assert.equal(toggled, 1);
  // 해설 창이 있는 게임 화면: 단어 창만 열고 번역은 열지 않는다
  let opened = null;
  const wrap2 = document.createElement('div');
  wrap2.addEventListener('click', () => toggled++);
  wrap2.append(R.renderJa('x', { s: null, mode: 'always', segs, onWord: (k) => (opened = k) }));
  click(wrap2.all('.w')[0]);
  assert.equal(opened, '稽古');
  assert.equal(toggled, 1);
});

test('T2: 풀이 — 도장·동네·거리·신사·강은 세계 설정의 한국어 이름과 이름 속 말의 뜻', () => {
  const s = life();
  for (const region of REGIONS) {
    for (const dojo of DOJOS) {
      s.world.region = region;
      s.world.dojo = dojo;
      s.world.dojoName = dojo.id === 'kids' ? region.town + dojo.name : dojo.name;
      s.world.dojoNameKo = dojo.id === 'kids' ? region.townKo + ' ' + dojo.nameKo : dojo.nameKo;
      const d = nameInfo(s, { key: 'D', value: s.world.dojoName });
      assert.equal(d.kind, 'dojo');
      assert.equal(d.ko, s.world.dojoNameKo);
      assert.equal(d.desc, dojo.desc);
      assert.ok(d.parts.length >= 1, `${s.world.dojoName}: 뜻을 풀 조각`);
      for (const [key, field, kind] of [['T', 'town', 'town'], ['S', 'street', 'street'], ['SH', 'shrine', 'shrine'], ['RV', 'river', 'river']]) {
        const q = nameInfo(s, { key, value: region[field] });
        // 거리: 한국어 이름이 「상점가」인 곳은 상점가(商店街)
        assert.equal(q.kind, kind === 'street' && /상점가/.test(region.streetKo) ? 'arcade' : kind);
        // 일본어 모드에서도 일본어 한 줄 (동네는 세계 설정의 소개, 거리·신사·강은 「○○町の商店街」 꼴)
        assert.ok(q.jaText.length >= 1, `${region[field]}: 일본어 풀이`);
        assert.equal(q.ko, region[field + 'Ko']);
        assert.equal(q.area, region.ko);
        // 이름 속 말(町·浜·村·銀座·通り·稲荷·天神·八幡·神社·鎮守·川)이 하나는 풀린다
        assert.ok(q.parts.length >= 1, `${region[field]}: 풀이할 조각 없음`);
        assert.equal(q.reading, nameReading(region[field]));
      }
    }
  }
  const kids = nameInfo(s, { key: 'D', value: 'しらかば町こども剣友会' });
  assert.deepEqual(kids.parts.map((x) => x.w), ['町', 'こども', '剣友会']);
  assert.match(kids.parts[2].ko, /검도/);
});

test('T2: 풀이 — 사람은 이번 견생의 역할과 소개, 성씨 글자는 낱말로 풀지 않는다, 아이는 지금 나이', () => {
  const s = life();
  for (const role of ROLES) {
    const p = personFor(s.cast, role);
    const q = nameInfo(s, { key: role, value: p.call });
    assert.equal(q.kind, 'person');
    assert.equal(q.role, role);
    assert.ok(q.roleKo && q.roleJa);
    assert.equal(q.ko, p.ko);
    assert.equal(q.desc, p.desc);
    for (const part of q.parts) assert.ok(['先生', 'さん', 'ちゃん', 'くん'].includes(part.w), `${p.call}: ${part.w}`);
  }
  // 森川(성씨)의 森·川을 숲·강으로 풀지 않는다
  assert.deepEqual(nameParts('森川ひなた', true), []);
  assert.deepEqual(nameParts('すみれ川').map((x) => x.w), ['川']);
  // 이름만 와도(키 없이) 이번 견생의 사람을 찾는다
  const shihan = personFor(s.cast, 'shihan');
  assert.equal(nameInfo(s, { value: shihan.call }).role, 'shihan');
  // 아이는 자란다: 처음 만났을 때의 소개 + 지금 나이
  s.t = 12;
  const kid = nameInfo(s, { key: 'kid', value: personFor(s.cast, 'kid').call });
  assert.equal(kid.descThen, true);
  assert.equal(kid.ageNow, PEOPLE[s.cast.kid].age + 3);
  // 위원장
  assert.equal(nameInfo(s, { key: 'iincho', value: '委員長' }).roleKo, '이웃');
});

test('T2: 풀이 — 이어지는 세계: 노사범·사범은 이어진 소개, 先代는 전에 살던 개', () => {
  const s1 = life('gen1');
  const legacy = G.legacyOf(s1);
  const s = G.newLife({ seed: 'gen2', world: 'continue', legacy });
  G.beginLife(s);
  const roshi = nameInfo(s, { key: 'roshi', value: personFor(s.cast, 'roshi').call });
  assert.match(roshi.desc, /전 사범/);
  assert.ok(roshi.descJa && /師範/.test(roshi.descJa));
  const prev = nameInfo(s, { key: 'P', value: s.prevDog.name });
  assert.equal(prev.kind, 'prevdog');
  assert.equal(prev.ko, s.prevDog.nameKo);
  assert.match(prev.desc, new RegExp(`${s.world.yearsLater}년`));
  // 키 없이 개 이름만 와도
  assert.equal(nameInfo(s, { value: s.prevDog.name }).kind, 'prevdog');
});

test('T2: 대사에 그대로 나오는 고유명사(韓国·大阪…)도 풀이가 있다', () => {
  const LINES = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/gen/lines.json'), 'utf8'));
  const P = new Set();
  const walk = (segs) => (segs || []).forEach((sg) => (Array.isArray(sg) && sg[2] === 'P' ? P.add(sg[0]) : sg && sg.s ? walk(sg.s) : null));
  Object.values(LINES.lines).forEach(walk);
  Object.values(LINES.ex).forEach(walk);
  const s = life();
  const missing = [...P].filter((w) => !PLACES[w] && !nameInfo(s, { value: w }).kind);
  // 형태소 분석기가 잘못 고유명사로 본 한 글자(日 등)만 남아도 된다
  assert.ok(missing.every((w) => w.length === 1), `풀이 없는 고유명사: ${missing.join(' ')}`);
  for (const [w, [ko, kind]] of Object.entries(PLACES)) {
    assert.ok(ko && KIND[kind === 'person' ? 'person' : kind], w);
    assert.equal(nameInfo(s, { value: w }).ko, ko, w);
  }
});

test('T2: 이름 속 말 풀이 데이터는 읽기와 한국어가 다 있다', () => {
  for (const [w, [r, ko]] of Object.entries(PARTS)) {
    assert.match(r, /^[ぁ-ゖー]+$/, w);
    assert.ok(ko && /[가-힣]/.test(ko), w);
  }
});

test('T3: 표시 안내는 짧고 한 언어만, 보기 글자는 진짜 밑줄 단추 class를 쓰지 않는다', () => {
  for (const ja of [true, false]) {
    for (const compact of [true, false]) {
      const el = R.legendView(ja, { compact });
      assert.equal(el.all('.w').length + el.all('.gm').length + el.all('.pn').length, 0);
      assert.equal(el.all('.legend-mark').length, R.MARKS.length);
      assert.doesNotMatch(el.textContent, /사람 이름/);
      if (ja) assert.doesNotMatch(el.textContent, /[가-힣]/);
      else assert.doesNotMatch(el.textContent, /「訳」|全訳/);
    }
  }
});

test('T3: 설정 스위치 설명은 한 줄', () => {
  for (const [ko, ja] of Object.values(R.SETTING_DESC)) {
    assert.ok(ko.length <= 40 && ja.length <= 40);
  }
});

test('T2: 선택지 단추 안의 이름은 점선·탭 없이 (이름을 눌러도 그 선택지가 골라진다)', () => {
  const s = life();
  let named = 0;
  R.setNameHandler(() => named++);
  const btn = document.createElement('button');
  let chosen = 0;
  btn.addEventListener('click', () => chosen++);
  btn.append(R.renderJa('x', { s, mode: 'always', targets: new Set(), onName: null, plainNames: true, segs: [{ p: 'okami' }, 'のそばにいる'] }));
  assert.equal(btn.all('.pn').length, 0);
  const plain = btn.all('.pn-plain');
  assert.equal(plain.length, 1);
  assert.equal(plain[0].getAttribute('role'), null);
  click(plain[0]);
  assert.equal(chosen, 1);
  assert.equal(named, 0);
  R.setNameHandler(null);
});

test('T2: 고유명사로 잘못 붙은 한 글자(日用品의 「日」)는 점선 없이, 풀이가 있는 이름은 점선', () => {
  const s = life();
  assert.equal(nameExplained(s, '日'), false);
  assert.equal(nameExplained(s, '韓国'), true);
  const el = R.renderJa('x', { s: null, mode: 'always', segs: [['日', 'にち', 'P', 0], ['用品', 'ようひん', '2', 0], 'と', ['韓国', 'かんこく', 'P', 0]] });
  const pn = el.all('.pn');
  assert.deepEqual(pn.map((x) => x.textContent.replace(/かんこく/, '')), ['韓国']);
  assert.ok(rubies(el).some(([b, r]) => b === '日' && r === 'にち'), '「日」은 보통 루비로');
  // 사람 이름(鷲尾先生)은 점선 없이 읽기만
  const el2 = R.renderJa('x', { s, mode: 'always', segs: [['鷲尾', 'わしお', 'P', 1], ['先生', 'せんせい', '4', 0], 'が'] });
  assert.equal(el2.all('.pn').length, 0);
  assert.ok(rubies(el2).some(([b, r]) => b === '鷲尾' || r === 'わしおせんせい'));
  assert.equal(nameInfo(s, { value: '鷲尾先生' }).kind, 'person');
});

test('T2: 풀이 — 아이는 학년이 바뀐다 (초등부 → 중학생 → 고등학생 → 졸업), 처음 소개에는 「처음 만났을 때」', () => {
  const s = life();
  const kid = () => nameInfo(s, { key: 'kid', value: personFor(s.cast, 'kid').call });
  const want = [[0, '초등부', '少年部'], [14, '중학생', '中学生'], [30, '고등학생', '高校生'], [36, '고등학교 졸업', '高校卒業']];
  for (const [t, ko, ja] of want) {
    s.t = t;
    const q = kid();
    assert.equal(q.roleKo, ko, `t=${t}`);
    assert.equal(q.roleJa, ja, `t=${t}`);
  }
  assert.ok(KID_STAGE.every(([, ko, ja]) => ko && ja));
  s.t = 36;
  const q = kid();
  const age = PEOPLE[s.cast.kid].age + 9;
  assert.match(q.koText, new RegExp(`^처음 만났을 때: .*지금 ${age}살이에요\\.$`));
  // 일본어 문단: 初めて会ったとき：… 今は18歳。
  const flat = q.jaText[0].map((x) => (Array.isArray(x) ? x.map((y) => (Array.isArray(y) ? y[0] : typeof y === 'string' ? y : '')).join('') : x)).join('');
  assert.match(flat, new RegExp(`^初めて会ったとき：.*今は${age}歳。$`));
  // 요즘 근황(이야기에서 바뀐 소식)
  s.news.kid = '중학교 검도부. 토요일에만 도장에 온다.';
  assert.equal(kid().nowKo, '요즘: 중학교 검도부. 토요일에만 도장에 온다.');
});

test('T2: 풀이 — 이어지는 세계의 千春さん은 지금 관계로 (사범의 배우자 → 노사범의 배우자, 남편이 없는 세대는 관계 없이)', () => {
  const s1 = life('gen1');
  const s = G.newLife({ seed: 'gen2', world: 'continue', legacy: G.legacyOf(s1) });
  G.beginLife(s);
  assert.equal(s.cast.okami, 'chiharu');
  assert.equal(s.cast.roshi, 'makoto');
  const q = nameInfo(s, { key: 'okami', value: personFor(s.cast, 'okami').call });
  assert.equal(q.desc, KO.okamiOfRoshi);
  assert.doesNotMatch(q.koText, /^사범의/);
  assert.ok(q.jaText[0].some((x) => Array.isArray(x) && x.some((y) => Array.isArray(y) && y[0] === '老師範')));
  // 1세대(남편이 사범): 원래 소개
  const g1 = nameInfo(s1, { key: 'okami', value: personFor(s1.cast, 'okami').call });
  assert.equal(g1.desc, PEOPLE.chiharu.desc);
  // 남편(坂上誠)이 없는 세대
  s.cast = { ...s.cast, roshi: 'hinata', shihan: 'youta' };
  const q3 = nameInfo(s, { key: 'okami', value: personFor(s.cast, 'okami').call });
  assert.equal(q3.desc, KO.okamiWork);
  assert.doesNotMatch(q3.koText, /배우자/);
});

test('T2: 풀이 — 이어지는 세계의 도장 소개는 「앞 세대 때」, 옮긴 도장·공민관은 그 사실을, 先代는 해가 갈수록', () => {
  const s1 = life('gen1');
  for (const dojo of DOJOS) {
    const legacy = { ...G.legacyOf(s1), dojo: dojo.id, dojoState: 'kominkan' };
    const s = G.newLife({ seed: 'gen2', world: 'continue', legacy });
    G.beginLife(s);
    const d = nameInfo(s, { key: 'D', value: s.world.dojoName });
    const cont = DOJO_LABEL_CONT[dojo.id];
    assert.equal(d.label, cont ? cont[0] : dojo.ko, dojo.id);
    assert.ok(d.koText.startsWith(cont ? KO.prevGenDojo : dojo.desc), dojo.id);
    assert.ok(d.koText.endsWith(KO.dojoKominkan), dojo.id);
    if (dojo.id === 'old') {
      // 소개 글 속 鷲尾는 이번 견생에 없는 앞 세대 사람
      const w = nameInfo(s, { value: '鷲尾先生' });
      assert.equal(w.kind, 'person');
      assert.ok(w.koText.startsWith(KO.prevGen));
    }
    // 先代: 이번 견생이 시작될 때 햇수 + 지난 해
    s.t = 9;
    const p = nameInfo(s, { key: 'P', value: s.prevDog.name });
    assert.match(p.koText, new RegExp(`건넌 지 ${s.world.yearsLater + 2}년`));
  }
  // 이름 없는 先代: 종류와 같은 말을 조각 풀이로 또 쓰지 않는다
  const fresh = life();
  const p0 = nameInfo(fresh, { key: 'P', value: '先代' });
  assert.equal(p0.kind, 'prevdog');
  assert.deepEqual(p0.parts, []);
});

test('T2: 풀이 — 가타카나 이름은 읽기를 되풀이하지 않는다 (ハン・ソジン（ハン・ソジン） 꼴 없음)', () => {
  const s = life();
  for (const role of ROLES) {
    const p = personFor(s.cast, role);
    const q = nameInfo(s, { key: role, value: p.call });
    if (q.full) assert.notEqual(q.fullReading, q.full, p.call);
  }
  const kor = nameInfo(s, { key: 'kor', value: personFor(s.cast, 'kor').call });
  assert.equal(kor.full, 'ハン・ソジン');
  assert.equal(kor.fullReading, null);
});

test('T2: 풀이 창 일본어 문장 표기 → 조각 (루비·점선 이름·자리표시자·숫자)', () => {
  assert.deepEqual(jaSegs('〔今|いま〕は%n〔歳|さい〕。', 18).filter((x) => typeof x === 'string'), ['は18', '。']);
  assert.deepEqual(jaSegs(JA.arcade)[0], { p: 'T', q: '' });
  assert.equal(jaSegs(JA.okamiOfRoshi).find((x) => Array.isArray(x) && x[0] === '坂上先生')[2], 'P');
  // 모든 문장의 루비 읽기는 히라가나
  for (const t of Object.values(JA)) for (const x of jaSegs(t)) if (Array.isArray(x)) assert.match(x[1], /^[ぁ-ゖー]+$/, x[0]);
});

test('T1: 머리줄 갈래 이름은 짧은 덩어리로만 줄을 바꾼다 (「全訳」 밑으로 넘치지 않게)', () => {
  for (const role of Object.keys(ROLE_JA)) {
    for (const c of R.catChunks(ROLE_JA[role])) assert.ok(c.length <= 6, `${ROLE_JA[role]}: ${c}`);
    for (const c of R.catChunks(ROLE_KO[role])) assert.ok(c.length <= 4, `${ROLE_KO[role]}: ${c}`);
  }
  assert.deepEqual(R.catChunks('韓国から来た門下生'), ['韓国から来た', '門下生']);
  assert.deepEqual(R.catChunks('사회인 수련생'), ['사회인', '수련생']);
});

test('T1: 서술 문단의 틈을 누르면 가장 가까운 문장', () => {
  const sp = (rects) => ({ getClientRects: () => rects });
  const a = sp([{ top: 0, bottom: 20, left: 0, right: 300 }, { top: 30, bottom: 50, left: 0, right: 120 }]);
  const b = sp([{ top: 30, bottom: 50, left: 120, right: 300 }]);
  assert.equal(R.nearestSpan([a, b], 200, 25), a, '줄 사이 틈: 위아래가 가까운 쪽');
  assert.equal(R.nearestSpan([a, b], 200, 52), b, '같은 줄: 옆 거리');
  assert.equal(R.nearestSpan([a, b], 330, 40), b, '줄 끝 빈자리');
});
