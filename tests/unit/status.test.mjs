// 状態の表示と、まわりへの気配（src/lib/status.ts）・伝説の物（src/lib/legend.ts）・マスの明るさ（src/lib/lightmap.ts）の単体テスト。
// 指紋の値は、移す前の古い JS（src/game/02・06・12・13・14・24・26・27）でも同じになる（status-cases.mjs の場合を、古い関数で数えて確かめた）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の画面の部品を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import * as LG from '../../src/lib/legend.ts';
import * as LM from '../../src/lib/lightmap.ts';
import * as ST from '../../src/lib/status.ts';
import { here, ui } from '../../src/lib/state.ts';
import { statusCases } from './status-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('止まっているか・場所の名前', () => {
  it('どれかの画面が開いていれば止まっている', () => {
    const keep = { ...ui };
    try {
      Object.assign(ui, { invOpen: false, menuOpen: false, dbgOpen: false, altarOpen: false, lvlOpen: false });
      expect(ST.isPaused()).toBe(false);
      ui.lvlOpen = true;
      expect(ST.isPaused()).toBe(true);
    } finally {
      Object.assign(ui, keep);
    }
  });
  it('ふつうの階は深さ、支道は名前と何階目か', () => {
    const keep = { depth: here.depth, branch: here.branch, realm: here.realm, inter: here.inter };
    try {
      Object.assign(here, { depth: 7, branch: null, realm: null, inter: null });
      expect(ST.placeLabel()).toBe('7');
      here.branch = { key: 'crypt', lvl: 1, len: 2, ret: 4 };
      expect(ST.placeLabel()).toBe('墓所 1/2');
    } finally {
      Object.assign(here, keep);
    }
  });
});

describe('移す前と同じ', () => {
  it('状態の表示・気配・年代記・操作の案内・魔導書・見つかった時・物音・立ち止まって調べる・伝説の物・マスの明るさ（300の場合、17の関数）の指紋', async () => {
    const all = await statusCases({ ...ST, ...LG, ...LM }, 300),
      lines = all.split('\n'),
      names = new Set(lines.flatMap((l) => [...l.matchAll(/"name":"(\w+)"/g)].map((m) => m[1])));
    // 場合が中身を通っているか：17の関数が全部呼ばれ、忘れられた獣が目を覚ます場合も通る
    expect([lines.length, names.size, all.includes('目を覚まし')]).toEqual([300, 17, true]);
    expect([fnv(all), all.length]).toEqual(['52ab2c8e', 843575]);
  }, 60000);
});
