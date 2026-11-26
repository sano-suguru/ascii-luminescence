// 照準（もとは src/game/28-camera-player.js の headPos・aimOrigin、20-chant-hits.js の viewDir、18-level-player.js の hittable、
// 22-world-hints.js の handUp・aimPoint・centerPoint・castPoint・handPoint、19-hands-runes.js の drawSwing）：
// 目の位置と見ている向き、攻撃や投げた物が出る所、照準の先の点、手の前の点、詠唱の円の位置、武器を振った線。
// 状態の入れ物 player・ui（1人称か3人称か）・gfx（カメラの位置。読むだけ）・here（今の階）に頼る。呼ぶのは古い JS の詠唱・攻撃・飛ぶ物・描画。
import { must, nth } from './array.ts';
import { G } from './glyphs.ts';
import { dyn } from './particles.ts';
import { clamp } from './rng.ts';
import { type Monster, gfx, here, player, ui } from './state.ts';
import { CELL, MW, NCELL, TW, TX } from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');
type V3 = [number, number, number];

/** 頭の位置（3人称の時の、体の頭。転がっている間は低くなる） */
export function headPos(): V3 {
  return [player.x, player.eye + 0.05 - (player.roll ? Math.sin((Math.PI * player.roll.t) / 0.32) * 0.55 : 0), player.z];
}
// where attacks and thrown things start: the eye in first person, the head of the avatar in third person
/** 攻撃や投げた物が出る所：1人称では目（カメラ）、3人称では体の頭 */
export function aimOrigin(): V3 {
  return ui.camMode === 'tps' ? headPos() : [gfx.camera.position.x, gfx.camera.position.y, gfx.camera.position.z];
}
/** 見ている向き（長さ1） */
export function viewDir(): V3 {
  const cp = Math.cos(player.pitch);
  return [-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp];
}
/** 攻撃が当たる生き物か（倒れていない、穏やかでない） */
export const hittable = (m: Monster): boolean => !m.dead && !m.ty.peaceful;
/** 見ている向きの、前・右・上（どれも長さ1。上は、向きと右に直交して上を向く物） */
export function handUp(): [V3, V3, V3] {
  const [fx, fy, fz] = viewDir(),
    rx = Math.cos(player.yaw),
    rz = -Math.sin(player.yaw);
  let ux = -rz * fy,
    uy = rz * fx - rx * fz,
    uz = rx * fy;
  if (uy < 0) {
    ux = -ux;
    uy = -uy;
    uz = -uz;
  }
  const l = Math.hypot(ux, uy, uz) || 1;
  return [
    [fx, fy, fz],
    [rx, 0, rz],
    [ux / l, uy / l, uz / l],
  ];
}
// what the crosshair points at: the first wall, floor or creature along the line of sight
/** 照準の先の点：見ている向きに進んで、最初に当たる壁・床・天井・生き物（40 まで。何にも当たらなければ、その先の点） */
export function aimPoint(): V3 {
  const [ox, oy, oz] = aimOrigin(),
    [dx, dy, dz] = viewDir();
  let x = ox,
    y = oy,
    z = oz;
  const near = here.monsters.filter((m) => hittable(m) && Math.hypot(m.x - ox, m.z - oz) < 42);
  for (let s = 0; s < 160; s++) {
    x += dx * 0.25;
    y += dy * 0.25;
    z += dz * 0.25;
    const ci = Math.floor(z / CELL) * MW + Math.floor(x / CELL);
    if (ci < 0 || ci >= NCELL) break;
    if (level().tile[ci] === TW || level().tile[ci] === TX || y < 0.02 || y > (level().ceil[ci] ?? NaN)) return [x, y, z];
    for (const m of near) {
      if (m.ty.habitat === 'deep' && (m.rise || 0) < 0.3) continue;
      const cy = m.hidden ? (m.y ?? NaN) + 1.3 : must(m.y, '足もとの高さ y') + (m.ty.flier ? 0 : 0.6 * m.ty.scale);
      if (Math.hypot(m.x - x, cy - y, m.z - z) < 0.42 + 0.35 * m.ty.scale) return [x, y, z];
    }
  }
  return [x, y, z];
}
/** 照準の少し前（0.95 先）の点 */
export function centerPoint(): V3 {
  const [o0, o1, o2] = aimOrigin(),
    [f] = handUp();
  return [o0 + nth(f, 0) * 0.95, o1 + nth(f, 1) * 0.95, o2 + nth(f, 2) * 0.95];
}
// the chant circle: born at the hand, drawn to the crosshair as the chant fills
/** 詠唱の円の位置：手の前で生まれ、溜まる（k が 0 から 1）につれて照準の前へ寄る */
export function castPoint(h: string, k: number): V3 {
  const a = handPoint(h),
    b = centerPoint(),
    e = 1 - Math.pow(1 - clamp(k, 0, 1), 2.2);
  return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e];
}
/** 手の前の点（左手 'L' は左、ほかは右。少し下） */
export function handPoint(h: string): V3 {
  const [o0, o1, o2] = aimOrigin(),
    [f, r, u] = handUp(),
    s = h === 'L' ? -1 : 1;
  return [
    o0 + nth(f, 0) * 0.95 + nth(r, 0) * s * 0.38 - nth(u, 0) * 0.27,
    o1 + nth(f, 1) * 0.95 - nth(u, 1) * 0.27,
    o2 + nth(f, 2) * 0.95 + nth(r, 2) * s * 0.38 - nth(u, 2) * 0.27,
  ];
}
/** 武器を振った線（振った残りの秒 player.swing の間、目の前に弧を描く。波を撃つ途中は描かない） */
export function drawSwing(): void {
  if (!((player.swing ?? NaN) > 0) || player.swingWave) return;
  const k = 1 - (player.swing ?? NaN) / 0.22,
    [fx, fy, fz] = viewDir(),
    rx = Math.cos(player.yaw),
    rz = -Math.sin(player.yaw);
  // up vector of the view = right x forward (flipped to point upward)
  let ux = -rz * fy,
    uy = rz * fx - rx * fz,
    uz = rx * fy;
  if (uy < 0) {
    ux = -ux;
    uy = -uy;
    uz = -uz;
  }
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const [cx0, cy0, cz0] = aimOrigin();
  for (let q = 0; q < 7; q++) {
    const a = (q / 6 - 0.5) * 1.6 + (k - 0.5) * 1.2,
      u = Math.sin(a) * 0.75,
      v = Math.cos(a) * 0.35 - 0.2;
    dyn(
      cx0 + fx * 0.9 + rx * u + ux * v,
      cy0 + fy * 0.9 + uy * v,
      cz0 + fz * 0.9 + rz * u + uz * v,
      G(q % 2 ? '/' : '-'),
      0.16,
      nth(player.swingCol || [0.8, 0.75, 0.65], 0) * 2 * (1 - k * 0.6),
      nth(player.swingCol || [0.8, 0.75, 0.65], 1) * 2 * (1 - k * 0.6),
      nth(player.swingCol || [0.8, 0.75, 0.65], 2) * 2 * (1 - k * 0.6),
    );
  }
}
