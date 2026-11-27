// 足元の物を拾う処理（src/lib/pickup.ts）・立ち直り（combat.ts の updateRally）・最深部（levels.ts の updateFinal・spawnFinalBoss）の単体テスト。
// 指紋は、pickup-cases.mjs の場合の結果。移す時に、移す前の古い JS（src/game/21-altars-heal.js・24-goal.js）と比べた：
//   origin/main を別の作業場所に出し、tools/legacy-eval.mjs の legacyValues で古い関数（と包みの一番外の変数）を取り出して、同じ16の場合を走らせ、
//   記録の文字列がバイトまで同じことを確かめた。新しい関数をわざと1か所変える（落石の傷・光の粒の向かう高さ・亡霊を呼ぶ間・音の間）と、違いが出ることも確かめた。
// 動きを意図して変えた時は、変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import { updateRally } from '../../src/lib/combat.ts';
import { spawnFinalBoss, updateFinal } from '../../src/lib/levels.ts';
import * as PICKUP from '../../src/lib/pickup.ts';
import { adv, fight, hudInfo } from '../../src/lib/state.ts';
import { fakeDom, fnv } from './fight-cases.mjs';
import { NAMES, pickupCases, pickupText } from './pickup-cases.mjs';
import { caseOut } from './case-out.mjs';

// 場合ごとに、関数が覚える状態（入れ物に移した物）を初めに戻す
const makeF = () => {
  fight.rockfall = null;
  fight.rallyChime = 0;
  hudInfo.rallyShown = -1;
  adv.slotPickN = 0;
  return { ...PICKUP, updateRally, updateFinal, spawnFinalBoss };
};

describe('移す前と同じ', () => {
  it('拾う・宝物庫・落石・立ち直り・最深部（16の場合、9の関数）の指紋', { timeout: 120000 }, async () => {
    const all = await pickupCases(makeF, 16, fakeDom()),
      body = pickupText(all),
      calls = all.flatMap((c) => c.calls);
    caseOut('pickup', body);
    expect([fnv(body), body.length]).toEqual(['b5e4629c', 2358936]);
    // 場合が中身を通っているか：9の関数が全部呼ばれ、どれも止まらず、待たせた処理も止まらない
    expect(new Set(calls.map((c) => c.name))).toEqual(new Set(NAMES));
    expect(calls.filter((c) => c.threw).length).toBe(0);
    expect(all.every((c) => c.timers === 0)).toBe(true);
    // 拾う物の種類ごとの伝言が出る（番人が倒れた・墓・泉・伝説の物・枠・鍛える・癒す・宝物庫の2通り）。王の影は二つ目の姿になり、亡霊を呼ぶ
    const said = calls.map((c) => c.msgs).join('|');
    for (const w of [
      '番人が倒れた',
      '祭壇に光が灯った',
      '先人の形見',
      '泉の光',
      'を手にした',
      '三つの光が',
      '開ける枠はもうない',
      'どの枠を開けるか',
      'が Lv',
      '温かな光',
      '石像の目',
      '天井が軋み',
      '王の姿が砕け',
      '亡霊を呼び出した',
    ])
      expect(said).toContain(w);
    // 落石は、プレイヤーにも生き物にも当たる
    expect(all.some((c) => c.rockHit[0])).toBe(true);
    expect(all.some((c) => c.rockHit[1])).toBe(true);
  });
});
