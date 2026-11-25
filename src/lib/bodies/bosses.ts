// 主の形（もとは src/game/07-bodies-lords.js・08-bodies-shadow.js）：不死の王・蜘蛛の女王・ナーガの女王・古竜・王の影の二つ目の姿。
// どれも、面の向きと材質で文字と明るさを決める点（put）と、文字をそのまま置く点（lit）で作る。形を作る時に mr()（見た目の乱数）を引く順番を変えないこと。
import { nth } from '../array.ts';
import { G, RUNE_CHARS } from '../glyphs.ts';
import { clamp } from '../rng.ts';
import { mpick, mr } from '../random.ts';
import { type Body, type Color, type Extra, type Ramp, type Vec3, strokeCh } from './kit.ts';

const LD = [0.42, 0.72, 0.55] as const;
/** 面の向き (nx, ny, nz) から、光の当たり方（0 から 1） */
const shade = (nx: number, ny: number, nz: number): number => {
  const l = Math.hypot(nx, ny, nz) || 1,
    d = (nx * LD[0] + ny * LD[1] + nz * LD[2]) / l;
  return clamp(0.2 + 0.8 * Math.max(0, d), 0, 1);
};
/** 明るさの並び R から、光の当たり方 i に合う文字 */
const rampCh = (R: Ramp, i: number): string => nth(R, Math.min(R.length - 1, Math.floor(i * R.length)));
/** 文字をそのまま置く点を足す関数（part を省くと dflt） */
type Lit = (x: number, y: number, z: number, ch: string, s: number, b: number, col: Color, part?: string, extra?: Extra) => void;
const litter =
  (pts: Body, dflt: string): Lit =>
  (x, y, z, ch, s, b, col, part, extra) => {
    pts.push(Object.assign({ x, y, z, g: G(ch), s, b, part: part || dflt, ph: mr() * 6.28, piv: 0, pz: 0, col }, extra || {}));
  };
/** a から b への線（向きに合う文字を並べる） */
type Stroke = (a: Vec3, b: Vec3, col: Color, bri: number, s: number, part: string, step?: number, extra?: Extra) => void;
const stroker =
  (lit: Lit, S: number, dstep: number): Stroke =>
  (a, b, col, bri, s, part, step, extra) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      dz = b[2] - a[2],
      L = Math.hypot(dx, dy, dz),
      n = Math.max(1, Math.round(L / (step || dstep))),
      ch = strokeCh(dx, dy);
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      lit(a[0] + dx * f, a[1] + dy * f, a[2] + dz * f, ch, s || S, bri, col, part, extra);
    }
  };
/** 点の列 path の i 番目 */
const pathPt = (path: readonly Vec3[], i: number): Vec3 => nth(path, i);

// ---------------------------------------------------------------- the Undead King (rebuilt): a floating upper body joined to its mantle only by the spine, one huge spiked shoulder and armoured arm,
// one long bone arm holding a cold flame, a crown of tall light needles, a greatsword planted in the floor with chains and rune pendants.
// Surfaces are filled densely; each glyph is chosen by how its surface faces the light (ASCII-art shading), by material.
export function lichKingForm(): Body {
  // readable glyphs: about 0.17 body units each (0.29 m at the king's size), spaced 1.2-1.5 glyphs apart; lines are drawn as one stroke of glyphs that follow their direction
  const pts: Body = [],
    S = 0.17,
    GAP = 0.145;
  const RAMP = {
    cloth: ['.', ':', '|', '|', '#'],
    red: ['.', ':', '|', '|', '#'],
    metal: ['.', ':', '=', '#', '@'],
    bone: ['.', 'o', 'o', '0', '@'],
    gold: ['-', '=', '=', '#', '@'],
  } as const;
  type Mat = keyof typeof RAMP;
  const COL: Record<Mat | 'blade' | 'ice' | 'chain', Color> = {
    cloth: [0.3, 0.27, 0.4],
    red: [0.72, 0.14, 0.16],
    metal: [0.44, 0.44, 0.5],
    bone: [0.9, 0.86, 0.74],
    gold: [1.0, 0.78, 0.34],
    blade: [0.8, 0.82, 0.88],
    ice: [0.6, 0.86, 1.0],
    chain: [0.75, 0.72, 0.66],
  };
  const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number, mat: Mat, part?: string, s?: number) => {
    const i = shade(nx, ny, nz);
    pts.push({
      x,
      y,
      z,
      g: G(rampCh(RAMP[mat], i)),
      s: s || S,
      b: 0.45 + (mat === 'gold' ? 1.2 : 0.95) * i,
      part: part || 'body',
      ph: mr() * 6.28,
      piv: 0,
      pz: 0,
      col: COL[mat],
    });
  };
  const lit = litter(pts, 'body');
  // a stroke: glyphs following the line's direction as seen from the front (| / \ -)
  const stroke = stroker(lit, S, 0.15);
  const shell = (
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    mat: Mat,
    part: string,
    keep?: (nx: number, ny: number, nz: number) => boolean,
  ) => {
    for (let v = 0.2; v <= Math.PI - 0.2; v += GAP / Math.max(rx, ry, rz)) {
      const sv = Math.sin(v),
        cv = Math.cos(v),
        n = Math.max(5, Math.round((2 * Math.PI * Math.max(rx, rz) * sv) / GAP));
      for (let k = 0; k < n; k++) {
        const u = (k / n) * Math.PI * 2 + v,
          nx = Math.cos(u) * sv,
          ny = cv,
          nz = Math.sin(u) * sv;
        if (keep && !keep(nx, ny, nz)) continue;
        put(cx + nx * rx, cy + ny * ry, cz + nz * rz, nx / rx, ny / ry, nz / rz, mat, part);
      }
    }
  };
  const ring = (cx: number, cy: number, cz: number, rx: number, rz: number, n: number, mat: Mat, part: string, s?: number) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      put(cx + Math.cos(a) * rx, cy, cz + Math.sin(a) * rz, Math.cos(a), 0.2, Math.sin(a), mat, part, s);
    }
  };
  // 1. the mantle column: fold lines of | from the waist to the torn hem, a crimson slit at the front
  for (let y = 0.05; y < 1.12; y += 0.115) {
    const f = y / 1.12,
      r = 0.78 - 0.4 * f,
      n = Math.round((2 * Math.PI * r) / 0.14);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + ((y * 3) % 0.3),
        nx = Math.cos(a),
        nz = Math.sin(a),
        front = Math.abs(Math.atan2(nx, nz)) < 0.4;
      if (f < 0.2 && mr() < 0.3) continue;
      put(nx * r, y, nz * r * 0.92, nx, 0.25, nz, front ? 'red' : 'cloth', 'robe');
    }
  }
  // 2. the spine
  for (let y = 1.14; y < 1.5; y += 0.1) lit(0, y, -0.02, 'o', 0.13, 1.1, COL.bone, 'body');
  // 3. the floating chest, gold at the waist and the collar
  shell(0, 1.76, 0, 0.4, 0.3, 0.25, 'metal', 'body', (_nx, ny) => ny > -0.85);
  ring(0, 1.5, 0, 0.34, 0.22, 18, 'gold', 'body');
  ring(0, 2.02, 0, 0.24, 0.18, 13, 'gold', 'body');
  // 4. the skull, with large cold eyes and teeth
  shell(0, 2.2, 0.02, 0.15, 0.17, 0.15, 'bone', 'head');
  lit(0.06, 2.22, 0.16, '*', 0.16, 4.0, COL.ice, 'head');
  lit(-0.06, 2.22, 0.16, '*', 0.16, 4.0, COL.ice, 'head');
  lit(0, 2.1, 0.16, '=', 0.13, 1.2, COL.bone, 'head');
  // 5. the crown: a gold band, tall needles of light
  ring(0, 2.36, 0, 0.16, 0.15, 9, 'gold', 'head', 0.14);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2,
      h = 0.32 + 0.3 * Math.abs(Math.sin(k * 1.7)),
      lean = 0.12,
      base: Vec3 = [Math.cos(a) * 0.16, 2.42, Math.sin(a) * 0.15],
      tip: Vec3 = [Math.cos(a) * (0.16 + lean), 2.42 + h, Math.sin(a) * (0.15 + lean)];
    stroke(base, tip, COL.gold, 2.0, 0.13, 'head', 0.13);
    lit(tip[0], tip[1] + 0.06, tip[2], '^', 0.18, 3.6, COL.ice, 'head');
  }
  // 6. the huge shoulder (right), its rim and spikes
  shell(0.56, 1.98, 0, 0.3, 0.24, 0.28, 'metal', 'body', (_nx, ny) => ny > -0.2);
  ring(0.56, 1.93, 0, 0.3, 0.28, 16, 'gold', 'body');
  for (let k = 0; k < 6; k++) {
    const a = -0.3 + k * 0.55,
      d: Vec3 = [Math.cos(a) * 0.6, 0.8, Math.sin(a) * 0.4],
      b0: Vec3 = [0.56 + d[0] * 0.22, 1.98 + d[1] * 0.14, d[2] * 0.22],
      b1: Vec3 = [0.56 + d[0] * 0.56, 1.98 + d[1] * 0.48, d[2] * 0.56];
    stroke(b0, b1, COL.gold, 1.8, 0.13, 'body', 0.13);
    lit(b1[0], b1[1] + 0.05, b1[2], '^', 0.15, 2.6, COL.gold, 'body');
  }
  // 7. the armoured arm (right): plates, gold joints, elbow spikes, a gauntlet on the sword's grip
  const sh: Vec3 = [0.66, 1.8, 0.02],
    el: Vec3 = [0.82, 1.36, 0.1],
    wr: Vec3 = [0.86, 1.02, 0.22];
  const bones: readonly (readonly [Vec3, Vec3])[] = [
    [sh, el],
    [el, wr],
  ];
  for (const [a, b] of bones) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    for (let t = 0; t <= L; t += 0.13)
      for (let k = 0; k < 6; k++) {
        const an = (k / 6) * Math.PI * 2 + t * 2,
          f = t / L;
        put(
          a[0] + (b[0] - a[0]) * f + Math.cos(an) * 0.12,
          a[1] + (b[1] - a[1]) * f,
          a[2] + (b[2] - a[2]) * f + Math.sin(an) * 0.12,
          Math.cos(an),
          0,
          Math.sin(an),
          'metal',
          'body',
        );
      }
  }
  for (const j of [el, wr]) ring(j[0], j[1], j[2], 0.14, 0.14, 6, 'gold', 'body', 0.13);
  stroke([el[0] + 0.08, el[1], el[2] - 0.04], [el[0] + 0.3, el[1] + 0.05, el[2] - 0.16], COL.gold, 1.8, 0.13, 'body', 0.12);
  // 8. the bone arm (left), long, its claws holding a cold flame
  const lsh: Vec3 = [-0.4, 1.86, 0],
    lel: Vec3 = [-0.7, 1.38, 0.12],
    lwr: Vec3 = [-0.62, 0.98, 0.42];
  stroke(lsh, lel, COL.bone, 1.3, 0.14, 'body', 0.12);
  stroke(lel, lwr, COL.bone, 1.3, 0.14, 'body', 0.12);
  lit(lel[0], lel[1], lel[2], 'o', 0.14, 1.4, COL.bone, 'body');
  for (let f = 0; f < 3; f++)
    stroke(
      [lwr[0] + (f - 1) * 0.06, lwr[1] + 0.04, lwr[2] + 0.04],
      [lwr[0] + (f - 1) * 0.08, lwr[1] + 0.14, lwr[2] + 0.2],
      COL.bone,
      1.3,
      0.11,
      'body',
      0.08,
    );
  for (let k = 0; k < 5; k++)
    lit(0, lwr[1] + 0.32 + k * 0.03, 0, k ? "'" : '*', k ? 0.12 : 0.22, k ? 2.6 : 4.2, COL.ice, 'spin', {
      cx: lwr[0],
      cz: lwr[2] + 0.12,
      r: 0.03 + 0.03 * (k % 3),
      sp: 2.4 + k * 0.4,
      ph: k * 1.2,
    });
  // 9. the greatsword, planted; chains with rune pendants from the guard
  const sx = 1.12,
    sz = 0.32;
  for (const o of [-0.06, 0.06]) stroke([sx + o, 0.08, sz], [sx + o, 2.0, sz], COL.blade, 1.5, 0.15, 'body', 0.15);
  stroke([sx, 0.02, sz], [sx, 1.95, sz], COL.gold, 1.2, 0.1, 'body', 0.3);
  stroke([sx - 0.32, 2.04, sz], [sx + 0.32, 2.04, sz], COL.gold, 2.0, 0.15, 'body', 0.12);
  lit(sx - 0.38, 2.08, sz, '<', 0.14, 2.2, COL.gold, 'body');
  lit(sx + 0.38, 2.08, sz, '>', 0.14, 2.2, COL.gold, 'body');
  stroke([sx, 2.1, sz], [sx, 2.38, sz], COL.metal, 1.2, 0.14, 'body', 0.12);
  lit(sx, 2.46, sz, '@', 0.2, 2.6, COL.gold, 'body');
  for (const side of [-1, 1]) {
    const ax = sx + side * 0.24;
    for (let t = 0; t <= 1; t += 0.14) {
      lit(ax + side * 0.12 * t, 2.0 - 0.75 * t, sz + 0.04, (t * 7) % 2 < 1 ? 'o' : '.', 0.11, 1.3, COL.chain, 'body');
    }
    lit(ax + side * 0.12, 1.18, sz + 0.04, nth(RUNE_CHARS, side > 0 ? 0 : 6), 0.2, 3.0, COL.ice, 'body');
  }
  return pts;
}

// ---------------------------------------------------------------- the Spider Queen: held high on eight arched legs, a lantern abdomen glowing amber through its plates, a cluster of eyes,
// a crown spun of silver thread, threads up to the dark with prey cocoons hanging; readable glyphs (0.12 body units = about 0.29 m at her size)
export function spiderQueenForm(): Body {
  const pts: Body = [],
    S = 0.12,
    GAP = 0.1;
  const RAMP = { chitin: ['.', ':', 'o', '%', '@'], cocoon: ['.', ':', '0', '0', '@'] } as const;
  type Mat = keyof typeof RAMP;
  const COL: Record<Mat | 'silver' | 'amber' | 'eye', Color> = {
    chitin: [0.74, 0.64, 0.92],
    silver: [0.86, 0.88, 0.96],
    amber: [1.0, 0.68, 0.28],
    eye: [1.0, 0.55, 0.85],
    cocoon: [0.88, 0.86, 0.8],
  };
  const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number, mat: Mat, part?: string, s?: number, extra?: Extra) => {
    const i = shade(nx, ny, nz);
    pts.push(
      Object.assign(
        {
          x,
          y,
          z,
          g: G(rampCh(RAMP[mat], i)),
          s: s || S,
          b: 0.45 + 0.95 * i,
          part: part || 'body',
          ph: mr() * 6.28,
          piv: 0,
          pz: 0,
          col: COL[mat],
        },
        extra || {},
      ),
    );
  };
  const lit = litter(pts, 'body');
  const stroke = stroker(lit, S, 0.1);
  const shell = (
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    mat: Mat,
    part: string,
    glow?: (nx: number, ny: number, nz: number) => boolean,
  ) => {
    for (let v = 0.2; v <= Math.PI - 0.15; v += GAP / Math.max(rx, ry, rz)) {
      const sv = Math.sin(v),
        cv = Math.cos(v),
        n = Math.max(5, Math.round((2 * Math.PI * Math.max(rx, rz) * sv) / GAP));
      for (let k = 0; k < n; k++) {
        const u = (k / n) * Math.PI * 2 + v,
          nx = Math.cos(u) * sv,
          ny = cv,
          nz = Math.sin(u) * sv,
          x = cx + nx * rx,
          y = cy + ny * ry,
          z = cz + nz * rz;
        if (glow && glow(nx, ny, nz)) lit(x, y, z, mpick(['*', '+', "'"]), S * 0.9, 2.6 + mr(), COL.amber, part);
        else put(x, y, z, nx / rx, ny / ry, nz / rz, mat, part);
      }
    }
  };
  // the eight legs: hip, a high knee, a far foot; each swings from its hip
  for (const sx of [1, -1])
    for (let k = 0; k < 4; k++) {
      const hz = 0.32 - k * 0.16,
        part = (k % 2 === 0) === sx > 0 ? 'legL' : 'legR',
        ex = { piv: 1.12, pz: hz };
      const hip: Vec3 = [sx * 0.14, 1.12, hz],
        knee: Vec3 = [sx * (0.5 + k * 0.04), 1.62 - k * 0.05, hz + (1.5 - k) * 0.14],
        foot: Vec3 = [sx * (0.95 + k * 0.05), 0.02, hz + (1.5 - k) * 0.42];
      const segs: readonly (readonly [Vec3, Vec3, number, number])[] = [
        [hip, knee, 0.06, 0.045],
        [knee, foot, 0.045, 0.022],
      ];
      for (const [a, b, w0, w1] of segs) {
        for (const o of [-1, 0, 1]) {
          const off = (f: number) => o * (w0 + (w1 - w0) * f);
          const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.1));
          for (let q = 0; q <= n; q++) {
            const f = q / n;
            lit(
              a[0] + (b[0] - a[0]) * f + off(f) * sx * 0.4,
              a[1] + (b[1] - a[1]) * f + off(f),
              a[2] + (b[2] - a[2]) * f,
              strokeCh(b[0] - a[0], b[1] - a[1]),
              S * (o ? 0.85 : 1),
              o ? 0.8 : 1.15,
              COL.chitin,
              part,
              ex,
            );
          }
        }
        for (let q = 1; q < 5; q++) {
          const f = q / 5;
          lit(
            a[0] + (b[0] - a[0]) * f + sx * 0.07,
            a[1] + (b[1] - a[1]) * f + 0.04,
            a[2] + (b[2] - a[2]) * f,
            mpick([',', '"']),
            S * 0.7,
            0.7,
            [0.55, 0.48, 0.62],
            part,
            ex,
          );
        }
      }
      lit(knee[0], knee[1], knee[2], 'o', S * 1.5, 1.6, COL.chitin, part, ex);
      lit(foot[0], foot[1] + 0.03, foot[2], '^', S, 1.2, COL.chitin, part, ex);
    }
  // head-chest and the eye cluster
  shell(0, 1.14, 0.2, 0.2, 0.13, 0.22, 'chitin', 'body');
  shell(0, 1.2, 0.46, 0.1, 0.09, 0.1, 'chitin', 'head');
  for (let e = 0; e < 24; e++) {
    const row = Math.floor(e / 6),
      k = e % 6,
      a = (k / 5 - 0.5) * 1.5,
      b = 0.5 - row * 0.28;
    lit(
      Math.sin(a) * 0.1 * Math.cos(b),
      1.2 + Math.sin(b) * 0.09,
      0.46 + Math.cos(a) * 0.1 * Math.cos(b),
      '*',
      S * (row < 2 ? 0.9 : 0.65),
      row < 2 ? 3.6 : 2.6,
      COL.eye,
      'head',
    );
  }
  for (let k = 0; k < 7; k++) lit((mr() - 0.5) * 0.3, 1.27, 0.1 + mr() * 0.25, '.', S * 0.8, 2.4, COL.eye, 'body');
  for (let k = 0; k < 14; k++)
    lit((mr() - 0.5) * 0.36, 1.2 + mr() * 0.05, (mr() - 0.2) * 0.4, mpick([',', '"']), S * 0.7, 0.7, [0.55, 0.48, 0.62], 'body');
  // fangs: thick curved chelicerae, and the palps beside them
  for (const sx of [1, -1]) {
    const p0: Vec3 = [sx * 0.05, 1.14, 0.55],
      p1: Vec3 = [sx * 0.08, 0.98, 0.66],
      p2: Vec3 = [sx * 0.03, 0.86, 0.62];
    for (const o of [-0.02, 0.02]) {
      stroke([p0[0] + o, p0[1], p0[2]], [p1[0] + o, p1[1], p1[2]], [0.5, 0.42, 0.55], 1.3, S, 'head', 0.06);
      stroke([p1[0] + o, p1[1], p1[2]], [p2[0] + o, p2[1], p2[2]], [0.85, 0.82, 0.78], 1.6, S * 0.9, 'head', 0.06);
    }
    lit(p2[0], p2[1] - 0.03, p2[2], "'", S * 0.9, 2.4, [0.55, 1.0, 0.5], 'head');
    const q0: Vec3 = [sx * 0.11, 1.12, 0.5],
      q1: Vec3 = [sx * 0.2, 1.0, 0.66],
      q2: Vec3 = [sx * 0.16, 0.9, 0.76];
    stroke(q0, q1, COL.chitin, 1.1, S * 0.85, 'head', 0.07);
    stroke(q1, q2, COL.chitin, 1.1, S * 0.85, 'head', 0.07);
    lit(q1[0], q1[1], q1[2], 'o', S, 1.4, COL.chitin, 'head');
  }
  // a crown spun of thread
  for (let k = 0; k < 7; k++) {
    const a = (k / 6 - 0.5) * 1.6;
    stroke(
      [Math.sin(a) * 0.08, 1.28, 0.46 + Math.cos(a) * 0.03],
      [Math.sin(a) * 0.16, 1.55 + 0.06 * Math.cos(a * 2), 0.42],
      COL.silver,
      1.9,
      S * 0.85,
      'head',
      0.07,
    );
    lit(Math.sin(a) * 0.16, 1.6, 0.42, "'", S, 3, COL.silver, 'head');
  }
  // the lantern abdomen: plates of chitin, amber light through the cracks, a core inside
  shell(
    0,
    1.26,
    -0.6,
    0.42,
    0.38,
    0.52,
    'chitin',
    'body',
    (nx, ny, nz) => Math.sin(nx * 9 + nz * 7) > 0.72 || (Math.abs(ny) < 0.12 && Math.sin(nz * 20) > 0),
  );
  for (let k = 0; k < 6; k++)
    lit((mr() - 0.5) * 0.26, 1.26 + (mr() - 0.5) * 0.26, -0.6 + (mr() - 0.5) * 0.32, '*', S * 1.6, 3.4, COL.amber, 'body');
  // threads up into the dark, prey cocoons hanging from them; the spinnerets' line to the floor
  const threads: readonly (readonly [number, number])[] = [
    [0.18, -0.6],
    [-0.2, -0.4],
    [0.05, -0.8],
    [-0.1, -0.2],
  ];
  for (const [x, z] of threads) stroke([x, 1.46, z], [x * 2.6, 3.0, z * 1.6], COL.silver, 1.0, S * 0.75, 'body', 0.12);
  const cocoons: readonly Vec3[] = [
    [0.62, 2.1, -0.9],
    [-0.66, 2.35, -0.5],
    [0.3, 1.95, 0.6],
  ];
  for (const [x, y, z] of cocoons) {
    stroke([x, 2.9, z], [x, y + 0.2, z], COL.silver, 0.9, S * 0.7, 'body', 0.12);
    for (let k = 0; k < 6; k++)
      put(x + (mr() - 0.5) * 0.08, y - k * 0.06 + 0.12, z + (mr() - 0.5) * 0.08, mr() - 0.5, 0.3, 0.8, 'cocoon', 'body', S * 0.95);
    lit(x, y - 0.04, z + 0.03, '*', S * 0.8, 1.8, COL.amber, 'body');
  }
  stroke([0, 0.92, -1.1], [0, 0.02, -1.45], COL.silver, 1.0, S * 0.75, 'body', 0.12);
  return pts;
}

// ---------------------------------------------------------------- the Naga Queen: a coiled serpent throne, an upright body with four arms (two curved blades, a mirror, an open hand),
// a cobra hood with glowing eye patterns, a tall gold crown; jade scales and gold; readable glyphs (0.11 body units = about 0.29 m at her size)
export function nagaQueenForm(): Body {
  const pts: Body = [],
    S = 0.11;
  const RAMP = {
    jade: ['.', ':', '=', '%', '#'],
    belly: ['.', '-', '=', '=', '#'],
    skin: ['.', ':', 'o', '0', '@'],
    gold: ['-', '=', '=', '#', '@'],
  } as const;
  type Mat = keyof typeof RAMP;
  const COL: Record<Mat | 'steel' | 'teal' | 'mirror', Color> = {
    jade: [0.32, 0.8, 0.55],
    belly: [0.86, 0.86, 0.6],
    skin: [0.55, 0.82, 0.62],
    gold: [1.0, 0.8, 0.36],
    steel: [0.82, 0.86, 0.9],
    teal: [0.4, 1.0, 0.85],
    mirror: [0.75, 0.95, 1.0],
  };
  const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number, mat: Mat, part?: string, s?: number) => {
    const i = shade(nx, ny, nz);
    pts.push({
      x,
      y,
      z,
      g: G(rampCh(RAMP[mat], i)),
      s: s || S,
      b: 0.45 + (mat === 'gold' ? 1.2 : 0.95) * i,
      part: part || 'body',
      ph: mr() * 6.28,
      piv: 0,
      pz: 0,
      col: COL[mat],
    });
  };
  const lit = litter(pts, 'body');
  const stroke = stroker(lit, S, 0.09);
  // a tube along a path: scales on top, pale belly underneath
  const tube = (path: readonly Vec3[], r0: number, r1: number, part: string) => {
    for (let i = 0; i < path.length - 1; i++) {
      const a = pathPt(path, i),
        b = pathPt(path, i + 1),
        f = i / (path.length - 1),
        r = r0 + (r1 - r0) * f;
      const tx = b[0] - a[0],
        ty = b[1] - a[1],
        tz = b[2] - a[2],
        tl = Math.hypot(tx, ty, tz) || 1;
      let px = -tz / tl,
        pz = tx / tl;
      const py = 0;
      if (Math.hypot(px, pz) < 0.1) {
        px = 1;
        pz = 0;
      }
      const qx = (ty / tl) * pz - (tz / tl) * py,
        qy = (tz / tl) * px - (tx / tl) * pz,
        qz = (tx / tl) * py - (ty / tl) * px,
        n = Math.max(5, Math.round((2 * Math.PI * r) / 0.1));
      for (let k = 0; k < n; k++) {
        const an = (k / n) * Math.PI * 2 + i * 0.5,
          ox = Math.cos(an) * px + Math.sin(an) * qx,
          oy = Math.cos(an) * py + Math.sin(an) * qy,
          oz = Math.cos(an) * pz + Math.sin(an) * qz;
        put(a[0] + ox * r, a[1] + oy * r, a[2] + oz * r, ox, oy, oz, oy < -0.35 ? 'belly' : 'jade', part);
      }
    }
  };
  // 1. the coil: two turns rising from the floor, the tail running out
  const coil: Vec3[] = [];
  for (let t = 0; t <= 1; t += 0.03) {
    const a = t * Math.PI * 2 * 2.1,
      r = 0.66 - 0.4 * t;
    coil.push([Math.cos(a) * r, 0.12 + 0.4 * t, Math.sin(a) * r]);
  }
  tube(coil, 0.15, 0.17, 'body');
  const tail: Vec3[] = [];
  for (let t = 0; t <= 1; t += 0.08) {
    const a = -t * 1.6;
    tail.push([Math.cos(a) * (0.66 + 0.4 * t), 0.1 - 0.05 * t, Math.sin(a) * (0.66 + 0.4 * t)]);
  }
  tube(tail, 0.14, 0.04, 'body');
  const trunk: Vec3[] = [],
    top = pathPt(coil, coil.length - 1);
  for (let t = 0; t <= 1; t += 0.12) trunk.push([top[0] * (1 - t), 0.52 + 0.43 * t, top[2] * (1 - t) + 0.05 * t]);
  tube(trunk, 0.17, 0.15, 'body');
  // 2. the upright body: skin, a gold belt and neck ornament
  for (let y = 0.95; y < 1.36; y += 0.08) {
    const r = 0.15 + 0.05 * Math.sin(((y - 0.95) / 0.41) * Math.PI),
      n = Math.round((2 * Math.PI * r) / 0.1);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      put(Math.cos(a) * r, y, Math.sin(a) * r * 0.75 + 0.05, Math.cos(a), 0, Math.sin(a), 'skin', 'body');
    }
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    put(Math.cos(a) * 0.17, 0.97, Math.sin(a) * 0.13 + 0.05, Math.cos(a), 0, Math.sin(a), 'gold', 'body');
    put(Math.cos(a) * 0.16, 1.34, Math.sin(a) * 0.12 + 0.05, Math.cos(a), 0.4, Math.sin(a), 'gold', 'body');
  }
  // 3. the head, slit eyes, a tall crown with a gem
  for (let i = 0; i < 16; i++) {
    const y = 1 - (2 * (i + 0.5)) / 16,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996;
    put(Math.cos(a) * rr * 0.09, 1.5 + y * 0.11, 0.07 + Math.sin(a) * rr * 0.09, Math.cos(a) * rr, y, Math.sin(a) * rr, 'skin', 'head');
  }
  lit(0.035, 1.52, 0.16, '*', S * 0.8, 3.4, COL.gold, 'head');
  lit(-0.035, 1.52, 0.16, '*', S * 0.8, 3.4, COL.gold, 'head');
  for (let k = 0; k < 5; k++) {
    const a = (k / 4 - 0.5) * 1.4;
    // 真ん中（k が 2）だけ高い：もとの 0.08*(k===2) と同じ値
    stroke(
      [Math.sin(a) * 0.09, 1.6, 0.07 + Math.cos(a) * 0.05],
      [Math.sin(a) * 0.06, 1.78 + 0.08 * (k === 2 ? 1 : 0), 0.06],
      COL.gold,
      2.0,
      S * 0.9,
      'head',
      0.06,
    );
  }
  lit(0, 1.92, 0.06, '*', S * 1.4, 3.6, COL.teal, 'head');
  // 4. the hood: a broad fan behind the neck with glowing eye patterns
  for (let y = 1.22; y < 1.78; y += 0.07) {
    const f = (y - 1.22) / 0.56,
      w = 0.12 + 0.34 * Math.sin(Math.PI * Math.min(1, f * 1.15));
    const n = Math.round((w * 2) / 0.075);
    for (let k = 0; k <= n; k++) {
      const x = -w + k * ((2 * w) / n),
        z = -0.06 - 0.1 * (x / w) * (x / w);
      put(x, y, z, x * 0.8, 0.2, 0.6, 'jade', 'head');
    }
  }
  const eyes: readonly (readonly [number, number])[] = [
    [0.24, 1.52],
    [-0.24, 1.52],
    [0.3, 1.38],
    [-0.3, 1.38],
    [0.17, 1.65],
    [-0.17, 1.65],
  ];
  for (const [x, y] of eyes) {
    lit(x, y, -0.02, 'O', S * 1.2, 3.0, COL.teal, 'head');
    lit(x, y, -0.01, '.', S * 0.6, 3.6, [1, 1, 1], 'head');
  }
  // 5. four arms: two curved blades, a mirror, an open hand
  const arm = (a: Vec3, b: Vec3, c: Vec3) => {
    stroke(a, b, COL.skin, 1.2, S, 'body', 0.08);
    stroke(b, c, COL.skin, 1.2, S, 'body', 0.08);
    lit(b[0], b[1], b[2], 'o', S, 1.4, COL.skin, 'body');
    lit(c[0], c[1], c[2], 'o', S * 1.1, 2.0, COL.gold, 'body');
  };
  arm([0.2, 1.33, 0.05], [0.42, 1.5, 0.12], [0.5, 1.74, 0.16]);
  for (let t = 0; t <= 1; t += 0.08) {
    const a = t * 1.6;
    lit(0.5 + Math.sin(a) * 0.18, 1.78 + t * 0.5, 0.16 + (1 - Math.cos(a)) * 0.08, t < 0.5 ? '|' : '/', S, 2.0, COL.steel, 'body');
  }
  arm([-0.2, 1.33, 0.05], [-0.45, 1.26, 0.15], [-0.64, 1.3, 0.32]);
  for (let t = 0; t <= 1; t += 0.08) {
    const a = t * 1.6;
    lit(-0.64 - Math.sin(a) * 0.12, 1.3 + Math.sin(a) * 0.18, 0.32 + t * 0.42, t < 0.6 ? '-' : '\\', S, 2.0, COL.steel, 'body');
  }
  arm([0.18, 1.2, 0.06], [0.34, 1.05, 0.2], [0.38, 1.0, 0.36]);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    lit(0.38 + Math.cos(a) * 0.12, 1.08 + Math.sin(a) * 0.12, 0.42, '=', S * 0.9, 1.8, COL.gold, 'body');
  }
  lit(0.38, 1.08, 0.43, '*', S * 1.3, 3.0, COL.mirror, 'body');
  arm([-0.18, 1.2, 0.06], [-0.3, 1.1, 0.3], [-0.28, 1.06, 0.55]);
  for (let f = 0; f < 4; f++) lit(-0.28 + (f - 1.5) * 0.03, 1.06, 0.62, "'", S * 0.8, 1.3, COL.skin, 'body');
  return pts;
}

// ---------------------------------------------------------------- the Old Dragon: asleep on its hoard, a low mound of a body, a long arched neck with a horned head on the floor,
// wings folded like torn sails, a spine of jagged plates grown over with moss and crystal, scars, embers between the teeth; readable glyphs (0.08 body units = about 0.29 m at its size)
export function oldDragonForm(): Body {
  const pts: Body = [],
    S = 0.08;
  const RAMP = { scale: ['.', ':', '=', '%', '#'], wing: ['.', ':', '%', '%', '#'] } as const;
  type Mat = keyof typeof RAMP;
  const COL: Record<Mat | 'plate' | 'moss' | 'crystal' | 'horn' | 'scar' | 'ember', Color> = {
    scale: [0.78, 0.38, 0.24],
    plate: [0.62, 0.5, 0.42],
    moss: [0.45, 0.8, 0.35],
    crystal: [0.55, 0.95, 1.0],
    horn: [0.86, 0.8, 0.66],
    wing: [0.55, 0.24, 0.2],
    scar: [0.95, 0.3, 0.22],
    ember: [1.0, 0.55, 0.18],
  };
  const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number, mat: Mat, part?: string, s?: number) => {
    const i = shade(nx, ny, nz);
    pts.push({
      x,
      y,
      z,
      g: G(rampCh(RAMP[mat], i)),
      s: s || S,
      b: 0.45 + 0.95 * i,
      part: part || 'body',
      ph: mr() * 6.28,
      piv: 0,
      pz: 0,
      col: COL[mat],
    });
  };
  const lit = litter(pts, 'body');
  const stroke = stroker(lit, S, 0.07);
  const tube = (path: readonly Vec3[], r0: number, r1: number, mat: Mat, part: string, step?: number) => {
    for (let i = 0; i < path.length - 1; i++) {
      const a = pathPt(path, i),
        b = pathPt(path, i + 1),
        f = i / (path.length - 1),
        r = r0 + (r1 - r0) * f;
      const tx = b[0] - a[0],
        ty = b[1] - a[1],
        tz = b[2] - a[2],
        tl = Math.hypot(tx, ty, tz) || 1;
      let px = -tz / tl,
        pz = tx / tl;
      const py = 0;
      if (Math.hypot(px, pz) < 0.1) {
        px = 1;
        pz = 0;
      }
      const qx = (ty / tl) * pz - (tz / tl) * py,
        qy = (tz / tl) * px - (tx / tl) * pz,
        qz = (tx / tl) * py - (ty / tl) * px,
        n = Math.max(5, Math.round((2 * Math.PI * r) / (step || 0.1)));
      if (i % 2 && r < 0.12) continue;
      for (let k = 0; k < n; k++) {
        const an = (k / n) * Math.PI * 2 + i * 0.5,
          ox = Math.cos(an) * px + Math.sin(an) * qx,
          oy = Math.cos(an) * py + Math.sin(an) * qy,
          oz = Math.cos(an) * pz + Math.sin(an) * qz;
        if (a[1] + oy * r < 0.02) continue;
        put(a[0] + ox * r, a[1] + oy * r, a[2] + oz * r, ox, oy, oz, mat, part);
      }
    }
  };
  const curve = (p0: Vec3, p1: Vec3, p2: Vec3, n: number): Vec3[] => {
    const out: Vec3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        a = (1 - t) * (1 - t),
        b = 2 * (1 - t) * t,
        c = t * t;
      out.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1], a * p0[2] + b * p1[2] + c * p2[2]]);
    }
    return out;
  };
  // 1. the mound of the body
  for (let v = 0.15; v <= Math.PI * 0.62; v += 0.1 / 0.55) {
    const sv = Math.sin(v),
      cv = Math.cos(v),
      n = Math.max(6, Math.round((2 * Math.PI * 0.8 * sv) / 0.1));
    for (let k = 0; k < n; k++) {
      const u = (k / n) * Math.PI * 2 + v,
        nx = Math.cos(u) * sv,
        ny = cv,
        nz = Math.sin(u) * sv;
      put(nx * 0.55, 0.4 + ny * 0.4, nz * 0.8, nx / 0.55, ny / 0.4, nz / 0.8, 'scale', 'body');
    }
  }
  for (let k = 0; k < 4; k++) {
    const z = -0.25 + k * 0.14;
    stroke([0.52, 0.42 + k * 0.03, z], [0.5, 0.32 + k * 0.03, z + 0.12], COL.scar, 1.8, S, 'body', 0.05);
  }
  // 2. the spine's jagged plates, moss and crystal
  for (let t = 0; t <= 1; t += 0.06) {
    const z = 0.72 - t * 1.5,
      y = 0.8 - 0.25 * t * t + 0.02 * Math.sin(t * 20),
      h = 0.1 + 0.08 * Math.abs(Math.sin(t * 9));
    stroke([0, y, z], [0, y + h, z - 0.04], COL.plate, 1.4, S, 'body', 0.05);
    lit(0, y + h + 0.03, z - 0.05, '^', S * 1.1, 1.6, COL.plate, 'body');
    if (Math.sin(t * 13) > 0.3) lit((mr() - 0.5) * 0.12, y + 0.03, z + 0.04, mpick([',', '"']), S, 1.3, COL.moss, 'body');
    if (Math.sin(t * 7 + 1) > 0.75)
      lit(0.06 * (mr() < 0.5 ? 1 : -1), y + 0.05, z, mpick(['*', '<', '>']), S * 1.2, 2.6, COL.crystal, 'body');
  }
  // 3. the neck arching forward, the head lying on the floor
  tube(curve([0, 0.62, 0.68], [0.05, 1.05, 1.05], [0.25, 0.2, 1.5], 12), 0.17, 0.12, 'scale', 'body');
  tube(curve([0.25, 0.2, 1.5], [0.3, 0.2, 1.75], [0.36, 0.12, 2.02], 6), 0.13, 0.06, 'scale', 'head');
  for (const sd of [1, -1])
    for (let k = 0; k < 2; k++) {
      const b0: Vec3 = [0.25 + sd * (0.06 + k * 0.04), 0.3, 1.58 - k * 0.06];
      stroke(b0, [0.25 + sd * (0.22 + k * 0.08), 0.58 - k * 0.12, 1.18 - k * 0.1], COL.horn, 1.5, S * 1.1, 'head', 0.05);
    }
  for (const sd of [1, -1])
    stroke([0.25 + sd * 0.09, 0.27, 1.72], [0.25 + sd * 0.11, 0.27, 1.82], [0.5, 0.3, 0.2], 1.0, S * 0.9, 'head', 0.04);
  // embers between the teeth
  for (let k = 0; k < 7; k++)
    lit(
      0.33 + (mr() - 0.5) * 0.06,
      0.12 + mr() * 0.04,
      1.88 + k * 0.02,
      mpick(['*', "'", '.']),
      S * (1 + mr() * 0.5),
      3.2 + mr(),
      COL.ember,
      'head',
    );
  for (let k = 0; k < 8; k++) lit(0.35 + (k % 2 ? 0.05 : -0.05), 0.1, 1.82 + k * 0.025, 'v', S * 0.8, 1.2, COL.horn, 'head');
  // 4. wings folded like torn sails
  for (const sd of [1, -1]) {
    const sh: Vec3 = [sd * 0.42, 0.72, 0.42],
      wr: Vec3 = [sd * 0.72, 1.3, -0.12],
      tip: Vec3 = [sd * 0.68, 0.32, -1.0];
    stroke(sh, wr, COL.horn, 1.3, S * 1.1, 'body', 0.05);
    stroke(wr, tip, COL.horn, 1.2, S, 'body', 0.06);
    for (let f = 0; f < 3; f++) {
      const e: Vec3 = [sd * (0.64 - f * 0.04), 0.3 + f * 0.04, 0.1 - f * 0.35];
      stroke(wr, e, COL.horn, 1.0, S * 0.9, 'body', 0.07);
      for (let q = 0; q < 18; q++) {
        const u = mr(),
          v = mr();
        if (mr() < 0.22) continue;
        const nxt: Vec3 = f < 2 ? [sd * (0.64 - (f + 1) * 0.04), 0.3 + (f + 1) * 0.04, 0.1 - (f + 1) * 0.35] : tip;
        const x = wr[0] + (e[0] - wr[0]) * u + (nxt[0] - e[0]) * u * v,
          y = wr[1] + (e[1] - wr[1]) * u + (nxt[1] - e[1]) * u * v,
          z = wr[2] + (e[2] - wr[2]) * u + (nxt[2] - e[2]) * u * v;
        put(x, y, z, sd, 0.2, 0, 'wing', 'body');
      }
    }
  }
  // 5. the tail curling round to the front, spiked
  const tail = curve([0, 0.3, -0.75], [-1.2, 0.1, -0.3], [-0.7, 0.06, 0.95], 18);
  tube(tail, 0.18, 0.04, 'scale', 'body');
  for (let i = 0; i < tail.length; i += 2) {
    const p = pathPt(tail, i);
    lit(p[0], p[1] + 0.18 * (1 - i / tail.length) + 0.04, p[2], '^', S, 1.4, COL.plate, 'body');
  }
  // 6. forelegs and claws beside the head
  for (const sd of [1, -1]) {
    const a: Vec3 = [sd * 0.35, 0.35, 0.55],
      b: Vec3 = [sd * 0.45, 0.1, 0.9];
    tube([a, b], 0.09, 0.07, 'scale', 'body');
    for (let c = 0; c < 3; c++)
      stroke([b[0] + (c - 1) * 0.05, 0.06, b[2] + 0.05], [b[0] + (c - 1) * 0.07, 0.02, b[2] + 0.15], COL.horn, 1.3, S * 0.9, 'body', 0.04);
  }
  return pts;
}

// ---------------------------------------------------------------- the Last King's Shadow, the second form: the seal broken. The cloak twisted into a long body, the wing bones grown into two great arms with torn membrane hanging,
// the crown's shards grown into horns, the same single eye in a hollow skull with an open jaw; the starry dark and the trapped faces of the kings inside;
// top-heavy (the chest the thickest), flared ribs, muscle bands, great back fins, a thick double coil on the floor, leaning hard forward; the heart in the chest with light running down the belly
export function shadowSerpentForm(): Body {
  const pts: Body = [],
    S = 0.08;
  const EDGE: Color = [0.88, 0.84, 1.0],
    DARK: Color = [0.26, 0.18, 0.42],
    BELLY: Color = [0.62, 0.5, 0.3],
    LIGHT: Color = [1.0, 0.86, 0.5],
    SHARD: Color = [0.92, 0.9, 1.0],
    EYE: Color = [0.75, 0.92, 1.0],
    STAR: Color = [0.7, 0.72, 1.0],
    MASK: Color = [0.72, 0.68, 0.82],
    HEART: Color = [1.0, 0.86, 0.55];
  const lit = litter(pts, 'serp');
  const stroke = stroker(lit, S, 0.1);
  // 制御点を通る曲線（Catmull-Rom）を、step ごとの点にする
  const spline = (ctrl: readonly Vec3[], step: number): Vec3[] => {
    const out: Vec3[] = [];
    for (let i = 0; i < ctrl.length - 1; i++)
      for (let t = 0; t < 1; t += step) {
        const a = pathPt(ctrl, Math.max(0, i - 1)),
          b = pathPt(ctrl, i),
          c = pathPt(ctrl, i + 1),
          d = pathPt(ctrl, Math.min(ctrl.length - 1, i + 2)),
          t2 = t * t,
          t3 = t2 * t;
        const k3 = (k: 0 | 1 | 2): number =>
          0.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3);
        out.push([k3(0), k3(1), k3(2)]);
      }
    out.push(pathPt(ctrl, ctrl.length - 1));
    return out;
  };
  // the body: a thick double coil on the floor, rising in an S, thickest at the chest, leaning hard forward
  const path = spline(
    [
      [0.7, 0.2, -0.9],
      [1.0, 0.22, 0.1],
      [0.2, 0.24, 0.75],
      [-0.7, 0.3, 0.2],
      [-0.45, 0.75, -0.45],
      [0.15, 1.35, -0.55],
      [0.35, 1.95, -0.2],
      [0.15, 2.45, 0.3],
      [0.0, 2.7, 0.85],
    ],
    0.1,
  );
  const rad = (f: number): number =>
    f < 0.45 ? 0.3 : f < 0.82 ? 0.3 + 0.24 * Math.sin((((f - 0.45) / 0.37) * Math.PI) / 2) : 0.54 - (0.3 * (f - 0.82)) / 0.18;
  for (let i = 0; i < path.length - 1; i++) {
    const a = pathPt(path, i),
      b = pathPt(path, i + 1),
      f = i / (path.length - 1),
      r = rad(f);
    if (f > 0.86) break;
    const tx = b[0] - a[0],
      ty = b[1] - a[1],
      tz = b[2] - a[2],
      tl = Math.hypot(tx, ty, tz) || 1;
    let px = -tz / tl,
      pz = tx / tl;
    const py = 0;
    if (Math.hypot(px, pz) < 0.1) {
      px = 1;
      pz = 0;
    }
    const pl = Math.hypot(px, pz);
    px /= pl;
    pz /= pl;
    const qx = (ty / tl) * pz - (tz / tl) * py,
      qy = (tz / tl) * px - (tx / tl) * pz,
      qz = (tx / tl) * py - (ty / tl) * px;
    const n = Math.max(8, Math.round((2 * Math.PI * r) / 0.15));
    for (let k = 0; k < n; k++) {
      const an = (k / n) * Math.PI * 2 + i * 0.3,
        ox = Math.cos(an) * px + Math.sin(an) * qx,
        oy = Math.cos(an) * py + Math.sin(an) * qy,
        oz = Math.cos(an) * pz + Math.sin(an) * qz;
      const x = a[0] + ox * r,
        y = a[1] + oy * r,
        z = a[2] + oz * r;
      if (y < 0.02) continue;
      const belly = Math.cos(an) < -0.55,
        rim = 1 - Math.abs(oz);
      if (belly) {
        lit(x, y, z, i % 2 ? '=' : '-', S, 0.75, BELLY, 'serp');
        if (i % 2 && f > 0.35) lit(x, y, z, '=', S * 1.05, 3.0, LIGHT, 'heart');
      } else if (rim > 0.74) lit(x, y, z, Math.abs(oy) > 0.6 ? '-' : '|', S, 1.7 + 1.2 * rim, EDGE, 'serp');
      else if (mr() < 0.6) lit(x, y, z, mpick(['%', ':', '.']), S, 0.32 + 0.25 * rim, DARK, 'serp');
      // great back fins and muscle bands
      if (!belly && Math.cos(an) > 0.95 && f > 0.15) {
        const h = (0.2 + 0.34 * Math.sin(f * Math.PI)) * (i % 2 ? 0.55 : 1);
        for (let q = 1; q <= 4; q++) {
          const bend = q * q * 0.012;
          lit(
            x + (ox * h * q) / 4,
            y + (oy * h * q) / 4 - bend,
            z + (oz * h * q) / 4 - bend * 2,
            q === 4 ? '^' : '|',
            S * (q === 4 ? 1.25 : 1.05),
            i % 2 ? 1.1 : 2.0,
            i % 2 ? [0.55, 0.5, 0.72] : EDGE,
            'serp',
          );
        }
      }
      if (f > 0.6 && f < 0.88 && i % 3 === 0 && Math.abs(Math.cos(an) - 0.3) < 0.12) lit(x, y, z, '(', S, 1.6, EDGE, 'serp');
    }
    // the starry dark inside
    if (i % 2 === 0 && f > 0.3)
      for (let q = 0; q < 1; q++) {
        const rr = r * 0.55 * Math.sqrt(mr()),
          an = mr() * 6.28;
        lit(
          a[0] + Math.cos(an) * px * rr + Math.sin(an) * qx * rr,
          a[1] + Math.sin(an) * qy * rr,
          a[2] + Math.cos(an) * pz * rr + Math.sin(an) * qz * rr,
          mr() < 0.8 ? '.' : '+',
          S * 0.8,
          1.6 + mr(),
          STAR,
          'serp',
        );
      }
  }
  // the chest: flared ribs and the heart, kept low so the face has room
  const C = pathPt(path, Math.floor(0.8 * (path.length - 1)));
  for (let r = 0; r < 4; r++) {
    const y = C[1] - 0.42 + r * 0.1;
    for (const sd of [1, -1]) {
      stroke([C[0] + sd * 0.08, y, C[2] + 0.42], [C[0] + sd * 0.42, y - 0.08, C[2] + 0.22], EDGE, 1.8, S * 0.9, 'serp', 0.07);
    }
  }
  const HC: Vec3 = [C[0], C[1] - 0.28, C[2] + 0.44];
  lit(HC[0], HC[1], HC[2], '*', S * 3, 4.2, HEART, 'heart');
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    lit(HC[0] + Math.cos(a) * 0.13, HC[1] + Math.sin(a) * 0.13, HC[2] + 0.02, '+', S, 2.6, HEART, 'heart');
  }
  // the trapped faces of the kings
  for (let k = 0; k < 5; k++) {
    const p = pathPt(path, Math.floor((0.38 + k * 0.08) * (path.length - 1))),
      sd = k % 2 ? 1 : -1;
    lit(p[0] + sd * 0.08, p[1] + 0.05, p[2] + 0.1, '(', S * 1.3, 1.1, MASK, 'serp');
    lit(p[0] + sd * 0.08 + 0.12, p[1] + 0.05, p[2] + 0.1, ')', S * 1.3, 1.1, MASK, 'serp');
    lit(p[0] + sd * 0.08 + 0.04, p[1] + 0.08, p[2] + 0.12, '.', S, 2.2, EYE, 'serp');
    lit(p[0] + sd * 0.08 + 0.08, p[1] + 0.08, p[2] + 0.12, '.', S, 2.2, EYE, 'serp');
  }
  // massive shoulders, set wide, with great spikes
  for (const sd of [1, -1]) {
    const SH: Vec3 = [C[0] + sd * 0.72, C[1] + 0.18, C[2] - 0.05];
    for (let i = 0; i < 22; i++) {
      const y = 1 - (2 * (i + 0.5)) / 22,
        rr = Math.sqrt(1 - y * y),
        a = i * 2.39996,
        nx = Math.cos(a) * rr,
        nz = Math.sin(a) * rr;
      if (y < -0.4) continue;
      const rim = Math.abs(nx);
      lit(
        SH[0] + nx * 0.26,
        SH[1] + y * 0.2,
        SH[2] + nz * 0.24,
        rim > 0.7 || y > 0.75 ? '-' : mpick(['%', ':']),
        S,
        rim > 0.7 || y > 0.75 ? 1.9 : 0.4,
        rim > 0.7 || y > 0.75 ? EDGE : DARK,
        'serp',
      );
    }
    for (let k = 0; k < 3; k++) {
      const b0: Vec3 = [SH[0] + sd * (0.05 + k * 0.08), SH[1] + 0.18, SH[2] - 0.1 + k * 0.08];
      stroke(b0, [b0[0] + sd * (0.14 + k * 0.04), b0[1] + 0.34 - k * 0.06, b0[2] - 0.12], EDGE, 2.2, S * 1.05, 'serp', 0.07);
      lit(b0[0] + sd * (0.14 + k * 0.04), b0[1] + 0.4 - k * 0.06, b0[2] - 0.12, '^', S * 1.3, 2.8, EDGE, 'serp');
    }
  }
  // four thick arms: the upper pair raised and brought forward, the lower pair with elbows out, forearms forward and slightly up, hands at chest height reaching for you
  const limb = (a: Vec3, b: Vec3, r0: number, r1: number) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      dz = b[2] - a[2],
      L = Math.hypot(dx, dy, dz),
      ux = dx / L,
      uy = dy / L,
      uz = dz / L;
    let px = -uz,
      pz = ux;
    const py = 0;
    if (Math.hypot(px, pz) < 0.1) {
      px = 1;
      pz = 0;
    }
    const pl = Math.hypot(px, pz);
    px /= pl;
    pz /= pl;
    const qx = uy * pz - uz * py,
      qy = uz * px - ux * pz,
      qz = ux * py - uy * px;
    for (let t = 0; t <= L; t += 0.13) {
      const f = t / L,
        r = r0 + (r1 - r0) * f,
        n = Math.max(6, Math.round((2 * Math.PI * r) / 0.13));
      for (let k = 0; k < n; k++) {
        const an = (k / n) * Math.PI * 2 + t * 3,
          ox = Math.cos(an) * px + Math.sin(an) * qx,
          oy = Math.cos(an) * py + Math.sin(an) * qy,
          oz = Math.cos(an) * pz + Math.sin(an) * qz,
          rim = 1 - Math.abs(oz);
        lit(
          a[0] + ux * t + ox * r,
          a[1] + uy * t + oy * r,
          a[2] + uz * t + oz * r,
          rim > 0.7 ? (Math.abs(uy) > 0.6 ? '|' : '-') : mpick(['%', ':', '=']),
          S,
          rim > 0.7 ? 1.8 : 0.5,
          rim > 0.7 ? EDGE : DARK,
          'serp',
        );
      }
    }
  };
  const hand = (w: Vec3, dir: Vec3, sd: number) => {
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39996,
        y = 1 - (2 * (i + 0.5)) / 14,
        rr = Math.sqrt(1 - y * y);
      lit(w[0] + Math.cos(a) * rr * 0.14, w[1] + y * 0.11, w[2] + Math.sin(a) * rr * 0.14, mpick(['%', '#']), S, 0.9, EDGE, 'serp');
    }
    for (let c = 0; c < 4; c++) {
      const spread = (c - 1.5) * 0.13,
        base: Vec3 = [w[0] + dir[0] * 0.1, w[1] + spread + dir[1] * 0.1, w[2] + dir[2] * 0.1];
      let prev = base;
      for (let q = 1; q <= 5; q++) {
        const f = q / 5,
          curl = f * f * 0.2,
          nxt: Vec3 = [
            base[0] + dir[0] * 0.44 * f - sd * curl * 0.6,
            base[1] + dir[1] * 0.44 * f - spread * f * 0.4 - curl * 0.3,
            base[2] + dir[2] * 0.44 * f - curl * 0.35,
          ];
        lit(
          nxt[0],
          nxt[1],
          nxt[2],
          q === 5 ? '>' : strokeCh(nxt[0] - prev[0], nxt[1] - prev[1]),
          S * (q === 5 ? 1.1 : 1.05),
          q > 3 ? 2.8 : 2.0,
          q > 3 ? [0.95, 0.9, 0.85] : EDGE,
          'claw',
          { hx: w[0], hy: w[1], hz: w[2], cf: f },
        );
        prev = nxt;
      }
    }
  };
  const armSpikes = (a: Vec3, b: Vec3, sd: number) => {
    for (let k = 1; k <= 3; k++) {
      const f = k / 4,
        p: Vec3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
      stroke([p[0] + sd * 0.08, p[1] + 0.06, p[2] - 0.04], [p[0] + sd * 0.28, p[1] + 0.16, p[2] - 0.18], EDGE, 2.1, S, 'serp', 0.06);
      lit(p[0] + sd * 0.3, p[1] + 0.18, p[2] - 0.2, '^', S * 1.1, 2.6, EDGE, 'serp');
    }
  };
  for (const sd of [1, -1]) {
    const s0: Vec3 = [C[0] + sd * 0.82, C[1] + 0.26, C[2]],
      e0: Vec3 = [C[0] + sd * 1.35, C[1] + 0.7, C[2] + 0.2],
      w0: Vec3 = [C[0] + sd * 1.0, C[1] + 1.1, C[2] + 0.72];
    limb(s0, e0, 0.15, 0.13);
    limb(e0, w0, 0.13, 0.1);
    armSpikes(e0, w0, sd);
    stroke([e0[0] + sd * 0.1, e0[1], e0[2] - 0.05], [e0[0] + sd * 0.34, e0[1] - 0.12, e0[2] - 0.2], EDGE, 2.2, S * 1.05, 'serp', 0.06);
    hand(w0, [-sd * 0.45, 0.2, 0.85], sd);
    const s1: Vec3 = [C[0] + sd * 0.7, C[1] - 0.05, C[2] + 0.1],
      e1: Vec3 = [C[0] + sd * 1.25, C[1] - 0.12, C[2] + 0.15],
      w1: Vec3 = [C[0] + sd * 0.82, C[1] + 0.12, C[2] + 1.05];
    limb(s1, e1, 0.14, 0.13);
    limb(e1, w1, 0.13, 0.1);
    armSpikes(e1, w1, sd);
    stroke([e1[0] + sd * 0.1, e1[1], e1[2] - 0.05], [e1[0] + sd * 0.34, e1[1] - 0.1, e1[2] - 0.22], EDGE, 2.2, S * 1.05, 'serp', 0.06);
    hand(w1, [-sd * 0.35, 0.05, 0.95], sd);
    for (let q = 0; q < 12; q++) {
      const u = mr();
      lit(
        s0[0] + (e0[0] - s0[0]) * u,
        s0[1] + (e0[1] - s0[1]) * u - 0.12 - mr() * 0.5,
        s0[2] + (e0[2] - s0[2]) * u - 0.08,
        mpick([':', '%', '.']),
        S,
        0.35,
        DARK,
        'serp',
      );
    }
  }
  // the head: a crowned skull-helm (the first form's crown became this helm) - riveted dark bronze plates, deep sockets with small cold points of light,
  // a heavy jaw thrust forward with uneven fangs and tusks, chains hanging from it, and two great horns rising from the helm and curving up and out
  const H: Vec3 = [C[0], C[1] + 0.36, C[2] + 0.58],
    BONE: Color = [0.88, 0.84, 0.76],
    BRZ: Color = [0.78, 0.6, 0.36],
    DBRZ: Color = [0.42, 0.32, 0.22];
  const HELM: Ramp = ['.', ':', '=', '#', '@'];
  for (let i = 0; i < 70; i++) {
    const y = 1 - (2 * (i + 0.5)) / 70,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996,
      nx = Math.cos(a) * rr,
      nz = Math.sin(a) * rr;
    if (nz < -0.2 || y < -0.45) continue;
    const ex = Math.abs(Math.abs(nx) - 0.36),
      sock = ex < 0.17 && Math.abs(y - 0.02) < 0.17 && nz > 0.5;
    if (sock) continue;
    const d = clamp(0.2 + 0.8 * Math.max(0, nx * 0.42 + y * 0.72 + nz * 0.55), 0, 1),
      ch = nth(HELM, Math.min(4, Math.floor(d * 5)));
    lit(H[0] + nx * 0.32, H[1] + 0.05 + y * 0.3, H[2] + nz * 0.28, Math.abs(nx) > 0.85 ? '|' : ch, S, 0.45 + 1.1 * d, BRZ, 'serp');
  }
  for (let k = 0; k <= 10; k++) {
    const f = k / 10 - 0.5;
    lit(H[0] + f * 0.56, H[1] + 0.18 - Math.abs(f) * 0.12, H[2] + 0.25, '=', S * 1.15, 1.9, BRZ, 'serp');
    if (k % 2 === 0) lit(H[0] + f * 0.56, H[1] + 0.22 - Math.abs(f) * 0.12, H[2] + 0.26, '.', S * 0.8, 3.0, [1, 0.9, 0.7], 'serp');
  }
  for (let k = 0; k < 5; k++)
    lit(
      H[0],
      H[1] + 0.32 - k * 0.07,
      H[2] + 0.26 + k * 0.005,
      k % 2 ? '.' : '|',
      S * (k % 2 ? 0.8 : 1),
      k % 2 ? 3 : 1.6,
      k % 2 ? [1, 0.9, 0.7] : BRZ,
      'serp',
    );
  for (const sd of [1, -1]) {
    const ex = H[0] + sd * 0.115,
      ey = H[1] + 0.02,
      ez = H[2] + 0.2;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      lit(ex + Math.cos(a) * 0.075, ey + Math.sin(a) * 0.07, ez + 0.02, mpick(['%', '#']), S * 0.9, 0.35, DARK, 'serp');
    }
    lit(ex, ey, ez - 0.04, '.', S * 1.2, 4.6, EYE, 'eye');
    lit(ex, ey, ez - 0.05, '*', S * 0.8, 3.2, EYE, 'eye');
  }
  lit(H[0] - 0.03, H[1] - 0.1, H[2] + 0.24, '/', S, 0.9, DARK, 'serp');
  lit(H[0] + 0.03, H[1] - 0.1, H[2] + 0.24, '\\', S, 0.9, DARK, 'serp');
  for (let k = 0; k <= 6; k++) {
    const f = k / 6 - 0.5;
    lit(H[0] + f * 0.3, H[1] - 0.18, H[2] + 0.25 - Math.abs(f) * 0.06, 'v', S * (0.9 + (0.3 * ((k * 7) % 3)) / 2), 2.4, BONE, 'serp');
  }
  for (let k = 0; k <= 8; k++) {
    const f = k / 8 - 0.5,
      x = H[0] + f * 0.42,
      z = H[2] + 0.34 - f * f * 0.5,
      y = H[1] - 0.4;
    lit(x, y, z, '=', S * 1.1, 1.6, BONE, 'serp');
    lit(x, y - 0.06, z - 0.02, '-', S, 1.1, BONE, 'serp');
    const big = k % 3 === 1;
    lit(x, y + 0.09 + (big ? 0.05 : 0), z + 0.01, '^', S * (big ? 1.4 : 1.0), 2.6, BONE, 'serp');
    if (big) lit(x, y + 0.2, z + 0.01, '|', S * 0.9, 2.2, BONE, 'serp');
  }
  for (const sd of [1, -1]) {
    stroke([H[0] + sd * 0.2, H[1] - 0.14, H[2] + 0.16], [H[0] + sd * 0.22, H[1] - 0.4, H[2] + 0.28], BONE, 1.4, S, 'serp', 0.07);
    let prev: Vec3 = [H[0] + sd * 0.22, H[1] - 0.38, H[2] + 0.3];
    for (let k = 1; k <= 4; k++) {
      const f = k / 4,
        nxt: Vec3 = [H[0] + sd * (0.22 + 0.07 * f), H[1] - 0.38 + 0.26 * f, H[2] + 0.3 + 0.12 * f - 0.08 * f * f];
      lit(
        nxt[0],
        nxt[1],
        nxt[2],
        k === 4 ? '^' : strokeCh(nxt[0] - prev[0], nxt[1] - prev[1]),
        S * 1.1,
        k === 4 ? 2.6 : 2.0,
        k === 4 ? BRZ : BONE,
        'serp',
      );
      prev = nxt;
    }
    for (let k = 1; k <= 6; k++)
      lit(H[0] + sd * 0.24, H[1] - 0.42 - k * 0.07, H[2] + 0.22 + Math.sin(k) * 0.02, k % 2 ? 'o' : '.', S * 0.85, 1.6, BRZ, 'serp');
    lit(H[0] + sd * 0.24, H[1] - 0.9, H[2] + 0.22, '+', S, 2.2, BRZ, 'serp');
  }
  for (const sd of [1, -1]) {
    let prev: Vec3 = [H[0] + sd * 0.24, H[1] + 0.24, H[2] + 0.02];
    for (let k = 1; k <= 10; k++) {
      const f = k / 10,
        nxt: Vec3 = [
          H[0] + sd * (0.24 + 0.26 * f + 0.06 * Math.sin(f * Math.PI)),
          H[1] + 0.24 + 0.95 * f - 0.18 * f * f,
          H[2] + 0.02 - 0.28 * f * f,
        ];
      const w = 0.075 * (1 - f * 0.85),
        tip = f > 0.8,
        col = tip ? SHARD : f < 0.35 ? BRZ : DBRZ;
      for (const o of w > 0.04 ? [-1, 0, 1] : [0]) {
        const mx = (prev[0] + nxt[0]) / 2 + o * w,
          my = (prev[1] + nxt[1]) / 2,
          mz = (prev[2] + nxt[2]) / 2;
        lit(
          mx,
          my,
          mz,
          tip ? mpick(['/', '\\', '|']) : strokeCh(nxt[0] - prev[0], nxt[1] - prev[1]),
          S * (o ? 0.95 : 1.1),
          tip ? 3.4 : o ? 1.3 : 1.9,
          col,
          'serp',
        );
      }
      if (k % 3 === 0 && !tip) lit(nxt[0], nxt[1], nxt[2] + 0.02, '-', S, 1.5, BRZ, 'serp');
      prev = nxt;
    }
    lit(prev[0], prev[1] + 0.05, prev[2], '^', S * 1.4, 4.0, SHARD, 'serp');
  }
  // the crest, set back from the top of the head down the nape, leaning back, leading into the back fin
  for (let k = 0; k < 4; k++) {
    const z = H[2] - 0.34 - k * 0.17,
      yb = H[1] + 0.1 - k * 0.1,
      h = 0.2 + k * 0.05;
    stroke([H[0], yb, z], [H[0], yb + h, z - 0.16], EDGE, 2.0, S, 'serp', 0.06);
    lit(H[0], yb + h + 0.04, z - 0.19, '^', S * 1.2, 2.6, EDGE, 'serp');
  }
  return pts;
}
