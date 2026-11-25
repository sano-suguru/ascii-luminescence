// 階のシード（もとは src/game/18-level-player.js）と、最深部か（もとは 24-goal.js）、特別な階の場所（もとは 02-constants.js）。
// 状態の入れ物 adv（探索のシード）・here（今いる場所）に頼る物。
import { adv, here } from './state.ts';
import { SPECIALS } from './strata.ts';
import { FINAL_DEPTH } from './world.ts';

/** 今の階のシード（探索のシード・深さ・支道・異界・特別な階から決める。0 にはならない） */
export const levelSeed = (): number =>
  (Math.imul(adv.runSeed, 2654435761) ^
    Math.imul(here.depth, 1013904223) ^
    (here.branch ? Math.imul(here.branch.lvl * 31 + here.branch.key.charCodeAt(0), 0x27d4eb2d) : 0) ^
    (here.realm ? Math.imul(here.realm.key.charCodeAt(0) + 7, 0x165667b1) : 0) ^
    (here.inter ? Math.imul(here.inter.key.charCodeAt(0) + 13, 0x2c1b3c6d) : 0)) >>>
    0 || 1;

/** 今いるのが最深部か（本道の一番深い階。支道・異界・特別な階は違う） */
export const isFinal = (): boolean => here.depth === FINAL_DEPTH && !here.branch && !here.realm && !here.inter;

/** 特別な階 key（town・bigroom・oracle・fortress）がある深さ（大広間と砦は、探索のシードで1つずれる）。ほかの key は undefined */
export function interAt(key: string): number | undefined {
  const h = Math.imul(adv.runSeed ^ 0x5bd1e995, 2654435761) >>> 0;
  const at: Readonly<Record<string, number>> = { town: 2, bigroom: 3 + (h & 1), oracle: 5, fortress: 9 + ((h >> 2) & 1) };
  return at[key];
}
/** 深さ d の次（下り階段の先）にある特別な階の key。無ければ null */
export function interAfter(d: number): string | null {
  for (const k in SPECIALS) if (interAt(k) === d) return k;
  return null;
}
