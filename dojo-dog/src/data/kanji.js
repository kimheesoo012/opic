// 한자 DB: 글자 → { on: 음독 배열(히라가나), ko: 한국 훈음 }. 어휘 DB의 모든 한자와 문제은행 선택지의 한자를 담는다.
// 쓰임: 읽기·표기 문제의 정답 해설에 「逮 たい 잡을 체 ＋ 捕 ほ 잡을 포」 줄을 자동으로 만든다.
import k1 from './kanji/k1.js';
import k2 from './kanji/k2.js';
import k3 from './kanji/k3.js';
import k4 from './kanji/k4.js';

export const KANJI = {};
for (const part of [k1, k2, k3, k4]) {
  for (const [c, [on, ko]] of Object.entries(part)) KANJI[c] = { on: on ? on.split(/[・･、,]/).map((x) => x.trim()).filter(Boolean) : [], ko: ko || '' };
}
