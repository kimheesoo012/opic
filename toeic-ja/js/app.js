// 앱 시작·라우팅·홈/학습/결과/목표 화면 (RC 전용)
import { C } from './ctx.js';
import { buildBank, questionsOf, conceptName, targetSec } from './bank.js';
import { openStore, idbAdapter, lsAdapter, memoryAdapter } from './store.js';
import { estimate, goalGap, rcGoal } from './scoring.js';
import { recommend } from './recommend.js';
import { newSession, summarize } from './sessions.js';
import { dueCards } from './review.js';
import { partStats, todayAttempts, todayStudySec, conceptStats, overtimeQids } from './stats.js';
import { makeRng, dayKey, pct, fmtSec, fmtMin, PART_NAMES, TARGETS, DAY, RC_PARTS } from './util.js';
import { h, on, toast, sheet, closeSheet, installDispatcher, icons } from './ui.js';
import { initPlayer, startSession, render as renderPlayer, leavePlayer, explainHtml } from './player.js';
import { renderReview, renderStats, renderSettings, renderTrain, renderAbout } from './screens.js';

export const APP_VERSION = '2.0.0';

// ---------- 공용 ----------
C.save = (keys) => { for (const k of keys) C.store.save(k).catch((e) => console.warn('save', k, e)); };
C.estimateNow = () => {
  const since = Date.now() - 90 * DAY;
  return estimate(C.state.attempts.filter((a) => a.t >= since), { baseline: C.state.profile.rcScore || undefined });
};
C.snapshotScore = () => {
  if (!C.state.attempts.some((a) => RC_PARTS.includes(a.part))) return;
  const est = C.estimateNow();
  const day = dayKey(Date.now());
  const snap = { t: Date.now(), day, lo: est.rc.lo, hi: est.rc.hi, point: est.rc.point, n: est.n, enough: est.enough, rc: true };
  const hist = C.state.scoreHistory;
  if (hist.length && hist[hist.length - 1].day === day) hist[hist.length - 1] = snap; else hist.push(snap);
  if (hist.length > 120) hist.splice(0, hist.length - 120);
};

function applyTheme() {
  const t = C.state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
C.applyTheme = applyTheme;
C.scoreCardHtml = (est) => scoreCard(est);

const NAV = [['home', 'ホーム', 'home'], ['learn', '学習', 'learn'], ['review', '復習', 'review'], ['stats', '記録', 'stats'], ['prefs', '設定', 'settings']];
function navHtml(active) {
  return `<nav class="nav" aria-label="メインメニュー"><div class="nav-in">${NAV.map(([r, label, ic]) => `<button data-act="nav" data-r="${r}" ${active === r ? 'aria-current="page"' : ''}>${icons[ic]}<span>${label}</span></button>`).join('')}</div></nav>`;
}
on('nav', (el) => C.go(el.dataset.r));

C.go = (route) => {
  if (location.hash !== `#${route}`) location.hash = route;
  else C.render();
};

C.render = () => {
  const route = (location.hash || '#home').slice(1) || 'home';
  C.route = route;
  const root = document.getElementById('app');
  if (route !== 'play') leavePlayer();
  closeSheet();
  if (route === 'play') { renderPlayer(); return; }
  const base = route.split('-')[0];
  let html = '';
  if (base === 'home') html = renderHome();
  else if (base === 'learn') html = renderLearn();
  else if (base === 'result') html = renderResult();
  else if (base === 'goal') html = renderGoal();
  else if (base === 'review') html = renderReview();
  else if (base === 'stats') html = renderStats();
  else if (base === 'prefs') html = renderSettings();
  else if (base === 'train') html = renderTrain(route.split('-')[1]);
  else if (base === 'about') html = renderAbout();
  else html = renderHome();
  const navKey = { result: 'learn', goal: 'home', train: 'learn', about: 'stats' }[base] || base;
  root.innerHTML = html + navHtml(navKey);
  window.scrollTo(0, 0);
};

// ---------- 점수 카드 ----------
export function scoreCard(est, { compact = false } = {}) {
  const p = C.state.profile;
  const g = rcGoal(p.goal, p.lcBase);
  if (!est || est.n === 0) {
    return `<div class="card"><h3>RC推定スコア</h3><p class="muted small">記録がありません。クイック診断を解くと、パートごとの苦手と学習レベルが分かります。</p></div>`;
  }
  if (!est.enough) {
    return `<div class="card"><div class="row between"><h3>学習レベル</h3><span class="tag warn">データ不足</span></div>
      <div class="score-big">${h(est.level)}</div>
      <p class="small muted">記録${est.n}問。スコア範囲を出すには足りないため、レベルだけ表示します。</p></div>`;
  }
  const R = est.rc;
  const gap = g.want - R.point;
  return `<div class="card"><div class="row between"><h3>RC推定スコア範囲</h3><span class="tag accent">推定</span></div>
    <div class="score-big">${R.lo}–${R.hi}</div>
    <div class="score-sub">中央値 ${R.point}・${h(est.level)}</div>
    ${compact ? '' : sparkline()}
    <p class="small" style="margin:8px 0 0">${gap > 0 ? `RC目標<b>${g.want}</b>まであと約<b>+${gap}点</b>` : `RC目標<b>${g.want}</b>に届くレベル`}・<a href="#goal">パート別の差</a></p>
    <p class="xs muted" style="margin:6px 0 0">検証済みの換算モデルではない推定値です。<a href="#about">計算方法</a></p></div>`;
}

function sparkline() {
  const hist = C.state.scoreHistory.filter((x) => x.enough && x.rc);
  if (hist.length < 2) return '';
  const W = 300;
  const H = 80;
  const ys = hist.flatMap((x) => [x.lo, x.hi]);
  const min = Math.min(...ys) - 10;
  const max = Math.max(...ys) + 10;
  const X = (i) => 6 + (i * (W - 12)) / (hist.length - 1);
  const Y = (v) => H - 6 - ((v - min) * (H - 12)) / (max - min || 1);
  const band = hist.map((x, i) => `${X(i)},${Y(x.hi)}`).join(' ') + ' ' + hist.slice().reverse().map((x, i) => `${X(hist.length - 1 - i)},${Y(x.lo)}`).join(' ');
  const line = hist.map((x, i) => `${X(i)},${Y(x.point)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="RC推定スコアの推移">
    <polygon points="${band}" fill="var(--accent-soft)"/><polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${hist.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x.point)}" r="2.5" fill="var(--accent)"/>`).join('')}</svg>
    <div class="row between xs muted"><span>${hist[0].day.slice(5)}</span><span>${hist[hist.length - 1].day.slice(5)}</span></div>`;
}

// ---------- 홈 ----------
function courseFor(minutes) {
  const st = C.state;
  const day = dayKey(Date.now());
  const cache = st.profile.course;
  if (cache && cache.day === day && cache.minutes === minutes && !cache.stale && cache.v === 2) return cache;
  const est = C.estimateNow();
  const rec = recommend({ bank: C.bank, attempts: st.attempts, cards: st.reviews, vocab: st.vocab, wrongNote: st.wrongNote, profile: st.profile, est, minutes });
  const done = cache && cache.day === day ? cache.done || [] : [];
  st.profile.course = { v: 2, day, minutes, items: rec.course.map((c) => ({ ...c, key: c.kind + JSON.stringify(c.params || {}) })), done };
  C.save(['profile']);
  return st.profile.course;
}
export function markCourseDone(key) {
  const c = C.state.profile.course;
  if (c && key && !c.done.includes(key)) { c.done.push(key); C.save(['profile']); }
}

function renderHome() {
  const st = C.state;
  const est = C.estimateNow();
  const today = todayAttempts(st.attempts);
  const todaySec = todayStudySec(st.studyLog);
  const minutes = st.settings.course || 20;
  const course = courseFor(minutes);
  const due = dueCards(st.reviews, Date.now());
  let html = `<div class="page"><div class="row between"><h1>今日のRC</h1><a class="tag accent" href="#goal">目標 ${st.profile.goal}</a></div>`;
  if (st.active) {
    const s = st.active;
    html += `<div class="card"><div class="row"><div class="grow"><h3>続きから解く</h3><p class="small muted" style="margin:0">${h(s.title)}・${Object.keys(s.answers).length}問解答済み</p></div>
      <button class="btn primary" data-act="resume">続ける</button></div></div>`;
  }
  html += `<div class="card"><div class="row between"><div><div class="xs muted">今日の学習</div><div class="stat">${fmtMin(todaySec)}</div></div>
    <div><div class="xs muted">解いた問題</div><div class="stat">${today.length}</div></div>
    <div><div class="xs muted">正答率</div><div class="stat">${today.length ? pct(today.filter((a) => a.correct).length / today.length) + '%' : '–'}</div></div></div></div>`;
  html += scoreCard(est);
  html += `<h2>今日のおすすめ</h2><div class="row between wrap"><div class="seg" role="group" aria-label="コースの長さ">${[10, 20, 40].map((m) => `<button data-act="courseLen" data-m="${m}" aria-pressed="${minutes === m}">${m}分</button>`).join('')}</div>
    <button class="btn sm ghost" data-act="courseRefresh">別のおすすめ</button></div>`;
  course.items.forEach((c, i) => {
    const done = course.done.includes(c.key);
    html += `<div class="card rec"><div class="grow"><b>${h(c.title)}</b>${done ? ' <span class="tag ok">完了</span>' : ''} <span class="tag">${c.minutes}分</span><p>${h(c.reason)}</p></div>
      <button class="btn ${done ? '' : 'primary'} sm" data-act="startRec" data-i="${i}">${done ? 'もう一度' : '開始'}</button></div>`;
  });
  if (due.length) html += `<div class="card"><div class="row"><div class="grow"><h3>復習待ち ${due.length}タイプ</h3><p class="small muted" style="margin:0">${due.slice(0, 3).map((c) => h(conceptName(C.bank, c.concept))).join(' · ')}</p></div><a class="btn sm" href="#review">復習</a></div></div>`;
  html += `</div>`;
  return html;
}

on('resume', () => C.go('play'));
on('courseLen', (el) => { C.state.settings.course = Number(el.dataset.m); C.save(['settings']); C.render(); });
on('courseRefresh', () => { if (C.state.profile.course) C.state.profile.course.stale = true; C.render(); });

export function startActivity(c) {
  const env = { bank: C.bank, state: C.state, rng: C.rng, now: Date.now() };
  const params = { ...(c.params || {}), recKey: c.key };
  if (C.state.active) {
    sheet(`<h3>途中のセッションがあります</h3><p class="small muted">${h(C.state.active.title)}。続きから解くか、破棄して新しく始めます。</p>
      <div class="stack"><button class="btn primary block" data-act="resume">続きから解く</button><button class="btn block" data-act="discardAndStart">破棄して新しく始める</button></div>`);
    C.pending = c;
    return;
  }
  if (c.kind === 'para') { markCourseDone(c.key); C.go('train-para'); return; }
  if (c.kind === 'vocab') { markCourseDone(c.key); C.go('train-vocab'); return; }
  const kind = c.kind === 'diag' && c.params && c.params.kind === 'deep' ? 'deep' : c.kind;
  const s = newSession(kind, params, env);
  if (!s) { toast(kind === 'review' ? '今復習するステップはありません。' : '条件に合う問題が足りません。'); return; }
  startSession(s);
}
on('discardAndStart', () => {
  C.state.active = null;
  C.save(['active']);
  closeSheet();
  const c = C.pending;
  C.pending = null;
  if (c) startActivity(c);
});
on('startRec', (el) => startActivity(C.state.profile.course.items[Number(el.dataset.i)]));

// ---------- 학습 ----------
function row(title, tag, desc, act, attrs, primary = false) {
  return `<div class="card rec"><div class="grow"><b>${title}</b>${tag ? ` <span class="tag">${tag}</span>` : ''}<p>${desc}</p></div><button class="btn sm ${primary ? 'primary' : ''}" data-act="${act}" ${attrs}>開始</button></div>`;
}

function renderLearn() {
  const ps = partStats(C.state.attempts);
  const over = overtimeQids(C.state.attempts).length;
  let html = `<div class="page"><h1>学習</h1><h2>診断</h2>
    ${row('クイック診断', '20分', '3パートから約30問。苦手パートが分かる。', 'startKind', 'data-k="diag"', true)}
    ${row('詳細診断', '45分', '約60問、ダブル・トリプルパッセージを含む。タイプ別の実力と時間配分を分析。', 'startKind', 'data-k="deep"')}
    <h2>パート別練習</h2>`;
  for (const p of RC_PARTS) {
    const s = ps[p];
    const nQ = { 5: 10, 6: 8, 7: 6 }[p];
    html += `<div class="card rec"><div class="grow"><b>Part ${p}</b> ${PART_NAMES[p]} <span class="tag">${C.bank.count(p)}問</span>
      <p>${s.n ? `正答率${pct(s.acc)}%・${s.n}問${s.avgSec != null ? `・平均${Math.round(s.avgSec)}秒` : ''}` : '記録なし'}</p></div>
      <div class="stack"><button class="btn primary sm" data-act="startPart" data-p="${p}" data-n="${nQ}">${nQ}問</button><button class="btn sm ghost" data-act="conceptList" data-p="${p}">タイプ別</button></div></div>`;
  }
  html += `<div class="card rec"><div class="grow"><b>Part 7 ダブル・トリプルパッセージ</b> <span class="tag">${(C.bank.byPart[7] || []).filter((u) => u.passages.length > 1).length}セット</span><p>複数の文書の情報をつなげて解く問題。</p></div><button class="btn sm" data-act="startMulti">2セット</button></div>
    <h2>スピード練習</h2>
    ${row('Part 5 連続解答', '12問', '1問20秒。時間が来ると次の問題に進みます。', 'startKind', 'data-k="speed"', true)}
    ${row('Part 7 文書別タイム練習', '2〜3セット', '文書の長さで決めた目標時間内に解く。', 'startKind', 'data-k="p7time"')}
    ${row('時間オーバー問題', `${over}問`, '目標時間を超えた問題を時間内に解き直す。', 'startKind', `data-k="overtime" ${over ? '' : 'disabled'}`)}
    <h2>本番形式</h2>
    ${row('RC本番模試', '75分', '100問。Part 5 30問、Part 6 16問、Part 7 54問。解説は最後に表示。', 'startKind', 'data-k="full"', true)}
    ${row('ハーフ模試', '38分', '約50問。解説は最後に表示。', 'startKind', 'data-k="mock"')}
    <div class="card"><b>パート別の時間制限</b><div class="stack" style="margin-top:8px">
      <button class="btn block" data-act="startTimed" data-p="5" data-n="15" data-l="300">Part 5・15問・5分</button>
      <button class="btn block" data-act="startTimed" data-p="6" data-n="8" data-l="240">Part 6・2セット・4分</button>
      <button class="btn block" data-act="startTimed" data-p="7" data-n="10" data-l="660">Part 7・約10問・11分</button>
    </div></div>
    <h2>読解・語彙</h2>
    <div class="card rec"><div class="grow"><b>言い換え練習</b><p>本文の表現と正解の表現を組み合わせる。</p></div><a class="btn sm" href="#train-para">開く</a></div>
    <div class="card rec"><div class="grow"><b>単語帳</b><p>問題から保存した単語を4択で復習。</p></div><a class="btn sm" href="#train-vocab">開く</a></div>
  </div>`;
  return html;
}

function startNew(kind, params) {
  if (C.state.active) { startActivity({ kind, params, key: null }); return; }
  startSession(newSession(kind, params, { bank: C.bank, state: C.state, rng: C.rng, now: Date.now() }));
}
on('startKind', (el) => startNew(el.dataset.k, {}));
on('startPart', (el) => startNew('practice', { part: Number(el.dataset.p), nQ: Number(el.dataset.n) }));
on('startMulti', () => startNew('practice', { part: 7, nQ: 10, multi: true, title: 'Part 7 ダブル・トリプルパッセージ' }));
on('startTimed', (el) => startNew('timed', { part: Number(el.dataset.p), nQ: Number(el.dataset.n), limitSec: Number(el.dataset.l), title: el.textContent.trim() }));
on('startConcept', (el) => { closeSheet(); startNew('drill', { concept: el.dataset.c, nQ: 6 }); });
on('conceptList', (el) => {
  const p = Number(el.dataset.p);
  const cs = conceptStats(C.state.attempts);
  const list = C.bank.concepts.filter((c) => c.part === p);
  sheet(`<h3>Part ${p} タイプ別練習</h3><div>${list.map((c) => {
    const s = cs.get(c.id);
    const n = (C.bank.byConcept.get(c.id) || []).length;
    return `<div class="list-item"><div class="grow"><b>${h(c.name)}</b><div class="xs muted">${n}問・${s ? `正答率${pct(s.acc)}%、${s.n}問解答` : '記録なし'}</div></div><button class="btn sm" data-act="startConcept" data-c="${c.id}" ${n ? '' : 'disabled'}>練習</button></div>`;
  }).join('')}</div><button class="btn block ghost" data-act="closeSheet">閉じる</button>`);
});

// ---------- 결과 ----------
function renderResult() {
  let s = C.lastSession;
  if (!s) { try { s = JSON.parse(sessionStorage.getItem('ttja-last') || 'null'); } catch { s = null; } }
  if (!s) return `<div class="page"><h1>結果</h1><p class="muted">表示する結果がありません。</p></div>`;
  const sum = summarize(s, C.bank);
  if (s.params && s.params.recKey) markCourseDone(s.params.recKey);
  let html = `<div class="page"><h1>${h(s.title)}の結果</h1>
    <div class="card"><div class="row between"><div><div class="xs muted">正解</div><div class="score-big">${sum.correct}/${sum.n}</div></div>
    <div><div class="xs muted">正答率</div><div class="stat">${sum.n ? pct(sum.correct / sum.n) : 0}%</div></div>
    <div><div class="xs muted">時間</div><div class="stat">${fmtSec(s.elapsed)}</div></div></div>
    <p class="small" style="margin:8px 0 0">目標時間オーバー ${sum.over}問${sum.unanswered ? `・未回答 ${sum.unanswered}問${s.timeUp ? '、制限時間終了' : ''}` : ''}</p></div>`;
  if (['diag', 'deep', 'mock', 'full'].includes(s.kind)) {
    const est = C.estimateNow();
    html += scoreCard(est, { compact: true });
    if (s.kind === 'diag' || s.kind === 'deep') html += `<a class="btn primary block" href="#goal">目標とパート別の差を見る</a>`;
    if (s.kind !== 'diag') {
      const R = est.rc;
      html += `<div class="card"><h3>時間配分</h3>${RC_PARTS.map((p) => {
        const info = R.parts[p];
        return `<div class="small">Part ${p}: ${info.timeRatio == null ? '記録不足' : `目標時間の${pct(info.timeRatio)}%`}</div>`;
      }).join('')}<p class="small muted" style="margin:6px 0 0">${R.unanswered ? `このペースだと、本番RC 75分ではPart 7が約${R.unanswered}問解き終わらない推定。` : 'このペースなら、RC 75分で全問解き終わる。'}</p></div>`;
      html += conceptTable(s);
    }
  }
  html += `<div class="card"><h3>パート別</h3><table class="t"><thead><tr><th>パート</th><th class="num">正答率</th><th class="num">平均</th><th class="num">超過</th></tr></thead><tbody>${Object.entries(sum.byPart).map(([p, v]) => `<tr><td>Part ${p}</td><td class="num">${v.n ? pct(v.correct / v.n) + '%' : '–'} <span class="muted">${v.correct}/${v.n}</span></td><td class="num">${v.n ? Math.round(v.sec / v.n) + '秒' : '–'}</td><td class="num">${v.over}</td></tr>`).join('')}</tbody></table></div>`;
  const wrongQs = [];
  for (const it of s.items) {
    if (it.type !== 'unit') continue;
    const unit = C.bank.unitById.get(it.unitId);
    if (!unit) continue;
    for (const q of questionsOf(unit)) {
      const a = s.answers[q.id];
      const slow = a && a.choice === q.answer && a.sec > targetSec(C.bank, q, unit) && ['speed', 'p7time', 'overtime', 'timed'].includes(s.kind);
      if (!a || a.choice !== q.answer || slow) wrongQs.push({ q, unit, a, slow });
    }
  }
  if (wrongQs.length) {
    html += `<h2>見直す問題 ${wrongQs.length}</h2>`;
    for (const { q, unit, a, slow } of wrongQs) {
      const att = s.attemptIds && s.attemptIds[q.id] ? C.state.attempts.find((x) => x.id === s.attemptIds[q.id]) : null;
      const tag = slow ? ['warn', '時間オーバー'] : !a ? ['bad', '未回答'] : a.choice === -1 ? ['bad', '時間切れ'] : ['bad', '不正解'];
      const label = unit.part === 6 ? `空所(${q.blank})` : q.question;
      html += `<details class="card"><summary><span class="tag ${tag[0]}">${tag[1]}</span> <span class="small">Part ${unit.part} · ${h(String(label || '').replace(/-{7}/, '___').slice(0, 70))}</span></summary>
        ${unit.part >= 6 ? `<p class="xs muted">本文は間違いノートで解き直すときに見られます。</p>` : ''}
        ${explainHtml(q, unit, a, { causeFor: att })}</details>`;
    }
    const concepts = [...new Set(wrongQs.filter((w) => !w.a || w.a.choice !== w.q.answer).map((w) => w.q.concept))];
    if (concepts.length) html += `<button class="btn primary block" data-act="reviewConcepts" data-c="${concepts.join(',')}">間違えたタイプをステップ復習・${concepts.length}タイプ</button>`;
  } else {
    html += `<p class="muted">間違えた問題はありません。</p>`;
  }
  html += `<div class="stack" style="margin-top:10px"><a class="btn block" href="#home">ホームへ</a></div></div>`;
  return html;
}

function conceptTable(s) {
  const byC = {};
  for (const it of s.items) {
    if (it.type !== 'unit') continue;
    const unit = C.bank.unitById.get(it.unitId);
    if (!unit) continue;
    for (const q of questionsOf(unit)) {
      const a = s.answers[q.id];
      if (!a) continue;
      const c = (byC[q.concept] ||= { n: 0, ok: 0, sec: 0, target: 0 });
      c.n++; c.sec += a.sec; c.target += targetSec(C.bank, q, unit);
      if (a.choice === q.answer) c.ok++;
    }
  }
  const rows = Object.entries(byC).filter(([, v]) => v.n >= 2).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n);
  if (!rows.length) return '';
  return `<div class="card"><h3>タイプ別の実力</h3><table class="t"><thead><tr><th>タイプ</th><th class="num">正答率</th><th class="num">平均/目標</th></tr></thead><tbody>${rows.map(([id, v]) => `<tr><td>${h(conceptName(C.bank, id))}</td><td class="num">${pct(v.ok / v.n)}% <span class="muted">${v.ok}/${v.n}</span></td><td class="num">${Math.round(v.sec / v.n)}/${Math.round(v.target / v.n)}秒</td></tr>`).join('')}</tbody></table>
    <p class="xs muted" style="margin:6px 0 0">2問以上出たタイプのみ。苦手の判定はタイプごとに4問以上の累積記録で行います。</p></div>`;
}

on('reviewConcepts', (el) => {
  const s = newSession('review', { concepts: el.dataset.c.split(',') }, { bank: C.bank, state: C.state, rng: C.rng, now: Date.now() });
  if (!s) { toast('今復習するステップはありません。'); return; }
  startSession(s);
});

// ---------- 목표 ----------
function renderGoal() {
  const p = C.state.profile;
  const est = C.estimateNow();
  const gg = goalGap(est, p.goal, p.lcBase);
  let html = `<div class="page"><h1>目標設定</h1>
    <p class="small muted">トータルの目標を選ぶと、LCの基準スコアを引いた分がRCの目標になります。目標が高いほど上級・ひっかけ問題が増えます。</p>
    <div class="seg" role="group" aria-label="目標スコア" style="display:flex">${TARGETS.map((t) => `<button style="flex:1" data-act="setGoal" data-g="${t}" aria-pressed="${p.goal === t}">${t}</button>`).join('')}</div>
    <div class="card"><div class="row between"><span>RC目標</span><b style="font-size:22px">${gg.want}</b></div>
      <p class="xs muted" style="margin:4px 0 0">${p.goal} − LC ${p.lcBase}${gg.overflow ? `・RC満点でも${gg.overflow}点足りない。LCも上げる必要がある目標。` : ''}</p></div>`;
  html += scoreCard(est, { compact: true });
  if (est.n) {
    html += `<div class="card"><h3>パート別の差</h3>
      <p class="xs muted" style="margin:0 0 8px">本番の難易度分布を想定した正答率の推定。バーは現在、縦線はRC ${gg.want}点に必要な水準。</p>
      ${RC_PARTS.map((pp) => {
        const g = gg.parts[pp];
        const few = g.n < 4;
        return `<div style="margin:10px 0"><div class="row between small"><span>Part ${pp} ${PART_NAMES[pp]}</span><span>${few ? '<span class="tag warn">記録不足</span>' : `${pct(g.now)}% → <b>${pct(g.need)}%</b>`}</span></div>
          <div class="bar"><i style="width:${pct(g.now)}%;${few ? 'opacity:.35' : ''}"></i><b style="left:${pct(g.need)}%"></b></div></div>`;
      }).join('')}</div>`;
  }
  html += `<div class="card"><h3>基準スコア</h3>
    <div class="row"><label class="field grow"><span>LC基準スコア</span><input id="lcBase" type="number" min="5" max="495" step="5" value="${p.lcBase ?? ''}" data-change="profNum" data-k="lcBase"></label>
    <label class="field grow"><span>最近のRCスコア</span><input id="rcScore" type="number" min="5" max="495" step="5" value="${p.rcScore ?? ''}" data-change="profNum" data-k="rcScore"></label></div>
    <p class="xs muted" style="margin:0">LC基準スコアはRC目標の計算だけに使います。最近のRCスコアは、記録が少ないときだけ推定に弱く反映されます。</p></div>
    <a class="btn primary block" href="#home">今日の学習へ</a></div>`;
  return html;
}
on('setGoal', (el) => {
  C.state.profile.goal = Number(el.dataset.g);
  C.state.profile.onboarded = true;
  if (C.state.profile.course) C.state.profile.course.stale = true;
  C.save(['profile']);
  C.render();
});
on('profNum', (el) => {
  const v = Number(el.value);
  if (v >= 5 && v <= 495) C.state.profile[el.dataset.k] = Math.round(v / 5) * 5; else C.state.profile[el.dataset.k] = el.dataset.k === 'lcBase' ? 0 : null;
  if (C.state.profile.course) C.state.profile.course.stale = true;
  C.save(['profile']);
  C.render();
  toast('保存しました');
});

// ---------- 시작 ----------
async function loadData() {
  if (window.__TT_DATA__) return window.__TT_DATA__;
  const get = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(`${f} ${r.status}`); return r.json(); });
  const idx = await get('index.json');
  const [concepts, ...files] = await Promise.all([get('concepts.json'), ...idx.files.map(get)]);
  return { version: idx.version, concepts: concepts.concepts, units: files.flatMap((f) => f.units) };
}

async function openBestStore() {
  try { return await openStore(await idbAdapter()); } catch (e) { console.warn('IndexedDB 사용 불가', e); }
  try { localStorage.setItem('ttja:probe', '1'); localStorage.removeItem('ttja:probe'); return await openStore(lsAdapter()); } catch (e) { console.warn('localStorage 사용 불가', e); }
  toast('このブラウザでは記録が保存されません。', 4000);
  return openStore(memoryAdapter());
}

// 1.x 기록 호환: LC/RC 기준 점수, LC 진행 중 세션 정리
function migrate(st) {
  const p = st.profile;
  if (p.baseline && typeof p.baseline === 'object') {
    if (p.rcScore == null && p.baseline.RC) p.rcScore = p.baseline.RC;
    if (p.lcBase == null && p.baseline.LC) p.lcBase = p.baseline.LC;
    delete p.baseline;
  }
  if (p.lcBase == null) p.lcBase = 350;
  if (st.active && st.active.items.some((it) => it.type === 'unit' && !C.bank.unitById.get(it.unitId))) st.active = null;
  st.scoreHistory = st.scoreHistory.filter((x) => x.rc);
  for (const [k, c] of Object.entries(st.reviews)) if (!C.bank.byConcept.has(c.concept)) delete st.reviews[k];
  for (const [k, w] of Object.entries(st.wrongNote)) if (!C.bank.qById.has(w.qid)) delete st.wrongNote[k];
  if (!st.active) st.active = null;
  C.save(['profile', 'active', 'scoreHistory', 'reviews', 'wrongNote']);
}

export async function boot() {
  installDispatcher();
  const root = document.getElementById('app');
  try {
    const data = await loadData();
    C.bank = buildBank(data.units, data.concepts);
    C.dataVersion = data.version;
    if (C.bank.report.errors.length) console.warn('제외된 문항', C.bank.report.errors);
  } catch (e) {
    root.innerHTML = `<div class="page"><h1>問題を読み込めませんでした</h1><p class="muted">${h(e.message)}</p><p class="small">初回はインターネット接続が必要です。一度開いた後はオフラインでも使えます。</p></div>`;
    return;
  }
  C.store = await openBestStore();
  C.state = C.store.state;
  C.version = APP_VERSION;
  C.embedded = !!window.__TT_DATA__;
  C.rng = makeRng(Date.now() & 0xffffffff);
  migrate(C.state);
  applyTheme();
  initPlayer(C);
  window.addEventListener('hashchange', () => C.render());
  document.addEventListener('visibilitychange', () => { if (document.hidden && C.state.active) C.store.save('active'); });
  C.render();
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && !C.embedded) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW 등록 실패', e));
  }
}

boot();
