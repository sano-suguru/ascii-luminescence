// 火と術の跡を描く（もとは src/game/15-sound-fire.js の drawFire、26-spells-hud.js の drawFrozen、24-goal.js の addBolt・sparkCrown・drawBoltFx、
// 20-chant-hits.js の drawZones・drawWave）：燃えているマスの炎、凍らせた水、たどれる稲妻（ぎざぎざの線がちらつき、遅れて落ちる稲妻を順に起こす）、
// 当たった生き物の頭の火花の輪、床の目印と魔法の場、剣が飛ばす風の刃。毎フレーム、世界の中に文字を置き（dyn）、粒子を出す（spawn）。
// 状態の入れ物 blaze（火）・fight（稲妻・目印）・vfx（稲妻の光り）・player・gfx（カメラの位置。読むだけ）に頼る。呼ぶのは描画（src/lib/loop.ts の tick と
// src/lib/fixtures.ts の drawRunesWorld）と、稲妻を出す処理（20-chant-hits.js・26-spells-hud.js）。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う見た目になるので、順番を変えないこと。
import { must, nth } from './array.ts';
import { handUp } from './aim.ts';
import { G } from './glyphs.ts';
import { vmGlyph } from './hands.ts';
import { jagged } from './math.ts';
import { dyn, spawn } from './particles.ts';
import { mpick, mr } from './random.ts';
import { clamp } from './rng.ts';
import { elemCol } from './runes.ts';
import { type Monster, type Proj, blaze, fight, gfx, player, vfx } from './state.ts';
import { CELL, MW, cpos } from './world.ts';

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

/** 凍らせた水のマス（30 より遠いマスは描かない。溶けかけの5秒は、ひびが入る） */
export function drawFrozen(t: number): void {
  for (const [i, f] of blaze.frozen) {
    const [x, z] = cpos(i);
    if (Math.hypot(x - player.x, z - player.z) > 30) continue;
    const crack = f.t < 5;
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++) {
        const sh = 0.85 + 0.15 * Math.sin(t * 2 + a + b * 1.7);
        dyn(x + (a - 1) * 0.62, 0.08, z + (b - 1) * 0.62, G(crack && (a + b) % 2 ? '/' : '='), 0.36, 0.7 * sh, 0.92 * sh, 1.25 * sh);
      }
  }
}

/** a から b への稲妻の見た目を足す（style は 'thunder'（書かなければこれ）・'fire'・'ice' など。雷は大きく揺れ、長く残る） */
export function addBolt(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  col: readonly number[],
  style?: string,
): void {
  style = style || 'thunder';
  const amp = style === 'thunder' ? 0.35 : 0.14;
  fight.boltFx.push({ a, b, col, style, amp, t: 0, life: style === 'thunder' ? 0.36 : 0.3, re: 0, pts: jagged(a, b, amp) });
}

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
    f.re -= dt;
    if (f.re <= 0) {
      f.re = 0.07;
      f.pts = jagged(f.a, f.b, f.amp);
    }
    const fade = Math.max(0, 1 - f.t / f.life),
      c = f.col,
      br = (f.style === 'thunder' ? 3.2 : 2.2) * fade * (0.75 + 0.5 * mr());
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
      // 色の無い性質は無い（無ければ、元と同じく、ここで止まる）
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
  // @ts-expect-error -- 古い JS のまま（前の向き cf は使っていない）
  const [cf, cr, cu] = handUp(),
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
