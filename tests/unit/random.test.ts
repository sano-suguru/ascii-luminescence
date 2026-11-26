// src/lib/random.ts と src/lib/glyphs.ts の単体テスト
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nth } from '../../src/lib/array.ts';
import { G, RUNE_CHARS } from '../../src/lib/glyphs.ts';
import { R, RI, keyedRand, mpick, mr, pick, rand, setRand, setSoundRand, shuffle, sndRand } from '../../src/lib/random.ts';
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

describe('sndRand（音の乱数）', () => {
  it('初めから、見た目の乱数（Math.random）とは別の並びで、Math.random を呼ばない（読み直した新しいモジュールで確かめる）', async () => {
    let calls = 0;
    Math.random = () => {
      calls++;
      return 0.5;
    };
    vi.resetModules();
    const fresh = await import('../../src/lib/random.ts');
    const xs = Array.from({ length: 1000 }, () => fresh.sndRand());
    expect(calls).toBe(0);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(990);
  });
  it('crypto が無い環境でも読めて、Math.random を呼ばない（初めのシードは時刻）', async () => {
    let calls = 0;
    Math.random = () => {
      calls++;
      return 0.5;
    };
    vi.stubGlobal('crypto', undefined);
    try {
      vi.resetModules();
      const fresh = await import('../../src/lib/random.ts');
      const xs = Array.from({ length: 100 }, () => fresh.sndRand());
      expect(calls).toBe(0);
      expect(new Set(xs).size).toBeGreaterThan(95);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('setSoundRand で入れ替え、前の物を返す。見た目の乱数と迷宮の乱数は進めない', () => {
    setRand(mulberry32(7));
    Math.random = mulberry32(9);
    const old = setSoundRand(mulberry32(202));
    try {
      const want = mulberry32(202);
      expect(Array.from({ length: 50 }, () => sndRand())).toEqual(Array.from({ length: 50 }, () => want()));
      expect([rand(), mr()]).toEqual([mulberry32(7)(), mulberry32(9)()]);
    } finally {
      setSoundRand(old);
    }
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

describe('keyedRand（出来事ごとの乱数）', () => {
  it('鍵が同じなら同じ並び、Math.random は呼ばない', () => {
    Math.random = () => {
      throw new Error('使わないはず');
    };
    const a = keyedRand('altar', 12345, 678),
      b = keyedRand('altar', 12345, 678);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('今の並びを残す（変わると、同じシードで祭壇・レベルアップ・眠る生き物などが変わる）', () => {
    const out: string[] = [];
    for (const [w, k] of [
      ['altar', [123456789, 1234]],
      ['lordaltar', [5, 6]],
      ['levelup', [42, 7]],
      ['slot', [1, 2]],
      ['vault', [3, 4]],
      ['sleep', [99]],
    ] as const) {
      const r = keyedRand(w, ...k);
      out.push(w, ...Array.from({ length: 3 }, () => r().toFixed(6)));
    }
    expect(out.join(' ')).toBe(
      'altar 0.702675 0.430698 0.914484 lordaltar 0.083914 0.494912 0.733143 levelup 0.518361 0.800761 0.944213 ' +
        'slot 0.105956 0.997003 0.508263 vault 0.023905 0.765351 0.270437 sleep 0.572020 0.684500 0.065073',
    );
  });
  it('名前か鍵が1つでも違えば、初めの値から違う（名前と鍵の境目も見る）', () => {
    const vals = [
      keyedRand('altar', 1, 2)(),
      keyedRand('altar', 1, 3)(),
      keyedRand('altar', 2, 2)(),
      keyedRand('altar', 2, 1)(),
      keyedRand('levelup', 1, 2)(),
      keyedRand('A')(),
      keyedRand('', 65)(),
      keyedRand('', 65, 0x10000)(),
      keyedRand('A', 0x10000)(),
      keyedRand('ab')(),
      keyedRand('a', 98)(),
    ];
    expect(new Set(vals).size).toBe(vals.length);
  });
  it('並んだ鍵（隣のマス・次のレベル）でも、初めの値はほぼ同じ割合で散らばる', () => {
    const buckets = Array.from({ length: 10 }, () => 0);
    for (let i = 0; i < 20000; i++) {
      const k = Math.floor(keyedRand('levelup', 777, i)() * 10);
      buckets[k] = nth(buckets, k) + 1;
    }
    for (const c of buckets) expect(Math.abs(c - 2000)).toBeLessThan(150);
  });
});
