// src/lib/random.ts と src/lib/glyphs.ts の単体テスト
import { afterEach, describe, expect, it, vi } from 'vitest';
import { G, RUNE_CHARS } from '../../src/lib/glyphs.ts';
import { R, RI, mpick, mr, pick, rand, setRand, shuffle } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';

const random = Math.random;
afterEach(() => {
  Math.random = random;
  setRand(mr); // 迷宮の乱数は、このモジュールの中の状態。テストの並び順に頼らないように、毎回初めの形に戻す
});

const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
};

describe('rand・R・RI・pick（迷宮の乱数）', () => {
  it('setRand する前は、見た目の乱数（Math.random）と同じ（読み直した新しいモジュールで確かめる）', async () => {
    vi.resetModules();
    const fresh = await import('../../src/lib/random.ts');
    Math.random = () => 0.5;
    expect([fresh.rand(), fresh.R(0, 10), fresh.RI(0, 9), fresh.pick(['a', 'b', 'c', 'd'])]).toEqual([0.5, 5, 5, 'c']);
  });
  it('setRand した乱数を使い、TypeScript に移す前と同じ並びになる', () => {
    const LIST = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    setRand(mulberry32(202));
    const out: (number | string)[] = [];
    for (let i = 0; i < 500; i++) out.push(R(-3, 7), RI(0, 9), RI(-2, 2), pick(LIST), rand());
    const s = JSON.stringify(out);
    expect(s.length).toBe(23292);
    expect(fnv(s)).toBe('d601c721'); // 移す前の実装で出した値
  });
  it('入れ替えた後は Math.random を使わない。R は a 以上 b 未満、RI は a 以上 b 以下', () => {
    setRand(mulberry32(7));
    Math.random = () => {
      throw new Error('使わないはず');
    };
    for (let i = 0; i < 1000; i++) {
      const r = R(2, 5),
        n = RI(2, 5);
      expect(r >= 2 && r < 5).toBe(true);
      expect(Number.isInteger(n) && n >= 2 && n <= 5).toBe(true);
    }
  });
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

describe('G（文字の絵の表の番号）', () => {
  it('ASCII は 32 を引いた番号、ルーン文字は 96 から、無い文字は 31', () => {
    expect(G(' ')).toBe(0);
    expect(G('A')).toBe(33);
    expect(G('~')).toBe(94);
    expect(RUNE_CHARS.split('').map((c) => G(c))) // ルーン文字は、どれも UTF-16 の1単位
      .toEqual([96, 97, 98, 99, 100, 101, 102, 103, 104, 105]);
    expect(G('日')).toBe(31);
  });
});

describe('shuffle（混ぜる）', () => {
  it('その場で混ぜて同じ配列を返し、中身は変わらない。乱数は長さより1回少なく引く', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8];
    let n = 0;
    const g = mulberry32(5),
      r = () => (n++, g());
    expect(shuffle(a, r)).toBe(a);
    expect(a.toSorted((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(n).toBe(7);
    expect(shuffle([], r)).toEqual([]);
  });
  it('同じ乱数なら同じ並び（今の並びを残す。変わると、全部の階の形が変わる）', () => {
    setRand(mulberry32(202));
    const out = Array.from({ length: 50 }, (_, k) => shuffle(Array.from({ length: k }, (_, i) => i)).join(','));
    expect(fnv(out.join(';'))).toBe('30ef5ebc');
  });
  it('どの並びも、ほぼ同じ割合で出る（4つの物の24通り）', () => {
    const g = mulberry32(7),
      count = new Map<string, number>();
    for (let i = 0; i < 24000; i++) {
      const k = shuffle(['a', 'b', 'c', 'd'], g).join('');
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    expect(count.size).toBe(24);
    for (const c of count.values()) expect(Math.abs(c - 1000)).toBeLessThan(150);
  });
});
