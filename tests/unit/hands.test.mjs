// 手元の武器（src/lib/hands.ts の形と色の表と VM_FIST、src/lib/held.ts の drawViewWeapons）の単体テスト。
// 指紋は、hands-cases.mjs の場合の結果（移す前の古い JS と、バイトまで同じだった値）。動きを意図して変えた時や、場合の入力を変えた時は、
// 変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽のカメラを本物の型に合わせられないためと、古い JS の関数と同じ台本（hands-cases.mjs）で比べたため。
import { describe, expect, it } from 'vitest';
import * as H from '../../src/lib/hands.ts';
import * as W from '../../src/lib/held.ts';
import { caseOut } from './case-out.mjs';
import { handsCases } from './hands-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('移す前と同じ', () => {
  it('手元の武器の表と描く処理（400の場合）の指紋', { timeout: 60000 }, async () => {
    const body = await handsCases({ ...H, ...W }, 400);
    caseOut('hands', body);
    expect([fnv(body), body.length]).toEqual(['d6c0eb89', 4005493]);
    // 場合が中身を通っているか：描かずに戻る・描く・性質の火花が出る
    expect(body).toMatch(/ dn=0 pN=0 /);
    expect(body).toMatch(/ dn=[1-9]\d* pN=0 /);
    expect(body).toMatch(/ dn=[1-9]\d* pN=[1-9]/);
  });
});

describe('線の向きの文字 vmGlyph', () => {
  // 画面での線の向き（度。0 が右、90 が上）の、境（22.5・67.5・112.5・157.5）の前後。反対の向き（+180）・負の角度も同じ文字
  const CASES = [
    [0, '-'],
    [22, '-'],
    [23, '/'],
    [45, '/'],
    [67, '/'],
    [68, '|'],
    [90, '|'],
    [112, '|'],
    [113, '\\'],
    [135, '\\'],
    [157, '\\'],
    [158, '-'],
    [179.6, '-'],
  ];
  it.each(CASES)('%s 度の線は %s', (deg, g) => {
    for (const a of [deg, deg + 180, deg - 180, deg - 360]) {
      const r = (a * Math.PI) / 180;
      expect(H.vmGlyph(Math.cos(r), Math.sin(r))).toBe(g);
    }
  });
  it('vmGlyphS は、目から見た2点を奥行きで割った画面での傾きで選ぶ（途中で計算した配列の点も受け取る）', () => {
    expect(H.vmGlyphS([0, 0, 1], [1, 1, 1])).toBe('/');
    // 同じ画面の点へ奥へ伸びる線は、奥行きで割ると傾きが無い
    expect(H.vmGlyphS([0.1, 0.2, 0.5], [0.2, 0.4, 1])).toBe('-');
    expect(H.vmGlyphS([0, 0, 1], [0, 1, 2])).toBe('|');
    expect(H.vmGlyphS([0, 0, 1], [-1, 1, 1])).toBe('\\');
  });
});
