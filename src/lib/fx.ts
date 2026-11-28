// 火と術の跡を描く（drawFire・drawFrozen・addBolt・addRipple・sparkCrown・shockRise・drawBoltFx・drawZones・drawWave）：
// 燃えているマスの炎、凍らせた水、たどれる稲妻（ぎざぎざの線がちらつき、遅れて落ちる稲妻を順に起こす。水を伝わる雷は、水面を這う線と、水面に広がる輪と、足元から上る火花）、
// 当たった生き物の頭の火花の輪、床の目印と魔法の場、剣が飛ばす風の刃。毎フレーム、世界の中に文字を置き（dyn）、粒子を出す（spawn）。
// 状態の入れ物 blaze（火）・fight（稲妻・目印）・vfx（稲妻の光り）・player・gfx（カメラの位置。読むだけ）に頼る。呼ぶのは描画（src/lib/loop.ts の tick と
// src/lib/fixtures.ts の drawRunesWorld）と、稲妻を出す処理（src/lib/combat.ts）。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う見た目になるので、順番を変えないこと。
import { must, nth } from './array.ts';
import { aimOrigin, handUp } from './aim.ts';
import { G } from './glyphs.ts';
import { vmGlyph, vmGlyphS } from './hands.ts';
import { jagged } from './math.ts';
import { dyn, spawn } from './particles.ts';
import { mpick, mr } from './random.ts';
import { clamp } from './rng.ts';
import { elemCol } from './runes.ts';
import { type Bolt, type Monster, type Proj, blaze, fight, gfx, here, player, vfx } from './state.ts';
import { CELL, LQ_DEEP, LQ_WATER, MW, cpos } from './world.ts';

/** 燃えているマスの炎（34 より遠いマスは描かない。ときどき火の粉を出す） */
export function drawFire(t: number, dt: number): void {
  for (const i of blaze.burning) {
    const f = blaze.fire[i] ?? NaN;
    if (f <= 0) continue;
    const x0 = ((i % MW) + 0.5) * CELL,
      z0 = (((i / MW) | 0) + 0.5) * CELL;
    if (Math.hypot(x0 - player.x, z0 - player.z) > 34) continue;
    let h = Math.sin(i * 12.9898) * 43758.5453;
    h -= Math.floor(h);
    for (let k = 0; k < 5; k++) {
      const q = (t * (1.8 + h) + k / 5 + h) % 1,
        ox = Math.sin(k * 2.3 + h * 9) * 0.6,
        oz = Math.cos(k * 1.7 + h * 7) * 0.6,
        b = 2.8 * (1 - q) * f;
      dyn(
        x0 + ox,
        0.12 + q * 1.3 * f,
        z0 + oz,
        G(k % 3 === 0 ? '^' : k % 3 === 1 ? '*' : "'"),
        0.5 * (1 - q * 0.6) * (0.5 + f * 0.5),
        b * 1.0,
        b * 0.45 * (1 - q),
        b * 0.12 * (1 - q) * (1 - q),
      );
    }
    if (mr() < dt * 6 * f)
      spawn(
        x0 + (mr() - 0.5) * 1.4,
        0.3,
        z0 + (mr() - 0.5) * 1.4,
        (mr() - 0.5) * 0.4,
        0.9 + mr() * 1.2,
        (mr() - 0.5) * 0.4,
        1.2 + mr() * 1.6,
        G(mpick(['.', "'", '*'])),
        0.1,
        2.8,
        1.4,
        0.5,
        0,
      );
  }
}

/** 凍らせた水の1マスに並べる氷の文字の、1辺の数（4×4） */
export const ICE_N = 4;
/** 凍らせた水が解けるまでの残りの秒がこれより短くなると、ひびが入り始める（残り 0 で全部の文字がひびになる） */
export const ICE_CRACK = 10;
/**
 * マス i の氷の文字 (a, b)（0 から ICE_N-1）がひびになる順番の鍵（0 から 1。小さいほど先にひびになる）。
 * 凍っていないマスに接する辺の文字は 0 から 0.5、内の文字は 0.5 から 1 なので、縁の側から内へひびが進む。同じ側の中の順番は、マスと文字の位置から作った決まった値
 */
export function iceCrackKey(i: number, a: number, b: number): number {
  // 行の端のマスの横は、隣の行のマスではなく、凍っていない所と見る
  const x = i % MW,
    edge =
      (a === 0 && (x === 0 || !blaze.frozen.has(i - 1))) ||
      (a === ICE_N - 1 && (x === MW - 1 || !blaze.frozen.has(i + 1))) ||
      (b === 0 && !blaze.frozen.has(i - MW)) ||
      (b === ICE_N - 1 && !blaze.frozen.has(i + MW));
  let h = Math.sin(i * 12.9898 + a * 78.233 + b * 37.719) * 43758.5453;
  h -= Math.floor(h);
  return (edge ? 0 : 0.5) + h * 0.5;
}
/**
 * 凍らせた水（30 より遠いマスは描かない）：1マスに ICE_N×ICE_N の氷の文字（# と + を互い違いに）を床に寝かせて並べ、青白く少し光らせる（下の水面は描かない。src/lib/build.ts の updateWaterCell）。
 * 解けるまでの残りが ICE_CRACK 秒を切ると、縁の側から順に文字がひび（/ と \）に変わり、ひびの割合は 1 から 残り/ICE_CRACK を引いた物
 */
export function drawFrozen(t: number): void {
  const step = CELL / ICE_N;
  for (const [i, f] of blaze.frozen) {
    const [x, z] = cpos(i);
    if (Math.hypot(x - player.x, z - player.z) > 30) continue;
    const crack = 1 - f.t / ICE_CRACK;
    for (let a = 0; a < ICE_N; a++)
      for (let b = 0; b < ICE_N; b++) {
        const px = x + (a - (ICE_N - 1) / 2) * step,
          pz = z + (b - (ICE_N - 1) / 2) * step,
          sh = 0.85 + 0.15 * Math.sin(t * 1.6 + px * 1.3 + pz * 0.9);
        if (crack > 0 && iceCrackKey(i, a, b) < crack)
          dyn(px, 0.07, pz, G((a + b) % 2 ? '/' : '\\'), 0.44, 0.45 * sh, 0.7 * sh, 1.05 * sh, 1);
        else dyn(px, 0.07, pz, G((a + b) % 2 ? '+' : '#'), 0.44, 0.62 * sh, 0.82 * sh, 1.12 * sh, 1);
      }
  }
}

/** 水面を這う雷の高さ（水面 gfx.waterMesh は 0.06） */
export const WATER_ZAP_Y = 0.1;
/** a から b への稲妻の見た目を足す（style は 'thunder'（書かなければこれ）・'fire'・'ice'・水面を這う雷 'water' など。雷は大きく揺れ、長く残る） */
export function addBolt(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  col: readonly number[],
  style?: string,
): void {
  style = style || 'thunder';
  const amp = style === 'thunder' ? 0.35 : style === 'water' ? 0.3 : 0.14,
    f: Bolt = {
      a,
      b,
      col,
      style,
      amp,
      t: 0,
      life: style === 'thunder' ? 0.36 : style === 'water' ? 0.42 : 0.3,
      re: 0,
      pts: jagged(a, b, amp),
    };
  if (style === 'water') {
    flatten(f);
    // 線の上で跳ねる小さな火花（目の高さから見ても、水面の線に高さが出る）
    for (let k = 0; k < 7; k++) {
      const s = (k + 0.5) / 7,
        x = a[0] + (b[0] - a[0]) * s,
        z = a[2] + (b[2] - a[2]) * s;
      spawn(
        x,
        WATER_ZAP_Y,
        z,
        (mr() - 0.5) * 0.6,
        0.9 + 0.9 * mr(),
        (mr() - 0.5) * 0.6,
        0.22 + 0.1 * mr(),
        G(mpick(["'", '|', '.'])),
        0.1,
        (col[0] ?? 0) * 2.4,
        (col[1] ?? 0) * 2.4,
        (col[2] ?? 0) * 2.4,
        0,
      );
    }
  }
  fight.boltFx.push(f);
}
/** 水面を這う雷の線を水面の高さに揃え、枝を作り直す */
function flatten(f: Bolt): void {
  f.pts = f.pts.map((v) => [v[0], WATER_ZAP_Y, v[2]] as const);
  f.br = waterBranches(f.pts);
}

/** 水面の (x, z) から、半径 r まで広がる輪を足す（水のマスの上だけに描く） */
export function addRipple(x: number, z: number, r: number, col: readonly number[]): void {
  fight.boltFx.push({
    a: [x, WATER_ZAP_Y, z],
    b: [x, WATER_ZAP_Y, z],
    col,
    style: 'ripple',
    amp: r,
    t: 0,
    life: r / RIPPLE_SPEED + 0.2,
    re: 0,
    pts: [],
  });
}
/** 水を伝わる雷と水面の輪が広がる速さ（1秒に何進むか。src/lib/combat.ts の waterShock は、輪が届いた敵に雷を走らせる） */
export const RIPPLE_SPEED = 15;

/** 稲妻が当たった生き物の頭のまわりに、火花の輪を出す（当たって光る時間も 0.3 秒は残す） */
export function sparkCrown(m: Monster, col: readonly number[]): void {
  const cy = (m.y ?? NaN) + 0.6 * m.ty.scale + 0.35 * m.ty.scale;
  m.hitT = Math.max(m.hitT || 0, 0.3);
  for (let q = 0; q < 12; q++) {
    const a = (q / 12) * Math.PI * 2;
    spawn(
      m.x + Math.cos(a) * 0.3 * m.ty.scale,
      cy,
      m.z + Math.sin(a) * 0.3 * m.ty.scale,
      Math.cos(a) * 1.4,
      1.2 + mr(),
      Math.sin(a) * 1.4,
      0.35,
      G(mpick(['*', '+', "'"])),
      0.13,
      (col[0] ?? NaN) * 3.2,
      (col[1] ?? NaN) * 3.2,
      (col[2] ?? NaN) * 3.2,
      0,
    );
  }
}

/** 水を伝わった雷が当たった生き物の、足元から体へ上る細い火花（当たって光る時間も 0.18 秒は残す。頭の火花の輪より細く暗くして、群れの上を白くにじませない） */
export function shockRise(m: Monster, col: readonly number[]): void {
  const s = m.ty.scale,
    y0 = (m.y ?? 0) + 0.05;
  m.hitT = Math.max(m.hitT || 0, 0.18);
  for (let q = 0; q < 8; q++) {
    const a = (q / 8) * Math.PI * 2 + mr() * 0.5,
      r = (0.15 + 0.2 * mr()) * s;
    spawn(
      m.x + Math.cos(a) * r,
      y0,
      m.z + Math.sin(a) * r,
      0,
      (2.2 + 1.4 * mr()) * s,
      0,
      0.3 + 0.12 * mr(),
      G(q % 3 ? '|' : "'"),
      0.11,
      (col[0] ?? NaN) * 2.2,
      (col[1] ?? NaN) * 2.2,
      (col[2] ?? NaN) * 2.2,
      0,
    );
  }
}

/** 目から見た点（右・上・前の3つ。vmGlyphS に渡す形） */
const eyeOf = (
  p: readonly number[],
  o: readonly number[],
  f: readonly number[],
  rt: readonly number[],
  up: readonly number[],
): [number, number, number] => {
  const v0 = (p[0] ?? 0) - (o[0] ?? 0),
    v1 = (p[1] ?? 0) - (o[1] ?? 0),
    v2 = (p[2] ?? 0) - (o[2] ?? 0);
  return [
    v0 * (rt[0] ?? 0) + v1 * (rt[1] ?? 0) + v2 * (rt[2] ?? 0),
    v0 * (up[0] ?? 0) + v1 * (up[1] ?? 0) + v2 * (up[2] ?? 0),
    Math.max(0.05, v0 * (f[0] ?? 0) + v1 * (f[1] ?? 0) + v2 * (f[2] ?? 0)),
  ];
};

/** 水面の線 pts を、目から見た傾きに合う文字で描く（芯 core は白に寄せた明るい文字、縁は性質の色の小さな文字） */
function drawWaterLine(pts: readonly (readonly [number, number, number])[], c: readonly number[], br: number, size: number): void {
  const [f, rt, up] = handUp(),
    o = aimOrigin();
  for (let k = 0; k + 1 < pts.length; k++) {
    const p = nth(pts, k),
      q = nth(pts, k + 1),
      dx = q[0] - p[0],
      dz = q[2] - p[2],
      ch = vmGlyphS(eyeOf(p, o, f, rt, up), eyeOf(q, o, f, rt, up)),
      n = Math.max(1, Math.round(Math.hypot(dx, dz) / 0.12));
    for (let j = 0; j < n; j++) {
      const s = j / n,
        x = p[0] + dx * s,
        z = p[2] + dz * s;
      dyn(
        x,
        WATER_ZAP_Y,
        z,
        G(ch),
        size,
        (0.45 + 0.55 * (c[0] ?? 0)) * br,
        (0.45 + 0.55 * (c[1] ?? 0)) * br,
        (0.45 + 0.55 * (c[2] ?? 0)) * br,
      );
      if (j % 2 === 0)
        dyn(
          x,
          WATER_ZAP_Y + 0.02,
          z,
          G('~'),
          size * 1.6,
          (c[0] ?? 0) * br * 0.25,
          (c[1] ?? 0) * br * 0.25,
          (c[2] ?? 0) * br * 0.25,
          1,
          Math.atan2(dx, dz),
        );
    }
  }
}

/** 水面の輪（今の半径に、水のマスの上だけ、輪に沿う向きの文字を並べる。1つの輪に160字まで。少し内側に、薄いもう1つの輪。真ん中が 34 より遠い輪は描かない） */
function drawRipple(f: Bolt): void {
  const D = here.D;
  if (!D) return;
  // 遠い輪は描かない（火の 34 と同じ）
  if (Math.hypot(f.a[0] - player.x, f.a[2] - player.z) - f.amp > 34) return;
  const [fw, rt, up] = handUp(),
    o = aimOrigin(),
    c = f.col,
    rNow = Math.min(f.amp, f.t * RIPPLE_SPEED),
    fade = Math.max(0, 1 - f.t / f.life);
  for (const [k, b] of [
    [1, 3],
    [0.8, 1.2],
  ] as const) {
    const r = rNow * k;
    if (r < 0.2) continue;
    const n = Math.min(160, Math.max(12, Math.round((Math.PI * 2 * r) / 0.22))),
      bb = b * fade * (1 - 0.45 * (r / f.amp));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        x = f.a[0] + Math.cos(a) * r,
        z = f.a[2] + Math.sin(a) * r,
        ci = Math.floor(z / CELL) * MW + Math.floor(x / CELL),
        lq = D.liquid[ci];
      if (lq !== LQ_WATER && lq !== LQ_DEEP) continue;
      const tx = -Math.sin(a) * 0.1,
        tz = Math.cos(a) * 0.1,
        ch = vmGlyphS(eyeOf([x - tx, WATER_ZAP_Y, z - tz], o, fw, rt, up), eyeOf([x + tx, WATER_ZAP_Y, z + tz], o, fw, rt, up));
      dyn(
        x,
        WATER_ZAP_Y + 0.02,
        z,
        G(ch),
        0.22,
        (0.3 + 0.7 * (c[0] ?? 0)) * bb,
        (0.3 + 0.7 * (c[1] ?? 0)) * bb,
        (0.3 + 0.7 * (c[2] ?? 0)) * bb,
      );
    }
  }
}

/** 水面を這う雷の枝：線 pts の途中から、横へ短く2本 */
function waterBranches(pts: readonly (readonly [number, number, number])[]): (readonly [number, number, number])[][] {
  const out: (readonly [number, number, number])[][] = [];
  for (let b = 0; b < 2 && pts.length > 3; b++) {
    const i = 1 + Math.floor(mr() * (pts.length - 2)),
      p = nth(pts, i),
      q = nth(pts, Math.min(pts.length - 1, i + 1)),
      dir = Math.atan2(q[2] - p[2], q[0] - p[0]) + (b ? 1 : -1) * (0.6 + 0.6 * mr()),
      len = 0.5 + 0.7 * mr();
    out.push(
      jagged(p, [p[0] + Math.cos(dir) * len, WATER_ZAP_Y, p[2] + Math.sin(dir) * len], 0.12).map((v) => [v[0], WATER_ZAP_Y, v[2]] as const),
    );
  }
  return out;
}

/** 稲妻を進めて描く：遅れて落ちる稲妻を時間が来たら起こし、稲妻の光りを弱め、ぎざぎざの線を 0.07 秒ごとに引き直して描き、消えた物を除く */
export function drawBoltFx(_t: number, dt: number): void {
  for (const z of fight.zapQueue) {
    z.t -= dt;
    if (z.t <= 0 && !z.done) {
      z.done = true;
      z.fn();
    }
  }
  fight.zapQueue = fight.zapQueue.filter((z) => !z.done);
  if (vfx.zapFlash && vfx.zapFlash.t < 900) vfx.zapFlash.t -= dt;
  for (const f of fight.boltFx) {
    f.t += dt;
    if (f.style === 'ripple') {
      drawRipple(f);
      continue;
    }
    f.re -= dt;
    if (f.re <= 0) {
      f.re = 0.07;
      f.pts = jagged(f.a, f.b, f.amp);
      if (f.style === 'water') flatten(f);
    }
    const fade = Math.max(0, 1 - f.t / f.life),
      c = f.col;
    if (f.style === 'water') {
      const br = 2.7 * fade * (0.75 + 0.5 * mr());
      drawWaterLine(f.pts, c, br, 0.24);
      for (const b of f.br || []) drawWaterLine(b, c, br * 0.55, 0.17);
      continue;
    }
    const br = (f.style === 'thunder' ? 3.2 : 2.2) * fade * (0.75 + 0.5 * mr());
    for (let k = 0; k + 1 < f.pts.length; k++) {
      const p = nth(f.pts, k),
        q = nth(f.pts, k + 1),
        dx = q[0] - p[0],
        dy = q[1] - p[1],
        dz = q[2] - p[2],
        hz = Math.hypot(dx, dz);
      const ch =
        f.style === 'thunder'
          ? Math.abs(dy) > hz * 1.2
            ? '|'
            : dy > 0 === dx + dz > 0
              ? '/'
              : '\\'
          : f.style === 'fire'
            ? mpick(['^', '~'])
            : f.style === 'ice'
              ? mpick(['*', '.'])
              : mpick(['%', '.']);
      const n = Math.max(1, Math.round(Math.hypot(dx, dy, dz) / 0.2));
      for (let j = 0; j < n; j++) {
        const s = j / n;
        dyn(
          p[0] + dx * s,
          p[1] + dy * s,
          p[2] + dz * s,
          G(ch),
          f.style === 'thunder' ? 0.16 : 0.12,
          (c[0] ?? NaN) * br,
          (c[1] ?? NaN) * br,
          (c[2] ?? NaN) * br,
        );
      }
    }
  }
  fight.boltFx = fight.boltFx.filter((f) => f.t < f.life);
}

/** 床の目印（雨や落ちてくる物の落ちる場所）：回る点の輪。星の目印は + の輪と、真ん中の *。魔法の場（30 より遠い物は描かない）：性質ごとの文字の輪（できてから 1.5 秒かけて明るくなる） */
export function drawZones(t: number): void {
  for (const mk of fight.marks) {
    const n = mk.star ? 14 : 18,
      b = 0.6 + 0.4 * Math.sin(t * 10),
      c0 = mk.c[0] ?? NaN,
      c1 = mk.c[1] ?? NaN,
      c2 = mk.c[2] ?? NaN;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + t * (mk.star ? 1.5 : 0.6);
      dyn(
        mk.x + Math.cos(a) * mk.r,
        0.06,
        mk.z + Math.sin(a) * mk.r,
        G(mk.star ? '+' : '.'),
        0.15,
        c0 * b * 2,
        c1 * b * 2,
        c2 * b * 2,
        0,
        0,
      );
    }
    if (mk.star) dyn(mk.x, 0.08, mk.z, G('*'), 0.3, c0 * 2.5 * b, c1 * 2.5 * b, c2 * 2.5 * b, 0, 0);
  }
  for (const zn of fight.zones) {
    if (Math.hypot(zn.x - player.x, zn.z - player.z) > 30) continue;
    const c = elemCol(zn.el),
      f = Math.min(1, zn.t / 1.5),
      n = Math.round(10 + zn.r * 8);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + t * 0.3,
        rr = zn.r * (0.92 + 0.08 * Math.sin(t * 3 + k)),
        b = (zn.el ? 0.9 : 0.35) * f * (0.7 + 0.3 * Math.sin(t * 4 + k * 1.3));
      // 色の無い性質は無い（無ければ、ここで止まる）
      const col = must(c, '魔法の場の色');
      dyn(
        zn.x + Math.cos(a) * rr,
        0.05,
        zn.z + Math.sin(a) * rr,
        G(zn.el === 'fire' ? '^' : zn.el === 'ice' ? '*' : zn.el === 'thunder' ? '/' : zn.el === 'poison' ? '%' : '.'),
        0.15,
        (col[0] ?? NaN) * b * 1.8,
        (col[1] ?? NaN) * b * 1.8,
        (col[2] ?? NaN) * b * 1.8,
        0,
        0,
      );
    }
  }
}
/** 風の刃の明るさ（突きの線は 1.05 倍）。明るいと、敵より目立ち、光のにじみで白く広がる */
const WAVE_K = 1.5;
/** 風の刃の明るさを目からの距離で変える：[この距離までは一番暗い, この距離で元の明るさ, 一番暗い時の倍率] */
const WAVE_NEAR = [0.3, 2.0, 0.15] as const;
/**
 * 剣が飛ばす風の刃（剣は短く、大剣の払いは幅広く）。刃が振った面に沿って傾き（剣は右手なら右上から左下、左手なら逆、大剣の払いはほぼ水平）、
 * 前へ弓なりに反って両端が手前に流れる。真ん中は太く明るく、端は細い。飛ぶほど広がり、薄い尾を引き、終わりに薄れる。突きは細い線。
 * 出たばかりの目の前では暗く、離れるほど明るくする（目の前で明るいと、光のにじみが画面の半分に広がって白く飛ぶ。pnpm glare の「画面」で数える）
 */
export function drawWave(p: Proj): void {
  const cam = gfx.camera.position,
    nearK = clamp((Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z) - WAVE_NEAR[0]) / (WAVE_NEAR[1] - WAVE_NEAR[0]), WAVE_NEAR[2], 1);
  const c = elemCol(p.sp.elem),
    v = Math.hypot(p.vx, p.vz) || 1,
    dx = p.vx / v,
    dz = p.vz / v,
    px = -dz,
    pz = dx,
    life = clamp(1 - p.t / (p.maxT || 1), 0, 1),
    fade = Math.min(1, life * 2.2),
    b = (0.75 + 0.55 * fade) * fade * nearK;
  if (p.thrust) {
    for (let i = 0; i < 6; i++) {
      const k = i * 0.16;
      dyn(
        p.x - dx * k,
        p.y - (p.vy / v) * k,
        p.z - dz * k,
        G(i === 0 ? '>' : '-'),
        0.16 - i * 0.015,
        nth(must(c), 0) * WAVE_K * 1.05 * b * (1 - i / 7),
        nth(must(c), 1) * WAVE_K * 1.05 * b * (1 - i / 7),
        nth(must(c), 2) * WAVE_K * 1.05 * b * (1 - i / 7),
      );
    }
    return;
  }
  const [, cr, cu] = handUp(),
    grow = 1 + 0.5 * (1 - life),
    W = (p.cw || 1.2) * grow,
    half = W / 2,
    bow = 0.28 * W,
    ang = (p.big ? 0.14 : 0.61) * (p.sp.h === 'L' ? -1 : 1),
    ca = Math.cos(ang),
    sa = Math.sin(ang);
  const S: [number, number, number] = [px * ca, sa, pz * ca],
    n = Math.max(11, Math.round(W * 9));
  const pt = (s: number, back: number): [number, number, number] => {
    const f = -bow * s * s - back;
    return [p.x + S[0] * s * half + dx * f, p.y + S[1] * s * half, p.z + S[2] * s * half + dz * f];
  };
  for (const [trail, tb] of [
    [0, 1],
    [0.22, 0.35],
  ] as const) {
    const ox = -dx * trail * v * 0.04 * 6,
      oz = -dz * trail * v * 0.04 * 6;
    for (let i = 0; i < n; i++) {
      const s = (i / (n - 1)) * 2 - 1,
        core = 1 - s * s,
        rows = trail ? 1 : Math.max(1, Math.round(1 + core * 2.2));
      const T: [number, number, number] = [S[0] * half + dx * (-2 * bow * s), S[1] * half, S[2] * half + dz * (-2 * bow * s)],
        g = vmGlyph(T[0] * cr[0] + T[2] * cr[2], T[0] * cu[0] + T[1] * cu[1] + T[2] * cu[2]);
      for (let k = 0; k < rows; k++) {
        const q = pt(s, k * 0.07),
          bb = b * tb * (0.45 + 0.75 * core) * (1 - k * 0.22);
        dyn(
          q[0] + ox,
          q[1],
          q[2] + oz,
          G(g),
          (p.big ? 0.2 : 0.16) * (0.7 + 0.45 * core),
          nth(must(c), 0) * WAVE_K * bb,
          nth(must(c), 1) * WAVE_K * bb,
          nth(must(c), 2) * WAVE_K * bb,
        );
      }
    }
  }
}
