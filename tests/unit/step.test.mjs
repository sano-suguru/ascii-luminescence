// 詠唱と転がり・飛ぶ物と戦いの跡を進める処理・詠唱の声・剣の波を描く・火とガスと地面を進める処理・部屋の出来事と罠・神託所の手がかり
// （src/lib/chant.ts・projs.ts・audio.ts・fx.ts・ground.ts・events.ts・legend.ts）の単体テスト。
// 指紋の値は、移す前の古い JS（src/game/15・18・20・24・26）でも同じになる（step-cases.mjs の場合を、古い関数で数えて確かめた）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import * as AUDIO from '../../src/lib/audio.ts';
import * as CHANT from '../../src/lib/chant.ts';
import * as EVENTS from '../../src/lib/events.ts';
import * as FX from '../../src/lib/fx.ts';
import * as GROUND from '../../src/lib/ground.ts';
import * as LEGEND from '../../src/lib/legend.ts';
import * as PROJS from '../../src/lib/projs.ts';
import { fakeDom, fnv } from './fight-cases.mjs';
import { NAMES, stepCases, stepText } from './step-cases.mjs';

describe('移す前と同じ', () => {
  it('詠唱と転がり・飛ぶ物と戦いの跡・火とガス・部屋の出来事と罠（8の場合、26の関数）の指紋', { timeout: 120000 }, async () => {
    const F = { ...AUDIO, ...CHANT, ...EVENTS, ...FX, ...GROUND, ...LEGEND, ...PROJS },
      all = await stepCases(F, 8, fakeDom()),
      body = stepText(all),
      calls = all.flatMap((c) => c.calls);
    expect([fnv(body), body.length]).toEqual(['c9b982d3', 2645891]);
    // 場合が中身を通っているか：26の関数が全部呼ばれ、どれも止まらない。見た目の乱数・音の乱数・伝言・setTimeout・音の部品を使う呼び出しもある
    expect(new Set(calls.map((c) => c.name))).toEqual(new Set(NAMES));
    expect(calls.filter((c) => c.threw).length).toBe(0);
    expect(all.every((c) => c.timers.threw === 0)).toBe(true);
    const by = (name, f) => calls.filter((c) => c.name === name && f(c)).length;
    for (const name of ['updateProjs', 'updateStatuses', 'stepFire', 'updateEvents', 'startRoll'])
      expect(by(name, (c) => c.mr > 0)).toBeGreaterThan(0);
    for (const name of ['updateEvents', 'triggerTrap', 'updateTraps']) expect(by(name, (c) => c.msg > 0)).toBeGreaterThan(0);
    for (const name of ['updateEvents', 'oracleLegendHints']) expect(by(name, (c) => c.timers > 0)).toBeGreaterThan(0);
    for (const name of ['chantStart', 'updateEvents', 'stepFire'])
      expect(by(name, (c) => c.snd > 0 || c.audio !== fnv('[]'))).toBeGreaterThan(0);
  });
});
