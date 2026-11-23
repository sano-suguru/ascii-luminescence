// src/lib/random.ts と src/lib/glyphs.ts の単体テスト
import { afterEach, describe, expect, it } from 'vitest';
import { G, RUNE_CHARS } from '../../src/lib/glyphs.ts';
import { mpick, mr } from '../../src/lib/random.ts';

const random = Math.random;
afterEach(() => {
  Math.random = random;
});

describe('mr・mpick', () => {
  it('呼んだ時の Math.random を使う（テスト用モードが、モジュールを読んだ後に Math.random を入れ替えるため）', () => {
    Math.random = () => 0.25;
    expect(mr()).toBe(0.25);
    expect(mpick(['a', 'b', 'c', 'd'])).toBe('b');
    Math.random = () => 0.99;
    expect(mpick(['a', 'b', 'c', 'd'])).toBe('d');
  });
});

describe('G（文字の図鑑の番号）', () => {
  it('ASCII は 32 を引いた番号、ルーン文字は 96 から、無い文字は 31', () => {
    expect(G(' ')).toBe(0);
    expect(G('A')).toBe(33);
    expect(G('~')).toBe(94);
    expect(RUNE_CHARS.split('').map((c) => G(c))) // ルーン文字は、どれも UTF-16 の1単位
      .toEqual([96, 97, 98, 99, 100, 101, 102, 103, 104, 105]);
    expect(G('日')).toBe(31);
  });
});
