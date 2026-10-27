// 대사 템플릿 → 그 대사가 나온 장면(번역, 화자, 사건 제목). 학습 팝업과 복습 해설이 쓴다.
import { ALL_EVENTS } from '../data/index.js';
import { resolveKo } from '../engine/text.js';
import { personFor } from '../engine/world.js';
import { LINES } from './render.js';

let INDEX = null;
function build() {
  INDEX = new Map();
  const add = (l, e) => {
    if (Array.isArray(l) && !INDEX.has(l[1])) INDEX.set(l[1], { sp: l[0], ko: l[2], ev: e });
  };
  const walk = (ls, e) => {
    for (const l of ls || []) {
      if (Array.isArray(l)) add(l, e);
      else if (l) {
        walk(l.l, e);
        walk(l.else, e);
      }
    }
  };
  const wo = (o, e) => {
    if (!o) return;
    walk(o.lines, e);
    if (o.check) {
      wo(o.check.ok, e);
      wo(o.check.ng, e);
    }
  };
  for (const e of ALL_EVENTS) {
    walk(e.lines, e);
    for (const c of e.choices || []) wo(c, e);
    wo(e.brief, e);
  }
}

export function speakerName(sp, s) {
  if (!sp) return '';
  if (sp.startsWith('@')) return sp.slice(1);
  if (sp === 'dog') return s.dog.name;
  return personFor(s.cast, sp).ko;
}

// 템플릿의 장면 정보. s: 이름을 채울 상태
export function sceneOf(tpl, s) {
  if (!INDEX) build();
  const hit = INDEX.get(tpl);
  if (!hit) return null;
  const title = resolveKo(typeof hit.ev.title === 'string' ? hit.ev.title : '', { s });
  const who = speakerName(hit.sp, s);
  return { tpl, role: hit.sp, ko: resolveKo(hit.ko, { s }), sp: who, title, situation: `「${title}」에서 ${who}${/[가-힣]$/.test(who) ? (hasBatchim(who) ? '이' : '가') : '가'} 한 말` };
}

function hasBatchim(w) {
  const c = w.charCodeAt(w.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
}

// 학습 항목이 처음 나온 장면
export function firstSceneOf(id, s) {
  const ref = id.startsWith('g:') ? LINES.gidx[id.slice(2)] : LINES.vidx[id.slice(2)];
  return ref ? sceneOf(ref.tpl, s) : null;
}
