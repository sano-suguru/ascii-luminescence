// 霧と目の慣れと、その点が岩の中か（もとは src/game/28-camera-player.js の updateAtmosphere・rockAt）と、
// 階の場所ごとの空気（22-world-hints.js の updateSectionAir）。
import { must, nth } from './array.ts';
import { cellLight } from './lightmap.ts';
import { bodyUnseen } from './monsters.ts';
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
  must(must(gfx.finalPass).uniforms['uSwim']).value = clamp((EYE - player.eye) / (EYE - 0.62), 0, 1);
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

// the air of each part of a level: the crossroads a little brighter, the way to the stairs a little darker and quieter
/** 階の場所ごとの空気（もとは src/game/22-world-hints.js）：分かれ道は少し明るく、階段へ向かう道の終わりの3割は少し暗く。まわりの明るさ uAmb をゆっくり合わせる */
export function updateSectionAir(dt: number): void {
  if (!here.D || !here.D.prof) return;
  const pc = ((player.z / CELL) | 0) * MW + ((player.x / CELL) | 0);
  let k = 1;
  if (level().hub && level().roomOf[pc] === must(level().hub, '分かれ道 here.D.hub').ri) k = 1.25;
  else if (
    level().dS &&
    (level().pathL ?? NaN) > 0 &&
    (must(level().dS, '階段までの距離 here.D.dS')[pc] ?? NaN) > (level().pathL ?? NaN) * 0.7
  )
    k = 0.85;
  vfx.ambK += (k - vfx.ambK) * Math.min(1, dt * 1.2);
  must(gfx.U, '分け合う値 gfx.U').uAmb.value = level().prof.ambient * vfx.ambK;
}
