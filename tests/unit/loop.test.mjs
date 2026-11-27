// 大きさとメインループ（src/lib/loop.ts）と描画の土台（src/lib/render.ts）の単体テスト。
// 指紋は、loop-cases.mjs の場合の結果。移す時に、古い JS を消す前に比べた：tools/legacy-eval.mjs の legacyValues で、
// 移す前の src/game/05-renderer.js・06-world.js・30-loop-init.js（状態を入れ物に移した名前を tools/state-move.mjs で書き換えた物）の関数を取り出し、
// 同じ場合で呼んで、文字列が同じだった（12の場合・5650回の呼び出し）。わざと1か所変えると違いが出ることも確かめた。
// 古い関数と新しい関数は、別々のプロセスで走らせて比べた（同じプロセスで続けて走らせると、前の物が残した状態（粒子や関数に覚えさせた欄など）が後の物に入る）。
// このテストも、自分のファイルだけを1つのプロセスで走らせる前提（Vitest はファイルごとに分ける）。
// 動きを意図して変えた時や、場合の入力を変えた時は、変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// tick は、ほとんどの処理（生き物・火・粒子・描く物）を呼ぶので、それらを変えても、この指紋は変わる。
// テストを .mjs で書くのは、偽の描画の部品・画面の部品を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import * as LO from '../../src/lib/loop.ts';
import * as RE from '../../src/lib/render.ts';
import { caseOut } from './case-out.mjs';
import { fakeDom, fnv } from './fight-cases.mjs';
import { NAMES, loopCases } from './loop-cases.mjs';

describe('移す前と同じ', () => {
  it('大きさ・メインループ・画質・描画の土台（12の場合、10の関数）の指紋', async () => {
    const all = await loopCases({ ...LO, ...RE }, 12, fakeDom()),
      lines = all.split('\n'),
      calls = lines.flatMap((l) => JSON.parse(l).calls),
      st = calls.filter((c) => c.name === 'tick').map((c) => JSON.parse(c.state));
    // 場合が中身を通っているか：全部の関数を呼び、階を移り、明るくなり、置いたカメラで描き、画質を下げて戻し、例外を出さない
    expect([lines.length, new Set(calls.map((c) => c.name))]).toEqual([12, new Set(NAMES)]);
    expect(calls.filter((c) => c.threw).length).toBe(0);
    expect(st.filter((s) => s.here[1]).length).toBeGreaterThan(100);
    expect(st.filter((s) => s.here[0] < 1 && !s.here[1]).length).toBeGreaterThan(100);
    expect(st.filter((s) => s.gfx[4]).length).toBeGreaterThan(1000);
    expect(st.filter((s) => s.gfx[2].prev).length).toBeGreaterThan(500);
    expect(st.filter((s) => s.gfx[2].done).length).toBeGreaterThan(500);
    expect(new Set(st.map((s) => s.gfx[0])).size).toBeGreaterThan(3);
    expect(calls.filter((c) => c.log.includes('"render"')).length).toBeGreaterThan(100);
    caseOut('loop', all);
    expect([fnv(all), all.length]).toEqual(['4ff7dc8f', 22570268]);
  }, 180000);
});
