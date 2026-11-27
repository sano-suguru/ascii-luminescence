// 階ごとに祭壇とルーンを置く処理（src/lib/altars.ts の placeRunesForLevel・mainPathAltars・strongestKey・nearStele）と、
// 階のシード（src/lib/levels.ts）・生き物の強さ（src/lib/creatures.ts の MSTAT と src/lib/monsters.ts の statOf）・墓のルーン（src/lib/gear.ts の graveRune）・
// 試練（src/lib/unlocks.ts の trialOn）の単体テスト。
// 指紋の値は、移す前の古い JS（src/game/17-meta.js・18-level-player.js・21-altars-heal.js）でも同じになる（place-cases.ts の場合を、古い関数で数えて確かめた）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、置く処理の指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
import { describe, expect, it } from 'vitest';
import * as AL from '../../src/lib/altars.ts';
import { lookup } from '../../src/lib/array.ts';
import { MSTAT, MTYPES } from '../../src/lib/creatures.ts';
import { graveRune } from '../../src/lib/gear.ts';
import { levelSeed } from '../../src/lib/levels.ts';
import { statOf } from '../../src/lib/monsters.ts';
import { adv, here } from '../../src/lib/state.ts';
import { trialOn } from '../../src/lib/unlocks.ts';
import { placeCases, smallCases } from './place-cases.ts';
import { caseOut } from './case-out.mjs';

const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
const F = { ...AL, levelSeed, statOf, graveRune, trialOn };

describe('階のシード・生き物の強さ・墓のルーン', () => {
  it('階のシードは 0 にならない（計算が 0 になる時は 1）', () => {
    const keep = [adv.runSeed, here.depth, here.branch, here.realm, here.inter] as const;
    try {
      Object.assign(here, { depth: 0, branch: null, realm: null, inter: null });
      adv.runSeed = 0;
      expect(levelSeed()).toBe(1);
    } finally {
      [adv.runSeed, here.depth, here.branch, here.realm, here.inter] = keep;
    }
  });
  it('強さの表には、王の影の2つの姿と、試しの間の的もある。表に無い種類は並の強さ', () => {
    expect([MSTAT['final'], MSTAT['final2'], MSTAT['dummyT']]).toEqual([
      [260, 6, 11, 1.7],
      [260, 8, 14, 1.25],
      [60, 0, 0, 99],
    ]);
    expect(statOf({ ty: lookup(MTYPES, 'r'), key: 'nope' })).toEqual([12, 2, 5, 1.2]);
  });
  it('墓のルーンは強い版でなくなり、特性はそれぞれ1段下がる（0段の特性は消える）', () => {
    const ru = graveRune({
      type: 'blade',
      strong: true,
      traits: [
        { k: 'a', lv: 3 },
        { k: 'b', lv: 1 },
      ],
    });
    expect([ru.strong, ru.traits]).toEqual([false, [{ k: 'a', lv: 2 }]]);
  });
});

describe('移す前と同じ', () => {
  it('階のシード・試練・墓のルーン（400の場合）と、生き物の強さ（全部の種類、試練のあり・なし）の指紋', () => {
    const all = smallCases(F, 400);
    caseOut('place-1', all);
    expect([fnv(all), all.length]).toEqual(['e45d554b', 79502]);
  });
  it('階ごとに祭壇とルーンを置く（10シード×全部の場所、300の場合）の指紋', async () => {
    const all = await placeCases(F, 10),
      lines = all.split('\n'),
      count = (re: RegExp): number => lines.filter((l) => re.test(l)).length;
    // 場合が中身を通っているか：本道と脇道の祭壇・鍛えの祭壇・泉・墓・強敵の褒美・深さ1の台・最初の祭壇・十字路・階段の前の群れ・取った物が、それぞれ出てくる
    expect([
      lines.length,
      count(/altar\d+m/),
      count(/altar\d+s/),
      count(/"forge":true/),
      count(/"kind":"spring"/),
      count(/"kind":"grave"/),
      count(/"elitePrize":true/),
      count(/"pedestal":true/),
      count(/"altar1"/),
      count(/"hub":\{/),
      count(/"stairGuard":\d/),
      count(/"taken":true/),
    ]).toEqual([300, 232, 18, 27, 154, 45, 52, 6, 4, 135, 40, 60]);
    caseOut('place-2', all);
    expect([fnv(all), all.length]).toEqual(['6ab8037c', 790161]);
  }, 60000);
});
