// 経験・伝承・解放（もとは src/game/17-meta.js と 18-level-player.js の一部）。

/** レベル n から次へ上がるのに要る経験 */
export const expNeed = (n: number): number => (n <= 1 ? 4 : 8 + 14 * (n - 2));
/** 倒した生き物から得る経験（的・小さな生き物・おとなしい生き物は 0。強い個体と主は多い） */
export function expOf(m: {
  ty: { dummy?: unknown; critter?: unknown; peaceful?: unknown };
  maxHp?: number;
  elite?: unknown;
  key?: string;
}): number {
  if (m.ty.dummy || m.ty.critter || m.ty.peaceful) return 0;
  return Math.min(
    60,
    (1 + Math.floor(Math.sqrt(m.maxHp || 10) / 3)) * (m.elite ? 3 : 1) * (m.key === 'lord' || m.key === 'final' ? 10 : 1),
  );
}

/** 冒険をまたいで残る物（伝承・使った伝承・解放した物・墓・試練）の初めの形 */
export interface Meta {
  /** 持っている伝承と、使った伝承 */
  lore: number;
  spent: number;
  /** 解放した物の id（UNLOCKS） */
  unl: string[];
  /** 前の冒険の墓 */
  grave: unknown;
  /** 選んでいる試練（UNLOCKS の t） */
  trials: string[];
}
export const META_DEF: Meta = { lore: 0, spent: 0, unl: [], grave: null, trials: [] };
/** 伝承で解放できる物 */
export interface Unlock {
  id: string;
  kind: 'weapon' | 'rune' | 'bless' | 'build' | 'trial';
  t?: string;
  name: string;
  cost: number;
  desc: string;
}
export const UNLOCKS: Unlock[] = [
  { id: 'w_star', kind: 'weapon', t: 'star', name: '星降りの杖', cost: 15, desc: '狙った所に、遅れて光の柱が降る杖' },
  { id: 'w_rain', kind: 'weapon', t: 'rain', name: '雨降らしの長弓', cost: 20, desc: '両手で持つ長弓。狙った所に、矢の雨を降らせる' },
  { id: 'w_gsword', kind: 'weapon', t: 'gsword', name: '遠鳴りの両手剣', cost: 25, desc: '両手で持つ大剣。広い斬撃と、溜めた大きな斬撃' },
  { id: 'w_mstaff', kind: 'weapon', t: 'mstaff', name: '満ち月の長杖', cost: 25, desc: '両手で持つ長杖。溜めるほど育つ光の月' },
  { id: 'r_poison', kind: 'rune', t: 'poison', name: '毒のルーン', cost: 15, desc: '性質のルーン「毒」が、祭壇などに出るようになる' },
  { id: 'b_shatter', kind: 'bless', t: 'shatter', name: '恩恵「冷え込み」', cost: 10, desc: 'レベルアップの恩恵に加わる' },
  { id: 'b_swapedge', kind: 'bless', t: 'swapedge', name: '恩恵「持ち替えの冴え」', cost: 10, desc: 'レベルアップの恩恵に加わる' },
  { id: 'b_scorch', kind: 'bless', t: 'scorch', name: '恩恵「焦熱」', cost: 10, desc: 'レベルアップの恩恵に加わる（代償あり）' },
  { id: 'b_reckless', kind: 'bless', t: 'reckless', name: '恩恵「捨て身」', cost: 10, desc: 'レベルアップの恩恵に加わる（代償あり）' },
  { id: 'build3', kind: 'build', name: '三つ目のビルド', cost: 30, desc: '保存できるビルドが3つになる' },
  {
    id: 't_dusk',
    kind: 'trial',
    t: 'dusk',
    name: '試練「薄明」',
    cost: 20,
    desc: '灯りが約6割しか届かない。代わりに、敵にも見つかりにくい',
  },
  { id: 't_fury', kind: 'trial', t: 'fury', name: '試練「猛り」', cost: 30, desc: '敵の体力と攻撃が約3割強く、群れが少し増える' },
];
