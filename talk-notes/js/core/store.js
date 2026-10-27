/* 학습 기록 저장 (기기 브라우저 localStorage, 녹음은 IndexedDB)
   서버·계정 없음. 다른 기기로 옮기려면 설정 → 백업 내보내기/가져오기 */
import { grade as srsGrade, dayNum, dayKey } from './srs.js';
import { parseKey, resolve } from './deck.js';

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
  sound: true           // 맞음·틀림 효과음
};

function blank() {
  return { v: 1, settings: Object.assign({}, DEFAULT_SETTINGS), srs: {}, stars: {}, memos: {}, log: {}, tagStats: {}, pron: {}, said: {}, resume: null, lastBackup: 0, created: Date.now() };
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
  for (const k of ['srs', 'stars', 'memos', 'log', 'tagStats', 'pron', 'said']) if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = {};
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
export function onChange(f) { listeners.add(f); return () => listeners.delete(f); }

export function todayLog() {
  const k = dayKey(dayNum());
  return S.log[k] || (S.log[k] = { n: 0, ok: 0, nw: 0, ms: 0, modes: {} });
}

/* 문제 하나 평가 기록. ok: 맞혔는지(평가 2 이상), ms: 걸린 시간 */
export function record(key, g, { ms = 0, said = null } = {}) {
  const prev = S.srs[key];
  const wasNew = !prev || !prev.n;
  S.srs[key] = srsGrade(prev, g);
  const L = todayLog();
  const ok = g >= 2;
  L.n++; if (ok) L.ok++; if (wasNew) L.nw++; L.ms += Math.min(ms, 5 * 60 * 1000);
  const { type } = parseKey(key);
  L.modes[type] = (L.modes[type] || 0) + 1;
  const r = resolve(key);
  if (r && r.card) for (const t of r.card.g) {
    const ts = S.tagStats[t] || (S.tagStats[t] = { n: 0, ok: 0 });
    ts.n++; if (ok) ts.ok++;
  }
  if (said != null && said !== '') S.said[key] = { s: String(said).slice(0, 400), t: Date.now() };
  save();
  return S.srs[key];
}

export function recordPron(word, ok, heard) {
  const p = S.pron[word] || (S.pron[word] = { n: 0, ok: 0, last: [] });
  p.n++; if (ok) p.ok++;
  p.last = [{ ok, h: String(heard || '').slice(0, 80), t: Date.now() }].concat(p.last || []).slice(0, 6);
  save();
}

export function toggleStar(id) { if (S.stars[id]) delete S.stars[id]; else S.stars[id] = Date.now(); save(); return !!S.stars[id]; }
export function setMemo(id, text) { const t = String(text || '').trim(); if (t) S.memos[id] = t.slice(0, 2000); else delete S.memos[id]; save(); }
export function setSetting(k, v) { S.settings[k] = v; save(); }
export function setResume(r) { S.resume = r; save(); }

/* 연속 학습일 */
export function streak(today = dayNum()) {
  let n = 0;
  for (let d = today; ; d--) {
    const L = S.log[dayKey(d)];
    if (L && L.n > 0) n++;
    else if (d === today) continue; // 오늘 아직 안 했어도 어제까지 이어졌으면 유지
    else break;
    if (n > 3650) break;
  }
  return n;
}

/* ── 백업 ─────────────────── */
export function exportJSON() {
  S.lastBackup = Date.now(); save(true);
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
