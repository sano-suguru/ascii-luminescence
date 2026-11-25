// 伝言（src/lib/log.ts）・下の HUD（src/lib/hotbar.ts）・手の枠（src/lib/gear.ts の equipWeapon・slotSet・freeSlotFor・bodyN）・加護の段（src/lib/progress.ts の BL）・
// 保存（src/lib/save.ts）・ルーンの説明（src/lib/runes.ts の trDesc・detailLines）・拾ったルーンを入れる処理と祭壇の画面の説明（src/lib/altars.ts）の単体テスト。
// 指紋の値は、移す前の古い JS（src/game/16・17・18・19・21・25・26・27）でも同じになる（ui-cases.mjs の場合を、古い関数で数えて確かめた）。
// テストを .mjs で書くのは、偽の画面の部品と偽の localStorage を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import * as AL from '../../src/lib/altars.ts';
import * as GR from '../../src/lib/gear.ts';
import * as HB from '../../src/lib/hotbar.ts';
import * as LOG from '../../src/lib/log.ts';
import * as PR from '../../src/lib/progress.ts';
import { redraw } from '../../src/lib/redraw.ts';
import * as RU from '../../src/lib/runes.ts';
import * as SV from '../../src/lib/save.ts';
import { gear, msgs, saved, ui } from '../../src/lib/state.ts';
import { fakePage, swapGlobals, uiCases } from './ui-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
const F = { ...LOG, ...HB, ...GR, ...PR, ...SV, ...RU, ...AL };
/** 偽の画面と、決まった時計で fn を呼ぶ（終わったら元に戻す） */
function withPage(fn) {
  const page = fakePage(),
    restoreGlobals = swapGlobals({ document: page.document, localStorage: page.localStorage }),
    keepNow = Object.getOwnPropertyDescriptor(performance, 'now');
  let clock = 0;
  performance.now = () => clock;
  try {
    return fn(page, (t) => (clock = t));
  } finally {
    restoreGlobals();
    if (keepNow) Object.defineProperty(performance, 'now', keepNow);
    else Reflect.deleteProperty(performance, 'now');
    msgs.length = 0;
  }
}

describe('伝言', () => {
  it('新しい3つまで残し、13秒たった物は消す。古い物ほど薄い', () =>
    withPage((page, at) => {
      for (const [t, s] of [
        [0, 'a'],
        [1000, 'b'],
        [2000, 'c'],
        [3000, 'd'],
      ]) {
        at(t);
        LOG.msg(s);
      }
      expect(msgs.map((m) => m.html)).toEqual(['b', 'c', 'd']);
      expect(page.els.log.innerHTML).toBe(
        '<div class="m" style="opacity:0.40">b</div><div class="m" style="opacity:0.70">c</div><div class="m" style="opacity:1.00">d</div>',
      );
      at(15500);
      LOG.renderLog();
      expect(msgs.map((m) => m.html)).toEqual(['d']);
    }));
});

describe('装備の画面の描き直し（呼び口 redraw.inv）', () => {
  it('入れる前に呼ぶと止まる。装備の画面が開いている時だけ、拾ったルーンを入れた後に呼ぶ', () =>
    withPage(() => {
      const keep = { inv: redraw.inv, hands: gear.hands, bag: gear.bag, invOpen: ui.invOpen, rseen: saved.RSEEN };
      try {
        expect(() => redraw.inv()).toThrow('redraw.inv');
        let n = 0;
        redraw.inv = () => n++;
        gear.hands = { L: GR.newHand('blade'), R: GR.newHand('bolt'), B: { b0: null, b1: null } };
        gear.bag = [];
        saved.RSEEN = new Set();
        ui.invOpen = false;
        AL.takeRune({ uid: 1, type: 'fire' });
        expect(n).toBe(0);
        ui.invOpen = true;
        AL.takeRune({ uid: 2, type: 'ice' });
        AL.placeChosen({ uid: 3, type: 'bolt' });
        AL.placeChosen({ uid: 4, type: 'm_chain' });
        expect(AL.mergeMod({ uid: 5, type: 'm_chain' })).toBe(true);
        expect(n).toBe(4);
      } finally {
        Object.assign(redraw, { inv: keep.inv });
        Object.assign(gear, { hands: keep.hands, bag: keep.bag });
        ui.invOpen = keep.invOpen;
        saved.RSEEN = keep.rseen;
      }
    }));
});

describe('移す前と同じ', () => {
  it('伝言・下の HUD・手の枠・保存・ルーンの説明・拾ったルーンを入れる処理（800の場合、18の関数）の指紋', () => {
    const page = fakePage(),
      all = uiCases(F, 800, () => (msgs.length = 0), page),
      lines = all.split('\n'),
      names = new Set(lines.flatMap((l) => [...l.matchAll(/"name":"(\w+)"/g)].map((m) => m[1])));
    // 場合が中身を通っているか：18の関数が全部呼ばれ、伝言・下の HUD・保存が書かれる
    expect([
      lines.length,
      names.size,
      lines.filter((l) => /"hotbar":"<span/.test(l)).length > 100,
      lines.filter((l) => /"stored":\[\[/.test(l)).length > 100,
    ]).toEqual([800, 18, true, true]);
    expect([fnv(all), all.length]).toEqual(['9ca82160', 928945]);
  });
});
