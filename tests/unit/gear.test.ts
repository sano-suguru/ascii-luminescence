// 手と持ち物の処理（src/lib/gear.ts）と、ルーンの名前・付け方（src/lib/runes.ts）の単体テスト。
// 値は、移す前の古い JS（src/game/19-hands-runes.js）と同じ。移す時に、古い JS を消す前に比べた：
//   tools/legacy-eval.mjs の legacyValues で古い関数を取り出し（古い関数も、src/lib/state.ts の gear を同じ物として読む）、
//   乱数で作った600通りの手を、structuredClone で2つに写して gear に入れ、古い関数と新しい関数の結果と、gear の変わり方を比べた（約7万5千か所、違い0）。
//   わざと1か所変えると違いが出ることも確かめた（比べ方が効いていること）。
import { beforeEach, describe, expect, it } from 'vitest';
import * as G from '../../src/lib/gear.ts';
import * as R from '../../src/lib/runes.ts';
import { type Rune } from '../../src/lib/runes.ts';
import { gear } from '../../src/lib/state.ts';

const ru = (uid: number, type: string, extra: Partial<Rune> = {}): Rune => ({ uid, type, aff: {}, ...extra });
// 両手持ちの短弓（左右で同じ武器）。左の枠に炎・氷、右の枠に「かわすと」、体に速さの護符、持ち物に強い連鎖
const bow = ru(1, 'bolt');
beforeEach(() => {
  gear.hands = {
    L: { atk: bow, slots: [ru(2, 'fire'), ru(3, 'ice'), null, null], slotN: 2, turn: 0, elem: null, trig: null },
    R: { atk: bow, slots: [ru(4, 'dodge'), null, null, null], slotN: 2, turn: 0, elem: null, trig: null },
    B: { b0: ru(5, 'swift'), b1: null },
  };
  gear.bag = [ru(6, 'm_chain', { strong: true })];
});

describe('両手持ち（src/lib/gear.ts）', () => {
  it('左右が同じ両手持ちの武器なら、枠を合わせた1つの手になり、左右で撃ち方が違う', () => {
    expect(G.isTwo()).toBe(true);
    expect([G.atkType('L'), G.atkType('R')]).toEqual(['bolt', 'bpower']);
    const e = G.effHand('L');
    expect(e.slots.map((r) => r && r.uid)).toEqual([2, 3, 4, null]);
    expect([e.slotN, e.two]).toEqual([4, true]);
  });
  it('性質は交代で放ち、左右で同じ。発動のルーンも左右で同じ', () => {
    G.syncHands();
    expect([gear.hands?.L.elem?.uid, gear.hands?.R.elem?.uid, gear.hands?.L.trig?.uid]).toEqual([2, 2, 4]);
    G.turnElem('L');
    expect([gear.hands?.L.elem?.uid, gear.hands?.R.turn]).toEqual([3, 1]);
  });
  it('持っている物の一覧と、並びを表す文字', () => {
    expect(G.allRunes().map((r) => r.uid)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(G.handsKey()).toBe('1,2,3,0,0:2|1,4,0,0,0:2|5,0');
  });
  it('両手持ちの枠に付けられるか：性質は2種類まで、発動は1つまで', () => {
    expect(G.canPutAt('R', 1, ru(7, 'thunder'))).toBe(false);
    expect(G.canPutAt('R', 1, ru(8, 'kill'))).toBe(false);
    expect(G.canPutAt('R', 1, ru(9, 'm_area'))).toBe(true);
  });
  it('写しを取って、変えても、写しに戻せる', () => {
    const sn = G.snapHands();
    if (gear.hands) gear.hands.L.slots[0] = null;
    gear.bag.push(ru(99, 'fire'));
    G.restoreHands(sn);
    expect(G.handsKey()).toBe('1,2,3,0,0:2|1,4,0,0,0:2|5,0');
    expect(gear.bag.map((r) => r.uid)).toEqual([6]);
  });
});

describe('ルーンを作る（src/lib/gear.ts）', () => {
  it('番号は通しで増え、飾りは付かず、乱数も引かない（移す前と同じ）', () => {
    gear.runeUid = 40;
    let calls = 0;
    expect(
      G.makeRune('orb', 2, () => {
        calls++;
        return 0.5;
      }),
    ).toEqual({ uid: 40, type: 'orb', aff: {} });
    expect(calls).toBe(0);
    expect(G.makeStrong('m_area')).toEqual({ uid: 41, type: 'm_area', aff: {}, strong: true });
    expect(G.newHand('blade').atk?.uid).toBe(42);
    expect(gear.runeUid).toBe(43);
  });
});

describe('ルーンの名前・付け方（src/lib/runes.ts）', () => {
  it('ひとつの手の枠：性質は2種類まで、同じ効き方は2つまで、枠の外と武器は付けられない', () => {
    expect(R.canPut({ slots: [ru(10, 'fire'), ru(11, 'ice'), null], slotN: 3 }, 2, ru(12, 'thunder'))).toBe(false);
    expect(R.canPut({ slots: [ru(10, 'm_dur'), ru(11, 'm_dur'), null], slotN: 3 }, 2, ru(12, 'm_dur'))).toBe(false);
    expect(R.canPut({ slots: [null, null], slotN: 2 }, 2, ru(12, 'fire'))).toBe(false);
    expect(R.canPut({ slots: [null, null], slotN: 2 }, 0, ru(12, 'blade'))).toBe(false);
  });
  it('名前：効き方は値つき（強い物は2倍）、手は性質の前置きと武器', () => {
    const chain = gear.bag[0];
    if (!chain) throw new Error('持ち物が無い');
    expect([R.runeName(chain), R.runeShort(chain), R.thingLabel(chain), R.thingLabel(bow)]).toEqual([
      '連鎖 +2',
      '連鎖 +2',
      '連鎖 +2のルーン',
      '短弓',
    ]);
    G.syncHands();
    G.turnElem('L');
    expect(R.handName(gear.hands?.L ?? { atk: null, elem: null })).toBe('氷の短弓');
    expect(R.handName({ atk: null, elem: null })).toBe('素手');
  });
  it('効き方が効くか、武器の特性', () => {
    expect(R.modWorks('chain', G.effHand('L'))).toBe(true);
    expect(R.modWorks('area', { atk: ru(1, 'blade'), slots: [], slotN: 2 })).toBe(false);
    expect(R.rollTraits(ru(1, 'orb'), Math.random, 7, 1).traits).toEqual([
      { k: 'count', lv: 3 },
      { k: 'bounce', lv: 3 },
    ]);
    expect(R.rollTraits(ru(1, 'orb'), Math.random, 1).traits).toEqual([]);
    expect(R.rollTraits(ru(1, 'fire'), Math.random, 9).traits).toBeUndefined();
  });
});
