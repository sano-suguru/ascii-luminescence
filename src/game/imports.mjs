// ゲーム本体（src/game/*.js をつないで1つの関数で包んだもの）が使う、TypeScript のモジュール。
// 包みの関数の前（モジュールの一番上）に置かれる（tools/game-source.mjs の gameSource）。ここで読んだ名前は、どのファイルからも使える。
// src/game/ から TypeScript に移した物は、ここに足す。
import { clamp, mulberry32 } from '../lib/rng.ts';
import { boxText, padTo, visW, wrapPlain } from '../lib/text.ts';
import { makeHistory } from '../lib/history.ts';
import { G, RUNE_CHARS } from '../lib/glyphs.ts';
import { mpick, mr } from '../lib/random.ts';
import { BONE, FUR, GOLD, HRAMP, PALE, SCALE, SKINR, hsl2rgb, q3 } from '../lib/bodies/kit.ts';
import { bloatForm, bogForm, crabForm, critterForm, eelForm, fishForm, jellyForm, krakenForm, robotForm, shroomForm, snakeForm, spiderForm, wispForm } from '../lib/bodies/small.ts';
import {
  batForm,
  bogForm2,
  caveSpiderForm,
  dragonSleepForm,
  golemForm2,
  grazerForm,
  jackalForm,
  krakenForm2,
  nagaForm,
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
