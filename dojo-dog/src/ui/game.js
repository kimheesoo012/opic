// 게임 화면: 위 조작 줄 → LCD 창 → 이야기 칸 → 선택 버튼. 시간 흐름, 오토, 배속.
import * as G from '../engine/core.js';
import { SEASON_MS, SPEEDS, FIRST_EVENT_MS, AUTO_WORD_MS, eventShowMs, resultShowMs } from '../engine/pace.js';
import { SEASON_JA, SEASON_KO, STAT_KO, STAT_JA, STAGES, ROLE_KO, ROLE_JA, ROLES, personFor } from '../engine/world.js';
import { SUB_TITLES } from '../data/index.js';
import { resolveKo, plainKo, plainJa, splitSentJa, splitSentKo } from '../engine/text.js';
import { h, renderJa, renderKo, renderSpeaker, plainSegs, sceneTargets, markLead, catChunks, nearestSpan, LINES } from './render.js';
import { itemOf } from '../engine/study.js';
import { LCD } from './pixel/lcd.js';
import { idlePlan, eventPlan, lookFor } from './pixel/director.js';
import { icon } from './icons.js';
import { store } from './store.js';
import { quizLog, noteScene, sceneQuizDue, cardDue, reschedule } from '../engine/quizplan.js';
import { planQuiz, renderQuiz } from './playquiz.js';
import { modal } from './vocabui.js';
import { legendView, LEGEND_TITLE } from './help.js';

const CAT = { daily: '日常', kendo: '稽古', sub: 'サブストーリー', iincho: '委員長', cast: '道場の人々', milestone: '節目', hub: '日常' };
const CAT_KO = { daily: '일상', kendo: '연습(稽古)', sub: '서브 스토리', iincho: '위원장', cast: '도장 사람들', milestone: '중요한 고비', hub: '일상' };
// 처음 한 번 뜨는 표시 안내가 열려 있는 동안 오토를 멈춘다. 다만 오래(실제 시간 25초) 두면 다시 흐른다 (오토 감상이 멈춰 버리지 않게)
const LEGEND_HOLD_MS = 25000;
// 이야기 칸 아래쪽 여백(styles.css ux 블록의 .panel padding-bottom)보다 더 가려져 있으면 「▼ 続き」
const MORE_PAD = 16;
const STAT_ORDER = ['hap', 'hea', 'back', 'soc', 'brave', 'mis'];
const RUBY_SCENES = 4; // 확인 문제가 고르는 범위(최근 네 장면, quizplan RECENT_SCENES)와 같게
// 이름은 줄바꿈할 자리(<wbr>)를 넣어 둘로 나눈다 (작은 창에서 두 줄로)
const AUTO_MODES = [
  ['major', ['大事な場面だけ', '止まる']],
  ['all', ['全部', 'おまかせ']],
  ['off', ['オートを', '切る']],
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
    // 최근 장면들(최대 RUBY_SCENES개)에서 후리가나를 달아 보여 준 단어·문법 id. 확인 문제가 방금 본 읽기를 묻지 않게 넘긴다.
    this.rubyRecent = (state.rubyRecent || []).map((x) => new Set(x));
    // 지금 장면에서 번역을 열고 닫을 수 있는 것들 { on(), set(on) } — 머리줄 「全訳」이 한꺼번에 다룬다
    this.tr = [];
  }

  get set() {
    return this.app.settings;
  }
  // 일본어 몰입 모드(기본): 서술·제목·선택지·결과를 일본어로, 한국어는 문장을 탭했을 때만
  get ja() {
    return (this.set.lang || 'ja') === 'ja';
  }

  mount() {
    const s = this.s;
    // ── 조작 줄
    this.speedBtns = SPEEDS.map((sp) => h('button', { type: 'button', 'aria-pressed': String(this.set.speed === sp), 'aria-label': `${sp}배속`, onclick: () => this.setSpeed(sp) }, `${sp}x`));
    this.pauseBtn = h('button', { class: 'ctl', type: 'button', 'aria-label': '일시정지', onclick: () => this.togglePause() }, icon('pause', 18));
    this.autoBtn = h('button', { class: 'ctl auto', type: 'button', 'aria-expanded': 'false', onclick: () => this.toggleAutoPanel() }, 'オート');
    this.modeCap = h('div', { class: 'auto-cap' });
    const menuBtn = h('button', { class: 'ctl', type: 'button', 'aria-label': '메뉴', onclick: () => this.menu() }, icon('menu', 18));
    // オート 방식 고르기: 조작 줄 위에 겹치는 작은 창. 도트 창과 이야기는 가리지 않는다. 고르거나 바깥을 누르면 닫힌다.
    this.autoPanel = h('div', { class: 'auto-panel', hidden: true, role: 'group', 'aria-label': 'オート' }, AUTO_MODES.map(([m, parts]) => h('button', { class: 'btn center', type: 'button', 'data-mode': m, onclick: () => this.setAuto(m) }, parts[0], h('wbr'), parts[1])));
    const top = h('div', { class: 'topbar pad' },
      this.modeCap,
      h('div', { class: 'ctrl' }, this.pauseBtn, h('div', { class: 'seg speeds', role: 'group', 'aria-label': '배속' }, this.speedBtns), this.autoBtn, menuBtn, this.autoPanel));
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
    // 직접 스크롤해도 「▼ 続き」 단추가 바로 바뀌게
    this.panel.addEventListener('scroll', () => {
      if (this.moreRaf) return;
      this.moreRaf = requestAnimationFrame(() => {
        this.moreRaf = 0;
        this.updateMore();
      });
    }, { passive: true });
    this.foot = h('div', { class: 'foot pad' });
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
    this.closeAutoPanel();
    this.lcd && this.lcd.stop();
  }

  // 접힘 여부: 직접 고른 값이 있으면 그 값, 없으면 아주 낮은 화면(600px 미만)에서는 늘 접어 둔다 (장면마다 열고 닫으면 화면이 흔들린다)
  isFolded() {
    if (typeof this.set.lcdFold === 'boolean') return this.set.lcdFold;
    return window.innerHeight < 600;
  }
  toggleFold() {
    this.set.lcdFold = !this.isFolded();
    this.app.saveSettings();
    this.fitLcd();
  }
  renderFold() {
    const fold = this.isFolded();
    this.el.classList.toggle('lcd-fold', fold);
    // 화살표와 글자를 따로 묶어 둔다: 도트 창 옆 좁은 자리에서는 두 줄로 (글자 중간에서 끊기지 않게)
    this.foldBtn.replaceChildren(h('span', null, fold ? '▼' : '▲'), ' ', h('span', null, this.ja ? (fold ? 'ひらく' : 'たたむ') : fold ? '펼치기' : '접기'));
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
    // 760→860: Claude 앱 안의 화면처럼 위에 머리줄이 있어 세로가 짧은 경우까지 대사·선택지에 자리를 준다
    const short = vh < 860;
    const tiny = vh < 700;
    const mini = vh < 600;
    // 장면이 바뀔 때 크기·간격이 오르내리면 화면 전체가 흔들려 어지럽다. 화면 높이로만 정하고 장면과 무관하게 고정한다.
    const target = Math.min(avail, mini ? 160 : tiny ? 175 : short ? 230 : 290);
    this.el.classList.toggle('tiny', tiny);
    this.el.classList.toggle('compact', short);
    this.el.classList.toggle('xs', mini);
    this.renderFold();
    const k = Math.max(1, Math.floor((target * dpr) / 160));
    const w = (k * 160) / dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = (w * 96) / 160 + 'px';
    // 짧은 화면: 계절·성장 단계·접기 단추를 도트 창 위의 줄 대신 도트 창 양옆의 빈 자리에 둔다 (세로 40px 남짓을 이야기 칸에)
    // 양옆 자리가 좁은 기기(폭 360px 미만 등)에서는 예전처럼 위의 한 줄
    // 기기 안쪽 폭(clientWidth − 좌우 padding 16) − 도트 창(캔버스 + padding 8) − 칸 사이 간격 12
    const side = (this.device.clientWidth - 16 - (w + 8) - 12) / 2;
    this.el.classList.toggle('lcd-side', short && side >= 48);
    this.updateMore();
  }

  // ───── 시간 ─────
  tick() {
    const now = performance.now();
    const dt = Math.min(200, now - this.last);
    this.last = now;
    // 글자 크기·번역·창 크기가 바뀌어도 「▼ 続き」가 맞게 (가볍게, 0.3초마다)
    if (!(now - (this.moreAt || 0) < 300)) {
      this.moreAt = now;
      this.updateMore();
    }
    if (this.paused || this.app.modalOpen() || this.quiz) return;
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
        if (this.legendHold()) break;
        if (this.autoActive() && !this.manualOnce) {
          this.wait += dt * sp;
          const delay = eventShowMs(G.view(s)) * (this.set.focus ? 1.6 : 1);
          if (!this.autoShown && this.wait > delay * 0.4) this.showAutoPick();
          if (this.autoRead(delay) && this.wait > delay) this.doChoose(this.autoIdx, true);
        }
        break;
      case 'result':
        if (this.legendHold()) break;
        if (this.autoActive()) {
          this.wait += dt * sp;
          const delay = this.resultMs * (this.set.focus ? 1.6 : 1);
          if (this.autoRead(delay) && this.wait > delay) this.doAck();
        }
        break;
      case 'word':
        if (this.legendHold()) break;
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
    this.renderHud();
    this.setIdle();
    this.renderIdle();
    this.save();
    // 학습 모드: 계절이 바뀔 때 가끔 복습 카드 (이야기와 따로, 예전에 만난 말)
    if (cardDue(quizLog(s), this.set, s.t)) this.openQuiz('card');
  }

  // 플레이 중 학습: src 'scene'(장면 뒤 확인 문제) | 'card'(복습 카드). 문제가 없으면 아무것도 하지 않는다.
  openQuiz(src) {
    const log = quizLog(this.s);
    const plan = planQuiz(log, src, Date.now(), this.ja, this.rubySeenRecent());
    if (src === 'scene') reschedule(log, this.set);
    if (!plan) return false;
    if (src === 'card') log.lastCard = this.s.t;
    this.quiz = src;
    this.wait = 0;
    renderQuiz(this.app, this, plan, src, log, () => {
      this.quiz = null;
      this.save();
      this.renderPhase();
    });
    this.resetScroll();
    return true;
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
    if (!open) return this.closeAutoPanel();
    this.autoPanel.hidden = false;
    this.autoBtn.setAttribute('aria-expanded', 'true');
    this.renderMode();
    if (!this.onOutside) {
      // 바깥을 누르면 닫기만 한다: 그 탭이 도트 창(건너뛰기)이나 대사를 함께 누르지 않게 뒤따르는 click을 삼킨다
      this.onOutside = (e) => {
        if (this.autoPanel.contains(e.target)) return;
        this.swallowUntil = performance.now() + 800;
        this.closeAutoPanel();
      };
      this.onSwallow = (e) => {
        if (!this.swallowUntil) return;
        const hit = performance.now() < this.swallowUntil;
        this.swallowUntil = 0;
        if (hit) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      this.onAutoKey = (e) => {
        if (e.key !== 'Escape') return;
        this.closeAutoPanel();
        this.autoBtn.focus();
      };
    }
    document.addEventListener('pointerdown', this.onOutside, true);
    document.addEventListener('click', this.onSwallow, true);
    document.addEventListener('keydown', this.onAutoKey, true);
    const cur = this.autoPanel.querySelector('[aria-pressed="true"]');
    if (cur) cur.focus({ preventScroll: true });
  }
  closeAutoPanel() {
    if (!this.autoPanel) return;
    this.autoPanel.hidden = true;
    this.autoBtn.setAttribute('aria-expanded', 'false');
    if (!this.onOutside) return;
    document.removeEventListener('pointerdown', this.onOutside, true);
    document.removeEventListener('keydown', this.onAutoKey, true);
    // click 삼키기는 바로 뒤따르는 click 하나에만 쓰고 스스로 풀린다
    setTimeout(() => {
      if (!this.autoPanel.hidden) return;
      this.swallowUntil = 0;
      document.removeEventListener('click', this.onSwallow, true);
    }, 900);
  }
  setAuto(m) {
    if (m === 'off') this.set.auto = false;
    else {
      this.set.auto = true;
      this.set.autoMode = m;
    }
    this.app.saveSettings();
    this.wait = 0;
    this.closeAutoPanel();
    this.renderMode();
  }
  renderMode() {
    const cur = this.set.auto ? this.set.autoMode : 'off';
    this.modeCap.textContent = this.set.auto ? (cur === 'all' ? '全部おまかせ' : '大事な場面だけ止まる') : 'オート切';
    this.autoBtn.setAttribute('aria-pressed', String(this.set.auto));
    for (const b of this.autoPanel.children) b.setAttribute('aria-pressed', String(b.dataset.mode === cur));
  }

  // 최근 장면들에서 후리가나를 보여 준 id 전체 (진행 중인 장면 포함)
  rubySeenRecent() {
    const all = new Set();
    for (const set of [...this.rubyRecent, this.bag && this.bag.ruby]) if (set) for (const id of set) all.add(id);
    return all;
  }

  save() {
    this.s.seenWords = [...this.seenWords].slice(-800);
    this.s.rubyRecent = this.rubyRecent.map((x) => [...x]);
    if (this.seenNames) this.s.seenNames = [...this.seenNames];
    this.app.saveGame(this.s);
  }

  ageTextJa() {
    const t = this.s.t;
    if (t < 4) return `生後${3 + t * 3}か月`;
    return `${Math.floor(t / 4)}歳`;
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
    this.whenEl.replaceChildren(h('span', null, SEASON_JA[sea]), ' ', h('span', null, `${G.yearNo(s)}年目`));
    const st = STAGES.find((x) => x.id === G.stage(s));
    this.stageBtn.textContent = st.ja;
    const STAT = this.ja ? STAT_JA : STAT_KO;
    this.ageEl.textContent = `${s.dog.name} · ${this.ja ? this.ageTextJa() : this.ageText()}`;
    this.statsEl.replaceChildren(...STAT_ORDER.map((k) => h('span', { class: 'stat', title: STAT[k] }, icon(k, 16), h('span', { class: 'bar' }, h('i', { style: `width:${s.st[k]}%` })))));
    this.statsDetail.replaceChildren(...STAT_ORDER.map((k) => h('span', null, icon(k, 16), `${STAT[k]} ${Math.round(s.st[k])}`)));
    if (first) this.fitLcd();
  }


  log(text, textJa = null) {
    this.pendingLog = this.pendingLog || [];
    this.pendingLog.push({ ko: text, ja: textJa });
  }
  // 계절 사이의 기록 줄. 일본어 모드: 일본어로 쓰고, 탭하면 한국어가 아래에
  flushLog() {
    const s = this.s;
    for (const l of s.log.splice(0)) this.log(l.text, l.textJa ? plainJa(l.textJa, { s }) : null);
    for (const { ko, ja } of this.pendingLog || []) this.logEl.prepend(this.ja && ja ? tapKo(h('p', { lang: 'ja' }, ja), ko) : h('p', null, ko));
    this.pendingLog = [];
    while (this.logEl.children.length > 3) this.logEl.lastChild.remove();
  }

  // ───── 장면 ─────
  setIdle() {
    this.idle = true;
    this.lcd.setPlan(idlePlan(this.s, this.elapsed / SEASON_MS), this.s);
  }
  renderIdle() {
    this.flushLog();
    // 기다리는 동안은 도트 창의 개만 본다. 사람들의 근황은 메뉴 → 「道場の人々」
    this.panel.replaceChildren(this.logEl);
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
      // 점선 이름: 읽기와 누구(무엇)인지 풀이 창
      onName: (q) => this.app.openName(q, this.s),
      newTerms: [],
      rubySeen: this.bag ? this.bag.ruby : null,
      saved: new Set(Object.keys(store.wordbook())),
    };
  }

  // 장면의 학습 대상: 대사(+ 일본어 모드에서는 서술 문장)에서 고른다. 만난 것으로 기록하고, 장면 뒤 확인 문제에 쓴다.
  sceneIds(tpls) {
    const targetIds = sceneTargets(tpls, this.set);
    this.app.meet(targetIds, this.s);
    if (this.bag) {
      this.bag.lines += tpls.length;
      for (const id of targetIds) {
        this.bag.ids.add(id);
        const hit = tpls.find((t) => lineHas(t, id));
        if (hit) this.bag.where[id] = hit;
      }
    }
    return targetIds;
  }

  // 일본어 서술: 문장마다 탭하면 그 문장의 한국어가 아래에 나온다 (낱말 밑줄을 탭하면 해설 창)
  // 서술 전체의 번역은 머리줄의 「全訳」이 대사와 함께 열고 닫는다 (this.tr에 등록)
  narrBlock(ja, ko, title, targets, cls = 'ev-text jp') {
    const jaS = splitSentJa(ja);
    const koS = splitSentKo(resolveKo(ko || '', { s: this.s }));
    const aligned = jaS.length === koS.length;
    const p = h('p', { class: cls, lang: 'ja' });
    const koBox = h('div', { class: 'sent-ko', hidden: true, lang: 'ko' });
    let open = -1; // -1 닫힘 · i 그 문장만 · 'all' 전부
    const show = (which) => {
      open = which;
      spans.forEach((x, j) => {
        x.classList.toggle('on', which === j);
        x.setAttribute('aria-expanded', String(which === j || which === 'all'));
      });
      if (which === -1) koBox.hidden = true;
      else {
        const rows = which === 'all' ? (aligned ? koS : [koS.join(' ')]) : [aligned ? koS[which] : koS.join(' ')];
        koBox.replaceChildren(...rows.map((t) => h('div', null, t)));
        koBox.hidden = false;
        for (const t of which === 'all' ? jaS : [jaS[which]]) this.app.noteTranslate(t);
      }
    };
    const spans = jaS.map((sent, i) => {
      const ctx = this.ctxFor(null);
      ctx.targets = targets;
      const scene = () => ({ tpl: sent, role: null, ja: plainJa(sent, { s: this.s }), ko: aligned ? koS[i] : koS.join(' '), sp: '', title, when: this.ageText() });
      ctx.onWord = (key) => this.app.openWord(key, scene());
      ctx.onGrammar = (key) => this.app.openGrammar(key, scene());
      const span = h('span', { class: 'sent', role: 'button', tabindex: '0', 'aria-expanded': 'false', 'aria-label': '이 문장 번역' }, renderJa(sent, ctx));
      const toggle = () => {
        show(open === i ? -1 : i);
        this.translated();
        if (open === i) this.reveal(span, koBox);
      };
      span.addEventListener('click', toggle);
      span.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle()));
      span._toggle = toggle;
      return span;
    });
    p.append(...spans);
    // 문장 사이 틈(루비 줄 위·줄 사이·끝의 빈자리)을 눌러도 가장 가까운 문장의 번역이 열리게
    p.addEventListener('click', (e) => {
      if (e.target !== p || !spans.length) return;
      const near = nearestSpan(spans, e.clientX, e.clientY);
      if (near) near._toggle();
    });
    markLead(p);
    if (koS.length) this.tr.push({ on: () => open === 'all', set: (on) => (on ? open !== 'all' && show('all') : open !== -1 && show(-1)) });
    return h('div', { class: 'narr' }, p, koBox);
  }

  // 대사: 화자 이름을 첫 줄 앞에 붙여 쓴다(이름 줄 하나만큼 세로 자리를 아낀다).
  // 일본어 모드: 대사를 탭하면 그 대사의 한국어가 아래에, 다시 탭하면 닫힌다. 오른쪽 위의 작은 「訳」도 같은 일 (키보드·화면 읽기용)
  // 대사 속 밑줄 단어·문법·점선 이름은 제 창을 연다 (그쪽에서 탭을 멈춘다)
  renderLines(lines, title, ids = null) {
    const box = h('div', { class: 'lines' });
    const focus = !!this.set.focus;
    const targetIds = ids || this.sceneIds(lines.map((l) => l[1]));
    const targets = new Set(targetIds);
    const scenes = {};
    for (const [sp, ja, ko] of lines) {
      const ctx = this.ctxFor(sp);
      ctx.targets = targets;
      const koText = resolveKo(ko, { s: this.s });
      const koEl = h('div', { class: 'ko', hidden: this.ja, lang: 'ko' }, koText);
      const spName = spLabelText(sp, this.s);
      const scene = () => ({ tpl: ja, role: sp, ja: plainSegs(ja, { s: this.s, speaker: sp }), ko: koText, sp: spName, title, when: `${this.ageText()} ${SEASON_KO[G.season(this.s)]}` });
      for (const id of targetIds) if (!scenes[id] && lineHas(ja, id)) scenes[id] = scene;
      ctx.onWord = (key) => this.app.openWord(key, scene());
      ctx.onGrammar = (key) => this.app.openGrammar(key, scene());
      const spEl = h('span', { class: 'sp' }, renderSpeaker(sp, this.s, this.set.furigana, ctx));
      const jaEl = h('div', { class: 'ja' }, renderJa(ja, ctx));
      if (!this.ja) {
        box.append(h('div', { class: 'line dl' }, spEl, jaEl, koEl));
        continue;
      }
      const btn = h('button', { class: 'mini-btn line-tr', type: 'button', 'aria-pressed': 'false', 'aria-label': `${spName} 대사 번역` }, '訳');
      const line = h('div', { class: 'line dl tap' }, btn, spEl, jaEl, koEl);
      const set = (on) => {
        if (on === !koEl.hidden) return;
        koEl.hidden = !on;
        line.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', String(on));
        if (on) this.app.noteTranslate(ja);
      };
      const toggle = () => {
        set(koEl.hidden);
        this.translated();
        if (!koEl.hidden) this.reveal(line, koEl);
      };
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
      });
      line.addEventListener('click', (e) => {
        if (e.target.closest && e.target.closest('button, input, a, .pn')) return;
        // 글자를 길게 눌러 고르는 중이면 번역을 열지 않는다
        const sel = window.getSelection && window.getSelection();
        if (sel && !sel.isCollapsed && line.contains(sel.anchorNode)) return;
        toggle();
      });
      this.tr.push({ on: () => !koEl.hidden, set });
      box.append(line);
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

  // 일본어 제목: 탭하면 한국어 제목 (「全訳」에도 들어간다)
  titleEl(ja, ko) {
    if (!ja) return h('h3', { class: 'ev-title' }, resolveKo(ko || '', { s: this.s }));
    const koEl = h('span', { class: 'title-ko', hidden: true, lang: 'ko' }, ko);
    const el = h('h3', { class: 'ev-title jp', lang: 'ja', role: 'button', tabindex: '0', 'aria-expanded': 'false' }, markLead(renderJa(ja, { ...this.ctxFor(null), targets: new Set() })), koEl);
    const set = (on) => {
      if (on === !koEl.hidden) return;
      koEl.hidden = !on;
      el.setAttribute('aria-expanded', String(on));
      if (on) this.app.noteTranslate(ja);
    };
    const toggle = () => {
      set(koEl.hidden);
      this.translated();
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle()));
    this.tr.push({ on: () => !koEl.hidden, set });
    return el;
  }

  // 장면 머리줄: 제목 · 갈래(탭하면 한국어) · 「全訳」(일본어 모드). 한 줄에 모아 이야기 칸의 세로 자리를 아낀다.
  // 「全訳」은 몸통을 다 그린 뒤 번역할 것이 있을 때만 보인다 (finishHead)
  // shown: 머리줄에 보일 짧은 꼴 (도장 사람들 장면은 역할 이름만. 탭·화면 읽기는 전체 이름)
  sceneHead(titleNode, catJa, catKo, shown = catJa) {
    // 갈래 이름은 낱말 덩어리에서만 줄을 바꾼다 (道場の人々 / · 韓国から来た / 門下生, 도장 사람들 / · 사회인 / 수련생): 좁은 칸에서 「全訳」 밑으로 넘치지 않게
    const parts = shown ? shown.split(' · ').map((x, i) => h('span', null, catChunks(x).flatMap((c, j) => [j ? (/[가-힣]/.test(x) ? ' ' : h('wbr')) : null, h('span', { class: 'cat-chunk' }, (i && !j ? '· ' : '') + c)]))) : [];
    const cat = shown ? h('button', { class: 'ev-cat', type: 'button', lang: 'ja', 'aria-label': `${catJa} (${catKo})`, onclick: () => this.app.toast(`${catJa} — ${catKo}`) }, parts.flatMap((x, i) => (i ? [' ', x] : [x]))) : null;
    this.allBtn = this.ja ? h('button', { class: 'mini-btn tr-all', type: 'button', 'aria-pressed': 'false', 'aria-label': '장면 전체 번역', hidden: true, onclick: () => this.toggleAll() }, '全訳') : null;
    return h('div', { class: 'ev-head' }, titleNode, cat, this.allBtn);
  }
  finishHead() {
    if (this.allBtn) this.allBtn.hidden = !this.tr.length;
    this.syncAll();
  }
  // 「全訳」: 하나라도 닫혀 있으면 모두 열고, 모두 열려 있으면 모두 닫는다
  toggleAll() {
    const on = !this.tr.every((t) => t.on());
    for (const t of this.tr) t.set(on);
    this.translated();
  }
  syncAll() {
    if (!this.allBtn) return;
    const on = this.tr.length > 0 && this.tr.every((t) => t.on());
    this.allBtn.textContent = on ? '閉じる' : '全訳';
    this.allBtn.setAttribute('aria-pressed', String(on));
  }
  // 번역을 열거나 닫았다: 「全訳」 표시와 「▼ 続き」를 맞춘다
  translated() {
    this.syncAll();
    this.updateMore();
  }

  // 한국어 해설은 상황만 짧게: 앞 문장(40자 안팎)만 보이고 나머지는 「더보기」. 일본어 대사가 주인공이다.
  // full: 결과 문장은 자르지 않는다 (마지막 문장이 웃음 포인트인 경우가 많다)
  koBlock(text, title, full = false) {
    const ctx = this.ctxFor(null);
    ctx.onWord = (key) => this.app.openWord(key, { ja: '', ko: plainKo(text), sp: '', title, when: this.ageText() });
    const { head, rest } = full ? { head: text, rest: '' } : splitContext(text);
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
    if (this.quiz) return;
    const s = this.s;
    const keep = this.wait;
    const top = this.panel.scrollTop;
    if (s.phase === 'event') this.showEvent(true);
    else if (s.phase === 'result') this.showResult(true);
    this.wait = keep;
    this.panel.scrollTop = top;
    this.updateMore();
  }

  renderPhase() {
    const s = this.s;
    // 첫 장면에 띄운 표시 안내는 다음 장면으로 넘어가면 본 것으로 친다
    if (this.legend) this.closeLegend();
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
      this.updateMore();
    });
  }

  showEvent(again = false) {
    const v = G.view(this.s);
    if (!v) return;
    this.wait = 0;
    this.autoShown = false;
    this.tr = [];
    this.moreBtn = null;
    // 오토 선택은 장면마다 한 번만 정한다 (설정을 바꿔 다시 그려도 그대로)
    if (!again || this.autoIdx === undefined) this.autoIdx = G.autoChoice(this.s);
    const ev = G.EV.get(v.id);
    if (!again) this.bag = { ids: new Set(), where: {}, lines: 0, ruby: new Set() };
    if (!again) {
      const plan = eventPlan(this.s, v, this.elapsed / SEASON_MS);
      this.lcd.setPlan(plan, this.s);
      if (plan.big) {
        this.big(plan.big);
        this.app.sound.sfx('big');
      } else if (ev.cat === 'kendo' || ev.kendo) this.app.sound.sfx('shinai');
    }
    const catBase = v.sub ? 'サブストーリー' : CAT[v.cat] || '';
    const catKo = (v.sub ? CAT_KO.sub : CAT_KO[v.cat] || '') + (v.who ? ` · ${ROLE_KO[v.who]}` : '');
    const cat = catBase + (v.who ? ` · ${(this.ja ? ROLE_JA : ROLE_KO)[v.who]}` : '');
    // 도장 사람들 장면: 머리줄에는 역할 이름만 (「道場の人々 · 韓国から来た門下生」은 세 줄이 되어 이야기 칸을 줄인다)
    const catShown = v.who && !v.sub && v.cat === 'cast' ? (this.ja ? ROLE_JA : ROLE_KO)[v.who] : cat;
    if (this.ja && v.textJa) {
      // 일본어 몰입: 제목·서술 일본어, 서술 문장도 학습 대상에 넣는다
      const narr = splitSentJa(v.textJa);
      const ids = this.sceneIds([...narr, ...v.lines.map((l) => l[1])]);
      const targets = new Set(ids);
      const head = this.sceneHead(this.titleEl(v.titleJa, v.title), cat, catKo, catShown);
      this.panel.replaceChildren(...this.withLegend([head, this.narrBlock(v.textJa, v.text, v.title, targets), v.lines.length ? this.renderLines(v.lines, v.title, ids) : '']));
    } else {
      const head = this.sceneHead(h('h3', { class: 'ev-title' }, v.title), cat, catKo, catShown);
      this.panel.replaceChildren(...this.withLegend([head, v.text ? this.koBlock(v.text, v.title) : '', v.lines.length ? this.renderLines(v.lines, v.title) : '']));
    }
    this.finishHead();
    this.choiceBtns = [];
    this.manualOnce = false;
    const btns = [];
    const calm = this.autoActive() && v.choices.length && !v.mini;
    // 「선택지: 중요한 장면만」: 작은 장면은 개가 성격대로 움직인다. 대사를 읽고 つぎへ (원하면 직접 고르기)
    const dogActs = !calm && this.set.choiceMode !== 'all' && !v.major && !v.mini && v.choices.length > 1 && this.autoIdx >= 0;
    // 직접 고르는 장면도 선택지는 「행동 고르기」를 누른 뒤에 펼친다 (먼저 일본어 대사를 다 읽을 수 있게)
    const askFirst = !calm && !dogActs && !v.mini && v.choices.length > 1;
    if (calm) {
      // 오토가 고른 행동(일본어)을 탭하면 한국어
      this.autoLine = h('span', { class: 'auto-line-text', onclick: () => {
        const pair = this.autoShown && this.choiceBtns.find(([i]) => i === this.autoIdx);
        if (pair && pair[4] && pair[4] !== pair[3]) this.app.toast(pair[4]);
      } }, 'オート');
      btns.push(h('div', { class: 'auto-line' }, this.autoLine, h('button', { class: 'mini-btn', type: 'button', onclick: () => this.takeOver() }, this.ja ? '自分で選ぶ' : '직접 고르기')));
    }
    if (dogActs) {
      btns.push(h('div', { class: 'dog-acts' },
        this.primaryBtn('つぎへ', () => this.doChoose(this.autoIdx, true)),
        h('button', { class: 'mini-btn', type: 'button', onclick: (e) => { e.currentTarget.parentNode.remove(); this.revealChoices(); } }, this.ja ? '自分で選ぶ' : '직접 고르기')));
    }
    if (askFirst) {
      btns.push(this.primaryBtn(this.ja ? 'どうする？' : '행동 고르기', (e) => { e.currentTarget.remove(); this.revealChoices(); }, 'open-choices'));
    }
    if (v.mini && !this.autoActive()) btns.push(this.tambourine(v));
    else if (v.choices.length) {
      for (const c of v.choices) {
        const jp = this.ja && c.tJa;
        const why = !c.ok && (jp && c.whyJa ? c.whyJa : c.why);
        // 번역: 선택지의 한국어(고를 수 없는 까닭이 있으면 그것도)
        const ko = jp ? h('span', { class: 'choice-ko', hidden: true, lang: 'ko' }, c.t, !c.ok && c.why && c.whyJa ? ` (${c.why})` : '') : null;
        // 선택지 안의 이름은 점선·탭 없이 (이름을 눌러도 그 선택지를 고르게)
        const label = jp ? markLead(renderJa(c.tJa, { ...this.ctxFor(null), targets: new Set(), onName: null, plainNames: true })) : c.t;
        const b = h('button', { class: 'btn' + (c.ok ? '' : ' off'), type: 'button', disabled: !c.ok, lang: jp ? 'ja' : null, onclick: () => this.doChoose(c.i, false) }, h('span', null, label, ko, why ? h('div', { class: 'why' }, jp && c.whyJa ? plainJa(c.whyJa, { s: this.s }) : why) : null));
        // 번역은 선택과 따로: 「訳」을 눌러도 고르지 않는다
        const tr = jp ? h('button', { class: 'tr-btn', type: 'button', 'aria-label': '이 선택지 번역', 'aria-pressed': 'false', onclick: (e) => {
          e.stopPropagation();
          // 선택지 칸이 번역만큼 커져도, 보이던 마지막 대사는 계속 보이게
          const keep = this.lastLineVisible();
          ko.hidden = !ko.hidden;
          tr.setAttribute('aria-pressed', String(!ko.hidden));
          if (!ko.hidden) this.app.noteTranslate(c.tJa);
          if (keep) this.showLastLine();
        } }, '訳') : null;
        const row = h('div', { class: 'choice-row', hidden: calm || dogActs || askFirst }, b, tr);
        this.choiceBtns.push([c.i, row, b, jp ? plainJa(c.tJa, { s: this.s }) : c.t, c.t]);
        btns.push(row);
      }
    } else btns.push(this.primaryBtn('つぎへ', () => this.doChoose(-1, false)));
    this.foot.replaceChildren(...btns);
  }

  // 오토 장면에서 「직접 고르기」: 이번 장면만 오토를 멈추고 선택지를 펼친다
  takeOver() {
    this.manualOnce = true;
    const line = this.foot.querySelector('.auto-line');
    if (line) line.remove();
    this.revealChoices();
  }

  // 선택지를 펼친다. 아래 칸이 커져도 마지막 대사가 선택지 바로 위에 보이도록 이야기 칸을 내린다 (무엇에 답하는지 다시 읽을 수 있게)
  revealChoices() {
    for (const [, b] of this.choiceBtns) b.hidden = false;
    this.showLastLine();
    requestAnimationFrame(() => this.showLastLine());
  }
  // 마지막 대사(없으면 서술). 대사 아래 「訳」 줄이 함께 들어가면 그것까지
  lastLineBox() {
    const p = this.panel;
    const lines = p.querySelectorAll('.lines > .line');
    const last = lines[lines.length - 1] || p.querySelector('.narr');
    if (!last) return null;
    const r = last.getBoundingClientRect();
    const tools = lines.length ? p.querySelector('.lines > .tools') : null;
    const tb = tools && tools.getBoundingClientRect();
    // 서술만 있는 장면: 서술의 끝(마지막 두 줄 남짓)을 맞춘다
    const top = lines.length ? r.top : r.bottom - Math.min(r.height, 72);
    return { top, bottom: tb && tb.height ? Math.max(r.bottom, tb.bottom) : r.bottom, lineBottom: r.bottom };
  }
  showLastLine() {
    const box = this.lastLineBox();
    if (!box) return;
    const p = this.panel;
    const pr = p.getBoundingClientRect();
    const pad = 8;
    // 「訳」 줄까지 들어가지 않으면 대사만
    const bottom = box.bottom - box.top + pad * 2 <= pr.height ? box.bottom : box.lineBottom;
    let d = Math.max(0, bottom - (pr.bottom - pad));
    // 대사가 칸보다 길면 그 대사의 처음부터
    if (box.top - d < pr.top + pad) d = box.top - (pr.top + pad);
    if (Math.abs(d) >= 1) p.scrollTop += d;
  }
  // 마지막 대사의 끝이 지금 이야기 칸 안에 보이는가
  lastLineVisible() {
    const box = this.lastLineBox();
    if (!box) return false;
    const pr = this.panel.getBoundingClientRect();
    return box.lineBottom <= pr.bottom + 1 && box.lineBottom >= pr.top;
  }

  showAutoPick() {
    this.autoShown = true;
    const pair = this.choiceBtns.find(([i]) => i === this.autoIdx);
    if (this.autoLine && pair && !this.manualOnce) this.autoLine.textContent = `オート · ${pair[3]}`;
    if (pair) {
      pair[2].classList.add('auto-pick');
      pair[2].append(h('span', { class: 'auto-badge' }, 'オート'));
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
    this.tr = [];
    this.moreBtn = null;
    const ev = G.EV.get(r.id);
    // 허브(누구 옆에·산책 코스)는 고르면 바로 그 장면으로: 할 말이 없는 결과 화면은 건너뛴다
    if (ev.cat === 'hub' && !r.res && !(r.lines && r.lines.length)) return this.doAck();
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
    const jp = this.ja && (r.resJa || ev.titleJa);
    const body = [this.sceneHead(jp && ev.titleJa ? this.titleEl(ev.titleJa, title) : h('h3', { class: 'ev-title' }, title), CAT[ev.cat] || '', CAT_KO[ev.cat] || '')];
    if (r.choice) {
      const pre = r.auto ? `${this.s.dog.name} · ` : '';
      if (jp && r.choiceJa) {
        // 일본어 모드: 탭하면 한국어가 아래에 (「全訳」에도 들어간다)
        const ko = h('div', { class: 'ko', hidden: true, lang: 'ko' }, r.choice);
        const el = h('div', { class: 'res-choice tap', lang: 'ja', role: 'button', tabindex: '0', 'aria-expanded': 'false' }, pre + plainJa(r.choiceJa, { s: this.s }), ko);
        this.tapRow(el, ko, r.choiceJa);
        body.push(el);
      } else body.push(h('div', { class: 'res-choice' }, pre + r.choice));
    }
    if (jp && r.resJa) {
      const narr = splitSentJa(r.resJa);
      const ids = this.sceneIds([...narr, ...r.lines.map((l) => l[1])]);
      body.push(this.narrBlock(r.resJa, r.res, title, new Set(ids)));
      if (r.lines.length) body.push(this.renderLines(r.lines, title, ids));
    } else {
      if (r.res) body.push(this.koBlock(r.res, title, true));
      if (r.lines.length) body.push(this.renderLines(r.lines, title));
    }
    if (r.delta.length) {
      body.push(h('div', { class: 'deltas' }, r.delta.map((d) => {
        const p = d.k.startsWith('b_') && d.k !== 'b_iincho' ? personFor(this.s.cast, d.k.slice(2)) : null;
        const who = d.k === 'b_iincho' ? '위원장' : p && p.ko;
        // 받침이 있으면 「과」, 없으면 「와」
        const wa = (w) => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? '과' : '와');
        const nameKo = d.k.startsWith('b_') ? `${who}${wa(who)}의 유대` : STAT_KO[d.k];
        const name = this.ja ? (d.k.startsWith('b_') ? `${d.k === 'b_iincho' ? '委員長' : p.call}との絆` : STAT_JA[d.k]) : nameKo;
        const v = `${d.v > 0 ? '+' : ''}${d.v}`;
        // 일본어 모드: 탭하면 한국어 뜻
        return this.ja
          ? h('button', { class: 'delta ' + (d.v > 0 ? 'up' : 'down'), type: 'button', onclick: () => this.app.toast(`${nameKo} ${v}`) }, `${name} ${v}`)
          : h('span', { class: 'delta ' + (d.v > 0 ? 'up' : 'down') }, `${name} ${v}`);
      })));
    }
    const notes = this.ja && r.notesJa ? r.notesJa.filter((x) => x !== '成功' && x !== '失敗') : r.notes.filter((x) => x !== '성공' && x !== '실패');
    const notesKo = r.notes.filter((x) => x !== '성공' && x !== '실패');
    notes.forEach((n, i) => body.push(this.ja && notesKo[i] && notesKo[i] !== n ? toastTap(h('p', { class: 'note', lang: 'ja' }, n), notesKo[i], this.app) : h('p', { class: 'note' }, n)));
    // 도장 찍기(일본어): 탭하면 한국어
    if (r.foil) {
      body.push(toastTap(h('div', { class: 'stamp', lang: 'ja' }, '作戦阻止', h('small', null, this.ja ? `通算${this.s.foiled}回` : `통산 ${this.s.foiled}회`)), `작전 저지 — 위원장의 작전을 막았다 (통산 ${this.s.foiled}회)`, this.app));
      if (!again) this.big('作戦阻止');
    }
    if (r.clear) {
      const st = SUB_TITLES[r.clear];
      body.push(toastTap(h('div', { class: 'stamp', lang: 'ja' }, 'サブストーリー クリア', h('small', { lang: 'ja' }, `「${st.ja}」`)), `서브 스토리 클리어 — 「${st.ko}」`, this.app));
      if (!again) {
        this.big('クリア');
        this.app.sound.sfx('clear');
      }
    }
    this.resultMs = resultShowMs(r);
    this.panel.replaceChildren(...this.withLegend(body));
    this.finishHead();
    this.foot.replaceChildren(this.primaryBtn('つぎへ', () => this.doAck()));
    if (this.s.phase === 'result') this.renderHud();
  }

  doAck() {
    if (this.s.phase !== 'result') return;
    G.ack(this.s);
    this.elapsed = Math.min(this.elapsed, SEASON_MS - 1500);
    // 일본어 대사가 있던 장면이 끝났다: 학습 기록에 남기고, 차례가 되면 확인 문제 (사건 순서는 그대로)
    const bag = this.bag;
    this.bag = null;
    const log = quizLog(this.s);
    if (bag && bag.lines) noteScene(log, [...bag.ids], bag.where, this.set);
    if (bag && (bag.lines || bag.ruby.size)) {
      this.rubyRecent.unshift(bag.ruby);
      this.rubyRecent.length = Math.min(this.rubyRecent.length, RUBY_SCENES);
    }
    this.save();
    this.renderHud();
    if (bag && bag.lines && sceneQuizDue(log, this.set) && this.openQuiz('scene')) return;
    this.renderPhase();
  }

  showWord() {
    const w = this.s.pendingWord;
    this.wait = 0;
    this.tr = [];
    this.moreBtn = null;
    const jp = this.ja && w.qJa;
    const q = resolveKo(w.q, { s: this.s });
    const input = h('input', { class: 'word-input', id: 'word-input', maxlength: '30', placeholder: jp ? '自分で書く' : '직접 쓰기', 'aria-label': '한마디' });
    this.panel.replaceChildren(...this.withLegend([this.sceneHead(jp ? this.titleEl(w.qJa, q) : h('h3', { class: 'ev-title' }, q), '節目', CAT_KO.milestone)]));
    const ja = jp && w.presetsJa;
    const presets = ja ? w.presetsJa : w.presets;
    // 일본어 한마디 고르기: 「訳」을 누르면 각 한마디 아래에 한국어 (고르는 것과 따로)
    const kos = [];
    const btns = presets.map((p, i) => {
      const ko = ja && w.presets[i] && w.presets[i] !== p ? h('span', { class: 'choice-ko', hidden: true, lang: 'ko' }, w.presets[i]) : null;
      if (ko) kos.push(ko);
      return h('button', { class: 'btn', type: 'button', lang: jp ? 'ja' : null, onclick: () => this.doWord(p) }, h('span', null, p, ko));
    });
    const setKo = (on) => {
      kos.forEach((k) => (k.hidden = !on));
      tr.setAttribute('aria-pressed', String(on));
    };
    const tr = kos.length ? h('button', { class: 'tr-btn', type: 'button', 'aria-label': '한마디 번역', 'aria-pressed': 'false', onclick: () => {
      setKo(kos[0].hidden);
      this.translated();
    } }, '訳') : null;
    if (kos.length) this.tr.push({ on: () => !kos[0].hidden, set: setKo });
    this.finishHead();
    this.foot.replaceChildren(
      ...btns,
      h('div', { class: 'row' }, input, h('button', { class: 'mini-btn', type: 'button', style: 'min-width:72px', onclick: () => input.value.trim() && this.doWord(input.value) }, jp ? '残す' : '남기기'), tr));
  }

  doWord(text, auto) {
    if (this.s.phase !== 'word') return;
    G.setWord(this.s, text, auto);
    if (auto) {
      const w = this.s.words[this.s.words.length - 1];
      this.log(`오토: 「${w.text}」`, `オート：「${w.textJa || w.text}」`);
    }
    this.save();
    this.renderPhase();
  }

  // 일본어 한 덩어리(고른 행동 등): 탭하면 한국어가 아래에. 「全訳」에도 들어간다.
  tapRow(el, koEl, tpl) {
    const set = (on) => {
      if (on === !koEl.hidden) return;
      koEl.hidden = !on;
      el.setAttribute('aria-expanded', String(on));
      if (on && tpl) this.app.noteTranslate(tpl);
    };
    const toggle = () => {
      set(koEl.hidden);
      this.translated();
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle()));
    this.tr.push({ on: () => !koEl.hidden, set });
    return el;
  }

  // ───── 「▼ 続き」: 화면을 쓸어 올리지 않아도 장면을 끝까지 읽게 ─────
  // 아래 단추(つぎへ·どうする？)는 아직 안 보인 글이 아래에 남아 있으면 이야기 칸을 한 쪽 내린다. 끝까지 보이면 원래 일을 한다.
  primaryBtn(label, action, cls = '') {
    const b = h('button', { class: 'btn primary' + (cls ? ' ' + cls : ''), type: 'button' }, label);
    b._label = label;
    b.addEventListener('click', (e) => {
      if (this.moreBelow()) {
        this.pageDown();
        return;
      }
      action(e);
    });
    this.moreBtn = b;
    return b;
  }
  // 아직 안 보인 글이 아래에 남았나 (아래 여백만 가려진 것은 빼고)
  moreBelow() {
    const p = this.panel;
    // 확인 문제(this.quiz)는 계절 진행 중에 열리므로 그때도 센다
    if (!p || !p.isConnected || !this.s || (this.s.phase === 'season' && !this.quiz)) return false;
    return p.scrollHeight - p.clientHeight - p.scrollTop > MORE_PAD;
  }
  updateMore() {
    const b = this.moreBtn;
    if (!b || !b.isConnected) return;
    const more = this.moreBelow();
    if (b.dataset.more === (more ? '1' : '0')) return;
    b.dataset.more = more ? '1' : '0';
    b.textContent = more ? (this.ja ? '▼ 続き' : '▼ 계속') : b._label;
    if (more) b.setAttribute('aria-label', this.ja ? '続きを読む (아래 글 이어 읽기)' : '아래 글 이어 읽기');
    else b.removeAttribute('aria-label');
  }
  // 한 쪽 내리기: 아래가 잘린 첫 덩어리(대사 칸·서술 문장)의 처음이 칸 맨 위에 오게. 그것이 너무 가깝거나 멀면 칸 높이에서 한 줄 남짓 겹치게.
  pageDown() {
    const p = this.panel;
    const pr = p.getBoundingClientRect();
    const max = p.scrollHeight - p.clientHeight;
    const step = Math.max(80, p.clientHeight - 44);
    let target = p.scrollTop + step;
    for (const b of p.querySelectorAll('.ev-head, .narr .sent, .sent-ko, .lines > .line, .targets, .res-choice, .deltas, .note, .stamp, .legend-card')) {
      if (b.closest('[hidden]')) continue;
      const r = b.getBoundingClientRect();
      if (!r.height || r.bottom <= pr.bottom - 2) continue;
      const t = p.scrollTop + (r.top - pr.top) - 6;
      if (t > p.scrollTop + 40 && t < target) target = t;
      break;
    }
    p.scrollTop = Math.min(max, Math.round(target));
    this.updateMore();
  }
  // 오토: 읽는 속도(이 장면에 주어진 시간)에 맞춰 한 쪽씩 내린다. 아래에 남은 글이 없으면 true (넘겨도 된다)
  autoRead(delay) {
    if (!this.moreBelow()) return true;
    const p = this.panel;
    const seen = (p.scrollTop + p.clientHeight) / Math.max(1, p.scrollHeight);
    if (this.wait > delay * seen) {
      this.pageDown();
      // 새로 보인 쪽을 읽을 틈 (1배속 기준 2초 이상)
      this.wait = Math.min(this.wait, delay - 2000);
    }
    return false;
  }

  // ───── 처음 한 번: 표시 안내 ─────
  // 이야기 칸 맨 위에 실선·물결선·점선과 탭의 뜻. 「わかった」를 누르거나 다음 장면으로 넘어가면 다시 뜨지 않는다 (설정 seenLegend).
  // 열려 있는 동안 오토는 멈춘다 (LEGEND_HOLD_MS까지)
  withLegend(nodes) {
    if (!this.legend && !this.set.seenLegend) this.legend = { el: this.legendCard(), at: performance.now() };
    return this.legend ? [this.legend.el, ...nodes] : nodes;
  }
  // 짧게: 머리줄(제목 + 「わかった」) · 줄 표시 셋 한 줄씩 · 탭 안내 한 줄 (자세한 것은 ≡ 메뉴 「下線の見方」)
  legendCard() {
    const ja = this.ja;
    const title = LEGEND_TITLE[ja ? 1 : 0];
    return h('section', { class: 'legend-card', 'aria-label': title },
      h('div', { class: 'legend-card-head' },
        h('div', { class: 'legend-card-title' }, h('b', { lang: ja ? 'ja' : 'ko' }, title), ja ? h('span', { class: 'legend-ko', lang: 'ko' }, LEGEND_TITLE[0]) : null),
        h('button', { class: 'mini-btn legend-ok', type: 'button', lang: ja ? 'ja' : 'ko', onclick: () => this.closeLegend() }, ja ? 'わかった' : '알겠어요')),
      legendView(ja, { compact: true }));
  }
  closeLegend() {
    if (!this.legend) return;
    this.legend.el.remove();
    this.legend = null;
    this.set.seenLegend = true;
    this.app.saveSettings();
    this.updateMore();
  }
  legendHold() {
    if (!this.legend || !this.legend.el.isConnected || performance.now() - this.legend.at >= LEGEND_HOLD_MS) return false;
    // 「▼ 続き」나 손가락으로 안내를 지나 내려갔으면(안내가 칸 위로 거의 사라졌으면) 장면을 읽는 중이다: 더 붙잡지 않는다
    const r = this.legend.el.getBoundingClientRect();
    const pr = this.panel.getBoundingClientRect();
    return r.bottom > pr.top + 24;
  }
  // 방금 연 번역(ko)이 이야기 칸 아래로 잘리면 보이게 내린다. 누른 덩어리(block)의 처음은 칸 위로 밀어내지 않는다.
  reveal(block, ko) {
    const p = this.panel;
    if (!p || !ko || ko.hidden) return;
    const pr = p.getBoundingClientRect();
    const kr = ko.getBoundingClientRect();
    const br = block.getBoundingClientRect();
    const pad = 8;
    let d = kr.bottom - (pr.bottom - pad);
    if (d <= 0) return;
    d = Math.min(d, br.top - (pr.top + pad));
    if (d >= 1) {
      p.scrollTop += d;
      this.updateMore();
    }
  }
  showLegendModal() {
    const title = LEGEND_TITLE[this.ja ? 1 : 0];
    modal(this.app, title, h('h3', { class: 'ev-title' }, title), legendView(this.ja));
  }

  // ───── 탬버린 미니게임 ─────
  tambourine(v) {
    const total = 12;
    let hits = 0;
    let started = false;
    const period = 620;
    const ring = h('div', { class: 'ring' });
    const drum = h('div', { class: 'drum', role: 'button', tabindex: '0', 'aria-label': '탬버린' }, ring, h('span', null, '♪'));
    const score = h('div', { class: 'score' }, this.ja ? 'タップでスタート' : '탭: 시작');
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
    const note = h('p', { class: 'note', style: 'text-align:center' }, this.ja ? '輪が重なったらタップ' : '고리가 닿을 때 탭');
    return h('div', null, this.ja ? toastTap(note, '고리가 닿을 때 탭', this.app) : note, box);
  }

  // ───── 근황·메뉴 ─────
  castSheet(role) {
    const s = this.s;
    const p = personFor(s.cast, role);
    const ach = s.ach[role];
    const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && back.remove() },
      h('div', { class: 'modal' },
        h('div', { class: 'ev-cat' }, this.ja ? ROLE_JA[role] : ROLE_KO[role]),
        h('h3', { class: 'ev-title' }, this.ja ? p.call : p.ko, h('small', { class: 'note', lang: 'ja', style: 'margin-left:8px' }, p.s ? (/^[ァ-ヶー]+$/.test(p.s) ? `${p.s}・${p.g}` : `${p.s} ${p.g}`) : p.g)),
        this.ja && s.newsJa && s.newsJa[role] ? tapKo(h('p', { lang: 'ja' }, plainJa(s.newsJa[role], { s })), s.news[role]) : h('p', null, s.news[role]),
        h('p', { class: 'note' }, this.ja ? `絆 ${s.bond[role]}` : `유대 ${s.bond[role]}`),
        ach.length ? h('ul', this.ja ? { lang: 'ja' } : null, ach.map((a) => (this.ja && a.textJa ? tapKo(h('li', null, `${Math.floor(a.t / 4)}歳 — ${plainJa(a.textJa, { s })}`), a.text) : h('li', null, this.ja ? `${Math.floor(a.t / 4)}歳 — ${a.text}` : `${Math.floor(a.t / 4)}살 — ${a.text}`)))) : null,
        h('button', { class: 'btn primary', type: 'button', onclick: () => back.remove() }, this.ja ? '閉じる' : '닫기')));
    this.app.root.append(back);
  }

  menu() {
    const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && close() });
    const close = () => back.remove();
    back.append(h('div', { class: 'modal' },
      h('h3', { class: 'ev-title' }, 'メニュー'),
      // 글 아래 줄(실선·물결선·점선)과 탭의 뜻: 메뉴 맨 위에서 바로
      h('button', { class: 'btn center legend-open', type: 'button', onclick: () => { close(); this.showLegendModal(); } }, this.ja ? '下線の見方' : '표시 보는 법'),
      h('h3', { class: 'h' }, this.ja ? '道場の人々' : '도장 사람들'),
      h('div', { class: 'people-grid' }, ROLES.map((r) => {
        const p = personFor(this.s.cast, r);
        return h('button', { class: 'btn center', type: 'button', lang: this.ja ? 'ja' : null, onclick: () => this.castSheet(r) }, this.ja ? p.call : p.ko);
      })),
      this.app.studyControls(() => { close(); this.menu(); }),
      h('h3', { class: 'h' }, this.ja ? 'サウンド' : '소리'),
      this.app.soundControls(),
      h('div', { class: 'btns', style: 'margin-top:10px' },
        h('div', { class: 'row' },
          h('button', { class: 'btn center', type: 'button', onclick: () => { close(); this.save(); this.app.go('wordbook'); } }, '単語帳'),
          h('button', { class: 'btn center', type: 'button', onclick: () => { close(); this.save(); this.app.go('review'); } }, '復習')),
        h('button', { class: 'btn center', type: 'button', onclick: () => { close(); this.save(); this.app.go('title'); } }, 'タイトル'),
        h('button', { class: 'btn primary', type: 'button', onclick: close }, this.ja ? '閉じる' : '닫기'))));
    this.app.root.append(back);
  }
}

// 일본어 글 한 덩어리(기록 줄·근황): 탭하면 한국어가 아래에, 다시 탭하면 닫힌다
export function tapKo(el, ko) {
  if (!ko) return el;
  const koEl = h('span', { class: 'tap-ko', hidden: true, lang: 'ko' }, ko);
  el.classList.add('tap');
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-expanded', 'false');
  const toggle = () => {
    koEl.hidden = !koEl.hidden;
    el.setAttribute('aria-expanded', String(!koEl.hidden));
  };
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle()));
  el.append(koEl);
  return el;
}
// 짧은 일본어 표시(도장 찍기·안내): 탭하면 한국어를 잠깐 띄운다
function toastTap(el, ko, app) {
  el.classList.add('tap');
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.addEventListener('click', () => app.toast(ko));
  el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), app.toast(ko)));
  return el;
}

// 한국어 해설을 앞부분(상황)과 나머지로 나눈다. 문장 단위로 40자 안팎까지 (첫 문장은 항상 통째로).
export function splitContext(text) {
  // 짧은 글(대부분의 장면)은 자르지 않는다. 긴 글만 앞부분 80자 안팎을 보이고 「더보기」
  if (plainKo(text).length <= 120) return { head: String(text), rest: '' };
  const parts = String(text).split(/(?<=[.!?…」])\s+/);
  let head = parts[0];
  let i = 1;
  while (i < parts.length && plainKo(head + ' ' + parts[i]).length <= 80) head += ' ' + parts[i++];
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

