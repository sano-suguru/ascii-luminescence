// ゲーム本体（src/game/*.js をつないで1つの関数で包んだもの）が使う、TypeScript のモジュール。
// 包みの関数の前（モジュールの一番上）に置かれる（tools/game-source.mjs の gameSource）。ここで読んだ名前は、どのファイルからも使える。
// src/game/ から TypeScript に移した物は、ここに足す。
import { autoGuard } from '../lib/auto.ts';
import { addLooks } from '../lib/bodies/build.ts';
import { start } from '../lib/boot.ts';
import { MTYPES } from '../lib/creatures.ts';
import { initDbg } from '../lib/debug.ts';
import { initInput, initPointer } from '../lib/input.ts';
import { initIntro } from '../lib/intro.ts';
import { renderLog } from '../lib/log.ts';
import { applySize } from '../lib/loop.ts';
import { sizeMap } from '../lib/minimap.ts';
import { DUMMY_KINDS } from '../lib/names.ts';
import { initRenderer } from '../lib/render.ts';
import { RES } from '../lib/runes.ts';
import { loadSet } from '../lib/save.ts';
import { loadSndLevel } from '../lib/screens.ts';
import { adv, clock, saved, TEST, ui } from '../lib/state.ts';
import { initTestApi } from '../lib/testapi.ts';
import { installTestMode } from '../lib/testmode.ts';
import { buildLogo } from '../lib/title.ts';
