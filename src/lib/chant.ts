// 詠唱と転がり：ゲームの時間の速さ、溜め始める・放つ・溜めの途中、溜めが散る、転がり。
// 状態の入れ物 gear（両手・溜め・持ち替え・詠唱の声）・fight・player・adv・here・ui・clock に頼る。
import { lookup, must, nth } from './array.ts';
import { aimOrigin, castPoint, handPoint, viewDir } from './aim.ts';
import { chantStart, sChime, sWhoosh } from './audio.ts';
import { castNow, fireBeam } from './combat.ts';
import { type Side, atkType, bodyN, restoreHands, turnElem, wTL } from './gear.ts';
import { G } from './glyphs.ts';
import { renderHotbar } from './hotbar.ts';
import { BL } from './monsters.ts';
import { spawn } from './particles.ts';
import { mpick, mr } from './random.ts';
import { RUNE_DEF, TRAIT_V, elemCol } from './runes.ts';
import { adv, clock, fight, gear, here, keys, player, ui } from './state.ts';
import { isPaused } from './status.ts';

/** ゲームの時間の速さ（ヒットストップ中は 1/20、溜めている間は半分） */
export const timeScale = (): number => (performance.now() < fight.hitStopUntil ? 0.05 : gear.castSt ? 0.5 : 1);
/** 手 h で溜め始める（溜めの要らない武器と素手は、すぐ放つ）。詠唱の声を鳴らし始める */
export function beginCast(h: Side): void {
  if (
    adv.dead ||
    here.trans ||
    !ui.started ||
    isPaused() ||
    gear.swapSt ||
    gear.castSt ||
    (fight.beamRun && !fight.beamRun.auto) ||
    (player.netT ?? NaN) > 0 ||
    player.roll
  )
    return;
  if ((player.recover || 0) > 0) return;
  const H = must(gear.hands)[h];
  if (!H.atk) {
    castNow(h);
    return;
  }
  const at = atkType(h),
    def = lookup(RUNE_DEF, must(at));
  if ((def.chant ?? NaN) <= 0) {
    castNow(h);
    return;
  }
  let needK = 1;
  if (clock.time < (player.qcUntil || 0)) {
    needK *= 0.5;
    player.qcUntil = 0;
  }
  if (BL('desperate') && player.hp < adv.PLAYER_MAX * 0.5) needK *= BL('desperate') >= 2 ? 0.55 : 0.7;
  gear.castSt = {
    h,
    t: 0,
    need: (def.chant ?? NaN) * Math.max(0.4, 1 - 0.3 * bodyN('quick')) * nth(TRAIT_V.charge, wTL(h, 'charge')) * needK,
    full: false,
    hold: 0,
    beam: at === 'beam',
    firing: false,
    tick: 0,
    beamT: 0,
  };
  if (gear.humNode) gear.humNode.stop();
  gear.humNode = chantStart(H.elem ? H.elem.type : null);
}
/** 溜めが散る（手の前に灰色の粒） */
export function fizzle(): void {
  const [ox, oy, oz] = aimOrigin(),
    [dx, dy, dz] = viewDir();
  for (let q = 0; q < 8; q++) {
    const a = mr() * 6.28;
    spawn(
      ox + dx * 0.7,
      oy - 0.3 + dy * 0.7,
      oz + dz * 0.7,
      Math.cos(a) * 0.6,
      0.2 + mr() * 0.4,
      Math.sin(a) * 0.6,
      0.5,
      G(mpick(['.', "'"])),
      0.1,
      0.6,
      0.55,
      0.75,
      0,
    );
  }
}
/** 手 h のボタンを離した（溜めきっていれば放つ。足りなければ散る） */
export function releaseCast(h: Side): void {
  if (!gear.castSt || gear.castSt.h !== h) return;
  const c = gear.castSt;
  gear.castSt = null;
  if (c.full) castNow(h, { chanted: true, hold: c.hold });
  else fizzle();
}
/**
 * 溜めと、撃ち続ける光線・発動の待ち・立ち直り・持ち替えを進める（溜めきると光の粒。溜めきって2秒たつと放つ。詠唱の声に溜まった割合を伝える。
 * 0.1 秒ごとに下の HUD を描き直す）
 */
export function updateCast(dt: number): void {
  if (!gear.castSt && gear.humNode) {
    gear.humNode.stop();
    gear.humNode = null;
  }
  if (fight.beamRun) {
    fight.beamRun.t -= dt;
    fight.beamRun.tick -= dt;
    if (fight.beamRun.tick <= 0) {
      fight.beamRun.tick = 0.15;
      fireBeam(fight.beamRun.h, fight.beamRun.dir, fight.beamRun.dir ? handPoint(fight.beamRun.h) : null, fight.beamRun.auto);
    }
    if (fight.beamRun.t <= 0) {
      turnElem(fight.beamRun.h);
      fight.beamRun = null;
      fight.beamSegs = [];
    }
  }
  fight.trigCd.L = Math.max(0, fight.trigCd.L - dt);
  fight.trigCd.R = Math.max(0, fight.trigCd.R - dt);
  player.recover = Math.max(0, (player.recover || 0) - dt);
  if (gear.swapSt) {
    gear.swapSt.t += dt;
    if (gear.swapSt.t >= gear.swapSt.dur) {
      gear.swapSt = null;
      if (BL('swapedge')) player.swapEdgeUntil = clock.time + 3;
      sChime(player.x, player.z, 0.25);
      renderHotbar();
    } else if (((gear.swapSt.t * 10) | 0) !== gear.swapSt.last) {
      gear.swapSt.last = (gear.swapSt.t * 10) | 0;
      renderHotbar();
    }
  }
  if (!gear.castSt) return;
  if (!ui.started || adv.dead || here.trans) {
    gear.castSt = null;
    fight.beamSegs = [];
    return;
  }
  gear.castSt.t += dt;
  if (!gear.castSt.full && gear.castSt.t >= gear.castSt.need) {
    gear.castSt.full = true;
    const P = castPoint(gear.castSt.h, 1),
      c = elemCol(must(gear.hands)[gear.castSt.h].elem ? must(must(gear.hands)[gear.castSt.h].elem).type : null);
    for (let q = 0; q < 14; q++) {
      const a = mr() * 6.28;
      spawn(
        P[0],
        P[1],
        P[2],
        Math.cos(a) * 1.2,
        (mr() - 0.4) * 1.2,
        Math.sin(a) * 1.2,
        0.35,
        G('*'),
        0.05,
        nth(must(c), 0) * 3,
        nth(must(c), 1) * 3,
        nth(must(c), 2) * 3,
        0,
      );
    }
  }
  if (gear.humNode && gear.humNode.tick) gear.humNode.tick(Math.min(1, gear.castSt.t / Math.max(0.01, gear.castSt.need)), gear.castSt.full);
  if (gear.castSt.full) {
    gear.castSt.hold += dt;
    if (gear.castSt.hold > 2) {
      const hh = gear.castSt.h;
      gear.castSt = null;
      castNow(hh, { chanted: true, hold: 2 });
    }
  }
  if (((clock.time * 10) | 0) !== updateCast.last) {
    updateCast.last = (clock.time * 10) | 0;
    renderHotbar();
  }
}
/**
 * 下の HUD を最後に描き直した時の、ゲームの時刻の 0.1 秒の番号（関数の欄。updateCast が読み書きする）。
 * 型だけの declare namespace で欄の型を付ける（組み立てで消える）
 */
export declare namespace updateCast {
  let last: number | undefined;
}
/** かわす転がり：動いている向き（止まっていれば前）へ素早く転がる。持ち替え・溜め・撃ち続ける光線は止める */
export function startRoll(): void {
  if (adv.dead || here.trans || (player.rollCd || 0) > 0 || (player.netT ?? NaN) > 0 || player.roll) return;
  const k = keys,
    fw = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0),
    st = (k['KeyD'] ? 1 : 0) - (k['KeyA'] ? 1 : 0),
    sy = Math.sin(player.yaw),
    cy = Math.cos(player.yaw);
  let ix = -sy * fw + cy * st,
    iz = -cy * fw - sy * st;
  const l = Math.hypot(ix, iz);
  if (l < 0.01) {
    ix = sy;
    iz = cy;
  } else {
    ix /= l;
    iz /= l;
  }
  player.roll = { t: 0, dx: ix, dz: iz };
  player.rollCd = 1.0;
  sWhoosh();
  if (gear.swapSt) {
    restoreHands(gear.swapSt.snap);
    gear.swapSt = null;
    renderHotbar();
  }
  if (gear.castSt) {
    gear.castSt = null;
    fight.beamSegs = [];
    fizzle();
    renderHotbar();
  }
  if (fight.beamRun) {
    fight.beamRun = null;
    fight.beamSegs = [];
  }
  for (let q = 0; q < 10; q++) {
    const a = mr() * 6.28;
    spawn(
      player.x,
      0.1,
      player.z,
      Math.cos(a) * 0.8,
      0.2 + mr() * 0.4,
      Math.sin(a) * 0.8,
      0.6,
      G(mpick(['.', ',', "'"])),
      0.14,
      0.5,
      0.48,
      0.55,
      1,
    );
  }
}
