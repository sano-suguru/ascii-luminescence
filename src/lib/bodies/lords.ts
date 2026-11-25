// 主・機械・忘れられた獣の形（もとは src/game/07-bodies-lords.js・08-bodies-shadow.js・10-bodies-beast.js）。
import { must, nth } from '../array.ts';
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
  FUR,
  mLit,
  mPut,
  q3,
  strokeCh,
  adder,
} from './kit.ts';
import { dragonForm } from './beasts.ts';

/** 忘れられた獣の作り（年代記の獣から決まる） */
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

/** 忘れられた獣の体の作り（年代記の獣から決まる。図鑑の見本も同じ形） */
export interface BeastBody extends BeastSpec {
  legs: number;
  wings: boolean;
  eyes: number;
  /** 燃える鱗の・影を喰らう・歌う */
  fire: boolean;
  shadow: boolean;
  sing: boolean;
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
export const SHADOW_KING_H = 3.51;
/** 王の影の大きさ：プレイヤーの目の高さの約4倍。天井が低い所だけ縮める（SHADOW_MIN_SC より小さくはしない。最深部は高い天井の所なので、そこまで低い天井は無い） */
export const SHADOW_KING_SC = 2.0,
  SHADOW_MIN_SC = 1.2;
/** 天井の高さ ceilH の所に出る、王の影の一つ目の姿の大きさ */
export const shadowKingScale = (ceilH: number): number => Math.max(SHADOW_MIN_SC, Math.min(SHADOW_KING_SC, (ceilH - 0.3) / SHADOW_KING_H));
/** 王の影の外套の幅の半分（高さ y で）：肩は狭くなで下ろし、胸から腰までは細い柱、下の4割で大きく広がる */
export const shadowCloakHalf = (y: number): number =>
  y > 1.95
    ? 0.1 + (0.22 * (2.12 - Math.min(2.12, y))) / 0.17
    : y > 0.95
      ? 0.32 + 0.06 * (1.95 - y)
      : 0.38 + 0.6 * Math.pow((0.95 - Math.max(0, y)) / 0.95, 1.4);

export function shadowKingForm(): Body {
  // the first form: a king of shadow, tall and narrow, in a cloak that hangs straight from narrow sloping shoulders and spreads wide only near the floor;
  // its right edge (on the right as it faces you) is torn into small rags. Dark inside, only its edges thin and bright like cut paper.
  // a narrow hood rising to a point, with one slit of cold light for a face and two small eyes at its top; a crown of five long thin spikes;
  // a black sun high above the crown (a dim rim round a dark middle, a ring of dots and a ring of marks, turning slowly);
  // a long sword taller than the king, held at the chest, its shaft down to the floor, with a pommel, curled guard ends and rings at the foot of the blade.
  // the cloak opens down the front, wider toward the hem, and shows the body inside: the spine's joints, ribs on the chest, an ornament at the hips, two ribbed legs
  // with their knees; three lights down the middle (the heart at the chest, the belly, the hips); a chain with three small skulls hanging from the left shoulder;
  // star-like holes and long folds in the cloak.
  // cracks of cold light (part 'crack', each with a health threshold) open as it weakens, letting the starry dark show through
  const pts: Body = [],
    S = 0.08,
    ZS = 0.9; // the cloak is a little flatter front to back
  const EDGE: Color = [0.88, 0.84, 1.0],
    DARK: Color = [0.26, 0.18, 0.42],
    SHARD: Color = [0.92, 0.9, 1.0],
    EYE: Color = [0.92, 0.96, 1.0],
    HEART: Color = [1.0, 0.86, 0.55],
    CRACK: Color = [0.8, 0.9, 1.0],
    STAR: Color = [0.7, 0.72, 1.0],
    BLADE: Color = [0.82, 0.9, 1.0],
    GRIP: Color = [0.6, 0.54, 0.76],
    BONE: Color = [0.86, 0.82, 0.74];
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
  // the torn right edge: how far the cloak reaches past its smooth line, at height y (more toward the floor)
  const rag = (y: number): number => {
    const t = y < 1.7 ? 1 - y / 1.7 : 0;
    return (
      t * (0.035 * Math.sin(y * 41) + 0.025 * Math.sin(y * 97 + 1.3) + 0.02 * Math.sin(y * 173 + 0.4)) +
      (Math.sin(y * 23) > 0.93 ? 0.05 * t : 0)
    );
  };
  // the half width toward the right (x > 0) is a little wider, and torn
  const halfAt = (y: number, nx: number): number => {
    const h = shadowCloakHalf(y);
    return nx > 0 ? h * (y < 0.95 ? 1.12 : 1.05) + rag(y) * nx : h;
  };
  // the front opening: from the chest down, wider toward the hem (half its width, at height y)
  const gapAt = (y: number): number => (y < 1.55 ? 0.05 + 0.2 * ((1.55 - y) / 1.55) : 0);
  // a point on the front of the cloak, at x across and height y
  const frontZ = (x: number, y: number, inset = 0): number => {
    const h = shadowCloakHalf(y);
    return Math.sqrt(Math.max(0, h * h - x * x)) * ZS * (1 - inset) + 0.01;
  };
  for (let y = 0.04; y < 2.1; y += 0.1) {
    const r0 = shadowCloakHalf(y),
      slope = (shadowCloakHalf(y + 0.05) - shadowCloakHalf(y - 0.05)) / 0.1,
      n = Math.max(8, Math.round((2 * Math.PI * r0) / 0.13));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + y * 2,
        nx = Math.cos(a),
        nz = Math.sin(a),
        r = halfAt(y, nx);
      if (nz > 0 && Math.abs(nx * r) < gapAt(y)) continue; // the opening
      if (y < 0.25 && mr() < 0.4) {
        lit(nx * r * (1 + mr() * 0.3), 0.03, nz * r * ZS * (1 + mr() * 0.3), '~', S, 0.6, DARK, 'robe');
        continue;
      }
      skin(nx * r, y, nz * r * ZS, nx, nz, y < 1.0 ? 'robe' : 'body', nx > 0 ? -slope : slope);
    }
  }
  // the train: the back of the cloak runs on along the floor behind, longest in the middle, its edge bright
  const back0 = shadowCloakHalf(0) * ZS;
  for (let x = -0.62; x <= 0.62; x += 0.07) {
    const len = 0.7 * Math.sqrt(Math.max(0, 1 - (x / 0.66) ** 2));
    for (let d = 0.08; d <= len; d += 0.09) {
      const edge = d + 0.09 > len;
      if (!edge && mr() < 0.35) continue;
      lit(
        x * (1 - d * 0.15),
        0.03,
        -back0 - d,
        edge ? mpick(['~', ',', '.']) : mpick(['~', ':', '.']),
        S,
        edge ? 1.5 : 0.5,
        edge ? EDGE : DARK,
        'robe',
      );
    }
  }
  // rags hanging from the torn edge, swaying
  for (let k = 0; k < 16; k++) {
    const y = 0.15 + mr() * 1.3,
      r = halfAt(y, 1) + 0.02;
    for (let q = 0; q < 3; q++)
      lit(
        r + q * 0.015,
        y - q * 0.06,
        (mr() - 0.5) * 0.2,
        q === 2 ? mpick(["'", ',']) : mpick(['|', '!']),
        S,
        q === 2 ? 1.1 : 0.7,
        q === 2 ? EDGE : DARK,
        'robe',
      );
  }
  // the edges of the opening, bright
  for (let y = 0.06; y < 1.55; y += 0.06)
    for (const sd of [-1, 1]) {
      const x = sd * gapAt(y);
      lit(x, y, frontZ(x, y), sd < 0 ? ')' : '(', S, 1.8, EDGE, y < 1.0 ? 'robe' : 'body');
    }
  // the body inside the cloak (a little behind its front): the spine's joints from the neck to the hips, and ribs on the chest
  for (let y = 1.15; y < 1.95; y += 0.07) lit(0, y, frontZ(0, y, 0.08), '=', S, 1.0, EDGE, 'body');
  for (let k = 0; k < 4; k++) {
    const y0 = 1.82 - k * 0.09;
    for (const sd of [-1, 1])
      for (let q = 0; q <= 5; q++) {
        const f = q / 5,
          x = sd * (0.05 + 0.15 * Math.sin(f * 1.4)),
          y = y0 - 0.06 * f * f;
        lit(x, y, frontZ(x, y, 0.04), sd < 0 ? '(' : ')', S * 0.85, 0.9, EDGE, 'body');
      }
  }
  // the ornament at the hips: a small ring round a glowing core
  for (let q = 0; q < 12; q++) {
    const a = (q / 12) * Math.PI * 2,
      x = Math.cos(a) * 0.08,
      y = 1.02 + Math.sin(a) * 0.06;
    lit(x, y, frontZ(x, y, 0.1), '.', S * 0.9, 1.3, EDGE, 'body');
  }
  // three lights down the middle: the belly and the hips (the heart, at the chest, is below)
  for (const y of [1.3, 1.02]) lit(0, y, frontZ(0, y, 0.06), 'o', S * 1.2, 2.6, STAR, y < 1.0 ? 'robe' : 'body');
  // two ribbed legs inside the opening, with their knees and hips
  for (const sd of [-1, 1]) {
    for (const o of [-0.03, 0, 0.03])
      for (let y = 0.08; y < 0.95; y += 0.08) {
        const x = sd * (0.09 + (0.03 * (0.95 - y)) / 0.87) + o;
        lit(x, y, frontZ(x, y, 0.15), '|', S * 0.8, 0.8, GRIP, 'robe');
      }
    lit(sd * 0.105, 0.55, frontZ(sd * 0.105, 0.55, 0.12), '@', S, 1.4, EDGE, 'robe');
    lit(sd * 0.095, 0.9, frontZ(sd * 0.095, 0.9, 0.12), 'o', S * 0.9, 1.1, EDGE, 'robe');
  }
  // a chain hanging from the left shoulder across the chest, with three small skulls
  for (let q = 0; q <= 8; q++) {
    const f = q / 8,
      x = -0.22 + 0.3 * f,
      y = 1.88 - 0.25 * Math.sin(f * Math.PI);
    lit(x, y, frontZ(x, y) + 0.01, 'o', S * 0.75, 1.6, EDGE, 'body');
  }
  for (const [x, y] of [
    [-0.15, 1.7],
    [0.02, 1.63],
    [0.12, 1.72],
  ] as const)
    lit(x, y, frontZ(x, y) + 0.02, '@', S * 1.5, 2.0, BONE, 'body');
  // star-like holes in the cloak, and long folds
  for (let q = 0; q < 26; q++) {
    const y = 0.15 + mr() * 1.6,
      side = q % 2 ? 1 : -1,
      x = side * (gapAt(y) + 0.06 + mr() * Math.max(0, shadowCloakHalf(y) - gapAt(y) - 0.08));
    lit(x, y, frontZ(x, y), mpick(['.', '+', "'"]), S * 0.8, 2.0, STAR, y < 1.0 ? 'robe' : 'body');
  }
  for (const x0 of [-0.22, -0.32, 0.24, 0.36])
    for (let k = 0; k <= 16; k++) {
      const f = k / 16,
        y = 1.6 - 1.52 * f,
        x = x0 * (0.6 + 1.1 * f);
      lit(x, y, frontZ(x, y), x0 < 0 ? '/' : '\\', S * 0.8, 0.7, EDGE, y < 1.0 ? 'robe' : 'body');
    }
  // ragged tufts along the shoulders
  for (let k = 0; k < 24; k++) {
    const sd = mr() < 0.5 ? -1 : 1,
      y = 1.9 + mr() * 0.18,
      r = shadowCloakHalf(y) + 0.03 + mr() * 0.04,
      a = mr() * Math.PI;
    lit(
      sd * Math.abs(Math.cos(a)) * r,
      y,
      Math.sin(a) * r * ZS * (mr() < 0.5 ? -1 : 1),
      mpick(['*', '.', "'", '^']),
      S * (0.8 + mr() * 0.4),
      1.4 + mr() * 1.2,
      EDGE,
      'body',
    );
  }
  // the hood: narrow, rising to a point; no face but one slit of cold light, and two small eyes at its top
  const hoodHalf = (y: number): number => 0.1 - (0.06 * (y - 2.12)) / 0.35;
  for (let y = 2.12; y <= 2.47; y += 0.05) {
    const r = hoodHalf(y),
      n = Math.max(6, Math.round((2 * Math.PI * r) / 0.07));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + y * 3,
        nx = Math.cos(a),
        nz = Math.sin(a);
      if (nz > 0.6 && Math.abs(nx) < 0.5 && y < 2.42) continue; // the face: left dark but for the slit
      skin(nx * r, y, nz * r * 0.9, nx, nz, 'head', 0.2);
    }
  }
  stroke([0, 2.2, 0.085], [0, 2.38, 0.075], EYE, 2.6, S * 0.8, 'head', 0.04);
  for (const sd of [1, -1]) lit(sd * 0.03, 2.4, 0.07, '*', S * 0.9, 3.4, EYE, 'eye');
  // the crown: five long thin spikes, the middle one tallest
  const SPIKE = [0.1, 0.15, 0.2, 0.15, 0.1];
  SPIKE.forEach((h, k) => {
    const x = (k - 2) * 0.025;
    stroke([x, 2.46, 0.02], [x * 1.12, 2.46 + h, 0.02], SHARD, 2.2, S * 0.8, 'head', 0.05);
    lit(x * 1.12, 2.49 + h, 0.02, '^', S * 0.9, 2.8, SHARD, 'head');
  });
  // the black sun, well above the crown: a dim rim round the dark middle, a ring of dots, and a ring of marks, the rings turning slowly
  // each point is stored where it starts on its ring (x, y), so code that reads the shape without the animation (the change into the second form,
  // the bestiary's framing) sees the ring
  const ring = (n: number, r: number, sp: number, ch: string, s: number, b: number, col: Color) => {
    for (let k = 0; k < n; k++) {
      const ph = (k / n) * Math.PI * 2;
      lit(Math.cos(ph) * r, 3.12 + Math.sin(ph) * r, -0.08, ch, s, b, col, 'halo', { cy: 3.12, r, sp, ph });
    }
  };
  ring(24, 0.15, 0.05, '.', S * 0.9, 0.9, DARK);
  ring(28, 0.24, 0.15, '.', S * 1.1, 2.4, SHARD);
  ring(12, 0.39, -0.1, "'", S * 1.4, 3.0, SHARD);
  // the long sword, taller than the king: held at the chest in its right hand (on the left as it faces you), the blade up past the crown, the shaft down to the floor
  const SX = -0.55,
    SZ = 0.12;
  stroke([-0.3, 1.9, 0.05], [SX + 0.03, 1.74, SZ], EDGE, 1.4, S, 'body', 0.06); // the arm
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    lit(SX + Math.cos(a) * 0.045, 1.7 + (k % 2) * 0.05, SZ + Math.sin(a) * 0.035, mpick(['#', '%']), S, 1.1, EDGE, 'body'); // the gauntlet
  }
  stroke([SX, 0.02, SZ], [SX, 1.6, SZ], GRIP, 1.0, S * 0.6, 'body', 0.09); // the shaft under the grip
  stroke([SX, 1.62, SZ], [SX, 1.83, SZ], GRIP, 1.4, S, 'body', 0.06); // the grip
  stroke([SX - 0.12, 1.86, SZ], [SX + 0.12, 1.86, SZ], SHARD, 3.0, S, 'body', 0.05); // the cross guard
  for (const e of [-0.02, 0.02]) stroke([SX + e, 1.9, SZ], [SX + e * 0.5, 3.05, SZ], BLADE, 2.4, S * 0.85, 'body', 0.08);
  for (let y = 1.95; y < 3.0; y += 0.15) lit(SX, y, SZ, '.', S * 0.8, 1.0, BLADE, 'body');
  lit(SX, 3.18, SZ, '^', S, 3.0, BLADE, 'body');
  // the sword's ornaments: a pommel, curled ends of the guard, rings at the foot of the blade
  lit(SX, 1.6, SZ, 'o', S * 1.1, 2.0, SHARD, 'body');
  lit(SX - 0.13, 1.88, SZ, '(', S, 2.0, SHARD, 'body');
  lit(SX + 0.13, 1.88, SZ, ')', S, 2.0, SHARD, 'body');
  for (const y of [2.0, 2.06, 2.12]) lit(SX, y, SZ + 0.01, 'o', S * 0.6, 1.6, BLADE, 'body');
  // the heart, always shown
  const hz = shadowCloakHalf(1.6) * ZS + 0.02;
  lit(0, 1.6, hz, '*', S * 2.6, 4.0, HEART, 'heart');
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    lit(Math.cos(a) * 0.1, 1.6 + Math.sin(a) * 0.1, hz, '+', S * 0.9, 2.4, HEART, 'heart');
  }
  // cracks of the seal: each opens below its threshold of health, with the starry dark behind it
  for (let c = 0; c < 7; c++) {
    const th = 0.95 - c * 0.06;
    let a = mr() * Math.PI * 2 * 0.8 - 0.4 * Math.PI + Math.PI / 2,
      y = 0.3 + mr() * 1.3;
    for (let k = 0; k < 9; k++) {
      const r = shadowCloakHalf(y) + 0.01,
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

// ---- 忘れられた獣（もとは src/game/10-bodies-beast.js）
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
 * 忘れられた獣の形（もとは src/game/10-bodies-beast.js）：年代記から決まる体の作り spec（獣・竜・大蛇・蛾・百足）の上に、特徴
 * （六本脚の・翼なき・千の眼を持つ・燃える鱗の・影を喰らう・歌う）を重ねる。体の色と、飾りの色（beastAcc）
 */
export function beastForm2(ty: { col: Color; spec?: BeastBody | undefined }): Body {
  const spec = must(ty.spec, '忘れられた獣の体の作り spec'),
    C = ty.col,
    A = beastAcc(C),
    H = q3(BEAST_S),
    { S, pts, lit, stroke, ell, tube } = H;
  const R = ['.', ':', ...spec.glyphs.slice(0, 2), '#'],
    BONE: Color = [0.9, 0.86, 0.76],
    EYE: Color = [1, 0.85, 0.35];
  const belly = (_ox: number, oy: number): Color => (oy < -0.5 ? A : C),
    belly4 = (_ox: number, oy: number): Color => (oy < -0.4 ? A : C);
  if (spec.kind === '竜') {
    const d = dragonForm({ ...ty, scale: 2.35 });
    for (const p of d) {
      if (!p.col || p.col === ty.col) p.col = C;
    }
    pts.push(...d);
  } else if (spec.plan === 'quad') {
    tube([0, 0.5, -0.5], [0, 0.7, 0.35], 0.24, 0.3, R, belly, 'body', undefined, 0.2);
    ell([0, 0.95, 0.22], 0.24, 0.18, 0.24, R, () => C, 'body');
    for (let z = -0.45; z <= 0.42; z += 0.13)
      for (const x of [-0.14, 0, 0.14]) {
        const top = 0.5 + (0.2 * (z + 0.5)) / 0.85 + (Math.abs(z - 0.22) < 0.2 ? 0.38 : 0.28);
        lit(x, top, z, '#', 1.05, 1.4, A, 'body');
        lit(x, top + 0.07, z - 0.02, '^', 1, 1.6, A, 'body');
      }
    const legs: readonly (readonly [number, number])[] =
      spec.legs === 6
        ? [
            [0.34, 0.62],
            [-0.05, 0.58],
            [-0.45, 0.55],
          ]
        : [
            [0.34, 0.62],
            [-0.45, 0.55],
          ];
    legs.forEach(([z, top], k) => {
      for (const sd of [-1, 1]) {
        const part = (k % 2 === 0) === sd > 0 ? 'legL' : 'legR',
          ex = { piv: top, pz: z };
        tube([sd * 0.24, top, z], [sd * 0.3, 0.22, z + 0.06], 0.11, 0.08, R, C, part, ex, 0.2);
        tube([sd * 0.3, 0.22, z + 0.06], [sd * 0.3, 0.03, z + 0.1], 0.08, 0.07, R, C, part, ex);
        for (let c = 0; c < 3; c++) lit(sd * 0.3 + (c - 1) * 0.05, 0.01, z + 0.18, 'v', 0.9, 1.5, BONE, part, ex);
      }
    });
    ell([0, 0.56, 0.78], 0.18, 0.15, 0.2, R, (_nx, ny) => (ny < -0.4 ? A : C), 'head');
    for (const sd of [-1, 1]) {
      lit(sd * 0.08, 0.6, 0.95, '*', 1, 3.4, EYE, 'head');
      stroke([sd * 0.12, 0.66, 0.8], [sd * 0.3, 0.84, 0.62], BONE, 1.6, 1, 'head');
      stroke([sd * 0.3, 0.84, 0.62], [sd * 0.36, 0.8, 0.42], BONE, 1.6, 1, 'head');
      lit(sd * 0.07, 0.42, 0.95, '^', 1, 2.2, BONE, 'head');
    }
    tube([0, 0.5, -0.55], [0, 0.28, -1.0], 0.14, 0.05, R, C, 'tail', { piv: 1 });
  } else if (spec.plan === 'serpent') {
    const coil: Vec3[] = [];
    for (let t = 0; t <= 1; t += 0.04) {
      const a = t * Math.PI * 2 * 2.2,
        r = 0.85 - 0.45 * t;
      coil.push([Math.cos(a) * r, 0.18 + 0.3 * t, Math.sin(a) * r]);
    }
    for (let i = 0; i < coil.length - 1; i++) tube(nth(coil, i), nth(coil, i + 1), 0.22, 0.22, R, belly4, 'body');
    const e = nth(coil, coil.length - 1),
      neck: Vec3[] = [e, [e[0] * 0.5, 0.8, e[2] * 0.5 + 0.15], [0, 1.15, 0.45], [0, 1.2, 0.75]];
    for (let i = 0; i < neck.length - 1; i++) tube(nth(neck, i), nth(neck, i + 1), 0.2 - i * 0.03, 0.18 - i * 0.03, R, belly4, 'head');
    ell([0, 1.2, 0.88], 0.14, 0.11, 0.2, R, () => C, 'head');
    for (const sd of [-1, 1]) lit(sd * 0.07, 1.25, 1.02, '*', 1, 3.4, EYE, 'head');
    for (let k = 0; k < 6; k++) stroke([0, 1.3 - k * 0.03, 0.85 - k * 0.1], [0, 1.5 - k * 0.05, 0.75 - k * 0.12], A, 1.8, 1, 'head');
    for (let i = 2; i < coil.length; i += 2) {
      const p = nth(coil, i);
      stroke([p[0], p[1] + 0.2, p[2]], [p[0], p[1] + 0.34, p[2]], A, 1.4, 0.9, 'body');
    }
  } else if (spec.plan === 'moth') {
    ell([0, 0, 0.1], 0.18, 0.17, 0.2, FUR, () => C, 'body');
    ell([0, -0.04, -0.4], 0.15, 0.14, 0.36, FUR, (_nx, _ny, nz) => (Math.sin(nz * 12) > 0.3 ? A : C), 'body');
    ell([0, 0.02, 0.36], 0.12, 0.11, 0.11, FUR, () => C, 'head');
    for (const sd of [-1, 1]) {
      lit(sd * 0.07, 0.05, 0.44, '@', 1.3, 3.6, EYE, 'head');
      let pv: Vec3 = [sd * 0.05, 0.12, 0.42];
      for (let k = 1; k <= 6; k++) {
        const nx: Vec3 = [sd * (0.05 + k * 0.06), 0.12 + k * 0.07, 0.42 + k * 0.04];
        stroke(pv, nx, A, 1.4, 0.85, 'head');
        lit(nx[0] + sd * 0.04, nx[1] - 0.02, nx[2], '-', 0.7, 1.2, A, 'head');
        pv = nx;
      }
    }
    for (const sd of [-1, 1])
      for (let l = 0; l < 3; l++) stroke([sd * 0.1, -0.12, 0.15 - l * 0.1], [sd * 0.2, -0.4, 0.2 - l * 0.12], C, 1.0, 0.85, 'body');
    for (const sd of [-1, 1])
      for (const [z0, rmax] of [
        [0.08, 1.35],
        [-0.22, 0.95],
      ] as const)
        for (let r = 0.2; r <= rmax; r += S * 1.0)
          for (let dz = -0.32; dz <= 0.32; dz += S * 1.0) {
            const f = r / rmax,
              edge = Math.abs(dz) > 0.3 * (1 - f * 0.35);
            if (Math.abs(dz) > 0.34 * (1 - f * 0.35)) continue;
            const spot = Math.hypot(r - rmax * 0.6, dz) < 0.12,
              ch = spot ? (Math.hypot(r - rmax * 0.6, dz) < 0.05 ? '@' : 'O') : edge ? '~' : mpick(['%', ':', '.']);
            lit(0, 0.04 + dz * 0.2, z0 + dz, ch, 1, spot ? 2.6 : edge ? 1.4 : 0.95, spot ? A : edge ? A : C, 'wing', { sd, r });
          }
  } else if (spec.plan === 'centipede') {
    const segs = 14;
    for (let i = 0; i < segs; i++) {
      const f = i / (segs - 1),
        z = 0.9 - f * 2.4,
        y = f < 0.25 ? 0.9 - f * 2.6 : 0.26,
        c = [0, y, z] as const;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI,
          x = Math.cos(a) * 0.22,
          yy = Math.sin(a) * 0.16;
        lit(
          c[0] + x,
          c[1] + yy,
          c[2],
          k === 0 || k === 11 ? '=' : mpick(['#', '%', '=']),
          1,
          1.0 + 0.4 * Math.sin(a),
          k === 0 || k === 11 ? A : C,
          'seg',
          { piv: i },
        );
      }
      for (const sd of [-1, 1]) {
        const part = (i % 2 === 0) === sd > 0 ? 'legL' : 'legR',
          top = c[1];
        stroke([sd * 0.22, top, z], [sd * 0.42, top + 0.1, z + 0.04], C, 1.1, 0.9, part, { piv: top, pz: z });
        stroke([sd * 0.42, top + 0.1, z + 0.04], [sd * 0.5, 0.02, z + 0.08], C, 1.1, 0.9, part, { piv: top, pz: z });
      }
    }
    const hd: Vec3 = [0, 0.98, 1.0];
    ell(hd, 0.15, 0.12, 0.14, R, () => C, 'head');
    for (const sd of [-1, 1]) {
      lit(sd * 0.07, 1.02, 1.12, '*', 1, 3.2, EYE, 'head');
      stroke([sd * 0.08, 0.92, 1.12], [sd * 0.16, 0.86, 1.3], A, 1.8, 1, 'head');
      stroke([sd * 0.16, 0.86, 1.3], [sd * 0.06, 0.84, 1.4], A, 1.8, 1, 'head');
      let pv: Vec3 = [sd * 0.06, 1.08, 1.1];
      for (let k = 1; k <= 6; k++) {
        const nx: Vec3 = [sd * (0.06 + k * 0.05), 1.08 + k * 0.08, 1.1 + k * 0.07];
        stroke(pv, nx, A, 1.3, 0.85, 'head');
        pv = nx;
      }
    }
  }
  // 体の上の特徴
  if (!spec.wings) for (let i = pts.length - 1; i >= 0; i--) if (pts[i]?.part === 'wing' && spec.plan !== 'moth') pts.splice(i, 1);
  const bodyPts = pts.filter((p) => p.part !== 'wing');
  if (spec.eyes > 0)
    for (let k = 0; k < 32; k++) {
      const p = nth(bodyPts, Math.floor(mr() * bodyPts.length));
      lit(p.x * 1.02, p.y + 0.01, p.z * 1.02, mr() < 0.5 ? 'o' : '*', 0.9, 3.2, [1, 0.9, 0.4], p.part, { piv: p.piv, pz: p.pz, ti: p.ti });
    }
  if (spec.fire) {
    for (let k = 0; k < 50; k++) {
      const p = nth(bodyPts, Math.floor(mr() * bodyPts.length));
      p.col = [1, 0.4, 0.12];
      p.g = G(mpick(['/', '\\']));
      p.b = 2.4;
    }
    const tops = bodyPts
      .slice()
      .sort((a, b) => b.y - a.y)
      .slice(0, 14);
    for (const p of tops)
      for (let q = 0; q < 3; q++) {
        const f = q / 2;
        lit(p.x, p.y + 0.06 + f * 0.14, p.z, '^', 1 - f * 0.3, 2.2 + 1.2 * f, [1, 0.3 + 0.55 * f, 0.08 + 0.4 * f], 'flame', { fh: f });
      }
  }
  if (spec.shadow) {
    for (const p of pts) {
      if (p.col === EYE) continue;
      if (mr() < 0.22) {
        p.col = [0.88, 0.84, 1.0];
        p.b = 2.2;
      } else {
        p.col = [0.24, 0.17, 0.38];
        p.b *= 0.6;
      }
    }
  }
  if (spec.sing) {
    const tops = bodyPts
      .slice()
      .sort((a, b) => b.y - a.y)
      .slice(0, 7);
    for (const p of tops) {
      for (let q = 0; q < 3; q++) {
        const dx = (q - 1) * 0.06;
        for (let j = 1; j <= 3; j++) lit(p.x + (dx * j) / 3, p.y + j * 0.07, p.z, j === 3 ? '*' : '|', 1, 2.4, [0.6, 0.95, 1.0], 'pulse');
      }
    }
  }
  pts.noExtra = true;
  return pts;
}

/** 図鑑の見本の忘れられた獣（開発用。5つの体の作りと特徴を1つずつ） */
export function beastSamples(): {
  seed: number;
  name: string;
  col: Color;
  spec: BeastBody;
  lore: string;
  scale: number;
  fl: number;
  flier: boolean;
}[] {
  const K = [
    ['獣', '六本脚の', 'quad'],
    ['竜', '燃える鱗の', 'quad'],
    ['大蛇', '千の眼を持つ', 'serpent'],
    ['蛾', '歌う', 'moth'],
    ['百足', '影を喰らう', 'centipede'],
  ] as const;
  const GLYPHS = [
    ['#', '%', '&'],
    ['=', '~', 'x'],
    ['%', '*', '#'],
    ['&', '8', '%'],
    ['#', '=', '%'],
  ] as const;
  return K.map(([kind, feat, plan], i) => ({
    seed: -1 - i,
    name: `${feat}${kind}（見本）`,
    col: feat === '燃える鱗の' ? [1.0, 0.42, 0.14] : feat === '影を喰らう' ? [0.5, 0.32, 0.8] : hsl2rgb(i * 0.21 + 0.05, 0.75, 0.6),
    spec: {
      plan,
      kind,
      legs: feat === '六本脚の' ? 6 : 4,
      wings: kind === '竜' || kind === '蛾',
      eyes: feat === '千の眼を持つ' ? 26 : 0,
      fire: feat === '燃える鱗の',
      shadow: feat === '影を喰らう',
      sing: feat === '歌う',
      glyphs: [...nth(GLYPHS, i)],
    },
    lore: '開発用の見本。探索で出会った獣は、名前と年代記の一節とともにここへ記される。',
    scale: plan === 'moth' ? 3.0 : 3.6,
    fl: plan === 'moth' ? 2.4 : 0,
    flier: plan === 'moth',
  }));
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
