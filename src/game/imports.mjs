// ゲーム本体（src/game/*.js をつないで1つの関数で包んだもの）が使う、TypeScript のモジュール。
// 包みの関数の前（モジュールの一番上）に置かれる（tools/game-source.mjs の gameSource）。ここで読んだ名前は、どのファイルからも使える。
// src/game/ から TypeScript に移した物は、ここに足す。
import { clamp, mulberry32 } from '../lib/rng.ts';
import { boxText, padTo, visW, wrapPlain } from '../lib/text.ts';
import { makeHistory } from '../lib/history.ts';
