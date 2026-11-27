// カメラから見て描く・調べる処理の単体テスト：生き物を描く処理（src/lib/bodies/draw.ts）・罠と鉄格子を描く処理（fixtures.ts の drawTraps）・
// 見た時の説明（look.ts）・灯りの揺らぎと灯りを描画に渡す配列（lightmap.ts の flicker・updateLights）・照準（aim.ts）。
// 指紋は、view-cases.mjs の場合の結果。動きを意図して変えた時や、場合の入力を変えた時は、変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の画面の部品・偽のカメラ・偽の Web Audio を、本物の型に合わせられないため。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as AIM from '../../src/lib/aim.ts';
import * as DRAW from '../../src/lib/bodies/draw.ts';
import * as FIX from '../../src/lib/fixtures.ts';
import * as LM from '../../src/lib/lightmap.ts';
import * as LOOK from '../../src/lib/look.ts';
import { LIGHT_TYPES, PARTS, lookName, viewCases, viewText } from './view-cases.mjs';
import { caseOut } from './case-out.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
const NAMES = [
  'drawMonster',
  'drawMonster1',
  'drawMonster0',
  'drawTentacles',
  'drawTraps',
  'look',
  'flicker',
  'updateLights',
  'headPos',
  'aimOrigin',
  'viewDir',
  'hittable',
  'handUp',
  'aimPoint',
  'centerPoint',
  'castPoint',
  'handPoint',
  'drawSwing',
];

describe('移す前と同じ', () => {
  it('描く・調べる処理（240の場合、18の関数）の指紋', { timeout: 60000 }, async () => {
    const all = await viewCases({ ...AIM, ...DRAW, ...FIX, ...LM, ...LOOK }, 240),
      body = viewText(all),
      calls = all.flatMap((c) => c.calls);
    caseOut('view', body);
    expect([fnv(body), body.length]).toEqual(['233d1ce9', 59837934]);
    // 場合が中身を通っているか：18の関数が全部呼ばれ、文字を置き、粒子を出し、どれも止まらない
    expect(new Set(calls.map((c) => c.name))).toEqual(new Set(NAMES));
    expect(calls.filter((c) => c.dn > 0).length).toBeGreaterThan(2000);
    expect(calls.filter((c) => c.pN > 0).length).toBeGreaterThan(50);
    expect(calls.filter((c) => c.threw).length).toBe(0);
    // 見た時の説明：look.ts に書いてある、決まった名前の説明（73 の lookLine のうち、名前が決まった文字の 53）が全部出る（見続けて画面に出た物も、たくさんある）
    const src = readFileSync(join(import.meta.dirname, '../../src/lib/look.ts'), 'utf8'),
      want = [...src.matchAll(/lookLine\(\s*'[^']*',\s*(?:\[[^\]]*\]|[\w.()]+),\s*'([^']+)'/g)].map((m) => m[1]),
      seen = new Set(calls.filter((c) => c.look).map((c) => lookName(c.look[2])));
    expect(want.length).toBe(53);
    expect(want.filter((w) => !seen.has(w))).toEqual([]);
    expect(calls.filter((c) => c.look && c.look[1] && c.look[1] !== 'old').length).toBeGreaterThan(500);
    // 生き物の形の部位：drawMonster0 が動かし方を分ける部位が全部描かれる（'parm' は、どの形も作らない）
    const parts = new Set(calls.flatMap((c) => c.parts));
    expect(PARTS.filter((p) => !parts.has(p))).toEqual(['parm']);
    // 灯りの揺らぎ：全部の種類
    expect(LIGHT_TYPES.filter((t) => !calls.some((c) => c.light === t))).toEqual([]);
  });
});
