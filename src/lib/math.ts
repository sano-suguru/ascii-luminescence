// 小さな計算の道具（もとは src/game/06-world.js・12-hud-text.js・18-level-player.js・20-chant-hits.js）。
import { clamp } from './rng.ts';

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
