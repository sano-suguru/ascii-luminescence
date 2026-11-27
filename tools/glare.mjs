#!/usr/bin/env node
// 敵に攻撃を当てた時の眩しさを、本物の階で写して数える（テスト版を組み立てて、テスト用モードで）。当てた時に体が白く飛んでいないかを確かめる時に使う。
//   pnpm glare                     既定の生き物（GLARE_PICK）を、近接（blade）と飛ぶ物（bolt）で
//   pnpm glare ゴブリン ヘビ       図鑑の名前（表の鍵でもよい）で選ぶ
//   --weapons blade,bolt           使う武器（RUNE_DEF の攻撃の鍵）
//   --scene 1:202                  写す階（深さ:シード）
//   --hide hands,swing             tick の段（src/game/30-loop-init.js の inPhase の名前。生き物の体は 'mob draw'、剣の波は飛ぶ物の 'projs'）を止めた時も撃って写し、
//                                  止めない時と並べて出す（何が光っているかを切り分ける時に。__test.skipPhase）
//   --out <ディレクトリ>           置き場所（既定 tests/out/glare/）
// 写す物：生き物をプレイヤーの前に置いて照準を合わせ（照準の先は明るく描く。tests/lib.mjs の aimAt）、当てる前の1枚を写す。それから右手で撃ち（strike）、
// 体力が減った（当たった）次のフレームから、光り終わる（当たって光る残りの秒 hitT が 0 になる）まで1フレームずつ写す（0 になったフレームが最後の1枚）。写真ごとに、当てる前の体の範囲（__test.monsterView の画面の範囲）の中で、
//   白飛び：3つの色がどれも 245 以上の画素の割合（ほぼ真っ白。形も色も読めない所）
//   眩しさ：明るさ（輝度）200 以上の画素の割合（pnpm lords と同じ境）
//   明るさ：範囲の中の明るさの平均（0〜255）
//   画面：画面全体で、明るさ 200 以上の画素の割合（目の前に描く振った線の光や、光のにじみが画面に広がった分も入る）
// と、写した時の体の明るさの元（当たって光る残りの秒 hitT・倍率 glow・照準の先か）を出し、summary.json に書く。
// 写真は <名前>-<武器>[-hide-<段>]-<before|hit0…>.png（画面全体）と、行が生き物と武器の組（--hide なら、止めない時と止めた時の2行）、
// 列が当てる前・当たった次のフレーム・その後のフレームの、体のまわりを切り抜いて並べた1枚 glare.png。画面全体の霞は、切り抜きでは見えないので、元の写真を1枚ずつ見る。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { withBrowser, newPage, openTest, advance, frames, aimAt, strike, arg, OUT } from '../tests/lib.mjs';
import { cropRect, writeSheet } from './sheet.mjs';

const W = 960,
  H = 540,
  CLIP = { x: 0, y: 0, width: W, height: H },
  AFTER_MAX = 30, // 当たった後に写すフレームの数の上限（1フレーム＝ゲームの1/30秒。当たって光る hitT は 0.22〜0.35 秒なので、ふつうは 7〜11 枚で光り終わる）
  GLARE_PICK = ['ゴブリン', 'トロル', 'レイス'];
const argv = process.argv.slice(2);
const usage = (why) => {
  console.log(`${why}\n使い方：pnpm glare [名前…] [--weapons blade,bolt] [--scene 1:202] [--hide 段,…] [--out <ディレクトリ>]`);
  process.exit(1);
};
const opt = (k) => {
  const v = arg(k, null);
  if (argv.includes(k) && (!v || v.startsWith('--'))) usage(`${k} の後に値を書いてください`);
  return v;
};
const outDir = resolve(opt('--out') ?? join(OUT, 'glare'));
const weapons = (opt('--weapons') ?? 'blade,bolt').split(',');
const [depth, seed] = (opt('--scene') ?? '1:202').split(':').map(Number);
if (!(depth >= 1 && depth <= 13 && seed >= 0)) usage('--scene は 深さ:シード（深さは 1 から 13）');
const hide = opt('--hide')?.split(',').filter(Boolean) ?? [];
const VALUED = new Set(['--out', '--weapons', '--scene', '--hide']);
const picked = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1] ?? ''));
const names = picked.length ? picked : GLARE_PICK;
mkdirSync(outDir, { recursive: true });

const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
/** 写真 png の、画面の範囲 box の中の数 */
function count(png, box) {
  const d = png.data;
  let n = 0,
    white = 0,
    bright = 0,
    sum = 0;
  for (let y = box.y0; y < box.y1; y++)
    for (let x = box.x0; x < box.x1; x++) {
      const i = (y * png.width + x) * 4,
        l = lum(d, i);
      n++;
      sum += l;
      if (l >= 200) bright++;
      if (d[i] >= 245 && d[i + 1] >= 245 && d[i + 2] >= 245) white++;
    }
  const r = (v) => +(n ? v / n : 0).toFixed(4);
  return { white: r(white), bright: r(bright), mean: +(n ? sum / n : 0).toFixed(1) };
}
/** 写真 file の、体の範囲 box の中の数と、画面全体の眩しさ screen（振った線など、体の外の光も入る） */
function measure(file, box) {
  const png = PNG.sync.read(readFileSync(file));
  return { ...count(png, box), screen: count(png, { x0: 0, y0: 0, x1: png.width, y1: png.height }).bright };
}

/** 1つの生き物を1つの武器で撃って写す（skip：止める tick の段）。写真と数の一覧を返す */
async function shoot(browser, base, key, weapon, prefix, errs, skip = []) {
  const pageErrs = [];
  const pg = await newPage(browser, pageErrs, { width: W, height: H, still: true });
  const fail = async (why) => {
    errs.push(`${prefix}：${why}`);
    await pg.close();
    return null;
  };
  await openTest(pg, base, `seed=${seed}&depth=${depth}&god=1`);
  const skipped = await pg.evaluate((s) => __test.skipPhase(s), skip);
  if (skipped.join() !== skip.join()) return fail(`止められない段がある（${skip.join('・')} → ${skipped.join('・')}）`);
  await advance(pg, 2); // 階に入ると、約1.25秒かけて明るくなる
  // 置く所：見えている床で、近接なら 1.8 マス、飛ぶ物なら 4 マスほど先の物
  const want = weapon === 'blade' ? 1.8 : 4;
  const r = await pg.evaluate(
    ([key, weapon, want]) => {
      const eq = __test.equip('R', weapon);
      if (eq !== weapon) return { err: eq };
      __test.clearAll();
      __test.fov();
      const s = __test.state(),
        { w, h } = __test.size(),
        cells = [];
      for (let i = 0; i < w * h; i++) {
        const c = __test.cell(i);
        if (!c.floor || !c.seen) continue;
        const d = Math.hypot(c.x - s.pos[0], c.z - s.pos[1]);
        if (d >= want - 0.6 && d <= want + 1.5) cells.push([Math.abs(d - want), i]);
      }
      cells.sort((a, b) => a[0] - b[0]);
      if (!cells.length) return { err: '置く床が無い' };
      __test.summon(key, cells[0][1]);
      return { ok: true };
    },
    [key, weapon, want],
  );
  if (r.err) return fail(r.err);
  const shots = [];
  const snap = async (tag) => {
    const file = `${prefix}-${tag}.png`;
    await pg.screenshot({ path: file, timeout: 90000 });
    // 写した時の、体の明るさの元（当たって光る残りの秒 hitT・明るさの倍率 glow・気づいている度合い alert・照準の先か aimed）
    const mob = await pg.evaluate(() => __test.mob(0));
    shots.push({
      tag,
      file,
      hitT: +(mob?.hitT ?? 0).toFixed(3),
      glow: +(mob?.glow ?? 0).toFixed(2),
      alert: +(mob?.alert ?? 0).toFixed(2),
      aimed: !!mob?.aimed,
    });
  };
  // 照準の先にしてから（照準の先は明るく描くので、当てる前もそうしておく）、当てる前を写す
  try {
    await aimAt(pg, key);
  } catch (e) {
    return fail(`${e.message}（当てる前の明るさを比べられない）`);
  }
  await frames(pg, 1);
  const box = await pg.evaluate((key) => __test.monsterView(key)?.screen ?? null, key);
  if (!box) return fail('生き物が描かれていない');
  await snap('before');
  // 撃つ：近接は押した時に当たる。飛ぶ物は溜めきってから離す（tests/lib.mjs の strike）
  try {
    await strike(pg, 'R', key);
  } catch (e) {
    return fail(e.message);
  }
  // 当たった次のフレームから、光り終わる（hitT が 0 になる）まで写す
  await frames(pg, 1);
  await snap('hit0');
  for (let k = 1; k <= AFTER_MAX && shots.at(-1).hitT > 0; k++) {
    await frames(pg, 1);
    await snap(`hit${k}`);
  }
  if (shots.at(-1).hitT > 0) errs.push(`${prefix}：${AFTER_MAX} フレーム写しても光り終わらない`);
  if (pageErrs.length) errs.push(`${prefix}：${pageErrs.join(' / ')}`);
  await pg.close();
  return { box, shots: shots.map((s) => ({ ...s, ...measure(s.file, box) })) };
}

const errs = [],
  rows = [],
  sheetRows = [];
await withBrowser(async ({ browser, base }) => {
  const pg = await newPage(browser, errs, { width: W, height: H, still: true });
  await openTest(pg, base);
  await advance(pg, 1);
  const list = await pg.evaluate(() => __test.gallery());
  await pg.close();
  if (typeof list === 'string') throw new Error(list);
  for (const want of names) {
    const e = list.find((x) => (x.name === want || x.key === want) && !String(x.key).includes(':'));
    if (!e) {
      errs.push(`図鑑に無い名前：${want}`);
      continue;
    }
    for (const weapon of weapons)
      for (const skip of hide.length ? [[], hide] : [[]]) {
        const tail = skip.length ? `-hide-${skip.join('_').replace(/\s/g, '-')}` : '',
          prefix = join(outDir, `${e.name.replace(/[\\/:*?"<>|（）\s]/g, '_')}-${weapon}${tail}`);
        const got = await shoot(browser, base, e.key, weapon, prefix, errs, skip);
        if (!got) continue;
        rows.push({ name: e.name, key: e.key, weapon, hide: skip, ...got });
        const rect = cropRect([got.box], CLIP);
        sheetRows.push(got.shots.map((s) => ({ file: s.file, rect })));
        const pct = (v) => `${(v * 100).toFixed(1).padStart(5)}%`;
        console.log(`${e.name}（${weapon}${skip.length ? `・止めた段：${skip.join('・')}` : ''}）`);
        for (const s of got.shots)
          console.log(
            `  ${s.tag.padEnd(6)} 白飛び ${pct(s.white)}  眩しさ ${pct(s.bright)}  明るさ ${String(s.mean).padStart(5)}  画面 ${pct(s.screen)}  hitT ${s.hitT.toFixed(2)}  glow ${s.glow}${s.aimed ? '  照準' : ''}`,
          );
      }
  }
});
if (sheetRows.length) {
  const file = join(outDir, 'glare.png');
  writeSheet(sheetRows, file, 200);
  console.log(
    `${file}（行：${rows.map((r) => `${r.name}・${r.weapon}${r.hide.length ? `・止めた段 ${r.hide.join('・')}` : ''}`).join(' / ')}。列：当てる前・当たったフレーム・光り終わるまでのフレーム）`,
  );
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ depth, seed, hide, rows }, null, 2) + '\n');
if (errs.length) {
  console.log('うまくいかなかった物：', errs);
  process.exitCode = 1;
}
