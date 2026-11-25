// 小さな生き物の形（もとは src/game/09-bodies-creatures.js の初めと、13-creatures.js の古い形。古いトロルは 07-bodies-lords.js）。
import { mpick, mr } from '../random.ts';
import { type Body, type BodyType, adder, cpt } from './kit.ts';

export function jellyForm(ty: BodyType): Body {
  const pts: Body = [],
    S = 0.22 / ty.scale,
    C = ty.col;
  for (let y = 0.04; y < 0.6; y += 0.11) {
    const r = 0.5 * Math.sqrt(Math.max(0, 1 - Math.pow(y / 0.62, 2))) + 0.03,
      n = Math.max(5, Math.round((2 * Math.PI * r) / 0.16));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + y * 3,
        rim = Math.abs(Math.cos(a));
      cpt(pts, Math.cos(a) * r, y, Math.sin(a) * r, rim > 0.7 ? '(' : mpick(['~', 'o', '.']), S, rim > 0.7 ? 1.4 : 0.7, C, 'jel');
    }
  }
  for (let k = 0; k < 7; k++)
    cpt(pts, (mr() - 0.5) * 0.4, 0.12 + mr() * 0.3, (mr() - 0.5) * 0.4, mpick(['o', '%', '=']), S * 0.9, 0.8, [0.88, 0.82, 0.72], 'jel');
  return pts;
}

export function bloatForm(ty: BodyType): Body {
  const pts: Body = [],
    S = 0.22,
    C = ty.col;
  for (let i = 0; i < 38; i++) {
    const y = 1 - (2 * (i + 0.5)) / 38,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996;
    cpt(
      pts,
      Math.cos(a) * rr * 0.42,
      y * 0.4,
      Math.sin(a) * rr * 0.42,
      y > 0.3 ? 'o' : mpick(['O', '%', 'o']),
      S,
      0.9 + 0.5 * Math.max(0, y),
      C,
      'bloat',
    );
  }
  for (let m2 = 0; m2 < 4; m2++) {
    const a = (m2 / 4) * Math.PI * 2;
    for (let k = 0; k < 6; k++) {
      const v = -0.7 + k * 0.28;
      cpt(
        pts,
        Math.cos(a) * Math.cos(v) * 0.43,
        Math.sin(v) * 0.41,
        Math.sin(a) * Math.cos(v) * 0.43,
        '|',
        S * 0.8,
        1.5,
        [0.75, 0.72, 0.5],
        'bloat',
      );
    }
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    cpt(pts, Math.cos(a) * 0.09, -0.4, Math.sin(a) * 0.09, k % 2 ? '(' : ')', S * 0.8, 1.2, [0.55, 0.4, 0.3], 'bloat');
  }
  return pts;
}

export function wispForm(ty: BodyType): Body {
  const pts: Body = [],
    S = 0.22,
    C = ty.col;
  cpt(pts, 0, 0, 0, '*', S * 1.5, 4.0, [1.0, 1.0, 0.9], 'wisp');
  for (let k = 0; k < 5; k++)
    cpt(pts, (mr() - 0.5) * 0.06, 0.04 + k * 0.05, (mr() - 0.5) * 0.06, '^', S * (1 - k * 0.12), 3.2 - k * 0.3, C, 'wisp');
  for (let i = 0; i < 22; i++) {
    const y = 1 - (2 * (i + 0.5)) / 22,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996;
    cpt(pts, Math.cos(a) * rr * 0.32, y * 0.34, Math.sin(a) * rr * 0.32, mpick(['.', "'", ',']), S * 0.85, 0.9, C, 'wisp');
  }
  return pts;
}

export function eelForm(ty: BodyType): Body {
  const pts: Body = [],
    S = 0.2,
    C = ty.col;
  for (let k = 0; k <= 16; k++) {
    const z = 0.8 - k * 0.1,
      w = 0.07 * (1 - k / 20);
    for (const sd of [-1, 1]) cpt(pts, sd * w, 0.04, z, sd < 0 ? '(' : ')', S, 1.1, C, 'eelw');
    if (k % 2 === 0 && k > 2) cpt(pts, 0, 0.12, z, '^', S * 0.85, 1.3, C, 'eelw');
  }
  cpt(pts, 0.05, 0.08, 0.82, '.', S * 0.9, 3.0, [0.9, 1.0, 0.8], 'eelw');
  cpt(pts, -0.05, 0.08, 0.82, '.', S * 0.9, 3.0, [0.9, 1.0, 0.8], 'eelw');
  cpt(pts, 0, 0.04, 0.9, '>', S, 1.3, C, 'eelw');
  return pts;
}

export function snakeForm(ty: BodyType): Body {
  const pts: Body = [],
    S = 0.22 / ty.scale,
    C = ty.col;
  for (let k = 0; k <= 18; k++) {
    const z = 0.55 - k * 0.075,
      w = 0.06 * (1 - k / 24);
    cpt(pts, 0, 0.05, z, k % 3 === 0 ? '=' : '~', S, 1.1, C, 'slither');
    for (const sd of [-1, 1]) if (k % 2 === 0) cpt(pts, sd * w, 0.05, z, '.', S * 0.7, 0.8, [0.55, 0.6, 0.35], 'slither');
  }
  cpt(pts, -0.06, 0.07, 0.6, '<', S, 1.4, C, 'slither');
  cpt(pts, 0.06, 0.07, 0.6, '>', S, 1.4, C, 'slither');
  cpt(pts, 0, 0.08, 0.64, '^', S, 1.3, C, 'slither');
  cpt(pts, 0.03, 0.1, 0.62, '.', S * 0.8, 3.0, [1.0, 0.9, 0.4], 'slither');
  cpt(pts, -0.03, 0.1, 0.62, '.', S * 0.8, 3.0, [1.0, 0.9, 0.4], 'slither');
  cpt(pts, 0, 0.06, 0.73, '-', S * 0.8, 1.8, [0.95, 0.35, 0.35], 'tongue');
  return pts;
}

export function fishForm(ty: BodyType): Body {
  const pts: Body = [],
    S = 0.22 / ty.scale,
    C = ty.col;
  for (let k = 0; k <= 6; k++) {
    const z = 0.3 - k * 0.09,
      w = 0.13 * Math.sin((Math.PI * (k + 0.5)) / 7.5);
    for (const sd of [-1, 1]) cpt(pts, sd * w, 0, z, sd < 0 ? '(' : ')', S, 1.1, C, 'body');
  }
  cpt(pts, 0, 0, 0.38, '>', S, 1.3, C, 'head');
  cpt(pts, 0.05, 0.03, 0.3, '.', S * 0.8, 2.4, [1, 1, 1], 'head');
  for (let k = 0; k < 3; k++)
    cpt(pts, (mr() - 0.5) * 0.06, (mr() - 0.5) * 0.05, 0.12 - k * 0.04, '*', S * (1.1 - k * 0.2), 3.6, [1.0, 0.95, 0.6], 'body');
  for (const sd of [-1, 1]) cpt(pts, sd * 0.08, 0, -0.4, sd < 0 ? '/' : '\\', S, 1.3, C, 'tail', { piv: 2 });
  cpt(pts, 0, 0, -0.36, '<', S, 1.2, C, 'tail', { piv: 1 });
  return pts;
}

export function shroomForm(ty: BodyType): Body {
  const pts: Body = [],
    S = 0.22 / ty.scale,
    C = ty.col;
  for (let k = 0; k < 4; k++) cpt(pts, 0, 0.06 + k * 0.13, 0, '|', S * 1.1, 0.95, [0.85, 0.82, 0.75], 'body');
  for (const [y, r] of [
    [0.55, 0.46],
    [0.64, 0.4],
    [0.72, 0.28],
    [0.78, 0.12],
  ] as const) {
    const n = Math.max(5, Math.round((2 * Math.PI * r) / 0.16));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      cpt(pts, Math.cos(a) * r, y, Math.sin(a) * r, y < 0.6 ? '=' : '^', S, 1.1, C, 'cap');
    }
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    cpt(pts, Math.cos(a) * 0.28, 0.5, Math.sin(a) * 0.28, '|', S * 0.85, 0.8, [0.8, 0.7, 0.65], 'cap');
  }
  for (let k = 0; k < 6; k++) {
    const a = mr() * 6.28,
      r = mr() * 0.3;
    cpt(pts, Math.cos(a) * r, 0.76, Math.sin(a) * r, '.', S, 2.8, [1.0, 0.95, 0.85], 'cap');
  }
  return pts;
}

export function crabForm(ty: BodyType): Body {
  const pts: Body = [],
    S = 0.22 / ty.scale,
    C = ty.col;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    cpt(pts, Math.cos(a) * 0.32, 0.22, Math.sin(a) * 0.24, Math.abs(Math.sin(a)) > 0.7 ? '=' : '(', S, 1.1, C, 'body');
  }
  for (let k = 0; k < 5; k++)
    cpt(pts, (k - 2) * 0.1, 0.26, (k % 2) * 0.06 - 0.03, k === 2 ? '?' : '~', S, k === 2 ? 2.2 : 1.1, [0.95, 0.88, 0.6], 'body');
  for (const sd of [-1, 1])
    for (let l = 0; l < 3; l++) {
      const z = 0.14 - l * 0.14,
        part = (l % 2 === 0) === sd > 0 ? 'legL' : 'legR';
      cpt(pts, sd * 0.4, 0.14, z, sd < 0 ? '\\' : '/', S, 1.0, C, part, { piv: 0.22, pz: z });
      cpt(pts, sd * 0.48, 0.04, z, '|', S * 0.9, 0.9, C, part, { piv: 0.22, pz: z });
    }
  for (const sd of [-1, 1]) {
    cpt(pts, sd * 0.1, 0.32, 0.22, '|', S * 0.7, 1.0, C, 'head');
    cpt(pts, sd * 0.1, 0.38, 0.22, '.', S * 0.9, 2.6, [1, 1, 0.9], 'head');
  }
  return pts;
}

// ---- 古い形（色を持たない点。13-creatures.js の初めにあった物）

/** 小さな生き物（魚・茸・虫）。form で形が変わる */
export function critterForm(ty: { form?: string }): Body {
  const pts: Body = [],
    add = adder(pts);
  if (ty.form === 'fish') {
    add(0, 0, 0.32, '>', 0.22, 2.0, 'head');
    for (let k = 0; k < 4; k++) add(0, 0, 0.18 - k * 0.12, k % 2 ? '=' : '-', 0.2, 1.5, 'body');
    add(0, 0, -0.36, '<', 0.24, 1.4, 'tail', 1);
    add(0.09, 0.02, 0.05, '.', 0.1, 1.6, 'body');
    add(-0.09, 0.02, 0.05, '.', 0.1, 1.6, 'body');
  } else if (ty.form === 'shroom') {
    for (let k = 0; k < 3; k++) add(0, 0.1 + k * 0.16, 0, '|', 0.18, 0.8, 'body');
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      add(Math.cos(a) * 0.22, 0.58, Math.sin(a) * 0.22, k % 2 ? '^' : 'n', 0.17, 1.5, 'head');
    }
    add(0, 0.66, 0, '*', 0.2, 2.4, 'core');
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      add(Math.cos(a) * 0.12, 0.5, Math.sin(a) * 0.12, '.', 0.1, 2.2, 'head');
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const y = 1 - (2 * (i + 0.5)) / 10,
        rr = Math.sqrt(1 - y * y),
        a = i * 2.39996;
      add(Math.cos(a) * rr * 0.2, 0.28 + y * 0.1, Math.sin(a) * rr * 0.2, mpick(['&', '%', 'o']), 0.14, 1.1, 'body');
    }
    add(0.07, 0.38, 0.18, 'o', 0.1, 2.4, 'head');
    add(-0.07, 0.38, 0.18, 'o', 0.1, 2.4, 'head');
    for (const sx of [1, -1])
      for (const z of [0.15, 0, -0.15]) {
        const part = z > 0 === sx > 0 ? 'legL' : 'legR';
        add(sx * 0.28, 0.12, z, sx > 0 ? '\\' : '/', 0.14, 0.9, part, 0.25, z);
      }
  }
  return pts;
}

export function spiderForm(): Body {
  const pts: Body = [],
    add = adder(pts);
  for (let i = 0; i < 10; i++) {
    const y = 1 - (2 * (i + 0.5)) / 10,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996;
    add(Math.cos(a) * rr * 0.22, 0.42 + y * 0.16, -0.18 + Math.sin(a) * rr * 0.26, mpick(['%', '&', 'o']), 0.15, 1.0, 'body');
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(Math.cos(a) * 0.12, 0.42, 0.16 + Math.sin(a) * 0.08, 'o', 0.12, 1.1, 'head');
  }
  add(0.05, 0.48, 0.26, '*', 0.08, 2.6, 'head');
  add(-0.05, 0.48, 0.26, '*', 0.08, 2.6, 'head');
  add(0.02, 0.52, 0.24, '.', 0.06, 2.4, 'head');
  add(-0.02, 0.52, 0.24, '.', 0.06, 2.4, 'head');
  for (const sx of [1, -1])
    for (let k = 0; k < 4; k++) {
      const z = 0.2 - k * 0.13,
        part = (k % 2 === 0) === sx > 0 ? 'legL' : 'legR';
      add(sx * 0.24, 0.5, z, sx > 0 ? '/' : '\\', 0.14, 0.8, part, 0.42, z);
      add(sx * 0.4, 0.34, z + 0.02, sx > 0 ? '\\' : '/', 0.14, 0.8, part, 0.42, z);
      add(sx * 0.5, 0.12, z + 0.04, '|', 0.12, 0.7, part, 0.42, z);
    }
  return pts;
}

export function robotForm(): Body {
  const pts: Body = [],
    add = adder(pts);
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 2; b++)
      for (let c = 0; c < 3; c++) {
        if (a === 1 && c === 1 && b === 0) continue;
        add((a - 1) * 0.16, 0.42 + b * 0.18, (c - 1) * 0.16, (a + b + c) % 2 ? '#' : '=', 0.17, 0.85, 'body');
      }
  add(0, 0.56, 0.26, 'o', 0.2, 3.0, 'core');
  add(0, 0.82, 0, '|', 0.14, 0.8, 'head');
  add(0, 0.96, 0, '*', 0.12, 2.4, 'head');
  for (const sx of [1, -1]) for (let k = 0; k < 3; k++) add(sx * 0.27, 0.14, (k - 1) * 0.16, '=', 0.15, 0.7, 'body');
  return pts;
}

export function bogForm(): Body {
  const pts: Body = [],
    add = adder(pts);
  for (let i = 0; i < 22; i++) {
    const y = (i + 0.5) / 22,
      rr = Math.sqrt(1 - y * y) * 0.55,
      a = i * 2.39996;
    add(Math.cos(a) * rr, y * 0.75, Math.sin(a) * rr, mpick(['%', '&', '#', '~', 'o']), 0.2, 0.9, 'body');
  }
  add(0.14, 0.62, 0.4, 'o', 0.14, 3.0, 'head');
  add(-0.14, 0.62, 0.4, 'o', 0.14, 3.0, 'head');
  for (let k = 0; k < 5; k++) add((k - 2) * 0.12, 0.18, 0.5, '|', 0.14, 0.8, 'body');
  return pts;
}

export function krakenForm(): Body {
  const pts: Body = [],
    add = adder(pts);
  for (let i = 0; i < 16; i++) {
    const y = 1 - (2 * (i + 0.5)) / 16,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996;
    add(Math.cos(a) * rr * 0.6, y * 0.35, Math.sin(a) * rr * 0.6, mpick(['%', '&', 'o', '8']), 0.24, 0.7, 'body');
  }
  add(0.2, 0.15, 0.45, 'O', 0.22, 3.0, 'head');
  add(-0.2, 0.15, 0.45, 'O', 0.22, 3.0, 'head');
  return pts;
}

// troll: hunched, with arms that nearly reach the ground and moss hanging from the shoulders
export function trollForm(): Body {
  const L = 'T',
    pts: Body = [],
    add = adder(pts);
  for (let i = 0; i < 9; i++) {
    const y = 1 - (2 * (i + 0.5)) / 9,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996;
    add(Math.cos(a) * rr * 0.15, 1.26 + y * 0.14, 0.24 + Math.sin(a) * rr * 0.15, mpick([L, '%', '*']), 0.15, 1.5, 'head');
  }
  for (let k = 0; k < 5; k++) {
    const yy = 0.88 + k * 0.1,
      lean = k * 0.045;
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      add(Math.cos(a) * 0.26, yy, Math.sin(a) * 0.17 + lean, mpick(['%', '&', '#', L]), 0.16, 1.0, 'body');
    }
  }
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 8; k++) {
      const f = k / 7;
      // 右腕の '\\\\' は、もとから2文字（文字の絵の表の番号は1文字目の \\ で決まる）
      add(
        sd * (0.34 + f * 0.05),
        1.3 - f * 1.05,
        0.12 + f * 0.06,
        mpick([L, '|', '%', sd < 0 ? '/' : '\\\\']),
        0.15,
        1.0,
        sd < 0 ? 'armL' : 'armR',
        1.3,
      );
    }
    for (let k = 0; k < 3; k++) add(sd * (0.36 + k * 0.05), 0.22 - k * 0.03, 0.2, 'v', 0.12, 1.0, sd < 0 ? 'armL' : 'armR', 1.3);
    for (let k = 0; k < 5; k++) {
      const f = k / 4;
      add(sd * 0.14, 0.82 - f * 0.74, 0, mpick(['|', '!', '#']), 0.17, 0.95, sd < 0 ? 'legL' : 'legR', 0.82);
    }
    for (let k = 0; k < 4; k++) add(sd * (0.2 + k * 0.04), 1.25 - k * 0.12, -0.05, mpick(['"', ',', ';']), 0.12, 0.9, 'body');
  }
  add(0, 1.3, 0.33, L, 0.4, 3.0, 'core');
  return pts;
}
