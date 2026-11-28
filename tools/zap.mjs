#!/usr/bin/env node
// 水の中に立つ何体かの敵の1体に雷を当て、ほかの敵へ伝わるところを、時間を追って写す（テスト版を組み立てて、テスト用モードで）。
// 雷が水を伝わる見た目（src/lib/combat.ts の conductWater・chainLightning と、src/lib/fx.ts の描き方）を直す時に使う。
//   pnpm zap                        既定（蛇の穴の水場、シード202。ゴブリンを4体）
//   pnpm zap ゴブリン               生き物を図鑑の名前（表の鍵でもよい）で選ぶ
//   --scene 4:202                   写す階（深さ:シード。URL の指定そのもの seed=202&branch=snake でもよい）
//   --n 4                           水の中に置く数（当てる1体を含む。2〜7）
//   --dry                           水の外にも1体置く（雷は跳ぶが、水を伝わらない物）
//   --weapon bolt                   右手の武器（RUNE_DEF の攻撃の鍵）。性質は雷にする
//   --frames 18                     当たった後に写すフレームの数（1フレーム＝ゲームの1/30秒）
//   --out <ディレクトリ>            置き場所（既定 tests/out/zap/）
// 写す物：水のマスが固まっている所を探し、当てる1体と、そのまわり 1.6〜4.5 の水のマスに残りを置いて止め（__test.hold）、3.5〜5.5 離れた床から照準を合わせる。
// 目の高さ（eye）と、プレイヤーの後ろの高い所に置いたカメラ（top。__test.cam）の2通りで、当てる前の1枚と、当たったフレームから --frames 枚を写す
// （テスト用モードなので、2通りとも同じ場面になる）。写真は <見え方>-<before|hNN>.png（画面全体）と、体のまわりを切り抜いて時間の順に並べた
// <見え方>.png（行ごとに6枚）。数は summary.json：フレームごとの、置いた生き物の体力と、稲妻の数（__test.traces の bolts）。
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { withBrowser, newPage, openTest, advance, frames, aimAt, strike, arg, OUT } from '../tests/lib.mjs';
import { cropRect, writeSheet } from './sheet.mjs';
import { MTYPES } from '../src/lib/creatures.ts';

const W = 960,
  H = 540,
  CLIP = { x: 0, y: 0, width: W, height: H };
const argv = process.argv.slice(2);
const usage = (why) => {
  console.log(`${why}\n使い方：pnpm zap [名前] [--scene 4:202] [--n 4] [--dry] [--weapon bolt] [--frames 18] [--out <ディレクトリ>]`);
  process.exit(1);
};
const opt = (k) => {
  const v = arg(k, null);
  if (argv.includes(k) && (!v || v.startsWith('--'))) usage(`${k} の後に値を書いてください`);
  return v;
};
const outDir = resolve(opt('--out') ?? join(OUT, 'zap'));
const scene = opt('--scene') ?? 'seed=202&branch=snake',
  [depth, seed] = scene.split(':').map(Number);
// 深さ:シードか、URL の指定そのもの（例：seed=202&branch=snake）
const query = scene.includes('=') ? scene : `seed=${seed}&depth=${depth}`;
if (!scene.includes('=') && !(depth >= 1 && depth <= 13 && seed >= 0))
  usage('--scene は 深さ:シード（深さは 1 から 13）か、URL の指定（seed=202&branch=snake）');
const count = Number(opt('--n') ?? 4);
if (!(count >= 2 && count <= 7)) usage('--n は 2 から 7');
const after = Number(opt('--frames') ?? 18);
const weapon = opt('--weapon') ?? 'bolt';
const dry = argv.includes('--dry');
const VALUED = new Set(['--out', '--scene', '--n', '--weapon', '--frames']);
const want = argv.find((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1] ?? '')) ?? 'ゴブリン';
const hit = Object.entries(MTYPES).filter(([k, t]) => !t.dummy && (k === want || t.name === want));
if (hit.length !== 1) usage(`表に無い名前：${want}`);
const key = hit[0][0];
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.png')) rmSync(join(outDir, f));

/** 場面を作る：水の固まりを探し、生き物を置いて止め、プレイヤーを離れた床に立たせて当てる1体を向く。置いた所を返す */
const setup = (pg) =>
  pg.evaluate(
    ([key, count, dry, weapon]) => {
      const eq = __test.equip('R', weapon);
      if (eq !== weapon) return { err: `武器 ${weapon}：${eq}` };
      const el = __test.elem('R', 'thunder');
      if (el !== 'thunder') return { err: `雷：${el}` };
      __test.clearAll();
      const { w, h } = __test.size(),
        cells = [];
      for (let i = 0; i < w * h; i++) {
        const c = __test.cell(i);
        cells.push({ i, ...c });
      }
      const water = cells.filter((c) => c.water && c.floor),
        floor = cells.filter((c) => c.floor),
        d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
      for (const t of water) {
        // まわりの水：互いに 1.4 以上離れた物を、近い順に選ぶ
        const near = water.filter((c) => c !== t && d(c, t) >= 1.6 && d(c, t) <= 4.5).sort((a, b) => d(a, t) - d(b, t)),
          picks = [t];
        for (const c of near) if (picks.length < count && picks.every((p) => d(p, c) >= 1.4)) picks.push(c);
        if (picks.length < count) continue;
        let dryCell = null;
        if (dry) {
          dryCell = floor.find((c) => !c.water && d(c, t) >= 1.6 && d(c, t) <= 3.5 && picks.every((p) => d(p, c) >= 1.4));
          if (!dryCell) continue;
        }
        // 立つ所：当てる1体から 5〜7 離れた、水でない床で、置いた物が全部見える所
        const stands = floor.filter((c) => !c.water && d(c, t) >= 3.5 && d(c, t) <= 5.5);
        for (const s of stands) {
          dbg.step(s.x, s.z);
          __test.fov();
          const all = dryCell ? [...picks, dryCell] : picks;
          if (!all.every((c) => __test.cell(c.i).seen)) continue;
          all.forEach((c) => __test.summon(key, c.i));
          __test.state().monsters.forEach((_, n) => __test.hold(n, {}));
          return { ok: true, stand: [s.x, s.z], target: [t.x, t.z], cells: all.map((c) => [c.x, c.z]), dry: !!dryCell };
        }
      }
      return { err: `水の中に ${count} 体を置ける所が無い` };
    },
    [key, count, dry, weapon],
  );

const result = { query, key, weapon, views: {} };
const errs = [];
await withBrowser(async ({ browser, base }) => {
  for (const view of ['eye', 'top']) {
    const pageErrs = [];
    const pg = await newPage(browser, pageErrs, { width: W, height: H, still: true });
    await openTest(pg, base, `${query}&god=1`);
    await advance(pg, 2);
    const s = await setup(pg);
    if (s.err) {
      errs.push(`${view}：${s.err}`);
      await pg.close();
      continue;
    }
    await advance(pg, 0.5);
    try {
      await aimAt(pg, key);
    } catch (e) {
      errs.push(`${view}：${e.message}`);
      await pg.close();
      continue;
    }
    if (view === 'top') {
      // プレイヤーの後ろ 2.5、高さ 3.2（天井が低ければ下げる）から、当てる1体と置いた物の真ん中を見下ろす
      const placed = await pg.evaluate((s) => {
        const [px, pz] = s.stand,
          [tx, tz] = s.target,
          mx = s.cells.reduce((a, c) => a + c[0], 0) / s.cells.length,
          mz = s.cells.reduce((a, c) => a + c[1], 0) / s.cells.length,
          dl = Math.hypot(mx - px, mz - pz) || 1;
        for (const y of [3.2, 2.8, 2.4, 2.0])
          for (const back of [2.5, 1.5, 0.5]) {
            const r = __test.cam({
              pos: [px - ((mx - px) / dl) * back, y, pz - ((mz - pz) / dl) * back],
              at: [(mx + tx) / 2, 0.3, (mz + tz) / 2],
            });
            if (typeof r !== 'string' && r.clear) return r;
          }
        return null;
      }, s);
      if (!placed) errs.push('top：見下ろすカメラを置けない（目の高さで写す）');
    }
    const rows = [];
    const snap = async (tag) => {
      const file = join(outDir, `${view}-${tag}.png`);
      await pg.screenshot({ path: file, timeout: 90000 });
      const st = await pg.evaluate(() => {
        const s = __test.state();
        return { hp: s.monsters.map((m) => m[3]), bolts: __test.traces().bolts ?? null, time: +s.time.toFixed(3) };
      });
      rows.push({ tag, file, ...st });
    };
    // 切り抜く範囲：置いた所の足元と、頭の上 1.2 の画面の位置を、全部含む範囲
    const boxes = await pg.evaluate((s) => {
      const p = __test
        .project(
          s.cells.flatMap(([x, z]) => [
            [x, 0, z],
            [x, 1.2, z],
          ]),
        )
        .filter(Boolean);
      if (!p.length) return null;
      const xs = p.map((q) => q[0]),
        ys = p.map((q) => q[1]);
      return [{ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }];
    }, s);
    await frames(pg, 1);
    await snap('before');
    try {
      await strike(pg, 'R', key);
    } catch (e) {
      errs.push(`${view}：${e.message}`);
      await pg.close();
      continue;
    }
    for (let k = 0; k <= after; k++) {
      await frames(pg, 1);
      await snap(`h${String(k).padStart(2, '0')}`);
    }
    if (pageErrs.length) errs.push(`${view}：${pageErrs.join(' / ')}`);
    await pg.close();
    result.views[view] = { setup: s, rows: rows.map(({ file, ...r }) => r) };
    const rect = boxes ? cropRect(boxes, CLIP) : { x: 0, y: 0, side: H };
    const per = 6,
      sheet = [];
    for (let i = 0; i < rows.length; i += per) sheet.push(rows.slice(i, i + per).map((r) => ({ file: r.file, rect })));
    writeSheet(sheet, join(outDir, `${view}.png`), 320);
    console.log(`${view}：${join(outDir, `${view}.png`)}`);
    for (const r of rows) console.log(`  ${r.tag.padEnd(6)} 体力 ${r.hp.join(' ')}  稲妻 ${r.bolts}`);
  }
});
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
if (errs.length) {
  console.log('うまくいかなかった物：', errs);
  process.exitCode = 1;
}
