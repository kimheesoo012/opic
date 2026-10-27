// 시드 기반 난수 생성기 (mulberry32). 상태는 정수 하나라서 state 객체에 그대로 저장된다.

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const t = String(str);
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// holder.rng 에 상태를 보관한다.
export function rand(holder) {
  let a = (holder.rng = (holder.rng + 0x6d2b79f5) >>> 0);
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

export const rint = (h, lo, hi) => lo + Math.floor(rand(h) * (hi - lo + 1));
export const chance = (h, p) => rand(h) < p;
export const pick = (h, arr) => arr[Math.floor(rand(h) * arr.length)];

export function weighted(h, items, wfn) {
  let total = 0;
  const ws = items.map((it) => {
    const w = Math.max(0, wfn(it));
    total += w;
    return w;
  });
  if (total <= 0) return null;
  let r = rand(h) * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

export function shuffle(h, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(h) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
