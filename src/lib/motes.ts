// 粒子を動かす（updateGasPoints・riverFX・updateParticles）：漂う塵（降る層では雪や灰）、沼のガスの粒、川のさざ波、
// 術や火が出したそのほかの粒子（動き方 ty：0 は昇りながら赤から消える火の粉、1 は瞬く、ほかはそのまま）。毎フレーム、描く粒子の配列（src/lib/particles.ts の ptPos など）に書き、
// 描く数を GPU に渡す（形と属性 gfx.ptGeo・bpPos などは src/lib/render.ts の initRenderer が作る）。
import { must, nth } from './array.ts';
import { G } from './glyphs.ts';
import { cellLight, ceilAt } from './lightmap.ts';
import { killP, P, ptCol, ptGly, ptPos, ptSize, respawnDust, spawn } from './particles.ts';
import { mpick, mr } from './random.ts';
import { DUST_N, GAS_N, P0 } from './shaders.ts';
import { blaze, buf, dust, gfx, here, player } from './state.ts';
import { CELL, EYE, LQ_DEEP, LQ_WATER, MH, MW } from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

/** ガスの粒を置くマスの、プレイヤーのマスからのずれ（まわり 12 マスの四角。近い順で、同じ距離は北の行から） */
const GAS_OFFS: readonly (readonly [number, number])[] = (() => {
  const RR = 12,
    o: [number, number][] = [];
  for (let dz = -RR; dz <= RR; dz++) for (let dx = -RR; dx <= RR; dx++) o.push([dx, dz]);
  return o.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
})();
/**
 * 沼のガスの粒：プレイヤーのまわり 12 マスの、ガスのあるマスに、濃さに合わせて 1 から 3 粒（全部で GAS_N まで）。使わなかった粒は大きさを 0 にする。
 * 近いマスから置くので、濃い沼で GAS_N に届いた時は、遠いマスの粒が出ない
 */
export function updateGasPoints(t: number): void {
  let gi = 0;
  if (blaze.gasAny) {
    const pcx = Math.floor(player.x / CELL),
      pcz = Math.floor(player.z / CELL),
      g = level().gas;
    for (const [dx, dz] of GAS_OFFS) {
      if (gi >= GAS_N) break;
      const cx = pcx + dx,
        cz = pcz + dz;
      if (cx < 0 || cz < 0 || cx >= MW || cz >= MH) continue;
      const i = cz * MW + cx,
        v = nth(g, i);
      if (v < 0.04) continue;
      const l = cellLight((cx + 0.5) * CELL, (cz + 0.5) * CELL),
        n = v > 0.35 ? 3 : v > 0.15 ? 2 : 1;
      for (let s = 0; s < n && gi < GAS_N; s++) {
        let h1 = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
        h1 -= Math.floor(h1);
        let h2 = Math.sin(i * 39.3468 + s * 11.135) * 24634.6345;
        h2 -= Math.floor(h2);
        const k = Math.min(1, v) * (0.6 + 0.4 * Math.sin(t * 1.3 + h1 * 20)),
          j = DUST_N + gi,
          j3 = j * 3;
        ptPos[j3] = (cx + ((h1 + t * 0.02 * (1 + s)) % 1)) * CELL;
        ptPos[j3 + 1] = 0.25 + ((h1 * 3.7 + t * 0.05) % 1) * 1.6;
        ptPos[j3 + 2] = (cz + ((h2 + t * 0.017 * (1 + s)) % 1)) * CELL;
        ptCol[j3] = (0.05 + l[0] * 0.15) * k;
        ptCol[j3 + 1] = (0.09 + l[1] * 0.15) * k;
        ptCol[j3 + 2] = (0.02 + l[2] * 0.1) * k;
        ptSize[j] = 0.45 + h2 * 0.35;
        ptGly[j] = G(h1 < 0.5 ? '~' : h1 < 0.8 ? '.' : ':');
        gi++;
      }
    }
  }
  for (let k = gi; k < GAS_N; k++) ptSize[DUST_N + k] = 0;
}

/** 川のさざ波：プレイヤーから 18 以内の流れる水のマスに、流れの向きへ動く粒を出す（凍った川・溶岩になった川には出さない） */
export function riverFX(dt: number): void {
  if (!here.riverCells.length) return;
  for (let k = 0; k < 6 && mr() < dt * 14; k++) {
    const i = nth(here.riverCells, Math.floor(mr() * here.riverCells.length)),
      x = ((i % MW) + 0.2 + mr() * 0.6) * CELL,
      z = (((i / MW) | 0) + 0.2 + mr() * 0.6) * CELL;
    const lq = level().liquid[i];
    if (Math.hypot(x - player.x, z - player.z) > 18 || (lq !== LQ_WATER && lq !== LQ_DEEP)) continue; // a river frozen or turned to lava has no ripples
    const a = (level().flow[i] ?? NaN) - 10;
    spawn(x, 0.12, z, Math.cos(a) * 1.3, 0.01, Math.sin(a) * 1.3, 2.2 + mr(), G(mpick(['~', '.', '-'])), 0.13, 0.25, 0.55, 0.75, 1);
  }
}

/** 粒子を1歩進めて描く配列に書く（川のさざ波を出し、塵を漂わせ（遠い・天井より上・降る層で床に着いた塵は置き直す）、粒子を動かして寿命の尽きた物を消し、ガスの粒を置く）。最後に、描く数を GPU に渡す */
export function updateParticles(dt: number, t: number): void {
  riverFX(dt);
  const px = player.x,
    pz = player.z;
  for (let i = 0; i < DUST_N; i++) {
    const ph = nth(dust.ph, i);
    dust.x[i] = nth(dust.x, i) + Math.sin(t * 0.31 + ph) * 0.13 * dt;
    dust.z[i] = nth(dust.z, i) + Math.cos(t * 0.27 + ph * 1.3) * 0.13 * dt;
    dust.y[i] = nth(dust.y, i) + (Math.sin(t * 0.21 + ph * 2) * 0.06 + 0.015) * dt;
    const dx = nth(dust.x, i) - px,
      dz = nth(dust.z, i) - pz;
    if (level().stratum.fall) {
      dust.y[i] = nth(dust.y, i) - (level().stratum.fall === 'snow' ? 0.45 : 0.3) * dt;
      dust.x[i] = nth(dust.x, i) + Math.sin(t * 0.7 + ph) * 0.2 * dt;
    }
    if (
      dx * dx + dz * dz > 16 * 16 ||
      nth(dust.y, i) > (ceilAt(nth(dust.x, i), nth(dust.z, i)) ?? NaN) - 0.05 ||
      (level().stratum.fall && nth(dust.y, i) < 0.05)
    )
      respawnDust(i, false);
    const l = cellLight(nth(dust.x, i), nth(dust.z, i));
    const dd = Math.hypot(nth(dust.x, i) - px, nth(dust.y, i) - EYE, nth(dust.z, i) - pz),
      lan = Math.max(0, 1 - dd / 7);
    const tw = 0.5 + 0.5 * Math.sin(t * (0.7 + (ph % 1) * 1.3) + ph * 9),
      k = 0.2 + 0.8 * tw;
    const i3 = i * 3;
    ptPos[i3] = nth(dust.x, i);
    ptPos[i3 + 1] = nth(dust.y, i);
    ptPos[i3 + 2] = nth(dust.z, i);
    ptCol[i3] = (0.012 + l[0] * 0.2 + lan * lan * 0.09) * k;
    ptCol[i3 + 1] = (0.01 + l[1] * 0.2 + lan * lan * 0.085) * k;
    ptCol[i3 + 2] = (0.026 + l[2] * 0.2 + lan * lan * 0.13) * k;
    ptSize[i] = nth(dust.s, i);
    ptGly[i] = nth(dust.g, i);
  }
  for (let i = 0; i < buf.pN;) {
    P.age[i] = nth(P.age, i) + dt;
    if (nth(P.age, i) >= nth(P.life, i)) {
      killP(i);
      continue;
    }
    const ph = nth(P.ph, i),
      ty = nth(P.ty, i);
    P.vx[i] = nth(P.vx, i) + Math.sin(t * 1.7 + ph) * 0.35 * dt;
    P.vz[i] = nth(P.vz, i) + Math.cos(t * 1.3 + ph * 1.3) * 0.35 * dt;
    if (ty === 0) P.vy[i] = nth(P.vy, i) + 0.2 * dt;
    const drag = 1 - 0.5 * dt;
    P.vx[i] = nth(P.vx, i) * drag;
    P.vz[i] = nth(P.vz, i) * drag;
    P.vy[i] = nth(P.vy, i) * (1 - 0.15 * dt);
    P.x[i] = nth(P.x, i) + nth(P.vx, i) * dt;
    P.y[i] = nth(P.y, i) + nth(P.vy, i) * dt;
    P.z[i] = nth(P.z, i) + nth(P.vz, i) * dt;
    const a = nth(P.age, i) / nth(P.life, i);
    let k = Math.min(1, nth(P.age, i) * 5) * (1 - a);
    if (ty === 1) k = k * (0.6 + 0.4 * Math.sin(t * 4 + ph));
    const j = P0 + i,
      j3 = j * 3;
    ptPos[j3] = nth(P.x, i);
    ptPos[j3 + 1] = nth(P.y, i);
    ptPos[j3 + 2] = nth(P.z, i);
    if (ty === 0) {
      ptCol[j3] = nth(P.r, i) * k;
      ptCol[j3 + 1] = nth(P.g, i) * Math.pow(k, 1.7);
      ptCol[j3 + 2] = nth(P.b, i) * Math.pow(k, 2.4);
    } else {
      ptCol[j3] = nth(P.r, i) * k;
      ptCol[j3 + 1] = nth(P.g, i) * k;
      ptCol[j3 + 2] = nth(P.b, i) * k;
    }
    ptSize[j] = nth(P.sz, i);
    ptGly[j] = nth(P.gl, i);
    i++;
  }
  updateGasPoints(t);
  const total = P0 + buf.pN;
  must(gfx.ptGeo).setDrawRange(0, total);
  for (const [a, s] of [
    [must(gfx.bpPos), 3],
    [must(gfx.bpCol), 3],
    [must(gfx.bpSize), 1],
    [must(gfx.bpGly), 1],
  ] as const) {
    a.updateRange.offset = 0;
    a.updateRange.count = total * s;
    a.needsUpdate = true;
  }
}
