// 乱数と小さな道具（もとは src/game/02-constants.js）。

/** シードで決まる乱数（0 以上 1 未満）を返す関数を作る。同じシードなら、いつも同じ並びになる */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** v を a 以上 b 以下に収める */
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
