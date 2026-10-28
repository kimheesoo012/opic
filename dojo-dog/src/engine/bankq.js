// 문제은행(오리지널 N2 형식 문제)을 플레이 중 확인 문제로 쓰기 위한 색인. 한 문장으로 끝나는 유형만 쓴다.
import { BANK, BANK_TYPES } from '../data/n2/bank.js';

const PLAY_TYPES = new Set(['kanji', 'hyoki', 'gokei', 'bunmyaku', 'iikae', 'bunpo', 'kaiwa']);
export const BANK_BY_REF = {};
for (const q of BANK) {
  if (!PLAY_TYPES.has(q.type)) continue;
  for (const id of q.ref || []) (BANK_BY_REF[id] = BANK_BY_REF[id] || []).push(q);
}

// 문항이 다루는 어휘 키 (해설의 한자 분해·비슷한 말 줄에 쓴다): ref의 v:○○, 표기 문제는 정답 글자
export const bankVkey = (item) => (item.type === 'hyoki' ? item.opts[item.a] : (item.ref || []).filter((r) => r.startsWith('v:')).map((r) => r.slice(2))[0] || null);

// 문제은행 문항 → 확인 문제 모양
export function bankQuestion(id, item) {
  return {
    id,
    kind: 'bank',
    btype: item.type,
    bankId: item.id,
    prompt: item.q,
    options: item.opts,
    answer: item.a,
    why: item.why,
    ko: item.ko,
    vkey: bankVkey(item),
    full: item.full,
    explain: item.why[item.a],
    label: BANK_TYPES[item.type][0],
    sub: '',
  };
}
