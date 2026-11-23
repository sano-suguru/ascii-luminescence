// テストの共通部分：組み立て・配信・ブラウザ・テスト用モードのページ。
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from '../tools/build.mjs';
import { serve } from '../tools/serve.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'tests/out');
export const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

// ヘッドレスの Chromium はソフトウェアGL（swiftshader）で描く。とても遅い（960x540 で1秒に1フレームほど）。
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

// 組み立てて配信し、ブラウザを開く。fn が終わったら必ず閉じる。
export async function withBrowser(fn, { cdn = false } = {}) {
  mkdirSync(OUT, { recursive: true });
  const srv = await serve(build({ test: !cdn }));
  const browser = await chromium.launch({ args: GL_ARGS });
  try { return await fn({ browser, base: `http://127.0.0.1:${srv.port}/index.html` }); }
  finally { await browser.close(); srv.close(); }
}

// ページを作る。ページのエラーは errs に集める。ポインタロックは止める。
export async function newPage(browser, errs, { width = 960, height = 540 } = {}) {
  const pg = await browser.newPage({ viewport: { width, height } });
  pg.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await pg.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new Error('no')); });
  return pg;
}

// テスト用モード（?test=1）で開き、準備ができるまで待つ。ゲームは、advance / frames を呼ぶまで進まない。
export async function openTest(pg, base, query = '') {
  await pg.goto(`${base}?test=1${query ? '&' + query : ''}`, { waitUntil: 'commit', timeout: 120000 });
  await pg.waitForFunction(() => window.__test && (window.__test.ready() || window.__test.error()), null, { timeout: 90000, polling: 200 });
  const err = await pg.evaluate(() => __test.error());
  if (err) throw new Error(`起動に失敗：${err}`);
}

// 描いて n フレーム進める（1フレーム＝ゲームの 1/30 秒）
export const frames = (pg, n) => pg.evaluate((n) => __test.frames(n), n);
// 描かずに進める（速い）
export const advance = (pg, sec) => pg.evaluate((s) => __test.advance(s), sec);
