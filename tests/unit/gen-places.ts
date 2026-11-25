// 迷宮の生成のテストの共通部分（generate.test.ts と reach.test.ts）：全部の場所と、決まった入力で生成する gen。
import { lookup } from '../../src/lib/array.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { type BranchPlace, type GenEnv, type GenResult, type InterPlace, type RealmPlace, generateLevel } from '../../src/lib/generate.ts';
import { makeHistory } from '../../src/lib/history.ts';
import { RUNE_TYPES, rollTraits } from '../../src/lib/runes.ts';
import { makeRune } from '../../src/lib/gear.ts';
import { SPECIALS } from '../../src/lib/strata.ts';
import { BRANCHES, FINAL_DEPTH, REALMS } from '../../src/lib/world.ts';

/** 生成に渡す物（生き物の表は src/lib/creatures.ts、ルーンを作る makeRune は src/lib/gear.ts、特性を決める rollTraits は src/lib/runes.ts） */
export const loadEnv = async (): Promise<GenEnv> => ({ MTYPES, makeRune, rollTraits });

/** 生成する場所（深さと、支道・異界・特別な階のどれか） */
export interface Place {
  depth: number;
  branch?: BranchPlace;
  realm?: RealmPlace;
  inter?: InterPlace;
}
// 全部の場所（ブラウザの __test.places と同じ並び。特別な階の深さは、探索のシードで少し変わるので、ここでは決まった深さにする）
const SPECIAL_AT: Record<string, number> = { town: 2, bigroom: 3, oracle: 5, fortress: 9 };
export const PLACES: Place[] = [
  ...Array.from({ length: FINAL_DEPTH }, (_, i) => ({ depth: i + 1 })),
  ...Object.keys(SPECIALS).map((k) => ({ depth: lookup(SPECIAL_AT, k), inter: { key: k, after: lookup(SPECIAL_AT, k) } })),
  ...Object.values(BRANCHES).flatMap((B) =>
    Array.from({ length: B.len }, (_, i) => ({ depth: B.at[0], branch: { key: B.key, lvl: i + 1, len: B.len, ret: B.at[0] + 1 } })),
  ),
  ...Object.values(REALMS).map((R) => ({ depth: R.minD + 2, realm: { key: R.key, ret: R.minD + 3 } })),
];
/** 最深部か（階段が無くてよい） */
export const isFinal = (pl: Place): boolean => pl.depth === FINAL_DEPTH && !pl.branch && !pl.realm && !pl.inter;
/** 場所 place を、階のシード seed・探索のシード runSeed で生成する */
export const gen = (env: GenEnv, seed: number, place: Place, runSeed = 42): GenResult =>
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
