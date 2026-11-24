// 迷宮の生成のテストの共通部分（generate.test.ts と reach.test.ts）：全部の場所と、決まった入力で生成する gen。
// まだ古い JS にある物（生き物の表 MTYPES・ルーンを作る makeRune など）は、本物を古い JS の文から取り出して使う（tools/legacy-eval.mjs）。
import { legacyValues } from '../../tools/legacy-eval.mjs';
import { type BranchPlace, type GenEnv, type GenResult, type InterPlace, type RealmPlace, generateLevel } from '../../src/lib/generate.ts';
import { makeHistory } from '../../src/lib/history.ts';
import { RUNE_TYPES } from '../../src/lib/runes.ts';
import { SPECIALS } from '../../src/lib/strata.ts';
import { BRANCHES, FINAL_DEPTH, REALMS } from '../../src/lib/world.ts';

/** 生成に渡す、まだ古い JS にある物（テストの beforeAll で1回読む） */
export const loadEnv = (): Promise<GenEnv> =>
  legacyValues<GenEnv>(['MTYPES', 'RUNE_DEF', 'WEAPON_SIG', 'runeUid', 'makeRune', 'rollTraits']);

/** 生成する場所（深さと、支道・異界・特別な階のどれか） */
export interface Place {
  depth: number;
  branch?: BranchPlace;
  realm?: RealmPlace;
  inter?: InterPlace;
}
// 全部の場所（ブラウザの __test.places と同じ並び。特別な階の深さは、冒険のシードで少し変わるので、ここでは決まった深さにする）
const SPECIAL_AT: Record<string, number> = { town: 2, bigroom: 3, oracle: 5, fortress: 9 };
export const PLACES: Place[] = [
  ...Array.from({ length: FINAL_DEPTH }, (_, i) => ({ depth: i + 1 })),
  ...Object.keys(SPECIALS).map((k) => ({ depth: SPECIAL_AT[k] as number, inter: { key: k, after: SPECIAL_AT[k] as number } })),
  ...Object.values(BRANCHES).flatMap((B) =>
    Array.from({ length: B.len }, (_, i) => ({ depth: B.at[0], branch: { key: B.key, lvl: i + 1, len: B.len, ret: B.at[0] + 1 } })),
  ),
  ...Object.values(REALMS).map((R) => ({ depth: R.minD + 2, realm: { key: R.key, ret: R.minD + 3 } })),
];
/** 最深部か（階段が無くてよい） */
export const isFinal = (pl: Place): boolean => pl.depth === FINAL_DEPTH && !pl.branch && !pl.realm && !pl.inter;
/** 場所 place を、階のシード seed・冒険のシード runSeed で生成する */
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
