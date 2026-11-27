// ミニマップ（src/lib/minimap.ts の sizeMap・drawMap）の単体テスト。
// 指紋は、minimap-cases.mjs の場合の結果（移す前の古い JS と、バイトまで同じだった値）。動きを意図して変えた時や、場合の入力を変えた時は、
// 変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の描き手とキャンバスを、本物の型に合わせられないため。
import { afterAll, describe, expect, it } from 'vitest';
import * as MM from '../../src/lib/minimap.ts';
import { MCH, MCW, MMC, MMR, MPAD } from '../../src/lib/hud.ts';
import { clamp } from '../../src/lib/rng.ts';
import { blaze, here, player, ui } from '../../src/lib/state.ts';
import { CELL, MH, MW, NCELL, SF_DEAD, TF } from '../../src/lib/world.ts';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { fakeCanvas, minimapCases } from './minimap-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
const keep = { mapC: ui.mapC, mctx: ui.mctx };
afterAll(() => Object.assign(ui, keep));

describe('移す前と同じ', () => {
  it('ミニマップ（画面の倍率8通りと、120の階）の指紋', { timeout: 60000 }, async () => {
    const fake = fakeCanvas();
    Object.assign(ui, { mapC: fake.canvas, mctx: fake.ctx });
    const body = await minimapCases(MM, fake, 120);
    expect([fnv(body), body.length]).toEqual(['dbb496dc', 21652486]);
    // 場合が中身を通っているか：マスの分かれ道と、上に重ねる物の文字が全部出る
    const drawn = new Set([...body.matchAll(/^fillText\((.),/gm)].map((m) => m[1]));
    expect('#0:=~,"*^\'+.$%?@/'.split('').filter((ch) => !drawn.has(ch))).toEqual([]);
    // 毒の霧（マスを塗る）・透明な生き物の気配（薄い色）・化けている生き物（?）・鉄格子（金色）を描いた
    expect(body).toMatch(/^fillStyle=rgba\(120,190,60,/m);
    expect(body).toMatch(/^shadowColor=rgb\(92,103,125\)/m);
    expect(body).toMatch(/^shadowColor=#ffd48a/m);
  });
});

describe('火と灰', () => {
  it('燃えている枯れ草と飾りのマスは火（^）、燃え尽きた枯れ草は灰（,）で描く', async () => {
    const keep = {
      here: { D: here.D, monsters: here.monsters, explored: here.explored, mem: here.mem, fovVis: here.fovVis, fovStamp: here.fovStamp },
      blaze: { fire: blaze.fire, burnt: blaze.burnt, cellFlag: blaze.cellFlag, fireLight: blaze.fireLight },
      player: { ...player },
    };
    const fake = fakeCanvas();
    Object.assign(ui, { mapC: fake.canvas, mctx: fake.ctx });
    try {
      const D = gen(await loadEnv(), 1234, PLACES[0]).level;
      Object.assign(here, {
        D,
        monsters: [],
        explored: new Uint8Array(NCELL).fill(1),
        mem: new Float32Array(NCELL * 3),
        fovVis: new Uint32Array(NCELL).fill(1),
        fovStamp: 1,
      });
      Object.assign(blaze, {
        fire: new Float32Array(NCELL),
        burnt: new Uint8Array(NCELL),
        cellFlag: new Uint8Array(NCELL),
        fireLight: new Float32Array(NCELL),
      });
      D.items = [];
      D.traps = [];
      D.webs = [];
      D.gate = null;
      // ただの床のマス（備品・飾り・扉・液体・橋・穴が無い）
      const plain = [];
      for (let i = 0; i < NCELL; i++)
        if (D.tile[i] === TF && !D.liquid[i] && !D.bridge[i] && D.doorAt[i] < 0 && !D.fixCell.has(i) && !D.decoCell.has(i) && !D.pit?.[i])
          plain.push(i);
      const p = plain[Math.floor(plain.length / 2)];
      Object.assign(player, { x: ((p % MW) + 0.5) * CELL, z: (Math.floor(p / MW) + 0.5) * CELL, yaw: 0 });
      const pcx = player.x / CELL,
        pcz = player.z / CELL,
        ox = clamp(Math.floor(pcx) - (MMC >> 1), 0, MW - MMC),
        oy = clamp(Math.floor(pcz) - (MMR >> 1), 0, MH - MMR);
      const near = plain.filter(
        (i) => i !== p && (i % MW) - ox >= 0 && (i % MW) - ox < MMC && Math.floor(i / MW) - oy >= 0 && Math.floor(i / MW) - oy < MMR,
      );
      const [deadFire, deadBurnt, decoFire, deco, dead] = near;
      for (const i of [deadFire, deadBurnt, dead]) D.surface[i] = SF_DEAD;
      blaze.fire[deadFire] = 0.8;
      blaze.burnt[deadBurnt] = 1;
      for (const i of [decoFire, deco]) D.decoCell.set(i, { ch: '%', col: [0.9, 0.88, 0.75] });
      blaze.fire[decoFire] = 0.8;
      MM.drawMap();
      // そのマスに描いた文字（マスの文字は、上に重ねる物より先に描く）
      const chAt = (i) => {
        const x = MPAD + ((i % MW) - ox + 0.5) * MCW,
          y = MPAD + (Math.floor(i / MW) - oy + 0.5) * MCH;
        return fake.log.find((l) => l.endsWith(`,${x},${y})`) && l.startsWith('fillText('))?.slice(9, 10);
      };
      expect([deadFire, deadBurnt, decoFire, deco, dead].map(chAt)).toEqual(['^', ',', '^', '%', '"']);
    } finally {
      Object.assign(here, keep.here);
      Object.assign(blaze, keep.blaze);
      Object.assign(player, keep.player);
    }
  });
});
