// 학습 기록 저장소. IndexedDB 우선, 안 되면 localStorage, 테스트에서는 메모리.
import { newGame } from './game.js';
export const SCHEMA_VERSION = 1;
export const APP_ID = 'toeic-trainer-ja';

const KV_KEYS = ['profile', 'settings', 'reviews', 'wrongNote', 'vocab', 'scoreHistory', 'sessions', 'studyLog', 'game', 'active'];

export function defaultState() {
  return {
    profile: { goal: 730, rcScore: 300, lcBase: 350, onboarded: false, createdAt: Date.now() },
    settings: { theme: 'auto', course: 20, sound: true, passageTrans: false },
    attempts: [],
    reviews: {},
    wrongNote: {},
    vocab: {},
    scoreHistory: [],
    sessions: [],
    studyLog: {},
    game: newGame(),
    active: null,
  };
}

// ---- 어댑터 ----
export function memoryAdapter() {
  const kv = new Map();
  let attempts = [];
  return {
    kind: 'memory',
    async loadAll() { return { kv: Object.fromEntries(kv), attempts: attempts.slice() }; },
    async put(key, val) { kv.set(key, JSON.parse(JSON.stringify(val))); },
    async putAttempt(a) {
      const i = attempts.findIndex((x) => x.id === a.id);
      if (i >= 0) attempts[i] = { ...a }; else attempts.push({ ...a });
    },
    async replaceAll(state) {
      kv.clear();
      for (const k of KV_KEYS) kv.set(k, JSON.parse(JSON.stringify(state[k])));
      attempts = state.attempts.slice();
    },
  };
}

export function lsAdapter(ls = globalThis.localStorage) {
  const P = 'ttja:';
  return {
    kind: 'localStorage',
    async loadAll() {
      const kv = {};
      for (const k of KV_KEYS) {
        const v = ls.getItem(P + k);
        if (v != null) kv[k] = JSON.parse(v);
      }
      const at = ls.getItem(P + 'attempts');
      return { kv, attempts: at ? JSON.parse(at) : [] };
    },
    async put(key, val) { ls.setItem(P + key, JSON.stringify(val)); },
    async putAttempt(a) {
      const at = JSON.parse(ls.getItem(P + 'attempts') || '[]');
      const i = at.findIndex((x) => x.id === a.id);
      if (i >= 0) at[i] = a; else at.push(a);
      ls.setItem(P + 'attempts', JSON.stringify(at));
    },
    async replaceAll(state) {
      for (const k of KV_KEYS) ls.setItem(P + k, JSON.stringify(state[k]));
      ls.setItem(P + 'attempts', JSON.stringify(state.attempts));
    },
  };
}

function reqP(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

export async function idbAdapter(name = 'toeic-trainer-ja') {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('attempts')) d.createObjectStore('attempts', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('IndexedDB blocked'));
  });
  const tx = (stores, mode) => db.transaction(stores, mode);
  return {
    kind: 'indexedDB',
    async loadAll() {
      const t = tx(['kv', 'attempts'], 'readonly');
      const kvStore = t.objectStore('kv');
      const keys = await reqP(kvStore.getAllKeys());
      const vals = await reqP(kvStore.getAll());
      const kv = {};
      keys.forEach((k, i) => { kv[k] = vals[i]; });
      const attempts = await reqP(t.objectStore('attempts').getAll());
      return { kv, attempts };
    },
    async put(key, val) {
      const t = tx(['kv'], 'readwrite');
      t.objectStore('kv').put(JSON.parse(JSON.stringify(val)), key);
      await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
    },
    async putAttempt(a) {
      const t = tx(['attempts'], 'readwrite');
      t.objectStore('attempts').put(JSON.parse(JSON.stringify(a)));
      await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
    },
    async replaceAll(state) {
      const t = tx(['kv', 'attempts'], 'readwrite');
      const kv = t.objectStore('kv');
      const at = t.objectStore('attempts');
      kv.clear();
      at.clear();
      for (const k of KV_KEYS) kv.put(JSON.parse(JSON.stringify(state[k])), k);
      for (const a of state.attempts) at.put(a);
      await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
    },
  };
}

// ---- 저장소 ----
export async function openStore(adapter) {
  const state = defaultState();
  const { kv, attempts } = await adapter.loadAll();
  for (const k of KV_KEYS) {
    if (kv[k] !== undefined && kv[k] !== null) {
      state[k] = typeof state[k] === 'object' && !Array.isArray(state[k]) && state[k] !== null ? { ...state[k], ...kv[k] } : kv[k];
    }
  }
  if (kv.active === null) state.active = null;
  state.attempts = attempts || [];
  const store = {
    state,
    adapter,
    async save(key) { await adapter.put(key, state[key]); },
    async saveMany(keys) { for (const k of keys) await adapter.put(k, state[k]); },
    // 같은 id면 갱신(오답 원인 태그 등), 없으면 추가
    async putAttempt(a) {
      const i = state.attempts.findIndex((x) => x.id === a.id);
      if (i >= 0) state.attempts[i] = a; else state.attempts.push(a);
      await adapter.putAttempt(a);
    },
    exportData(appVersion) {
      const data = {};
      for (const k of KV_KEYS) if (k !== 'active') data[k] = state[k];
      data.attempts = state.attempts;
      return { app: APP_ID, schema: SCHEMA_VERSION, appVersion, exportedAt: new Date().toISOString(), data };
    },
    // 검증을 통과한 경우에만 교체한다. 실패하면 기존 기록은 그대로.
    async importData(obj) {
      const errs = validateImport(obj);
      if (errs.length) return { ok: false, errors: errs };
      const next = defaultState();
      for (const k of KV_KEYS) if (k !== 'active' && obj.data[k] !== undefined) next[k] = obj.data[k];
      next.profile = { ...defaultState().profile, ...obj.data.profile };
      next.settings = { ...defaultState().settings, ...obj.data.settings };
      next.game = { ...newGame(), ...(isObj(obj.data.game) ? obj.data.game : {}) };
      next.attempts = obj.data.attempts.map((a, i) => (a.id ? a : { ...a, id: `imp-${i}-${a.t}` }));
      next.active = null;
      await adapter.replaceAll(next);
      Object.assign(state, next);
      return { ok: true, count: next.attempts.length };
    },
    async reset() {
      const next = defaultState();
      await adapter.replaceAll(next);
      Object.assign(state, next);
    },
  };
  return store;
}

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

export function validateImport(obj) {
  const errs = [];
  if (!isObj(obj)) return ['JSONオブジェクトではありません。'];
  if (obj.app !== APP_ID) errs.push('このアプリから書き出したファイルではありません。');
  if (!Number.isInteger(obj.schema)) errs.push('バージョン情報がありません。');
  else if (obj.schema > SCHEMA_VERSION) errs.push(`新しいバージョン${obj.schema}のファイルです。アプリを更新すると読み込めます。`);
  if (!isObj(obj.data)) return [...errs, 'data項目がありません。'];
  const d = obj.data;
  if (!Array.isArray(d.attempts)) errs.push('attemptsが配列ではありません。');
  else {
    const bad = d.attempts.findIndex((a) => !isObj(a) || typeof a.qid !== 'string' || typeof a.correct !== 'boolean' || !Number.isFinite(a.t) || !Number.isInteger(a.part));
    if (bad >= 0) errs.push(`attempts[${bad}] 形式エラー`);
  }
  for (const k of ['profile', 'settings', 'reviews', 'wrongNote', 'vocab', 'studyLog', 'game']) {
    if (d[k] !== undefined && !isObj(d[k])) errs.push(`${k} 形式エラー`);
  }
  for (const k of ['scoreHistory', 'sessions']) {
    if (d[k] !== undefined && !Array.isArray(d[k])) errs.push(`${k} 形式エラー`);
  }
  if (isObj(d.profile) && d.profile.goal !== undefined && !Number.isFinite(d.profile.goal)) errs.push('目標スコア形式エラー');
  return errs;
}
