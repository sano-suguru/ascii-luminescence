// なめらかなノイズ（hash3・vnoise）。迷宮の生成と描画が使う。
// ノイズの種は、迷宮の乱数と同じく、このモジュールの中に持つ（生成が階ごとに setNoiseSeed で入れ替える。階に入る時も入れ替える）。

let seed = 1;
/** ノイズの種を入れ替える */
export const setNoiseSeed = (s: number): void => {
  seed = s;
};
/** 整数の点 (x, y, z) の、0 以上 1 未満の値（種で決まる） */
export const hash3 = (x: number, y: number, z: number): number => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
/** なめらかなノイズ（0 以上 1 未満） */
export function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z),
    xf = x - xi,
    yf = y - yi,
    zf = z - zi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf),
    w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, t: number): number => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}
