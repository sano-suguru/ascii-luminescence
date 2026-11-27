#!/usr/bin/env node
// タイトルの画面のテスト（どれもテスト用モードでない時のページ）：タイトルの画面が出るか、開発用モードのまま読み直した時・保存が使えない時のタイトル、
// 自動再生を許さないブラウザで、音の部品がタイトルでは動かず、迷宮に入ると動き出すか（診断の記録で見る）。
// テスト用モードではないので、ゲームを止めて進められない。待つのは、タイトルが出るまでと、背景の迷宮を描いたフレームが2つ進むまでだけ。ページのエラーを確かめ、画面写真を tests/out/ に保存。
//   node tests/title.mjs          テスト版（.build/test/。既定）
//   node tests/title.mjs --prod   公開用の版（dist/）。JetBrains Mono を指定した所の日本語は、システムのフォントで描く
import { join } from 'node:path';
import { withBrowser, newPage, OUT } from './lib.mjs';
import { fakeClaude, readDiag, strictAudio } from './page-fakes.mjs';

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
    // 4. 自動再生を許さないブラウザ（iPhone の Safari など。tests/page-fakes.mjs の strictAudio で真似る）：音の部品はタイトルを出した時に先に作るが（src/lib/audio.ts の sndPrep）、
    //    動かない。［迷宮に入る］を押すと、押した中で動かし始める（sndInit）。本物の時計なので、診断の記録（偽の window.claude の持ち主）の
    //    音の部品の状態 audio と、かかった時間 took（迷宮に入った時・音を鳴らし始めた時）で見る。テスト用モードでは音の部品が偽物で、いつも動いているので、ここで見る
    const snd = await newPage(browser, errs);
    await snd.addInitScript(strictAudio);
    await snd.addInitScript(fakeClaude, true);
    await snd.goto(base, { waitUntil: 'commit', timeout: 120000 });
    await snd.waitForSelector('#enter', { timeout: 90000 });
    await snd.waitForTimeout(1500); // 診断の記録が始まり（持ち主かを確かめる）、できごとを 0.25 秒ごとに見るまで
    const before = await readDiag(snd);
    if (!before) errs.push('音の部品：診断の記録が書かれない（テストの前提が崩れた）');
    else if (before.events.some((e) => e.k === 'audio')) errs.push(`音の部品：押す前に動いている（${JSON.stringify(before.events)}）`);
    await snd.click('#enter');
    let after = null;
    for (let i = 0; i < 20 && !after?.events.some((e) => e.k === 'audio' && e.v === 'running'); i++) {
      await snd.waitForTimeout(300);
      after = await readDiag(snd);
    }
    if (!after?.events.some((e) => e.k === 'audio' && e.v === 'running'))
      errs.push(`音の部品：［迷宮に入る］を押しても動き出さない（${JSON.stringify(after?.events ?? null).slice(0, 300)}）`);
    const tk = (k) => after?.took.find((r) => r.k === k);
    if (!tk('start') || tk('sndInit')?.early !== true)
      errs.push(`音の部品：かかった時間の記録が無い（${JSON.stringify(after?.took ?? null).slice(0, 300)}）`);
    else console.log(`迷宮に入る：${tk('start').ms}ms（音を鳴らし始める ${tk('sndInit').ms}ms）`);
    await snd.close();
  },
  { prod: process.argv.includes('--prod') },
);
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
