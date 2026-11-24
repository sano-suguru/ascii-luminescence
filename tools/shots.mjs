#!/usr/bin/env node
// 図鑑の生き物を、見やすい角度で写す（テスト版を組み立てて、テスト用モードの図鑑で __test.galleryShow を使う）。
//   pnpm shots                  決めた12枚（竜・主たちなど）
//   pnpm shots 竜 トロル        名前で選ぶ（図鑑の名前と同じ。鍵（D・T など）でもよい）
//   pnpm shots --all            図鑑の全部
//   --bare                      図鑑の枠を隠す（体の下の方が枠に隠れる大きな生き物に）
//   --out <ディレクトリ>        置き場所（既定 tests/out/shots/）
// 同じコマンドなら、いつも同じ写真になる（テスト用モード）。ただし、羽ばたきなどはゲームの時計で動くので、
// 写す物の組み合わせや順番を変えると、同じ生き物でも少し違う姿になりうる。
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { withBrowser, newPage, openTest, advance, frames, arg, OUT } from '../tests/lib.mjs';

// 角度（yaw）：0 でこちらを向き、＋でこちらから見て右へ回る（ラジアン）。図鑑の形（form）ごとに決める。無い形は DEFAULT
const DEFAULT = { yaw: 0.6 }; // 斜め前（約35°）
const BY_FORM = {
  troll: { yaw: 0.25 }, // 人型の大きな物と主は、ほぼ正面の方が形が分かる
  lichking: { yaw: 0.25 },
  nagaqueen: { yaw: 0.25 },
  shadowking: { yaw: 0.25 },
  shadowserpent: { yaw: 0.25 },
  olddragon: { yaw: 1.2 }, // 斜め前だと、頭が画面の端や図鑑の枠に隠れる
  spiderqueen: { yaw: 1.1 }, // 横寄りの方が、胴と頭が脚に埋もれない
};
// 眠る姿も写す形（図鑑で寝起きをくり返す竜）
const ALSO_SLEEP = new Set(['dragon']);
// 既定で写す物（図鑑の名前）
const PICK = [
  '竜',
  '年老いた竜',
  '燃える鱗の竜（見本）',
  'トロル',
  'クラーケン',
  '不死の王',
  '蜘蛛の女王',
  'ナーガの女王',
  '深みの主',
  '最後の王の影',
  '最後の王の影（底の闇）',
];
const POSE_NAME = { stand: '', walk: '-歩く', sleep: '-眠り' };
const WAIT = 3; // 出してから写すまでのゲームの秒（歩く姿が歩幅いっぱいになり、灯りが落ち着くまで）

const argv = process.argv.slice(2);
const outDir = resolve(arg('--out', join(OUT, 'shots')));
const names = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const all = argv.includes('--all'),
  bare = argv.includes('--bare');
mkdirSync(outDir, { recursive: true });

const errs = [];
await withBrowser(async ({ browser, base }) => {
  const pg = await newPage(browser, errs, { width: 960, height: 540, still: true });
  await openTest(pg, base);
  await advance(pg, 1);
  const list = await pg.evaluate(() => __test.gallery());
  if (typeof list === 'string') throw new Error(list);
  const want = all ? list : (names.length ? names : PICK).map((w) => list.find((e) => e.name === w || e.key === w) || w);
  const missing = want.filter((e) => typeof e === 'string');
  if (missing.length) {
    console.log('図鑑に無い名前：', missing.join('、'));
    console.log('図鑑の名前：', list.map((e) => e.name).join('、'));
    process.exitCode = 1;
    return;
  }
  if (bare) await pg.addStyleTag({ content: '#gal{visibility:hidden!important}' });
  for (const e of want) {
    const { yaw } = BY_FORM[e.form] || DEFAULT;
    for (const pose of ALSO_SLEEP.has(e.form) ? ['stand', 'sleep'] : ['stand']) {
      const r = await pg.evaluate(({ n, yaw, pose }) => __test.galleryShow(n, { yaw, pose }), { n: e.n, yaw, pose });
      if (typeof r === 'string') throw new Error(r);
      await advance(pg, WAIT);
      await frames(pg, 2);
      const file = join(outDir, `${String(e.n).padStart(2, '0')}-${e.name.replace(/[\\/:*?"<>|（）\s]/g, '_')}${POSE_NAME[pose]}.png`);
      await pg.screenshot({ path: file, timeout: 90000 });
      console.log(file);
    }
  }
});
if (errs.length) {
  console.log('page errors:', errs);
  process.exitCode = 1;
}
