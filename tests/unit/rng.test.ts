// src/lib/rng.ts の単体テスト
import { describe, expect, it } from 'vitest';
import { clamp, mulberry32 } from '../../src/lib/rng.ts';

describe('mulberry32', () => {
  it('同じシードなら同じ並び（ゲームの年代記や生成が、この並びに頼っている）', () => {
    const r = mulberry32(202);
    expect([r(), r(), r()]).toEqual([0.1287418524734676, 0.9633730442728847, 0.2188588441349566]);
    const a = mulberry32(7),
      b = mulberry32(7);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('0 以上 1 未満の値を返す', () => {
    for (const seed of [0, 1, -1, 0xffffffff, 2 ** 40]) {
      const r = mulberry32(seed);
      for (let i = 0; i < 1000; i++) {
        const v = r();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });
});

describe('clamp', () => {
  it('範囲に収める', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
