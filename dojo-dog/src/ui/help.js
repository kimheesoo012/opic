// 표시 안내: 글 아래의 줄(실선·물결선·점선)이 무엇이고, 누르면 무엇이 나오는지.
// 설정 화면과 게임 메뉴, 처음 한 번 뜨는 안내에서 같은 내용을 쓴다.
import { h } from './render.js';

// [보기 글자, 보기 class, 한국어 이름, 일본어 이름, 한국어 설명, 일본어 설명]
export const MARKS = [
  ['稽古', 'w', '실선 밑줄', '実線', '학습할 단어예요. 누르면 읽기·뜻·예문이 나오고 단어장에 넣을 수 있어요.', '学習する語。タップすると読み・意味・例文。単語帳に入れられる。'],
  ['わけにはいかない', 'gm', '물결 밑줄', '波線', '학습할 문법이에요. 누르면 뜻·접속·예문이 나와요.', '学習する文法。タップすると意味・接続・例文。'],
  ['千春', 'pn', '점선', '点線', '사람·도장·동네 이름이에요. 누르면 읽기와 누구(무엇)인지가 나와요.', '人・道場・町の名前。タップすると読みと、誰（何）なのか。'],
];
export const TAPS = [
  ['문장을 누르면 그 문장의 한국어 번역이 나와요.', '文をタップすると、その文の訳が出る。'],
  ['「訳」은 서술이나 대사 전체의 번역을 한꺼번에 열고 닫아요.', '「訳」は地の文・セリフ全体の訳をまとめて開け閉めする。'],
];

// 줄 표시 보기 + 설명. ja: 일본어 표시 모드
export function legendView(ja = true) {
  return h('div', { class: 'legend' },
    MARKS.map(([sample, cls, ko, jaName, koDesc, jaDesc]) => h('div', { class: 'legend-row' },
      h('span', { class: 'legend-sample', lang: 'ja' }, h('span', { class: cls + ' legend-mark' }, sample)),
      h('div', { class: 'legend-text' }, h('b', null, ja ? jaName : ko), h('span', null, ja ? jaDesc : koDesc), ja ? h('span', { class: 'legend-ko', lang: 'ko' }, koDesc) : null))),
    h('ul', { class: 'legend-taps' }, TAPS.map(([ko, jaT]) => h('li', null, ja ? jaT : ko, ja ? h('span', { class: 'legend-ko', lang: 'ko' }, ko) : null))));
}

// 설정 스위치 설명 (src/engine/learn.js · quizplan.js · game.js 동작과 맞춘다)
export const SETTING_DESC = {
  hideEasy: ['켜면 고른 학습 수준보다 쉬운 단어·문법에는 밑줄을 긋지 않아요. 예: N2를 고르면 N2·N1 말에만 밑줄. 후리가나는 그대로예요.', 'オンにすると、選んだ学習レベルよりやさしい語・文法には下線を引かない（例：N2ならN2・N1だけ）。ふりがなはそのまま。'],
  focus: ['공부에 더 무게를 둬요. 대사마다 「訳」 버튼, 장면 아래 학습 단어 목록, 장면당 밑줄 최대 6개(평소 3개), 퀴즈가 한 단계 자주, 오토 진행이 조금 느려져요.', '勉強寄りにする。セリフごとの「訳」、場面の下に学習語の一覧、下線は1場面6つまで（ふだん3つ）、クイズが一段多め、オートが少しゆっくり。'],
};
