// ゲームの状態の入れ物（段階7b）。古い JS（src/game/）の一番外の状態（let など）を、分野ごとに型の付いた入れ物にまとめる。
// 古い JS は src/game/imports.mjs で入れ物を読み、vfx.shake のように欄で読み書きする（入れ物そのものは差し替えない）。
// 移す時は tools/state-move.mjs を使う（同じ名前の局所の変数は書き換えない）。初めの値は、古い JS の宣言のまま。
// 入れ物の名前は、古い JS の局所の名前とぶつからない物にする（道具が確かめる。fx は座標の fx とぶつかるので vfx にした）。
import { type BranchPlace, type InterPlace, type Level, type RealmPlace } from './generate.ts';
import { type Rune } from './runes.ts';
import { NCELL } from './world.ts';

/** 稲妻の光り（灯りの1つとして描く。t は残りの秒。900 より大きいと消えない） */
export interface ZapFlash {
  x: number;
  y: number;
  z: number;
  col: readonly number[];
  t: number;
  r: number;
}

/** 時計（ゲームの時刻。止めている間・テスト用モードで進めない間は進まない。溜めている間・ヒットストップ中はゆっくり進む） */
export interface Clock {
  /** ゲームが始まってからの秒（30-loop-init.js の tick が進める） */
  time: number;
}
export const clock: Clock = { time: 0 };

/** 揺れと光り（画面の揺れ、画面の光り、傷・回復の光り、稲妻の光り） */
export interface Vfx {
  shake: number;
  flash: number;
  hurtFlash: number;
  hpFlash: number;
  zapFlash: ZapFlash | null;
}
export const vfx: Vfx = { shake: 0, flash: 0, hurtFlash: 0, hpFlash: 0, zapFlash: null };

/** 画面の開け閉め（冒険が始まったか、1人称・3人称、マウスを捕まえているか、各画面が開いているか、表示の量） */
export interface Ui {
  /** 冒険が始まったか（タイトルの画面を閉じたか） */
  started: boolean;
  /** 装備の画面 */
  invOpen: boolean;
  /** メニュー */
  menuOpen: boolean;
  /** 操作の案内 */
  helpOn: boolean;
  /** マウスを捕まえているか（ポインタロック） */
  locked: boolean;
  /** 1人称（'fps'）か3人称 */
  camMode: string;
  /** レベルアップの画面 */
  lvlOpen: boolean;
  /** 祭壇の画面 */
  altarOpen: boolean;
  /** デバッグの画面（F2） */
  dbgOpen: boolean;
  /** 年代記の画面 */
  chronOn: boolean;
  /** 表示の量（0：全部、1：少し、2：なし） */
  uiMode: number;
  /** 速さの表示 */
  perfOn: boolean;
}
export const ui: Ui = {
  started: false,
  invOpen: false,
  menuOpen: false,
  helpOn: false,
  locked: false,
  camMode: 'fps',
  lvlOpen: false,
  altarOpen: false,
  dbgOpen: false,
  chronOn: false,
  uiMode: 0,
  perfOn: false,
};

/** レベルと経験（n：レベル、exp：経験、pending：まだ選んでいない加護の数、bless：加護ごとの段、strata：入った層）。後から足される欄は、使う処理を移す時に型を足す */
export interface Lvl {
  n: number;
  exp: number;
  pending: number;
  bless: Record<string, number>;
  strata: Set<string>;
}
/** 冒険の記録（倒した数・始めた時刻）。後から足される欄（maxDepth・cause など）は、使う処理を移す時に型を足す */
export interface RunStats {
  kills: number;
  t0: number;
}
/** 冒険の進み（最初の武器を選んだか・最初の祭壇・取った物・倒した主）。後から足される欄（bodyOpen など）は、使う処理を移す時に型を足す */
export interface RunState {
  startChosen: boolean;
  altar1: boolean;
  taken: Set<string>;
  lordsDone: Set<string>;
}
/** 今の冒険（シード・レベル・死んだか・勝ったか・記録・進み・試練・体力の上限・表示している体力） */
export interface Adv {
  /** 冒険のシード。本当の初めの値は、古い JS（18-level-player.js）がテスト用モードの乱数の入れ替えの後に入れる。ここの 0 は仮 */
  runSeed: number;
  lvl: Lvl;
  dead: boolean;
  runStats: RunStats;
  runState: RunState;
  /** 選んだ試練 */
  runTrials: string[];
  /** 体力の上限 */
  PLAYER_MAX: number;
  won: boolean;
  /** 表示している体力（変わった時だけ描き直すため） */
  hpShown: number;
}
export const adv: Adv = {
  runSeed: 0,
  lvl: { n: 1, exp: 0, pending: 0, bless: {}, strata: new Set() },
  dead: false,
  runStats: { kills: 0, t0: 0 },
  runState: { startChosen: false, altar1: false, taken: new Set(), lordsDone: new Set() },
  runTrials: [],
  PLAYER_MAX: 40,
  won: false,
  hpShown: -1,
};

/** プレイヤー（位置・速さ・向き・揺れ・目の高さ・体力）。丸ごと入れ替えることは無いので、古い JS は今までどおり player.x のように読む。
 * 後から足される欄（roll・lunge・netT など）は、使う処理を移す時に型を足す */
export interface Player {
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  pitch: number;
  bob: number;
  eye: number;
  hp: number;
}
export const player: Player = { x: 0, z: 0, vx: 0, vz: 0, yaw: 0, pitch: -0.04, bob: 0, eye: 1.62, hp: 40 };

/** 片手（L・R）の状態：武器のルーン atk と、付けたルーンの枠 slots（枠の数 slotN）。elem・trig は、その手の性質と引き金のルーン。後から足される欄は、使う処理を移す時に型を足す。
 * runes.ts の Hand（handRunes などが読む、枠だけの形）とは別の物 */
export interface HandState {
  atk: Rune | null;
  slots: (Rune | null)[];
  slotN: number;
  turn: number;
  elem: Rune | null;
  trig: Rune | null;
}
/** 両手と、体のルーンの枠 B（b0・b1） */
export interface Hands {
  L: HandState;
  R: HandState;
  B: { b0: Rune | null; b1: Rune | null };
}
/** 詠唱（溜め）の途中：どちらの手か h、経った時間 t と要る時間 need、溜めきったか full、光線か beam など */
export interface CastState {
  h: 'L' | 'R';
  t: number;
  need: number;
  full: boolean;
  hold: number;
  beam: boolean;
  firing: boolean;
  tick: number;
  beamT: number;
  /** 今の音節の番号（詠唱の声が鳴るたびに入る。26-spells-hud.js の chantStart） */
  syl?: number;
  /** 今の音節が鳴った時刻（詠唱の見た目が、鳴った直後だけ文字を光らせる） */
  sylT?: number;
}
/** 武器の持ち替えの途中（経った時間 t・かかる時間 dur・持ち替える前の形 snap） */
export interface SwapState {
  t: number;
  dur: number;
  snap: unknown;
  last: number;
}
/** 覚えておいた組み合わせ（両手の武器と枠、名前）。atk・slots はルーンそのものではなく、ルーンの uid（空は 0）。使う時に uid から持ち物を探す */
export interface Build {
  L: { atk: number; slots: number[] };
  R: { atk: number; slots: number[] };
  label: string;
}
/** 手と詠唱（両手・持ち物・詠唱の途中・持ち替えの途中・覚えておいた組み合わせと、今どれか） */
export interface Gear {
  /** 両手。冒険が始まるまでは null */
  hands: Hands | null;
  /** 持ち物のルーン */
  bag: Rune[];
  castSt: CastState | null;
  swapSt: SwapState | null;
  builds: (Build | null)[];
  /** 今の組み合わせ（-1 はどれでもない） */
  buildIdx: number;
}
export const gear: Gear = { hands: null, bag: [], castSt: null, swapSt: null, builds: [null, null], buildIdx: -1 };

/** 投げた火花（火打ち石。当たった所に火がつく） */
export interface Spark {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
}
/** 火と地面のマス（マスごとの火・燃える物・灰・印・火の明かり・匂い）と、燃えているマスの一覧・ガス・投げた火花。階に入るたびに作り直す（火・燃える物・灰・印・明かりと燃えているマスは 15-sound-fire.js の initFire、匂い・ガス・火花は 18-level-player.js の newLevel） */
export interface Blaze {
  /** マスごとの火の強さ */
  fire: Float32Array;
  /** マスごとの燃える物の量 */
  fuel: Float32Array;
  /** 燃え尽きた灰の印 */
  burnt: Uint8Array;
  /** マスごとの印（苔を食べた跡など） */
  cellFlag: Uint8Array;
  /** マスごとの火の明かり */
  fireLight: Float32Array;
  /** プレイヤーの匂い（付いた時のゲームの時刻。0は匂い無し。猟犬が追う） */
  scent: Float32Array;
  /** 燃えているマスの一覧 */
  burning: number[];
  /** どこかにガスがあるか */
  gasAny: boolean;
  spark: Spark | null;
  /** 凍らせた水のマス（マス → 溶けるまでの秒・元の液体・元の床）。26-spells-hud.js の chillArea・updateFrozen */
  frozen: Map<number, { t: number; liq: number; surf: number }>;
}
export const blaze: Blaze = {
  fire: new Float32Array(NCELL),
  fuel: new Float32Array(NCELL),
  burnt: new Uint8Array(NCELL),
  cellFlag: new Uint8Array(NCELL),
  fireLight: new Float32Array(NCELL),
  scent: new Float32Array(NCELL),
  burning: [],
  gasAny: false,
  spark: null,
  frozen: new Map(),
};

/** 光線の一切れ（点の並び・色・残りの秒） */
export interface BeamSeg {
  pts: unknown[];
  col: readonly number[];
  t: number;
}
/** 毒の霧 */
export interface Cloud {
  x: number;
  z: number;
  r: number;
  t: number;
  tick: number;
}
/** 魔法の場（性質 el の場。0.5秒ごとに、中にいる生き物に性質を移す） */
export interface Zone {
  x: number;
  z: number;
  r: number;
  r0: number;
  /** 術の中身。型は、詠唱の処理を移す時に作る */
  sp: unknown;
  el: string | null;
  t: number;
  tick: number;
  grow: boolean;
}
/** 遅れて起きること（ゲームの時刻 t になったら fn を呼ぶ） */
export interface Later {
  t: number;
  fn: () => void;
  done?: boolean;
}
/** 降り注ぐ雨（n 粒を iv 秒ごとに。left は残りの粒） */
export interface Rain {
  x: number;
  z: number;
  r: number;
  n: number;
  left: number;
  iv: number;
  tick: number;
  /** 術の中身。型は、詠唱の処理を移す時に作る */
  sp: unknown;
  follow: boolean;
  elemK: number;
  again: boolean;
  done?: boolean;
}
/** 床の印（雨や落ちてくる物の、落ちる場所の目印） */
export interface Mark {
  x: number;
  z: number;
  r: number;
  t: number;
  c: readonly number[];
  star?: boolean;
}
/** 撃っている途中の光線（どちらの手か・残りの秒・次に撃つまでの秒・自動か・向き） */
export interface BeamRun {
  h: 'L' | 'R';
  t: number;
  tick: number;
  auto: boolean;
  dir: readonly number[] | null;
}
/** 稲妻の見た目（a から b へ、ぎざぎざの線 pts） */
export interface Bolt {
  a: readonly number[];
  b: readonly number[];
  col: readonly number[];
  style: string;
  amp: number;
  t: number;
  life: number;
  re: number;
  pts: unknown[];
}
/** 戦い：飛ぶ物・光線・毒の霧・魔法の場・遅れて起きること・雨・床の印・ヒットストップ・引き金の待ち・稲妻 */
export interface Fight {
  /** 飛ぶ物（矢・術の弾など）。種類が多いので、型は飛ぶ物の処理を移す時に作る */
  projs: unknown[];
  beamSegs: BeamSeg[];
  clouds: Cloud[];
  zones: Zone[];
  laters: Later[];
  rains: Rain[];
  marks: Mark[];
  beamRun: BeamRun | null;
  /** ヒットストップが終わる時刻（実時間の performance.now） */
  hitStopUntil: number;
  /** 今の当たりの元の位置（押し返しの向きを決める） */
  hitSrcPoint: [number, number] | null;
  /** 手ごとの、引き金のルーンが次に効くまでの秒 */
  trigCd: { L: number; R: number };
  /** 光線が最後に火をつけた時刻（ゲームの時刻 clock.time） */
  beamIgT: number;
  boltFx: Bolt[];
  /** 少しずつ遅れて落ちる稲妻（t 秒後に fn。済んだら done） */
  zapQueue: { t: number; fn: () => void; done?: boolean }[];
}
export const fight: Fight = {
  projs: [],
  beamSegs: [],
  clouds: [],
  zones: [],
  laters: [],
  rains: [],
  marks: [],
  beamRun: null,
  hitStopUntil: 0,
  hitSrcPoint: null,
  trigCd: { L: 0, R: 0 },
  beamIgT: -9,
  boltFx: [],
  zapQueue: [],
};

/** 階を移る途中（out：暗くなって出ていく、in：明るくなって入る。go は行き先の種類） */
export interface Trans {
  phase: 'out' | 'in';
  t: number;
  regen?: boolean;
  go?: string;
}
/** 今いる場所と、階の中身。深さ・支道・異界・特別な階、生き物、灯りの備品、階を移る途中、着いた所 */
export interface Here {
  /** 階の生き物。生き物の型は、生き物の処理を移す時に作る */
  monsters: unknown[];
  depth: number;
  branch: BranchPlace | null;
  realm: RealmPlace | null;
  inter: InterPlace | null;
  /** 灯りの備品。型は、備品の処理を移す時に作る */
  fixtures: unknown[];
  trans: Trans | null;
  /** 着いた所（'stairs'・'portal' など。普通に入った時は null） */
  arrive: string | null;
  /** 階に入った時の暗さ */
  fade: number;
  /** 図鑑の見本の階を作っているか */
  showroomGen: boolean;
  /** 今の階の中身（generate.ts の generateLevel の結果）。初期化（30-loop-init.js の init）で1つ目の階を作るまでは null。後から足される欄（hub など）は、使う処理を移す時に型を足す */
  D: Level | null;
  /** 見たことのあるマス（階に入るたびに作り直す。18-level-player.js の newLevel） */
  explored: Uint8Array;
  /** マスごとの覚えた色（マスの数×3） */
  mem: Float32Array;
  /** 今見えているマスの印（fovStamp と同じなら見えている） */
  fovVis: Uint32Array;
  /** 見えるマスを数え直すたびに増える印 */
  fovStamp: number;
  /** 部屋の出来事（神託・転移・噴き出し・像・崩れ・水攻め・霊など）。型は、出来事の処理を移す時に作る */
  events: unknown[];
  /** 川のマスの一覧 */
  riverCells: number[];
}
export const here: Here = {
  monsters: [],
  depth: 1,
  branch: null,
  realm: null,
  inter: null,
  fixtures: [],
  trans: null,
  arrive: null,
  fade: 0,
  showroomGen: false,
  D: null,
  explored: new Uint8Array(NCELL),
  mem: new Float32Array(NCELL * 3),
  fovVis: new Uint32Array(NCELL),
  fovStamp: 1,
  events: [],
  riverCells: [],
};
/** 行った階の覚え（場所の名前 → 見えた所と覚えた色の写し）。丸ごと入れ替えないので、古い JS は今までどおり placeMem で読む */
export const placeMem = new Map<string, { explored: Uint8Array; mem: Float32Array }>();
