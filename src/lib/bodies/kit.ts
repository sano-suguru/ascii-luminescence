// 生き物の形を作る道具（もとは src/game/07 から 09・13 の各所）。
// 形は「文字の点（Glyph）」の配列。描画（src/game/13-creatures.js の drawMonster）が、part ごとに動かして描く。
// 形を作る時に mr()（見た目の乱数）を引く順番を変えると、同じシードでも違う見た目になるので、順番を変えないこと。
import { nth } from '../array.ts';
import { G } from '../glyphs.ts';
import { clamp } from '../rng.ts';
import { mr } from '../random.ts';

export type Vec3 = readonly [number, number, number];
export type Color = readonly [number, number, number];
/** 明るさの順に並べた文字（暗い → 明るい） */
export type Ramp = readonly string[];

/** 形の1つの点（1文字） */
export interface Glyph {
  x: number;
  y: number;
  z: number;
  /** 文字の絵の表の番号（G） */
  g: number;
  /** 大きさ */
  s: number;
  /** 明るさ */
  b: number;
  /** 体のどこか（動き方が決まる。'body'・'head'・'legL' など） */
  part: string;
  /** 揺れの位相 */
  ph: number;
  /** 回す軸の高さと奥行き（脚など） */
  piv: number;
  pz: number;
  /** 点の色（無い時と null の時は、生き物の色で描く） */
  col?: Color | null | undefined;
  // 部位ごとの動きの値（翼の向き・半径、ひびの閾値、回る物の中心と速さ、触手の番号、炎の高さ）
  sd?: number;
  r?: number;
  th?: number;
  sp?: number;
  cx?: number;
  cy?: number;
  cz?: number;
  ti?: number | undefined;
  fh?: number;
  // 爪（王の影の二つ目の姿の手）：握る先の手首の位置と、指のどこか（0 から 1）
  hx?: number;
  hy?: number;
  hz?: number;
  cf?: number;
}
/** 点に足す値（Object.assign で上書きする） */
export type Extra = Partial<
  Pick<Glyph, 'piv' | 'pz' | 'ph' | 'sd' | 'r' | 'th' | 'sp' | 'cx' | 'cy' | 'cz' | 'ti' | 'fh' | 'hx' | 'hy' | 'hz' | 'cf'>
>;
/** 形。noExtra は、描画で飾りの点を足さない印 */
export type Body = Glyph[] & { noExtra?: boolean };
/** 形を作るのに使う、生き物の種類の値（MTYPES の一部） */
export interface BodyType {
  scale: number;
  col: Color;
}

/** 点を1つ足す（大きさ s・明るさ b をそのまま） */
export function cpt(
  pts: Glyph[],
  x: number,
  y: number,
  z: number,
  ch: string,
  s: number,
  b: number,
  col: Color,
  part?: string,
  extra?: Extra,
): void {
  pts.push(Object.assign({ x, y, z, g: G(ch), s, b, part: part || 'body', ph: mr() * 6.28, piv: 0, pz: 0, col }, extra || {}));
}
/** 機械の点：面の向き（nx, ny, nz）で明るさと文字を決める */
export function mPut(
  pts: Glyph[],
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  col: Color,
  ramp: Ramp,
  s: number,
  part?: string,
  extra?: Extra,
): void {
  const LD = [0.42, 0.72, 0.55] as const,
    l = Math.hypot(nx, ny, nz) || 1,
    d = (nx * LD[0] + ny * LD[1] + nz * LD[2]) / l,
    i = clamp(0.2 + 0.8 * Math.max(0, d), 0, 1);
  pts.push(
    Object.assign(
      {
        x,
        y,
        z,
        g: G(nth(ramp, Math.min(ramp.length - 1, Math.floor(i * ramp.length)))),
        s,
        b: 0.45 + 0.95 * i,
        part: part || 'body',
        ph: mr() * 6.28,
        piv: 0,
        pz: 0,
        col,
      },
      extra || {},
    ),
  );
}
/** 機械の点：文字と明るさをそのまま */
export function mLit(
  pts: Glyph[],
  x: number,
  y: number,
  z: number,
  ch: string,
  s: number,
  b: number,
  col: Color,
  part?: string,
  extra?: Extra,
): void {
  pts.push(Object.assign({ x, y, z, g: G(ch), s, b, part: part || 'body', ph: mr() * 6.28, piv: 0, pz: 0, col }, extra || {}));
}

/** 古い形の点を足す関数（色を持たない点。大きさ s・明るさ b をそのまま） */
export type Add = (x: number, y: number, z: number, ch: string, s: number, b: number, part?: string, piv?: number, pz?: number) => void;
export function adder(pts: Glyph[]): Add {
  return (x, y, z, ch, s, b, part, piv, pz) => {
    pts.push({ x, y, z, g: G(ch), s, b, part: part || 'body', ph: mr() * 6.28, piv: piv || 0, pz: pz || 0 });
  };
}

/** 傾きに合う線の文字 */
export const strokeCh = (dx: number, dy: number): string =>
  Math.abs(dy) > Math.abs(dx) * 2 ? '|' : Math.abs(dx) > Math.abs(dy) * 2 ? '-' : dx * dy > 0 ? '/' : '\\';

type ColorAt = (nx: number, ny: number, nz: number) => Color;
/** 四つ足などの形の道具（大きさは種類の scale で決まる） */
export interface Kit2 {
  S: number;
  pts: Body;
  /** 面の向きで明るさと文字を決める点 */
  put: (x: number, y: number, z: number, nx: number, ny: number, nz: number, ramp: Ramp, col: Color, part?: string, extra?: Extra) => void;
  /** 文字と明るさをそのまま（大きさは s 倍） */
  lit: (x: number, y: number, z: number, ch: string, s: number, b: number, col: Color, part?: string, extra?: Extra) => void;
  /** a から b への線 */
  stroke: (a: Vec3, b: Vec3, col: Color, bri: number, s: number, part?: string, extra?: Extra, step?: number) => void;
  /** 楕円の体（skip が真の向きは描かない） */
  ell: (
    c: Vec3,
    rx: number,
    ry: number,
    rz: number,
    ramp: Ramp,
    colf: ColorAt,
    part?: string,
    step?: number | null,
    skip?: (nx: number, ny: number, nz: number) => boolean,
  ) => void;
}
/** Kit2 に、管と箱を足した道具 */
export interface Kit3 extends Kit2 {
  tube: (a: Vec3, b: Vec3, r0: number, r1: number, ramp: Ramp, col: Color | ColorAt, part?: string, extra?: Extra, bulge?: number) => void;
  box: (c: Vec3, w: number, h: number, d: number, ramp: Ramp, col: Color, part?: string, extra?: Extra) => void;
}

export function q2(ty: Pick<BodyType, 'scale'>): Kit2 {
  const S = Math.min(0.36, 0.2 / ty.scale),
    pts: Body = [],
    LD = [0.42, 0.72, 0.55] as const;
  const put: Kit2['put'] = (x, y, z, nx, ny, nz, ramp, col, part, extra) => {
    const l = Math.hypot(nx, ny, nz) || 1,
      d = (nx * LD[0] + ny * LD[1] + nz * LD[2]) / l,
      i = clamp(0.2 + 0.8 * Math.max(0, d), 0, 1);
    pts.push(
      Object.assign(
        {
          x,
          y,
          z,
          g: G(nth(ramp, Math.min(ramp.length - 1, Math.floor(i * ramp.length)))),
          s: S,
          b: 0.5 + 0.9 * i,
          part: part || 'body',
          ph: mr() * 6.28,
          piv: 0,
          pz: 0,
          col,
        },
        extra || {},
      ),
    );
  };
  const lit: Kit2['lit'] = (x, y, z, ch, s, b, col, part, extra) => {
    pts.push(Object.assign({ x, y, z, g: G(ch), s: s * S, b, part: part || 'body', ph: mr() * 6.28, piv: 0, pz: 0, col }, extra || {}));
  };
  const stroke: Kit2['stroke'] = (a, b, col, bri, s, part, extra, step) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      dz = b[2] - a[2],
      L = Math.hypot(dx, dy, dz),
      n = Math.max(1, Math.round(L / (step || S * 0.8))),
      ch = strokeCh(dx, dy);
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      lit(a[0] + dx * f, a[1] + dy * f, a[2] + dz * f, ch, s, bri, col, part, extra);
    }
  };
  const ell: Kit2['ell'] = (c, rx, ry, rz, ramp, colf, part, step, skip) => {
    const st = step || S * 0.85;
    for (let v = 0.25; v < Math.PI - 0.1; v += st / Math.max(rx, ry)) {
      const sv = Math.sin(v),
        cv = Math.cos(v),
        n = Math.max(5, Math.round((2 * Math.PI * Math.max(rx, rz) * sv) / st));
      for (let k = 0; k < n; k++) {
        const u = (k / n) * Math.PI * 2 + v,
          nx = Math.cos(u) * sv,
          ny = cv,
          nz = Math.sin(u) * sv;
        if (skip && skip(nx, ny, nz)) continue;
        put(c[0] + nx * rx, c[1] + ny * ry, c[2] + nz * rz, nx / rx, ny / ry, nz / rz, ramp, colf(nx, ny, nz), part);
      }
    }
  };
  return { S, pts, put, lit, stroke, ell };
}

export function q3(ty: Pick<BodyType, 'scale'>): Kit3 {
  const H = q2(ty);
  const { S, put } = H;
  const tube: Kit3['tube'] = (a, b, r0, r1, ramp, col, part, extra, bulge) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      dz = b[2] - a[2],
      L = Math.hypot(dx, dy, dz) || 1e-3,
      ux = dx / L,
      uy = dy / L,
      uz = dz / L;
    let px = -uz,
      py = 0,
      pz = ux;
    if (Math.hypot(px, pz) < 0.1) {
      px = 1;
      pz = 0;
    }
    const pl = Math.hypot(px, pz);
    px /= pl;
    pz /= pl;
    const qx = uy * pz - uz * py,
      qy = uz * px - ux * pz,
      qz = ux * py - uy * px,
      st = S * 0.85;
    for (let t = 0; t <= L + 1e-6; t += st) {
      const f = t / L,
        r = (r0 + (r1 - r0) * f) * (1 + (bulge || 0) * Math.sin(Math.PI * f)),
        n = Math.max(4, Math.round((2 * Math.PI * r) / st));
      for (let k = 0; k < n; k++) {
        const an = (k / n) * Math.PI * 2 + t * 2,
          ox = Math.cos(an) * px + Math.sin(an) * qx,
          oy = Math.cos(an) * py + Math.sin(an) * qy,
          oz = Math.cos(an) * pz + Math.sin(an) * qz;
        put(
          a[0] + ux * t + ox * r,
          a[1] + uy * t + oy * r,
          a[2] + uz * t + oz * r,
          ox,
          oy,
          oz,
          ramp,
          typeof col === 'function' ? col(ox, oy, oz) : col,
          part,
          extra,
        );
      }
    }
  };
  const box: Kit3['box'] = (c, w, h, d, ramp, col, part, extra) => {
    const st = S * 0.9;
    for (let x = -w; x <= w + 1e-6; x += st)
      for (let y = -h; y <= h + 1e-6; y += st)
        for (let z = -d; z <= d + 1e-6; z += st) {
          const onX = Math.abs(Math.abs(x) - w) < st * 0.5,
            onY = Math.abs(Math.abs(y) - h) < st * 0.5,
            onZ = Math.abs(Math.abs(z) - d) < st * 0.5;
          if (!(onX || onY || onZ)) continue;
          put(c[0] + x, c[1] + y, c[2] + z, onX ? Math.sign(x) : 0, onY ? Math.sign(y) : 0, onZ ? Math.sign(z) : 0, ramp, col, part, extra);
        }
  };
  return Object.assign(H, { tube, box });
}

// 文字の明るさの並びと、色
export const HRAMP = {
  skin: ['.', ':', 'o', '%', '#'],
  cloth: ['.', ':', '|', '/', '#'],
  fur: ['.', ',', '"', '%', '#'],
  metal: ['.', ':', '=', '#', '@'],
};
export const FUR: Ramp = ['.', ',', '"', '%', '#'],
  SCALE: Ramp = ['.', ':', '=', '%', '#'];
export const SKINR: Ramp = ['.', ':', 'o', '%', '#'],
  STONE: Ramp = ['.', ':', '=', '#', '#'],
  MUD: Ramp = ['.', ',', '~', '%', '#'];
export const BRASS: Color = [0.85, 0.68, 0.38],
  BRASS_R: Ramp = ['.', '-', '=', '#', '@'];
export const GOLD: Color = [1.0, 0.82, 0.38],
  BONE: Color = [0.85, 0.8, 0.66],
  PALE: Color = [0.75, 0.9, 1.0];
