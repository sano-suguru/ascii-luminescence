// src/lib/generate.js（迷宮の生成）の単体テスト。Node で動くので、ブラウザの「全部の階」のテストより速い。
// まだ古い JS にある物（生き物の表 MTYPES・ルーンを作る makeRune など）は、本物を古い JS の文から取り出して使う（tools/legacy-eval.mjs）。
import { beforeAll, describe, expect, it } from 'vitest';
import { legacyValues } from '../../tools/legacy-eval.mjs';
import { generateLevel } from '../../src/lib/generate.js';
import { makeHistory } from '../../src/lib/history.ts';
import { RUNE_TYPES } from '../../src/lib/runes.ts';
import { SPECIALS } from '../../src/lib/strata.ts';
import { BRANCHES, FINAL_DEPTH, REALMS } from '../../src/lib/world.ts';

let env;
beforeAll(async () => {
  env = await legacyValues(['MTYPES', 'RUNE_DEF', 'WEAPON_SIG', 'runeUid', 'makeRune', 'rollTraits']);
});

// 全部の場所（ブラウザの __test.places と同じ並び。特別な階の深さは、冒険のシードで少し変わるので、ここでは決まった深さにする）
const SPECIAL_AT = { town: 2, bigroom: 3, oracle: 5, fortress: 9 };
const PLACES = [
  ...Array.from({ length: FINAL_DEPTH }, (_, i) => ({ depth: i + 1 })),
  ...Object.keys(SPECIALS).map((k) => ({ depth: SPECIAL_AT[k], inter: { key: k, after: SPECIAL_AT[k] } })),
  ...Object.values(BRANCHES).flatMap((B) =>
    Array.from({ length: B.len }, (_, i) => ({ depth: B.at[0], branch: { key: B.key, lvl: i + 1, len: B.len, ret: B.at[0] + 1 } })),
  ),
  ...Object.values(REALMS).map((R) => ({ depth: R.minD + 2, realm: { key: R.key, ret: R.minD + 3 } })),
];
const gen = (seed, place, runSeed = 42) =>
  generateLevel(
    seed,
    place.depth,
    {
      runSeed,
      branch: place.branch ?? null,
      realm: place.realm ?? null,
      inter: place.inter ?? null,
      showroom: false,
      hist: makeHistory(runSeed),
      trials: [],
      weapons: RUNE_TYPES.atk.slice(),
    },
    env,
  );
// 階を文字にする（ルーンの番号 uid は、全体の数え上げなので除く）
const text = (r) =>
  JSON.stringify(r, (k, v) =>
    k === 'uid' ? 0 : ArrayBuffer.isView(v) ? Array.from(v) : v instanceof Map ? [...v] : v instanceof Set ? [...v] : v,
  );
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
};

describe('迷宮の生成', () => {
  // ブラウザで続けて生成すると、シード 777 の蛇の穴 2 階などが揺れることがあった（段階6b）。生成に隠れた入力が無いことを確かめる
  it('同じ入力なら、同じ迷宮になる（ほかの階を間に挟んでも、順番を変えても）', () => {
    const first = PLACES.map((pl) => text(gen(777, pl)));
    for (const [i, pl] of [...PLACES.entries()].reverse()) expect(text(gen(777, pl)), `場所 ${JSON.stringify(pl)}`).toBe(first[i]);
  }, 30000);
  it('生き物の表に書き込まない（その階の主と忘れられた獣は、結果として返す）', () => {
    const before = JSON.stringify(env.MTYPES);
    const lords = PLACES.filter((p) => p.branch && p.branch.lvl === p.branch.len).map((p) => gen(5, p));
    expect(JSON.stringify(env.MTYPES)).toBe(before);
    expect(lords.every((r) => r.lordType && r.lordType.boss)).toBe(true);
    expect(PLACES.some((p) => gen(5, p).beastType)).toBe(true);
  });
  it('どの階にも、始まりの場所と下り階段がある', () => {
    for (const [i, pl] of PLACES.entries()) {
      const { level } = gen(11 + i, pl);
      expect(level.tile.length).toBe(level.liquid.length);
      expect(level.start).toBeGreaterThanOrEqual(0);
      expect(level.stairs).toBeGreaterThanOrEqual(0);
    }
  });
  // 移す前と同じ迷宮になることは、ブラウザで main と 150 の階を作り比べて確かめた。その時の生成の指紋
  it('移した時と同じ迷宮になる（全部の場所の指紋）', () => {
    let all = '';
    for (const pl of PLACES) all += text(gen(202, pl));
    expect([fnv(all), all.length]).toEqual(['43db869', 19917081]);
  }, 30000);
});
