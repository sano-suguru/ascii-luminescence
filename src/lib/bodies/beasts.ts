// 四つ足・大きな生き物・死者の形（もとは src/game/09-bodies-creatures.js）。q2・q3 の道具で、面の向きに合わせて文字と明るさを決める。
import { mpick, mr } from '../random.ts';
import { type Body, type BodyType, type Color, type Vec3, FUR, MUD, SCALE, SKINR, STONE, q2, q3 } from './kit.ts';

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
  const { S, pts, lit, stroke, ell, tube } = q3(ty),
    SK: Color = [0.5, 0.6, 0.46],
    MOSS: Color = [0.42, 0.72, 0.36],
    ST: Color = [0.62, 0.62, 0.6],
    EYE: Color = [1, 0.85, 0.3];
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'legL' : 'legR';
    tube([sd * 0.16, 0.62, 0], [sd * 0.18, 0.05, 0.04], 0.12, 0.1, SKINR, SK, part, { piv: 0.62, pz: 0 }, 0.2);
  }
  for (let y = 0.6; y <= 1.45; y += S * 0.85) {
    const f = (y - 0.6) / 0.85,
      rx = 0.28 + 0.08 * f,
      rz = 0.22,
      lean = 0.3 * f,
      n = Math.max(6, Math.round((2 * Math.PI * rx) / (S * 0.85)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      lit(
        Math.cos(a) * rx,
        y,
        Math.sin(a) * rz + lean,
        Math.sin(a) < -0.4 && f > 0.4 ? mpick([',', '"']) : mpick(['o', '%', ':']),
        1,
        Math.sin(a) < -0.4 && f > 0.4 ? 1.2 : 1.0,
        Math.sin(a) < -0.4 && f > 0.4 ? MOSS : SK,
      );
    }
  }
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'armL' : 'armR',
      ex = { piv: 1.4, pz: 0 };
    tube([sd * 0.4, 1.38, 0.3], [sd * 0.5, 0.8, 0.45], 0.09, 0.08, SKINR, SK, part, ex, 0.2);
    tube([sd * 0.5, 0.8, 0.45], [sd * 0.48, 0.2, 0.55], 0.08, 0.07, SKINR, SK, part, ex, 0.1);
    for (let c = 0; c < 4; c++) lit(sd * 0.48 + (c - 1.5) * 0.04, 0.1, 0.6, 'v', 1, 1.3, SK, part, ex);
  }
  ell([0, 1.38, 0.55], 0.15, 0.14, 0.15, SKINR, () => SK, 'head');
  lit(0, 1.33, 0.73, '(', 1.3, 1.5, SK, 'head');
  lit(0.02, 1.33, 0.73, ')', 1.3, 1.5, SK, 'head');
  for (const sd of [-1, 1]) {
    lit(sd * 0.06, 1.42, 0.68, '.', 0.8, 3.2, EYE, 'head');
    lit(sd * 0.08, 1.22, 0.68, '^', 1, 2.2, [0.95, 0.92, 0.82], 'head');
  }
  stroke([0.48, 0.2, 0.55], [0.4, 0.04, 1.2], [0.55, 0.45, 0.3], 1.1, 1, 'armR', { piv: 1.4, pz: 0 });
  for (let q = 0; q < 6; q++)
    lit(0.4 + (mr() - 0.5) * 0.15, 0.08 + (mr() - 0.2) * 0.1, 1.25 + (mr() - 0.5) * 0.15, mpick(['#', '%']), 1.1, 1.2, ST, 'armR', {
      piv: 1.4,
      pz: 0,
    });
  return pts;
}

export function golemForm2(ty: BodyType): Body {
  const { S, pts, lit, box } = q3(ty),
    ST: Color = [0.66, 0.66, 0.68],
    MOSS: Color = [0.42, 0.68, 0.36],
    GLOW: Color = [0.6, 0.85, 1.0];
  for (const sd of [-1, 1]) box([sd * 0.2, 0.3, 0], 0.13, 0.3, 0.14, STONE, ST, sd < 0 ? 'legL' : 'legR', { piv: 0.6, pz: 0 });
  box([0, 0.95, 0], 0.38, 0.32, 0.24, STONE, ST);
  box([0, 0.58, 0], 0.26, 0.08, 0.18, STONE, ST);
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'armL' : 'armR',
      ex = { piv: 1.2, pz: 0 };
    box([sd * 0.55, 1.15, 0], 0.15, 0.12, 0.16, STONE, ST, part, ex);
    box([sd * 0.58, 0.75, 0.04], 0.12, 0.25, 0.12, STONE, ST, part, ex);
    box([sd * 0.58, 0.4, 0.08], 0.13, 0.1, 0.13, STONE, ST, part, ex);
  }
  box([0, 1.42, 0.04], 0.12, 0.12, 0.12, STONE, ST, 'head');
  for (const sd of [-1, 1]) lit(sd * 0.05, 1.44, 0.17, '.', 0.8, 3.4, GLOW, 'head');
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    lit(Math.cos(a) * 0.14, 0.98 + Math.sin(a) * 0.14, 0.25, '*', 0.9, 2.8, GLOW);
  }
  lit(0, 0.98, 0.26, '+', 1.2, 3.4, GLOW);
  for (const y of [0.62, 1.28]) for (let x = -0.36; x <= 0.36; x += S) lit(x, y, 0.245, '-', 0.8, 2.0, GLOW);
  for (let k = 0; k < 10; k++) lit((mr() - 0.5) * 0.7, 1.0 + mr() * 0.3, -0.25, mpick([',', '"']), 1, 1.2, MOSS);
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
      path[i] as Vec3,
      path[i + 1] as Vec3,
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
      at = (i: number): Vec3 => ctrl[i] as Vec3;
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
  const seg = (a: readonly Vec3[], i: number): Vec3 => a[i] as Vec3;
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
