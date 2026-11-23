#!/usr/bin/env node
// スモークテスト：組み立て → 配信 → タイトル → 開発用の冒険 → dbg を少し → ページのエラーを確かめ、画面写真を tests/out/ に保存。
//   node tests/smoke.mjs          three.js は node_modules から（オフラインで動く。既定）
//   node tests/smoke.mjs --cdn    公開用と同じく CDN から（ネットワークが必要）
// メモ：ヘッドレスの Chromium はソフトウェアGL（swiftshader）で、とても遅い（960x540 で1秒に1フレームほど）。
//       ゲームの時間もゆっくり進むので、実時間ではなくゲームの時間で待つこと。長いテストは分ける。
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from '../tools/build.mjs';
import { serve } from '../tools/serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests/out');
mkdirSync(out, { recursive: true });
const dir = build({ test: !process.argv.includes('--cdn') });
const srv = await serve(dir);
const url = (q = '') => `http://127.0.0.1:${srv.port}/index.html${q}`;
// 実時間ではなく、描いたフレームの数で待つ（遅いマシンでも、ゲームが同じだけ進む）。
const frames = (pg, n) => pg.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errs = [];
try {
  const pg = await browser.newPage({ viewport: { width: 960, height: 540 } });
  pg.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  pg.on('requestfailed', (r) => console.log('request failed:', r.url()));
  await pg.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new Error('no')); });

  // 1. タイトル
  await pg.goto(url(), { waitUntil: 'commit', timeout: 120000 });
  await pg.waitForSelector('#enter', { timeout: 90000 });
  await frames(pg, 3);
  await pg.screenshot({ path: join(out, 'title.png'), timeout: 90000 });

  // 2. 開発用の冒険（すべて解放済み、dbg が使える）
  await pg.goto(url('?dev=1&seed=202&depth=3&god=1'), { waitUntil: 'commit', timeout: 120000 });
  // window.dbg は読み込んだ時点で入るので、階ができて info() が深度3を返すまで待つ。
  await pg.waitForFunction(() => { try { const i = dbg.info(); return i && i.depth === 3 && i.monsters > 0; } catch { return false; } }, null, { timeout: 90000, polling: 500 });
  await frames(pg, 8);
  console.log('info:', await pg.evaluate(() => JSON.stringify(dbg.info()).slice(0, 300)));
  await pg.evaluate(() => { dbg.to('altar'); });
  await frames(pg, 3);
  await pg.screenshot({ path: join(out, 'run.png'), timeout: 90000 });
} finally {
  await browser.close();
  srv.close();
}
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
