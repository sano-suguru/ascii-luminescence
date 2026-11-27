// 倒れた生き物が崩れる：体の文字が上から順に外れて落ち、床に寝て小山に積もり、しばらくして1つずつ縮んで消える。
// 倒れた時（src/lib/combat.ts の damageMonster）に crumble が、その時の体を写し取って「崩れる体」を1つ足し、tick の段 debris（src/lib/loop.ts）で updateDebris が動かして描く。
// 写し取る時と、文字ごとのばらつきは、その生き物の鍵の乱数（keyedRand('fall'…)）で決め、動かす間は乱数を引かない。なので、倒した段のほかの物も、ほかの段もずれない。
// 描くのは体と同じ dyn の文字（足さない描き方で、にじみが無い）。何枚重なっても白くならない。
import { must, nth } from './array.ts';
import { drawMonster0, drawTentacles, krakenArms } from './bodies/draw.ts';
import type { Body } from './bodies/kit.ts';
import { levelSeed } from './levels.ts';
import { cellLight, litScale } from './lightmap.ts';
import { dCol, dPar, dPos, dyn } from './particles.ts';
import { DYN_MAX } from './shaders.ts';
import { keyedRand, withVisualRand } from './random.ts';
import { type Mob, buf, clock, fight, gfx, here, player } from './state.ts';
import { CELL, LQ_BOG, LQ_DEEP, LQ_LAVA, LQ_WATER, MH, MW, TC, TP, TW, TX } from './world.ts';

/** 文字の様子：体に付いたまま・落ちている・床に積もった・塵になって縮む・水に沈む・溶岩で燃える・消えた */
const ON = 0,
  FALL = 1,
  REST = 2,
  PUFF = 3,
  SINK = 4,
  BURN = 5,
  GONE = 6;
/** 崩れる体（文字ごとの値は配列。n は文字の数、t は倒れてからの秒、life は積もった文字が消え始める基の秒、hurry は数が多すぎて早く消す時の秒） */
export interface Debris {
  n: number;
  t: number;
  life: number;
  hurry: number;
  ember: boolean;
  x0: number;
  z0: number;
  /** 残す文字の数（数の上限を数えるため） */
  kept: number;
  /** 消えていない文字の数 */
  alive: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  g: Float32Array;
  s: Float32Array;
  r: Float32Array;
  gc: Float32Array;
  b: Float32Array;
  /** 外れる秒・様子が変わった秒・寝た向き・回る速さ・傾き・消え始めのばらつき（0 から 1） */
  t0: Float32Array;
  tl: Float32Array;
  yaw: Float32Array;
  spin: Float32Array;
  tilt: Float32Array;
  u: Float32Array;
  st: Uint8Array;
  keep: Uint8Array;
  bounced: Uint8Array;
  /** 積もった高さ（0.25 ごとの格子） */
  hm: Map<number, number>;
}

/** 崩れる体の数と、積もって残る文字の数の上限（越えたら古い物から早く消す） */
export const DEBRIS_MAX = 12,
  DEBRIS_KEEP = 3000;
/** 上から下まで外れるのにかかる秒・重さ・積もった文字が縮んで消える秒・明るすぎる文字（目・心臓の光など）とみなす一番低い値 */
const CRUMBLE = 0.5,
  GRAV = 12,
  SHRINK = 0.6,
  GLOW = 1.1,
  /** 積もった文字の大きさ（寝かせると細く見えるので、体の時より少し大きく） */
  REST_K = 1.2,
  /** 積もった小山の一番高い所 */
  PILE_MAX = 0.6;
/** 火で倒れた時の、熱い色と冷めた色 */
const EMBER_HOT = [1.0, 0.42, 0.12],
  EMBER_COLD = [0.3, 0.12, 0.07];

/** 1体に残す文字の数（試しの間の的は少なく、主と大きな物は多く） */
const keepOf = (m: Mob): number => (m.ty.dummy ? 40 : m.ty.boss || m.ty.lord || m.ty.scale >= 2 ? 250 : 120);
/** 積もった文字が消え始める基の秒 */
const lifeOf = (m: Mob): number => (m.ty.dummy ? 3 : m.ty.boss || m.ty.lord ? 20 : 10);

/**
 * 今の体の文字を写し取る（体だけを描く処理（触手とクラーケンの腕も、生きている時の描き方 drawMonster1 と同じに選ぶ）を、その生き物の鍵の乱数で呼び、置いた文字を読んで、置いた数を戻す）。
 * このフレームに置いた文字で置ける数（DYN_MAX）が足りず、体が途中で切れた時は、置いた文字を取っておいて、初めから置き直して写し、元に戻す
 */
function snapBody(m: Mob): { pos: number[]; col: number[]; gs: number[] } {
  const d0 = buf.dn,
    p0 = buf.pN,
    pos: number[] = [],
    col: number[] = [],
    gs: number[] = [];
  const mm: Mob & { form: Body } = { ...m, form: m.form || [] };
  const draw = (from: number): void => {
    buf.dn = from;
    withVisualRand(keyedRand('fall look', levelSeed(), m.seq), () => {
      if (m.ty.habitat === 'deep') (m.ty.form === 'kraken' ? krakenArms : drawTentacles)(mm, clock.time);
      drawMonster0(mm, clock.time);
    });
    pos.length = col.length = gs.length = 0;
    for (let k = from; k < buf.dn; k++) {
      pos.push(nth(dPos, k * 3), nth(dPos, k * 3 + 1), nth(dPos, k * 3 + 2));
      col.push(nth(dCol, k * 3), nth(dCol, k * 3 + 1), nth(dCol, k * 3 + 2));
      gs.push(nth(dPar, k * 4), nth(dPar, k * 4 + 1));
    }
  };
  const keep = { pos: dPos.slice(0, 0), col: dCol.slice(0, 0), par: dPar.slice(0, 0) };
  try {
    gfx.drawBodyOnly = true;
    draw(d0);
    if (buf.dn >= DYN_MAX && d0 > 0) {
      keep.pos = dPos.slice(0, d0 * 3);
      keep.col = dCol.slice(0, d0 * 3);
      keep.par = dPar.slice(0, d0 * 4);
      draw(0);
    }
  } finally {
    gfx.drawBodyOnly = false;
    if (keep.pos.length) {
      dPos.set(keep.pos);
      dCol.set(keep.col);
      dPar.set(keep.par);
    }
    buf.dn = d0;
    buf.pN = p0;
  }
  return { pos, col, gs };
}

/** 倒れた生き物の体を写し取り、崩れる体を足す（how が 'fire' なら残り火の色）。見た目の乱数 mr() は引かない */
export function crumble(m: Mob, how?: string): void {
  const { pos, col, gs } = snapBody(m);
  const n = pos.length / 3;
  if (!n) return;
  const rnd = keyedRand('fall', levelSeed(), m.seq);
  const F = (): Float32Array => new Float32Array(n);
  const d: Debris = {
    n,
    t: 0,
    life: lifeOf(m),
    hurry: Infinity,
    ember: how === 'fire',
    x0: m.x,
    z0: m.z,
    kept: 0,
    alive: n,
    x: F(),
    y: F(),
    z: F(),
    vx: F(),
    vy: F(),
    vz: F(),
    g: F(),
    s: F(),
    r: F(),
    gc: F(),
    b: F(),
    t0: F(),
    tl: F(),
    yaw: F(),
    spin: F(),
    tilt: F(),
    u: F(),
    st: new Uint8Array(n),
    keep: new Uint8Array(n),
    bounced: new Uint8Array(n),
    hm: new Map(),
  };
  let y0 = Infinity,
    y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const y = nth(pos, i * 3 + 1);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const K = keepOf(m),
    pk = Math.min(1, K / n);
  // 明るすぎる文字（目・心臓などの光）：体の明るさの真ん中の2倍より明るく、GLOW も越える物。明るく描く生き物でも、体の大半は光に数えない
  const lum: number[] = [];
  for (let i = 0; i < n; i++) lum.push(Math.max(nth(col, i * 3), nth(col, i * 3 + 1), nth(col, i * 3 + 2)));
  const glowAt = Math.max(
    GLOW,
    2 *
      nth(
        [...lum].sort((a, b) => a - b),
        n >> 1,
      ),
  );
  for (let i = 0; i < n; i++) {
    const x = nth(pos, i * 3),
      y = nth(pos, i * 3 + 1),
      z = nth(pos, i * 3 + 2);
    d.x[i] = x;
    d.y[i] = y;
    d.z[i] = z;
    d.r[i] = nth(col, i * 3);
    d.gc[i] = nth(col, i * 3 + 1);
    d.b[i] = nth(col, i * 3 + 2);
    d.g[i] = nth(gs, i * 2);
    d.s[i] = nth(gs, i * 2 + 1);
    const hn = y1 > y0 ? (y - y0) / (y1 - y0) : 1;
    // 明るすぎる文字は落とさず、すぐ消す
    const glow = nth(lum, i) > glowAt;
    d.t0[i] = (1 - hn) * CRUMBLE + rnd() * 0.08;
    let ox = x - m.x,
      oz = z - m.z;
    const ol = Math.hypot(ox, oz);
    const a = rnd() * Math.PI * 2;
    if (ol > 1e-3) {
      ox /= ol;
      oz /= ol;
    } else {
      ox = Math.cos(a);
      oz = Math.sin(a);
    }
    const sp = 0.1 + rnd() * 0.25;
    d.vx[i] = ox * sp + Math.cos(a) * 0.1;
    d.vz[i] = oz * sp + Math.sin(a) * 0.1;
    d.vy[i] = 0.1 + rnd() * 0.4;
    d.yaw[i] = rnd() * Math.PI * 2;
    d.spin[i] = (rnd() - 0.5) * 14;
    d.tilt[i] = 0.35 + rnd() * 0.35;
    d.u[i] = rnd();
    const keep = !glow && d.kept < K && rnd() < pk;
    d.keep[i] = keep ? 1 : 0;
    if (keep) d.kept++;
    if (glow) {
      d.st[i] = PUFF;
      d.tl[i] = 0;
    }
  }
  fight.debris.push(d);
  // 多すぎる時は、古い物から早く消す
  let total = 0,
    live = 0;
  for (const e of fight.debris)
    if (e.hurry === Infinity) {
      total += e.kept;
      live++;
    }
  for (const e of fight.debris) {
    if (live <= DEBRIS_MAX && total <= DEBRIS_KEEP) break;
    if (e === d || e.hurry !== Infinity) continue;
    e.hurry = e.t;
    total -= e.kept;
    live--;
  }
}

/** マスの床の種類：通れない（壁・柱・水晶）・底の無い穴・水・溶岩・床 */
function ground(x: number, z: number): 'solid' | 'chasm' | 'water' | 'lava' | 'floor' {
  const cx = Math.floor(x / CELL),
    cz = Math.floor(z / CELL);
  if (cx < 0 || cz < 0 || cx >= MW || cz >= MH) return 'solid';
  const D = must(here.D, '今の階 here.D'),
    i = cz * MW + cx,
    tt = D.tile[i];
  if (tt === TW || tt === TP || tt === TX) return 'solid';
  if (tt === TC && !(D.pit && D.pit[i])) return 'chasm';
  const lq = D.liquid[i];
  if (lq === LQ_LAVA) return 'lava';
  if (lq === LQ_WATER || lq === LQ_DEEP || lq === LQ_BOG) return 'water';
  return 'floor';
}

/** 積もった高さの格子の番号 */
const hkey = (x: number, z: number): number => Math.floor(x * 4) * 65536 + Math.floor(z * 4);

/** 崩れる体を動かして描く（tick の段 debris。dt はゲームの時間の秒。乱数は引かない） */
export function updateDebris(dt: number): void {
  if (!fight.debris.length) return;
  for (const d of fight.debris) stepOne(d, dt);
  if (fight.debris.some((d) => d.alive <= 0)) fight.debris = fight.debris.filter((d) => d.alive > 0);
}

function stepOne(d: Debris, dt: number): void {
  d.t += dt;
  const t = d.t,
    far = Math.hypot(d.x0 - player.x, d.z0 - player.z) > 44;
  // 足すまわりの明かりは、体と同じく強い所で頭打ちにする（src/lib/lightmap.ts の LIT_MAX）
  const lit = cellLight(d.x0, d.z0),
    lk = 0.12 * litScale(lit),
    l0 = lit[0] * lk,
    l1 = lit[1] * lk,
    l2 = lit[2] * lk;
  for (let i = 0; i < d.n; i++) {
    let st = nth(d.st, i);
    if (st === GONE) continue;
    const s = nth(d.s, i);
    if (st === ON && t >= nth(d.t0, i)) {
      // 壁の中にある文字（壁に掛かっていた翼や腕）は、出られないので落とさず、塵にする
      st = ground(nth(d.x, i), nth(d.z, i)) === 'solid' ? PUFF : FALL;
      d.st[i] = st;
      d.tl[i] = t;
    }
    if (st === FALL) {
      d.vy[i] = nth(d.vy, i) - GRAV * dt;
      const nx = nth(d.x, i) + nth(d.vx, i) * dt,
        nz = nth(d.z, i) + nth(d.vz, i) * dt;
      if (ground(nx, nz) === 'solid') {
        d.vx[i] = 0;
        d.vz[i] = 0;
      } else {
        d.x[i] = nx;
        d.z[i] = nz;
      }
      d.y[i] = nth(d.y, i) + nth(d.vy, i) * dt;
      d.yaw[i] = nth(d.yaw, i) + nth(d.spin, i) * dt;
      const x = nth(d.x, i),
        z = nth(d.z, i),
        gk = ground(x, z);
      if (gk === 'chasm') {
        if (nth(d.y, i) < -4) st = GONE;
      } else {
        // 積もる文字は、まわりの格子のうち一番低い所に着く（砂の山のように、なだらかな小山になる）
        let key = hkey(x, z),
          top = 0;
        if (d.keep[i]) {
          const kx = Math.floor(x * 4),
            kz = Math.floor(z * 4);
          top = d.hm.get(key) ?? 0;
          for (let dz = -1; dz <= 1; dz++)
            for (let dx = -1; dx <= 1; dx++) {
              const k2 = (kx + dx) * 65536 + kz + dz,
                h = d.hm.get(k2) ?? 0;
              if (h < top - 1e-6 && ground((kx + dx + 0.5) / 4, (kz + dz + 0.5) / 4) === 'floor') {
                top = h;
                key = k2;
              }
            }
        }
        if (nth(d.y, i) <= top + s * 0.3) {
          if (gk === 'water') st = SINK;
          else if (gk === 'lava') st = BURN;
          else if (!d.bounced[i] && nth(d.vy, i) < -1) {
            d.bounced[i] = 1;
            d.vy[i] = -nth(d.vy, i) * 0.25;
            d.vx[i] = nth(d.vx, i) * 0.3;
            d.vz[i] = nth(d.vz, i) * 0.3;
            d.y[i] = Math.max(nth(d.y, i), top + s * 0.3);
          } else if (d.keep[i]) {
            st = REST;
            // 選んだ格子へ移す（格子の中の位置はそのまま）
            const kx = Math.floor(key / 65536),
              kz = key - kx * 65536;
            d.x[i] = (kx + (x * 4 - Math.floor(x * 4))) / 4;
            d.z[i] = (kz + (z * 4 - Math.floor(z * 4))) / 4;
            d.y[i] = top + 0.02 + s * REST_K * 0.5 * Math.sin(nth(d.tilt, i));
            d.hm.set(key, Math.min(PILE_MAX, top + s * 0.7));
          } else st = PUFF;
          if (st !== FALL) d.tl[i] = t;
        }
      }
      if (st !== FALL) d.st[i] = st;
    }
    // 今の様子になってからの秒
    const age = t - nth(d.tl, i);
    let k = 1,
      size = s,
      mode = 0,
      yaw = 0,
      r = nth(d.r, i),
      g = nth(d.gc, i),
      b = nth(d.b, i);
    if (d.ember && st !== ON) {
      const c = st === REST ? Math.min(1, age / 1.5) : 0;
      r = nth(EMBER_HOT, 0) + (nth(EMBER_COLD, 0) - nth(EMBER_HOT, 0)) * c;
      g = nth(EMBER_HOT, 1) + (nth(EMBER_COLD, 1) - nth(EMBER_HOT, 1)) * c;
      b = nth(EMBER_HOT, 2) + (nth(EMBER_COLD, 2) - nth(EMBER_HOT, 2)) * c;
      r *= 0.85;
      g *= 0.85;
      b *= 0.85;
    }
    switch (st) {
      case ON:
        k = 1 + 0.25 * Math.max(0, 1 - t / 0.15);
        break;
      case FALL:
        mode = 2;
        yaw = nth(d.yaw, i);
        break;
      case REST: {
        // 消え始める秒（数が多すぎる時は早める）
        const dieAt = Math.min(d.life * (0.6 + 0.3 * nth(d.u, i)), d.hurry + 0.8 * nth(d.u, i));
        size = s * REST_K;
        if (t >= dieAt) size *= 1 - (t - dieAt) / SHRINK;
        if (size <= 0) st = GONE;
        if (!d.ember) {
          const c = Math.min(1, age / 1.5),
            gray = (r + g + b) / 3,
            dim = 1 - 0.45 * c;
          r = (r + (gray - r) * 0.35 * c) * dim;
          g = (g + (gray - g) * 0.35 * c) * dim;
          b = (b + (gray - b) * 0.35 * c) * dim;
        }
        r += l0;
        g += l1;
        b += l2;
        mode = 1 + nth(d.tilt, i);
        yaw = nth(d.yaw, i);
        break;
      }
      case PUFF:
        size = s * (1 - age / 0.3);
        if (size <= 0) st = GONE;
        break;
      case SINK:
        d.y[i] = nth(d.y, i) - 0.25 * dt;
        k = 1 - age / 0.8;
        if (k <= 0) st = GONE;
        break;
      case BURN: {
        const p = age / 0.35;
        r = 1.4;
        g = 0.6;
        b = 0.15;
        k = 1 - p;
        size = s * (1 - p * 0.6);
        if (p >= 1) st = GONE;
        break;
      }
    }
    if (st === GONE) {
      d.st[i] = GONE;
      d.alive--;
      continue;
    }
    if (!far) dyn(nth(d.x, i), nth(d.y, i), nth(d.z, i), nth(d.g, i), size, r * k, g * k, b * k, mode, yaw);
  }
}

/** テスト用（__test.debris）：崩れる体ごとの、文字の数・残す数・消えていない数・様子ごとの数と、積もった文字の高さの範囲と、倒れた所からの一番遠い距離 */
export function debrisInfo(): {
  n: number;
  kept: number;
  alive: number;
  st: number[];
  rest: { y0: number; y1: number; far: number } | null;
  top: number;
}[] {
  return fight.debris.map((d) => {
    const st = [0, 0, 0, 0, 0, 0, 0];
    let y0 = Infinity,
      y1 = -Infinity,
      far = 0,
      top = -Infinity;
    for (let i = 0; i < d.n; i++) {
      const s = nth(d.st, i);
      st[s] = nth(st, s) + 1;
      if (s !== GONE) top = Math.max(top, nth(d.y, i));
      if (s !== REST) continue;
      y0 = Math.min(y0, nth(d.y, i));
      y1 = Math.max(y1, nth(d.y, i));
      far = Math.max(far, Math.hypot(nth(d.x, i) - d.x0, nth(d.z, i) - d.z0));
    }
    return { n: d.n, kept: d.kept, alive: d.alive, st, rest: nth(st, REST) ? { y0, y1, far } : null, top };
  });
}
