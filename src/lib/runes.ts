// ルーンと武器の特性・反応・手の枠（もとは src/game/19-hands-runes.js と、18・27 の一部）。
import { css } from './color.ts';

/** 特性の段（0 から 5）ごとの値 */
export const TRAIT_V = {
  count: [0, 1, 1, 2, 2, 3],
  pierce: [0, 1, 1, 2, 3, 3],
  bounce: [0, 1, 2, 2, 3, 3],
  homing: [0, 10, 15, 20, 25, 30],
  range: [1, 1.2, 1.35, 1.5, 1.65, 1.8],
  speed: [1, 1.15, 1.25, 1.35, 1.45, 1.6],
  width: [0, 0.15, 0.25, 0.35, 0.45, 0.6],
  knock: [1, 1.5, 1.8, 2.1, 2.4, 2.8],
  stagger: [0, 0.3, 0.45, 0.6, 0.75, 0.9],
  charge: [1, 0.9, 0.82, 0.75, 0.68, 0.6],
  length: [1, 1.2, 1.35, 1.5, 1.65, 1.8],
  focus: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
  size: [1, 1.15, 1.3, 1.45, 1.6, 1.8],
  pull: [0, 2.5, 3, 3.5, 4, 4.5],
  fall: [1, 0.85, 0.75, 0.65, 0.55, 0.45],
  stride: [0, 0.6, 1.0, 1.4, 1.8, 2.2],
  link: [1, 0.85, 0.75, 0.65, 0.55, 0.45],
  after: [0, 1, 1, 2, 2, 3],
  area: [1, 1.15, 1.3, 1.45, 1.6, 1.8],
  span: [1, 1.25, 1.5, 1.75, 2, 2.3],
  accuracy: [0, 1, 2, 3, 4, 5],
};
export type TraitKey = keyof typeof TRAIT_V;
/** 1 を基準にした割合を、増える % にする（1.2 → 20） */
export const pct = (v: number): number => Math.round((v - 1) * 100);
/** 特性の説明（段 lv、増える物の名前 what）。段は 0 から 5（範囲の外は、移す前と同じく undefined や NaN の文字になる） */
export const TD: Record<TraitKey, (lv: number, what?: string) => string> = {
  count: (lv, what) => `${what}が ${TRAIT_V.count[lv] as number} つ増える`,
  pierce: (lv) => `敵を ${TRAIT_V.pierce[lv] as number} 体貫く`,
  bounce: (lv) => `壁で ${TRAIT_V.bounce[lv] as number} 回跳ねる`,
  homing: (lv) => `飛びながら敵の方へ曲がる（${TRAIT_V.homing[lv] as number}度）`,
  range: (lv) => `${pct(TRAIT_V.range[lv] as number)}% 遠くまで飛ぶ`,
  speed: (lv) => `${pct(TRAIT_V.speed[lv] as number)}% 速く飛ぶ`,
  width: (lv) => `当たる幅が ${Math.round((TRAIT_V.width[lv] as number) * 100)}cm 広がる`,
  knock: (lv) => `当たった敵を、${TRAIT_V.knock[lv] as number}倍の強さで押し返す`,
  stagger: (lv) => `当たった敵の攻撃の構えを、${Math.round((TRAIT_V.stagger[lv] as number) * 100)}% で崩す`,
  charge: (lv) => `詠唱が ${Math.round((1 - (TRAIT_V.charge[lv] as number)) * 100)}% 速い`,
  length: (lv) => `帯が ${pct(TRAIT_V.length[lv] as number)}% 長く届く`,
  focus: (lv) => `照らし続けるほど強まる（最大 +${Math.round((TRAIT_V.focus[lv] as number) * 100)}%）`,
  size: (lv) => `${pct(TRAIT_V.size[lv] as number)}% 大きい`,
  pull: (lv) => `周りの敵を引き寄せる（${TRAIT_V.pull[lv] as number}m）`,
  fall: (lv) => `降るまでが ${Math.round((1 - (TRAIT_V.fall[lv] as number)) * 100)}% 短い`,
  stride: (lv) => `駆ける距離が ${TRAIT_V.stride[lv] as number}m 伸びる`,
  link: (lv) => `次に駆けるまでの間が ${Math.round((1 - (TRAIT_V.link[lv] as number)) * 100)}% 短い`,
  after: (lv) => `駆けた跡に、刃の残像が ${TRAIT_V.after[lv] as number} つ残って当たる`,
  area: (lv) => `雨の範囲が ${pct(TRAIT_V.area[lv] as number)}% 広い`,
  span: (lv) => `雨が ${pct(TRAIT_V.span[lv] as number)}% 長く降る`,
  accuracy: (_lv) => `ばらつきが小さく、少し敵へ曲がる`,
};
/** 武器の特性（名前と、段ごとの説明） */
export interface Trait {
  name: string;
  d: (lv: number) => string;
}
export const TR = (k: TraitKey, name: string, what?: string): Trait => ({ name, d: (lv) => TD[k](lv, what) });
/** 武器ごとに付きうる特性 */
export const TRAITS: Record<string, Partial<Record<TraitKey, Trait>>> = {
  blade: { count: TR('count', '数', '風の刃'), range: TR('range', '飛距離'), width: TR('width', '刃の幅'), knock: TR('knock', '押し返し') },
  dash: {
    stride: TR('stride', '駆ける距離'),
    link: TR('link', '駆ける間'),
    after: TR('after', '残像'),
    range: TR('range', '突きの飛距離'),
  },
  gsword: {
    width: TR('width', '刃の幅'),
    charge: TR('charge', '溜めの速さ'),
    knock: TR('knock', '押し返し'),
    stagger: TR('stagger', 'よろめき'),
  },
  bolt: {
    count: TR('count', '数', '矢'),
    pierce: TR('pierce', '貫き'),
    homing: TR('homing', 'ホーミング'),
    speed: TR('speed', '矢の速さ'),
  },
  rain: { area: TR('area', '雨の広さ'), charge: TR('charge', '引きの速さ'), span: TR('span', '降る長さ'), count: TR('count', '数', '矢') },
  rapid: {
    count: TR('count', '数', '矢'),
    accuracy: TR('accuracy', '精密'),
    charge: TR('charge', '装填の速さ'),
    knock: TR('knock', '押し返し'),
  },
  orb: { count: TR('count', '数', '弾'), bounce: TR('bounce', '跳ね返り'), speed: TR('speed', '弾の速さ'), knock: TR('knock', '押し返し') },
  beam: { length: TR('length', '帯の長さ'), bounce: TR('bounce', '跳ね返り'), focus: TR('focus', '収束') },
  star: { count: TR('count', '数', '光の柱'), size: TR('size', '柱の大きさ'), fall: TR('fall', '降る速さ'), pull: TR('pull', '引き寄せ') },
  mstaff: {
    charge: TR('charge', '満ちる速さ'),
    size: TR('size', '月の大きさ'),
    pull: TR('pull', '潮'),
    count: TR('count', '数', '光の弾'),
  },
};

/** ルーンに付いた特性（種類 k と段 lv） */
export interface RuneTrait {
  k: string;
  lv: number;
}
/** ルーン（武器も、性質・発動・効き方・護符も） */
export interface Rune {
  type: string;
  strong?: boolean;
  traits?: RuneTrait[];
  named?: unknown;
}
/** 特性の名前（武器 w に無い特性なら、種類の名前のまま） */
export const trName = (w: string, t: RuneTrait): string => {
  const tw = TRAITS[w],
    tr = tw && tw[t.k as TraitKey];
  return tr ? tr.name : t.k;
};
/** 術（sp）の特性 k の段（無ければ 0） */
export const TL = (sp: { tr?: Partial<Record<string, number>> } | null | undefined, k: string): number => (sp && sp.tr && sp.tr[k]) || 0;
/** 術（sp）の特性 k の値 */
export const tv = (sp: Parameters<typeof TL>[0], k: TraitKey): number | undefined => TRAIT_V[k][TL(sp, k)];
/** ルーンの特性の一覧（無ければ空） */
export const trList = (ru: Rune | null | undefined): RuneTrait[] => (ru && ru.traits) || [];
/** 特性の段の色（並：白、1：青、3：緑、5：金） */
export const TIER_COL: [number, number, number][] = [
  [0.9, 0.9, 0.95],
  [0.45, 0.72, 1.0],
  [0.45, 1.0, 0.55],
  [1.0, 0.82, 0.3],
];
/** 武器の名前の色（特性が無ければ ''、段5か名のある武器なら金） */
export const weaponCol = (ru: Rune | null | undefined): string => {
  const tr = trList(ru);
  if (!tr.length) return '';
  return tr.some((t) => t.lv >= 5) || (ru as Rune).named ? css(TIER_COL[3] as [number, number, number]) : '#9fdcf0';
};

/** 性質の反応（二つの性質が重なった時） */
export const REACT: Record<string, { name: string; pair: string; desc: string }> = {
  steam: { name: '蒸気', pair: '火 × 氷', desc: '凍えたものを焼くと、蒸気が噴き出して周りを巻き込む' },
  blast: { name: '爆炎', pair: '火 × 毒', desc: '毒に蝕まれたものに火をつけると、弾けて燃え広がる' },
  overload: { name: '過熱', pair: '火 × 雷', desc: '燃えるものと雷が重なると、周りを吹き飛ばす' },
  shatter: { name: '砕氷', pair: '氷 × 雷', desc: '凍えたものに雷を落とすと、氷ごと砕ける' },
  frostbite: { name: '凍える毒', pair: '氷 × 毒', desc: '凍えと毒が重なると、毒が長く深く残る' },
  contagion: { name: '毒の伝播', pair: '雷 × 毒', desc: '毒に蝕まれたものに雷が走ると、毒が周りへ移る' },
};

/** 手の枠の数の上限 */
export const SLOT_MAX = 4;
/** 両手持ちの武器の枠の数 */
export const TWO_SLOTS = 6;
// the same element twice or more in one hand resonates
/** 同じ性質のルーンの数（0 から 4）ごとの強さ */
export const ELEM_POW = [1, 1, 1.4, 1.7, 1.9];
/** 手（左手・右手） */
export interface Hand {
  slots?: (Rune | null | undefined)[];
  slotN?: number;
}
/** 手に付けたルーン（使える枠の分だけ、空きを除く） */
export const handRunes = (H: Hand): Rune[] => (H.slots || []).slice(0, H.slotN || 2).filter((r): r is Rune => Boolean(r));
/** 手に付けた、性質 el のルーンの数 */
export const elemCount = (H: Hand, el: string): number => handRunes(H).filter((r) => r.type === el).length;

/** ルーン文字を描くフォント */
export const RUNE_FONT = '"Noto Sans Runic","Segoe UI Historic","Segoe UI Symbol",FreeMono,Unifont,serif';
/** ルーンを保存する形（種類・強い印・特性） */
export const serRune = (ru: Rune): { type: string; strong: boolean; traits: RuneTrait[] } => ({
  type: ru.type,
  strong: !!ru.strong,
  traits: (ru.traits || []).map((t) => ({ k: t.k, lv: t.lv })),
});

/** 装備の画面：ルーンの種類ごとの括弧と名前 */
export const CAT_BR: Record<string, [string, string]> = {
  atk: ['', ''],
  elem: ['(', ')'],
  trig: ['&lt;', '&gt;'],
  mod: ['{', '}'],
  body: ['', ''],
};
export const CAT_NAME: Record<string, string> = { atk: '武器', elem: '性質', trig: '発動', mod: '効き方', body: '護符' };
/** 装備の画面：空きの枠のボタン */
export function emptyChip(cat: string, attrs: string): string {
  const br = cat === 'atk' ? ['', ''] : cat === 'body' ? ['"', ''] : cat === 'rune' ? ['[', ']'] : CAT_BR[cat] || ['', ''];
  return `<button class="row rs empty" ${attrs}><span class="mk"> </span><span class="dim">${br[0]} 空き ${br[1]}</span></button>`;
}
