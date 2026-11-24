// ルーンと武器の特性・反応・手の枠（もとは src/game/19-hands-runes.js と、18・27 の一部）。
import { nth } from './array.ts';
import { css } from './color.ts';

/** 特性の段（0 から 5）。古い JS は数のまま渡すので、範囲の外の段が来ると、移す前と同じく undefined や NaN の文字になる */
export type TraitLv = 0 | 1 | 2 | 3 | 4 | 5;
/** 段の一覧（0 から 5） */
export const TRAIT_LVS: readonly TraitLv[] = [0, 1, 2, 3, 4, 5];
type Six = readonly [number, number, number, number, number, number];
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
} satisfies Record<string, Six>;
export type TraitKey = keyof typeof TRAIT_V;
/** 1 を基準にした割合を、増える % にする（1.2 → 20） */
export const pct = (v: number): number => Math.round((v - 1) * 100);
/** 特性の説明（段 lv、増える物の名前 what） */
export const TD: Record<TraitKey, (lv: TraitLv, what?: string) => string> = {
  count: (lv, what) => `${what}が ${TRAIT_V.count[lv]} つ増える`,
  pierce: (lv) => `敵を ${TRAIT_V.pierce[lv]} 体貫く`,
  bounce: (lv) => `壁で ${TRAIT_V.bounce[lv]} 回跳ねる`,
  homing: (lv) => `飛びながら敵の方へ曲がる（${TRAIT_V.homing[lv]}度）`,
  range: (lv) => `${pct(TRAIT_V.range[lv])}% 遠くまで飛ぶ`,
  speed: (lv) => `${pct(TRAIT_V.speed[lv])}% 速く飛ぶ`,
  width: (lv) => `当たる幅が ${Math.round(TRAIT_V.width[lv] * 100)}cm 広がる`,
  knock: (lv) => `当たった敵を、${TRAIT_V.knock[lv]}倍の強さで押し返す`,
  stagger: (lv) => `当たった敵の攻撃の構えを、${Math.round(TRAIT_V.stagger[lv] * 100)}% で崩す`,
  charge: (lv) => `詠唱が ${Math.round((1 - TRAIT_V.charge[lv]) * 100)}% 速い`,
  length: (lv) => `帯が ${pct(TRAIT_V.length[lv])}% 長く届く`,
  focus: (lv) => `照らし続けるほど強まる（最大 +${Math.round(TRAIT_V.focus[lv] * 100)}%）`,
  size: (lv) => `${pct(TRAIT_V.size[lv])}% 大きい`,
  pull: (lv) => `周りの敵を引き寄せる（${TRAIT_V.pull[lv]}m）`,
  fall: (lv) => `降るまでが ${Math.round((1 - TRAIT_V.fall[lv]) * 100)}% 短い`,
  stride: (lv) => `駆ける距離が ${TRAIT_V.stride[lv]}m 伸びる`,
  link: (lv) => `次に駆けるまでの間が ${Math.round((1 - TRAIT_V.link[lv]) * 100)}% 短い`,
  after: (lv) => `駆けた跡に、刃の残像が ${TRAIT_V.after[lv]} つ残って当たる`,
  area: (lv) => `雨の範囲が ${pct(TRAIT_V.area[lv])}% 広い`,
  span: (lv) => `雨が ${pct(TRAIT_V.span[lv])}% 長く降る`,
  accuracy: (_lv) => `ばらつきが小さく、少し敵へ曲がる`,
};
/** 武器の特性（名前と、段ごとの説明） */
export interface Trait {
  name: string;
  d: (lv: TraitLv) => string;
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
  const tw: Partial<Record<string, Trait>> | undefined = TRAITS[w],
    tr = tw && tw[t.k];
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
  return tr.some((t) => t.lv >= 5) || ru?.named ? css(nth(TIER_COL, 3)) : '#9fdcf0';
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

/** ルーンの種類（武器・性質・発動・効き方・護符） */
export const RUNE_TYPES = {
  atk: ['blade', 'bolt', 'orb', 'beam', 'dash', 'rain', 'rapid', 'star', 'gsword', 'mstaff'],
  elem: ['fire', 'ice', 'thunder', 'poison'],
  trig: ['dodge', 'kill'],
  mod: ['m_chain', 'm_area', 'm_dur'],
  body: ['swift', 'roll', 'quick', 'lamp', 'mend', 'linger', 'hush', 'ward'],
};
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

// ---------------------------------------------------------------- もとは src/game/18・19・20・21・27
/** 武器の飾り（増える弾・跳ね返りなど）：名前と、値の振り方 roll（乱数 r を使う）と、書き方 fmt */
export const AFFIX = {
  count: { name: '弾数', roll: (r) => 1 + (r() < 0.3 ? 1 : 0), fmt: (v) => `弾数 +${v}` },
  bounce: { name: '跳ね返り', roll: (r) => 1 + Math.floor(r() * 3), fmt: (v) => `跳ね返り +${v}` },
  homing: { name: 'ホーミング', roll: (r) => 20 + Math.floor(r() * 5) * 10, fmt: (v) => `ホーミング +${v}度` },
  chain: { name: '連鎖', roll: (r) => 1 + (r() < 0.35 ? 1 : 0), fmt: (v) => `連鎖 +${v}` },
  area: { name: '範囲', roll: (r) => 25 + Math.floor(r() * 8) * 5, fmt: (v) => `範囲 +${v}%` },
  dur: { name: '持続', roll: (r) => 30 + Math.floor(r() * 6) * 10, fmt: (v) => `持続 +${v}%` },
} satisfies Record<string, { name: string; roll: (r: () => number) => number; fmt: (v: number) => string }>;
/** 術 sp が性質（elem）を持つか */
export const sp_elem = (p: { sp?: { elem?: unknown } | null } | null | undefined): boolean => !!(p && p.sp && p.sp.elem);
/** 二つの性質の反応の名前（無ければ null） */
export function reactionOf(a: string, b: string): string | null {
  const k = [a, b].sort().join('+');
  const table: Readonly<Record<string, string>> = {
    'fire+ice': 'steam',
    'fire+poison': 'blast',
    'fire+thunder': 'overload',
    'ice+thunder': 'shatter',
    'ice+poison': 'frostbite',
    'poison+thunder': 'contagion',
  };
  return table[k] || null;
}
/** 立て直し（rally）で体力が戻る、当たりの種類 */
export const RALLY_FROM = new Set(['blade', 'magic', 'fire', 'thunder', 'poison', 'ice']);
/** 素手の時の短剣と、眠っている相手への倍率 */
export const WEAPON = { name: '短剣', min: 3, max: 5, cd: 0.45, reach: 2.2 },
  SLEEP_MULT = 3;

/** ルーンの定義（武器・性質・発動・効き方・護符など）。もとは src/game/19-hands-runes.js */
export interface RuneDef {
  /** 種類（atk 武器・sub・elem 性質・trig 発動・body 護符・open・mod 効き方） */
  cat: string;
  /** 文字 */
  ch?: string;
  name: string;
  /** 武器の種類の名前（剣・弓・杖など） */
  wk?: string;
  /** 詠唱の秒 */
  chant?: number;
  dmg?: readonly number[];
  /** 立ち直りの秒 */
  rec?: number;
  /** 付けられる特性 */
  aff: readonly string[];
  desc?: string;
  /** 両手で持つ（左右で別の撃ち方 L・R） */
  two?: boolean;
  L?: string;
  R?: string;
  reach?: number;
  arc?: number;
  pre?: string;
  col?: readonly number[];
  short?: string;
  sh?: string;
  nm?: string;
  unit?: string;
  /** 効き方のルーンの種類 */
  mk?: string;
  val?: number;
}
/** ルーンの定義（種類 → 定義） */
export const RUNE_DEF: Record<string, RuneDef> = {
  blade: {
    cat: 'atk',
    ch: ')',
    name: '小剣',
    wk: '剣',
    chant: 0,
    dmg: [4, 6],
    rec: 0.42,
    aff: ['count'],
    desc: '目の前を薙ぐ。詠唱はいらない',
  },
  bolt: {
    cat: 'atk',
    ch: '}',
    name: '短弓',
    wk: '弓',
    two: true,
    L: 'bolt',
    R: 'bpower',
    chant: 0.4,
    dmg: [3, 5],
    rec: 0.12,
    aff: ['count', 'bounce', 'homing'],
    desc: '両手で持つ。左：素早く射る　右：引き絞って、強く貫く一矢',
  },
  orb: {
    cat: 'atk',
    ch: '/',
    name: '樫の杖',
    wk: '杖',
    chant: 0.8,
    dmg: [5, 8],
    rec: 0.15,
    aff: ['count', 'bounce', 'homing'],
    desc: '光の弾を放つ。弧を描いて飛び、落ちた所で弾ける',
  },
  beam: {
    cat: 'atk',
    ch: '/',
    name: '水晶の杖',
    wk: '杖',
    chant: 0.3,
    dmg: [1, 2],
    rec: 0.25,
    aff: ['count', 'bounce'],
    desc: '押している間、光の帯で照らし続ける',
  },
  dash: {
    cat: 'atk',
    ch: ')',
    name: '風走りの細剣',
    wk: '剣',
    chant: 0,
    dmg: [4, 6],
    rec: 0.55,
    aff: [],
    desc: '斬りながら、前へ駆け抜ける。通り抜けた敵を斬る',
  },
  rain: {
    cat: 'atk',
    ch: '}',
    name: '雨降らしの長弓',
    wk: '弓',
    two: true,
    L: 'rshot',
    R: 'rain',
    chant: 0.9,
    dmg: [2, 3],
    rec: 0.3,
    aff: ['count', 'bounce', 'homing'],
    desc: '両手で持つ。左：遠くへ一矢を射る　右：狙った所に、壁を越えて矢の雨を降らせる',
  },
  bpower: { cat: 'sub', name: '強弓', chant: 0.8, dmg: [6, 9], rec: 0.4, aff: ['count', 'bounce', 'homing'] },
  rshot: { cat: 'sub', name: '遠矢', chant: 0.5, dmg: [4, 6], rec: 0.3, aff: ['count', 'bounce', 'homing'] },
  rapid: {
    cat: 'atk',
    ch: '}',
    name: '早撃ちの連弩',
    wk: '弓',
    chant: 0.3,
    dmg: [2, 3],
    rec: 0.35,
    aff: ['count', 'bounce', 'homing'],
    desc: '矢を、素早く3本続けて撃つ',
  },
  star: {
    cat: 'atk',
    ch: '/',
    name: '星降りの杖',
    wk: '杖',
    chant: 0.7,
    dmg: [6, 9],
    rec: 0.25,
    aff: ['count'],
    desc: '狙った所に、少し遅れて光の柱が降る',
  },
  gsword: {
    cat: 'atk',
    ch: ')',
    name: '遠鳴りの両手剣',
    wk: '剣',
    two: true,
    L: 'gsweep',
    R: 'gwave',
    chant: 0,
    dmg: [7, 10],
    rec: 0.8,
    aff: ['count'],
    desc: '両手で持つ。左：大きく薙ぐ　右：溜めて、加速する大きな風の刃を飛ばす',
  },
  mstaff: {
    cat: 'atk',
    ch: '/',
    name: '満ち月の長杖',
    wk: '杖',
    two: true,
    L: 'mshot',
    R: 'mmoon',
    chant: 0.3,
    dmg: [3, 4],
    rec: 0.25,
    aff: ['count', 'bounce', 'homing'],
    desc: '両手で持つ。左：光の弾を撃つ　右：溜めるほど大きな光の月を放つ',
  },
  gsweep: { cat: 'sub', name: '薙ぎ', chant: 0, dmg: [7, 10], rec: 0.8, reach: 2.7, arc: 0.75, aff: ['count'] },
  gwave: { cat: 'sub', name: '遠鳴りの刃', chant: 1.0, dmg: [8, 12], rec: 0.6, aff: ['count'] },
  mshot: { cat: 'sub', name: '光の弾', chant: 0.3, dmg: [3, 4], rec: 0.25, aff: ['count', 'bounce', 'homing'] },
  mmoon: { cat: 'sub', name: '光の月', chant: 0.8, dmg: [6, 9], rec: 0.5, aff: ['count'] },
  fire: {
    cat: 'elem',
    ch: 'ᚲ',
    name: '火',
    pre: '炎の',
    col: [1.0, 0.5, 0.16],
    aff: ['chain', 'area', 'dur'],
    desc: '燃え移り、草や干し草にも火をつける',
  },
  ice: {
    cat: 'elem',
    ch: 'ᛁ',
    name: '氷',
    pre: '氷の',
    col: [0.55, 0.86, 1.0],
    aff: ['chain', 'area', 'dur'],
    desc: '凍えさせ、動きを鈍らせる',
  },
  thunder: {
    cat: 'elem',
    ch: 'ᛊ',
    name: '雷',
    pre: '雷の',
    col: [1.0, 0.92, 0.45],
    aff: ['chain', 'area', 'dur'],
    desc: '痺れさせ、近くの敵へ跳ぶ。水の中の敵によく通る',
  },
  poison: { cat: 'elem', ch: 'ᚾ', name: '毒', pre: '毒の', col: [0.45, 1.0, 0.35], aff: ['chain', 'area', 'dur'], desc: 'じわじわと蝕む' },
  dodge: {
    cat: 'trig',
    ch: 'ᚱ',
    name: '攻撃をかわした時',
    short: 'かわした時',
    aff: [],
    desc: '敵の攻撃を転がってかわした瞬間、この手の攻撃が、かわした相手へひとりでに放たれる',
  },
  kill: {
    cat: 'trig',
    ch: 'ᚺ',
    name: '敵を倒した時',
    short: '倒した時',
    aff: [],
    desc: '敵を倒した時、この手の攻撃が近くの敵へひとりでに放たれる',
  },
  swift: { cat: 'body', ch: '"', col: [1.0, 0.86, 0.62], name: '疾風の護符', aff: [], desc: '走る速さが 15% 上がる' },
  roll: { cat: 'body', ch: '"', col: [1.0, 0.86, 0.62], name: '身軽の護符', aff: [], desc: '転がってかわす距離が 35% 伸びる' },
  quick: { cat: 'body', ch: '"', col: [1.0, 0.86, 0.62], name: '早口の護符', aff: [], desc: '詠唱の時間が 30% 短くなる' },
  lamp: { cat: 'body', ch: '"', col: [1.0, 0.86, 0.62], name: '灯火の護符', aff: [], desc: '灯りの届く距離が 35% 伸びる' },
  mend: {
    cat: 'body',
    ch: '"',
    col: [1.0, 0.86, 0.62],
    name: '癒しの護符',
    aff: [],
    desc: '取り戻せる傷が長く残り、攻めて取り戻す量も増える',
  },
  linger: { cat: 'body', ch: '"', col: [1.0, 0.86, 0.62], name: '余韻の護符', aff: [], desc: '燃焼・凍え・痺れ・毒が 50% 長く続く' },
  hush: {
    cat: 'body',
    ch: '"',
    col: [1.0, 0.86, 0.62],
    name: '忍び足の護符',
    aff: [],
    desc: '足音が静かになり、敵に気づかれる距離が 25% 縮む',
  },
  slotopt: { cat: 'open', ch: '{', col: [1.0, 0.9, 0.6], name: '枠', aff: [], desc: '' },
  forgeopt: { cat: 'open', ch: 'T', col: [0.7, 0.85, 1.0], name: '鍛え', aff: [], desc: '' },
  m_count: {
    cat: 'mod',
    sh: '数',
    nm: '数',
    unit: '',
    ch: 'ᚷ',
    col: [0.85, 0.8, 1.0],
    name: '数 +1',
    mk: 'count',
    val: 1,
    aff: [],
    desc: 'その手の攻撃の数が 1 増える。短弓なら矢が2本、樫の杖なら弾が2つ、小剣なら2度薙ぐ',
  },
  m_bounce: {
    cat: 'mod',
    sh: '跳返',
    nm: '跳ね返り',
    unit: '',
    ch: 'ᚢ',
    col: [0.85, 0.8, 1.0],
    name: '跳ね返り +2',
    mk: 'bounce',
    val: 2,
    aff: [],
    desc: '壁で 2 回多く跳ねる',
  },
  m_homing: {
    cat: 'mod',
    sh: '追尾',
    nm: 'ホーミング',
    unit: '度',
    ch: 'ᛉ',
    col: [0.85, 0.8, 1.0],
    name: 'ホーミング +20度',
    mk: 'homing',
    val: 20,
    aff: [],
    desc: '飛びながら、敵の方へ曲がる',
  },
  m_chain: {
    cat: 'mod',
    sh: '連鎖',
    nm: '連鎖',
    unit: '',
    ch: 'ᚹ',
    col: [0.85, 0.8, 1.0],
    name: '連鎖 +1',
    mk: 'chain',
    val: 1,
    aff: [],
    desc: '性質の連鎖が 1 増える。雷なら、もう1体へ跳ぶ',
  },
  m_area: {
    cat: 'mod',
    ch: 'ᛈ',
    col: [0.85, 0.8, 1.0],
    sh: '広がり',
    nm: '広がり',
    unit: '%',
    name: '広がり +30%',
    mk: 'area',
    val: 30,
    aff: [],
    desc: '性質の効果が広がる。炎の燃え広がりや、霧の広さなど',
  },
  m_dur: {
    cat: 'mod',
    ch: 'ᚠ',
    col: [0.85, 0.8, 1.0],
    sh: '長さ',
    nm: '長さ',
    unit: '%',
    name: '長さ +50%',
    mk: 'dur',
    val: 50,
    aff: [],
    desc: '性質の効果が長く続く。燃焼や凍えなど',
  },
  ward: { cat: 'body', ch: '"', col: [1.0, 0.86, 0.62], name: '守りの護符', aff: [], desc: '受ける傷が 15% 軽くなる' },
};
/** 生き物ごとの、性質の効き目の倍率（種類 → 性質 → 倍率。試しの間の的は 25-gallery.js が足す） */
export const RES: Record<string, Record<string, number>> = {
  L: { poison: 0.2, fire: 2 },
  lord: { poison: 0.5 },
  Y: { poison: 0.2, thunder: 2 },
  Rc: { poison: 0.2, thunder: 2 },
  Re: { poison: 0.2, thunder: 2 },
  Rw: { poison: 0.2, thunder: 2 },
  l: { fire: 0.2, ice: 2 },
  Zf: { fire: 0.2, ice: 2 },
  D: { fire: 0.2, ice: 1.5 },
  Zi: { ice: 0.2, fire: 2 },
  Zl: { thunder: 0.2 },
  N: { fire: 0.5, thunder: 2 },
  K: { fire: 0.5, thunder: 2 },
  f: { thunder: 2 },
  n: { poison: 0.25 },
  B: { poison: 0.2, fire: 2 },
  S: { fire: 2 },
  j: {},
  T: { fire: 1.5 },
};
