// src/lib/history.ts の単体テスト（年代記）
import { describe, expect, it } from 'vitest';
import { makeHistory } from '../../src/lib/history.ts';

// 32bit の FNV-1a（たくさんの結果を、短い値で比べるため）
const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
};

describe('makeHistory', () => {
  it('TypeScript に移す前と、同じシードで同じ歴史になる（乱数を引く順番が変わっていない）', () => {
    let all = '';
    for (let s = 0; s < 500; s++) all += JSON.stringify(makeHistory(s));
    expect(fnv(all)).toBe('86b388a2'); // 移す前の実装で出した値
    const h = makeHistory(202);
    expect(h.civ).toEqual({ name: 'ゼラ', ep: '光を編む民' });
    expect(h.events[0]).toEqual({ art: 'tower', text: '第一の王マグザは、石の迷宮の上にゼラの最初の都を築いた。', ruler: 0 });
  });
  it('王は5〜7人で、どの王にも出来事と戴冠の彫刻が1つずつある。出来事は重ならないことが多い', () => {
    let dup = 0;
    for (let s = 0; s < 300; s++) {
      const h = makeHistory(s);
      expect(h.rulers.length).toBeGreaterThanOrEqual(5);
      expect(h.rulers.length).toBeLessThanOrEqual(7);
      expect(h.events.map((e) => e.ruler)).toEqual(h.rulers.map((_, k) => k));
      expect(h.crowns.map((e) => e.ruler)).toEqual(h.rulers.map((_, k) => k));
      expect(h.events[0]?.art).toBe('tower'); // 最初の王は都を築く
      if (new Set(h.events.map((e) => e.text)).size < h.events.length) dup++;
    }
    expect(dup).toBeLessThan(30);
  });
});
