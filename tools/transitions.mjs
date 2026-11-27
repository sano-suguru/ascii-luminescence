#!/usr/bin/env node
// 場面が切り替わる時の確かめ：Artifact 版（.build/artifact/index.html）を、テスト用モードでなく（本物の時計・本物の音の部品で）スマホの大きさで開き、
// 遊ぶ人と同じ順で通す（迷宮に入る → 階段で3回下りる → 死ぬ → ［新しい探索へ］ → 画面の向きを変えて戻す）。
// 偽の window.claude の持ち主として開くので、診断の記録（src/lib/diag.ts）が、iPhone で遊んだ時と同じ形で書かれる。それを tools/diag-report.mjs の表で出し、
// 次のことを確かめる（違えば終わりの値を 1 にする）：
//   - 音の部品が、自動再生を許さないブラウザの真似（tests/page-fakes.mjs の strictAudio）で、押すまで動かず、押すと動き出す
//   - かかった時間が、迷宮に入った時・音を鳴らし始めた時（先に作った部品で）・階を作った時（階段の数だけ）・死んだ時・新しい探索で書かれる
//   - 画面の大きさを変えた時は作り直し、同じ大きさの resize では作り直さない
// 使い方：node tools/transitions.mjs [--rate 1,4]（CPU を何倍遅くするか。既定は 1） [--keep]（組み立て済みの Artifact 版を使う）
// 時間は CPU で描くこの環境の値（GPU に送る時間などは本物の端末と違う）。遅いフレームは、CPU で描く分いつも出るので、数より「近くの処理」と長さを見る。
// 記録の JSON は tests/out/transitions/x<倍>.json に置く（node tools/diag-report.mjs でもう一度表にできる）
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { build } from 'vite';
import { GL_ARGS, ROOT, OUT, arg } from '../tests/lib.mjs';
import { fakeClaude, readDiag, strictAudio } from '../tests/page-fakes.mjs';
import { report } from './diag-report.mjs';
import { serve } from './serve.mjs';

const RATES = String(arg('--rate', '1')).split(',').map(Number);
const dir = join(OUT, 'transitions');
mkdirSync(dir, { recursive: true });
if (!process.argv.includes('--keep')) await build({ configFile: join(ROOT, 'vite.config.mjs'), mode: 'artifact', logLevel: 'warn' });
const srv = await serve(join(ROOT, '.build/artifact'), 0, {});
const browser = await chromium.launch({ args: GL_ARGS, env: { ...process.env, FONTCONFIG_FILE: join(ROOT, 'tests/fonts.conf') } });
const fails = [];
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** cond がページの中で真になるまで待つ（本物の時計。CPU で描くので遅い） */
const until = async (pg, cond, sec, what, a) => {
  for (let t = 0; t < sec * 4; t++) {
    if (await pg.evaluate(cond, a)) return true;
    await sleep(250);
  }
  fails.push(`${what}が ${sec} 秒たっても起きない`);
  return false;
};
try {
  for (const rate of RATES) {
    // 本物の端末（iPhone の横向き、claude.ai のアプリの中で 750×312）と同じ大きさ。画素の倍率は 1（CPU で描くので、3 では遅すぎる）
    const ctx = await browser.newContext({ viewport: { width: 750, height: 312 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => fails.push(`ページのエラー：${String(e).slice(0, 300)}`));
    await pg.addInitScript(strictAudio);
    await pg.addInitScript(fakeClaude, true);
    // ?dev=1：開発用モード（dbg で階段の前へ行く・体力を減らす）。テスト用モードではない
    await pg.goto(`http://127.0.0.1:${srv.port}/index.html?dev=1&seed=202`, { waitUntil: 'commit', timeout: 120000 });
    await pg.waitForSelector('#enter', { timeout: 120000 });
    await sleep(2000);
    const cdp = await ctx.newCDPSession(pg);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const tap = async (sel) => {
      await pg.locator(sel).scrollIntoViewIfNeeded();
      const b = await pg.locator(sel).boundingBox();
      if (!b) throw new Error(`${sel} が見えない`);
      await pg.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    };
    // 1. 迷宮に入る
    await tap('#enter');
    await until(pg, () => document.body.classList.contains('started'), 30, '迷宮に入ること');
    await sleep(3000);
    // 2. 階段で3回下りる（階段の2マス手前に置き、番人を消して、前へ歩く。暗転の真ん中で新しい階を作る）
    for (let k = 0; k < 3; k++) {
      const d0 = await pg.evaluate(() => dbg.info().depth);
      // 歩いても下りられない時（行く手の物に引っかかるなど）は、階段の前に置き直す（3回まで）
      let down = false;
      for (let tries = 0; tries < 3 && !down; tries++) {
        await pg.evaluate(() => (dbg.to('stairs'), dbg.clear()));
        await pg.keyboard.down('KeyW');
        for (let t = 0; t < 80 && !down; t++) {
          await sleep(250);
          down = await pg.evaluate((d) => dbg.info().depth !== d, d0);
        }
        await pg.keyboard.up('KeyW');
      }
      if (!down) fails.push(`x${rate}：${k + 1}回目の階段で下りられない`);
      await sleep(3000);
      console.log(`x${rate}：階段 ${k + 1} 回目：深さ ${d0} → ${await pg.evaluate(() => dbg.info().depth)}`);
    }
    // 3. 死んで、［新しい探索へ］（暗くしてから、真っ暗な間に新しい探索を始める）
    console.log(`x${rate}：死ぬ：${JSON.stringify(await pg.evaluate(() => dbg.hurt(9999)))}`);
    await until(pg, () => document.getElementById('death')?.classList.contains('show'), 30, '結果の画面が出ること');
    await tap('#newRunB');
    await until(pg, () => dbg.info().depth === 1 && !document.body.classList.contains('over'), 30, '新しい探索が始まること');
    await sleep(3000);
    // 4. 画面の向きを変えて戻す。間に、同じ大きさの resize を1つ出す（作り直さないはず）
    await pg.setViewportSize({ width: 312, height: 750 });
    await sleep(1500);
    await pg.evaluate(() => window.dispatchEvent(new Event('resize')));
    await pg.setViewportSize({ width: 750, height: 312 });
    await sleep(1500);
    // 記録を読む
    const rec = await readDiag(pg);
    if (!rec) {
      fails.push(`x${rate}：診断の記録が書かれない`);
      await ctx.close();
      continue;
    }
    writeFileSync(join(dir, `x${rate}.json`), JSON.stringify(rec, null, 1));
    console.log(`---- CPU ${rate}倍遅く`);
    console.log(report(rec).join('\n'));
    const ev = (k, v) => rec.events.some((e) => e.k === k && e.v === v);
    const took = (k) => rec.took.filter((r) => r.k === k);
    const pressAt = rec.events.find((e) => e.k === 'press' && String(e.v).startsWith('enter'))?.t ?? Infinity;
    if (!ev('audio', 'running')) fails.push(`x${rate}：音の部品が動き出さない`);
    if (rec.events.some((e) => e.k === 'audio' && e.v === 'running' && e.t < pressAt)) fails.push(`x${rate}：押す前に音の部品が動いた`);
    if (!took('start').length || took('sndInit')[0]?.early !== true) fails.push(`x${rate}：迷宮に入った時・音を鳴らし始めた時の記録が無い`);
    if (took('newLevel').length < 4)
      fails.push(`x${rate}：階を作った記録が ${took('newLevel').length} 回（階段3回と新しい探索で4回のはず）`);
    if (took('die').length !== 1 || took('newRun').length !== 1) fails.push(`x${rate}：死んだ時・新しい探索の記録が無い`);
    const rs = took('applySize').filter((r) => r.why === 'resize');
    if (rs.length !== 2)
      fails.push(`x${rate}：画面の大きさを変えた時の作り直しが ${rs.length} 回（縦・横の2回のはず。同じ大きさでは作り直さない）`);
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.close();
}
console.log(fails.length ? `\n確かめて違った所：\n  ${fails.join('\n  ')}` : '\n確かめた所は、どれも思ったとおり');
process.exitCode = fails.length ? 1 : 0;
