// 복습·기록·설정·훈련·계산 방식 화면
import { C } from './ctx.js';
import { questionsOf, conceptName } from './bank.js';
import { dueCards, STAGES } from './review.js';
import { partStats, weakConcepts, causeDist, retentionStats, CAUSES, todayAttempts, todayStudySec, overtimeQids } from './stats.js';
import { newSession } from './sessions.js';
import { pct, dayKey, fmtMin, PART_NAMES, DAY, LETTERS, RC_PARTS } from './util.js';
import { XP, DAILY_GOALS, BADGES, MASTERY_LABELS, streakInfo, levelOf, setDaily, shiftDay } from './game.js';
import { h, on, toast, sheet, closeSheet, copyText, download, icons } from './ui.js';
import { startSession, stageDots } from './player.js';
import { validateImport } from './store.js';

const env = () => ({ bank: C.bank, state: C.state, rng: C.rng, now: Date.now() });
function partOf(concept) { const c = C.bank.conceptById.get(concept); return c && !c.name.startsWith('Part') ? `P${c.part} · ` : ''; }
function days(ms) { const d = Math.ceil(ms / DAY); return d <= 0 ? '今日' : `${d}日後`; }

// ---------- 복습 ----------
export function renderReview() {
  const st = C.state;
  const now = Date.now();
  const due = dueCards(st.reviews, now);
  const later = Object.values(st.reviews).filter((c) => c.due > now).sort((a, b) => a.due - b.due);
  let html = `<div class="page"><h1>復習</h1><h2>ステップ復習</h2>`;
  if (!due.length && !later.length) html += `<p class="muted small">間違えた問題のタイプがここにたまります。順番: 要点 → やさしい問題 → 難しい問題 → 制限時間 → 1・3・7日後に新しい問題。</p>`;
  if (due.length) {
    html += `<button class="btn primary block" data-act="startReview">今すぐ復習・${Math.min(due.length, 5)}タイプ</button>`;
    html += due.map((c) => `<div class="card"><div class="row between"><b>${partOf(c.concept)}${h(conceptName(C.bank, c.concept))}</b><span class="tag accent">今</span></div>${stageDots(c.stage)}</div>`).join('');
  }
  if (later.length) {
    html += `<h2>予定</h2>` + later.slice(0, 12).map((c) => `<div class="list-item"><div class="grow"><b class="small">${partOf(c.concept)}${h(conceptName(C.bank, c.concept))}</b>${stageDots(c.stage)}</div><span class="tag">${days(c.due - now)}</span></div>`).join('');
  }
  const notes = Object.values(st.wrongNote).sort((a, b) => b.lastT - a.lastT);
  const filter = C.wnFilter || 0;
  const shown = notes.filter((n) => !filter || n.part === filter);
  html += `<h2>間違いノート <span class="muted small">${notes.length}問</span></h2>
    <div class="row wrap" style="gap:6px">${[0, 5, 6, 7].map((p) => `<button class="chip" data-act="wnFilter" data-p="${p}" aria-pressed="${filter === p}">${p ? `P${p}` : 'すべて'}</button>`).join('')}</div>`;
  if (shown.length) {
    html += `<button class="btn block" style="margin-top:10px" data-act="wnAll">まだ正解していない問題を解く・${Math.min(shown.filter((n) => !n.rightAfter).length, 10)}</button>`;
    html += shown.slice(0, 40).map((n) => {
      const ref = C.bank.qById.get(n.qid);
      if (!ref) return '';
      const label = ref.unit.part === 6 ? `空所(${ref.q.blank})` : ref.q.question;
      return `<div class="list-item"><div class="grow"><div class="xs muted">P${n.part}・${h(conceptName(C.bank, n.concept))}・不正解${n.wrongCount}${n.rightAfter ? `・その後正解${n.rightAfter}` : ''}${n.cause ? `・${h(CAUSES.find((c) => c.id === n.cause)?.label || '')}` : ''}</div>
        <div class="small">${h(String(label || '').replace(/-{7}/, '___').slice(0, 80))}</div></div><button class="btn sm" data-act="wnOne" data-q="${n.qid}">解き直す</button></div>`;
    }).join('');
  } else html += `<p class="muted small">該当する問題はありません。</p>`;
  const over = overtimeQids(st.attempts);
  html += `<h2>時間オーバー問題 <span class="muted small">${over.length}問</span></h2>${over.length ? `<button class="btn block" data-act="overtimeStart">時間内に解き直す・${Math.min(over.length, 10)}</button>` : '<p class="muted small">目標時間を超えた問題がここに集まります。</p>'}`;
  const r = retentionStats(st.attempts);
  html += `<h2>復習の効果</h2><div class="card small">同じ問題の再正解 <b>${r.repeatRight}/${r.repeatTotal}</b><br>同じタイプの新しい問題の正解 <b>${r.newRight}/${r.newTotal}</b>
    <p class="xs muted" style="margin:6px 0 0">同じ問題は記憶、新しい問題は理解の確認です。2つを分けて記録します。</p></div>
    <h2>単語帳 <span class="muted small">${Object.keys(st.vocab).length}語</span></h2><a class="btn block" href="#train-vocab">単語帳を開く</a></div>`;
  return html;
}
on('startReview', () => {
  const due = dueCards(C.state.reviews, Date.now());
  const s = newSession('review', { concepts: due.slice(0, 5).map((c) => c.concept) }, env());
  if (!s) { toast('今復習するステップはありません。'); return; }
  startSession(s);
});
on('overtimeStart', () => startSession(newSession('overtime', {}, env())));
on('wnFilter', (el) => { C.wnFilter = Number(el.dataset.p); C.render(); });
on('wnOne', (el) => startSession(newSession('wrongnote', { qids: [el.dataset.q] }, env())));
on('wnAll', () => {
  const f = C.wnFilter || 0;
  const qids = Object.values(C.state.wrongNote).filter((n) => !n.rightAfter && (!f || n.part === f)).sort((a, b) => a.lastT - b.lastT).slice(0, 10).map((n) => n.qid);
  if (!qids.length) { toast('すべて1回以上正解しています。'); return; }
  startSession(newSession('wrongnote', { qids }, env()));
});

// ---------- 기록 ----------
function summaryText() {
  const st = C.state;
  const today = todayAttempts(st.attempts);
  const est = C.estimateNow();
  const lines = [`[TOEIC RC 学習まとめ] ${dayKey(Date.now())}`];
  lines.push(`今日解いた問題: ${today.length}問${today.length ? `、正答率${pct(today.filter((a) => a.correct).length / today.length)}%` : ''}、学習${fmtMin(todayStudySec(st.studyLog))}`);
  const ps = partStats(today.length ? today : st.attempts);
  const parts = RC_PARTS.filter((p) => ps[p].n).map((p) => `P${p} ${pct(ps[p].acc)}% ${ps[p].n}問`);
  lines.push(`パート別正答率${today.length ? '・今日' : '・全期間'}: ${parts.join('、') || '記録なし'}`);
  const weak = weakConcepts(st.attempts, 3);
  lines.push(`苦手なタイプ: ${weak.length ? weak.map((w) => `${conceptName(C.bank, w.concept)} ${pct(w.acc)}% ${w.n}問`).join('、') : '判断できる記録が不足'}`);
  const si = streakInfo(st.game);
  lines.push(`${si.days}日連続・Lv.${levelOf(st.game.total).level}・累計${st.game.total} XP・今日${si.todayXp}/${st.game.daily} XP`);
  lines.push(est.enough ? `RC推定スコア範囲: ${est.rc.lo}–${est.rc.hi}、公式換算ではない・目標${st.profile.goal}` : `学習レベル: ${est.level}、データ不足・目標${st.profile.goal}`);
  return lines.join('\n');
}
C.summaryText = summaryText;

export function renderStats() {
  const st = C.state;
  const est = C.estimateNow();
  const ps = partStats(st.attempts);
  const weak = weakConcepts(st.attempts, 3);
  const causes = causeDist(st.attempts);
  const causeTotal = Object.values(causes).reduce((a, b) => a + b, 0);
  let html = `<div class="page"><h1>記録</h1>`;
  // scoreCard는 app.js에 있으므로 간접 호출
  html += C.scoreCardHtml ? C.scoreCardHtml(est) : '';
  html += growthCard() + masteryCard() + badgeCard();
  html += `<div class="card"><h3>パート別の正答率・解答時間</h3><table class="t"><thead><tr><th>パート</th><th class="num">問題数</th><th class="num">正答率</th><th class="num">平均</th></tr></thead><tbody>
    ${RC_PARTS.map((p) => `<tr><td>P${p} ${PART_NAMES[p]}</td><td class="num">${ps[p].n}</td><td class="num">${ps[p].n ? pct(ps[p].acc) + '%' : '–'}</td><td class="num">${ps[p].avgSec != null ? `${Math.round(ps[p].avgSec)}秒${p >= 5 && ps[p].target ? `<div class="xs muted">目標${ps[p].target}秒</div>` : ''}` : '–'}</td></tr>`).join('')}</tbody></table></div>`;
  html += `<div class="card"><h3>よく間違えるタイプ TOP 3</h3>${weak.length ? weak.map((w, i) => `<div class="list-item"><b>${i + 1}</b><div class="grow">${h(conceptName(C.bank, w.concept))}<div class="xs muted">正答率${pct(w.acc)}%・${w.n}問${w.avgSec != null ? `・平均${Math.round(w.avgSec)}秒` : ''}</div></div><button class="btn sm" data-act="drillConcept" data-c="${w.concept}">練習</button></div>`).join('') : '<p class="small muted">タイプごとに4問以上解くと苦手を判定します。</p>'}</div>`;
  html += `<div class="card"><h3>ミスの原因</h3>${causeTotal ? CAUSES.map((c) => `<div class="dist-row"><span>${c.label}</span><div class="bar"><i style="width:${pct((causes[c.id] || 0) / causeTotal)}%"></i></div><span class="xs muted">${causes[c.id] || 0}</span></div>`).join('') : '<p class="small muted">解説の下で選んだミスの原因がここに集まります。</p>'}</div>`;
  const r = retentionStats(st.attempts);
  html += `<div class="card"><h3>復習の効果</h3><div class="small">同じ問題の再正解 ${r.repeatRight}/${r.repeatTotal}・同じタイプの新しい問題の正解 ${r.newRight}/${r.newTotal}</div></div>`;
  html += `<div class="card"><h3>学習まとめ</h3><pre class="small" style="white-space:pre-wrap;margin:0 0 8px">${h(summaryText())}</pre><button class="btn primary block" data-act="copySummary">まとめをコピー</button></div>`;
  html += `<div class="card"><h3>学習記録のバックアップ</h3><p class="xs muted" style="margin:0 0 8px">記録はこの端末のブラウザにだけ保存されます。別の端末に移すときはJSONで書き出します。</p>
    <div class="row"><button class="btn grow" data-act="exportData">JSON書き出し</button><button class="btn grow" data-act="importPick">読み込み</button></div>
    <input type="file" accept="application/json,.json" class="hidden" id="importFile" data-change="importFile"></div></div>`;
  return html;
}
// 지난 7일과 그 전 7일 비교, 날짜별 XP 막대
function growthCard() {
  const g = C.state.game;
  const now = Date.now();
  const today = dayKey(now);
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));
  const prevDays = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 13));
  const xpSum = (ds) => ds.reduce((a, d) => a + (g.xp[d] || 0), 0);
  const inDays = (ds) => { const set = new Set(ds); return C.state.attempts.filter((a) => set.has(dayKey(a.t))); };
  const cur = inDays(days);
  const prev = inDays(prevDays);
  const acc = (l) => (l.length ? pct(l.filter((a) => a.correct).length / l.length) : null);
  const diff = (a, b, unit = '') => (a == null || b == null ? '' : `<span class="delta ${a > b ? 'up' : a < b ? 'down' : ''}">${a > b ? '+' : ''}${a - b}${unit}</span>`);
  const max = Math.max(g.daily, ...days.map((d) => g.xp[d] || 0));
  return `<div class="card"><h3>直近7日</h3>
    <div class="row between"><div><div class="xs muted">XP</div><div class="stat">${xpSum(days)} ${diff(xpSum(days), xpSum(prevDays))}</div></div>
    <div><div class="xs muted">解いた問題</div><div class="stat">${cur.length} ${diff(cur.length, prev.length)}</div></div>
    <div><div class="xs muted">正答率</div><div class="stat">${acc(cur) == null ? '–' : acc(cur) + '%'} ${diff(acc(cur), acc(prev), '%p')}</div></div></div>
    <div class="xpchart" role="img" aria-label="日別XP">${days.map((d) => `<div class="col ${g.done[d] ? 'done' : ''}"><div class="bw"><i style="height:${Math.round(((g.xp[d] || 0) / max) * 100)}%"></i></div><span>${weekdayOf(d)}</span></div>`).join('')}<b class="goal" style="bottom:${20 + Math.round((g.daily / max) * 80)}px"></b></div>
    <p class="xs muted" style="margin:6px 0 0">数字の横はその前の7日間との差。線は1日の目標${g.daily} XP。</p></div>`;
}
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const weekdayOf = (d) => WD[new Date(`${d}T12:00`).getDay()];

// 유형별 숙련도 0~5. 탭하면 그 유형 연습
function masteryCard() {
  const mm = C.mastery();
  const lv = (c) => (mm[c.id] ? mm[c.id].lv : 0);
  const all = C.bank.concepts;
  const masters = all.filter((c) => lv(c) >= 5).length;
  const adv = all.filter((c) => lv(c) >= 4).length;
  const overall = pct(all.reduce((a, c) => a + lv(c), 0) / (all.length * 5));
  const parts = RC_PARTS.map((p) => {
    const list = all.filter((c) => c.part === p);
    const avg = pct(list.reduce((a, c) => a + lv(c), 0) / (list.length * 5));
    return `<details><summary><b>Part ${p}</b> ${PART_NAMES[p]} <span class="tag">${avg}%</span></summary>${list.map((c) => `<button class="mrow" data-act="drillConcept" data-c="${c.id}"><span class="grow">${h(c.name.replace(/^Part \d /, ''))}</span><span class="segs l${lv(c)}">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= lv(c) ? 'on' : ''}"></i>`).join('')}</span><span class="mlab">${MASTERY_LABELS[lv(c)]}</span></button>`).join('')}</details>`;
  }).join('');
  return `<div class="card"><h3>実力マップ</h3>
    <div class="row between"><div><div class="xs muted">全体の習熟度</div><div class="stat">${overall}%</div></div><div><div class="xs muted">得意以上</div><div class="stat">${adv}/${all.length}</div></div><div><div class="xs muted">マスター</div><div class="stat">${masters}</div></div></div>
    <div class="bar" style="margin:8px 0 4px"><i style="width:${overall}%"></i></div>
    ${parts}
    <p class="xs muted" style="margin:6px 0 0">段階: 入門 → 基礎（2問、50%）→ 習得中（4問、70%）→ 得意（6問、80%、中級に正解）→ マスター（8問、85%、上級に正解、目標時間内）。正答率は直近10回で計算。</p></div>`;
}

function badgeCard() {
  const got = C.state.game.badges;
  const n = BADGES.filter((b) => got[b.id]).length;
  return `<div class="card"><h3>バッジ <span class="muted small">${n}/${BADGES.length}</span></h3><div class="badges">${BADGES.map((b) => `<div class="badge ${got[b.id] ? 'on' : ''}" title="${h(b.desc)}">${icons[b.icon]}<b>${h(b.label)}</b><span>${h(b.desc)}</span></div>`).join('')}</div></div>`;
}

on('drillConcept', (el) => startSession(newSession('drill', { concept: el.dataset.c, nQ: 6 }, env())));
on('copySummary', async () => { toast((await copyText(summaryText())) ? 'コピーしました' : 'コピーできませんでした。テキストを長押ししてコピーできます。'); });
on('exportData', async () => {
  const data = C.store.exportData(C.version);
  data.dataVersion = C.dataVersion;
  const text = JSON.stringify(data);
  if (C.embedded) {
    // 미리보기 페이지(Artifact)는 파일 저장이 막혀 있어 클립보드로 대신한다
    const ok = await copyText(text);
    sheet(`<h3>記録JSON ${ok ? 'コピー済み' : 'コピー失敗'}</h3><p class="small">このページではファイル保存ができません。${ok ? 'クリップボードにコピーしたので、メモアプリに貼り付けて.jsonで保存できます。' : 'コピーもできませんでした。GitHub Pages版から書き出せます。'}</p><button class="btn block" data-act="closeSheet">閉じる</button>`);
    return;
  }
  download(`toeic-trainer-ja-${dayKey(Date.now())}.json`, text);
  toast('書き出しました');
});
on('importPick', () => document.getElementById('importFile').click());
on('importFile', async (el) => {
  const f = el.files && el.files[0];
  el.value = '';
  if (!f) return;
  let obj;
  try { obj = JSON.parse(await f.text()); } catch { toast('JSONファイルを読めませんでした。今の記録はそのままです。', 3500); return; }
  const errs = validateImport(obj);
  if (errs.length) { sheet(`<h3>読み込めないファイル</h3><p class="small">今の記録は変わっていません。</p><ul class="small">${errs.slice(0, 6).map((e) => `<li>${h(e)}</li>`).join('')}</ul><button class="btn block" data-act="closeSheet">閉じる</button>`); return; }
  C.pendingImport = obj;
  sheet(`<h3>記録を置き換えますか？</h3><p class="small">ファイルの記録${obj.data.attempts.length}問、書き出し日${h(String(obj.exportedAt || '').slice(0, 10))}。今の記録${C.state.attempts.length}問と置き換えます。${C.embedded ? 'このページでは自動バックアップを保存できません。必要なら先に書き出しでコピーしておきます。' : '今の記録は先にファイルとしてダウンロードされます。'}</p>
    <div class="stack"><button class="btn primary block" data-act="importConfirm">置き換える</button><button class="btn block ghost" data-act="closeSheet">キャンセル</button></div>`);
});
on('importConfirm', async () => {
  const obj = C.pendingImport;
  C.pendingImport = null;
  closeSheet();
  if (!obj) return;
  if (!C.embedded) download(`toeic-trainer-ja-backup-before-import-${Date.now()}.json`, JSON.stringify(C.store.exportData(C.version)));
  const r = await C.store.importData(obj);
  if (!r.ok) { toast('読み込めませんでした。今の記録はそのままです。'); return; }
  C.ensureGame();
  C.save(['game']);
  C.applyTheme();
  toast(`${r.count}問の記録を読み込みました`);
  C.render();
});

// ---------- 설정 ----------
export function renderSettings() {
  const st = C.state;
  const s = st.settings;
  const total = RC_PARTS.reduce((a, p) => a + C.bank.count(p), 0);
  return `<div class="page"><h1>設定</h1>
    <div class="card"><div class="row between"><div><h3>目標スコア</h3><div class="small muted">トータル${st.profile.goal}・LC基準${st.profile.lcBase}</div></div><a class="btn sm" href="#goal">変更</a></div></div>
    <div class="card"><h3>1日の目標</h3><div class="seg" style="display:flex">${DAILY_GOALS.map((n) => `<button style="flex:1" data-act="daily" data-n="${n}" aria-pressed="${st.game.daily === n}">${n}</button>`).join('')}</div>
      <p class="xs muted" style="margin:6px 0 0">XPで設定。正解10、不正解2、同じ問題の解き直しは半分。50 XPは約5問。</p></div>
    <div class="card"><div class="row between"><h3 style="margin:0">効果音</h3><div class="seg">${[['1', 'オン'], ['0', 'オフ']].map(([v, l]) => `<button data-act="setOpt" data-k="sound" data-v="${v}" aria-pressed="${(s.sound !== false) === (v === '1')}">${l}</button>`).join('')}</div></div></div>
    <div class="card"><h3>画面</h3><div class="seg" style="display:flex">${[['auto', '端末の設定'], ['light', 'ライト'], ['dark', 'ダーク']].map(([k, l]) => `<button style="flex:1" data-act="theme" data-t="${k}" aria-pressed="${(s.theme || 'auto') === k}">${l}</button>`).join('')}</div></div>
    <div class="card"><h3>データ</h3><div class="stack"><button class="btn block" data-act="exportData">学習記録を書き出す</button><button class="btn block" data-act="importPick">学習記録を読み込む</button><button class="btn block ghost" data-act="resetAsk">すべての記録を消去</button></div>
      <input type="file" accept="application/json,.json" class="hidden" id="importFile" data-change="importFile"></div>
    <div class="card small"><h3>アプリ情報</h3>アプリ ${h(C.version)}・問題データ ${h(C.dataVersion)}<br>${RC_PARTS.map((p) => `Part ${p} ${C.bank.count(p)}問`).join('・')}・合計${total}<br>Part 6 ${(C.bank.byPart[6] || []).length}セット・Part 7 シングル${(C.bank.byPart[7] || []).filter((u) => u.passages.length === 1).length}セット、ダブル・トリプル${(C.bank.byPart[7] || []).filter((u) => u.passages.length > 1).length}セット<br>保存方式 ${h(C.store.adapter.kind)}<br><a href="#about">推定スコアの計算方法と限界</a>
      <p class="xs muted">RC専用アプリです。すべての問題はこのアプリのために新しく作ったもので、実際の試験や教材の問題ではありません。TOEICはETSの登録商標です。</p></div></div>`;
}
on('daily', (el) => {
  const ev = setDaily(C.state.game, Number(el.dataset.n));
  C.save(['game']);
  if (ev.goalReached) toast('今日の目標達成');
  C.render();
});
on('setOpt', (el) => { C.state.settings[el.dataset.k] = el.dataset.v === '1'; C.save(['settings']); C.render(); });
on('theme', (el) => { C.state.settings.theme = el.dataset.t; C.save(['settings']); C.applyTheme(); C.render(); });
on('resetAsk', () => sheet(`<h3>すべての記録を消去しますか？</h3><p class="small">解答記録、復習カード、単語帳、XP・連続記録、設定がすべて消え、元に戻せません。</p>
  <div class="stack"><button class="btn block" data-act="exportData">先に書き出す</button><button class="btn primary block" data-act="resetConfirm">消去する</button><button class="btn ghost block" data-act="closeSheet">キャンセル</button></div>`));
on('resetConfirm', async () => { closeSheet(); await C.store.reset(); C.applyTheme(); toast('記録を消去しました'); C.go('home'); });

// ---------- 단어 ----------
let vocabIndex = null;
function sentenceWith(text, w) {
  if (!text) return null;
  const parts = String(text).replace(/\{\{\d\}\}/g, '____').replace(/— \[\d\] —/g, '').split(/(?<=[.!?])\s+|\n+/);
  const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  return parts.find((p) => re.test(p)) || null;
}
function buildVocabIndex() {
  vocabIndex = new Map();
  for (const u of C.bank.units) {
    const texts = [u.question, ...(u.passages || []).map((p) => p.text), ...(u.questions || []).map((q) => q.question)];
    for (const q of questionsOf(u)) {
      for (const v of q.vocab || []) {
        const key = v.w.toLowerCase();
        if (vocabIndex.has(key)) continue;
        let ctx = null;
        for (const t of [q.question, ...texts]) { ctx = sentenceWith(t, v.w); if (ctx) break; }
        vocabIndex.set(key, { ...v, qid: q.id, ctx: ctx ? ctx.replace(/-{7}/, '______').trim() : null });
      }
    }
  }
  return vocabIndex;
}
export function vocabPool() { return [...(vocabIndex || buildVocabIndex()).values()]; }

on('word', (el) => {
  const idx = vocabIndex || buildVocabIndex();
  const v = idx.get(el.dataset.w.toLowerCase());
  if (!v) return;
  const saved = !!C.state.vocab[v.w.toLowerCase()];
  sheet(`<h3>${h(v.w)} <span class="tag">${h(v.pos || '')}</span></h3><p style="font-size:18px;margin:4px 0 10px">${h(v.m)}</p>
    ${v.ctx ? `<div class="card small"><div class="xs muted">問題での使われ方</div>${h(v.ctx)}</div>` : ''}${v.ex ? `<div class="card small"><div class="xs muted">例文</div>${h(v.ex)}</div>` : ''}
    <div class="stack"><button class="btn primary block" data-act="saveWord" data-w="${h(v.w)}" ${saved ? 'disabled' : ''}>${saved ? '単語帳に保存済み' : '単語帳に保存'}</button><button class="btn ghost block" data-act="closeSheet">閉じる</button></div>`);
});
on('saveWord', (el) => {
  const v = (vocabIndex || buildVocabIndex()).get(el.dataset.w.toLowerCase());
  if (!v) return;
  C.state.vocab[v.w.toLowerCase()] = { w: v.w, m: v.m, pos: v.pos || '', ctx: v.ctx, qid: v.qid, added: Date.now(), box: 0, due: Date.now(), right: 0, wrong: 0 };
  C.save(['vocab']);
  el.disabled = true;
  el.textContent = '保存しました';
});

// ---------- 훈련 ----------
export function renderTrain(kind) {
  if (kind === 'para') return renderPara();
  if (kind === 'vocab') return renderVocab();
  return `<div class="page"><p>不明な練習</p></div>`;
}

// 패러프레이즈
const PT = { cur: null, chosen: null, right: 0, total: 0, mode: 'quiz' };
function paraPool() {
  const out = [];
  for (const u of C.bank.units) for (const q of questionsOf(u)) for (const p of q.para || []) out.push({ ...p, q, unit: u });
  return out;
}
function newParaQ() {
  const pool = paraPool();
  const wrongQ = new Set(C.state.attempts.filter((a) => !a.correct).map((a) => a.qid));
  const pref = pool.filter((x) => wrongQ.has(x.q.id));
  const item = C.rng.pick(pref.length && C.rng() < 0.6 ? pref : pool);
  // 선택지는 그 문제의 실제 선택지라 형태가 비슷해 정답이 티 나지 않는다
  PT.cur = { item, opts: item.q.choices.slice(), answer: item.q.answer };
  PT.chosen = null;
}
function renderPara() {
  const pool = paraPool();
  if (!PT.cur) newParaQ();
  let html = `<div class="page"><h1>言い換え練習</h1>
    <div class="seg"><button data-act="ptMode" data-m="quiz" aria-pressed="${PT.mode === 'quiz'}">クイズ</button><button data-act="ptMode" data-m="list" aria-pressed="${PT.mode === 'list'}">ペア一覧</button></div>`;
  if (PT.mode === 'list') {
    html += `<p class="small muted">本文の表現と正解の表現 ${pool.length}組</p>` + pool.map((p) => `<div class="card small"><div class="xs muted">P${p.unit.part} · ${h(conceptName(C.bank, p.q.concept))}</div>${h(p.p)}<br>→ <b>${h(p.a)}</b></div>`).join('');
    return html + '</div>';
  }
  const { item, opts } = PT.cur;
  html += `<p class="small">正解 ${PT.right}/${PT.total}</p>
    <div class="card"><div class="xs muted">Part ${item.unit.part} · ${h(item.q.question || '')}</div><p style="font-size:17px;margin:8px 0 0">本文の表現: <b>${h(item.p)}</b></p></div>
    <p class="small muted">この本文の表現を言い換えた選択肢</p><div class="choices">${opts.map((o, i) => {
      let cls = 'choice';
      if (PT.chosen != null) { if (i === PT.cur.answer) cls += ' right'; else if (PT.chosen === i) cls += ' wrong'; }
      return `<button class="${cls}" data-act="ptChoose" data-i="${i}"><span class="L">${LETTERS[i]}</span><span>${h(o)}</span></button>`;
    }).join('')}</div>`;
  if (PT.chosen != null) html += `<div class="card small"><b>ペア</b><br>本文: ${h(item.p)}<br>正解: <b>${h(item.a)}</b></div><div class="foot-actions"><button class="btn primary" data-act="ptNext">次へ</button></div>`;
  return html + '</div>';
}
on('ptMode', (el) => { PT.mode = el.dataset.m; C.render(); });
on('ptChoose', (el) => {
  if (PT.chosen != null) return;
  PT.chosen = Number(el.dataset.i);
  PT.total++;
  if (PT.chosen === PT.cur.answer) { PT.right++; C.award(XP.drill); }
  const k = dayKey(Date.now());
  C.state.studyLog[k] = (C.state.studyLog[k] || 0) + 15;
  C.save(['studyLog']);
  C.render();
});
on('ptNext', () => { newParaQ(); C.render(); });

// 단어장
const VT = { mode: 'quiz', cur: null, chosen: null, hideMeaning: false };
const BOX_DAYS = [0, 1, 2, 4, 8, 16, 32];
function vocabOptions(entry) {
  const pool = vocabPool().filter((v) => v.m !== entry.m && v.w.toLowerCase() !== entry.w.toLowerCase());
  const samePos = pool.filter((v) => (v.pos || '') === (entry.pos || ''));
  const close = (samePos.length >= 3 ? samePos : pool).filter((v) => Math.abs(v.m.length - entry.m.length) <= 4);
  const src = close.length >= 3 ? close : samePos.length >= 3 ? samePos : pool;
  const picks = C.rng.shuffle(src).slice(0, 3).map((v) => v.m);
  return C.rng.shuffle([entry.m, ...picks]);
}
function newVocabQ() {
  const now = Date.now();
  const list = Object.values(C.state.vocab);
  if (!list.length) { VT.cur = null; return; }
  const due = list.filter((v) => (v.due || 0) <= now).sort((a, b) => (a.box || 0) - (b.box || 0));
  const entry = due.length ? due[0] : C.rng.pick(list);
  VT.cur = { entry, opts: vocabOptions(entry) };
  VT.chosen = null;
}
function renderVocab() {
  const list = Object.values(C.state.vocab).sort((a, b) => b.added - a.added);
  let html = `<div class="page"><h1>単語帳 <span class="muted small">${list.length}語</span></h1>
    <div class="seg"><button data-act="vtMode" data-m="quiz" aria-pressed="${VT.mode === 'quiz'}">クイズ</button><button data-act="vtMode" data-m="list" aria-pressed="${VT.mode === 'list'}">一覧</button></div>`;
  if (list.length < 4) {
    html += `<div class="card small">解説の単語をタップして保存するとここにたまります。クイズは4語から使えます。
      <button class="btn block" style="margin-top:8px" data-act="vtSeed">間違えた問題の単語をまとめて追加</button></div>`;
  }
  if (VT.mode === 'list') {
    html += list.map((v) => `<div class="list-item"><div class="grow"><b>${h(v.w)}</b> <span class="tag">${h(v.pos || '')}</span> ${VT.hideMeaning ? '' : `<span>${h(v.m)}</span>`}${v.ctx ? `<div class="xs muted">${h(v.ctx)}</div>` : ''}</div><button class="btn sm ghost" data-act="vtDel" data-w="${h(v.w.toLowerCase())}">削除</button></div>`).join('');
    html += list.length ? `<button class="btn block ghost" data-act="vtHide">${VT.hideMeaning ? '意味を表示' : '意味を隠す'}</button>` : '';
    return html + '</div>';
  }
  if (list.length < 4) return html + '</div>';
  if (!VT.cur || !C.state.vocab[VT.cur.entry.w.toLowerCase()]) newVocabQ();
  const { entry, opts } = VT.cur;
  html += `<div class="card"><div class="row between"><b style="font-size:22px">${h(entry.w)}</b><span class="tag">${h(entry.pos || '')} · ${entry.box || 0}段階</span></div>${entry.ctx ? `<p class="small muted" style="margin:6px 0 0">${h(entry.ctx)}</p>` : ''}</div>
    <div class="choices">${opts.map((o, i) => {
      let cls = 'choice';
      if (VT.chosen != null) { if (o === entry.m) cls += ' right'; else if (VT.chosen === i) cls += ' wrong'; }
      return `<button class="${cls}" data-act="vtChoose" data-i="${i}"><span class="L">${LETTERS[i]}</span><span>${h(o)}</span></button>`;
    }).join('')}</div>`;
  if (VT.chosen != null) html += `<div class="foot-actions"><button class="btn primary" data-act="vtNext">次へ</button></div>`;
  return html + '</div>';
}
on('vtMode', (el) => { VT.mode = el.dataset.m; C.render(); });
on('vtHide', () => { VT.hideMeaning = !VT.hideMeaning; C.render(); });
on('vtDel', (el) => { delete C.state.vocab[el.dataset.w]; C.save(['vocab']); C.render(); });
on('vtSeed', () => {
  const idx = vocabIndex || buildVocabIndex();
  const wrongQ = [...new Set(C.state.attempts.filter((a) => !a.correct).map((a) => a.qid))];
  let added = 0;
  for (const qid of wrongQ) {
    const ref = C.bank.qById.get(qid);
    if (!ref) continue;
    for (const v of ref.q.vocab || []) {
      const key = v.w.toLowerCase();
      if (C.state.vocab[key]) continue;
      const iv = idx.get(key) || v;
      C.state.vocab[key] = { w: v.w, m: v.m, pos: v.pos || '', ctx: iv.ctx || null, qid, added: Date.now(), box: 0, due: Date.now(), right: 0, wrong: 0 };
      added++;
    }
  }
  C.save(['vocab']);
  toast(added ? `${added}語追加しました` : '追加する単語がありません。間違えた問題の単語が対象です。');
  C.render();
});
on('vtChoose', (el) => {
  if (VT.chosen != null) return;
  VT.chosen = Number(el.dataset.i);
  const e = C.state.vocab[VT.cur.entry.w.toLowerCase()];
  const ok = VT.cur.opts[VT.chosen] === e.m;
  if (ok) C.award(XP.drill);
  if (ok) { e.box = Math.min(6, (e.box || 0) + 1); e.right = (e.right || 0) + 1; e.due = Date.now() + BOX_DAYS[e.box] * DAY; } else { e.box = 0; e.wrong = (e.wrong || 0) + 1; e.due = Date.now() + 10 * 60 * 1000; }
  const k = dayKey(Date.now());
  C.state.studyLog[k] = (C.state.studyLog[k] || 0) + 8;
  C.save(['vocab', 'studyLog']);
  C.render();
});
on('vtNext', () => { newVocabQ(); C.render(); });

// ---------- 계산 방식 ----------
export function renderAbout() {
  return `<div class="page"><h1>推定スコアの計算方法</h1>
  <div class="card small stack">
    <p><b>使う記録</b><br>直近90日のRC解答の正誤、問題の難易度、解答時間、パート別の成績。同じ問題の解き直しとステップ復習の記録は除きます。診断・模試は重み1、通常の練習は0.6です。</p>
    <p><b>計算の手順</b><br>1. 難易度と当てずっぽうで正解する確率を入れた項目反応モデルで能力値の分布を求めます。本番のパート比率で重みをつけ、多く解いたパートだけで結果が決まらないようにします。Part 7はRCの54%です。<br>
    2. パート別の能力値は全体の能力値に寄せ、記録が少ないパートの値が極端にならないようにします。<br>
    3. 本番の問題数と想定した難易度分布から予想素点を求めます。自分の解答ペースで75分以内に解き終わらない問題は、当てずっぽうで答えるとみなして減らします。<br>
    4. 素点の割合を近似換算表で5〜495点に換算します。<br>
    5. 能力値分布の10〜90%区間に、換算表の誤差20点と未解答パートの比率分を加えて範囲で表示します。15問未満、またはパート比率の半分以上を解いていない場合は、スコアの代わりに学習レベルだけを表示します。</p>
    <p><b>最近のRCスコア</b><br>目標画面の「最近のRCスコア」は、記録が少ないときだけ弱く反映されます。初期値は300です。</p>
    <p><b>限界</b><br>検証済みの換算モデルではありません。難易度は作成者がつけた値で、受験者データで補正していません。換算表も公式のものではありません。実際のスコアを正確に予測するものではなく、学習の方向を決めるための目安です。</p>
  </div><a class="btn block" href="#stats">記録へ</a></div>`;
}
