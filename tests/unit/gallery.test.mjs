// 見た物の記録・図鑑・試しの間（src/lib/gallery.ts）の単体テスト。
// 指紋は、gallery-cases.mjs の場合の結果。移す時に、古い JS を消す前に比べた：tools/legacy-eval.mjs の legacyValues で、
// 移す前の src/game/25-gallery.js（状態を入れ物に移した名前 gfx.canvas・ui.seenT を書き換えた物）の関数を取り出し、同じ場合で呼んで、文字列が同じだった
// （12の場合・840回の呼び出し）。わざと1か所変えると違いが出ることも確かめた。
// 動きを意図して変えた時や、場合の入力を変えた時は、変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 部屋は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の画面の部品・描く画面を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import * as GA from '../../src/lib/gallery.ts';
import { caseOut } from './case-out.mjs';
import { fakeDom, fnv } from './fight-cases.mjs';
import { NAMES, galleryCases } from './gallery-cases.mjs';

describe('移す前と同じ', () => {
  it('見た物の記録・図鑑・試しの間（12の場合、20の関数）の指紋', async () => {
    const all = await galleryCases(GA, 12, fakeDom()),
      lines = all.split('\n'),
      calls = lines.flatMap((l) => JSON.parse(l).calls),
      by = (name) => calls.filter((c) => c.name === name),
      st = (c) => JSON.parse(c.state);
    // 場合が中身を通っているか：全部の関数を呼び、図鑑のカメラを、止めた向き・プレイヤーが動かした向きの両方で置き、
    // 寄って体の外で止まり、壁を透かし、試しの間の的が倒れて起き上がり、ダメージの数を描く
    expect([lines.length, new Set(calls.map((c) => c.name))]).toEqual([12, new Set(NAMES)]);
    const beast = by('updateGallery')
      .map(st)
      .filter((s) => s.gallery && s.gallery.mode === 'beast');
    expect(beast.filter((s) => s.gallery.fix).length).toBeGreaterThan(50);
    expect(beast.filter((s) => s.gallery.view && s.gallery.view.midOff !== undefined).length).toBeGreaterThan(50);
    expect(beast.filter((s) => (s.gallery.fix || s.gallery.view || {}).bodyR !== undefined).length).toBeGreaterThan(50);
    expect(beast.filter((s) => s.U[0] === 1).length).toBeGreaterThan(5);
    expect(new Set(by('showBeast').map((c) => st(c).gal)).size).toBeGreaterThan(20);
    expect(by('drawGallery').filter((c) => st(c).gallery && st(c).gallery.mode === 'range' && st(c).dn > 0).length).toBeGreaterThan(20);
    expect(by('openRange').filter((c) => c.threw).length).toBe(0);
    expect(by('trackSeen').filter((c) => c.stored !== '[]').length).toBeGreaterThan(0);
    caseOut('gallery', all);
    expect([fnv(all), all.length]).toEqual(['463ee9c4', 15094311]);
  }, 120000);
});
