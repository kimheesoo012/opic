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
  furigana: 'n2', // 'always' 항상 / 'n2' N2 이상 어휘만 / 'hard' 어려운 한자·고유명사만 / 'off'
  studyLevel: 'n2', // 'n5'(N5~N4) / 'n3' / 'n2' / 'n1' / 'custom'
  customLevels: ['3', '2', 'K'],
  hideEasy: true, // 쉬운 단어 학습 표시 끄기
  focus: false, // 학습 집중 모드
  lang: 'ja', // 'ja' 일본어 몰입(번역은 탭할 때만) / 'ko' 한국어 서술
  playMode: 'study', // 'study' 학습 모드(확인 문제·복습 카드) / 'watch' 감상 모드(학습 문제가 저절로 나오지 않는다)
  quizFreq: 'mid', // 'off' / 'low' 8~10장면 / 'mid' 4~5장면 / 'high' 2~3장면마다 한 문제
  choiceMode: 'major', // 'major' 중요한 장면만 직접 고른다(나머지는 개가 성격대로 움직인다) / 'all' 모든 장면
  lcdFold: null, // 도트 창 접기: null=자동(600px 미만 화면에서는 접음), true/false=직접 고른 값
  sound: false,
  bgm: 0.5,
  sfx: 0.45,
  sfxOn: true,
  theme: 'system',
};

const SETTINGS_VERSION = 2;

// 옛 설정을 새 형식으로: 1판의 'hard'(N4 밖 한자에 읽기)는 새 기본값 'n2'로 옮긴다
export function migrateSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  if ((raw && raw.v ? raw.v : 1) < 2) {
    if (s.furigana === 'hard') s.furigana = 'n2';
  }
  if (!['always', 'n2', 'hard', 'off'].includes(s.furigana)) s.furigana = 'n2';
  if (!['n5', 'n3', 'n2', 'n1', 'custom'].includes(s.studyLevel)) s.studyLevel = 'n2';
  if (!Array.isArray(s.customLevels)) s.customLevels = [...DEFAULT_SETTINGS.customLevels];
  if (!['study', 'watch'].includes(s.playMode)) s.playMode = 'study';
  if (!['ja', 'ko'].includes(s.lang)) s.lang = 'ja';
  if (!['off', 'low', 'mid', 'high'].includes(s.quizFreq)) s.quizFreq = 'mid';
  if (!['major', 'all'].includes(s.choiceMode)) s.choiceMode = 'major';
  s.v = SETTINGS_VERSION;
  return s;
}

export const store = {
  settings() {
    return migrateSettings(read('settings', null));
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
  // N2 문제 기록 { 문제id: { ok, ng, last, lastOk, t 유형 } }
  qlog() {
    return read('qlog', {});
  },
  saveQlog(x) {
    write('qlog', x);
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
    for (const k of ['settings', 'save', 'wordbook', 'study', 'terms', 'history', 'legacy', 'srs', 'daily', 'qlog']) remove(k);
  },
};
