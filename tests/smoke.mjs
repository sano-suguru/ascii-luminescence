#!/usr/bin/env node
// スモークテスト：ふだんのページが起動するか、開発用の冒険で dbg が動くか。ページのエラーを確かめ、画面写真を tests/out/ に保存。
//   node tests/smoke.mjs          three.js は node_modules から（オフラインで動く。既定）
//   node tests/smoke.mjs --cdn    公開用と同じく CDN から（ネットワークが必要）
import { join } from 'node:path';
import { withBrowser, newPage, openTest, frames, advance, OUT } from './lib.mjs';

const errs = [];
await withBrowser(
  async ({ browser, base }) => {
    const pg = await newPage(browser, errs);
    // 1. ふだんのページ（テスト用モードではない）：タイトルが出るまで
    await pg.goto(base, { waitUntil: 'commit', timeout: 120000 });
    await pg.waitForSelector('#enter', { timeout: 90000 });
    await pg.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 90000 });
    await pg.waitForTimeout(3000); // ふだんのループが背景の迷宮を描くまで（実時間）
    await pg.screenshot({ path: join(OUT, 'title.png'), timeout: 90000 });

    // 2. テスト用モードで、開発用の冒険（すべて解放済み、dbg が使える）
    await openTest(pg, base, 'seed=202&depth=3&god=1');
    await advance(pg, 2); // 階に入った時の明るくなる演出（約1.25秒）を終わらせる
    await frames(pg, 2);
    const info = await pg.evaluate(() => dbg.info());
    console.log('info:', JSON.stringify(info).slice(0, 200));
    if (info.depth !== 3 || !info.monsters) errs.push(`冒険が始まっていない：${JSON.stringify(info).slice(0, 200)}`);
    await pg.evaluate(() => {
      dbg.to('altar');
    });
    await advance(pg, 1);
    await frames(pg, 2);
    await pg.screenshot({ path: join(OUT, 'run.png'), timeout: 90000 });
  },
  { cdn: process.argv.includes('--cdn') },
);
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
