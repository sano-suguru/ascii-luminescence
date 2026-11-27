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
    expect([fnv(body), body.length]).toEqual(['9ebe15a9', 4038463]);
    // 場合が中身を通っているか：描かずに戻る・描く・性質の火花が出る
    expect(body).toMatch(/ dn=0 pN=0 /);
    expect(body).toMatch(/ dn=[1-9]\d* pN=0 /);
    expect(body).toMatch(/ dn=[1-9]\d* pN=[1-9]/);
  });
});
