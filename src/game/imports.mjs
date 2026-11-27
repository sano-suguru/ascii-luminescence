// ゲーム本体（src/game/*.js をつないで1つの関数で包んだもの）が使う、TypeScript のモジュール。
// 包みの関数の前（モジュールの一番上）に置かれる（tools/game-source.mjs の gameSource）。ここで読んだ名前は、どのファイルからも使える。
// src/game/ から TypeScript に移した物は、ここに足す。
import { clamp, mulberry32 } from '../lib/rng.ts';
import { boxText, clipHtml, padTo, visW, wrapPlain } from '../lib/text.ts';
import { makeHistory } from '../lib/history.ts';
import { G, RAMP_CH, RUNESET, RUNE_CHARS, SWAPSET, WG } from '../lib/glyphs.ts';
import { R, RI, keyedRand, mpick, mr, pick, rand, roll, setSoundRand, shuffle, sndRand, withVisualRand } from '../lib/random.ts';
import { dragonSleepForm } from '../lib/bodies/beasts.ts';
import { applySize, frame, setQuality, testTick, tick, withTestCam } from '../lib/loop.ts';
import { buildAtlas, cullChunks, flushDyn, makeWater } from '../lib/render.ts';
import { drawGallery, galleryDrag, galleryHold, galleryReset, galleryView, galleryWheel, galleryZoom, openBestiary, openRange, renderGallery, showBeast, trackSeen, updateGallery } from '../lib/gallery.ts';
import { beastSamples, beastSleep, SHADOW_KING_SC, shadowKingScale } from '../lib/bodies/lords.ts';
import {
  BASE_H, BRANCHES, CELL, CH_D, CHUNK, CXN, CZN, D4, FOGS, LQ_BOG, LQ_DEEP, LQ_LAVA, LQ_WATER, MH, MW, NCELL, NDL, NSL, PR, PROPHECIES,
  REALMS, SF_BRIM, SF_DEAD, SF_FOLIAGE, SF_FUNGFOR, SF_GRASS, SF_HAY, SF_ICE, SF_LUMEN, SF_MUD, SF_OBSIDIAN, SF_RUBBLE, TC, TF,
  TW, TX, VAULT_WALL_H, FINAL_DEPTH, VEIN_NAME, blocksWalk, cpos, FIRE_TYPES, } from '../lib/world.ts';
import { topLights } from '../lib/light.ts';
import { flowW, jagged, mCenter, sstep, turnDir } from '../lib/math.ts';
import { css } from '../lib/color.ts';
import {
  CAT_BR, CAT_NAME, ELEM_POW, RUNE_FONT, RUNE_TYPES, RALLY_FROM, SLEEP_MULT, SLOT_MAX, TIER_COL, TL, TRAITS, TRAIT_V, WEAPON, elemCount, handRunes, serRune, sp_elem, trList, trName, tv, RES, RUNE_DEF, detailLines, elemCol, modVal, modWorks, rollTraits, runeCol, runeName, syncHand, thingLabel,
} from '../lib/runes.ts';
import {
  allRunes, atkType, bodyN, canPutAt, effHand, equipWeapon, isTwo, makeRune, makeStrong, newHand, randomRuneType, applyOpen, resetRunes, restoreHands, slotSet, snapHands, specOf, syncHands, turnElem, wTL,
} from '../lib/gear.ts';
import { BLESS, META_DEF, UNLOCKS, expNeed, expOf } from '../lib/progress.ts';
import { MTYPES } from '../lib/creatures.ts';
import { drawViewWeapons } from '../lib/held.ts';
import {
  SPECIALS, STRATA, } from '../lib/strata.ts';
import { setNoiseSeed, vnoise } from '../lib/noise.ts';
import { ARTS, VAULTS } from '../lib/vaults.ts';
import { generateLevel } from '../lib/generate.ts';
import { buildLogo } from '../lib/title.ts';
import { buildIntroPanel, initIntro, redrawIntroLater } from '../lib/intro.ts';
import { dbg, dbgUrl, initDbg } from '../lib/debug.ts';
import { initInput, initPointer } from '../lib/input.ts';
import { DYN_VS, GLYPH_FS, PT_FS, PT_VS, STATIC_VS, WATER_FS, WATER_VS } from '../lib/shaders.ts';
import { ALTAR_W, MARK_H } from '../lib/hud.ts';
import { drawMap, sizeMap } from '../lib/minimap.ts';
import { BRANCH_HINT, DECO_K, DECO_NAMES, DUMMY_KINDS, FIX_NAMES, GALLERY_SLEEP, LEGEND_KINDS, LEGEND_ORDER, LORD_GAL, MACHINE_INFO, lookLine, mname } from '../lib/names.ts';
import { CHANT_STEPS, SND_NAME, VOWELS, sEnv } from '../lib/sound.ts';
import {
  castSound, sAlarm, sBoom, sBubble, sChime, sCreak, sDist, sHiss, sHowl, sndInit, sndPrep, sndReady, sndUpdate, sNoise, sOut, sRumble, sSplash, sSqueak, sTone, sWhoosh,
} from '../lib/audio.ts';
import {
  altarDetail, altarFill, altarLine, altarOpts, guardedNow, placeAltar, placeChosen, placeRunesForLevel, takeRune, vaultArea,
} from '../lib/altars.ts';
import { lockedOf, loreLeft, unlocked, weaponPool } from '../lib/unlocks.ts';
import {
  advance, checkEvents, computeFOV, die, generate, initEvents, newLevel, newRun, interAfter, interAt, isFinal, levelSeed, placeKey, settleSlotPick, setupFinal, showStratum, strataGrowth, updateFinal,
} from '../lib/levels.ts';
import { grabItem, openSlot, pickupItems, updateRockfall } from '../lib/pickup.ts';
import { msg, renderLog } from '../lib/log.ts';
import { buildsHave, renderHotbar } from '../lib/hotbar.ts';
import { applyBuild, renderInv, setInv, startSwap } from '../lib/inventory.ts';
import {
  bookRows, chronRows, cycleUi, drawMark, flyOpen, helpRows, isPaused, onNoticed, placeLabel, renderBook, renderChron, renderHelp, renderStatus, setHelp, flashHint, showHint, updateSearch, updateStealth,
} from '../lib/status.ts';
import { descentSealed, drawLegendWorld, getLegend, legendAll, legendOfBranch } from '../lib/legend.ts';
import { ceilAt, updateLights } from '../lib/lightmap.ts';
import { drawDoors, drawFixtures, drawGraves, drawRunesWorld, drawSprings, drawTraps, drawWebs, webTouch } from '../lib/fixtures.ts';
import { drawArrows } from '../lib/arrows.ts';
import { drawCastFx, updateCross } from '../lib/chantfx.ts';
import { addBolt, drawBoltFx, drawFire, drawFrozen, drawWave, drawZones, sparkCrown } from '../lib/fx.ts';
import { BRANCH_OMEN, REALM_OMEN, SPECIAL_OMEN, STRATUM_OMEN, drawOmens, drawStairSeal, omenOf, stairsGuarded } from '../lib/omens.ts';
import { loadBeasts, loadSet, recordBeast, saveMeta, saveSet } from '../lib/save.ts';
import { BL, canStep, chooseNext, fireNear, foe, hostile, makeMonster, statOf, summon, updateMonster } from '../lib/monsters.ts';
import { brimFlare, brimRecover, chillArea, crackIce, ignite, initFire, regrow, splash, stepFire, stepGas, tallAt, trample, updateCritter, updateFrozen, uploadCells } from '../lib/ground.ts';
import { updateEvents, updateTraps } from '../lib/events.ts';
import { loadSndLevel, lockFailed, menuOnHide, menuOnUnlock, relockClick, sndToggle, tryLock, updateResume } from '../lib/screens.ts';
import { addLooks } from '../lib/bodies/build.ts';
import { bogAura, dragonAura, drawMorph, houndAura, krakenAura, lichAura, nagaAura, salamanderAura, shadowAura, spiderAura, transformShadow } from '../lib/bodies/auras.ts';
import { P, dCol, dPar, dPos, dyn, initDust, ptCol, ptGly, ptPos, ptSize, spawn } from '../lib/particles.ts';
import { updateParticles } from '../lib/motes.ts';
import { rockAt, updateAtmosphere, updateSectionAir } from '../lib/camera.ts';
import { crumble, debrisInfo, updateDebris } from '../lib/debris.ts';
import { drawMonster, drawMonster0, drawTentacles } from '../lib/bodies/draw.ts';
import { look } from '../lib/look.ts';
import {
  aimOrigin, aimPoint, aimTarget, assistPoint, beamFrame, castPoint, doorBlock, drawSwing, groundPoint, handPoint, handUp, hittable, losClear, reflectDir, shotFrame, viewDir,
} from '../lib/aim.ts';
import {
  addZone, applyElem, applyHit, burstFire, castNow, castRapid, castStar, chainLightning, coldSnap, conductWater, damageMonster, dashCast, dashCuts, dropRune,
  fireBeam, fireWave, gainExp, hitFeedback, hitReact, hurtPlayer, inWater, landElem, later, lordFell, meleeCast, monsterStrike, nearestFoe, onDodged, onKilledBy,
  orbBurst, rallyOnHit, react, startRain, updateLife, updateRally, zapLine,
} from '../lib/combat.ts';
import { solidAt, updatePlayer } from '../lib/player.ts';
import { beginCast, releaseCast, startRoll, timeScale, updateCast } from '../lib/chant.ts';
import { cloudsMeetFire, monTimeK, updateProjs, updateStatuses } from '../lib/projs.ts';
import { awardLore, graveCandidates, graveRows, loreRows, resultPlace, runLore, saveGrave, startNewRun, victory } from '../lib/results.ts';
// three.js（r147）と光のにじみなどの部品 T、霧の色 fogCol
import { T, fogCol } from '../lib/three.ts';
import { buildWorld, setFog, updateWater } from '../lib/build.ts';
import { DLC, DLP, SL, SND, adv, beamHold, blaze, buf, cellData, clock, fight, gear, gfx, here, hudInfo, iceT, keys, lantern, placeMem, player, saved, stealth, ui, vfx, vmKick, edge, TEST, TEST_STEP, TESTQ, tickNoise, skipPhases } from '../lib/state.ts';
import { initFitIntro } from '../lib/layout.ts';
import { byInput, confirmTap, homeHint, initTouch } from '../lib/touch.ts';
import { TUNE, initTouchpad, releaseTouch } from '../lib/touchpad.ts';
import { autoGuard, autoSt, canOfferAuto, initAuto, startAuto } from '../lib/auto.ts';
import { initDiag } from '../lib/diag.ts';
import { took } from '../lib/took.ts';
import { closeAltar, updateAltarPanel } from '../lib/panels.ts';
import { returnToTitle, setMenu } from '../lib/menu.ts';
import { QUALITY, holdQuality, stepQuality } from '../lib/quality.ts';
