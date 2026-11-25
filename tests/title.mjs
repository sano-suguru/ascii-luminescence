#!/usr/bin/env node
// タイトルの画面のテスト（どれもテスト用モードでない時のページ）：タイトルの画面が出るか、開発用モードのまま読み直した時・保存が使えない時のタイトル。
// テスト用モードではないので、ゲームを止めて進められない。待つのは、タイトルが出るまでと、背景の迷宮を描いたフレームが2つ進むまでだけ。ページのエラーを確かめ、画面写真を tests/out/ に保存。
//   node tests/title.mjs          テスト版（.build/test/。既定）
//   node tests/title.mjs --prod   公開用の版（dist/）。JetBrains Mono を指定した所の日本語は、システムのフォントで描く
import { join } from 'node:path';
import { withBrowser, newPage, OUT } from './lib.mjs';

const errs = [];
await withBrowser(
  async ({ browser, base }) => {
    const pg = await newPage(browser, errs);
    // 1. テスト用モードでない時：タイトルの画面が出るまで
    await pg.goto(base, { waitUntil: 'commit', timeout: 120000 });
    await pg.waitForSelector('#enter', { timeout: 90000 });
    await pg.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 90000 });
    // メインループが背景の迷宮を描くまで（テスト用モードでないので、描いたフレームが2つ進むのを待つ）
    await pg.evaluate(
      () =>
        new Promise((ok) => {
          let n = 0;
          const f = () => (++n >= 2 ? ok() : requestAnimationFrame(f));
          requestAnimationFrame(f);
        }),
    );
    await pg.screenshot({ path: join(OUT, 'title.png'), timeout: 90000 });
    await pg.close(); // テスト用モードでないので、開いたままだと、メインループが描き続けて重い

    // 2. 開発用モードをオンにしたまま（localStorage の al_dev が '1'）、?dev=1 も ?test=1 も付けずにページを読み直しても、
    //    タイトルは開発用モードの形で出る（試練の行がある。ボタンは「オン」）。テスト用モードではないので、タイトルが出るまでだけ待つ
    const dev = await newPage(browser, errs);
    await dev.addInitScript(() => {
      try {
        localStorage.setItem('al_dev', '1');
      } catch {}
    });
    await dev.goto(base, { waitUntil: 'commit', timeout: 120000 });
    await dev.waitForSelector('#enter', { timeout: 90000 });
    const title = await dev.evaluate(() => document.getElementById('intropanel').innerText);
    if (!title.includes('開発用モード：オン')) errs.push('開発用モードのまま読み直したのに、タイトルのボタンが「オン」でない');
    if (!title.includes('試練'))
      errs.push('開発用モードのまま読み直したのに、タイトルに試練の行が出ない（開発用モードではすべて解放済みのはず）');
    await dev.close();
    // 3. localStorage が使えない時（保存を止めたブラウザ）も、開発用モードのボタンを押すと、表示が「オン」に変わる
    const blocked = await newPage(browser, errs);
    await blocked.addInitScript(() => {
      const no = () => {
        throw new Error('storage blocked');
      };
      Storage.prototype.getItem = no;
      Storage.prototype.setItem = no;
    });
    await blocked.goto(base, { waitUntil: 'commit', timeout: 120000 });
    await blocked.waitForSelector('#galDev', { timeout: 90000 });
    await blocked.evaluate(() => document.getElementById('galDev').click());
    const label = await blocked.evaluate(() => document.getElementById('galDev').innerText);
    if (!label.includes('オン')) errs.push(`保存が使えない時、開発用モードを押しても表示が「オン」にならない：${label}`);
    await blocked.close();
  },
  { prod: process.argv.includes('--prod') },
);
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
