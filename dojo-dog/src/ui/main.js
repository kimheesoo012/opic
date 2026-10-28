// 앱 셸: 화면 전환, 설정, 저장, 소리, 학습 기록
import * as G from '../engine/core.js';
import { COATS, HAIRS, PERSONALITIES } from '../engine/world.js';
import { h, LINES, sceneTargets, setNameHandler } from './render.js';
import { store } from './store.js';
import { Sound } from './audio.js';
import { GameView } from './game.js';
import { farewellScreen, memorialScreen, resultScreen, ageLabel } from './end.js';
import { wordPopup, grammarPopup, namePopup } from './vocabui.js';
import { studyScreen, quizScreen, dailyIds, progressBox, recordMet, engage, reviewCounts } from './studyui.js';
import { n2Screen, n2SummaryBox } from './n2ui.js';
import { LCD, fitCanvas } from './pixel/lcd.js';
import { lookFor } from './pixel/director.js';
import { icon } from './icons.js';
import { legendView, SETTING_DESC } from './help.js';

// 복습 계열 화면: 이 사이를 오가는 동안 「戻る」는 처음 들어온 곳(타이틀·게임·결과)으로
const STUDY_SCREENS = ['quiz', 'review', 'wordbook', 'metwords'];

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
    // 점선 이름은 어느 화면에서 눌러도 풀이 창 (render.js nameUnit)
    setNameHandler((q, s) => this.openName(q, s));
    // 소리 설정은 기억하지만, 브라우저 정책상 첫 탭 이후에만 켠다
    // 안드로이드(갤럭시·LINE 내장 브라우저)는 터치의 pointerdown으로는 소리를 열어 주지 않으므로 pointerup·touchend·click도 듣는다
    if (this.settings.sound) {
      const EVS = ['pointerup', 'touchend', 'click', 'keydown'];
      const once = () => {
        if (!this.settings.sound) return done();
        this.sound.setOn(true);
        if (this.sound.ctx && this.sound.ctx.state === 'running') done();
      };
      const done = () => EVS.forEach((e) => window.removeEventListener(e, once, true));
      EVS.forEach((e) => window.addEventListener(e, once, true));
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
  go(name, arg, arg2) {
    if (this.view && name !== 'game') {
      this.view.unmount();
      this.view = null;
    }
    // 복습 화면들(퀴즈·복습·단어장·만난 말) 사이를 오갈 때는 「戻る」가 돌아갈 곳을 바꾸지 않는다
    if (!STUDY_SCREENS.includes(name) || !STUDY_SCREENS.includes(this.cur)) this.prev = this.cur;
    this.cur = name;
    this.curArgs = [arg, arg2];
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
      case 'metwords':
        return this.mountScreen(studyScreen(this, 'met'));
      case 'history':
        return this.mountScreen(this.historyScreen());
      case 'n2':
        return this.mountScreen(n2Screen(this, arg || 'home', arg2));
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
  // 만남·복습 등록 규칙은 studyui.js 머리말에 있다: 장면에 나온 말은 「만남」으로만, 직접 건드린 말만 간격 반복(srs)에 넣는다.
  // 단어 뜻 창: wordPopup이 onWordSaved를 부르므로 거기서 등록한다 (단어장·N2 목록에서 연 창도 같다)
  openWord(key, scene) {
    wordPopup(this, key, scene, this.settings.furigana);
  }
  // 점선 이름 풀이 창 (학습 기록에는 남기지 않는다)
  openName(q, s) {
    namePopup(this, q, s || this.state || this.refState());
  }
  // 문법 뜻 창을 열었다 → 간격 반복에 등록
  openGrammar(key, scene) {
    engage(['g:' + key]);
    grammarPopup(this, key, scene, this.settings.furigana);
  }
  // 단어 뜻 창이 열렸다(저장 단추도 이 창 안에 있다) → 간격 반복에 등록, 이번 견생의 「본 말」에도
  onWordSaved(key) {
    engage(['v:' + key]);
    if (this.state && this.state.phase !== 'ended' && !this.state.vocab.includes(key)) this.state.vocab.push(key);
  }
  // 장면에서 학습 대상을 만났다 → 만난 기록과 이번 견생의 s.met에만 (간격 반복에는 넣지 않는다)
  meet(ids, s) {
    recordMet(ids, s);
  }
  // 번역을 열었다: 그 문장의 학습 대상을 간격 반복에 등록하고, 문장 속 말에 「번역 확인」을 센다 (오답으로 치지 않는다. 복습 순서에만 쓴다)
  noteTranslate(tpl) {
    const segs = (LINES.lines[tpl] || []).filter((x) => x && (x.v || x.g));
    if (!segs.length) return;
    const ids = [...new Set(segs.map((sg) => (sg.g ? 'g:' + sg.g : 'v:' + sg.v)))];
    engage(sceneTargets([tpl], this.settings), { tr: ids });
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
  // 퀴즈는 끝나도, 중간에 그만둬도 시작한 화면으로 돌아간다 (복습·단어장·만난 말·N2 화면은 같은 탭으로, 결과 화면은 결과로)
  startQuiz(ids, label) {
    if (this.view) {
      this.view.unmount();
      this.view = null;
    }
    const from = this.cur === 'quiz' && this.quizFrom ? this.quizFrom : { name: this.cur, args: this.curArgs || [] };
    if (!STUDY_SCREENS.includes(this.cur)) this.prev = this.cur;
    this.quizFrom = from;
    this.cur = 'quiz';
    this.mountScreen(quizScreen(this, ids, label, { onDone: () => this.returnFromQuiz(from) }));
  }
  returnFromQuiz(from) {
    if (from && [...STUDY_SCREENS, 'n2'].includes(from.name) && from.name !== 'quiz') return this.go(from.name, ...(from.args || []));
    return this.back();
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
  // 표시 언어에 맞춘 라벨
  tx(ko, ja) {
    return (this.settings.lang || 'ja') === 'ja' ? ja : ko;
  }
  soundControls() {
    const set = this.settings;
    const t = (ko, ja) => this.tx(ko, ja);
    const sw = (key, onChange) => {
      const b = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(!!set[key]), onclick: () => { set[key] = !set[key]; this.saveSettings(); b.setAttribute('aria-checked', String(!!set[key])); onChange && onChange(); } }, h('i'));
      return b;
    };
    const range = (key, label) => h('div', { class: 'toggle-row' }, h('label', { for: 'r-' + key }, label), h('input', { type: 'range', id: 'r-' + key, min: '0', max: '1', step: '0.05', value: String(set[key]), oninput: (e) => { set[key] = Number(e.target.value); this.saveSettings(); this.sound.setVolumes(set.bgm, set.sfx, set.sfxOn); } }));
    return h('div', { class: 'sound-box' },
      h('div', { class: 'toggle-row' }, h('span', null, t('소리', 'サウンド')), sw('sound', () => this.sound.setOn(set.sound))),
      range('bgm', t('BGM 음량', 'BGM音量')),
      range('sfx', t('효과음 음량', '効果音の音量')),
      h('div', { class: 'toggle-row' }, h('span', null, t('효과음', '効果音')), sw('sfxOn', () => this.sound.setVolumes(set.bgm, set.sfx, set.sfxOn))));
  }
  segRow(key, label, opts, after) {
    const set = this.settings;
    return h('div', { class: 'toggle-row' }, h('span', null, label), h('div', { class: 'seg' }, opts.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(set[key] === v), onclick: (e) => { set[key] = v; this.saveSettings(); after && after(); [...e.currentTarget.parentNode.children].forEach((b) => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); } }, l))));
  }
  // 후리가나·학습 수준·쉬운 단어 숨기기·학습 집중 모드. 바꾸면 보고 있는 장면에 바로 반영한다.
  // onLang: 표시 언어를 바꾼 뒤 이 조각을 새 언어로 다시 그릴 때
  studyControls(onLang) {
    const set = this.settings;
    const t = (ko, ja) => this.tx(ko, ja);
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
      const desc = SETTING_DESC[key];
      // 일본어 표시 모드: 일본어 설명 아래에 한국어 (표시 안내와 같은 방식)
      const ja = (set.lang || 'ja') === 'ja';
      return h('div', { class: 'toggle-block' }, h('div', { class: 'toggle-row' }, h('span', null, label), b), desc ? h('p', { class: 'toggle-desc' }, t(desc[0], desc[1]), ja ? h('span', { class: 'legend-ko', lang: 'ko' }, desc[0]) : null) : null);
    };
    const custom = h('div', { class: 'opt-grid checks', hidden: set.studyLevel !== 'custom' },
      [['5', 'N5'], ['4', 'N4'], ['3', 'N3'], ['2', 'N2'], ['1', 'N1'], ['K', t('검도 용어', '剣道用語')]].map(([c, label]) => h('button', { type: 'button', role: 'checkbox', 'aria-checked': String(set.customLevels.includes(c)), onclick: (e) => {
        const has = set.customLevels.includes(c);
        set.customLevels = has ? set.customLevels.filter((x) => x !== c) : [...set.customLevels, c];
        e.currentTarget.setAttribute('aria-checked', String(!has));
        changed();
      } }, label)));
    const freq = h('div', null,
      h('div', { class: 'field-label' }, t('플레이 중 퀴즈', 'プレイ中のクイズ')),
      grid('quizFreq', [['off', t('끄기', 'なし')], ['low', t('적게', '少なめ')], ['mid', t('보통', 'ふつう')], ['high', t('많이', '多め')]]));
    freq.hidden = set.playMode === 'watch';
    return h('div', { class: 'study-box' },
      h('div', { class: 'field-label' }, t('표시 언어', '表示言語')),
      grid('lang', [['ja', '日本語'], ['ko', '한국어']], onLang),
      h('div', { class: 'field-label' }, t('모드', 'モード')),
      grid('playMode', [['study', t('학습 모드', '学習')], ['watch', t('감상 모드', '観賞')]], () => (freq.hidden = set.playMode === 'watch')),
      freq,
      h('div', { class: 'field-label' }, 'ふりがな'),
      grid('furigana', [['always', t('항상', 'いつも')], ['n2', t('N2 이상 어휘만', 'N2以上の語だけ')], ['hard', t('어려운 한자·고유명사만', '難しい漢字・固有名詞だけ')], ['off', t('끄기', 'なし')]]),
      h('div', { class: 'field-label' }, t('학습 수준', '学習レベル')),
      grid('studyLevel', [['n5', 'N5~N4'], ['n3', 'N3'], ['n2', 'N2'], ['n1', 'N1'], ['custom', t('직접 선택', '自分で選ぶ')]], () => (custom.hidden = set.studyLevel !== 'custom')),
      custom,
      sw('hideEasy', t('쉬운 단어 학습 표시 끄기', 'やさしい語の印を消す')),
      sw('focus', t('학습 집중 모드', '学習集中モード')),
      h('div', { class: 'field-label' }, t('글 아래 표시 보는 법', '下線・点線の見方')),
      legendView((set.lang || 'ja') === 'ja'),
      h('div', { class: 'field-label' }, t('선택지', '選択肢')),
      grid('choiceMode', [['major', t('중요한 장면만', '大事な場面だけ')], ['all', t('모든 장면', 'すべての場面')]]));
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
    const ja = (this.settings.lang || 'ja') === 'ja';
    const counts = reviewCounts(srs);
    const soundBtn = h('button', { class: 'btn center', type: 'button', 'aria-pressed': String(this.settings.sound), onclick: () => { this.setSound(!this.settings.sound); soundBtn.replaceChildren(icon(this.settings.sound ? 'snd' : 'mute', 16), this.settings.sound ? this.tx('소리 끄기', '音を消す') : this.tx('소리 켜기', '音を出す')); soundBtn.setAttribute('aria-pressed', String(this.settings.sound)); } }, icon(this.settings.sound ? 'snd' : 'mute', 16), this.settings.sound ? this.tx('소리 끄기', '音を消す') : this.tx('소리 켜기', '音を出す'));
    // 첫 화면 안에 시작 단추: 로고·도트 창 바로 아래에 つづきから/はじめから, 학습 기록과 다른 메뉴는 그 아래
    // 나이는 게임 화면·연표와 같은 표기 (1살 전에는 「生後○か月」)
    const el = h('div', { class: 'screen' },
      h('div', { class: 'scroll title-wrap' },
        h('div', null, h('h1', { class: 'logo', lang: 'ja' }, '道場犬'), h('p', { class: 'subtitle', lang: 'ja' }, 'ある道場の、ある犬の一生')),
        h('div', { class: 'device title-device' }, h('div', { class: 'lcd' }, cv)),
        h('div', { class: 'btns title-main' },
          has ? h('button', { class: 'btn primary', type: 'button', onclick: () => this.resume(save) }, `つづきから · ${save.state.dog.name} ${ageLabel(save.state.t, true)}`) : null,
          h('button', { class: has ? 'btn center' : 'btn primary', type: 'button', onclick: () => this.go('birth') }, 'はじめから')),
        h('button', { class: 'study-strip', type: 'button', onclick: () => this.go('review') },
          h('span', { class: 'due' }, h('b', null, ja ? '今日の復習' : '오늘의 복습'), h('span', null, String(counts.today)), h('small', { class: 'due-next' }, ja ? `明日から復習 ${counts.tomorrow}` : `내일부터 복습 ${counts.tomorrow}`)),
          progressBox(srs, undefined, ja)),
        n2SummaryBox(this),
        h('div', { class: 'btns' },
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
    G.repairState(s);
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
    const jp = (this.settings.lang || 'ja') === 'ja';
    const gloss = (ja, ko, jaNote) => h('button', { class: 'gloss', type: 'button', lang: 'ja', onclick: () => this.toast(jp && jaNote ? `${ja} — ${jaNote}（${ko}）` : `${ja} — ${ko}`) }, ja);
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
        h('dt', null, '性格'), h('dd', null, gloss(per.ja, per.desc, per.descJa)),
        h('dt', null, '町'), h('dd', null, jp ? gloss(w.region.ja, w.region.desc, w.region.descJa) : w.region.ko),
        h('dt', null, '道場'), h('dd', null, gloss(w.dojoName, w.dojo.ko, w.dojo.labelJa)),
        ...(w.continued ? [h('dt', null, '代'), h('dd', null, jp ? `${w.gen}代目 · 先代 ${s.prevDog.name}` : `${w.gen}대째 · 선대 ${s.prevDog.name}`)] : []));
      if (lcd) {
        lcd.dog = s.dog;
        lcd.draw();
      }
    };
    const worldSeg = legacy
      ? h('div', { class: 'seg', role: 'group', 'aria-label': '세계' },
          h('button', { type: 'button', 'aria-pressed': 'true', onclick: (e) => { world = 'new'; setSeg(e); make(); } }, jp ? '新しい世界' : '새 세계'),
          h('button', { type: 'button', 'aria-pressed': 'false', onclick: (e) => { world = 'continue'; setSeg(e); make(); } }, jp ? '続きの世界' : '이어지는 세계'))
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
              h('div', { class: 'note', lang: 'ja' }, `${x.dojoName} · ${x.gen}代目 · ${x.years}年`),
              h('div', null, x.titles.map((t) => h('span', { class: 'title-badge' }, t.ja))),
              x.lastWord ? h('div', null, `“${x.lastWord}”`) : null)))
          : h('p', { class: 'note' }, 'まだ記録がない')),
      h('div', { class: 'sheet-foot', style: 'position:static' }, h('button', { class: 'btn center', type: 'button', onclick: () => this.go('title') }, '戻る')));
  }

  settingsScreen() {
    const t = (ko, ja) => this.tx(ko, ja);
    const confirmBox = h('div', { hidden: true, class: 'card' },
      h('p', null, t('단어장·복습 기록·역사·진행 중인 견생이 모두 지워진다.', '単語帳・復習の記録・歴史・プレイ中の一生がすべて消える。')),
      h('div', { class: 'row' },
        h('button', { class: 'btn center danger', type: 'button', onclick: () => { store.resetAll(); this.settings = store.settings(); this.applyTheme(); this.toast(t('지움', '消した')); this.go('title'); } }, t('지우기', '消す')),
        h('button', { class: 'btn center', type: 'button', onclick: () => (confirmBox.hidden = true) }, t('그만두기', 'やめる'))));
    return h('div', { class: 'screen' },
      h('div', { class: 'scroll' },
        h('h2', { class: 'h' }, '設定'),
        this.segRow('theme', t('화면', '画面'), [['system', t('자동', '自動')], ['dark', t('다크', 'ダーク')], ['light', t('라이트', 'ライト')]], () => this.applyTheme()),
        h('h3', { class: 'h' }, t('일본어', '日本語')),
        this.studyControls(() => this.go('settings')),
        h('h3', { class: 'h' }, t('소리', 'サウンド')),
        this.soundControls(),
        h('h3', { class: 'h' }, t('기록', '記録')),
        h('button', { class: 'btn danger center', type: 'button', onclick: () => (confirmBox.hidden = false) }, t('모든 기록 지우기', 'すべての記録を消す')),
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
