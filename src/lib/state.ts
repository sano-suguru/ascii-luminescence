// ゲームの状態の入れ物。古い JS（src/game/）の一番外の状態（let など）を、分野ごとに型の付いた入れ物にまとめる。
// 古い JS は src/game/imports.mjs で入れ物を読み、vfx.shake のように欄で読み書きする（入れ物そのものは差し替えない）。
// 移す時は tools/state-move.mjs を使う（同じ名前の局所の変数は書き換えない）。初めの値は、古い JS の宣言のまま。
// 入れ物の名前は、古い JS の局所の名前とぶつからない物にする（道具が確かめる。fx は座標の fx とぶつかるので vfx にした）。
import { type MonsterType } from './creatures.ts';
import { type BranchPlace, type Fixture, type InterPlace, type Level, type RealmPlace, type Web } from './generate.ts';
import { META_DEF, type Meta } from './progress.ts';
import { type History } from './history.ts';
import type { HandsSnap, Spec } from './gear.ts';
import type { LoreResult } from './results.ts';
import type { Body, Glyph } from './bodies/kit.ts';
import { type Rune } from './runes.ts';
import type { DataTexture, Mesh, Scene, ShaderMaterial, Sphere, Texture, Vector3, WebGLRenderer } from 'three';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { DUST_N } from './shaders.ts';
import { NCELL, NDL, NSL } from './world.ts';

/** 稲妻の光り（灯りの1つとして描く。t は残りの秒。900 より大きいと消えない） */
export interface ZapFlash {
  x: number;
  y: number;
  z: number;
  col: readonly number[];
  t: number;
  r: number;
}

/** テスト用モード（?test=1）か（src/game/00-test-mode.js が時計と乱数を入れ替える。読めない時は違う） */
export const TEST = (() => {
  try {
    return new URLSearchParams(location.search).get('test') === '1';
  } catch {
    return false;
  }
})();

/** 時計（ゲームの時刻。止めている間・テスト用モードで進めない間は進まない。溜めている間・ヒットストップ中はゆっくり進む） */
export interface Clock {
  /** ゲームが始まってからの秒（30-loop-init.js の tick が進める） */
  time: number;
  /** tick が進んだ回数（止めている間に描き直さない時は数えない）。tick の段ごとの見た目の乱数の鍵にする（30-loop-init.js の inPhase・inMobPhase） */
  frame: number;
}
export const clock: Clock = { time: 0, frame: 0 };

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
  /** このページで一度でもマウスを捕まえられたか（それからは、続けて3回失敗するまで、捕まえられないとは決めない） */
  lockedOnce: boolean;
  /** 最後に捕まえてから、捕まえようとした回数（捕まえると0に戻る。外れてから1.5秒の間の分は数えない） */
  lockTries: number;
  /** マウスが最後に外れた時刻（performance.now の値） */
  unlockedAt: number;
  /** Esc のキーを処理している間か（その間は tryLock が捕まえにいかない） */
  escKey: boolean;
  /** 指で遊んでいるか（指で触れたら true、マウスを動かしたら false。src/lib/touch.ts。この間は tryLock が捕まえにいかない） */
  touch: boolean;
  /** 指でパネルの選択肢を1回押して、選んだだけの物（2回目で決める。src/lib/touch.ts の confirmTap。無ければ ''） */
  tapArm: string;
  /** 1人称（'fps'）か3人称 */
  camMode: string;
  /** レベルアップの画面 */
  lvlOpen: boolean;
  /** 祭壇の画面 */
  altarOpen: boolean;
  /** 今いる近くの、灯った祭壇の組（祭壇の真ん中の台から1.5より近い時。無ければ null。祭壇の画面が開いている間は、開いた時の組のまま） */
  altarNear: string | null;
  /** 装備の画面で選んでいるルーン（袋から選んだ物か、手の枠 h・s から選んだ物。無ければ null） */
  packSel: { ru: Rune; from: 'bag' } | { ru: Rune; from: 'slot'; h: 'L' | 'R' | 'B'; s: string } | null;
  /** 装備の画面で、マウスを乗せているルーン（下の説明の5行に出す） */
  packHover: Rune | null;
  /** 装備の画面で、袋のルーンを最後に押した時（ルーンの番号 u と時刻 t。続けて押すと、自動ではめる） */
  packClick: { u: number; t: number };
  /** 装備の画面の袋の、種類ごとの今のページと、ページの数 */
  bagPage: Record<string, number>;
  bagPageN: Record<string, number>;
  /** 操作の案内を出してからの秒（始まりに出し、しばらくすると消す） */
  helpT: number;
  /** 群れ（'g' と群れの番号）か1体（'m' と並びの番号）ごとに、「気づいた」の伝言を出したゲームの時刻（同じ群れには12秒あける） */
  noticeMsgT: Record<string, number>;
  /** 画面の下の一言（同じ時は書き直さない） */
  hintHTML: string;
  /** メニューの「タイトルへ」「新しい探索」の、もう一度押して確かめる待ちが終わる時刻（待っていなければ 0） */
  titleArm: number;
  newRunArm: number;
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
  /** マウスを捕まえられないと決めたか（決めた後は捕まえようとしない。捕まえていない時は、ドラッグで視点を動かし、Esc でメニューを開く） */
  plFailed: boolean;
  /** 3人称のカメラの位置（x・y・z。少しずつ狙う位置へ寄せる。視点を変えた時と始めは null で、狙う位置から始める） */
  camPos: number[] | null;
  /** 装備の画面を開けた時の両手（handsKey の key と、写し snap）。閉じた時に変わっていれば、付け替えの詠唱をする。閉じている間は null */
  packSnap: { key: string; snap: HandsSnap } | null;
  /** 照準の先の生き物（src/lib/look.ts の look が毎フレーム入れ直す。src/lib/bodies/draw.ts の drawMonster1 が、明るく描いて輪を足す）。無ければ null */
  aimMon: Monster | null;
  /** 見た時の説明：今見ている物の説明（変わった時刻 lookPendT から0.5秒見続けると出す）と、出している説明 lookHTML、出す所 lookEl（30-loop-init.js より前、29-look.js で document から読む） */
  lookPend: string;
  lookPendT: number;
  lookHTML: string;
  lookEl: HTMLElement | null;
  /** 伝言を出したゲームの時刻：生き物が炎から逃げた（6秒あける）・叫ぶ生き物が叫んだ（8秒あける）。src/lib/monsters.ts の chooseNext・src/lib/ground.ts の updateCritter */
  fleeMsgT: number;
  shriekMsgT: number;
  /** 草を食べる生き物が灯りに驚いた伝言を出したか（探索の間に一度だけ） */
  grazeMsg: boolean;
  /** 照準の先の生き物を最後に探したゲームの時刻と、その生き物（src/lib/aim.ts の aimTarget。0.1秒ごとに探し直す） */
  aimT: number;
  crossMon: Mob | null;
  /** 結果の画面：墓に遺せるルーンの一覧と、選んでいる番号（0 は遺さない。src/lib/results.ts） */
  graveCands: Rune[];
  graveSel: number;
  /** 開発用：ダメージを受けない（dbg.god） */
  godMode: boolean;
  /** 背の高い茂みに入った伝言を出したか（階ごとに戻す） */
  tallMsg: boolean;
}
export const ui: Ui = {
  started: false,
  invOpen: false,
  menuOpen: false,
  helpOn: false,
  locked: false,
  lockedOnce: false,
  lockTries: 0,
  unlockedAt: -1e9,
  escKey: false,
  touch: false,
  tapArm: '',
  camMode: 'fps',
  lvlOpen: false,
  altarOpen: false,
  altarNear: null,
  packSel: null,
  packHover: null,
  packClick: { u: 0, t: 0 },
  bagPage: { atk: 0, elem: 0, trig: 0 },
  bagPageN: { atk: 1, elem: 1, trig: 1 },
  helpT: 0,
  noticeMsgT: {},
  hintHTML: '',
  titleArm: 0,
  newRunArm: 0,
  dbgOpen: false,
  chronOn: false,
  uiMode: 0,
  perfOn: false,
  gallery: null,
  plFailed: false,
  camPos: null,
  packSnap: null,
  aimMon: null,
  lookPend: '',
  lookPendT: 0,
  lookHTML: '',
  lookEl: null,
  fleeMsgT: -10,
  shriekMsgT: -99,
  grazeMsg: false,
  aimT: 0,
  crossMon: null,
  graveCands: [],
  graveSel: 0,
  godMode: false,
  tallMsg: false,
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
  /** この探索で新しく記録した忘れられた獣の数 */
  beastsNew?: number;
  /** 届いた一番深い深さ・探索の始めに魔導書に記してあった反応の数・死因・受け取った伝承（src/lib/results.ts） */
  maxDepth?: number;
  book0?: number;
  cause?: string;
  loreRes?: LoreResult;
}
/** 探索の進み（最初の武器を選んだか・最初の祭壇・取った物・倒した主・開いた体の枠の数）。古い JS が後から足すほかの欄は、使う処理を移す時に型を足す */
export interface RunState {
  startChosen: boolean;
  altar1: boolean;
  taken: Set<string>;
  lordsDone: Set<string>;
  /** 開いた体の枠の数（0 から 2） */
  bodyOpen?: number;
  /** 枠を選ぶ祭壇の組（選ばなかった枠を、離れた時に開ける。src/lib/levels.ts の settleSlotPick） */
  slotPend?: string | null;
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
  /** この探索の年代記（探索のシード HIST_SEED から、迷宮を作る時に作る。まだ作っていなければ null） */
  HIST: History | null;
  HIST_SEED: number;
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
  HIST: null,
  HIST_SEED: -1,
};

/** 指の操作の入力（src/lib/touchpad.ts が書き、src/lib/player.ts が読む） */
export const thumb: {
  /** スティックの倒し具合（アナログの時だけ。左右 x・前後 y、どちらも -1 から 1。前が -y。無ければ null で、キー WASD を使う） */
  stick: [number, number] | null;
} = { stick: null };

/** プレイヤー（位置・速さ・向き・揺れ・目の高さ・体力）。丸ごと入れ替えることは無いので、古い JS は今までどおり player.x のように読む */
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
  /** 取り戻せる体力（受けたダメージの一部。攻撃を当てると戻る） */
  rally?: number;
  /** 立ち止まっている秒と、最後に辺りを調べたマス（立ち止まると、隠された罠や化けた生き物が見つかる） */
  stillT: number;
  searchedAt: number;
  /** 転がり（経った秒 t と向き dx・dz。src/lib/chant.ts の startRoll が作り、終わると null） */
  roll?: { t: number; dx: number; dz: number } | null;
  /** 武器を振った残りの秒（0.22 から減る）と、振りの線の色（無ければ決まった色）、波を撃つ途中か（その間は振りの線を描かない） */
  swing?: number;
  swingCol?: readonly number[] | undefined;
  swingWave?: boolean;
  /** 網に掛かった残りの秒（src/lib/events.ts の罠） */
  netT?: number;
  /** 最後に通れなかった物（'wall'・'chasm'・'lava'・'gate'・'xtal'。src/lib/player.ts の solidAt が入れる） */
  blockType: string;
  /** 取り戻せる体力が戻る速さ（1秒あたり） */
  rallyRate?: number;
  /** 最後にダメージを受けたゲームの時刻 */
  lastHurt?: number;
  /** 攻撃の後の立ち直りの残りの秒（その間は次の攻撃ができない） */
  recover?: number;
  /** 加護の効く間：反撃（ctrUntil）・持ち替えの直後（swapEdgeUntil）・倒した勢い（momUntil）・素早い詠唱（qcUntil）のゲームの時刻 */
  ctrUntil?: number;
  swapEdgeUntil?: number;
  momUntil?: number;
  qcUntil?: number;
  /** 突進（経った秒 t・かかる秒 dur・向き dx・dz・速さ sp と、突進の間に切る物 cut） */
  lunge?: Lunge | null;
  /** 振った手 */
  swingH?: string;
  /** 次に転がれるまでの秒 */
  rollCd?: number;
  /** 水を歩いた時の水しぶきの溜め */
  splash?: number;
  /** 落ちて次の階へ行く途中（着いた時に落下のダメージ） */
  fall?: boolean;
  /** 炎の上にいた秒（0.5 秒ごとにダメージ） */
  fireT?: number;
  /** 最後にいたマス（マスが変わった時だけ、茂みと硫黄を調べる） */
  lastCell?: number;
}
/** 突進（経った秒 t・かかる秒 dur・向き dx・dz・速さ sp と、突進の間に切る物 cut：術 sp・当たった物 hit・幅 w・ダメージの倍率 dK・切った時に立ち直るか link） */
export interface Lunge {
  t: number;
  dur: number;
  dx: number;
  dz: number;
  sp: number;
  cut: { sp: Spec; hit: Set<Mob>; w: number; dK: number; link: boolean };
}
export const player: Player = {
  x: 0,
  z: 0,
  vx: 0,
  vz: 0,
  yaw: 0,
  pitch: -0.04,
  bob: 0,
  eye: 1.62,
  hp: 40,
  stillT: 0,
  searchedAt: -1,
  blockType: '',
};

/** 片手（L・R）の状態：武器のルーン atk と、付けたルーンの枠 slots（枠の数 slotN）。elem・trig は、その手の性質と発動のルーン。後から足される欄は、使う処理を移す時に型を足す。
 * runes.ts の Hand（handRunes などが読む、枠だけの形）とは別の物 */
export interface HandState {
  atk: Rune | null;
  slots: (Rune | null)[];
  slotN: number;
  turn: number;
  /** 次に放つ性質と発動のルーン（両手持ちの時は、実際に使う手の物を写す。無い時は null か undefined） */
  elem: Rune | null | undefined;
  trig: Rune | null | undefined;
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
  /** 今の音節の番号（詠唱の声が鳴るたびに入る。src/lib/audio.ts の chantStart） */
  syl?: number;
  /** 今の音節が鳴った時刻（詠唱の見た目が、鳴った直後だけ文字を光らせる） */
  sylT?: number;
}
/** 武器の持ち替えの途中（経った時間 t・かかる時間 dur・持ち替える前の形 snap） */
export interface SwapState {
  t: number;
  dur: number;
  snap: HandsSnap;
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
  /** 鳴っている詠唱の声（src/lib/audio.ts の chantStart が作る。音を鳴らせない時と、詠唱していない時は null） */
  humNode: ChantVoice | null;
}
/** 詠唱の声（tick：溜まった割合と、溜め終わったかを伝える。stop：止める） */
export interface ChantVoice {
  tick(k: number, isFull: boolean): void;
  stop(): void;
}
export const gear: Gear = {
  hands: null,
  bag: [],
  castSt: null,
  swapSt: null,
  builds: [null, null],
  buildIdx: -1,
  runeUid: 1,
  humNode: null,
};

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
/** 火と地面のマス（マスごとの火・燃える物・灰になったか・マスの変わり方の種類・火の明かり・匂い）と、燃えているマスの一覧・ガス・投げた火花。階に入るたびに作り直す（火・燃える物・灰・マスの変わり方・明かりと燃えているマスは src/lib/ground.ts の initFire、匂い・ガス・火花は src/lib/levels.ts の newLevel） */
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
  /** 凍らせた水のマス（マス → 溶けるまでの秒・元の液体・元の床）。src/lib/ground.ts の chillArea・updateFrozen */
  frozen: Map<number, { t: number; liq: number; surf: number }>;
  /** 踏み分けた背の高い草や茸のマスと、踏んだゲームの時刻（src/lib/ground.ts の trample が足し、src/lib/ground.ts の regrow が元に戻す。newLevel が空にする） */
  trampled: [number, number][];
  /** 火の備品（松明・焚き火など）のマス（燃えるガスがここに触れると燃え上がる。src/lib/ground.ts の initFire が作る） */
  fireSrc: number[];
  /** 沼のガスが爆ぜた伝言を最後に出したゲームの時刻（3秒あける） */
  lastBoom: number;
  /** ガスが広がる時の作業の配列（src/lib/ground.ts の stepGas） */
  gasTmp: Float32Array;
  /** 燃えた硫黄を戻すまでに経った秒（2秒ごとに戻す。src/lib/ground.ts の brimRecover） */
  brimT: number;
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
  trampled: [],
  fireSrc: [],
  lastBoom: -10,
  gasTmp: new Float32Array(NCELL),
  brimT: 0,
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
  /** 術の中身 */
  sp: Spec;
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
  /** 術の中身 */
  sp: Spec;
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
  dir: readonly [number, number, number] | null;
}
/** 稲妻の見た目（a から b へ、ぎざぎざの線 pts） */
export interface Bolt {
  a: readonly [number, number, number];
  b: readonly [number, number, number];
  col: readonly number[];
  /** 描き方（'thunder'・'fire'・'ice' と、ほか） */
  style: string;
  amp: number;
  t: number;
  life: number;
  /** ぎざぎざの線を引き直すまでの秒 */
  re: number;
  pts: (readonly [number, number, number])[];
}
/**
 * 飛ぶ物（矢 bolt・玉 orb。src/lib/combat.ts の撃ち方が作り、src/lib/projs.ts の updateProjs が動かす）。
 * 位置と速さ・経った秒 t・術 sp・跳ね返る数 bounce・追う強さ homing・当たった生き物 hit は必ずある。ほかは撃ち方ごとの欄
 */
export interface Proj {
  kind: 'bolt' | 'orb';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  sp: Spec;
  bounce: number;
  homing: number;
  hit: Set<Mob>;
  /** 消えるまでの秒（無ければ 4） */
  maxT?: number;
  /** 自動で撃った物（発動のルーン） */
  auto?: boolean;
  /** 風の刃（剣の波・突き）・大きい・波の形・突きの形・幅・当たりの太さ */
  wind?: boolean;
  big?: boolean;
  wave?: boolean;
  thrust?: boolean;
  cw?: number;
  rad?: number;
  /** 加速と最高の速さ */
  accel?: number;
  vmax?: number;
  /** ダメージの幅と倍率、貫く残りの数と、貫いても弱らないか、壁を抜ける残りの数と、壁を抜けている途中か */
  dmg?: readonly number[] | undefined;
  dmgK?: number;
  pierce?: number;
  keep?: boolean;
  wallPass?: number;
  passing?: boolean;
  /** 光の月：大きさ・引き寄せ・引き寄せた生き物、重さが効かない */
  moon?: number;
  tide?: number;
  pulled?: Set<Mob>;
  noGrav?: boolean;
  /** 消える印 */
  dead?: boolean;
}
/** 戦い：飛ぶ物・光線・毒の霧・魔法の場・遅れて起きること・雨・床の目印・ヒットストップ・発動の待ち・稲妻 */
export interface Fight {
  /** 飛ぶ物（矢・術の弾など） */
  projs: Proj[];
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
  /** 立ち直りの光の粒（当てた生き物から手元へ飛ぶ。src/lib/combat.ts の rallyOnHit が足し、21-altars-heal.js の updateRally が動かす） */
  rallyMotes: RallyMote[];
}
/** 立ち直りの光の粒（出た所 x0・y0・z0、経った秒 t（初めは負で、少し遅れて出る）、飛ぶ秒 dur、戻す体力 amt、色 c、揺れの位相 wob） */
export interface RallyMote {
  x0: number;
  y0: number;
  z0: number;
  t: number;
  dur: number;
  amt: number;
  c: readonly number[];
  wob: number;
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
  rallyMotes: [],
};

/** 階を移る途中（out：暗くなって出ていく、in：明るくなって入る。go は行き先の種類） */
export interface Trans {
  phase: 'out' | 'in';
  t: number;
  regen?: boolean;
  go?: string;
  /** 真っ暗になったら、新しい探索を始める（src/lib/levels.ts の startNewRun） */
  run?: boolean;
}
/** 今の階に、古い JS が後から足す欄（型は、使う処理を移す時に足す） */
export interface LevelExtra {
  /** 最深部の階（王の影が現れる。src/lib/levels.ts の newLevel が入れる） */
  finalVault?: boolean;
  /**
   * ここから stairGuard までは、深さ2から下（と支道・異界）の祭壇などを置く時（src/lib/altars.ts の mainPathAltars）に入れる。深さ1・特別な階・最深部には無い。
   * 始まりのマスから各マスへの歩数（行けないマスは -1）
   */
  dS?: Int32Array;
  /** 始まりから階段までの歩数（階段が無い・行けない時は 0） */
  pathL?: number;
  /** 十字路（本道の真ん中あたりの一番大きい部屋の番号 ri と、その真ん中 cx・cz） */
  hub?: { ri: number; cx: number; cz: number };
  /** 十字路から矢印が届く所にある、寄り道の場所の数 */
  hubNear?: number;
  /** 強敵の部屋を置いたかの手がかり（dbg が見せる。部屋の数・本道から5以上外れた部屋の数・選んだ部屋があるか・強敵の種類・引いた乱数） */
  eliteWhy?: { rooms: number; far: number; er: boolean; key: string | null; roll: number };
  /** 階段の前の部屋で待つ群れの番号（この群れが倒れるまで、階段は封じられる） */
  stairGuard?: number;
  /** 階段と門のそばの石碑（マス i と、刻まれた文字 g。どの階でも、src/lib/altars.ts の placeRunesForLevel が入れる） */
  steles?: { i: number; g: string }[];
  /** 薄い氷のきしむ伝言を出したか（その階で一度だけ。src/lib/ground.ts の crackIce） */
  crackMsg?: boolean;
  /** 床が崩れたか（部屋の出来事。src/lib/levels.ts の initEvents が false にする） */
  collapsed?: boolean;
  /** 床が崩れて開いた穴のマス（1 が穴。src/lib/levels.ts の initEvents が作り、床が崩れる出来事が入れる） */
  pit?: Uint8Array;
  /** マス → クモの巣（src/lib/ground.ts の initFire が作る） */
  webAt?: Map<number, Web>;
  /** 先にある物の手がかり（はじめて読んだ時に作る。src/lib/omens.ts の omenOf） */
  omen?: Omen;
  /** 封じられた階段のうなり声を、次に鳴らせるゲームの時刻と、封が解けた伝言を出したか（src/lib/omens.ts の drawStairSeal） */
  sealSnd?: number;
  sealOpenMsg?: boolean;
  /** 壁の彫刻を見つけた伝言・深い水に入った伝言・氷の上の伝言を出したか（その階で一度だけ） */
  engrSeen?: boolean;
  swimMsg?: boolean;
  iceMsg?: boolean;
  /** 転移の陣の伝言を出したか（その階で一度だけ。src/lib/events.ts の updateEvents） */
  teleMsg?: boolean;
}
/** 先にある物の手がかり（src/lib/omens.ts の computeOmen）：下り階段から漏れる物（特別な階・層の変わり目・支道の奥）、支道の入口、異界の門、
 * 支道の入口と奥の階段のまわりの跡、場所ごとに次に音を鳴らせるゲームの時刻 */
export interface Omen {
  stairs: { kind: 'special' | 'stratum'; key: string } | { kind: 'branch'; key: string; strong: boolean } | null;
  branch: { key: string; cell: number } | null;
  portal: { key: string; cell: number } | null;
  traces: { x: number; z: number; key: string; r: number; a: number }[];
  sndT: Record<string, number>;
}
/** 伝言（html と、出した時刻 t） */
export interface LogMsg {
  html: string;
  t: number;
}
/** 画面の伝言（新しい物が後ろ。src/lib/log.ts の msg が足し、renderLog が古い物を消す）。丸ごと入れ替えない */
export const msgs: LogMsg[] = [];
/** 階の生き物（位置と種類） */
export interface Monster {
  x: number;
  z: number;
  /** 足もとの高さ */
  y?: number;
  ty: MonsterType;
  /** 今見えているか（見えるマスにいて、隠れていない） */
  visible?: boolean;
  dead?: boolean;
  /** 群れの番号 */
  g?: number | undefined;
  /** 水から出ている度合い（うなぎ。0 なら潜っている） */
  surf?: number;
  /** 気づいている度合い（0 から 1.25。0.35 を超えると、眠りから覚める）と、気づいたか・眠っているか */
  aware?: number;
  noticed?: boolean;
  sleep?: boolean;
  /** 起きた後、動き出すまでの秒 */
  wait?: number;
  /** 化けている（巻物の姿の幻影）。revealNow で正体を現す */
  hidden?: boolean;
  revealNow?: boolean;
  /** 警報を鳴らしたか（監視の機械）・遠吠えを上げたか（野営の群れ・猟犬）・目を覚ましたか（忘れられた獣） */
  alarmed?: boolean;
  howled?: boolean;
  woke?: boolean;
  /** 頭の上の印（! ?）を出してからの秒 */
  mark?: number;
  /** 向き（ラジアン）と、歩いている度合い（0 から 1） */
  yaw?: number;
  moving?: number;
  /** 体力と、その最大 */
  hp?: number;
  maxHp?: number;
  /** 形（src/lib/bodies/build.ts の buildForm） */
  form?: Body;
  /** 姿を変える途中（前の姿の点 from、始めたゲームの時刻 t0、かかる秒 dur。王の影の変身） */
  morph?: { from: Glyph[]; t0: number; dur: number } | null;
  /** 王の影：二つ目の姿になったか、攻撃が効かない残りの秒 */
  phase2?: boolean;
  invulnT?: number;
  /** まわりの粒子が初めに作って覚える物（src/lib/bodies/auras.ts）：不死の王の剣、古竜の宝、深みの主の灯り、光の猟犬の残像と、残した時刻 */
  swords?: { x: number; z: number; tx: number; tz: number; h: number }[];
  hoard?: { x: number; z: number; y: number; ch: string }[];
  lamps?: [number, number, number][];
  ghosts?: { x: number; y: number; z: number; yaw: number; t: number }[];
  ghostT?: number;
  /** 次に低い音・息の音を鳴らせるゲームの時刻（不死の王・ナーガの女王） */
  droneT?: number;
  hissT?: number;
  /** 向かう所（x・z）と、そこを目指すのをやめるゲームの時刻（クモの巣に触れた時など） */
  goal?: [number, number];
  goalT?: number;
  /** 当たって光る残りの秒 */
  hitT?: number;
  /** 体の明るさ（生き物の処理が入れる）と、心臓を見せるか（王の影。24-goal.js の spawnFinalBoss） */
  glow?: number;
  heartOn?: boolean;
  /** ここから下は、描く処理（src/lib/bodies/draw.ts）と見た時の説明（src/lib/look.ts）・灯り（src/lib/lightmap.ts の updateLights）が読む欄。
   * 生き物の表の鍵（'final' は王の影）と、揺れの位相 ph・歩きの位相 walk・警戒 alert（src/lib/monsters.ts の makeMonster が入れる） */
  key?: string;
  ph?: number;
  walk?: number;
  alert?: number;
  /** 深みの主の、水から出ている度合い（0 なら触手を描かない） */
  rise?: number;
  /** 近接の攻撃の溜めの残りの秒（頭の上に ! を出す） */
  wind?: number;
  /** __test.hideMonster：しばらく描かない（灯りは残る） */
  drawHide?: boolean;
  /** 当たってひるむのが終わるゲームの時刻（それまで体が震える） */
  flinchUntil?: number;
  /** 眠っている姿（竜と忘れられた獣。初めて描く時に作る）と、前に描いた時に眠っていたか、今描く姿（眠っている時は眠っている姿、ほかは null） */
  formSleep?: Body;
  wasSleep?: boolean;
  drawForm?: Body | null;
  /** その生き物だけの見た目の乱数の並び（src/lib/monsters.ts の makeMonster が作る）。形と初めの値と、初めて描く時に作って覚える物（眠った姿・まわりの飾り）に使う */
  rnd?: () => number;
  /** 強い個体（足もとに輪を描く） */
  elite?: boolean;
  /** 剣を操る者のまわりの剣 */
  blades?: { a: number; x: number; y: number; z: number }[];
  /** 驚いて逃げている残りの秒（小さな生き物） */
  flee?: number;
  /** 動いている速さ（照準の先読みに使う。src/lib/projs.ts の updateStatuses が、前のフレームの位置 plx・plz から入れる） */
  vlx?: number;
  vlz?: number;
  plx?: number;
  plz?: number;
  /** 最後に受けた攻撃の種類と、その吹き飛ばしの強さ（src/lib/combat.ts の hitReact が読む） */
  lastAtk?: string | undefined;
  lastKnock?: number | undefined;
  /** 性質の跡を最後に残したゲームの時刻（火・冷気・稲妻・連鎖。0.5 秒あける） */
  fireT2?: number;
  iceT?: number;
  chainT?: number;
  chainT2?: number;
  /** 沼と深みの物が姿を現した伝言を出したか・ノームが最後に話したゲームの時刻・重い足音の溜め */
  riseMsg?: boolean;
  talkT?: number;
  stepT?: number;
  /** 試しの間の的：受けた傷の合計と、それを出しておく残りの秒 */
  dsum?: number;
  dT?: number;
  /** 吹き飛ばされている速さ */
  kx?: number;
  kz?: number;
  /** 最後にプレイヤーの攻撃が当たったゲームの時刻（立ち直りに使う） */
  playerT?: number;
}
/** src/lib/monsters.ts の makeMonster が作る生き物（階の生き物 here.monsters）。makeMonster が必ず入れる欄を、必ずある物にした型 */
export interface Mob extends Monster {
  /** 出てはいけない部屋の外（その部屋の番号）・見回りの道のマスと、次に向かう番号・野営の火のマス */
  home?: number | undefined;
  route?: number[] | undefined;
  ri: number;
  camp?: number | undefined;
  key: string;
  /** いるマス cx・cz と、向かっているマス tx・tz、向かう向き dir（上下左右の1つ。初めは [0, 0]） */
  cx: number;
  cz: number;
  tx: number;
  tz: number;
  dir: readonly [number, number];
  yaw: number;
  /** 進む向き（ラジアン。体は少しずつこちらへ回る） */
  dirYaw: number;
  wait: number;
  alert: number;
  /** 見たか（初めて見た時の伝言を出したか） */
  seen: boolean;
  visible: boolean;
  walk: number;
  moving: number;
  ph: number;
  form: Body;
  /** 光の尾・うなぎの波紋を出すまでの溜め */
  acc: number;
  glow: number;
  y: number;
  /** 群れの頭か、群れの頭（頭は null） */
  isLead?: boolean | undefined;
  leader: Mob | null;
  dead: boolean;
  aware: number;
  noticed: boolean;
  sleep: boolean;
  mark: number;
  surf: number;
  /** うなぎが次に水から出るまでの秒 */
  surfT: number;
  /** 飛ぶ生き物の速さと、飛ぶ高さ fy、次に向きを変えるまでの秒 flitT */
  vx: number;
  vz: number;
  vy: number;
  fy: number;
  flitT: number;
  rnd: () => number;
  /** 階で何体目か（here.mobSeq から。makeMonster が並び rnd を作った時だけ。渡された時は -1）。tick で、この生き物の動きと描画の見た目の乱数の鍵にする */
  seq: number;
  /** 次に近接の攻撃をするまでの秒（src/lib/monsters.ts の initMonsterLife が入れる） */
  atkCd?: number;
  /** 掃除機・修復機：している仕事（灰や火のマス、作り直す扉の番号。無ければ -1）・仕事をした秒・最後に仕事を探したゲームの時刻 */
  job?: number;
  work?: number;
  scanT?: number;
  /** 叫ぶ生き物が最後に叫んだゲームの時刻 */
  shriekT?: number;
  /** 魚：次に跳ねるまでの秒と、跳ねている途中（0 から 1。跳ねていなければ 0） */
  jumpT?: number;
  jump?: number;
  /** 猟犬の群れの頭：匂いを嗅ぎつけたか */
  tracked?: boolean;
  /** 剣を操る者：剣が回り始めた伝言を出したか */
  bladeMsg?: boolean;
  /** 状態異常（残りの秒など。死ぬと null） */
  st?: MonStatus | null;
}
/** 生き物の状態異常（燃える burn・冷える chill・毒 poison・痺れ shock・動けない pin の残りの秒、次に動けなくなれるゲームの時刻 pinCd、
 * 焦がしの加護が効いたか scorched、毒と燃えの傷の溜め pt・bt） */
export interface MonStatus {
  burn?: number;
  chill?: number;
  poison?: number;
  shock?: number;
  pin?: number;
  pinCd?: number;
  scorched?: boolean;
  pt?: number;
  bt?: number;
}
/** 今いる場所と、階の中身。深さ・支道・異界・特別な階、生き物、灯りの備品、階を移る途中、着いた所 */
export interface Here {
  /** 階の生き物（型は、TypeScript が読む欄だけ。ほかの欄は、生き物の処理を移す時に足す） */
  monsters: Mob[];
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
  /** 見たことのあるマス（階に入るたびに作り直す。src/lib/levels.ts の newLevel） */
  explored: Uint8Array;
  /** マスごとの覚えた色（マスの数×3） */
  mem: Float32Array;
  /** マスごとの、最後に見えた時の数え直しの番号（fovStamp と同じなら今見えている） */
  fovVis: Uint32Array;
  /** 見えるマスを数え直すたびに1増える番号 */
  fovStamp: number;
  /** 部屋の出来事（神託・転移・噴き出し・像・崩れ・水攻め・霊など。src/lib/levels.ts の initEvents が作り、src/lib/events.ts の updateEvents が進める） */
  events: RoomEvent[];
  /** 川のマスの一覧 */
  riverCells: number[];
  /** 最深部の状態（最深部の階に入った時に作る。ほかの階では null。src/lib/levels.ts の setupFinal） */
  finalSt: FinalState | null;
  /** その階で一度だけ出す伝言を出したか：巣に絡まった・巣が燃え落ちた・修復機が扉を直した・足元の硫黄が燃え上がった（src/lib/levels.ts の newLevel が階ごとに戻す） */
  webMsg: boolean;
  webBurnMsg: boolean;
  repairMsg: boolean;
  brimMsg: boolean;
  /** その階で作った生き物の数（src/lib/monsters.ts の makeMonster が、生き物ごとの見た目の乱数の鍵にする。src/lib/levels.ts の newLevel が階ごとに 0 に戻す） */
  mobSeq: number;
  /** 着いた時に立っていた階段や門のマス（離れるまで、踏んでも階を移らない。離れたら -1） */
  lockCell: number;
  /** その階で入った部屋（初めて入った時に部屋の伝言を出す）と、下り階段を見つけた伝言を出したか */
  visitedRooms: Set<number>;
  stairsSeen: boolean;
  /** 前の階の層（層が変わった時に、層の名前を出す） */
  lastStratum: Level['stratum'] | null;
}
/**
 * 部屋の出来事（src/lib/levels.ts の initEvents が作り、src/lib/events.ts の updateEvents が進める）。種類 type ごとの欄：
 * 目覚める像（statue）：像のマス cell・済んだか done・組み直している途中か active・経った秒 t・鐘を鳴らしたか chimed。
 * 崩れる床（collapse）：穴になるマス cells・部屋 ri・段階 state（0：待つ、1：揺れる、2：崩れた）・経った秒 t。
 * 神託（oracle）：巻物のマス cell・済んだか done。
 * 水攻めと溶岩（flood・lavaflow）：部屋 ri（罠から噴き出した水は -2）・広がる順 order・噴き出す所 src・段階 state・秒 t・広げた数 k・広げる数の上限 max。
 * 転移（tele）：対の陣 a・b と、着いたばかりで踏んでも飛ばない陣 lock（-1 は無し）。
 * 噴き出し（erupt）：火口 src・広がる順 order・段階 state（0：待つ、1：あふれる、2：とどまる、3：引く）・秒 t・広げた数 k。
 * 霊（haunt）：部屋 ri・墓のマス tombs・済んだか done・経った秒 t（入る前は -1）・鐘を鳴らしたか chimed
 */
export type RoomEvent =
  | { type: 'statue'; cell: number; done: boolean; active: boolean; t: number; chimed?: boolean }
  | { type: 'collapse'; cells: number[] | undefined; ri: number; state: number; t: number }
  | { type: 'oracle'; cell: number; done: boolean }
  | {
      type: 'flood' | 'lavaflow';
      ri: number;
      order: number[];
      src: number | undefined;
      state: number;
      t: number;
      k: number;
      /** 溶岩の流れ：同じマスを試し直した回数・試し直すマス・流せずに待っているマス（src/lib/events.ts の nextFlow） */
      tries?: Map<number, number>;
      retry?: number[];
      wait?: number[];
    }
  | { type: 'tele'; a: number; b: number; lock: number }
  | {
      type: 'erupt';
      src: number;
      order: number[];
      state: number;
      t: number;
      k: number;
      /** 溶岩の流れ：同じマスを試し直した回数・試し直すマス・流せずに待っているマス（src/lib/events.ts の nextFlow）と、この噴き上がりで流したマスの、流す前の液体と印 */
      tries?: Map<number, number>;
      retry?: number[];
      wait?: number[];
      poured?: Map<number, [number, number]>;
    }
  | { type: 'haunt'; ri: number; tombs: number[]; done: boolean; t: number; chimed?: boolean };
/** 最深部の状態：一番高い天井のマス c0（王の影が現れる所）、王の影 boss と、現れるまで・呼び出すまでの秒、着いた時の伝言を出したか */
export interface FinalState {
  c0: number;
  boss: Monster | null;
  bossT: number;
  summonT: number;
  said: boolean;
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
  finalSt: null,
  webMsg: false,
  webBurnMsg: false,
  repairMsg: false,
  brimMsg: false,
  mobSeq: 0,
  lockCell: -1,
  visitedRooms: new Set(),
  stairsSeen: false,
  lastStratum: null,
};
/** 行った階の覚え（場所の名前 → 見えた所と覚えた色の写し）。丸ごと入れ替えないので、古い JS は今までどおり placeMem で読む */
export const placeMem = new Map<string, { explored: Uint8Array; mem: Float32Array }>();

/** 伝説の物（名前・言い伝え・ある支道 branch・種類 kind） */
export interface LegendItem {
  name: string;
  lore: string;
  branch: string | undefined;
  kind: string;
}
/** 今の探索の伝説の物（シード・物の種類 → 物・手にした物）。src/lib/legend.ts の getLegend が、はじめて読んだ時に作る */
export interface Legend {
  seed: number;
  /** 物の種類（LEGEND_ORDER の candle・bell・mirror）→ 物 */
  items: Record<string, LegendItem>;
  have: Set<string>;
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
 * 部品は、タイトルを出した時に先に作り（src/lib/audio.ts の sndPrep）、最初に音を鳴らす時（sndInit）にここへ入れる */
export interface SoundState {
  /** 音量の段（src/lib/sound.ts の SND_LV の番号） */
  lv: number;
  ctx: AudioContext | null;
  on: boolean;
  master: GainNode | null;
  inp: GainNode | null;
  wet: GainNode | null;
  noise: AudioBuffer | null;
  /** 鳴り続ける音（地鳴り・水・火・風・低い音）。src/lib/audio.ts の sndPrep か sndInit が作る */
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
  /** 生き物に見られているか（src/lib/status.ts の updateStealth が入れる。それまでは無い） */
  seen?: boolean;
}
export const stealth: Stealth = { lum: 0, level: 1, range: 8, sneak: false, hudKey: '' };
/** 手元の灯り（届く距離 r・強さ k）。丸ごと入れ替えない */
export const lantern = { r: 8.2, k: 1 };
/**
 * 状態の表示の数（見たマスの割合 explored と、速さの表示：描いた文字の数 glyphCount・描いた区切りの文字の数 chunksDrawn・
 * 1秒あたりのフレームの数 pfFps と、それを数える途中のフレームの数 pfFrames と秒 pfT）。丸ごと入れ替えない
 */
export const hudInfo = { explored: 0, glyphCount: 0, chunksDrawn: 0, pfFrames: 0, pfT: 0, pfFps: 0 };
/** 描く物の数：このフレームに置いた文字の数 dn（src/lib/particles.ts の dyn）と、生きている粒子の数 pN（spawn・killP） */
export interface Buf {
  dn: number;
  pN: number;
}
export const buf: Buf = { dn: 0, pN: 0 };
/** three.js のカメラのうち、TypeScript が使う欄だけ（本物は 05-renderer.js が作る PerspectiveCamera。位置と向きは src/lib/player.ts が set で書く） */
export interface CameraView {
  readonly position: { readonly x: number; readonly y: number; readonly z: number; set(x: number, y: number, z: number): unknown };
  readonly rotation: { set(x: number, y: number, z: number): unknown };
}
/** three.js の、マスの火・灰・変わり方を描画に渡す絵（DataTexture）のうち、TypeScript が書く欄だけ（本物は 05-renderer.js が作る。中身は cellData） */
export interface CellTex {
  needsUpdate: boolean;
}
/** 描画の部品（three.js の物）と描き方の切り替え：カメラ camera とマスの絵 cellTex（本当の値は 05-renderer.js がその場で入れる。ここの値は仮）と、
 * 生き物の体だけを描くか drawBodyOnly（まわりの飾り・強い個体の輪・頭の上の印を描かない。__test.monsterView だけが入れる） */
export interface Gfx {
  camera: CameraView;
  cellTex: CellTex;
  drawBodyOnly: boolean;
  /** ここから下は、05-renderer.js・30-loop-init.js・06-world.js がその場で入れる three.js の物（入れるまでは null・undefined か空）。
   * 描画する部品（WebGL を使えない時は作れず、ゲームは始まらない） */
  renderer: WebGLRenderer | undefined;
  /** 描く物を入れる場面（05-renderer.js が作る。three.js は物を作る時に Math.random を引くので、テスト用モードの乱数の入れ替えの後に作る） */
  scene: Scene | null;
  /** 描画の全部の部品が分け合う値（シェーダーの uniform） */
  U: Uniforms | null;
  /** 階の文字の部品（30-loop-init.js の init が作る）と、壁の向こうを隠す板の部品 */
  staticMat: ShaderMaterial | undefined;
  occMat: ShaderMaterial | undefined;
  /** 画面の最後の後処理（露出・熱のゆらぎ・水中・傷の赤み・詠唱の間の色） */
  finalPass: ShaderPass | null;
  /** 階の文字を区切りごとにまとめた物（区切りの文字の数 count と、区切りを包む球 sphere。球で、見えない区切りを描かない）と、壁の向こうを隠す板（src/lib/build.ts の buildWorld が作る） */
  chunks: { mesh: Mesh; count: number; sphere: Sphere }[];
  occMesh: Mesh | null;
  /** 水面の絵（マスごとの水の深さ・流れ・湖か・藻と、灯りの番号と重み。06-world.js の makeWater が作り、src/lib/build.ts の updateWater が書く） */
  waterTex: DataTexture | null;
  waterLTex: DataTexture | null;
  /** その階の霧の濃さの基 */
  fogBase: number;
}
/** 描画の部品が分け合う値（シェーダーの uniform。05-renderer.js が作る） */
export interface Uniforms {
  uCell: { value: unknown };
  uCollT: { value: number };
  uAtlas: { value: Texture | null };
  uTime: { value: number };
  uSL: { value: Float32Array };
  uDLP: { value: Float32Array };
  uDLC: { value: Float32Array };
  uCamP: { value: Vector3 };
  uCutP: { value: Vector3 };
  uCut: { value: number };
  uFogDen: { value: number };
  uFogColor: { value: Vector3 };
  uScale: { value: number };
  uRamp: { value: Float32Array };
  uAmb: { value: number };
}
export const gfx: Gfx = {
  camera: { position: { x: 0, y: 0, z: 0, set: () => undefined }, rotation: { set: () => undefined } },
  cellTex: { needsUpdate: false },
  drawBodyOnly: false,
  renderer: undefined,
  scene: null,
  U: null,
  staticMat: undefined,
  occMat: undefined,
  finalPass: null,
  chunks: [],
  occMesh: null,
  waterTex: null,
  waterLTex: null,
  fogBase: 0.05,
};
/** マスの絵 gfx.cellTex の中身（マス1つに4つ：火の明かり・火の強さ・灰か・変わり方の種類。src/lib/ground.ts の uploadCells が書く）。丸ごと入れ替えない */
export const cellData = new Uint8Array(NCELL * 4);
/** 薄い氷のマスに乗っていた秒（マス → 秒。src/lib/ground.ts の crackIce。src/lib/levels.ts の newLevel が階ごとに空にする）。丸ごと入れ替えない */
export const iceT = new Map<number, number>();
/** 灯りを描画に渡す配列（src/lib/lightmap.ts の updateLights が毎フレーム書き、05-renderer.js の U が描画に渡す）。丸ごと入れ替えない。
 * SL：階の灯りの色と強さ（灯り1つに3つ）、DLP：動く灯りの位置と届く距離（1つに4つ。0番は手元の灯り、最後は稲妻か火花）、DLC：動く灯りの色（1つに3つ） */
export const SL = new Float32Array(NSL * 3),
  DLP = new Float32Array(NDL * 4),
  DLC = new Float32Array(NDL * 3);
/** 押しているキー（キーの code → 押しているか）。丸ごと入れ替えない */
export const keys: { KeyW?: boolean; KeyA?: boolean; KeyS?: boolean; KeyD?: boolean; [code: string]: boolean | undefined } = {};
/** 手元の武器が跳ねたゲームの時刻（術を放った時。19-hands-runes.js の drawViewWeapons が読む）。丸ごと入れ替えない */
export const vmKick = { L: -9, R: -9 };
/** 光線を撃ち続けている間の、手ごとの記録（続けた秒 hold・最後に撃った時刻 last）。丸ごと入れ替えない */
export const beamHold = { L: { hold: 0, last: -9 }, R: { hold: 0, last: -9 } };
/** 漂う塵の粒（位置 x・y・z、揺れの位相 ph、文字 g、大きさ s。src/lib/particles.ts の initDust・respawnDust が置き、15-sound-fire.js が動かす）。丸ごと入れ替えない */
export const dust = {
  x: new Float32Array(DUST_N),
  y: new Float32Array(DUST_N),
  z: new Float32Array(DUST_N),
  ph: new Float32Array(DUST_N),
  g: new Float32Array(DUST_N),
  s: new Float32Array(DUST_N),
};
/** 通れない所に押し当てている間の記録（押した秒 t・何に当たっているか k・離してからの秒 idle）。丸ごと入れ替えない */
export const edge = { t: 0, k: '', idle: 0 };
