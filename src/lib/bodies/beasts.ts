// 四つ足・大きな生き物（オーガ・竜も）・死者の形（もとは src/game/09-bodies-creatures.js）。q2・q3 の道具で、面の向きに合わせて文字と明るさを決める。
import { nth } from '../array.ts';
import type { Color } from '../color.ts';
import { G } from '../glyphs.ts';
import { clamp } from '../rng.ts';
import { mpick, mr } from '../random.ts';
import { type Body, type BodyType, type Extra, type Ramp, type Vec3, FUR, MUD, SCALE, SKINR, STONE, q2, q3 } from './kit.ts';

type Leg = readonly [number, number, string];

export function ratForm(ty: BodyType): Body {
  const { pts, lit, stroke, ell } = q2(ty),
    GREY: Color = [0.6, 0.54, 0.48],
    PINK: Color = [0.95, 0.62, 0.66],
    EYE: Color = [1, 0.3, 0.25];
  ell([0, 0.3, 0], 0.22, 0.2, 0.38, FUR, (_nx, ny) => (ny < -0.5 ? [0.75, 0.7, 0.64] : GREY), 'body');
  ell([0, 0.27, 0.42], 0.13, 0.12, 0.14, FUR, () => GREY, 'head');
  lit(0, 0.23, 0.6, '>', 1, 1.6, PINK, 'snout');
  for (const sd of [-1, 1]) {
    lit(sd * 0.1, 0.25, 0.56, '-', 0.8, 1.4, [0.9, 0.88, 0.85], 'snout');
    lit(sd * 0.14, 0.26, 0.53, '-', 0.8, 1.2, [0.9, 0.88, 0.85], 'snout');
    lit(sd * 0.1, 0.4, 0.38, sd < 0 ? '(' : ')', 1, 1.4, PINK, 'head');
    lit(sd * 0.05, 0.31, 0.53, '.', 0.7, 3.2, EYE, 'head');
  }
  for (const [x, z, part] of [
    [-0.12, 0.22, 'legL'],
    [0.12, 0.22, 'legR'],
    [-0.12, -0.22, 'legR'],
    [0.12, -0.22, 'legL'],
  ] as const satisfies readonly Leg[]) {
    stroke([x, 0.18, z], [x, 0.02, z + 0.03], GREY, 1.0, 0.9, part, { piv: 0.18, pz: z });
    lit(x, 0.01, z + 0.06, '_', 0.8, 1.1, PINK, part, { piv: 0.18, pz: z });
  }
  for (let k = 0; k < 14; k++) {
    const f = k / 13;
    lit(Math.sin(f * 3) * 0.08, 0.24 - 0.2 * f, -0.38 - f * 0.75, k % 2 ? '~' : '-', 0.8, 1.2, PINK, 'tail', { piv: k * 0.5 });
  }
  return pts;
}

export function jackalForm(ty: BodyType): Body {
  const { S, pts, lit, stroke, ell } = q2(ty),
    SAND: Color = [0.82, 0.66, 0.42],
    DARK: Color = [0.42, 0.3, 0.2],
    WHITE: Color = [0.92, 0.88, 0.8],
    EYE: Color = [1, 0.85, 0.3];
  for (let z = -0.4; z <= 0.42; z += S * 0.8) {
    const f = (z + 0.4) / 0.82,
      r = 0.11 + 0.06 * Math.sin(Math.PI * Math.min(1, f * 1.3)) + (f > 0.7 ? 0.03 : 0),
      ry = 0.15 + 0.05 * f,
      cy = 0.72 + 0.06 * f,
      n = Math.max(5, Math.round((2 * Math.PI * r) / (S * 0.85)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2,
        nx = Math.cos(a),
        ny = Math.sin(a);
      lit(
        nx * r,
        cy + ny * ry,
        z,
        ny > 0.75 ? '"' : ny < -0.4 ? ':' : mpick(['%', '"', ',']),
        1,
        ny > 0.75 ? 1.0 : 1.2,
        ny > 0.75 ? DARK : ny < -0.4 ? WHITE : SAND,
      );
    }
  }
  ell([0, 0.9, 0.52], 0.09, 0.09, 0.1, FUR, (_nx, ny) => (ny < -0.3 ? WHITE : SAND), 'head');
  stroke([0, 0.87, 0.6], [0, 0.82, 0.84], SAND, 1.3, 0.9, 'head');
  lit(0, 0.82, 0.88, '.', 0.8, 1.8, [0.2, 0.15, 0.12], 'head');
  for (const sd of [-1, 1]) {
    stroke([sd * 0.05, 0.97, 0.5], [sd * 0.09, 1.17, 0.47], SAND, 1.4, 0.9, 'head');
    lit(sd * 0.09, 1.21, 0.47, '^', 1, 1.6, SAND, 'head');
    lit(sd * 0.04, 0.93, 0.6, '.', 0.7, 3.2, EYE, 'head');
  }
  for (const [x, z, part] of [
    [-0.08, 0.34, 'legL'],
    [0.08, 0.34, 'legR'],
    [-0.08, -0.32, 'legR'],
    [0.08, -0.32, 'legL'],
  ] as const satisfies readonly Leg[]) {
    stroke([x, 0.62, z], [x, 0.3, z - 0.04], SAND, 1.1, 0.85, part, { piv: 0.62, pz: z });
    stroke([x, 0.3, z - 0.04], [x, 0.02, z + 0.02], SAND, 1.1, 0.85, part, { piv: 0.62, pz: z });
  }
  for (let k = 0; k < 8; k++) {
    const f = k / 7;
    for (const o of [-0.03, 0.03])
      lit(o, 0.68 - 0.38 * f, -0.42 - 0.18 * f, mpick(['"', '%']), 1, 1.1, f > 0.75 ? WHITE : SAND, 'tail', { piv: k * 0.4 });
  }
  return pts;
}

export function grazerForm(ty: BodyType): Body {
  const { pts, lit, stroke, ell } = q2(ty),
    BROWN: Color = [0.62, 0.46, 0.3],
    MOSS: Color = [0.45, 0.75, 0.35];
  ell(
    [0, 0.45, 0],
    0.38,
    0.32,
    0.48,
    FUR,
    () => BROWN,
    'body',
    null,
    (_nx, ny) => ny > 0.45,
  );
  for (let i = 0; i < 40; i++) {
    const y = 1 - ((i + 0.5) / 40) * 0.55,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996;
    lit(Math.cos(a) * rr * 0.4, 0.45 + y * 0.34, Math.sin(a) * rr * 0.5, mpick([',', '"', '%', '"']), 1, 1.2 + 0.3 * mr(), MOSS);
  }
  for (const [x, z, cap] of [
    [0.12, 0.1, [1, 0.35, 0.3]],
    [-0.14, -0.12, [0.95, 0.95, 0.9]],
    [0.05, -0.28, [1, 0.35, 0.3]],
    [-0.08, 0.24, [0.95, 0.95, 0.9]],
  ] as const) {
    lit(x, 0.8, z, '|', 0.9, 1.2, [0.92, 0.9, 0.82], 'sway');
    lit(x, 0.9, z, 'n', 1.1, 1.8, cap, 'sway');
  }
  ell([0, 0.24, 0.56], 0.13, 0.12, 0.13, FUR, () => BROWN, 'graze');
  for (const sd of [-1, 1]) lit(sd * 0.06, 0.28, 0.66, '.', 0.7, 2.4, [0.2, 0.15, 0.1], 'graze');
  lit(0, 0.15, 0.68, '-', 0.8, 1.2, [0.4, 0.3, 0.2], 'graze');
  for (const [x, z, part] of [
    [-0.2, 0.26, 'legL'],
    [0.2, 0.26, 'legR'],
    [-0.2, -0.26, 'legR'],
    [0.2, -0.26, 'legL'],
  ] as const satisfies readonly Leg[]) {
    for (const o of [-0.03, 0.03]) stroke([x + o, 0.2, z], [x + o, 0.02, z], BROWN, 1.0, 1, part, { piv: 0.2, pz: z });
  }
  return pts;
}

export function salamanderForm(ty: BodyType): Body {
  const { S, pts, lit, stroke } = q2(ty),
    BLACK: Color = [0.3, 0.26, 0.28],
    EMBER: Color = [1, 0.35, 0.12];
  for (let z = 0.6; z >= -1.25; z -= S * 0.8) {
    const f = (0.6 - z) / 1.85,
      r = 0.15 * (1 - f * 0.85),
      n = Math.max(4, Math.round((2 * Math.PI * r) / (S * 0.9)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2,
        nx = Math.cos(a),
        ny = Math.sin(a);
      lit(
        nx * r,
        0.17 * (1 - f * 0.6) + ny * r * 0.55,
        z,
        ny > 0.6 ? '=' : mpick(['%', '#', ':']),
        1,
        ny > 0.3 ? 1.1 : 0.8,
        BLACK,
        'slither',
      );
    }
    if (f > 0.08 && f < 0.75 && Math.round(z * 20) % 2 === 0)
      lit((mr() - 0.5) * 0.06, 0.17 * (1 - f * 0.6) + r * 0.6, z, mpick(['/', '\\']), 1, 2.6, EMBER, 'slither');
  }
  for (const sd of [-1, 1]) {
    lit(sd * 0.07, 0.24, 0.62, '.', 0.8, 3.2, [1, 0.6, 0.2], 'slither');
  }
  for (const [z, part] of [
    [0.32, 'legL'],
    [-0.2, 'legR'],
  ] as const)
    for (const sd of [-1, 1]) {
      const p2 = sd > 0 ? part : part === 'legL' ? 'legR' : 'legL';
      stroke([sd * 0.12, 0.12, z], [sd * 0.32, 0.06, z + 0.06], BLACK, 1.0, 0.9, p2, { piv: 0.12, pz: z });
      stroke([sd * 0.32, 0.06, z + 0.06], [sd * 0.36, 0.01, z + 0.14], BLACK, 1.0, 0.9, p2, { piv: 0.12, pz: z });
    }
  for (let q = 0; q < 5; q++) {
    const f = q / 4;
    lit(
      (mr() - 0.5) * 0.05,
      0.06 + f * 0.22,
      -1.28 - 0.04 * f,
      '^',
      1.05 - 0.3 * f,
      2.2 + 1.2 * f,
      [1, 0.35 + 0.55 * f, 0.1 + 0.4 * f],
      'flame',
      { fh: f },
    );
  }
  return pts;
}

export function trollForm2(ty: BodyType): Body {
  const { S, pts, put, lit, stroke, ell, tube } = q3(ty),
    SK: Color = [0.4, 0.48, 0.36],
    BELLY: Color = [0.62, 0.6, 0.46],
    ARM: Color = [0.34, 0.42, 0.31],
    MOSS: Color = [0.45, 0.88, 0.32],
    CLOTH: Color = [0.55, 0.38, 0.22],
    WOOD: Color = [0.5, 0.36, 0.22],
    ST: Color = [0.62, 0.62, 0.6],
    EYE: Color = [1, 0.85, 0.3],
    IVORY: Color = [0.95, 0.92, 0.8];
  // 腕は肩（高さ 1.42・奥行き 0.4）を軸に回る
  const SHOULDER = { piv: 1.42, pz: 0.4 };
  // 腕の一部の楕円（ell は回す軸を受け取らないので、作った点に肩の軸を入れる。入れないと、歩く時に床の高さを軸に回って腕から離れる）
  const armEll: typeof ell = (...a) => {
    const n0 = pts.length;
    ell(...a);
    for (let i = n0; i < pts.length; i++) Object.assign(nth(pts, i), SHOULDER);
  };
  // 脚：短く太く、がに股
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'legL' : 'legR',
      ex = { piv: 0.62, pz: 0 };
    tube([sd * 0.18, 0.62, -0.04], [sd * 0.3, 0.32, 0.06], 0.14, 0.11, SKINR, SK, part, ex, 0.15);
    tube([sd * 0.3, 0.32, 0.06], [sd * 0.26, 0.06, 0.04], 0.11, 0.1, SKINR, SK, part, ex, 0.1);
    for (let c = 0; c < 3; c++) lit(sd * 0.26 + (c - 1) * 0.06, 0.03, 0.16, 'm', 1, 1.1, SK, part, ex);
  }
  // 胴：腰は細く、肩は広く盛り上がり、背は丸く前に屈む。腹は少し出る
  for (let y = 0.6; y <= 1.56; y += S * 0.85) {
    const f = (y - 0.6) / 0.96,
      rx = 0.24 + 0.2 * Math.sin(Math.min(1, f / 0.82) * Math.PI * 0.5) - (f > 0.82 ? (f - 0.82) * 1.1 : 0),
      lean = 0.38 * f * f,
      n = Math.max(6, Math.round((2 * Math.PI * rx) / (S * 0.85)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2,
        sn = Math.sin(a),
        // 背中のこぶと、出た腹
        rz = sn < 0 ? 0.22 + 0.1 * Math.sin(f * Math.PI) : 0.2 + 0.07 * Math.max(0, Math.sin(((f - 0.05) / 0.5) * Math.PI)),
        moss = (sn < -0.3 && f > 0.35) || (f > 0.8 && sn < 0.6),
        belly = !moss && sn > 0.45 && f < 0.75;
      // 肌は面の向き（前に屈む分、上を向く）で明るさと文字を決める。苔は、光の当たらない背中でも見えるように明るさを決めて置く
      if (moss) lit(Math.cos(a) * rx, y, sn * rz + lean, mpick(['%', '"', '&']), 1.2, 1.4, MOSS);
      else put(Math.cos(a) * rx, y, sn * rz + lean, Math.cos(a) / rx, 0.25 + f * 0.5, sn / rz, SKINR, belly ? BELLY : SK);
    }
  }
  // 腰布：腰のまわりと、前に垂れる布
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    lit(Math.cos(a) * 0.27, 0.6, Math.sin(a) * 0.23, '=', 1, 1.1, CLOTH);
  }
  for (let y = 0.54; y >= 0.36; y -= S * 0.8) for (const x of [-0.07, 0, 0.07]) lit(x, y, 0.26 + (0.6 - y) * 0.15, '#', 1, 0.9, CLOTH);
  // 腕：太く長い。前腕がふくらみ、拳は地面の近く
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'armL' : 'armR',
      ex = SHOULDER;
    tube([sd * 0.44, 1.42, 0.38], [sd * 0.66, 0.98, 0.46], 0.12, 0.09, SKINR, ARM, part, ex, 0.2);
    tube([sd * 0.66, 0.98, 0.46], [sd * 0.5, 0.42, 0.7], 0.09, 0.12, SKINR, ARM, part, ex, 0.3);
    armEll([sd * 0.48, 0.32, 0.74], 0.1, 0.09, 0.1, SKINR, () => ARM, part);
    for (let c = 0; c < 4; c++) lit(sd * 0.48 + (c - 1.5) * 0.045, 0.22, 0.82, 'v', 1, 1.3, ARM, part, ex);
  }
  // 頭：肩より低く、前へ突き出る。頭の上には苔
  ell([0, 1.44, 0.68], 0.16, 0.14, 0.15, SKINR, (_x, ny, nz) => (ny > 0.5 ? MOSS : nz > 0.45 ? BELLY : SK), 'head');
  // 大きな下あごと、上に向いた牙
  ell([0, 1.33, 0.74], 0.14, 0.06, 0.1, SKINR, () => BELLY, 'head');
  for (const sd of [-1, 1]) {
    lit(sd * 0.09, 1.41, 0.86, '^', 1.4, 1.3, IVORY, 'head');
    // 眉の張り出しの下の目
    lit(sd * 0.06, 1.51, 0.81, '-', 1, 0.8, SK, 'head');
    lit(sd * 0.06, 1.48, 0.83, '.', 0.7, 1.8, EYE, 'head');
    // とがった耳
    lit(sd * 0.21, 1.5, 0.62, sd < 0 ? '<' : '>', 1.4, 1.3, SK, 'head');
  }
  // 長い鼻
  stroke([0, 1.48, 0.83], [0, 1.4, 0.91], SK, 1.4, 1.2, 'head');
  // 棍棒：右手に握り、先を前の床につける
  tube([0.48, 0.34, 0.76], [0.46, 0.16, 1.18], 0.035, 0.05, STONE, WOOD, 'armR', SHOULDER);
  armEll([0.46, 0.17, 1.32], 0.16, 0.15, 0.17, STONE, () => WOOD, 'armR');
  for (let q = 0; q < 8; q++)
    lit(
      0.46 + (mr() - 0.5) * 0.38,
      0.17 + (mr() - 0.5) * 0.3,
      1.32 + (mr() - 0.5) * 0.38,
      mpick(['#', '%']),
      1.1,
      1.2,
      ST,
      'armR',
      SHOULDER,
    );
  return pts;
}

export function golemForm2(ty: BodyType): Body {
  const { S, pts, put, lit, ell, tube } = q3(ty),
    ST: Color = [0.58, 0.52, 0.44],
    BLUE: Color = [0.42, 0.48, 0.6],
    MOSS: Color = [0.45, 0.82, 0.34],
    GLOW: Color = [0.45, 0.85, 1.0],
    ROCK: Ramp = ['.', ':', '=', '%', '#'];
  // 腕は肩（高さ 1.34・奥行き 0.06）を、脚は腰（高さ 0.62）を軸に回る
  const SHOULDER = { piv: 1.34, pz: 0.06 },
    HIP = { piv: 0.62, pz: 0 };
  // 楕円の点に回す軸を入れる（ell は軸を受け取らないので、作った点に入れる）
  const ellAt = (ex: Extra | null, ...a: Parameters<typeof ell>): void => {
    const n0 = pts.length;
    ell(...a);
    if (ex) for (let i = n0; i < pts.length; i++) Object.assign(nth(pts, i), ex);
  };
  // 切り出した石の段：断面は角の丸い四角（|x/rx|^4 + |z/rz|^4 = 1）。段と段の間は、すき間（継ぎ目）を空ける。
  // 行は下の端 y0 から上の端 y1 まで等しい間隔で置く（最後の行が y1 に来る）。cap が真なら、上の面も張る
  type Slab = {
    y0: number;
    y1: number;
    rxAt: (f: number) => number;
    rzAt: (f: number, back: boolean) => number;
    zAt: (f: number) => number;
  };
  const slab = (d: Slab, col: Color, part: string, cap: boolean): void => {
    const st = S * 0.85,
      nr = Math.max(1, Math.round((d.y1 - d.y0) / st));
    for (let j = 0; j <= nr; j++) {
      const f = j / nr,
        y = d.y0 + (d.y1 - d.y0) * f,
        rx = d.rxAt(f),
        z0 = d.zAt(f),
        // 上と下の縁の行は、面を斜め上・斜め下へ向けて、段の角を見せる（横の向きを長さ 1 にしてから、縦を混ぜる）
        tilt = j === nr ? 0.55 : j === 0 ? -0.6 : 0.05,
        n = Math.max(8, Math.round((2 * Math.PI * Math.max(rx, d.rzAt(f, false))) / st));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2,
          c = Math.cos(a),
          sn = Math.sin(a),
          rz = d.rzAt(f, sn < 0),
          x = Math.sign(c) * Math.sqrt(Math.abs(c)) * rx,
          z = Math.sign(sn) * Math.sqrt(Math.abs(sn)) * rz,
          hx = (Math.sign(x) * Math.pow(Math.abs(x / rx), 3)) / rx,
          hz = (Math.sign(z) * Math.pow(Math.abs(z / rz), 3)) / rz,
          hl = Math.hypot(hx, hz) || 1,
          side = Math.sqrt(1 - tilt * tilt);
        put(x, y, z + z0, (hx / hl) * side, tilt, (hz / hl) * side, ROCK, col, part);
      }
    }
    if (!cap) return;
    // 上の面：上の端の断面を、内へ小さくした輪で埋める（上から見て、中が透けないように）。面は真ん中ほど高い丸い屋根にする（平らだと、目の高さから見た時に点が1本の線に重なって、明るい縞になる）
    const rx = d.rxAt(1),
      z0 = d.zAt(1);
    for (let q = 1 - (st * 1.2) / rx; q > 0.05; q -= (st * 1.2) / rx) {
      const n = Math.max(4, Math.round((2 * Math.PI * rx * q) / (st * 1.2)));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + q * 3,
          c = Math.cos(a),
          sn = Math.sin(a);
        put(
          Math.sign(c) * Math.sqrt(Math.abs(c)) * rx * q,
          d.y1 + 0.1 * (1 - q * q),
          Math.sign(sn) * Math.sqrt(Math.abs(sn)) * d.rzAt(1, sn < 0) * q + z0,
          c * q * 0.9,
          1,
          sn * q * 0.9,
          ROCK,
          col,
          part,
        );
      }
    }
    put(0, d.y1 + 0.1, z0, 0, 1, 0, ROCK, col, part);
  };
  // 脚：短く太い。四角い足
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'legL' : 'legR';
    tube([sd * 0.2, 0.6, 0], [sd * 0.25, 0.32, 0.02], 0.15, 0.13, ROCK, ST, part, HIP, 0.1);
    tube([sd * 0.25, 0.32, 0.02], [sd * 0.25, 0.12, 0.03], 0.13, 0.15, ROCK, ST, part, HIP);
    for (let x = -0.12; x <= 0.12 + 1e-6; x += S * 0.8)
      for (let z = -0.08; z <= 0.24 + 1e-6; z += S * 0.8) put(sd * 0.25 + x, 0.07, z, 0, 1, 0.3, ROCK, ST, part, HIP);
  }
  // 腰の石
  slab({ y0: 0.56, y1: 0.7, rxAt: () => 0.26, rzAt: () => 0.19, zAt: () => 0 }, ST, 'body', false);
  // 胴：下は細く、上へ行くほど広い（逆三角）。少し前へ屈み、背は盛り上がる。腹と胸の2段
  slab(
    { y0: 0.78, y1: 1.02, rxAt: (f) => 0.28 + 0.06 * f, rzAt: (_f, back) => (back ? 0.25 : 0.23), zAt: (f) => 0.02 + 0.02 * f },
    ST,
    'body',
    false,
  );
  const CHEST: Slab = {
    y0: 1.1,
    y1: 1.42,
    rxAt: (f) => 0.36 + 0.12 * Math.sin(f * Math.PI * 0.6),
    rzAt: (f, back) => (back ? 0.3 + 0.07 * Math.sin(f * Math.PI) : 0.28),
    zAt: (f) => 0.05 + 0.04 * f,
  };
  slab(CHEST, ST, 'body', true);
  // 頭：肩の間に沈み、前へ出る。張り出した眉の下に目
  slab({ y0: 1.46, y1: 1.72, rxAt: (f) => 0.19 - 0.03 * f, rzAt: () => 0.15, zAt: () => 0.24 }, BLUE, 'head', true);
  for (let x = -0.17; x <= 0.17 + 1e-6; x += S * 0.7) lit(x, 1.66, 0.41, '=', 1.1, 1.3, BLUE, 'head');
  for (const sd of [-1, 1]) for (const o of [-0.025, 0.025]) lit(sd * 0.075 + o, 1.6, 0.41, '-', 0.9, 1.8, GLOW, 'head');
  for (let x = -0.08; x <= 0.08 + 1e-6; x += S * 0.7) lit(x, 1.52, 0.4, '-', 0.9, 0.7, BLUE, 'head');
  // 腕：肩に大岩、長い腕、大きな拳は地面の近く
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'armL' : 'armR';
    ellAt(
      SHOULDER,
      [sd * 0.58, 1.42, 0.06],
      0.25,
      0.2,
      0.24,
      ROCK,
      () => BLUE,
      part,
      null,
      (_nx, ny) => ny > 0.6,
    );
    tube([sd * 0.64, 1.24, 0.06], [sd * 0.8, 0.9, 0.16], 0.12, 0.1, ROCK, ST, part, SHOULDER);
    tube([sd * 0.8, 0.88, 0.16], [sd * 0.7, 0.54, 0.32], 0.12, 0.17, ROCK, ST, part, SHOULDER, 0.1);
    ellAt(SHOULDER, [sd * 0.68, 0.36, 0.36], 0.22, 0.19, 0.22, ROCK, () => BLUE, part);
    // 肩の上の苔（光の当たらない後ろからも見えるように、明るさを決めて置く）
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39996,
        r = 0.2 * Math.sqrt((i + 0.5) / 14);
      lit(
        sd * 0.58 + Math.cos(a) * r,
        1.58 + 0.02 * Math.sin(a * 3),
        0.04 + Math.sin(a) * r,
        mpick(['%', '"', '&']),
        1.1,
        1.35,
        MOSS,
        part,
        SHOULDER,
      );
    }
    // ひじの光るひび（前腕の付け根の外側の表面）
    lit(sd * 0.93, 0.87, 0.18, sd < 0 ? '/' : '\\', 1, 1.6, GLOW, part, SHOULDER);
  }
  // 背中の苔
  // 背中の苔：胸の段の上の方の、背中の面の少し外に置く
  for (let i = 0; i < 24; i++) {
    const f = 0.3 + mr() * 0.7,
      rx = CHEST.rxAt(f),
      x = (mr() - 0.5) * 1.6 * rx,
      back = CHEST.rzAt(f, true) * Math.pow(1 - Math.pow(Math.abs(x / rx), 4), 0.25);
    lit(x, CHEST.y0 + (CHEST.y1 - CHEST.y0) * f, CHEST.zAt(f) - back - 0.03, mpick(['%', '"', '&', ',']), 1.1, 1.3, MOSS);
  }
  for (let i = 0; i < 8; i++) lit((mr() - 0.5) * 0.26, 1.73, 0.22 + (mr() - 0.5) * 0.22, mpick(['"', '%']), 1, 1.3, MOSS, 'head');
  // 胸の真ん中の光る石と、そこから走るひび
  lit(0, 1.22, 0.37, '*', 1.1, 1.8, GLOW);
  for (const [dx, dy] of [
    [-1, 1],
    [1, 0.6],
    [-0.7, -1],
    [0.5, -1],
  ] as const) {
    for (let k = 1; k <= 3; k++) {
      const x = dx * 0.06 * k + (k % 2 ? 0.02 : -0.02),
        y = 1.22 + dy * 0.05 * k;
      lit(x, y, 0.36, Math.abs(dy) > Math.abs(dx) ? '|' : dx * dy > 0 ? '/' : '\\', 0.9, 1.5 - 0.15 * k, GLOW);
    }
  }
  return pts;
}

export function bogForm2(ty: BodyType): Body {
  const { pts, lit, tube } = q3(ty),
    MUDC: Color = [0.4, 0.3, 0.19],
    WET: Color = [0.75, 0.7, 0.55],
    WEED: Color = [0.42, 0.7, 0.32],
    ROOT: Color = [0.5, 0.38, 0.24],
    BONE: Color = [0.92, 0.9, 0.82],
    RUST: Color = [0.72, 0.32, 0.18],
    EYE: Color = [0.8, 1.0, 0.4];
  // a hunched mound of mud from the swamp's bottom
  for (let i = 0; i < 170; i++) {
    const y = 1 - ((i + 0.5) / 170) * 1.25,
      rr = Math.sqrt(Math.max(0, 1 - y * y)),
      a = i * 2.39996;
    if (y < -0.25) continue;
    const n = 0.12 * Math.sin(a * 3 + y * 5) + 0.06 * Math.sin(a * 7);
    const x = Math.cos(a) * rr * (0.72 + n),
      z = Math.sin(a) * rr * (0.62 + n) - 0.05,
      yy = 0.05 + (y + 0.25) * 0.95;
    if (mr() < 0.12) lit(x, yy, z, '~', 1, 2.0, WET, 'bog');
    else lit(x, yy, z, mpick(['%', '~', '#', ',']), 1, 0.55 + 0.6 * Math.max(0, y), MUDC, 'bog');
  }
  // two thick arms of mud reaching forward, lumpy
  for (const sd of [-1, 1]) {
    const ex = { piv: 0 },
      p0: Vec3 = [sd * 0.45, 0.85, 0.25],
      p1: Vec3 = [sd * 0.62, 0.55, 0.62],
      p2: Vec3 = [sd * 0.5, 0.18, 0.9];
    tube(p0, p1, 0.16, 0.14, MUD, MUDC, 'bogarm', ex, 0.3);
    tube(p1, p2, 0.14, 0.12, MUD, MUDC, 'bogarm', ex, 0.3);
    for (let c = 0; c < 3; c++) lit(p2[0] + (c - 1) * 0.07, p2[1] - 0.06, p2[2] + 0.1, mpick(['v', '|']), 1, 1.0, MUDC, 'bogarm', ex);
    for (let q = 0; q < 4; q++) {
      const f = 0.2 + q * 0.2;
      lit(
        p0[0] + (p1[0] - p0[0]) * f,
        p0[1] + (p1[1] - p0[1]) * f - 0.2 - q * 0.04,
        p0[2] + (p1[2] - p0[2]) * f,
        q % 2 ? ')' : '|',
        1,
        1.2,
        WEED,
        'bogarm',
        ex,
      );
    }
  }
  // the head lump: a gaping mouth (a dark hole) and two glowing eyes; mud dripping from the mouth's rim
  const H: Vec3 = [0, 1.12, 0.42];
  for (let i = 0; i < 40; i++) {
    const y = 1 - (2 * (i + 0.5)) / 40,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996,
      nx = Math.cos(a) * rr,
      nz = Math.sin(a) * rr;
    if (nz > 0.55 && y < 0.15 && y > -0.6 && Math.abs(nx) < 0.45) continue;
    lit(H[0] + nx * 0.3, H[1] + y * 0.26, H[2] + nz * 0.26, mpick(['%', '~', '#']), 1, 0.7 + 0.4 * Math.max(0, y), MUDC, 'bog');
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    lit(
      H[0] + Math.cos(a) * 0.13,
      H[1] - 0.08 + Math.sin(a) * 0.11,
      H[2] + 0.24,
      mpick(['(', ')', '~']),
      0.95,
      0.5,
      [0.2, 0.15, 0.1],
      'bog',
    );
  }
  for (let k = 0; k < 3; k++) lit(H[0] + (k - 1) * 0.06, H[1] - 0.24 - k * 0.04, H[2] + 0.25, '|', 0.9, 1.0, MUDC, 'bog');
  for (const sd of [-1, 1]) {
    lit(H[0] + sd * 0.13, H[1] + 0.1, H[2] + 0.24, 'O', 1.1, 1.0, [0.25, 0.2, 0.12], 'bog');
    lit(H[0] + sd * 0.13, H[1] + 0.1, H[2] + 0.26, '*', 1.05, 3.8, EYE, 'bog');
  }
  // half-buried bones and skulls, an old rusted sword
  for (const [x, y, z] of [
    [-0.45, 0.55, 0.38],
    [0.35, 0.4, 0.48],
    [0.15, 0.8, -0.5],
    [-0.3, 0.25, -0.45],
  ] as const) {
    lit(x, y, z, 'O', 1.1, 1.5, BONE, 'bog');
    lit(x - 0.03, y + 0.01, z + 0.03, '.', 0.7, 0.4, [0.1, 0.1, 0.1], 'bog');
    lit(x + 0.03, y + 0.01, z + 0.03, '.', 0.7, 0.4, [0.1, 0.1, 0.1], 'bog');
  }
  for (const [x, y, z] of [
    [0.5, 0.7, 0.1],
    [-0.55, 0.35, -0.1],
    [0.2, 0.25, 0.62],
  ] as const)
    lit(x, y, z, mpick(['(', ')', '=']), 1, 1.4, BONE, 'bog');
  for (let k = 0; k < 5; k++) lit(-0.15, 0.95 + k * 0.1, 0.2 - k * 0.06, k === 0 ? '+' : '|', 1, k === 0 ? 1.6 : 1.3, RUST, 'bog');
  // rotting weeds and roots hanging from the shoulders
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.2,
      x = Math.cos(a) * 0.62,
      z = Math.sin(a) * 0.52 - 0.05;
    for (let q = 0; q < 4; q++)
      lit(
        x * (1 + q * 0.04),
        0.95 - q * 0.16,
        z * (1 + q * 0.04),
        k % 3 === 0 ? '\\' : q % 2 ? ')' : '|',
        1,
        1.15,
        k % 3 === 0 ? ROOT : WEED,
        'bog',
      );
  }
  return pts;
}

export function nagaForm(ty: BodyType): Body {
  const { S, pts, lit, stroke, ell, tube } = q3(ty),
    SC = ty.col,
    SKIN: Color = [0.78, 0.82, 0.7],
    WOOD: Color = [0.55, 0.4, 0.25],
    MET: Color = [0.85, 0.88, 0.95];
  const path: Vec3[] = [];
  for (let k = 0; k <= 14; k++) {
    const f = k / 14;
    path.push([Math.sin(f * Math.PI * 1.6) * 0.3, 0.1 + (0.25 * Math.max(0, f - 0.6)) / 0.4, -0.9 + f * 0.95]);
  }
  for (let i = 0; i < path.length - 1; i++)
    tube(
      nth(path, i),
      nth(path, i + 1),
      0.06 + 0.08 * (i / path.length),
      0.06 + 0.08 * ((i + 1) / path.length),
      SCALE,
      (_ox, oy) => (oy < -0.4 ? [0.86, 0.86, 0.6] : SC),
      'slither',
    );
  for (let y = 0.35; y <= 0.85; y += S * 0.85) {
    const f = (y - 0.35) / 0.5,
      rx = 0.12 + 0.05 * f,
      n = Math.max(5, Math.round((2 * Math.PI * rx) / (S * 0.85)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      lit(Math.cos(a) * rx, y, 0.05 + Math.sin(a) * rx * 0.75, mpick(['o', '%', ':']), 1, 1.0, SKIN);
    }
  }
  ell([0, 1.0, 0.06], 0.09, 0.1, 0.09, SKINR, () => SKIN, 'head');
  for (const sd of [-1, 1]) {
    lit(sd * 0.035, 1.02, 0.15, '.', 0.8, 3, [1, 0.9, 0.4], 'head');
    lit(sd * 0.12, 0.95, 0.02, sd < 0 ? '(' : ')', 1.1, 1.4, SC, 'head');
  }
  for (const sd of [-1, 1])
    tube([sd * 0.16, 0.82, 0.05], [sd * 0.22, 0.55, 0.25], 0.045, 0.04, SKINR, SKIN, sd < 0 ? 'armL' : 'armR', { piv: 0.82, pz: 0 });
  stroke([0.22, 0.2, 0.28], [0.22, 1.3, 0.28], WOOD, 1.1, 0.9, 'armR', { piv: 0.82, pz: 0 });
  lit(0.22, 1.36, 0.28, '^', 1.1, 2.4, MET, 'armR', { piv: 0.82, pz: 0 });
  return pts;
}

export function krakenForm2(ty: BodyType): Body {
  const { pts, lit, ell } = q3(ty),
    BODY: Color = [0.28, 0.5, 0.6],
    SUCK: Color = [0.7, 0.9, 0.95],
    EYE: Color = [1, 0.3, 0.25];
  ell(
    [0, 0.18, 0],
    0.38,
    0.4,
    0.36,
    SCALE,
    () => BODY,
    'body',
    null,
    (_nx, ny) => ny < -0.3,
  );
  for (const sd of [-1, 1]) {
    lit(sd * 0.12, 0.3, 0.34, '*', 1, 3.8, EYE, 'eye');
  }
  for (let ti = 0; ti < 4; ti++) {
    const a0 = (ti / 4) * Math.PI * 2 + 0.4;
    for (let i = 0; i <= 14; i++) {
      const t2 = i / 14,
        r = 0.35 + 0.55 * t2,
        y = 0.9 * Math.sin(Math.PI * Math.min(1, t2 * 1.1)),
        x = Math.cos(a0) * r,
        z = Math.sin(a0) * r;
      lit(x, y, z, mpick(['%', '~', ':']), 1, 1.0, BODY, 'tent', { piv: i * 0.45, ti });
      if (i % 2 === 0) lit(x, y - 0.06, z, 'o', 0.8, 1.6, SUCK, 'tent', { piv: i * 0.45, ti });
    }
  }
  return pts;
}

export function caveSpiderForm(ty: BodyType): Body {
  const { pts, lit, ell, tube } = q3(ty),
    BR: Color = [0.45, 0.34, 0.26],
    OCH: Color = [0.85, 0.68, 0.35],
    EYE: Color = [1, 0.3, 0.25];
  ell([0, 0.38, 0.12], 0.16, 0.12, 0.16, FUR, () => BR, 'body');
  ell([0, 0.42, -0.28], 0.24, 0.2, 0.28, FUR, (_nx, ny, nz) => (ny > 0.5 && Math.abs(Math.sin(nz * 9)) > 0.6 ? OCH : BR), 'body');
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) lit((k - 1.5) * 0.04, 0.44 + r * 0.04, 0.27, '.', 0.7, 3.4, EYE, 'head');
  for (const sd of [-1, 1]) lit(sd * 0.03, 0.32, 0.3, 'v', 0.8, 1.6, [0.9, 0.88, 0.8], 'head');
  for (const sd of [1, -1])
    for (let k = 0; k < 4; k++) {
      const hz = 0.22 - k * 0.1,
        part = (k % 2 === 0) === sd > 0 ? 'legL' : 'legR',
        ex = { piv: 0.38, pz: hz },
        knee: Vec3 = [sd * 0.52, 0.78, hz + (1.5 - k) * 0.14],
        foot: Vec3 = [sd * 0.88, 0.02, hz + (1.5 - k) * 0.32];
      tube([sd * 0.12, 0.38, hz], knee, 0.04, 0.035, FUR, BR, part, ex);
      tube(knee, foot, 0.035, 0.02, FUR, BR, part, ex);
    }
  return pts;
}

export function batForm(ty: BodyType): Body {
  const { pts, lit, ell } = q3(ty),
    FURC: Color = [0.3, 0.24, 0.26],
    MEM: Color = [0.45, 0.2, 0.32],
    EYE: Color = [1, 0.25, 0.25];
  ell([0, 0, 0], 0.13, 0.12, 0.15, FUR, () => FURC, 'body');
  for (const sd of [-1, 1]) {
    lit(sd * 0.08, 0.16, 0.04, '^', 1.1, 1.3, FURC, 'body');
    lit(sd * 0.04, 0.03, 0.13, '.', 0.8, 3.4, EYE, 'body');
    lit(sd * 0.02, -0.05, 0.14, 'v', 0.7, 2.2, [0.95, 0.95, 0.9], 'body');
    for (let k = 0; k < 4; k++) {
      const r = 0.18 + k * 0.15;
      lit(0, 0.06 - k * 0.01, 0.02, '-', 1, 1.4, [0.6, 0.5, 0.5], 'wing', { sd, r });
      for (let q = 1; q < 3; q++)
        lit(0, 0.06 - k * 0.01 - q * 0.07, 0.02 - q * 0.02, mpick(['%', ':']), 1, 1.0, MEM, 'wing', { sd, r: r * (1 - q * 0.12) });
    }
  }
  return pts;
}

// the sleeping dragon: curled low, the tail wrapped round the front, the neck bent in an S with the head resting on its coil,
// wings folded along the back, legs tucked under; the whole body breathing slowly
export function dragonSleepForm(ty: BodyType): Body {
  const { pts, lit, stroke, ell, tube } = q3(ty),
    SC = ty.col,
    BELLY: Color = [0.95, 0.78, 0.5],
    MEM: Color = [0.55, 0.18, 0.18],
    HORN: Color = [0.88, 0.84, 0.72],
    EMB: Color = [1, 0.55, 0.18];
  // 制御点を通る曲線（Catmull-Rom）を、step ごとの点にする
  const spl = (ctrl: readonly Vec3[], step: number): Vec3[] => {
    const out: Vec3[] = [],
      at = (i: number): Vec3 => nth(ctrl, i);
    for (let i = 0; i < ctrl.length - 1; i++)
      for (let t = 0; t < 1; t += step) {
        const a = at(Math.max(0, i - 1)),
          b = at(i),
          c = at(i + 1),
          d = at(Math.min(ctrl.length - 1, i + 2)),
          t2 = t * t,
          t3 = t2 * t;
        const k3 = (k: 0 | 1 | 2): number =>
          0.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3);
        out.push([k3(0), k3(1), k3(2)]);
      }
    out.push(at(ctrl.length - 1));
    return out;
  };
  const seg = (a: readonly Vec3[], i: number): Vec3 => nth(a, i);
  const body = spl(
    [
      [-0.42, 0.34, -0.3],
      [-0.1, 0.4, -0.5],
      [0.28, 0.44, -0.32],
      [0.46, 0.46, 0.08],
    ],
    0.2,
  );
  for (let i = 0; i < body.length - 1; i++) {
    const f = i / (body.length - 1);
    tube(
      seg(body, i),
      seg(body, i + 1),
      0.15 + 0.08 * f,
      0.15 + 0.08 * ((i + 1) / (body.length - 1)),
      SCALE,
      (_ox, oy) => (oy < -0.5 ? BELLY : SC),
      'breathe',
    );
  }
  const tail = spl(
    [
      [-0.42, 0.3, -0.3],
      [-0.6, 0.14, 0.12],
      [-0.32, 0.07, 0.55],
      [0.15, 0.06, 0.7],
      [0.55, 0.05, 0.5],
      [0.7, 0.04, 0.25],
    ],
    0.2,
  );
  for (let i = 0; i < tail.length - 1; i++) {
    const f = i / (tail.length - 1);
    tube(seg(tail, i), seg(tail, i + 1), 0.12 * (1 - f * 0.8), 0.12 * (1 - ((i + 1) / (tail.length - 1)) * 0.8), SCALE, SC, 'breathe');
  }
  lit(0.7, 0.04, 0.25, '^', 1.1, 1.7, HORN, 'breathe');
  const neck = spl(
    [
      [0.46, 0.5, 0.1],
      [0.42, 0.78, 0.22],
      [0.18, 0.9, 0.12],
      [-0.02, 0.78, 0.28],
      [0.02, 0.66, 0.46],
    ],
    0.2,
  );
  for (let i = 0; i < neck.length - 1; i++) {
    const f = i / (neck.length - 1);
    tube(
      seg(neck, i),
      seg(neck, i + 1),
      0.13 - 0.05 * f,
      0.13 - 0.05 * ((i + 1) / (neck.length - 1)),
      SCALE,
      (_ox, oy) => (oy < -0.5 ? BELLY : SC),
      'breathe',
    );
  }
  ell([0.03, 0.64, 0.58], 0.09, 0.07, 0.14, SCALE, (_nx, ny) => (ny < -0.4 ? BELLY : SC), 'breathe');
  for (const sd of [-1, 1]) {
    stroke([0.03 + sd * 0.05, 0.64, 0.66], [0.03 + sd * 0.015, 0.6, 0.8], SC, 1.3, 0.9, 'breathe');
    lit(0.03 + sd * 0.055, 0.68, 0.66, '-', 0.85, 1.8, [1, 0.75, 0.35], 'breathe');
    stroke([0.03 + sd * 0.05, 0.72, 0.55], [0.03 + sd * 0.1, 0.8, 0.38], HORN, 1.6, 0.95, 'breathe');
    lit(0.03 + sd * 0.12, 0.82, 0.33, '<', 0.95, 1.8, HORN, 'breathe');
  }
  for (let k = 0; k < 3; k++) lit(0.03 + (mr() - 0.5) * 0.03, 0.58, 0.82 + k * 0.02, mpick(["'", '.']), 0.8, 2.4, EMB, 'breathe');
  // folded wings along the back
  for (const sd of [-1, 1]) {
    const r0: Vec3 = [sd * 0.16, 0.7, 0.12],
      r1: Vec3 = [sd * 0.3, 0.74, -0.2],
      r2: Vec3 = [sd * 0.34, 0.66, -0.55];
    stroke(r0, r1, HORN, 1.5, 1, 'breathe');
    stroke(r1, r2, HORN, 1.4, 0.95, 'breathe');
    for (let q = 0; q < 28; q++) {
      const u = mr(),
        v = mr() * (1 - u);
      lit(
        r0[0] + (r1[0] - r0[0]) * u + (r2[0] - r0[0]) * v - sd * 0.06 * v,
        r0[1] + (r1[1] - r0[1]) * u + (r2[1] - r0[1]) * v - 0.12 * v,
        r0[2] + (r1[2] - r0[2]) * u + (r2[2] - r0[2]) * v,
        mpick(['%', ':', '#']),
        1,
        0.9,
        MEM,
        'breathe',
      );
    }
  }
  // tucked legs: front paws before the chest, a hind haunch
  for (const sd of [-1, 1]) {
    tube([0.42 + sd * 0.12, 0.3, 0.22], [0.4 + sd * 0.14, 0.06, 0.38], 0.06, 0.045, SCALE, SC, 'breathe');
    for (let c = 0; c < 3; c++) lit(0.4 + sd * 0.14 + (c - 1) * 0.035, 0.02, 0.44, 'v', 0.8, 1.4, HORN, 'breathe');
  }
  ell([-0.32, 0.28, -0.12], 0.14, 0.14, 0.16, SCALE, () => SC, 'breathe');
  // a spined ridge along the curled back
  for (let i = 0; i < body.length; i += 1) {
    const p = seg(body, i);
    stroke([p[0], p[1] + 0.18, p[2]], [p[0], p[1] + 0.28, p[2] - 0.04], HORN, 1.5, 0.85, 'breathe');
  }
  return pts;
}

export function wraithForm2(ty: BodyType): Body {
  const { S, pts, lit, stroke } = q3(ty);
  pts.noExtra = true;
  const RAG: Color = [0.34, 0.33, 0.38],
    EYE: Color = [0.55, 1.0, 0.6],
    CLAW: Color = [0.82, 0.88, 0.92];
  // a heap of rags leaning forward, the hood dark inside
  for (let y = 0.2; y <= 1.4; y += S * 0.85) {
    const f = (y - 0.2) / 1.2,
      r = 0.3 - 0.1 * f,
      lean = 0.18 * f,
      n = Math.max(6, Math.round((2 * Math.PI * r) / (S * 0.9)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      if (mr() < 0.12) continue;
      lit(
        Math.cos(a) * r,
        y,
        Math.sin(a) * r * 0.85 + lean,
        mpick(['%', '#', ':', '|']),
        1,
        0.6 + 0.3 * Math.max(0, Math.cos(a - 0.8)),
        RAG,
        'robe',
      );
    }
  }
  for (let i = 0; i < 20; i++) {
    const y = 1 - (2 * (i + 0.5)) / 20,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996,
      nz = Math.sin(a) * rr;
    if (nz > 0.5 && y < 0.5) continue;
    if (y < -0.4) continue;
    lit(Math.cos(a) * rr * 0.2, 1.5 + y * 0.2, 0.18 + nz * 0.2, mpick(['%', '#']), 1, 0.75, RAG, 'head');
  }
  for (const sd of [-1, 1]) lit(sd * 0.05, 1.48, 0.34, '*', 0.85, 3.6, EYE, 'head');
  // long sleeves reaching forward, long claws
  for (const sd of [-1, 1]) {
    stroke([sd * 0.24, 1.25, 0.2], [sd * 0.3, 1.05, 0.55], RAG, 1.0, 1, 'body');
    for (let c = 0; c < 4; c++)
      stroke([sd * 0.3, 1.03, 0.58], [sd * (0.28 + 0.04 * (c - 1.5)), 0.86 - 0.03 * c, 0.82], CLAW, 2.0, 0.85, 'body');
  }
  // rag strips trailing behind from the hem（'\\\\' は2文字の文字列。描くのは1文字目の \ ）
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * (1.15 + (0.7 * k) / 8),
      x = Math.cos(a) * 0.28,
      z = Math.sin(a) * 0.24;
    for (let q = 0; q < 5; q++) lit(x * (1 + q * 0.05), 0.22 - q * 0.03, z - 0.08 * q, q % 2 ? '\\\\' : '|', 0.95, 0.8, RAG, 'robe');
  }
  return pts;
}

// the phantom's hidden shape (only glimpsed)
export function phantomForm(ty: BodyType): Body {
  const { S, pts, lit, stroke } = q3(ty);
  pts.noExtra = true;
  // the hidden shape, glimpsed only: a wailing ghost - hollow eyes, an open mouth, long hair streaming back, a veil over head and shoulders,
  // faint collarbones and ribs with a soft light within, one arm reaching with long fingers, the other hanging in a torn sleeve, a ragged hem fraying into wisps
  const C: Color = [0.75, 0.85, 1.0],
    DIM: Color = [0.5, 0.58, 0.75],
    HOLLOW: Color = [0.08, 0.1, 0.18],
    CORE: Color = [0.85, 0.92, 1.0];
  // head: a pale face with dark hollows
  for (let i = 0; i < 22; i++) {
    const y = 1 - (2 * (i + 0.5)) / 22,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996,
      nz = Math.sin(a) * rr;
    lit(Math.cos(a) * rr * 0.12, 1.56 + y * 0.14, 0.04 + nz * 0.12, nz > 0.3 ? ':' : '.', 1, 0.8 + 0.5 * Math.max(0, nz), C, 'head');
  }
  for (const sd of [-1, 1]) {
    lit(sd * 0.045, 1.58, 0.16, 'O', 0.85, 0.6, HOLLOW, 'head');
    lit(sd * 0.045, 1.58, 0.17, '.', 0.6, 1.6, CORE, 'head');
  }
  lit(0, 1.47, 0.16, 'O', 0.95, 0.5, HOLLOW, 'head');
  lit(0, 1.44, 0.15, 'o', 0.7, 0.9, C, 'head');
  // a veil over the head, falling over the shoulders and back
  for (let k = 0; k < 14; k++) {
    const a = Math.PI * (0.15 + (0.7 * k) / 13),
      x = Math.cos(a) * 0.16,
      z = -Math.sin(a) * 0.13;
    for (let q = 0; q < 5; q++)
      lit(
        x * (1 + q * 0.35),
        1.68 - q * 0.12,
        z * (1 + q * 0.2) - 0.02 * q,
        q === 0 ? '^' : x > 0 ? '\\' : '/',
        0.95,
        0.9 - q * 0.1,
        DIM,
        'robe',
      );
  }
  // long hair streaming back and down
  for (let h = 0; h < 7; h++) {
    const x0 = (h - 3) * 0.04;
    for (let q = 0; q < 9; q++) {
      const f = q / 8;
      lit(x0 * (1 + f), 1.62 - f * 0.55, -0.1 - f * 0.32, q % 2 ? ')' : '~', 0.9, 1.0 - 0.4 * f, C, 'tendril', { piv: q });
    }
  }
  // the body: shoulders, faint collarbones and ribs, a soft light within; it thins and frays below
  for (let y = 0.4; y <= 1.38; y += S * 0.85) {
    const f = (y - 0.4) / 0.98,
      r = 0.06 + 0.2 * Math.pow(f, 1.3),
      n = Math.max(4, Math.round((2 * Math.PI * r) / (S * 0.9)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      if (f < 0.35 && mr() < 0.55 * (1 - f / 0.35)) continue;
      lit(
        Math.cos(a) * r,
        y,
        Math.sin(a) * r * 0.75,
        Math.abs(Math.cos(a)) > 0.8 ? '|' : mpick([':', '.', "'"]),
        1,
        0.7 + 0.4 * f,
        C,
        'robe',
      );
    }
  }
  for (const sd of [-1, 1]) {
    stroke([sd * 0.02, 1.36, 0.14], [sd * 0.2, 1.38, 0.08], C, 1.4, 0.85);
    for (let r = 0; r < 4; r++) lit(sd * 0.08, 1.24 - r * 0.07, 0.15, sd < 0 ? '(' : ')', 0.85, 1.0, DIM);
  }
  lit(0, 1.15, 0.1, '*', 1.2, 2.2, CORE);
  lit(0, 1.15, 0.1, 'o', 1.6, 0.7, CORE);
  // one arm reaching, long fingers; the other hanging in a torn sleeve
  stroke([0.22, 1.34, 0.04], [0.34, 1.22, 0.4], C, 1.1, 0.95);
  stroke([0.34, 1.22, 0.4], [0.38, 1.24, 0.68], C, 1.1, 0.9);
  for (let c = 0; c < 5; c++) {
    const sp = (c - 2) * 0.03;
    stroke([0.38 + sp, 1.24, 0.7], [0.38 + sp * 1.6, 1.25 - Math.abs(sp) * 0.6, 0.86], C, 1.3, 0.75);
  }
  stroke([-0.22, 1.34, 0.0], [-0.28, 1.0, 0.06], C, 1.0, 0.95);
  stroke([-0.28, 1.0, 0.06], [-0.28, 0.78, 0.1], C, 1.0, 0.9);
  for (let k = 0; k < 5; k++) lit(-0.28 + (k - 2) * 0.035, 0.95 - ((k * 7) % 3) * 0.05, 0.1, k % 2 ? '\\' : '/', 0.9, 0.8, DIM, 'robe');
  // the ragged hem fraying into wisps that trail behind
  for (let w = 0; w < 6; w++) {
    const a = Math.PI * (1.1 + (0.8 * w) / 5),
      x = Math.cos(a) * 0.1,
      z = Math.sin(a) * 0.08;
    for (let q = 0; q < 8; q++) {
      const f = q / 7;
      lit(x * (1 + f), 0.5 - f * 0.35, z - f * 0.45, q % 2 ? '~' : "'", 0.85, 0.9 - 0.5 * f, C, 'tendril', { piv: q * 1.2 });
    }
  }
  return pts;
}

// ---------------------------------------------------------------- the ogre, its own body: broad shoulders and a V-shaped torso, bulging shoulders and arms, thick legs, a heavy brow and tusks,
// a leather loincloth with fur, a belt with an iron buckle, and a real club - thick at the head, iron-banded, studded with iron spikes - resting on its shoulder. Several colours, not one
export function ogreForm(ty: BodyType & { ch: string }): Body {
  const pts: Body = [],
    S = 0.167,
    GAP = 0.14,
    LD = [0.42, 0.72, 0.55] as const;
  const SKIN: Color = [0.52, 0.62, 0.44],
    LEATHER: Color = [0.36, 0.22, 0.14],
    FURC: Color = [0.88, 0.8, 0.64],
    WOOD: Color = [0.72, 0.46, 0.24],
    IRON: Color = [0.82, 0.86, 0.95],
    TUSK: Color = [0.98, 0.95, 0.86],
    EYE: Color = [1.0, 0.85, 0.3];
  const R = {
    skin: ['.', ':', 'o', '%', '#'],
    cloth: ['.', ':', '|', '/', '#'],
    wood: ['.', ':', '=', '%', '#'],
    fur: ['.', ',', '"', '%', '#'],
  } as const;
  type Mat = keyof typeof R;
  const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number, mat: Mat, col: Color, part?: string, extra?: Extra) => {
    const l = Math.hypot(nx, ny, nz) || 1,
      d = (nx * LD[0] + ny * LD[1] + nz * LD[2]) / l,
      i = clamp(0.2 + 0.8 * Math.max(0, d), 0, 1),
      r = R[mat];
    pts.push(
      Object.assign(
        {
          x,
          y,
          z,
          g: G(nth(r, Math.min(r.length - 1, Math.floor(i * r.length)))),
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
  const lit = (x: number, y: number, z: number, ch: string, s: number, b: number, col: Color, part?: string, extra?: Extra) => {
    pts.push(Object.assign({ x, y, z, g: G(ch), s, b, part: part || 'body', ph: mr() * 6.28, piv: 0, pz: 0, col }, extra || {}));
  };
  const tube = (a: Vec3, b: Vec3, r0: number, r1: number, mat: Mat, col: Color, part?: string, extra?: Extra, bulge?: number) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      dz = b[2] - a[2],
      L = Math.hypot(dx, dy, dz),
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
      qz = ux * py - uy * px;
    for (let t = 0; t <= L + 1e-6; t += GAP) {
      const f = t / L,
        r = (r0 + (r1 - r0) * f) * (1 + (bulge || 0) * Math.sin(Math.PI * f)),
        n = Math.max(5, Math.round((2 * Math.PI * r) / GAP));
      for (let k = 0; k < n; k++) {
        const an = (k / n) * Math.PI * 2 + t * 2,
          ox = Math.cos(an) * px + Math.sin(an) * qx,
          oy = Math.cos(an) * py + Math.sin(an) * qy,
          oz = Math.cos(an) * pz + Math.sin(an) * qz;
        put(a[0] + ux * t + ox * r, a[1] + uy * t + oy * r, a[2] + uz * t + oz * r, ox, oy, oz, mat, col, part, extra);
      }
    }
  };
  const hip = 0.6,
    sh = 1.26,
    hc = 1.42;
  // thick legs with bulging calves, wide feet
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'legL' : 'legR',
      ex = { piv: hip, pz: 0 };
    tube([sd * 0.15, hip, 0], [sd * 0.16, 0.06, 0.02], 0.12, 0.09, 'skin', SKIN, part, ex, 0.25);
    for (let k = 0; k < 3; k++) lit(sd * 0.16 + (k - 1) * 0.06, 0.03, 0.1, '_', S, 1.0, SKIN, part, ex);
  }
  // the torso: V-shaped, broadest at the chest; a slight belly in front
  for (let y = hip; y <= sh + 0.01; y += GAP) {
    const f = (y - hip) / (sh - hip),
      rx = 0.26 + 0.18 * Math.pow(f, 1.3),
      rz = 0.2 + 0.04 * f,
      bel = 0.07 * Math.sin(Math.PI * Math.min(1, f * 1.6)),
      n = Math.max(8, Math.round((2 * Math.PI * rx) / GAP));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2,
        nx = Math.cos(a),
        nz = Math.sin(a);
      put(nx * rx, y, nz * (rz + (nz > 0 ? bel : 0)), nx, 0.15, nz, 'skin', SKIN);
    }
  }
  for (const sd of [-1, 1])
    for (let k = 0; k < 3; k++) lit(sd * (0.1 + k * 0.07), sh - 0.12 - k * 0.02, 0.26, sd < 0 ? '(' : ')', S, 1.5, [0.5, 0.46, 0.32]);
  for (let r = 0; r < 3; r++) for (const sd of [-1, 1]) lit(sd * 0.06, hip + 0.2 + r * 0.11, 0.29, '=', S * 0.9, 1.2, [0.5, 0.46, 0.32]);
  // bulging shoulders and a thick neck
  for (const sd of [-1, 1])
    for (let i = 0; i < 12; i++) {
      const y = 1 - (2 * (i + 0.5)) / 12,
        rr = Math.sqrt(1 - y * y),
        a = i * 2.39996;
      if (y < -0.3) continue;
      put(
        sd * 0.46 + Math.cos(a) * rr * 0.14,
        sh - 0.02 + y * 0.12,
        Math.sin(a) * rr * 0.14,
        Math.cos(a) * rr,
        y,
        Math.sin(a) * rr,
        'skin',
        SKIN,
      );
    }
  tube([0, sh, 0], [0, hc - 0.08, 0.02], 0.13, 0.11, 'skin', SKIN, 'body');
  // thick arms with biceps and fists
  const armLen = 0.82;
  // the left arm hangs; the right is bent at the elbow, its fist in front of the chest, holding the club on the shoulder
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'armL' : 'armR',
      ex = { piv: sh, pz: 0 },
      s0: Vec3 = [sd * 0.5, sh - 0.04, 0],
      el: Vec3 = sd < 0 ? [sd * 0.56, sh - 0.42, 0.04] : [0.6, sh - 0.4, 0.14],
      wr: Vec3 = sd < 0 ? [sd * 0.54, sh - armLen, 0.1] : [0.44, sh - 0.14, 0.32];
    tube(s0, el, 0.1, 0.085, 'skin', SKIN, part, ex, 0.3);
    tube(el, wr, 0.085, 0.075, 'skin', SKIN, part, ex, 0.15);
    for (let i = 0; i < 8; i++) {
      const y = 1 - (2 * (i + 0.5)) / 8,
        rr = Math.sqrt(1 - y * y),
        a = i * 2.39996;
      put(
        wr[0] + Math.cos(a) * rr * 0.09,
        wr[1] - 0.06 + y * 0.08,
        wr[2] + Math.sin(a) * rr * 0.09,
        Math.cos(a) * rr,
        y,
        Math.sin(a) * rr,
        'skin',
        SKIN,
        part,
        ex,
      );
    }
    lit(sd * 0.54, sh - 0.2, 0.12, '^', S * 0.8, 1.2, LEATHER, part, ex);
  }
  // a small head: heavy brow, small yellow eyes, a jutting jaw with tusks, small ears; its letter
  for (let i = 0; i < 14; i++) {
    const y = 1 - (2 * (i + 0.5)) / 14,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996;
    put(
      Math.cos(a) * rr * 0.14,
      hc + y * 0.14,
      0.04 + Math.sin(a) * rr * 0.14,
      Math.cos(a) * rr,
      y,
      Math.sin(a) * rr,
      'skin',
      SKIN,
      'head',
    );
  }
  for (let k = 0; k < 5; k++) lit((k - 2) * 0.05, hc + 0.05, 0.18, '=', S * 0.9, 1.4, [0.5, 0.46, 0.32], 'head');
  for (const sd of [-1, 1]) {
    lit(sd * 0.05, hc + 0.0, 0.18, '.', S * 0.8, 3.2, EYE, 'head');
    lit(sd * 0.06, hc - 0.1, 0.2, '^', S * 0.9, 2.4, TUSK, 'head');
    lit(sd * 0.15, hc + 0.02, 0.02, sd < 0 ? '(' : ')', S * 0.85, 1.1, SKIN, 'head');
  }
  for (let k = 0; k < 3; k++) lit((k - 1) * 0.05, hc - 0.12, 0.17, '-', S * 0.85, 1.2, SKIN, 'head');
  lit(0, hc + 0.02, 0.1, ty.ch, S * 1.2, 1.4, SKIN, 'core');
  // a leather loincloth with fur, a belt with an iron buckle
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    lit(Math.cos(a) * 0.29, hip + 0.06, Math.sin(a) * 0.23 + (Math.sin(a) > 0 ? 0.04 : 0), '=', S, 1.2, LEATHER);
  }
  lit(0, hip + 0.06, 0.3, '#', S * 1.1, 2.2, IRON);
  for (const zf of [1, -1])
    for (let k = 0; k < 5; k++) {
      const x = (k - 2) * 0.08;
      for (let y = hip; y > hip - 0.32; y -= GAP) lit(x, y, zf * (0.24 + 0.02 * (hip - y)), '|', S, 0.95, LEATHER);
      lit(x, hip - 0.34, zf * 0.25, '"', S, 1.3, FURC);
    }
  // the club: in the right hand, resting on the shoulder - narrow grip, swelling head, two iron bands, iron spikes
  const g0: Vec3 = [0.44, sh - 0.22, 0.36],
    g1: Vec3 = [0.47, sh + 0.55, -0.46],
    ex = { piv: sh, pz: 0 };
  tube(g0, g1, 0.045, 0.16, 'wood', WOOD, 'armR', ex, 0);
  for (const f of [0.62, 0.84]) {
    const c: Vec3 = [g0[0] + (g1[0] - g0[0]) * f, g0[1] + (g1[1] - g0[1]) * f, g0[2] + (g1[2] - g0[2]) * f],
      r = 0.05 + 0.12 * f;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      lit(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.4, c[2] + Math.sin(a) * r, '=', S, 1.8, IRON, 'armR', ex);
    }
  }
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2,
      f = 0.9 + 0.08 * (k % 2),
      c: Vec3 = [g0[0] + (g1[0] - g0[0]) * f, g0[1] + (g1[1] - g0[1]) * f, g0[2] + (g1[2] - g0[2]) * f],
      r = 0.2;
    lit(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.6, c[2] + Math.sin(a) * r, '^', S * 1.05, 2.4, IRON, 'armR', ex);
  }
  return pts;
}

// the dragon (a large creature, and the forgotten beast of kind 竜)
export function dragonForm(ty: BodyType): Body {
  const { S, pts, lit, stroke, ell, tube, put } = q3(ty),
    SC = ty.col,
    BELLY: Color = [0.95, 0.78, 0.5],
    MEM: Color = [0.55, 0.18, 0.18],
    HORN: Color = [0.88, 0.84, 0.72],
    EMB: Color = [1, 0.55, 0.18];
  // a predator's build: a deep, heavy chest and raised shoulders tapering to a tight waist and light hips; legs thick at the top, slim below; a shorter neck holding the head high;
  // an angular head (brow ridges, a pointed snout, a jaw line, cheek spikes, long swept horns); a thick-based tail; a spined ridge largest at the shoulders
  const prof = (z: number): Vec3 => {
    const rx =
      z > 0.15
        ? 0.17 + 0.07 * Math.sin((Math.min(1, (z - 0.15) / 0.3) * Math.PI) / 2)
        : z > -0.25
          ? 0.13 + (0.04 * (z + 0.25)) / 0.4
          : 0.13;
    const ry =
      z > 0.15
        ? 0.18 + 0.08 * Math.sin((Math.min(1, (z - 0.15) / 0.3) * Math.PI) / 2)
        : z > -0.25
          ? 0.13 + (0.05 * (z + 0.25)) / 0.4
          : 0.14;
    const cy = z > 0.15 ? 0.7 + (0.04 * (z - 0.15)) / 0.3 : 0.66 + 0.04 * Math.max(0, (z + 0.25) / 0.4);
    return [rx, ry, cy];
  };
  for (let z = -0.6; z <= 0.48; z += S * 0.85) {
    const [rx, ry, cy] = prof(Math.min(z, 0.45)),
      n = Math.max(6, Math.round((2 * Math.PI * Math.max(rx, ry)) / (S * 0.85)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2,
        nx = Math.cos(a),
        ny = Math.sin(a);
      put(nx * rx, cy + ny * ry, z, nx, ny, 0.1, SCALE, ny < -0.5 ? BELLY : SC, 'body');
    }
  }
  for (const sd of [-1, 1])
    for (let i = 0; i < 10; i++) {
      const y = 1 - (2 * (i + 0.5)) / 10,
        rr = Math.sqrt(1 - y * y),
        a = i * 2.39996;
      if (y < -0.3) continue;
      put(
        sd * 0.2 + Math.cos(a) * rr * 0.1,
        0.82 + y * 0.08,
        0.36 + Math.sin(a) * rr * 0.1,
        Math.cos(a) * rr,
        y,
        Math.sin(a) * rr,
        SCALE,
        SC,
        'body',
      );
    }
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'legL' : 'legR',
      ex = { piv: 0.7, pz: 0.38 };
    tube([sd * 0.2, 0.72, 0.38], [sd * 0.21, 0.38, 0.4], 0.095, 0.06, SCALE, SC, part, ex, 0.2);
    tube([sd * 0.21, 0.38, 0.4], [sd * 0.21, 0.04, 0.45], 0.055, 0.04, SCALE, SC, part, ex);
    for (let c = 0; c < 3; c++) lit(sd * 0.21 + (c - 1) * 0.04, 0.01, 0.52, 'v', 0.85, 1.5, HORN, part, ex);
  }
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'legR' : 'legL',
      ex = { piv: 0.64, pz: -0.42 };
    tube([sd * 0.15, 0.66, -0.42], [sd * 0.18, 0.38, -0.25], 0.11, 0.065, SCALE, SC, part, ex, 0.25);
    tube([sd * 0.18, 0.38, -0.25], [sd * 0.18, 0.17, -0.45], 0.06, 0.045, SCALE, SC, part, ex);
    tube([sd * 0.18, 0.17, -0.45], [sd * 0.19, 0.03, -0.36], 0.045, 0.035, SCALE, SC, part, ex);
    for (let c = 0; c < 3; c++) lit(sd * 0.19 + (c - 1) * 0.04, 0.01, -0.3, 'v', 0.85, 1.5, HORN, part, ex);
  }
  const neck: readonly Vec3[] = [
    [0, 0.86, 0.42],
    [0, 1.04, 0.54],
    [0, 1.2, 0.66],
  ];
  for (let i = 0; i < neck.length - 1; i++)
    tube(nth(neck, i), nth(neck, i + 1), 0.14 - i * 0.035, 0.105 - i * 0.025, SCALE, (_ox, oy) => (oy < -0.5 ? BELLY : SC), 'head');
  ell([0, 1.26, 0.78], 0.09, 0.08, 0.14, SCALE, (_nx, ny) => (ny < -0.4 ? BELLY : SC), 'head');
  for (const sd of [-1, 1]) {
    stroke([sd * 0.06, 1.27, 0.86], [sd * 0.02, 1.22, 1.04], SC, 1.3, 0.9, 'head');
    stroke([sd * 0.06, 1.19, 0.84], [sd * 0.015, 1.16, 1.0], SC, 1.0, 0.85, 'head');
    stroke([sd * 0.04, 1.33, 0.8], [sd * 0.09, 1.33, 0.9], HORN, 1.8, 0.95, 'head');
    lit(sd * 0.07, 1.29, 0.9, '.', 0.85, 3.4, [1, 0.8, 0.3], 'head');
    lit(sd * 0.12, 1.22, 0.78, sd < 0 ? '<' : '>', 0.95, 1.7, HORN, 'head');
    stroke([sd * 0.05, 1.34, 0.76], [sd * 0.11, 1.48, 0.58], HORN, 1.6, 1, 'head');
    stroke([sd * 0.11, 1.48, 0.58], [sd * 0.14, 1.52, 0.4], HORN, 1.6, 0.9, 'head');
    lit(sd * 0.14, 1.54, 0.36, '<', 0.95, 1.9, HORN, 'head');
  }
  lit(0, 1.2, 1.06, 'v', 0.85, 1.4, HORN, 'head');
  for (let k = 0; k < 4; k++) lit((mr() - 0.5) * 0.04, 1.17, 1.04 + k * 0.015, mpick(['*', "'"]), 0.85, 3.0, EMB, 'head');
  const tail: readonly Vec3[] = [
    [0, 0.64, -0.58],
    [0.08, 0.52, -0.92],
    [0.22, 0.34, -1.2],
    [0.28, 0.16, -1.45],
  ];
  for (let i = 0; i < tail.length - 1; i++)
    tube(nth(tail, i), nth(tail, i + 1), 0.12 - i * 0.035, 0.085 - i * 0.03, SCALE, SC, 'tail', { piv: i });
  for (const sd of [-1, 1]) stroke([0.28, 0.16, -1.45], [0.28 + sd * 0.08, 0.12, -1.58], HORN, 1.6, 0.9, 'tail', { piv: 3 });
  lit(0.28, 0.12, -1.62, '^', 1.1, 1.8, HORN, 'tail', { piv: 3 });
  for (let k = 0; k < 12; k++) {
    const z = 0.66 - k * 0.12,
      top = z > 0.42 ? 1.28 - (0.66 - z) * 1.6 : z > -0.6 ? prof(z)[2] + prof(z)[1] : 0.64 - (-0.6 - z) * 0.4,
      h = 0.06 + 0.1 * Math.max(0, 1 - Math.abs(z - 0.3) / 0.7);
    stroke([0, top, z], [0, top + h, z - 0.06], HORN, 1.6, 0.9, 'body');
  }
  // dragon wings: an arm bone to the wrist, four finger bones fanning back, membrane filled between them with a scalloped trailing edge, a claw at the wrist.
  // drawn in the wing's own plane (r = out from the body, z = along it); the 'wing' motion raises them in a V and opens and closes them
  type P2 = readonly [number, number];
  const WY = 0.9,
    sh: P2 = [0.12, 0.32],
    wr: P2 = [0.85, 0.46],
    tips: readonly P2[] = [
      [1.6, 0.22],
      [1.55, -0.36],
      [1.22, -0.86],
      [0.7, -1.06],
    ];
  const tip = (i: number): P2 => nth(tips, i);
  for (const sd of [-1, 1]) {
    const W = (r: number, z: number, ch: string, b: number, col: Color, s2?: number) =>
      lit(0, WY, z, ch, s2 || 1, b, col, 'wing', { sd, r });
    const bone = (a: P2, b2: P2, thick: boolean) => {
      const n = Math.max(2, Math.round(Math.hypot(b2[0] - a[0], b2[1] - a[1]) / (S * 0.75)));
      for (let k = 0; k <= n; k++) {
        const f = k / n;
        W(a[0] + (b2[0] - a[0]) * f, a[1] + (b2[1] - a[1]) * f, thick ? '=' : '-', 1.6, HORN, thick ? 1.1 : 1);
      }
    };
    bone(sh, wr, true);
    W(wr[0], wr[1] + 0.06, '^', 2.2, HORN, 1.1);
    for (const tp of tips) bone(wr, tp, false);
    // membrane: fill each triangle (wrist, tip_i, tip_i+1) and (shoulder, wrist, last tip); trailing edge bows inward between tips
    const tris: readonly (readonly [P2, P2, P2])[] = [
      [wr, tip(0), tip(1)],
      [wr, tip(1), tip(2)],
      [wr, tip(2), tip(3)],
      [sh, wr, tip(3)],
    ];
    for (const [A, B, C] of tris) {
      const st = S * 0.85,
        la = Math.hypot(B[0] - A[0], B[1] - A[1]),
        lb = Math.hypot(C[0] - A[0], C[1] - A[1]),
        nu = Math.max(2, Math.round(la / st)),
        nv = Math.max(2, Math.round(lb / st));
      for (let i = 1; i < nu; i++)
        for (let j = 1; j < nv; j++) {
          const u = i / nu,
            v = j / nv;
          if (u + v >= 0.98) continue;
          const bow = 0.18 * Math.sin((Math.PI * v) / (u + v || 1)) * (u + v);
          const r = A[0] + (B[0] - A[0]) * u + (C[0] - A[0]) * v,
            z = A[1] + (B[1] - A[1]) * u + (C[1] - A[1]) * v;
          const cx = (B[0] + C[0]) / 2,
            cz = (B[1] + C[1]) / 2;
          if (u + v > 0.82 && Math.hypot(r - cx, z - cz) < bow * 0.9) continue;
          W(r, z, mpick(['%', ':', '#', '.']), 0.85 + 0.25 * mr(), MEM);
        }
    }
    for (let i = 0; i < tips.length - 1; i++) {
      const B = tip(i),
        C = tip(i + 1);
      for (let k = 1; k < 6; k++) {
        const f = k / 6,
          r = B[0] + (C[0] - B[0]) * f,
          z = B[1] + (C[1] - B[1]) * f,
          inw = 0.16 * Math.sin(Math.PI * f);
        const dr = wr[0] - r,
          dz = wr[1] - z,
          dl = Math.hypot(dr, dz) || 1;
        W(r + (dr / dl) * inw, z + (dz / dl) * inw, '~', 1.3, [0.75, 0.3, 0.28]);
      }
    }
  }
  return pts;
}

// ---- 死者の体（もとは src/game/09-bodies-creatures.js）
/** リッチ（浮かぶ骸骨の術師）：裾が霧にほどける衣、開いた胸の肋骨、冷たい目と色あせた冠、骨の杖、回る本 */
export function lichForm(ty: BodyType): Body {
  const { S, pts, lit, stroke, ell } = q3(ty);
  pts.noExtra = true;
  const BONE: Color = [0.9, 0.88, 0.8],
    ROBE: Color = [0.45, 0.35, 0.6],
    GOLD: Color = [0.85, 0.7, 0.38],
    ICE: Color = [0.6, 0.88, 1.0],
    MIST: Color = [0.55, 0.55, 0.75],
    BOOK: Color = [0.6, 0.45, 0.85];
  // 衣。裾は床の上で霧にほどける
  for (let y = 0.28; y <= 1.3; y += S * 0.85) {
    const f = (y - 0.28) / 1.02,
      r = 0.32 - 0.1 * f,
      n = Math.max(6, Math.round((2 * Math.PI * r) / (S * 0.9)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      if (f < 0.25 && mr() < 0.35 * (1 - f / 0.25)) continue;
      lit(
        Math.cos(a) * r,
        y,
        Math.sin(a) * r * 0.85,
        mpick(['%', ':', '|', '#']),
        1,
        0.75 + 0.35 * Math.max(0, Math.cos(a - 0.8)),
        ROBE,
        'robe',
      );
    }
  }
  for (let k = 0; k < 16; k++) {
    const a = mr() * 6.28,
      r = 0.25 + mr() * 0.15;
    lit(Math.cos(a) * r, 0.08 + mr() * 0.2, Math.sin(a) * r, mpick(['~', '.']), 0.9, 0.8, MIST, 'robe');
  }
  // 開いた胸から見える肋骨
  for (let r = 0; r < 4; r++) for (const sd of [-1, 1]) lit(sd * 0.08, 1.12 - r * 0.08, 0.2, sd < 0 ? '(' : ')', 0.9, 1.4, BONE);
  // 頭蓋骨、冷たい目、色あせた冠
  ell([0, 1.5, 0.02], 0.13, 0.14, 0.13, SKINR, () => BONE, 'head');
  for (const sd of [-1, 1]) lit(sd * 0.05, 1.52, 0.14, '*', 0.9, 3.8, ICE, 'head');
  lit(0, 1.4, 0.14, '=', 0.85, 1.4, BONE, 'head');
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    lit(Math.cos(a) * 0.12, 1.65, Math.sin(a) * 0.11, k % 2 ? '^' : '=', 0.9, 1.8, GOLD, 'head');
  }
  // 骨の腕と骨の杖（頭が冷たく光る）。もう一方の手は開いている
  stroke([0.26, 1.25, 0.06], [0.34, 0.95, 0.14], BONE, 1.3, 0.9, 'body');
  stroke([0.38, 0.15, 0.14], [0.38, 1.85, 0.14], [0.7, 0.66, 0.6], 1.1, 0.9, 'body');
  lit(0.38, 1.92, 0.14, '@', 1.3, 3.6, ICE, 'body');
  stroke([-0.26, 1.25, 0.06], [-0.36, 1.05, 0.3], BONE, 1.3, 0.9, 'body');
  for (let f2 = 0; f2 < 4; f2++) lit(-0.36 + (f2 - 1.5) * 0.03, 1.02, 0.38, "'", 0.8, 1.4, BONE, 'body');
  // まわりを回る本。ページがめくれる
  for (const [ch, dy] of [
    ['#', 0],
    ['=', 0.08],
    ['=', -0.08],
  ] as const)
    lit(0, 1.0 + dy, 0, ch, 1.05, 2.2, BOOK, 'orbit', { r: 0.6, sp: 0.7, ph: 0 });
  lit(0, 1.12, 0, '~', 0.9, 2.8, ICE, 'orbit', { r: 0.6, sp: 0.7, ph: 0.12 });
  return pts;
}
