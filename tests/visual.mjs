#!/usr/bin/env node
// 画面写真の比較：決まった場面を写し、tests/baseline/ の基準の画像と画素で比べる。
//   node tests/visual.mjs              比べる（違いが大きければ失敗。違いの画像を tests/out/visual/ に出す）
//   node tests/visual.mjs --update     基準の画像を作り直す（見た目を意図して変えた時だけ）
//   node tests/visual.mjs --only bow   その場面だけ
//   node tests/visual.mjs --soft       画面が違っても失敗にしない（基準が無い・大きさが違う時も。違いの画像は作る。ページのエラーは失敗のまま）
// テスト版はフォントを npm から同梱しているので、マシンが違っても文字の形は同じになる。
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { GALLERY_SPECIMENS } from './gallery-specimens.mjs';
import { withBrowser, newPage, openTest, frames, advance, nearAltar, arg, ROOT, OUT } from './lib.mjs';

const SIZE = [640, 360]; // 場面ごとに size で変えられる
const MAX_RATIO = 0.002; // 違う画素が 0.2% を超えたら失敗
const BASE = join(ROOT, 'tests/baseline'),
  DIFF = join(OUT, 'visual');
const update = process.argv.includes('--update'),
  soft = process.argv.includes('--soft'),
  only = arg('--only');

const enter = async (pg) => {
  await advance(pg, 2);
}; // 階に入った時の明るくなる演出を終わらせる
const ev = (pg, f, a) => pg.evaluate(f, a);
// 図鑑の生き物を、向きと姿を止めて写す（__test.galleryShow）。図鑑の枠（名前と説明の文）は隠して、生き物の形だけを見張る
// （パネルの文字は tests/panels.mjs が見る）。寄って（zoom）、体の高さの真ん中を画面の真ん中に写す（center）。生き物の画素が多いほど、小さな違いに気づける。
// 写す生き物と写し方は tests/gallery-specimens.mjs。出してから3秒進めて、灯りが落ち着いてから写す。
// 大きさは 1280×720（体を作る文字の形まで読めるので、違いの画像を見て何が変わったか分かる。違いの割合は大きさでほぼ変わらない）
const bestiary = (name, yaw, pose, zoom) => async (pg) => {
  const why = await ev(
    pg,
    ({ name, yaw, pose, zoom }) => {
      const e = __test.gallery().find((o) => o.name === name);
      if (!e) return `図鑑に「${name}」が無い`;
      const r = __test.galleryShow(e.n, { yaw, pose, zoom, center: true });
      return typeof r === 'string' ? r : null;
    },
    { name, yaw, pose, zoom },
  );
  if (why) throw new Error(why);
  await pg.addStyleTag({ content: '#gal{visibility:hidden!important}' });
  await advance(pg, 3);
};
const SCENES = [
  // 世界：層ごとの色・シェーダー・降る粒子
  { name: 'title', q: '', size: [960, 540], go: (pg) => advance(pg, 1) },
  { name: 'maze', q: 'seed=202&depth=1&god=1', go: enter },
  { name: 'cavern', q: 'seed=202&depth=3&god=1', go: enter },
  { name: 'ruins', q: 'seed=202&depth=6&god=1', go: enter },
  { name: 'magma', q: 'seed=202&depth=9&god=1', go: enter },
  { name: 'abyss', q: 'seed=202&depth=12&god=1', go: enter },
  // 手元の武器：振る・引き絞る・飛ぶ物、ミニマップとの重なり
  {
    name: 'blade',
    q: 'seed=202&depth=1&god=1',
    go: async (pg) => {
      await enter(pg);
      await ev(pg, () => __test.press('L'));
      await advance(pg, 0.1);
    },
  },
  {
    name: 'bow',
    q: 'seed=202&depth=1&god=1',
    go: async (pg) => {
      await enter(pg);
      await ev(pg, () => __test.equip('L', 'bolt'));
      await advance(pg, 0.6);
      await ev(pg, () => __test.press('R'));
      await advance(pg, 0.7);
    },
  },
  {
    name: 'staff',
    q: 'seed=202&depth=1&god=1',
    go: async (pg) => {
      await enter(pg);
      await ev(pg, () => __test.press('R'));
      await advance(pg, 1.8);
      await ev(pg, () => __test.release('R'));
      await advance(pg, 0.1);
    },
  }, // 溜めの間はゲームの時間が半分の速さ
  // 画面：パネルと日本語の幅（レベルアップは全部の加護を1段目にして、2段目の「II」の印を出す）
  {
    name: 'equip',
    q: 'seed=202&depth=1&god=1',
    size: [1280, 720],
    go: async (pg) => {
      await enter(pg);
      await pg.keyboard.press('Tab');
      await advance(pg, 0.2);
    },
  },
  {
    name: 'levelup',
    q: 'seed=202&depth=1&god=1',
    size: [960, 540],
    go: async (pg) => {
      await enter(pg);
      await ev(pg, () => {
        __test.bless(1);
        dbg.exp(60);
      });
      await advance(pg, 0.3);
    },
  },
  {
    name: 'altar',
    q: 'seed=202&depth=3&god=1',
    size: [960, 540],
    go: async (pg) => {
      await enter(pg);
      await nearAltar(pg);
      await advance(pg, 0.5);
    },
  },
  // 生き物の形：図鑑の部屋で、描く処理の違う所を別々の生き物で押さえる
  ...GALLERY_SPECIMENS.map((g) => ({ name: g.scene, q: '', size: [1280, 720], go: bestiary(g.name, g.yaw, g.pose, g.zoom) })),
];

mkdirSync(BASE, { recursive: true });
mkdirSync(DIFF, { recursive: true });
// 透明度は使わないので RGB で保存する（少し小さくなる）
const save = (file, png) => writeFileSync(file, PNG.sync.write(png, { colorType: 2, inputHasAlpha: true }));
const errs = [],
  rows = [];
await withBrowser(async ({ browser, base }) => {
  for (const sc of SCENES) {
    if (only && sc.name !== only) continue;
    const [W, H] = sc.size || SIZE;
    const pg = await newPage(browser, errs, { width: W, height: H, still: true });
    await openTest(pg, base, sc.q);
    // 場面を作れなかった時（図鑑に生き物が無い、など）は、その場面だけ失敗にして、残りの場面を続ける
    try {
      await sc.go(pg);
    } catch (e) {
      await pg.close();
      rows.push([sc.name, '✗ 作れない', String(e && e.message ? e.message : e)]);
      continue;
    }
    await pg.evaluate(() => document.fonts.ready);
    await frames(pg, 1);
    const shot = PNG.sync.read(await pg.screenshot({ timeout: 90000 }));
    await pg.close();
    const file = join(BASE, `${sc.name}.png`);
    if (update) {
      save(file, shot);
      rows.push([sc.name, '作り直した', '']);
      continue;
    }
    if (!existsSync(file)) {
      save(join(DIFF, `${sc.name}.png`), shot);
      rows.push([sc.name, '✗ 基準が無い', '--update で作る']);
      continue;
    }
    const ref = PNG.sync.read(readFileSync(file));
    if (ref.width !== shot.width || ref.height !== shot.height) {
      rows.push([sc.name, '✗ 大きさが違う', `${ref.width}x${ref.height} → ${shot.width}x${shot.height}`]);
      continue;
    }
    const diff = new PNG({ width: W, height: H });
    const n = pixelmatch(ref.data, shot.data, diff.data, W, H, { threshold: 0.1 });
    const ratio = n / (W * H);
    if (n) {
      save(join(DIFF, `${sc.name}.png`), shot);
      save(join(DIFF, `${sc.name}.diff.png`), diff);
    }
    rows.push([
      sc.name,
      ratio > MAX_RATIO ? '✗ 違う' : n ? '△ わずかに違う' : '✓ 同じ',
      n ? `${n} 画素（${(ratio * 100).toFixed(3)}%）` : '',
    ]);
  }
});
for (const [name, st, note] of rows) console.log(`${st.padEnd(8)} ${name.padEnd(8)} ${note}`);
const bad = rows.filter((r) => r[1].startsWith('✗'));
if (bad.length) console.log(`違いの画像：${DIFF}（*.diff.png の赤い所が違う画素）。意図した変更なら --update で作り直す。`);
if (errs.length) console.log('page errors:', errs);
process.exit(errs.length || (bad.length && !soft) ? 1 : 0);
