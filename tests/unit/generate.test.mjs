// src/lib/generate.js（迷宮の生成）の単体テスト。Node で動くので、ブラウザの「全部の階」のテストより速い。
// まだ古い JS にある物（生き物の表 MTYPES・ルーンを作る makeRune など）は、本物を古い JS の文から取り出して使う（tools/legacy-eval.mjs）。
import { beforeAll, describe, expect, it } from 'vitest';
import { legacyValues } from '../../tools/legacy-eval.mjs';
import { reachProblems } from '../reach.mjs';
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
// 階を文字にする。ルーンの番号 uid は、全体の数え上げなので除く。日本語の文（伝言・名前・碑文など）も、言い回しを直すたびに
// 指紋が変わらないように、印に置き換える（かなを含むか、漢字が2字以上の文字列。1字の漢字は、描く文字のことがあるので残す）
const PROSE = /[\u3040-\u30ff]|[\u4e00-\u9fff].*[\u4e00-\u9fff]/u;
const text = (r) =>
  JSON.stringify(r, (k, v) =>
    k === 'uid'
      ? 0
      : typeof v === 'string' && PROSE.test(v)
        ? '文'
        : ArrayBuffer.isView(v)
          ? Array.from(v)
          : v instanceof Map
            ? [...v]
            : v instanceof Set
              ? [...v]
              : v,
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
  // ブラウザ（Chromium）と Node で同じ迷宮になることを、190 の階を作り比べて確かめた（混ぜるのを shuffle にした時）。その時の生成の指紋（日本語の文は除く）。
  // 生成を変えると変わる。意図して変えた時は、ブラウザでも同じになることを確かめてから作り直す
  it('今の迷宮と同じになる（全部の場所の指紋）', () => {
    let all = '';
    for (const pl of PLACES) all += text(gen(202, pl));
    expect([fnv(all), all.length]).toEqual(['1bf236b2', 20044633]);
  }, 30000);
  it('歩いて行けるかの調べ方：壁や深い水の向こうの物を見つける（作った小さな階で）', () => {
    // 70 マス×3 行。1 行目だけが床で、x=5 が壁、x=8 が深い水
    const tile = new Uint8Array(210),
      liquid = new Uint8Array(210);
    for (let x = 0; x < 70; x++) tile[70 + x] = 1;
    tile[75] = 0;
    liquid[78] = 2;
    const L = { tile, liquid, start: 71, stairs: 74, bstairs: null, portal: null, upstairs: -1, items: [{ kind: 'rune', i: 77 }] };
    expect(reachProblems(L, false)).toEqual(['物（rune） @7,1']);
    expect(reachProblems({ ...L, stairs: 80, items: [] }, false)).toEqual(['階段 @10,1']);
    expect(reachProblems({ ...L, stairs: -1, items: [] }, false)).toEqual(['階段が無い']);
    expect(reachProblems({ ...L, stairs: -1, items: [] }, true)).toEqual([]);
  });
  // ブラウザの tests/levels.mjs（20 シード）と同じ決まり。ここでは少ないシードで、編集のたびに確かめる
  it('始まりの場所から、階段・入口・門・置かれた物まで歩いて行ける（5 シード）', () => {
    const fails = [];
    for (const seed of [3, 58, 777, 4096, 31337])
      for (const pl of PLACES) {
        const final = pl.depth === FINAL_DEPTH && !pl.branch && !pl.realm && !pl.inter;
        const missing = reachProblems(gen(seed, pl, seed).level, final);
        if (missing.length) fails.push(`シード ${seed} ${JSON.stringify(pl)}：${missing.join('、')}`);
      }
    expect(fails).toEqual([]);
  }, 30000);
});
