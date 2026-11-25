#!/usr/bin/env node
// 主たちを本当にいる場所（支道の奥の階・最深部）に置き、プレイヤーの目の高さから写す（テスト版を組み立てて、テスト用モードで）。
//   pnpm lords                    全部（不死の王・年老いた竜・深みの主・蜘蛛の女王・ナーガの女王・王の影）
//   pnpm lords nest final         場所の鍵で選ぶ（crypt・lair・sunken・nest・snake・final）
//   --dist <数>                   主からの床の上の距離（既定 8）
//   --out <ディレクトリ>          置き場所（既定 tests/out/lords/）
// 写真ごとに、主の体が描かれた画面の範囲（まわりの飾りの粒子や頭の上の印は含めない）の中で、主が足した眩しい画素の割合（眩しさ：主の体だけを描かずに
// 同じ所を写し（主の灯りは残る）、主の体がある時だけ明るさ（輝度）が 200 以上になる画素。光のにじみで形が白や色の塊になった所）と、
// 主の体の文字のうち画面の外に出た割合（はみ出し）を出し、summary.json にも書く。眩しさと大きさを、目で見るのと数で比べる時に使う。
// <場所>.glare.png は、数えた眩しい画素を赤く、主の体の範囲を黄色い枠で塗った写真（主の体を描かないと、目の慣れなどで周りの明るさもわずかに変わるので、
// 範囲の外は数えない）。主は、見通せて床のある向きのうち最初の物から写す（16の向きを順に試す）。王の影は、伝説の物を3つ台座に置いて呼び出す。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { withBrowser, newPage, openTest, advance, frames, arg, OUT } from '../tests/lib.mjs';

const PLACES = {
  crypt: '不死の王',
  lair: '年老いた竜',
  sunken: '深みの主',
  nest: '蜘蛛の女王',
  snake: 'ナーガの女王',
  final: '王の影',
};
const W = 1280,
  H = 720;
const argv = process.argv.slice(2);
const usage = (why) => {
  console.log(`${why}\n使い方：pnpm lords [${Object.keys(PLACES).join('|')}…] [--dist <数>] [--out <ディレクトリ>]`);
  process.exit(1);
};
const dist = Number(arg('--dist', '8'));
if (!(dist >= 2 && dist <= 30)) usage('--dist は 2 から 30 の数にしてください');
const outArg = arg('--out', join(OUT, 'lords'));
if (!outArg || outArg.startsWith('--')) usage('--out の後に、置き場所のディレクトリを書いてください');
const outDir = resolve(outArg);
const names = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out' && argv[i - 1] !== '--dist');
const bad = names.filter((n) => !PLACES[n]);
if (bad.length) usage(`知らない場所：${bad.join('、')}`);
const want = names.length ? names : Object.keys(PLACES);
mkdirSync(outDir, { recursive: true });

// 画面の範囲 box の中で、主の体がある時（png）だけ眩しい（明るさ（輝度）200 以上の）画素の割合。without は主の体を描かなかった時の写真
const lum = (png, i) => 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
const glare = (png, without, box) => {
  let n = 0,
    w = 0;
  for (let y = box.y0; y < box.y1; y++)
    for (let x = box.x0; x < box.x1; x++) {
      const i = (y * png.width + x) * 4;
      n++;
      if (lum(png, i) >= 200 && lum(without, i) < 200) w++;
    }
  return n ? w / n : 0;
};

const rows = [],
  errs = [];
await withBrowser(async ({ browser, base }) => {
  for (const key of want) {
    const pageErrs = [];
    const pg = await newPage(browser, pageErrs, { width: W, height: H, still: true });
    await openTest(pg, base, `seed=202&god=1${key === 'final' ? '&depth=13' : ''}`);
    await advance(pg, 1);
    const r = await pg.evaluate(
      ([key, D]) => {
        const mk = key === 'final' ? 'final' : 'lord';
        if (key === 'final') {
          dbg.give('legends');
          for (let k = 0; k < 3; k++) {
            dbg.to('pedestal');
            __test.advance(0.2);
          }
          __test.advance(4);
        } else {
          dbg.branch(key, 2);
          __test.advance(2);
        }
        const L = __test.state().monsters.find((m) => m[0] === mk);
        if (!L) return { err: '主がいない' };
        const { w } = __test.size(),
          ci = (x, z) => Math.floor(z / 2) * w + Math.floor(x / 2);
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2,
            x = L[1] + Math.sin(a) * D,
            z = L[2] + Math.cos(a) * D;
          if (!__test.cell(ci(x, z)).floor) continue;
          dbg.clear();
          dbg.step(x, z);
          __test.fov();
          if (!__test.cell(ci(L[1], L[2])).seen) continue;
          // 向きは、1フレーム進めて目の位置を新しくしてから決める。狙うのは体の高さの真ん中（目の高さより下にはしない）
          __test.advance(1 / 30);
          const v0 = __test.monsterView(mk);
          dbg.look(L[1], Math.max(1.62, v0 && v0.world ? (v0.world.y0 + v0.world.y1) / 2 : 2), L[2]);
          return { mk };
        }
        return { err: '見通せる床が無い' };
      },
      [key, dist],
    );
    if (r.err) {
      errs.push(`${key}：${r.err}`);
      await pg.close();
      continue;
    }
    await frames(pg, 2);
    const view = await pg.evaluate((mk) => __test.monsterView(mk), r.mk);
    if (!view || !view.world) {
      errs.push(`${key}：主の体が描かれていない`);
      await pg.close();
      continue;
    }
    const buf = await pg.screenshot({ timeout: 90000 });
    const file = join(outDir, `${key}.png`);
    writeFileSync(file, buf);
    const png = PNG.sync.read(buf);
    // 主の体だけを描かずに写す（主は階に残るので、主の灯りはそのまま。描き直すために1フレーム（1/30秒）だけ進める）
    await pg.evaluate((mk) => __test.hideMonster(mk, true), r.mk);
    await pg.evaluate(() => __test.frames(1));
    const without = PNG.sync.read(await pg.screenshot({ timeout: 90000 }));
    await pg.evaluate((mk) => __test.hideMonster(mk, false), r.mk);
    // 数えた画素だけを赤く塗った写真（主の体の範囲の中だけ。範囲の枠は黄色。範囲の外は暗くするだけ）
    const mask = new PNG({ width: png.width, height: png.height }),
      b = view.screen;
    for (let y = 0; y < png.height; y++)
      for (let x = 0; x < png.width; x++) {
        const i = (y * png.width + x) * 4,
          inBox = x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1,
          edge = inBox && (x === b.x0 || x === b.x1 - 1 || y === b.y0 || y === b.y1 - 1),
          hot = inBox && lum(png, i) >= 200 && lum(without, i) < 200;
        const c = edge ? [255, 220, 60] : hot ? [255, 40, 40] : [png.data[i] * 0.35, png.data[i + 1] * 0.35, png.data[i + 2] * 0.35];
        mask.data[i] = c[0];
        mask.data[i + 1] = c[1];
        mask.data[i + 2] = c[2];
        mask.data[i + 3] = 255;
      }
    writeFileSync(join(outDir, `${key}.glare.png`), PNG.sync.write(mask));
    const row = {
      key,
      name: PLACES[key],
      dist,
      height: view.world.y1,
      screen: view.screen,
      cut: view.cut,
      glare: +glare(png, without, view.screen).toFixed(3),
      file,
    };
    rows.push(row);
    console.log(
      `${row.name.padEnd(8, '　')} 高さ ${row.height.toFixed(1).padStart(5)}  画面 ${row.screen.x0}-${row.screen.x1} × ${row.screen.y0}-${row.screen.y1}  はみ出し ${(row.cut * 100).toFixed(1).padStart(5)}%  眩しさ ${(row.glare * 100).toFixed(1).padStart(5)}%`,
    );
    if (pageErrs.length) errs.push(`${key}：${pageErrs.join(' / ')}`);
    await pg.close();
  }
});
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(rows, null, 2) + '\n');
console.log(`写真と summary.json：${outDir}`);
if (errs.length) {
  console.log('うまくいかなかった物：', errs);
  process.exitCode = 1;
}
