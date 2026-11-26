// プレイヤーの動き（もとは src/game/28-camera-player.js・16-view-input.js）：通れない所の当たり判定、3人称のカメラ、歩く・泳ぐ・滑る・転がる・
// 突進、通れない所の一言、生き物に押されること、カメラ。状態の入れ物 player・here・ui・gfx・edge・keys に頼る。
import { must } from './array.ts';
import { headPos, viewDir } from './aim.ts';
import { sRumble, sSplash } from './audio.ts';
import { dashCuts } from './combat.ts';
import { webTouch } from './fixtures.ts';
import { bodyN } from './gear.ts';
import { G } from './glyphs.ts';
import { brimFlare, crackIce, tallAt, trample } from './ground.ts';
import { msg } from './log.ts';
import { spawn } from './particles.ts';
import { mr } from './random.ts';
import { clamp } from './rng.ts';
import { blaze, clock, edge, gfx, here, keys, player, stealth, ui, vfx, adv } from './state.ts';
import { showHint } from './status.ts';
import { CELL, EYE, LQ_BOG, LQ_DEEP, LQ_LAVA, LQ_WATER, MH, MW, PR, SF_ICE, SF_MUD, TC, TP, TW, TX } from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

/** 半径 r の丸が、(x, z) で通れない所に重なるか（壁・裂け目・結晶・溶岩・閉じた鉄格子・柱・置物。重なった物を player.blockType に入れる。もとは src/game/16-view-input.js） */
export function solidAt(x: number, z: number, r: number): boolean {
  const x0 = Math.floor((x - r) / CELL),
    x1 = Math.floor((x + r) / CELL),
    z0 = Math.floor((z - r) / CELL),
    z1 = Math.floor((z + r) / CELL);
  for (let cz = z0; cz <= z1; cz++)
    for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0 || cz < 0 || cx >= MW || cz >= MH) {
        player.blockType = 'wall';
        return true;
      }
      if (level().gate && must(level().gate).o < 0.7 && cz * MW + cx === must(level().gate).cell) {
        const nx = clamp(x, cx * CELL, (cx + 1) * CELL),
          nz = clamp(z, cz * CELL, (cz + 1) * CELL);
        if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) {
          player.blockType = 'gate';
          return true;
        }
      }
      const tt = level().tile[cz * MW + cx];
      const lqc = level().liquid[cz * MW + cx];
      if (tt === TW || (tt === TC && !(level().pit && must(level().pit)[cz * MW + cx])) || tt === TX || lqc === LQ_LAVA) {
        const nx = clamp(x, cx * CELL, (cx + 1) * CELL),
          nz = clamp(z, cz * CELL, (cz + 1) * CELL);
        if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) {
          player.blockType = tt === TC ? 'chasm' : tt === TX ? 'xtal' : lqc === LQ_LAVA ? 'lava' : 'wall';
          return true;
        }
      } else if (tt === TP) {
        if (Math.hypot(x - (cx + 0.5) * CELL, z - (cz + 0.5) * CELL) < 0.55 + r) {
          player.blockType = 'wall';
          return true;
        }
      } else {
        const sr = level().solid.get(cz * MW + cx);
        if (sr && Math.hypot(x - (cx + 0.5) * CELL, z - (cz + 0.5) * CELL) < sr + r) {
          player.blockType = 'wall';
          return true;
        }
      }
    }
  return false;
}
/** 3人称のカメラを、頭の後ろの少し右へ寄せる（ゆっくり追う。揺れ sk。カメラと頭の間の壁を描かないように、描画に渡す。もとは src/game/28-camera-player.js） */
export function placeThirdPerson(dt: number, sk: number): void {
  const h = headPos(),
    [dx, dy, dz] = viewDir(),
    rx = Math.cos(player.yaw),
    rz = -Math.sin(player.yaw);
  const tx = h[0] - dx * 4.0 + rx * 0.5,
    ty = Math.max(0.4, h[1] - dy * 4.0 + 0.5),
    tz = h[2] - dz * 4.0 + rz * 0.5;
  if (!ui.camPos) ui.camPos = [tx, ty, tz];
  const k = Math.min(1, dt * 14);
  ui.camPos[0] = must(ui.camPos[0]) + (tx - must(ui.camPos[0])) * k;
  ui.camPos[1] = must(ui.camPos[1]) + (ty - must(ui.camPos[1])) * k;
  ui.camPos[2] = must(ui.camPos[2]) + (tz - must(ui.camPos[2])) * k;
  gfx.camera.position.set(must(ui.camPos[0]) + (mr() - 0.5) * sk, must(ui.camPos[1]) + (mr() - 0.5) * sk, must(ui.camPos[2]));
  gfx.camera.rotation.set(player.pitch, player.yaw, 0);
  must(gfx.U).uCamP.value.set(must(ui.camPos[0]), must(ui.camPos[1]), must(ui.camPos[2]));
  must(gfx.U).uCutP.value.set(h[0], h[1] - 0.25, h[2]);
  must(gfx.U).uCut.value = 1;
}
/**
 * プレイヤーの動き（毎フレーム）：歩く・泳ぐ（深い水・沼・浅い水・泥で遅く、網で止まる）・氷で滑る・突進・転がる、通れない所の一言と裂け目の縁、
 * 生き物に押される、目の高さ（深い水では低く）とカメラ（もとは src/game/28-camera-player.js）
 */
export function updatePlayer(dt: number): void {
  if (adv.dead) return;
  if (!ui.started) {
    player.yaw += dt * 0.07;
  } else {
    const k = keys;
    const fw = (k.KeyW || k['ArrowUp'] ? 1 : 0) - (k.KeyS || k['ArrowDown'] ? 1 : 0),
      st = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    if (k['ArrowLeft']) player.yaw += dt * 2.0;
    if (k['ArrowRight']) player.yaw -= dt * 2.0;
    const sy = Math.sin(player.yaw),
      cy = Math.cos(player.yaw);
    const pci = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL),
      lq = level().liquid[pci],
      wade =
        (level().bridge[pci] ? 1 : lq === LQ_DEEP ? 0.45 : lq === LQ_BOG ? 0.55 : lq === LQ_WATER ? 0.8 : 1) *
        (webTouch(pci) ? 0.35 : 1) *
        (level().surface[pci] === SF_MUD && !lq ? 0.72 : 1) *
        ((player.netT ?? NaN) > 0 ? 0 : 1);
    if (pci !== player.lastCell) {
      player.lastCell = pci;
      brimFlare(pci);
      if (tallAt(pci)) {
        if (!ui.tallMsg) {
          ui.tallMsg = true;
          msg(
            '<b style="color:#7ad86a">"</b>背の高い茂みを踏み分けた。茂みは視線を遮る。獣との間に挟めば、身を隠す壁になる。踏み分けた跡は、しばらくすると元に戻る。',
          );
        }
        trample(pci);
      }
    }
    if (!lq) blaze.scent[pci] = clock.time;
    if (lq === LQ_DEEP && !level().swimMsg) {
      level().swimMsg = true;
      msg('<b style="color:#5aa0ff">~</b>深い水に入った。足が届かない。ゆっくりと泳いで進む。');
    }
    const ix = -sy * fw + cy * st,
      iz = -cy * fw - sy * st,
      len = Math.hypot(ix, iz),
      sp = ((k['ShiftLeft'] || k['ShiftRight']) && !stealth.sneak ? 5.6 : stealth.sneak ? 2.3 : 3.2) * wade;
    if (wade < 1 && len) {
      player.splash = (player.splash || 0) + dt * Math.hypot(player.vx, player.vz) * 1.4;
      while (player.splash > 1) {
        player.splash--;
        const a0 = mr() * 6.28;
        sSplash(lq === LQ_DEEP ? 0.22 : 0.12);
        for (let q = 0; q < 5; q++) {
          const a = a0 + (q / 5) * Math.PI * 2;
          spawn(
            player.x + Math.cos(a) * 0.15,
            0.07,
            player.z + Math.sin(a) * 0.15,
            Math.cos(a) * 0.5,
            0.02,
            Math.sin(a) * 0.5,
            0.8,
            G(lq === LQ_BOG ? 'o' : '~'),
            0.12,
            lq === LQ_BOG ? 0.3 : 0.15,
            lq === LQ_BOG ? 0.34 : 0.3,
            lq === LQ_BOG ? 0.12 : 0.55,
            1,
          );
        }
      }
    }
    const onIce = level().surface[pci] === SF_ICE && !level().liquid[pci] && !level().bridge[pci];
    if (onIce && !level().iceMsg) {
      level().iceMsg = true;
      msg('<b style="color:#b8e4ff">=</b>氷の上だ。足が滑る。止まるにも、曲がるにも時間がかかる。');
    }
    if (level().thin[pci] && !level().liquid[pci]) crackIce(pci, dt);
    const BSP = 1 + 0.15 * bodyN('swift'),
      tx = len ? (ix / len) * sp * BSP : 0,
      tz = len ? (iz / len) * sp * BSP : 0,
      a = 1 - Math.exp(-dt * (onIce ? 1.3 : 9));
    player.vx += (tx - player.vx) * a;
    player.vz += (tz - player.vz) * a;
    if (player.lunge) {
      player.lunge.t += dt;
      player.vx = player.lunge.dx * player.lunge.sp;
      player.vz = player.lunge.dz * player.lunge.sp;
      dashCuts();
      if (player.lunge.t >= player.lunge.dur) player.lunge = null;
    }
    if (player.roll) {
      player.roll.t += dt;
      const rs = 8.5 * Math.min(1, wade + 0.25);
      player.vx = player.roll.dx * rs;
      player.vz = player.roll.dz * rs;
      if (player.roll.t >= 0.32 * (1 + 0.35 * bodyN('roll'))) player.roll = null;
    }
    player.rollCd = Math.max(0, (player.rollCd || 0) - dt);
    let blocked = '';
    const nx = player.x + player.vx * dt;
    if (!solidAt(nx, player.z, PR)) player.x = nx;
    else {
      player.vx = 0;
      blocked = player.blockType;
    }
    const nz = player.z + player.vz * dt;
    if (!solidAt(player.x, nz, PR)) player.z = nz;
    else {
      player.vz = 0;
      blocked = blocked || player.blockType;
    }
    // make impassable terrain legible: say what is in the way; at a chasm's edge, keep pushing to jump (as in Brogue)
    if (len && blocked && blocked !== 'wall') {
      edge.t += dt;
      edge.k = blocked;
      edge.idle = 0;
      if (blocked === 'chasm') {
        showHint(
          `裂け目の縁だ。このまま進み続けると飛び降りる <b>[${'#'.repeat(Math.min(5, Math.floor(edge.t / 0.24)))}${'-'.repeat(5 - Math.min(5, Math.floor(edge.t / 0.24)))}]</b>`,
        );
        if (edge.t > 1.2 && !here.trans) {
          here.trans = { phase: 'out', t: 0, regen: false };
          player.fall = true;
          sRumble(0.5, 1.4);
          msg('<b style="color:#9a7cff">:</b>裂け目へ身を投じ、闇の中を下の階層へと落ちていく……');
        }
      } else if (blocked === 'lava') {
        showHint('溶岩の熱が行く手を阻んでいる。これ以上は近づけない');
        must(must(gfx.finalPass).uniforms['uHeat']).value = Math.min(1.4, must(must(gfx.finalPass).uniforms['uHeat']).value + dt * 2);
      } else if (blocked === 'gate') showHint('鉄格子が行く手を塞いでいる。どこかに開ける仕掛けがあるはずだ');
      else if (blocked === 'xtal') showHint('結晶に行く手を塞がれている。光は通るが、体は通れない');
    } else {
      edge.idle += dt;
      if (edge.idle > 0.15) edge.t = 0;
      if (edge.idle > 0.9) showHint('');
    }
    for (const m of here.monsters) {
      if (m.ty.flier || m.ty.form === 'eel') continue;
      const dx = player.x - m.x,
        dz = player.z - m.z,
        d = Math.hypot(dx, dz),
        rr = 0.7 * m.ty.scale;
      if (d < rr && d > 1e-4) {
        const qx = m.x + (dx / d) * rr,
          qz = m.z + (dz / d) * rr;
        if (!solidAt(qx, player.z, PR)) player.x = qx;
        if (!solidAt(player.x, qz, PR)) player.z = qz;
      }
    }
    player.bob += dt * Math.hypot(player.vx, player.vz) * 2.1;
  }
  const spd = Math.min(1, Math.hypot(player.vx, player.vz) / 3.2);
  const sk = vfx.shake * 0.08;
  vfx.shake = Math.max(0, vfx.shake - dt * 1.2);
  {
    const pci = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL),
      deep = level().liquid[pci] === LQ_DEEP && !level().bridge[pci];
    player.eye += ((deep ? 0.62 : EYE) - player.eye) * Math.min(1, dt * 3);
  }
  if (ui.camMode === 'tps') {
    placeThirdPerson(dt, sk);
    return;
  }
  must(gfx.U).uCut.value = 0;
  gfx.camera.position.set(
    player.x + (mr() - 0.5) * sk,
    (mr() - 0.5) * sk +
      player.eye -
      (player.roll ? Math.sin((Math.PI * player.roll.t) / 0.32) * 0.55 : 0) +
      Math.sin(player.bob * 2) * 0.035 * spd * (player.eye < 1 ? 0.3 : 1) +
      (player.eye < 1 ? Math.sin(clock.time * 1.8) * 0.04 : 0),
    player.z,
  );
  gfx.camera.rotation.set(player.pitch, player.yaw, Math.sin(player.bob) * 0.004 * spd);
}
// 型だけの declare namespace で、関数の欄の型を付ける（組み立てで消える。古い JS の文をそのまま残すため）
export declare namespace updatePlayer {
  /** 階段の封の伝言を最後に出したゲームの時刻（src/lib/levels.ts の checkEvents が読み書きする） */
  let sealT: number | undefined;
}
