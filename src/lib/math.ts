// 小さな計算の道具（もとは src/game/06-world.js・12-hud-text.js・18-level-player.js・20-chant-hits.js）。
import { clamp } from './rng.ts';
import { mr } from './random.ts';

/** なめらかな 0 から 1（a で 0、b で 1） */
export const sstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** 角度の差 a - b を、-PI から PI に収める */
export const angDiff = (a: number, b: number): number => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
/** 角度 a から b へ、近い向きに k だけ進める */
export const lerpAngle = (a: number, b: number, k: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};
/** 向き d を、上下の軸のまわりに a だけ回す */
export function turnDir(d: readonly [number, number, number], a: number): [number, number, number] {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [d[0] * c - d[2] * s, d[1], d[0] * s + d[2] * c];
}

/** 流れの向き f（ラジアン）を、水面のシェーダーに渡す 0 から 1 の値にする */
export const flowW = (f: number): number => (((((f - 10) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 0.998 + 0.001;
/** a から b への、ぎざぎざの線（稲妻）の点の列。真ん中ほど大きく揺らす（見た目の乱数 mr を引く） */
export function jagged(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  amp: number,
): (readonly [number, number, number])[] {
  const n = Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.45)),
    pts: (readonly [number, number, number])[] = [a];
  for (let k = 1; k < n; k++) {
    const f = k / n,
      w = Math.sin(Math.PI * f) * amp;
    pts.push([
      a[0] + (b[0] - a[0]) * f + (mr() - 0.5) * w * 2,
      a[1] + (b[1] - a[1]) * f + (mr() - 0.5) * w * 2,
      a[2] + (b[2] - a[2]) * f + (mr() - 0.5) * w * 2,
    ]);
  }
  pts.push(b);
  return pts;
}
/** 生き物の真ん中（体の高さの6割） */
export const mCenter = (m: { x: number; y: number; z: number; ty: { scale: number } }): [number, number, number] => [
  m.x,
  m.y + 0.6 * m.ty.scale,
  m.z,
];
