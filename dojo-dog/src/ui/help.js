// 표시 안내: 글 아래의 줄(실선·물결선·점선)이 무엇이고, 누르면 무엇이 나오는지.
// 설정 화면과 게임 메뉴, 처음 한 번 뜨는 안내에서 같은 내용을 쓴다.
import { h } from './render.js';

// [보기 글자, 보기 class, 한국어 이름, 일본어 이름, 한국어 설명, 일본어 설명, 짧은 한국어 설명(처음 안내 카드)]
export const MARKS = [
  ['稽古', 'w', '실선', '実線', '학습 단어. 누르면 읽기·뜻·예문', '学習する語。タップで読み・意味・例文', '학습 단어'],
  ['に違いない', 'gm', '물결선', '波線', '학습 문법. 누르면 뜻·접속·예문', '学習する文法。タップで意味・接続・例文', '학습 문법'],
  ['灯心館', 'pn', '점선', '点線', '장소 이름. 누르면 어떤 곳인지', '場所の名前。タップでどんな所か', '장소 이름'],
];
// [한국어, 일본어, 어느 표시 모드에서 보이나]
export const TAPS = [
  ['문장을 누르면 번역, 「全訳」은 장면 전체', '文をタップで訳。「全訳」は場面全体', 'ja'],
];
export const TAP_SHORT = '문장을 누르면 번역, 「全訳」은 장면 전체';
export const LEGEND_TITLE = ['표시 보는 법', '下線・点線の見方'];

export const tapsFor = (ja) => TAPS.filter((x) => x[2] === 'all' || x[2] === (ja ? 'ja' : 'ko'));

// 줄 표시 보기 + 한 줄 설명 (표시 언어 하나로만). 보기 글자는 모양만 같은 class(.mk-*)
export function legendView(ja = true, { compact = false } = {}) {
  return h('div', { class: 'legend' + (compact ? ' compact' : '') },
    MARKS.map(([sample, cls, ko, jaName, koDesc, jaDesc]) => h('div', { class: 'legend-row' },
      h('span', { class: 'legend-sample', lang: 'ja' }, h('span', { class: 'mk-' + cls + ' legend-mark' }, sample)),
      h('span', { class: 'legend-text', lang: ja ? 'ja' : 'ko' }, ja ? jaDesc : koDesc))),
    ja ? h('ul', { class: 'legend-taps' }, h('li', { lang: 'ja' }, TAPS[0][1])) : null);
}

// 설정 스위치 설명 (src/engine/learn.js · quizplan.js · game.js 동작과 맞춘다)
//  hideEasy: learn.js allowedLevel — 「직접 선택」 수준은 고른 수준만 밑줄이라 이 스위치를 보지 않는다
//  focus: learn.js maxTargets(한 화면 6개) · game.js renderLines(대사 아래 목록) · quizplan.js BUMP(퀴즈·복습 카드 한 단계, 「많이」는 그대로) · 오토 1.6배
export const SETTING_DESC = {
  hideEasy: ['고른 수준보다 쉬운 말에는 밑줄을 긋지 않아요', '選んだレベルよりやさしい語には下線を引かない'],
  focus: ['밑줄·퀴즈가 늘고 대사 아래에 학습 단어 목록', '下線・クイズが増え、セリフの下に学習語の一覧'],
};
