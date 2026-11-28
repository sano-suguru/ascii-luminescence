// 大きさとメインループ。
// 画面の大きさに合わせる applySize、毎フレームの frame、テスト用モードの1歩 testTick、ゲームの一歩 stepTick・tick と、tick の段ごとの見た目の乱数
// （keyedPhase・tickRandOn・inPhase・inMobPhase）、テスト用モードの __test.cam で置いたカメラ（placeTestCam・withTestCam）、画質を変える setQuality。
import { must } from './array.ts';
import { drawSwing } from './aim.ts';
import { drawArrows } from './arrows.ts';
import { sndUpdate } from './audio.ts';
import { drawMonster } from './bodies/draw.ts';
import { updateAtmosphere, updateSectionAir } from './camera.ts';
import { timeScale, updateCast } from './chant.ts';
import { drawCastFx, updateCross } from './chantfx.ts';
import { updateLife } from './combat.ts';
import { updateDebris } from './debris.ts';
import { updateEvents, updateTraps } from './events.ts';
import { drawDoors, drawFixtures, drawRunesWorld, drawTraps, drawWebs } from './fixtures.ts';
import { drawBoltFx, drawFire, drawFrozen } from './fx.ts';
import { drawGallery, trackSeen, updateGallery } from './gallery.ts';
import { brimRecover, regrow, stepFire, stepGas, updateFrozen } from './ground.ts';
import { drawViewWeapons } from './held.ts';
import { drawLegendWorld } from './legend.ts';
import { advance, checkEvents, computeFOV, levelSeed, newLevel, newRun, updateFinal } from './levels.ts';
import { updateLights } from './lightmap.ts';
import { look } from './look.ts';
import { drawMap } from './minimap.ts';
import { updateMonster } from './monsters.ts';
import { updateParticles } from './motes.ts';
import { drawOmens } from './omens.ts';
import { updateAltarPanel } from './panels.ts';
import { pickupItems, updateRockfall } from './pickup.ts';
import { updatePlayer } from './player.ts';
import { cloudsMeetFire, monTimeK, updateProjs, updateStatuses } from './projs.ts';
import { holdQuality, QUALITY, type Quality, stepQuality } from './quality.ts';
import { keyedRand, mr, withVisualRand } from './random.ts';
import { cullChunks, flushDyn } from './render.ts';
import { clamp } from './rng.ts';
import {
  adv,
  buf,
  clock,
  gear,
  gfx,
  here,
  hudInfo,
  type Mob,
  player,
  skipPhases,
  TEST,
  TEST_STEP,
  TESTQ,
  tickNoise,
  ui,
  vfx,
} from './state.ts';
import { isPaused, renderStatus, setHelp, updateSearch, updateStealth } from './status.ts';
import { took } from './took.ts';

// ---------------------------------------------------------------- sizing
// why：何のために（'init'・'resize'・速さに合わせて解像度を下げた 'auto'・下げても速くならず戻した 'back'・比べる前に数えるのが途切れて戻した 'hold'）。大きさと解像度が前と同じなら、作り直さない
// （iOS は、画面の向きを変えると、同じ大きさの resize を続けて出すことがある。作り直すと、描く物の大きさを全部取り直すため）
/** 画面の大きさと描く細かさに合わせて、描画の部品とカメラを作り直す */
export function applySize(why: string): void {
  frame.stillDrawn = false;
  const w = window.innerWidth,
    h = window.innerHeight;
  if (gfx.sizedAs === w + 'x' + h + '@' + gfx.pixelRatio) return;
  gfx.sizedAs = w + 'x' + h + '@' + gfx.pixelRatio;
  const t0 = performance.now();
  must(gfx.renderer, '描画する部品').setPixelRatio(gfx.pixelRatio);
  must(gfx.renderer, '描画する部品').setSize(w, h, false);
  must(gfx.composer, '後処理をつなぐ部品').setPixelRatio(gfx.pixelRatio);
  must(gfx.composer, '後処理をつなぐ部品').setSize(w, h);
  gfx.camera.aspect = w / h;
  gfx.camera.updateProjectionMatrix();
  must(gfx.U, '分け合う値').uScale.value = (h * gfx.pixelRatio) / (2 * Math.tan((gfx.camera.fov * Math.PI) / 360));
  must(must(gfx.finalPass, '後処理').uniforms['uRes']).value.set(w * gfx.pixelRatio, h * gfx.pixelRatio);
  took('applySize', t0, { why, w, h, pr: +gfx.pixelRatio.toFixed(2) });
}

// ---------------------------------------------------------------- main loop
/** 毎フレーム（requestAnimationFrame）。テスト用モードでは、__test.frames(n) が頼んだ数だけ1歩ずつ進める */
export function frame(nowMs: number): void {
  requestAnimationFrame(frame);
  if (TEST) {
    if (TESTQ.n > 0) {
      TESTQ.n--;
      try {
        testTick(true);
      } finally {
        if (!TESTQ.n && TESTQ.done) {
          const d = TESTQ.done;
          TESTQ.done = null;
          d();
        }
      }
    }
    return;
  }
  const now = nowMs / 1000;
  let raw = clock.last ? now - clock.last : 0.016;
  clock.last = now;
  stepTick(raw, true);
}
// 止めている間に、一度描いたか（それからは描き直さない）
// oxlint-disable-next-line typescript/no-namespace -- 関数に覚えさせる欄の型（組み立てで消える）
export declare namespace frame {
  let stillDrawn: boolean;
}
/** テスト用モードの1歩（時計を TEST_STEP 進め、その間の setTimeout を流してから、1歩進める） */
export function testTick(draw: boolean): void {
  must(clock.TESTCLK, 'テスト用モードの時計').advance(TEST_STEP * 1000);
  stepTick(TEST_STEP, draw);
}
// one step of the game. While the bestiary shows a creature, the visual random (mr) reads the creature's own sequence (showBeast in src/lib/gallery.ts)
/** ゲームの一歩（図鑑で生き物を出している間は、その生き物の見た目の乱数の並びで包む） */
export function stepTick(raw: number, draw: boolean): void {
  const g = ui.gallery,
    r = g && g.mode === 'beast' && g.m ? g.rnd : null;
  if (r) withVisualRand(r, () => tick(raw, draw));
  else tick(raw, draw);
}
// tick の段ごとの見た目の乱数：tick を段（プレイヤー・世界・灯り・描く物の種類ごと・粒子・火の広がり・飛ぶ物…）に分け、段ごとに、何の段か・探索のシード・
// 何回目の tick か（clock.frame）を鍵にした新しい並びを読む（keyedRand）。生き物は1体ずつ、動きと描画を、階のシード・階で何体目か（m.seq）・何回目の tick か を鍵にした並びで読む。
// なので、ある段で見た目の乱数を引く回数が変わっても、ほかの段・ほかの生き物と、次の tick からは変わらない（見た目だけの変更で、生き物の動き・戦い・火の広がりがずれない）。
// 同じ段の中では、その tick の後の物がずれる。図鑑で生き物を出している間は、段に分けず、これまでどおり生き物の並びで tick を包む（stepTick）。
// tick の外（マウスやキーの処理・setTimeout）は、Math.random の並びのまま（tick の中では引かないので、tick の中の変更ではずれない）。
// テスト用モードの __test.tickNoise(n) は、どの段も終わりに見た目の乱数を n 回余分に引く（段を分けていれば、何も変わらないことを確かめる。tests/determinism.mjs）
/** fn を、並び r の見た目の乱数で呼ぶ（終わりに、__test.tickNoise の数だけ余分に引く） */
export const keyedPhase = <T>(r: () => number, fn: () => T): T =>
  withVisualRand(r, () => {
    const v = fn();
    for (let i = 0; i < tickNoise.n; i++) mr();
    return v;
  });
/** tick を段に分けるか（図鑑で生き物を出している間は分けない） */
export const tickRandOn = (): boolean => {
  const g = ui.gallery;
  return !(g && g.mode === 'beast' && g.m);
};
// テスト用モードの __test.skipPhase(names) で止めた段の名前（skipPhases）は、その段を飛ばす（何が光っているかを切り分ける時に。tools/glare.mjs の --hide）
/** tick の段 name（探索のシードと何回目の tick かを鍵にした見た目の乱数で呼ぶ） */
export const inPhase = <T>(name: string, fn: () => T): T | undefined =>
  skipPhases.has(name) ? undefined : tickRandOn() ? keyedPhase(keyedRand('tick ' + name, adv.runSeed, clock.frame), fn) : fn();
/** 生き物 m の tick の段 name（階のシード・階で何体目か・何回目の tick かを鍵にした見た目の乱数で呼ぶ） */
export const inMobPhase = <T>(name: string, m: Mob, fn: () => T): T | undefined =>
  skipPhases.has(name) ? undefined : tickRandOn() ? keyedPhase(keyedRand('tick ' + name, levelSeed(), m.seq, clock.frame), fn) : fn();
// テスト用モードの __test.cam で置いたカメラ（gfx.testCam：{pos, at, lvl}。null ならふだんどおり）。描く間（見える区切りを選ぶ所と描く所）だけ、このカメラにする。
// 置いた時の階（lvl）と違う階に移ったら、置いたカメラは捨てて目に戻す（岩の中かは置いた時の階でしか確かめていないので）。
// ゲームの一歩の間は目のカメラのままなので、術の出る所・手元の灯り・照準・見た時の説明は、ふだんどおりプレイヤーの目から。
// 手元の武器と詠唱の円は目の前に描くので、離れたカメラから写すと宙に浮く（要らなければ __test.skipPhase(['hands','castfx'])）。
// 生き物の光り方の強さ（近いほど弱める）と、こちらを向く飾りは、目からの距離と向きで決まる
/** カメラを、置いたカメラの位置に置き、見る点へ向ける */
export const placeTestCam = (): void => {
  const [x, y, z] = must(gfx.testCam, '置いたカメラ').pos,
    [ax, ay, az] = must(gfx.testCam, '置いたカメラ').at;
  gfx.camera.position.set(x, y, z);
  gfx.camera.rotation.set(Math.atan2(ay - y, Math.hypot(ax - x, az - z)), Math.atan2(-(ax - x), -(az - z)), 0);
};
// fn の間だけ、置いたカメラにする（置いていなければ、そのまま fn）
/** fn の間だけ、置いたカメラにする */
export const withTestCam = <T>(fn: () => T): T => {
  if (gfx.testCam && gfx.testCam.lvl !== here.D) gfx.testCam = null;
  if (!gfx.testCam) return fn();
  const c = gfx.camera,
    p = c.position.clone(),
    r = c.rotation.clone();
  placeTestCam();
  c.updateMatrixWorld();
  try {
    return fn();
  } finally {
    c.position.copy(p);
    c.rotation.copy(r);
    c.updateMatrixWorld();
  }
};
/** ゲームの一歩（raw：前のフレームからの実時間の秒。draw：描くか） */
export function tick(raw: number, draw: boolean): void {
  if (isPaused() && ui.started) {
    if (frame.stillDrawn) return;
    frame.stillDrawn = true;
  } else frame.stillDrawn = false;
  clock.frame++;
  const dt = isPaused() ? 0 : clamp(raw, 0, 0.05) * timeScale();
  clock.time += dt;
  const t = clock.time;
  must(gfx.U, '分け合う値').uTime.value = t;
  inPhase('trans', () => {
    if (here.trans) {
      here.trans.t += dt;
      if (here.trans.phase === 'out') {
        here.fade = 1 - here.trans.t / 0.8;
        if (here.trans.t >= 0.8) {
          if (here.trans.run) newRun();
          else {
            if (here.trans.regen) adv.runSeed = (Math.random() * 1e9) >>> 0;
            else advance(here.trans.go);
            newLevel();
          }
          here.trans = { phase: 'in', t: 0 };
          here.fade = 0;
        }
      } else {
        here.fade = here.trans.t / 1.3;
        if (here.trans.t >= 1.3) {
          here.trans = null;
          here.fade = 1;
        }
      }
    } else here.fade = Math.min(1, here.fade + dt * 0.8);
  });
  inPhase('player', () => {
    updatePlayer(dt);
    updateStealth(dt);
    updateStatuses(dt);
  });
  for (const m of here.monsters) if (!m.galShow && !m.ty.dummy) inMobPhase('mob', m, () => updateMonster(m, dt * monTimeK(m), t));
  if (here.monsters.some((m) => m.dead)) here.monsters = here.monsters.filter((m) => !m.dead);
  hudInfo.pfFrames++;
  hudInfo.pfT += raw;
  if (hudInfo.pfT >= 0.5) {
    hudInfo.pfFps = Math.round(hudInfo.pfFrames / hudInfo.pfT);
    hudInfo.pfFrames = 0;
    hudInfo.pfT = 0;
    if (ui.perfOn) renderStatus();
  }
  inPhase('world', () => {
    regrow();
    brimRecover(dt);
    if (!adv.dead) {
      updateTraps(dt);
      updateSearch(dt);
    }
    updateLife(dt);
  });
  inPhase('lights', () => {
    updateLights(t);
    updateAtmosphere(dt);
    updateSectionAir(dt);
  });
  buf.dn = 0;
  inPhase('fixtures', () => drawFixtures(t, dt));
  inPhase('doors', () => drawDoors(t, dt));
  inPhase('fire', () => drawFire(t, dt));
  inPhase('webs', () => drawWebs(t));
  inPhase('traps', () => drawTraps(t));
  inPhase('swing', () => drawSwing());
  inPhase('hands', () => drawViewWeapons(t));
  inPhase('omens', () => drawOmens(t, dt));
  inPhase('runes', () => {
    drawRunesWorld(t);
    updateAltarPanel();
    drawArrows();
    drawLegendWorld(t);
  });
  inPhase('rockfall', () => {
    if (!here.trans) updateRockfall(dt);
  }); // 階を移り始めたら、石は落ちず、当たらない（新しい階で newLevel が消す）
  inPhase('bolt', () => drawBoltFx(t, dt));
  inPhase('gallery', () => drawGallery(t));
  inPhase('frozen', () => drawFrozen(t));
  inPhase('castfx', () => drawCastFx(t));
  for (const m of here.monsters) inMobPhase('mob draw', m, () => drawMonster(m, t));
  inPhase('debris', () => updateDebris(dt));
  flushDyn();
  inPhase('particles', () => updateParticles(dt, t));
  clock.fovT += dt;
  if (clock.fovT > 0.1) {
    clock.fovT = 0;
    inPhase('fov', () => {
      computeFOV();
      checkEvents(false);
      look();
    });
    inPhase('gas', () => stepGas());
    inPhase('spread', () => stepFire());
  }
  clock.mapT += dt;
  if (clock.mapT > 0.11) {
    clock.mapT = 0;
    if (ui.uiMode === 0) inPhase('map', () => drawMap());
  }
  if (ui.helpT > 0) {
    ui.helpT -= dt;
    if (ui.helpT <= 0 && ui.helpOn) setHelp(false);
  }
  must(must(gfx.finalPass, '後処理').uniforms['uTime']).value = t;
  must(must(gfx.finalPass, '後処理').uniforms['uFade']).value = clamp(here.fade, 0, 1);
  must(must(gfx.finalPass, '後処理').uniforms['uHurt']).value =
    vfx.hurtFlash + (player.hp < adv.PLAYER_MAX * 0.25 && !adv.dead ? 0.18 + 0.08 * Math.sin(t * 4) : 0);
  inPhase('pickup', () => {
    if (ui.started && !here.trans && !adv.dead && !isPaused()) pickupItems();
  });
  inPhase('cast', () => {
    if (gear.hands) updateCast(dt);
  });
  inPhase('final', () => updateFinal(dt));
  inPhase('galstep', () => updateGallery(dt));
  inPhase('seen', () => trackSeen(dt));
  inPhase('thaw', () => {
    updateFrozen(dt);
    cloudsMeetFire();
  });
  inPhase('cross', () => updateCross(raw));
  inPhase('projs', () => updateProjs(dt));
  inPhase('sound', () => sndUpdate(dt));
  inPhase('events', () => updateEvents(dt, t));
  withTestCam(() => {
    cullChunks();
    if (draw) must(gfx.composer, '後処理をつなぐ部品').render(dt);
  });
  if (TEST) return; // keep the resolution fixed in tests
  // 速さに合わせて画質を下げる（src/lib/quality.ts）。数えるのは探索中だけ（階を移る途中・止まっている間・タイトルと図鑑は数えない。
  // 階を作る一瞬の遅れで下がらないように）。数えないフレームが来たら、そこから3秒は様子を見てから数え直す
  if (!ui.started || here.trans || isPaused() || document.hidden) {
    clock.warm = clock.perfT = clock.perfAcc = clock.perfN = 0;
    if (gfx.qRun.prev) {
      gfx.qRun = holdQuality(gfx.qRun);
      setQuality(gfx.qRun.q, 'hold');
    }
    return;
  }
  clock.warm += raw;
  if (clock.warm > 3) {
    clock.perfAcc += raw;
    clock.perfN++;
    clock.perfT += raw;
    if (clock.perfT > QUALITY.span) {
      gfx.qRun = stepQuality(clock.perfAcc / clock.perfN, {
        ...gfx.qRun,
        q: { pr: gfx.pixelRatio, bloom: must(gfx.bloom, '光のにじみ').enabled },
      });
      clock.perfT = clock.perfAcc = clock.perfN = 0;
      setQuality(gfx.qRun.q, gfx.qRun.done ? 'back' : 'auto');
    }
  }
}
// 画質を q にする。変えたら、作り直した直後の遅いフレームを次の比べに数えないように、3秒おいてから数え直す
/** 画質（描く細かさと光のにじみ）を q にする */
export function setQuality(q: Quality, why: string): void {
  if (q.pr === gfx.pixelRatio && q.bloom === must(gfx.bloom, '光のにじみ').enabled) return;
  const pr0 = gfx.pixelRatio;
  gfx.pixelRatio = q.pr;
  must(gfx.bloom, '光のにじみ').enabled = q.bloom;
  clock.warm = clock.perfT = clock.perfAcc = clock.perfN = 0;
  if (q.pr !== pr0) applySize(why);
  else took('quality', performance.now(), { bloom: q.bloom, why });
}
