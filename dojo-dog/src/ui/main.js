// 앱 셸: 화면 전환, 설정, 저장, 소리
import * as G from '../engine/core.js';
import { COATS, HAIRS, PERSONALITIES } from '../engine/world.js';
import { h } from './render.js';
import { store } from './store.js';
import { Sound } from './audio.js';
import { GameView } from './game.js';
import { farewellScreen, resultScreen, quizScreen } from './end.js';
import { wordPopup, wordbookScreen } from './vocabui.js';
import { drawDog } from './dogdraw.js';

class App {
  constructor(root) {
    this.root = root;
    this.settings = store.settings();
    this.sound = new Sound();
    this.sound.setVolumes(this.settings.bgm, this.settings.sfx);
    this.view = null;
    this.state = null;
    this.prev = 'title';
    this.cur = 'title';
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
    if (on) this.sound.sfx('bark');
  }
  modalOpen() {
    return !!this.root.querySelector('.modal-back');
  }
  toast(msg) {
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    this.root.append(t);
    setTimeout(() => t.remove(), 2600);
  }
  mountScreen(el) {
    this.root.querySelectorAll('.screen, .modal-back, .toast').forEach((n) => n.remove());
    this.root.append(el);
  }
  go(name, arg) {
    if (this.view && name !== 'game') {
      this.view.unmount();
      this.view = null;
    }
    if (name !== 'quiz') this.prev = this.cur;
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
      case 'wordbook':
        return this.mountScreen(wordbookScreen(this));
      case 'history':
        return this.mountScreen(this.historyScreen());
      case 'settings':
        return this.mountScreen(this.settingsScreen());
      default:
        return null;
    }
  }
  back() {
    if (this.prev === 'result' && this.lastLife) return this.mountScreen(resultScreen(this, this.lastLife)), (this.cur = 'result');
    if (this.prev === 'game' && this.state) return this.go('game', this.state);
    if (this.prev === 'wordbook') return this.go('wordbook');
    return this.go('title');
  }
  openWord(key, scene) {
    wordPopup(this, key, scene, this.settings.furigana);
  }
  onWordSaved(key) {
    if (this.state && this.state.phase !== 'ended' && !this.state.vocab.includes(key)) this.state.vocab.push(key);
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
  finishLife(s) {
    const sum = s.summary;
    const hist = store.history();
    hist.unshift({ at: Date.now(), name: sum.dog.name, nameKo: sum.dog.nameKo, years: sum.years, seasons: sum.seasons, titles: sum.titles.slice(0, 3), dojoName: sum.world.dojoName, gen: sum.world.gen, subs: sum.subs, foiled: sum.foiled, vocab: sum.vocab, lastWord: sum.lastWord, cast: Object.fromEntries(Object.entries(sum.cast).map(([r, c]) => [r, { ko: c.ko, epilogue: c.epilogue }])) });
    store.saveHistory(hist.slice(0, 50));
    store.saveLegacy(G.legacyOf(s));
    store.clearGame();
    this.lastLife = s;
    this.state = null;
    this.cur = 'result';
    this.mountScreen(resultScreen(this, s));
  }
  startQuiz(keys, label) {
    if (this.cur !== 'quiz') this.prev = this.cur;
    this.cur = 'quiz';
    if (this.view) {
      this.view.unmount();
      this.view = null;
    }
    this.mountScreen(quizScreen(this, keys, label));
  }

  // ───── 화면들 ─────
  titleScreen() {
    const save = store.loadGame();
    const cv = h('canvas', { class: 'title-dog', width: '720', height: '360', 'aria-hidden': 'true' });
    const dog = save && save.state ? save.state.dog : { name: 'コテツ', coat: 'black_tan', hair: 'smooth' };
    requestAnimationFrame(() => {
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 720, 360);
      ctx.fillStyle = 'rgba(201,154,98,0.35)';
      ctx.fillRect(0, 300, 720, 60);
      drawDog(ctx, 360, 250, 2.2, dog, { pose: 'sit', t: 0.2 });
    });
    const soundBtn = h('button', { class: 'btn center', type: 'button', 'aria-pressed': String(this.settings.sound), onclick: () => { this.setSound(!this.settings.sound); soundBtn.textContent = this.settings.sound ? '🔊 소리 끄기' : '🔈 소리 켜기'; } }, this.settings.sound ? '🔊 소리 끄기' : '🔈 소리 켜기');
    const hist = store.history();
    return h('div', { class: 'screen' },
      h('div', { class: 'scroll title-wrap' },
        h('div', null,
          h('div', { class: 'kicker' }, 'ある道場の、ある犬の一生'),
          h('h1', { class: 'logo', lang: 'ja' }, '道場犬', h('small', null, '일본 동네 검도장에 사는 닥스훈트의 견생 시뮬레이션. 개는 검도를 하지 않는다. 대신 곁에서 지켜보고, 아주 조금 바꾼다.'))),
        cv,
        h('div', { class: 'btns' },
          save && save.state ? h('button', { class: 'btn primary', type: 'button', onclick: () => this.resume(save) }, `つづきから · ${save.state.dog.nameKo} (${Math.floor(save.state.t / 4)}살)`) : null,
          h('button', { class: save && save.state ? 'btn center' : 'btn primary', type: 'button', onclick: () => this.go('birth') }, hist.length ? 'はじめから · 새 견생' : 'はじめから'),
          h('div', { class: 'row' },
            h('button', { class: 'btn center', type: 'button', onclick: () => this.go('wordbook') }, '単語帳'),
            h('button', { class: 'btn center', type: 'button', onclick: () => this.go('history') }, '道場の歴史')),
          h('div', { class: 'row' }, soundBtn, h('button', { class: 'btn center', type: 'button', onclick: () => this.go('settings') }, '설정')),
          h('p', { class: 'note' }, '오토 1배속으로 한 판 약 15~20분. 시스템 해설은 한국어, 사람들의 대사는 일본어입니다. 밑줄 단어를 탭하면 단어장에 저장돼요.'))));
  }

  resume(save) {
    const s = save.state;
    if (s.phase === 'farewell') return this.toFarewell(s);
    if (s.phase === 'birth') G.beginLife(s);
    this.go('game', s);
  }

  birthScreen() {
    const legacy = store.legacy();
    let world = 'new';
    let s = null;
    const make = () => {
      s = G.newLife({ seed: String(Date.now()) + Math.random().toString(36).slice(2, 7), world, legacy });
      draw();
    };
    const cv = h('canvas', { class: 'title-dog', width: '720', height: '320', 'aria-hidden': 'true' });
    const info = h('div', { class: 'card' });
    const nameIn = h('input', { class: 'word-input', id: 'dog-name', maxlength: '8', 'aria-label': '이름' });
    const draw = () => {
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 720, 320);
      ctx.fillStyle = 'rgba(201,154,98,0.35)';
      ctx.fillRect(0, 262, 720, 58);
      drawDog(ctx, 360, 222, 2.0, s.dog, { pose: 'stand', t: 0 });
      nameIn.value = s.dog.name;
      const coat = COATS.find((c) => c.id === s.dog.coat);
      const hair = HAIRS.find((c) => c.id === s.dog.hair);
      const per = PERSONALITIES.find((p) => p.id === s.dog.per);
      const w = s.world;
      info.innerHTML = '';
      info.append(h('dl', { class: 'kv' },
        h('dt', null, '털 색'), h('dd', null, h('span', { lang: 'ja' }, coat.ja), ` · ${coat.ko}`),
        h('dt', null, '털 종류'), h('dd', null, h('span', { lang: 'ja' }, hair.ja), ` · ${hair.ko}`),
        h('dt', null, '성격'), h('dd', null, h('span', { lang: 'ja' }, per.ja), ` · ${per.desc}`),
        h('dt', null, '지역'), h('dd', null, `${w.region.ko} — ${w.region.desc}`),
        h('dt', null, '도장'), h('dd', null, h('span', { lang: 'ja' }, w.dojoName), ` · ${w.dojo.ko}. ${w.dojo.desc}`),
        w.continued ? [h('dt', null, '세계'), h('dd', null, `선대 ${s.prevDog.nameKo} 이후 ${w.yearsLater}년. 예전에 울던 아이가 이제 사범이다.`)] : null));
    };
    const worldSeg = legacy
      ? h('div', { class: 'seg', role: 'group', 'aria-label': '세계' },
          h('button', { type: 'button', 'aria-pressed': 'true', onclick: (e) => { world = 'new'; setSeg(e); make(); } }, '새로운 세계'),
          h('button', { type: 'button', 'aria-pressed': 'false', onclick: (e) => { world = 'continue'; setSeg(e); make(); } }, '이어서 살아가는 세계'))
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
      this.go('game', s);
    };
    return h('div', { class: 'screen' },
      h('div', { class: 'scroll' },
        h('div', { class: 'kicker' }, '誕生'),
        h('h2', { class: 'h' }, '새 강아지가 도장에 온다'),
        worldSeg,
        cv,
        h('label', { for: 'dog-name', class: 'note' }, '이름 (바꿔도 돼요)'),
        nameIn,
        h('div', { style: 'height:10px' }),
        info),
      h('div', { class: 'sheet-foot', style: 'position:static' },
        h('button', { class: 'btn primary', type: 'button', onclick: start }, 'この子と生きる'),
        h('div', { class: 'row' },
          h('button', { class: 'btn center', type: 'button', onclick: make }, '다른 아이 만나기'),
          h('button', { class: 'btn center', type: 'button', onclick: () => this.go('title') }, '돌아가기'))));
  }

  historyScreen() {
    const hist = store.history();
    const legacy = store.legacy();
    return h('div', { class: 'screen' },
      h('div', { class: 'scroll' },
        h('h2', { class: 'h' }, '道場の歴史'),
        legacy ? h('p', { class: 'note' }, `다음 견생에서 「이어서 살아가는 세계」를 고르면, 이 도장에서 ${legacy.gen + 1}대째 개의 이야기가 시작됩니다.`) : null,
        hist.length
          ? h('div', { class: 'list' }, hist.map((x) => h('div', { class: 'card' },
              h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', { lang: 'ja', style: 'font-size:20px' }, x.name), h('span', { class: 'note' }, new Date(x.at).toLocaleDateString())),
              h('div', { class: 'note' }, `${x.dojoName} · ${x.gen}대째 · 견생 ${x.years}년`),
              h('div', null, x.titles.map((t) => h('span', { class: 'title-badge' }, t.ja))),
              h('div', { class: 'note' }, `서브스토리 ${x.subs} · 委員長 저지 ${x.foiled} · 단어 ${x.vocab}`),
              x.lastWord ? h('div', null, `“${x.lastWord}”`) : null)))
          : h('p', { class: 'note' }, '아직 기록이 없습니다. 첫 견생을 마치면 여기에 남아요.')),
      h('div', { class: 'sheet-foot', style: 'position:static' }, h('button', { class: 'btn center', type: 'button', onclick: () => this.go('title') }, '돌아가기')));
  }

  settingsScreen() {
    const set = this.settings;
    const seg = (key, opts, after) => h('div', { class: 'seg' }, opts.map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(set[key] === v), onclick: (e) => { set[key] = v; this.saveSettings(); after && after(); [...e.currentTarget.parentNode.children].forEach((b) => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); } }, label)));
    const range = (key, label) => h('div', { class: 'toggle-row' }, h('label', { for: 'r-' + key }, label), h('input', { type: 'range', id: 'r-' + key, min: '0', max: '1', step: '0.05', value: String(set[key]), oninput: (e) => { set[key] = Number(e.target.value); this.saveSettings(); this.sound.setVolumes(set.bgm, set.sfx); } }));
    const confirmBox = h('div', { hidden: true, class: 'card' },
      h('p', null, '단어장, 학습 기록, 도장의 역사, 진행 중인 견생이 모두 지워집니다.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn center danger', type: 'button', onclick: () => { store.resetAll(); this.settings = store.settings(); this.applyTheme(); this.toast('모든 기록을 지웠어요.'); this.go('title'); } }, '정말 지우기'),
        h('button', { class: 'btn center', type: 'button', onclick: () => (confirmBox.hidden = true) }, '그만두기')));
    return h('div', { class: 'screen' },
      h('div', { class: 'scroll' },
        h('h2', { class: 'h' }, '설정'),
        h('div', { class: 'toggle-row' }, h('span', null, '후리가나'), seg('furigana', [['always', '항상'], ['hard', '어려운 한자만'], ['off', '끄기']])),
        h('div', { class: 'toggle-row' }, h('span', null, 'オート'), seg('auto', [[true, 'ON'], [false, 'OFF']])),
        h('div', { class: 'toggle-row' }, h('span', null, 'オート 방식'), seg('autoMode', [['major', '大事な場面だけ'], ['all', '全部おまかせ']])),
        h('div', { class: 'toggle-row' }, h('span', null, '화면'), seg('theme', [['system', '시스템'], ['dark', '다크'], ['light', '라이트']], () => this.applyTheme())),
        h('div', { class: 'toggle-row' }, h('span', null, '소리'), seg('sound', [[true, '켜기'], [false, '끄기']], () => this.sound.setOn(set.sound))),
        range('bgm', 'BGM 음량'),
        range('sfx', '효과음 음량'),
        h('p', { class: 'note' }, '「어려운 한자만」은 대략 N4 범위 밖의 한자가 들어간 말에만 읽기를 답니다.'),
        h('h3', { class: 'h' }, '데이터'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => (confirmBox.hidden = false) }, '모든 기록 지우기'),
        confirmBox),
      h('div', { class: 'sheet-foot', style: 'position:static' }, h('button', { class: 'btn center', type: 'button', onclick: () => this.go('title') }, '돌아가기')));
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
