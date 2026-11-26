// 乱数（もとは src/game/02-constants.js の mr・mpick・rand・R・RI・pick）。
//   見た目の乱数（mr・mpick）：Math.random。テスト用モードでは、シードで決まる物に入れ替わる
//   迷宮の乱数（rand・R・RI・pick）：迷宮の生成が、階ごとのシードで setRand して使う。同じシードなら同じ迷宮になる
//   出来事ごとの乱数（keyedRand）：祭壇の中身・レベルアップの選択肢など、遊びの中身を選ぶ所が、出来事の鍵から作る。見た目の乱数の並びに左右されない
//   音の乱数（sndRand）：音だけが使う、見た目の乱数とは別の並び。音を足したり変えたりしても、見た目の乱数の並びは変わらない
import { nth } from './array.ts';
import { mulberry32 } from './rng.ts';

/**
 * Math.random を呼ぶ。呼んだ時の Math.random を使う（テスト用モードは、ゲームの最初に Math.random をシードで決まる物に入れ替える。
 * このモジュールはそれより先に読まれるので、読んだ時の Math.random を覚えておくと、入れ替える前の物を使ってしまう）
 */
export const mr = (): number => Math.random();

/** 配列から1つ選ぶ（mr を使う）。空の配列は渡さないこと */
export const mpick = <T>(a: readonly T[]): T => nth(a, Math.floor(mr() * a.length));

// 今の迷宮の乱数。初めは見た目の乱数と同じ（迷宮の生成が、階ごとに setRand で入れ替える）
let current: () => number = mr;

/** 迷宮の乱数（0 以上 1 未満） */
export const rand = (): number => current();
/** 迷宮の乱数を入れ替える（例：setRand(mulberry32(seed))） */
export const setRand = (f: () => number): void => {
  current = f;
};
/** a 以上 b 未満の数（迷宮の乱数） */
export const R = (a: number, b: number): number => a + rand() * (b - a);
/** a 以上 b 以下の整数（迷宮の乱数） */
export const RI = (a: number, b: number): number => Math.floor(a + rand() * (b - a + 1));
/** 配列から1つ選ぶ（迷宮の乱数）。空の配列は渡さないこと */
export const pick = <T>(a: readonly T[]): T => nth(a, Math.floor(rand() * a.length));
/**
 * 配列をその場で混ぜて、同じ配列を返す（フィッシャー・イェーツ。乱数を配列の長さより1回少なく引く）。
 * 混ぜるのに .sort(() => r() - 0.5) は使わない：でたらめな値を返す比べる関数での並びは、JS の決まりでは
 * エンジン次第で、Chromium では最適化の前と後でも変わる（同じシードで違う迷宮になっていた）
 */
export const shuffle = <T>(a: T[], r: () => number = rand): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = nth(a, i);
    a[i] = nth(a, j);
    a[j] = t;
  }
  return a;
};

/**
 * 出来事ごとの乱数を作る。鍵（何の出来事か・階のシード・マスなど）を混ぜたシードで、新しい並びを作る。
 * 鍵が同じなら、いつも同じ並びになり、見た目の乱数も、ほかの出来事の順番も関わらない。祭壇の中身・レベルアップの選択肢など、遊びの中身を選ぶ所で使う
 */
export const keyedRand = (...keys: readonly (string | number)[]): (() => number) => {
  let h = 0x811c9dc5;
  const mix = (v: number): void => {
    h = Math.imul(h ^ v, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  };
  for (const k of keys)
    if (typeof k === 'number') mix(k >>> 0);
    else {
      for (let i = 0; i < k.length; i++) mix(k.charCodeAt(i));
      mix(0x10000); // 文字列の終わり（文字の番号より大きい数）。'ab' と 'a','b' を分ける
    }
  return mulberry32(h >>> 0);
};

// 今の音の乱数。初めのシードは crypto で決める（crypto が無い環境では時刻）。Math.random は使わない：テスト用モードが
// Math.random を入れ替える前か後かによらず、見た目の乱数の並びを進めないため。テスト用モードは、ゲームの最初に setSoundRand でシードで決まる物に入れ替える
const firstSeed = (): number => {
  const c: Crypto | undefined = globalThis.crypto;
  return c ? (c.getRandomValues(new Uint32Array(1))[0] ?? 0) : Date.now() >>> 0;
};
let sound: () => number = mulberry32(firstSeed());

/** 音の乱数（0 以上 1 未満）。音の高さ・長さ・左右のゆらぎや、まわりの音を鳴らすかなど、音だけに使う */
export const sndRand = (): number => sound();
/** 音の乱数を入れ替え、前の物を返す（例：setSoundRand(mulberry32(seed))。テストは、返った物で元に戻す） */
export const setSoundRand = (f: () => number): (() => number) => {
  const old = sound;
  sound = f;
  return old;
};

/** a 以上 b 以下の整数（見た目の乱数 mr。もとは src/game/18-level-player.js） */
export const roll = (a: number, b: number): number => a + Math.floor(mr() * (b - a + 1));
