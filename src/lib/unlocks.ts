// 解放の確かめ（もとは src/game/17-meta.js）。保存する記録 saved（解放した物・開発用モード）に頼る物。
// 解放の表 UNLOCKS は src/lib/progress.ts。
import { UNLOCKS, type Unlock } from './progress.ts';
import { RUNE_TYPES } from './runes.ts';
import { saved } from './state.ts';

/** 解放したか（開発用モードでは、すべて解放済み） */
export const unlocked = (id: string): boolean => saved.DEVALL || saved.META.unl.includes(id);
/** 種類 kind の t が、まだ解放されていないか（解放の表に無い物は、はじめから使える） */
export const lockedOf = (kind: Unlock['kind'], t: string): boolean => {
  const u = UNLOCKS.find((x) => x.kind === kind && x.t === t);
  return !!u && !unlocked(u.id);
};
/** 見つかる武器の一覧（解放していない武器は出ない） */
export const weaponPool = (): string[] => RUNE_TYPES.atk.filter((t) => !lockedOf('weapon', t));
