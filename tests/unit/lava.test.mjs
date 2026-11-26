// 溶岩の流れ（src/lib/events.ts の火口の噴き上がり erupt と、部屋の出来事の流れ lavaflow）と、吹き飛ばし（src/lib/projs.ts の updateStatuses）の単体テスト。
// 火山の異界の本物の階に、壁で囲んだ床の区画を書き込み（区画の中は全部書き直し、生き物・備品・出来事も消すので、迷宮の生成が変わっても結果は変わらない）、
// 生き物と出来事を置いて、updateEvents・updateStatuses を直に呼ぶ。updateMonster は呼ばないので、生き物は置いた所から歩かない。
// プレイヤーは区画の外（溶岩を流さない近さ 1.6 より遠く）に置く。
// テストを .mjs で書くのは、偽の画面の部品を本物の型に合わせられないため。
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { updateEvents } from '../../src/lib/events.ts';
import { initFire } from '../../src/lib/ground.ts';
import { makeMonster } from '../../src/lib/monsters.ts';
import { updateStatuses } from '../../src/lib/projs.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { blaze, clock, fight, gfx, here, player } from '../../src/lib/state.ts';
import { CELL, LQ_LAVA, MW, NCELL, TF, TW } from '../../src/lib/world.ts';
import { fakeDom } from './fight-cases.mjs';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';

/** 区画（壁を含む）：横 X0〜X1、縦 Z0〜Z1 のマス。内側が床 */
const X0 = 6,
  X1 = 30,
  Z0 = 6,
  Z1 = 20;
const at = (x, z) => z * MW + x;
const lava = (i) => here.D.liquid[i] === LQ_LAVA;
let restore = null,
  keepRandom = null;

beforeEach(async () => {
  const D = gen(
    await loadEnv(),
    7,
    PLACES.find((p) => p.realm?.key === 'volcano'),
  ).level;
  Object.assign(here, { D, fixtures: [], events: [], monsters: [], fovVis: new Uint32Array(NCELL), fovStamp: 1 });
  for (let z = Z0; z <= Z1; z++)
    for (let x = X0; x <= X1; x++) {
      const i = at(x, z);
      D.tile[i] = z === Z0 || z === Z1 || x === X0 || x === X1 ? TW : TF;
      D.liquid[i] = 0;
      D.gas[i] = 0;
      D.solid.delete(i);
    }
  initFire();
  for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) blaze.fuel[at(x, z)] = 0;
  Object.assign(blaze, { frozen: new Map(), trampled: [] });
  Object.assign(fight, { laters: [], zones: [], rains: [], clouds: [], marks: [] });
  gfx.cellTex = { needsUpdate: false };
  clock.time = 100;
  // 区画の外の壁の中（溶岩を流すマスから遠い）
  Object.assign(player, { x: 1, z: 1 });
  keepRandom = Math.random;
  Math.random = mulberry32(1);
  restore = swapGlobals({ document: fakeDom().document, performance: { now: () => clock.time * 1000 } });
});
afterEach(() => {
  restore?.();
  Math.random = keepRandom;
});

/** 種類 key の生き物を、マス (x, z) の真ん中（dx・dz でずらす）に、吹き飛びの速さ kx・kz で置く */
function put(key, x, z, { dx = 0, dz = 0, kx = 0, kz = 0 } = {}) {
  const m = makeMonster({ key, cx: x, cz: z, g: -1 });
  Object.assign(m, { x: (x + 0.5) * CELL + dx, z: (z + 0.5) * CELL + dz, cx: x, cz: z, tx: x, tz: z, kx, kz, st: {} });
  here.monsters.push(m);
  return m;
}
/** 部屋の出来事を sec 秒、0.1 秒ずつ進める。each は1歩ごとに呼ぶ（true を返したら止める） */
function runEvents(sec, each = () => false) {
  for (let q = 0; q < Math.round(sec * 10); q++) {
    clock.time += 0.1;
    updateEvents(0.1, clock.time);
    if (each()) return;
  }
}
/** 部屋の出来事を sec 秒進め、噴き上がり evs のそれぞれが引き始めた（状態 2 → 3）その時の、流れる順のマスのうち溶岩でない物を返す（after は1歩ごとに呼ぶ） */
function holesAtRecede(evs, sec, after = () => {}) {
  const prev = new Map(evs.map((e) => [e, e.state])),
    holes = new Map();
  runEvents(sec, () => {
    for (const e of evs) {
      if (prev.get(e) === 2 && e.state === 3)
        holes.set(
          e,
          e.order.filter((i) => !lava(i)),
        );
      prev.set(e, e.state);
    }
    after();
    return false;
  });
  return evs.map((e) => holes.get(e));
}
/** 横一列のマス（z の行の x0 から x1 へ。x1 < x0 なら西へ） */
const row = (z, x0, x1) => Array.from({ length: Math.abs(x1 - x0) + 1 }, (_, k) => at(x0 + (x1 >= x0 ? k : -k), z));
/** 区画の中で溶岩のマスの数 */
function lavaCount() {
  let n = 0;
  for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) if (lava(at(x, z))) n++;
  return n;
}

describe('溶岩の流れ', () => {
  it('溶岩に住む生き物（サラマンダー）のいるマスには流す（歩けない生き物のいるマスには流さない）', () => {
    const ways = [row(10, 8, 17), row(14, 8, 17)];
    here.events.push(
      { type: 'erupt', src: ways[0][0], order: ways[0].slice(), state: 0, t: 0.01, k: 0 },
      { type: 'lavaflow', ri: -1, src: ways[1][0], order: ways[1].slice(), state: 1, t: 0, k: 0 },
    );
    const mobs = ways.map((w) => [put('l', 12, Math.floor(w[0] / MW)), put('k', 15, Math.floor(w[0] / MW))]);
    // 噴き上がりが流し終えて待つ間（状態 2）。部屋の出来事の流れも流し終えている（状態 2）。塞がれたマスを 10 回試し直す分、長くかかる
    runEvents(10);
    expect(here.events.map((e) => e.state)).toEqual([2, 2]);
    for (const [sal, kob] of mobs) {
      expect(lava(at(sal.cx, sal.cz))).toBe(true);
      expect(lava(at(kob.cx, kob.cz))).toBe(false);
    }
    // 流れる順のうち、歩けない生き物のいるマスのほかは、全部溶岩
    for (const [w, [, kob]] of ways.map((w, n) => [w, mobs[n]])) expect(w.filter((i) => !lava(i))).toEqual([at(kob.cx, kob.cz)]);
  });

  it('2つの火口の流れる道が重なり、先に噴き上がった方が先に引く：後の火口は、先の溶岩が引いた後に流し、穴を残さない', () => {
    const A = { type: 'erupt', src: at(8, 10), order: row(10, 8, 17), state: 0, t: 0.01, k: 0 },
      B = { type: 'erupt', src: at(23, 10), order: row(10, 23, 14), state: 0, t: 3, k: 0 };
    here.events.push(A, B);
    const holes = holesAtRecede([A, B], 20);
    expect(holes).toEqual([[], []]);
    expect([A.state, B.state]).toEqual([0, 0]);
    expect(lavaCount()).toBe(0);
  });

  it('2つの火口の流れる道が重なり、後に噴き上がった方が先に引く：先の火口の溶岩を消さない', () => {
    const A = { type: 'erupt', src: at(8, 10), order: row(10, 8, 17), state: 0, t: 0.01, k: 0 },
      B = { type: 'erupt', src: at(23, 10), order: row(10, 23, 14), state: 0, t: 3, k: 0 };
    here.events.push(A, B);
    // B が流し終えたら（状態 2）、A の待つ時計を 20 秒のばして、B より後に引かせる
    let moved = false;
    const holes = holesAtRecede([A, B], 37, () => {
      if (!moved && B.state === 2) {
        A.t += 20;
        moved = true;
      }
    });
    expect(moved).toBe(true);
    expect(holes).toEqual([[], []]);
    expect([A.state, B.state]).toEqual([0, 0]);
    expect(lavaCount()).toBe(0);
  });

  for (const first of ['erupt', 'lavaflow'])
    it(`部屋の出来事の流れの溶岩は、重なる噴き上がりが引いても消えない（先に流すのは ${first}）`, () => {
      const E = { type: 'erupt', src: at(8, 10), order: row(10, 8, 17), state: 0, t: first === 'erupt' ? 0.01 : 3, k: 0 },
        F = { type: 'lavaflow', ri: -1, src: at(20, 10), order: row(10, 20, 14), state: first === 'lavaflow' ? 1 : 0, t: 0, k: 0 };
      here.events.push(E, F);
      // 噴き上がりが先なら、流し終えた後（3 秒）に、部屋の出来事の流れを始める（状態 0 のままでは、プレイヤーが部屋に入るまで流れない）
      runEvents(3);
      if (F.state === 0) F.state = 1;
      // 噴き上がりが引き終えるまで
      runEvents(30, () => E.state === 0 && clock.time > 120);
      expect(E.state).toBe(0);
      expect(F.state).toBe(2);
      expect(F.order.filter((i) => !lava(i))).toEqual([]);
      // 噴き上がりだけが流したマスは、引いて溶岩でなくなる
      expect(E.order.filter((i) => !F.order.includes(i) && lava(i))).toEqual([]);
    });
});

describe('吹き飛ばし', () => {
  /** 生き物 m の体の東の端と、東隣のマス（x + 1）の西の縁との間（0 以上なら、体は東隣にかかっていない） */
  const gapEast = (m, x) => (x + 1) * CELL - (m.x + 0.35 * m.ty.scale);

  it('速さが 0 になるフレームに壁へ入っても、動いた分を戻して壁の手前に残る', () => {
    here.D.tile[at(13, 10)] = TW;
    // 壁の 0.001 手前。速さ 0.06 は、このフレームで 0.002 動き、減って 0.05 を切るので 0 になる
    const m = put('k', 12, 10, { dx: CELL / 2 - 0.001, kx: 0.06 });
    updateStatuses(1 / 30);
    expect([m.kx, m.kz]).toEqual([0, 0]);
    expect(Math.floor(m.x / CELL)).toBe(12);
    expect(m.x).toBeCloseTo(13 * CELL - 0.001, 9);
  });

  it('速さが 0 になるフレームに溶岩へ入っても、動いた分を戻して溶岩の手前に残る', () => {
    here.D.liquid[at(13, 10)] = LQ_LAVA;
    const k = put('k', 12, 10, { kx: 0.06 }),
      r = 0.35 * k.ty.scale;
    // 体の東の端が、溶岩の 0.001 手前
    k.x = 13 * CELL - r - 0.001;
    const x0 = k.x;
    updateStatuses(1 / 30);
    expect([k.kx, k.kz]).toEqual([0, 0]);
    expect(k.x).toBe(x0);
    expect(gapEast(k, 12)).toBeGreaterThan(0);
  });

  it('北と西の両側に溶岩がある時、竜を浅くかかる西の溶岩へ吹き飛ばしても、それより深くは入らない', () => {
    // 北隣（15, 11）と西隣（14, 12）が溶岩。竜（体の半径 1.05）は、北の溶岩に 0.85、西の溶岩に 0.35 かかる
    here.D.liquid[at(15, 11)] = LQ_LAVA;
    here.D.liquid[at(14, 12)] = LQ_LAVA;
    const d = put('D', 15, 12, { dx: -0.3, dz: -0.8, kx: -6 }),
      x0 = d.x;
    expect(15 * CELL - (x0 - 0.35 * d.ty.scale)).toBeCloseTo(0.35, 9);
    for (let q = 0; q < 60; q++) updateStatuses(1 / 30);
    // 西へ動くと、北の溶岩にかかる深さは変わらず、西の溶岩に深く入るので、動かない
    expect([d.kx, d.kz]).toEqual([0, 0]);
    expect(d.x).toBe(x0);
  });

  it('体の真ん中が溶岩のマスに入っている生き物は、もっと深くへは吹き飛ばない（溶岩から出る向きには動く）', () => {
    for (let z = Z0 + 1; z < Z1; z++) here.D.liquid[at(15, z)] = LQ_LAVA;
    // 15 列目の溶岩の、西の縁から 0.3 入った所
    const deeper = put('T', 15, 12, { dx: -CELL / 2 + 0.3, kx: 8 }),
      x0 = deeper.x;
    for (let q = 0; q < 60; q++) updateStatuses(1 / 30);
    expect(deeper.x).toBe(x0);
    here.monsters.length = 0;
    const out = put('T', 15, 12, { dx: -CELL / 2 + 0.3, kx: -8 });
    for (let q = 0; q < 60; q++) updateStatuses(1 / 30);
    expect(out.x).toBeLessThan(x0);
  });
});
