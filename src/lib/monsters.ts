// 生き物の処理と加護の段（もとは src/game/18-level-player.js）。状態の入れ物 adv（選んでいる試練・加護の段）に頼る物。
import { type MonsterType, MSTAT } from './creatures.ts';
import { adv } from './state.ts';
import { trialOn } from './unlocks.ts';

/** 加護 k の今の段（取っていなければ 0） */
export const BL = (k: string): number => adv.lvl.bless[k] || 0;

/**
 * 生き物 m の強さ [体力, 最小のダメージ, 最大のダメージ, 攻撃の間の秒]。種類 key（主は元にした種類 sk）で表を引く（無ければ並の強さ）。
 * 試練「猛り」（fury）では、体力とダメージが 1.3 倍
 */
export const statOf = (m: { ty: MonsterType; key: string }): readonly number[] => {
  const st = MSTAT[m.ty.sk || m.key] || ([12, 2, 5, 1.2] as const);
  return trialOn('fury') ? [st[0] * 1.3, st[1] * 1.3, st[2] * 1.3, st[3]] : st;
};
