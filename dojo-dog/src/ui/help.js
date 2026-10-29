// 표시 안내: 글 아래의 줄(실선·물결선·점선)이 무엇이고, 누르면 무엇이 나오는지.
// 설정 화면과 게임 메뉴, 처음 한 번 뜨는 안내에서 같은 내용을 쓴다.
import { h } from './render.js';

// [보기 글자, 보기 class, 한국어 이름, 일본어 이름, 한국어 설명, 일본어 설명, 짧은 한국어 설명(처음 안내 카드)]
export const MARKS = [
  ['稽古', 'w', '실선 밑줄', '実線', '학습할 단어예요. 누르면 읽기·뜻·예문이 나오고 단어장에 넣을 수 있어요.', '学習する語。タップすると読み・意味・例文。単語帳に入れられる。', '학습할 단어. 누르면 읽기·뜻'],
  ['に違いない', 'gm', '물결 밑줄', '波線', '학습할 문법이에요. 누르면 뜻·접속·예문이 나와요.', '学習する文法。タップすると意味・接続・例文。', '학습할 문법. 누르면 뜻·접속'],
  ['灯心館', 'pn', '점선', '点線', '도장·동네·거리 같은 장소 이름이에요. 누르면 읽기와 어떤 곳인지가 나와요. 사람 이름에는 긋지 않아요.', '道場・町・通りなど場所の名前。タップすると読みと、どんな所か。人の名前には引かない。', '장소 이름. 누르면 어떤 곳인지'],
];
// [한국어, 일본어, 어느 표시 모드에서 보이나: 'ja' 일본어 표시 · 'ko' 한국어 표시 · 'all']
// 한국어 표시 모드에는 「訳」「全訳」 단추도, 눌러서 여는 번역도 없다 (번역이 늘 보인다)
export const TAPS = [
  ['서술 문장이나 대사를 누르면 그 한국어 번역이 아래에 나와요. 다시 누르면 닫혀요.', '地の文やセリフをタップすると、その訳が下に出る。もう一度タップで閉じる。', 'ja'],
  ['대사 옆 「訳」은 그 대사만, 제목 옆 「全訳」은 장면 전체의 번역을 한꺼번에 열고 닫아요.', 'セリフの「訳」はそのセリフだけ、題の横の「全訳」は場面全体の訳をまとめて開け閉めする。', 'ja'],
  ['한국어 표시에서는 대사 아래에 번역이 늘 보여요. 일본어 표시로 바꾸면 문장을 눌러 번역을 열고 닫아요.', '韓国語表示では訳がいつもセリフの下に出る。日本語表示では文をタップして訳を開け閉めする。', 'ko'],
  ['사람 이름, 나(私·俺·僕), 숫자, 지금 키우는 개 이름에는 점선이 없어요.', '人の名前、「私・俺・僕」、数字、この犬の名前には点線を引かない。', 'all'],
];
// 처음 안내 카드의 탭 안내 한 줄 (일본어 표시 모드만)
export const TAP_SHORT = '문장·대사를 누르면 번역이 열리고 닫혀요. 「全訳」은 장면 전체.';
export const LEGEND_TITLE = ['글 아래 표시 보는 법', '下線・点線の見方'];

export const tapsFor = (ja) => TAPS.filter((x) => x[2] === 'all' || x[2] === (ja ? 'ja' : 'ko'));

// 줄 표시 보기 + 설명. ja: 일본어 표시 모드
// 보기 글자는 진짜 밑줄 단추(.w/.gm/.pn)와 모양만 같은 class(.mk-*)를 쓴다: 게임 칸 안에 있어도 학습 대상으로 세지 않게
// compact: 게임 화면에 처음 한 번 뜨는 안내 — 표시마다 한 줄(이름 + 짧은 한국어 설명), 탭 안내는 일본어 표시 모드에서 한 줄
export function legendView(ja = true, { compact = false } = {}) {
  if (compact) {
    return h('div', { class: 'legend compact' },
      MARKS.map(([sample, cls, ko, jaName, , , koShort]) => h('div', { class: 'legend-row' },
        h('span', { class: 'legend-sample', lang: 'ja' }, h('span', { class: 'mk-' + cls + ' legend-mark' }, sample)),
        h('span', { class: 'legend-text' }, h('b', ja ? { lang: 'ja' } : null, ja ? jaName : ko.replace(' 밑줄', '')), h('span', { lang: 'ko' }, koShort)))),
      ja ? h('ul', { class: 'legend-taps' }, h('li', null, TAP_SHORT)) : null);
  }
  return h('div', { class: 'legend' },
    MARKS.map(([sample, cls, ko, jaName, koDesc, jaDesc]) => h('div', { class: 'legend-row' },
      h('span', { class: 'legend-sample', lang: 'ja' }, h('span', { class: 'mk-' + cls + ' legend-mark' }, sample)),
      h('div', { class: 'legend-text' }, h('b', ja ? { lang: 'ja' } : null, ja ? jaName : ko), h('span', null, ja ? jaDesc : koDesc), ja ? h('span', { class: 'legend-ko', lang: 'ko' }, koDesc) : null))),
    h('ul', { class: 'legend-taps' }, tapsFor(ja).map(([ko, jaT]) => h('li', null, ja ? jaT : ko, ja ? h('span', { class: 'legend-ko', lang: 'ko' }, ko) : null))));
}

// 설정 스위치 설명 (src/engine/learn.js · quizplan.js · game.js 동작과 맞춘다)
//  hideEasy: learn.js allowedLevel — 「직접 선택」 수준은 고른 수준만 밑줄이라 이 스위치를 보지 않는다
//  focus: learn.js maxTargets(한 화면 6개) · game.js renderLines(대사 아래 목록) · quizplan.js BUMP(퀴즈·복습 카드 한 단계, 「많이」는 그대로) · 오토 1.6배
export const SETTING_DESC = {
  hideEasy: ['켜면 고른 학습 수준보다 쉬운 단어·문법에는 밑줄을 긋지 않아요. 예: N2를 고르면 N2·N1 말에만 밑줄. 후리가나는 그대로예요. 학습 수준이 「직접 선택」이면 고른 수준에만 밑줄이 있어 이 스위치는 쓰이지 않아요.', 'オンにすると、選んだ学習レベルよりやさしい語・文法には下線を引かない（例：N2ならN2・N1だけ）。ふりがなはそのまま。学習レベルが「自分で選ぶ」のときは選んだレベルだけに下線があるので、このスイッチは使われない。'],
  focus: ['공부에 더 무게를 둬요. 대사가 있는 장면은 대사 아래에 학습 단어 목록이 나오고, 밑줄은 한 화면에 최대 6개(평소 3개), 플레이 중 퀴즈·복습 카드는 한 단계 잦아져요(「많이」면 그대로). 오토 진행도 조금 느려져요.', '勉強寄りにする。セリフのある場面はセリフの下に学習語の一覧、下線は1画面6つまで（ふだん3つ）、プレイ中のクイズ・復習カードが一段多め（「多め」ならそのまま）。オートも少しゆっくり。'],
};
