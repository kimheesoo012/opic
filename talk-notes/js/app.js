/* 앱 시작과 화면 이동(해시 라우터) */
import { load, isMemoryOnly, S } from './core/store.js';
import { tts, stt } from './core/speech.js';
import { $, $$, esc, applyTheme, toast } from './ui/ui.js';
import home from './ui/home.js';
import note from './ui/note.js';
import practice from './ui/practice.js';
import session from './ui/session.js';
import card from './ui/card.js';
import stats from './ui/stats.js';
import settings from './ui/settings.js';

const SCREENS = { home, note, practice, s: session, card, stats, settings };
let cleanup = null, navSeq = 0;

export function parse(hash = location.hash) {
  const h = hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const params = path.split('/').filter(Boolean).map(decodeURIComponent);
  const query = {};
  new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
  return { name: params.shift() || 'home', params, query };
}

async function route() {
  const my = ++navSeq;
  if (cleanup) { try { await cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  if (my !== navSeq) return;
  tts.cancel(); stt.abort();
  $$('.sheet-bg').forEach(x => x.remove());
  const r = parse();
  const sc = SCREENS[r.name] || home;
  const view = $('#view');
  const title = typeof sc.title === 'function' ? sc.title(r) : sc.title;
  document.title = (title ? title + ' · ' : '') + '회화 교정 노트';
  $('#hdr-title').textContent = title || '회화 교정 노트';
  $('#hdr-back').hidden = !!sc.tab;
  $('#hdr-act').innerHTML = '';
  $('#hdr').hidden = !!sc.fullscreen;
  document.body.classList.toggle('in-session', !!sc.fullscreen);
  $$('#tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === (sc.tab || sc.parentTab)));
  document.body.dataset.screen = r.name;
  view.innerHTML = '';
  window.scrollTo(0, 0);
  try {
    const c = await sc.render(view, r.params, r.query);
    if (my === navSeq) cleanup = typeof c === 'function' ? c : null;
    else if (typeof c === 'function') c();
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="panel"><h2>화면을 열지 못했어요</h2><p>${esc(e.message || String(e))}</p><a class="btn" href="#/">처음으로</a></div>`;
  }
  if (!r.query.c) view.focus({ preventScroll: true });
}

export function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
window.TN = { go, refresh: route };

function start() {
  load();
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  const banner = $('#env-banner');
  const msgs = [];
  if (location.protocol === 'file:') msgs.push('파일로 직접 연 상태예요. https 주소(GitHub Pages)로 열어야 녹음·음성 인식·오프라인 설치가 돼요.');
  if (isMemoryOnly()) msgs.push('이 브라우저에서는 기록을 저장할 수 없어요(시크릿 모드?). 앱을 닫으면 기록이 사라져요.');
  if (msgs.length) { banner.innerHTML = msgs.map(esc).join('<br>'); banner.hidden = false; }
  $('#hdr-back').onclick = () => { if (history.length > 1) history.back(); else go('#/'); };
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('새 버전이 준비됐어요. 앱을 다시 열면 적용돼요.', 4000); });
      });
    }).catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => { if (!p && Object.keys(S.srs).length > 20) navigator.storage.persist().catch(() => {}); }).catch(() => {});
}
start();
