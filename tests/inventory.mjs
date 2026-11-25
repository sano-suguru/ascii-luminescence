#!/usr/bin/env node
// 装備の画面のテスト：同じシードで装備の画面を開き、画面のボタンをシードの乱数で押し続けて、押すたびの装備の画面と下の HUD の HTML を記録する。
// 押す物：ルーンや枠のボタン（選ぶ・はめる・外す・入れ替える）、袋のページ送り、ビルドの保存と呼び出し、袋のルーンのダブルクリック（自動ではめる）、
// マウスを乗せる・外す（下の説明の5行）、右クリックと、ボタンの無い所のクリック（選んだ物を取り消す）。
// 記録の指紋が決まった値と同じかを確かめる（装備の画面の周りを、動きを変えずに書き直したかを確かめるため）。記録は tests/out/inventory.log
//   node tests/inventory.mjs            確かめる
//   node tests/inventory.mjs --print    指紋を出すだけ（意図して動きを変えた時に、新しい指紋を書く）
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withBrowser, newPage, openTest, advance, OUT } from './lib.mjs';

const FP = ['1450fa66', 9735028];
const STEPS = 1000;
const errs = [];
let result = null;
await withBrowser(async ({ browser, base }) => {
  const pg = await newPage(browser, errs);
  await openTest(pg, base, 'seed=202&depth=3&god=1');
  await advance(pg, 2);
  // 持ち物：全部の武器・ルーン・護符を2つずつ（同じ効き方のルーンは、まとめて強い版になる）。手のルーンの枠と体の枠を全部開ける
  const ready = await pg.evaluate(() => {
    for (const t of ['slotL', 'slotL', 'slotR', 'slotR', 'body', 'body']) __test.open(t);
    dbg.give('runes');
    dbg.give('runes');
    dbg.give('body');
    return true;
  });
  if (!ready) errs.push('持ち物を用意できない（テストの前提が崩れた）');
  await pg.keyboard.press('Tab');
  await advance(pg, 0.1);
  result = await pg.evaluate((steps) => {
    const pack = document.getElementById('pack'),
      hot = document.getElementById('hotbar');
    if (!pack || !pack.classList.contains('show')) return { err: '装備の画面が開かない（テストの前提が崩れた）' };
    let s = 202;
    const r = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = (a) => a[Math.floor(r() * a.length)];
    const ev = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
    const log = [],
      count = {};
    for (let i = 0; i < steps; i++) {
      const buttons = [...pack.querySelectorAll('button')],
        bag = buttons.filter((b) => b.dataset.b),
        k = r();
      let act;
      if (k < 0.55 && buttons.length) {
        const b = pick(buttons);
        act =
          'click:' +
          (b.dataset.pg
            ? 'pg'
            : b.dataset.h
              ? 'slot'
              : b.dataset.b
                ? 'bag'
                : b.dataset.save !== undefined
                  ? 'save'
                  : b.dataset.load !== undefined
                    ? 'load'
                    : 'other');
        b.click();
      } else if (k < 0.65 && bag.length) {
        act = 'dbl';
        const b = pick(bag);
        b.click();
        b.click();
      } else if (k < 0.77 && buttons.length) {
        act = 'over';
        ev(pick(buttons), 'mouseover');
      } else if (k < 0.82) {
        act = 'leave';
        ev(pack, 'mouseleave');
      } else if (k < 0.91) {
        act = 'right';
        ev(pack, 'contextmenu');
      } else {
        act = 'empty';
        ev(pack, 'click');
      }
      count[act] = (count[act] || 0) + 1;
      log.push(`#${i} ${act}\n${pack.innerHTML}\n${hot.innerHTML}`);
    }
    const all = log.join('\n');
    let h = 0x811c9dc5;
    for (const c of all) h = Math.imul(h ^ c.codePointAt(0), 0x01000193);
    return { fp: [(h >>> 0).toString(16).padStart(8, '0'), all.length], count, all, open: pack.classList.contains('show') };
  }, STEPS);
});
if (result?.err) errs.push(result.err);
else if (result) {
  writeFileSync(join(OUT, 'inventory.log'), result.all);
  console.log('押した物:', JSON.stringify(result.count), ' 指紋:', JSON.stringify(result.fp));
  if (!result.open) errs.push('押している間に、装備の画面が閉じた');
  // 場合が中身を通っているか：どの押し方も起きている
  for (const k of ['click:slot', 'click:bag', 'click:pg', 'click:save', 'click:load', 'dbl', 'over', 'leave', 'right', 'empty'])
    if (!result.count[k]) errs.push(`「${k}」を一度も押していない（テストの前提が崩れた）`);
  if (!process.argv.includes('--print') && JSON.stringify(result.fp) !== JSON.stringify(FP))
    errs.push(
      `装備の画面の記録の指紋が違う：${JSON.stringify(result.fp)}（決まった値は ${JSON.stringify(FP)}。記録は tests/out/inventory.log）`,
    );
}
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
