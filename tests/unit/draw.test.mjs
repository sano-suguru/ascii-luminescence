// 階に置いてある物を描く処理（src/lib/fixtures.ts）・火と術の跡を描く処理（fx.ts）・先にある物の手がかりと階段の封（omens.ts）・
// 伝説の物の読み方と描く処理（legend.ts）・特別な階の場所（levels.ts）・天井の高さ（lightmap.ts の ceilAt）の単体テスト。
// 指紋の値は、移す前の古い JS（src/game/02・06・13・14・15・20・21・22・24・26）でも同じになる（draw-cases.mjs の場合を、古い関数で数えて確かめた）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import * as FX from '../../src/lib/fixtures.ts';
import * as FXX from '../../src/lib/fx.ts';
import * as LG from '../../src/lib/legend.ts';
import * as LV from '../../src/lib/levels.ts';
import * as LM from '../../src/lib/lightmap.ts';
import * as OM from '../../src/lib/omens.ts';
import { adv } from '../../src/lib/state.ts';
import { BASE_H } from '../../src/lib/world.ts';
import { drawCases } from './draw-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('特別な階の場所・天井の高さ', () => {
  it('大広間と砦は、探索のシードで1つずれる。ほかの名前は undefined', () => {
    const keep = adv.runSeed;
    try {
      const seen = new Set();
      for (let s = 1; s <= 40; s++) {
        adv.runSeed = s * 977;
        seen.add(`${LV.interAt('bigroom')},${LV.interAt('fortress')}`);
        expect([LV.interAt('town'), LV.interAt('oracle'), LV.interAt('none')]).toEqual([2, 5, undefined]);
        expect(LV.interAfter(2)).toBe('town');
        expect(LV.interAfter(1)).toBe(null);
      }
      expect(seen).toEqual(new Set(['3,9', '3,10', '4,9', '4,10']));
    } finally {
      adv.runSeed = keep;
    }
  });
  it('マップの外の天井は BASE_H（階を読まない）', () => {
    expect([LM.ceilAt(-1, 0), LM.ceilAt(0, -1), LM.ceilAt(1e6, 0)]).toEqual([BASE_H, BASE_H, BASE_H]);
  });
});

describe('移す前と同じ', () => {
  it('描く処理と手がかり・伝説の物の読み方（300の場合、25の関数）の指紋', async () => {
    const all = await drawCases({ ...FX, ...FXX, ...OM, ...LG, ...LV, ...LM }, 300),
      lines = all.split('\n'),
      calls = lines.flatMap((l) => JSON.parse(l).calls),
      names = new Set(calls.map((c) => c.name)),
      msgs = new Set(calls.flatMap((c) => c.msg));
    // 場合が中身を通っているか：25の関数が全部呼ばれ、文字を置き、粒子を出し、4つの一度だけの伝言（巣に絡まる・巣が燃える・ブラッドワート・階段の封）が出る
    expect([lines.length, names.size, msgs.size]).toEqual([300, 25, 4]);
    expect(calls.filter((c) => c.dn > 0).length).toBeGreaterThan(1000);
    expect(calls.filter((c) => c.pN > 0).length).toBeGreaterThan(300);
    // 音の乱数（sndRand）を引く場合も通る（手がかりの音の間隔・階段の封のうなり声・音を鳴らす処理）
    expect(new Set(calls.filter((c) => c.sndRand > 0).map((c) => c.name))).toEqual(
      new Set(['drawOmens', 'omenSound', 'drawFixtures', 'drawStairSeal']),
    );
    expect(calls.filter((c) => c.threw).length).toBeLessThan(5);
    expect([fnv(all), all.length]).toEqual(['d9ea2cb8', 5561079]);
  }, 60000);
});
