// 照準と線（もとは src/game/28-camera-player.js の headPos・aimOrigin、20-chant-hits.js の viewDir・groundPoint・reflectDir、18-level-player.js の hittable、
// 22-world-hints.js の handUp・aimPoint・centerPoint・castPoint・handPoint・aimTarget・assistPoint・shotFrame、19-hands-runes.js の drawSwing、
// 26-spells-hud.js の doorBlock・losClear・beamFrame）：目の位置と見ている向き、攻撃や投げた物が出る所、照準の先の点と生き物、狙いを助ける点、撃つ所と向き、
// 手の前の点、詠唱の円の位置、武器を振った線、閉じた扉・見通し・地面に落とす所・跳ね返る向き。
// 状態の入れ物 player・ui（1人称か3人称か。照準の先を探した時刻 aimT と生き物 crossMon は読み書きする）・gfx（カメラの位置。読むだけ）・here（今の階）・clock に頼る。
import { must, nth } from './array.ts';
import { G } from './glyphs.ts';
import { dyn } from './particles.ts';
import { clamp } from './rng.ts';
import { foe } from './monsters.ts';
import { type Mob, type Monster, clock, gfx, here, player, ui } from './state.ts';
import { CELL, MH, MW, NCELL, TW, TX } from './world.ts';

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
/** マスに閉じた扉があるか（燃え尽きた扉と、半分より開いた扉は通す。マップの外のマスは扉が無い。もとは src/game/26-spells-hud.js） */
export function doorBlock(ci: number): boolean {
  // マップの外のマスも渡される（光線がマップの端で止まった所など）。その時は扉が無い（元のまま。範囲の外の読みは undefined で、比べると false）
  const di = level().doorAt[ci],
    d = (di ?? NaN) >= 0 ? nth(level().doors, must(di)) : null;
  return !!d && !d.gone && d.o < 0.5;
}
/** 2つの点の間を、壁・閉じた扉・天井に遮られずに見通せるか（0.3 ごとに調べる。マップの外に出たら見通せない。もとは src/game/26-spells-hud.js） */
export function losClear(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const d = Math.hypot(bx - ax, by - ay, bz - az),
    n = Math.ceil(d / 0.3);
  for (let k = 1; k < n; k++) {
    const f = k / n,
      x = ax + (bx - ax) * f,
      y = ay + (by - ay) * f,
      z = az + (bz - az) * f,
      ci = Math.floor(z / CELL) * MW + Math.floor(x / CELL);
    if (ci < 0 || ci >= NCELL) return false;
    const tt = level().tile[ci];
    if (tt === TW || tt === TX || doorBlock(ci) || y > (level().ceil[ci] ?? NaN)) return false;
  }
  return true;
}
/**
 * 地面に落とす術の落ちる所：o から向き d に 0.3 ずつ進み（maxD まで。既定 22）、敵の体に当たればその足もと、壁・閉じた扉に当たればその手前、床に着けばそこ
 * （もとは src/game/20-chant-hits.js）
 */
export function groundPoint(o: readonly number[], d: readonly number[], maxD?: number): [number, number] {
  let x = nth(o, 0),
    y = nth(o, 1),
    z = nth(o, 2),
    px = x,
    pz = z;
  for (let s2 = 0; s2 < (maxD || 22); s2 += 0.3) {
    x += nth(d, 0) * 0.3;
    y += nth(d, 1) * 0.3;
    z += nth(d, 2) * 0.3;
    for (const m of here.monsters) {
      if (!foe(m)) continue;
      const cy = m.y + 0.6 * m.ty.scale;
      if (Math.hypot(m.x - x, cy - y, m.z - z) < 0.6 + 0.35 * m.ty.scale) return [m.x, m.z];
    }
    const ci = Math.floor(z / CELL) * MW + Math.floor(x / CELL);
    if (ci < 0 || ci >= NCELL || level().tile[ci] === TW || level().tile[ci] === TX || doorBlock(ci)) return [px, pz];
    if (y <= 0.05) return [x, z];
    px = x;
    pz = z;
  }
  return [x, z];
}
/** 跳ね返る向き：少し先が床か天井なら上下を、壁なら当たった向きを反す（角なら両方。もとは src/game/20-chant-hits.js） */
export function reflectDir(x: number, y: number, z: number, d: readonly number[]): V3 {
  const s = 0.25,
    cx = Math.floor((x + nth(d, 0) * s) / CELL),
    cz = Math.floor((z + nth(d, 2) * s) / CELL),
    ox = Math.floor(x / CELL),
    oz = Math.floor(z / CELL);
  const solidAt = (a: number, b: number): boolean =>
    a < 0 || b < 0 || a >= MW || b >= MH || level().tile[b * MW + a] === TW || level().tile[b * MW + a] === TX;
  let r: V3 = [nth(d, 0), nth(d, 1), nth(d, 2)];
  const ci = Math.floor(z / CELL) * MW + Math.floor(x / CELL);
  if (y + nth(d, 1) * s < 0.02 || y + nth(d, 1) * s > (level().ceil[ci] ?? NaN)) {
    r[1] = -nth(r, 1);
    return r;
  }
  const bx = solidAt(cx, oz),
    bz = solidAt(ox, cz);
  if (bx) r[0] = -nth(r, 0);
  if (bz) r[2] = -nth(r, 2);
  if (!bx && !bz) {
    r[0] = -nth(r, 0);
    r[2] = -nth(r, 2);
  }
  return r;
}
/**
 * 照準の先の生き物：見えている敵のうち、目から 28 以内で、照準からの角度が体の大きさの分の内にあり、見通せる物（角度と距離で一番近い物）。
 * 0.1 秒ごとに探し直し、間は前の答えを返す（ui.aimT・ui.crossMon。もとは src/game/22-world-hints.js）
 */
export function aimTarget(): Mob | null {
  if (clock.time - ui.aimT < 0.1) return ui.crossMon;
  ui.aimT = clock.time;
  ui.crossMon = null;
  const [ox, oy, oz] = aimOrigin(),
    [vx, vy, vz] = viewDir();
  // @ts-expect-error -- 古い JS のまま（使っていない。tools/same-code.mjs が同じ文と見るため）
  let bd = 1e9;
  let ba = 1e9;
  for (const m of here.monsters) {
    if (!foe(m) || !m.visible) continue;
    if (m.ty.habitat === 'deep' && (m.rise || 0) < 0.3) continue;
    const cy = m.y + 0.6 * m.ty.scale,
      ax = m.x - ox,
      ay = cy - oy,
      az = m.z - oz,
      d = Math.hypot(ax, ay, az);
    if (d > 28) continue;
    const ang = Math.acos(clamp((ax * vx + ay * vy + az * vz) / Math.max(d, 1e-3), -1, 1)),
      tol = 0.08 + Math.atan2(0.6 * m.ty.scale, Math.max(d, 0.5));
    if (ang > tol) continue;
    const score = ang / tol + d * 0.01;
    if (score < ba && losClear(ox, oy, oz, m.x, cy, m.z)) {
      ba = score;
      ui.crossMon = m;
    }
  }
  return ui.crossMon;
}
/** 狙いを助ける点：撃つ物が bolt か beam で、照準の先に生き物がいれば、その体（bolt は、動いている向きに飛ぶ時間の分だけ先）。ほかは null（もとは src/game/22-world-hints.js） */
export function assistPoint(o: readonly number[], kind: string | undefined): V3 | null {
  if (kind !== 'bolt' && kind !== 'beam') return null;
  const m = aimTarget();
  if (!m || m.dead) return null;
  const c: V3 = [m.x, m.y + (m.ty.flier ? 0 : 0.6 * m.ty.scale), m.z];
  if (kind === 'beam') return c;
  const t = Math.hypot(c[0] - nth(o, 0), c[1] - nth(o, 1), c[2] - nth(o, 2)) / 20;
  return [c[0] + (m.vlx || 0) * t, c[1], c[2] + (m.vlz || 0) * t];
}
/** 撃つ所 o と向き d（長さ1）：詠唱した時は詠唱の円の少し下から、ほかは手の前から、狙いを助ける点か照準の先の点へ（近すぎる時は見ている向き。もとは src/game/22-world-hints.js） */
export function shotFrame(h: string, chanted: boolean, kind: string | undefined): { o: V3; d: V3 } {
  const o: V3 = chanted
      ? (() => {
          const c = castPoint(h, 1),
            u = handUp()[2];
          return [c[0] - u[0] * 0.14, c[1] - u[1] * 0.14, c[2] - u[2] * 0.14];
        })()
      : handPoint(h),
    a = assistPoint(o, kind) || aimPoint(),
    dx = a[0] - o[0],
    dy = a[1] - o[1],
    dz = a[2] - o[2],
    l = Math.hypot(dx, dy, dz);
  return { o, d: l > 1 ? [dx / l, dy / l, dz / l] : viewDir() };
}
/** 光線を撃つ所 o と向き d（手の前から、狙いを助ける点か照準の先の点へ。もとは src/game/26-spells-hud.js） */
export function beamFrame(h: string): { o: V3; d: V3 } {
  const o = handPoint(h),
    a = assistPoint(o, 'beam') || aimPoint(),
    dx = a[0] - o[0],
    dy = a[1] - o[1],
    dz = a[2] - o[2],
    l = Math.hypot(dx, dy, dz);
  return { o, d: l > 1 ? [dx / l, dy / l, dz / l] : viewDir() };
}
