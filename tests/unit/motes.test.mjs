// 粒子を動かす処理（src/lib/motes.ts の updateParticles・riverFX・updateGasPoints）の単体テスト。
// 指紋は、motes-cases.mjs の場合の結果（移す前の古い JS と、バイトまで同じだった値）。動きを意図して変えた時や、場合の入力を変えた時は、
// 変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、古い JS の関数と同じ台本（motes-cases.mjs）で比べたため。
import { describe, expect, it } from 'vitest';
import * as F from '../../src/lib/motes.ts';
import * as A from '../../src/lib/particles.ts';
import { caseOut } from './case-out.mjs';
import { motesCases } from './motes-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('移す前と同じ', () => {
  it('塵・ガスの粒・川のさざ波・粒子（40の場合）の指紋', { timeout: 60000 }, async () => {
    const body = await motesCases(F, A, 40);
    caseOut('motes', body);
    expect([fnv(body), body.length]).toEqual(['4e2eab48', 162809]);
    // 場合が中身を通っているか：ガスの粒が上限まで出る・止めると消える、粒子が尽きて減る、川のさざ波が出る
    expect(body).toMatch(/ gas=700 /);
    expect(body).toMatch(/^gasoff pN=\d+ gas=0 /m);
  });
});
