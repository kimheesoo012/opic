// 저장소. localStorage가 막혀 있어도(사생활 보호 모드 등) 게임은 메모리로 계속 돌아간다.
const PREFIX = 'dojoinu.';
const mem = {};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    if (v != null) return JSON.parse(v);
  } catch {
    /* 저장소 사용 불가 */
  }
  return key in mem ? mem[key] : fallback;
}
function write(key, value) {
  mem[key] = value;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function remove(key) {
  delete mem[key];
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* 무시 */
  }
}

export const DEFAULT_SETTINGS = {
  speed: 1,
  auto: true,
  autoMode: 'major', // 'all' 全部おまかせ / 'major' 大事な場面だけ止まる
  furigana: 'hard', // 'always' / 'hard' / 'off'
  sound: false,
  bgm: 0.5,
  sfx: 0.45,
  sfxOn: true,
  theme: 'system',
};

export const store = {
  settings() {
    return { ...DEFAULT_SETTINGS, ...read('settings', {}) };
  },
  saveSettings(s) {
    write('settings', s);
  },
  loadGame() {
    return read('save', null);
  },
  saveGame(state, extra) {
    return write('save', { state, extra, at: Date.now() });
  },
  clearGame() {
    remove('save');
  },
  // 단어장: { key: { key, at, scenes: [{ja, ko, sp, title, age, season}], n } }
  wordbook() {
    return read('wordbook', {});
  },
  saveWordbook(wb) {
    write('wordbook', wb);
  },
  // 학습 기록: { key: { ok, ng, last } }
  study() {
    return read('study', {});
  },
  saveStudy(st) {
    write('study', st);
  },
  // 간격 반복 기록 { 'v:단어' | 'g:문법': { met, box, due, streak, ok, ng, last } } — 견생을 넘어 유지
  srs() {
    return read('srs', {});
  },
  saveSrs(x) {
    write('srs', x);
  },
  // 오늘의 한 문제를 푼 날 (YYYY-MM-DD)
  dailyDone() {
    return read('daily', '');
  },
  saveDailyDone(d) {
    write('daily', d);
  },
  // 처음 본 검도 용어
  seenTerms() {
    return new Set(read('terms', []));
  },
  saveSeenTerms(set) {
    write('terms', [...set]);
  },
  // 도장의 역사 (지난 견생 요약)
  history() {
    return read('history', []);
  },
  saveHistory(h) {
    write('history', h);
  },
  legacy() {
    return read('legacy', null);
  },
  saveLegacy(l) {
    write('legacy', l);
  },
  resetAll() {
    for (const k of ['settings', 'save', 'wordbook', 'study', 'terms', 'history', 'legacy', 'srs', 'daily']) remove(k);
  },
};
