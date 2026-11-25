// 迷宮の大きさとタイル・液体と地面・支道と異界・深さごとの割合（depthProfile）と層ごとの霧の色（FOGS）・岩の色（もとは src/game/02-constants.js と、03・06 の一部）。
import { clamp } from './rng.ts';

/** 1マスの大きさ（m）・天井の高さ・目の高さ・迷宮の横と奥のマスの数・マスの数 */
export const CELL = 2,
  BASE_H = 3.2,
  EYE = 1.62,
  MW = 70,
  MH = 46,
  NCELL = MW * MH,
  CH_D = 9;
/** タイルの種類（壁・床・柱 など） */
export const TW = 0,
  TF = 1,
  TP = 2,
  TC = 3,
  TX = 4;
export const NSL = 96,
  NDL = 6;
export const PR = 0.3;
/** 一番深い階（王の影がいる最深部） */
export const FINAL_DEPTH = 13;
/** 上下左右の4方向 */
export const D4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
/** 描画のまとまり（チャンク）の大きさと、横・奥の数 */
export const CHUNK = 8,
  CXN = Math.ceil(MW / CHUNK),
  CZN = Math.ceil(MH / CHUNK);

// terrain layers (after Brogue's dungeon / liquid / surface layers)
export const LQ_WATER = 1,
  LQ_DEEP = 2,
  LQ_LAVA = 3,
  LQ_BOG = 4;
/** 歩いて渡れない液体か（溶岩・深い水） */
export const blocksWalk = (l: number): boolean => l === LQ_LAVA || l === LQ_DEEP;
export const SF_GRASS = 1,
  SF_LUMEN = 2,
  SF_OBSIDIAN = 3,
  SF_DEAD = 4,
  SF_RUBBLE = 5,
  SF_ICE = 6,
  SF_FOLIAGE = 7,
  SF_FUNGFOR = 8,
  SF_BRIM = 9,
  SF_MUD = 10,
  SF_HAY = 11;

/** 廃墟・砦の部屋に入った時の言葉 */
export const RUIN_KIND_MSG: Record<string, string> = {
  atrium: '吹き抜けの遥か上から、青白い光が降り注いでいる。',
  plaza: '広場の中央に、石を刻んだ巨像がそびえている。',
  garden: '廃墟を呑み込むように、草木が生い茂っている。',
};
export const FORT_KIND_MSG: Record<string, string> = {
  dining: '長い石の食卓が並ぶ食堂。皿も杯も、埃をかぶったままだ。',
  forge: '冷えた炉と金床が並ぶ鍛冶場。槌の音は、とうに途絶えている。',
  flooded: 'この広間は水に沈んでいる。上の階から、ゆっくりと水が染み出してきたのだろう。',
};
/** 神託所の予言 */
export const PROPHECIES: string[] = [
  '石の回廊の先で大地は口を開け、星のような光が天井を覆うだろう。',
  '水底の影に気をつけよ。光る湖は、何かを抱いて眠っている。',
  '巨像の眼はまだ見ている。名を失った王たちの時代を。',
  'やがて足元は燃える海となり、黒い島々だけが道を示す。',
  '最後には何もない闇がある。そこでは落ちることだけが、先へ進む道だ。',
  '灯りを絞れ。闇は、見つからぬ者の味方だ。',
  '火は草を走り、沼の息はそれを待っている。',
];
/** 特別な階（どこからも呼ばれていない。いつも null を返す） */
export const specialAt = (_d: number): null => null;

// branches (after DCSS): short side-dungeons that leave the main path and rejoin it one level further down
/** 支道（本道から分かれる短い道）。at は入口が出る深さの範囲 */
export interface Branch {
  key: string;
  name: string;
  len: number;
  at: [number, number];
  col: [number, number, number];
}
export const BRANCHES: Record<string, Branch> = {
  crypt: { key: 'crypt', name: '墓所', len: 2, at: [2, 3], col: [0.6, 0.5, 1.0] },
  lair: { key: 'lair', name: '獣の巣', len: 2, at: [4, 5], col: [0.4, 1.0, 0.5] },
  sunken: { key: 'sunken', name: '水没神殿', len: 2, at: [6, 8], col: [0.35, 0.85, 1.0] },
  nest: { key: 'nest', name: '蜘蛛の巣', len: 2, at: [5, 7], col: [0.82, 0.7, 1.0] },
  snake: { key: 'snake', name: '蛇の穴', len: 2, at: [7, 9], col: [0.6, 0.85, 0.4] },
};
// portal realms (after DCSS's portal vaults): one-level places behind a shimmering gate
/** 異界（入口から入る別の場所）。minD は出始める深さ */
export interface Realm {
  key: string;
  name: string;
  minD: number;
  col: [number, number, number];
}
export const REALMS: Record<string, Realm> = {
  ice: { key: 'ice', name: '氷の洞窟', minD: 2, col: [0.6, 0.85, 1.0] },
  lab: { key: 'lab', name: '魔術師の研究所', minD: 2, col: [1.0, 0.35, 0.85] },
  volcano: { key: 'volcano', name: '火山', minD: 4, col: [1.0, 0.45, 0.12] },
};

// what changes as you descend: bright, torch-lit halls near the surface; dark fungus, crystal and lava below
export function depthProfile(d: number) {
  const t = clamp((d - 1) / 7, 0, 1);
  return {
    t,
    torch: 1.15 - t * 0.85,
    grass: 1 - t * 0.55,
    lumen: 0.3 + t * 0.9,
    ambient: 1 - t * 0.42,
    door: 0.8 - t * 0.3,
    lavaPool: d >= 4 ? 0.18 + t * 0.22 : 0,
    bogPool: d >= 2 ? 0.12 + t * 0.1 : 0,
    fogDark: 1 - t * 0.4,
    biomes: {
      lake: 3 - 1.8 * t,
      fungal: 1.6 + t,
      chasm: d >= 2 ? 1 + 1.5 * t : 0.4,
      cathedral: d >= 2 ? 1.4 : 0.5,
      magma: d >= 2 ? 1.2 + 5 * t : 0,
      swamp: d >= 2 ? 1.3 + t : 0.5,
      crystal: d >= 2 ? 0.9 + 1.8 * t : 0.4,
    },
  };
}
/** 層ごとの霧の色 */
export const FOGS: [number, number, number][] = [
  [0.0035, 0.0024, 0.011],
  [0.0018, 0.0038, 0.0105],
  [0.0058, 0.0018, 0.0085],
  [0.003, 0.0028, 0.012],
];

/** 宝物庫の壁の高さ */
export const VAULT_WALL_H = 3.0;
// rock of each stratum: two tones for the banded layers, and a name for the look text
export const ROCKS: Record<string, { name: string; a: [number, number, number]; b: [number, number, number] }> = {
  maze: { name: '花崗岩', a: [0.62, 0.56, 0.62], b: [0.48, 0.46, 0.6] },
  cavern: { name: '石灰岩', a: [0.74, 0.72, 0.62], b: [0.52, 0.6, 0.72] },
  ruins: { name: '砂岩', a: [0.88, 0.7, 0.48], b: [0.68, 0.52, 0.44] },
  magma: { name: '玄武岩', a: [0.36, 0.3, 0.32], b: [0.52, 0.32, 0.28] },
  abyss: { name: '黒曜石', a: [0.3, 0.25, 0.42], b: [0.46, 0.34, 0.62] },
  bigroom: { name: '大理石', a: [0.86, 0.86, 0.92], b: [0.7, 0.72, 0.82] },
  oracle: { name: '大理石', a: [0.86, 0.86, 0.92], b: [0.7, 0.72, 0.82] },
  town: { name: '花崗岩', a: [0.62, 0.56, 0.62], b: [0.48, 0.46, 0.6] },
  fortress: { name: '花崗岩', a: [0.62, 0.56, 0.62], b: [0.48, 0.46, 0.6] },
};
/** 鉱脈の色と名前（1 金・2 紅玉・3 青玉・4 翠玉） */
export const VEIN_COL: Record<number, [number, number, number]> = {
    1: [1.0, 0.82, 0.35],
    2: [1.0, 0.22, 0.32],
    3: [0.35, 0.55, 1.0],
    4: [0.25, 1.0, 0.55],
  },
  VEIN_NAME: Record<number, string> = { 1: '金', 2: '紅玉', 3: '青玉', 4: '翠玉' };

/** マス i の真ん中の、世界の座標 [x, z]（もとは src/game/15-sound-fire.js） */
export const cpos = (i: number): [number, number] => [((i % MW) + 0.5) * CELL, (((i / MW) | 0) + 0.5) * CELL];
/** 火の備品の種類（火の音や、燃え広がる元に使う。もとは src/game/15-sound-fire.js） */
export const FIRE_TYPES = new Set(['brazier', 'torch', 'lava', 'embers', 'abyss']);
