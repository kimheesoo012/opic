/* 앱 시작·화면 이동(해시 라우터) */
(function (root) {
  'use strict';
  const { store, ui, recorder, tts, C } = root.OPIC;
  const screens = root.OPIC.screens = root.OPIC.screens || {};
  let cleanup = null;
  let navSeq = 0;

  function parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const query = {};
    (qs || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return { name: parts[0] || 'home', params: parts.slice(1), query };
  }

  async function route() {
    const my = ++navSeq;
    if (cleanup) {
      const wasRec = recorder.isRecording();
      try { await cleanup(); } catch (e) {}
      cleanup = null;
      if (wasRec) ui.toast('화면을 옮겨서 녹음을 멈추고 저장했습니다.');
    }
    if (my !== navSeq) return;
    tts.cancel(); C.stopPlayback(); ui.dock('');
    const r = parse();
    const sc = screens[r.name] || screens.home;
    const view = ui.$('#view');
    document.title = sc.title && sc.title !== 'OPIc 말하기 연습' ? sc.title + ' · OPIc 말하기 연습' : 'OPIc 말하기 연습';
    ui.$('#hdr-title').textContent = sc.title || 'OPIc 말하기 연습';
    ui.$('#hdr-back').hidden = !!sc.tab;
    ui.$$('#tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === (sc.tab || sc.parentTab)));
    document.body.dataset.screen = r.name;
    view.innerHTML = '';
    view.scrollTop = 0; root.scrollTo(0, 0);
    try {
      const c = await sc.render(view, r.params, r.query);
      if (my === navSeq) cleanup = typeof c === 'function' ? c : null;
      else if (typeof c === 'function') c();
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="card"><h2>화면을 열지 못했습니다</h2><p>${ui.esc(e.message || String(e))}</p><a class="btn" href="#/">홈으로</a></div>`;
    }
    ui.$('#view').focus({ preventScroll: true });
    root.OPIC.P.flush();
  }

  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  root.OPIC.go = go;
  root.OPIC.refresh = route;

  function applyTheme() {
    const t = store.S.settings.theme;
    document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark';
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = t === 'light' ? '#f6f7fb' : '#0f1420';
  }
  root.OPIC.applyTheme = applyTheme;

  async function start() {
    const env = recorder.environment();
    if (env.file) ui.$('#env-banner').innerHTML = '<b>파일로 직접 연 상태(file://)입니다.</b> 녹음·오프라인 실행·홈 화면 설치가 되지 않을 수 있어요. GitHub Pages 주소(https://)로 열어 주세요.';
    else if (!env.secure) ui.$('#env-banner').innerHTML = '<b>HTTPS가 아닌 주소입니다.</b> 마이크 녹음은 https:// 주소에서만 됩니다.';
    ui.$('#env-banner').hidden = !(env.file || !env.secure);

    try { await store.init(); }
    catch (e) { ui.$('#view').innerHTML = `<div class="card"><h2>저장소를 열지 못했습니다</h2><p>${ui.esc(e.message || e)}</p></div>`; return; }
    if (root.OPIC.db.isMemory()) {
      ui.$('#env-banner').hidden = false;
      ui.$('#env-banner').innerHTML += '<div><b>이 브라우저에서는 기기 저장(IndexedDB)을 쓸 수 없어</b> 앱을 닫으면 기록이 사라집니다. 사생활 보호(시크릿) 모드를 끄고 열어 주세요.</div>';
    }
    applyTheme();
    if (store.S.recovered.length) setTimeout(() => ui.modal({ title: '녹음을 복구했습니다', html: `<p>앱이 갑자기 닫히기 전에 하던 녹음 ${store.S.recovered.length}개를 복구해 「기록」에 저장했습니다.</p>` }), 400);

    /* 보상: +XP 말풍선, 목표 달성·레벨 업·배지 축하 */
    store.onAward(ev => { if (ev.n > 0) root.OPIC.P.pop(ev.n); root.OPIC.P.celebrate(ev); });
    ui.$('#hdr-back').onclick = () => { if (history.length > 1) history.back(); else go('#/'); };
    root.addEventListener('hashchange', route);
    await route();

    /* 오프라인 실행: 서비스 워커 (https/localhost에서만) */
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w && w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) ui.toast('새 버전이 준비되었습니다. 앱을 다시 열면 적용됩니다.', 4000);
          });
        });
      }).catch(() => {});
    }
    /* 저장 데이터 보존 요청 (지원 브라우저만) */
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(p => { root.OPIC.persisted = p; }).catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(window);
