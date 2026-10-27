// 4지선다 복습 퀴즈 생성. 오답 선택지는 같은 품사·비슷한 길이에서 골라 정답이 티 나지 않게 한다.
import { hashSeed, rand, shuffle } from './rng.js';

const LV = { N5: 5, N4: 4, N3: 3, N2: 2, N1: 1, '범위 밖': 0 };

function similarity(a, b, field) {
  let score = 0;
  if (a.pos === b.pos) score += 3;
  if (!!a.k === !!b.k) score += 2;
  score -= Math.abs((LV[a.lv] ?? 2) - (LV[b.lv] ?? 2)) * 0.6;
  const la = String(a[field]).length;
  const lb = String(b[field]).length;
  score -= Math.abs(la - lb) / Math.max(la, lb, 1) * 3;
  return score;
}

// keys: 문제로 낼 단어들, vocab: 전체 사전, n: 문제 수
export function makeQuiz(keys, vocab, n = 10, seed = 'quiz') {
  const h = { rng: hashSeed(seed) };
  const pool = shuffle(h, [...new Set(keys)].filter((k) => vocab[k]));
  const all = Object.keys(vocab);
  const qs = [];
  for (let i = 0; i < Math.min(n, pool.length); i++) {
    const key = pool[i];
    const v = vocab[key];
    // 문제 유형: 뜻 고르기 / 단어 고르기 / 읽기 고르기 (가나만으로 된 단어는 읽기 문제를 내지 않는다)
    const kinds = ['meaning', 'word'];
    if (/[一-鿿]/.test(key)) kinds.push('reading');
    const kind = kinds[Math.floor(rand(h) * kinds.length)];
    const field = kind === 'meaning' ? 'm' : kind === 'reading' ? 'r' : 'w';
    const val = (k) => (field === 'w' ? k : vocab[k][field]);
    const correct = val(key);
    const cands = all
      .filter((k) => k !== key && val(k) !== correct && !String(val(k)).includes(correct) && !String(correct).includes(val(k)))
      .map((k) => ({ k, s: similarity({ ...v, w: key }, { ...vocab[k], w: k }, field) + rand(h) * 1.5 }))
      .sort((a, b) => b.s - a.s);
    const picked = [];
    for (const c of cands) {
      if (picked.length >= 3) break;
      if (picked.some((p) => val(p) === val(c.k))) continue;
      picked.push(c.k);
    }
    const options = shuffle(h, [key, ...picked]).map((k) => ({ key: k, label: val(k) }));
    qs.push({ key, kind, prompt: kind === 'word' ? v.m : key, options, answer: options.findIndex((o) => o.key === key) });
  }
  return qs;
}
