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

// 飾りと描画に使う文字の並び（もとは src/game/02-constants.js）
/** 壁などに刻むルーンの代わりの記号 */
export const RUNESET = ['&', '%', '$', '?', '!', '#', '+', 'x', 'Y', 'Z', '8', '0', '*', '~', '^', '=', '<', '>', '{', '}', '/', '\\'];
/** 生き物の文字が、ときどき入れ替わる時の文字 */
export const SWAPSET = '#$%&*+=?@0123456789ABCDEFGHJKLMNPQRSTUVWXYZ<>{}[]~^';
/** 壁の文字 */
export const WG = '###########%%&8HX=+#$#';
/** 明るさの段ごとの文字（暗い方から。シェーダーの uRamp に渡す） */
export const RAMP_CH = '.`,:-~=+*^%%#&08';
