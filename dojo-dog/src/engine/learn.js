// 후리가나 표시와 학습 대상 고르기. 두 설정은 서로 따로 움직인다.
import { VOCAB } from '../data/vocab.js';
import { GRAMMAR } from '../data/grammar.js';
// 수준 코드: '5'~'1'(N5~N1 추정), 'K'(검도 용어), 'P'(고유명사)
// JLPT는 공식 어휘 목록을 공개하지 않으므로 모든 수준은 학습 편의를 위한 추정이다.

export const FURIGANA_MODES = ['always', 'n2', 'hard', 'off'];
export const STUDY_LEVELS = ['n5', 'n3', 'n2', 'n1', 'custom'];
const TARGET = { n5: 4.5, n3: 3, n2: 2, n1: 1 };

export const lvCode = (lv) => (lv === '범위 밖' ? 'K' : /^N[1-5]$/.test(lv || '') ? lv.slice(1) : null);

// 루비(읽기)를 보일까. lv: 그 말의 수준 코드, hardKanji: 한자 자체가 N3 범위 밖인지, first: 고유명사가 처음 나왔는지
export function showRuby(mode, lv, { hardKanji = false, first = false } = {}) {
  if (mode === 'always') return true;
  if (mode === 'off') return false;
  if (lv === 'P') return first || mode === 'hard';
  if (mode === 'n2') return lv === '2' || lv === '1' || lv === 'K';
  if (mode === 'hard') return lv === '1' || lv === 'K' || hardKanji;
  return false;
}

// 이 수준의 말을 학습 대상으로 강조할까
export function allowedLevel(code, set) {
  if (!code || code === 'P') return false;
  const level = set.studyLevel || 'n2';
  if (level === 'custom') return (set.customLevels || ['3', '2', 'K']).includes(code);
  if (code === 'K') return set.kendoTerms !== false;
  if (!set.hideEasy) return true;
  // 「쉬운 단어 학습 표시 끄기」: 고른 수준보다 두 단계 이상 쉬운 말은 강조하지 않는다
  return Number(code) <= TARGET[level] + 1;
}

// 장면 하나의 학습 대상 순위: 고른 수준에 가까운 것 → 문법 우선 → 어려운 쪽 우선 → 먼저 나온 것
export function rankScore(type, code, set, order = 0) {
  const level = set.studyLevel || 'n2';
  const t = level === 'custom' ? 2 : TARGET[level];
  const n = code === 'K' ? t + 2.5 : Number(code);
  const dist = Math.abs(n - t) + (n > t ? 0.3 : 0);
  return dist * 100 + (type === 'g' ? 0 : 40) + order;
}

export const maxTargets = (set) => (set.focus ? 6 : 3);

// 장면의 대사 조각들(segs 배열의 배열)에서 학습 대상 id를 고른다
export function pickTargets(segLists, set = {}) {
  const found = new Map();
  let order = 0;
  for (const segs of segLists) {
    for (const sg of segs || []) {
      if (!sg || typeof sg !== 'object' || Array.isArray(sg)) continue;
      const id = sg.g ? 'g:' + sg.g : sg.v ? 'v:' + sg.v : null;
      order++;
      if (!id || found.has(id)) continue;
      const code = lvCode(sg.g ? GRAMMAR[sg.g]?.lv : VOCAB[sg.v]?.lv);
      if (!allowedLevel(code, set)) continue;
      found.set(id, rankScore(id[0], code, set, order));
    }
  }
  return [...found].sort((a, b) => a[1] - b[1]).slice(0, maxTargets(set)).map(([id]) => id);
}
