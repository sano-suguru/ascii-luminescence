// 迷宮の生成（もとは src/game/04-generate.js の generate）。「入力 → 結果」の形：
//   generateLevel(seed, depth, input, env) → { level, lordType, beastType }
//   input：探索のシード runSeed、場所（branch・realm・inter）、図鑑の見本か（showroom）、年代記（hist）、試練（trials）、使える武器（weapons）
//   env：生き物の表 MTYPES（src/lib/creatures.ts。読むだけ）と、ルーンを作る makeRune（src/lib/gear.ts）・特性を決める rollTraits（src/lib/runes.ts）
//   結果：階（level）と、その階の主の種類（lordType）・忘れられた獣（beastType）。生き物の表への書き込みは、古い JS の生成の呼び出し口（04-generate.js の generate）が行う
// 迷宮の乱数（setRand）とノイズの種（setNoiseSeed）は、ここで階のシードから入れ替える。
import { lookup, must, nth } from './array.ts';
import { type Light, computeVis, topLights } from './light.ts';
import { R, RI, pick, rand, setRand, shuffle } from './random.ts';
import { clamp, mulberry32 } from './rng.ts';
import { RUNE_TYPES } from './runes.ts';
import { setNoiseSeed, vnoise } from './noise.ts';
import { VAULTS, makeCave, vaultCells } from './vaults.ts';
import { makeBeastType } from './bodies/lords.ts';
import type { Art, History, HistoryEvent } from './history.ts';
import type { Rune } from './runes.ts';
import type { MonsterType } from './creatures.ts';
import {
  type Horde,
  type Stratum,
  type Theme,
  BIOMES,
  BRANCH_STRATA,
  FORT_THEMES,
  HORDES,
  REALM_STRATA,
  RUIN_THEMES,
  SPECIALS,
  THEMES,
  branchAtDepth,
  levelDims,
  stratumOf,
} from './strata.ts';
import {
  BASE_H,
  BRANCHES,
  CELL,
  D4,
  FINAL_DEPTH,
  FORT_KIND_MSG,
  LQ_BOG,
  LQ_DEEP,
  LQ_LAVA,
  LQ_WATER,
  MH,
  MW,
  NCELL,
  NSL,
  REALMS,
  ROCKS,
  RUIN_KIND_MSG,
  SF_BRIM,
  SF_DEAD,
  SF_FOLIAGE,
  SF_FUNGFOR,
  SF_GRASS,
  SF_HAY,
  SF_ICE,
  SF_LUMEN,
  SF_MUD,
  SF_OBSIDIAN,
  SF_RUBBLE,
  TC,
  TF,
  TP,
  TW,
  TX,
  VEIN_COL,
  blocksWalk,
  depthProfile,
} from './world.ts';

/** 支道の中にいる時の場所（今の支道・何階目か・全部で何階か・戻る深さ） */
export interface BranchPlace {
  key: string;
  lvl: number;
  len: number;
  ret: number;
}
/** 異界の中にいる時の場所（異界の名前・戻る深さ） */
export interface RealmPlace {
  key: string;
  ret: number;
}
/** 特別な階の中にいる時の場所（特別な階の名前・その前の深さ） */
export interface InterPlace {
  key: string;
  after: number;
}
/** 生成の入力 */
export interface GenInput {
  runSeed: number;
  branch: BranchPlace | null;
  realm: RealmPlace | null;
  inter: InterPlace | null;
  /** 図鑑の見本の階か */
  showroom: boolean;
  hist: History;
  /** 選んだ試練 */
  trials: readonly string[];
  /** 使える武器（解放したもの） */
  weapons: readonly string[];
}
/** 壁の彫刻（年代記の出来事。2マスにまたがる物は、2つ目のマスに skip を置く） */
export type Engraving = (HistoryEvent & { wide?: boolean; pi?: number }) | { skip: true; mi: number; art: Art };
/** 上下左右の向き（D4 の1つ） */
type Dir = (typeof D4)[number];
/** 生き物の種類（src/lib/creatures.ts） */
export type { MonsterType } from './creatures.ts';
/** 生成に外から渡す物（生き物の表と、ルーンを作る関数。テストは同じ物を渡す） */
export interface GenEnv {
  /** 生き物の表（読むだけ） */
  MTYPES: Readonly<Record<string, MonsterType>>;
  makeRune: (type: string) => Rune;
  rollTraits: (ru: Rune, d: number, bonus?: number) => Rune;
}
export type { Stratum, Theme } from './strata.ts';
/** 手で描いた宝物庫の絵（src/lib/vaults.ts の VAULTS の1つ） */
export type Vault = (typeof VAULTS)[number];
/** 部屋の仕掛け（Brogue の machine）の中身 */
export interface MachineData {
  type: string;
  fire?: number;
  beds?: number[];
  bones?: number[];
  altar?: number;
  shelves?: { i: number; dx: number; dz: number }[];
  pages?: number[];
  tombs?: { i: number; yaw: number }[];
  statues?: number[];
  awaken?: number[];
  ponds?: number[];
  carpet?: number[];
  ash?: number[];
  blood?: number[];
  char?: number[];
  inert?: number[];
  order?: number[];
  plant?: number;
  bones2?: number[];
  src?: number;
  pit?: number[];
}
/** 部屋（ふつうの部屋・宝物庫・洞窟・廃墟の広間） */
export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  shape: string;
  cx: number;
  cy: number;
  theme: Theme | null;
  cells: number[];
  cave: boolean;
  chasm: number[];
  lava: number[];
  mush: number[];
  deep: number[];
  bog: number[];
  xtal: number[];
  clusters: { c: number; col: number[] }[];
  cells0?: number[];
  ruin?: boolean;
  fort?: boolean;
  rkind?: string;
  rh?: number;
  special?: boolean;
  kindMsg?: string;
  vaultPref?: boolean;
  forceVault?: Vault;
  vault?: Vault;
  shell?: boolean;
  noShell?: boolean;
  vfx?: [string, number][];
  vstat?: number[];
  vcarpet?: number[];
  valtar?: number[];
  tables?: number[];
  anvils?: number[];
  sanct?: boolean;
  mdata?: MachineData;
  machine?: string;
  camp?: number;
  lair?: boolean;
  giant?: boolean;
  colossus?: number;
  alcove?: boolean;
}
/** 生き物が湧く所（群れ g の頭 lead など） */
export interface Spawn {
  key: string;
  cx: number;
  cz: number;
  g?: number;
  lead?: boolean;
  home?: number;
  camp?: number;
  route?: number[];
  elite?: boolean;
}
/** 灯り（light.ts の Light に、色・強さ・種類・揺らぎを足した物。vis は後で古い JS が入れる） */
export interface LevelLight extends Omit<Light, 'vis'> {
  col: number[];
  int: number;
  type: string;
  ph: number;
  f: number;
  vis: Light['vis'] | null;
}
/** 灯りの備品（たいまつ・水晶 など） */
export interface Fixture {
  type: string;
  x: number;
  z: number;
  col: number[];
  li: number;
  acc: number;
  ph: number;
  nx?: number;
  nz?: number;
  wx?: number;
  wz?: number;
  /** 泉の、壁の向き */
  wd?: readonly number[];
}
/** マスに描く飾りの文字 */
export interface CellMark {
  ch: string;
  col: number[];
  k?: string;
}
/** 扉（i の通路のマスと、j の部屋のマスの間） */
export interface Door {
  i: number;
  j: number;
  bx: number;
  bz: number;
  yaw: number;
  o: number;
}
/** 鉄格子の宝物庫（cell の鉄格子と、別の所にある lever のレバー。ld はレバーの壁の向き、heir は中の遺品の名前） */
export interface Gate {
  cell: number;
  lever: number;
  ld: Dir;
  open: boolean;
  o: number;
  axis: number;
  heir?: string;
}
/** 隠れた罠（流れ出す罠は、水の広がる順 order を持つ） */
export interface Trap {
  i: number;
  type: string;
  hidden: boolean;
  used: boolean;
  order?: number[];
}
/** 床に置かれた物（祭壇の選択肢は、祭壇の組 grp・何番目か slot と、選んだ時のこと opt などを持つ。祭壇の中身は src/lib/altars.ts の altarFill が入れる） */
export interface Item {
  i: number;
  kind: string;
  taken: boolean;
  rune?: Rune | null;
  vault?: boolean;
  /** 祭壇の組（'altar1'・'start' など） */
  grp?: string;
  altar?: boolean;
  slot?: number;
  /** 主の祭壇（強い選択肢）・鍛えの祭壇 */
  lord?: boolean;
  forge?: boolean;
  /** 選ぶと何が起きるか（'rune'・'heal'・'forge'・'open'） */
  opt?: string;
  /** 鍛える武器・特性・上げた後の段 */
  forgeW?: Rune;
  forgeK?: string;
  forgeTo?: number;
  /** 番人の群れ（この群れが生きている間は暗く、取れない） */
  guardG?: number;
  /** 枠を開ける選択肢の名前 */
  label?: string;
}
/** その階の主の種類（生き物の表の1つを元に、名前や形を変えた物。古い JS が MTYPES.lord に入れる） */
export type LordType = MonsterType & { sk: string; boss: boolean };

/**
 * 部屋を作る。必須の欄（床のマス cells、深い水 deep などの中の配列）をすべてそろえて作る。
 * 中心 cx・cy は四角の真ん中。more は、宝物庫の印・テーマ・廃墟の種類など部屋ごとの欄（同じ名前なら more の値で上書きする）
 */
function newRoom(x: number, y: number, w: number, h: number, shape: string, more: Partial<Room> = {}): Room {
  return {
    x,
    y,
    w,
    h,
    shape,
    cx: x + (w >> 1),
    cy: y + (h >> 1),
    theme: null,
    cells: [],
    cave: false,
    chasm: [],
    lava: [],
    mush: [],
    deep: [],
    bog: [],
    xtal: [],
    clusters: [],
    ...more,
  };
}

export function generateLevel(seed: number, depth: number, input: GenInput, env: GenEnv) {
  const { runSeed, branch, realm, inter, showroom, hist: HIST, trials, weapons } = input,
    { MTYPES, makeRune, rollTraits } = env;
  let lordType: LordType | null = null,
    beastType: ReturnType<typeof makeBeastType> | null = null;
  setRand(mulberry32(seed));
  const W = MW,
    H = MH,
    N = NCELL;
  const prof = depthProfile(depth);
  const tile = new Uint8Array(N),
    liquid = new Uint8Array(N),
    surface = new Uint8Array(N),
    roomOf = new Int16Array(N).fill(-1);
  const walk = (j: number): boolean => tile[j] === TF && !blocksWalk(nth(liquid, j));
  const bridge = new Uint8Array(N),
    bridgeDir = new Uint8Array(N),
    xtalCol = new Map<number, number[]>();
  const ns = (rand() * 1e9) | 0;
  setNoiseSeed(ns);
  const ceil = new Float32Array(N).fill(BASE_H),
    dfield = new Int16Array(N),
    flow = new Float32Array(N);
  const overlaps = (
    list: readonly { x: number; y: number; w: number; h: number }[],
    x: number,
    y: number,
    w: number,
    h: number,
    m: number,
  ): boolean => list.some((r) => x < r.x + r.w + m && x + w + m > r.x && y < r.y + r.h + m && y + h + m > r.y);

  const stratum: Stratum = realm
    ? lookup<Stratum>(REALM_STRATA, realm.key)
    : branch
      ? lookup<Stratum>(BRANCH_STRATA, branch.key)
      : inter
        ? lookup<Stratum>(SPECIALS, inter.key)
        : stratumOf(depth);
  const [UW, UH] = levelDims(stratum, depth, { showroom, realm, branch });
  let caves: Room[] = [],
    normals: Room[] = [],
    rooms: Room[];
  if (stratum.k === 'ruins' || stratum.k === 'fortress') {
    const fort = stratum.k === 'fortress';
    // ---- the Ancient Ruins (after Caves of Qud): a decaying megastructure of grand halls on a grid of broad avenues
    const cols = RI(3, 4),
      rowsN = fort ? 3 : rand() < 0.45 ? 2 : 3,
      bw = Math.floor((UW - 2) / cols),
      bh = Math.floor((UH - 2) / rowsN),
      streetH = fort ? 3.6 : 5.2;
    const carveS = (x: number, y: number): void => {
      if (x < 1 || y < 1 || x > UW - 2 || y > UH - 2) return;
      const i = y * W + x;
      if (tile[i] === TW) {
        tile[i] = TF;
        ceil[i] = streetH;
      }
    };
    for (let bx = 0; bx < cols; bx++) {
      const X0 = 1 + bx * bw;
      for (let y = 1; y < UH - 1; y++) {
        carveS(X0, y);
        carveS(X0 + 1, y);
      }
    }
    for (let by = 0; by < rowsN; by++) {
      const Y0 = 1 + by * bh;
      for (let x = 1; x < UW - 1; x++) {
        carveS(x, Y0);
        carveS(x, Y0 + 1);
      }
    }
    const KINDS = fort
      ? ['dining', 'forge', 'crypt', 'library', 'statues', 'hall', 'flooded']
      : ['hall', 'hall', 'atrium', 'plaza', 'garden'];
    for (let by = 0; by < rowsN; by++)
      for (let bx = 0; bx < cols; bx++) {
        const X0 = 1 + bx * bw,
          Y0 = 1 + by * bh,
          x = X0 + 3,
          y = Y0 + 3,
          w = bw - 4,
          h = bh - 4;
        if (w < 5 || h < 4 || x + w > UW - 1 || y + h > UH - 1) continue;
        if (normals.length > 0 && rand() < 0.08) continue;
        normals.push(
          newRoom(x, y, w, h, 'rect', {
            ruin: true,
            fort,
            rkind: normals.length === 0 ? 'hall' : pick(KINDS),
            rh: Math.round((fort ? R(4.4, 5.6) : R(6.4, 10)) / 0.4) * 0.4,
          }),
        );
      }
    rooms = normals;
    caves = [];
    rooms.forEach((r, ri) => {
      for (let yy = r.y; yy < r.y + r.h; yy++)
        for (let xx = r.x; xx < r.x + r.w; xx++) {
          const i = yy * W + xx;
          tile[i] = TF;
          roomOf[i] = ri;
          ceil[i] = must(r.rh);
        }
    });
    // gates (2 wide) from every hall onto the avenues, and a few extra ones
    rooms.forEach((r) => {
      const gate = (x0: number, y0: number, horiz: boolean): void => {
        for (const o of [0, 1]) {
          if (horiz) carveS(x0, y0 + o);
          else carveS(x0 + o, y0);
        }
      };
      gate(r.x - 1, r.cy - 1, true);
      gate(r.x + r.w, r.cy - 1, true);
      gate(r.cx - 1, r.y - 1, false);
      gate(r.cx - 1, r.y + r.h, false);
      if (rand() < 0.5) gate(r.x - 1, RI(r.y + 1, r.y + r.h - 3), true);
      if (rand() < 0.5) gate(RI(r.x + 1, r.x + r.w - 3), r.y + r.h, false);
    });
    // decay: breaches through thin walls, rubble everywhere
    for (let i = W; i < N - W; i++) {
      if (tile[i] !== TW) continue;
      const lr = tile[i - 1] === TF && tile[i + 1] === TF,
        ud = tile[i - W] === TF && tile[i + W] === TF;
      if ((lr || ud) && rand() < (fort ? 0.025 : 0.07)) {
        tile[i] = TF;
        ceil[i] = streetH;
        surface[i] = SF_RUBBLE;
        for (const d of D4) {
          const j = i + d[0] + d[1] * W;
          if (tile[j] === TF && rand() < 0.6) surface[j] = SF_RUBBLE;
        }
      }
    }
    for (let i = 0; i < N; i++)
      if (tile[i] === TF && !surface[i] && D4.some((d) => tile[i + d[0] + d[1] * W] === TW) && rand() < 0.05) surface[i] = SF_RUBBLE;
    // an aqueduct runs down the middle of one avenue
    if (!fort) {
      const Y0 = 1 + RI(1, rowsN - 1) * bh;
      for (let x = 1; x < UW - 1; x++) {
        const i = Y0 * W + x;
        if (tile[i] === TF && nth(roomOf, i) < 0 && !surface[i]) {
          liquid[i] = LQ_WATER;
          flow[i] = 10;
        }
      }
    }
  } else if (stratum.k === 'bigroom' || stratum.k === 'town') {
    // ---- one enormous hall between two small chambers (NetHack's Big Room; the town is built inside such a hall)
    const town = stratum.k === 'town',
      cyM = UH >> 1;
    normals = [
      { x: 2, y: cyM - 3, w: 7, h: 7 },
      { x: 12, y: 3, w: UW - 24, h: UH - 6 },
      { x: UW - 9, y: cyM - 3, w: 7, h: 7 },
    ].map((r) => newRoom(r.x, r.y, r.w, r.h, 'rect'));
    nth(normals, 1).special = true;
    nth(normals, 1).kindMsg = town ? '' : '天井の高みまで、無数の灯が整然と並んでいる。';
    rooms = normals;
    caves = [];
    rooms.forEach((r, ri) => {
      const rh = ri === 1 ? (town ? 8 : 10.4) : 3.6;
      for (let yy = r.y; yy < r.y + r.h; yy++)
        for (let xx = r.x; xx < r.x + r.w; xx++) {
          const i = yy * W + xx;
          tile[i] = TF;
          roomOf[i] = ri;
          ceil[i] = rh;
        }
    });
    const doors: [number, number][] = [
      [9, 11],
      [UW - 12, UW - 10],
    ];
    for (const [x0, x1] of doors)
      for (let x = x0; x <= x1; x++)
        for (const y of [cyM, cyM + 1]) {
          const i = y * W + x;
          tile[i] = TF;
          ceil[i] = 3.2;
        }
  } else if (stratum.k === 'maze' || stratum.k === 'oracle') {
    // caverns first (the large open spaces)
    caves = [];
    const nCave = stratum.k === 'oracle' ? 0 : 1 + (rand() < 0.6 ? 1 : 0);
    const bk: string[] = [];
    {
      const w: Record<string, number> = { ...prof.biomes, ...(stratum.k === 'maze' ? { warren: 1.3 } : {}) };
      for (let c = 0; c < 2; c++) {
        let tot = 0;
        for (const k in w) tot += lookup(w, k);
        let r0 = rand() * tot,
          chosen: string | null = null;
        for (const k in w) {
          r0 -= lookup(w, k);
          if (r0 <= 0) {
            chosen = k;
            break;
          }
        }
        if (!chosen) chosen = nth(Object.keys(w), 0);
        bk.push(chosen);
        delete w[chosen];
      }
    }
    for (let c = 0; c < nCave; c++) {
      for (let a = 0; a < 40; a++) {
        const w = c === 0 ? RI(22, 30) : RI(15, 21),
          h = c === 0 ? RI(15, 21) : RI(12, 16);
        const x = RI(1, UW - w - 1),
          y = RI(1, UH - h - 1);
        if (overlaps(caves, x, y, w, h, 3)) continue;
        const loc = makeCave(w, h);
        if (!loc) continue;
        // 中心 cx・cy は仮（四角の真ん中）。下で、床の重心に近いマスに置き直す
        caves.push(
          newRoom(x, y, w, h, 'cave', {
            cave: true,
            cells0: loc.map((li) => (y + ((li / w) | 0)) * W + x + (li % w)),
            theme: lookup(BIOMES, nth(bk, c)),
          }),
        );
        break;
      }
    }
    // rooms sized for a hand-drawn vault are reserved first, then ordinary rooms fill the rest
    const vRooms = [];
    if (stratum.k === 'oracle') {
      const ov = must(VAULTS.find((v) => v.k === 'oracle')),
        w = nth(ov.map, 0).length + 4,
        h = ov.map.length + 4,
        x = (UW - w) >> 1,
        y = (UH - h) >> 1;
      if (!overlaps(caves, x, y, w, h, 1)) vRooms.push(newRoom(x, y, w, h, 'rect', { vaultPref: true, forceVault: ov }));
    }
    {
      const vo = VAULTS.filter((v) => v.strata.includes('maze') && depth >= v.minD),
        want = RI(1, 2);
      for (let t = 0; t < 400 && vRooms.length < want && vo.length; t++) {
        const v = pick(vo),
          w = nth(v.map, 0).length + RI(2, 3),
          h = v.map.length + RI(2, 3),
          x = RI(1, UW - w - 1),
          y = RI(1, UH - h - 1);
        if (overlaps(vRooms, x, y, w, h, 2) || overlaps(caves, x, y, w, h, 2)) continue;
        vRooms.push(newRoom(x, y, w, h, 'rect', { vaultPref: true }));
      }
    }
    // ordinary rooms
    normals = [];
    for (let i = 0; i < 800 && normals.length < 12; i++) {
      const w = RI(5, 12),
        h = RI(5, 9),
        x = RI(1, UW - w - 1),
        y = RI(1, UH - h - 1);
      if (overlaps(normals, x, y, w, h, 2) || overlaps(caves, x, y, w, h, 2) || overlaps(vRooms, x, y, w, h, 2)) continue;
      const s = rand();
      const shape = s < 0.2 ? 'ellipse' : s < 0.32 && w >= 7 && h >= 7 ? 'cross' : 'rect';
      normals.push(newRoom(x, y, w, h, shape));
    }
    normals = normals.concat(vRooms);
    rooms = normals.concat(caves);
    rooms.forEach((r, ri) => {
      if (r.cave) {
        let sx = 0,
          sy = 0;
        for (const i of must(r.cells0)) {
          tile[i] = TF;
          roomOf[i] = ri;
          sx += i % W;
          sy += (i / W) | 0;
        }
        sx /= must(r.cells0).length;
        sy /= must(r.cells0).length;
        let bi = nth(must(r.cells0), 0),
          bd = 1e9;
        for (const i of must(r.cells0)) {
          const d = ((i % W) - sx) ** 2 + (((i / W) | 0) - sy) ** 2;
          if (d < bd) {
            bd = d;
            bi = i;
          }
        }
        r.cx = bi % W;
        r.cy = (bi / W) | 0;
        return;
      }
      const rh = r.shape === 'ellipse' ? 4.4 : pick([3.2, 3.2, 3.6, 4.0]);
      for (let yy = r.y; yy < r.y + r.h; yy++)
        for (let xx = r.x; xx < r.x + r.w; xx++) {
          let ok = true;
          if (r.shape === 'ellipse') {
            const dx = (xx + 0.5 - (r.x + r.w / 2)) / (r.w / 2),
              dy = (yy + 0.5 - (r.y + r.h / 2)) / (r.h / 2);
            ok = dx * dx + dy * dy <= 1.05;
          } else if (r.shape === 'cross') {
            const ix = xx - r.x,
              iy = yy - r.y,
              bx = Math.floor(r.w / 3),
              by = Math.floor(r.h / 3);
            ok = (ix >= bx && ix < r.w - bx) || (iy >= by && iy < r.h - by);
          }
          if (ok) {
            const i = yy * W + xx;
            tile[i] = TF;
            roomOf[i] = ri;
            ceil[i] = rh;
          }
        }
    });
    // connect everything
    const edges: [number, number][] = [],
      inTree = [0],
      rest = new Set(rooms.map((_, i) => i));
    rest.delete(0);
    const rd = (a: number, b: number): number =>
      Math.abs(nth(rooms, a).cx - nth(rooms, b).cx) + Math.abs(nth(rooms, a).cy - nth(rooms, b).cy);
    while (rest.size) {
      let best: [number, number] | null = null,
        bd = 1e9;
      for (const a of inTree)
        for (const b of rest) {
          const d = rd(a, b);
          if (d < bd) {
            bd = d;
            best = [a, b];
          }
        }
      edges.push(must(best));
      inTree.push(must(best)[1]);
      rest.delete(must(best)[1]);
    }
    for (let k = 0; k < 4; k++) {
      const a = RI(0, rooms.length - 1);
      const others = rooms
        .map((_, i) => i)
        .filter((i) => i !== a)
        .sort((p, q) => rd(a, p) - rd(a, q));
      if (others.length > 2) edges.push([a, nth(others, RI(1, 2))]);
    }
    const carve = (x: number, y: number): void => {
      if (x < 1 || y < 1 || x > UW - 2 || y > UH - 2) return;
      const i = y * W + x;
      if (tile[i] === TW) {
        tile[i] = TF;
        ceil[i] = BASE_H;
      }
    };
    for (const [ai, bi] of edges) {
      const a = nth(rooms, ai),
        b = nth(rooms, bi);
      let x = a.cx,
        y = a.cy;
      const sx = () => {
        while (x !== b.cx) {
          x += Math.sign(b.cx - x);
          carve(x, y);
        }
      };
      const sy = () => {
        while (y !== b.cy) {
          y += Math.sign(b.cy - y);
          carve(x, y);
        }
      };
      if (rand() < 0.5) {
        sx();
        sy();
      } else {
        sy();
        sx();
      }
    }
  } else {
    // ---- the Great Caverns (after Dwarf Fortress's cavern layers): one vast cave system crossed by an underground river
    let g = new Uint8Array(N);
    const edgeOf = (x: number, y: number): number => Math.min(x, y, UW - 1 - x, UH - 1 - y);
    for (let y = 1; y < UH - 1; y++) for (let x = 1; x < UW - 1; x++) g[y * W + x] = edgeOf(x, y) > 2 && rand() < 0.6 ? 1 : 0;
    for (let k = RI(4, 6); k > 0; k--) {
      const cx = RI(9, UW - 10),
        cy = RI(7, UH - 8),
        rx = R(4, 9),
        ry = R(3.5, 7);
      for (let y = 2; y < UH - 2; y++)
        for (let x = 2; x < UW - 2; x++) {
          const dx = (x - cx) / rx,
            dy = (y - cy) / ry;
          if (dx * dx + dy * dy < 1) g[y * W + x] = 1;
        }
    }
    for (let it = 0; it < 5; it++) {
      const ng = new Uint8Array(N);
      for (let y = 1; y < UH - 1; y++)
        for (let x = 1; x < UW - 1; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += nth(g, (y + dy) * W + x + dx);
          ng[y * W + x] = edgeOf(x, y) < 2 ? 0 : n >= 5 ? 1 : n < 4 ? 0 : nth(g, y * W + x);
        }
      g = ng;
    }
    const comps = (val: number): number[][] => {
      const lab = new Int32Array(N).fill(-1),
        out: number[][] = [];
      for (let s0 = 0; s0 < N; s0++) {
        if (g[s0] !== val || nth(lab, s0) >= 0) continue;
        const list = [s0];
        lab[s0] = out.length;
        for (let h = 0; h < list.length; h++) {
          const c = nth(list, h),
            x = c % W,
            y = (c / W) | 0;
          for (const d of D4) {
            const xx = x + d[0],
              yy = y + d[1];
            if (xx < 0 || yy < 0 || xx >= UW || yy >= UH) continue;
            const j = yy * W + xx;
            if (g[j] === val && nth(lab, j) < 0) {
              lab[j] = out.length;
              list.push(j);
            }
          }
        }
        out.push(list);
      }
      return out;
    };
    {
      const oc = comps(1).sort((p, q) => q.length - p.length);
      for (let k = 1; k < oc.length; k++) for (const i of nth(oc, k)) g[i] = 0;
    }
    {
      const rc = comps(0);
      for (const list of rc) {
        if (list.length < 6 && !list.some((i) => edgeOf(i % W, (i / W) | 0) < 2)) for (const i of list) g[i] = 1;
      }
    }
    for (let i = 0; i < N; i++) if (g[i]) tile[i] = TF;
    let magSeeds: number[] = [];
    if (stratum.k === 'cavern') {
      // the river meanders from the west edge to the east edge, carving its own channel through the rock
      const path: [number, number][] = [];
      {
        let ry = RI(10, UH - 11),
          ty = RI(8, UH - 9);
        for (let x = 2; x < UW - 2; x++) {
          ry = clamp(ry + clamp(Math.round((ty - ry) * 0.1 + (vnoise(x * 0.15, 7.3, 0.5) - 0.5) * 2.6), -1, 1), 4, UH - 5);
          path.push([x, ry]);
          if (rand() < 0.05) ty = RI(8, UH - 9);
        }
      }
      path.forEach(([px, py], pi) => {
        const pa = nth(path, Math.max(0, pi - 2)),
          pb = nth(path, Math.min(path.length - 1, pi + 2)),
          ang = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]);
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const d = Math.hypot(dx, dy),
              x = px + dx,
              y = py + dy;
            if (edgeOf(x, y) < 1) continue;
            const i = y * W + x;
            if (d <= 0.9) {
              tile[i] = TF;
              liquid[i] = LQ_DEEP;
              flow[i] = ang + 10;
            } else if (d <= 1.8) {
              tile[i] = TF;
              if (liquid[i] !== LQ_DEEP) liquid[i] = LQ_WATER;
              flow[i] = ang + 10;
            }
          }
      });
      const ford = (k: number): void => {
        const [px, py] = nth(path, clamp(k, 0, path.length - 1));
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const i = (py + dy) * W + px + dx;
            if (Math.hypot(dx, dy) <= 1.8 && tile[i] === TF && liquid[i] === LQ_DEEP) liquid[i] = LQ_WATER;
          }
      };
      for (let k = RI(4, 8); k < path.length; k += RI(9, 15)) ford(k);
      // make sure everything walkable is reachable: add fords until it is
      {
        const anyWalk = () => {
          for (let i = 0; i < N; i++) if (walk(i) && !liquid[i]) return i;
          return -1;
        };
        for (let tries = 0; tries < 40; tries++) {
          const s0 = anyWalk(),
            seen = new Uint8Array(N),
            st = [s0];
          seen[s0] = 1;
          while (st.length) {
            const c = must(st.pop());
            for (const d of D4) {
              const j = c + d[0] + d[1] * W;
              if (!seen[j] && walk(j)) {
                seen[j] = 1;
                st.push(j);
              }
            }
          }
          let missing = false;
          for (let i = 0; i < N; i++)
            if (walk(i) && !seen[i]) {
              missing = true;
              break;
            }
          if (!missing) break;
          ford(RI(0, path.length - 1));
        }
        for (let i = 0; i < N; i++) if (liquid[i] === LQ_DEEP && tile[i] !== TF) liquid[i] = 0;
      }
    } else if (stratum.k === 'abyss') {
      // ---- the Abyss (after DCSS's Abyss and NetHack's Gehennom): fragments of the world above, drifting over the void, tied together by rope bridges
      const cand0: number[] = [];
      for (let i = 0; i < N; i++) if (tile[i] === TF && edgeOf(i % W, (i / W) | 0) > 3) cand0.push(i);
      magSeeds = [nth(cand0, Math.floor(rand() * cand0.length))];
      while (magSeeds.length < 10) {
        let bi = -1,
          bd = -1;
        for (let t = 0; t < 300; t++) {
          const c = nth(cand0, Math.floor(rand() * cand0.length));
          let md = 1e9;
          for (const o of magSeeds) {
            const d = ((c % W) - (o % W)) ** 2 + (((c / W) | 0) - ((o / W) | 0)) ** 2;
            if (d < md) md = d;
          }
          if (md > bd) {
            bd = md;
            bi = c;
          }
        }
        if (bd < 30) break;
        magSeeds.push(bi);
      }
      for (let i = 0; i < N; i++) if (tile[i] === TF) tile[i] = TC;
      for (const c of magSeeds) {
        const cx = c % W,
          cy = (c / W) | 0;
        if (rand() < 0.45) {
          const hw = RI(2, 3),
            hh = RI(1, 3);
          for (let y = cy - hh; y <= cy + hh; y++)
            for (let x = cx - hw; x <= cx + hw; x++) {
              if (edgeOf(x, y) >= 2 && rand() > 0.06) tile[y * W + x] = TF;
            }
        } else {
          const rr = R(2.2, 3.8);
          for (let dy = -5; dy <= 5; dy++)
            for (let dx = -5; dx <= 5; dx++) {
              const x = cx + dx,
                y = cy + dy;
              if (edgeOf(x, y) < 2) continue;
              if (Math.hypot(dx, dy) <= rr + vnoise(x * 0.5, 2.9, y * 0.5) * 1.4 - 0.5) tile[y * W + x] = TF;
            }
        }
        tile[c] = TF;
      }
      const span = (a: number, b: number): void => {
        let x = a % W,
          y = (a / W) | 0;
        const tx = b % W,
          ty = (b / W) | 0,
          hf = rand() < 0.5;
        const put = (dir: number): void => {
          const i = y * W + x;
          if (tile[i] === TC || tile[i] === TW) {
            tile[i] = TF;
            bridge[i] = 1;
            bridgeDir[i] = dir;
          }
        };
        const sx = () => {
            while (x !== tx) {
              x += Math.sign(tx - x);
              put(0);
            }
          },
          sy = () => {
            while (y !== ty) {
              y += Math.sign(ty - y);
              put(1);
            }
          };
        if (hf) {
          sx();
          sy();
        } else {
          sy();
          sx();
        }
      };
      {
        const inT = [0],
          rest2 = new Set(magSeeds.map((_, k) => k));
        rest2.delete(0);
        const dd = (a: number, b: number): number =>
          Math.abs((nth(magSeeds, a) % W) - (nth(magSeeds, b) % W)) + Math.abs(((nth(magSeeds, a) / W) | 0) - ((nth(magSeeds, b) / W) | 0));
        while (rest2.size) {
          let best: [number, number] | null = null,
            bd2 = 1e9;
          for (const a of inT)
            for (const b of rest2) {
              const d = dd(a, b);
              if (d < bd2) {
                bd2 = d;
                best = [a, b];
              }
            }
          span(nth(magSeeds, must(best)[0]), nth(magSeeds, must(best)[1]));
          inT.push(must(best)[1]);
          rest2.delete(must(best)[1]);
        }
        for (let k = 0; k < 2; k++) {
          const a = RI(0, magSeeds.length - 1),
            b = RI(0, magSeeds.length - 1);
          if (a !== b) span(nth(magSeeds, a), nth(magSeeds, b));
        }
      }
      {
        const seen = new Uint8Array(N),
          st = [nth(magSeeds, 0)];
        seen[nth(magSeeds, 0)] = 1;
        while (st.length) {
          const c = must(st.pop());
          for (const d of D4) {
            const j = c + d[0] + d[1] * W;
            if (!seen[j] && walk(j)) {
              seen[j] = 1;
              st.push(j);
            }
          }
        }
        for (let i = 0; i < N; i++)
          if (walk(i) && !seen[i]) {
            tile[i] = TC;
            bridge[i] = 0;
          }
      }
    } else {
      // ---- the Magma Sea (after Dwarf Fortress): basalt islands joined by narrow causeways over a sea of lava
      const cand0: number[] = [];
      for (let i = 0; i < N; i++) if (tile[i] === TF && edgeOf(i % W, (i / W) | 0) > 3) cand0.push(i);
      magSeeds = [nth(cand0, Math.floor(rand() * cand0.length))];
      while (magSeeds.length < 11) {
        let bi = -1,
          bd = -1;
        for (let t = 0; t < 300; t++) {
          const c = nth(cand0, Math.floor(rand() * cand0.length));
          let md = 1e9;
          for (const o of magSeeds) {
            const d = ((c % W) - (o % W)) ** 2 + (((c / W) | 0) - ((o / W) | 0)) ** 2;
            if (d < md) md = d;
          }
          if (md > bd) {
            bd = md;
            bi = c;
          }
        }
        if (bd < 24) break;
        magSeeds.push(bi);
      }
      for (let i = 0; i < N; i++) if (tile[i] === TF) liquid[i] = LQ_LAVA;
      for (const c of magSeeds) {
        const rr = R(2.6, 4.6),
          cx = c % W,
          cy = (c / W) | 0;
        for (let dy = -5; dy <= 5; dy++)
          for (let dx = -5; dx <= 5; dx++) {
            const x = cx + dx,
              y = cy + dy;
            if (edgeOf(x, y) < 1) continue;
            const i = y * W + x;
            if (Math.hypot(dx, dy) <= rr + vnoise(x * 0.5, 1.7, y * 0.5) * 1.2 - 0.4) {
              tile[i] = TF;
              liquid[i] = 0;
            }
          }
      }
      const causeway = (a: number, b: number): void => {
        let x = a % W,
          y = (a / W) | 0;
        const tx = b % W,
          ty = (b / W) | 0;
        for (let guard = 0; (x !== tx || y !== ty) && guard < 500; guard++) {
          const dx = tx - x,
            dy = ty - y;
          if (rand() < 0.3) {
            if (rand() < 0.5 && dy !== 0) y += Math.sign(dy);
            else if (dx !== 0) x += Math.sign(dx);
            else y += Math.sign(dy);
          } else if (Math.abs(dx) > Math.abs(dy)) x += Math.sign(dx);
          else y += Math.sign(dy);
          x = clamp(x, 2, UW - 3);
          y = clamp(y, 2, UH - 3);
          const i = y * W + x;
          tile[i] = TF;
          liquid[i] = 0;
          {
            const j = i + (rand() < 0.5 ? 1 : W);
            if (edgeOf(j % W, (j / W) | 0) >= 1) {
              tile[j] = TF;
              liquid[j] = 0;
            }
          }
        }
      };
      {
        const inT = [0],
          rest2 = new Set(magSeeds.map((_, k) => k));
        rest2.delete(0);
        const dd = (a: number, b: number): number =>
          Math.abs((nth(magSeeds, a) % W) - (nth(magSeeds, b) % W)) + Math.abs(((nth(magSeeds, a) / W) | 0) - ((nth(magSeeds, b) / W) | 0));
        while (rest2.size) {
          let best: [number, number] | null = null,
            bd2 = 1e9;
          for (const a of inT)
            for (const b of rest2) {
              const d = dd(a, b);
              if (d < bd2) {
                bd2 = d;
                best = [a, b];
              }
            }
          causeway(nth(magSeeds, must(best)[0]), nth(magSeeds, must(best)[1]));
          inT.push(must(best)[1]);
          rest2.delete(must(best)[1]);
        }
        for (let k = 0; k < 2; k++) {
          const a = RI(0, magSeeds.length - 1),
            b = RI(0, magSeeds.length - 1);
          if (a !== b) causeway(nth(magSeeds, a), nth(magSeeds, b));
        }
      }
      // cooled crust: obsidian footholds creeping out from the shores
      for (let i = W; i < N - W; i++) {
        if (liquid[i] !== LQ_LAVA || tile[i] !== TF) continue;
        if (D4.some((d) => walk(i + d[0] + d[1] * W)) && vnoise((i % W) * 0.4, 4.2, ((i / W) | 0) * 0.4) > 0.55 && rand() < 0.55)
          liquid[i] = 0;
      }
      {
        const seen = new Uint8Array(N),
          st = [nth(magSeeds, 0)];
        seen[nth(magSeeds, 0)] = 1;
        while (st.length) {
          const c = must(st.pop());
          for (const d of D4) {
            const j = c + d[0] + d[1] * W;
            if (!seen[j] && walk(j)) {
              seen[j] = 1;
              st.push(j);
            }
          }
        }
        for (let i = 0; i < N; i++) if (walk(i) && !seen[i]) liquid[i] = LQ_LAVA;
      }
    }
    // regions: each part of the cave system gets its own character (multi-source flood from far-apart seeds)
    const cand: number[] = [];
    for (let i = 0; i < N; i++) if (walk(i) && !liquid[i]) cand.push(i);
    const seeds =
      stratum.k === 'magma' || stratum.k === 'abyss' ? magSeeds.filter((c) => walk(c)) : [nth(cand, Math.floor(rand() * cand.length))];
    while (seeds.length < 7) {
      let bi = -1,
        bd = -1;
      for (let t = 0; t < 400; t++) {
        const c = nth(cand, Math.floor(rand() * cand.length));
        let md = 1e9;
        for (const o of seeds) {
          const d = ((c % W) - (o % W)) ** 2 + (((c / W) | 0) - ((o / W) | 0)) ** 2;
          if (d < md) md = d;
        }
        if (md > bd) {
          bd = md;
          bi = c;
        }
      }
      if (bd < 36) break;
      seeds.push(bi);
    }
    {
      const q: number[] = [];
      seeds.forEach((sd0, k) => {
        roomOf[sd0] = k;
        q.push(sd0);
      });
      for (let h = 0; h < q.length; h++) {
        const c = nth(q, h);
        for (const d of D4) {
          const j = c + d[0] + d[1] * W;
          if ((tile[j] === TF || (stratum.k === 'abyss' && tile[j] === TC)) && nth(roomOf, j) < 0) {
            roomOf[j] = nth(roomOf, c);
            q.push(j);
          }
        }
      }
    }
    const cw: Record<string, number> = stratum.cw || {
      warren: 0.8,
      mossfield: 2,
      towercap: 2.2,
      lake: 1.6,
      crystal: 1.2,
      fungal: 1,
      swamp: 0.8,
      chasm: 0.9,
      magma: depth >= 4 ? 0.9 : 0,
    };
    const pickCW = (): Theme => {
      let tot = 0;
      for (const k in cw) tot += lookup(cw, k);
      let r0 = rand() * tot;
      for (const k in cw) {
        r0 -= lookup(cw, k);
        if (r0 <= 0) return lookup(BIOMES, k);
      }
      return BIOMES.mossfield;
    };
    caves = seeds.map((sd0, k) => {
      const cells0: number[] = [];
      let x0 = W,
        y0 = H,
        x1 = 0,
        y1 = 0;
      for (let i = 0; i < N; i++)
        if (roomOf[i] === k) {
          cells0.push(i);
          const x = i % W,
            y = (i / W) | 0;
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      return newRoom(x0, y0, x1 - x0 + 1, y1 - y0 + 1, 'cave', {
        cave: true,
        noShell: true,
        cells0,
        cx: sd0 % W,
        cy: (sd0 / W) | 0,
        theme:
          stratum.k === 'abyss'
            ? k === 0
              ? BIOMES.abyssal
              : pick([BIOMES.abyssal, BIOMES.mossfield, BIOMES.crystal, BIOMES.towercap, BIOMES.fungal, BIOMES.abyssal])
            : stratum.k === 'magma'
              ? k === 0 || rand() < 0.6
                ? BIOMES.basalt
                : rand() < 0.75
                  ? BIOMES.ashfield
                  : BIOMES.crystal
              : k === 0
                ? BIOMES.mossfield
                : pickCW(),
      });
    });
    const all: number[] = [];
    for (let i = 0; i < N; i++) if (tile[i] === TF || (stratum.k === 'abyss' && tile[i] === TC)) all.push(i);
    caves.push(
      newRoom(1, 1, UW - 2, UH - 2, 'cave', {
        cave: true,
        shell: true,
        cells0: all,
        cx: nth(caves, 0).cx,
        cy: nth(caves, 0).cy,
        theme: BIOMES.cavern,
      }),
    );
    rooms = caves.slice();
    normals = [];
  }
  // cavern ceilings rise toward the middle
  rooms.forEach((r, ri) => {
    if (!r.cave || r.shell) return;
    const q: number[] = [];
    for (const i of must(r.cells0)) {
      if (D4.some((d) => roomOf[i + d[0] + d[1] * W] !== ri)) {
        dfield[i] = 1;
        q.push(i);
      }
    }
    for (let h = 0; h < q.length; h++) {
      const i = nth(q, h);
      for (const d of D4) {
        const j = i + d[0] + d[1] * W;
        if (roomOf[j] === ri && !dfield[j]) {
          dfield[j] = nth(dfield, i) + 1;
          q.push(j);
        }
      }
    }
    const B = must(r.theme);
    for (const i of must(r.cells0)) ceil[i] = Math.round(Math.min(must(B.base), 3.6 + (nth(dfield, i) - 1) * must(B.slope)) / 0.4) * 0.4;
  });
  const startI = nth(rooms, 0).cy * W + nth(rooms, 0).cx;
  const flood = (from: number): number => {
    const seen = new Uint8Array(N),
      st = [from];
    seen[from] = 1;
    let c = 0;
    while (st.length) {
      const i = must(st.pop());
      c++;
      const x = i % W,
        y = (i / W) | 0;
      for (const d of D4) {
        const j = (y + d[1]) * W + x + d[0];
        if (!seen[j] && walk(j)) {
          seen[j] = 1;
          st.push(j);
        }
      }
    }
    return c;
  };
  const countTF = (): number => {
    let c = 0;
    for (let i = 0; i < N; i++) if (walk(i)) c++;
    return c;
  };
  // vaults: stamp a few hand-drawn ASCII rooms into ordinary rooms, keeping every walkable cell reachable
  const vaultCell = new Uint8Array(N);
  const stampAt = (r: Room, vt: Vault, m: string[][], ox: number, oy: number): boolean => {
    const saved: [number, number, number, number][] = [],
      fx: [string, number][] = [];
    for (let y = 0; y < m.length; y++)
      for (let x = 0; x < nth(m, 0).length; x++) {
        const ch = nth(m, y)[x];
        if (ch === ' ') continue;
        const xx = ox + x,
          yy = oy + y;
        if (xx < 1 || yy < 1 || xx > UW - 2 || yy > UH - 2) continue;
        const i = yy * W + xx;
        saved.push([i, nth(tile, i), nth(liquid, i), nth(surface, i)]);
        surface[i] = 0;
        liquid[i] = 0;
        if (ch === '#' || ch === 'H') tile[i] = TW;
        else if (ch === ':') tile[i] = TC;
        else if (ch === 'X') {
          tile[i] = TX;
          xtalCol.set(i, vt.wcol);
        } else if (ch === '0' || ch === '&' || ch === '_') {
          tile[i] = TP;
          if (ch !== '0') fx.push([ch, i]);
        } else {
          tile[i] = TF;
          if (ch === '~') liquid[i] = LQ_WATER;
          else if (ch === 'W') liquid[i] = LQ_DEEP;
          else if (ch === 'L') liquid[i] = LQ_LAVA;
          else if (ch === '"') surface[i] = rand() < 0.5 ? SF_LUMEN : SF_GRASS;
          else if (ch === 'x') surface[i] = SF_RUBBLE;
          else if (ch === '*' || ch === 'c') fx.push([ch, i]);
        }
      }
    if (flood(startI) !== countTF()) {
      for (const [i, t0, l0, s0] of saved) {
        tile[i] = t0;
        liquid[i] = l0;
        surface[i] = s0;
      }
      return false;
    }
    r.vfx = (r.vfx || []).concat(fx);
    const vi = VAULTS.indexOf(vt) + 1;
    for (const [i] of saved) vaultCell[i] = vi;
    return true;
  };
  for (const r of rooms) {
    if (!r.forceVault) continue;
    const vt = r.forceVault,
      m = vt.map.map((x) => x.split(''));
    if (stampAt(r, vt, m, r.x + ((r.w - nth(m, 0).length) >> 1), r.y + ((r.h - m.length) >> 1))) {
      r.vault = vt;
      r.kindMsg = vt.msg;
    }
  }
  if (stratum.k === 'town') {
    // the town: a fountain plaza in the middle, houses, shops and a temple on a loose grid around it
    const big = nth(rooms, 1),
      hs = VAULTS.filter((v) => v.k === 'house' || v.k === 'shop'),
      tp = must(VAULTS.find((v) => v.k === 'townTemple')),
      fo = must(VAULTS.find((v) => v.k === 'townFountain'));
    stampAt(
      big,
      fo,
      fo.map.map((x) => x.split('')),
      big.cx - 3,
      big.cy - 2,
    );
    let templeDone = false;
    for (let gy = big.y + 1; gy + 8 <= big.y + big.h; gy += 9)
      for (let gx = big.x + 1; gx + 10 <= big.x + big.w; gx += 11) {
        if (Math.abs(gx + 4 - big.cx) < 9 && Math.abs(gy + 3 - big.cy) < 6) continue;
        if (rand() < 0.12) continue;
        const vt = !templeDone && rand() < 0.3 ? tp : pick(hs),
          m = vaultCells(vt);
        if (stampAt(big, vt, m, gx + RI(0, 1), gy + RI(0, 1)) && vt === tp) templeDone = true;
      }
  }
  if (stratum.k === 'maze' || stratum.k === 'ruins' || stratum.k === 'oracle') {
    const sk = stratum.k === 'oracle' ? 'maze' : stratum.k;
    const want = stratum.k === 'ruins' ? RI(2, 3) : RI(1, 2),
      opts = VAULTS.filter((v) => (stratum.vaults ? stratum.vaults.includes(v.k) : v.strata.includes(sk) && depth >= v.minD));
    let placed = 0;
    const order = shuffle(rooms.map((_, i) => i).filter((i) => i > 0)).sort(
      (a2, b2) => (nth(rooms, b2).vaultPref ? 1 : 0) - (nth(rooms, a2).vaultPref ? 1 : 0),
    );
    for (const ri of order) {
      if (placed >= want || !opts.length) break;
      const r = nth(rooms, ri);
      if (r.cave || r.shape !== 'rect' || r.vault) continue;
      let mg = 2;
      const fit = (w: number, h: number): boolean => w <= r.w - mg && h <= r.h - mg;
      let fits = opts.filter((v) => fit(nth(v.map, 0).length, v.map.length) || fit(v.map.length, nth(v.map, 0).length));
      if (!fits.length && r.ruin) {
        mg = 0;
        fits = opts.filter((v) => fit(nth(v.map, 0).length, v.map.length) || fit(v.map.length, nth(v.map, 0).length));
      }
      if (!fits.length) continue;
      let tw = 0;
      for (const v of fits) tw += v.map.length * nth(v.map, 0).length;
      let r0 = rand() * tw,
        vt = nth(fits, 0);
      for (const v of fits) {
        r0 -= v.map.length * nth(v.map, 0).length;
        if (r0 <= 0) {
          vt = v;
          break;
        }
      }
      let m = vaultCells(vt);
      if (!fit(nth(m, 0).length, m.length)) {
        const t2: string[][] = [];
        for (let x = 0; x < nth(m, 0).length; x++) t2.push(m.map((row) => nth(row, x)));
        m = t2;
      }
      if (!fit(nth(m, 0).length, m.length)) continue;
      const vh = m.length,
        vw = nth(m, 0).length;
      const ox = r.x + Math.floor((r.w - vw) / 2),
        oy = r.y + Math.floor((r.h - vh) / 2),
        saved: [number, number, number, number][] = [],
        fx: [string, number][] = [];
      for (let y = 0; y < vh; y++)
        for (let x = 0; x < vw; x++) {
          const ch = nth(m, y)[x];
          if (ch === ' ') continue;
          const i = (oy + y) * W + ox + x;
          saved.push([i, nth(tile, i), nth(liquid, i), nth(surface, i)]);
          surface[i] = 0;
          liquid[i] = 0;
          if (ch === '#' || ch === 'H') tile[i] = TW;
          else if (ch === ':') tile[i] = TC;
          else if (ch === 'X') {
            tile[i] = TX;
            xtalCol.set(i, vt.wcol);
          } else if (ch === '0' || ch === '&' || ch === '_') {
            tile[i] = TP;
            if (ch !== '0') fx.push([ch, i]);
          } else {
            tile[i] = TF;
            if (ch === '~') liquid[i] = LQ_WATER;
            else if (ch === 'W') liquid[i] = LQ_DEEP;
            else if (ch === 'L') liquid[i] = LQ_LAVA;
            else if (ch === '"') surface[i] = rand() < 0.5 ? SF_LUMEN : SF_GRASS;
            else if (ch === 'x') surface[i] = SF_RUBBLE;
            else if (ch === '*' || ch === 'c') fx.push([ch, i]);
          }
        }
      if (flood(startI) !== countTF()) {
        for (const [i, t0, l0, s0] of saved) {
          tile[i] = t0;
          liquid[i] = l0;
          surface[i] = s0;
        }
        continue;
      }
      r.vault = vt;
      r.vfx = fx;
      r.kindMsg = vt.msg;
      if (r.ruin) r.rkind = 'vault';
      placed++;
      const vi = VAULTS.indexOf(vt) + 1;
      for (const [i] of saved) vaultCell[i] = vi;
    }
  }
  // bridges: rope bridges over chasms, stone causeways over deep water, laid where they save the longest detour
  const bfsDist = (a: number, b: number): number => {
    const dd = new Int32Array(N).fill(-1),
      q = [a];
    dd[a] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = nth(q, h);
      if (i === b) return nth(dd, i);
      for (const d of D4) {
        const j = i + d[0] + d[1] * W;
        if (nth(dd, j) < 0 && walk(j)) {
          dd[j] = nth(dd, i) + 1;
          q.push(j);
        }
      }
    }
    return -1;
  };
  const bridgeAcross = (r: Room, isGap: (j: number) => boolean, kind: number): boolean => {
    const cands: [number, number, (typeof D4)[number], number][] = [];
    for (const a of must(r.cells0)) {
      if (!walk(a)) continue;
      for (const d of D4) {
        let j = a + d[0] + d[1] * W,
          k = 0;
        while (isGap(j) && k < 12) {
          j += d[0] + d[1] * W;
          k++;
        }
        if (k < 2 || k > 9 || !walk(j)) continue;
        cands.push([a, j, d, k]);
      }
    }
    if (!cands.length) return false;
    let best: (typeof cands)[number] | null = null,
      bs = -1;
    for (let t = 0; t < Math.min(40, cands.length); t++) {
      const c = nth(cands, Math.floor(rand() * cands.length));
      const dd = bfsDist(c[0], c[1]);
      const sc = (dd < 0 ? 1000 : dd) - c[3];
      if (sc > bs) {
        bs = sc;
        best = c;
      }
    }
    if (!best || bs < 6) return false;
    const [a, , d, k] = best;
    let j = a + d[0] + d[1] * W;
    for (let st = 0; st < k; st++) {
      bridge[j] = kind;
      bridgeDir[j] = d[0] ? 0 : 1;
      if (kind === 1) tile[j] = TF;
      else liquid[j] = 0;
      j += d[0] + d[1] * W;
    }
    return true;
  };
  // biome terrain
  rooms.forEach((r) => {
    if (!r.cave) return;
    const blob = (minD: number): number[] =>
      must(r.cells0).filter((i) => {
        const x = (i % W) + 0.5,
          y = ((i / W) | 0) + 0.5,
          dx = (x - (r.x + r.w / 2)) / (r.w * 0.3),
          dy = (y - (r.y + r.h / 2)) / (r.h * 0.3);
        return tile[i] === TF && dx * dx + dy * dy < 1 + 0.3 * Math.sin(x * 0.9 + y * 0.7) && nth(dfield, i) >= minD;
      });
    if (must(r.theme).k === 'chasm') {
      const b = blob(2);
      if (b.length < 10) r.theme = BIOMES.lake;
      else {
        b.forEach((i) => (tile[i] = TC));
        for (let tries = 0; tries < 3 && flood(startI) !== countTF(); tries++) if (!bridgeAcross(r, (j) => tile[j] === TC, 1)) break;
        if (flood(startI) !== countTF()) {
          b.forEach((i) => {
            tile[i] = TF;
            bridge[i] = 0;
          });
          const b3 = blob(3);
          b3.forEach((i) => (tile[i] = TC));
          if (flood(startI) !== countTF()) {
            b3.forEach((i) => (tile[i] = TF));
            r.theme = BIOMES.lake;
          } else bridgeAcross(r, (j) => tile[j] === TC, 1);
        } else if (rand() < 0.8) bridgeAcross(r, (j) => tile[j] === TC, 1);
      }
    }
    if (must(r.theme).k === 'lake') {
      blob(2).forEach((i) => (liquid[i] = LQ_WATER));
      const core = blob(3).filter((i) => liquid[i] === LQ_WATER);
      if (core.length >= 6) {
        core.forEach((i) => (liquid[i] = LQ_DEEP));
        for (let tries = 0; tries < 3 && flood(startI) !== countTF(); tries++) if (!bridgeAcross(r, (j) => liquid[j] === LQ_DEEP, 2)) break;
        if (flood(startI) !== countTF())
          core.forEach((i) => {
            liquid[i] = LQ_WATER;
            bridge[i] = 0;
          });
        else if (rand() < 0.6) bridgeAcross(r, (j) => liquid[j] === LQ_DEEP, 2);
      }
    }
    if (must(r.theme).k === 'towercap' || must(r.theme).k === 'mossfield') {
      /* vegetation comes from the surface pass and the lights below */
    }
    if (must(r.theme).k === 'warren') {
      for (const i of must(r.cells0)) {
        if (tile[i] !== TF || liquid[i]) continue;
        const v = vnoise((i % W) * 0.5, 6.6, ((i / W) | 0) * 0.5);
        surface[i] = v > 0.68 ? SF_HAY : SF_MUD;
      }
    }
    if (must(r.theme).k === 'swamp') {
      for (const i of must(r.cells0)) {
        if (tile[i] !== TF || liquid[i]) continue;
        if (vnoise((i % W) * 0.4, 2.2, ((i / W) | 0) * 0.4) > 0.55) surface[i] = SF_MUD;
      }
      for (const i of must(r.cells0)) {
        if (tile[i] !== TF) continue;
        const x = i % W,
          y = (i / W) | 0;
        const v = vnoise(x * 0.33, 0.5, y * 0.33) * 0.7 + vnoise(x * 0.9, 3.1, y * 0.9) * 0.3;
        if (v > 0.46) liquid[i] = LQ_BOG;
      }
    }
    if (must(r.theme).k === 'crystal') {
      const pal = [
        [0.55, 0.85, 1.0],
        [0.75, 0.6, 1.0],
        [0.85, 0.95, 1.0],
        [0.5, 1.0, 0.85],
      ];
      const pool = must(r.cells0).filter((i) => tile[i] === TF && nth(dfield, i) >= 2),
        seeds: number[] = [];
      for (let t = 0; t < 60 && seeds.length < 9; t++) {
        const c = pool[Math.floor(rand() * pool.length)];
        if (c === undefined) break;
        if (seeds.every((o) => Math.hypot((o % W) - (c % W), ((o / W) | 0) - ((c / W) | 0)) > 3.5)) seeds.push(c);
      }
      for (const s0 of seeds) {
        const rad = R(0.8, 1.9),
          sx = s0 % W,
          sy = (s0 / W) | 0,
          cl = must(r.cells0).filter((i) => tile[i] === TF && Math.hypot((i % W) - sx, ((i / W) | 0) - sy) <= rad);
        cl.forEach((i) => (tile[i] = TX));
        if (flood(startI) !== countTF()) {
          cl.forEach((i) => (tile[i] = TF));
          continue;
        }
        const col = pick(pal);
        cl.forEach((i) => xtalCol.set(i, col));
        r.clusters.push({ c: s0, col });
      }
      for (const i of must(r.cells0)) {
        if (tile[i] !== TF || dfield[i] !== 1 || rand() > 0.22) continue;
        tile[i] = TX;
        if (flood(startI) !== countTF()) tile[i] = TF;
        else xtalCol.set(i, pick(pal));
      }
    }
    if (must(r.theme).k === 'magma') {
      let ok = false;
      for (const md of [2, 3, 4]) {
        const b = blob(md);
        if (b.length < 6) continue;
        b.forEach((i) => (liquid[i] = LQ_LAVA));
        if (flood(startI) === countTF()) {
          ok = true;
          break;
        }
        b.forEach((i) => (liquid[i] = 0));
      }
      if (!ok) blob(2).forEach((i) => (surface[i] = SF_OBSIDIAN));
    }
    if (must(r.theme).k === 'cathedral') {
      for (let py = r.y + 2; py < r.y + r.h - 2; py += 4)
        for (let px = r.x + 2; px < r.x + r.w - 2; px += 4) {
          const blk = [py * W + px, py * W + px + 1, (py + 1) * W + px, (py + 1) * W + px + 1];
          if (!blk.every((i) => tile[i] === TF && roomOf[i] === rooms.indexOf(r) && nth(dfield, i) >= 3)) continue;
          blk.forEach((i) => (tile[i] = TW));
          if (flood(startI) !== countTF()) blk.forEach((i) => (tile[i] = TF));
        }
    }
  });
  // pillars in ordinary rooms
  let base = flood(startI);
  rooms.forEach((r) => {
    if (r.cave || r.vault || r.special || r.shape !== 'rect' || r.w < 7 || r.h < 6 || (r.ruin ? r.rkind !== 'hall' : rand() < 0.25)) return;
    for (let py = r.y + 2; py < r.y + r.h - 2; py += 3)
      for (let px = r.x + 2; px < r.x + r.w - 2; px += 3) {
        if (px === r.cx || py === r.cy) continue;
        const i = py * W + px;
        if (tile[i] !== TF) continue;
        tile[i] = TP;
        const c = flood(startI);
        if (c !== base - 1) tile[i] = TF;
        else base = c;
      }
  });
  const TH: Theme[] = stratum.themes
    ? stratum.themes
    : stratum.k === 'ruins'
      ? RUIN_THEMES
      : stratum.k === 'fortress'
        ? FORT_THEMES
        : THEMES;
  const pickTheme = (): Theme => {
    let tot = 0;
    const ws = TH.map((th) => {
      const w = th.fix === 'brazier' ? 1.7 - 1.2 * prof.t : th.k === 'emerald' ? 0.6 + 0.9 * prof.t : 1;
      tot += w;
      return w;
    });
    let r0 = rand() * tot;
    for (let k = 0; k < TH.length; k++) {
      r0 -= nth(ws, k);
      if (r0 <= 0) return nth(TH, k);
    }
    return nth(TH, 0);
  };
  normals.forEach((r, i) => {
    let th;
    do {
      th = pickTheme();
    } while (i > 0 && th === nth(normals, i - 1).theme && rand() < 0.85);
    r.theme = th;
  });
  // pools in ordinary rooms: water near the surface, lava in the depths
  normals.forEach((r, ri) => {
    if (ri === 0 || r.vault || r.special || r.fort || r.w < 6 || r.h < 5) return;
    const lava = rand() < prof.lavaPool,
      bogp = !lava && rand() < prof.bogPool,
      wet = !lava && !bogp && rand() < 0.3;
    if (!lava && !wet && !bogp) return;
    const k = lava ? 1.7 : 1.3,
      rx = r.w / 2 - k,
      ry = r.h / 2 - k,
      ox = r.x + r.w / 2 + R(-0.8, 0.8),
      oy = r.y + r.h / 2 + R(-0.6, 0.6);
    const pool = [];
    for (let yy = r.y; yy < r.y + r.h; yy++)
      for (let xx = r.x; xx < r.x + r.w; xx++) {
        const i = yy * W + xx;
        if (roomOf[i] !== ri || tile[i] !== TF) continue;
        const dx = (xx + 0.5 - ox) / rx,
          dy = (yy + 0.5 - oy) / ry;
        if (dx * dx + dy * dy < 1) pool.push(i);
      }
    if (!pool.length) return;
    pool.forEach((i) => (liquid[i] = lava ? LQ_LAVA : bogp ? LQ_BOG : LQ_WATER));
    if (lava && flood(startI) !== countTF()) pool.forEach((i) => (liquid[i] = 0));
    if (wet && pool.length >= 14) {
      const ps = new Set(pool),
        core = pool.filter((i) => D4.every((d) => ps.has(i + d[0] + d[1] * W)));
      if (core.length >= 3) {
        core.forEach((i) => (liquid[i] = LQ_DEEP));
        if (flood(startI) !== countTF()) core.forEach((i) => (liquid[i] = LQ_WATER));
      }
    }
  });
  for (let i = 0; i < N; i++) {
    const ri = nth(roomOf, i);
    if (ri < 0) continue;
    const R0 = nth(rooms, ri);
    if (tile[i] === TC) R0.chasm.push(i);
    else if (tile[i] === TX) R0.xtal.push(i);
    else if (tile[i] === TF) {
      const l = liquid[i];
      if (l === LQ_LAVA) R0.lava.push(i);
      else if (l === LQ_DEEP) R0.deep.push(i);
      else {
        R0.cells.push(i);
        if (l === LQ_BOG) R0.bog.push(i);
      }
    }
  }
  // surface layer: moss, luminescent fungus, cooled obsidian around lava
  for (let i = 0; i < N; i++) {
    if (!walk(i) || liquid[i]) continue;
    let nearLava = false;
    for (let dy = -1; dy <= 1 && !nearLava; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (liquid[i + dx + dy * W] === LQ_LAVA) {
          nearLava = true;
          break;
        }
      }
    if (nearLava) {
      surface[i] = SF_OBSIDIAN;
      continue;
    }
    if (surface[i]) continue;
    const ri = nth(roomOf, i),
      nearWall = D4.some((d) => tile[i + d[0] + d[1] * W] === TW),
      k = ri >= 0 ? must(nth(rooms, ri).theme).k : '';
    const lum = k === 'emerald' || k === 'fungal' || k === 'towercap' || k === 'mossfield',
      shore =
        (k === 'lake' || stratum.k === 'cavern') &&
        D4.some((d) => liquid[i + d[0] + d[1] * W] === LQ_WATER || liquid[i + d[0] + d[1] * W] === LQ_DEEP),
      swamp = k === 'swamp' || D4.some((d) => liquid[i + d[0] + d[1] * W] === LQ_BOG);
    const p = k === 'mossfield' ? 0.85 : lum ? 0.55 : swamp ? 0.42 : shore ? 0.35 : (nearWall ? 0.07 : 0.015) * prof.grass;
    if (rand() < p)
      surface[i] = swamp ? (rand() < 0.7 ? SF_DEAD : SF_GRASS) : lum || shore || rand() < prof.lumen * 0.2 ? SF_LUMEN : SF_GRASS;
  }
  // stairs in the farthest area
  const dist = new Int32Array(N).fill(-1);
  {
    const q = [startI];
    dist[startI] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = nth(q, h);
      for (const d of D4) {
        const j = i + d[0] + d[1] * W;
        if (nth(dist, j) < 0 && walk(j)) {
          dist[j] = nth(dist, i) + 1;
          q.push(j);
        }
      }
    }
  }
  let best = 1,
    bd = -1;
  rooms.forEach((r, ri) => {
    if (ri === 0 || !r.cells.length) return;
    const d = nth(dist, nth(r.cells, 0));
    if (d > bd) {
      bd = d;
      best = ri;
    }
  });
  // a level of one great cave has no other room: the stairs go to the farthest dry floor from the start
  let stI: number;
  const sroom = rooms[best] && best !== 0 ? nth(rooms, best) : null;
  if (!sroom) {
    let far = -1;
    stI = startI;
    for (let i = 0; i < N; i++) {
      if (nth(dist, i) > far && !liquid[i] && walk(i)) {
        far = nth(dist, i);
        stI = i;
      }
    }
  } else {
    stI = nth(sroom.cells, 0);
    let sbd = 1e9;
    for (const i of sroom.cells) {
      if (liquid[i]) continue;
      const d = ((i % W) - sroom.cx) ** 2 + (((i / W) | 0) - sroom.cy) ** 2;
      if (d < sbd) {
        sbd = d;
        stI = i;
      }
    }
  }
  liquid[stI] = 0;
  surface[stI] = 0;

  // lights and fixtures
  const lights: LevelLight[] = [],
    fixtures: Fixture[] = [],
    fixCell = new Map<number, CellMark>(),
    used = new Set<number>();
  const addFix = (type: string, ci: number, col: number[], y: number, int: number, rad: number, chr: string): void => {
    if (lights.length >= NSL) return;
    const x = ((ci % W) + 0.5) * CELL,
      z = (((ci / W) | 0) + 0.5) * CELL;
    lights.push({ x, y, z, col, int, rad, type, ph: rand() * 100, f: 1, vis: null });
    fixtures.push({ type, x, z, col, li: lights.length - 1, acc: 0, ph: rand() * 6.28 });
    fixCell.set(ci, { ch: chr, col });
    used.add(ci);
  };
  addFix('stairs', stI, [1.0, 0.76, 0.36], 1.7, 2.0, 8.5, '>');
  // doors where a corridor meets an ordinary room
  const doors: Door[] = [],
    doorAt = new Int16Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    if (!walk(i) || nth(roomOf, i) >= 0 || used.has(i)) continue;
    for (const d of D4) {
      const j = i + d[0] + d[1] * W,
        rj = nth(roomOf, j);
      if (rj < 0 || nth(rooms, rj).cave || !walk(j)) continue;
      if (tile[i - d[1] + d[0] * W] !== TW || tile[i + d[1] - d[0] * W] !== TW) continue;
      if (!walk(i - d[0] - d[1] * W)) continue;
      if (rand() > prof.door) break;
      let close = false;
      for (const o of doors) {
        if (Math.abs((o.i % W) - (i % W)) <= 1 && Math.abs(((o.i / W) | 0) - ((i / W) | 0)) <= 1) {
          close = true;
          break;
        }
      }
      if (close) break;
      const cx = i % W,
        cz = (i / W) | 0;
      doorAt[i] = doors.length;
      doors.push({ i, j, bx: (cx + 0.5 + d[0] * 0.5) * CELL, bz: (cz + 0.5 + d[1] * 0.5) * CELL, yaw: Math.atan2(-d[0], -d[1]), o: 0 });
      used.add(i);
      break;
    }
  }
  const cd = (a: number, b: number): number => ((a % W) - (b % W)) ** 2 + (((a / W) | 0) - ((b / W) | 0)) ** 2;
  const spread = (cands: readonly number[], n: number): number[] => {
    const out: number[] = [];
    if (!cands.length || n < 1) return out;
    out.push(nth(cands, Math.floor(rand() * cands.length)));
    while (out.length < n) {
      let bi = -1,
        bdd = -1;
      for (const c of cands) {
        let md = 1e9;
        for (const o of out) {
          const d = cd(c, o);
          if (d < md) md = d;
        }
        if (md > bdd) {
          bdd = md;
          bi = c;
        }
      }
      if (bdd < 9) break;
      out.push(bi);
    }
    return out;
  };
  const nearWallC = (i: number): boolean => D4.some((d) => tile[i + d[0] + d[1] * W] === TW);
  rooms.forEach((r) => {
    const th = must(r.theme),
      area = r.cells.length;
    const ok = r.cells.filter((i) => !used.has(i) && cd(i, stI) > 4);
    const dry = ok.filter((i) => !liquid[i] && !bridge[i]);
    const edge = dry.filter(nearWallC);
    const inner = ok.filter((i) => !D4.some((d) => tile[i + d[0] + d[1] * W] !== TF));
    if (r.cave) {
      switch (th.k) {
        case 'lake': {
          const wet = ok.filter((i) => liquid[i] === LQ_WATER);
          for (const i of spread(wet.length ? wet : ok, 4))
            addFix(
              'crystal',
              i,
              pick([
                [0.25, 0.82, 1.0],
                [0.5, 0.68, 1.0],
                [0.4, 1.0, 0.88],
              ]),
              R(3.2, 4.6),
              2.5,
              14,
              '*',
            );
          for (const i of spread(edge, 1)) addFix('fungus', i, [0.3, 0.9, 1.0], 0.6, 1.3, 8, '"');
          break;
        }
        case 'chasm':
          for (const i of spread(r.chasm, 3))
            addFix(
              'abyss',
              i,
              pick([
                [1.0, 0.3, 0.12],
                [1.0, 0.55, 0.15],
                [1.0, 0.18, 0.3],
              ]),
              -3.2,
              3.4,
              13,
              '^',
            );
          for (const i of spread(edge, 2)) addFix('brazier', i, [1.0, 0.42, 0.14], 1.35, 2.2, 9, '*');
          break;
        case 'fungal':
          for (const i of spread(dry, 5))
            addFix(
              'fungus',
              i,
              pick([
                [0.25, 1.0, 0.55],
                [0.3, 0.9, 1.0],
                [0.6, 1.0, 0.35],
              ]),
              0.6,
              1.6,
              9,
              '"',
            );
          r.mush = spread(
            dry.filter((i) => nth(dfield, i) >= 2 && !used.has(i)),
            9,
          );
          break;
        case 'swamp':
          for (const i of spread(
            ok.filter((i) => liquid[i] === LQ_BOG),
            4,
          ))
            addFix(
              'marsh',
              i,
              pick([
                [0.55, 1.0, 0.45],
                [0.75, 1.0, 0.5],
                [0.4, 0.95, 0.7],
              ]),
              1.3,
              1.4,
              8,
              '*',
            );
          break;
        case 'crystal':
          for (const cl of r.clusters.slice(0, 8)) addFix('xlight', cl.c, cl.col, 1.6, 1.9, 10.5, '#');
          break;
        case 'towercap':
          for (const i of spread(dry, 4))
            addFix(
              'fungus',
              i,
              pick([
                [0.72, 0.55, 1.0],
                [0.4, 0.85, 1.0],
              ]),
              0.6,
              1.6,
              10,
              '"',
            );
          r.mush = spread(
            dry.filter((i) => nth(dfield, i) >= 2 && !used.has(i)),
            16,
          );
          r.giant = true;
          break;
        case 'mossfield':
          for (const i of spread(dry, 3)) addFix('fungus', i, [0.3, 1.0, 0.85], 0.6, 1.4, 10, '"');
          for (const i of spread(
            dry.filter((i) => !used.has(i)),
            3,
          ))
            addFix(
              'firefly',
              i,
              pick([
                [0.6, 1.0, 0.6],
                [0.5, 0.95, 1.0],
              ]),
              1.4,
              1.1,
              8,
              '.',
            );
          break;
        case 'abyssal':
          for (const i of spread(dry, 2))
            addFix(
              'crystal',
              i,
              pick([
                [0.6, 0.4, 1.0],
                [0.9, 0.3, 0.6],
              ]),
              2.3,
              1.8,
              10,
              '*',
            );
          break;
        case 'ashfield':
          for (const i of spread(dry, 4)) addFix('embers', i, [1.0, 0.48, 0.16], 0.45, 1.2, 6.5, '*');
          break;
        case 'magma':
          for (const i of spread(edge, 1)) addFix('brazier', i, [1.0, 0.3, 0.1], 1.35, 1.6, 8, '*');
          break;
        case 'cathedral':
          for (const i of spread(edge, 4))
            addFix(
              'brazier',
              i,
              pick([
                [1.0, 0.55, 0.17],
                [1.0, 0.2, 0.22],
              ]),
              1.35,
              2.4,
              10,
              '*',
            );
          for (const i of spread(
            dry.filter((i) => nth(dfield, i) >= 3),
            3,
          ))
            addFix('lamp', i, [1.0, 0.7, 0.35], nth(ceil, i) - 3.6, 2.0, 12, '*');
          break;
      }
      return;
    }
    const n = area > 60 ? 3 : area > 30 ? 2 : 1;
    if (th.fix === 'brazier') {
      for (const i of spread(edge.length ? edge : dry, n + (area > 85 ? 1 : 0))) addFix('brazier', i, th.col, 1.35, 2.4, 9.5, '*');
    } else if (th.fix === 'crystal') {
      for (const i of spread(inner.length ? inner : ok, n)) addFix('crystal', i, th.col, 1.95, 2.0, 11, '*');
    } else if (th.fix === 'orb') {
      for (const i of spread(edge.length ? edge : dry, n + 1)) addFix('orb', i, th.col, 1.65, 2.1, 11, 'o');
    } else if (th.fix === 'rune') {
      const c = r.cy * W + r.cx;
      const list = ok.includes(c) && !liquid[c] ? [c] : spread(inner.length ? inner : dry, 1);
      for (const i of list) addFix('rune', i, th.col, 0.7, 2.3, 10.5, '0');
      if (area > 55) {
        for (const i of spread(
          edge.filter((i) => !used.has(i)),
          1,
        ))
          addFix('crystal', i, th.col, 1.95, 1.5, 8, '*');
      }
    } else {
      for (const i of spread(dry, n + 1)) addFix('fungus', i, th.col, 0.55, 1.35, 7.5, '"');
    }
  });
  // Brogue-style machines: small story set pieces in ordinary rooms
  const solid = new Map<number, number>(),
    decoCell = new Map<number, CellMark>();
  const trySolid = (i: number, rad: number): boolean => {
    tile[i] = TP;
    const okc = flood(startI) === countTF();
    tile[i] = TF;
    if (okc) solid.set(i, rad);
    return okc;
  };
  const mlist = shuffle(
    ['camp', 'altar', 'library', 'crypt', 'statues', 'collapse', 'bloodwort', 'flood'].concat(
      depth >= 4 ? ['lavaflow'] : [],
      depth <= 5 ? ['idyll'] : [],
      depth >= 3 ? ['dismal'] : [],
      depth >= 4 ? ['remnant'] : [],
    ),
  );
  let mk = 0;
  normals.forEach((r, ri) => {
    if (ri === 0 || r === sroom || r.vault || r.special || r.cells.length < 14) return;
    if (r.fort && !(r.rkind !== undefined && ['crypt', 'library', 'statues'].includes(r.rkind))) return;
    if (stratum.machines) {
      if (rand() > 0.85) return;
    } else if (!r.fort && (mk >= mlist.length || rand() > 0.65)) return;
    const type = must(stratum.machines ? pick(stratum.machines) : r.fort ? r.rkind : mlist[mk++]),
      md: MachineData = { type };
    const free = r.cells.filter((i) => !used.has(i) && !liquid[i] && cd(i, stI) > 2);
    const edgeF = free.filter(nearWallC),
      innerF = free.filter((i) => !D4.some((d) => tile[i + d[0] + d[1] * W] !== TF));
    const one = (list: readonly number[]): number | undefined => {
      const o = spread(list, 1)[0];
      if (o !== undefined) used.add(o);
      return o;
    };
    if (type === 'camp') {
      const f = one(innerF.length ? innerF : free);
      if (f === undefined) return;
      md.fire = f;
      addFix('embers', f, [1.0, 0.5, 0.16], 0.45, 1.1, 6, '*');
      md.beds = free.filter((i) => !used.has(i) && cd(i, f) <= 2).slice(0, 2);
      md.beds.forEach((i) => {
        used.add(i);
        decoCell.set(i, { ch: '=', col: [0.7, 0.4, 0.3] });
      });
      md.bones = spread(
        free.filter((i) => !used.has(i)),
        4,
      );
      md.bones.forEach((i) => decoCell.set(i, { ch: '%', col: [0.9, 0.88, 0.75] }));
    } else if (type === 'altar') {
      const a = one(innerF.length ? innerF : free);
      if (a === undefined) return;
      md.altar = a;
      addFix('relic', a, [1.0, 0.82, 0.42], 1.55, 1.7, 8, '_');
      trySolid(a, 0.75);
    } else if (type === 'library') {
      md.shelves = [];
      for (const i of edgeF) {
        if (md.shelves.length >= 10) break;
        if (used.has(i)) continue;
        const d = D4.find((d) => tile[i + d[0] + d[1] * W] === TW);
        md.shelves.push({ i, dx: must(d)[0], dz: must(d)[1] });
        used.add(i);
        decoCell.set(i, { ch: '[', col: [0.75, 0.55, 0.35] });
      }
      const c = one(innerF.length ? innerF : free);
      if (c !== undefined) addFix('pages', c, [0.62, 0.48, 1.0], 2.2, 1.3, 8, '?');
      md.pages = spread(
        free.filter((i) => !used.has(i)),
        6,
      );
    } else if (type === 'crypt') {
      const c = one(innerF.length ? innerF : free);
      if (c !== undefined) addFix('mist', c, [0.45, 0.65, 1.0], 0.6, 1.2, 9, '~');
      md.tombs = [];
      for (const i of innerF) {
        if (md.tombs.length >= 7) break;
        if (used.has(i) || ((i % W) + ((i / W) | 0)) % 2) continue;
        if (!trySolid(i, 0.45)) continue;
        used.add(i);
        md.tombs.push({ i, yaw: rand() < 0.5 ? 0 : Math.PI });
        decoCell.set(i, { ch: '+', col: [0.7, 0.72, 0.9] });
      }
    } else if (type === 'statues') {
      md.statues = [];
      for (const i of spread(
        edgeF.filter((i) => !used.has(i)),
        5,
      )) {
        if (!trySolid(i, 0.5)) continue;
        used.add(i);
        md.statues.push(i);
        decoCell.set(i, { ch: '&', col: [0.75, 0.74, 0.9] });
      }
      md.awaken = md.statues.slice(0, depth >= 3 ? 2 : 1);
    } else if (type === 'idyll') {
      const pool = innerF.length ? innerF : free;
      if (pool.length < 4) return;
      md.ponds = spread(pool, RI(1, 2));
      for (const c of md.ponds)
        for (const i of r.cells) {
          if (!used.has(i) && Math.hypot((i % W) - (c % W), ((i / W) | 0) - ((c / W) | 0)) <= 1.25) {
            liquid[i] = LQ_WATER;
            surface[i] = 0;
          }
        }
      for (const i of r.cells) {
        if (!liquid[i] && !used.has(i) && rand() < 0.75) surface[i] = rand() < 0.35 ? SF_LUMEN : SF_GRASS;
      }
      const sc = one(free.filter((i) => !liquid[i]));
      if (sc !== undefined) {
        addFix('sun', sc, [1.0, 0.93, 0.78], nth(ceil, sc) - 0.3, 2.2, 9, '*');
        fixCell.delete(sc);
      }
    } else if (type === 'remnant') {
      const hw = Math.max(1, Math.floor((r.w - 4) / 2)),
        hh = Math.max(1, Math.floor((r.h - 4) / 2));
      md.carpet = [];
      md.ash = [];
      for (const i of r.cells) {
        if (used.has(i) || liquid[i]) continue;
        const dx = Math.abs((i % W) - r.cx),
          dy = Math.abs(((i / W) | 0) - r.cy);
        if (dx <= hw && dy <= hh) md.carpet.push(i);
        else if (dx <= hw + 1 && dy <= hh + 1) md.ash.push(i);
      }
      if (md.carpet.length < 4) return;
      md.carpet.forEach((i) => {
        surface[i] = 0;
        used.add(i);
        decoCell.set(i, { ch: '.', col: [0.95, 0.35, 0.32], k: 'carpet' });
      });
      md.ash.forEach((i) => {
        surface[i] = 0;
      });
      md.inert = [];
      const corners: [number, number][] = [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ];
      for (const [sx, sy] of corners) {
        const i = (r.cy + sy * (hh + 1)) * W + r.cx + sx * (hw + 1);
        if (r.cells.includes(i) && !used.has(i) && trySolid(i, 0.5)) {
          used.add(i);
          md.inert.push(i);
          decoCell.set(i, { ch: '&', col: [0.75, 0.74, 0.9] });
        }
      }
    } else if (type === 'dismal') {
      const blood = spread(free, 5);
      md.blood = blood;
      md.bones2 = spread(
        free.filter((i) => !blood.includes(i)),
        4,
      );
      md.char = spread(free, 5);
      md.blood.forEach((i) => decoCell.set(i, { ch: '~', col: [0.75, 0.1, 0.12], k: 'blood' }));
      md.bones2.forEach((i) => decoCell.set(i, { ch: '%', col: [0.9, 0.88, 0.75] }));
      md.char.forEach((i) => {
        surface[i] = 0;
      });
    } else if (type === 'bloodwort') {
      const c = one(edgeF.length ? edgeF : free);
      if (c === undefined) return;
      md.plant = c;
      addFix('bloodwort', c, [1.0, 0.25, 0.3], 1.0, 1.4, 6.5, '*');
      trySolid(c, 0.35);
    } else if (type === 'flood') {
      // a spring behind a cracked wall: when you enter, water bursts out and spreads through the room (Brogue's flooded rooms)
      const src = one(edgeF.length ? edgeF : free);
      if (src === undefined) return;
      const dW = D4.find((d) => tile[src + d[0] + d[1] * W] === TW) || [1, 0];
      const before = fixtures.length;
      addFix('spring', src, [0.45, 0.75, 1.0], 1.2, 0.9, 7, '~');
      fixCell.delete(src);
      if (fixtures.length > before) nth(fixtures, fixtures.length - 1).wd = dW;
      const order: number[] = [],
        seen = new Set([src]),
        q = [src];
      for (let h = 0; h < q.length && order.length < 80; h++) {
        const c = nth(q, h);
        order.push(c);
        for (const dd of D4) {
          const j = c + dd[0] + dd[1] * W;
          if (seen.has(j) || !walk(j) || liquid[j] || solid.has(j) || j === stI) continue;
          if (nth(roomOf, j) >= 0 && roomOf[j] !== ri) continue;
          seen.add(j);
          q.push(j);
        }
      }
      md.src = src;
      md.order = order;
    } else if (type === 'lavaflow') {
      // a crack in the floor: when you enter, lava wells up and spreads, but only over cells that never cut the level apart
      const src = one(innerF.length ? innerF : free);
      if (src === undefined) return;
      addFix('crater', src, [1.0, 0.42, 0.12], 0.6, 1.4, 9, '^');
      fixCell.delete(src);
      const order: number[] = [],
        seen = new Set([src]),
        q = [src];
      for (let h = 0; h < q.length && order.length < 34; h++) {
        const c = nth(q, h);
        liquid[c] = LQ_LAVA;
        const okc = flood(startI) === countTF();
        liquid[c] = 0;
        if (!okc && c !== src) continue;
        order.push(c);
        for (const dd of D4) {
          const j = c + dd[0] + dd[1] * W;
          if (seen.has(j) || !walk(j) || liquid[j] || solid.has(j) || j === stI || roomOf[j] !== ri) continue;
          seen.add(j);
          q.push(j);
        }
      }
      order.forEach((j) => (liquid[j] = LQ_LAVA));
      const allOk = flood(startI) === countTF();
      order.forEach((j) => (liquid[j] = 0));
      if (!allOk) order.length = 1;
      md.src = src;
      md.order = order;
    } else if (type === 'collapse') {
      const pool = innerF.filter((i) => !used.has(i));
      if (pool.length < 6) return;
      const c0 = nth(pool, Math.floor(rand() * pool.length)),
        reg = pool.filter((i) => Math.hypot((i % W) - (c0 % W), ((i / W) | 0) - ((c0 / W) | 0)) <= 1.6);
      if (reg.length < 3) return;
      reg.forEach((i) => (tile[i] = TC));
      const okc = flood(startI) === countTF();
      reg.forEach((i) => (tile[i] = TF));
      if (!okc) return;
      md.pit = reg;
      reg.forEach((i) => used.add(i));
      addFix('pitglow', c0, [1.0, 0.5, 0.2], -4.5, 2.6, 10, ':');
      fixCell.delete(c0);
    }
    r.mdata = md;
    r.machine = type;
  });
  if (stratum.k === 'cavern')
    rooms.forEach((r) => {
      if (r.shell || !r.cells.length) return;
      const dry = r.cells.filter((i) => !liquid[i] && !used.has(i) && !bridge[i]);
      for (const i of spread(dry, 2))
        addFix(
          'fungus',
          i,
          pick([
            [0.3, 0.9, 1.0],
            [0.62, 0.45, 1.0],
            [0.35, 1.0, 0.6],
          ]),
          0.6,
          1.5,
          11,
          '"',
        );
    });
  // the glow of the void, far below the fragments
  if (stratum.k === 'abyss') {
    const vo = [];
    for (let i = 0; i < N; i++) if (tile[i] === TC && !bridge[i]) vo.push(i);
    for (const i of spread(vo, 9))
      addFix(
        'abyss',
        i,
        pick([
          [0.6, 0.35, 1.0],
          [0.95, 0.25, 0.55],
          [0.4, 0.6, 1.0],
        ]),
        -3.2,
        3.0,
        13,
        '^',
      );
  }
  let bstairs: { cell: number; key: string } | null = null,
    portal: { cell: number; key: string } | null = null,
    upstairs = -1;
  if (stratum.branch || stratum.realm) {
    const c = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]
      .map((o) => startI + o)
      .find((j) => walk(j) && !liquid[j] && !used.has(j) && !solid.has(j) && j !== stI);
    if (c !== undefined) {
      addFix('upstairs', c, stratum.realm ? lookup(REALMS, must(realm).key).col : lookup(BRANCHES, must(branch).key).col, 1.6, 1.5, 7, '<');
      upstairs = c;
    }
  }
  if (!stratum.branch && !stratum.realm && !stratum.special) {
    const pickSpot = (): number => {
      const cand: number[] = [];
      rooms.forEach((r, ri) => {
        if (ri === 0 || !r.cells.length || r.shell) return;
        for (const i of r.cells)
          if (walk(i) && !liquid[i] && !used.has(i) && !solid.has(i) && cd(i, stI) > 36 && cd(i, startI) > 25) cand.push(i);
      });
      return cand.length ? nth(cand, Math.floor(rand() * cand.length)) : -1;
    };
    const bk = branchAtDepth(depth, runSeed);
    if (bk) {
      const c = pickSpot();
      if (c >= 0) {
        addFix('bstairs', c, lookup(BRANCHES, bk).col, 1.7, 1.8, 8.5, '>');
        bstairs = { cell: c, key: bk };
      }
    }
    if (depth >= 2 && rand() < 0.3) {
      const ks = Object.keys(REALMS).filter((k) => depth >= lookup(REALMS, k).minD),
        rk = nth(ks, Math.floor(rand() * ks.length)),
        c = pickSpot();
      if (c >= 0) {
        addFix('portal', c, lookup(REALMS, rk).col, 1.6, 2.0, 9, '0');
        portal = { cell: c, key: rk };
      }
    }
  }
  // lava is itself a light source
  rooms.forEach((r) => {
    if (!r.lava.length) return;
    const n = clamp(Math.round(r.lava.length / 9), 1, 5);
    for (const i of spread(r.lava, n)) addFix('lava', i, [1.0, 0.4, 0.1], 0.8, 2.6, 10, '~');
  });
  // wall-mounted torches: plentiful near the surface, rare in the depths
  const addTorch = (ci: number, d: Dir): void => {
    if (lights.length >= NSL) return;
    const cx = ci % W,
      cz = (ci / W) | 0,
      wx = (cx + 0.5 + d[0] * 0.5) * CELL,
      wz = (cz + 0.5 + d[1] * 0.5) * CELL,
      nx = -d[0],
      nz = -d[1],
      x = wx + nx * 0.45,
      z = wz + nz * 0.45,
      col = [1.0, 0.6, 0.22];
    lights.push({ x, y: 2.05, z, col, int: 1.9, rad: 8.5, type: 'torch', ph: rand() * 100, f: 1, vis: null });
    fixtures.push({ type: 'torch', x, z, wx, wz, nx, nz, col, li: lights.length - 1, acc: 0, ph: rand() * 6.28 });
    fixCell.set((cz + d[1]) * W + cx + d[0], { ch: '#', col: [1.0, 0.72, 0.32] });
    used.add(ci);
  };
  let nT = 0;
  for (let i = 0; i < N && nT < 24; i++) {
    if (!walk(i) || liquid[i] || used.has(i)) continue;
    const ri = nth(roomOf, i);
    if (ri >= 0 && nth(rooms, ri).cave) continue;
    if (rand() > (ri >= 0 ? 0.05 : 0.03) * prof.torch * (stratum.torchMul || 1)) continue;
    const fs = D4.filter((d) => tile[i + d[0] + d[1] * W] === TW);
    if (!fs.length) continue;
    let near = false;
    for (const f of fixtures) {
      if (Math.hypot(f.x / CELL - ((i % W) + 0.5), f.z / CELL - (((i / W) | 0) + 0.5)) < 3.2) {
        near = true;
        break;
      }
    }
    if (near) continue;
    addTorch(i, pick(fs));
    nT++;
  }
  // vault features: lights, statues and altars marked in the drawing
  rooms.forEach((r) => {
    if (!r.vfx) return;
    r.vstat = [];
    r.valtar = [];
    r.vcarpet = [];
    for (const [ch, i] of r.vfx) {
      if (ch === '*') {
        if (must(r.theme).fix === 'brazier') addFix('brazier', i, must(r.theme).col, 1.35, 2.2, 9, '*');
        else addFix('orb', i, must(r.theme).col, 1.65, 2.0, 10, 'o');
      } else if (ch === '&') {
        tile[i] = TF;
        solid.set(i, 0.5);
        used.add(i);
        r.vstat.push(i);
        decoCell.set(i, { ch: '&', col: [0.75, 0.74, 0.9] });
      } else if (ch === 'c') {
        used.add(i);
        r.vcarpet.push(i);
        decoCell.set(i, { ch: '.', col: [0.95, 0.35, 0.32], k: 'carpet' });
      } else if (ch === '_') {
        tile[i] = TF;
        solid.set(i, 0.6);
        used.add(i);
        r.valtar.push(i);
        addFix('relic', i, [1.0, 0.82, 0.42], 1.55, 1.6, 8, '_');
      }
    }
  });
  // ruins are lit by ancient lamps scattered through every district
  if (stratum.k === 'ruins')
    rooms.forEach((r) => {
      if (!r.ruin) return;
      for (const i of spread(
        r.cells.filter((i) => !used.has(i) && !liquid[i] && !solid.has(i)),
        r.cells.length > 90 ? 2 : 1,
      ))
        addFix('orb', i, must(r.theme).col, 1.65, 1.9, 10, 'o');
    });
  if (stratum.k === 'bigroom') {
    const big = nth(rooms, 1),
      cols2 = [
        [1.0, 0.55, 0.17],
        [0.25, 0.82, 1.0],
        [0.62, 0.4, 1.0],
        [1.0, 0.25, 0.5],
        [0.3, 1.0, 0.6],
      ];
    let k2 = 0;
    for (let y = big.y + 7; y < big.y + big.h - 2; y += 8)
      for (let x = big.x + 8; x < big.x + big.w - 3; x += 9) {
        const i = y * W + x;
        if (!used.has(i) && !liquid[i])
          addFix(
            'lamp',
            i,
            pick([
              [1.0, 0.78, 0.45],
              [0.6, 0.8, 1.0],
            ]),
            5.4,
            2.3,
            13,
            '*',
          );
      }
    for (let y = big.y + 3; y < big.y + big.h - 2; y += 8)
      for (let x = big.x + 4; x < big.x + big.w - 3; x += 9) {
        const i = y * W + x;
        if (used.has(i) || liquid[i]) continue;
        const t2 = k2++ % 3;
        addFix(
          t2 === 0 ? 'brazier' : t2 === 1 ? 'crystal' : 'rune',
          i,
          nth(cols2, (k2 * 2) % cols2.length),
          t2 === 0 ? 1.35 : t2 === 1 ? 2.4 : 0.7,
          2.3,
          11,
          t2 === 2 ? '0' : '*',
        );
      }
  }
  if (stratum.k === 'town') {
    const big = nth(rooms, 1),
      streets = big.cells.filter((i) => !vaultCell[i] && !used.has(i) && !liquid[i]);
    for (const i of spread(streets, 12))
      addFix(
        'lamp',
        i,
        pick([
          [1.0, 0.78, 0.45],
          [1.0, 0.62, 0.3],
        ]),
        3.4,
        1.6,
        8,
        '*',
      );
  }
  if (stratum.k === 'fortress')
    rooms.forEach((r) => {
      if (!r.fort) return;
      const fm = r.rkind === undefined ? undefined : FORT_KIND_MSG[r.rkind];
      if (fm) r.kindMsg = fm;
      const free = r.cells.filter((i) => !used.has(i) && !liquid[i] && !solid.has(i));
      if (r.rkind === 'dining') {
        r.tables = [];
        for (let y = r.y + 2; y < r.y + r.h - 2; y += 3)
          for (let x = r.x + 2; x < r.x + r.w - 2; x++) {
            const i = y * W + x;
            if (!free.includes(i)) continue;
            if (trySolid(i, 0.62)) {
              used.add(i);
              r.tables.push(i);
              decoCell.set(i, { ch: '=', col: [0.78, 0.62, 0.45], k: 'table' });
            }
          }
      } else if (r.rkind === 'forge') {
        r.anvils = [];
        const c = r.cy * W + r.cx;
        if (free.includes(c)) {
          addFix('embers', c, [1.0, 0.48, 0.16], 0.6, 1.6, 8, '*');
        }
        for (const i of spread(
          free.filter((i) => i !== c && !used.has(i)),
          4,
        )) {
          if (trySolid(i, 0.45)) {
            used.add(i);
            r.anvils.push(i);
            decoCell.set(i, { ch: 'T', col: [0.6, 0.6, 0.7], k: 'anvil' });
          }
        }
      } else if (r.rkind === 'flooded') {
        for (const i of r.cells) {
          if (used.has(i) || solid.has(i)) continue;
          liquid[i] = LQ_WATER;
          surface[i] = 0;
        }
        const core = r.cells.filter((i) => liquid[i] === LQ_WATER && D4.every((d) => liquid[i + d[0] + d[1] * W] === LQ_WATER));
        core.forEach((i) => (liquid[i] = LQ_DEEP));
        if (flood(startI) !== countTF()) core.forEach((i) => (liquid[i] = LQ_WATER));
      }
    });
  // ruin districts: atriums open to a light well, plazas with a colossus, gardens swallowed by plants
  if (stratum.k === 'ruins')
    rooms.forEach((r) => {
      if (!r.ruin) return;
      const c = r.cy * W + r.cx;
      if (r.rkind === 'hall' && !r.kindMsg) r.kindMsg = `${HIST.civ.name}の民が集った大広間の跡。柱だけが、いまも天井を支えている。`;
      if (r.rkind === 'atrium') {
        const rx = r.w / 2 - 2.2,
          ry = r.h / 2 - 2.2;
        for (const i of r.cells) {
          if (used.has(i) || solid.has(i)) continue;
          const dx = ((i % W) + 0.5 - (r.x + r.w / 2)) / rx,
            dy = (((i / W) | 0) + 0.5 - (r.y + r.h / 2)) / ry;
          if (dx * dx + dy * dy < 1) {
            liquid[i] = LQ_WATER;
            surface[i] = 0;
          }
        }
        addFix('well', c, [0.45, 1.0, 0.92], Math.min(nth(ceil, c) - 0.4, 4.4), 2.6, 12, '*');
        fixCell.delete(c);
        r.kindMsg = lookup(RUIN_KIND_MSG, 'atrium');
      } else if (r.rkind === 'plaza') {
        if (!used.has(c) && trySolid(c, 1.35)) {
          r.colossus = c;
          used.add(c);
          decoCell.set(c, { ch: '&', col: [0.85, 0.82, 0.95], k: 'colossus' });
          const ru = nth(HIST.rulers, c % HIST.rulers.length);
          r.kindMsg = `広場の中央に、${ru.title}${ru.name}の巨像がそびえている。`;
        }
      } else if (r.rkind === 'garden') {
        for (const i of r.cells) if (!liquid[i] && !used.has(i) && rand() < 0.75) surface[i] = rand() < 0.4 ? SF_LUMEN : SF_GRASS;
        r.kindMsg = lookup(RUIN_KIND_MSG, 'garden');
      }
    });
  if (stratum.flood) {
    for (let i = 0; i < N; i++) {
      if (walk(i) && !liquid[i] && !used.has(i) && !solid.has(i) && i !== stI && i !== startI) {
        liquid[i] = LQ_WATER;
        surface[i] = 0;
      }
    }
    const core = [];
    for (let i = W; i < N - W; i++) {
      if (liquid[i] !== LQ_WATER || nth(roomOf, i) < 0) continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (liquid[i + dx + dy * W] !== LQ_WATER) {
            ok = false;
            break;
          }
        }
      if (ok && vnoise((i % W) * 0.3, 7.7, ((i / W) | 0) * 0.3) > 0.45) core.push(i);
    }
    core.forEach((i) => (liquid[i] = LQ_DEEP));
    if (flood(startI) !== countTF()) core.forEach((i) => (liquid[i] = LQ_WATER));
  }
  const thin = new Uint8Array(N);
  if (stratum.freeze) {
    for (let i = 0; i < N; i++) {
      if (liquid[i] === LQ_WATER || liquid[i] === LQ_DEEP) {
        if (liquid[i] === LQ_DEEP) thin[i] = 1;
        liquid[i] = 0;
        surface[i] = SF_ICE;
        flow[i] = 0;
      }
    }
  }
  const teles: { a: number; b: number }[] = [],
    erupts: { src: number; order: number[] }[] = [];
  if (stratum.realm && realm && realm.key === 'lab') {
    const rs = shuffle(rooms.map((_r, ri) => ri).filter((ri) => ri > 0 && nth(rooms, ri).cells.length > 12));
    for (let k = 0; k + 1 < rs.length && teles.length < 3; k += 2) {
      const pick2 = (ri: number): number => {
        const c = nth(rooms, ri).cells.filter((i) => walk(i) && !liquid[i] && !used.has(i) && !solid.has(i) && i !== stI);
        return c.length ? nth(c, Math.floor(rand() * c.length)) : -1;
      };
      const a = pick2(nth(rs, k)),
        b = pick2(nth(rs, k + 1));
      if (a < 0 || b < 0) continue;
      const col = pick([
        [1.0, 0.35, 0.85],
        [0.35, 0.9, 1.0],
        [0.7, 0.5, 1.0],
      ]);
      addFix('tele', a, col, 0.4, 1.4, 6, '*');
      addFix('tele', b, col, 0.4, 1.4, 6, '*');
      fixCell.delete(a);
      fixCell.delete(b);
      teles.push({ a, b });
    }
  }
  // volcano: craters that erupt now and then; their flows only take cells that never cut the level apart
  if (stratum.realm && realm && realm.key === 'volcano') {
    const cand: number[] = [];
    for (let i = 0; i < N; i++) if (walk(i) && !liquid[i] && !used.has(i) && !solid.has(i) && i !== stI && cd(i, startI) > 30) cand.push(i);
    const tried = shuffle(cand.slice()).slice(0, 60);
    for (const src of tried) {
      if (erupts.length >= 3) break;
      if (erupts.some((e) => cd(e.src, src) < 64)) continue;
      const order: number[] = [],
        seen = new Set([src]),
        q = [src];
      for (let h = 0; h < q.length && order.length < 22; h++) {
        const c = nth(q, h);
        liquid[c] = LQ_LAVA;
        const okc = flood(startI) === countTF();
        liquid[c] = 0;
        if (!okc && c !== src) continue;
        order.push(c);
        for (const dd of D4) {
          const j = c + dd[0] + dd[1] * W;
          if (seen.has(j) || !walk(j) || liquid[j] || solid.has(j) || j === stI || j === startI) continue;
          seen.add(j);
          q.push(j);
        }
      }
      order.forEach((j) => (liquid[j] = LQ_LAVA));
      const ok = flood(startI) === countTF();
      order.forEach((j) => (liquid[j] = 0));
      if (!ok || order.length < 14) continue;
      addFix('crater', src, [1.0, 0.42, 0.12], 0.6, 1.6, 10, '^');
      fixCell.delete(src);
      erupts.push({ src, order });
    }
  }
  // where lava meets water it cools to obsidian and steams (after Dwarf Fortress)
  {
    const contact: number[] = [];
    for (let i = W; i < N - W; i++) {
      if (liquid[i] !== LQ_LAVA) continue;
      if (
        D4.some((d) => {
          const l = liquid[i + d[0] + d[1] * W];
          return l === LQ_WATER || l === LQ_DEEP;
        })
      ) {
        liquid[i] = 0;
        surface[i] = SF_OBSIDIAN;
        contact.push(i);
      }
    }
    for (const i of spread(contact, 3)) addFix('vent', i, [0.85, 0.9, 1.0], 1.4, 1.6, 8, 'o');
  }
  // waterfalls fall from glowing rifts high in the vault, over lakes and rivers
  {
    const fc: number[] = [];
    for (const r of rooms) {
      if (!r.cave || r.shell) continue;
      for (const i of r.cells) {
        if ((liquid[i] === LQ_WATER || liquid[i] === LQ_DEEP) && !used.has(i) && nth(ceil, i) >= 5.5) fc.push(i);
      }
    }
    fc.sort((p, q) => nth(ceil, q) - nth(ceil, p));
    const topC = fc.slice(0, Math.max(4, Math.floor(fc.length * 0.25)));
    const nF = stratum.k === 'cavern' ? RI(1, 2) : topC.length ? 1 : 0;
    for (const i of spread(topC, nF)) addFix('fall', i, [0.5, 0.85, 1.0], Math.min(6, nth(ceil, i) * 0.45), 1.9, 12, '|');
  }
  // ore veins in the rock (gold near the surface, gems deeper)
  const vein = new Uint8Array(N);
  if (stratum.k !== 'abyss')
    for (let i = W; i < N - W; i++) {
      if (tile[i] !== TW || !D4.some((d) => tile[i + d[0] + d[1] * W] !== TW)) continue;
      const x = i % W,
        y = (i / W) | 0,
        v = vnoise(x * 0.33, 9.1, y * 0.33) * 0.75 + vnoise(x * 0.9, 2.2, y * 0.9) * 0.25;
      if (v > 0.68) {
        const g2 = vnoise(x * 0.1, 5.5, y * 0.1);
        vein[i] = depth <= 3 ? 1 : g2 < 0.35 ? 1 : g2 < 0.55 ? 2 : g2 < 0.75 ? 3 : 4;
      }
    }
  {
    const vc: [number, number, Dir][] = [];
    for (let i = W; i < N - W; i++) {
      if (!vein[i]) continue;
      for (const d of D4) {
        const j = i - d[0] - d[1] * W;
        if (walk(j) && !liquid[j] && !used.has(j)) {
          vc.push([j, i, d]);
          break;
        }
      }
    }
    const nV = Math.min(7, Math.max(0, NSL - lights.length - 8));
    for (const j of spread(
      vc.map((x) => x[0]),
      nV,
    )) {
      const e = must(vc.find((x) => x[0] === j)),
        before = fixtures.length;
      addFix('veinlight', j, lookup(VEIN_COL, nth(vein, e[1])), 1.3, 1.0, 6.5, '*');
      if (fixtures.length > before) {
        nth(fixtures, fixtures.length - 1).wd = [e[2][0], e[2][1]];
        fixCell.delete(j);
      }
    }
  }
  // autogenerators (after Brogue's DF_SUNLIGHT / DF_DARKNESS / STEAM_VENT)
  const darkMul = new Float32Array(N).fill(1);
  if (depth <= 5)
    for (let k = RI(1, 3); k > 0; k--) {
      const r = normals[RI(1, Math.max(1, normals.length - 1))];
      if (!r) continue;
      const c = spread(
        r.cells.filter((i) => !used.has(i) && !liquid[i]),
        1,
      )[0];
      if (c === undefined) continue;
      addFix('sun', c, [1.0, 0.93, 0.78], nth(ceil, c) - 0.3, 2.2, 9, '*');
      fixCell.delete(c);
    }
  if (depth >= 2)
    for (let k = RI(1, 2); k > 0; k--) {
      const r = rooms[RI(1, rooms.length - 1)];
      const c = r && r.cells.length ? pick(r.cells) : undefined;
      if (c === undefined) continue;
      const cx = c % W,
        cy = (c / W) | 0;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx,
            y = cy + dy;
          if (x < 0 || y < 0 || x >= UW || y >= UH) continue;
          const m = clamp((Math.hypot(dx, dy) - 1.2) / 2.6, 0, 1);
          darkMul[y * W + x] = Math.min(nth(darkMul, y * W + x), 0.12 + 0.88 * m);
        }
    }
  if (depth >= 5)
    for (let k = RI(1, 3); k > 0; k--) {
      const r = rooms[RI(1, rooms.length - 1)];
      const c = r
        ? spread(
            r.cells.filter((i) => !used.has(i) && !liquid[i]),
            1,
          )[0]
        : undefined;
      if (c === undefined) continue;
      addFix('vent', c, [0.85, 0.9, 1.0], 1.4, 1.6, 8, 'o');
    }
  const engr = new Map<number, Engraving>();
  {
    const ENGR_N: Record<string, number> = { ruins: 10, fortress: 10, town: 4, oracle: 6, maze: 3, bigroom: 6 };
    const FD: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const nE = ENGR_N[stratum.k] || 0,
      cands: number[] = [];
    if (nE)
      for (const r of rooms) {
        if (r.cave) continue;
        for (const i of r.cells) {
          if (liquid[i] || used.has(i)) continue;
          for (let fi = 0; fi < 4; fi++) {
            const j = i + nth(FD, fi)[0] + nth(FD, fi)[1] * W;
            if (tile[j] === TW && !fixCell.has(j)) cands.push(i * 4 + fi);
          }
        }
      }
    const picks: number[] = [];
    for (let t = 0; t < 600 && picks.length < nE && cands.length; t++) {
      const k = nth(cands, Math.floor(rand() * cands.length)),
        i = k >> 2;
      if (picks.some((o) => Math.hypot(((o >> 2) % W) - (i % W), (((o >> 2) / W) | 0) - ((i / W) | 0)) < 5)) continue;
      picks.push(k);
    }
    const pool = HIST.events.concat(HIST.events, HIST.crowns);
    for (const k of picks) {
      const i = k >> 2,
        fi = k & 3,
        ev = pick(pool),
        tg = fi < 2 ? [W, -W] : [1, -1];
      let pi = -1;
      for (const o of tg) {
        const p = i + o,
          wj = p + nth(FD, fi)[0] + nth(FD, fi)[1] * W;
        if (tile[p] === TF && !liquid[p] && roomOf[p] === roomOf[i] && tile[wj] === TW && !fixCell.has(wj) && !engr.has(p * 4 + fi)) {
          pi = p;
          break;
        }
      }
      if (pi >= 0 && rand() < 0.75) {
        engr.set(k, { ...ev, wide: true, pi });
        engr.set(pi * 4 + fi, { skip: true, mi: i, art: ev.art });
      } else engr.set(k, ev);
    }
  }
  const lampCols = [
    [0.5, 0.68, 1.0],
    [0.62, 0.45, 1.0],
    [0.45, 0.9, 0.95],
  ];
  for (let i = 0; i < N; i++) {
    if (tile[i] !== TF || nth(roomOf, i) >= 0 || used.has(i) || rand() > (stratum.k === 'ruins' ? 0.085 : 0.05)) continue;
    let near = false;
    for (const f of fixtures) {
      if (Math.hypot(f.x / CELL - ((i % W) + 0.5), f.z / CELL - (((i / W) | 0) + 0.5)) < 7) {
        near = true;
        break;
      }
    }
    if (!near) addFix('lamp', i, pick(lampCols), 2.35, 1.1, 6.5, '*');
  }
  lights.forEach((L) => (L.vis = computeVis(L, tile)));
  const cellLI = new Float32Array(N * 3).fill(-1),
    cellLW = new Float32Array(N * 3);
  const bakeCellLights = () => {
    cellLI.fill(-1);
    cellLW.fill(0);
    for (let i = 0; i < N; i++) {
      let ref = i;
      if (tile[i] === TW) {
        ref = -1;
        for (const d of D4) {
          const x = (i % W) + d[0],
            y = ((i / W) | 0) + d[1];
          if (x >= 0 && y >= 0 && x < UW && y < UH && tile[y * W + x] !== TW) {
            ref = y * W + x;
            break;
          }
        }
        if (ref < 0) continue;
      }
      topLights(lights, ((i % W) + 0.5) * CELL, 1.3, (((i / W) | 0) + 0.5) * CELL, null, 0, 0, ref, cellLI, cellLW, i * 3);
      for (let k = 0; k < 3; k++) cellLW[i * 3 + k] = nth(cellLW, i * 3 + k) * nth(darkMul, i);
    }
  };
  bakeCellLights();
  // tall vegetation (after Brogue's foliage and fungus forests): blocks sight, hides whoever stands in it, flattens when walked through
  for (let i = W; i < N - W; i++) {
    if (tile[i] !== TF || liquid[i] || i === startI || i === stI || vaultCell[i]) continue;
    const sf = surface[i],
      x = i % W,
      y = (i / W) | 0,
      r = nth(roomOf, i) >= 0 ? rooms[nth(roomOf, i)] : null,
      k = r && r.theme ? r.theme.k : '';
    const v = vnoise(x * 0.28, 8.8, y * 0.28) * 0.7 + vnoise(x * 0.9, 1.9, y * 0.9) * 0.3;
    if (
      (sf === SF_GRASS ||
        sf === SF_DEAD ||
        (sf === 0 && r && r.cave && !['crystal', 'magma', 'basalt', 'ashfield', 'abyssal', 'warren', 'cavern'].includes(k))) &&
      v > 0.5 &&
      k !== 'warren'
    )
      surface[i] = SF_FOLIAGE;
    else if ((k === 'fungal' || k === 'towercap' || k === 'mossfield') && v > 0.6) surface[i] = SF_FUNGFOR;
  }
  // brimstone near lava: flares up when stepped on (after Brogue)
  if (depth >= 4 || (stratum.realm && realm && realm.key === 'volcano')) {
    for (let i = W; i < N - W; i++) {
      if (tile[i] !== TF || liquid[i] || surface[i] === SF_FOLIAGE || i === startI) continue;
      let nearL = false;
      for (let dy = -3; dy <= 3 && !nearL; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const j = i + dx + dy * W;
          if (j >= 0 && j < N && liquid[j] === LQ_LAVA) {
            nearL = true;
            break;
          }
        }
      if (nearL && vnoise((i % W) * 0.45, 4.4, ((i / W) | 0) * 0.45) > 0.6) surface[i] = SF_BRIM;
    }
  }
  // luminescent algae drifting in deep water
  const algae = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (
      liquid[i] === LQ_DEEP &&
      vnoise((i % W) * 0.3, 5.1, ((i / W) | 0) * 0.3) > // 湖の重み lake が無い層もある（無ければ多くない）
        (stratum.flood || (stratum.cw && (stratum.cw['lake'] ?? 0) > 2) ? 0.42 : 0.56)
    )
      algae[i] = 1;
  }
  // a sanctuary: a room whose whole floor is laid with sacred glyphs no beast will cross
  const glyph = new Uint8Array(N);
  if (depth >= 3 && !stratum.special && rand() < 0.5) {
    const rs = rooms
      .map((_r, ri) => ri)
      .filter(
        (ri) =>
          ri > 0 &&
          !nth(rooms, ri).cave &&
          !nth(rooms, ri).vault &&
          !nth(rooms, ri).mdata &&
          nth(rooms, ri).cells.length >= 12 &&
          nth(rooms, ri).cells.length <= 60 &&
          !nth(rooms, ri).cells.includes(stI),
      );
    if (rs.length) {
      const r = nth(rooms, nth(rs, Math.floor(rand() * rs.length)));
      for (const i of r.cells) if (walk(i) && !liquid[i]) glyph[i] = 1;
      r.sanct = true;
      r.kindMsg = '床一面に聖なる紋様が描かれた部屋。獣たちは、この紋様を越えようとしない。';
    }
  }
  // monsters arrive in hordes: a leader and its followers placed on nearby free cells
  const spawns: Spawn[] = [],
    taken = new Set<number>();
  const okCell = (i: number | undefined): i is number =>
    i !== undefined && i >= 0 && walk(i) && nth(dist, i) >= 8 && i !== stI && !solid.has(i) && !bridge[i] && !taken.has(i) && !glyph[i];
  const hordes = stratum.hordes;
  const avail: Horde[] = hordes
    ? HORDES.filter((H) => hordes.includes(H.lead))
    : HORDES.filter((H) => depth >= nth(H.d, 0) && depth <= nth(H.d, 1));
  const areaK = clamp((UW * UH) / (MW * MH), 0.3, 1) * (trials.includes('fury') ? 1.25 : 1),
    nH = Math.max(
      2,
      Math.round(
        areaK * (stratum.hordeMul || 1) * (6 + Math.min(depth, 6)) * (stratum.k === 'bigroom' ? 1.5 : stratum.k === 'town' ? 0.35 : 1),
      ),
    );
  let gid = 0;
  for (let g2 = 0; g2 < 800 && gid < nH && avail.length; g2++) {
    let tot = 0;
    for (const H of avail) tot += H.w;
    let r0 = rand() * tot,
      H = nth(avail, 0);
    for (const h of avail) {
      r0 -= h.w;
      if (r0 <= 0) {
        H = h;
        break;
      }
    }
    const room = rooms[RI(1, rooms.length - 1)],
      i = room && room.cells.length && rand() < 0.85 ? pick(room.cells) : RI(0, N - 1);
    if (!okCell(i)) continue;
    taken.add(i);
    spawns.push({ key: H.lead, cx: i % W, cz: (i / W) | 0, g: gid, lead: true });
    const nearC: number[] = [];
    {
      const q = [i],
        seen = new Map([[i, 0]]);
      for (let h = 0; h < q.length; h++) {
        const c = nth(q, h),
          dd = must(seen.get(c));
        if (dd >= 4) continue;
        for (const d of D4) {
          const j = c + d[0] + d[1] * W;
          if (seen.has(j) || !walk(j)) continue;
          seen.set(j, dd + 1);
          q.push(j);
          if (okCell(j)) nearC.push(j);
        }
      }
    }
    for (const [fk, mn, mx] of H.fol) {
      const n = RI(mn, mx);
      for (let k = 0; k < n && nearC.length; k++) {
        const j = nth(nearC.splice(Math.floor(rand() * nearC.length), 1), 0);
        taken.add(j);
        spawns.push({ key: fk, cx: j % W, cz: (j / W) | 0, g: gid, lead: false });
      }
    }
    gid++;
  }
  // schools of glowing fish in lakes and rivers
  {
    const wc: number[] = [];
    for (let i = 0; i < N; i++) if (tile[i] === TF && (liquid[i] === LQ_WATER || liquid[i] === LQ_DEEP)) wc.push(i);
    if (wc.length >= 12)
      for (const c of spread(wc, Math.min(3, Math.floor(wc.length / 70) + 1))) {
        const q = [c],
          seen = new Set([c]);
        for (let h = 0; h < q.length && q.length < 12; h++)
          for (const d of D4) {
            const j = nth(q, h) + d[0] + d[1] * W;
            if (!seen.has(j) && tile[j] === TF && (liquid[j] === LQ_WATER || liquid[j] === LQ_DEEP)) {
              seen.add(j);
              q.push(j);
            }
          }
        for (let k = 0; k < RI(3, 5) && q.length; k++) {
          const j = nth(q.splice(Math.floor(rand() * q.length), 1), 0);
          spawns.push({ key: 'f', cx: j % W, cz: (j / W) | 0, g: -1, lead: true });
        }
      }
  }
  // grazers wander the luminous moss in small herds
  {
    const mc: number[] = [];
    for (let i = 0; i < N; i++) if (surface[i] === SF_LUMEN && walk(i) && !liquid[i] && i !== stI && nth(dist, i) >= 5) mc.push(i);
    if (mc.length >= 10)
      for (const c of spread(mc, Math.min(3, Math.floor(mc.length / 35) + 1))) {
        const near = mc.filter((j) => Math.abs((j % W) - (c % W)) + Math.abs(((j / W) | 0) - ((c / W) | 0)) <= 3);
        for (let k = 0; k < RI(3, 5) && near.length; k++) {
          const j = nth(near.splice(Math.floor(rand() * near.length), 1), 0);
          spawns.push({ key: 'h', cx: j % W, cz: (j / W) | 0, g: -1, lead: true });
        }
      }
  }
  // shriekers keep watch in dark corners, often beside a sleeping horde
  if (depth >= 2 || stratum.branch || stratum.realm) {
    const nS = RI(2, 4);
    for (let k = 0; k < nS; k++) {
      let c = -1;
      if (rand() < 0.5 && spawns.length) {
        const s0 = nth(spawns, Math.floor(rand() * spawns.length));
        const b0 = s0.cz * W + s0.cx;
        const nb: number[] = [];
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -3; dx <= 3; dx++) {
            const j = b0 + dx + dy * W;
            if (j > 0 && j < N && okCell(j) && !liquid[j]) nb.push(j);
          }
        if (nb.length) c = nth(nb, Math.floor(rand() * nb.length));
      }
      if (c < 0) {
        for (let t2 = 0; t2 < 40; t2++) {
          const j = RI(0, N - 1);
          if (okCell(j) && !liquid[j] && nth(roomOf, j) >= 0) {
            c = j;
            break;
          }
        }
      }
      if (c >= 0) {
        taken.add(c);
        spawns.push({ key: 'p', cx: c % W, cz: (c / W) | 0, g: -1, lead: true });
      }
    }
  }
  // spider nests: narrow passages strung with glowing webs
  const webs: { i: number; ax: number; gone: boolean }[] = [];
  if ((depth >= 2 || stratum.branch || stratum.realm) && !stratum.special && stratum.k !== 'abyss') {
    const dense = !!stratum.denseWebs,
      narrow: number[] = [];
    for (let i = W; i < N - W; i++) {
      if (!walk(i) || liquid[i] || i === stI || nth(dist, i) < 10 || bridge[i]) continue;
      let n = 0;
      for (const d of D4) if (walk(i + d[0] + d[1] * W)) n++;
      if (n <= (dense ? 3 : 2)) narrow.push(i);
    }
    for (const c of spread(narrow, dense ? RI(4, 6) : rand() < 0.5 ? 1 : 2)) {
      const g = gid++;
      const q = [c],
        seen = new Map([[c, 0]]);
      for (let h = 0; h < q.length; h++) {
        const x = nth(q, h),
          dd = must(seen.get(x));
        if (dd >= 6) continue;
        for (const d of D4) {
          const j = x + d[0] + d[1] * W;
          if (seen.has(j) || !walk(j)) continue;
          seen.set(j, dd + 1);
          q.push(j);
        }
      }
      const cand = q.filter((i) => !liquid[i] && i !== stI && !used.has(i) && !solid.has(i));
      let nW = 0;
      for (const i of shuffle(cand)) {
        if (nW >= (dense ? 12 : 7)) break;
        let n = 0;
        const ew = walk(i + 1) && walk(i - 1),
          ns = walk(i + W) && walk(i - W);
        for (const d of D4) if (walk(i + d[0] + d[1] * W)) n++;
        if (n > 2 && !dense && rand() < 0.7) continue;
        webs.push({ i, ax: ew && !ns ? 0 : 1, gone: false });
        nW++;
      }
      for (let k = 0; k < RI(1, 2); k++) {
        const sc = cand.filter((i) => okCell(i) && !webs.some((w) => w.i === i));
        if (!sc.length) break;
        const j = nth(sc, Math.floor(rand() * sc.length));
        taken.add(j);
        spawns.push({ key: 'S', cx: j % W, cz: (j / W) | 0, g, lead: k === 0 });
      }
    }
  }
  // a snapjaw camp: a campfire, the tribe around it, and sentries walking a loop
  if (
    depth >= 2 &&
    !stratum.special &&
    !stratum.realm &&
    stratum.k !== 'abyss' &&
    stratum.k !== 'magma' &&
    rand() < (stratum.branch ? 0.6 : 0.4)
  ) {
    const rs = rooms
      .map((_r, ri) => ri)
      .filter(
        (ri) => ri > 0 && nth(rooms, ri).cells.length >= 30 && !nth(rooms, ri).vault && !nth(rooms, ri).shell && !nth(rooms, ri).mdata,
      );
    if (rs.length) {
      const r = nth(rooms, nth(rs, Math.floor(rand() * rs.length))),
        cc = r.cells.filter((i) => walk(i) && !liquid[i] && !used.has(i) && !solid.has(i) && i !== stI && nth(dist, i) >= 10);
      if (cc.length) {
        const c = nth(
            cc.sort((a, b) => Math.hypot((a % W) - r.cx, ((a / W) | 0) - r.cy) - Math.hypot((b % W) - r.cx, ((b / W) | 0) - r.cy)),
            0,
          ),
          g = gid++;
        addFix('embers', c, [1.0, 0.55, 0.2], 0.6, 2.6, 11, '*');
        const ring = (r0: number, r1: number): number[] =>
          r.cells.filter((i) => {
            const d = Math.hypot((i % W) - (c % W), ((i / W) | 0) - ((c / W) | 0));
            return d >= r0 && d <= r1 && okCell(i) && !liquid[i];
          });
        const sit = ring(1, 2.3);
        for (let k = 0; k < RI(3, 5) && sit.length; k++) {
          const j = nth(sit.splice(Math.floor(rand() * sit.length), 1), 0);
          taken.add(j);
          spawns.push({ key: 's', cx: j % W, cz: (j / W) | 0, g, lead: k === 0, camp: c });
        }
        const loop = ring(3.5, 5.5).sort(
          (a, b) =>
            Math.atan2(((a / W) | 0) - ((c / W) | 0), (a % W) - (c % W)) - Math.atan2(((b / W) | 0) - ((c / W) | 0), (b % W) - (c % W)),
        );
        const route = loop.filter((_, k) => k % Math.max(1, Math.floor(loop.length / 8)) === 0);
        for (let k = 0; k < RI(1, 2) && route.length > 2; k++) {
          const j = route[Math.floor(rand() * route.length)];
          if (!okCell(j)) continue;
          taken.add(j);
          spawns.push({ key: 'sw', cx: j % W, cz: (j / W) | 0, g, lead: false, route: k ? route.slice().reverse() : route });
        }
        r.camp = c;
        r.kindMsg = (r.kindMsg ? r.kindMsg + ' ' : '') + '焚き火の煙と、獣じみた笑い声。スナップジョーの野営地だ。';
      }
    }
  }
  // ancient machines keep the ruins tidy (after Cogmind)
  if (stratum.k === 'ruins' || stratum.k === 'fortress' || (stratum.realm && realm && realm.key === 'lab')) {
    const plan: [string, number][] = [
      ['Rc', RI(1, 2)],
      ['Re', 1],
      ['Rw', RI(1, 2)],
    ];
    for (const [key, n] of plan)
      for (let k = 0; k < n; k++) {
        for (let t2 = 0; t2 < 40; t2++) {
          const j = RI(0, N - 1);
          if (okCell(j) && !liquid[j] && nth(roomOf, j) >= 0) {
            taken.add(j);
            spawns.push({ key, cx: j % W, cz: (j / W) | 0, g: key === 'Rw' ? gid++ : -1, lead: true });
            break;
          }
        }
      }
  }
  // large creatures live where their terrain is (after Brogue): bog monsters in bogs, nagas and krakens in deep water, salamanders in lava
  {
    const cnt = (lq: number): number[] => {
      const a: number[] = [];
      for (let i = 0; i < N; i++) if (tile[i] === TF && liquid[i] === lq && !taken.has(i)) a.push(i);
      return a;
    };
    const put = (key: string, arr: readonly number[], n: number): void => {
      for (const j of spread(arr, n)) {
        taken.add(j);
        spawns.push({ key, cx: j % W, cz: (j / W) | 0, g: gid++, lead: true });
      }
    };
    const bog = cnt(LQ_BOG),
      deep = cnt(LQ_DEEP),
      lava = cnt(LQ_LAVA);
    if (depth >= 2 && bog.length >= 15) put('B', bog, bog.length > 60 ? 2 : 1);
    if (depth >= 3 && deep.length >= 25 && rand() < 0.6) {
      const shore = deep.filter((i) => D4.some((d) => walk(i + d[0] + d[1] * W) && !liquid[i + d[0] + d[1] * W]));
      put('N', shore.length ? shore : deep, 1);
    }
    if (depth >= 5 && deep.length >= 60 && rand() < 0.5)
      put(
        'K',
        deep.filter((i) => D4.every((d) => liquid[i + d[0] + d[1] * W] === LQ_DEEP)),
        1,
      );
    if (depth >= 4 && lava.length >= 20) put('l', lava, lava.length > 300 ? 2 : 1);
  }
  if ((stratum.k === 'ruins' || stratum.k === 'fortress') && depth >= 6) {
    for (let k = 0; k < RI(1, 2); k++)
      for (let t2 = 0; t2 < 40; t2++) {
        const j = RI(0, N - 1);
        if (okCell(j) && !liquid[j] && nth(roomOf, j) >= 0 && nth(rooms, nth(roomOf, j)).cells.length > 20) {
          taken.add(j);
          spawns.push({ key: 'Y', cx: j % W, cz: (j / W) | 0, g: gid++, lead: true });
          break;
        }
      }
  }
  // the lord of a branch waits near its last staircase (after DCSS's branch-end uniques)
  if (stratum.branch && branch && branch.lvl === branch.len) {
    const ru = nth(HIST.rulers, HIST.rulers.length - 1),
      bk = branch.key;
    const LORDS: Record<string, { base: string; name: string; scale: number; verb: string }> = {
        crypt: {
          base: 'L',
          name: `不死の王 ${ru.name}`,
          scale: 1.7,
          verb: `${ru.title}${ru.name}の亡霊。王冠だけが、まだ光を失っていない`,
        },
        lair: { base: 'D', name: '年老いた竜', scale: 3.6, verb: '巣の最奥で、とぐろを巻いて眠っている。寝息のたびに洞窟が揺れる' },
        sunken: { base: 'K', name: '深みの主', scale: 3.6, verb: '沈んだ神殿の底から、無数の触手を伸ばしている' },
        nest: { base: 'S', name: '蜘蛛の女王', scale: 2.4, verb: '巣の中心で、光る糸を紡ぎ続けている' },
        snake: { base: 'N', name: 'ナーガの女王', scale: 2.6, verb: '水場のほとりで、冠のような鱗を光らせている' },
      },
      LORD = LORDS[bk];
    if (LORD) {
      lordType = {
        ...lookup(MTYPES, LORD.base),
        sk: LORD.base,
        name: LORD.name,
        scale: LORD.scale,
        verb: LORD.verb,
        boss: true,
        col: LORD.base === 'L' ? [0.75, 0.9, 1.0] : lookup(MTYPES, LORD.base).col,
        // 元は ({ crypt: null, … } as …)[bk] || 元の生き物の look。表の値はどれも null なので、いつも元の生き物の look になる
        look: lookup(MTYPES, LORD.base).look,
      };
      if (bk === 'lair') {
        lordType.form = 'olddragon';
        lordType.light = 5;
      }
      if (bk === 'sunken') {
        lordType.form = 'deepkraken';
        lordType.light = 5;
      }
      if (bk === 'crypt') {
        lordType.form = 'lichking';
        lordType.light = 7;
      }
      if (bk === 'nest') {
        lordType.form = 'spiderqueen';
        lordType.light = 6;
      }
      if (bk === 'snake') {
        lordType.form = 'nagaqueen';
        lordType.light = 6;
      }
      const near: number[] = [];
      for (let i = 0; i < N; i++) {
        const d = cd(i, stI);
        if (d < 36 || d > 144 || taken.has(i)) continue;
        const okL =
          LORD.base === 'K'
            ? liquid[i] === LQ_DEEP && D4.every((dd) => liquid[i + dd[0] + dd[1] * W] === LQ_DEEP)
            : walk(i) && !liquid[i] && !solid.has(i);
        if (okL) near.push(i);
      }
      if (!near.length && LORD.base === 'K') {
        const dw: number[] = [];
        for (let i = 0; i < N; i++) if (liquid[i] === LQ_DEEP && cd(i, stI) >= 36 && !taken.has(i)) dw.push(i);
        dw.sort((a, b) => cd(a, stI) - cd(b, stI));
        near.push(...dw.slice(0, 8));
      }
      // a lord must always be there (it may hold a legendary thing): with no deep water, a pool is dug for the Lord of the Depths; any other lord takes the farthest open floor
      if (!near.length) {
        let best = -1,
          bd = -1;
        const open2 = (i: number): boolean => {
          const x = i % W,
            z = (i / W) | 0;
          if (x < 3 || z < 3 || x > UW - 4 || z > UH - 4) return false;
          for (let dz = -2; dz <= 2; dz++)
            for (let dx = -2; dx <= 2; dx++) {
              const j = i + dz * W + dx;
              if (!walk(j) || solid.has(j) || taken.has(j)) return false;
            }
          return true;
        };
        for (let i = 0; i < N; i++) {
          if (!open2(i)) continue;
          const d = cd(i, stI);
          if (d > bd) {
            bd = d;
            best = i;
          }
        }
        if (best < 0)
          for (let i = 0; i < N; i++) {
            if (!walk(i) || liquid[i] || solid.has(i) || taken.has(i)) continue;
            const d = cd(i, stI);
            if (d > bd) {
              bd = d;
              best = i;
            }
          }
        if (best >= 0) {
          if (LORD.base === 'K') {
            for (let dz = -2; dz <= 2; dz++)
              for (let dx = -2; dx <= 2; dx++) {
                const j = best + dz * W + dx;
                if (Math.hypot(dx, dz) <= 2.6) liquid[j] = LQ_DEEP;
              }
          }
          near.push(best);
        }
      }
      if (near.length) {
        const j = nth(near, Math.floor(rand() * near.length));
        taken.add(j);
        spawns.push({ key: 'lord', cx: j % W, cz: (j / W) | 0, g: gid++, lead: true });
      }
    }
  }
  // mimics wait in rooms, disguised as floating scrolls
  {
    const nM = rand() < 0.6 ? 1 : 2;
    for (let k = 0; k < nM; k++) {
      const rr = rooms.filter((r, ri) => ri > 0 && r.cells.length > 12 && !r.shell);
      if (!rr.length) break;
      const r = nth(rr, Math.floor(rand() * rr.length));
      const c = r.cells.filter((i) => okCell(i) && !liquid[i] && !used.has(i));
      if (c.length) {
        const j = nth(c, Math.floor(rand() * c.length));
        taken.add(j);
        spawns.push({ key: 'q', cx: j % W, cz: (j / W) | 0, g: -1, lead: true });
      }
    }
  }
  if (stratum.k === 'town') {
    const st2 = nth(rooms, 1).cells.filter((i) => !vaultCell[i] && walk(i) && !liquid[i] && !solid.has(i));
    for (let k = 0; k < 7 && st2.length; k++) {
      const i = nth(st2.splice(Math.floor(rand() * st2.length), 1), 0);
      spawns.push({ key: 'G', cx: i % W, cz: (i / W) | 0, g: -1, lead: true });
    }
  }
  if (stratum.k === 'cavern' && depth === 3 && !stratum.branch && !stratum.realm) {
    beastType = makeBeastType(HIST, runSeed);
    let lr = -1,
      ld = -1;
    rooms.forEach((r, ri) => {
      if (ri === 0 || !r.cells.length || !r.cave || r.shell) return;
      const d = nth(dist, r.cx + r.cy * W);
      if (d > ld && r.cells.length > 30) {
        ld = d;
        lr = ri;
      }
    });
    if (lr >= 0) {
      const r = nth(rooms, lr);
      r.lair = true;
      const cand = r.cells.filter((i) => walk(i) && !liquid[i] && !solid.has(i) && i !== stI);
      const c = cand.sort((p, q) => nth(dfield, q) - nth(dfield, p))[0];
      if (c !== undefined) spawns.push({ key: 'X', cx: c % W, cz: (c / W) | 0, g: -1, lead: true, home: lr });
    }
  }
  if (depth >= 2) {
    const deepAll: number[] = [];
    for (let i = 0; i < N; i++) if (liquid[i] === LQ_DEEP) deepAll.push(i);
    const ne = deepAll.length >= 8 ? Math.min(3, 1 + Math.floor(deepAll.length / 20)) : 0;
    for (let k = 0; k < ne; k++) {
      const i = pick(deepAll);
      spawns.push({ key: 'e', cx: i % W, cz: (i / W) | 0, g: -1, lead: true });
    }
  }
  let sy = 0,
    bl = -1;
  for (const d of D4) {
    let l = 0,
      x = nth(rooms, 0).cx,
      y = nth(rooms, 0).cy;
    while (tile[(y + d[1]) * W + x + d[0]] === TF && l < 20) {
      x += d[0];
      y += d[1];
      l++;
    }
    if (l > bl) {
      bl = l;
      sy = Math.atan2(-d[0], -d[1]);
    }
  }
  let floorCount = 0;
  for (let i = 0; i < N; i++) if (tile[i] === TF || tile[i] === TP) floorCount++;
  // a vault behind a portcullis, opened by a lever somewhere else on the level
  let gate: Gate | null = null;
  if (!stratum.special && !stratum.realm && stratum.k !== 'abyss' && stratum.k !== 'magma' && rand() < 0.55) {
    for (const ri of shuffle(rooms.map((_, k) => k))) {
      const r = nth(rooms, ri);
      if (
        ri === 0 ||
        r.cave ||
        r.vault ||
        r.sanct ||
        r.camp !== undefined ||
        r.mdata ||
        r.cells.includes(stI) ||
        r.cells.length < 10 ||
        r.cells.length > 70
      )
        continue;
      const set = new Set(r.cells),
        ent = new Set<number>();
      for (const i of r.cells)
        for (const d of D4) {
          const j = i + d[0] + d[1] * W;
          if (!set.has(j) && walk(j)) ent.add(j);
        }
      if (ent.size < 1 || ent.size > 4) continue;
      const entL = [...ent].filter((j) => j !== stI && j !== startI && nth(doorAt, j) < 0 && !used.has(j));
      if (!entL.length) continue;
      const e = nth(entL, 0),
        seal = [...ent].filter((j) => j !== e);
      if (seal.some((j) => j === stI || j === startI || nth(doorAt, j) >= 0 || used.has(j))) continue;
      const inside = r.cells.filter((i) => walk(i)).length,
        sv = nth(tile, e);
      for (const j of seal) tile[j] = TW;
      tile[e] = TW;
      const ok = flood(startI) === countTF() - inside;
      tile[e] = sv;
      if (!ok) {
        for (const j of seal) tile[j] = TF;
        continue;
      }
      if (spawns.some((sp) => set.has(sp.cz * W + sp.cx)))
        for (let k = spawns.length - 1; k >= 0; k--) if (set.has(nth(spawns, k).cz * W + nth(spawns, k).cx)) spawns.splice(k, 1);
      const lc: [number, Dir][] = [];
      for (let i = W; i < N - W; i++) {
        if (!walk(i) || liquid[i] || set.has(i) || i === e || used.has(i) || cd(i, e) < 100) continue;
        const d = D4.find((dd) => tile[i + dd[0] + dd[1] * W] === TW);
        if (d) lc.push([i, d]);
      }
      if (!lc.length) continue;
      const [li, ld] = nth(lc, Math.floor(rand() * lc.length));
      const axis = (walk(e + W) || set.has(e + W)) && (walk(e - W) || set.has(e - W)) ? 1 : 0;
      gate = { cell: e, lever: li, ld, open: false, o: 0, axis };
      const c = r.cells
        .filter((i) => walk(i) && !liquid[i] && !used.has(i))
        .sort((a, b) => Math.hypot((a % W) - r.cx, ((a / W) | 0) - r.cy) - Math.hypot((b % W) - r.cx, ((b / W) | 0) - r.cy))[0];
      if (c !== undefined) {
        addFix('relic', c, [1.0, 0.82, 0.42], 1.55, 1.6, 8, '_');
        const ru = nth(HIST.rulers, Math.floor(rand() * HIST.rulers.length));
        gate.heir = `${ru.title}${ru.name}の遺品`;
      }
      r.kindMsg = '鉄格子の奥の宝物庫。古の王の遺品が、台座の上で静かに光っている。';
      break;
    }
    // no room qualifies: carve a small treasure alcove into solid rock, reachable only through the gate
    if (!gate) {
      const all: number[] = [];
      for (let i = W * 3; i < N - W * 3; i++)
        if (walk(i) && !liquid[i] && !used.has(i) && i !== stI && i !== startI && cd(i, startI) > 49) all.push(i);
      for (let t2 = 0; t2 < 300 && !gate && all.length; t2++) {
        const f = nth(all, Math.floor(rand() * all.length)),
          d = nth(D4, Math.floor(rand() * 4)),
          fx = f % W,
          fz = (f / W) | 0,
          cxN = fx + d[0] * 3,
          czN = fz + d[1] * 3;
        if (cxN < 3 || czN < 3 || cxN > UW - 4 || czN > UH - 4) continue;
        let solidAll = tile[f + d[0] + d[1] * W] === TW;
        for (let dz = -2; dz <= 2 && solidAll; dz++)
          for (let dx = -2; dx <= 2; dx++) {
            if (tile[(czN + dz) * W + cxN + dx] !== TW) {
              solidAll = false;
              break;
            }
          }
        if (!solidAll) continue;
        const e = f + d[0] + d[1] * W,
          cells: number[] = [];
        tile[e] = TF;
        ceil[e] = BASE_H;
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const j = (czN + dz) * W + cxN + dx;
            tile[j] = TF;
            ceil[j] = BASE_H;
            cells.push(j);
          }
        const ri = rooms.length;
        rooms.push(
          newRoom(cxN - 1, czN - 1, 3, 3, 'rect', {
            cells,
            theme: nth(rooms, 0).theme,
            alcove: true,
            kindMsg: '鉄格子の奥の小さな宝物庫。古の王の遺品が、台座の上で静かに光っている。',
          }),
        );
        for (const j of cells) roomOf[j] = ri;
        const lc: [number, Dir][] = [];
        for (let i = W; i < N - W; i++) {
          if (!walk(i) || liquid[i] || cells.includes(i) || i === e || used.has(i) || cd(i, e) < 100) continue;
          const dd = D4.find((q) => tile[i + q[0] + q[1] * W] === TW);
          if (dd) lc.push([i, dd]);
        }
        if (!lc.length) {
          for (const j of cells.concat([e])) tile[j] = TW;
          rooms.pop();
          continue;
        }
        const [li, ld] = nth(lc, Math.floor(rand() * lc.length));
        gate = { cell: e, lever: li, ld, open: false, o: 0, axis: d[0] !== 0 ? 0 : 1 };
        addFix('relic', czN * W + cxN, [1.0, 0.82, 0.42], 1.55, 1.6, 8, '_');
        const ru = nth(HIST.rulers, Math.floor(rand() * HIST.rulers.length));
        gate.heir = `${ru.title}${ru.name}の遺品`;
      }
    }
    // still nothing: a one-cell niche in the wall, which even the thin walls of the great caverns can hold
    if (!gate) {
      const all: number[] = [];
      for (let i = W * 2; i < N - W * 2; i++)
        if (walk(i) && !liquid[i] && !used.has(i) && i !== stI && i !== startI && cd(i, startI) > 49) all.push(i);
      for (let t2 = 0; t2 < 400 && !gate && all.length; t2++) {
        const f = nth(all, Math.floor(rand() * all.length)),
          d = nth(D4, Math.floor(rand() * 4)),
          e = f + d[0] + d[1] * W,
          c = f + d[0] * 2 + d[1] * W * 2,
          ccx = c % W,
          ccz = (c / W) | 0;
        if (ccx < 2 || ccz < 2 || ccx > UW - 3 || ccz > UH - 3 || tile[e] !== TW) continue;
        let ok = true;
        for (let dz = -1; dz <= 1 && ok; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            if (tile[(ccz + dz) * W + ccx + dx] !== TW) {
              ok = false;
              break;
            }
          }
        if (!ok) continue;
        const lc: [number, Dir][] = [];
        for (let i = W; i < N - W; i++) {
          if (!walk(i) || liquid[i] || i === e || used.has(i) || cd(i, e) < 100) continue;
          const dd = D4.find((q) => tile[i + q[0] + q[1] * W] === TW);
          if (dd) lc.push([i, dd]);
        }
        if (!lc.length) continue;
        tile[e] = TF;
        tile[c] = TF;
        ceil[e] = ceil[c] = BASE_H;
        const ri = rooms.length;
        rooms.push(
          newRoom(ccx, ccz, 1, 1, 'rect', {
            cells: [c],
            theme: nth(rooms, 0).theme,
            alcove: true,
            kindMsg: '鉄格子の奥の壁龕。古の王の遺品が、ひっそりと光っている。',
          }),
        );
        roomOf[c] = ri;
        const [li, ld] = nth(lc, Math.floor(rand() * lc.length));
        gate = { cell: e, lever: li, ld, open: false, o: 0, axis: d[0] !== 0 ? 0 : 1 };
        addFix('relic', c, [1.0, 0.82, 0.42], 1.55, 1.6, 8, '_');
        const ru = nth(HIST.rulers, Math.floor(rand() * HIST.rulers.length));
        gate.heir = `${ru.title}${ru.name}の遺品`;
      }
    }
  }
  // hidden traps: alarms, trapdoors, nets, floods and gas
  const traps: Trap[] = [];
  if (depth >= 2 && !stratum.special) {
    const types = ['alarm', 'net', 'methane', 'flood'].concat(stratum.k !== 'abyss' ? ['trapdoor'] : []),
      nT = RI(2, 4) + (depth >= 6 ? 1 : 0),
      cand: number[] = [];
    for (let i = W; i < N - W; i++) {
      if (
        !walk(i) ||
        liquid[i] ||
        used.has(i) ||
        solid.has(i) ||
        bridge[i] ||
        i === stI ||
        i === startI ||
        cd(i, startI) < 64 ||
        cd(i, stI) < 9 ||
        vaultCell[i] ||
        glyph[i] ||
        (gate && i === gate.cell) ||
        taken.has(i)
      )
        continue;
      cand.push(i);
    }
    for (const i of spread(cand, nT)) {
      const type = nth(types, Math.floor(rand() * types.length)),
        t: Trap = { i, type, hidden: true, used: false };
      if (type === 'flood') {
        const order: number[] = [],
          seen = new Set([i]),
          q = [i];
        for (let h = 0; h < q.length && order.length < 40; h++) {
          const c = nth(q, h);
          order.push(c);
          for (const d of D4) {
            const j = c + d[0] + d[1] * W;
            if (seen.has(j) || !walk(j) || liquid[j] || solid.has(j) || j === stI) continue;
            seen.add(j);
            q.push(j);
          }
        }
        t.order = order;
      }
      traps.push(t);
    }
  }
  const items: Item[] = [];
  if (!stratum.special) {
    const free: number[] = [];
    for (let i = W; i < N - W; i++)
      if (
        walk(i) &&
        !liquid[i] &&
        !used.has(i) &&
        !solid.has(i) &&
        i !== stI &&
        i !== startI &&
        !taken.has(i) &&
        !(gate && i === gate.cell)
      )
        free.push(i);
    if (gate) {
      const inside: number[] = [];
      for (let i = 0; i < N; i++) {
        const rr = nth(roomOf, i);
        const km = rr >= 0 ? nth(rooms, rr).kindMsg : undefined;
        if (km && km.includes('鉄格子の奥') && walk(i) && !used.has(i)) inside.push(i);
      }
      items.push({
        i: inside.length ? nth(inside, Math.floor(rand() * inside.length)) : gate.cell,
        kind: 'rune',
        rune: (() => {
          if (rand() < 0.5) {
            const wp = weapons;
            return rollTraits(makeRune(nth(wp, Math.floor(rand() * wp.length))), depth, 1);
          }
          const ru = makeRune(nth(RUNE_TYPES.mod, Math.floor(rand() * RUNE_TYPES.mod.length)));
          if (rand() < 0.35) ru.strong = true;
          return ru;
        })(),
        taken: false,
        vault: true,
      });
    }
  }
  // the deepest place: a high vault over the bottom, so the last shadow stands under its own dark sky
  if (depth === FINAL_DEPTH && !branch && !realm) {
    const sx0 = stI % W,
      sz0 = (stI / W) | 0;
    for (let dz = -10; dz <= 10; dz++)
      for (let dx = -10; dx <= 10; dx++) {
        const i = (sz0 + dz) * W + sx0 + dx,
          d = Math.hypot(dx, dz);
        if (i < 0 || i >= N || d > 10) continue;
        ceil[i] = Math.max(nth(ceil, i), 7 + 6 * (1 - d / 10));
      }
  }
  // lights placed with the inhabitants (campfires) still need their visibility, and the light map must include them
  if (lights.some((L) => !L.vis)) {
    lights.forEach((L) => {
      if (!L.vis) L.vis = computeVis(L, tile);
    });
    bakeCellLights();
  }
  const level = {
    items,
    traps,
    glyph,
    gate,
    algae,
    webs,
    thin,
    teles,
    erupts,
    upstairs,
    bstairs,
    portal,
    rock: ROCKS[stratum.k] || ROCKS['maze'],
    vein,
    engr,
    vaultCell,
    flow,
    stratum,
    darkMul,
    bridge,
    bridgeDir,
    xtalCol,
    prof,
    doors,
    doorAt,
    tile,
    liquid,
    surface,
    roomOf,
    rooms,
    ceil,
    dfield,
    lights,
    fixtures,
    fixCell,
    decoCell,
    solid,
    stairs: stI,
    start: startI,
    startYaw: sy,
    cellLI,
    cellLW,
    spawns,
    floorCount,
    noiseSeed: ns,
    gas: new Float32Array(N),
    bogList: rooms.flatMap((r) => r.bog).concat([...Array(N).keys()].filter((i) => nth(roomOf, i) < 0 && liquid[i] === LQ_BOG)),
  };
  return { level, lordType, beastType };
}
/** 生成の結果（階・その階の主の種類・忘れられた獣） */
export type GenResult = ReturnType<typeof generateLevel>;
/** 生成した階（古い JS の D に入る物） */
export type Level = GenResult['level'];
