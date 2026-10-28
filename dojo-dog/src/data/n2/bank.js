// JLPT N2 형식 문제은행 (오리지널). 기출·시판 교재 문제를 옮기지 않는다.
// 문제 한 개: { id, type, q 문제문(〔밑줄〕·（　）빈칸), opts 선택지, a 정답 번호, why 선택지별 해설, ko 문제문 해석, ref ['v:말'|'g:문법'], pid 지문 id(文章の文法) }
// 정답이 하나뿐인지는 자동 검사로 보증할 수 없다 → tools/bank-check.mjs 는 형식·참조·읽기만 본다.
import vocabA from './bank_vocab_a.js';
import vocabB from './bank_vocab_b.js';
import gokei from './bank_gokei.js';
import grammarItems, { PASSAGES } from './bank_grammar.js';

export const BANK_TYPES = {
  kanji: ['漢字読み', '한자 읽기'],
  hyoki: ['表記', '표기'],
  gokei: ['語形成', '어형성'],
  bunmyaku: ['文脈規定', '문맥 규정'],
  iikae: ['言い換え類義', '바꿔 말하기'],
  yoho: ['用法', '용법'],
  bunpo: ['文法形式の判断', '문법 형식 판단'],
  narabe: ['文の組み立て', '문장 만들기(★)'],
  kaiwa: ['文脈の文法', '대화 속 문법'],
  bunsho: ['文章の文法', '글의 문법'],
};
export const BANK = [...vocabA, ...gokei, ...vocabB, ...grammarItems];
export { PASSAGES };
export const BANK_BY_ID = Object.fromEntries(BANK.map((q) => [q.id, q]));
