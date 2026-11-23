// 色の道具（もとは src/game/02-constants.js の css と、07-bodies-lords.js の hsl2rgb）。

/** 色（0 から 1 の RGB）を、少し明るくした CSS の rgb() にする（暗い色もパネルで読めるように） */
export const css = (c: readonly [number, number, number]): string =>
  `rgb(${Math.round(255 * Math.min(1, c[0] * 0.85 + 0.15))},${Math.round(255 * Math.min(1, c[1] * 0.85 + 0.15))},${Math.round(255 * Math.min(1, c[2] * 0.85 + 0.15))})`;

/** 色相・彩度・明るさ（どれも 0 から 1）から RGB */
export function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number): number => {
    const k = (n + h * 12) % 12,
      a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}
