// 主・機械・忘れられた獣の形（もとは src/game/07-bodies-lords.js・08-bodies-shadow.js・10-bodies-beast.js）。
import { nth } from '../array.ts';
import { hsl2rgb } from '../color.ts';
import { G } from '../glyphs.ts';
import type { History } from '../history.ts';
import { mulberry32 } from '../rng.ts';
import { mpick, mr } from '../random.ts';
import {
  type Body,
  type BodyType,
  type Color,
  type Extra,
  type Glyph,
  type Vec3,
  BRASS,
  BRASS_R,
  mLit,
  mPut,
  strokeCh,
  adder,
} from './kit.ts';

/** 忘れられた獣の作り（年代記の獣から決まる。src/game/10-bodies-beast.js） */
export interface BeastSpec {
  /** 体の形：四つ足・大蛇・百足・蛾 など */
  plan: string;
  kind: string;
  glyphs: readonly string[];
  legs?: number;
  wings?: boolean;
  eyes?: number;
  core?: string;
}

/** 忘れられた獣（古い形） */
export function beastForm(spec: BeastSpec): Body {
  const pts: Body = [],
    add = adder(pts);
  const B = spec.glyphs,
    fib = (n: number, r: number, cx: number, cy: number, cz: number, set: readonly string[], s: number, b: number, part: string) => {
      for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + 0.5)) / n,
          rr = Math.sqrt(1 - y * y),
          a = i * 2.39996;
        add(cx + Math.cos(a) * rr * r, cy + y * r, cz + Math.sin(a) * rr * r, mpick(set), s, b, part);
      }
    };
  let head: Vec3 = [0, 0.8, 0.7];
  if (spec.plan === 'quad') {
    for (let k = 0; k < 8; k++) {
      const z = -0.45 + k * 0.13;
      for (let j = 0; j < 7; j++) {
        const a = (j / 7) * Math.PI * 2;
        add(Math.cos(a) * 0.2, 0.55 + Math.sin(a) * 0.15, z, mpick(B), 0.14, 1.0, 'body');
      }
    }
    if (spec.kind === '竜') {
      for (let k = 0; k < 4; k++) add(0, 0.68 + k * 0.1, 0.5 + k * 0.07, mpick(B), 0.13, 1.0, 'head');
      head = [0, 1.08, 0.8];
    }
    fib(8, 0.15, head[0], head[1], head[2], B, 0.13, 1.3, 'head');
    const lz = spec.legs === 6 ? [0.38, 0, -0.38] : [0.36, -0.36];
    lz.forEach((z, k) => {
      for (const sx of [1, -1]) {
        const part = (k % 2 === 0) === sx > 0 ? 'legL' : 'legR';
        for (let q = 0; q < 4; q++) add(sx * 0.17, 0.42 - q * 0.13, z, mpick(['|', '!', '/']), 0.12, 0.9, part, 0.45, z);
      }
    });
    for (let k = 0; k < 6; k++) add(0, 0.6 - k * 0.03, -0.55 - k * 0.12, mpick(['~', '-', nth(B, 0)]), 0.12, 0.9, 'tail', k);
    if (spec.wings)
      for (const sd of [-1, 1])
        for (let k = 0; k < 7; k++)
          pts.push({
            x: 0,
            y: 0.85,
            z: 0.1,
            g: G(mpick(['^', 'v', '/', '\\', '~'])),
            s: 0.15,
            b: 1.1,
            part: 'wing',
            ph: mr() * 6.28,
            piv: 0,
            pz: 0,
            sd,
            r: 0.18 + k * 0.12,
          });
  } else if (spec.plan === 'serpent' || spec.plan === 'centipede') {
    const n = spec.plan === 'serpent' ? 18 : 14;
    for (let i = 0; i < n; i++) {
      const zc = 0.9 - i * 0.2,
        yc = 0.22 + (i < 2 ? 0.35 - i * 0.15 : 0),
        rr = 0.16 * (1 - i / (n * 1.4));
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + i * 0.4;
        add(Math.cos(a) * rr, yc + Math.sin(a) * rr, zc, mpick(B), 0.15, 1.0, 'seg', i);
      }
      if (spec.plan === 'centipede') for (const sd of [-1, 1]) add(sd * 0.3, 0.08, zc, sd < 0 ? '/' : '\\', 0.13, 0.9, 'seg', i);
    }
    head = [0, 0.62, 1.0];
  } else {
    for (let k = 0; k < 6; k++) add(0, -0.1 + k * 0.1, 0, mpick(B), 0.13, 1.1, 'body');
    head = [0, 0.55, 0.05];
    if (spec.wings)
      for (const sd of [-1, 1])
        for (const [yo, n] of [
          [0.18, 8],
          [-0.08, 6],
        ] as const)
          for (let k = 0; k < n; k++)
            pts.push({
              x: 0,
              y: yo,
              z: 0,
              g: G(mpick(['^', 'v', '~', '*', 'o'])),
              s: 0.16,
              b: 1.2,
              part: 'wing',
              ph: mr() * 6.28,
              piv: 0,
              pz: 0,
              sd,
              r: 0.14 + k * 0.11,
            });
  }
  add(head[0], head[1], head[2] + 0.05, spec.core || 'X', 0.42, 3.2, spec.plan === 'quad' || spec.plan === 'moth' ? 'core' : 'shead', 0);
  const eyes = spec.eyes || 2;
  for (let k = 0; k < eyes; k++) {
    // 目：2つまでは頭に、それより多ければ体のどこかの点の上に
    const onHead = k < 2 || !spec.eyes;
    const p = onHead
      ? { x: head[0] + (k % 2 ? 0.07 : -0.07), y: head[1] + 0.05, z: head[2] + 0.13 }
      : nth(pts, Math.floor(mr() * pts.length));
    add(p.x, p.y + 0.05, p.z, 'o', 0.11, 3.0, onHead ? 'head' : 'body');
  }
  return pts;
}

export function golemForm(): Body {
  const L = 'Y',
    pts: Body = [],
    add = adder(pts);
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 4; b++)
      for (let c = 0; c < 2; c++) {
        if (a === 1 && b === 2 && c === 1) continue;
        add((a - 1) * 0.17, 0.92 + b * 0.15, (c - 0.5) * 0.17, (a + b + c) % 2 ? '#' : '=', 0.19, 0.85, 'body');
      }
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) add((a - 0.5) * 0.15, 1.58 + b * 0.13, 0, b ? '[' : ']', 0.17, 0.9, 'head');
  add(0.07, 1.64, 0.1, '*', 0.1, 3.0, 'head');
  add(-0.07, 1.64, 0.1, '*', 0.1, 3.0, 'head');
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 4; k++) add(sd * 0.38, 1.32 - k * 0.17, 0, k === 3 ? '#' : '[', 0.2, 0.85, sd < 0 ? 'armL' : 'armR', 1.32);
    for (let k = 0; k < 4; k++) add(sd * 0.14, 0.8 - k * 0.2, 0, '#', 0.2, 0.85, sd < 0 ? 'legL' : 'legR', 0.8);
  }
  add(0, 1.24, 0.12, L, 0.36, 3.4, 'core');
  return pts;
}

/** 人型の体の割合（腰・肩・頭の高さ、頭の大きさ、前のめり、脚の太さ） */
export interface HumProp {
  hip: number;
  sh: number;
  hc: number;
  hk: number;
  lean?: number;
  legW?: number;
}
export const HUM_PROP: Record<'base' | 'small' | 'monkey' | 'snapjaw' | 'ogre', HumProp> = {
  base: { hip: 0.75, sh: 1.3, hc: 1.47, hk: 1.0 },
  small: { hip: 0.6, sh: 1.12, hc: 1.36, hk: 1.25 },
  monkey: { hip: 0.52, sh: 1.1, hc: 1.28, hk: 1.1 },
  snapjaw: { hip: 0.68, sh: 1.24, hc: 1.43, hk: 1.05, lean: 0.12 },
  ogre: { hip: 0.6, sh: 1.26, hc: 1.4, hk: 0.9, legW: 1.3 },
};
/** 見た目の名前 → HUM_PROP のどれか */
export const LOOK_PROP: Record<string, keyof typeof HUM_PROP> = {
  kobold: 'small',
  goblin: 'small',
  gnome: 'small',
  conjurer: 'small',
  monkey: 'monkey',
  snapjaw: 'snapjaw',
  ogre: 'ogre',
};

/** 王の影の一つ目の姿の高さ（足元から、頭の上の黒い太陽の外の印まで。大きさ scale を掛ける前） */
export const SHADOW_KING_H = 3.37;

export function shadowKingForm(): Body {
  // the first form: a king of shadow in a long cloak whose torn hem spreads over the floor. Dark inside, only its edges thin and bright like cut paper.
  // a faceless helm with two small cold eyes, a crown of five upright spikes, a black sun above it (a ring of dots and marks turning slowly round a dark middle),
  // a fur collar of twinkling specks, a long sword held upright in its right hand, a row of small lights down the front, and the heart.
  // cracks of cold light (part 'crack', each with a health threshold) open as it weakens, letting the starry dark show through
  const pts: Body = [],
    S = 0.08,
    ZS = 0.75; // the cloak is flatter front to back
  const EDGE: Color = [0.88, 0.84, 1.0],
    DARK: Color = [0.26, 0.18, 0.42],
    SHARD: Color = [0.92, 0.9, 1.0],
    EYE: Color = [0.92, 0.96, 1.0],
    HEART: Color = [1.0, 0.86, 0.55],
    CRACK: Color = [0.8, 0.9, 1.0],
    STAR: Color = [0.7, 0.72, 1.0],
    FUR: Color = [0.8, 0.76, 1.0],
    BLADE: Color = [0.82, 0.9, 1.0],
    GRIP: Color = [0.6, 0.54, 0.76];
  const lit = (x: number, y: number, z: number, ch: string, s: number, b: number, col: Color, part?: string, extra?: Extra) => {
    pts.push(Object.assign({ x, y, z, g: G(ch), s, b, part: part || 'body', ph: mr() * 6.28, piv: 0, pz: 0, col }, extra || {}));
  };
  const stroke = (a: Vec3, b: Vec3, col: Color, bri: number, s: number, part: string, step?: number) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      dz = b[2] - a[2],
      L = Math.hypot(dx, dy, dz),
      n = Math.max(1, Math.round(L / (step || 0.1))),
      ch = strokeCh(dx, dy);
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      lit(a[0] + dx * f, a[1] + dy * f, a[2] + dz * f, ch, s || S, bri, col, part);
    }
  };
  const skin = (x: number, y: number, z: number, nx: number, nz: number, part: string, slope: number) => {
    const rim = 1 - Math.abs(nz) / (Math.hypot(nx, nz) || 1);
    if (rim > 0.72) lit(x, y, z, slope > 0.35 ? '/' : slope < -0.35 ? '\\' : '|', S, 1.6 + 1.2 * rim, EDGE, part);
    else if (mr() < 0.6) lit(x, y, z, mpick(['%', ':', '.']), S, 0.3 + 0.2 * rim, DARK, part);
  };
  // the cloak: wide on the floor, narrowing up to the shoulders, then rounding in to the neck
  const prof = (y: number): number =>
    y < 1.7
      ? 0.46 + 0.54 * Math.pow(1 - Math.max(0, y) / 1.7, 1.6)
      : Math.max(0.16, 0.46 - 0.3 * Math.pow(Math.min(1, (y - 1.7) / 0.2), 1.5));
  // the front opening: below the chest the cloak parts a little, wider toward the hem
  const gap = (y: number): number => (y < 1.45 ? 0.06 + 0.3 * ((1.45 - y) / 1.45) : 0);
  for (let y = 0.04; y < 1.92; y += 0.12) {
    const r = prof(y),
      slope = (prof(y + 0.05) - prof(y - 0.05)) / 0.1,
      n = Math.max(8, Math.round((2 * Math.PI * r) / 0.13)),
      gp = gap(y);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + y * 2,
        nx = Math.cos(a),
        nz = Math.sin(a);
      if (nz > 0 && Math.abs(nx) < gp) continue;
      if (y < 0.25 && mr() < 0.4) {
        lit(nx * r * (1 + mr() * 0.3), 0.03, nz * r * ZS * (1 + mr() * 0.3), '~', S, 0.6, DARK, 'robe');
        continue;
      }
      skin(nx * r, y, nz * r * ZS, nx, nz, y < 1.0 ? 'robe' : 'body', nx > 0 ? -slope : slope);
    }
  }
  // the bright edges of the opening, from the collar down to the hem
  for (const sd of [1, -1])
    for (let y = 0.06; y < 1.45; y += 0.09) {
      const r = prof(y),
        x = sd * gap(y) * r;
      lit(x, y, Math.sqrt(Math.max(0, r * r - x * x)) * ZS, sd > 0 ? '(' : ')', S, 2.0, EDGE, y < 1.0 ? 'robe' : 'body');
    }
  // the torn hem: strips hanging from the lower cloak, swaying
  for (let k = 0; k < 22; k++) {
    const a = mr() * Math.PI * 2,
      nx = Math.cos(a),
      nz = Math.sin(a);
    if (nz > 0 && Math.abs(nx) < gap(0.2)) continue;
    const top = 0.18 + mr() * 0.22,
      r0 = prof(top),
      r1 = prof(0) * (1.05 + mr() * 0.25);
    for (let q = 0; q < 4; q++) {
      const f = q / 3,
        r = r0 + (r1 - r0) * f;
      lit(
        nx * r,
        top * (1 - f) + 0.02,
        nz * r * ZS,
        q === 3 ? mpick(['~', ',', "'"]) : mpick(['|', '!', ':']),
        S,
        q === 3 ? 0.9 : 0.55,
        q === 3 ? EDGE : DARK,
        'robe',
      );
    }
  }
  // the inner robe seen through the opening: dark, with a row of small lights down the front
  for (let y = 0.2; y < 1.45; y += 0.1) {
    const r = prof(y) * 0.9,
      w = gap(y) * r;
    for (let x = -w + 0.04; x < w - 0.02; x += 0.07)
      if (mr() < 0.55) lit(x, y, r * ZS, mpick([':', '.', '%']), S, 0.28, DARK, y < 1.0 ? 'robe' : 'body');
  }
  for (let y = 0.5; y < 1.66; y += 0.13) {
    const big = Math.round(y * 10) % 3 === 0;
    lit(0, y, prof(y) * ZS * 0.95, big ? 'o' : '.', S * (big ? 1.1 : 0.9), big ? 2.4 : 1.6, STAR, y < 1.0 ? 'robe' : 'body');
  }
  // the fur collar: specks round the shoulders that twinkle (each glyph's own shimmer)
  for (let k = 0; k < 56; k++) {
    const a = mr() * Math.PI * 2,
      y = 1.7 + mr() * 0.2,
      r = prof(y) + 0.04 + mr() * 0.06;
    lit(Math.cos(a) * r, y, Math.sin(a) * r * ZS, mpick(['*', '.', '+', "'", '.']), S * (1 + mr() * 0.5), 2.0 + mr() * 1.6, FUR, 'body');
  }
  // the helm: no face, only the dark inside it and two small cold eyes
  for (let i = 0; i < 40; i++) {
    const y = 1 - (2 * (i + 0.5)) / 40,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996,
      nx = Math.cos(a) * rr,
      nz = Math.sin(a) * rr;
    if (nz > 0.5 && Math.abs(y) < 0.65) continue; // the face: left dark
    skin(nx * 0.18, 2.08 + y * 0.2, nz * 0.17, nx, nz, 'head', 0);
  }
  for (const sd of [1, -1]) lit(sd * 0.055, 2.1, 0.15, '*', S * 1.25, 3.8, EYE, 'eye');
  // the crown: a band round the top of the helm, and five upright spikes, the middle one tallest
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    lit(Math.cos(a) * 0.18, 2.25, Math.sin(a) * 0.16, mpick(['=', '-']), S, 2.2, SHARD, 'head');
  }
  const SPIKE = [0.16, 0.25, 0.36, 0.25, 0.16];
  SPIKE.forEach((h, k) => {
    const x = (k - 2) * 0.065,
      z = 0.15 - x * x * 2;
    stroke([x, 2.27, z], [x * 1.15, 2.27 + h, z], SHARD, 2.2, S * 1.1, 'head', 0.07);
    lit(x * 1.15, 2.31 + h, z, '^', S * 1.1, 2.8, SHARD, 'head');
  });
  // the black sun above the crown: an inner ring of dots and an outer ring of marks, turning slowly the other way; nothing is drawn in the middle
  for (let k = 0; k < 24; k++)
    lit(0, 2.95, -0.08, '.', S * 1.2, 2.6, SHARD, 'halo', { cy: 2.95, r: 0.26, sp: 0.15, ph: (k / 24) * Math.PI * 2 });
  for (let k = 0; k < 12; k++)
    lit(0, 2.95, -0.08, "'", S * 1.4, 3.0, SHARD, 'halo', { cy: 2.95, r: 0.42, sp: -0.1, ph: (k / 12) * Math.PI * 2 });
  // the long sword, held upright in its right hand (on the left as it faces you): pommel, grip, cross guard, and a blade with two bright edges
  const SX = -0.58,
    SZ = 0.28;
  stroke([-0.42, 1.66, 0.1], [SX + 0.02, 0.96, SZ - 0.02], EDGE, 1.4, S, 'body', 0.1); // the sleeve
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    lit(SX + Math.cos(a) * 0.05, 0.88 + (k % 2) * 0.06, SZ + Math.sin(a) * 0.04, mpick(['#', '%']), S, 1.1, EDGE, 'body'); // the gauntlet
  }
  lit(SX, 0.72, SZ, 'o', S * 1.1, 2.4, SHARD, 'body');
  stroke([SX, 0.76, SZ], [SX, 0.98, SZ], GRIP, 1.4, S, 'body', 0.06);
  stroke([SX - 0.22, 1.02, SZ], [SX + 0.22, 1.02, SZ], SHARD, 3.2, S, 'body', 0.06);
  for (const e of [-0.024, 0.024]) stroke([SX + e, 1.07, SZ], [SX + e * 0.4, 2.58, SZ], BLADE, 2.6, S * 0.9, 'body', 0.08);
  for (let y = 1.12; y < 2.5; y += 0.16) lit(SX, y, SZ, '.', S * 0.8, 1.0, BLADE, 'body');
  lit(SX, 2.64, SZ, '^', S, 3.0, BLADE, 'body');
  // the heart (seen in the light)
  const hz = prof(1.42) * ZS + 0.02;
  lit(0, 1.42, hz, '*', S * 2.6, 4.0, HEART, 'heart');
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    lit(Math.cos(a) * 0.1, 1.42 + Math.sin(a) * 0.1, hz, '+', S * 0.9, 2.4, HEART, 'heart');
  }
  // cracks of the seal: each opens below its threshold of health, with the starry dark behind it
  for (let c = 0; c < 7; c++) {
    const th = 0.95 - c * 0.06;
    let a = mr() * Math.PI * 2 * 0.8 - 0.4 * Math.PI + Math.PI / 2,
      y = 0.3 + mr() * 1.3;
    for (let k = 0; k < 9; k++) {
      const r = prof(y) + 0.01,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r * ZS;
      const na = a + (mr() - 0.5) * 0.35,
        ny = y + 0.07 + (mr() - 0.3) * 0.06,
        dx = Math.cos(na) * r - x,
        dy = ny - y;
      lit(x, y, z, strokeCh(dx, dy), S * 1.05, 3.0, CRACK, 'crack', { th });
      if (k % 3 === 1) lit(x * 0.92, y, z * 0.92, mpick(['.', '+']), S * 0.8, 2.2, STAR, 'crack', { th });
      a = na;
      y = ny;
    }
  }
  return pts;
}

/** 深みの主の触手の通り道（制御点）と太さ。初めの4本は体のそばの触手、残りの10本は水面から出る触手 */
const krakenT: Vec3[][] = [
    [
      [-0.45, 0, 0.1],
      [-0.9, 1.2, 0.0],
      [-0.85, 2.4, -0.1],
      [-0.25, 2.95, 0.1],
      [0.12, 2.65, 0.32],
      [0.02, 2.35, 0.36],
    ],
    [
      [0.5, 0, 0.05],
      [1.0, 1.05, -0.1],
      [1.1, 2.05, -0.2],
      [0.8, 2.65, 0.0],
      [0.45, 2.55, 0.22],
      [0.55, 2.28, 0.32],
    ],
    [
      [-0.42, 0, 0.62],
      [-0.75, 0.42, 1.3],
      [-0.62, 0.95, 1.8],
      [-0.3, 1.12, 1.92],
      [-0.18, 0.88, 1.78],
    ],
    [
      [0.38, 0, 0.66],
      [0.82, 0.32, 1.22],
      [0.96, 0.78, 1.62],
      [0.7, 1.02, 1.76],
      [0.6, 0.82, 1.66],
    ],
  ],
  krakenW: number[] = [0.22, 0.22, 0.2, 0.2];
// tentacles breaking the water at different distances: some arch high, some curl in or out, a few show only their tips
for (let k = 0; k < 10; k++) {
  const a = (k / 10) * Math.PI * 2 + 0.3 * (k % 3) + 0.15,
    r = 1.35 + 0.95 * ((k * 0.618) % 1),
    tipOnly = k % 4 === 3,
    h = tipOnly ? 0.35 + 0.15 * ((k * 0.41) % 1) : 0.6 + 1.5 * ((k * 0.37 + 0.2) % 1),
    sd = k % 2 ? 1 : -1;
  const bx = Math.cos(a) * r,
    bz = Math.sin(a) * r,
    tx = -Math.sin(a) * sd,
    tz = Math.cos(a) * sd,
    ox = Math.cos(a) * (k % 3 ? 1 : -1),
    oz = Math.sin(a) * (k % 3 ? 1 : -1),
    L = tipOnly ? 0.4 : 1;
  krakenT.push([
    [bx, 0, bz],
    [bx + tx * 0.15 * L, h * 0.45, bz + tz * 0.15 * L],
    [bx + tx * 0.3 * L + ox * 0.1 * L, h * 0.9, bz + tz * 0.3 * L + oz * 0.1 * L],
    [bx + tx * 0.15 * L + ox * 0.35 * L, h, bz + tz * 0.15 * L + oz * 0.35 * L],
    [bx + ox * 0.4 * L, h * 0.78, bz + oz * 0.4 * L],
  ]);
  krakenW.push(tipOnly ? 0.09 : 0.13 + 0.04 * ((k * 0.29) % 1));
}
export const KRAKEN_T: readonly (readonly Vec3[])[] = krakenT,
  KRAKEN_W: readonly number[] = krakenW;

// the ancient machines, each its own body: old brass with light leaking from the seams (readable glyphs; S about 0.28 local)
// ---- 古い機械（真鍮）
export function cleanerForm(ty: BodyType): Body {
  const pts: Body = [],
    S = 0.28,
    C = ty.col;
  for (const [y, r] of [
    [0.1, 0.56],
    [0.22, 0.56],
    [0.32, 0.46],
    [0.42, 0.3],
    [0.5, 0.12],
  ] as const) {
    const n = Math.max(5, Math.round((2 * Math.PI * r) / 0.3));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      mPut(pts, Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), y > 0.3 ? 0.8 : 0.1, Math.sin(a), BRASS, BRASS_R, S);
    }
  }
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    mLit(pts, Math.cos(a) * 0.57, 0.27, Math.sin(a) * 0.57, '-', S * 0.8, 2.2, C);
  }
  for (const sd of [1, -1])
    for (let k = 0; k < 3; k++)
      mLit(pts, 0, 0.05, 0, k ? 'x' : '*', S * 0.9, 1.6, [0.9, 0.9, 0.85], 'spin', {
        cx: sd * 0.3,
        cz: 0.32,
        r: 0.1 + k * 0.05,
        sp: 7 * sd,
        ph: k * 2.1,
      });
  for (let k = 0; k < 4; k++) mLit(pts, (k - 1.5) * 0.1, 0.12, 0.58, '=', S * 0.8, 1.8, C);
  mLit(pts, 0, 0.44, 0.24, '.', S, 3.2, C, 'eye');
  return pts;
}

export function repairerForm(ty: BodyType): Body {
  const pts: Body = [],
    S = 0.27,
    C = ty.col;
  for (let i = 0; i < 30; i++) {
    const y = 1 - (2 * (i + 0.5)) / 30,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996;
    mPut(pts, Math.cos(a) * rr * 0.36, 0.78 + y * 0.32, Math.sin(a) * rr * 0.36, Math.cos(a) * rr, y, Math.sin(a) * rr, BRASS, BRASS_R, S);
  }
  for (let k = 0; k < 5; k++) mLit(pts, (k - 2) * 0.08, 0.84, 0.36, '=', S * 0.85, 2.6, C, 'eye');
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    mLit(pts, Math.cos(a) * 0.37, 0.66, Math.sin(a) * 0.37, '-', S * 0.75, 1.9, C);
  }
  for (const [a, part] of [
    [Math.PI / 2, 'legL'],
    [(Math.PI * 7) / 6, 'legR'],
    [-Math.PI / 6, 'legL'],
  ] as const) {
    const fx = Math.cos(a) * 0.34,
      fz = Math.sin(a) * 0.34;
    for (let k = 0; k < 4; k++) {
      const f = k / 3;
      mLit(pts, fx * (0.5 + 0.5 * f), 0.5 - 0.48 * f, fz * (0.5 + 0.5 * f), k === 3 ? '^' : '|', S, 1.1, BRASS, part, {
        piv: 0.5,
        pz: fz * 0.5,
      });
    }
  }
  const tools = ['>', '+', '=', '%'] as const;
  (
    [
      [0.36, 0.84, 1, 'armR'],
      [0.34, 0.66, 1, 'armR'],
      [-0.36, 0.84, -1, 'armL'],
      [-0.34, 0.66, -1, 'armL'],
    ] as const
  ).forEach(([x, y, sd, part], j) => {
    const el: Vec3 = [x + sd * 0.22, y + 0.05, 0.18],
      tp: Vec3 = [x + sd * 0.12, y - 0.08, 0.48];
    for (let k = 0; k <= 3; k++) {
      const f = k / 3;
      mLit(pts, x + (el[0] - x) * f, y + (el[1] - y) * f, 0.05 + (el[2] - 0.05) * f, '-', S * 0.85, 1.2, BRASS, part, { piv: y });
    }
    mLit(pts, el[0], el[1], el[2], 'o', S * 0.9, 1.5, BRASS, part, { piv: y });
    for (let k = 1; k <= 3; k++) {
      const f = k / 3;
      mLit(pts, el[0] + (tp[0] - el[0]) * f, el[1] + (tp[1] - el[1]) * f, el[2] + (tp[2] - el[2]) * f, '/', S * 0.85, 1.2, BRASS, part, {
        piv: y,
      });
    }
    mLit(pts, tp[0], tp[1], tp[2] + 0.05, nth(tools, j), S * 1.05, 2.6, [0.95, 0.95, 0.9], part, { piv: y });
  });
  for (let k = 0; k < 8; k++) mLit(pts, ((k % 3) - 1) * 0.14, 0.86 + Math.floor(k / 3) * 0.13, -0.42, '#', S, 0.9, [0.6, 0.6, 0.58]);
  return pts;
}

export function watcherForm(ty: BodyType): Body {
  const pts: Body = [],
    S = 0.26,
    C = ty.col;
  for (const [a, part] of [
    [Math.PI / 2, 'legL'],
    [(Math.PI * 7) / 6, 'legR'],
    [-Math.PI / 6, 'legL'],
  ] as const) {
    const fx = Math.cos(a) * 0.55,
      fz = Math.sin(a) * 0.55,
      kx = Math.cos(a) * 0.32,
      kz = Math.sin(a) * 0.32;
    for (let k = 0; k <= 4; k++) {
      const f = k / 4;
      mLit(pts, kx * f, 1.3 - (1.3 - 0.75) * f, kz * f, fx > 0 ? '/' : '\\', S * 0.9, 1.1, BRASS, part, { piv: 1.3, pz: 0 });
    }
    mLit(pts, kx, 0.75, kz, 'o', S, 1.4, BRASS, part, { piv: 1.3 });
    for (let k = 1; k <= 4; k++) {
      const f = k / 4;
      mLit(pts, kx + (fx - kx) * f, 0.75 - 0.73 * f, kz + (fz - kz) * f, '|', S * 0.9, 1.1, BRASS, part, { piv: 1.3 });
    }
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    mLit(pts, Math.cos(a) * 0.2, 1.3, Math.sin(a) * 0.2, '=', S * 0.85, 1.3, BRASS);
  }
  for (let i = 0; i < 34; i++) {
    const y = 1 - (2 * (i + 0.5)) / 34,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996,
      nz = Math.sin(a) * rr;
    if (nz > 0.55) continue;
    mPut(pts, Math.cos(a) * rr * 0.3, 1.62 + y * 0.3, nz * 0.3, Math.cos(a) * rr, y, nz, BRASS, BRASS_R, S);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    mLit(pts, Math.cos(a) * 0.2, 1.62 + Math.sin(a) * 0.2, 0.25, Math.abs(Math.cos(a)) > 0.7 ? '|' : '-', S * 0.9, 1.6, BRASS, 'ap', {
      cx: 0,
      cy: 1.62,
    });
    mLit(pts, Math.cos(a) * 0.13, 1.62 + Math.sin(a) * 0.13, 0.28, a < Math.PI ? '<' : '>', S * 0.8, 1.8, [0.8, 0.6, 0.5], 'ap', {
      cx: 0,
      cy: 1.62,
    });
  }
  mLit(pts, 0, 1.62, 0.3, '@', S * 1.5, 4.2, C, 'eye');
  return pts;
}

// ---- 忘れられた獣（src/game/10-bodies-beast.js）
/** 獣の大きさ（獣の大きさで、文字が約 0.3 m になる） */
export const BEAST_S = { scale: 2.35 };
/** 獣の体の色から、飾りの色（補色寄り）を作る */
export function beastAcc(col: Color): Color {
  return [Math.min(1, col[2] * 0.9 + 0.25), Math.min(1, col[0] * 0.9 + 0.15), Math.min(1, col[1] * 0.9 + 0.2)];
}
/** 眠っている獣の形（体を低く、脚を畳み、翼を閉じる） */
export function beastSleep(form: readonly Glyph[], ty: { spec: { plan: string } }): Glyph[] {
  const out: Glyph[] = [];
  for (const p of form) {
    const q = { ...p };
    if (ty.spec.plan === 'moth') {
      if (p.part === 'wing') q.r = (p.r || 0) * 0.35;
    } else if (ty.spec.plan !== 'serpent') {
      if (p.part === 'legL' || p.part === 'legR') {
        q.y = p.y * 0.35;
        q.piv = (p.piv || 0) * 0.35;
        q.part = 'body';
      } else if (p.part === 'head') {
        q.y = Math.max(0.08, p.y * 0.38);
        q.z = p.z * 0.95;
      } else if (p.part === 'wing') {
        q.r = (p.r || 0) * 0.4;
        q.y = (p.y || 0) * 0.6;
      } else q.y = p.y * 0.6;
    }
    out.push(q);
  }
  return out;
}

/**
 * 忘れられた獣の種類（生き物の表 MTYPES の X）。年代記の獣（H.beastSpec）から、体の形・色・言い伝えを決める。
 * 色の乱数は探索のシード runSeed で決まる（迷宮の乱数は使わない）
 */
export function makeBeastType(H: History, runSeed: number) {
  const sp = H.beastSpec,
    rnd = mulberry32((runSeed ^ 0x1234567) >>> 0);
  const PLANS: Record<string, string> = { 獣: 'quad', 竜: 'quad', 大蛇: 'serpent', 蛾: 'moth', 百足: 'centipede' };
  const plan = PLANS[sp.kind] || 'quad';
  const spec = {
    plan,
    kind: sp.kind,
    legs: sp.feat === '六本脚の' ? 6 : 4,
    wings: (sp.kind === '竜' || sp.kind === '蛾') && sp.feat !== '翼なき',
    eyes: sp.feat === '千の眼を持つ' ? 26 : 0,
    fire: sp.feat === '燃える鱗の',
    shadow: sp.feat === '影を喰らう',
    sing: sp.feat === '歌う',
    glyphs: nth(
      [
        ['#', '%', '&'],
        ['=', '~', 'x'],
        ['%', '*', '#'],
        ['&', '8', '%'],
      ],
      Math.floor(rnd() * 4),
    ),
  };
  const col: Color = spec.fire ? [1.0, 0.42, 0.14] : spec.shadow ? [0.5, 0.32, 0.8] : hsl2rgb(rnd(), 0.75, 0.6);
  const lore = (H.events.find((e) => e.art === 'serpent') || { text: undefined }).text || `その名は、年代記の隅にだけ記されている。`;
  return {
    ch: 'X',
    name: H.beast,
    col,
    form: 'beast',
    spec,
    lore,
    scale: plan === 'moth' ? 3.0 : 3.6,
    speed: plan === 'moth' ? 1.0 : 0.55,
    fl: plan === 'moth' ? 2.4 : 0,
    light: 9,
    trail: spec.fire ? 8 : 3,
    flier: plan === 'moth',
    beast: true,
    verb: '洞窟の奥で、身じろぎもせずに眠っている',
  };
}
