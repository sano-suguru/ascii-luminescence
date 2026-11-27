// 霧と目の慣れ・3人称の自分の姿・岩の断面（src/lib/camera.ts の updateAtmosphere・updateAvatar・rockAt・drawSection）の単体テスト。
// 指紋は、camera-cases.mjs の場合の結果（移す前の古い JS と、バイトまで同じだった値）。動きを意図して変えた時や、場合の入力を変えた時は、
// 変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の uniform を本物の型に合わせられないためと、古い JS の関数と同じ台本（camera-cases.mjs）で比べたため。
import { describe, expect, it } from 'vitest';
import { MTYPES } from '../../src/lib/creatures.ts';
import { gfx, here, player, ui, vfx } from '../../src/lib/state.ts';
import { CELL, MW, TF } from '../../src/lib/world.ts';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import * as F from '../../src/lib/camera.ts';
import { cameraCases } from './camera-cases.mjs';
import { caseOut } from './case-out.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('移す前と同じ', () => {
  it('霧と目の慣れ・自分の姿・岩の断面（40の場合）の指紋', { timeout: 60000 }, async () => {
    const body = await cameraCases(F, 40);
    caseOut('camera', body);
    expect([fnv(body), body.length]).toEqual(['b117d656', 78384]);
    // 場合が中身を通っているか：熱のゆらぎ・水中の見え方・図鑑で目をすぐ合わせる・岩の断面を描く
    expect(body).toMatch(/ heat=0\.\d*[1-9]/);
    expect(body).toMatch(/ swim=0\.\d/);
    expect(body).toMatch(/ settle=0$/m);
    expect(body).toMatch(/^section f0 n=[1-9]/m);
  });
});

describe('目の慣れ', () => {
  it('見えない生き物・化けている生き物・水に潜ったうなぎは、近くにいても明るさに数えない（見える生き物は数える）', async () => {
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
      camMode: ui.camMode,
    };
    try {
      const D = gen(await loadEnv(), 99, PLACES[0]).level;
      let pc = 0;
      while (D.tile[pc] !== TF) pc++;
      Object.assign(here, { D, fixtures: [] });
      player.x = ((pc % MW) + 0.5) * CELL;
      player.z = (Math.floor(pc / MW) + 0.5) * CELL;
      Object.assign(player, { eye: 1.62 });
      Object.assign(ui, { gallery: null, camMode: 'fps' });
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
      const near = (ty, extra = {}) => ({ x: player.x + 1, z: player.z, ty, ...extra });
      const none = expoWith([]);
      expect(expoWith([near(MTYPES['P'])])).toBe(none);
      expect(expoWith([near(MTYPES['r'], { hidden: true })])).toBe(none);
      const eel = Object.values(MTYPES).find((t) => t.form === 'eel');
      expect(expoWith([near(eel, { surf: 0 })])).toBe(none);
      expect(expoWith([near(eel, { surf: 0.5 })])).not.toBe(none);
      expect(expoWith([near(MTYPES['r'])])).not.toBe(none);
    } finally {
      Object.assign(here, { D: keep.D, monsters: keep.monsters, fixtures: keep.fixtures });
      Object.assign(player, { x: keep.x, z: keep.z, eye: keep.eye });
      Object.assign(gfx, { U: keep.U, finalPass: keep.fp });
      Object.assign(vfx, { expo: keep.expo, flash: keep.flash });
      Object.assign(ui, { gallery: keep.gallery, camMode: keep.camMode });
    }
  });
});
