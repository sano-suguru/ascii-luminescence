// ミニマップ（src/lib/minimap.ts の sizeMap・drawMap）の単体テスト。
// 指紋は、minimap-cases.mjs の場合の結果（移す前の古い JS と、バイトまで同じだった値）。動きを意図して変えた時や、場合の入力を変えた時は、
// 変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の描き手とキャンバスを、本物の型に合わせられないため。
import { afterAll, describe, expect, it } from 'vitest';
import * as MM from '../../src/lib/minimap.ts';
import { ui } from '../../src/lib/state.ts';
import { fakeCanvas, minimapCases } from './minimap-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
const keep = { mapC: ui.mapC, mctx: ui.mctx };
afterAll(() => Object.assign(ui, keep));

describe('移す前と同じ', () => {
  it('ミニマップ（画面の倍率8通りと、120の階）の指紋', { timeout: 60000 }, async () => {
    const fake = fakeCanvas();
    Object.assign(ui, { mapC: fake.canvas, mctx: fake.ctx });
    const body = await minimapCases(MM, fake, 120);
    expect([fnv(body), body.length]).toEqual(['0a3d6ee3', 21652500]);
    // 場合が中身を通っているか：マスの分かれ道と、上に重ねる物の文字が全部出る
    const drawn = new Set([...body.matchAll(/^fillText\((.),/gm)].map((m) => m[1]));
    expect('#0:=~,"*^\'+.$%?@/'.split('').filter((ch) => !drawn.has(ch))).toEqual([]);
    // 毒の霧（マスを塗る）・透明な生き物の気配（薄い色）・化けている生き物（?）・鉄格子（金色）を描いた
    expect(body).toMatch(/^fillStyle=rgba\(120,190,60,/m);
    expect(body).toMatch(/^shadowColor=rgb\(92,103,125\)/m);
    expect(body).toMatch(/^shadowColor=#ffd48a/m);
  });
});
