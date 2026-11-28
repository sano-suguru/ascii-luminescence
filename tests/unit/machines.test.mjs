// 掃除機（灰を片付ける）と修復機（焼け落ちた扉を作り直す）が、壁の向こうの仕事で動かなくならないかの単体テスト（src/lib/ground.ts の machineWork・updateCritter と
// src/lib/monsters.ts の critterStep）。1階の本物の階に、壁で囲んだ床の区画を書き込み（区画の中のマスの床・壁・液体・燃える物・灰は書き直し、
// 生き物・扉も消すので、生成した階の中身によらない）、区画の中に壁と仕事を置いて、updateCritter を直に呼んでゲームの時間を進める。
// プレイヤーは区画の外に置く。テストを .mjs で書くのは、偽の画面の部品を本物の型に合わせられないため。
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initFire, updateCritter } from '../../src/lib/ground.ts';
import { makeMonster } from '../../src/lib/monsters.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { blaze, clock, fight, gfx, here, player } from '../../src/lib/state.ts';
import { CELL, MW, NCELL, TF, TW } from '../../src/lib/world.ts';
import { fakeDom } from './fight-cases.mjs';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';

/** 区画（壁を含む）：横 X0〜X1、縦 Z0〜Z1 のマス。内側が床 */
const X0 = 6,
  X1 = 30,
  Z0 = 6,
  Z1 = 20;
const at = (x, z) => z * MW + x;
let restore = null,
  keepRandom = null;

beforeEach(async () => {
  const D = gen(await loadEnv(), 3, PLACES[0]).level;
  Object.assign(here, { D, fixtures: [], events: [], monsters: [], fovVis: new Uint32Array(NCELL), fovStamp: 1 });
  D.doors = [];
  for (let z = Z0; z <= Z1; z++)
    for (let x = X0; x <= X1; x++) {
      const i = at(x, z);
      D.tile[i] = z === Z0 || z === Z1 || x === X0 || x === X1 ? TW : TF;
      D.liquid[i] = 0;
      D.gas[i] = 0;
      D.solid.delete(i);
      if (D.glyph) D.glyph[i] = 0;
    }
  initFire();
  for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) blaze.fuel[at(x, z)] = 0;
  Object.assign(blaze, { frozen: new Map(), trampled: [] });
  Object.assign(fight, { laters: [], zones: [], rains: [], clouds: [], marks: [] });
  gfx.cellTex = { needsUpdate: false };
  clock.time = 100;
  Object.assign(player, { x: 1, z: 1 });
  keepRandom = Math.random;
  Math.random = mulberry32(1);
  restore = swapGlobals({ document: fakeDom().document, performance: { now: () => clock.time * 1000 } });
});
afterEach(() => {
  restore?.();
  Math.random = keepRandom;
});

/** 区画の中のマス (x, z) を壁にする */
const wall = (x, z) => {
  here.D.tile[at(x, z)] = TW;
};
/** 種類 key の小さな生き物を、マス (x, z) の真ん中に置く */
function put(key, x, z) {
  const m = makeMonster({ key, cx: x, cz: z, g: -1 });
  Object.assign(m, { x: (x + 0.5) * CELL, z: (z + 0.5) * CELL, cx: x, cz: z, tx: x, tz: z, wait: 0, st: {} });
  here.monsters.push(m);
  return m;
}
/** マス (x, z) と、その横 (x+dx, z+dz) の間の、焼け落ちた扉を置く（番号を返す） */
function burntDoor(x, z, dx, dz) {
  const d = {
    i: at(x, z),
    j: at(x + dx, z + dz),
    bx: (x + 0.5 + dx * 0.5) * CELL,
    bz: (z + 0.5 + dz * 0.5) * CELL,
    yaw: Math.atan2(-dx, -dz),
    o: 1,
    gone: true,
  };
  here.D.doors.push(d);
  return here.D.doors.length - 1;
}
/** 小さな生き物 m を sec 秒、0.1 秒ずつ動かす。done が true を返したら止めて、その秒を返す（止まらなければ null） */
function run(m, sec, done) {
  for (let q = 0; q < Math.round(sec * 10); q++) {
    clock.time += 0.1;
    updateCritter(m, 0.1, clock.time, 99);
    if (done()) return q / 10;
  }
  return null;
}

describe('掃除機', () => {
  it('壁の向こうの近い灰は選ばず、手前の行ける灰を片付ける', () => {
    for (let z = Z0 + 1; z < Z1; z++) wall(18, z); // 区画を左右に分ける壁
    const far = at(19, 13), // 壁の向こう（直線で3マス）
      near = at(9, 13); // 手前（直線で7マス）
    blaze.burnt[far] = 1;
    blaze.burnt[near] = 1;
    const m = put('Rc', 16, 13);
    expect(run(m, 60, () => !blaze.burnt[near])).not.toBeNull();
    expect(blaze.burnt[far]).toBe(1);
  });
  it('U字の壁の奥にいても、回り込んで灰を片付ける', () => {
    // 北を塞いだ U字（口は南）。生き物は中、灰は U字の北の外
    for (let x = 14; x <= 18; x++) wall(x, 11);
    for (let z = 12; z <= 14; z++) {
      wall(14, z);
      wall(18, z);
    }
    const ash = at(16, 9);
    blaze.burnt[ash] = 1;
    const m = put('Rc', 16, 13);
    expect(run(m, 60, () => !blaze.burnt[ash])).not.toBeNull();
  });
  it('壁の無い所の灰は、今までどおり片付ける', () => {
    const a = at(12, 10),
      b = at(20, 16);
    blaze.burnt[a] = 1;
    blaze.burnt[b] = 1;
    const m = put('Rc', 16, 13);
    expect(run(m, 90, () => !blaze.burnt[a] && !blaze.burnt[b])).not.toBeNull();
  });
  it('向かっている途中で道に火が回ると、仕事を手放して探し直し、火が消えればまた向かう', () => {
    // 区画を左右に分ける壁の、1マスだけの通り道。灰は通り道の向こう
    for (let z = Z0 + 1; z < Z1; z++) if (z !== 13) wall(18, z);
    const ash = at(21, 13);
    blaze.burnt[ash] = 1;
    const m = put('Rc', 15, 13);
    expect(run(m, 3, () => m.job === ash)).not.toBeNull();
    blaze.fire[at(18, 13)] = 1; // 通り道が燃える（火は進めないので、燃えたまま）
    expect(run(m, 20, () => m.job === -1)).not.toBeNull();
    expect(blaze.burnt[ash]).toBe(1);
    // 燃えている間は、探し直しても選ばない
    run(m, 6, () => false);
    expect(m.job).toBe(-1);
    blaze.fire[at(18, 13)] = 0;
    expect(run(m, 60, () => !blaze.burnt[ash])).not.toBeNull();
  });
});

describe('修復機', () => {
  it('壁の向こうの近い扉は選ばず、手前の行ける扉を作り直す', () => {
    for (let z = Z0 + 1; z < Z1; z++) wall(18, z);
    const far = burntDoor(20, 13, 1, 0), // 壁の向こう（扉まで直線で 9）
      near = burntDoor(9, 13, -1, 0); // 手前（扉まで直線で 15）
    const m = put('Re', 16, 13);
    expect(run(m, 60, () => !here.D.doors[near].gone)).not.toBeNull();
    expect(here.D.doors[far].gone).toBe(true);
  });
  it('壁の無い所の扉は、今までどおり作り直す', () => {
    const k = burntDoor(24, 9, 0, -1);
    const m = put('Re', 12, 16);
    expect(run(m, 60, () => !here.D.doors[k].gone)).not.toBeNull();
  });
});
