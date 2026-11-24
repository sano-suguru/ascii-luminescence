// 灯りの計算（もとは src/game/02-constants.js の light helpers）。
import { nth } from './array.ts';
import { CELL, MH, MW, NCELL, TP, TW } from './world.ts';

/** 灯り（位置と届く半径。vis はその灯りから見えるマス） */
export interface Light {
  x: number;
  y: number;
  z: number;
  rad: number;
  vis: ArrayLike<number>;
}
/** topLights が読む灯り。迷宮の生成の灯りは、作ったばかりだと vis がまだ null（ref を使って選ぶ時は、入っていること） */
export type LitLight = Omit<Light, 'vis'> & { vis: ArrayLike<number> | null };

/** 灯りから見えるマス（壁と柱で遮る）。tile はマスごとのタイルの種類 */
export function computeVis(L: Pick<Light, 'x' | 'z' | 'rad'>, tile: ArrayLike<number>): Uint8Array {
  const vis = new Uint8Array(NCELL);
  const lcx = Math.floor(L.x / CELL),
    lcz = Math.floor(L.z / CELL),
    r = Math.ceil(L.rad / CELL) + 1;
  for (let dz = -r; dz <= r; dz++)
    for (let dx = -r; dx <= r; dx++) {
      const cx = lcx + dx,
        cz = lcz + dz;
      if (cx < 0 || cz < 0 || cx >= MW || cz >= MH) continue;
      const tx = (cx + 0.5) * CELL,
        tz = (cz + 0.5) * CELL,
        ddx = tx - L.x,
        ddz = tz - L.z,
        dist = Math.hypot(ddx, ddz);
      if (dist > L.rad + CELL) continue;
      const steps = Math.max(1, Math.ceil(dist / 0.3));
      let ok = true;
      for (let s = 1; s < steps; s++) {
        const f = s / steps,
          sx = L.x + ddx * f,
          sz = L.z + ddz * f,
          ccx = Math.floor(sx / CELL),
          ccz = Math.floor(sz / CELL);
        if (ccx === cx && ccz === cz) break;
        const tt = tile[ccz * MW + ccx];
        if (tt === TW) {
          ok = false;
          break;
        }
        if (tt === TP && Math.hypot(sx - (ccx + 0.5) * CELL, sz - (ccz + 0.5) * CELL) < 0.5) {
          ok = false;
          break;
        }
      }
      if (ok) vis[cz * MW + cx] = 1;
    }
  return vis;
}

/**
 * 点 (x, y, z) を照らす強い灯りを3つまで選び、番号を outI に、重みを outW に、o 番目から書く。
 * nx が null でなければ、面の向き (nx, ny, nz) で重みを変える。ref が 0 以上なら、そのマスが見える灯りだけ
 */
export function topLights(
  lights: readonly LitLight[],
  x: number,
  y: number,
  z: number,
  nx: number | null,
  ny: number,
  nz: number,
  ref: number,
  outI: { [i: number]: number },
  outW: { [i: number]: number },
  o: number,
): void {
  let i0 = -1,
    i1 = -1,
    i2 = -1,
    w0 = 0,
    w1 = 0,
    w2 = 0;
  for (let li = 0; li < lights.length; li++) {
    const L = nth(lights, li),
      dx = L.x - x,
      dy = L.y - y,
      dz = L.z - z,
      d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= L.rad * L.rad) continue;
    if (ref >= 0) {
      const vis = L.vis;
      if (vis === null) throw new TypeError('灯りの見えるマス vis が、まだ無い');
      if (!vis[ref]) continue;
    }
    const d = Math.sqrt(d2),
      f = 1 - d / L.rad;
    let w = f * f * (1 + 0.5 * f * f);
    if (nx !== null) {
      const nd = (nx * dx + ny * dy + nz * dz) / Math.max(d, 1e-3);
      w *= Math.max(0, nd * 0.62 + 0.38);
    }
    if (w <= 0.002) continue;
    if (w > w0) {
      i2 = i1;
      w2 = w1;
      i1 = i0;
      w1 = w0;
      i0 = li;
      w0 = w;
    } else if (w > w1) {
      i2 = i1;
      w2 = w1;
      i1 = li;
      w1 = w;
    } else if (w > w2) {
      i2 = li;
      w2 = w;
    }
  }
  outI[o] = i0;
  outI[o + 1] = i1;
  outI[o + 2] = i2;
  outW[o] = w0;
  outW[o + 1] = w1;
  outW[o + 2] = w2;
}
