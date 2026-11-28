// 霧と目の慣れ・岩の中か（src/lib/camera.ts の updateAtmosphere・rockAt）の単体テスト。
// 指紋は、camera-cases.mjs の場合の結果。動きを意図して変えた時や、場合の入力を変えた時は、
// 変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の uniform を本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import { MTYPES } from '../../src/lib/creatures.ts';
import { gfx, here, player, ui, vfx } from '../../src/lib/state.ts';
import { CELL, MW, SF_FOLIAGE, TF } from '../../src/lib/world.ts';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import * as F from '../../src/lib/camera.ts';
import { bodyUnseen } from '../../src/lib/monsters.ts';
import { cameraCases } from './camera-cases.mjs';
import { caseOut } from './case-out.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('指紋', () => {
  it('霧と目の慣れ・岩の中か（40の場合）の指紋', { timeout: 60000 }, async () => {
    const body = await cameraCases(F, 40);
    caseOut('camera', body);
    expect([fnv(body), body.length]).toEqual(['dc804780', 45018]);
    // 場合が中身を通っているか：熱のゆらぎ・水中の見え方・図鑑で目をすぐ合わせる・岩の中の点と外の点
    expect(body).toMatch(/ heat=0\.\d*[1-9]/);
    expect(body).toMatch(/ swim=0\.\d/);
    expect(body).toMatch(/ settle=0$/m);
    expect(body).toMatch(/^rock [01]*1[01]*0|^rock [01]*0[01]*1/m);
  });
});

describe('目の慣れ', () => {
  it('見えない生き物・化けている生き物・水に潜ったうなぎ・沼に沈んだ生き物・3 より遠い茂みの中の生き物は、近くにいても明るさに数えない（見える生き物は数える）', async () => {
    const keep = {
      D: here.D,
      monsters: here.monsters,
      fixtures: here.fixtures,
      x: player.x,
      z: player.z,
      eye: player.eye,
      U: gfx.U,
      fp: gfx.finalPass,
      expo: vfx.expo,
      flash: vfx.flash,
      gallery: ui.gallery,
    };
    try {
      const D = gen(await loadEnv(), 99, PLACES[0]).level;
      // 東へ 5 マス続く床の、西の端に立つ（茂みを東に置くため）
      let pc = 0;
      while ([0, 1, 2, 3, 4, 5].some((k) => D.tile[pc + k] !== TF)) pc++;
      Object.assign(here, { D, fixtures: [] });
      player.x = ((pc % MW) + 0.5) * CELL;
      player.z = (Math.floor(pc / MW) + 0.5) * CELL;
      Object.assign(player, { eye: 1.62 });
      Object.assign(ui, { gallery: null });
      const fp = { uniforms: { uExposure: { value: 1 }, uHeat: { value: 0 }, uSwim: { value: 0 } } };
      Object.assign(gfx, { U: { uFogDen: { value: 0.05 } }, finalPass: fp });
      // 1 フレームだけ進めた露出（同じ所から始める）
      const expoWith = (mons) => {
        here.monsters = mons;
        vfx.expo = 1;
        vfx.flash = 0;
        F.updateAtmosphere(0.1);
        return vfx.expo;
      };
      // 生き物を、プレイヤーから東へ dx の所に置く（マス cx・cz も）
      const near = (ty, extra = {}, dx = 1) => {
        const x = player.x + dx;
        return { x, z: player.z, cx: Math.floor(x / CELL), cz: Math.floor(player.z / CELL), ty, ...extra };
      };
      const none = expoWith([]);
      expect(expoWith([near(MTYPES['P'])])).toBe(none);
      expect(expoWith([near(MTYPES['r'], { hidden: true })])).toBe(none);
      const eel = Object.values(MTYPES).find((t) => t.form === 'eel');
      expect(expoWith([near(eel, { surf: 0 })])).toBe(none);
      expect(expoWith([near(eel, { surf: 0.05 })])).toBe(none);
      expect(expoWith([near(eel, { surf: 0.5 })])).not.toBe(none);
      // 沼に沈んだ生き物（浮かび上がる途中の 0.25 まで）は数えず、姿を現したら数える
      expect(MTYPES['B'].habitat).toBe('bog');
      expect(expoWith([near(MTYPES['B'], { rise: 0.2 })])).toBe(none);
      expect(expoWith([near(MTYPES['B'], { rise: 0.6 })])).not.toBe(none);
      expect(expoWith([near(MTYPES['r'])])).not.toBe(none);
      // 茂みの中の生き物：3 より遠いと数えず、3 以内なら数える
      const grassAt = (dx) => {
        const c = near(MTYPES['r'], {}, dx);
        D.surface[c.cz * MW + c.cx] = SF_FOLIAGE;
        return c;
      };
      expect(expoWith([grassAt(4)])).toBe(none);
      expect(expoWith([grassAt(2.5)])).not.toBe(none);
    } finally {
      Object.assign(here, { D: keep.D, monsters: keep.monsters, fixtures: keep.fixtures });
      Object.assign(player, { x: keep.x, z: keep.z, eye: keep.eye });
      Object.assign(gfx, { U: keep.U, finalPass: keep.fp });
      Object.assign(vfx, { expo: keep.expo, flash: keep.flash });
      Object.assign(ui, { gallery: keep.gallery });
    }
  });
});

describe('描かれない生き物（bodyUnseen。m.visible と目の慣れが使う）', () => {
  it('見えない種類・うなぎ（0.08）・沼の生き物（0.25）・茂み（3）の境', async () => {
    const keep = { D: here.D };
    try {
      const D = gen(await loadEnv(), 99, PLACES[0]).level;
      here.D = D;
      const at = (ty, extra = {}) => ({ x: 0, z: 0, cx: 5, cz: 5, ty, surf: 0, ...extra });
      const eel = Object.values(MTYPES).find((t) => t.form === 'eel');
      D.surface[5 * MW + 5] = 0;
      expect(bodyUnseen(at(MTYPES['r']), 1)).toBe(false);
      expect(bodyUnseen(at(MTYPES['P']), 1)).toBe(true);
      expect(bodyUnseen(at(eel, { surf: 0.08 }), 1)).toBe(true);
      expect(bodyUnseen(at(eel, { surf: 0.0801 }), 1)).toBe(false);
      expect(bodyUnseen(at(MTYPES['B'], { rise: 0.25 }), 1)).toBe(true);
      expect(bodyUnseen(at(MTYPES['B'], { rise: 0.2501 }), 1)).toBe(false);
      expect(bodyUnseen(at(MTYPES['B']), 1)).toBe(true);
      D.surface[5 * MW + 5] = SF_FOLIAGE;
      expect(bodyUnseen(at(MTYPES['r']), 3)).toBe(false);
      expect(bodyUnseen(at(MTYPES['r']), 3.01)).toBe(true);
    } finally {
      here.D = keep.D;
    }
  });
});
