// 앱 셸: 화면 전환, 설정, 저장, 소리, 학습 기록
import * as G from '../engine/core.js';
import { COATS, HAIRS, PERSONALITIES } from '../engine/world.js';
import { meet as srsMeet, dueIds } from '../engine/study.js';
import { h } from './render.js';
import { store } from './store.js';
import { Sound } from './audio.js';
import { GameView } from './game.js';
import { farewellScreen, memorialScreen, resultScreen } from './end.js';
import { wordPopup, grammarPopup } from './vocabui.js';
import { studyScreen, quizScreen, dailyIds, progressBox } from './studyui.js';
import { LCD, fitCanvas } from './pixel/lcd.js';
import { lookFor } from './pixel/director.js';
import { icon } from './icons.js';

class App {
  constructor(root) {
    this.root = root;
    this.settings = store.settings();
    this.sound = new Sound();
    this.sound.setVolumes(this.settings.bgm, this.settings.sfx, this.settings.sfxOn);
    this.view = null;
    this.state = null;
    this.prev = 'title';
    this.cur = 'title';
    this.lcds = [];
    this.applyTheme();
    // 소리 설정은 기억하지만, 브라우저 정책상 첫 탭 이후에만 켠다
    if (this.settings.sound) {
      const once = () => {
        this.sound.setOn(true);
        window.removeEventListener('pointerdown', once);
      };
      window.addEventListener('pointerdown', once);
    }
  }
  applyTheme() {
    const t = this.settings.theme;
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  saveSettings() {
    store.saveSettings(this.settings);
  }
  setSound(on) {
    this.settings.sound = on;
    this.saveSettings();
    this.sound.setOn(on);
    if (on) this.sound.sfx('tap');
  }
  modalOpen() {
    return !!this.root.querySelector('.modal-back');
  }
  toast(msg) {
    this.root.querySelectorAll('.toast').forEach((n) => n.remove());
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    this.root.append(t);
    setTimeout(() => t.remove(), 2400);
  }
  mountScreen(el) {
    this.lcds.forEach((l) => l.stop());
    this.lcds = [];
    this.root.querySelectorAll('.screen, .modal-back, .toast').forEach((n) => n.remove());
    this.root.append(el);
    el.scrollTop = 0;
  }
  go(name, arg) {
    if (this.view && name !== 'game') {
      this.view.unmount();
      this.view = null;
    }
    if (!['quiz', 'review', 'wordbook'].includes(name) || !['quiz', 'review', 'wordbook'].includes(this.cur)) this.prev = this.cur;
    this.cur = name;
    if (name !== 'game') delete this.root.dataset.season;
    switch (name) {
      case 'title':
        return this.mountScreen(this.titleScreen());
      case 'birth':
        return this.mountScreen(this.birthScreen());
      case 'game':
        this.state = arg;
        this.view = new GameView(this, arg);
        return this.view.mount();
      case 'review':
        return this.mountScreen(studyScreen(this, 'review'));
      case 'wordbook':
        return this.mountScreen(studyScreen(this, 'book'));
      case 'history':
        return this.mountScreen(this.historyScreen());
      case 'settings':
        return this.mountScreen(this.settingsScreen());
      default:
        return null;
    }
  }
  back() {
    const p = this.prev;
    if (p === 'result' && this.lastLife) {
      this.cur = 'result';
      return this.mountScreen(resultScreen(this, this.lastLife));
    }
    if (p === 'game' && this.state) return this.go('game', this.state);
    return this.go('title');
  }
  openWord(key, scene) {
    wordPopup(this, key, scene, this.settings.furigana);
  }
  openGrammar(key, scene) {
    grammarPopup(this, key, scene, this.settings.furigana);
  }
  onWordSaved(key) {
    if (this.state && this.state.phase !== 'ended' && !this.state.vocab.includes(key)) this.state.vocab.push(key);
  }
  // 장면에서 학습 대상을 만났다 → 간격 반복에 등록, 이번 견생 기록에도 남긴다
  meet(ids, s) {
    if (!ids.length) return;
    const srs = store.srs();
    let changed = false;
    for (const id of ids) changed = srsMeet(srs, id) || changed;
    if (changed) store.saveSrs(srs);
    if (s) {
      s.met = s.met || [];
      for (const id of ids) if (!s.met.includes(id)) s.met.push(id);
    }
  }
  // 대사 자리표시자를 채우기 위한 기준 상태 (게임 밖 화면에서 예문을 보여 줄 때)
  refState() {
    if (this.state) return this.state;
    if (!this._ref) {
      const save = store.loadGame();
      if (save && save.state) this._ref = save.state;
      else {
        this._ref = G.newLife({ seed: 'ref' });
        G.beginLife(this._ref);
      }
    }
    return this._ref;
  }
  saveGame(s) {
    store.saveGame(s);
  }
  toFarewell(s) {
    if (this.view) {
      this.view.unmount();
      this.view = null;
    }
    this.cur = 'farewell';
    this.mountScreen(farewellScreen(this, s));
  }
  toMemorial(s) {
    this.cur = 'memorial';
    this.mountScreen(memorialScreen(this, s));
  }
  finishLife(s) {
    const sum = s.summary;
    const hist = store.history();
    hist.unshift({ at: Date.now(), name: sum.dog.name, nameKo: sum.dog.nameKo, years: sum.years, seasons: sum.seasons, titles: sum.titles.slice(0, 3), dojoName: sum.world.dojoName, gen: sum.world.gen, subs: sum.subs, foiled: sum.foiled, vocab: sum.vocab, lastWord: sum.lastWord, born: s.born, cast: Object.fromEntries(Object.entries(sum.cast).map(([r, c]) => [r, { ko: c.ko, epilogue: c.epilogue }])) });
    store.saveHistory(hist.slice(0, 50));
    store.saveLegacy(G.legacyOf(s));
    store.clearGame();
    this.lastLife = s;
    this.state = null;
    this._ref = null;
    this.cur = 'result';
    this.mountScreen(resultScreen(this, s));
  }
  startQuiz(ids, label) {
    if (this.view) {
      this.view.unmount();
      this.view = null;
    }
    if (this.cur !== 'quiz') this.prev = ['review', 'wordbook'].includes(this.cur) ? this.cur : this.cur;
    this.quizFrom = this.cur;
    this.cur = 'quiz';
    this.mountScreen(quizScreen(this, ids, label, { onDone: () => (this.quizFrom === 'review' || this.quizFrom === 'wordbook' ? this.go(this.quizFrom) : this.back()) }));
  }
  // 게임 시작 전 今日の一問 (풀 것이 있을 때만)
  enterGame(s) {
    const ids = dailyIds();
    if (!ids.length) return this.go('game', s);
    this.cur = 'quiz';
    this.mountScreen(quizScreen(this, ids, '今日の一問', { daily: true, n: ids.length, onDone: () => this.go('game', s) }));
  }

  // ───── 공용 조각 ─────
  lcdOf(canvas, plan, dog, opts = {}) {
    const l = new LCD(canvas);
    l.lookFn = lookFor;
    l.dog = dog;
    l.season = opts.season || 'spring';
    l.stage = opts.stage || 'adult';
    l.setPlan(plan, opts.state || this.refState());
    l.start();
    this.lcds.push(l);
    return l;
  }
  soundControls() {
    const set = this.settings;
    const sw = (key, onChange) => {
      const b = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(!!set[key]), onclick: () => { set[key] = !set[key]; this.saveSettings(); b.setAttribute('aria-checked', String(!!set[key])); onChange && onChange(); } }, h('i'));
      return b;
    };
    const range = (key, label) => h('div', { class: 'toggle-row' }, h('label', { for: 'r-' + key }, label), h('input', { type: 'range', id: 'r-' + key, min: '0', max: '1', step: '0.05', value: String(set[key]), oninput: (e) => { set[key] = Number(e.target.value); this.saveSettings(); this.sound.setVolumes(set.bgm, set.sfx, set.sfxOn); } }));
    return h('div', { class: 'sound-box' },
      h('div', { class: 'toggle-row' }, h('span', null, '소리'), sw('sound', () => this.sound.setOn(set.sound))),
      range('bgm', 'BGM 음량'),
      range('sfx', '효과음 음량'),
      h('div', { class: 'toggle-row' }, h('span', null, '효과음'), sw('sfxOn', () => this.sound.setVolumes(set.bgm, set.sfx, set.sfxOn))));
  }
  segRow(key, label, opts, after) {
    const set = this.settings;
    return h('div', { class: 'toggle-row' }, h('span', null, label), h('div', { class: 'seg' }, opts.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(set[key] === v), onclick: (e) => { set[key] = v; this.saveSettings(); after && after(); [...e.currentTarget.parentNode.children].forEach((b) => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); } }, l))));
  }
  // 후리가나·학습 수준·쉬운 단어 숨기기·학습 집중 모드. 바꾸면 보고 있는 장면에 바로 반영한다.
  studyControls() {
    const set = this.settings;
    const changed = () => {
      this.saveSettings();
      if (this.view && this.view.refresh) this.view.refresh();
    };
    const grid = (key, opts, after) => {
      const box = h('div', { class: 'opt-grid', role: 'radiogroup' });
      for (const [v, label] of opts) {
        box.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(set[key] === v), onclick: (e) => {
          set[key] = v;
          [...box.children].forEach((b) => b.setAttribute('aria-checked', String(b === e.currentTarget)));
          after && after();
          changed();
        } }, label));
      }
      return box;
    };
    const sw = (key, label) => {
      const b = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(!!set[key]), 'aria-label': label, onclick: () => { set[key] = !set[key]; b.setAttribute('aria-checked', String(!!set[key])); changed(); } }, h('i'));
      return h('div', { class: 'toggle-row' }, h('span', null, label), b);
    };
    const custom = h('div', { class: 'opt-grid checks', hidden: set.studyLevel !== 'custom' },
      [['5', 'N5'], ['4', 'N4'], ['3', 'N3'], ['2', 'N2'], ['1', 'N1'], ['K', '검도 용어']].map(([c, label]) => h('button', { type: 'button', role: 'checkbox', 'aria-checked': String(set.customLevels.includes(c)), onclick: (e) => {
        const has = set.customLevels.includes(c);
        set.customLevels = has ? set.customLevels.filter((x) => x !== c) : [...set.customLevels, c];
        e.currentTarget.setAttribute('aria-checked', String(!has));
        changed();
      } }, label)));
    return h('div', { class: 'study-box' },
      h('div', { class: 'field-label' }, 'ふりがな'),
      grid('furigana', [['always', '항상'], ['n2', 'N2 이상 어휘만'], ['hard', '어려운 한자·고유명사만'], ['off', '끄기']]),
      h('div', { class: 'field-label' }, '학습 수준'),
      grid('studyLevel', [['n5', 'N5~N4'], ['n3', 'N3'], ['n2', 'N2'], ['n1', 'N1'], ['custom', '직접 선택']], () => (custom.hidden = set.studyLevel !== 'custom')),
      custom,
      sw('hideEasy', '쉬운 단어 학습 표시 끄기'),
      sw('focus', '학습 집중 모드'),
      h('div', { class: 'field-label' }, '선택지'),
      grid('choiceMode', [['major', '중요한 장면만'], ['all', '모든 장면']]),
      h('p', { class: 'note small' }, '「중요한 장면만」: 나머지 장면에서는 개가 성격대로 움직이고, 대사를 읽은 뒤 つぎへ만 누른다.'));
  }
  furiganaRow() {
    return this.studyControls();
  }

  // ───── 화면들 ─────
  titleScreen() {
    const save = store.loadGame();
    const has = save && save.state && save.state.phase !== 'ended';
    const dog = has ? save.state.dog : { name: 'コテツ', coat: 'black_tan', hair: 'smooth' };
    const cv = h('canvas', { class: 'lcd-canvas', 'aria-hidden': 'true' });
    const srs = store.srs();
    const due = dueIds(srs).length;
    const soundBtn = h('button', { class: 'btn center', type: 'button', 'aria-pressed': String(this.settings.sound), onclick: () => { this.setSound(!this.settings.sound); soundBtn.replaceChildren(icon(this.settings.sound ? 'snd' : 'mute', 16), this.settings.sound ? '소리 끄기' : '소리 켜기'); soundBtn.setAttribute('aria-pressed', String(this.settings.sound)); } }, icon(this.settings.sound ? 'snd' : 'mute', 16), this.settings.sound ? '소리 끄기' : '소리 켜기');
    const el = h('div', { class: 'screen' },
      h('div', { class: 'scroll title-wrap' },
        h('div', null, h('h1', { class: 'logo', lang: 'ja' }, '道場犬'), h('p', { class: 'subtitle', lang: 'ja' }, 'ある道場の、ある犬の一生')),
        h('div', { class: 'device title-device' }, h('div', { class: 'lcd' }, cv)),
        h('button', { class: 'study-strip', type: 'button', onclick: () => this.go('review') }, h('span', { class: 'due' }, h('b', null, '今日の復習'), h('span', null, String(due))), progressBox(srs)),
        h('div', { class: 'btns' },
          has ? h('button', { class: 'btn primary', type: 'button', onclick: () => this.resume(save) }, `つづきから · ${save.state.dog.name} ${Math.floor(save.state.t / 4)}살`) : null,
          h('button', { class: has ? 'btn center' : 'btn primary', type: 'button', onclick: () => this.go('birth') }, 'はじめから'),
          h('div', { class: 'row' },
            h('button', { class: 'btn center', type: 'button', onclick: () => this.go('review') }, '復習'),
            h('button', { class: 'btn center', type: 'button', onclick: () => this.go('history') }, '歴史')),
          h('div', { class: 'row' }, soundBtn, h('button', { class: 'btn center', type: 'button', onclick: () => this.go('settings') }, '設定')))));
    requestAnimationFrame(() => {
      this.lcdOf(cv, { loc: 'dojo', tod: 'day', people: [], dog: { mode: 'wander' } }, dog, { stage: has ? G.stage(save.state) : 'adult', season: has ? G.season(save.state) : 'spring', state: has ? save.state : undefined });
      fitCanvas(cv, 360);
    });
    return el;
  }

  resume(save) {
    const s = save.state;
    if (s.phase === 'farewell') return this.toFarewell(s);
    if (s.phase === 'birth') G.beginLife(s);
    this.enterGame(s);
  }

  birthScreen() {
    const legacy = store.legacy();
    let world = 'new';
    let s = null;
    let lcd = null;
    const cv = h('canvas', { class: 'lcd-canvas', 'aria-hidden': 'true' });
    const info = h('dl', { class: 'kv' });
    const nameIn = h('input', { class: 'word-input', id: 'dog-name', maxlength: '8', 'aria-label': '名前' });
    const gloss = (ja, ko) => h('button', { class: 'gloss', type: 'button', lang: 'ja', onclick: () => this.toast(`${ja} — ${ko}`) }, ja);
    const make = () => {
      s = G.newLife({ seed: String(Date.now()) + Math.random().toString(36).slice(2, 7), world, legacy });
      s.born = new Date().getFullYear();
      nameIn.value = s.dog.name;
      const coat = COATS.find((c) => c.id === s.dog.coat);
      const hair = HAIRS.find((c) => c.id === s.dog.hair);
      const per = PERSONALITIES.find((p) => p.id === s.dog.per);
      const w = s.world;
      info.replaceChildren(
        h('dt', null, '毛色'), h('dd', null, gloss(coat.ja, coat.ko)),
        h('dt', null, '毛'), h('dd', null, gloss(hair.ja, hair.ko)),
        h('dt', null, '性格'), h('dd', null, gloss(per.ja, per.desc)),
        h('dt', null, '町'), h('dd', null, w.region.ko),
        h('dt', null, '道場'), h('dd', null, gloss(w.dojoName, w.dojo.ko)),
        ...(w.continued ? [h('dt', null, '代'), h('dd', null, `${w.gen}대째 · 선대 ${s.prevDog.name}`)] : []));
      if (lcd) {
        lcd.dog = s.dog;
        lcd.draw();
      }
    };
    const worldSeg = legacy
      ? h('div', { class: 'seg', role: 'group', 'aria-label': '세계' },
          h('button', { type: 'button', 'aria-pressed': 'true', onclick: (e) => { world = 'new'; setSeg(e); make(); } }, '새 세계'),
          h('button', { type: 'button', 'aria-pressed': 'false', onclick: (e) => { world = 'continue'; setSeg(e); make(); } }, '이어지는 세계'))
      : null;
    function setSeg(e) {
      [...e.currentTarget.parentNode.children].forEach((b) => b.setAttribute('aria-pressed', 'false'));
      e.currentTarget.setAttribute('aria-pressed', 'true');
    }
    make();
    const start = () => {
      const nm = nameIn.value.trim();
      if (nm && nm !== s.dog.name) {
        s.dog.name = nm;
        s.dog.nameKo = nm;
      }
      G.beginLife(s);
      store.saveGame(s);
      this.enterGame(s);
    };
    const el = h('div', { class: 'screen' },
      h('div', { class: 'scroll' },
        h('h2', { class: 'h' }, '誕生'),
        worldSeg,
        h('div', { class: 'device' }, h('div', { class: 'lcd' }, cv)),
        h('label', { for: 'dog-name', class: 'field-label' }, '名前'),
        nameIn,
        h('div', { style: 'height:10px' }),
        h('div', { class: 'card' }, info)),
      h('div', { class: 'sheet-foot', style: 'position:static' },
        h('button', { class: 'btn primary', type: 'button', onclick: start }, 'この子と生きる'),
        h('div', { class: 'row' },
          h('button', { class: 'btn center', type: 'button', onclick: make }, '別の子'),
          h('button', { class: 'btn center', type: 'button', onclick: () => this.go('title') }, '戻る'))));
    requestAnimationFrame(() => {
      lcd = this.lcdOf(cv, { loc: 'dojo', tod: 'day', people: [], dog: { mode: 'wander' } }, s.dog, { stage: 'puppy', season: G.season(s) });
      fitCanvas(cv, 360);
    });
    return el;
  }

  historyScreen() {
    const hist = store.history();
    return h('div', { class: 'screen' },
      h('div', { class: 'scroll' },
        h('h2', { class: 'h' }, '道場の歴史'),
        hist.length
          ? h('div', { class: 'list' }, hist.map((x) => h('div', { class: 'card' },
              h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', { lang: 'ja', style: 'font-size:20px' }, x.name), h('span', { class: 'note' }, new Date(x.at).toLocaleDateString())),
              h('div', { class: 'note' }, `${x.dojoName} · ${x.gen}대째 · ${x.years}년`),
              h('div', null, x.titles.map((t) => h('span', { class: 'title-badge' }, t.ja))),
              x.lastWord ? h('div', null, `“${x.lastWord}”`) : null)))
          : h('p', { class: 'note' }, '기록 없음')),
      h('div', { class: 'sheet-foot', style: 'position:static' }, h('button', { class: 'btn center', type: 'button', onclick: () => this.go('title') }, '戻る')));
  }

  settingsScreen() {
    const confirmBox = h('div', { hidden: true, class: 'card' },
      h('p', null, '단어장·복습 기록·역사·진행 중인 견생이 모두 지워진다.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn center danger', type: 'button', onclick: () => { store.resetAll(); this.settings = store.settings(); this.applyTheme(); this.toast('지움'); this.go('title'); } }, '지우기'),
        h('button', { class: 'btn center', type: 'button', onclick: () => (confirmBox.hidden = true) }, '그만두기')));
    return h('div', { class: 'screen' },
      h('div', { class: 'scroll' },
        h('h2', { class: 'h' }, '設定'),
        this.segRow('theme', '화면', [['system', '자동'], ['dark', '다크'], ['light', '라이트']], () => this.applyTheme()),
        h('h3', { class: 'h' }, '일본어'),
        this.studyControls(),
        h('h3', { class: 'h' }, '소리'),
        this.soundControls(),
        h('h3', { class: 'h' }, '기록'),
        h('button', { class: 'btn danger center', type: 'button', onclick: () => (confirmBox.hidden = false) }, '모든 기록 지우기'),
        confirmBox),
      h('div', { class: 'sheet-foot', style: 'position:static' }, h('button', { class: 'btn center', type: 'button', onclick: () => this.go('title') }, '戻る')));
  }
}

export function boot() {
  const root = document.getElementById('app');
  const app = new App(root);
  window.__dojoinu = app;
  app.go('title');
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.__NO_SW__) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
boot();
