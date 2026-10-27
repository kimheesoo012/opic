// 게임 화면: 위 조작 줄 → LCD 창 → 이야기 칸 → 선택 버튼. 시간 흐름, 오토, 배속.
import * as G from '../engine/core.js';
import { SEASON_MS, SPEEDS, FIRST_EVENT_MS, AUTO_WORD_MS, eventShowMs, resultShowMs } from '../engine/pace.js';
import { SEASON_JA, SEASON_KO, STAT_KO, STAGES, ROLE_KO, ROLES, personFor } from '../engine/world.js';
import { SUB_TITLES } from '../data/index.js';
import { resolveKo, plainKo } from '../engine/text.js';
import { h, renderJa, renderKo, renderSpeaker, plainSegs, sceneTargets, LINES } from './render.js';
import { itemOf } from '../engine/study.js';
import { LCD } from './pixel/lcd.js';
import { idlePlan, eventPlan, lookFor } from './pixel/director.js';
import { icon } from './icons.js';
import { store } from './store.js';

const CAT = { daily: '日常', kendo: '稽古', sub: 'サブストーリー', iincho: '委員長', cast: '道場の人々', milestone: '節目', hub: '日常' };
const STAT_ORDER = ['hap', 'hea', 'back', 'soc', 'brave', 'mis'];
const AUTO_MODES = [
  ['major', '大事な場面だけ止まる'],
  ['all', '全部おまかせ'],
  ['off', 'オートを切る'],
];

export class GameView {
  constructor(app, state) {
    this.app = app;
    this.s = state;
    this.elapsed = 0; // 이번 계절 안에서 흐른 시간(1배속 기준 ms)
    this.wait = 0;
    this.timer = null;
    this.last = 0;
    this.seenWords = new Set(state.seenWords || []);
    this.seenTerms = store.seenTerms();
  }

  get set() {
    return this.app.settings;
  }

  mount() {
    const s = this.s;
    // ── 조작 줄
    this.speedBtns = SPEEDS.map((sp) => h('button', { type: 'button', 'aria-pressed': String(this.set.speed === sp), 'aria-label': `${sp}배속`, onclick: () => this.setSpeed(sp) }, `${sp}x`));
    this.pauseBtn = h('button', { class: 'ctl', type: 'button', 'aria-label': '일시정지', onclick: () => this.togglePause() }, icon('pause', 18));
    this.autoBtn = h('button', { class: 'ctl auto', type: 'button', 'aria-expanded': 'false', onclick: () => this.toggleAutoPanel() }, 'オート');
    this.modeCap = h('div', { class: 'auto-cap' });
    const menuBtn = h('button', { class: 'ctl', type: 'button', 'aria-label': '메뉴', onclick: () => this.menu() }, icon('menu', 18));
    this.autoPanel = h('div', { class: 'auto-panel', hidden: true }, AUTO_MODES.map(([m, label]) => h('button', { class: 'btn center', type: 'button', 'data-mode': m, onclick: () => this.setAuto(m) }, label)));
    const top = h('div', { class: 'topbar pad' },
      this.modeCap,
      h('div', { class: 'ctrl' }, this.pauseBtn, h('div', { class: 'seg speeds', role: 'group', 'aria-label': '배속' }, this.speedBtns), this.autoBtn, menuBtn),
      this.autoPanel);
    // ── LCD
    this.whenEl = h('span', { class: 'when' });
    this.stageBtn = h('button', { class: 'stage-chip', type: 'button', onclick: () => this.glossStage() });
    this.ageEl = h('span', { class: 'age' });
    this.canvas = h('canvas', { class: 'lcd-canvas', 'aria-hidden': 'true' });
    this.bigEl = h('div', { class: 'lcd-big', 'aria-live': 'polite' });
    this.lcdBox = h('div', { class: 'lcd', onclick: () => this.skip() }, this.canvas, this.bigEl, h('span', { class: 'lcd-skip', 'aria-hidden': 'true' }, icon('skip', 14)));
    // 도트 창 접기: 작은 화면에서 대사를 읽을 자리를 넓힌다 (설정에 기억)
    this.foldBtn = h('button', { class: 'fold-btn', type: 'button', onclick: () => this.toggleFold() });
    this.statsEl = h('button', { class: 'stats', type: 'button', 'aria-expanded': 'false', 'aria-label': '능력치', onclick: () => this.toggleStats() });
    this.statsDetail = h('div', { class: 'stats-detail', hidden: true });
    this.prog = h('i');
    this.device = h('div', { class: 'device' },
      h('div', { class: 'lcd-info' }, this.whenEl, this.stageBtn, this.ageEl, this.foldBtn),
      this.lcdBox,
      h('div', { class: 'progress' }, this.prog),
      this.statsEl,
      this.statsDetail);
    // ── 이야기 칸과 버튼
    this.panel = h('div', { class: 'panel pad', 'aria-live': 'polite' });
    this.foot = h('div', { class: 'foot pad' });
    this.ticker = h('div', { class: 'ticker' });
    this.logEl = h('div', { class: 'log' });
    this.el = h('div', { class: 'screen game' }, top, h('div', { class: 'pad' }, this.device), this.panel, this.foot);
    this.app.mountScreen(this.el);
    this.lcd = new LCD(this.canvas);
    this.lcd.lookFn = lookFor;
    this.lcd.dog = s.dog;
    this.lcd.speed = this.set.speed;
    this.app.sound.speed = this.set.speed;
    this.lcd.start();
    this.onResize = () => this.fitLcd();
    window.addEventListener('resize', this.onResize);
    this.paused = false;
    this.renderMode();
    this.renderHud(true);
    this.last = performance.now();
    this.timer = setInterval(() => this.tick(), 50);
    this.renderPhase();
  }

  unmount() {
    clearInterval(this.timer);
    window.removeEventListener('resize', this.onResize);
    this.lcd && this.lcd.stop();
  }

  // 접힘 여부: 직접 고른 값이 있으면 그 값, 없으면 아주 낮은 화면(600px 미만)에서 이야기가 펼쳐질 때만 접는다
  isFolded() {
    if (typeof this.set.lcdFold === 'boolean') return this.set.lcdFold;
    return this.s.phase !== 'season' && window.innerHeight < 600;
  }
  toggleFold() {
    this.set.lcdFold = !this.isFolded();
    this.app.saveSettings();
    this.fitLcd();
  }
  renderFold() {
    const fold = this.isFolded();
    this.el.classList.toggle('lcd-fold', fold);
    this.foldBtn.textContent = fold ? '▼ 펼치기' : '▲ 접기';
    this.foldBtn.setAttribute('aria-expanded', String(!fold));
    this.foldBtn.setAttribute('aria-label', fold ? '도트 창 펼치기' : '도트 창 접기');
  }

  // LCD는 기기 픽셀 기준 정수 배율로만 키운다 (도트가 고르게 보이도록)
  fitLcd() {
    const dpr = window.devicePixelRatio || 1;
    const avail = Math.max(160, this.device.clientWidth - 16);
    // 이야기가 펼쳐질 때는 도트 창을 줄여 대사와 선택지에 자리를 내준다.
    // 높이 기준: iPhone SE Safari(주소창 포함) ≈ 548px, iPhone 13/14 Safari ≈ 664px, 홈 화면 앱 667 / 844px
    const vh = window.innerHeight;
    const busy = this.s.phase !== 'season';
    const short = vh < 760;
    const tiny = vh < 700;
    const mini = vh < 600;
    const target = busy ? Math.min(avail, mini ? 160 : tiny ? 175 : short ? 230 : 290) : Math.min(avail, mini ? 240 : short ? 300 : 420);
    this.el.classList.toggle('tiny', busy && tiny);
    this.el.classList.toggle('compact', busy && short);
    this.el.classList.toggle('xs', busy && mini);
    this.renderFold();
    const k = Math.max(1, Math.floor((target * dpr) / 160));
    const w = (k * 160) / dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = (w * 96) / 160 + 'px';
  }

  // ───── 시간 ─────
  tick() {
    const now = performance.now();
    const dt = Math.min(200, now - this.last);
    this.last = now;
    if (this.paused || this.app.modalOpen()) return;
    const sp = this.set.speed;
    const s = this.s;
    switch (s.phase) {
      case 'season': {
        this.elapsed += dt * sp;
        if (G.hasEvent(s) && this.elapsed > FIRST_EVENT_MS) {
          G.nextEvent(s);
          this.save();
          this.renderPhase();
          return;
        }
        if (!G.hasEvent(s) && this.elapsed >= SEASON_MS) this.nextSeason();
        const frac = Math.min(1, this.elapsed / SEASON_MS);
        this.prog.style.width = frac * 100 + '%';
        const tod = frac < 0.55 ? 'day' : frac < 0.8 ? 'evening' : 'night';
        if (this.idle && this.lcd.plan.tod !== tod) this.lcd.setPlan({ ...this.lcd.plan, tod }, s);
        break;
      }
      case 'event':
        if (this.autoActive() && !this.manualOnce) {
          this.wait += dt * sp;
          const delay = eventShowMs(G.view(s)) * (this.set.focus ? 1.6 : 1);
          if (!this.autoShown && this.wait > delay * 0.4) this.showAutoPick();
          if (this.wait > delay) this.doChoose(this.autoIdx, true);
        }
        break;
      case 'result':
        if (this.autoActive()) {
          this.wait += dt * sp;
          if (this.wait > this.resultMs * (this.set.focus ? 1.6 : 1)) this.doAck();
        }
        break;
      case 'word':
        if (this.autoActive()) {
          this.wait += dt * sp;
          if (this.wait > AUTO_WORD_MS) this.doWord(G.autoWord(s), true);
        }
        break;
      case 'farewell':
        this.app.toFarewell(s);
        break;
      default:
        break;
    }
  }

  autoActive() {
    if (!this.set.auto) return false;
    const s = this.s;
    if (s.phase === 'word') return this.set.autoMode === 'all';
    const v = G.view(s);
    if (!v) return true;
    if (this.set.autoMode === 'all') return true;
    return !v.major;
  }

  nextSeason() {
    const s = this.s;
    G.endSeason(s);
    this.elapsed = 0;
    this.prog.style.width = '0%';
    if (s.phase === 'farewell') {
      this.save();
      this.app.toFarewell(s);
      return;
    }
    const sea = G.season(s);
    this.big(`${SEASON_JA[sea]}　${G.yearNo(s)}年目`, false);
    this.log(`${SEASON_KO[sea]}. ${this.ageText()}.`);
    this.renderHud();
    this.setIdle();
    this.renderIdle();
    this.save();
  }

  skip() {
    if (this.s.phase !== 'season') return;
    if (G.hasEvent(this.s)) {
      this.elapsed = FIRST_EVENT_MS;
      return;
    }
    this.elapsed = SEASON_MS;
  }

  setSpeed(sp) {
    this.set.speed = sp;
    this.app.saveSettings();
    this.speedBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(SPEEDS[i] === sp)));
    this.lcd.speed = sp;
    this.app.sound.speed = sp;
  }
  togglePause() {
    this.paused = !this.paused;
    this.lcd.paused = this.paused;
    this.pauseBtn.replaceChildren(icon(this.paused ? 'play' : 'pause', 18));
    this.pauseBtn.setAttribute('aria-label', this.paused ? '재개' : '일시정지');
    this.pauseBtn.setAttribute('aria-pressed', String(this.paused));
  }
  toggleAutoPanel(force) {
    const open = force ?? this.autoPanel.hidden;
    this.autoPanel.hidden = !open;
    this.autoBtn.setAttribute('aria-expanded', String(open));
    if (open) this.renderMode();
  }
  setAuto(m) {
    if (m === 'off') this.set.auto = false;
    else {
      this.set.auto = true;
      this.set.autoMode = m;
    }
    this.app.saveSettings();
    this.wait = 0;
    this.toggleAutoPanel(false);
    this.renderMode();
  }
  renderMode() {
    const cur = this.set.auto ? this.set.autoMode : 'off';
    this.modeCap.textContent = this.set.auto ? (cur === 'all' ? '全部おまかせ' : '大事な場面だけ止まる') : 'オート切';
    this.autoBtn.setAttribute('aria-pressed', String(this.set.auto));
    for (const b of this.autoPanel.children) b.setAttribute('aria-pressed', String(b.dataset.mode === cur));
  }

  save() {
    this.s.seenWords = [...this.seenWords].slice(-800);
    if (this.seenNames) this.s.seenNames = [...this.seenNames];
    this.app.saveGame(this.s);
  }

  ageText() {
    const t = this.s.t;
    if (t < 4) return `생후 ${3 + t * 3}개월`;
    return `${Math.floor(t / 4)}살`;
  }

  big(text, zoom = true) {
    this.bigEl.textContent = text;
    this.bigEl.classList.remove('show');
    this.lcdBox.classList.remove('zoom');
    void this.bigEl.offsetWidth;
    this.bigEl.classList.add('show');
    if (zoom) this.lcdBox.classList.add('zoom');
  }

  glossStage() {
    const st = STAGES.find((x) => x.id === G.stage(this.s));
    this.app.toast(`${st.ja} — ${st.ko}`);
  }

  toggleStats() {
    const open = this.statsDetail.hidden;
    this.statsDetail.hidden = !open;
    this.statsEl.setAttribute('aria-expanded', String(open));
  }

  renderHud(first) {
    const s = this.s;
    const sea = G.season(s);
    this.app.root.dataset.season = sea;
    this.lcd.season = sea;
    this.lcd.stage = G.stage(s);
    this.lcd.heavy = G.has(s, 'diet_fail') || (s.st.hea < 40 && G.stage(s) !== 'puppy');
    this.app.sound.setSeason(sea);
    this.whenEl.textContent = `${SEASON_JA[sea]} ${G.yearNo(s)}年目`;
    const st = STAGES.find((x) => x.id === G.stage(s));
    this.stageBtn.textContent = st.ja;
    this.ageEl.textContent = `${s.dog.name} · ${this.ageText()}`;
    this.statsEl.replaceChildren(...STAT_ORDER.map((k) => h('span', { class: 'stat', title: STAT_KO[k] }, icon(k, 16), h('span', { class: 'bar' }, h('i', { style: `width:${s.st[k]}%` })))));
    this.statsDetail.replaceChildren(...STAT_ORDER.map((k) => h('span', null, icon(k, 16), `${STAT_KO[k]} ${Math.round(s.st[k])}`)));
    if (first) this.fitLcd();
  }

  renderTicker() {
    const s = this.s;
    const prev = this.lastNews || {};
    this.ticker.replaceChildren(...ROLES.map((r) => {
      const p = personFor(s.cast, r);
      return h('button', { class: 'who' + (this.lastNews && prev[r] !== s.news[r] ? ' flash' : ''), type: 'button', onclick: () => this.castSheet(r) },
        h('b', null, p.ko), h('span', null, s.news[r] || ''));
    }));
    this.lastNews = { ...s.news };
  }

  log(text) {
    this.pendingLog = this.pendingLog || [];
    this.pendingLog.push(text);
  }
  flushLog() {
    const s = this.s;
    for (const l of s.log.splice(0)) this.log(l.text);
    for (const t of this.pendingLog || []) this.logEl.prepend(h('p', null, t));
    this.pendingLog = [];
    while (this.logEl.children.length > 4) this.logEl.lastChild.remove();
  }

  // ───── 장면 ─────
  setIdle() {
    this.idle = true;
    this.lcd.setPlan(idlePlan(this.s, this.elapsed / SEASON_MS), this.s);
  }
  renderIdle() {
    this.flushLog();
    this.renderTicker();
    this.panel.replaceChildren(this.ticker, this.logEl);
    this.foot.replaceChildren();
    this.foot.hidden = true;
    this.fitLcd();
  }

  ctxFor(lineSp) {
    if (!this.seenNames) this.seenNames = new Set(this.s.seenNames || []);
    return {
      s: this.s,
      speaker: lineSp,
      mode: this.set.furigana,
      seenWords: this.seenWords,
      seenTerms: this.seenTerms,
      seenNames: this.seenNames,
      onName: (base, reading) => this.app.toast(`${base}（${reading}）`),
      newTerms: [],
      saved: new Set(Object.keys(store.wordbook())),
    };
  }

  renderLines(lines, title) {
    const box = h('div', { class: 'lines' });
    const kos = [];
    const focus = !!this.set.focus;
    const targetIds = sceneTargets(lines.map((l) => l[1]), this.set);
    const targets = new Set(targetIds);
    this.app.meet(targetIds, this.s);
    const scenes = {};
    for (const [sp, ja, ko] of lines) {
      const ctx = this.ctxFor(sp);
      ctx.targets = targets;
      const koText = resolveKo(ko, { s: this.s });
      const koEl = h('div', { class: 'ko', hidden: true }, koText);
      kos.push(koEl);
      const scene = () => ({ tpl: ja, role: sp, ja: plainSegs(ja, { s: this.s, speaker: sp }), ko: koText, sp: spLabelText(sp, this.s), title, when: `${this.ageText()} ${SEASON_KO[G.season(this.s)]}` });
      for (const id of targetIds) if (!scenes[id] && lineHas(ja, id)) scenes[id] = scene;
      ctx.onWord = (key) => this.app.openWord(key, scene());
      ctx.onGrammar = (key) => this.app.openGrammar(key, scene());
      // 학습 집중 모드: 대사마다 번역 버튼
      const lineTool = focus ? h('button', { class: 'mini-btn line-ko', type: 'button', onclick: (e) => { koEl.hidden = !koEl.hidden; e.currentTarget.textContent = koEl.hidden ? '번역' : '닫기'; } }, '번역') : null;
      box.append(h('div', { class: 'line' }, h('div', { class: 'sp' }, renderSpeaker(sp, this.s, this.set.furigana, ctx), lineTool), h('div', { class: 'ja' }, renderJa(ja, ctx)), koEl));
    }
    if (kos.length && !focus) {
      let on = false;
      const btn = h('button', { class: 'mini-btn', type: 'button', onclick: () => { on = !on; kos.forEach((k) => (k.hidden = !on)); btn.textContent = on ? '번역 닫기' : '번역'; } }, '번역');
      box.append(h('div', { class: 'tools' }, btn));
    }
    // 학습 집중 모드: 이 장면의 학습 대상 목록 (탭하면 해설)
    if (focus && targetIds.length) {
      box.append(h('div', { class: 'targets' }, targetIds.map((id) => {
        const it = itemOf(id);
        const open = () => (id[0] === 'g' ? this.app.openGrammar(id.slice(2), scenes[id] && scenes[id]()) : this.app.openWord(id.slice(2), scenes[id] && scenes[id]()));
        return h('button', { class: 'target-chip', type: 'button', onclick: open }, h('b', { lang: 'ja' }, id[0] === 'g' ? it.f : it.key), h('span', null, it.m));
      })));
    }
    return box;
  }

  // 한국어 해설은 상황만 짧게: 앞 문장(40자 안팎)만 보이고 나머지는 「더보기」. 일본어 대사가 주인공이다.
  koBlock(text, title) {
    const ctx = this.ctxFor(null);
    ctx.onWord = (key) => this.app.openWord(key, { ja: '', ko: plainKo(text), sp: '', title, when: this.ageText() });
    const { head, rest } = splitContext(text);
    const p = h('p', { class: 'ev-text ctx' }, renderKo(head, ctx));
    if (ctx.newTerms.length) store.saveSeenTerms(this.seenTerms);
    if (!rest) return p;
    const more = h('button', { class: 'more-btn', type: 'button', 'aria-expanded': 'false', onclick: () => {
      more.remove();
      const c2 = this.ctxFor(null);
      c2.onWord = ctx.onWord;
      p.append(' ', renderKo(rest, c2));
    } }, '더보기');
    p.append(' ', more);
    return p;
  }

  refresh() {
    const s = this.s;
    const keep = this.wait;
    const top = this.panel.scrollTop;
    if (s.phase === 'event') this.showEvent(true);
    else if (s.phase === 'result') this.showResult(true);
    this.wait = keep;
    this.panel.scrollTop = top;
  }

  renderPhase() {
    const s = this.s;
    this.flushLog();
    if (s.phase === 'season') {
      this.setIdle();
      this.renderIdle();
      return;
    }
    this.idle = false;
    this.foot.hidden = false;
    if (s.phase === 'event') this.showEvent();
    else if (s.phase === 'result') this.showResult();
    else if (s.phase === 'word') this.showWord();
    else if (s.phase === 'farewell') return this.app.toFarewell(s);
    this.fitLcd();
    this.resetScroll();
  }

  // 장면이 바뀌면 새 글의 처음부터 보이게 한다.
  // iOS Safari는 관성 스크롤 중에 scrollTop 지정을 무시하므로, 잠깐 overflow를 막고 맞춘다. 배치가 끝난 뒤 한 번 더.
  resetScroll() {
    const p = this.panel;
    p.style.overflowY = 'hidden';
    p.scrollTop = 0;
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    requestAnimationFrame(() => {
      p.scrollTop = 0;
      p.style.overflowY = '';
    });
  }

  showEvent(again = false) {
    const v = G.view(this.s);
    if (!v) return;
    this.wait = 0;
    this.autoShown = false;
    // 오토 선택은 장면마다 한 번만 정한다 (설정을 바꿔 다시 그려도 그대로)
    if (!again || this.autoIdx === undefined) this.autoIdx = G.autoChoice(this.s);
    const ev = G.EV.get(v.id);
    if (!again) {
      const plan = eventPlan(this.s, v, this.elapsed / SEASON_MS);
      this.lcd.setPlan(plan, this.s);
      if (plan.big) {
        this.big(plan.big);
        this.app.sound.sfx('big');
      } else if (ev.cat === 'kendo' || ev.kendo) this.app.sound.sfx('shinai');
    }
    const head = h('div', { class: 'ev-cat' }, (v.sub ? 'サブストーリー' : CAT[v.cat] || '') + (v.who ? ` · ${ROLE_KO[v.who]}` : ''));
    this.panel.replaceChildren(head, h('h3', { class: 'ev-title' }, v.title), v.text ? this.koBlock(v.text, v.title) : '', v.lines.length ? this.renderLines(v.lines, v.title) : '');
    this.choiceBtns = [];
    this.manualOnce = false;
    const btns = [];
    const calm = this.autoActive() && v.choices.length && !v.mini;
    // 「선택지: 중요한 장면만」: 작은 장면은 개가 성격대로 움직인다. 대사를 읽고 つぎへ (원하면 직접 고르기)
    const dogActs = !calm && this.set.choiceMode !== 'all' && !v.major && !v.mini && v.choices.length > 1 && this.autoIdx >= 0;
    // 직접 고르는 장면도 선택지는 「행동 고르기」를 누른 뒤에 펼친다 (먼저 일본어 대사를 다 읽을 수 있게)
    const askFirst = !calm && !dogActs && !v.mini && v.choices.length > 1;
    if (calm) {
      this.autoLine = h('span', { class: 'auto-line-text' }, 'オート');
      btns.push(h('div', { class: 'auto-line' }, this.autoLine, h('button', { class: 'mini-btn', type: 'button', onclick: () => this.takeOver() }, '직접 고르기')));
    }
    if (dogActs) {
      btns.push(h('div', { class: 'dog-acts' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => this.doChoose(this.autoIdx, true) }, 'つぎへ'),
        h('button', { class: 'mini-btn', type: 'button', onclick: (e) => { e.currentTarget.parentNode.remove(); for (const [, b] of this.choiceBtns) b.hidden = false; } }, '직접 고르기')));
    }
    if (askFirst) {
      btns.push(h('button', { class: 'btn primary open-choices', type: 'button', onclick: (e) => { e.currentTarget.remove(); for (const [, b] of this.choiceBtns) b.hidden = false; } }, '행동 고르기'));
    }
    if (v.mini && !this.autoActive()) btns.push(this.tambourine(v));
    else if (v.choices.length) {
      for (const c of v.choices) {
        const b = h('button', { class: 'btn' + (c.ok ? '' : ' off'), type: 'button', disabled: !c.ok, hidden: calm || dogActs || askFirst, onclick: () => this.doChoose(c.i, false) }, h('span', null, c.t, !c.ok && c.why ? h('div', { class: 'why' }, c.why) : null));
        this.choiceBtns.push([c.i, b]);
        btns.push(b);
      }
    } else btns.push(h('button', { class: 'btn primary', type: 'button', onclick: () => this.doChoose(-1, false) }, 'つぎへ'));
    this.foot.replaceChildren(...btns);
  }

  // 오토 장면에서 「직접 고르기」: 이번 장면만 오토를 멈추고 선택지를 펼친다
  takeOver() {
    this.manualOnce = true;
    for (const [, b] of this.choiceBtns) b.hidden = false;
    const line = this.foot.querySelector('.auto-line');
    if (line) line.remove();
  }

  showAutoPick() {
    this.autoShown = true;
    const pair = this.choiceBtns.find(([i]) => i === this.autoIdx);
    if (this.autoLine && pair && !this.manualOnce) this.autoLine.textContent = `オート · ${pair[1].textContent}`;
    if (pair) {
      pair[1].classList.add('auto-pick');
      pair[1].append(h('span', { class: 'auto-badge' }, 'オート'));
    }
  }

  doChoose(i, auto) {
    const s = this.s;
    if (s.phase !== 'event') return;
    const ev = G.EV.get(s.cur.id);
    const c = ev.choices && ev.choices[i];
    if (c && (c.tag === 'brave' || c.tag === 'guard')) {
      this.app.sound.sfx('bark');
      this.lcd.bark();
    } else if (!auto) this.app.sound.sfx('tap');
    G.choose(s, i, auto);
    this.save();
    this.renderPhase();
  }

  showResult(again = false) {
    const r = this.s.res;
    this.wait = 0;
    const ev = G.EV.get(r.id);
    const title = resolveKo(ev.title, { s: this.s });
    const ok = r.notes.includes('성공');
    if (!again) {
      if (this.lcd.plan.match && ok) {
        this.lcd.flags();
        this.big('一本');
        this.app.sound.sfx('flag');
      }
      this.lcd.setPlan({ ...this.lcd.plan, bubble: ok ? 'heart' : r.notes.includes('실패') ? 'sweat' : null }, this.s);
    }
    const body = [h('div', { class: 'ev-cat' }, CAT[ev.cat] || ''), h('h3', { class: 'ev-title' }, title)];
    if (r.choice) body.push(h('div', { class: 'res-choice' }, (r.auto ? `${this.s.dog.name} · ` : '') + r.choice));
    if (r.res) body.push(this.koBlock(r.res, title));
    if (r.lines.length) body.push(this.renderLines(r.lines, title));
    if (r.delta.length) {
      body.push(h('div', { class: 'deltas' }, r.delta.map((d) => {
        const name = d.k.startsWith('b_') ? `${d.k === 'b_iincho' ? '위원장' : personFor(this.s.cast, d.k.slice(2)).ko} 유대` : STAT_KO[d.k];
        return h('span', { class: 'delta ' + (d.v > 0 ? 'up' : 'down') }, `${name} ${d.v > 0 ? '+' : ''}${d.v}`);
      })));
    }
    for (const n of r.notes.filter((x) => x !== '성공' && x !== '실패')) body.push(h('p', { class: 'note' }, n));
    if (r.foil) {
      body.push(h('div', { class: 'stamp' }, '作戦阻止', h('small', null, `통산 ${this.s.foiled}회`)));
      if (!again) this.big('作戦阻止');
    }
    if (r.clear) {
      const st = SUB_TITLES[r.clear];
      body.push(h('div', { class: 'stamp' }, 'サブストーリー クリア', h('small', { lang: 'ja' }, `「${st.ja}」`)));
      if (!again) {
        this.big('クリア');
        this.app.sound.sfx('clear');
      }
    }
    this.resultMs = resultShowMs(r);
    this.panel.replaceChildren(...body);
    this.foot.replaceChildren(h('button', { class: 'btn primary', type: 'button', onclick: () => this.doAck() }, 'つぎへ'));
    if (this.s.phase === 'result') this.renderHud();
  }

  doAck() {
    if (this.s.phase !== 'result') return;
    G.ack(this.s);
    this.elapsed = Math.min(this.elapsed, SEASON_MS - 1500);
    this.save();
    this.renderHud();
    this.renderPhase();
  }

  showWord() {
    const w = this.s.pendingWord;
    this.wait = 0;
    const q = resolveKo(w.q, { s: this.s });
    const input = h('input', { class: 'word-input', id: 'word-input', maxlength: '30', placeholder: '직접 쓰기', 'aria-label': '한마디' });
    this.panel.replaceChildren(h('div', { class: 'ev-cat' }, '節目'), h('h3', { class: 'ev-title' }, q));
    this.foot.replaceChildren(
      ...w.presets.map((p) => h('button', { class: 'btn', type: 'button', onclick: () => this.doWord(p) }, p)),
      h('div', { class: 'row' }, input, h('button', { class: 'mini-btn', type: 'button', style: 'min-width:72px', onclick: () => input.value.trim() && this.doWord(input.value) }, '남기기')));
  }

  doWord(text, auto) {
    if (this.s.phase !== 'word') return;
    G.setWord(this.s, text, auto);
    if (auto) this.log(`オート: 「${text}」`);
    this.save();
    this.renderPhase();
  }

  // ───── 탬버린 미니게임 ─────
  tambourine(v) {
    const total = 12;
    let hits = 0;
    let started = false;
    const period = 620;
    const ring = h('div', { class: 'ring' });
    const drum = h('div', { class: 'drum', role: 'button', tabindex: '0', 'aria-label': '탬버린' }, ring, h('span', null, '♪'));
    const score = h('div', { class: 'score' }, '탭: 시작');
    const box = h('div', { class: 'mini' }, drum, score);
    let t0 = 0;
    let raf = 0;
    const loop = (now) => {
      if (!started) return;
      const ph = ((now - t0) % period) / period;
      ring.style.transform = `scale(${1.9 - ph * 0.9})`;
      ring.style.opacity = String(1 - ph * 0.3);
      if (Math.floor((now - t0) / period) >= total) return finish();
      raf = requestAnimationFrame(loop);
    };
    const finish = () => {
      started = false;
      cancelAnimationFrame(raf);
      const ratio = hits / total;
      const want = ratio >= 0.75 ? 'great' : ratio >= 0.4 ? 'ok' : 'bad';
      const c = v.choices.find((x) => x.mini === want) || v.choices[0];
      score.textContent = `${hits} / ${total}`;
      setTimeout(() => this.doChoose(c.i, false), 700);
    };
    let lastHitBeat = -1;
    const hit = () => {
      const now = performance.now();
      if (!started) {
        started = true;
        t0 = now;
        raf = requestAnimationFrame(loop);
        score.textContent = `0 / ${total}`;
        return;
      }
      this.app.sound.sfx('tap');
      drum.classList.add('hit');
      setTimeout(() => drum.classList.remove('hit'), 90);
      const ph = ((now - t0) % period) / period;
      const b = Math.floor((now - t0) / period);
      if ((ph > 0.8 || ph < 0.12) && b !== lastHitBeat) {
        hits++;
        lastHitBeat = ph > 0.8 ? b + 1 : b;
      }
      score.textContent = `${hits} / ${total}`;
    };
    drum.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      hit();
    });
    drum.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && hit());
    return h('div', null, h('p', { class: 'note', style: 'text-align:center' }, '고리가 닿을 때 탭'), box);
  }

  // ───── 근황·메뉴 ─────
  castSheet(role) {
    const s = this.s;
    const p = personFor(s.cast, role);
    const ach = s.ach[role];
    const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && back.remove() },
      h('div', { class: 'modal' },
        h('div', { class: 'ev-cat' }, ROLE_KO[role]),
        h('h3', { class: 'ev-title' }, p.ko, h('small', { class: 'note', lang: 'ja', style: 'margin-left:8px' }, p.s ? (/^[ァ-ヶー]+$/.test(p.s) ? `${p.s}・${p.g}` : `${p.s} ${p.g}`) : p.g)),
        h('p', null, s.news[role]),
        h('p', { class: 'note' }, `유대 ${s.bond[role]}`),
        ach.length ? h('ul', null, ach.map((a) => h('li', null, `${Math.floor(a.t / 4)}살 — ${a.text}`))) : null,
        h('button', { class: 'btn primary', type: 'button', onclick: () => back.remove() }, '닫기')));
    this.app.root.append(back);
  }

  menu() {
    const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && close() });
    const close = () => back.remove();
    back.append(h('div', { class: 'modal' },
      h('h3', { class: 'ev-title' }, 'メニュー'),
      this.app.studyControls(),
      h('h3', { class: 'h' }, '소리'),
      this.app.soundControls(),
      h('div', { class: 'btns', style: 'margin-top:10px' },
        h('div', { class: 'row' },
          h('button', { class: 'btn center', type: 'button', onclick: () => { close(); this.save(); this.app.go('wordbook'); } }, '単語帳'),
          h('button', { class: 'btn center', type: 'button', onclick: () => { close(); this.save(); this.app.go('review'); } }, '復習')),
        h('button', { class: 'btn center', type: 'button', onclick: () => { close(); this.save(); this.app.go('title'); } }, 'タイトル'),
        h('button', { class: 'btn primary', type: 'button', onclick: close }, '닫기'))));
    this.app.root.append(back);
  }
}

// 한국어 해설을 앞부분(상황)과 나머지로 나눈다. 문장 단위로 40자 안팎까지 (첫 문장은 항상 통째로).
export function splitContext(text) {
  const parts = String(text).split(/(?<=[.!?…」])\s+/);
  let head = parts[0];
  let i = 1;
  while (i < parts.length && plainKo(head + ' ' + parts[i]).length <= 40) head += ' ' + parts[i++];
  return { head, rest: parts.slice(i).join(' ') };
}

function lineHas(tpl, id) {
  const segs = LINES.lines[tpl] || [];
  return segs.some((sg) => sg && (sg.g === id.slice(2) || sg.v === id.slice(2)));
}

function spLabelText(sp, s) {
  if (sp.startsWith('@')) return sp.slice(1);
  if (sp === 'dog') return s.dog.name;
  return personFor(s.cast, sp).call;
}
