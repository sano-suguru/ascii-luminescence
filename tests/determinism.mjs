#!/usr/bin/env node
// 同じ結果になるかのテスト：同じシードで2回、同じ手順を踏み、ゲームの状態（__test.state）が一致するか。
// 違うシードでは違う結果になることも確かめる（何も動いていないのに「一致」するのを防ぐ）。
import { withBrowser, newPage, openTest, advance } from './lib.mjs';

const steps = async (pg) => {
  await advance(pg, 3);
  await pg.evaluate(() => {
    dbg.to('hub');
  });
  await advance(pg, 4);
  await pg.evaluate(() => {
    dbg.hit(8);
    dbg.hit(8);
  }); // 近くの敵を叩いて、戦いを起こす
  await advance(pg, 5);
  return pg.evaluate(() => __test.state());
};
const errs = [];
const runs = await withBrowser(async ({ browser, base }) => {
  const out = [];
  for (const seed of [202, 202, 203]) {
    const pg = await newPage(browser, errs, { width: 320, height: 180 });
    await openTest(pg, base, `seed=${seed}&depth=4&god=1`);
    out.push(await steps(pg));
    await pg.close();
  }
  return out;
});
const [a, b, c] = runs.map((s) => JSON.stringify(s));
let fail = false;
if (a !== b) {
  fail = true;
  const A = runs[0],
    B = runs[1];
  for (const k in A)
    if (JSON.stringify(A[k]) !== JSON.stringify(B[k]))
      console.log(`✗ 同じシードで違う：${k}\n  1回目 ${JSON.stringify(A[k]).slice(0, 300)}\n  2回目 ${JSON.stringify(B[k]).slice(0, 300)}`);
} else console.log(`✓ 同じシードで一致（ゲームの ${runs[0].time} 秒、敵 ${runs[0].monsters.length} 体）`);
if (a === c) {
  fail = true;
  console.log('✗ 違うシードなのに同じ結果（何も動いていない恐れ）');
} else console.log('✓ 違うシードでは違う結果');
if (!runs[0].monsters.length) {
  fail = true;
  console.log('✗ 敵がいない');
}
if (errs.length) console.log('page errors:', errs);
process.exit(fail || errs.length ? 1 : 0);
