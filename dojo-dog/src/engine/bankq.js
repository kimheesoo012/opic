// 문제은행(오리지널 N2 형식 문제)을 플레이 중 확인 문제로 쓰기 위한 색인. 한 문장으로 끝나는 유형만 쓴다.
import { BANK, BANK_TYPES } from '../data/n2/bank.js';

const PLAY_TYPES = new Set(['kanji', 'hyoki', 'bunmyaku', 'iikae', 'bunpo', 'kaiwa']);
export const BANK_BY_REF = {};
for (const q of BANK) {
  if (!PLAY_TYPES.has(q.type)) continue;
  for (const id of q.ref || []) (BANK_BY_REF[id] = BANK_BY_REF[id] || []).push(q);
}

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
    explain: item.why[item.a],
    label: BANK_TYPES[item.type][0],
    sub: '',
  };
}
