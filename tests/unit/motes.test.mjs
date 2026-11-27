// 粒子を動かす処理（src/lib/motes.ts の updateParticles・riverFX・updateGasPoints）の単体テスト。
// 指紋は、motes-cases.mjs の場合の結果（移す前の古い JS と、バイトまで同じだった値）。動きを意図して変えた時や、場合の入力を変えた時は、
// 変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、古い JS の関数と同じ台本（motes-cases.mjs）で比べたため。
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

describe('移す前と同じ', () => {
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
  it('濃い沼で GAS_N に届いても、プレイヤーのまわりは近い所から埋まる（足元と南側も描く）', async () => {
    const keep = { D: here.D, gasAny: blaze.gasAny, x: player.x, z: player.z };
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
    }
  });
});
