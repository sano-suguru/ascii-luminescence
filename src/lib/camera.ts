// 霧と目の慣れ、3人称の自分の姿と、カメラと自分の間の岩の断面（もとは src/game/28-camera-player.js の updateAtmosphere・updateAvatar・rockAt・drawSection）。
// 3人称のカメラを置く placeThirdPerson は src/lib/player.ts。
import { must, nth } from './array.ts';
import { headPos } from './aim.ts';
import { buildForm } from './bodies/build.ts';
import { G } from './glyphs.ts';
import { cellLight } from './lightmap.ts';
import { lerpAngle } from './math.ts';
import { bodyUnseen } from './monsters.ts';
import { AVATAR_TY } from './names.ts';
import { dyn } from './particles.ts';
import { clamp } from './rng.ts';
import { gfx, here, player, ui, vfx } from './state.ts';
import { CELL, EYE, MH, MW, TC, TW, TX } from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

// eye adaptation and atmosphere: open caverns thin the fog, bright surroundings lower the exposure
/** 霧と目の慣れ（毎フレーム）：洞窟の部屋・遺跡では霧の濃さを変え、まわりの明るさ（灯り・近くの見える生き物と備品）で露出をゆっくり合わせる。溶岩の近くの熱のゆらぎと、水中の見え方も */
export function updateAtmosphere(dt: number): void {
  const pc = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL),
    ri = nth(level().roomOf, pc);
  const inCave = ri >= 0 && nth(level().rooms, ri).cave;
  const fogT = inCave ? (level().stratum.k === 'cavern' ? 0.032 : 0.03) : level().stratum.k === 'ruins' ? 0.04 : gfx.fogBase;
  must(gfx.U).uFogDen.value += (fogT - must(gfx.U).uFogDen.value) * (1 - Math.exp(-dt * 0.9));
  const l = cellLight(player.x, player.z);
  let B = 0.3 * l[0] + 0.55 * l[1] + 0.15 * l[2];
  for (const m of here.monsters) {
    const d = Math.hypot(m.x - player.x, m.z - player.z);
    if (d >= 5) continue;
    // 描かれない生き物（src/lib/monsters.ts の bodyUnseen。視界の外かは見ない）と化けている生き物は、目に入る明るさに数えない（近づいたのが暗さで分からないように）
    if (m.hidden || bodyUnseen(m, d)) continue;
    B += (1 - d / 5) ** 2 * 0.7;
  }
  for (const f of here.fixtures) {
    const d = Math.hypot(f.x - player.x, f.z - player.z);
    if (d < 3) B += (1 - d / 3) ** 2 * 0.8;
  }
  const target = clamp(1.25 / (1 + B * 0.6), 0.55, 1.25);
  // a creature just shown in the bestiary (showBeast), once the camera is placed (updateGallery): the eye and the fog settle at once, so the picture
  // does not hang on the last creature's view
  if (ui.gallery && ui.gallery.settle === 2) {
    ui.gallery.settle = 0;
    vfx.expo = target;
    must(gfx.U).uFogDen.value = fogT;
  }
  vfx.expo += (target - vfx.expo) * (1 - Math.exp(-dt * (target < vfx.expo ? 2.5 : 1.0)));
  vfx.flash = Math.max(0, vfx.flash - dt * 2.5);
  must(must(gfx.finalPass).uniforms['uExposure']).value = vfx.expo * (1 + vfx.flash * 1.6);
  let heat = 0;
  for (const f of here.fixtures) {
    if (f.type !== 'lava' && !(f.type === 'crater' && f.active)) continue;
    heat = Math.max(heat, 1 - Math.hypot(f.x - player.x, f.z - player.z) / 10);
  }
  const hu = must(must(gfx.finalPass).uniforms['uHeat']);
  hu.value += (heat - hu.value) * Math.min(1, dt * 2);
  must(must(gfx.finalPass).uniforms['uSwim']).value = ui.camMode === 'tps' ? 0 : clamp((EYE - player.eye) / (EYE - 0.62), 0, 1);
}

/** 3人称の自分の姿を動かす（初めて呼んだ時に作る）：プレイヤーの所に置き、進む向き（振っている時と止まっている時は前）へゆっくり向け、歩きの位相・沈み（深い水・転がる）・光り（傷を受けた時に強く） */
export function updateAvatar(dt: number): void {
  if (!ui.avatar)
    ui.avatar = { ty: AVATAR_TY, form: buildForm(AVATAR_TY), x: 0, z: 0, y: 0, yaw: 0, walk: 0, moving: 0, ph: 1.3, glow: 1.1, surf: 0 };
  const sp = Math.hypot(player.vx, player.vz),
    face = (player.swing ?? NaN) > 0 || sp < 0.3 ? player.yaw + Math.PI : Math.atan2(player.vx, player.vz);
  ui.avatar.x = player.x;
  ui.avatar.z = player.z;
  ui.avatar.yaw = lerpAngle(ui.avatar.yaw, face, 1 - Math.exp(-dt * 12));
  ui.avatar.moving += ((sp > 0.3 ? 1 : 0) - ui.avatar.moving) * Math.min(1, dt * 6);
  ui.avatar.walk += dt * sp * 2.2;
  ui.avatar.y = (player.eye < 1 ? -0.95 : 0) - (player.roll ? Math.sin((Math.PI * player.roll.t) / 0.32) * 0.6 : 0);
  ui.avatar.glow = 1.9 + Math.min(1.5, vfx.hurtFlash * 2);
}

/** その点が岩の中か（地図の外・壁・天井より上・裂け目でない床より下） */
export function rockAt(x: number, y: number, z: number): boolean {
  const cx = Math.floor(x / CELL),
    cz = Math.floor(z / CELL);
  if (cx < 0 || cz < 0 || cx >= MW || cz >= MH) return true;
  const i = cz * MW + cx,
    tt = level().tile[i];
  if (tt === TW || tt === TX) return true;
  if (y > nth(level().ceil, i)) return true;
  if (y < 0 && tt !== TC) return true;
  return false;
}

/** 3人称で、カメラから自分の頭までの線のまわりの輪（カメラ側が太く、頭の側が細い）の上で、岩の中にある点に、岩の断面の文字を置く（描かない壁の切り口を見せる） */
export function drawSection(): void {
  if (ui.camMode !== 'tps' || !ui.camPos) return;
  const C = ui.camPos,
    h = headPos(),
    P: [number, number, number] = [h[0], h[1] - 0.25, h[2]],
    sx = P[0] - nth(C, 0),
    sy = P[1] - nth(C, 1),
    sz = P[2] - nth(C, 2),
    L = Math.hypot(sx, sy, sz) || 1,
    ax = sx / L,
    ay = sy / L,
    az = sz / L;
  // two directions perpendicular to the line from the camera to you
  let ux = -az,
    uy = 0,
    uz = ax;
  const ul = Math.hypot(ux, uz) || 1;
  ux = ux / ul;
  uz = uz / ul;
  const vx = ay * uz - az * uy,
    vy = az * ux - ax * uz,
    vz = ax * uy - ay * ux;
  for (let r = 0; r < 18; r++) {
    const t = 0.03 + r * 0.053,
      R = 2.6 + (0.9 - 2.6) * t + 0.04,
      cx = nth(C, 0) + sx * t,
      cy = nth(C, 1) + sy * t,
      cz = nth(C, 2) + sz * t,
      n = Math.max(12, Math.round(R * 22));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r * 0.37,
        px = cx + (ux * Math.cos(a) + vx * Math.sin(a)) * R,
        py = cy + (uy * Math.cos(a) + vy * Math.sin(a)) * R,
        pz = cz + (uz * Math.cos(a) + vz * Math.sin(a)) * R;
      if (!rockAt(px, py, pz)) continue;
      const hsh = (k * 73 + r * 151) % 7,
        b = 0.2 + 0.06 * (hsh % 3);
      dyn(px, py, pz, G(hsh < 3 ? '#' : hsh < 5 ? '%' : ':'), 0.38, b * 1.25, b * 1.1, b * 1.35);
    }
  }
}
