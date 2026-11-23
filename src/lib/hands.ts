// 手元の武器の文字（もとは src/game/19-hands-runes.js の初め）。
type V3 = readonly [number, number, number];

/** 手元の武器の文字の大きさ */
export const VM_ST = 0.022;
/** 線の向き (dx, dy) に合う文字 */
export const vmGlyph = (dx: number, dy: number): string => {
  const a = Math.atan2(dy, dx);
  const d = ((a * 180) / Math.PI + 360) % 180;
  return d < 22.5 || d >= 157.5 ? '-' : d < 67.5 ? '/' : d < 112.5 ? '|' : '\\';
};
/** 目から見た2点 A・B を結ぶ線の文字（奥行きで割った、画面での傾きで選ぶ） */
export const vmGlyphS = (A: V3, B: V3): string => vmGlyph(B[0] / B[2] - A[0] / A[2], B[1] / B[2] - A[1] / A[2]);
export const VM_K = 1.95;
/** 左右を入れ替えた時の文字 */
export const VM_MIRROR: Record<string, string> = { '/': '\\', '\\': '/', '(': ')', ')': '(', '<': '>', '>': '<' };
