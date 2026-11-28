// 色の道具（css・hsl2rgb など）。
import { must, nth } from './array.ts';

/** 色（0 から 1 の RGB の、3つの数の組） */
export type Color = readonly [number, number, number];

/** 色（0 から 1 の RGB）を、少し明るくした CSS の rgb() にする（暗い色もパネルで読めるように） */
export const css = (c: Color): string =>
  `rgb(${Math.round(255 * Math.min(1, c[0] * 0.85 + 0.15))},${Math.round(255 * Math.min(1, c[1] * 0.85 + 0.15))},${Math.round(255 * Math.min(1, c[2] * 0.85 + 0.15))})`;

/** 表から読んだ色（3つの数の配列）を css の色に（色が無い・足りなければ、その場で止まる） */
export const cssOf = (c: readonly number[] | undefined): string => {
  const v = must(c, '色');
  return css([nth(v, 0), nth(v, 1), nth(v, 2)]);
};

/** 色相・彩度・明るさ（どれも 0 から 1）から RGB */
export function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number): number => {
    const k = (n + h * 12) % 12,
      a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}
