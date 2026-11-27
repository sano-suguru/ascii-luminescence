// 手元の武器の文字と形の表（もとは src/game/19-hands-runes.js の初め）。描く処理 drawViewWeapons は src/lib/held.ts。
// the weapons in hand: drawn in glyphs as if held, entering from the lower edges of the view and cut off by them;
// near parts large, far parts small; filled shapes with bright rims; a hand where a hand would be (a fist on a hilt or shaft, the bow hand and the drawing hand,
// two hands on a two-handed weapon, an open hand when bare). Long weapons show only their upper part. Near a wall the picture shrinks toward the eye.
import { nth } from './array.ts';
import type { Color } from './color.ts';

/** 目から見た点（右 x・上 y・奥 z） */
export type V3 = readonly [number, number, number];
/** 目から見た点（3つの数。途中で計算した点は配列のまま） */
export type V = readonly number[];
/** 形の1つの文字：位置 x y z・文字・部位（VM_PART の名前）・大きさ */
export type Pt = readonly [number, number, number, string, string, number];
interface VmBase {
  /** 振る・回す時の軸の点 */
  pivot: V;
  pts: Pt[];
  /** 両手で持つ */
  two?: boolean;
  /** 突く剣（振らずに前へ出す） */
  thrust?: boolean;
  /** 杖の頭（性質の火花が出る所。星の杖は、ここを光が回る） */
  head?: V3;
  orbit?: boolean;
}
/** 弓：弦の両端 top・bot、握り grip、弦を引かない時の真ん中 rest と引ききった時 draw */
export interface VmBow extends VmBase {
  kind: 'bow';
  top: V3;
  bot: V3;
  grip: V3;
  rest: V3;
  draw: V3;
}
export interface VmOther extends VmBase {
  kind: 'sword' | 'xbow' | 'staff' | 'bare';
}
/** 武器の種類ごとの形 */
export type VmModel = VmBow | VmOther;

/** 手元の武器の文字の大きさ */
export const VM_ST = 0.022;
/** 線の向き (dx, dy) に合う文字 */
export const vmGlyph = (dx: number, dy: number): string => {
  const a = Math.atan2(dy, dx);
  const d = ((a * 180) / Math.PI + 360) % 180;
  return d < 22.5 || d >= 157.5 ? '-' : d < 67.5 ? '/' : d < 112.5 ? '|' : '\\';
};
/** 目から見た2点 A・B を結ぶ線の文字（奥行きで割った、画面での傾きで選ぶ） */
export const vmGlyphS = (A: V, B: V): string =>
  vmGlyph(nth(B, 0) / nth(B, 2) - nth(A, 0) / nth(A, 2), nth(B, 1) / nth(B, 2) - nth(A, 1) / nth(A, 2));
export const VM_K = 1.95;
/** 左右を入れ替えた時の文字 */
export const VM_MIRROR: Record<string, string> = { '/': '\\', '\\': '/', '(': ')', ')': '(', '<': '>', '>': '<' };

/** 武器の種類ごとの形（読み込んだ時に1回だけ作る。乱数は引かない）。表に無い種類は素手 bare で描く */
export const VM_MODELS = ((): Record<string, VmModel> => {
  const TV = Math.tan((37 * Math.PI) / 180),
    AS = 16 / 9,
    SZ = 0.03,
    K = VM_K;
  const S = (sx: number, sy: number, z: number): V3 => [sx * TV * AS * z, sy * TV * z, z];
  const L3 = (A: V, B: V, t: number): V => [0, 1, 2].map((k) => nth(A, k) + (nth(B, k) - nth(A, k)) * t);
  // a stroke of glyphs along a line, spaced so that each glyph stands apart
  const stroke = (o: Pt[], A: V, B: V, part: string, sz?: number, g?: string | null, gap?: number): void => {
    sz = (sz || SZ) * K;
    const dx = nth(B, 0) - nth(A, 0),
      dy = nth(B, 1) - nth(A, 1),
      dz = nth(B, 2) - nth(A, 2),
      L = Math.hypot(dx, dy, dz),
      n = Math.max(1, Math.round(L / (sz * (gap || 0.5)))),
      gg = g || vmGlyphS(A, B);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      o.push([nth(A, 0) + dx * t, nth(A, 1) + dy * t, nth(A, 2) + dz * t, gg, part, sz]);
    }
  };
  const curve = (o: Pt[], A: V, C: V, B: V, part: string, sz?: number, g?: string): void => {
    const N = 8;
    let P = A;
    for (let i = 1; i <= N; i++) {
      const t = i / N,
        Q = [0, 1, 2].map((k) => (1 - t) * (1 - t) * nth(A, k) + 2 * (1 - t) * t * nth(C, k) + t * t * nth(B, k));
      stroke(o, P, Q, part, sz, g);
      P = Q;
    }
  };
  const ring = (o: Pt[], c: V, R: number, a0: number, a1: number, n: number, part: string, sz?: number, g?: string): void => {
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / Math.max(1, n - 1);
      o.push([nth(c, 0) + Math.cos(a) * R, nth(c, 1) + Math.sin(a) * R, nth(c, 2), g || 'o', part, (sz || SZ) * K]);
    }
  };
  // a fist: a few large glyphs, the forearm leaving the view downward
  const fist = (o: Pt[], c: V, arm?: number | false): void => {
    const P: [number, number, string][] = [
      [-0.05, 0.024, '@'],
      [0, 0.032, '@'],
      [0.05, 0.024, '@'],
      [-0.04, -0.027, '%'],
      [0.01, -0.03, '%'],
      [0.057, -0.02, '%'],
    ];
    for (const [x, y, g] of P) o.push([nth(c, 0) + x, nth(c, 1) + y, nth(c, 2), g, g === '@' ? 'knuckle' : 'hand', 0.038 * K]);
    if (arm !== false)
      stroke(
        o,
        [nth(c, 0) + 0.02, nth(c, 1) - 0.04, nth(c, 2) - 0.01],
        [nth(c, 0) + (arm || 0.09), nth(c, 1) - 0.42, nth(c, 2) - 0.12],
        'arm',
        0.05,
        '%',
        1.1,
      );
  };
  // a sword along one axis: pommel, grip in the fist, a guard square to the axis, the blade to the tip
  const sword = (o: Pt[], P0: V3, T: V3, fistT: number, guardT: number, w0: number, guardW: number, inner: boolean): V => {
    const ax: V3 = [T[0] - P0[0], T[1] - P0[1], T[2] - P0[2]],
      al = Math.hypot(ax[0], ax[1]) || 1,
      px = -ax[1] / al,
      py = ax[0] / al;
    const F = L3(P0, T, fistT),
      Gd = L3(P0, T, guardT);
    fist(o, F);
    stroke(o, L3(P0, T, fistT + 0.03), Gd, 'metal', 0.03);
    stroke(
      o,
      [nth(Gd, 0) - px * guardW, nth(Gd, 1) - py * guardW, nth(Gd, 2)],
      [nth(Gd, 0) + px * guardW, nth(Gd, 1) + py * guardW, nth(Gd, 2)],
      'metal',
      0.032,
    );
    const B0 = L3(P0, T, guardT + 0.02);
    stroke(o, [nth(B0, 0) - px * w0, nth(B0, 1) - py * w0, nth(B0, 2)], T, 'edge', 0.03);
    stroke(o, [nth(B0, 0) + px * w0, nth(B0, 1) + py * w0, nth(B0, 2)], T, 'edge', 0.03);
    if (inner) stroke(o, B0, L3(B0, T, 0.85), 'fill', 0.026, null, 0.9);
    o.push([...T, '^', 'edge', 0.034]);
    return F;
  };
  const M: Record<string, VmModel> = {};
  {
    const o: Pt[] = [],
      F = sword(o, S(0.66, -1.12, 0.47), S(0.42, -0.42, 0.82), 0.13, 0.27, 0.026, 0.075, false);
    M['blade'] = { kind: 'sword', pivot: F, pts: o };
  }
  {
    const o: Pt[] = [],
      F = sword(o, S(0.66, -1.12, 0.47), S(0.38, -0.34, 0.9), 0.12, 0.24, 0.011, 0.04, false);
    M['dash'] = { kind: 'sword', thrust: true, pivot: F, pts: o };
  }
  {
    const o: Pt[] = [],
      P0 = S(0.48, -1.22, 0.45),
      T = S(0.32, -0.28, 0.95);
    fist(o, L3(P0, T, 0.06), 0.06);
    const F = sword(o, P0, T, 0.15, 0.25, 0.05, 0.12, true);
    M['gsword'] = { kind: 'sword', two: true, pivot: F, pts: o };
  }
  // bows: upright, a little left of the middle; the limbs bend away from you, the string toward you; the left fist on the grip
  const bow = (tall: boolean): VmBow => {
    const o: Pt[] = [],
      g = S(-0.3, -0.6, 0.72),
      top = S(-0.35, tall ? 0.15 : 0.0, 0.6),
      bot = S(-0.34, -1.9, 0.62);
    curve(o, g, S(-0.3, tall ? -0.2 : -0.28, 0.78), top, 'wood', 0.032);
    curve(o, g, S(-0.3, -1.2, 0.79), bot, 'wood', 0.032);
    fist(o, [g[0] + 0.004, g[1], g[2] - 0.01], -0.05);
    return { kind: 'bow', two: true, pivot: g, top, bot, grip: g, rest: S(-0.31, -0.6, 0.6), draw: S(0.12, -0.8, 0.46), pts: o };
  };
  M['bolt'] = bow(false);
  M['rain'] = bow(true);
  // the crossbow (one hand): level, low and to the right, a glowing bolt along its top
  {
    const o: Pt[] = [];
    fist(o, S(0.56, -1.05, 0.5));
    stroke(o, S(0.6, -1.25, 0.44), S(0.36, -0.68, 0.85), 'wood', 0.034);
    curve(o, S(0.14, -0.68, 0.8), S(0.36, -0.6, 0.84), S(0.6, -0.72, 0.78), 'metal', 0.03, '=');
    stroke(o, S(0.14, -0.69, 0.79), S(0.38, -0.75, 0.64), 'string', 0.022);
    stroke(o, S(0.6, -0.73, 0.78), S(0.38, -0.75, 0.64), 'string', 0.022);
    stroke(o, S(0.385, -0.7, 0.64), S(0.355, -0.62, 0.9), 'glow', 0.028);
    o.push([...S(0.352, -0.61, 0.91), '>', 'glow', 0.034]);
    M['rapid'] = { kind: 'xbow', pivot: S(0.48, -0.85, 0.6), pts: o };
  }
  // staffs: only the upper shaft and the head come into view; the hands hold it below
  const staff = (head: string): VmOther => {
    const o: Pt[] = [],
      h = S(0.42, -0.42, 0.86);
    stroke(o, S(0.6, -1.25, 0.56), [h[0], h[1] - 0.07, h[2]], 'wood', 0.034);
    if (head === 'orb') {
      ring(o, h, 0.075, 0, Math.PI * 2, 9, 'head', 0.034, 'o');
      o.push([...h, '*', 'glow', 0.05 * K]);
    } else if (head === 'beam') {
      const P: [number, number][] = [
        [0, 0.15],
        [0.066, 0],
        [0, -0.09],
        [-0.066, 0],
      ];
      for (let i = 0; i < 4; i++) {
        const A = nth(P, i),
          B = nth(P, (i + 1) % 4);
        stroke(o, [h[0] + A[0], h[1] + A[1], h[2]], [h[0] + B[0], h[1] + B[1], h[2]], 'head', 0.028);
      }
      o.push([h[0], h[1] + 0.018, h[2], '*', 'glow', 0.05 * K]);
    } else {
      for (let i = 0; i < 5; i++) {
        const a = Math.PI / 2 + (i * Math.PI * 2) / 5;
        stroke(o, h, [h[0] + Math.cos(a) * 0.105, h[1] + Math.sin(a) * 0.105, h[2]], 'head', 0.026);
      }
      o.push([...h, '*', 'glow', 0.05 * K]);
    }
    return { kind: 'staff', pivot: S(0.52, -0.85, 0.6), head: h, orbit: head === 'star', pts: o };
  };
  M['orb'] = staff('orb');
  M['beam'] = staff('beam');
  M['star'] = staff('star');
  {
    const o: Pt[] = [],
      h = S(0.36, -0.25, 0.92);
    stroke(o, S(0.5, -1.5, 0.5), [h[0] - 0.01, h[1] - 0.1, h[2]], 'wood', 0.036);
    ring(o, h, 0.15, 1.15, 5.13, 11, 'head', 0.05, '(');
    ring(o, [h[0] - 0.03, h[1], h[2]], 0.11, 1.5, 4.78, 7, 'glow', 0.034, '(');
    M['mstaff'] = { kind: 'staff', two: true, pivot: S(0.44, -0.8, 0.6), head: h, pts: o };
  }
  // bare hands: an open hand of a few large glyphs, fingers up
  {
    const o: Pt[] = [],
      c = S(0.62, -0.92, 0.55);
    for (const [x, y] of [
      [-0.035, 0],
      [0.02, 0],
      [0.065, -0.006],
      [-0.015, -0.05],
      [0.04, -0.05],
    ] as const)
      o.push([c[0] + x, c[1] + y, c[2], '@', 'hand', 0.04 * K]);
    for (let i = 0; i < 4; i++)
      stroke(
        o,
        [c[0] - 0.05 + i * 0.04, c[1] + 0.06, c[2]],
        [c[0] - 0.07 + i * 0.05, c[1] + 0.19 - Math.abs(i - 1.5) * 0.025, c[2] + 0.012],
        'knuckle',
        0.028,
        '|',
      );
    stroke(o, [c[0] - 0.07, c[1] - 0.008, c[2]], [c[0] - 0.15, c[1] + 0.065, c[2] + 0.01], 'knuckle', 0.028);
    stroke(o, [c[0] + 0.02, c[1] - 0.05, c[2] - 0.01], [c[0] + 0.09, c[1] - 0.42, c[2] - 0.12], 'arm', 0.05, '%', 1.1);
    M['bare'] = { kind: 'bare', pivot: c, pts: o };
  }
  return M;
})();
/** 部位ごとの色 */
export const VM_PART: Record<string, Color> = {
  fill: [0.46, 0.48, 0.56],
  edge: [0.86, 0.89, 0.96],
  metal: [0.7, 0.72, 0.8],
  wood: [0.42, 0.3, 0.19],
  woodedge: [0.66, 0.49, 0.32],
  hand: [0.5, 0.35, 0.25],
  knuckle: [0.66, 0.48, 0.34],
  arm: [0.3, 0.22, 0.18],
  head: [0.95, 0.9, 0.75],
  glow: [1, 0.95, 0.82],
  string: [0.7, 0.66, 0.58],
};
/** 部位ごとの明るさ */
export const VM_BRIGHT: Record<string, number> = {
  fill: 0.8,
  edge: 1.1,
  metal: 0.95,
  wood: 0.78,
  woodedge: 1.0,
  hand: 0.75,
  knuckle: 0.9,
  arm: 0.45,
  head: 1.25,
  glow: 1.3,
  string: 0.6,
};
// at rest the weapons in hand are dimmed, so they do not outshine the creatures in front: the bright parts (a staff's head and glow, a blade's edge) to VM_REST_HOT,
// the rest to VM_REST. Chanting, holding a full chant, a swing and the kick of a shot bring them back up to full
export const VM_REST = 0.75,
  VM_REST_HOT = 0.65;
/** 性質の色に染める割合（部位ごと） */
export const VM_TINT: Record<string, number> = { edge: 0.7, head: 0.85, glow: 0.85, fill: 0.25 };
// a fist built on demand (the hand that draws the bowstring)
/** 弦を引く手の、握った形（o に足す） */
export function VM_FIST(o: Pt[], c: V3): void {
  const K = VM_K,
    P: [number, number, string][] = [
      [-0.05, 0.024, '@'],
      [0, 0.032, '@'],
      [0.05, 0.024, '@'],
      [-0.04, -0.027, '%'],
      [0.01, -0.03, '%'],
      [0.057, -0.02, '%'],
    ];
  for (const [x, y, g] of P) o.push([c[0] + x, c[1] + y, c[2], g, g === '@' ? 'knuckle' : 'hand', 0.038 * K]);
  for (let i = 1; i <= 4; i++) o.push([c[0] + 0.03 + i * 0.02, c[1] - 0.06 - i * 0.09, c[2] - 0.01 - i * 0.025, '%', 'arm', 0.05 * K]);
}
