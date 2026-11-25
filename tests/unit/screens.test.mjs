// 粒子と世界の中に置く文字（src/lib/particles.ts）・頭の上の印（status.ts の drawMark）・装備の画面の開け閉めと付け替えの詠唱（inventory.ts）・
// マウスを捕まえる・視点・音量（screens.ts）の単体テスト。
// 指紋の値は、移す前の古い JS（src/game/05・12・15・16・27・28）で数えた値から、音が音の乱数（sr）を使い、見た目の乱数を引かなくなった分だけ違う
// （screens-cases.mjs の場合を、古い関数で数えて確かめた。音の乱数を Math.random に回すと、分ける前と同じ値になることを確かめた）。
// テストを .mjs で書くのは、偽の画面の部品を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import * as INV from '../../src/lib/inventory.ts';
import * as PT from '../../src/lib/particles.ts';
import * as SC from '../../src/lib/screens.ts';
import * as ST from '../../src/lib/status.ts';
import { G } from '../../src/lib/glyphs.ts';
import { fakeScreen, particleCases, screenCases } from './screens-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('移す前と同じ', () => {
  it('粒子を出す・消す・文字を置く（300の場合）の指紋', () => {
    const all = particleCases(PT, 300);
    // 場合が中身を通っているか：粒子と文字の数が上限に達する場合も通る
    expect([all.split('\n').length, all.includes('"pN":3600'), all.includes('"dn":12000')]).toEqual([300, true, true]);
    expect([fnv(all), all.length]).toEqual(['04640061', 87148]);
  });
  it('頭の上の印・装備の画面の開け閉め・付け替えの詠唱・マウスを捕まえる・視点・音量（300の場合）の指紋', async () => {
    const all = await screenCases({ ...INV, ...ST, ...SC }, 300, fakeScreen()),
      has = (k) => all.includes(k),
      cases = all.split('\n').map((l) => JSON.parse(l)),
      calls = cases.flatMap((c) => c.calls),
      gs = new Set(calls.flatMap((c) => c.gs ?? []));
    // 場合が中身を通っているか：7つの関数が全部呼ばれ、マウスを捕まえる時の返し方の全部、音量を変える、マウスを放す、視点を保存する場合も通る
    expect(new Set(calls.map((c) => c.f)).size).toBe(7);
    expect(
      [
        '["rpl","throw"]',
        '["rpl","plain"]',
        '["rpl?","none"]',
        '["rpl","ok"]',
        '"setTargetAtTime"',
        '"exitPointerLock"',
        '"al_cam"',
      ].filter((k) => !has(k)),
    ).toEqual([]);
    // 頭の上の印は z・!・? の3つとも出る
    expect(['z', '!', '?'].filter((c) => !gs.has(G(c)))).toEqual([]);
    // 付け替え：詠唱を始める場合と、石碑のそばですぐ替わる場合（粒子が16増える）。両手を変えて閉じると詠唱になる場合。
    // 石碑のそばで、鈴の音を鳴らす場合（鳴らせる偽の Web Audio に、音の部品を作った記録が残る）
    const swaps = calls.filter((c) => c.f === 'startSwap' || (c.f === 'setInv' && !c.on));
    expect([
      calls.some((c) => c.f === 'startSwap' && c.swap),
      swaps.some((c) => c.grew === 16 && !c.swap),
      calls.some((c) => c.f === 'setInv' && !c.on && c.swap),
      cases.some((c) => c.calls.some((x) => x.grew === 16) && c.log.some((e) => e[1] === 'start')),
    ]).toEqual([true, true, true, true]);
    expect([fnv(all), all.length]).toEqual(['df06fba5', 739383]);
  });
});
