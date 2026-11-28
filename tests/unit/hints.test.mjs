// 世界の中の手がかりと詠唱の見た目（src/lib/arrows.ts の方向の矢印、camera.ts の updateSectionAir、fixtures.ts の drawRunesWorld、
// chantfx.ts の simPath・drawCastFx・updateCross）の単体テスト。
// 指紋は、hints-cases.mjs の場合の結果。動きを意図して変えた時や、場合の入力を変えた時は、変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の描き手・キャンバス・画面の部品を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import * as AR from '../../src/lib/arrows.ts';
import * as CA from '../../src/lib/camera.ts';
import * as CF from '../../src/lib/chantfx.ts';
import * as FX from '../../src/lib/fixtures.ts';
import { caseOut } from './case-out.mjs';
import { hintsCases } from './hints-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('指紋', () => {
  it('方向の矢印・場所ごとの空気・床のルーン・詠唱の見た目・照準の文字（300の場合、8の関数）の指紋', async () => {
    const all = await hintsCases({ ...AR, ...CA, ...FX, ...CF }, 300),
      lines = all.split('\n'),
      calls = lines.flatMap((l) => JSON.parse(l).calls),
      by = (name) => calls.filter((c) => c.name === name);
    // 場合が中身を通っているか：8の関数が全部呼ばれ、矢印を描き、文字を置き、粒子を出し、照準の文字を書く
    expect([lines.length, new Set(calls.map((c) => c.name)).size]).toEqual([300, 8]);
    expect(by('drawArrows').filter((c) => c.canvas.some((l) => l.startsWith('strokeText'))).length).toBeGreaterThan(200);
    expect(by('drawRunesWorld').filter((c) => c.dn > 0).length).toBeGreaterThan(400);
    expect(by('drawCastFx').filter((c) => c.pN > 0).length).toBeGreaterThan(200);
    expect(new Set(by('updateCross').map((c) => c.cross[1]))).toEqual(new Set(['', 'chant', 'full']));
    expect(new Set(by('simPath').map((c) => JSON.parse(c.ret).hitM !== null))).toEqual(new Set([true, false]));
    expect(calls.filter((c) => c.threw).length).toBeLessThan(60);
    // 床のルーンを描いても、場所ごとの空気（uAmb）は変わらない（空気は tick の段 'lights' が updateSectionAir で合わせる）
    for (const l of lines) {
      let amb = 1;
      for (const c of JSON.parse(l).calls) {
        if (c.name === 'drawRunesWorld') expect(c.uni[1]).toBe(amb);
        amb = c.uni[1];
      }
    }
    expect(by('updateSectionAir').filter((c) => c.uni[1] !== 1).length).toBeGreaterThan(50);
    caseOut('hints', all);
    expect([fnv(all), all.length]).toEqual(['0d2314b7', 5416588]);
  }, 60000);
});
