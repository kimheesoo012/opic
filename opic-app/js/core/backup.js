/* 기록 JSON 내보내기·가져오기 형식 검증 (순수 로직)
   잘못된 파일이면 아무것도 바꾸지 않도록, 가져오기 전에 전부 검사한다. */
(function (root) {
  'use strict';
  const FORMAT = 'opic-practice-backup';
  const VERSION = 1;
  const STORES = ['recordings', 'qstate', 'notes', 'scripts', 'sessions', 'kv'];
  const KEYS = { recordings: 'id', qstate: 'qid', notes: 'id', scripts: 'id', sessions: 'id', kv: 'k' };

  function validateBackup(obj) {
    const errors = [];
    if (!obj || typeof obj !== 'object') return { ok: false, errors: ['JSON 객체가 아닙니다.'] };
    if (obj.format !== FORMAT) errors.push('이 앱에서 내보낸 기록 파일이 아닙니다 (format 불일치).');
    if (typeof obj.version !== 'number') errors.push('버전 정보가 없습니다.');
    else if (obj.version > VERSION) errors.push(`더 새로운 버전(v${obj.version})의 파일입니다. 앱을 업데이트한 뒤 가져와 주세요.`);
    const data = obj.data;
    if (!data || typeof data !== 'object') errors.push('data 항목이 없습니다.');
    const counts = {};
    if (data && typeof data === 'object') {
      STORES.forEach(s => {
        const arr = data[s];
        if (arr === undefined) { counts[s] = 0; return; }
        if (!Array.isArray(arr)) { errors.push(`${s} 항목 형식이 잘못되었습니다.`); return; }
        const k = KEYS[s];
        const bad = arr.filter(x => !x || typeof x !== 'object' || (typeof x[k] !== 'string' || !x[k])).length;
        if (bad) errors.push(`${s}에 형식이 잘못된 항목이 ${bad}개 있습니다.`);
        counts[s] = arr.length;
      });
      if (data.audio !== undefined) {
        if (!Array.isArray(data.audio)) errors.push('audio 항목 형식이 잘못되었습니다.');
        else {
          const bad = data.audio.filter(a => !a || typeof a.id !== 'string' || typeof a.data !== 'string' || !/^[A-Za-z0-9+/=]*$/.test(a.data.slice(0, 200))).length;
          if (bad) errors.push(`녹음 데이터 중 ${bad}개가 손상되었습니다.`);
          counts.audio = data.audio.length;
        }
      }
    }
    return { ok: errors.length === 0, errors, counts };
  }

  const api = { FORMAT, VERSION, STORES, KEYS, validateBackup };
  root.OPIC = root.OPIC || {};
  root.OPIC.backup = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
