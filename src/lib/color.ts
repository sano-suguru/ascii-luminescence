// 色（もとは src/game/02-constants.js の css）。

/** 色（0 から 1 の RGB）を、少し明るくした CSS の rgb() にする（暗い色もパネルで読めるように） */
export const css = (c: readonly [number, number, number]): string =>
  `rgb(${Math.round(255 * Math.min(1, c[0] * 0.85 + 0.15))},${Math.round(255 * Math.min(1, c[1] * 0.85 + 0.15))},${Math.round(255 * Math.min(1, c[2] * 0.85 + 0.15))})`;
