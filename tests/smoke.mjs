#!/usr/bin/env node
// スモークテスト：ふだんのページが起動するか、開発用の冒険で dbg が動くか、冒険の始め直しで前の場所や状態が残らないか
// （特別な階・階段を下りる途中で死んだ時、試しの間から始めた時）と、メニューの確かめの受付が切れるか。扉や火など、世界とのやり取りは tests/world.mjs。ページのエラーを確かめ、画面写真を tests/out/ に保存。
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

    // 4. 階段を下りて暗くなる途中に死んで、すぐ Enter で始め直しても、深さ1から（階を移る途中が残って深さ2へ動かない）
    await pg.evaluate(() => dbg.go(3));
    await advance(pg, 2);
    await pg.evaluate(() => {
      dbg.to('stairs');
      dbg.clear(); // 階段の番人がいると、封じられて下りられない
    });
    await pg.keyboard.down('KeyW');
    let tr = null;
    for (let i = 0; i < 40 && tr !== 'out'; i++) {
      await advance(pg, 0.1);
      tr = await pg.evaluate(() => __test.state().trans);
    }
    await pg.keyboard.up('KeyW');
    if (tr !== 'out') errs.push('階段を下り始められていない（テストの前提が崩れた）');
    await pg.evaluate(() => dbg.hurt(9999));
    await advance(pg, 0.1);
    await pg.keyboard.press('Enter');
    await advance(pg, 2);
    const afterStairs = await pg.evaluate(() => dbg.info());
    if (afterStairs.depth !== 1) errs.push(`下りる途中に死んだ後の新しい冒険が深さ1で始まっていない：深さ${afterStairs.depth}`);

    // 5. 試しの間からメニューで新しい冒険を始めると、ふつうの冒険になる（試しの間のままだと、傷を受けない）
    const menu = async (k) => {
      await pg.evaluate((k) => document.querySelector(`#menu button.row[data-k="${k}"]`).click(), k);
      await advance(pg, 0.1);
    };
    await pg.keyboard.press('Escape');
    await advance(pg, 0.1);
    await menu('title');
    await menu('title'); // 2回押すとタイトルへ
    await advance(pg, 1);
    await pg.evaluate(() => document.getElementById('galR').click());
    await advance(pg, 2);
    await pg.keyboard.press('Escape');
    await advance(pg, 0.1);
    await menu('new');
    await menu('new'); // 2回押すと新しい冒険
    await advance(pg, 2);
    const hp0 = await pg.evaluate(() => dbg.info().hp);
    await pg.evaluate(() => dbg.hurt(5));
    await advance(pg, 0.1);
    const hp1 = await pg.evaluate(() => dbg.info().hp);
    if (!(hp1 < hp0)) errs.push(`試しの間から始めた新しい冒険で、傷を受けない：体力 ${hp0} → ${hp1}`);

    // 6. メニューの「新しい冒険」の、もう一度押して確かめる受付は、4秒で切れる（メニューを開いていて、ゲームの時刻が止まっていても）
    await pg.keyboard.press('Escape');
    await advance(pg, 0.1);
    await menu('new');
    await advance(pg, 6); // メニューを開いている間は止まっているので、ゲームの時刻は進まない（テストの時計は進む）
    await menu('new');
    const still = await pg.evaluate(() => __test.state().paused);
    if (!still) errs.push('メニューで「新しい冒険」を押してから6秒たって、もう一度押したら、確かめずに新しい冒険が始まった');
    else await pg.keyboard.press('Escape');
  },
  { prod: process.argv.includes('--prod') },
);
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
