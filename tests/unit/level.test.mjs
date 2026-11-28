// 階を移る処理と世界の組み立て（src/lib/levels.ts・build.ts と、ground.ts の initFire・particles.ts の initDust・respawnDust）の単体テスト。
// 指紋は、level-cases.mjs の場合の結果。動きを意図して変えた時は、変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の画面の部品・偽の描画の部品を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import * as BUILD from '../../src/lib/build.ts';
import { hurtPlayer } from '../../src/lib/combat.ts';
import * as GROUND from '../../src/lib/ground.ts';
import * as LEVELS from '../../src/lib/levels.ts';
import * as PART from '../../src/lib/particles.ts';
import { updatePlayer } from '../../src/lib/player.ts';
import { fakeDom } from './fight-cases.mjs';
import { NAMES, levelCases, levelText } from './level-cases.mjs';
import { caseOut } from './case-out.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('指紋', () => {
  it('階を移る処理と世界の組み立て（5の場合、19の関数）の指紋', { timeout: 180000 }, async () => {
    const all = await levelCases({ ...LEVELS, ...BUILD, ...GROUND, ...PART, updatePlayer, hurtPlayer }, 5, fakeDom()),
      body = levelText(all),
      calls = all.flatMap((c) => c.calls);
    caseOut('level', body);
    expect([fnv(body), body.length]).toEqual(['b431d423', 197069]);
    expect(new Set(calls.map((c) => c.name).filter((n) => NAMES.includes(n)))).toEqual(new Set(NAMES));
    expect(calls.filter((c) => c.threw).length).toBe(0);
    expect(all.every((c) => c.timers.threw === 0)).toBe(true);
    const by = (name, f) => calls.filter((c) => c.name === name && f(c)).length;
    for (const name of ['newLevel', 'checkEvents']) expect(by(name, (c) => c.msg > 0 || c.timers > 0)).toBeGreaterThan(0);
    expect(by('newLevel', (c) => c.mr > 0)).toBeGreaterThan(0);
  });
});

describe('区切りの文字の四角', () => {
  it('頂点の番号は、一番大きい番号が 65535 以上なら32ビット（16ビットの 65535 は WebGL2 で線を切る印になる）', () => {
    const at = (cnt) => BUILD.quadIndex(cnt),
      max = (a) => a.reduce((m, v) => Math.max(m, v), 0);
    expect(at(16383)).toBeInstanceOf(Uint16Array);
    expect(max(at(16383))).toBe(65531);
    expect(at(16384)).toBeInstanceOf(Uint32Array);
    expect(max(at(16384))).toBe(65535);
    expect([...at(2)]).toEqual([0, 2, 1, 2, 3, 1, 4, 6, 5, 6, 7, 5]);
  });
});
