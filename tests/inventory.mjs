#!/usr/bin/env node
// 装備の画面のテスト：同じシードで装備の画面を開き、画面のボタンをシードの乱数で押し続けて、押すたびの装備の画面と下の HUD の HTML を記録する。
// 押す物：ルーンや枠のボタン（選ぶ・はめる・外す・入れ替える）、袋のページ送り、ビルドの保存と呼び出し、袋のルーンを続けて2回（自動ではめる）、
// 武器の枠を続けて2回（外す）、マウスを乗せる・外す（下の説明の5行）、右クリックと、ボタンの無い所のクリック（選んだ物を取り消す）、
// 時を進める・袋のルーンを押して時を進めてからまた押す（テスト用モードの時計は、進めない限り止まっているので、時を進めずに同じルーンをまた押すと
// ダブルクリックになり、進めた後ならならない）。
// 持ち物の用意は3通り（枠を全部開けて全部を2つずつ・何も開けない・一部だけ開ける）。押すたびの記録の指紋を、基準 tests/baseline/inventory.json と比べ、
// 違えば何回目から違うかを出す（装備の画面の周りを、動きを変えずに書き直したかを確かめるため）。記録は tests/out/inventory-<用意>.log
//   node tests/inventory.mjs            確かめる
//   node tests/inventory.mjs --update   基準を作り直す（装備の画面の見た目や動きを意図して変えた時と、ルーンの番号が変わる変更をした時だけ）
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withBrowser, newPage, openTest, advance, OUT, ROOT } from './lib.mjs';

const BASE = join(ROOT, 'tests/baseline/inventory.json');
// 用意：開ける枠、持たせる物（dbg.give）、持たせた後に開ける枠（体の枠を後で開けると、空いたまま始まる）、押す回数、枠のボタンをよく押すか
const SETUPS = [
  {
    name: 'full',
    open: ['slotL', 'slotL', 'slotR', 'slotR', 'body', 'body'],
    give: ['runes', 'runes', 'body'],
    after: [],
    steps: 1000,
    slots: false,
  },
  { name: 'closed', open: [], give: ['runes'], after: [], steps: 600, slots: true },
  { name: 'part', open: [], give: ['runes'], after: ['slotR', 'body'], steps: 600, slots: true },
];
const update = process.argv.includes('--update');
const errs = [];
const results = {};
await withBrowser(async ({ browser, base }) => {
  for (const S of SETUPS) {
    const pg = await newPage(browser, errs);
    await openTest(pg, base, 'seed=202&depth=3&god=1');
    await advance(pg, 2);
    const opened = await pg.evaluate(
      ({ open, give, after }) => {
        const got = open.map((t) => __test.open(t));
        for (const g of give) dbg.give(g);
        return [...got, ...after.map((t) => __test.open(t))];
      },
      { open: S.open, give: S.give, after: S.after },
    );
    if (JSON.stringify(opened) !== JSON.stringify([...S.open, ...S.after]))
      errs.push(`${S.name}：枠を開けられない（${JSON.stringify(opened)}。テストの前提が崩れた）`);
    await pg.keyboard.press('Tab');
    await advance(pg, 0.1);
    const r = await pg.evaluate(
      ({ steps, slots, seed }) => {
        const pack = document.getElementById('pack'),
          hot = document.getElementById('hotbar');
        if (!pack || !pack.classList.contains('show')) return { err: '装備の画面が開かない（テストの前提が崩れた）' };
        let s = seed;
        const r = () => {
          s = (s + 0x6d2b79f5) | 0;
          let t = Math.imul(s ^ (s >>> 15), 1 | s);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const pick = (a) => a[Math.floor(r() * a.length)];
        const ev = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
        const fnv = (str) => {
          let h = 0x811c9dc5;
          for (const c of str) h = Math.imul(h ^ c.codePointAt(0), 0x01000193);
          return (h >>> 0).toString(16).padStart(8, '0');
        };
        const log = [],
          hashes = [],
          count = {};
        for (let i = 0; i < steps; i++) {
          const buttons = [...pack.querySelectorAll('button')],
            bag = buttons.filter((b) => b.dataset.b),
            slotB = buttons.filter((b) => b.dataset.h),
            k = r();
          let act;
          if (slots && k < 0.3 && slotB.length) {
            act = 'click:slot';
            pick(slotB).click();
          } else if (k < 0.55 && buttons.length) {
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
          } else if (k < 0.63 && bag.length) {
            act = 'dbl';
            const b = pick(bag);
            b.click();
            b.click();
          } else if (k < 0.75 && buttons.length) {
            act = 'over';
            ev(pick(buttons), 'mouseover');
          } else if (k < 0.8) {
            act = 'leave';
            ev(pack, 'mouseleave');
          } else if (k < 0.87) {
            act = 'right';
            ev(pack, 'contextmenu');
          } else if (k < 0.92) {
            act = 'empty';
            ev(pack, 'click');
          } else if (k < 0.95) {
            act = 'wait';
            __test.advance(0.7);
          } else if (k < 0.975 && bag.length) {
            // ゆっくり2回：時を進めてから同じルーンを押すと、ダブルクリックにならず、選び直すだけ
            act = 'slow';
            const u = pick(bag).dataset.b;
            pack.querySelector(`button[data-b="${u}"]`)?.click();
            __test.advance(0.7);
            pack.querySelector(`button[data-b="${u}"]`)?.click();
          } else {
            // 武器の枠を続けて2回：選んで、外す（袋へ）
            act = 'unequip';
            const w = pick(buttons.filter((b) => b.dataset.s === 'atk'));
            if (w) {
              const sel = `button[data-h="${w.dataset.h}"][data-s="atk"]`;
              pack.querySelector(sel)?.click();
              pack.querySelector(sel)?.click();
            }
          }
          count[act] = (count[act] || 0) + 1;
          const rec = `#${i} ${act}\n${pack.innerHTML}\n${hot.innerHTML}`;
          log.push(rec);
          hashes.push(fnv(rec));
        }
        const all = log.join('\n');
        return { fp: fnv(all), len: all.length, hashes, count, all, open: pack.classList.contains('show') };
      },
      { steps: S.steps, slots: S.slots, seed: 202 + S.name.length },
    );
    await pg.close();
    if (r.err) {
      errs.push(`${S.name}：${r.err}`);
      continue;
    }
    writeFileSync(join(OUT, `inventory-${S.name}.log`), r.all);
    console.log(`${S.name}：押した物 ${JSON.stringify(r.count)}  指紋 ${r.fp}`);
    if (!r.open) errs.push(`${S.name}：押している間に、装備の画面が閉じた`);
    results[S.name] = { fp: r.fp, len: r.len, steps: r.hashes, count: r.count };
  }
});
// 場合が中身を通っているか：どの押し方も、どれかの用意で起きている
const all = Object.values(results).reduce((a, x) => {
  for (const [k, v] of Object.entries(x.count)) a[k] = (a[k] || 0) + v;
  return a;
}, {});
for (const k of [
  'click:slot',
  'click:bag',
  'click:pg',
  'click:save',
  'click:load',
  'dbl',
  'over',
  'leave',
  'right',
  'empty',
  'wait',
  'slow',
  'unequip',
])
  if (!all[k]) errs.push(`「${k}」を一度も押していない（テストの前提が崩れた）`);
if (update) {
  writeFileSync(
    BASE,
    JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { fp: v.fp, len: v.len, steps: v.steps }]))) + '\n',
  );
  console.log(`基準を作り直した：${BASE}`);
} else if (!existsSync(BASE)) errs.push('基準 tests/baseline/inventory.json が無い（--update で作る）');
else {
  const want = JSON.parse(readFileSync(BASE, 'utf8'));
  for (const S of SETUPS) {
    const got = results[S.name],
      w = want[S.name];
    if (!got) continue;
    if (!w) {
      errs.push(`${S.name}：基準が無い（--update で作る）`);
      continue;
    }
    if (got.fp === w.fp && got.len === w.len) continue;
    const at = got.steps.findIndex((h, i) => h !== w.steps[i]);
    errs.push(
      `${S.name}：装備の画面の記録が基準と違う（${at < 0 ? '押した回数が違う' : `${at} 回目から`}。記録は tests/out/inventory-${S.name}.log）`,
    );
  }
}
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
