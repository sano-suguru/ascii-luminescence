// 生き物の形を作る（もとは src/game/07-bodies-lords.js・09-bodies-creatures.js・10-bodies-beast.js）。
// buildForm が、種類（MTYPES の1つ）の form・look から形を選んで作り、見た目の特徴（extraLook）を足す。
// 人型と四つ足の形と、種類ごとの見た目の特徴（lookHumanoid・shapeHumanoid・lookQuad・humanoid2）もここにある。
// addLooks は、表 MTYPES に見た目（look など）を書き足す（古い JS の 07-bodies-lords.js が、読み込む時に呼ぶ）。
// 形を作る時に mr()（見た目の乱数）を引く順番を変えると、同じシードでも違う見た目になるので、順番を変えないこと。
import { lookup } from '../array.ts';
import type { Color } from '../color.ts';
import { MTYPES } from '../creatures.ts';
import { G } from '../glyphs.ts';
import { clamp } from '../rng.ts';
import { mpick, mr } from '../random.ts';
import {
  batForm,
  bogForm2,
  caveSpiderForm,
  conjurerForm,
  dragonForm,
  golemForm2,
  grazerForm,
  fireHoundForm,
  iceHoundForm,
  lightHoundForm,
  jackalForm,
  krakenForm2,
  lichForm,
  nagaForm,
  ogreForm,
  phantomForm,
  ratForm,
  salamanderForm,
  trollForm2,
  wraithForm2,
} from './beasts.ts';
import { deepKrakenForm, lichKingForm, nagaQueenForm, oldDragonForm, shadowSerpentForm, spiderQueenForm } from './bosses.ts';
import { type Add, type Body, type BodyType, type Extra, BONE, GOLD, HRAMP, PALE, adder, mLit } from './kit.ts';
import {
  type BeastBody,
  type HumProp,
  HUM_PROP,
  LOOK_PROP,
  beastForm,
  beastForm2,
  cleanerForm,
  golemForm,
  repairerForm,
  shadowKingForm,
  watcherForm,
} from './lords.ts';
import {
  bloatForm,
  bogForm,
  crabForm,
  critterForm,
  eelForm,
  fishForm,
  jellyForm,
  krakenForm,
  robotForm,
  shroomForm,
  snakeForm,
  spiderForm,
  trollForm,
  wispForm,
} from './small.ts';

/** 形を作るのに使う、種類の値（MTYPES の1つ。壁の像は ch と form だけで作る） */
export interface FormType extends BodyType {
  ch: string;
  form: string;
  look?: string | null | undefined;
  boss?: boolean;
  invisible?: boolean;
  /** 主の元の生き物の記号（見張りの蛇顎 'sw' など） */
  sk?: string;
  name?: string;
  /** 忘れられた獣の体の作り */
  spec?: BeastBody;
}

/** 人型の体の割合（見た目ごと。表に無い見た目は base） */
const propOf = (look: string | null | undefined): HumProp =>
  lookup(HUM_PROP, (look === undefined || look === null ? undefined : LOOK_PROP[look]) || 'base');
/** 形の中の、part が parts のどれかの点に f をする */
const moveParts = (pts: Body, parts: readonly string[], f: (p: Body[number]) => void): void => {
  for (const p of pts) if (parts.includes(p.part)) f(p);
};

// ---- 種類ごとの特徴を、共通の体の上に足す（短く：割合と、持っている物を少し）
/** 古い人型の上に、見た目ごとの特徴を足す（add は色を持たない点を足す。L は種類の文字） */
export function lookHumanoid(look: string | null | undefined, pts: Body, add: Add, L: string): void {
  const mv = (parts: readonly string[], f: (p: Body[number]) => void): void => moveParts(pts, parts, f);
  if (look === 'kobold') {
    for (const sd of [-1, 1]) add(sd * 0.13, 1.72, 0, '^', 0.13, 1.4, 'head');
    for (let k = 0; k < 10; k++) add(0.33, 0.35 + k * 0.17, 0.05, k === 9 ? '^' : '|', 0.13, k === 9 ? 2.2 : 1.0, 'armR', 1.36);
  } else if (look === 'goblin') {
    for (const sd of [-1, 1]) add(sd * 0.25, 1.56, -0.02, sd < 0 ? '<' : '>', 0.13, 1.3, 'head');
    add(0.36, 0.8, 0.14, '-', 0.14, 1.7, 'armR', 1.36);
  } else if (look === 'snapjaw') {
    mv(['head', 'core'], (p) => {
      p.z += 0.06;
    });
    for (let k = 0; k < 4; k++) add(0, 1.46, 0.2 + k * 0.07, mpick(['=', '>']), 0.12, 1.2, 'head');
    for (let k = 0; k < 5; k++) add(0, 1.72 - k * 0.1, -0.14 - k * 0.02, '^', 0.12, 1.1, 'head');
  } else if (look === 'monkey') {
    mv(['head', 'core', 'body'], (p) => {
      p.z += (0.18 * Math.max(0, p.y - 0.9)) / 0.7;
      p.y -= 0.12;
    });
    mv(['armL', 'armR'], (p) => {
      p.y = p.piv - (p.piv - p.y) * 1.6;
    });
    for (let k = 0; k < 8; k++) {
      const a = (k / 7) * Math.PI;
      add(0, 0.72 + Math.sin(a) * 0.42, -0.2 - k * 0.07, mpick(['~', 's', '(']), 0.11, 1.0, 'tail', k * 0.6);
    }
  } else if (look === 'conjurer') {
    for (let i = pts.length - 1; i >= 0; i--) {
      const part = pts[i]?.part;
      if (part === 'legL' || part === 'legR') pts.splice(i, 1);
    }
    for (let y = 0.08; y < 0.95; y += 0.13) {
      const r = 0.36 - (y / 0.95) * 0.14,
        n = 9;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        add(Math.cos(a) * r, y, Math.sin(a) * r * 0.8, mpick(['/', '\\', '|', L]), 0.14, 0.95, 'robe');
      }
    }
    for (let k = 0; k < 11; k++) add(0.4, 0.1 + k * 0.18, 0.1, '|', 0.12, 0.9, 'armR', 1.36);
    add(0.4, 2.08, 0.1, '*', 0.22, 3.2, 'armR', 1.36);
    for (const [dx, dy] of [
      [-0.1, 1.72],
      [0, 1.8],
      [0.1, 1.72],
    ] as const)
      add(dx, dy, -0.02, '^', 0.12, 1.2, 'head');
  } else if (look === 'ogre') {
    mv(['body', 'head', 'core'], (p) => {
      p.x *= 1.35;
      p.z *= 1.3;
    });
    mv(['armL', 'armR'], (p) => {
      p.x *= 1.3;
    });
    for (let k = 0; k < 7; k++)
      add(0.47 + (mr() - 0.5) * 0.12, 0.6 + k * 0.05, 0.12 + (mr() - 0.5) * 0.12, mpick(['#', '%', '@']), 0.17, 1.1, 'armR', 1.36);
  } else if (look === 'gnome') {
    for (let k = 0; k < 5; k++) {
      const r = 0.16 - k * 0.03,
        n = Math.max(1, 6 - k);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        add(Math.cos(a) * r, 1.66 + k * 0.09, Math.sin(a) * r, k === 4 ? '^' : 'A', 0.12, 1.2, 'head');
      }
    }
    for (let k = 0; k < 4; k++) add((k - 1.5) * 0.05, 1.36, 0.15, '"', 0.11, 1.1, 'head');
  }
}
/** 体の割合を種類ごとに変える：腰・肩・頭を動かし、その間（持っている物も）はそれに沿う */
export function shapeHumanoid(pts: Body, look: string | null | undefined): void {
  const P = propOf(look);
  const map = (y: number): number => (y <= 0.86 ? y * (P.hip / 0.86) : P.hip + (y - 0.86) * ((P.sh - P.hip) / (1.37 - 0.86)));
  for (const p of pts) {
    const head = p.part === 'head' || p.part === 'core';
    if (head) {
      p.y = P.hc + (p.y - 1.5) * P.hk;
      p.x *= P.hk;
      p.z *= P.hk;
    } else p.y = map(p.y);
    if (p.piv && (p.part.startsWith('arm') || p.part.startsWith('leg'))) p.piv = map(p.piv);
    if (P.legW && p.part.startsWith('leg')) p.x *= P.legW;
    if (P.lean && !p.part.startsWith('leg')) {
      const k = Math.max(0, (p.y - P.hip) / (P.hc - P.hip));
      p.z += P.lean * k;
    }
  }
}
/** 古い四つ足の上に、見た目ごとの特徴を足す */
export function lookQuad(look: string | null | undefined, pts: Body, add: Add, _L: string): void {
  const mv = (parts: readonly string[], f: (p: Body[number]) => void): void => moveParts(pts, parts, f);
  const legStretch = (top: number, k: number): void => {
    mv(['legL', 'legR'], (p) => {
      p.y = top - (p.piv - p.y) * k;
      p.piv = top;
    });
  };
  if (look === 'rat') {
    mv(['body', 'head', 'core', 'tail'], (p) => {
      p.y *= 0.72;
    });
    legStretch(0.27, 0.75);
    for (let k = 3; k < 9; k++) add(0, 0.33 - k * 0.02, -0.42 - k * 0.12, mpick(['~', '-']), 0.09, 0.85, 'tail', k);
  } else if (look === 'jackal') {
    mv(['body', 'head', 'core', 'tail'], (p) => {
      p.y += 0.14;
    });
    legStretch(0.5, 1.4);
    for (const sd of [-1, 1]) add(sd * 0.07, 0.86, 0.42, '^', 0.11, 1.3, 'head');
  } else if (look === 'grazer') {
    mv(['head', 'core'], (p) => {
      p.y -= 0.14;
      p.z += 0.06;
    });
    for (let k = 0; k < 7; k++) {
      const z = -0.3 + k * 0.1;
      for (let j = -1; j <= 1; j++) add(j * 0.08, 0.6 + 0.04 * Math.cos(j), z, mpick(['o', '%', '"']), 0.12, 1.2, 'body');
    }
  } else if (look === 'salamander') {
    mv(['body', 'head', 'core', 'tail'], (p) => {
      p.y *= 0.62;
      p.z *= 1.35;
    });
    legStretch(0.24, 0.7);
    for (let k = 3; k < 8; k++) add(0, 0.3 - k * 0.02, -0.56 - k * 0.12, mpick(['~', '=']), 0.1, 0.9, 'tail', k);
    for (let k = 0; k < 6; k++) add((mr() - 0.5) * 0.1, 0.42 + mr() * 0.08, -0.35 + k * 0.14, '^', 0.13, 2.6, 'body');
  }
}

/** 表 MTYPES に、見た目（look）・機械の形・猟犬の尾と色を書き足す。古い JS（07-bodies-lords.js）が、読み込む時に1回呼ぶ */
export function addLooks(): void {
  for (const [k, v] of Object.entries({
    k: 'kobold',
    g: 'goblin',
    s: 'snapjaw',
    sw: 'snapjaw',
    m: 'monkey',
    c: 'conjurer',
    O: 'ogre',
    G: 'gnome',
    r: 'rat',
    j: 'jackal',
    h: 'grazer',
    Zf: 'houndF',
    Zi: 'houndI',
    Zl: 'houndL',
    l: 'salamander',
    L: 'lich',
    W: 'wraith',
  })) {
    const ty = MTYPES[k];
    if (ty) ty.look = v;
  }
  lookup(MTYPES, 'Rc').form = 'cleaner';
  lookup(MTYPES, 'Re').form = 'repairer';
  lookup(MTYPES, 'Rw').form = 'watcher';
  // 猟犬：形（beasts.ts の fireHoundForm・iceHoundForm・lightHoundForm）は点ごとに色を持つので、種類の色は体には使わない（照準の先の足もとの輪などに使う）。
  // 火と氷の猟犬は種類の色を暗くし、灯りは元の色のまま
  const Zf = lookup(MTYPES, 'Zf'),
    Zi = lookup(MTYPES, 'Zi'),
    Zl = lookup(MTYPES, 'Zl');
  Zf.trail = 0;
  Zi.trail = 0;
  Zl.trail = 0;
  Zf.lcol = Zf.col;
  Zf.col = [0.42, 0.3, 0.26];
  Zi.lcol = Zi.col;
  Zi.col = [0.32, 0.42, 0.56];
  Zl.col = [1.0, 0.95, 0.78];
}

// ---- 主と死者：共通の体の上に、それぞれの特徴を足す（冠・杖・頭巾・角・裂けた布）。点は自分の色を持てる
/** 見た目の特徴を足す（見た目が無い時と、形が飾りを断る時 noExtra は足さない） */
export function extraLook(ty: { look?: string | null | undefined }, pts: Body): void {
  const look = ty.look;
  if (!look || pts.noExtra) return;
  const add = (
    x: number,
    y: number,
    z: number,
    ch: string,
    s: number,
    b: number,
    part?: string,
    col?: Color | null,
    extra?: Extra,
  ): void => {
    pts.push(Object.assign({ x, y, z, g: G(ch), s, b, part: part || 'body', ph: mr() * 6.28, piv: 0, pz: 0, col }, extra || {}));
  };
  const crown = (y: number, r: number, n: number, ch: string, col: Color, b?: number): void => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      add(Math.cos(a) * r, y, Math.sin(a) * r, ch, 0.12, b || 2.4, 'head', col);
    }
  };
  if (look === 'lichking' || look === 'lich') {
    crown(
      2.08,
      look === 'lichking' ? 0.17 : 0.13,
      look === 'lichking' ? 8 : 5,
      '^',
      look === 'lichking' ? GOLD : [0.9, 0.85, 0.6],
      look === 'lichking' ? 2.6 : 1.8,
    );
    if (look === 'lichking') {
      for (let k = 0; k < 12; k++) add(0.48, 0.25 + k * 0.15, 0.1, '|', 0.12, 1.1, 'robe', BONE);
      add(0.48, 2.1, 0.1, '*', 0.24, 3.2, 'robe', PALE);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        add(Math.cos(a) * 0.62, 0.12 + mr() * 0.3, Math.sin(a) * 0.62, mpick(['\\', '/', '~', '%']), 0.13, 0.9, 'robe');
      }
    } else {
      add(0, 1.45, 0, '#', 0.2, 2.2, 'orbit', [0.75, 0.55, 1.0], { r: 0.62, sp: 0.9 });
      add(0, 1.58, 0, '=', 0.16, 1.8, 'orbit', [0.75, 0.55, 1.0], { r: 0.62, sp: 0.9 });
    }
  } else if (look === 'wraith') {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2,
        r = 0.5 + mr() * 0.15;
      add(Math.cos(a) * r, 0.05 + mr() * 0.35, Math.sin(a) * r, mpick(['|', '\\', '/', '!']), 0.13, 0.85, 'robe');
    }
    for (const sd of [-1, 1])
      for (let k = 0; k < 3; k++)
        add(sd * (0.68 + k * 0.07), 1.28 - k * 0.05, 0.35 + k * 0.06, sd < 0 ? '<' : '>', 0.11, 1.8, 'robe', [0.9, 0.92, 1.0]);
  } else if (look === 'shadowking') {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      for (let q = 0; q < 3; q++)
        add(Math.cos(a) * 0.2, 2.12 + q * 0.12, Math.sin(a) * 0.2, q === 2 ? '^' : '|', 0.12, 2.4, 'head', [0.82, 0.72, 1.0]);
    }
    add(0.08, 1.92, 0.14, '*', 0.09, 3.4, 'head', [1, 1, 1]);
    add(-0.08, 1.92, 0.14, '*', 0.09, 3.4, 'head', [1, 1, 1]);
    for (let k = 0; k < 18; k++) {
      const f = k / 18;
      add((mr() - 0.5) * 0.6, 1.6 - f * 1.1, -0.3 - f * 0.8, mpick(['~', '%', "'"]), 0.15, 0.9, 'robe', [0.4, 0.3, 0.7]);
    }
  } else if (look === 'spiderqueen') {
    for (let i = 0; i < 22; i++) {
      const y = 1 - (2 * (i + 0.5)) / 22,
        rr = Math.sqrt(1 - y * y),
        a = i * 2.39996;
      add(Math.cos(a) * rr * 0.3, 0.5 + y * 0.24, -0.42 + Math.sin(a) * rr * 0.34, mpick(['%', '&', '@']), 0.15, 1.0, 'body');
    }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      add(Math.cos(a) * 0.1, 0.66, 0.2 + Math.sin(a) * 0.06, mpick(['*', "'"]), 0.08, 2.6, 'head', [0.88, 0.92, 1.0]);
    }
    for (let k = 0; k < 4; k++) add(0, 0.05, 0, 's', 0.1, 1.3, 'orbit', null, { r: 0.9 + k * 0.12, sp: 0.6 + k * 0.15, ph: k * 1.57 });
  } else if (look === 'nagaqueen') {
    crown(0.92, 0.1, 5, '^', GOLD, 2.6);
    for (const p of pts) if (p.part === 'head' && p.y > 0.9 - 0.01 && p.col === GOLD) p.z += 1.0;
    for (const sd of [-1, 1])
      for (let k = 0; k < 5; k++) add(sd * (0.12 + k * 0.05), 0.58 + k * 0.04, 0.86, sd < 0 ? '(' : ')', 0.12, 1.2, 'head');
  } else if (look === 'olddragon') {
    for (const sd of [-1, 1])
      for (let k = 0; k < 4; k++)
        add(sd * (0.08 + k * 0.03), 1.2 + k * 0.08, 0.74 - k * 0.06, sd < 0 ? '\\' : '/', 0.11, 1.4, 'head', BONE);
    for (let k = 0; k < 5; k++) add((k - 2) * 0.03, 0.94 - k * 0.04, 0.92, mpick(['"', ',']), 0.1, 1.1, 'head', [0.8, 0.78, 0.7]);
    for (let i = pts.length - 1; i >= 0; i--) if (pts[i]?.part === 'wing' && mr() < 0.3) pts.splice(i, 1);
    for (const p of pts) if (p.part === 'wing' && mr() < 0.3) p.g = G('%');
    for (let k = 0; k < 4; k++)
      add((mr() < 0.5 ? -1 : 1) * 0.21, 0.55 + mr() * 0.1, -0.3 + k * 0.18, '=', 0.12, 1.6, 'body', [0.9, 0.32, 0.22]);
  }
}

// ---- 人型（作り直した物）：材料ごとに陰を付けた、読める文字の体。割合は種類ごと、種類ごとの特徴も
/** 人型の形（コボルド・ゴブリン・蛇顎・猿・ノーム。呪術師は beasts.ts の conjurerForm） */
export function humanoid2(ty: FormType): Body {
  const look = ty.look,
    P = propOf(look),
    S = Math.min(0.36, 0.22 / ty.scale),
    GAP = S * 0.8,
    pts: Body = [];
  const CLT: Readonly<Record<string, Color>> = {
    kobold: [0.6, 0.42, 0.3],
    goblin: [0.55, 0.45, 0.32],
    snapjaw: [0.62, 0.5, 0.36],
    monkey: [0.55, 0.42, 0.3],
    ogre: [0.55, 0.42, 0.3],
    gnome: [0.35, 0.45, 0.75],
  };
  const SK = ty.col,
    CL: Color = (look === undefined || look === null ? undefined : CLT[look]) || [0.5, 0.45, 0.4];
  const LD = [0.42, 0.72, 0.55] as const,
    put = (
      x: number,
      y: number,
      z: number,
      nx: number,
      ny: number,
      nz: number,
      mat: keyof typeof HRAMP,
      col: Color,
      part?: string,
      extra?: Extra,
    ): void => {
      const l = Math.hypot(nx, ny, nz) || 1,
        d = (nx * LD[0] + ny * LD[1] + nz * LD[2]) / l,
        i = clamp(0.2 + 0.8 * Math.max(0, d), 0, 1),
        R = HRAMP[mat];
      pts.push(
        Object.assign(
          {
            x,
            y,
            z,
            g: G(R[Math.min(R.length - 1, Math.floor(i * R.length))] ?? ''),
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
  const lit = (x: number, y: number, z: number, ch: string, s: number, b: number, col: Color, part?: string, extra?: Extra): void =>
    mLit(pts, x, y, z, ch, s, b, col, part, extra);
  const strokeCh = (dx: number, dy: number): string =>
    Math.abs(dy) > Math.abs(dx) * 2 ? '|' : Math.abs(dx) > Math.abs(dy) * 2 ? '-' : dx * dy > 0 ? '/' : '\\';
  type V3 = readonly [number, number, number];
  const stroke = (a: V3, b: V3, col: Color, bri: number, s?: number, part?: string, extra?: Extra): void => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      dz = b[2] - a[2],
      L = Math.hypot(dx, dy, dz),
      n = Math.max(1, Math.round(L / GAP)),
      ch = strokeCh(dx, dy);
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      lit(a[0] + dx * f, a[1] + dy * f, a[2] + dz * f, ch, s || S, bri, col, part, extra);
    }
  };
  const lean = look === 'goblin' ? 0.12 : look === 'snapjaw' ? 0.14 : look === 'monkey' ? 0.22 : 0,
    lz = (y: number): number => lean * Math.max(0, (y - P.hip) / (P.hc - P.hip));
  const bw = look === 'ogre' ? 1.45 : look === 'kobold' || look === 'gnome' ? 0.9 : 1,
    legW = P.legW || 1;
  // 脚（布か毛）。腰から振る
  const furry = look === 'snapjaw' || look === 'monkey' || look === 'kobold';
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'legL' : 'legR';
    for (let y = 0.04; y < P.hip; y += GAP) {
      put(sd * 0.1 * bw * legW, y, 0, sd, 0, 0.6, furry ? 'fur' : 'cloth', furry ? SK : CL, part, { piv: P.hip, pz: 0 });
      if (legW > 1.1) put(sd * 0.16 * bw, y, 0, sd, 0, 0.4, 'skin', SK, part, { piv: P.hip, pz: 0 });
    }
  }
  // 胴：腰から肩への輪。オーガは腹が出る
  for (let y = P.hip; y <= P.sh + 0.01; y += GAP) {
    const f = (y - P.hip) / (P.sh - P.hip),
      bel = look === 'ogre' ? 0.1 * Math.sin(Math.PI * Math.min(1, f * 1.3)) : 0,
      rx = (0.18 + 0.04 * f) * bw + bel,
      rz = 0.13 * bw + bel,
      n = Math.max(5, Math.round((2 * Math.PI * Math.max(rx, rz)) / GAP));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2,
        nx = Math.cos(a),
        nz = Math.sin(a),
        mat = f < 0.25 && look !== 'ogre' ? 'cloth' : look === 'gnome' ? 'cloth' : 'skin';
      put(nx * rx, y, nz * rz + lz(y), nx, 0.2, nz, mat, mat === 'cloth' ? CL : SK);
    }
  }
  // 腕。肩から振る。猿の腕は地面に届く
  const armLen = (P.sh - P.hip) * (look === 'monkey' ? 1.9 : look === 'ogre' ? 1.25 : 1.1);
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'armL' : 'armR',
      ax = sd * (0.22 * bw + 0.06);
    for (let t = 0; t <= armLen; t += GAP)
      put(ax + sd * 0.02 * t, P.sh - t, lz(P.sh) + 0.04 * t, sd, 0, 0.5, 'skin', SK, part, { piv: P.sh, pz: 0 });
    lit(ax + sd * 0.02 * armLen, P.sh - armLen - 0.02, lz(P.sh) + 0.04 * armLen, 'o', S, 1.4, SK, part, { piv: P.sh, pz: 0 });
  }
  // 頭：陰を付けた球、光る目、真ん中に小さく種類の文字
  const hr = 0.15 * P.hk * (look === 'ogre' ? 1.0 : 1),
    H = [0, P.hc, lz(P.hc)] as const;
  for (let i = 0; i < 14; i++) {
    const y = 1 - (2 * (i + 0.5)) / 14,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.39996;
    put(
      H[0] + Math.cos(a) * rr * hr,
      H[1] + y * hr,
      H[2] + Math.sin(a) * rr * hr,
      Math.cos(a) * rr,
      y,
      Math.sin(a) * rr,
      'skin',
      SK,
      'head',
    );
  }
  const EYE: Color = look === 'goblin' ? [1, 0.9, 0.3] : look === 'gnome' ? [0.6, 0.8, 1] : [1, 0.75, 0.4];
  for (const sd of [-1, 1]) lit(H[0] + sd * hr * 0.38, H[1] + hr * 0.15, H[2] + hr * 0.92, '.', S * 0.8, 3.2, EYE, 'head');
  lit(0, P.hc, H[2] + hr * 0.2, ty.ch, S * 1.3, 1.5, SK, 'core');
  const hand = [0.22 * bw + 0.06 + 0.02 * armLen, P.sh - armLen, lz(P.sh) + 0.04 * armLen] as const,
    arm = { piv: P.sh, pz: 0 };
  if (look === 'kobold') {
    for (let k = 1; k <= 3; k++) lit(0, H[1] - hr * 0.2, H[2] + hr + k * S * 0.6, k === 3 ? '>' : '=', S * 0.9, 1.4, SK, 'head');
    for (const sd of [-1, 1]) {
      lit(sd * hr * 0.6, H[1] + hr * 1.1, H[2], '^', S, 1.4, SK, 'head');
      lit(sd * hr * 0.65, H[1] + hr * 1.45, H[2] - 0.02, '^', S * 0.8, 1.2, SK, 'head');
    }
    stroke([hand[0], hand[1] - 0.3, hand[2]], [hand[0], hand[1] + 0.85, hand[2]], [0.6, 0.5, 0.35], 1.1, S * 0.9, 'armR', arm);
    lit(hand[0], hand[1] + 0.92, hand[2], '^', S * 1.1, 2.2, [0.85, 0.85, 0.9], 'armR', arm);
    stroke([0, P.hip, -0.12], [0, P.hip - 0.2, -0.3], SK, 1.0, S * 0.9, 'tail', { piv: 0 });
  }
  if (look === 'goblin') {
    for (const sd of [-1, 1]) {
      stroke([sd * hr, H[1] + hr * 0.2, H[2]], [sd * (hr + 0.22), H[1] + hr * 0.6, H[2] - 0.04], SK, 1.4, S, 'head');
      lit(sd * (hr + 0.26), H[1] + hr * 0.65, H[2] - 0.05, sd < 0 ? '<' : '>', S, 1.6, SK, 'head');
    }
    for (let k = 0; k < 5; k++)
      lit((k - 2) * 0.07, P.hip - 0.05 - ((k * 7) % 3) * 0.04, 0.14 + lz(P.hip), mpick(['|', '/', '\\']), S * 0.9, 1.0, CL);
    stroke([hand[0], hand[1], hand[2]], [hand[0], hand[1] - 0.02, hand[2] + 0.3], [0.7, 0.55, 0.4], 1.6, S * 0.9, 'armR', arm);
  }
  if (look === 'snapjaw') {
    for (let k = 1; k <= 4; k++) lit(0, H[1] - hr * 0.25, H[2] + hr + k * S * 0.55, k === 4 ? '>' : '=', S * 0.9, 1.4, SK, 'head');
    for (let k = 0; k < 6; k++)
      lit(0, H[1] + hr * 0.9 - k * 0.08, H[2] - hr - 0.02 - k * 0.03, '^', S * 0.9, 1.3, [0.4, 0.3, 0.22], 'head');
    for (let k = 0; k < 5; k++) lit((k - 2) * 0.08, P.hip - 0.04, 0.15 + lz(P.hip), '"', S * 0.9, 1.1, [0.5, 0.4, 0.3]);
    if (ty.sk === 'sw' || (ty.name && ty.name.includes('見張り'))) {
      stroke([hand[0], hand[1] - 0.05, hand[2]], [hand[0], hand[1] + 0.45, hand[2]], [0.5, 0.38, 0.25], 1.0, S * 0.9, 'armR', arm);
      for (let q = 0; q < 4; q++) {
        const f = q / 3;
        lit(
          hand[0],
          hand[1] + 0.5 + f * 0.22,
          hand[2],
          '^',
          S * (1.1 - f * 0.3),
          2.0 + 1.2 * f,
          [1.0, 0.3 + 0.55 * f, 0.1 + 0.4 * f],
          'flame',
          {
            fh: f,
            piv: P.sh,
          },
        );
      }
    }
  }
  if (look === 'monkey') {
    for (let k = 0; k < 9; k++) {
      const a = (k / 8) * Math.PI * 1.4;
      lit(0, P.hip - 0.05 + Math.sin(a) * 0.35, -0.15 - k * 0.07, mpick(['~', '(', ')']), S * 0.9, 1.1, SK, 'tail', { piv: k * 0.6 });
    }
    for (const sd of [-1, 1]) lit(sd * hr * 0.95, H[1], H[2], sd < 0 ? '(' : ')', S, 1.2, SK, 'head');
  }
  if (look === 'ogre') {
    for (let k = 0; k < 6; k++) lit((k - 2.5) * 0.1, P.hip + 0.02, 0.25, '"', S * 0.9, 1.1, [0.55, 0.45, 0.3]);
    stroke([hand[0], hand[1], hand[2]], [hand[0] - 0.05, P.sh + 0.3, -0.25], [0.55, 0.42, 0.3], 1.1, S, 'armR', arm);
    for (let q = 0; q < 7; q++)
      lit(
        hand[0] - 0.05 + (mr() - 0.5) * 0.16,
        P.sh + 0.32 + (mr() - 0.5) * 0.16,
        -0.28 + (mr() - 0.5) * 0.12,
        mpick(['#', '%', '@']),
        S * 1.05,
        1.2,
        [0.6, 0.5, 0.4],
        'armR',
        arm,
      );
  }
  if (look === 'gnome') {
    for (let k = 0; k < 6; k++) {
      const r = hr * 1.15 * (1 - k / 6),
        n = Math.max(1, 6 - k);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        lit(
          Math.cos(a) * r,
          H[1] + hr * 0.7 + k * 0.08,
          H[2] + Math.sin(a) * r,
          k === 5 ? '^' : 'A',
          S * 0.9,
          1.3,
          [0.85, 0.3, 0.3],
          'head',
        );
      }
    }
    for (let k = 0; k < 5; k++)
      stroke(
        [(k - 2) * 0.04, H[1] - hr * 0.3, H[2] + hr * 0.85],
        [(k - 2) * 0.05, H[1] - hr * 1.6, H[2] + hr * 0.9],
        [0.92, 0.92, 0.92],
        1.3,
        S * 0.85,
        'head',
      );
    lit(hand[0], hand[1] - 0.08, hand[2] + 0.1, '[', S * 0.9, 1.2, [0.7, 0.6, 0.4], 'armR', arm);
    lit(hand[0] + 0.08, hand[1] - 0.08, hand[2] + 0.1, ']', S * 0.9, 1.2, [0.7, 0.6, 0.4], 'armR', arm);
    lit(hand[0] + 0.04, hand[1] - 0.08, hand[2] + 0.1, '*', S * 1.1, 3.6, [1, 0.85, 0.5], 'armR', arm);
  }
  return pts;
}

// ---- 形を選んで作る
/** 種類の形（見た目の特徴も足す） */
export function buildForm(ty: FormType): Body {
  const pts = buildForm0(ty);
  extraLook(ty, pts);
  return pts;
}
type FormOf = (ty: FormType) => Body;
const BY_FORM: Readonly<Record<string, FormOf>> = {
    troll: trollForm2,
    golem: golemForm2,
    bog: bogForm2,
    dragon: dragonForm,
    naga: nagaForm,
    kraken: krakenForm2,
    spider: caveSpiderForm,
    bat: batForm,
  },
  BY_QUAD_LOOK: Readonly<Record<string, FormOf>> = {
    rat: ratForm,
    jackal: jackalForm,
    grazer: grazerForm,
    salamander: salamanderForm,
    houndF: fireHoundForm,
    houndI: iceHoundForm,
    houndL: lightHoundForm,
  },
  BY_SMALL: Readonly<Record<string, FormOf>> = {
    jelly: jellyForm,
    bloat: bloatForm,
    orb: wispForm,
    eel: eelForm,
    snake: snakeForm,
    fish: fishForm,
    shroom: shroomForm,
    crab: crabForm,
  };
/** 種類の形（見た目の特徴を足す前）。作り直した形があればそれを、無ければ古い形を作る */
export function buildForm0(ty: FormType): Body {
  if (ty.form === 'wraith' && !ty.boss) {
    if (ty.look === 'lich') return lichForm(ty);
    if (ty.look === 'wraith') return wraithForm2(ty);
    if (ty.invisible) return phantomForm(ty);
  }
  if (!ty.boss) {
    const F = BY_FORM[ty.form];
    if (F) return F(ty);
  }
  if (ty.form === 'quad') {
    const F = ty.look === undefined || ty.look === null ? undefined : BY_QUAD_LOOK[ty.look];
    if (F && !ty.boss) return F(ty);
  }
  if (ty.form === 'humanoid' && ty.look === 'ogre') return ogreForm(ty);
  if (ty.form === 'humanoid' && ty.look === 'conjurer') return conjurerForm(ty);
  if ((ty.form === 'humanoid' && ty.look && LOOK_PROP[ty.look] !== undefined) || (ty.form === 'humanoid' && ty.look === 'snapjaw'))
    return humanoid2(ty);
  {
    const F = BY_SMALL[ty.form];
    if (F && !ty.boss) return F(ty);
  }
  if (ty.form === 'lichking') return lichKingForm();
  if (ty.form === 'spiderqueen') return spiderQueenForm();
  if (ty.form === 'nagaqueen') return nagaQueenForm();
  if (ty.form === 'olddragon') return oldDragonForm();
  if (ty.form === 'shadowking') return shadowKingForm();
  if (ty.form === 'shadowserpent') return shadowSerpentForm();
  if (ty.form === 'deepkraken') return deepKrakenForm();
  if (ty.form === 'snake')
    return beastForm({ plan: 'serpent', kind: '大蛇', legs: 0, wings: false, eyes: 0, glyphs: ['~', 's', '='], core: ty.ch });
  if (ty.form === 'troll') return trollForm();
  if (ty.form === 'golem') return golemForm();
  if (ty.form === 'bog') return bogForm();
  if (ty.form === 'kraken') return krakenForm();
  if (ty.form === 'dragon')
    return beastForm({ plan: 'quad', kind: '竜', legs: 4, wings: true, eyes: 0, glyphs: ['#', '%', '&'], core: ty.ch });
  if (ty.form === 'naga')
    return beastForm({ plan: 'serpent', kind: '大蛇', legs: 0, wings: false, eyes: 0, glyphs: ['~', '=', '%'], core: ty.ch });
  if (ty.form === 'spider') return spiderForm();
  if (ty.form === 'robot') return robotForm();
  if (ty.form === 'cleaner') return cleanerForm(ty);
  if (ty.form === 'repairer') return repairerForm(ty);
  if (ty.form === 'watcher') return watcherForm(ty);
  if (ty.form === 'fish' || ty.form === 'shroom' || ty.form === 'crab') return critterForm(ty);
  if (ty.form === 'beast') return beastForm2(ty);
  // 古い形（作り直していない主の形と、見た目の無い人型・四つ足）
  const L = ty.ch,
    pts: Body = [];
  const add = adder(pts);
  const fib = (
    n: number,
    r: number,
    cx: number,
    cy: number,
    cz: number,
    set: readonly string[],
    s: number,
    b: number,
    part: string,
  ): void => {
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n,
        rr = Math.sqrt(1 - y * y),
        a = i * 2.39996;
      add(cx + Math.cos(a) * rr * r, cy + y * r, cz + Math.sin(a) * rr * r, mpick(set), s, b, part);
    }
  };
  switch (ty.form) {
    case 'humanoid':
      fib(10, 0.17, 0, 1.5, 0, [L, L, '*'], 0.15, 1.6, 'head');
      for (let yy = 0.92; yy <= 1.37; yy += 0.11)
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          add(Math.cos(a) * 0.2, yy, Math.sin(a) * 0.13, mpick([L, L, '#', '=']), 0.15, 1.0, 'body');
        }
      for (const sd of [-1, 1]) {
        for (let k = 0; k < 5; k++) {
          const f = k / 4;
          add(sd * (0.27 + f * 0.06), 1.36 - f * 0.5, 0, mpick([L, '|', sd < 0 ? '/' : '\\']), 0.14, 1.0, sd < 0 ? 'armL' : 'armR', 1.36);
        }
        for (let k = 0; k < 6; k++) {
          const f = k / 5;
          add(sd * (0.1 + f * 0.03), 0.86 - f * 0.8, 0, mpick([L, '|', '!']), 0.15, 0.95, sd < 0 ? 'legL' : 'legR', 0.86);
        }
      }
      add(0, 1.52, 0.03, L, 0.44, 3.2, 'core');
      lookHumanoid(ty.look, pts, add, L);
      shapeHumanoid(pts, ty.look);
      break;
    case 'quad':
      for (let k = 0; k < 6; k++) {
        const z = -0.32 + k * 0.13;
        for (let j = 0; j < 5; j++) {
          const a = (j / 5) * Math.PI * 2;
          add(Math.cos(a) * 0.15, 0.42 + Math.sin(a) * 0.11, z, mpick([L, L, '~', '=']), 0.13, 1.0, 'body');
        }
      }
      fib(6, 0.11, 0, 0.55, 0.44, [L, '*'], 0.12, 1.4, 'head');
      add(0, 0.57, 0.48, L, 0.32, 3.0, 'core');
      for (const [sx, sz, part] of [
        [1, 0.26, 'legL'],
        [-1, 0.26, 'legR'],
        [1, -0.26, 'legR'],
        [-1, -0.26, 'legL'],
      ] as const)
        for (let k = 0; k < 3; k++) add(sx * 0.12, 0.33 - k * 0.13, sz, mpick(['|', '!', L]), 0.12, 0.9, part, 0.36, sz);
      for (let k = 0; k < 3; k++) add(0, 0.48 + k * 0.05, -0.42 - k * 0.12, mpick(['~', '-', L]), 0.11, 0.9, 'tail', k);
      lookQuad(ty.look, pts, add, L);
      break;
    case 'bat':
      fib(5, 0.1, 0, 0, 0, ['v', '*'], 0.13, 1.3, 'body');
      add(0, 0.02, 0.02, 'v', 0.36, 2.6, 'core');
      for (const sd of [-1, 1])
        for (let k = 0; k < 5; k++) {
          const p = {
            x: 0,
            y: 0,
            z: -0.02 * k,
            g: G(mpick(['^', 'v', '/', '\\', '~'])),
            s: 0.13,
            b: 1.1,
            part: 'wing',
            ph: mr() * 6.28,
            piv: 0,
            pz: 0,
            sd,
            r: 0.12 + k * 0.11,
          };
          pts.push(p);
        }
      break;
    case 'bloat':
      fib(30, 0.4, 0, 0, 0, ['o', '0', '.', 'b'], 0.14, 1.0, 'puff');
      add(0, 0, 0, 'b', 0.5, 2.6, 'core');
      for (let k = 0; k < 4; k++) add((mr() - 0.5) * 0.3, -0.45 - k * 0.1, (mr() - 0.5) * 0.3, mpick([':', "'", '.']), 0.1, 0.8, 'tail', k);
      break;
    case 'orb':
      fib(28, 0.34, 0, 0, 0, [L, '.', '*', '+'], 0.13, 1.3, 'shell');
      add(0, 0, 0, L, 0.55, 3.6, 'core');
      break;
    case 'wraith':
      for (let k = 0; k < 7; k++) {
        const y = 1.85 - k * 0.26,
          r = 0.1 + k * 0.075,
          n = 5 + k * 2;
        for (let j = 0; j < n; j++) {
          const a = (j / n) * Math.PI * 2 + k * 0.4;
          add(Math.cos(a) * r, y, Math.sin(a) * r, mpick([L, L.toLowerCase(), '~', "'", '"', '|']), 0.15, 1.25 - k * 0.1, 'robe');
        }
      }
      for (const sd of [-1, 1])
        for (let k = 0; k < 5; k++)
          add(sd * (0.2 + k * 0.1), 1.55 - k * 0.06, 0.1 + k * 0.05, mpick(['~', '-', L.toLowerCase()]), 0.12, 0.9, 'robe');
      add(0, 1.9, 0, L, 0.46, 3.2, 'core');
      break;
    case 'eel':
      for (let i = 0; i < 12; i++) {
        const zc = 1.1 - i * 0.27,
          yc = 0.22 + (i === 0 ? 0.3 : i === 1 ? 0.12 : 0),
          rr = 0.14 * (1 - i / 16);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + i * 0.4;
          add(Math.cos(a) * rr, yc + Math.sin(a) * rr, zc, mpick([L, '~', '=', L]), 0.15, 1.0, 'seg', i);
        }
      }
      add(0, 0.62, 1.18, L, 0.4, 3.0, 'shead', 0);
      break;
    case 'jelly':
      for (let i = 0; i < 56; i++) {
        const y = 1 - (2 * (i + 0.5)) / 56;
        if (y < 0) continue;
        const rr = Math.sqrt(1 - y * y),
          a = i * 2.39996;
        add(Math.cos(a) * rr * 0.5, y * 0.45 + 0.03, Math.sin(a) * rr * 0.5, mpick([L, 'o', '~', '.', L]), 0.14, 1.1, 'jelly');
      }
      for (let k = 0; k < 5; k++) add((mr() - 0.5) * 0.4, 0.1 + mr() * 0.25, (mr() - 0.5) * 0.4, '.', 0.12, 1.6, 'jelly');
      add(0, 0.28, 0, L, 0.42, 3.0, 'core');
      break;
  }
  return pts;
}
