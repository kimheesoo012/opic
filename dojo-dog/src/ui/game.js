// 게임 화면: 시간 흐름, 이벤트 시트, 오토, 배속.
import * as G from '../engine/core.js';
import { SEASON_MS, SPEEDS, FIRST_EVENT_MS, AUTO_WORD_MS, eventShowMs, resultShowMs } from '../engine/pace.js';
import { SEASON_JA, SEASON_KO, STAT_KO, STAGES, ROLE_KO, ROLES, personFor } from '../engine/world.js';
import { SUB_TITLES } from '../data/index.js';
import { resolveKo, plainKo } from '../engine/text.js';
import { h, renderJa, renderKo, renderSpeaker, plainSegs } from './render.js';
import { Scene } from './scene.js';
import { wordPopup } from './vocabui.js';
import { store } from './store.js';

const CAT = { daily: '日常', kendo: '稽古', sub: 'サブストーリー', iincho: '委員長', cast: '道場の人々', milestone: '節目', hub: '日常' };
const STAT_ORDER = ['hap', 'hea', 'back', 'soc', 'brave', 'mis'];

export class GameView {
  constructor(app, state) {
    this.app = app;
    this.s = state;
    this.elapsed = 0; // 이번 계절 안에서 흐른 시간(1배속 기준 ms)
    this.wait = 0; // 이벤트 대기/표시 시간 누적
    this.sheet = null;
    this.mode = null;
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
    this.whenEl = h('div', { class: 'when' });
    this.stageChip = h('span', { class: 'stage-chip' });
    this.statsEl = h('div', { class: 'stats', 'aria-label': '능력치' });
    this.speedBtns = SPEEDS.map((sp) => h('button', { type: 'button', 'aria-pressed': String(this.set.speed === sp), onclick: () => this.setSpeed(sp) }, sp + 'x'));
    this.pauseBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': '일시정지', onclick: () => this.togglePause() }, '⏸');
    this.autoBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-pressed': String(this.set.auto), onclick: () => this.toggleAuto() }, 'オート');
    const menuBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': '메뉴', onclick: () => this.menu() }, '≡');
    this.hud = h('div', { class: 'hud pad' },
      h('div', { class: 'hud-top' }, this.whenEl, this.stageChip),
      h('div', { class: 'ctrl' }, h('div', { class: 'seg', role: 'group', 'aria-label': '배속' }, this.speedBtns), this.pauseBtn, this.autoBtn, menuBtn),
      this.statsEl);
    this.canvas = h('canvas', { 'aria-hidden': 'true' });
    this.banner = h('div', { class: 'season-banner' });
    this.hint = h('div', { class: 'stage-hint' }, '화면을 탭하면 다음 계절로');
    this.stageEl = h('div', { class: 'stage', onclick: () => this.skip() }, this.canvas, this.banner, this.hint);
    this.prog = h('i');
    this.ticker = h('div', { class: 'ticker pad' });
    this.logEl = h('div', { class: 'log pad', 'aria-live': 'polite' });
    this.el = h('div', { class: 'screen game' }, this.hud, this.stageEl, h('div', { class: 'progress' }, this.prog), this.ticker, this.logEl);
    this.app.mountScreen(this.el);
    this.scene = new Scene(this.canvas);
    this.scene.dog = s.dog;
    this.scene.start();
    this.paused = false;
    this.renderHud(true);
    this.last = performance.now();
    this.timer = setInterval(() => this.tick(), 50);
    this.renderPhase();
  }

  unmount() {
    clearInterval(this.timer);
    this.scene && this.scene.stop();
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
        this.prog.style.width = Math.min(100, (this.elapsed / SEASON_MS) * 100) + '%';
        break;
      }
      case 'event':
        if (this.autoActive()) {
          this.wait += dt * sp;
          const delay = eventShowMs(G.view(s));
          if (!this.autoShown && this.wait > delay * 0.4) this.showAutoPick();
          if (this.wait > delay) this.doChoose(this.autoIdx, true);
        }
        break;
      case 'result':
        if (this.autoActive()) {
          this.wait += dt * sp;
          if (this.wait > this.resultMs) this.doAck();
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
    this.banner.textContent = `${SEASON_JA[sea]} · ${G.yearNo(s)}年目`;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    this.log(`${SEASON_KO[sea]}이 왔다. (${this.ageText()})`);
    this.flushLog();
    this.renderHud();
    this.save();
  }

  skip() {
    if (this.s.phase !== 'season' || this.sheet) return;
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
    this.scene.speed = sp;
  }
  togglePause() {
    this.paused = !this.paused;
    this.pauseBtn.textContent = this.paused ? '▶' : '⏸';
    this.pauseBtn.setAttribute('aria-label', this.paused ? '재개' : '일시정지');
    this.pauseBtn.setAttribute('aria-pressed', String(this.paused));
  }
  toggleAuto() {
    this.set.auto = !this.set.auto;
    this.app.saveSettings();
    this.autoBtn.setAttribute('aria-pressed', String(this.set.auto));
    this.app.toast(this.set.auto ? `オート ON · ${this.set.autoMode === 'all' ? '全部おまかせ' : '大事な場面だけ止まる'}` : 'オート OFF · 모든 선택을 직접 고릅니다');
    this.wait = 0;
  }

  save() {
    this.s.seenWords = [...this.seenWords].slice(-800);
    this.app.saveGame(this.s);
  }

  ageText() {
    const t = this.s.t;
    if (t < 4) return `생후 ${3 + t * 3}개월`;
    return `${Math.floor(t / 4)}살`;
  }

  renderHud(first) {
    const s = this.s;
    const sea = G.season(s);
    this.app.root.dataset.season = sea;
    this.scene.season = sea;
    this.scene.senior = G.stage(s) === 'senior';
    this.app.sound.setSeason(sea);
    this.whenEl.innerHTML = '';
    this.whenEl.append(`${SEASON_JA[sea]} · ${G.yearNo(s)}年目`, h('small', null, `${s.dog.nameKo} · ${this.ageText()}`));
    const st = STAGES.find((x) => x.id === G.stage(s));
    this.stageChip.textContent = `${st.ja} · ${st.ko}`;
    this.statsEl.innerHTML = '';
    for (const k of STAT_ORDER) {
      this.statsEl.append(h('span', { class: 'stat', title: STAT_KO[k] }, STAT_KO[k], h('span', { class: 'bar' }, h('i', { style: `width:${s.st[k]}%` }))));
    }
    this.renderTicker(first);
  }

  renderTicker(first) {
    const s = this.s;
    const prev = this.lastNews || {};
    this.ticker.innerHTML = '';
    for (const r of ROLES) {
      const p = personFor(s.cast, r);
      const gone = (r === 'roshi' && G.has(s, 'roshi_gone')) || (r === 'kor' && G.has(s, 'kor_left'));
      const chip = h('button', { class: 'who' + (!first && prev[r] !== s.news[r] ? ' flash' : ''), type: 'button', onclick: () => this.castSheet(r) },
        h('b', null, `${p.ko}${gone ? ' ·' : ''}`), h('span', null, s.news[r] || ''));
      this.ticker.append(chip);
    }
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
    while (this.logEl.children.length > 5) this.logEl.lastChild.remove();
  }

  // ───── 시트 ─────
  closeSheet() {
    if (this.sheet) this.sheet.remove();
    if (this.sheetBack) this.sheetBack.remove();
    this.sheet = null;
    this.sheetBack = null;
  }
  openSheet(body, foot) {
    this.closeSheet();
    const hudH = this.hud.getBoundingClientRect().height;
    this.sheetBack = h('div', { class: 'sheet-back' });
    this.sheetBack.style.top = hudH + 'px';
    this.sheet = h('div', { class: 'sheet', role: 'dialog' }, h('div', { class: 'sheet-body' }, body), foot ? h('div', { class: 'sheet-foot' }, foot) : null);
    this.sheet.style.maxHeight = `calc(100% - ${Math.round(hudH)}px)`;
    this.el.append(this.sheetBack, this.sheet);
    return this.sheet;
  }

  ctxFor(lineSp) {
    return {
      s: this.s,
      speaker: lineSp,
      mode: this.set.furigana,
      seenWords: this.seenWords,
      seenTerms: this.seenTerms,
      newTerms: [],
      saved: new Set(Object.keys(store.wordbook())),
    };
  }

  renderLines(lines, title, wrap) {
    const box = h('div', { class: 'lines' });
    const kos = [];
    for (const [sp, ja, ko] of lines) {
      const ctx = this.ctxFor(sp);
      const koText = resolveKo(ko, { s: this.s });
      const koEl = h('div', { class: 'ko', hidden: true }, koText);
      kos.push(koEl);
      ctx.onWord = (key) => {
        const scene = { tpl: ja, role: sp, ja: plainSegs(ja, { s: this.s, speaker: sp }), ko: koText, sp: spLabelText(sp, this.s), title, when: `${this.ageText()} ${SEASON_KO[G.season(this.s)]}` };
        this.app.openWord(key, scene);
      };
      box.append(h('div', { class: 'line' }, h('div', { class: 'sp' }, renderSpeaker(sp, this.s, this.set.furigana)), h('div', { class: 'ja' }, renderJa(ja, ctx)), koEl));
    }
    if (kos.length && wrap) {
      let on = false;
      const btn = h('button', { class: 'icon-btn', type: 'button', onclick: () => { on = !on; kos.forEach((k) => (k.hidden = !on)); btn.textContent = on ? '번역 숨기기' : '번역 보기'; } }, '번역 보기');
      wrap.append(h('div', { class: 'tools' }, btn));
    }
    return box;
  }

  koBlock(text, title) {
    const ctx = this.ctxFor(null);
    ctx.onWord = (key) => this.app.openWord(key, { ja: '', ko: plainKo(text), sp: '', title, when: this.ageText() });
    const el = h('p', { class: 'ev-text' }, renderKo(text, ctx));
    if (ctx.newTerms.length) store.saveSeenTerms(this.seenTerms);
    return el;
  }

  renderPhase() {
    const s = this.s;
    this.flushLog();
    if (s.phase === 'season') {
      this.closeSheet();
      this.scene.pose = G.stage(s) === 'senior' && Math.random() < 0.5 ? 'sleep' : 'walk';
      return;
    }
    if (s.phase === 'event') return this.showEvent();
    if (s.phase === 'result') return this.showResult();
    if (s.phase === 'word') return this.showWord();
    if (s.phase === 'farewell') return this.app.toFarewell(s);
  }

  showEvent() {
    const v = G.view(this.s);
    if (!v) return;
    this.wait = 0;
    this.autoShown = false;
    this.autoIdx = G.autoChoice(this.s);
    this.scene.pose = 'sit';
    const ev = G.EV.get(v.id);
    if (ev.cat === 'kendo' || ev.kendo) this.app.sound.sfx('shinai');
    else if (ev.cat === 'hub' && v.id === 'h_walk') this.app.sound.sfx('step');
    const body = h('div');
    body.append(h('div', { class: 'ev-cat' }, (v.sub ? 'サブストーリー' : CAT[v.cat] || '') + (v.who ? ` · ${ROLE_KO[v.who]}` : '')), h('h3', { class: 'ev-title' }, v.title));
    if (v.text) body.append(this.koBlock(v.text, v.title));
    if (v.lines.length) {
      const tools = h('div');
      body.append(this.renderLines(v.lines, v.title, tools), tools);
    }
    this.choiceBtns = [];
    const foot = h('div', { class: 'btns' });
    this.autoTag = h('div', { class: 'auto-tag', hidden: true });
    foot.append(this.autoTag);
    if (v.mini && !this.autoActive()) {
      foot.append(this.tambourine(v));
    } else if (v.choices.length) {
      for (const c of v.choices) {
        const b = h('button', { class: 'btn' + (c.ok ? '' : ' off'), type: 'button', disabled: !c.ok, onclick: () => this.doChoose(c.i, false) }, h('span', null, c.t, !c.ok && c.why ? h('div', { class: 'why' }, c.why) : null));
        this.choiceBtns.push([c.i, b]);
        foot.append(b);
      }
    } else {
      foot.append(h('button', { class: 'btn primary', type: 'button', onclick: () => this.doChoose(-1, false) }, 'つぎへ'));
    }
    this.openSheet(body, foot);
  }

  showAutoPick() {
    this.autoShown = true;
    const v = G.view(this.s);
    const c = v && v.choices.find((x) => x.i === this.autoIdx);
    if (!c) return;
    const pair = this.choiceBtns.find(([i]) => i === this.autoIdx);
    if (pair) pair[1].classList.add('auto-pick');
    this.autoTag.hidden = false;
    this.autoTag.textContent = `オート: ${c.t}`;
  }

  doChoose(i, auto) {
    const s = this.s;
    if (s.phase !== 'event') return;
    const ev = G.EV.get(s.cur.id);
    const c = ev.choices && ev.choices[i];
    if (c && (c.tag === 'brave' || c.tag === 'guard')) {
      this.app.sound.sfx('bark');
      this.scene.bark();
    } else this.app.sound.sfx('tap');
    G.choose(s, i, auto);
    this.save();
    this.renderPhase();
  }

  showResult() {
    const r = this.s.res;
    this.wait = 0;
    const ev = G.EV.get(r.id);
    const title = resolveKo(ev.title, { s: this.s });
    const body = h('div');
    body.append(h('div', { class: 'ev-cat' }, CAT[ev.cat] || ''), h('h3', { class: 'ev-title' }, title));
    if (r.choice) body.append(h('div', { class: 'res-choice' }, (r.auto ? 'オート: ' : '선택: ') + r.choice));
    if (r.res) body.append(this.koBlock(r.res, title));
    if (r.lines.length) {
      const tools = h('div');
      body.append(this.renderLines(r.lines, title, tools), tools);
    }
    if (r.delta.length) {
      body.append(h('div', { class: 'deltas' }, r.delta.map((d) => {
        const name = d.k.startsWith('b_') ? `${d.k === 'b_iincho' ? '위원장' : personFor(this.s.cast, d.k.slice(2)).ko} 유대` : STAT_KO[d.k];
        return h('span', { class: 'delta ' + (d.v > 0 ? 'up' : 'down') }, `${name} ${d.v > 0 ? '+' : ''}${d.v}`);
      })));
    }
    for (const n of r.notes.filter((x) => x !== '성공' && x !== '실패')) body.append(h('p', { class: 'note' }, n));
    if (r.foil) body.append(h('div', { class: 'stamp' }, '作戦阻止！', h('small', null, `委員長의 작전을 막았다 (통산 ${this.s.foiled}회)`)));
    if (r.clear) {
      const st = SUB_TITLES[r.clear];
      body.append(h('div', { class: 'stamp' }, 'サブストーリー クリア', h('small', null, `「${st.ja}」 ${st.ko}`)));
      this.app.sound.sfx('clear');
    }
    this.resultMs = resultShowMs(r);
    const foot = h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => this.doAck() }, 'つぎへ'));
    this.openSheet(body, foot);
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
    const input = h('input', { class: 'word-input', id: 'word-input', maxlength: '30', placeholder: '짧게 직접 쓰기 (30자까지)' });
    const body = h('div', null, h('div', { class: 'ev-cat' }, '節目 · 한마디 남기기'), h('h3', { class: 'ev-title' }, q), h('p', { class: 'note' }, '고른 말은 결과 카드에 남습니다.'));
    const foot = h('div', { class: 'btns' },
      ...w.presets.map((p) => h('button', { class: 'btn', type: 'button', onclick: () => this.doWord(p) }, p)),
      h('div', { class: 'row' }, input, h('button', { class: 'icon-btn', type: 'button', style: 'min-width:84px', onclick: () => input.value.trim() && this.doWord(input.value) }, '남기기')));
    this.openSheet(body, foot);
  }

  doWord(text, auto) {
    if (this.s.phase !== 'word') return;
    G.setWord(this.s, text, auto);
    if (auto) this.log(`オート가 한마디를 골랐다: 「${text}」`);
    this.save();
    this.renderPhase();
  }

  // ───── 탬버린 미니게임 ─────
  tambourine(v) {
    const total = 12;
    let beat = 0;
    let hits = 0;
    let started = false;
    const period = 620;
    const ring = h('div', { class: 'ring' });
    const drum = h('div', { class: 'drum', role: 'button', tabindex: '0', 'aria-label': '탬버린 치기' }, ring, h('span', null, '♪'));
    const score = h('div', { class: 'score' }, '박자가 맞을 때 탭!');
    const box = h('div', { class: 'mini' }, drum, score);
    let t0 = 0;
    let raf = 0;
    const loop = (now) => {
      if (!started) return;
      const ph = ((now - t0) % period) / period;
      const sc = 1.9 - ph * 0.9;
      ring.style.transform = `scale(${sc})`;
      ring.style.opacity = String(1 - ph * 0.3);
      const b = Math.floor((now - t0) / period);
      if (b >= total) return finish();
      if (b !== beat) beat = b;
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
        score.textContent = '0 / 12';
        return;
      }
      this.app.sound.sfx('tamb');
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
    return h('div', null, h('p', { class: 'note', style: 'text-align:center' }, '북을 한 번 탭하면 시작. 바깥 고리가 북에 닿는 순간 탭!'), box);
  }

  // ───── 메뉴·근황 ─────
  castSheet(role) {
    const s = this.s;
    const p = personFor(s.cast, role);
    const ach = s.ach[role];
    const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && back.remove() },
      h('div', { class: 'modal' },
        h('div', { class: 'ev-cat' }, ROLE_KO[role]),
        h('h3', { class: 'ev-title' }, `${p.ko}`, h('small', { class: 'note', lang: 'ja', style: 'margin-left:8px' }, p.s ? (/^[ァ-ヶー]+$/.test(p.s) ? `${p.s}・${p.g}` : `${p.s} ${p.g}`) : p.g)),
        h('p', null, s.news[role]),
        h('p', { class: 'note' }, `유대 ${s.bond[role]} / 100 · 유대가 높을수록 이 사람의 이야기가 깊게 열립니다.`),
        ach.length ? h('ul', null, ach.map((a) => h('li', null, `${Math.floor(a.t / 4)}살 무렵 — ${a.text}`))) : h('p', { class: 'note' }, '아직 기록이 없습니다.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => back.remove() }, '닫기')));
    this.app.root.append(back);
  }

  menu() {
    const set = this.set;
    const segFor = (key, opts) => h('div', { class: 'seg' }, opts.map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(set[key] === v), onclick: (e) => { set[key] = v; this.app.saveSettings(); [...e.currentTarget.parentNode.children].forEach((b) => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); } }, label)));
    const back = h('div', { class: 'modal-back', onclick: (e) => e.target === back && close() });
    const close = () => back.remove();
    back.append(h('div', { class: 'modal' },
      h('h3', { class: 'ev-title' }, '메뉴'),
      h('div', { class: 'toggle-row' }, h('span', null, 'オート 방식'), segFor('autoMode', [['major', '大事な場面だけ止まる'], ['all', '全部おまかせ']])),
      h('div', { class: 'toggle-row' }, h('span', null, '후리가나'), segFor('furigana', [['always', '항상'], ['hard', '어려운 한자만'], ['off', '끄기']])),
      h('div', { class: 'toggle-row' }, h('span', null, '소리'), h('button', { class: 'icon-btn', type: 'button', 'aria-pressed': String(set.sound), onclick: (e) => { this.app.setSound(!set.sound); e.currentTarget.setAttribute('aria-pressed', String(set.sound)); e.currentTarget.textContent = set.sound ? '켜짐' : '꺼짐'; } }, set.sound ? '켜짐' : '꺼짐')),
      h('div', { class: 'btns', style: 'margin-top:10px' },
        h('button', { class: 'btn', type: 'button', onclick: () => { close(); this.app.go('wordbook'); } }, '単語帳 보기 (게임은 저장됩니다)'),
        h('button', { class: 'btn', type: 'button', onclick: () => { close(); this.save(); this.app.go('title'); } }, '저장하고 타이틀로'),
        h('button', { class: 'btn primary', type: 'button', onclick: close }, '돌아가기'))));
    this.app.root.append(back);
  }
}

function spLabelText(sp, s) {
  if (sp.startsWith('@')) return sp.slice(1);
  if (sp === 'dog') return s.dog.name;
  const p = personFor(s.cast, sp);
  return p.call;
}
