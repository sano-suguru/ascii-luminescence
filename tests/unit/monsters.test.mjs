// 生き物を作る・歩いて行けるか・次に向かうマス（src/lib/monsters.ts）と、小さな生き物と地面（src/lib/ground.ts）・叫び声の音（audio.ts の sShriek）の単体テスト。
// 指紋は、生き物を作る・動かす処理と地面の処理が、思わず変わっていないかを見る。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import { sShriek } from '../../src/lib/audio.ts';
import * as GROUND from '../../src/lib/ground.ts';
import * as MON from '../../src/lib/monsters.ts';
import { NAMES, monsterCases, monsterText } from './monsters-cases.mjs';
import { caseOut } from './case-out.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('指紋（思わず変わっていないか）', () => {
  it('生き物の動きと地面の処理（40の場合、23の関数）の指紋', { timeout: 60000 }, async () => {
    const all = await monsterCases({ ...MON, ...GROUND, sShriek }, 40),
      body = monsterText(all),
      calls = all.flatMap((c) => c.calls);
    caseOut('monsters', body);
    expect([fnv(body), body.length]).toEqual(['89240e96', 22738658]);
    // 場合が中身を通っているか：23の関数が全部呼ばれ、どれも止まらない。伝言・見た目の乱数・音の乱数を引く呼び出しもある
    expect(new Set(calls.map((c) => c.name))).toEqual(new Set(NAMES));
    expect(calls.filter((c) => c.threw).length).toBe(0);
    const by = (name, f) => calls.filter((c) => c.name === name && f(c)).length;
    for (const name of ['chooseNext', 'updateCritter', 'crackIce', 'brimFlare']) expect(by(name, (c) => c.msg > 0)).toBeGreaterThan(0);
    // 生き物を作る時は、その生き物だけの並び（m.rnd）を引き、ほかと分け合う見た目の乱数は引かない
    expect(by('makeMonster', (c) => c.mr > 0)).toBe(0);
    for (const name of ['chooseNext', 'critterStep', 'updateCritter', 'machineWork', 'splash', 'crackIce', 'chillArea', 'updateFrozen'])
      expect(by(name, (c) => c.mr > 0)).toBeGreaterThan(0);
    // 火・マスの変わり方・液体・床・マスの絵の中身・凍らせた水・踏み分けた茂み・氷に乗っていた秒が、歩みの間に変わり、絵を描画に渡す
    const steps = all.flatMap((c) => c.steps);
    for (const k of ['fire', 'cellFlag', 'liquid', 'surface', 'cellData', 'frozen', 'trampled', 'ice'])
      expect(new Set(steps.map((s) => s[k])).size).toBeGreaterThan(10);
    expect(steps.filter((s) => s.upload).length).toBeGreaterThan(100);
  });
});
