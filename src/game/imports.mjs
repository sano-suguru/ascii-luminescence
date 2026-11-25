// ゲーム本体（src/game/*.js をつないで1つの関数で包んだもの）が使う、TypeScript のモジュール。
// 包みの関数の前（モジュールの一番上）に置かれる（tools/game-source.mjs の gameSource）。ここで読んだ名前は、どのファイルからも使える。
// src/game/ から TypeScript に移した物は、ここに足す。
import { clamp, mulberry32 } from '../lib/rng.ts';
import { boxText, padTo, visW, wrapPlain } from '../lib/text.ts';
import { makeHistory } from '../lib/history.ts';
import { G, RAMP_CH, RUNESET, RUNE_CHARS, SWAPSET, WG } from '../lib/glyphs.ts';
import { R, RI, mpick, mr, pick, rand, roll, shuffle } from '../lib/random.ts';
import { BONE, FUR, GOLD, HRAMP, PALE, SKINR, q3 } from '../lib/bodies/kit.ts';
import { bloatForm, bogForm, crabForm, critterForm, eelForm, fishForm, jellyForm, krakenForm, robotForm, shroomForm, snakeForm, spiderForm, trollForm, wispForm } from '../lib/bodies/small.ts';
import {
  batForm,
  bogForm2,
  caveSpiderForm,
  dragonForm,
  dragonSleepForm,
  golemForm2,
  grazerForm,
  jackalForm,
  krakenForm2,
  nagaForm,
  ogreForm,
  phantomForm,
  ratForm,
  salamanderForm,
  trollForm2,
  wraithForm2,
} from '../lib/bodies/beasts.ts';
import {
  BEAST_S,
  HUM_PROP,
  KRAKEN_T,
  KRAKEN_W,
  LOOK_PROP,
  beastAcc,
  beastForm,
  beastSleep,
  cleanerForm,
  golemForm,
  repairerForm,
  shadowKingForm,
  watcherForm,
} from '../lib/bodies/lords.ts';
import { lichKingForm, nagaQueenForm, oldDragonForm, shadowSerpentForm, spiderQueenForm } from '../lib/bodies/bosses.ts';
import {
  BASE_H, BRANCHES, CELL, CH_D, CHUNK, CXN, CZN, D4, EYE, FOGS, LQ_BOG, LQ_DEEP, LQ_LAVA, LQ_WATER, MH, MW, NCELL, NDL, NSL, PR, PROPHECIES,
  REALMS, SF_BRIM, SF_DEAD, SF_FOLIAGE, SF_FUNGFOR, SF_GRASS, SF_HAY, SF_ICE, SF_LUMEN, SF_MUD, SF_OBSIDIAN, SF_RUBBLE, TC, TF, TP,
  TW, TX, VAULT_WALL_H, FINAL_DEPTH, VEIN_COL, VEIN_NAME, blocksWalk, cpos, FIRE_TYPES, } from '../lib/world.ts';
import { LANTERN, topLights } from '../lib/light.ts';
import { flowW, jagged, lerpAngle, mCenter, sstep, turnDir } from '../lib/math.ts';
import { css, cssOf, hsl2rgb } from '../lib/color.ts';
import {
  CAT_BR, CAT_NAME, ELEM_POW, REACT, RUNE_FONT, RUNE_TYPES, RALLY_FROM, SLEEP_MULT, SLOT_MAX, TIER_COL, TL, TRAITS, TRAIT_V, TWO_SLOTS, WEAPON, elemCount, emptyChip, handRunes, serRune, sp_elem, trList, trName, tv, weaponCol,
  RES, RUNE_DEF, detailLines, elemCol, handName, modTargets, modVal, modWorks, rollTraits, runeCol, runeName, runeShort, syncHand, thingLabel, trDesc,
} from '../lib/runes.ts';
import {
  allRunes, atkType, bodyN, canPutAt, effHand, equipWeapon, freeSlotFor, handsKey, isTwo, makeRune, makeStrong, newHand, randomRuneType, restoreHands, slotSet, snapHands, syncHands, turnElem, wTL,
} from '../lib/gear.ts';
import { BL, BLESS, META_DEF, UNLOCKS, expNeed, expOf } from '../lib/progress.ts';
import { MTYPES } from '../lib/creatures.ts';
import { VM_K, VM_MIRROR, VM_ST, vmGlyph, vmGlyphS } from '../lib/hands.ts';
import {
  SPECIALS, STRATA, stratumAtDepth, } from '../lib/strata.ts';
import { setNoiseSeed, vnoise } from '../lib/noise.ts';
import { VAULTS } from '../lib/vaults.ts';
import { generateLevel } from '../lib/generate.ts';
import { LOGO_ART, TITLE_LINES } from '../lib/title.ts';
import { DUST_N, DYN_MAX, DYN_VS, GAS_N, GLYPH_FS, P0, PT_FS, PT_TOTAL, PT_VS, P_MAX, STATIC_VS, WATER_FS, WATER_VS } from '../lib/shaders.ts';
import { ALTAR_W, BAG_LINES, LIGHT_COLS, LIGHT_NAMES, MARK_H, MCH, MCW, MMC, MMR, MPAD, PACK_SLOT, PACK_W, tone } from '../lib/hud.ts';
import { AVATAR_TY, BRANCH_HINT, DECO_K, DECO_NAMES, DUMMY_KINDS, FIX_NAMES, LEGEND_KINDS, LEGEND_ORDER, LORD_GAL, TRAP_INFO, lookLine, mname } from '../lib/names.ts';
import { CHANT_STEPS, SND_LV, SND_NAME, VOWELS, sEnv } from '../lib/sound.ts';
import {
  sAlert, sBoom, sBubble, sChime, sCrackleBurst, sCreak, sDist, sDrip, sHiss, sNoise, sOut, sRoar, sRumble, sSplash, sSqueak, sTone, sWhoosh, sndInit, sndReady, sndUpdate,
} from '../lib/audio.ts';
import {
  altarDetail, altarFill, altarLine, altarOpts, guardedNow, mergeMod, nearStele, placeAltar, placeChosen, placeRunesForLevel, runeDest, takeRune, vaultArea,
} from '../lib/altars.ts';
import { lockedOf, trialOn, unlocked, weaponPool } from '../lib/unlocks.ts';
import { levelSeed } from '../lib/levels.ts';
import { msg, renderLog } from '../lib/log.ts';
import { renderHotbar } from '../lib/hotbar.ts';
import { redraw } from '../lib/redraw.ts';
import { saveMeta, saveSet } from '../lib/save.ts';
import { statOf } from '../lib/monsters.ts';
// three.js（r147）。npm の three から読んで、組み立てに入れる（CDN からは読まない）。
// 光のにじみの4つの部品（examples/jsm の EffectComposer・RenderPass・ShaderPass・UnrealBloomPass）は、古い JS が T.EffectComposer などで使うので、00-test-mode.js で T に一緒に入れる
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SND, adv, blaze, clock, fight, gear, here, hudInfo, keys, lantern, msgs, placeMem, player, saved, stealth, ui, vfx } from '../lib/state.ts';
