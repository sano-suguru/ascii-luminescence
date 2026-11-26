// 詠唱と転がり・飛ぶ物と戦いの跡を進める処理・詠唱の声・剣の波を描く・火とガスと地面を進める処理・部屋の出来事と罠・神託所の手がかり
// （src/lib/chant.ts・projs.ts・audio.ts・fx.ts・ground.ts・events.ts・legend.ts）の単体テスト。
// 指紋は、step-cases.mjs の場合の結果。動きを意図して変えた時は、変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
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
  it('詠唱と転がり・飛ぶ物と戦いの跡・火とガス・部屋の出来事と罠（8の場合、23の関数）の指紋', { timeout: 120000 }, async () => {
    const F = { ...AUDIO, ...CHANT, ...EVENTS, ...FX, ...GROUND, ...LEGEND, ...PROJS },
      all = await stepCases(F, 8, fakeDom()),
      body = stepText(all),
      calls = all.flatMap((c) => c.calls);
    expect([fnv(body), body.length]).toEqual(['297f6daa', 2584750]);
    // 場合が中身を通っているか：23の関数が全部呼ばれ、どれも止まらない。見た目の乱数・音の乱数・伝言・setTimeout・音の部品を使う呼び出しもある
    expect(new Set(calls.map((c) => c.name))).toEqual(new Set(NAMES));
    expect(calls.filter((c) => c.threw).length).toBe(0);
    // 火口の噴き上がりは、流れ出す 1 → 待つ 2 → 引く 3 → 次まで待つ 0 と、最後まで進む
    expect(all.filter((c) => c.eruptSeen).flatMap((c) => c.eruptSeen)).toEqual(expect.arrayContaining(['0123']));
    expect(all.filter((c) => c.eruptSeen).every((c) => c.eruptSeen.every((x) => x === '0123'))).toBe(true);
    // 溶岩は、体の大きな生き物の体がかかるマスに流れない（場合の中で、トロルを道の隣に止めておいた）
    expect(all.filter((c) => c.big !== null).map((c) => c.big)).toEqual(expect.arrayContaining([false]));
    expect(all.some((c) => c.big === true)).toBe(false);
    // 部屋の出来事の溶岩の流れは、生き物に塞がれたマスがあっても流し終える（状態 2）。溶岩でないまま残るのは、今も塞がれているマスだけ
    const flows = all.map((c) => c.lavaflow).filter((f) => f && f[0] !== 0);
    expect(flows.length).toBeGreaterThan(0);
    expect(flows.every(([st, left]) => st === 2 && left === 0)).toBe(true);
    // 噴き上がりは、流れる順を並べ替えない（塞がれたマスは別の列で試し直す）。引くと、流す前の中身に戻る（水のマスは、溶岩になってから水に戻る）
    const ran = all.filter((c) => c.orderKept !== null);
    expect(ran.length).toBeGreaterThan(0);
    expect(ran.every((c) => c.orderKept)).toBe(true);
    expect(ran.every((c) => c.water[0] && c.water[1])).toBe(true);
    // 凍らせた水のマスは、引いた後に水へ戻り、氷の一覧から外れる。踏み分けた草は、引いた後も生え戻りの一覧にある
    expect(ran.every((c) => c.thawed.every(Boolean))).toBe(true);
    // 2つの火口の流れる道が重なっていても、全部の火口が引き終えたら、初めは溶岩でなかったマスに溶岩は残らない
    const done = ran.filter((c) => c.lavaLeft !== null);
    expect(done.length).toBeGreaterThan(0);
    expect(done.every((c) => c.lavaLeft === 0)).toBe(true);
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
