// 文字の図鑑の番号（もとは src/game/02-constants.js）。描画の文字の図鑑（src/game/05-renderer.js）と同じ並び。

/** ルーン文字（図鑑の 96 番から） */
export const RUNE_CHARS = 'ᚦᛏᛜᛞᚲᛁᛊᚾᚱᚺ';

/** 文字の、図鑑の中の番号。ASCII は 0 から 95、ルーン文字は 96 から、無い文字は 31 */
export const G = (ch: string): number => {
  const c = ch.charCodeAt(0);
  if (c < 128) return c - 32;
  const k = RUNE_CHARS.indexOf(ch);
  return k >= 0 ? 96 + k : 31;
};
