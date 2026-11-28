// 粒子を動かす処理（src/lib/motes.ts の updateParticles・riverFX・updateGasPoints）の単体テスト。
// 指紋は、motes-cases.mjs の場合の結果。動きを意図して変えた時や、場合の入力を変えた時は、
// 変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
import { describe, expect, it } from 'vitest';
import { DUST_N, GAS_N, P0 } from '../../src/lib/shaders.ts';
import { blaze, here, player } from '../../src/lib/state.ts';
import { CELL, MH, MW } from '../../src/lib/world.ts';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import * as F from '../../src/lib/motes.ts';
import * as A from '../../src/lib/particles.ts';
import { caseOut } from './case-out.mjs';
import { motesCases } from './motes-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('指紋', () => {
  it('塵・ガスの粒・川のさざ波・粒子（40の場合）の指紋', { timeout: 60000 }, async () => {
    const body = await motesCases(F, A, 40);
    caseOut('motes', body);
    expect([fnv(body), body.length]).toEqual(['65b0edfd', 162809]);
    // 場合が中身を通っているか：ガスの粒が上限まで出る・止めると消える、粒子が尽きて減る、川のさざ波が出る
    expect(body).toMatch(/ gas=700 /);
    expect(body).toMatch(/^gasoff pN=\d+ gas=0 /m);
  });
});

describe('ガスの粒', () => {
  it('上限に届かない時は、ガスのあるマスごとに、濃さどおりの数の粒が、そのマスに出る（置く順番によらない）', async () => {
    const keep = { D: here.D, gasAny: blaze.gasAny, x: player.x, z: player.z },
      arrays = [A.ptPos, A.ptCol, A.ptSize, A.ptGly].map((a) => [a, a.slice()]);
    try {
      const D = gen(await loadEnv(), 4321, PLACES[0]).level;
      here.D = D;
      const pcx = Math.floor(MW / 2),
        pcz = Math.floor(MH / 2);
      player.x = (pcx + 0.5) * CELL;
      player.z = (pcz + 0.5) * CELL;
      // まばらなガス（境の値も）：まわり 12 マスの四角の中と外
      D.gas.fill(0);
      const VALS = [0.0399, 0.04, 0.1, 0.15, 0.2, 0.35, 0.36, 0.9];
      for (let k = 0; k < 160; k++) {
        const cx = pcx - 14 + ((k * 7) % 29),
          cz = pcz - 14 + ((k * 13) % 29);
        D.gas[cz * MW + cx] = VALS[k % VALS.length];
      }
      blaze.gasAny = true;
      F.updateGasPoints(1.5);
      const want = new Map(),
        got = new Map();
      let total = 0;
      for (let cz = pcz - 12; cz <= pcz + 12; cz++)
        for (let cx = pcx - 12; cx <= pcx + 12; cx++) {
          const v = D.gas[cz * MW + cx];
          if (v < 0.04) continue;
          const n = v > 0.35 ? 3 : v > 0.15 ? 2 : 1;
          want.set(cz * MW + cx, n);
          total += n;
        }
      expect(total).toBeLessThan(GAS_N);
      for (let j = DUST_N; j < P0; j++) {
        if (!(A.ptSize[j] > 0)) continue;
        const c = Math.floor(A.ptPos[j * 3 + 2] / CELL) * MW + Math.floor(A.ptPos[j * 3] / CELL);
        got.set(c, (got.get(c) ?? 0) + 1);
      }
      expect([...got].sort((a, b) => a[0] - b[0])).toEqual([...want].sort((a, b) => a[0] - b[0]));
    } finally {
      Object.assign(here, { D: keep.D });
      blaze.gasAny = keep.gasAny;
      player.x = keep.x;
      player.z = keep.z;
      for (const [a, copy] of arrays) a.set(copy);
    }
  });

  it('濃い沼で GAS_N に届いても、プレイヤーのまわりは近い所から埋まる（足元と南側も描く）', async () => {
    const keep = { D: here.D, gasAny: blaze.gasAny, x: player.x, z: player.z },
      arrays = [A.ptPos, A.ptCol, A.ptSize, A.ptGly].map((a) => [a, a.slice()]);
    try {
      const D = gen(await loadEnv(), 4321, PLACES[0]).level;
      here.D = D;
      D.gas.fill(1);
      blaze.gasAny = true;
      const pcx = Math.floor(MW / 2),
        pcz = Math.floor(MH / 2);
      player.x = (pcx + 0.5) * CELL;
      player.z = (pcz + 0.5) * CELL;
      F.updateGasPoints(0);
      // 粒は全部使われ、どれもプレイヤーから 9 マスほどの円の中（四角の北の端の行まで届かない）
      let far = 0,
        south = 0,
        here0 = 0;
      for (let j = DUST_N; j < P0; j++) {
        expect(A.ptSize[j]).toBeGreaterThan(0);
        const cx = Math.floor(A.ptPos[j * 3] / CELL),
          cz = Math.floor(A.ptPos[j * 3 + 2] / CELL);
        far = Math.max(far, Math.hypot(cx - pcx, cz - pcz));
        if (cz > pcz) south++;
        if (cx === pcx && cz === pcz) here0++;
      }
      expect(GAS_N).toBe(P0 - DUST_N);
      expect(far).toBeLessThan(9.5);
      expect(here0).toBe(3);
      expect(south).toBeGreaterThan(GAS_N / 3);
    } finally {
      Object.assign(here, { D: keep.D });
      blaze.gasAny = keep.gasAny;
      player.x = keep.x;
      player.z = keep.z;
      for (const [a, copy] of arrays) a.set(copy);
    }
  });
});
