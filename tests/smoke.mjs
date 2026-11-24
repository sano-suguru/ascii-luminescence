#!/usr/bin/env node
// スモークテスト：ふだんのページが起動するか、開発用の冒険で dbg が動くか。ページのエラーを確かめ、画面写真を tests/out/ に保存。
//   node tests/smoke.mjs          テスト版（.build/test/。既定）
//   node tests/smoke.mjs --prod   公開用の版（dist/）。JetBrains Mono を指定した所の日本語は、システムのフォントで描く
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

    // 3. 特別な階（大広間）で死んで、Enter で新しい冒険を始めると、深さ1から（特別な階は残らない）
    await pg.evaluate(() => dbg.inter('bigroom'));
    await advance(pg, 2);
    const inBig = await pg.evaluate(() => dbg.info());
    if (inBig.inter !== 'bigroom') errs.push(`大広間に入れていない：${JSON.stringify(inBig).slice(0, 160)}`);
    await pg.evaluate(() => dbg.hurt(9999)); // god=1 でも dbg.hurt は傷を受ける
    await advance(pg, 1);
    await pg.keyboard.press('Enter');
    await advance(pg, 2);
    const again = await pg.evaluate(() => dbg.info());
    if (again.depth !== 1 || again.inter !== null)
      errs.push(`新しい冒険が深さ1の普通の階で始まっていない：${JSON.stringify(again).slice(0, 160)}`);
  },
  { prod: process.argv.includes('--prod') },
);
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
