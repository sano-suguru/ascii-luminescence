// 祭壇とルーンを置く処理（src/lib/altars.ts）と、解放の確かめ（src/lib/unlocks.ts）・ルーンの種類を選ぶ randomRuneType（src/lib/gear.ts）の単体テスト。
// 指紋の値は、移す前の古い JS（src/game/17-meta.js・19-hands-runes.js・21-altars-heal.js）でも同じになる（altar-cases.mjs の場合を、古い関数で数えて確かめた）。
// 迷宮の生成は使わないので、生成を変えてもこの指紋は変わらない。テストを .mjs で書くのは、テストの中で作る小さな階を、生成の結果の型に合わせられないため
import { describe, expect, it } from 'vitest';
import * as AL from '../../src/lib/altars.ts';
import { randomRuneType } from '../../src/lib/gear.ts';
import { adv, player, saved } from '../../src/lib/state.ts';
import * as UN from '../../src/lib/unlocks.ts';
import { altarCases } from './altar-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('解放の確かめ', () => {
  it('解放していない武器・ルーンは出ない。開発用モードでは、すべて出る', () => {
    const keep = { DEVALL: saved.DEVALL, META: saved.META };
    try {
      saved.DEVALL = false;
      saved.META = { ...saved.META, unl: ['w_rain'] };
      expect(UN.weaponPool()).toEqual(['blade', 'bolt', 'orb', 'beam', 'dash', 'rain', 'rapid']);
      expect([UN.lockedOf('rune', 'poison'), UN.lockedOf('rune', 'fire'), UN.unlocked('w_rain')]).toEqual([true, false, true]);
      saved.DEVALL = true;
      expect(UN.weaponPool().length).toBe(10);
    } finally {
      Object.assign(saved, keep);
    }
  });
});

describe('祭壇', () => {
  it('鍛えの祭壇の深さは、層の中で探索のシードで決まる（層の外は -1）', () => {
    const keep = adv.runSeed;
    try {
      adv.runSeed = 12345;
      expect(['cavern', 'ruins', 'magma', 'abyss'].map(AL.forgeDepthOf)).toEqual([5, 8, 10, -1]);
    } finally {
      adv.runSeed = keep;
    }
  });
  it('癒しの1行は、今の体力と、癒した後の体力（最大の7割を足す）', () => {
    const keep = [player.hp, adv.PLAYER_MAX];
    try {
      player.hp = 10;
      adv.PLAYER_MAX = 40;
      expect(AL.altarLine({ i: 0, kind: 'rune', taken: false, opt: 'heal' })).toBe(
        '癒し        <b style="color:#ff9aa8">+</b> 体力 10 → 38',
      );
    } finally {
      [player.hp, adv.PLAYER_MAX] = keep;
    }
  });
  it('ルーンの種類は重みの割合で選び、選べなければ火', () => {
    expect([randomRuneType(() => 0.99, { elem: 0.5 }), randomRuneType(() => 0, { mod: 1 })]).toEqual(['fire', 'm_chain']);
  });
});

describe('移す前と同じ', () => {
  it('祭壇の中身・番人・鍛え方・泉・祭壇の1行と、解放・ルーンの種類（400の場合）の指紋', () => {
    const all = altarCases({ ...AL, ...UN, randomRuneType }, 400),
      lines = all.split('\n');
    // 場合が中身を通っているか：ルーンの選択肢・鍛える選択肢・癒しの選択肢・番人・泉が、それぞれ出てくる
    const count = (re) => lines.filter((l) => re.test(l)).length;
    expect([
      lines.length,
      count(/"opt":"rune"/),
      count(/"opt":"forge"/),
      count(/"opt":"heal"/),
      count(/"home":/),
      count(/"kind":"spring"/),
      count(/ERR/),
    ]).toEqual([400, 400, 380, 343, 400, 189, 0]);
    expect([fnv(all), all.length]).toEqual(['bf108741', 1665849]);
  }, 30000);
});
