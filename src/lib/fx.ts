// 火と術の跡を描く（もとは src/game/15-sound-fire.js の drawFire、26-spells-hud.js の drawFrozen、24-goal.js の addBolt・sparkCrown・drawBoltFx、
// 20-chant-hits.js の drawZones）：燃えているマスの炎と投げた火花、凍らせた水、たどれる稲妻（ぎざぎざの線がちらつき、遅れて落ちる稲妻を順に起こす）、
// 当たった生き物の頭の火花の輪、床の目印と魔法の場。毎フレーム、世界の中に文字を置き（dyn）、粒子を出す（spawn）。
// 状態の入れ物 blaze（火）・fight（稲妻・目印）・vfx（稲妻の光り）・player に頼る。呼ぶのは古い JS の描画（30-loop-init.js の tick と
// 22-world-hints.js の drawRunesWorld）と、稲妻を出す処理（20-chant-hits.js・26-spells-hud.js）。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う見た目になるので、順番を変えないこと。
import { must, nth } from './array.ts';
import { G } from './glyphs.ts';
import { jagged } from './math.ts';
import { dyn, spawn } from './particles.ts';
import { mpick, mr } from './random.ts';
import { elemCol } from './runes.ts';
import { type Monster, blaze, fight, player, vfx } from './state.ts';
import { CELL, MW, cpos } from './world.ts';

/** 燃えているマスの炎（34 より遠いマスは描かない。ときどき火の粉を出す）と、投げた火花 */
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
  if (blaze.spark) dyn(blaze.spark.x, blaze.spark.y, blaze.spark.z, G('*'), 0.32, 3.4, 2.2, 0.9);
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
