// 解放の確かめと試練（もとは src/game/17-meta.js）。保存する記録 saved（解放した物・開発用モード）と、探索 adv（選んでいる試練）に頼る物。
// 解放の表 UNLOCKS は src/lib/progress.ts。
import { UNLOCKS, type Unlock } from './progress.ts';
import { RUNE_TYPES } from './runes.ts';
import { adv, saved } from './state.ts';

/** 解放したか（開発用モードでは、すべて解放済み） */
export const unlocked = (id: string): boolean => saved.DEVALL || saved.META.unl.includes(id);
/** 種類 kind の t が、まだ解放されていないか（解放の表に無い物は、はじめから使える） */
export const lockedOf = (kind: Unlock['kind'], t: string): boolean => {
  const u = UNLOCKS.find((x) => x.kind === kind && x.t === t);
  return !!u && !unlocked(u.id);
};
/** 見つかる武器の一覧（解放していない武器は出ない） */
export const weaponPool = (): string[] => RUNE_TYPES.atk.filter((t) => !lockedOf('weapon', t));
/** 今の探索で、試練 k を選んでいるか */
export const trialOn = (k: string): boolean => adv.runTrials.includes(k);
/** まだ使える伝承（たまった伝承から、解放に使った分を引く。もとは src/game/17-meta.js） */
export const loreLeft = (): number => Math.max(0, (saved.META.lore || 0) - (saved.META.spent || 0));
