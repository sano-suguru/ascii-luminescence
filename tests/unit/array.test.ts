// src/lib/array.ts（配列と表を読む道具）の単体テスト
import { describe, expect, it } from 'vitest';
import { lookup, nth } from '../../src/lib/array.ts';

describe('nth', () => {
  it('i 番目を返す（型付き配列も）', () => {
    expect(nth([3, 4, 5], 1)).toBe(4);
    expect(nth(new Uint8Array([7, 0]), 1)).toBe(0); // 0 や空の文字も、ある値として返す
    expect(nth([''], 0)).toBe('');
  });
  it('無ければ止まる（範囲の外・負・穴）', () => {
    expect(() => nth([1, 2], 2)).toThrow(RangeError);
    expect(() => nth([1, 2], -1)).toThrow(RangeError);
    expect(() => nth(new Float32Array(3), 3)).toThrow(RangeError);
    expect(() => nth([1, undefined, 3], 1)).toThrow(RangeError);
  });
});

describe('lookup', () => {
  it('欄の値を返す（0 や null も）', () => {
    expect(lookup({ a: 1, b: 0 }, 'b')).toBe(0);
    expect(lookup({ a: null }, 'a')).toBe(null);
  });
  it('無ければ止まる', () => {
    expect(() => lookup({ a: 1 }, 'z')).toThrow(RangeError);
  });
});
