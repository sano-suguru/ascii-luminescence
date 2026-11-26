#!/usr/bin/env node
// 図鑑の生き物を、見やすい角度で写す（テスト版を組み立てて、テスト用モードの図鑑で __test.galleryShow を使う）。
//   pnpm shots                  決めた12枚（下の PICK の11体。竜は眠る姿も写す）
//   pnpm shots 竜 トロル        名前で選ぶ（図鑑の名前と同じ。図鑑の鍵（D・T・lord:lair）でもよい）
//   pnpm shots --all            図鑑の全部
//   --bare                      図鑑の枠を隠す（体の下の方が枠に隠れる大きな生き物に）
//   --views                     生き物ごとに、角度の一揃い（下の VIEWS の7枚：正面・斜め前・横・後ろ・上から・歩く姿・遠く）を写す。
//                               図鑑の枠を隠し、体の高さの真ん中を画面の真ん中に置き、真ん中の 540×540 を切り出す。ファイル名は <番号>-<名前>-<向き>.png
//                               （形や色を直す時に。例：pnpm shots トロル --views）
//   --out <ディレクトリ>        置き場所（既定 tests/out/shots/）
// 同じコマンドなら、いつも同じ写真になる（テスト用モード）。写す物の組み合わせや順番を変えると、同じ生き物でも写真が少し変わる：
// 羽ばたきはゲームの時計で動き、時計は写すたびに進む。火花・炎のゆらぎは乱数で決まり、乱数の進み方は前に写した物の描き方で変わる。
// 背景に漂う粒も、前に写した時のカメラの位置を少し引きずる。
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { withBrowser, newPage, openTest, advance, frames, arg, OUT } from '../tests/lib.mjs';

// 写し方は図鑑の形（form）ごとに決める。無い形は DEFAULT。無い欄は、図鑑が生き物の大きさから決める写し方のまま
//   yaw：0 でこちらを向き、＋でこちらから見て右へ回る（ラジアン）
//   zoom：寄る・引く（距離を 1/zoom 倍。0.5〜3。書かなければ 1。部屋の壁より外には引かず、寄っても体の外で止まる）
//   pitch：見下ろす角度（ラジアン。0 で真横から、＋で上から。-0.3〜1.3。天井より上には出ない。書かなければ、図鑑が生き物の大きさから決める高さ）
const DEFAULT = { yaw: 0.6 }; // 斜め前（約35°）
const BY_FORM = {
  troll: { yaw: 0.25 }, // 人型の大きな物と主は、ほぼ正面の方が形が分かる
  lichking: { yaw: 0.25 },
  nagaqueen: { yaw: 0.25 },
  shadowking: { yaw: 0.25 },
  shadowserpent: { yaw: 0.25 },
  olddragon: { yaw: 1.2, pitch: 0.3 }, // 斜め前だと頭が画面の端や図鑑の枠に隠れる。少し上から見ると、頭まで枠の上に収まる
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
  '王の影',
  '王の影（底の闇）',
];
// --views で写す7枚（__test.galleryShow に渡す値）
const VIEWS = [
  { view: 'front', opt: { yaw: 0, pose: 'stand', zoom: 1.4 } },
  { view: 'q34', opt: { yaw: 0.8, pose: 'stand', zoom: 1.4 } },
  { view: 'side', opt: { yaw: 1.57, pose: 'stand', zoom: 1.4 } },
  { view: 'back', opt: { yaw: 3.0, pose: 'stand', zoom: 1.4 } },
  { view: 'high', opt: { yaw: 0.5, pose: 'stand', zoom: 1.2, pitch: 0.7 } },
  { view: 'walk', opt: { yaw: 0.6, pose: 'walk', zoom: 1.4 } },
  { view: 'far', opt: { yaw: 0.4, pose: 'stand', zoom: 0.6 } },
];
const VIEW_CLIP = { x: 210, y: 0, width: 540, height: 540 }; // 960×540 の真ん中
const POSE_NAME = { stand: '', walk: '-歩く', sleep: '-眠り' };
const WAIT = 3; // 出してから写すまでのゲームの秒（灯りと姿が落ち着くまで。眠りから起きる時の形の移り変わりは約1秒）

const argv = process.argv.slice(2);
const usage = (why) => {
  console.log(`${why}\n使い方：pnpm shots [名前…] [--all] [--bare] [--views] [--out <ディレクトリ>]`);
  process.exit(1);
};
const outArg = arg('--out', join(OUT, 'shots'));
if (!outArg || outArg.startsWith('--')) usage('--out の後に、置き場所のディレクトリを書いてください');
const outDir = resolve(outArg);
const names = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const all = argv.includes('--all'),
  bare = argv.includes('--bare'),
  views = argv.includes('--views');
if (all && names.length) usage(`--all と名前（${names.join('、')}）は一緒に使えません。どちらかにしてください`);
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
  if (bare || views) await pg.addStyleTag({ content: '#gal{visibility:hidden!important}' });
  const fileBase = (e) => join(outDir, `${String(e.n).padStart(2, '0')}-${e.name.replace(/[\\/:*?"<>|（）\s]/g, '_')}`);
  const shot = async (e, opt, file, clip) => {
    const r = await pg.evaluate(({ n, opt }) => __test.galleryShow(n, opt), { n: e.n, opt });
    if (typeof r === 'string') throw new Error(r);
    await advance(pg, WAIT);
    await frames(pg, 2);
    await pg.screenshot({ path: file, timeout: 90000, ...(clip ? { clip } : {}) });
    console.log(file);
  };
  for (const e of want) {
    if (views) {
      for (const { view, opt } of VIEWS) await shot(e, { ...opt, center: true }, `${fileBase(e)}-${view}.png`, VIEW_CLIP);
      continue;
    }
    const { yaw, zoom = 1, pitch = null } = BY_FORM[e.form] || DEFAULT;
    for (const pose of ALSO_SLEEP.has(e.form) ? ['stand', 'sleep'] : ['stand']) {
      await shot(e, { yaw, pose, zoom, pitch }, `${fileBase(e)}${POSE_NAME[pose]}.png`);
    }
  }
});
if (errs.length) {
  console.log('page errors:', errs);
  process.exitCode = 1;
}
