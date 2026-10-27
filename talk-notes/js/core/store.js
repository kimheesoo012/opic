/* 학습 기록 저장 (기기 브라우저 localStorage, 녹음은 IndexedDB)
   서버·계정 없음. 다른 기기로 옮기려면 설정 → 백업 내보내기/가져오기 */
import { grade as srsGrade, dayNum, dayKey } from './srs.js';
import { parseKey, resolve } from './deck.js';
import { xpFor, levelOf, applyFreeze, streakOn, checkBadges, masteredCount, FREEZE_MAX, FREEZE_EVERY } from './game.js';

const KEY = 'talknotes:v1';
export const DEFAULT_SETTINGS = {
  theme: 'system',      // system | light | dark
  voice: '',            // 영어 음성 이름 (비우면 가장 좋은 음성 자동)
  rate: 0.9,            // 읽기 속도
  stt: true,            // 음성 인식으로 채점
  record: false,        // 내 목소리 녹음해서 다시 듣기
  autoplay: true,       // 정답을 펼치면 자연스러운 표현 읽어 주기
  hideKr: false,        // 노트에서 해석 가리기
  hideN: false,         // 노트에서 자연스러운 표현 가리기
  newPerDay: 15,        // 하루 새 카드 수
  sessionSize: 20,      // 한 번에 풀 문제 수
  newOrder: 'recent',   // recent | first | weak | random
  goal: 30,             // 하루 목표 문제 수
  sound: true,          // 맞음·틀림 효과음
  remindAt: '21:00'     // 매일 알림 시각(캘린더 파일)
};

function blank() {
  return { v: 2, settings: Object.assign({}, DEFAULT_SETTINGS), srs: {}, stars: {}, memos: {}, log: {}, tagStats: {}, pron: {}, said: {}, resume: null, lastBackup: 0, created: Date.now(),
    xp: 0, badges: {}, freezes: 0, freezeAt: 0, bestCombo: 0 };
}

export const S = blank();
let memoryOnly = false;
const listeners = new Set();

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { memoryOnly = true; }
  if (raw) {
    try { Object.assign(S, migrate(JSON.parse(raw))); }
    catch (e) { console.warn('기록을 읽지 못해 새로 시작합니다', e); try { localStorage.setItem(KEY + ':broken:' + Date.now(), raw); } catch (_) {} }
  }
  return S;
}
export function isMemoryOnly() { return memoryOnly; }

function migrate(d) {
  const b = blank();
  if (!d || typeof d !== 'object') return b;
  const out = Object.assign(b, d);
  out.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
  for (const k of ['srs', 'stars', 'memos', 'log', 'tagStats', 'pron', 'said', 'badges']) if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = {};
  for (const k of ['xp', 'freezes', 'freezeAt', 'bestCombo']) if (typeof out[k] !== 'number' || !(out[k] >= 0)) out[k] = 0;
  // v1 기록: XP가 없던 때의 문제 풀이에 기본 XP를 소급
  if (!d.v || d.v < 2) { let xp = 0; for (const l of Object.values(out.log)) { l.xp = (l.ok || 0) * 10 + ((l.n || 0) - (l.ok || 0)) * 2; xp += l.xp; } out.xp = xp; out.v = 2; }
  return out;
}

let saveTimer = null;
export function save(now = false) {
  clearTimeout(saveTimer);
  const run = () => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { memoryOnly = true; }
    listeners.forEach(f => { try { f(S); } catch (_) {} });
  };
  if (now) run(); else saveTimer = setTimeout(run, 150);
}
/* 화면을 벗어나거나 앱이 가려질 때 바로 저장 (150ms 지연 중 닫히면 잃을 수 있어서) */
if (typeof document !== 'undefined') {
  const flush = () => { if (saveTimer) save(true); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
}
export function onChange(f) { listeners.add(f); return () => listeners.delete(f); }

export function todayLog() {
  const k = dayKey(dayNum());
  return S.log[k] || (S.log[k] = { n: 0, ok: 0, nw: 0, ms: 0, xp: 0, modes: {} });
}

/* 문제 하나 평가 기록. 돌려주는 값: {xp, combo, levelUp, goalHit, streak, badges, frozen} — 세션 화면이 보여 준다 */
export function record(key, g, { ms = 0, said = null, combo = 0 } = {}) {
  const prev = S.srs[key];
  const wasNew = !prev || !prev.n;
  S.srs[key] = srsGrade(prev, g);
  const L = todayLog();
  const ok = g >= 2;
  const firstToday = L.n === 0;
  const lvBefore = levelOf(S.xp);
  const goalBefore = L.n >= S.settings.goal;
  let frozen = [];
  if (firstToday) frozen = applyFreeze(S);
  L.n++; if (ok) L.ok++; if (wasNew) L.nw++; L.ms += Math.min(ms, 5 * 60 * 1000);
  const { type } = parseKey(key);
  L.modes[type] = (L.modes[type] || 0) + 1;
  const r = resolve(key);
  if (r && r.card) for (const t of r.card.g) {
    const ts = S.tagStats[t] || (S.tagStats[t] = { n: 0, ok: 0 });
    ts.n++; if (ok) ts.ok++;
  }
  if (said != null && said !== '') S.said[key] = { s: String(said).slice(0, 400), t: Date.now() };
  // XP
  let xp = xpFor(g, { wasNew, combo });
  if (firstToday) xp += 10;
  const goalHit = !goalBefore && L.n >= S.settings.goal;
  if (goalHit) xp += 30;
  L.xp = (L.xp || 0) + xp; S.xp += xp;
  if (combo > S.bestCombo) S.bestCombo = combo;
  L.m = masteredCount(S);
  // 7일 연속마다 휴식권
  const streak = streakOn(S);
  let freezeGot = false;
  if (streak > 0 && streak % FREEZE_EVERY === 0 && S.freezeAt !== streak && S.freezes < FREEZE_MAX) { S.freezes++; S.freezeAt = streak; freezeGot = true; }
  const badges = checkBadges(S);
  save();
  return { xp, combo, levelUp: levelOf(S.xp) > lvBefore ? levelOf(S.xp) : 0, goalHit, streak, badges, frozen, freezeGot, firstToday };
}

export function recordPron(word, ok, heard) {
  const p = S.pron[word] || (S.pron[word] = { n: 0, ok: 0, last: [] });
  p.n++; if (ok) p.ok++;
  p.last = [{ ok, h: String(heard || '').slice(0, 80), t: Date.now() }].concat(p.last || []).slice(0, 6);
  save();
  return checkBadges(S);
}

export function toggleStar(id) { if (S.stars[id]) delete S.stars[id]; else S.stars[id] = Date.now(); checkBadges(S); save(); return !!S.stars[id]; }
export function setMemo(id, text) { const t = String(text || '').trim(); if (t) S.memos[id] = t.slice(0, 2000); else delete S.memos[id]; save(); }
export function setSetting(k, v) { S.settings[k] = v; save(); }
export function setResume(r) { S.resume = r; save(); }

/* 연속 학습일 (휴식권으로 지킨 날 포함) */
export function streak(today = dayNum()) { return streakOn(S, today); }

/* ── 백업 ─────────────────── */
export function exportJSON() {
  S.lastBackup = Date.now(); checkBadges(S); save(true);
  return JSON.stringify({ app: 'talk-notes', exported: new Date().toISOString(), data: S }, null, 1);
}
/* 가져오기: 먼저 parseBackup으로 확인하고(잘못된 파일이면 오류), applyBackup으로 바꾼다 */
export function parseBackup(text) {
  let d;
  try { d = JSON.parse(text); } catch (e) { throw new Error('JSON 파일이 아니에요.'); }
  if (!d || d.app !== 'talk-notes' || !d.data || typeof d.data.srs !== 'object') throw new Error('이 앱에서 내보낸 백업 파일이 아니에요.');
  for (const [k, v] of Object.entries(d.data.srs)) {
    if (!v || typeof v.n !== 'number' || typeof v.d !== 'number' || typeof v.i !== 'number') throw new Error('기록 형식이 맞지 않아요: ' + k);
  }
  return d.data;
}
export function applyBackup(data) {
  const m = migrate(data);
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, m);
  save(true);
  return Object.keys(S.srs).length;
}
export function resetAll() {
  const keep = S.settings;
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, blank(), { settings: keep });
  save(true);
}

/* ── 녹음 (IndexedDB): 문제마다 마지막 녹음 하나 ─── */
let dbp = null;
function idb() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('no idb'));
    const r = indexedDB.open('talknotes', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('rec');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx(mode, fn) {
  return idb().then(db => new Promise((res, rej) => {
    const t = db.transaction('rec', mode);
    const st = t.objectStore('rec');
    const out = fn(st);
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  }));
}
export const rec = {
  put: (key, blob) => tx('readwrite', st => st.put({ blob, type: blob.type, t: Date.now() }, key)),
  get: key => tx('readonly', st => st.get(key)).catch(() => null),
  del: key => tx('readwrite', st => st.delete(key)),
  keys: () => tx('readonly', st => st.getAllKeys()).catch(() => []),
  clear: () => tx('readwrite', st => st.clear())
};
