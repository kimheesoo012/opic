/* IndexedDB 저장소
   - 녹음 메타데이터(recordings)와 오디오(audio)를 나눠 저장: 목록·통계는 오디오를 읽지 않고 빠르게
   - 녹음 중에는 1초 조각(chunks)을 계속 저장 → 앱이 강제 종료돼도 다음 실행 때 복구
   - IndexedDB를 쓸 수 없으면(일부 사생활 보호 모드 등) 메모리 저장으로 동작하고 경고 */
(function (root) {
  'use strict';
  const DB_NAME = 'opic-practice';
  const DB_VER = 1;
  const STORES = {
    recordings: { keyPath: 'id', indexes: [['questionId', 'questionId'], ['createdAt', 'createdAt']] },
    audio: { keyPath: 'id' },
    qstate: { keyPath: 'qid' },
    notes: { keyPath: 'id' },
    scripts: { keyPath: 'id' },
    sessions: { keyPath: 'id' },
    kv: { keyPath: 'k' },
    drafts: { keyPath: 'recId' },
    chunks: { keyPath: ['recId', 'seq'], indexes: [['recId', 'recId']] }
  };

  let dbp = null;
  let memory = null; // 폴백

  function friendly(err) {
    if (!err) return new Error('저장 중 알 수 없는 오류');
    const name = err.name || '';
    if (name === 'QuotaExceededError' || /quota/i.test(err.message || '')) {
      const e = new Error('저장 공간이 부족해 저장하지 못했습니다. 기존 기록은 그대로입니다. 「기록」 화면에서 오래된 녹음을 내보낸 뒤 지워 주세요.');
      e.quota = true; return e;
    }
    return err;
  }

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      if (!root.indexedDB) { memory = {}; return resolve(null); }
      let req;
      try { req = root.indexedDB.open(DB_NAME, DB_VER); } catch (e) { memory = {}; return resolve(null); }
      req.onupgradeneeded = () => {
        const db = req.result;
        Object.keys(STORES).forEach(name => {
          if (db.objectStoreNames.contains(name)) return;
          const os = db.createObjectStore(name, { keyPath: STORES[name].keyPath });
          (STORES[name].indexes || []).forEach(([n, k]) => os.createIndex(n, k));
        });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); };
        resolve(db);
      };
      req.onerror = () => { memory = {}; resolve(null); };
      req.onblocked = () => {};
    });
    return dbp;
  }
  function mem(store) { memory[store] = memory[store] || new Map(); return memory[store]; }
  function memKey(store, v) { const kp = STORES[store].keyPath; return Array.isArray(kp) ? kp.map(k => v[k]).join('|') : v[kp]; }
  function clone(v) { try { return structuredClone(v); } catch (e) { return v; } }

  function reqP(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(friendly(r.error)); }); }

  async function tx(stores, mode, fn) {
    const db = await open();
    if (!db) return fn(null);
    return new Promise((resolve, reject) => {
      let t, result;
      try { t = db.transaction(stores, mode); } catch (e) { return reject(friendly(e)); }
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(friendly(t.error));
      t.onabort = () => reject(friendly(t.error));
      Promise.resolve(fn(t)).then(r => { result = r; }).catch(e => { try { t.abort(); } catch (_) {} reject(friendly(e)); });
    });
  }

  const api = {
    open,
    isMemory: () => memory !== null,
    async get(store, key) {
      const db = await open();
      if (!db) return clone(mem(store).get(Array.isArray(key) ? key.join('|') : key));
      return tx([store], 'readonly', t => reqP(t.objectStore(store).get(key)));
    },
    async put(store, value) {
      const db = await open();
      if (!db) { mem(store).set(memKey(store, value), clone(value)); return; }
      return tx([store], 'readwrite', t => { t.objectStore(store).put(value); });
    },
    async del(store, key) {
      const db = await open();
      if (!db) { mem(store).delete(key); return; }
      return tx([store], 'readwrite', t => { t.objectStore(store).delete(key); });
    },
    async all(store) {
      const db = await open();
      if (!db) return Array.from(mem(store).values()).map(clone);
      return tx([store], 'readonly', t => reqP(t.objectStore(store).getAll()));
    },
    async byIndex(store, index, value) {
      const db = await open();
      if (!db) return Array.from(mem(store).values()).filter(v => v[index] === value).map(clone);
      return tx([store], 'readonly', t => reqP(t.objectStore(store).index(index).getAll(value)));
    },
    /* 녹음 저장: 메타와 오디오를 한 트랜잭션으로 (둘 중 하나만 저장되는 일이 없게) */
    async saveRecording(meta, blob) {
      const db = await open();
      if (!db) { mem('recordings').set(meta.id, meta); if (blob) mem('audio').set(meta.id, { id: meta.id, blob }); return; }
      return tx(['recordings', 'audio'], 'readwrite', t => {
        t.objectStore('recordings').put(meta);
        if (blob) t.objectStore('audio').put({ id: meta.id, blob });
      });
    },
    async deleteRecording(id) {
      const db = await open();
      if (!db) { mem('recordings').delete(id); mem('audio').delete(id); return; }
      return tx(['recordings', 'audio'], 'readwrite', t => { t.objectStore('recordings').delete(id); t.objectStore('audio').delete(id); });
    },
    async getAudio(id) { const a = await api.get('audio', id); return a ? a.blob : null; },
    /* 녹음 중 조각 저장 */
    async putChunk(recId, seq, blob) {
      const db = await open();
      if (!db) { mem('chunks').set(recId + '|' + seq, { recId, seq, blob }); return; }
      return tx(['chunks'], 'readwrite', t => { t.objectStore('chunks').put({ recId, seq, blob }); });
    },
    async getChunks(recId) {
      const db = await open();
      if (!db) return Array.from(mem('chunks').values()).filter(c => c.recId === recId).sort((a, b) => a.seq - b.seq);
      const list = await tx(['chunks'], 'readonly', t => reqP(t.objectStore('chunks').index('recId').getAll(recId)));
      return list.sort((a, b) => a.seq - b.seq);
    },
    async clearDraft(recId) {
      const db = await open();
      if (!db) { mem('drafts').delete(recId); Array.from(mem('chunks').keys()).forEach(k => { if (k.startsWith(recId + '|')) mem('chunks').delete(k); }); return; }
      return tx(['drafts', 'chunks'], 'readwrite', t => {
        t.objectStore('drafts').delete(recId);
        const idx = t.objectStore('chunks').index('recId');
        const r = idx.openKeyCursor(IDBKeyRange.only(recId));
        r.onsuccess = () => { const c = r.result; if (c) { t.objectStore('chunks').delete(c.primaryKey); c.continue(); } };
      });
    },
    /* 가져오기: 모든 저장소를 한 트랜잭션으로 → 중간에 실패하면 전부 취소(기존 기록 보호) */
    async importAll(data, audioList) {
      const db = await open();
      const names = ['recordings', 'qstate', 'notes', 'scripts', 'sessions', 'kv'];
      if (!db) {
        names.forEach(s => (data[s] || []).forEach(v => mem(s).set(memKey(s, v), v)));
        (audioList || []).forEach(a => mem('audio').set(a.id, a));
        return;
      }
      return tx(names.concat(['audio']), 'readwrite', t => {
        names.forEach(s => (data[s] || []).forEach(v => t.objectStore(s).put(v)));
        (audioList || []).forEach(a => t.objectStore('audio').put(a));
      });
    },
    async kvGet(k, def) { const r = await api.get('kv', k); return r ? r.v : def; },
    async kvSet(k, v) { return api.put('kv', { k, v }); }
  };

  root.OPIC = root.OPIC || {};
  root.OPIC.db = api;
})(typeof window !== 'undefined' ? window : globalThis);
