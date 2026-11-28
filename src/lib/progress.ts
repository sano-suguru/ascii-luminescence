// 経験・伝承・解放の表（もとは src/game/17-meta.js と 18-level-player.js の一部）。状態の入れ物（src/lib/state.ts）は読まない（state.ts がここの META_DEF を読むので、読むと輪になる）。
import { type SavedRune } from './runes.ts';

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

/** 探索をまたいで残る物（伝承・使った伝承・解放した物・墓・試練）の初めの形 */
export interface Meta {
  /** 持っている伝承と、使った伝承 */
  lore: number;
  spent: number;
  /** 解放した物の id（UNLOCKS） */
  unl: string[];
  /** 前の探索の墓 */
  grave: Grave | null;
  /** 選んでいる試練（UNLOCKS の t） */
  trials: string[];
  /** 指で遊ぶ時の始めの一言を、もう出したか（src/lib/intro.ts の touchTip） */
  touchTip?: boolean;
}
/** 墓（倒れた層 k・深さ・倒れた訳と、残したルーン。次の探索の同じ深さに置く） */
export interface Grave {
  k: string;
  depth: number;
  cause: string;
  item: SavedRune;
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

/** 加護（レベルアップで選ぶ。d は段 l の説明、cost は代わりに何かを失う物） */
export interface Bless {
  name: string;
  d: (l: number) => string;
  cost?: boolean;
}
/** 加護の表（もとは src/game/18-level-player.js） */
export const BLESS: Record<string, Bless> = {
  tough: { name: '頑丈な体', d: (l) => `最大体力が ${6 * l} 増える` },
  quickdodge: { name: '身軽な詠唱', d: (l) => `かわしてから ${l >= 2 ? 2.5 : 1.5}秒以内の詠唱が、半分の時間で済む` },
  counter: { name: '返しの一撃', d: (l) => `かわしてから 1.5秒の間、与えるダメージが ${l >= 2 ? 80 : 50}% 増える` },
  momentum: { name: '追い風', d: (l) => `敵を倒すと、3秒の間、性質のダメージが ${l >= 2 ? 40 : 25}% 増える` },
  devour: { name: '巻き返し', d: (l) => `敵を倒した時、取り戻せる体力が、さらに ${3 * l} 戻る` },
  kindle: { name: '火攻め', d: (l) => `燃えている敵へのダメージが ${l >= 2 ? 40 : 25}% 増える` },
  shatter: { name: '冷え込み', d: (l) => `凍えた敵を自分の攻撃で倒すと、周り ${l >= 2 ? 3.5 : 2.5}m の敵も凍える` },
  branch: { name: '裂ける雷', d: (l) => `雷の連鎖が ${l} 増える` },
  charge: { name: '溜めの一撃', d: (l) => `詠唱が満ちた後も構え続けて放つと、ダメージが ${l >= 2 ? 50 : 30}% 増える` },
  desperate: { name: '背水', d: (l) => `体力が半分を切ると、詠唱が ${l >= 2 ? 45 : 30}% 速い` },
  swapedge: { name: '持ち替えの冴え', d: (l) => `ビルドを替えてから 3秒の間、与えるダメージが ${l >= 2 ? 90 : 60}% 増える` },
  scorch: {
    name: '焦熱',
    d: (l) => `燃えている敵へのダメージが ${l >= 2 ? 70 : 50}% 増える。ただし、燃焼を生き延びた敵は、体力が3割戻る`,
    cost: true,
  },
  reckless: {
    name: '捨て身',
    d: (l) => `与えるダメージが ${l >= 2 ? 40 : 25}% 増えるが、受けるダメージも ${l >= 2 ? 35 : 25}% 増える`,
    cost: true,
  },
};
