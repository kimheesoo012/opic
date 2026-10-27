/* 공용 유틸 (브라우저·Node 공용) */
(function (root) {
  'use strict';
  const DAY = 24 * 60 * 60 * 1000;

  function uid(prefix) {
    const r = Math.random().toString(36).slice(2, 8);
    return (prefix || 'id') + '_' + Date.now().toString(36) + r;
  }
  function shuffle(arr, rng) {
    const a = arr.slice();
    const rand = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /* 재현 가능한 난수(테스트·가리기 단계 고정용) */
  function seededRng(seed) {
    let s = 0;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) >>> 0;
    s = s || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return (s >>> 0) / 4294967296;
    };
  }
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? `${m}분 ${s}초` : `${s}초`;
  }
  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }
  function fmtBytes(b) {
    if (!b) return '0 KB';
    if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB';
    if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
    return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }
  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* 연속 학습 일수: 오늘(또는 어제)부터 거꾸로 이어진 날 수 */
  function streak(dayKeys, now) {
    const set = new Set(dayKeys);
    let d = new Date(now || Date.now());
    if (!set.has(dayKey(d.getTime()))) d = new Date(d.getTime() - DAY);
    let n = 0;
    while (set.has(dayKey(d.getTime()))) { n++; d = new Date(d.getTime() - DAY); }
    return n;
  }

  const api = { DAY, uid, shuffle, seededRng, fmtDur, fmtClock, fmtBytes, dayKey, fmtDate, escapeHtml, streak };
  root.OPIC = root.OPIC || {};
  root.OPIC.util = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
