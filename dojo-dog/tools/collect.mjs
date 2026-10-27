// 콘텐츠 안의 모든 일본어 대사 템플릿과 한국어 해설을 모은다 (생성 도구와 테스트가 같이 쓴다).
import { ALL_EVENTS } from '../src/data/index.js';
import { FW } from '../src/data/farewell.js';

export function collect() {
  const ja = new Map(); // 템플릿 → 첫 등장 위치
  const speakers = new Set();
  const ko = []; // [텍스트, 위치]
  const addLine = (l, where) => {
    if (!Array.isArray(l)) return;
    const [sp, j, k] = l;
    if (typeof sp === 'string' && sp.startsWith('@')) speakers.add(sp.slice(1));
    if (!ja.has(j)) ja.set(j, where);
    ko.push([k, where, 'line']);
  };
  const walkLines = (ls, where) => {
    for (const l of ls || []) {
      if (Array.isArray(l)) addLine(l, where);
      else if (l) {
        walkLines(l.l, where);
        walkLines(l.else, where);
      }
    }
  };
  const walkText = (t, where, kind) => {
    if (!t) return;
    if (typeof t === 'string') ko.push([t, where, kind]);
    else if (Array.isArray(t)) for (const x of t) walkText(typeof x === 'string' ? x : x.v, where, kind);
  };
  const walkOut = (o, where) => {
    if (!o || typeof o !== 'object') return;
    walkText(o.res, where, 'res');
    walkLines(o.lines, where);
    if (o.check) {
      walkOut(o.check.ok, where);
      walkOut(o.check.ng, where);
    }
    if (o.ach) for (const a of Array.isArray(o.ach[0]) ? o.ach : [o.ach]) walkText(a[1], where, 'ach');
    if (o.news) for (const v of Object.values(o.news)) walkText(v, where, 'news');
    if (o.poolEmpty) walkText(o.poolEmpty, where, 'res');
  };
  for (const e of ALL_EVENTS) {
    walkText(e.title, e.id, 'title');
    walkText(e.text, e.id, 'text');
    walkLines(e.lines, e.id);
    for (const c of e.choices || []) {
      walkText(c.t, e.id, 'choice');
      walkOut(c, e.id);
    }
    walkOut(e.brief, e.id);
    walkOut(e.onShow, e.id);
    if (e.word) {
      walkText(e.word.q, e.id, 'word');
      for (const p of e.word.presets) walkText(p, e.id, 'word');
    }
  }
  for (const [k, l] of Object.entries(FW)) addLine(l, 'farewell.' + k);
  return { ja, speakers, ko };
}
