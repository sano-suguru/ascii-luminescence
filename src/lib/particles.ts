// 粒子と、世界の中に置く文字（もとは src/game/05-renderer.js）。どちらも、決まった大きさの配列に値を書いて、数を増やすだけ。
// 配列を GPU に渡す部品（three.js の属性）と、毎フレームの数の受け渡し（flushDyn）・粒子を動かす処理は、古い JS（05・15）にある。
// 数は状態の入れ物 buf（dn・pN）。漂う塵の粒を置く処理（initDust・respawnDust。もとは 15-sound-fire.js）もここ（塵の配列 dust は src/lib/state.ts）。
import { must, nth } from './array.ts';
import { G } from './glyphs.ts';
import { mpick, mr } from './random.ts';
import { DUST_N, DYN_MAX, P_MAX } from './shaders.ts';
import { buf, dust, here, player } from './state.ts';
import { CELL, CH_D, MH, MW, TC, TF } from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

/** 世界の中に置く文字（毎フレーム置き直す）：位置 dPos・色 dCol・文字と大きさと描き方と向き dPar */
export const dPos = new Float32Array(DYN_MAX * 3),
  dCol = new Float32Array(DYN_MAX * 3),
  dPar = new Float32Array(DYN_MAX * 4);

/**
 * 文字を1つ置く（g は文字の絵の表の番号、yaw は向き。数が DYN_MAX に達していれば置かない）。
 * mode は描き方：0 はこちらを向く、1 から 1.5 未満は床に寝かせる（1 を越えた分は、文字の上を起こす角度のラジアン）、それより上は立てる
 */
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
/** 塵の粒 i を、プレイヤーのまわりの床の上（near なら近く、ほかは 10 から 15 先）に置き直す。置ける所が無ければ見えない所へ（もとは src/game/15-sound-fire.js） */
export function respawnDust(i: number, near: boolean): void {
  for (let tries = 0; tries < 8; tries++) {
    const a = mr() * Math.PI * 2,
      r = near ? Math.sqrt(mr()) * 15 : 10 + mr() * 5;
    const x = player.x + Math.cos(a) * r,
      z = player.z + Math.sin(a) * r,
      cx = Math.floor(x / CELL),
      cz = Math.floor(z / CELL);
    if (cx < 0 || cz < 0 || cx >= MW || cz >= MH) continue;
    const ci = cz * MW + cx,
      tt = level().tile[ci];
    if (tt !== TF && tt !== TC) continue;
    const lo = tt === TC ? -CH_D + 1 : 0.15,
      hi = Math.min(nth(level().ceil, ci) - 0.2, 8);
    dust.x[i] = x;
    dust.z[i] = z;
    dust.y[i] = lo + mr() * (hi - lo);
    return;
  }
  dust.x[i] = player.x;
  dust.z[i] = player.z;
  dust.y[i] = -50;
}
/** 塵の粒を全部置き直す（層の降る物で文字を変える：雪・灰・ふつうの塵。もとは src/game/15-sound-fire.js） */
export function initDust(): void {
  const fl = level().stratum.fall;
  for (let i = 0; i < DUST_N; i++) {
    dust.ph[i] = mr() * 100;
    dust.g[i] = G(
      mpick(fl === 'snow' ? ['*', '.', '+', '*'] : fl === 'ash' ? [',', '.', '`', "'"] : ['.', '.', '.', '+', '*', "'", ':', '`']),
    );
    dust.s[i] = 0.1 + mr() * 0.11;
    respawnDust(i, true);
  }
}
