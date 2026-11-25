// 粒子と、世界の中に置く文字（もとは src/game/05-renderer.js）。どちらも、決まった大きさの配列に値を書いて、数を増やすだけ。
// 配列を GPU に渡す部品（three.js の属性）と、毎フレームの数の受け渡し（flushDyn）・粒子を動かす処理は、古い JS（05・15）にある。
// 数は状態の入れ物 buf（dn・pN）。
import { mr } from './random.ts';
import { DYN_MAX, P_MAX } from './shaders.ts';
import { buf } from './state.ts';

/** 世界の中に置く文字（毎フレーム置き直す）：位置 dPos・色 dCol・文字と大きさと描き方と向き dPar */
export const dPos = new Float32Array(DYN_MAX * 3),
  dCol = new Float32Array(DYN_MAX * 3),
  dPar = new Float32Array(DYN_MAX * 4);

/** 文字を1つ置く（g は文字の絵の表の番号、mode は描き方、yaw は向き。数が DYN_MAX に達していれば置かない） */
export function dyn(
  x: number,
  y: number,
  z: number,
  g: number,
  size: number,
  r: number,
  gg: number,
  b: number,
  mode?: number,
  yaw?: number,
): void {
  if (buf.dn >= DYN_MAX) return;
  const i3 = buf.dn * 3,
    i4 = buf.dn * 4;
  dPos[i3] = x;
  dPos[i3 + 1] = y;
  dPos[i3 + 2] = z;
  dCol[i3] = r;
  dCol[i3 + 1] = gg;
  dCol[i3 + 2] = b;
  dPar[i4] = g;
  dPar[i4 + 1] = size;
  dPar[i4 + 2] = mode || 0;
  dPar[i4 + 3] = yaw || 0;
  buf.dn++;
}

/** 粒子（位置・速さ・経った秒 age・続く秒 life・色・文字 gl・大きさ sz・動き方 ty・揺れの位相 ph）。番号 0 から buf.pN 未満が生きている */
export const P = {
  x: new Float32Array(P_MAX),
  y: new Float32Array(P_MAX),
  z: new Float32Array(P_MAX),
  vx: new Float32Array(P_MAX),
  vy: new Float32Array(P_MAX),
  vz: new Float32Array(P_MAX),
  age: new Float32Array(P_MAX),
  life: new Float32Array(P_MAX),
  r: new Float32Array(P_MAX),
  g: new Float32Array(P_MAX),
  b: new Float32Array(P_MAX),
  gl: new Float32Array(P_MAX),
  sz: new Float32Array(P_MAX),
  ty: new Uint8Array(P_MAX),
  ph: new Float32Array(P_MAX),
};
/** 粒子の全部の配列（消す時に、最後の粒子を詰めるため） */
export const PF: (Float32Array | Uint8Array)[] = Object.values(P);

/** 粒子を1つ出す（数が P_MAX に達していれば出さない）。揺れの位相は見た目の乱数 */
export function spawn(
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  life: number,
  gl: number,
  sz: number,
  r: number,
  g: number,
  b: number,
  ty: number,
): void {
  if (buf.pN >= P_MAX) return;
  const i = buf.pN++;
  P.x[i] = x;
  P.y[i] = y;
  P.z[i] = z;
  P.vx[i] = vx;
  P.vy[i] = vy;
  P.vz[i] = vz;
  P.age[i] = 0;
  P.life[i] = life;
  P.gl[i] = gl;
  P.sz[i] = sz;
  P.r[i] = r;
  P.g[i] = g;
  P.b[i] = b;
  P.ty[i] = ty;
  P.ph[i] = mr() * 100;
}

/** i 番目の粒子を消す（最後の粒子をそこに詰める） */
export function killP(i: number): void {
  const j = --buf.pN;
  if (i !== j) for (const a of PF) a[i] = a[j] ?? NaN;
}
