// 層・テーマ・特別な階・支道と異界の中身・地形・群れ（もとは src/game/02-constants.js と 04-generate.js の levelDims）。
// 迷宮の生成が読む表と、層・支道・階の大きさを決める小さな関数（stratumOf・branchAtDepth・levelDims）。
// 生き物の表 MTYPES は src/lib/creatures.ts。
import { lookup, nth } from './array.ts';
import { clamp } from './rng.ts';
import { BRANCHES, MH, MW } from './world.ts';

/** 部屋や洞窟のテーマ（灯りの色・備品・入った時の言葉。洞窟は地形 BIOMES） */
export interface Theme {
  k: string;
  col: number[];
  msg: string;
  fix?: string;
  ruin?: boolean;
  base?: number;
  slope?: number;
  cave?: boolean;
}
/** 層（本道の層・特別な階・支道・異界の中身） */
export interface Stratum {
  k: string;
  name: string;
  msg: string;
  n?: number;
  from?: number;
  to?: number;
  special?: boolean;
  branch?: boolean;
  realm?: boolean;
  themes?: Theme[];
  machines?: string[];
  vaults?: string[];
  hordes?: string[];
  hordeMul?: number;
  torchMul?: number;
  fog?: number[];
  cw?: Record<string, number>;
  denseWebs?: boolean;
  flood?: boolean;
  freeze?: boolean;
  fall?: string;
}
/** 群れ（strata.ts の HORDES の1つ）：頭の生き物 lead と、ついてくる生き物 [種類, 最少, 最多]、出る深さ d、重み w */
export interface Horde {
  lead: string;
  fol: [string, number, number][];
  d: [number, number];
  w: number;
}

// strata (after Dwarf Fortress's layers and DCSS's branches): the way the world is built changes with depth
/** 本道の層（深さ from から to まで） */
export const STRATA = [
  { k: 'maze', n: 1, name: '石の迷宮', from: 1, to: 2, msg: '' },
  { k: 'cavern', n: 2, name: '大洞窟', from: 3, to: 5, msg: '石の迷宮が途切れ、果てしない大洞窟が広がった。天井は遥か闇の彼方にある。' },
  {
    k: 'ruins',
    n: 3,
    name: '古代の廃墟',
    from: 6,
    to: 8,
    msg: '洞窟の先に、巨大な建造物の残骸が現れた。誰が、何のために築いたのかは分からない。',
  },
  { k: 'magma', n: 4, name: '溶岩の海', from: 9, to: 11, msg: '足元から熱気が噴き上がる。見渡す限り、溶岩の海が広がっている。' },
  { k: 'abyss', n: 5, name: '深淵', from: 12, to: 999, msg: '足場の下には何もない。底知れぬ闇の中を、これまでの世界の断片が漂っている。' },
];
/** 部屋のテーマ（灯りの色と、備品と、入った時の言葉） */
export const THEMES = [
  { k: 'amber', col: [1.0, 0.55, 0.17], fix: 'brazier', msg: '琥珀色の炎が揺らめく広間に出た。壁が火影に震えている。' },
  { k: 'crimson', col: [1.0, 0.13, 0.22], fix: 'brazier', msg: '深紅の火が、壁一面を血の色に染めている。' },
  { k: 'cyan', col: [0.2, 0.8, 1.0], fix: 'crystal', msg: '宙に浮かぶ水晶が、青白い光をゆっくりと脈打たせている。' },
  { k: 'violet', col: [0.55, 0.33, 1.0], fix: 'crystal', msg: '菫色の燐光が満ちる静かな広間。天井で無数の小さな光が瞬いている。' },
  { k: 'emerald', col: [0.2, 1.0, 0.5], fix: 'fungus', msg: '発光する苔が、床一面に芽吹いている。' },
  { k: 'magenta', col: [1.0, 0.25, 0.8], fix: 'rune', msg: '床に描かれた魔法陣が、妖しく回転している。' },
];
// districts of the ancient ruins (palette after Caves of Qud)
export const RUIN_THEMES = [
  { k: 'r_teal', col: [0.3, 0.95, 0.85], fix: 'orb', ruin: true, msg: '青緑に灯る古の球体が、崩れかけた大広間をいまも照らしている。' },
  { k: 'r_ochre', col: [1.0, 0.66, 0.28], fix: 'brazier', ruin: true, msg: '黄土色の炎が、巨大な柱の影を長く伸ばしている。' },
  { k: 'r_rose', col: [1.0, 0.42, 0.62], fix: 'orb', ruin: true, msg: '薔薇色に灯る古代の球体が、壁一面の碑文を照らしている。' },
  { k: 'r_violet', col: [0.62, 0.45, 1.0], fix: 'crystal', ruin: true, msg: '菫色の光の中で、誰のものとも知れぬ文明の名残が眠っている。' },
];
export const FORT_THEMES = [
  { k: 'f_forge', col: [1.0, 0.55, 0.2], fix: 'brazier', ruin: true, msg: '鍛冶の炎の名残が、煤けた壁を赤く照らしている。' },
  { k: 'f_hall', col: [1.0, 0.75, 0.4], fix: 'brazier', ruin: true, msg: 'ドワーフの大広間。石に刻まれた紋様が、炎の光に浮かぶ。' },
  { k: 'f_deep', col: [0.45, 0.75, 1.0], fix: 'orb', ruin: true, msg: '冷たい青い灯が、砦の奥の静けさを照らしている。' },
];
/** 特別な階（地下の町・大広間・神託所・砦） */
export const SPECIALS = {
  town: { k: 'town', special: true, name: '地下の町', msg: '岩盤をくり抜いて築かれた町に出た。家々の窓には、まだ灯りがともっている。' },
  bigroom: { k: 'bigroom', special: true, name: '大広間', msg: '視界が一気に開けた。どこまでも続く、ひとつきりの巨大な広間だ。' },
  oracle: { k: 'oracle', special: true, name: '神託所', msg: '静かな水音が聞こえる。この階のどこかに、神託を告げる座があるらしい。' },
  fortress: {
    k: 'fortress',
    special: true,
    name: '放棄された砦',
    msg: 'ドワーフの砦の跡に出た。溶岩の熱を頼りに栄え、そして見捨てられた場所だ。',
  },
} satisfies Record<string, Stratum>;
export const CRYPT_THEMES = [
  { k: 'c_cold', col: [0.45, 0.6, 1.0], fix: 'crystal', msg: '冷たい青い光の中に、石の棺が並んでいる。' },
  { k: 'c_violet', col: [0.62, 0.4, 1.0], fix: 'rune', msg: '菫色の魔法陣が、死者の眠りを見守っている。' },
  { k: 'c_pale', col: [0.8, 0.85, 1.0], fix: 'orb', msg: '青白い灯が、埃をかぶった回廊を照らしている。' },
];
export const LAB_THEMES = [
  { k: 'l_magenta', col: [1.0, 0.3, 0.85], fix: 'rune', msg: '床一面に魔法陣が描かれている。まだ微かに力が残っているようだ。' },
  { k: 'l_cyan', col: [0.3, 0.9, 1.0], fix: 'crystal', msg: '宙に浮かぶ水晶が、実験の続きを待っている。' },
  { k: 'l_violet', col: [0.65, 0.45, 1.0], fix: 'orb', msg: '灯の下に、書きかけの羊皮紙が散らばっている。' },
];
export const SUNKEN_THEMES = [nth(RUIN_THEMES, 0), nth(RUIN_THEMES, 3)];
/** 支道の中身（層の形・テーマ・からくり・宝物庫・群れ） */
export const BRANCH_STRATA = {
  crypt: {
    k: 'maze',
    branch: true,
    name: '墓所',
    msg: '冷たい石段を下りた。ここは死者のための回廊だ。',
    themes: CRYPT_THEMES,
    machines: ['crypt', 'crypt', 'statues', 'dismal', 'library'],
    vaults: ['ossuary', 'temple', 'labyrinth', 'throne'],
    hordes: ['W', 'P', 'w', 'k', 'J'],
    hordeMul: 1,
    torchMul: 0.25,
    fog: [0.004, 0.004, 0.012],
  },
  lair: {
    k: 'cavern',
    branch: true,
    name: '獣の巣',
    msg: '獣の匂いが立ちこめる洞窟に入った。あちこちで何かが息づいている。',
    cw: { towercap: 2.5, fungal: 2, mossfield: 1.5, swamp: 1.2, lake: 0.8 },
    hordes: ['r', 'j', 'v', 'm', 'b'],
    hordeMul: 1.25,
    fog: [0.006, 0.008, 0.004],
  },
  nest: {
    k: 'cavern',
    branch: true,
    name: '蜘蛛の巣',
    msg: '糸が幾重にも張りめぐらされた洞窟に入った。どこかで、何かが糸を伝って動いている。',
    cw: { fungal: 2, mossfield: 1, swamp: 1, crystal: 0.6 },
    denseWebs: true,
    hordes: ['S'],
    hordeMul: 1.3,
    fog: [0.008, 0.006, 0.012],
  },
  snake: {
    k: 'cavern',
    branch: true,
    name: '蛇の穴',
    msg: '乾いた砂地と、湿った水場が交互に続く洞窟。足元で、何かが這う音がする。',
    cw: { lake: 2.5, swamp: 1.5, mossfield: 1, crystal: 0.4 },
    hordes: ['n', 'N'],
    hordeMul: 1.2,
    fog: [0.012, 0.01, 0.004],
  },
  sunken: {
    k: 'ruins',
    branch: true,
    name: '水没神殿',
    msg: '足元を水が満たしている。神殿は、ゆっくりと水の底へ沈みつつある。',
    themes: SUNKEN_THEMES,
    flood: true,
    hordes: ['e', 'w', 'J', 'b'],
    hordeMul: 0.9,
    fog: [0.002, 0.008, 0.014],
  },
} satisfies Record<string, Stratum>;
/** 異界の中身 */
export const REALM_STRATA = {
  ice: {
    k: 'cavern',
    realm: true,
    name: '氷の洞窟',
    msg: '門をくぐると、凍てついた空気が肺を刺した。すべてが氷に閉ざされている。',
    cw: { crystal: 2.5, lake: 2, mossfield: 0.6 },
    freeze: true,
    fall: 'snow',
    hordes: ['w', 'b', 'v'],
    fog: [0.012, 0.016, 0.026],
  },
  lab: {
    k: 'maze',
    realm: true,
    name: '魔術師の研究所',
    msg: '門の先は、誰かの研究所だった。魔法陣と書物が、主の帰りを待っている。',
    themes: LAB_THEMES,
    machines: ['library', 'library', 'altar', 'statues'],
    vaults: ['observatory', 'temple', 'labyrinth'],
    hordes: ['w', 'c', 'b', 'J'],
  },
  volcano: {
    k: 'magma',
    realm: true,
    name: '火山',
    msg: '灼けた風が吹きつける。灰が雪のように降り続けている。',
    fall: 'ash',
    hordes: ['v', 'b', 'w'],
    fog: [0.022, 0.006, 0.002],
  },
} satisfies Record<string, Stratum>;
/** 深さ d の本道の層 */
export const stratumOf = (d: number): (typeof STRATA)[number] =>
  STRATA.find((st) => d >= st.from && d <= st.to) || nth(STRATA, STRATA.length - 1);
/** 深さ d に入口がある支道の名前（探索のシード runSeed で決まる。無ければ null） */
export function branchAtDepth(d: number, runSeed: number): string | null {
  const taken = new Set<number>();
  for (const k in BRANCHES) {
    const B = lookup(BRANCHES, k),
      span: number[] = [];
    for (let x = B.at[0]; x <= B.at[1]; x++) if (!taken.has(x)) span.push(x);
    if (!span.length) continue;
    const h = Math.imul(runSeed ^ (k.length * 0x9e37 + k.charCodeAt(0)), 2654435761) >>> 0,
      at = nth(span, h % span.length);
    taken.add(at);
    if (at === d) return k;
  }
  return null;
}
/** 生成の場所（levelDims が見る物） */
export interface PlaceKind {
  /** 図鑑の見本の階か（大広間を小さくしない） */
  showroom: boolean;
  realm: unknown;
  branch: unknown;
}
/** 階の大きさ（横・奥のマスの数）。層 st と深さ d と場所で決まる */
export function levelDims(st: { k: string; special?: boolean; realm?: boolean }, d: number, place: PlaceKind): [number, number] {
  if (st.k === 'bigroom' && !place.showroom) return [56, 34];
  if (st.k === 'fortress') return [56, 36];
  if (place.realm || st.special || st.realm) return [MW, MH];
  if (place.branch) return [46, 32];
  const k = st.k;
  let w = MW,
    h = MH;
  if (k === 'maze') {
    if (d <= 1) {
      w = 40;
      h = 28;
    } else {
      w = 50;
      h = 34;
    }
  } else if (k === 'cavern') {
    const f = clamp((d - 3) / 2, 0, 1);
    w = Math.round(60 + 10 * f);
    h = Math.round(40 + 6 * f);
  } else if (k === 'magma') {
    w = 70;
    h = 30;
  } else if (k === 'abyss') {
    w = 52;
    h = 36;
  }
  return [Math.min(MW, w), Math.min(MH, h)];
}
/** 地形（湖・茸の森・裂け目 など）。迷宮の中の大きな場所の種類 */
export const BIOMES = {
  lake: {
    k: 'lake',
    col: [0.25, 0.82, 1.0],
    base: 13.2,
    slope: 2.0,
    cave: true,
    msg: '天井の見えない大空洞に出た。光る湖の上を、無数の光の粒が星のように漂っている。',
  },
  chasm: {
    k: 'chasm',
    col: [1.0, 0.34, 0.14],
    base: 10.4,
    slope: 1.8,
    cave: true,
    msg: '足元に底知れぬ裂け目が口を開けている。深淵の奥から、燃える火の粉が立ち昇ってくる。',
  },
  fungal: { k: 'fungal', col: [0.25, 1.0, 0.55], base: 8.4, slope: 1.4, cave: true, msg: '巨大な茸が林立する、燐光の森に迷い込んだ。' },
  cathedral: {
    k: 'cathedral',
    col: [1.0, 0.62, 0.24],
    base: 12.8,
    slope: 3.2,
    cave: true,
    msg: '石の巨柱が闇へと伸びる、大聖堂のような空間。遥か頭上で琥珀の灯が揺れている。',
  },

  swamp: {
    k: 'swamp',
    col: [0.55, 0.9, 0.3],
    base: 8.0,
    slope: 1.6,
    cave: true,
    msg: '湿った沼地に足を踏み入れた。泥の泡がはじけ、鼻をつくガスが低く漂っている。',
  },
  crystal: {
    k: 'crystal',
    col: [0.6, 0.85, 1.0],
    base: 10.4,
    slope: 2.2,
    cave: true,
    msg: '透き通った結晶が林立する洞窟。光が結晶を抜けて、虹色に揺らめいている。',
  },
  towercap: {
    k: 'towercap',
    col: [0.72, 0.55, 1.0],
    base: 14,
    slope: 2.2,
    cave: true,
    msg: '茸の巨木が林立する森に出た。遥か頭上で、笠の裏が淡く光っている。',
  },
  mossfield: {
    k: 'mossfield',
    col: [0.3, 1.0, 0.85],
    base: 12,
    slope: 2.0,
    cave: true,
    msg: '光る苔が一面を覆う、静かな原。蛍のような光の粒が漂っている。',
  },
  basalt: {
    k: 'basalt',
    col: [1.0, 0.42, 0.14],
    base: 16,
    slope: 2.4,
    cave: true,
    msg: '黒い玄武岩の島。周りを、ゆっくりと流れる溶岩が取り囲んでいる。',
  },
  ashfield: {
    k: 'ashfield',
    col: [1.0, 0.55, 0.25],
    base: 15,
    slope: 2.2,
    cave: true,
    msg: '灰に覆われた焦土。燃え残りの熾火が、あちこちで赤く光っている。',
  },
  abyssal: {
    k: 'abyssal',
    col: [0.6, 0.4, 1.0],
    base: 22,
    slope: 3.0,
    cave: true,
    msg: '虚空に浮かぶ岩の欠片。足元の遥か下で、紫の光が渦を巻いている。',
  },
  warren: {
    k: 'warren',
    col: [0.85, 0.6, 0.35],
    base: 5.6,
    slope: 1.6,
    cave: true,
    msg: '泥で塗り固められたゴブリンの巣穴。干し草と、焚き火の燻った匂いがする。',
  },
  cavern: { k: 'cavern', col: [0.55, 0.55, 0.85], base: 17, slope: 2.5, cave: true, msg: '' },
  magma: {
    k: 'magma',
    col: [1.0, 0.36, 0.1],
    base: 11.2,
    slope: 2.0,
    cave: true,
    msg: '灼熱の大空洞に出た。溶岩の河がゆっくりと流れ、岩肌が赤く脈打っている。',
  },
} satisfies Record<string, Theme>;
// hordes (after Brogue): a leader and the followers that travel with it, gated by depth
/** 群れ（頭の生き物と、ついてくる生き物の数、出る深さ、重み） */
export const HORDES: Horde[] = [
  { lead: 'r', fol: [['r', 1, 3]], d: [1, 5], w: 3 },
  { lead: 'k', fol: [['k', 0, 2]], d: [1, 4], w: 3 },
  { lead: 'j', fol: [['j', 2, 4]], d: [1, 7], w: 2.5 },
  { lead: 'm', fol: [], d: [2, 8], w: 1.5 },
  { lead: 'b', fol: [['b', 0, 1]], d: [2, 12], w: 1.6 },
  { lead: 'g', fol: [['g', 0, 2]], d: [2, 99], w: 2 },
  { lead: 'c', fol: [['g', 2, 3]], d: [3, 99], w: 1.6 },
  { lead: 'J', fol: [], d: [3, 10], w: 1.5 },
  { lead: 'w', fol: [], d: [1, 99], w: 1.4 },
  { lead: 'Zf', fol: [['Zf', 2, 3]], d: [4, 99], w: 1.0 },
  { lead: 'Zi', fol: [['Zi', 2, 3]], d: [4, 99], w: 1.0 },
  { lead: 'Zl', fol: [['Zl', 1, 3]], d: [3, 99], w: 1.0 },
  { lead: 'v', fol: [['v', 0, 2]], d: [4, 99], w: 1.8 },
  { lead: 'O', fol: [['O', 0, 1]], d: [5, 99], w: 1.3 },
  { lead: 'W', fol: [], d: [6, 99], w: 1.4 },
  { lead: 'P', fol: [], d: [6, 99], w: 1.1 },
  { lead: 'n', fol: [['n', 1, 3]], d: [6, 99], w: 0.6 },
  { lead: 'S', fol: [['S', 0, 1]], d: [99, 99], w: 1.0 },
  { lead: 'N', fol: [['n', 1, 2]], d: [99, 99], w: 1.0 },
  { lead: 'T', fol: [], d: [6, 99], w: 1.0 },
  { lead: 'T', fol: [['T', 1, 1]], d: [9, 99], w: 0.5 },
  { lead: 'L', fol: [['W', 1, 2]], d: [9, 99], w: 0.5 },
  { lead: 'D', fol: [], d: [10, 99], w: 0.35 },
];

/** 深さ d の本道の層（もとは src/game/22-world-hints.js） */
export const stratumAtDepth = (d: number) => STRATA.find((s) => d >= s.from && d <= s.to);
