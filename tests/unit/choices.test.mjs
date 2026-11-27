// 選択肢の乱数の単体テスト：祭壇の中身（src/lib/altars.ts の altarFill）とレベルアップの選択肢（src/lib/panels.ts の levelChoices）は、
// 見た目の乱数（mr・Math.random）を引かず、出来事ごとに keyedRand で作った乱数で決める（祭壇は階のシードと祭壇のマス、レベルアップは探索のシードと何レベル目か）。
//   - 見た目の乱数を1回も引かない（Math.random を、呼ばれたら止まる物に入れ替えて確かめる）
//   - 鍵が同じなら、見た目の乱数をどれだけ進めても、ほかの出来事をどの順番で起こしても、同じ選択肢になる
//   - 選び方は変えていない：見た目の乱数で選んでいた時と同じ乱数を渡すと、同じ選択肢になる（レベルアップの指紋は、乱数を分ける前の古い JS で出した値。
//     祭壇は altars.test.mjs の指紋で確かめる）
// テストの中で作る小さな階を、生成の結果の型に合わせられないので .mjs で書く
import { afterEach, describe, expect, it } from 'vitest';
import { altarFill, placeAltar } from '../../src/lib/altars.ts';
import { makeRune } from '../../src/lib/gear.ts';
import { levelSeed } from '../../src/lib/levels.ts';
import { levelChoices } from '../../src/lib/panels.ts';
import { BLESS, UNLOCKS } from '../../src/lib/progress.ts';
import { keyedRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { rollTraits } from '../../src/lib/runes.ts';
import { adv, gear, here, player, saved } from '../../src/lib/state.ts';
import { caseOut } from './case-out.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
const random = Math.random;
const keep = {
  lvl: adv.lvl,
  runSeed: adv.runSeed,
  runState: adv.runState,
  PLAYER_MAX: adv.PLAYER_MAX,
  hands: gear.hands,
  runeUid: gear.runeUid,
  here: { D: here.D, depth: here.depth, branch: here.branch, realm: here.realm, inter: here.inter },
  hp: player.hp,
  DEVALL: saved.DEVALL,
  META: saved.META,
};
afterEach(() => {
  Math.random = random;
  Object.assign(adv, { lvl: keep.lvl, runSeed: keep.runSeed, runState: keep.runState, PLAYER_MAX: keep.PLAYER_MAX });
  Object.assign(gear, { hands: keep.hands, runeUid: keep.runeUid });
  Object.assign(here, keep.here);
  player.hp = keep.hp;
  Object.assign(saved, { DEVALL: keep.DEVALL, META: keep.META });
});
/** 見た目の乱数を引いたら止まるようにする */
const forbidLookRandom = () => {
  Math.random = () => {
    throw new Error('見た目の乱数を引いた');
  };
};
/** 見た目の乱数を n 回進める（シードで決まる物に入れ替えてから） */
const burnLookRandom = (seed, n) => {
  Math.random = mulberry32(seed);
  for (let i = 0; i < n; i++) Math.random();
};

// ---------------------------------------------------------------- レベルアップ
/** シード s のレベルアップの場面（加護の段・初めてか・護符の枠の数・解放・探索のシード・レベル）を入れる */
const levelScene = (s) => {
  const r = mulberry32(s * 7 + 1);
  const bless = {};
  for (const k of Object.keys(BLESS)) if (r() < 0.4) bless[k] = 1 + Math.floor(r() * 2);
  const pending = Math.floor(r() * 3);
  adv.lvl = { n: 2 + pending + Math.floor(r() * 20), exp: 0, pending, bless, strata: new Set(), firstDone: r() < 0.6 };
  adv.runState = { ...keep.runState, bodyOpen: Math.floor(r() * 3) };
  adv.runSeed = Math.floor(r() * 2 ** 31);
  saved.DEVALL = r() < 0.3;
  saved.META = { ...keep.META, unl: UNLOCKS.filter(() => r() < 0.5).map((u) => u.id) };
  gear.runeUid = 100;
};
const showLevel = (out) => JSON.stringify(out.map((o) => (o.kind === 'bless' ? o.k : [o.ru.type, Boolean(o.ru.strong)])));

describe('レベルアップの選択肢', () => {
  it('見た目の乱数を引かず、見た目の乱数をどれだけ進めても同じ選択肢になる（200の場合）', () => {
    for (let s = 1; s <= 200; s++) {
      levelScene(s);
      forbidLookRandom();
      const a = showLevel(levelChoices());
      levelScene(s);
      burnLookRandom(s, 1 + (s % 37));
      expect(showLevel(levelChoices())).toBe(a);
    }
  });
  it('何レベル目かで変わる（同じ探索で、別のレベルの選択肢は、ほとんどの場合で違う）', () => {
    let same = 0;
    for (let s = 1; s <= 200; s++) {
      levelScene(s);
      const a = showLevel(levelChoices());
      levelScene(s);
      adv.lvl.n++;
      if (showLevel(levelChoices()) === a) same++;
    }
    expect(same).toBeLessThan(20);
  });
  it('選び方は変えていない：見た目の乱数で選んでいた時と同じ乱数を渡すと、同じ選択肢になる（500の場合）', () => {
    const all = [];
    for (let s = 1; s <= 500; s++) {
      levelScene(s);
      Math.random = mulberry32(s * 13 + 5);
      all.push(showLevel(levelChoices(() => Math.random())));
    }
    const txt = all.join('\n');
    caseOut('choices', txt);
    expect([fnv(txt), txt.length]).toEqual(['6aeb2b3a', 19148]); // 乱数を分ける前の古い JS で出した値
  });
});

// ---------------------------------------------------------------- 祭壇
const WEAPONS = ['blade', 'bolt', 'orb', 'beam'];
/** シード s の祭壇の場面（深さ・探索のシード・体力・手の武器と空いた枠・護符の枠・解放）を入れ、ルーンの祭壇2つ・主の祭壇・鍛えの祭壇を置く */
const altarScene = (s) => {
  const r = mulberry32(s * 11 + 3);
  here.D = { items: [] };
  here.depth = 1 + Math.floor(r() * 13);
  Object.assign(here, { branch: null, realm: null, inter: null });
  adv.runSeed = Math.floor(r() * 2 ** 31);
  adv.PLAYER_MAX = 40 + Math.floor(r() * 40);
  adv.runState = { ...keep.runState, bodyOpen: Math.floor(r() * 3) };
  player.hp = r() * adv.PLAYER_MAX;
  saved.DEVALL = r() < 0.3;
  saved.META = { ...keep.META, unl: UNLOCKS.filter(() => r() < 0.5).map((u) => u.id) };
  gear.runeUid = 100;
  const hand = () => ({
    atk: rollTraits(makeRune(WEAPONS[Math.floor(r() * WEAPONS.length)]), here.depth, 0),
    slots: [r() < 0.5 ? makeRune('fire') : null, null, null],
    slotN: 2 + Math.floor(r() * 2),
    turn: 0,
    elem: null,
    trig: null,
  });
  gear.hands = { L: hand(), R: hand(), B: { b0: null, b1: null } };
  placeAltar(101, 'a');
  placeAltar(202, 'b');
  placeAltar(303, 'lord', { lord: true });
  placeAltar(404, 'forge', { forge: true });
};
const GRPS = ['a', 'b', 'lord', 'forge'];
/** 祭壇の組 grp の中身（ルーンの番号 uid は、作った順で変わるので見ない） */
const showAltar = (grp) =>
  JSON.stringify(
    here.D.items
      .filter((o) => o.grp === grp)
      .map((o) => [o.opt, o.rune?.type, Boolean(o.rune?.strong), o.rune?.traits, o.forgeK, o.forgeTo, o.forgeW?.type]),
  );

describe('祭壇の中身', () => {
  it('見た目の乱数を引かずに、ルーンの祭壇・主の祭壇・鍛えの祭壇の中身を決める（200の場合）', () => {
    for (let s = 1; s <= 200; s++) {
      altarScene(s);
      forbidLookRandom();
      for (const g of GRPS) altarFill(g);
      for (const g of GRPS) expect(here.D.items.filter((o) => o.grp === g).every((o) => o.opt)).toBe(true);
    }
  });
  it('近づく順番を変えても、間に見た目の乱数をどれだけ進めても、同じ祭壇は同じ中身になる（200の場合）', () => {
    for (let s = 1; s <= 200; s++) {
      altarScene(s);
      for (const g of GRPS) altarFill(g);
      const a = GRPS.map(showAltar);
      altarScene(s);
      for (const [k, g] of [...GRPS].reverse().entries()) {
        burnLookRandom(s + k, 1 + ((s * 7 + k) % 41));
        altarFill(g);
      }
      expect(GRPS.map(showAltar)).toEqual(a);
    }
  });
  it('祭壇のマスと階で変わる（同じ場面の2つのルーンの祭壇、別の深さの同じ祭壇は、ほとんどの場合で違う）', () => {
    let sameCell = 0,
      sameDepth = 0;
    for (let s = 1; s <= 200; s++) {
      altarScene(s);
      altarFill('a');
      altarFill('b');
      const a = showAltar('a');
      if (showAltar('b') === a) sameCell++;
      altarScene(s);
      here.depth++;
      altarFill('a');
      if (showAltar('a') === a) sameDepth++;
    }
    expect([sameCell < 20, sameDepth < 20]).toEqual([true, true]);
  });
  it('主の祭壇は別の名前で乱数を作る（取り終えた祭壇と同じマスに置かれても、同じ並びを引かない）', () => {
    let sameAsPlain = 0;
    for (let s = 1; s <= 200; s++) {
      altarScene(s);
      altarFill('lord');
      altarFill('a');
      const got = [showAltar('lord'), showAltar('a')];
      altarScene(s);
      altarFill('lord', keyedRand('lordaltar', levelSeed(), 303));
      altarFill('a', keyedRand('altar', levelSeed(), 101));
      expect([showAltar('lord'), showAltar('a')]).toEqual(got);
      altarScene(s);
      altarFill('lord', keyedRand('altar', levelSeed(), 303));
      if (showAltar('lord') === got[0]) sameAsPlain++;
    }
    expect(sameAsPlain).toBeLessThan(20);
  });
});
