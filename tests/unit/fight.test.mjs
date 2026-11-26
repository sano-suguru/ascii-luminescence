// 詠唱と当たり・照準と線・術の中身・結果の画面・プレイヤーの動き・生き物の動き（src/lib/combat.ts・aim.ts・gear.ts・audio.ts・results.ts・player.ts・monsters.ts）の単体テスト。
// 指紋の値は、移す前の古い JS（src/game/13・15・16・17・18・19・20・21・22・24・26・28）でも同じになる（fight-cases.mjs の場合を、古い関数で数えて確かめた）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import * as AIM from '../../src/lib/aim.ts';
import * as AUDIO from '../../src/lib/audio.ts';
import * as COMBAT from '../../src/lib/combat.ts';
import * as GEAR from '../../src/lib/gear.ts';
import * as MON from '../../src/lib/monsters.ts';
import * as PLAYER from '../../src/lib/player.ts';
import * as RESULTS from '../../src/lib/results.ts';
import { NAMES, fakeDom, fightCases, fightText } from './fight-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('移す前と同じ', () => {
  it('詠唱と当たり・プレイヤーと生き物の動き（16の場合、59の関数）の指紋', { timeout: 120000 }, async () => {
    const all = await fightCases({ ...AIM, ...AUDIO, ...COMBAT, ...GEAR, ...MON, ...PLAYER, ...RESULTS }, 16, fakeDom()),
      body = fightText(all),
      calls = all.flatMap((c) => c.calls);
    expect([fnv(body), body.length]).toEqual(['0980e6ea', 3823044]);
    // 場合が中身を通っているか：59の関数が全部呼ばれ、どれも止まらない。見た目の乱数・音の乱数・伝言・setTimeout を使う呼び出しもある
    expect(new Set(calls.map((c) => c.name))).toEqual(new Set(NAMES));
    expect(calls.filter((c) => c.threw).length).toBe(0);
    expect(all.every((c) => c.timers.threw === 0)).toBe(true);
    const by = (name, f) => calls.filter((c) => c.name === name && f(c)).length;
    for (const name of ['castNow', 'damageMonster', 'react', 'updateMonster', 'updatePlayer'])
      expect(by(name, (c) => c.mr > 0)).toBeGreaterThan(0);
    for (const name of ['damageMonster', 'hurtPlayer', 'updateMonster', 'boom']) expect(by(name, (c) => c.msg > 0)).toBeGreaterThan(0);
    for (const name of ['castNow', 'gainExp', 'lordFell']) expect(by(name, (c) => c.timers > 0)).toBeGreaterThan(0);
  });
});
