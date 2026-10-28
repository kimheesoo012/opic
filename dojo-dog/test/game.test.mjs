// 게임 화면 렌더링 검사 (render.js · playquiz.js): 루비 합치기, 첫 글자 맞춤, 확인 문제의 「읽기를 이미 봤나」 판단
// 브라우저 없이 돌리기 위해 esbuild로 묶고(lines.json 포함), 아주 작은 DOM 흉내를 쓴다.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LINES = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/gen/lines.json'), 'utf8'));

// ── 작은 DOM 흉내: render.js가 쓰는 만큼만
class Node {
  constructor() {
    this.parentNode = null;
  }
  get nextSibling() {
    const p = this.parentNode;
    if (!p) return null;
    const i = p.childNodes.indexOf(this);
    return p.childNodes[i + 1] || null;
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
  // 아주 단순한 찾기: 태그 이름 또는 .클래스 하나
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
globalThis.Node = Node;
globalThis.document = { createElement: (t) => new Element(t), createTextNode: (v) => new Text(v) };

let R; // render.js
let Q; // playquiz.js
before(async () => {
  // 다른 화면(N2 대책·해설) 모듈은 이 검사와 무관하므로 빈 모듈로 바꿔 끼운다
  const stub = {
    name: 'stub-ui',
    setup(b) {
      b.onResolve({ filter: /\/(n2ui|explainui)\.js$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const richQ = (x) => x; export const explainView = () => null;', loader: 'js' }));
    },
  };
  const entry = "export * from './src/ui/render.js'; export { quizCtx, planQuiz } from './src/ui/playquiz.js';";
  const out = await esbuild.build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'js' }, bundle: true, format: 'esm', platform: 'neutral', write: false, loader: { '.json': 'json' }, plugins: [stub], logLevel: 'silent' });
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-game-test-')), 'bundle.mjs');
  fs.writeFileSync(file, out.outputFiles[0].text);
  const mod = await import(pathToFileURL(file).href);
  R = mod;
  Q = mod;
});

const rubies = (el) => el.all('ruby').map((r) => [r.childNodes.filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(''), r.all('rt').map((x) => x.textContent).join('')]);
const tplWith = (re) => Object.keys(LINES.lines).find((k) => re.test(k));

test('J9: 나뉜 한자 조각(観客|席, 試合|場)은 루비 하나로 그린다', () => {
  const tpl = '観客席のすみで、すき間から試合場が見える。';
  assert.ok(LINES.lines[tpl], '검사용 대사가 있어야 한다');
  const got = rubies(R.renderJa(tpl, { s: null, mode: 'always' }));
  assert.deepEqual(got, [['観客席', 'かんきゃくせき'], ['間', 'ま'], ['試合場', 'しあいじょう'], ['見', 'み']]);
  // 설정이 그 말에 루비를 달지 않으면 합치지도 않는다 (N3·N4 말은 「N2以上」에서 루비 없음)
  assert.deepEqual(rubies(R.renderJa(tpl, { s: null, mode: 'n2' })), []);
  assert.deepEqual(rubies(R.renderJa(tpl, { s: null, mode: 'off' })), []);
});

test('J9: 학습 밑줄 단어 안의 조각(誕生|日)도 루비 하나, 밑줄 단추는 그대로', () => {
  const tpl = tplWith(/^\[本当\]の\[誕生日\]/);
  assert.ok(tpl);
  const el = R.renderJa(tpl, { s: null, mode: 'always', targets: new Set(['v:誕生日']) });
  const w = el.all('.w');
  assert.equal(w.length, 1);
  assert.equal(w[0].getAttribute('data-k'), '誕生日');
  assert.deepEqual(rubies(w[0]), [['誕生日', 'たんじょうび']]);
});

test('J9: 이어진 이름 조각(坂上|剣道場)은 이름 하나', () => {
  const el = document.createElement('p');
  el.append(...R.nameNodes('坂上剣道場', 'always'));
  const pn = el.all('.pn');
  assert.equal(pn.length, 1);
  assert.equal(pn[0].getAttribute('data-r'), 'さかがみけんどうじょう');
  assert.deepEqual(rubies(el), [['坂上剣道場', 'さかがみけんどうじょう']]);
  assert.deepEqual(R.joinNames(['道場', ['坂上', 'さかがみ'], ['先生', 'せんせい'], 'は']), ['道場', ['坂上先生', 'さかがみせんせい'], 'は']);
});

test('J9: 합치는 것은 둘 다 루비를 다는 한자 조각끼리만 (글자·고유명사·루비 없는 조각 사이는 합치지 않는다)', () => {
  const a = ['観客', 'かんきゃく', '3', 0];
  const b = ['席', 'せき', '3', 0];
  const hard = ['審', 'しん', '1', 1];
  assert.deepEqual(R.mergeRuby([a, b], 'always'), [{ merge: true, base: '観客席', reading: 'かんきゃくせき' }]);
  assert.deepEqual(R.mergeRuby([a, 'の', b], 'always'), [{ merge: true, base: '観客', reading: 'かんきゃく' }, 'の', { merge: true, base: '席', reading: 'せき' }]);
  // 「N2以上」: 審(N1)만 루비 → 앞의 観客(N3)과 합치지 않는다
  assert.deepEqual(R.mergeRuby([a, hard], 'n2'), [a, { merge: true, base: '審', reading: 'しん' }]);
  assert.deepEqual(R.mergeRuby([['坂上', 'さかがみ', 'P', 0], b], 'always'), [['坂上', 'さかがみ', 'P', 0], { merge: true, base: '席', reading: 'せき' }]);
});

test('J9: 모든 대사에서 루비 표기는 한자만, 합쳐도 읽기 글자는 그대로', () => {
  let merged = 0;
  for (const [tpl, segs] of Object.entries(LINES.lines).slice(0, 1500)) {
    const el = R.renderJa(tpl, { s: null, mode: 'always', segs: segs.filter((x) => !(x && x.p)) });
    for (const [base, rt] of rubies(el)) {
      assert.match(base, /^[一-鿿々〆ヶ]+$/, tpl);
      assert.ok(rt.length > 0, tpl);
    }
    const flat = [];
    const walk = (list) => list.forEach((x) => (Array.isArray(x) ? flat.push(x) : x && x.s ? walk(x.s) : null));
    walk(segs.filter((x) => !(x && x.p)));
    // 루비 읽기를 이으면 조각 읽기를 이은 것과 같다 (빠지거나 겹친 읽기 없음. 「いつも」는 고유명사 조각에도 읽기를 단다)
    assert.equal(rubies(el).map((x) => x[1]).join(''), flat.map((x) => x[1]).join(''), tpl);
    merged += flat.length - rubies(el).length;
  }
  assert.ok(merged > 100, `합쳐진 조각 ${merged}`);
});

test('J9: 글 첫 글자 맞춤 — 첫 루비는 lead, 여는 괄호는 hang', () => {
  const t1 = R.markLead(R.renderJa('「もう剣道、やだ」', { s: null, mode: 'always', segs: LINES.lines['「もう剣道、やだ」'] || ['「もう', ['剣道', 'けんどう', '3', 0], '、やだ」'] }));
  const hang = t1.all('.hang');
  assert.equal(hang.length, 1);
  assert.equal(hang[0].textContent, '「');
  assert.ok(t1.textContent.startsWith('「もう'), '글자는 그대로');
  const t2 = R.markLead(R.renderJa('x', { s: null, mode: 'always', segs: [['誕生日', 'たんじょうび', '3', 0], 'のケーキ'] }));
  assert.ok(t2.all('ruby')[0].classList.contains('lead'));
  // 밑줄 단추 안의 첫 루비도
  const t3 = R.markLead(R.renderJa('x', { s: null, mode: 'always', segs: [{ v: '誕生日', s: [['誕生', 'たんじょう', '3', 0], ['日', 'び', '4', 0]] }, 'だ'] }));
  assert.ok(t3.all('ruby')[0].classList.contains('lead'));
  // 첫 글자가 가나면 아무것도 바꾸지 않는다
  const t4 = R.markLead(R.renderJa('x', { s: null, mode: 'always', segs: ['かばんの', ['中', 'なか', '4', 0]] }));
  assert.equal(t4.all('.hang').length + t4.all('ruby').filter((r) => r.classList.contains('lead')).length, 0);
});

test('L3: 화면에 루비를 단 학습 대상만 rubySeen에 — 화면과 같은 판단', () => {
  for (const mode of ['always', 'n2', 'hard', 'off']) {
    let checked = 0;
    for (const [tpl, segs] of Object.entries(LINES.lines).slice(0, 2500)) {
      const ids = segs.filter((x) => x && (x.v || x.g)).map((x) => (x.v ? 'v:' + x.v : 'g:' + x.g));
      if (!ids.length) continue;
      const rubySeen = new Set();
      const el = R.renderJa(tpl, { s: null, mode, targets: new Set(ids), rubySeen, segs: segs.filter((x) => !(x && x.p)) });
      for (const b of [...el.all('.w'), ...el.all('.gm')]) {
        const id = b.getAttribute('data-k') ? 'v:' + b.getAttribute('data-k') : 'g:' + b.getAttribute('data-g');
        assert.equal(rubySeen.has(id), b.all('ruby').length > 0, `${mode} ${id} ${tpl}`);
        checked++;
      }
    }
    assert.ok(checked > 200, `${mode}: ${checked}`);
  }
});

test('L3: 확인 문제 문맥에 rubyShown을 넘긴다 (방금 루비를 본 말만 true)', () => {
  const tpl = tplWith(/^\[本当\]の\[誕生日\]/);
  const seen = new Set();
  R.renderJa(tpl, { s: null, mode: 'always', targets: new Set(['v:誕生日']), rubySeen: seen });
  assert.ok(seen.has('v:誕生日'));
  assert.equal(Q.quizCtx('v:誕生日', tpl, false, seen).rubyShown, true);
  assert.equal(Q.quizCtx('v:誕生日', tpl, false, new Set()).rubyShown, false);
  assert.equal(Q.quizCtx('v:誕生日', tpl, false, null).rubyShown, false);
  // 후리가나를 끈 설정: 보지 않았으므로 false
  const off = new Set();
  R.renderJa(tpl, { s: null, mode: 'off', targets: new Set(['v:誕生日']), rubySeen: off });
  assert.equal(Q.quizCtx('v:誕生日', tpl, false, off).rubyShown, false);
  // 나머지 문맥은 그대로
  const c = Q.quizCtx('v:誕生日', tpl, true, seen);
  assert.equal(c.hasScene, true);
  assert.equal(c.jaOnly, true);
});

test('J9: 합치지 못하고 붙은 두 루비(밑줄 단어|다음 조각)는 마주 보는 쪽으로 rt를 걸치지 않는다', () => {
  const tpl = '営業職の会社員。';
  assert.ok(LINES.lines[tpl]);
  const el = R.renderJa(tpl, { s: null, mode: 'always', targets: new Set(['v:営業']) });
  const rs = el.all('ruby');
  assert.deepEqual(rubies(el), [['営業', 'えいぎょう'], ['職', 'しょく'], ['会社員', 'かいしゃいん']]);
  assert.ok(rs[0].classList.contains('ne') && !rs[0].classList.contains('ns'));
  assert.ok(rs[1].classList.contains('ns') && !rs[1].classList.contains('ne'));
  // 가나를 사이에 둔 루비는 그대로 걸칠 수 있다
  assert.ok(!rs[2].classList.contains('ns') && !rs[2].classList.contains('ne'));
});
