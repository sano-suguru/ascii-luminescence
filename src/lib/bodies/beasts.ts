// 四つ足・大きな生き物（オーガ・竜も）・死者の形。q2・q3 の道具で、面の向きに合わせて文字と明るさを決める。
import { nth } from '../array.ts';
import type { Color } from '../color.ts';
import { G } from '../glyphs.ts';
import { clamp } from '../rng.ts';
import { mpick, mr } from '../random.ts';
import {
  type Body,
  type BodyType,
  type Extra,
  type Kit3,
  type Ramp,
  type Vec3,
  FUR,
  MUD,
  SCALE,
  SKINR,
  STONE,
  q2,
  q3,
  strokeCh,
} from './kit.ts';

type Leg = readonly [number, number, string];

/** 輪を並べた体の式：[z, cy, rx, ry]（奥行き z ごとの、真ん中の高さ cy・横の半径 rx・縦の半径 ry。前から順に）の間を滑らかにつなぐ */
type LoftKeys = readonly (readonly [number, number, number, number])[];
function loft(keys: LoftKeys): {
  at: (z: number) => { cy: number; rx: number; ry: number };
  surf: (z: number, a: number, out?: number) => Vec3;
} {
  const at = (z: number): { cy: number; rx: number; ry: number } => {
    let i = 0;
    while (i < keys.length - 2 && nth(keys, i + 1)[0] > z) i++;
    const a = nth(keys, i),
      b = nth(keys, i + 1),
      f = clamp((a[0] - z) / (a[0] - b[0]), 0, 1),
      e = f * f * (3 - 2 * f);
    return { cy: a[1] + (b[1] - a[1]) * e, rx: a[2] + (b[2] - a[2]) * e, ry: a[3] + (b[3] - a[3]) * e };
  };
  return {
    at,
    /** 奥行き z の輪の、角度 a（0 が右、Math.PI / 2 が背の真上）の表面の所。out は表面から外へ出す割合 */
    surf(z: number, a: number, out = 1): Vec3 {
      const { cy, rx, ry } = at(z);
      return [Math.cos(a) * rx * out, cy + Math.sin(a) * ry * out, z];
    },
  };
}

/** ネズミの体（鼻先から尻まで、ひと続きに）。尖った鼻先・丸い頭・細い首から、腰の上が一番高く丸まった背へ。
 *  体の点と、耳・目の位置を、同じ式から出す（脚の付け根は RAT_SHOULDER・RAT_HIP の決まった値。体の式を変えたら合わせる） */
const RAT_KEYS: LoftKeys = [
  [0.66, 0.15, 0.018, 0.018],
  [0.6, 0.155, 0.04, 0.038],
  [0.52, 0.17, 0.07, 0.065],
  [0.42, 0.195, 0.1, 0.09],
  [0.33, 0.215, 0.105, 0.098],
  [0.24, 0.225, 0.11, 0.105],
  [0.1, 0.245, 0.165, 0.135],
  [-0.08, 0.27, 0.205, 0.165],
  [-0.22, 0.265, 0.21, 0.165],
  [-0.34, 0.23, 0.165, 0.13],
  [-0.42, 0.2, 0.06, 0.06],
];
export const ratBody = {
  /** 鼻先と尻の端の奥行き */
  z1: 0.66,
  z0: -0.42,
  ...loft(RAT_KEYS),
  /** 頭（これより前は part 'head'） */
  headZ: 0.3,
  /** 尾の付け根の所 */
  tailRoot: [0, 0.2, -0.38] satisfies Vec3,
};
/** ネズミの脚の付け根（肩と腰）。脚の点は、これを軸に回る */
export const RAT_SHOULDER = { piv: 0.2, pz: 0.14 },
  RAT_HIP = { piv: 0.22, pz: -0.2 };
/** ネズミの色 */
export const RAT = {
  /** 背の毛：灰色がかった茶 */
  fur: [0.46, 0.37, 0.3],
  /** 背筋：少し暗い */
  back: [0.32, 0.25, 0.2],
  /** 腹：明るい灰 */
  belly: [0.8, 0.74, 0.66],
  /** 耳・鼻・手足・尾：くすんだ桃色 */
  pink: [0.92, 0.6, 0.6],
  /** 耳の縁：暗い桃色 */
  rim: [0.66, 0.45, 0.43],
  /** 目：赤く光る */
  eye: [1.0, 0.28, 0.2],
  /** 前歯 */
  tooth: [0.98, 0.92, 0.7],
} as const satisfies Record<string, Color>;

// rat: a low, hunched rodent. A pointed snout, round ears standing up, beady red eyes, an arched back highest over the hips,
// short legs mostly under the body with pink paws, and a long, bare, tapering tail that curves down to trail on the floor
export function ratForm(ty: BodyType): Body {
  const { S, pts, put, lit, stroke } = q2({ scale: ty.scale * 2.6 }),
    B = ratBody,
    C = RAT,
    FURR: Ramp = ['.', '"', '%', '%', '#'],
    PINKR: Ramp = ['.', '-', '=', '=', '%'];
  // 頭と胴：輪を、鼻先から尻まで等しい間隔で並べる。輪の点は前後に少しずつずらす（揃うと縦の縞に見える）
  const nz = Math.round((B.z1 - B.z0) / (S * 0.75)),
    gap = (B.z1 - B.z0) / nz;
  for (let i = 0; i <= nz; i++) {
    const z0 = B.z1 - gap * i,
      n = Math.max(5, Math.round((2 * Math.PI * Math.max(B.at(z0).rx, B.at(z0).ry)) / (S * 0.8)));
    for (let k = 0; k < n; k++) {
      const z = clamp(z0 + (((k * 0.618) % 1) - 0.5) * gap, B.z0, B.z1),
        { rx, ry } = B.at(z),
        slope = (B.at(z - 0.02).rx + B.at(z - 0.02).ry - B.at(z + 0.02).rx - B.at(z + 0.02).ry) / 0.08,
        a = (k / n) * Math.PI * 2 + i * 0.5,
        sn = Math.sin(a),
        [x, y] = B.surf(z, a),
        l = Math.hypot(Math.cos(a) / rx, sn / ry),
        part = z > B.headZ ? 'head' : 'body',
        col = sn < -0.4 ? C.belly : sn > 0.8 ? C.back : C.fur;
      put(x, y, z, Math.cos(a) / rx / l, sn / ry / l, slope, FURR, col, part);
    }
  }
  // 鼻：鼻先の桃色（くんくん動く）
  lit(0, B.at(B.z1).cy, B.z1 + 0.01, 'o', 0.7, 1.15, C.pink, 'snout');
  // 前歯：鼻の下に2本
  for (const sd of [-1, 1]) lit(sd * 0.012, 0.1, 0.6, '|', 0.5, 0.9, C.tooth, 'snout');
  // ひげ：鼻の脇から横と後ろへ
  for (const sd of [-1, 1])
    for (const [ex, ey, ez] of [
      [0.2, 0.19, 0.5],
      [0.19, 0.13, 0.53],
    ] as const)
      stroke([sd * 0.04, 0.16, 0.59], [sd * ex, ey, ez], C.belly, 0.75, 0.45, 'snout', undefined, S * 0.35);
  // 目：頭の脇、少し飛び出る（上に寄せると、向こう側の目が頭の隙間から透けて、2つ縦に並んで見える）
  for (const sd of [-1, 1]) {
    const [x, y] = B.surf(0.46, Math.PI / 2 - sd * 1.15, 1.12);
    lit(x, y, 0.46, 'o', 0.9, 1.25, C.eye, 'head');
  }
  // 耳：頭の後ろの上に、丸く立てる。円盤は斜め前の外を向く（前からも横からも丸く見える）。毛の色にすると頭に溶けるので、薄い皮の桃色にし、縁は暗くする
  for (const sd of [-1, 1]) {
    const [bx, by] = B.surf(0.33, Math.PI / 2 - sd * 0.8, 0.95),
      R = 0.075,
      // 円盤の向き（外へ 55 度開く）と、円盤の中の横の向き
      nx = sd * Math.sin(0.96),
      nzz = Math.cos(0.96),
      cx = bx + sd * 0.02,
      cyy = by + R * 0.55,
      cz = 0.33;
    for (const rr of [R, R * 0.68, R * 0.38]) {
      const n = Math.max(4, Math.round((2 * Math.PI * rr) / (S * 0.6)));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2,
          u = Math.cos(a) * rr,
          v = Math.sin(a) * rr;
        // 耳の下の端は頭に埋もれるので置かない
        if (v < -R * 0.55) continue;
        put(cx + u * nzz, cyy + v, cz - u * nx, nx, 0.25, nzz, PINKR, rr < R ? C.pink : C.rim, 'head');
      }
    }
  }
  // 脚：細い管（輪は2点）。点はどれも肩か腰を軸に回る。前の左と後ろの右が同じ向きに振れる
  const limb = (p0: Vec3, p1: Vec3, r: number, col: Color, ramp: Ramp, part: string, ex: Extra): void => {
    const dx = p1[0] - p0[0],
      dy = p1[1] - p0[1],
      dz = p1[2] - p0[2],
      m = Math.max(2, Math.round(Math.hypot(dx, dy, dz) / (S * 0.35))),
      dl = Math.hypot(dx, dy) || 1;
    for (let j = 0; j <= m; j++) {
      const f = j / m,
        a = j * 1.9;
      for (const sg of [1, -1]) {
        const ox = (-dy / dl) * Math.cos(a) * sg,
          oy = (dx / dl) * Math.cos(a) * sg,
          oz = Math.sin(a) * sg;
        put(p0[0] + dx * f + ox * r, p0[1] + dy * f + oy * r, p0[2] + dz * f + oz * r, ox, oy + 0.3, oz, ramp, col, part, ex);
      }
    }
  };
  for (const front of [true, false])
    for (const sd of [-1, 1]) {
      const part = front === sd < 0 ? 'legL' : 'legR',
        ex = front ? RAT_SHOULDER : RAT_HIP,
        z0 = ex.pz;
      if (front) {
        const root: Vec3 = [sd * 0.09, ex.piv, z0],
          elbow: Vec3 = [sd * 0.11, 0.09, z0 + 0.02],
          paw: Vec3 = [sd * 0.1, 0.025, z0 + 0.08];
        limb(root, elbow, 0.03, C.fur, FURR, part, ex);
        limb(elbow, paw, 0.018, C.pink, PINKR, part, ex);
        for (const ox of [-0.02, 0, 0.02]) lit(paw[0] + sd * ox, 0.015, paw[2] + 0.03, '.', 0.6, 1.0, C.pink, part, ex);
      } else {
        const root: Vec3 = [sd * 0.13, ex.piv, z0],
          knee: Vec3 = [sd * 0.17, 0.11, z0 + 0.08],
          heel: Vec3 = [sd * 0.16, 0.03, z0 - 0.08],
          toe: Vec3 = [sd * 0.15, 0.02, z0 + 0.06];
        limb(root, knee, 0.045, C.fur, FURR, part, ex);
        limb(knee, heel, 0.022, C.fur, FURR, part, ex);
        limb(heel, toe, 0.016, C.pink, PINKR, part, ex);
        for (const ox of [-0.02, 0, 0.02]) lit(toe[0] + sd * ox, 0.015, toe[2] + 0.03, '.', 0.6, 1.0, C.pink, part, ex);
      }
    }
  // 尾：尻から下がって床に届き、床の上を横へ流れる。根もとは太く（2列）、先へ細る（1列）。節は「=」と「-」を交互に。
  // 点が重なると明るさが足し合わさって白くにじむので、間を空け、明るさを決めて置く（右の列が明るい）。
  // 付け根から先へ、だんだん大きく振れる（part 'tailw'。piv は付け根からの距離）
  const [rx0, ry0, rz0] = B.tailRoot,
    TL = 0.95,
    nt = Math.round(TL / (S * 0.36));
  for (let j = 0; j <= nt; j++) {
    const f = j / nt,
      z = rz0 - TL * f,
      y = 0.025 + (ry0 - 0.025) * Math.pow(1 - Math.min(1, f * 1.5), 2),
      x = rx0 + 0.22 * f * f,
      r = 0.028 * (1 - f) + 0.006,
      ch = j % 2 ? '-' : '=',
      sz = 0.95 - 0.35 * f,
      ex = { piv: rz0 - z };
    if (r > 0.016) {
      lit(x + r, y + r * 0.5, z, ch, sz, 1.0, C.pink, 'tailw', ex);
      lit(x - r, y + r * 0.5, z, ch, sz, 0.75, C.pink, 'tailw', ex);
    } else lit(x, y + r * 0.5, z, ch, sz, 0.9, C.pink, 'tailw', ex);
  }
  return pts;
}

/** ジャッカルの体の輪：[z, cy, rx, ry]。前から順に：鼻先・細い鼻づら・額・頭の後ろ・首・深い胸・締まった腰・尻 */
const JACKAL_KEYS: LoftKeys = [
  [0.88, 0.85, 0.014, 0.014],
  [0.83, 0.855, 0.032, 0.03],
  [0.75, 0.865, 0.045, 0.044],
  [0.66, 0.89, 0.07, 0.064],
  [0.57, 0.915, 0.095, 0.085],
  [0.48, 0.9, 0.085, 0.085],
  [0.4, 0.84, 0.072, 0.085],
  [0.31, 0.76, 0.09, 0.115],
  [0.2, 0.7, 0.12, 0.155],
  [0.04, 0.7, 0.118, 0.14],
  [-0.13, 0.72, 0.098, 0.1],
  [-0.28, 0.71, 0.11, 0.12],
  [-0.38, 0.69, 0.085, 0.09],
  [-0.44, 0.68, 0.02, 0.02],
];
/** ジャッカルの体（鼻先から尻まで、ひと続きに）。細い鼻づらと額から、首を下りて深い胸へ、腰で締まり、尻で閉じる。
 *  体の点と、目・耳の位置を、同じ式から出す（背の鞍の範囲 saddle・尾の付け根 tailRoot と、脚の付け根 JACKAL_SHOULDER・JACKAL_HIP は決まった値。体の式を変えたら合わせる） */
export const jackalBody = {
  /** 鼻先と尻の端の奥行き */
  z1: 0.88,
  z0: -0.44,
  ...loft(JACKAL_KEYS),
  /** 頭（これより前は part 'head'） */
  headZ: 0.44,
  /** 背の黒い鞍の前と後ろの端の奥行き */
  saddle: [0.3, -0.36] as const,
  /** 尾の付け根の所 */
  tailRoot: [0, 0.72, -0.46] satisfies Vec3,
};
/** ジャッカルの脚の付け根（肩と腰）。脚の点は、これを軸に回る */
export const JACKAL_SHOULDER = { piv: 0.74, pz: 0.2 },
  JACKAL_HIP = { piv: 0.74, pz: -0.28 };
/** ジャッカルの色 */
export const JACKAL = {
  /** 脇・脚・頭・耳の外：赤みのある黄土 */
  tawny: [0.74, 0.35, 0.11],
  /** 背の鞍：黒に近い灰 */
  saddle: [0.17, 0.15, 0.15],
  /** 鞍に混じる白い毛 */
  silver: [0.5, 0.48, 0.46],
  /** 喉・胸・腹・脚の内・耳の内・口のまわり：白に近いクリーム */
  cream: [0.84, 0.78, 0.64],
  /** 鼻と尾の先：黒 */
  black: [0.08, 0.07, 0.07],
  /** 目：琥珀 */
  eye: [1.0, 0.72, 0.22],
} as const satisfies Record<string, Color>;

// jackal: a lean, leggy wild dog. A narrow pointed muzzle, very large upright ears, a deep chest and a tucked waist,
// a tawny coat with a dark grizzled saddle along the back, a cream throat and belly, and a bushy tail hanging low with a black tip
export function jackalForm(ty: BodyType): Body {
  const { S, pts, put, lit, tube } = q3({ scale: ty.scale * 1.5 }),
    B = jackalBody,
    C = JACKAL,
    // 段の初め（0番目）は使われない（光の当たらない面でも 1番目）。光の当たらない脇と腹がすかすかにならないように、1番目は詰まった文字にする
    PELT: Ramp = [':', '%', '"', '%', '#'],
    DARK: Ramp = [':', '%', '%', '#', '#'],
    CREAM: Ramp = [':', '%', 'o', '%', '#'];
  // 頭と胴：輪を、鼻先から尻まで、背筋に沿った長さで等しい間隔に並べる（首は急に下りるので、奥行きで等しく割ると輪の間が空く）。
  // 輪の点は前後に少しずつずらす（揃うと縦の縞に見える）
  const SN = 400,
    arc = [0];
  for (let j = 1; j <= SN; j++) {
    const za = B.z1 - ((B.z1 - B.z0) * (j - 1)) / SN,
      zb = B.z1 - ((B.z1 - B.z0) * j) / SN;
    arc.push(nth(arc, j - 1) + Math.hypot(za - zb, B.at(za).cy - B.at(zb).cy));
  }
  const len = nth(arc, SN),
    nz = Math.round(len / (S * 0.65)),
    // 背筋に沿った長さ d の所の奥行き
    zAt = (d: number): number => {
      let j = 1;
      while (j < SN && nth(arc, j) < d) j++;
      const a0 = nth(arc, j - 1),
        f = clamp((d - a0) / (nth(arc, j) - a0 || 1), 0, 1);
      return B.z1 - ((B.z1 - B.z0) * (j - 1 + f)) / SN;
    };
  for (let i = 0; i <= nz; i++) {
    const d0 = (len * i) / nz,
      z0 = zAt(d0),
      n = Math.max(5, Math.round((2 * Math.PI * Math.max(B.at(z0).rx, B.at(z0).ry)) / (S * 0.7)));
    for (let k = 0; k < n; k++) {
      const f = (k * 0.618) % 1,
        z = zAt(clamp(d0 + (f - 0.5) * (len / nz), 0, len)),
        { rx, ry } = B.at(z),
        a = (k / n) * Math.PI * 2 + i * 0.5,
        cs = Math.cos(a),
        sn = Math.sin(a),
        [x, y] = B.surf(z, a),
        l = Math.hypot(cs / rx, sn / ry),
        // 面の向きの奥行きの分：輪の式（横の半径・縦の半径・真ん中の高さ）の、奥行きでの変わり方から出す（首は真ん中の高さが急に下りるので、高さの変わり方も入れる）
        zA = B.at(z + 0.02),
        zB = B.at(z - 0.02),
        nzr = -((cs * cs * (zA.rx - zB.rx)) / rx + (sn * (zA.cy - zB.cy)) / ry + (sn * sn * (zA.ry - zB.ry)) / ry) / 0.04,
        part = z > B.headZ ? 'head' : 'body',
        // 鞍：肩から尻までの背。真ん中ほど脇へ広い
        sw = z < B.saddle[0] && z > B.saddle[1] ? Math.sin((Math.PI * (B.saddle[0] - z)) / (B.saddle[0] - B.saddle[1])) : 0,
        saddle = sn > 0.75 - 0.6 * sw && sw > 0.15,
        // 喉と胸と腹（頭では、鼻づらの下と頬）
        under = z > B.headZ ? sn < -0.2 : z > 0.22 ? sn < -0.1 : sn < -0.55;
      if (saddle) put(x, y, z, cs / rx / l, sn / ry / l, nzr / l, DARK, f < 0.15 ? C.silver : C.saddle, part);
      else put(x, y, z, cs / rx / l, sn / ry / l, nzr / l, under ? CREAM : PELT, under ? C.cream : C.tawny, part);
    }
  }
  // 鼻：鼻先の黒
  lit(0, B.at(B.z1).cy + 0.005, B.z1 + 0.01, 'o', 0.8, 1.0, C.black, 'head');
  // 目：額の脇、表面のすぐ外
  for (const sd of [-1, 1]) {
    const z = 0.66,
      [x, y] = B.surf(z, Math.PI / 2 - sd * 0.75, 1.1);
    lit(x, y, z, 'o', 0.85, 1.15, C.eye, 'head');
  }
  // 耳：頭の後ろの上に、大きな三角を立てる。面は前と少し外を向く。前の面は、内がクリームで縁は暗い。後ろの面は黄土（2枚を少し離して重ねる）
  for (const sd of [-1, 1]) {
    const z = 0.5,
      [bx, by] = B.surf(z, Math.PI / 2 - sd * 0.62, 0.95),
      H = 0.21,
      W = 0.065,
      nx = sd * 0.35,
      nzz = 0.94,
      rows = Math.max(3, Math.round(H / (S * 0.48)));
    for (let r = 0; r <= rows; r++) {
      const v = r / rows,
        hw = W * (1 - v),
        cols = Math.max(1, Math.round((2 * hw) / (S * 0.48)));
      for (let c = 0; c <= cols; c++) {
        const u = cols ? -1 + (2 * c) / cols : 0,
          edge = Math.abs(u) > 0.7 || v > 0.8,
          x = bx + sd * 0.06 * v + u * hw * nzz,
          y = by + v * H,
          zz = z - u * hw * nx - v * H * 0.12;
        for (const face of [1, -1]) {
          const o = face * 0.01,
            col = face < 0 ? C.tawny : edge ? C.saddle : C.cream;
          put(
            x + nx * o,
            y,
            zz + nzz * o,
            nx * face,
            0.2 * face,
            nzz * face,
            face > 0 && edge ? DARK : face > 0 ? CREAM : PELT,
            col,
            'head',
          );
        }
      }
    }
  }
  // 脚：細く長い。点はどれも肩か腰を軸に回る。前の左と後ろの右が同じ向きに振れる。黄土で、もも・二の腕の内（体の真ん中を向く側）だけクリーム
  // （すねの内までクリームにすると、細い所で点が重なり、足先が白くにじむ）。
  // 太いもも・二の腕は管、細いすねは輪を2点にして細かく並べる（管の間隔では、細い所の点がまばらになり、途切れて見える）
  const legCol =
    (sd: number) =>
    (ox: number): Color =>
      ox * sd < -0.3 ? C.cream : C.tawny;
  const shin = (p0: Vec3, p1: Vec3, r: number, part: string, ex: Extra): void => {
    const dx = p1[0] - p0[0],
      dy = p1[1] - p0[1],
      dz = p1[2] - p0[2],
      m = Math.max(2, Math.round(Math.hypot(dx, dy, dz) / (S * 0.42))),
      dl = Math.hypot(dy, dz) || 1;
    for (let j = 0; j <= m; j++) {
      const f = j / m,
        a = j * 1.9;
      for (const sg of [1, -1]) {
        // 脚の向きに直角な、横（x）と前後（脚の向きを回した向き）の輪
        const ox = Math.cos(a) * sg,
          oy = (-dz / dl) * Math.sin(a) * sg,
          oz = (dy / dl) * Math.sin(a) * sg;
        put(p0[0] + dx * f + ox * r, p0[1] + dy * f + oy * r, p0[2] + dz * f + oz * r, ox, oy + 0.3, oz, PELT, C.tawny, part, ex);
      }
    }
  };
  for (const front of [true, false])
    for (const sd of [-1, 1]) {
      const part = front === sd < 0 ? 'legL' : 'legR',
        ex = front ? JACKAL_SHOULDER : JACKAL_HIP,
        z0 = ex.pz,
        col = legCol(sd);
      if (front) {
        const root: Vec3 = [sd * 0.085, ex.piv, z0],
          elbow: Vec3 = [sd * 0.08, 0.46, z0 - 0.02],
          wrist: Vec3 = [sd * 0.075, 0.12, z0 + 0.01],
          paw: Vec3 = [sd * 0.075, 0.03, z0 + 0.06];
        tube(root, elbow, 0.05, 0.035, PELT, col, part, ex);
        shin(elbow, wrist, 0.026, part, ex);
        shin(wrist, paw, 0.024, part, ex);
      } else {
        const root: Vec3 = [sd * 0.095, ex.piv, z0],
          knee: Vec3 = [sd * 0.1, 0.44, z0 + 0.08],
          hock: Vec3 = [sd * 0.09, 0.2, z0 - 0.1],
          paw: Vec3 = [sd * 0.085, 0.03, z0 - 0.05];
        tube(root, knee, 0.07, 0.04, PELT, col, part, ex, 0.15);
        shin(knee, hock, 0.03, part, ex);
        shin(hock, paw, 0.024, part, ex);
      }
    }
  // 尾：尻から下へ垂れ、ふさふさに太り、先は黒い。上は鞍に続く暗い毛。付け根から先へ、だんだん大きく振れる（part 'tailw'。piv は付け根から、その輪の真ん中までの距離）
  const [, ry0, rz0] = B.tailRoot,
    TN = Math.round(0.5 / (S * 0.48));
  for (let j = 0; j <= TN; j++) {
    const f = j / TN,
      y = ry0 - 0.36 * f,
      z = rz0 - 0.3 * Math.sin(f * 1.3),
      r = 0.035 + 0.05 * Math.sin(Math.PI * Math.min(1, f * 1.1)),
      n = Math.max(5, Math.round((2 * Math.PI * r) / (S * 0.7))),
      tip = f > 0.78;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + j * 0.7,
        ca = Math.cos(a),
        sa = Math.sin(a),
        x = ca * r,
        zz = z + sa * r,
        ex = { piv: Math.hypot(ry0 - y, rz0 - z) },
        // 後ろ向きの面（sa < 0）が尾の上の側
        top = sa < -0.3;
      put(x, y, zz, ca, 0.25, sa, tip || top ? DARK : PELT, tip ? C.black : top ? C.saddle : C.tawny, 'tailw', ex);
    }
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

/** サラマンダーの体の輪：[z, cy, rx, ry]。前から順に：鼻先・平たく幅のある頭・首・肩・胴・腰・尾の付け根・細る尾（尾は横より縦が厚い） */
const SALA_KEYS: LoftKeys = [
  [0.78, 0.16, 0.05, 0.035],
  [0.7, 0.175, 0.13, 0.058],
  [0.58, 0.19, 0.185, 0.074],
  [0.5, 0.195, 0.17, 0.078],
  [0.41, 0.2, 0.095, 0.078],
  [0.3, 0.205, 0.135, 0.095],
  [0.02, 0.215, 0.155, 0.108],
  [-0.26, 0.205, 0.135, 0.1],
  [-0.4, 0.19, 0.095, 0.092],
  [-0.75, 0.155, 0.055, 0.07],
  [-1.05, 0.12, 0.028, 0.042],
  [-1.2, 0.1, 0.012, 0.018],
];
/** サラマンダーの体（頭・胴・尾をひと続きに）：奥行き z ごとの、真ん中の高さ cy・横の半径 rx・縦の半径 ry（間は滑らかにつなぐ）。
 *  体の点と、背の斑点・目・脚の付け根の位置を、同じ式から出す */
export const salaBody = {
  /** 鼻先と尾の先の奥行き */
  z1: 0.78,
  z0: -1.2,
  keys: SALA_KEYS,
  ...loft(SALA_KEYS),
  /** 尾の付け根の奥行き（ここより後ろの点は、付け根からの距離に合わせて左右に振れる） */
  tailZ: -0.36,
};
/** サラマンダー・ネズミ・ジャッカルの尾の、左右の振れ（形の中の横 x のずれ）。d は尾の付け根からの距離（付け根で 0、先ほど大きい）。歩くと大きく振る（位相 ph と歩く度合い moving が無い時は 0）。
 *  尾（part 'tailw'）とサラマンダーの尾の先の炎を描く時（draw.ts）と、炎から出る火の粉（auras.ts）が使う */
export const tailSwish = (m: { ph?: number; moving?: number }, t: number, d: number): number =>
  Math.sin(t * 4 - d * 5 + (m.ph ?? 0)) * (0.04 + 0.05 * (m.moving || 0)) * d;
/** サラマンダーの脚の付け根（肩と腰）。脚の点は、これを軸に回る */
export const SALA_SHOULDER = { piv: 0.2, pz: 0.3 },
  SALA_HIP = { piv: 0.2, pz: -0.26 };
/** サラマンダーの色 */
export const SALA = {
  /** 背と脇：焦げた黒褐色 */
  crust: [0.24, 0.1, 0.07],
  /** 腹と脇の下の縁：溶岩の橙 */
  belly: [1.0, 0.5, 0.16],
  /** 背の斑点：明るい橙黄 */
  spot: [1.0, 0.6, 0.16],
  /** 目：金 */
  eye: [1.0, 0.78, 0.22],
  /** 口の線 */
  mouth: [0.12, 0.05, 0.04],
} as const satisfies Record<string, Color>;

// salamander: a low lava newt. A broad flat head, a thick body slung low between sprawling legs (elbows out, feet planted),
// a tail flattened sideways that tapers to a small flame. Charred back with two rows of glowing spots, an orange belly
export function salamanderForm(ty: BodyType): Body {
  const { S, pts, put, lit } = q2({ scale: ty.scale * 2 }),
    B = salaBody,
    C = SALA,
    BELLY_R: Ramp = ['-', '-', '=', '=', '%'];
  // 頭・胴・尾：輪を、鼻先から尾の先まで等しい間隔で並べる（尾の先まで届くように、輪の数を先に決める）。
  // 輪の点は、前後に少しずつずらす（同じ奥行きに揃うと、横から見て輪が縦の縞に見える）
  const nz = Math.round((B.z1 - B.z0) / (S * 0.8)),
    gap = (B.z1 - B.z0) / nz,
    partAt = (z: number): { part: string; ex: Extra | undefined } =>
      z < B.tailZ ? { part: 'tailw', ex: { piv: B.tailZ - z } } : { part: z > 0.42 ? 'head' : 'body', ex: undefined };
  for (let i = 0; i <= nz; i++) {
    const z0 = B.z1 - gap * i,
      n = Math.max(5, Math.round((2 * Math.PI * Math.max(B.at(z0).rx, B.at(z0).ry)) / (S * 0.85)));
    for (let k = 0; k < n; k++) {
      const z = clamp(z0 + (((k * 0.618) % 1) - 0.5) * gap, B.z0, B.z1),
        { rx, ry } = B.at(z),
        // 面の前後の向き（半径が前へ細る鼻先は前を、後ろへ細る尾は後ろを向く）：前後で半径が減る割合
        slope = (B.at(z - 0.02).rx + B.at(z - 0.02).ry - B.at(z + 0.02).rx - B.at(z + 0.02).ry) / 0.08,
        a = (k / n) * Math.PI * 2 + i * 0.5,
        sn = Math.sin(a),
        [x, y] = B.surf(z, a),
        l = Math.hypot(Math.cos(a) / rx, sn / ry),
        { part, ex } = partAt(z);
      // 腹は横の線の文字にする（下を向く面は暗い側の文字になり、SKINR の「:」が縦に並ぶと、横から見て櫛が下がって見える）
      if (sn < -0.35) put(x, y, z, Math.cos(a) / rx / l, sn / ry / l, slope, BELLY_R, C.belly, part, ex);
      else put(x, y, z, Math.cos(a) / rx / l, sn / ry / l, slope, SKINR, C.crust, part, ex);
    }
  }
  // 背の斑点：背の真上から左右に寄った2列の、まだらな塊。間隔と位置をずらす（揃うと縞に見える）。光の当たらない後ろからも見えるように、明るさを決めて置く
  for (const [z, sd, w] of [
    [0.5, -1, 0.7],
    [0.3, 1, 1.2],
    [0.14, -1, 1.2],
    [-0.08, 1, 1.2],
    [-0.24, -1, 1],
    [-0.48, 1, 1],
    [-0.66, -1, 0.8],
    [-0.88, 1, 0.7],
  ] as const) {
    // 塊の3点：前後に並べ、1つを背の真ん中寄りにずらす
    for (const [oz, oa, ch] of [
      [-0.5, 0, '%'],
      [0.5, 0, 'o'],
      [0, 0.38, '%'],
    ] as const) {
      const zz = z + oz * S * 0.7 * w,
        [x, y] = B.surf(zz, Math.PI / 2 - sd * (0.7 - oa), 1.1),
        { part, ex } = partAt(zz);
      lit(x, y, zz, ch, Math.min(1.1, 0.8 + 0.25 * w), 1.45, C.spot, part, ex);
    }
  }
  // 口：頭の脇、少し下の線
  for (const sd of [-1, 1])
    for (let z = 0.74; z >= 0.5; z -= S * 0.6) {
      const [x, y] = B.surf(z, sd > 0 ? -0.15 : Math.PI + 0.15, 1.06);
      lit(x, y, z, '-', 0.8, 0.7, C.mouth, 'head');
    }
  // 目：頭の上の左右に、少し飛び出る
  for (const sd of [-1, 1]) {
    const [x, y] = B.surf(0.6, Math.PI / 2 - sd * 0.8, 1.15);
    lit(x, y, 0.6, 'o', 0.8, 1.4, C.eye, 'head');
  }
  // 脚：細い管にする。点の文字の大きさ S が脚の太さほどあるので、管の輪は2点にして、点を管の向きに細かく並べる（輪を多くすると、文字の分だけ太る）
  const limb = (p0: Vec3, p1: Vec3, r: number, part: string, ex: Extra): void => {
    const dx = p1[0] - p0[0],
      dy = p1[1] - p0[1],
      dz = p1[2] - p0[2],
      m = Math.max(2, Math.round(Math.hypot(dx, dy, dz) / (S * 0.35))),
      dl = Math.hypot(dx, dy) || 1;
    for (let j = 0; j <= m; j++) {
      const f = j / m,
        a = j * 1.9;
      for (const sg of [1, -1]) {
        // 管の向きに直交する向き（脚は横か縦に伸びるので、管と z 軸の両方に直交する向きと、z 軸の間で回す）
        const ox = (-dy / dl) * Math.cos(a) * sg,
          oy = (dx / dl) * Math.cos(a) * sg,
          oz = Math.sin(a) * sg;
        put(p0[0] + dx * f + ox * r, p0[1] + dy * f + oy * r, p0[2] + dz * f + oz * r, ox, oy + 0.3, oz, SKINR, C.crust, part, ex);
      }
    }
  };
  // 脚：肘とひざを外へ張り、手足を床に置く（はうように）。前の左と後ろの右が同じ向きに振れる。点はどれも肩か腰を軸に回る
  for (const front of [true, false])
    for (const sd of [-1, 1]) {
      const part = front === sd < 0 ? 'legL' : 'legR',
        ex = front ? SALA_SHOULDER : SALA_HIP,
        z0 = ex.pz,
        dz = front ? 1 : -1,
        root: Vec3 = [sd * 0.08, ex.piv, z0],
        knee: Vec3 = [sd * 0.27, 0.2, z0 + dz * 0.03],
        foot: Vec3 = [sd * 0.32, 0.035, z0 + dz * 0.1];
      limb(root, knee, 0.025, part, ex);
      limb(knee, foot, 0.02, part, ex);
      // 指：手足から外と前（後ろ足は後ろ）へ広げる
      for (const [ox, oz] of [
        [0.07, 0.0],
        [0.06, 0.05],
        [0.02, 0.08],
      ] as const)
        lit(foot[0] + sd * ox, 0.025, foot[2] + dz * oz, '.', 1.0, 1.1, C.belly, part, ex);
    }
  // 尾の先の小さな炎：根もとは深い赤、先は黄色（part 'flame'。尾と一緒に振れるように、尾の付け根からの距離を piv に入れる）
  const tip = B.at(B.z0 + 0.04);
  for (let q = 0; q < 5; q++) {
    const f = q / 4;
    lit(
      0,
      tip.cy + 0.02 + f * 0.2,
      B.z0 + 0.04 - 0.05 * f,
      '^',
      1.25 - 0.4 * f,
      1.3 + 0.45 * f,
      [1, 0.3 + 0.5 * f, 0.08 + 0.3 * f],
      'flame',
      {
        fh: f,
        piv: B.tailZ - B.z0,
      },
    );
  }
  return pts;
}

/** 猟犬の胴（3匹で同じ。形の中の奥行き z での、背の高さ・腹の高さ・横の半径）。体の点と、背の飾り（氷・炎）と脇腹の飾り（ひび・光の筋）の位置を、同じ式から出す */
export const houndTorso = {
  /** 尻の端と胸の端の奥行き */
  z0: -0.44,
  z1: 0.42,
  /** 尻（0）から胸（1）までの割合 u での、背の高さ・腹の高さ・横の半径（間は滑らかにつなぐ） */
  keys: [
    [0, 0.85, 0.63, 0.12],
    [0.18, 0.88, 0.6, 0.13],
    [0.42, 0.87, 0.66, 0.095],
    [0.72, 0.93, 0.48, 0.14],
    [0.9, 0.94, 0.5, 0.14],
    [1, 0.9, 0.58, 0.11],
  ] as const satisfies readonly (readonly [number, number, number, number])[],
  /** 割合 u での、背の高さ top・腹の高さ bot・横の半径 rx（端を閉じる前） */
  at(u: number): { top: number; bot: number; rx: number } {
    const K = houndTorso.keys;
    let i = 0;
    while (i < K.length - 2 && nth(K, i + 1)[0] < u) i++;
    const a = nth(K, i),
      b = nth(K, i + 1),
      f = clamp((u - a[0]) / (b[0] - a[0]), 0, 1),
      e = f * f * (3 - 2 * f);
    return { top: a[1] + (b[1] - a[1]) * e, bot: a[2] + (b[2] - a[2]) * e, rx: a[3] + (b[3] - a[3]) * e };
  },
  /** 端を丸く閉じる割合（真ん中は 1、両端で 0） */
  cap: (u: number): number => {
    const d = Math.max(0, Math.abs(u - 0.5) - 0.38) / 0.12;
    return Math.sqrt(Math.max(0, 1 - d * d));
  },
  /** 割合 u の輪の、真ん中の高さ cy と、端を閉じた後の縦と横の半径 ry・rx */
  ring(u: number): { cy: number; ry: number; rx: number } {
    const { top, bot, rx } = houndTorso.at(u),
      cp = houndTorso.cap(u);
    return { cy: (top + bot) / 2, ry: ((top - bot) / 2) * cp, rx: rx * cp };
  },
  /** 割合 u の奥行き */
  z: (u: number): number => houndTorso.z0 + (houndTorso.z1 - houndTorso.z0) * u,
};
/** 猟犬の首（3匹で同じ。胸の上から前へ立ち上がる管）：根もと a・先 b と、それぞれの半径 */
export const houndNeck = { a: [0, 0.84, 0.3], b: [0, 1.04, 0.56], r0: 0.1, r1: 0.078 } as const satisfies {
  a: Vec3;
  b: Vec3;
  r0: number;
  r1: number;
};
/** 猟犬の頭（3匹で同じ。楕円）の真ん中 c と半径 r。頭の点と、目・耳の位置を、同じ式から出す */
export const houndHead = { c: [0, 1.07, 0.63], r: [0.11, 0.1, 0.13] } as const satisfies { c: Vec3; r: Vec3 };
/** 頭の表面の、向き（nx, ny, nz）の所（長さは 1 にしてから、半径を掛ける）。out は表面から外へ出す割合 */
export const houndHeadAt = (nx: number, ny: number, nz: number, out = 1): Vec3 => {
  const l = Math.hypot(nx, ny, nz),
    { c, r } = houndHead;
  return [c[0] + (nx / l) * r[0] * out, c[1] + (ny / l) * r[1] * out, c[2] + (nz / l) * r[2] * out];
};
/** 氷のハウンドの色 */
export const HOUND_ICE = {
  /** 背と脇と頭の上：青 */
  fur: [0.4, 0.55, 0.82],
  /** 胸と腹と鼻づらと脚の先：霜の白 */
  frost: [0.84, 0.9, 0.96],
  /** 氷の結晶：澄んだ水色 */
  ice: [0.5, 0.9, 1.0],
  /** 鼻：黒 */
  nose: [0.08, 0.1, 0.14],
  /** 目：澄んだ水色（白い鼻づらと分かれるように、霜より青い） */
  eye: [0.45, 1.0, 1.0],
} as const satisfies Record<string, Color>;

/** 猟犬の体の色と文字（3匹で同じ体を、色で分ける） */
export interface HoundCoat {
  /** 背と脇と頭の上 */
  fur: Color;
  /** 胸と腹と鼻づらと脚の先と尾の先 */
  under: Color;
  nose: Color;
  eye: Color;
  /** 背と脇の文字と、胸と腹の文字（暗い → 明るい） */
  pelt: Ramp;
  belly: Ramp;
  /** 目の明るさ */
  eyeB: number;
}
/** 猟犬の体を作る道具（細かい点で作る。道具の点の大きさと間隔 S は、大きさ scale に反比例する。四つ足は小さいので、そのままだと胴が数個の文字になる） */
export const houndKit = (ty: BodyType): Kit3 => q3({ scale: ty.scale * 1.6 });
/** 猟犬の目の向き（頭の真ん中から、左右は sd を掛ける） */
export const HOUND_EYE_DIR = [0.75, 0.5, 0.45] as const;

// hound: a lean hunting dog. A deep chest and tucked waist, a neck rising to a long head with pointed ears,
// legs bent at the hock behind. The three hounds share this body and differ in coat and ornaments
/** 3匹の猟犬が同じに持つ体（脚・胴・首・頭・尾）。飾りは、同じ道具 kit で、この後に足す */
export function houndBody(kit: Kit3, C: HoundCoat): void {
  const { S, lit, stroke, ell, tube, put } = kit,
    T = houndTorso,
    NK = houndNeck,
    PELT = C.pelt,
    BELLY = C.belly;
  // 脚：前脚は肩（高さ 0.82）、後脚は腰（高さ 0.8）を軸に回る。前の左と後ろの右が同じ向きに振れる
  const FRONT = 0.82,
    HIP = 0.8;
  for (const sd of [-1, 1]) {
    const fp = sd < 0 ? 'legL' : 'legR',
      rp = sd < 0 ? 'legR' : 'legL',
      fx = { piv: FRONT, pz: 0.3 },
      rx = { piv: HIP, pz: -0.32 };
    // 前脚：まっすぐで細い。先は腹の色
    tube([sd * 0.1, 0.78, 0.3], [sd * 0.09, 0.4, 0.32], 0.055, 0.04, PELT, C.fur, fp, fx);
    tube([sd * 0.09, 0.4, 0.32], [sd * 0.09, 0.07, 0.31], 0.036, 0.032, BELLY, C.under, fp, fx);
    // 後脚：太いもも、後ろへ折れるかかと、前へ下りる足
    tube([sd * 0.1, 0.78, -0.32], [sd * 0.11, 0.48, -0.24], 0.08, 0.05, PELT, C.fur, rp, rx, 0.15);
    tube([sd * 0.11, 0.48, -0.24], [sd * 0.1, 0.22, -0.4], 0.045, 0.035, PELT, C.fur, rp, rx);
    tube([sd * 0.1, 0.22, -0.4], [sd * 0.1, 0.07, -0.36], 0.034, 0.032, BELLY, C.under, rp, rx);
    // 足：前へ向いた爪先
    for (const [z0, part, ex] of [
      [0.31, fp, fx],
      [-0.36, rp, rx],
    ] as const) {
      lit(sd * 0.09, 0.03, z0 + 0.04, 'm', 0.9, 1.0, C.under, part, ex);
      lit(sd * 0.09, 0.03, z0 + 0.1, '.', 0.7, 1.0, C.under, part, ex);
    }
  }
  // 胴：尻から胸へ、らせんに点を置く（輪ごとに同じ奥行きに並べると、横から見て縦の縞になる）。1周ごとに奥行きを1段進め、段の数は等しい間隔で割る
  const NR = Math.max(4, Math.round((T.z1 - T.z0) / (S * 0.6)));
  for (let r = 0; r <= NR; r++) {
    const n = Math.max(6, Math.round((Math.PI * (T.ring(r / NR).rx + T.ring(r / NR).ry)) / (S * 0.75)));
    for (let k = 0; k < (r === NR ? 1 : n); k++) {
      const u = (r + k / n) / NR,
        z = T.z(u),
        { cy, ry, rx } = T.ring(u),
        cp = T.cap(u),
        // 端に近いほど、面は前か後ろを向く
        nz = (u < 0.5 ? -1 : 1) * Math.sqrt(Math.max(0, 1 - cp * cp)),
        a = (k / n) * Math.PI * 2,
        ca = Math.cos(a),
        sa = Math.sin(a),
        // 胸と腹は腹の色、背と脇は毛の色
        under = sa < -0.35 || (u > 0.72 && sa < 0.3);
      put(
        ca * rx,
        cy + sa * ry,
        z,
        (ca / Math.max(rx, 0.01)) * cp,
        (sa / Math.max(ry, 0.01)) * cp,
        nz * 8,
        under ? BELLY : PELT,
        under ? C.under : C.fur,
      );
    }
  }
  // 首：胸の上から、前へ立ち上がる
  tube(NK.a, NK.b, NK.r0, NK.r1, PELT, (_x, oy) => (oy < -0.3 ? C.under : C.fur), 'head');
  // 頭：上は毛の色、下は腹の色の丸い頭と、前へ細る鼻づら（鼻筋だけ毛の色）。鼻
  {
    const H = houndHead;
    // 目のまわりは頭の点を空ける（近い所の大きな文字が、斜めから見た目を隠す）
    const EYE_DIR = HOUND_EYE_DIR,
      el = Math.hypot(...EYE_DIR),
      nearEye = (nx: number, ny: number, nz: number): boolean =>
        (Math.abs(nx) * EYE_DIR[0] + ny * EYE_DIR[1] + nz * EYE_DIR[2]) / el > 0.85;
    ell(H.c, H.r[0], H.r[1], H.r[2], PELT, (_x, ny) => (ny < -0.25 ? C.under : C.fur), 'head', null, nearEye);
    tube([0, 1.03, 0.75], [0, 0.98, 0.95], 0.068, 0.04, BELLY, (_x, oy) => (oy > 0.7 ? C.fur : C.under), 'head');
    lit(0, 0.985, 0.98, 'o', 0.8, 1.0, C.nose, 'head');
    for (const sd of [-1, 1]) {
      // とがった耳：頭の上の後ろから、後ろへ寝た三角（根もとは2本、先で1つになる）
      const e = houndHeadAt(sd * 0.5, 0.8, -0.35),
        tip: Vec3 = [e[0] + sd * 0.03, e[1] + 0.09, e[2] - 0.07];
      for (const dz of [0.03, -0.03]) stroke([e[0], e[1], e[2] + dz], tip, C.fur, 1.1, 0.9, 'head', undefined, S * 0.4);
      lit(tip[0], tip[1] + 0.02, tip[2] - 0.01, '^', 0.8, 1.1, C.fur, 'head');
      // 目：頭の前の上の横寄り（鼻づらの根もとに隠れない所）、表面のすぐ外
      const y = houndHeadAt(sd * EYE_DIR[0], EYE_DIR[1], EYE_DIR[2], 1.1);
      // 点（.）は小さすぎて近くでも読めないので、詰まった文字にする
      lit(y[0], y[1], y[2], 'o', 0.75, C.eyeB, C.eye, 'head');
    }
  }
  // 尾：尻から下へ垂れ、先が少し上がる。先ほど大きく揺れる
  const TN = 9;
  for (let k = 0; k <= TN; k++) {
    const f = k / TN,
      y = 0.8 - 0.4 * f + 0.14 * f * f * f,
      z = -0.42 - 0.32 * f,
      r = 0.045 * (1 - 0.5 * f);
    for (const o of [-1, 1]) lit(o * r, y, z, mpick(['%', '"']), 0.9, 1.1, f > 0.8 ? C.under : C.fur, 'tail', { piv: k * 0.35 });
  }
}

// ice hound: the hound body in blue with frost-white underparts. A ridge of ice shards runs along the spine from the neck to the haunch
export function iceHoundForm(ty: BodyType): Body {
  const kit = houndKit(ty),
    { pts, lit, tube } = kit,
    C = HOUND_ICE,
    T = houndTorso,
    NK = houndNeck,
    ICE: Ramp = [':', '/', '|', '^', '^'];
  // 光の当たらない側（腹と、横から見た向こう側）も見えるように、いちばん暗い文字も点（.）にしない
  houndBody(kit, {
    fur: C.fur,
    under: C.frost,
    nose: C.nose,
    eye: C.eye,
    pelt: [':', '"', '%', '#', '#'],
    belly: [':', ':', '%', '#', '#'],
    eyeB: 1.8,
  });
  // 背中の氷：首の付け根から腰まで、背骨に沿って後ろへ傾いた結晶が並ぶ。根もとは背の表面（胴と同じ式）
  const NS = 6;
  for (let q = 0; q < NS; q++) {
    const u = 0.3 + (0.6 * q) / (NS - 1),
      z = T.z(u),
      { cy, ry } = T.ring(u),
      top = cy + ry,
      h = 0.1 + 0.09 * Math.sin(q * 1.9 + 0.7) ** 2 + (q === 3 || q === 4 ? 0.05 : 0),
      tipZ = z - h * 0.8;
    // 先へ細る錐と、先の明るい文字
    tube([0, top, z], [0, top + h, tipZ], 0.035, 0.008, ICE, C.ice, 'body');
    lit(0, top + h * 1.15, z + (tipZ - z) * 1.15, '^', 0.8, 1.3, C.ice, 'body');
  }
  // 首の後ろの結晶：根もとは首の管の、上で後ろ向きの面（首の向きに直角）
  {
    const dy = NK.b[1] - NK.a[1],
      dz = NK.b[2] - NK.a[2],
      L = Math.hypot(dy, dz),
      oy = dz / L,
      oz = -dy / L;
    for (let q = 0; q < 2; q++) {
      const f = 0.35 + q * 0.35,
        r = NK.r0 + (NK.r1 - NK.r0) * f,
        y = NK.a[1] + dy * f + oy * r,
        z = NK.a[2] + dz * f + oz * r;
      tube([0, y, z], [0, y + 0.1, z - 0.06], 0.03, 0.008, ICE, C.ice, 'head');
      lit(0, y + 0.115, z - 0.07, '^', 0.75, 1.3, C.ice, 'head');
    }
  }
  return pts;
}

/** 炎のハウンドの色 */
export const HOUND_FIRE = {
  /** 背と脇と頭の上：煤けた黒に近い赤（自分の灯りの橙に照らされるので、暗くしておく） */
  fur: [0.2, 0.07, 0.05],
  /** 胸と腹と鼻づらと脚の先：熾火の赤 */
  ember: [0.75, 0.22, 0.06],
  /** 脇腹のひび：明るい橙 */
  crack: [1.0, 0.55, 0.15],
  /** 鼻：黒 */
  nose: [0.1, 0.05, 0.03],
  /** 目：黄色 */
  eye: [1.0, 0.9, 0.35],
} as const satisfies Record<string, Color>;
/** 炎のたてがみの根もと（首の上の5つと、背の7つ）：位置と、炎の高さ（不揃い） */
export function fireManeRoots(): { at: Vec3; h: number }[] {
  const T = houndTorso,
    NK = houndNeck,
    dy = NK.b[1] - NK.a[1],
    dz = NK.b[2] - NK.a[2],
    L = Math.hypot(dy, dz),
    oy = dz / L,
    oz = -dy / L,
    out: { at: Vec3; h: number }[] = [];
  // 首：管の、上で後ろ向きの面（首の向きに直角）。高さと間隔は不揃いにする（揃えると、止まった姿が縞の帯に見える）
  for (const [f, h] of [
    [0.9, 0.1],
    [0.72, 0.17],
    [0.5, 0.12],
    [0.33, 0.2],
    [0.1, 0.16],
  ] as const) {
    const r = NK.r0 + (NK.r1 - NK.r0) * f;
    out.push({ at: [0, NK.a[1] + dy * f + oy * r, NK.a[2] + dz * f + oz * r], h });
  }
  // 背：肩から腰へ、だんだん低くなる（これも不揃いに）
  for (const [u, h] of [
    [0.89, 0.26],
    [0.8, 0.17],
    [0.74, 0.23],
    [0.64, 0.13],
    [0.57, 0.18],
    [0.47, 0.1],
    [0.4, 0.12],
  ] as const) {
    const { cy, ry } = T.ring(u);
    out.push({ at: [0, cy + ry, T.z(u)], h });
  }
  return out;
}

// fire hound: the hound body in sooty red with ember-glowing underparts. A mane of flame runs from the nape down the back,
// glowing cracks split the flanks, and the tail ends in a flame
export function fireHoundForm(ty: BodyType): Body {
  const kit = houndKit(ty),
    { pts, lit } = kit,
    C = HOUND_FIRE,
    T = houndTorso;
  houndBody(kit, {
    fur: C.fur,
    under: C.ember,
    nose: C.nose,
    eye: C.eye,
    pelt: [':', '"', '%', '#', '#'],
    belly: [':', ':', '%', '#', '#'],
    // 自分の灯りの橙に照らされて、1.8 では光のにじみが顔を隠す
    eyeB: 1.5,
  });
  // 炎のたてがみ：根もとは深い赤、先は黄色。先ほど揺れ、走ると後ろへなびく（part 'flame'）。左右に少しずらした2本で厚みを出す。
  // 2本目の高さと、後ろへの傾きは炎ごとに変える（揃うと縞に見える）
  fireManeRoots().forEach(({ at, h }, k) => {
    const n = 5,
      h2 = nth([0.55, 0.9, 0.7], k % 3),
      lean = nth([0.3, 0.55, 0.42, 0.65], k % 4);
    for (const ox of [-0.025, 0.025])
      for (let q = 0; q < n; q++) {
        const f = q / (n - 1),
          hh = h * (ox < 0 ? 1 : h2);
        lit(
          at[0] + ox * (1 - f),
          at[1] + hh * f,
          at[2] - hh * lean * f,
          '^',
          1.1 - 0.4 * f,
          1.2 + 0.3 * f,
          [1.0, 0.18 + 0.5 * f, 0.04 + 0.2 * f * f],
          'flame',
          {
            fh: f,
          },
        );
      }
  });
  // 脇腹のひび：胴の表面のすぐ外に、上から下へ折れ曲がる細い橙の線（左右に2本ずつ。縞に見えないよう、長さと位置をずらす）
  for (const sd of [-1, 1])
    for (const [u, a0, n] of [
      [0.3, 0.35, 3],
      [0.62, 0.6, 4],
    ] as const) {
      for (let q = 0; q < n; q++) {
        const a = a0 - q * 0.32,
          uu = u + (q % 2 ? 0.04 : -0.02),
          { cy, ry, rx } = T.ring(uu);
        lit(sd * Math.cos(a) * rx * 1.08, cy + Math.sin(a) * ry * 1.08, T.z(uu), q % 2 ? '\\' : '/', 0.65, 1.4, C.crack, 'body');
      }
    }
  // 尾の先の炎
  for (let q = 0; q < 3; q++)
    lit(0, 0.56 + q * 0.05, -0.75 - q * 0.02, '^', 0.85 - q * 0.15, 1.3 + q * 0.2, [1.0, 0.45 + q * 0.2, 0.12], 'tail', { piv: 9 * 0.35 });
  return pts;
}

/** 光のハウンドの色 */
export const HOUND_LIGHT = {
  /** 背と脇と頭の上：金 */
  fur: [0.9, 0.62, 0.18],
  /** 胸と腹と鼻づらと脚の先と、胴の輪郭の線（背と腹の線・尻と胸の端）：淡い金 */
  pale: [1.0, 0.88, 0.55],
  /** 脇腹から後ろへ流れる光の筋 */
  ray: [1.0, 0.9, 0.55],
  /** 鼻：鼻づらと同じ淡い金（暗い鼻は、光の体に合わない） */
  nose: [1.0, 0.88, 0.55],
  /** 目：青みの白（金の体と分かれるように） */
  eye: [0.75, 0.95, 1.0],
} as const satisfies Record<string, Color>;
/** 光のハウンドの光の筋（左右に3本ずつ）：横 x・高さ y、始まりと終わりの奥行き z0・z1、点の数 n。始まりは胴の表面のすぐ外 */
export function lightStreaks(S: number): { x: number; y: number; z0: number; z1: number; n: number }[] {
  const T = houndTorso,
    out: { x: number; y: number; z0: number; z1: number; n: number }[] = [];
  for (const sd of [-1, 1])
    for (const [u, a, z1] of [
      [0.62, 0.55, -0.9],
      [0.5, 0.05, -1.1],
      [0.38, -0.45, -0.85],
    ] as const) {
      const { cy, ry, rx } = T.ring(u),
        z0 = T.z(u);
      out.push({
        x: sd * Math.cos(a) * rx * 1.12,
        y: cy + Math.sin(a) * ry * 1.12,
        z0,
        z1,
        n: Math.max(3, Math.round((z0 - z1) / (S * 0.7))),
      });
    }
  return out;
}

/** 光のハウンドの胴で、輪郭として濃く残す輪（尻から胸への割合。尻と胸の端だけ。間に輪を置くと、横から見て縦の縞になる） */
export const LIGHT_RINGS = [0.06, 0.94] as const;

// light hound: the hound body in gold, made of light. The torso is see-through between its outline lines, streaks of light stream back from the flanks, the hindquarters fade out,
// and the tail ends in a star
export function lightHoundForm(ty: BodyType): Body {
  const kit = houndKit(ty),
    { pts, lit, S } = kit,
    C = HOUND_LIGHT;
  houndBody(kit, {
    fur: C.fur,
    under: C.pale,
    nose: C.nose,
    eye: C.eye,
    pelt: [':', '"', '%', '#', '#'],
    belly: [':', ':', '%', '#', '#'],
    eyeB: 1.5,
  });
  // 透けた胴：輪郭の線（背と腹の線と、尻と胸の端の輪）だけを淡い金の明るい点で残し、間は半分に減らして細く暗い文字にする（脚・首・頭・尾はそのまま）
  {
    const T = houndTorso,
      keep: Body = [];
    let n = 0;
    for (const p of pts) {
      if (p.part !== 'body') {
        keep.push(p);
        continue;
      }
      const u = (p.z - T.z0) / (T.z1 - T.z0),
        r = T.ring(u),
        sa = (p.y - r.cy) / Math.max(r.ry, 0.01);
      if (Math.abs(sa) > 0.85 || LIGHT_RINGS.some((v) => Math.abs(u - v) < 0.035))
        keep.push(Object.assign(p, { col: C.pale, b: Math.min(1.6, p.b * 1.2) }));
      else if (n++ % 2 === 0) keep.push(Object.assign(p, { g: G(':'), b: p.b * 0.7 }));
    }
    pts.length = 0;
    pts.push(...keep);
  }
  // 後ろへ行くほど薄れる（光でできた体が、走った跡の残像へほどけていく）
  for (const p of pts) if (p.z < -0.05) p.b *= 1 - 0.45 * Math.min(1, (-0.05 - p.z) / 0.7);
  // 光の筋：脇腹の表面のすぐ外から、後ろへ流れる横の線（尻を越えて、先ほど薄れる）
  for (const st of lightStreaks(S))
    for (let q = 0; q < st.n; q++) {
      const f = q / Math.max(1, st.n - 1);
      lit(st.x, st.y, st.z0 - (st.z0 - st.z1) * f, '-', 0.9, 1.3 - 0.8 * f, C.ray, 'body');
    }
  // 尾の先の星
  lit(0, 0.57, -0.76, '*', 0.9, 1.7, C.pale, 'tail', { piv: 9 * 0.35 });
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

/** クラーケンの色（体の形と、水から立ち上がる触手 krakenArms が使う） */
export const KRAKEN = {
  /** 外套の上：藍 */
  top: [0.34, 0.26, 0.66],
  /** 外套の下：青紫 */
  mid: [0.3, 0.42, 0.8],
  /** 頭と触手：青緑 */
  skin: [0.2, 0.52, 0.64],
  /** 水際：白っぽい青 */
  pale: [0.58, 0.76, 0.82],
  /** 外套のまだら：明るい紫 */
  blot: [0.6, 0.44, 0.9],
  /** 目の奥：黒（目の輪の中に見え、後ろからは目を隠す） */
  pupil: [0.04, 0.03, 0.05],
  /** 外套の光る斑点 */
  spot: [0.55, 0.95, 1.0],
  /** 吸盤：薄紅 */
  sucker: [0.98, 0.6, 0.56],
  /** 目：金 */
  eye: [1.0, 0.78, 0.3],
} as const satisfies Record<string, Color>;
/** クラーケンの頭（形の中の高さ y での、真ん中の奥行きと半径）。体の点と、斑点・目の位置を、同じ式から出す */
export const krakenHead = {
  /** 目のある頭（下）と、後ろへ傾いた外套（上）の、大きい方。間がくびれる */
  r: (y: number): number =>
    Math.max(0.35 * Math.sqrt(Math.max(0, 1 - ((y - 0.44) / 0.26) ** 2)), 0.3 * Math.sqrt(Math.max(0, 1 - ((y - 0.88) / 0.3) ** 2))),
  cz: (y: number): number => 0.04 - 0.3 * clamp((y - 0.6) / 0.58, 0, 1) ** 2,
  /** 横の半径に対する、奥行きの半径 */
  kz: 0.92,
  /** 外套のてっぺん（水面から 2.4 ほど。天井の低い部屋 3.2 の下に、立ち上がる腕と一緒に収まる） */
  top: 1.18,
};
/** 水面の高さ（形の中の高さ。深い水の生き物は 0.7 沈むので、クラーケンの大きさ 2.6 なら 0.7 / 2.6） */
export const KRAKEN_WATER = 0.27;
/** 沈んでいる時（水から出ている度合い rise が 0）に、形を下げる高さ。外套の上だけが水面に出る（draw.ts の drawMonster0） */
export const KRAKEN_SINK = 0.7;

// kraken: an octopus's head rising out of deep water. The lower head holds the gold eyes, a waist, then the tall mantle leaning back,
// indigo with glowing spots (seen from behind too). Six arms lie on the water and curl at the tips, their edges lined with pink suckers.
// The arms standing up out of the water are drawn each frame (draw.ts の krakenArms), as they rise with the creature
export function krakenForm2(ty: BodyType): Body {
  const { S, pts, put, lit } = q3(ty),
    K = KRAKEN,
    H = krakenHead,
    W = KRAKEN_WATER,
    RAMP: Ramp = ['.', ':', '~', '%', '#'],
    // 頭と外套は、暗い側も濃い文字にする（細い文字だと、後ろから目の金が透ける）
    HEAD: Ramp = ['&', '%', '%', '#', '#'];
  // 目の位置（頭の前の左右）。体の点は、目のまわりを空けて、目が埋もれないようにする
  const ey = 0.47,
    EYES = [-1, 1].map((sd) => {
      const r = H.r(ey),
        x = sd * 0.17,
        z = H.cz(ey) + r * H.kz * Math.sqrt(1 - (x / r) ** 2),
        // 楕円の外向きの向き（x / r と (z - cz) / (r * kz) は、2つを2乗して足すと 1）
        ox = x / r,
        oz = (z - H.cz(ey)) / (r * H.kz);
      return { sd, x, z, ox, oz };
    });
  // 1. 頭と外套：高さを等しく割った行ごとの輪
  const rows = Math.round((H.top - W) / (S * 0.8));
  for (let i = 0; i <= rows; i++) {
    const y = W + ((H.top - W) * i) / rows,
      r = H.r(y),
      dr = (H.r(y + 0.01) - H.r(y - 0.01)) / 0.02,
      n = Math.max(1, Math.round((2 * Math.PI * r) / (S * 0.9))),
      m = clamp((y - 0.66) / 0.45, 0, 1),
      col: Color =
        y < W + 0.07
          ? K.pale
          : y < 0.66
            ? K.skin
            : [K.mid[0] + (K.top[0] - K.mid[0]) * m, K.mid[1] + (K.top[1] - K.mid[1]) * m, K.mid[2] + (K.top[2] - K.mid[2]) * m];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2,
        nx = Math.cos(a),
        nz = Math.sin(a),
        px = nx * r,
        pz = H.cz(y) + nz * r * H.kz;
      if (EYES.some((e) => Math.hypot(px - e.x, y - ey, pz - e.z) < 0.14)) continue;
      // 外套のまだら：向きと高さの波で、明るい斑を散らす
      const blot = y > 0.7 && Math.sin(a * 4 + y * 7) + Math.sin(a * 3 - y * 10) > 0.7;
      put(px, y, pz, nx, clamp(-dr, -4, 4), nz, HEAD, blot ? K.blot : col, 'body');
    }
  }
  // 外套の斑点：表面から少し外へ（前・横・後ろに散らす）
  for (let k = 0; k < 22; k++) {
    const y = 0.72 + 0.4 * ((k * 0.618) % 1),
      a = k * 2.39996,
      r = H.r(y) + 0.03;
    lit(Math.cos(a) * r, y, H.cz(y) + Math.sin(a) * r * H.kz, 'o', 1.1, 1.7, K.spot, 'body');
  }
  // 2. 目：頭の前の左右。金の輪（まわりの体の点を空けたので、輪の中は暗く、瞳に見える）と、上のまぶたの弧
  for (const { sd, x, z: zs, ox, oz } of EYES) {
    lit(x - ox * 0.02, ey, zs - oz * 0.02, '#', 2.8, 1, K.pupil, 'head');
    lit(x + ox * 0.05, ey, zs + oz * 0.05, 'O', 2.3, 1.6, K.eye, 'head');
    for (let j = -1; j <= 1; j++)
      lit(
        x + ox * 0.05 + j * 0.08 * oz,
        ey + 0.13 - Math.abs(j) * 0.035,
        zs + oz * 0.05 - j * 0.08 * ox,
        j ? (j * sd > 0 ? '\\' : '/') : '-',
        1,
        1.2,
        K.pale,
        'head',
      );
  }
  // 3. 水の上に伸びる6本の腕（前は目の前を空ける）。上は青緑、水際の両側に吸盤、先は巻く
  const ARMS = [1.0, -1.0, 1.8, -1.8, 2.6, -2.6];
  ARMS.forEach((a0, ti) => {
    const sd = Math.sign(a0),
      L = 0.85 + 0.12 * ((ti * 0.37) % 1),
      ds = S * 0.8,
      N = Math.round(L / ds);
    let px = Math.sin(a0) * H.r(W) * 0.95,
      pz = H.cz(W) + Math.cos(a0) * H.r(W) * 0.95,
      th = a0;
    for (let i = 0; i <= N; i++) {
      const f = i / N,
        w = 0.09 * (1 - 0.75 * f),
        y = W + 0.02 + w * 0.6,
        // 進む向き：少し横へ曲がり、先の3割で強く巻く
        turn = sd * (0.25 + 3.2 * Math.max(0, (f - 0.62) / 0.38) ** 2);
      th = a0 + turn;
      const dx = Math.sin(th),
        dz = Math.cos(th),
        ex = { piv: i * 0.45, ti };
      // 断面は水の上の半分：両脇（吸盤）・肩・背
      for (const c of [-1, -0.5, 0, 0.5, 1]) {
        const sx = dz * c * w,
          sz = -dx * c * w,
          up = Math.sqrt(1 - c * c) * w;
        if (Math.abs(c) === 1) {
          if (i % 2 === 0) lit(px + sx, y, pz + sz, 'o', 0.8 + 0.5 * (1 - f), 1.5, K.sucker, 'tent', ex);
        } else put(px + sx, y + up, pz + sz, dz * c, Math.sqrt(1 - c * c), -dx * c, RAMP, f > 0.6 ? K.skin : K.top, 'tent', ex);
      }
      px += dx * ds;
      pz += dz * ds;
    }
  });
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

/** 楕円（真ん中と、軸ごとの半径） */
interface Ellipsoid {
  c: Vec3;
  r: Vec3;
}
/** 吸血コウモリの体の寸法（形の中の座標。体の真ん中が原点で、前が +z。テストも同じ値で表面からの距離を数える） */
export const BAT: { body: Ellipsoid; head: Ellipsoid; wingY: number; wingTilt: number; wingRoot: number; eye: Color; fang: Color } = {
  /** 胴 */
  body: { c: [0, 0, -0.03], r: [0.1, 0.095, 0.16] },
  /** 頭 */
  head: { c: [0, 0.05, 0.18], r: [0.09, 0.082, 0.082] },
  /** 翼の面の高さ */
  wingY: 0.03,
  /** 翼の面の傾き（後ろへ 1 進むと、この分下がる） */
  wingTilt: 0.5,
  /** 翼の根もとの、体の真ん中からの距離（胴の横の半径より少し内。膜が胴に付いて見える） */
  wingRoot: 0.09,
  eye: [1, 0.22, 0.2],
  fang: [0.95, 0.92, 0.85],
};

// vampire bat: a furry egg of a body with a round head, tall pointed ears (pink inside), red eyes, a pug nose and two white fangs.
// The wings are membranes stretched over the long arm and four fingers, with a scalloped trailing edge, drawn in the wing's own plane
// (r = out from the body, z = along it; the 'wing' motion flaps them). Short legs with hooked claws trail behind, joined by a tail membrane.
export function batForm(ty: BodyType): Body {
  // 小さな体なので、文字を細かくする（kit の大きさ S は scale から決まるので、種類の scale の 1.5 倍を渡し、文字を 1/1.5 にする）
  const { S, pts, put, lit } = q3({ scale: 1.5 * ty.scale }),
    FURC: Color = [0.4, 0.2, 0.22],
    CHEST: Color = [0.62, 0.34, 0.32],
    SKIN: Color = [0.62, 0.32, 0.36],
    EAR: Color = [0.85, 0.42, 0.5],
    BONE: Color = [0.72, 0.42, 0.44],
    MEM: Color = [0.58, 0.12, 0.22],
    MEM_D: Color = [0.36, 0.07, 0.15],
    EDGE: Color = [0.85, 0.28, 0.36],
    FURR: Ramp = ['%', '%', '"', '%', '#'];
  // 楕円の毛皮：高さを等しく割った行ごとの輪（skip が真の所は描かない）
  const blob = (
    e: Ellipsoid,
    col: (nx: number, ny: number, nz: number) => Color,
    part: string,
    skip?: (nx: number, ny: number, nz: number) => boolean,
  ) => {
    const [cx, cy, cz] = e.c,
      [rx, ry, rz] = e.r,
      st = S * 0.8,
      rows = Math.max(3, Math.round((Math.PI * ry) / st));
    for (let i = 0; i <= rows; i++) {
      const v = (Math.PI * i) / rows,
        sv = Math.sin(v),
        cv = Math.cos(v),
        n = Math.max(1, Math.round((2 * Math.PI * Math.max(rx, rz) * sv) / st));
      for (let k = 0; k < n; k++) {
        const u = (k / n) * Math.PI * 2 + i * 0.7,
          nx = Math.cos(u) * sv,
          ny = cv,
          nz = Math.sin(u) * sv;
        if (skip && skip(nx, ny, nz)) continue;
        put(cx + nx * rx, cy + ny * ry, cz + nz * rz, nx / rx, ny / ry, nz / rz, FURR, col(nx, ny, nz), part);
      }
    }
  };
  // 1. 胴：背は暗く、胸と腹は明るい
  blob(BAT.body, (_x, ny, nz) => (ny < -0.2 || nz > 0.55 ? CHEST : FURC), 'body');
  // 首の毛の盛り上がり（頭と胴のつなぎ目）
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    lit(Math.cos(a) * 0.085, 0.03 + Math.sin(a) * 0.07, 0.1, '%', 1, 1.0, CHEST, 'head');
  }
  // 2. 頭：前の顔は明るい。目のまわりは毛の点を空ける（目が毛に埋もれないように）
  const H = BAT.head,
    hc = H.c,
    hr = H.r,
    // 目の向き（頭の楕円の、半径で割った座標での向き）
    EYES = [-1, 1].map((sd) => {
      const l = Math.hypot(sd * 0.42, 0.3, 0.86);
      return [(sd * 0.42) / l, 0.3 / l, 0.86 / l] as const;
    });
  blob(
    H,
    (_x, ny, nz) => (nz > 0.6 && ny < 0.3 ? SKIN : FURC),
    'head',
    (nx, ny, nz) => EYES.some(([ex, ey, ez]) => nx * ex + ny * ey + nz * ez > 0.9),
  );
  // 目：顔の前の左右、表面のすぐ外
  for (const [ex, ey, ez] of EYES)
    lit(hc[0] + ex * hr[0] * 1.25, hc[1] + ey * hr[1] * 1.25, hc[2] + ez * hr[2] * 1.25, 'o', 0.9, 1.8, BAT.eye, 'head');
  // 低い鼻（上を向いた豚鼻）と、口の両端から下に出る白い牙
  lit(0, hc[1] - 0.005, hc[2] + hr[2] + 0.035, 'n', 1, 1.3, SKIN, 'head');
  for (const sd of [-1, 1]) lit(sd * 0.025, hc[1] - 0.06, hc[2] + hr[2] + 0.01, 'v', 0.8, 1.6, BAT.fang, 'head');
  // 3. 耳：頭の上から高くとがる三角。縁は毛の色、内は桃色
  for (const sd of [-1, 1]) {
    const b0: Vec3 = [sd * 0.025, hc[1] + hr[1] * 0.85, hc[2] + 0.01],
      b1: Vec3 = [sd * 0.09, hc[1] + hr[1] * 0.5, hc[2] - 0.01],
      tip: Vec3 = [sd * 0.12, hc[1] + 0.25, hc[2] - 0.02],
      rows = 5;
    for (let i = 0; i <= rows; i++) {
      const f = i / rows,
        a: Vec3 = [b0[0] + (tip[0] - b0[0]) * f, b0[1] + (tip[1] - b0[1]) * f, b0[2] + (tip[2] - b0[2]) * f],
        b: Vec3 = [b1[0] + (tip[0] - b1[0]) * f, b1[1] + (tip[1] - b1[1]) * f, b1[2] + (tip[2] - b1[2]) * f],
        w = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = Math.max(1, Math.round(w / (S * 0.7)));
      // 最後の行は耳の先の1点だけ
      for (let j = 0; j <= (i === rows ? 0 : n); j++) {
        const g = j / n,
          edge = j === 0 || j === n || i === rows;
        lit(
          a[0] + (b[0] - a[0]) * g,
          a[1] + (b[1] - a[1]) * g,
          a[2] + (b[2] - a[2]) * g + (edge ? 0 : 0.012),
          edge ? (i === rows ? '^' : sd < 0 ? '/' : '\\') : '%',
          1,
          edge ? 1.2 : 1.1,
          edge ? FURC : EAR,
          'head',
        );
      }
    }
  }
  // 4. 後ろ脚：胴の後ろの下から後ろへ伸び、先に鉤爪。脚の間に尾の膜
  for (const sd of [-1, 1]) {
    const hip: Vec3 = [sd * 0.06, -0.06, -0.14],
      foot: Vec3 = [sd * 0.09, -0.09, -0.3];
    const n = 3;
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      lit(hip[0] + (foot[0] - hip[0]) * f, hip[1] + (foot[1] - hip[1]) * f, hip[2] + (foot[2] - hip[2]) * f, '|', 1, 1.0, SKIN, 'body');
    }
    for (const dx of [-0.02, 0.02]) lit(foot[0] + dx, foot[1] - 0.02, foot[2] - 0.03, 'v', 0.8, 1.3, BONE, 'body');
  }
  // 尾の膜：両足の先から後ろの尖りへ細くなる三角。縁は翼と同じ色
  for (let i = 0; i <= 3; i++) {
    const f = i / 3,
      z = -0.24 - 0.16 * f,
      w = 0.09 * (1 - f),
      n = Math.round((2 * w) / (S * 0.7));
    for (let j = 0; j <= n; j++) {
      const edge = j === 0 || j === n;
      lit(n ? -w + (2 * w * j) / n : 0, -0.09 - 0.02 * f, z, '%', 1, edge ? 1.1 : 0.85, edge ? EDGE : MEM, 'body');
    }
  }
  // 5. 翼：腕の骨（肩 → 手首）、手首から指の骨4本、骨の間に膜、後ろの縁は指の先の間で内へ弧を描く
  type P2 = readonly [number, number];
  // 翼の面は、後ろほど低く傾ける（前から見ても膜の面と後ろの縁の弧が見える。傾けないと、前からは1本の線になる）
  const WY = BAT.wingY,
    TILT = BAT.wingTilt,
    sh: P2 = [BAT.wingRoot, 0.03],
    el: P2 = [0.26, 0.11],
    wr: P2 = [0.44, 0.13],
    tips: readonly P2[] = [
      [0.72, 0.05],
      [0.76, -0.2],
      [0.62, -0.37],
      [0.38, -0.35],
    ],
    root: P2 = [BAT.wingRoot, -0.2];
  const tip = (i: number): P2 => nth(tips, i);
  for (const sd of [-1, 1]) {
    const W = (r: number, z: number, ch: string, b: number, col: Color, s2 = 1, dy = 0) =>
      lit(0, WY + TILT * z + dy, z, ch, s2, b, col, 'wing', { sd, r });
    // 骨の線（from が 1 なら、始めの点を描かない。関節の点を、ほかの骨と重ねて描かないように）
    const bone = (a: P2, b2: P2, ch: string, s2: number, from = 0) => {
      const n = Math.max(2, Math.round(Math.hypot(b2[0] - a[0], b2[1] - a[1]) / (S * 0.7)));
      for (let k = from; k <= n; k++) {
        const f = k / n;
        W(a[0] + (b2[0] - a[0]) * f, a[1] + (b2[1] - a[1]) * f, ch, 0.95, BONE, s2);
      }
    };
    bone(sh, el, '-', 1);
    bone(el, wr, '-', 1, 1);
    for (const tp of tips) bone(wr, tp, '-', 0.85, 1);
    // 膜：三角ごとに埋める。真ん中ほど少し下がる（平らな面が目の高さで1本の線に重ならないように）。
    // 後ろの縁になる三角（4つ目の値が真）は、辺 B-C が A の方へ弧を描いてへこむ（へこみの外は描かず、弧の上に縁を置く）。
    // 指の間の膜は、隣どうしで色の濃さを変える（膜を正面から見た時に、境の指の骨が読めるように）
    const tris: readonly (readonly [P2, P2, P2, boolean, Color])[] = [
      [wr, tip(0), tip(1), true, MEM],
      [wr, tip(1), tip(2), true, MEM_D],
      [wr, tip(2), tip(3), true, MEM],
      [sh, wr, tip(3), false, MEM_D],
      [sh, tip(3), root, true, MEM_D],
      [sh, el, wr, false, MEM],
    ];
    for (const [A, B, C, trailing, mc] of tris) {
      const st = S * 0.72,
        // 辺 B-C の上の f の所の、へこみの深さ
        bow = (f: number) => (trailing ? 0.22 * Math.hypot(C[0] - B[0], C[1] - B[1]) * Math.sin(Math.PI * f) : 0),
        nu = Math.max(2, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / st)),
        nv = Math.max(2, Math.round(Math.hypot(C[0] - A[0], C[1] - A[1]) / st));
      for (let i = 1; i < nu; i++)
        for (let j = 1; j < nv; j++) {
          const u = i / nu,
            v = j / nv,
            sum = u + v,
            f = v / sum,
            // A から、辺 B-C の上の f の所までの長さ
            L = Math.hypot(B[0] + (C[0] - B[0]) * f - A[0], B[1] + (C[1] - B[1]) * f - A[1]);
          // 縁の手前と、へこみの外は描かない
          if (sum >= 0.92 || 1 - sum < bow(f) / L + (trailing ? 0.06 : 0)) continue;
          const r = A[0] + (B[0] - A[0]) * u + (C[0] - A[0]) * v,
            z = A[1] + (B[1] - A[1]) * u + (C[1] - A[1]) * v;
          W(r, z, mpick(['%', '#', '%', '&']), 0.45 + 0.1 * mr(), mc, 1, -0.05 * 4 * u * v);
        }
      if (!trailing) continue;
      const n = Math.max(2, Math.round(Math.hypot(C[0] - B[0], C[1] - B[1]) / (S * 0.7)));
      for (let k = 1; k < n; k++) {
        const f = k / n,
          r = B[0] + (C[0] - B[0]) * f,
          z = B[1] + (C[1] - B[1]) * f,
          dr = A[0] - r,
          dz = A[1] - z,
          dl = Math.hypot(dr, dz) || 1;
        W(r + (dr / dl) * bow(f), z + (dz / dl) * bow(f), '~', 1.15, EDGE);
      }
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

// ---- 死者の体
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

/** ゴブリンの呪術師の衣（頭巾の下から裾まで）の形。f は裾 0 から肩 1。体の点と、縁取り・背中の印・帯は、この同じ式から置く */
export const CONJ_ROBE = {
  y0: 0.04,
  y1: 1.1,
  /** 横の半径：裾は広く、肩へ細くなる */
  rx: (f: number): number => 0.2 + 0.2 * Math.pow(1 - f, 1.8),
  /** 奥行きの半径：背中は丸く盛り上がる（猫背） */
  rz: (f: number, back: boolean): number => (0.17 + 0.17 * Math.pow(1 - f, 1.8)) * (back ? 1 + 0.45 * Math.sin(f * Math.PI * 0.85) : 1),
  /** 前へ出る量：上ほど前に屈む */
  z: (f: number): number => 0.2 * f * f,
  /** 裾の襞（下の方だけ。半径に掛ける） */
  fold: (f: number, a: number): number => 1 + 0.16 * Math.max(0, 0.45 - f) * Math.cos(9 * a),
};
/** 衣の表面の点（f と、まわりの角 a。a が PI/2 で真正面）。法線も返す */
export function conjRobeAt(f: number, a: number): { x: number; y: number; z: number; nx: number; ny: number; nz: number } {
  const R = CONJ_ROBE,
    c = Math.cos(a),
    s = Math.sin(a),
    k = R.fold(f, a),
    rx = R.rx(f) * k,
    rz = R.rz(f, s < 0) * k;
  // 半径が上へ細くなる分、面は少し上を向く
  return { x: c * rx, y: R.y0 + (R.y1 - R.y0) * f, z: s * rz + R.z(f), nx: c / rx, ny: 0.35 * (1 - f) + 0.1, nz: s / rz };
}

export function conjurerForm(ty: BodyType): Body {
  // 小さな体なので、点を細かくする（文字の大きさを決める scale を、1.25 より小さくしない）
  const { S, pts, put, lit, stroke, ell, tube } = q3({ scale: Math.max(ty.scale, 1.25) }),
    ROBE: Color = [0.52, 0.27, 0.88],
    ROBE_IN: Color = [0.24, 0.16, 0.36],
    TRIM: Color = [0.88, 0.72, 0.42],
    EDGE: Color = [0.68, 0.55, 0.9],
    SKN: Color = [0.5, 0.78, 0.32],
    EYE: Color = [1.0, 0.85, 0.3],
    WOOD: Color = [0.46, 0.32, 0.2],
    BONE_C: Color = [0.88, 0.84, 0.7],
    GLOW: Color = [0.82, 0.55, 1.0],
    CLOTH: Ramp = ['.', ':', ';', '|', '#'],
    R = CONJ_ROBE,
    st = S * 0.85;
  // 腕は肩（高さ 1.04・奥行き 0.14）を、足は腰（高さ 0.62）を軸に回る
  const SHOULDER = { piv: 1.04, pz: 0.14 },
    HIP = { piv: 0.62, pz: 0.05 };
  const ellAt = (ex: Extra, ...a: Parameters<typeof ell>): void => {
    const n0 = pts.length;
    ell(...a);
    for (let i = n0; i < pts.length; i++) Object.assign(nth(pts, i), ex);
  };
  // 衣：裾から肩まで、行の数を決めて等しい間隔で割る（最後の行が肩に来る）
  const nr = Math.max(1, Math.round((R.y1 - R.y0) / st));
  for (let j = 0; j <= nr; j++) {
    const f = j / nr,
      n = Math.max(8, Math.round((2 * Math.PI * Math.max(R.rx(f), R.rz(f, true))) / st));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + j * 0.37,
        p = conjRobeAt(f, a);
      put(p.x, p.y, p.z, p.nx, p.ny, p.nz, CLOTH, ROBE);
    }
  }
  // 肩の上の面（頭巾の下に、首のまわりの肩を張る。少し盛り上げる）
  for (let q = 0.75; q > 0.2; q -= 0.27) {
    const n = Math.max(6, Math.round((2 * Math.PI * R.rx(1) * q) / st));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + q * 2,
        c = Math.cos(a),
        s = Math.sin(a);
      put(c * R.rx(1) * q, R.y1 + 0.05 * (1 - q * q), s * R.rz(1, s < 0) * q + R.z(1), c * q, 1, s * q, CLOTH, ROBE);
    }
  }
  // 縁取り：裾の輪（表面のすぐ外）
  const OUT = 0.025;
  const onRobe = (f: number, a: number, ch: string, s: number, b: number, col: Color): void => {
    const p = conjRobeAt(f, a),
      l = Math.hypot(p.nx, p.nz) || 1;
    lit(p.x + (p.nx / l) * OUT, p.y, p.z + (p.nz / l) * OUT, ch, s, b, col);
  };
  {
    const n = Math.round((2 * Math.PI * R.rx(0)) / (st * 0.8));
    for (let k = 0; k < n; k++) onRobe(0.02, (k / n) * Math.PI * 2, '=', 0.85, 1.0, TRIM);
  }
  // 帯（腰）と、前に垂れる結び目、ぶら下がった骨のお守り
  const FW = (0.62 - R.y0) / (R.y1 - R.y0);
  {
    const n = Math.round((2 * Math.PI * R.rx(FW)) / (st * 0.75));
    for (let k = 0; k < n; k++) onRobe(FW, (k / n) * Math.PI * 2, '-', 0.9, 1.15, TRIM);
  }
  for (const [da, len] of [
    [-0.35, 3],
    [0.3, 2],
    [0.55, 3],
  ] as const) {
    const a = Math.PI / 2 + da;
    for (let q = 1; q <= len; q++) onRobe(FW - (q * 0.05) / (R.y1 - R.y0), a, q === len ? 'o' : ':', 0.8, q === len ? 1.4 : 1.0, BONE_C);
  }
  // 背中の印：円の中に目（光の当たらない背中でも見えるように、明るさを決めて置く）
  {
    const cy = 0.8,
      rr = 0.11,
      at = (x: number, y: number, ch: string, s: number, b: number): void => {
        const f = (y - R.y0) / (R.y1 - R.y0),
          rx = R.rx(f),
          c = clamp(x / rx, -1, 1),
          a = -Math.acos(c);
        onRobe(f, a, ch, s, b, GLOW);
      };
    for (let k = 0; k < 14; k++) {
      const t = (k / 14) * Math.PI * 2;
      at(Math.cos(t) * rr, cy + Math.sin(t) * rr, strokeCh(-Math.sin(t), Math.cos(t)), 0.75, 1.35);
    }
    at(-0.05, cy, '<', 0.75, 1.3);
    at(0, cy, 'o', 0.8, 1.6);
    at(0.05, cy, '>', 0.75, 1.3);
  }
  // 頭巾：頭を包み、前の開きから顔が見える。先は長く、後ろへ垂れる
  const HC = [0, 1.38, 0.3] as const,
    HR = 0.28;
  ell(
    HC,
    HR,
    HR * 1.05,
    HR,
    CLOTH,
    () => ROBE,
    'head',
    null,
    (_nx, ny, nz) => nz > 0.3 || ny < -0.75,
  );
  tube([0, 1.6, 0.22], [0, 1.76, 0.04], 0.16, 0.1, CLOTH, ROBE, 'head');
  tube([0, 1.76, 0.04], [0, 1.8, -0.22], 0.1, 0.06, CLOTH, ROBE, 'head');
  tube([0, 1.8, -0.22], [0, 1.72, -0.4], 0.06, 0.03, CLOTH, ROBE, 'head');
  lit(0, 1.69, -0.45, 'o', 0.8, 1.3, TRIM, 'head');
  // 頭巾の開きの縁取り
  for (let k = 0; k < 16; k++) {
    const t = (k / 16) * Math.PI * 2,
      q = Math.sqrt(1 - 0.32 * 0.32),
      nx = Math.cos(t) * q,
      ny = Math.sin(t) * q;
    if (ny < -0.75) continue;
    lit(
      HC[0] + nx * HR * 1.04,
      HC[1] + ny * HR * 1.09,
      HC[2] + 0.32 * HR * 1.04,
      strokeCh(-Math.sin(t), Math.cos(t)),
      0.8,
      1.1,
      EDGE,
      'head',
    );
  }
  // 頭巾の中の暗がり（顔の後ろ。開きから奥が透けないように）
  for (let k = 0; k < 9; k++) {
    const t = (k / 9) * Math.PI * 2;
    lit(HC[0] + Math.cos(t) * 0.12, HC[1] + Math.sin(t) * 0.13, HC[2] - 0.02, '#', 1, 0.5, ROBE_IN, 'head');
  }
  // 顔：頭巾の開きから前へ出る。光る黄色い目、怒った眉、長い鼻、牙
  const FC = [0, 1.33, 0.4] as const,
    FR = [0.18, 0.16, 0.11] as const;
  ell(
    FC,
    FR[0],
    FR[1],
    FR[2],
    SKINR,
    () => SKN,
    'head',
    null,
    (_nx, _ny, nz) => nz < 0.1,
  );
  const face = (x: number, y: number, dz: number): number =>
    FC[2] + FR[2] * Math.sqrt(Math.max(0, 1 - (x / FR[0]) ** 2 - ((y - FC[1]) / FR[1]) ** 2)) + dz;
  for (const sd of [-1, 1]) {
    lit(sd * 0.07, 1.37, face(sd * 0.07, 1.37, 0.03), 'o', 0.65, 1.8, EYE, 'head');
    lit(sd * 0.075, 1.43, face(sd * 0.075, 1.43, 0.03), sd < 0 ? '\\' : '/', 0.75, 1.1, [0.3, 0.18, 0.12], 'head');
    lit(sd * 0.05, 1.24, face(sd * 0.05, 1.24, 0.03), 'v', 0.6, 1.3, BONE_C, 'head');
  }
  stroke([0, 1.35, face(0, 1.35, 0.02)], [0, 1.27, 0.66], SKN, 1.35, 0.85, 'head');
  // 長い耳：頭巾の横から突き出る（上と下の縁を、先で合わせる）
  for (const sd of [-1, 1]) {
    const tip = [sd * 0.6, 1.5, 0.24] as const;
    stroke([sd * 0.27, 1.43, 0.32], tip, SKN, 1.3, 0.85, 'head');
    stroke([sd * 0.27, 1.31, 0.32], tip, SKN, 1.15, 0.85, 'head');
    lit(tip[0] + sd * 0.03, tip[1] + 0.01, tip[2], sd < 0 ? '<' : '>', 0.9, 1.3, SKN, 'head');
  }
  // 右腕：広がる袖と、杖を握る手
  const RH = [0.34, 0.74, 0.34] as const;
  tube([0.19, 1.04, 0.16], [0.31, 0.82, 0.3], 0.08, 0.12, CLOTH, ROBE, 'armR', SHOULDER);
  for (let k = 0; k < 10; k++) {
    const t = (k / 10) * Math.PI * 2;
    lit(0.31 + Math.cos(t) * 0.12, 0.82 + Math.sin(t) * 0.05, 0.3 + Math.sin(t) * 0.11, '=', 0.8, 1.1, EDGE, 'armR', SHOULDER);
  }
  ellAt(SHOULDER, RH, 0.06, 0.06, 0.06, SKINR, () => SKN, 'armR');
  // 杖：曲がった木。先は二股の鉤爪で、紫の石をつかむ
  const SX = RH[0] + 0.02,
    SZ = RH[2] + 0.02,
    TOP = 1.62;
  {
    const n = Math.round((TOP - 0.02) / (st * 0.7));
    for (let j = 0; j <= n; j++) {
      const y = 0.02 + ((TOP - 0.02) * j) / n,
        w = 0.015 * Math.sin(y * 9);
      lit(SX + w, y, SZ, j % 4 === 2 ? (w > 0 ? ')' : '(') : '|', 0.85, 0.95, WOOD, 'armR', SHOULDER);
    }
  }
  for (const sd of [-1, 1]) {
    stroke([SX, TOP, SZ], [SX + sd * 0.09, TOP + 0.1, SZ], WOOD, 1.1, 0.8, 'armR', SHOULDER);
    stroke([SX + sd * 0.09, TOP + 0.1, SZ], [SX + sd * 0.05, TOP + 0.22, SZ], WOOD, 1.1, 0.8, 'armR', SHOULDER);
  }
  lit(SX, TOP + 0.13, SZ, '*', 0.9, 1.6, GLOW, 'armR', SHOULDER);
  for (const [dx, dy, ch] of [
    [0, 0.07, '^'],
    [0, -0.06, 'v'],
    [-0.045, 0, '<'],
    [0.045, 0, '>'],
  ] as const)
    lit(SX + dx, TOP + 0.13 + dy, SZ, ch, 0.7, 1.5, GLOW, 'armR', SHOULDER);
  // 左腕：前へ差し出した手。指を開き、手のひらの上に小さな光
  const LH = [-0.31, 0.98, 0.5] as const;
  tube([-0.19, 1.04, 0.16], [-0.29, 0.98, 0.42], 0.08, 0.12, CLOTH, ROBE, 'armL', SHOULDER);
  for (let k = 0; k < 10; k++) {
    const t = (k / 10) * Math.PI * 2;
    lit(-0.29 + Math.cos(t) * 0.12, 0.98 + Math.sin(t) * 0.12, 0.43, strokeCh(-Math.sin(t), Math.cos(t)), 0.8, 1.1, EDGE, 'armL', SHOULDER);
  }
  ellAt(SHOULDER, LH, 0.055, 0.05, 0.05, SKINR, () => SKN, 'armL');
  for (const dx of [-0.05, 0, 0.05])
    stroke([LH[0] + dx * 0.6, LH[1] + 0.04, LH[2] + 0.02], [LH[0] + dx, LH[1] + 0.13, LH[2] + 0.05], SKN, 1.0, 0.7, 'armL', SHOULDER);
  lit(LH[0], LH[1] + 0.24, LH[2] + 0.06, 'o', 0.75, 1.4, GLOW, 'armL', SHOULDER);
  // 足：裾の前から、とがった爪先がのぞく
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'legL' : 'legR';
    ellAt(
      HIP,
      [sd * 0.12, 0.05, 0.36],
      0.065,
      0.045,
      0.1,
      SKINR,
      () => SKN,
      part,
      null,
      (_nx, ny) => ny < -0.5,
    );
    lit(sd * 0.13, 0.05, 0.48, '^', 0.7, 1.2, SKN, part, HIP);
  }
  return pts;
}

/** スナップジョーの胴（腰から肩まで）の形。f は腰 0 から肩 1。胴の点と、たてがみ・腰布・首飾りは、この同じ式から置く */
export const SNAP_TORSO = {
  y0: 0.66,
  y1: 1.26,
  /** 横の半径：腰は細く、肩は広い */
  rx: (f: number): number => 0.15 + 0.11 * Math.sin(Math.min(1, f / 0.85) * Math.PI * 0.5),
  /** 奥行きの半径：胸は薄く、背中は肩の下で盛り上がる（ハイエナの背のように、肩が高く腰が低い） */
  rz: (f: number, back: boolean): number => (back ? 0.13 + 0.07 * Math.sin(f * Math.PI * 0.85) : 0.12 + 0.03 * f),
  /** 前へ出る量：上ほど前に屈む（猫背） */
  z: (f: number): number => 0.24 * f * f,
};
/** 胴の表面の点（f と、まわりの角 a。a が PI/2 で真正面）。法線も返す */
export function snapTorsoAt(f: number, a: number): { x: number; y: number; z: number; nx: number; ny: number; nz: number } {
  const T = SNAP_TORSO,
    c = Math.cos(a),
    s = Math.sin(a),
    rx = T.rx(f),
    rz = T.rz(f, s < 0);
  // 前に屈む分、背中は上を向く
  return { x: c * rx, y: T.y0 + (T.y1 - T.y0) * f, z: s * rz + T.z(f), nx: c / rx, ny: 0.15 + (s < 0 ? 0.55 * f : 0.1), nz: s / rz };
}
/** スナップジョーのたてがみの線（高さ y と奥行き z の組。頭の後ろから、首の上・肩の上を通って、背の真ん中まで） */
export const SNAP_MANE: readonly (readonly [number, number])[] = [
  [1.48, 0.47],
  [1.42, 0.33],
  [1.36, 0.19],
  [1.27, 0.08],
  [1.1, -0.07],
  [0.98, -0.13],
];
/** スナップジョーの頭（楕円）の真ん中 c と半径 r。頭の点と、目・耳の位置を、同じ式から出す */
export const SNAP_HEAD = { c: [0, 1.37, 0.55], r: [0.13, 0.12, 0.13] } as const satisfies { c: Vec3; r: Vec3 };
/** スナップジョーの色（毛の色は種類の色 ty.col）。部分ごとに、毛と色みか明るさがはっきり違う色にする（似た茶色ばかりだと、体が一つの塊に見える） */
export const SNAP_COL = {
  /** たてがみ・首の襟・鼻づら・耳・前腕・すね・足・尾の先・棍棒：黒に近い灰（茶の色みを抜き、毛と明るさで分ける） */
  dark: [0.16, 0.14, 0.16],
  /** 腰布：赤（部族の色。見張りも同じ。毛と色みで分け、胴と脚の間に帯を入れる） */
  cloth: [0.8, 0.18, 0.12],
  /** 牙・爪・首飾り（光のにじみで白い塊にならないように、少しくすませる） */
  bone: [0.78, 0.72, 0.58],
  /** 槍の柄：くすんだ木の色（毛より暗く、たてがみより明るい。暗い灰だと、歩いて胴の前に振れた時に、たてがみや腕に溶けて穂だけが浮いて見える） */
  wood: [0.46, 0.36, 0.26],
  /** 槍の穂：石の灰色 */
  stone: [0.6, 0.64, 0.7],
  /** 目：琥珀 */
  eye: [1, 0.72, 0.25],
} as const satisfies Record<string, Color>;

// snapjaw: a hyena-headed beast-man. Hunched: high shoulders with a dark mane down the neck and back, a low waist,
// tawny fur. A long dark muzzle with the jaw hanging open over its teeth, round ears, long arms ending in claws,
// and beast legs bent back at the hock. A wooden club; the sentry carries a spear instead, and a necklace of teeth
export function snapjawForm(ty: BodyType, sentry: boolean): Body {
  // 人ほどの体なので、点を細かくする（文字の大きさを決める scale を、種類の 1.6 倍にする）
  const { S, pts, put, lit, stroke, ell, tube } = q3({ scale: ty.scale * 1.6 }),
    FURC = ty.col,
    C = SNAP_COL,
    T = SNAP_TORSO,
    HAIR: Ramp = ['.', ':', '"', '%', '#'];
  // 腕は肩（高さ 1.2・奥行き 0.22）を、脚は腰（高さ 0.72）を軸に回る
  const SHOULDER = { piv: 1.2, pz: 0.22 },
    HIP = { piv: 0.72, pz: 0 };
  const ellAt = (ex: Extra, ...a: Parameters<typeof ell>): void => {
    const n0 = pts.length;
    ell(...a);
    for (let i = n0; i < pts.length; i++) Object.assign(nth(pts, i), ex);
  };
  // 脚：太ももは前へ、すねは後ろへ、かかとから先の長い足（獣の脚）
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'legL' : 'legR';
    tube([sd * 0.12, 0.72, 0], [sd * 0.18, 0.46, 0.12], 0.1, 0.07, HAIR, FURC, part, HIP, 0.15);
    tube([sd * 0.18, 0.46, 0.12], [sd * 0.17, 0.2, -0.05], 0.065, 0.045, HAIR, C.dark, part, HIP);
    tube([sd * 0.17, 0.2, -0.05], [sd * 0.17, 0.05, 0.1], 0.045, 0.04, HAIR, C.dark, part, HIP);
    for (const o of [-1, 0, 1]) lit(sd * 0.17 + o * 0.035, 0.02, 0.16, 'v', 0.8, 0.85, C.bone, part, HIP);
  }
  // 胴：行の数を決めて、腰から肩まで等しい間隔で置く
  {
    const st = S * 0.85,
      nr = Math.max(2, Math.round((T.y1 - T.y0) / st));
    for (let j = 0; j <= nr; j++) {
      const f = j / nr,
        n = Math.max(8, Math.round((2 * Math.PI * Math.max(T.rx(f), T.rz(f, true))) / st));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + j * 0.4,
          p = snapTorsoAt(f, a);
        put(p.x, p.y, p.z, p.nx, p.ny, p.nz, HAIR, FURC);
      }
    }
  }
  // 肩の上：丸く盛り上がる（上から見て、胴の中が透けないように）
  ell(
    [0, T.y1, T.z(1) - 0.01],
    T.rx(1) * 0.95,
    0.08,
    T.rz(1, true) * 0.95,
    HAIR,
    () => FURC,
    'body',
    null,
    (_x, ny) => ny < 0,
  );
  // 首：肩の前から頭へ、前に突き出る
  const H = SNAP_HEAD,
    hy = H.c[1],
    hz = H.c[2];
  tube([0, 1.22, 0.3], [0, hy - 0.05, hz - 0.06], 0.1, 0.085, HAIR, FURC, 'head');
  // 首の根もとの、暗い毛の襟（明るい頭と胴を分ける）
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    lit(Math.cos(a) * 0.15, 1.27 + 0.03 * Math.sin(a), 0.31 + Math.sin(a) * 0.12, '%', 1.1, 1.0, C.dark, 'head');
  }
  // 頭：幅の広い頭と、長く太い暗い鼻づら（暗い色 C.dark）。下あごは開いて垂れ、牙が見える
  ell(H.c, H.r[0], H.r[1], H.r[2], HAIR, () => FURC, 'head');
  tube([0, hy - 0.01, hz + 0.1], [0, hy - 0.07, hz + 0.3], 0.08, 0.055, HAIR, C.dark, 'head');
  tube([0, hy - 0.07, hz + 0.3], [0, hy - 0.08, hz + 0.38], 0.055, 0.045, HAIR, C.dark, 'head');
  lit(0, hy - 0.06, hz + 0.42, 'o', 0.7, 0.9, C.dark, 'head');
  tube([0, hy - 0.12, hz + 0.06], [0, hy - 0.24, hz + 0.26], 0.05, 0.035, HAIR, C.dark, 'head');
  // 牙：上あごの下の縁と、下あごの上の縁
  for (const o of [-1, 1]) {
    lit(o * 0.035, hy - 0.11, hz + 0.18, 'v', 0.7, 0.9, C.bone, 'head');
    lit(o * 0.03, hy - 0.125, hz + 0.26, 'v', 0.7, 0.9, C.bone, 'head');
    lit(o * 0.03, hy - 0.12, hz + 0.14, '^', 0.7, 0.85, C.bone, 'head');
    lit(o * 0.025, hy - 0.17, hz + 0.22, '^', 0.7, 0.85, C.bone, 'head');
  }
  // 目：頭の表面の、少し前と上（表面のすぐ外）
  for (const sd of [-1, 1]) {
    // 鼻づらの根もと（真ん中の前）に隠れないように、少し外と上
    const nx = sd * 0.62,
      ny = 0.45,
      nz = Math.sqrt(1 - nx * nx - ny * ny);
    lit(H.c[0] + nx * H.r[0] * 1.08, hy + ny * H.r[1] * 1.08, hz + nz * H.r[2] * 1.08, '.', 1, 1.4, C.eye, 'head');
  }
  // 丸い耳：頭の上の左右に立つ。暗い色（明るい頭の上で、耳の形が見える）
  for (const sd of [-1, 1]) lit(sd * 0.11, hy + 0.15, hz - 0.05, 'n', 1.1, 1.2, C.dark, 'head');
  // たてがみ：頭の後ろから、首の上と肩の上を通って、背の真ん中まで（SNAP_MANE の線）。線から上と後ろへ立てる
  for (let i = 0; i + 1 < SNAP_MANE.length; i++) {
    const a = nth(SNAP_MANE, i),
      b = nth(SNAP_MANE, i + 1),
      dy = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dy, dz),
      // 線に直角で、外（上か後ろ）を向く向き
      oy = -dz / L,
      oz = dy / L,
      n = Math.max(1, Math.round(L / (S * 0.55)));
    for (let k = 0; k < n; k++) {
      const t = k / n,
        y = a[0] + dy * t,
        z = a[1] + dz * t,
        part = i < 2 ? 'head' : 'body';
      for (const o of [-0.035, 0.035]) {
        lit(o, y + oy * 0.02, z + oz * 0.02, '#', 1, 0.95, C.dark, part);
        lit(o * 0.5, y + oy * 0.08, z + oz * 0.08, '"', 1, 1.0, C.dark, part);
      }
    }
  }
  // 腰布：腰のまわりの帯と、前に垂れる布（胴と脚の間に、毛と違う色の帯を入れる）
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2,
      p = snapTorsoAt(0.05, a);
    lit(p.x * 1.12, p.y, p.z * 1.12, '=', 1, 1.0, C.cloth);
  }
  // 前に垂れる布：行の数を決めて、0.62 から 0.44 まで等しい間隔で置く（最後の行が下の端に来る）
  {
    const nr = Math.max(1, Math.round((0.62 - 0.44) / (S * 0.7)));
    for (let j = 0; j <= nr; j++) {
      const y = 0.62 - (0.18 * j) / nr;
      for (const x of [-0.06, 0, 0.06]) lit(x, y, T.rz(0, false) + 0.03 + (0.66 - y) * 0.2, '#', 1, 0.9, C.cloth);
    }
  }
  // 短い尾（毛の房）
  for (let k = 0; k < 4; k++) {
    const f = k / 3;
    lit(0, 0.66 - 0.12 * f, -0.17 - 0.09 * f, k > 1 ? '%' : '"', 1, 1.0, k > 1 ? C.dark : FURC, 'tail', { piv: k * 0.3 });
  }
  // 腕：長く、手は腰の下まで。爪
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'armL' : 'armR';
    tube([sd * 0.28, 1.2, 0.22], [sd * 0.38, 0.95, 0.3], 0.08, 0.06, HAIR, FURC, part, SHOULDER, 0.1);
    tube([sd * 0.38, 0.95, 0.3], [sd * 0.35, 0.7, 0.42], 0.06, 0.05, HAIR, C.dark, part, SHOULDER);
    ellAt(SHOULDER, [sd * 0.35, 0.66, 0.44], 0.06, 0.06, 0.06, HAIR, () => C.dark, part);
    for (const o of [-1, 0, 1]) lit(sd * 0.35 + o * 0.03, 0.58, 0.47, '|', 0.7, 0.85, C.bone, part, SHOULDER);
  }
  if (!sentry) {
    // 木の棍棒：右手に握り、先は前の下へ（暗い色 C.dark。明るい色だと、体より棒が目立つ）
    tube([0.35, 0.68, 0.46], [0.38, 0.34, 0.74], 0.03, 0.035, HAIR, C.dark, 'armR', SHOULDER);
    ellAt(SHOULDER, [0.385, 0.3, 0.77], 0.07, 0.06, 0.07, HAIR, () => C.dark, 'armR');
  } else {
    // 槍：右手（0.35, 0.66, 0.44）を通る線で、先を後ろへ傾けて肩に寄せて持つ（高さ 1 につき奥行き 0.25）。石の穂。
    // 槍は肩を軸に腕と一緒に振れ、手が後ろへ振れると肩より上は前へ倒れる。まっすぐ立てると、その時に柄が前かがみの頭と鼻づらに重なって消え、穂だけが浮いて見える
    const spearAt = (t: number): Vec3 => [0.35, 0.66 + t, 0.44 - 0.25 * t];
    stroke(spearAt(-0.24), spearAt(0.96), C.wood, 1.0, 0.9, 'armR', SHOULDER);
    lit(...spearAt(1.02), 'A', 1, 1.2, C.stone, 'armR', SHOULDER);
    lit(...spearAt(1.1), '^', 1, 1.3, C.stone, 'armR', SHOULDER);
    // 牙の首飾り：首の根もとの前に
    for (let k = 0; k < 7; k++) {
      const a = Math.PI * (0.2 + (0.6 * k) / 6),
        p = snapTorsoAt(1, a);
      lit(p.x * 0.85, p.y - 0.03, p.z + 0.03, 'v', 0.8, 1.2, C.bone);
    }
  }
  // 小さな体は明るく描かれ（1.4 倍）、照準の先ではさらに明るくなる。灯りの近くで白い塊にならないように、目のほかは暗めにする。
  // 一番明るい毛（胴・頭・上腕・太もも）は、さらに暗めにする（自分の灯りと部屋の灯りが重なると、毛だけが白くにじむ）
  for (const p of pts) if (p.col !== C.eye) p.b *= p.col === FURC ? 0.6 : 0.75;
  return pts;
}

/** ゴブリンの胴（腰から肩まで）の形。f は腰 0 から肩 1。胴の点と、上着の裾・帯・襟巻きは、この同じ式から置く */
export const GOB_TORSO = {
  y0: 0.56,
  y1: 1.0,
  /** 横の半径：肩は狭く、腹はふくらむ */
  rx: (f: number): number => 0.15 + 0.04 * Math.sin(Math.min(1, f / 0.7) * Math.PI * 0.5) - (0.03 * Math.max(0, f - 0.7)) / 0.3,
  /** 奥行きの半径：腹が前へ出て（太鼓腹）、背中は肩の下で丸く盛り上がる（猫背） */
  rz: (f: number, back: boolean): number =>
    back ? 0.12 + 0.06 * Math.sin(f * Math.PI * 0.9) : 0.13 + 0.05 * Math.sin(Math.min(1, f / 0.7) * Math.PI),
  /** 前へ出る量：上ほど前に屈む */
  z: (f: number): number => 0.2 * f * f,
};
/** 胴の表面の点（f と、まわりの角 a。a が PI/2 で真正面）。法線も返す */
export function gobTorsoAt(f: number, a: number): { x: number; y: number; z: number; nx: number; ny: number; nz: number } {
  const T = GOB_TORSO,
    c = Math.cos(a),
    s = Math.sin(a),
    rx = T.rx(f),
    rz = T.rz(f, s < 0);
  return { x: c * rx, y: T.y0 + (T.y1 - T.y0) * f, z: s * rz + T.z(f), nx: c / rx, ny: 0.15 + (s < 0 ? 0.5 * f : 0.05), nz: s / rz };
}
/** ゴブリンの頭（楕円）の真ん中 c と半径 r。頭の点と、目・耳・鼻の位置を、同じ式から出す */
export const GOB_HEAD = { c: [0, 1.2, 0.36], r: [0.19, 0.17, 0.17] } as const satisfies { c: Vec3; r: Vec3 };
/** ゴブリンの色。部分ごとに、色みか明るさがはっきり違う色にする */
export const GOB_COL = {
  /** 肌：くすんだ緑 */
  skin: [0.42, 0.62, 0.24],
  /** 目のくぼみと口：暗い緑 */
  shade: [0.12, 0.16, 0.08],
  /** 耳の内側：暗い赤茶 */
  inner: [0.42, 0.2, 0.16],
  /** 上着：暗い革 */
  hide: [0.36, 0.24, 0.15],
  /** 襟巻き：赤（種類の色に合わせる） */
  rag: [0.82, 0.22, 0.12],
  /** 帯の縄 */
  rope: [0.7, 0.6, 0.4],
  /** 牙・爪 */
  bone: [0.78, 0.74, 0.6],
  /** 短刀の刃：錆びた鉄 */
  iron: [0.6, 0.6, 0.62],
  /** 目：黄色 */
  eye: [1, 0.85, 0.25],
} as const satisfies Record<string, Color>;

// goblin: a small, hunched green creature. A big bald head with huge ears sticking out sideways, yellow eyes under a heavy brow,
// a long hooked nose and a wide grin of teeth. A pot belly in a ragged hide tunic tied with a rope, a red rag round the neck,
// thin arms and bent legs with big feet. A rusty knife in the right hand, the left hand open with claws
export function goblinForm(ty: BodyType): Body {
  // 小さな体なので、点を細かくする（文字の大きさを決める scale を、種類の 1.8 倍にする）
  const { S, pts, put, lit, stroke, ell, tube } = q3({ scale: ty.scale * 1.8 }),
    C = GOB_COL,
    T = GOB_TORSO,
    H = GOB_HEAD,
    SKIN: Ramp = [':', ';', '%', '%', '#'],
    HIDE: Ramp = ['.', ':', '=', '%', '#'],
    st = S * 0.85;
  // 腕は肩（高さ 0.96・奥行き 0.18）を、脚は腰（高さ 0.6）を軸に回る
  const SHOULDER = { piv: 0.96, pz: 0.18 },
    HIP = { piv: 0.6, pz: 0 };
  const ellAt = (ex: Extra, ...a: Parameters<typeof ell>): void => {
    const n0 = pts.length;
    ell(...a);
    for (let i = n0; i < pts.length; i++) Object.assign(nth(pts, i), ex);
  };
  // 脚：曲げたひざ（太ももは前へ、すねは後ろへ）と、大きな足
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'legL' : 'legR';
    tube([sd * 0.1, 0.6, 0], [sd * 0.15, 0.34, 0.1], 0.07, 0.05, SKIN, C.skin, part, HIP, 0.15);
    tube([sd * 0.15, 0.34, 0.1], [sd * 0.14, 0.08, -0.02], 0.05, 0.04, SKIN, C.skin, part, HIP);
    ellAt(
      HIP,
      [sd * 0.14, 0.05, 0.06],
      0.06,
      0.045,
      0.12,
      SKIN,
      () => C.skin,
      part,
      st * 0.4,
      (_nx, ny) => ny < -0.5,
    );
    for (const o of [-1, 0, 1]) lit(sd * 0.14 + o * 0.035, 0.03, 0.2, 'v', 0.8, 1.0, C.bone, part, HIP);
  }
  // 胴：行の数を決めて、腰から肩まで等しい間隔で置く。下の 9 割ほどは袖の無い上着、上は肌
  const TUNIC = 0.88;
  {
    const nr = Math.max(2, Math.round((T.y1 - T.y0) / st));
    for (let j = 0; j <= nr; j++) {
      const f = j / nr,
        n = Math.max(8, Math.round((2 * Math.PI * Math.max(T.rx(f), T.rz(f, true))) / st));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + j * 0.4,
          p = gobTorsoAt(f, a);
        if (f < TUNIC) put(p.x, p.y, p.z, p.nx, p.ny, p.nz, HIDE, C.hide);
        else put(p.x, p.y, p.z, p.nx, p.ny, p.nz, SKIN, C.skin);
      }
    }
  }
  // 肩の上：丸く盛り上がる（上から見て、胴の中が透けないように）
  ell(
    [0, T.y1, T.z(1)],
    T.rx(1) * 0.95,
    0.06,
    T.rz(1, true) * 0.95,
    SKIN,
    () => C.skin,
    'body',
    null,
    (_x, ny) => ny < 0,
  );
  // 上着の裾：ぎざぎざに破れて、腰の下へ垂れる（胴の下の端の表面のすぐ外）
  {
    const n = 18;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2,
        p = gobTorsoAt(0, a),
        l = Math.hypot(p.nx, p.nz) || 1,
        drop = k % 2 === 0 ? 0.07 : 0.03;
      for (let q = 1; q <= (k % 2 === 0 ? 2 : 1); q++)
        lit(
          p.x + (p.nx / l) * 0.02,
          p.y - (drop * q) / (k % 2 === 0 ? 2 : 1),
          p.z + (p.nz / l) * 0.02,
          q === 2 ? 'V' : '%',
          1,
          1.0,
          C.hide,
        );
    }
  }
  // 縄の帯（腰の少し上、表面のすぐ外）と、前に下げた結び目
  {
    const f = 0.2,
      n = Math.round((2 * Math.PI * T.rx(f)) / (st * 0.75));
    for (let k = 0; k < n; k++) {
      const p = gobTorsoAt(f, (k / n) * Math.PI * 2),
        l = Math.hypot(p.nx, p.nz) || 1;
      lit(p.x + (p.nx / l) * 0.02, p.y, p.z + (p.nz / l) * 0.02, '~', 0.9, 1.1, C.rope);
    }
    const p = gobTorsoAt(f, Math.PI / 2 + 0.5);
    for (let q = 0; q < 3; q++) lit(p.x + 0.01, p.y - 0.04 - q * 0.05, p.z + 0.03, q === 2 ? 'o' : '|', 0.8, 1.1, C.rope);
  }
  // 襟巻き：首の根もとに巻いた赤い布と、背中へ垂れる端
  {
    const f = 0.97,
      n = 16;
    for (let k = 0; k < n; k++) {
      const p = gobTorsoAt(f, (k / n) * Math.PI * 2),
        l = Math.hypot(p.nx, p.nz) || 1;
      lit(p.x + (p.nx / l) * 0.025, p.y, p.z + (p.nz / l) * 0.025, '#', 1, 1.1, C.rag);
    }
    for (const sd of [-1, 1])
      for (let q = 1; q <= 3; q++) {
        const p = gobTorsoAt(1 - q * 0.09, -Math.PI / 2 + sd * 0.25),
          l = Math.hypot(p.nx, p.nz) || 1;
        lit(p.x + (p.nx / l) * 0.03, p.y, p.z + (p.nz / l) * 0.03, q === 3 ? 'V' : '%', 0.95, 1.1, C.rag);
      }
  }
  // 首：肩の前から頭へ、前に突き出る
  tube([0, 0.98, 0.2], [0, H.c[1] - 0.08, H.c[2] - 0.06], 0.07, 0.065, SKIN, C.skin, 'head');
  // 頭：大きく丸い。あごは前へ細くとがる
  ell(H.c, H.r[0], H.r[1], H.r[2], SKIN, () => C.skin, 'head');
  ell([0, H.c[1] - 0.1, H.c[2] + 0.08], 0.1, 0.06, 0.08, SKIN, () => C.skin, 'head');
  // 頭の表面の点（向き nx, ny から、表面のすぐ外 out）
  const onHead = (nx: number, ny: number, out: number): Vec3 => {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)),
      k = 1 + out;
    return [H.c[0] + nx * H.r[0] * k, H.c[1] + ny * H.r[1] * k, H.c[2] + nz * H.r[2] * k];
  };
  // 張り出した眉と、その下の暗いくぼみの中の黄色い目（くぼみの暗さで、目と顔の形が読める）
  for (const sd of [-1, 1]) {
    for (const o of [0.15, 0.32, 0.5])
      lit(...onHead(sd * o, 0.44, 0.06), sd < 0 ? (o > 0.3 ? '\\' : '-') : o > 0.3 ? '/' : '-', 0.85, 1.2, C.skin, 'head');
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2;
      lit(...onHead(sd * 0.34 + Math.cos(t) * 0.11, 0.2 + Math.sin(t) * 0.1, 0.04), '#', 0.8, 0.8, C.shade, 'head');
    }
    lit(...onHead(sd * 0.34, 0.2, 0.08), 'o', 0.7, 1.3, C.eye, 'head');
  }
  // 長い鉤鼻：眉の間から前へ、先は下へ曲がる。細かい間隔の点の並び（離れると、横から見て鼻の先が顔から浮く）
  {
    const a = onHead(0, 0.22, 0),
      b: Vec3 = [0, a[1] - 0.04, a[2] + 0.15],
      c: Vec3 = [0, a[1] - 0.1, a[2] + 0.15],
      line = (p: Vec3, q: Vec3, ch: string, w: number): void => {
        const n = Math.max(2, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / (S * 0.3)));
        for (let k = 0; k <= n; k++) {
          const f = k / n;
          for (const o of w > 0 ? [-w, w] : [0])
            lit(
              p[0] + (q[0] - p[0]) * f + o * (1 - f * 0.6),
              p[1] + (q[1] - p[1]) * f,
              p[2] + (q[2] - p[2]) * f,
              ch,
              0.85,
              1.2,
              C.skin,
              'head',
            );
        }
      };
    line(a, b, '#', 0.025);
    line(b, c, '%', 0);
  }
  // 大きな口：耳の方まで裂けた笑い（暗い線）。上の縁に牙が並ぶ
  for (let k = 0; k <= 8; k++) {
    const nx = (k / 8 - 0.5) * 1.2,
      ny = -0.32 + 0.22 * nx * nx;
    lit(...onHead(nx, ny, 0.05), '=', 0.8, 0.9, C.shade, 'head');
    if (k % 2 === 1) lit(...onHead(nx, ny + 0.02, 0.09), 'v', 0.7, 1.3, C.bone, 'head');
  }
  // 大きな耳：頭の横から、外へ広く、少し上と後ろへ。根もとが太く先がとがる三角を、列ごとに下の縁から上の縁まで埋める。縁は肌、内側は暗い赤茶
  for (const sd of [-1, 1]) {
    const root: Vec3 = [sd * H.r[0] * 0.9, H.c[1], H.c[2] - 0.04],
      tip: Vec3 = [sd * 0.5, H.c[1] + 0.2, H.c[2] - 0.14],
      up = 0.1,
      dn = 0.08,
      g = S * 0.4,
      n = Math.max(3, Math.round(Math.abs(tip[0] - root[0]) / g));
    for (let k = 0; k <= n; k++) {
      const f = k / n,
        x = root[0] + (tip[0] - root[0]) * f,
        y = root[1] + (tip[1] - root[1]) * f,
        z = root[2] + (tip[2] - root[2]) * f,
        w = 1 - f,
        lo = y - dn * w,
        hi = y + up * w,
        m = Math.max(1, Math.round((hi - lo) / g));
      if (k === n) {
        lit(x, y, z, sd < 0 ? '<' : '>', 0.9, 1.2, C.skin, 'head');
        continue;
      }
      for (let j = 0; j <= m; j++) {
        const edge = j === 0 || j === m;
        lit(x, lo + ((hi - lo) * j) / m, z, edge ? '%' : ':', 0.95, edge ? 1.2 : 0.9, edge ? C.skin : C.inner, 'head');
      }
    }
  }
  // 背骨のこぶ：猫背の背中の真ん中（襟巻きの下から帯の上まで）
  for (let q = 0; q < 4; q++) {
    const p = gobTorsoAt(0.82 - q * 0.15, -Math.PI / 2);
    lit(p.x, p.y, p.z - 0.02, q === 0 ? 'n' : 'o', 0.8, 1.0, q === 0 ? C.skin : C.hide);
  }
  // 腕：細く長い。肩から振る
  const LH: Vec3 = [-0.28, 0.6, 0.36],
    RH: Vec3 = [0.27, 0.56, 0.34];
  for (const sd of [-1, 1]) {
    const part = sd < 0 ? 'armL' : 'armR',
      sh: Vec3 = [sd * 0.19, 0.96, 0.18],
      el: Vec3 = [sd * 0.27, 0.74, 0.16],
      hd = sd > 0 ? RH : LH;
    tube(sh, el, 0.045, 0.035, SKIN, C.skin, part, SHOULDER, 0.15);
    tube(el, hd, 0.035, 0.032, SKIN, C.skin, part, SHOULDER);
    ellAt(SHOULDER, hd, 0.05, 0.05, 0.05, SKIN, () => C.skin, part, st * 0.4);
  }
  // 左手：指を開いて、爪
  {
    const h = LH;
    for (const o of [-1, 0, 1])
      stroke([h[0] + o * 0.03, h[1] - 0.03, h[2] + 0.03], [h[0] + o * 0.045, h[1] - 0.1, h[2] + 0.08], C.bone, 1.0, 0.7, 'armL', SHOULDER);
  }
  // 右手：錆びた短刀。柄を握り、刃は前の上へ反る
  {
    const h = RH;
    lit(h[0], h[1] - 0.06, h[2], 'o', 0.7, 1.0, C.hide, 'armR', SHOULDER);
    for (const o of [-1, 1]) lit(h[0] + o * 0.05, h[1] + 0.06, h[2] + 0.02, '-', 0.8, 1.1, C.iron, 'armR', SHOULDER);
    const n = 6;
    for (let k = 1; k <= n; k++) {
      const f = k / n,
        y = h[1] + 0.06 + 0.32 * f,
        z = h[2] + 0.02 + 0.12 * f * f;
      lit(h[0], y, z, k === n ? '^' : '|', 0.85, 1.3, C.iron, 'armR', SHOULDER);
      if (k < n) lit(h[0], y, z + 0.035, k % 2 ? ')' : '|', 0.8, 1.0, C.iron, 'armR', SHOULDER);
    }
  }
  // 小さな体は明るく描かれ（1.4 倍）、照準の先ではさらに明るくなる。白い塊にならないように、目のほかは暗めにする。
  // 一番広い肌は、さらに暗めにする（部屋の灯りの下で、肌だけが白くにじみ、上着と襟巻きの色が消える）
  for (const p of pts) if (p.col !== C.eye) p.b *= p.col === C.skin ? 0.6 : 0.75;
  return pts;
}
