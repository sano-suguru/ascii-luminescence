// 階のシード（もとは src/game/18-level-player.js）。状態の入れ物 adv（探索のシード）・here（今いる場所）に頼る物。
import { adv, here } from './state.ts';

/** 今の階のシード（探索のシード・深さ・支道・異界・特別な階から決める。0 にはならない） */
export const levelSeed = (): number =>
  (Math.imul(adv.runSeed, 2654435761) ^
    Math.imul(here.depth, 1013904223) ^
    (here.branch ? Math.imul(here.branch.lvl * 31 + here.branch.key.charCodeAt(0), 0x27d4eb2d) : 0) ^
    (here.realm ? Math.imul(here.realm.key.charCodeAt(0) + 7, 0x165667b1) : 0) ^
    (here.inter ? Math.imul(here.inter.key.charCodeAt(0) + 13, 0x2c1b3c6d) : 0)) >>>
    0 || 1;
