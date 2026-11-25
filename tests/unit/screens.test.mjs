// 粒子と世界の中に置く文字（src/lib/particles.ts）・頭の上の印（status.ts の drawMark）・装備の画面の開け閉めと付け替えの詠唱（inventory.ts）・
// マウスを捕まえる・視点・音量（screens.ts）の単体テスト。
// 指紋の値は、移す前の古い JS（src/game/05・12・15・16・27・28）でも同じになる（screens-cases.mjs の場合を、古い関数で数えて確かめた）。
// テストを .mjs で書くのは、偽の画面の部品を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import * as INV from '../../src/lib/inventory.ts';
import * as PT from '../../src/lib/particles.ts';
import * as SC from '../../src/lib/screens.ts';
import * as ST from '../../src/lib/status.ts';
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
      has = (k) => all.includes(k);
    // 場合が中身を通っているか：7つの関数が全部呼ばれ、印は z（2つ）と ! か ?（1つ）、付け替えの詠唱、マウスを捕まえる時の返し方の全部、
    // 音量を変える、マウスを放す、視点を保存する場合も通る
    expect(new Set([...all.matchAll(/"f":"(\w+)"/g)].map((m) => m[1])).size).toBe(7);
    expect(
      [
        '"dn":2',
        '"dn":1',
        '"dur":1.5',
        '["rpl","throw"]',
        '["rpl","plain"]',
        '["rpl?","none"]',
        '["rpl","ok"]',
        '"gain"',
        '"exitPointerLock"',
        '"al_cam"',
      ].filter((k) => !has(k)),
    ).toEqual([]);
    expect([fnv(all), all.length]).toEqual(['9b136d7d', 671230]);
  });
});
