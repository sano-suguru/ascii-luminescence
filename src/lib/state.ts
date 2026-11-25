// ゲームの状態の入れ物。古い JS（src/game/）の一番外の状態（let など）を、分野ごとに型の付いた入れ物にまとめる。
// 古い JS は src/game/imports.mjs で入れ物を読み、vfx.shake のように欄で読み書きする（入れ物そのものは差し替えない）。
// 移す時は tools/state-move.mjs を使う（同じ名前の局所の変数は書き換えない）。初めの値は、古い JS の宣言のまま。
// 入れ物の名前は、古い JS の局所の名前とぶつからない物にする（道具が確かめる。fx は座標の fx とぶつかるので vfx にした）。
import { type MonsterType } from './creatures.ts';
import { type BranchPlace, type Fixture, type InterPlace, type Level, type RealmPlace } from './generate.ts';
import { META_DEF, type Meta } from './progress.ts';
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

/** 揺れと光り（画面の揺れ、画面の光り、ダメージを受けた時と回復した時の光り、稲妻の光り） */
export interface Vfx {
  shake: number;
  flash: number;
  hurtFlash: number;
  hpFlash: number;
  zapFlash: ZapFlash | null;
}
export const vfx: Vfx = { shake: 0, flash: 0, hurtFlash: 0, hpFlash: 0, zapFlash: null };

/** 図鑑の獣を見ている間（'beast'）か、試しの間（'range'）の状態（今は mode だけ型を付ける。ほかの欄は、図鑑と試しの間の処理を移す時に足す） */
export interface Gallery {
  mode: 'beast' | 'range';
}
/** 画面の開け閉め（探索が始まったか、1人称・3人称、マウスを捕まえているか、各画面が開いているか、表示の量、図鑑と試しの間） */
export interface Ui {
  /** 探索が始まったか（タイトルの画面を閉じたか） */
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
  /** 図鑑の獣を見ている間・試しの間の状態（どちらでもなければ null） */
  gallery: Gallery | null;
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
  gallery: null,
};

/** レベルと経験（n：レベル、exp：経験、pending：まだ選んでいない加護の数、bless：加護ごとの段、strata：入った層）。後から足される欄は、使う処理を移す時に型を足す */
export interface Lvl {
  n: number;
  exp: number;
  pending: number;
  bless: Record<string, number>;
  strata: Set<string>;
}
/** 探索の記録（倒した数・始めた時刻）。後から足される欄（maxDepth・cause など）は、使う処理を移す時に型を足す */
export interface RunStats {
  kills: number;
  t0: number;
}
/** 探索の進み（最初の武器を選んだか・最初の祭壇・取った物・倒した主・開いた体の枠の数）。古い JS が後から足すほかの欄は、使う処理を移す時に型を足す */
export interface RunState {
  startChosen: boolean;
  altar1: boolean;
  taken: Set<string>;
  lordsDone: Set<string>;
  /** 開いた体の枠の数（0 から 2） */
  bodyOpen?: number;
}
/** 今の探索（シード・レベル・死んだか・勝ったか・記録・進み・試練・体力の上限・表示している体力） */
export interface Adv {
  /** 探索のシード。本当の初めの値は、古い JS（18-level-player.js）がテスト用モードの乱数の入れ替えの後に入れる。ここの 0 は仮 */
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

/** 片手（L・R）の状態：武器のルーン atk と、付けたルーンの枠 slots（枠の数 slotN）。elem・trig は、その手の性質と発動のルーン。後から足される欄は、使う処理を移す時に型を足す。
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
/** ビルド（両手の武器と枠、名前）。atk・slots はルーンそのものではなく、ルーンの uid（空は 0）。使う時に uid から持ち物を探す */
export interface Build {
  L: { atk: number; slots: number[] };
  R: { atk: number; slots: number[] };
  label: string;
}
/** 手と詠唱（両手・持ち物・詠唱の途中・持ち替えの途中・ビルドと、今どれか） */
export interface Gear {
  /** 両手。探索が始まるまでは null */
  hands: Hands | null;
  /** 持ち物のルーン */
  bag: Rune[];
  castSt: CastState | null;
  swapSt: SwapState | null;
  builds: (Build | null)[];
  /** 今の組み合わせ（-1 はどれでもない） */
  buildIdx: number;
  /** 次に作るルーンの番号（探索の中で通し。src/lib/gear.ts の makeRune が数える） */
  runeUid: number;
}
export const gear: Gear = { hands: null, bag: [], castSt: null, swapSt: null, builds: [null, null], buildIdx: -1, runeUid: 1 };

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
/** 火と地面のマス（マスごとの火・燃える物・灰になったか・マスの変わり方の種類・火の明かり・匂い）と、燃えているマスの一覧・ガス・投げた火花。階に入るたびに作り直す（火・燃える物・灰・マスの変わり方・明かりと燃えているマスは 15-sound-fire.js の initFire、匂い・ガス・火花は 18-level-player.js の newLevel） */
export interface Blaze {
  /** マスごとの火の強さ */
  fire: Float32Array;
  /** マスごとの燃える物の量 */
  fuel: Float32Array;
  /** 燃え尽きて灰になったか */
  burnt: Uint8Array;
  /** マスごとの変わり方の種類（0：何も無い、20：踏まれた背の高い草や茸、30：食べられた光る苔、50：水になった、70：溶岩が流れ出した、100：動き出した像、200：崩れて崖になった床） */
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
/** 床の目印（雨や落ちてくる物の、落ちる場所） */
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
/** 戦い：飛ぶ物・光線・毒の霧・魔法の場・遅れて起きること・雨・床の目印・ヒットストップ・発動の待ち・稲妻 */
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
  /** 手ごとの、発動のルーンが次に効くまでの秒 */
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
/** 今の階に、古い JS が後から足す欄（型は、使う処理を移す時に足す） */
export interface LevelExtra {
  /** 最深部の階（伝説の物の台座がある。18-level-player.js の newLevel が入れる） */
  finalVault?: boolean;
}
/** 階の生き物（位置と種類） */
export interface Monster {
  x: number;
  z: number;
  ty: MonsterType;
  dead?: boolean;
  /** 群れの番号 */
  g?: number;
}
/** 今いる場所と、階の中身。深さ・支道・異界・特別な階、生き物、灯りの備品、階を移る途中、着いた所 */
export interface Here {
  /** 階の生き物（型は、TypeScript が読む欄だけ。ほかの欄は、生き物の処理を移す時に足す） */
  monsters: Monster[];
  depth: number;
  branch: BranchPlace | null;
  realm: RealmPlace | null;
  inter: InterPlace | null;
  /** 灯りの備品（今の階の here.D.fixtures と同じ物） */
  fixtures: Fixture[];
  trans: Trans | null;
  /** 着いた所（'stairs'・'portal' など。普通に入った時は null） */
  arrive: string | null;
  /** 階に入った時の暗さ */
  fade: number;
  /** 図鑑の見本の階を作っているか */
  showroomGen: boolean;
  /** 今の階の中身（generate.ts の generateLevel の結果）。初期化（30-loop-init.js の init）で1つ目の階を作るまでは null。古い JS が後から足す欄は LevelExtra（まだ型の無い hub などは、使う処理を移す時に足す） */
  D: (Level & LevelExtra) | null;
  /** 見たことのあるマス（階に入るたびに作り直す。18-level-player.js の newLevel） */
  explored: Uint8Array;
  /** マスごとの覚えた色（マスの数×3） */
  mem: Float32Array;
  /** マスごとの、最後に見えた時の数え直しの番号（fovStamp と同じなら今見えている） */
  fovVis: Uint32Array;
  /** 見えるマスを数え直すたびに1増える番号 */
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

/** 今の探索の伝説の物（シード・物の種類 → 物・持っている物・置いた物）。探索が伝説の物を選ぶまでは null。物の型は、目的の処理を移す時に作る */
export interface Legend {
  seed: number;
  /** 物の種類（LEGEND_ORDER の candle・bell・mirror）→ 物（名前・言い伝え・ある支道など） */
  items: Record<string, unknown>;
  have: Set<string>;
  placed: Set<string>;
}
/** 保存する記録（localStorage）：伝承・解放・墓・試練 META、魔導書に記した反応 BOOK、見たルーン RSEEN、見た生き物 SEEN、開発用モード DEVALL、
 * それと今の探索の伝説の物 LEGEND（これは保存しない）。
 * 本当の初めの値は、古い JS が localStorage から読んでその場で入れる（META・DEVALL は 17-meta.js、BOOK は 19-hands-runes.js、
 * SEEN・RSEEN は 25-gallery.js）。ここの値は仮 */
export interface Saved {
  META: Meta;
  BOOK: Set<string>;
  RSEEN: Set<string>;
  SEEN: Set<string>;
  DEVALL: boolean;
  LEGEND: Legend | null;
}
export const saved: Saved = {
  META: { ...META_DEF, unl: [], trials: [] },
  BOOK: new Set(),
  RSEEN: new Set(),
  SEEN: new Set(),
  DEVALL: false,
  LEGEND: null,
};

/** 鳴り続ける雑音（大きさ g と、濾す部品 f） */
export interface SoundLoop {
  g: GainNode;
  f: BiquadFilterNode;
}
/** 鳴り続ける低い音（大きさ g と、3つの波 o） */
export interface DroneLoop {
  g: GainNode;
  o: OscillatorNode[];
}
/** 鳴り続ける音の一覧（音の部品を作るまでは空） */
export interface SoundLoops {
  rumble?: SoundLoop;
  water?: SoundLoop;
  fire?: SoundLoop;
  wind?: SoundLoop;
  drone?: DroneLoop;
}
/** 音（音量の段 lv・音の仕組み ctx と、その部品・鳴り続ける音 L・まわりの音の様子 env）。丸ごと入れ替えないので、古い JS は今までどおり SND.lv のように読む。
 * 部品は、最初に音を鳴らす時（src/lib/audio.ts の sndInit）に作る */
export interface SoundState {
  /** 音量の段（src/lib/sound.ts の SND_LV の番号） */
  lv: number;
  ctx: AudioContext | null;
  on: boolean;
  master: GainNode | null;
  inp: GainNode | null;
  wet: GainNode | null;
  noise: AudioBuffer | null;
  /** 鳴り続ける音（地鳴り・水・火・風・低い音）。src/lib/audio.ts の sndInit が作る */
  L: SoundLoops;
  /** まわりの音の様子を数え直すまでの秒 */
  envT: number;
  /** まわりの音の様子（水・溶岩・崖・沼・水晶・燃えている所・火の強さと位置・洞窟か・滝の近さ）。sndUpdate が数え直す。
   * 滝 fall はその時に初めて入る。洞窟か cave は、部屋の外では部屋の欄が無いので undefined になりうる */
  env: {
    water: number;
    lava: number;
    chasm: number;
    bog: number;
    xtal: number;
    burn: number;
    fire: number;
    fx: number;
    fz: number;
    cave?: boolean | undefined;
    fall?: number;
  };
}
export const SND: SoundState = {
  lv: 1,
  ctx: null,
  on: true,
  master: null,
  inp: null,
  wet: null,
  noise: null,
  L: {},
  envT: 0,
  env: { water: 0, lava: 0, chasm: 0, bog: 0, xtal: 0, burn: 0, fire: 0, fx: 0, fz: 0, cave: false },
};
/** 忍び足と灯り（明るさ lum・見つかりやすさの段 level・物音の届く距離 range・忍び足か・表示を描き直すかを見分ける文字列 hudKey・見られているか seen）。丸ごと入れ替えない */
export interface Stealth {
  lum: number;
  level: number;
  range: number;
  sneak: boolean;
  hudKey: string;
  /** 生き物に見られているか（12-hud-text.js の updateStealth が入れる。それまでは無い） */
  seen?: boolean;
}
export const stealth: Stealth = { lum: 0, level: 1, range: 8, sneak: false, hudKey: '' };
/** 手元の灯り（届く距離 r・強さ k）。丸ごと入れ替えない */
export const lantern = { r: 8.2, k: 1 };
/** 状態の表示の数（見たマスの割合 explored）。丸ごと入れ替えない */
export const hudInfo = { explored: 0 };
/** 押しているキー（キーの code → 押しているか）。丸ごと入れ替えない */
export const keys: Record<string, boolean> = {};
