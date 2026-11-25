// テストの共通部分：組み立て・配信・ブラウザ・テスト用モードのページ。
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'vite';
import { serve } from '../tools/serve.mjs';
import { findMap, originalPosition } from '../tools/sourcemap.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'tests/out');
export const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};

// ヘッドレスの Chromium はソフトウェアGL（swiftshader）で描く。とても遅い（960x540 で1秒に1フレームほど）。
const GL_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--font-render-hinting=none',
];

// ページのエラーの「assets/index-xxxx.js:行:列」に、src/game/ の場所を書き足す（組み立てた JS は書き直されていて、行が違うため）。
// ソースマップは公開物に入れず、.build/maps/<mode>/ に置いている（vite.config.mjs）
let mapDir = null;
const maps = {};
export const annotate = (s) =>
  !mapDir
    ? s
    : s.replace(/assets\/([\w.-]+\.js)(?:\?[^:\s)]*)?:(\d+):(\d+)/g, (all, f, l, c) => {
        maps[f] ??= findMap(f, mapDir);
        const p = maps[f] && originalPosition(maps[f], Number(l), Number(c) - 1);
        return p ? `${all} (${p.source}:${p.line}:${p.column + 1})` : all;
      });

// 組み立てて配信し、ブラウザを開く。fn が終わったら必ず閉じる。
export async function withBrowser(fn, { prod = false } = {}) {
  mkdirSync(OUT, { recursive: true });
  // テスト版は .build/test/、prod は公開用と同じ dist/（three.js とフォントは、どちらも組み立てに入っている。違いはテスト版の cjkFallback だけ）
  const mode = prod ? 'production' : 'test',
    dir = join(ROOT, prod ? 'dist' : '.build/test');
  await build({ configFile: join(ROOT, 'vite.config.mjs'), mode, logLevel: 'warn' });
  mapDir = join(ROOT, '.build/maps', mode);
  const srv = await serve(dir);
  // システムのフォントを見せない（tests/fonts.conf）。テスト版は日本語も同梱のフォントで描くので、どのマシンでも同じ文字になる。
  // 公開用の版（prod）は、JetBrains Mono を指定した所の日本語をシステムのフォントで描くので、FONTCONFIG_FILE を替えない（システムのフォントも見せる）。
  const env = prod ? process.env : { ...process.env, FONTCONFIG_FILE: join(ROOT, 'tests/fonts.conf') };
  const browser = await chromium.launch({ args: GL_ARGS, env });
  try {
    return await fn({ browser, base: `http://127.0.0.1:${srv.port}/index.html` });
  } finally {
    await browser.close();
    srv.close();
  }
}

// ページを作る。ページのエラーは errs に集める。ポインタロックは止める。
// still: CSS のアニメーションとトランジションを止める（実際の時間で進むので、撮るたびに画面写真が変わる。いつも終わった後の姿にする）
export async function newPage(browser, errs, { width = 960, height = 540, still = false } = {}) {
  const pg = await browser.newPage({ viewport: { width, height } });
  pg.on('pageerror', (e) => errs.push(annotate(String(e.stack || e)).slice(0, 600)));
  pg.on('requestfailed', (r) => console.log('request failed:', r.url(), r.failure()?.errorText || ''));
  await pg.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new Error('no'));
  });
  if (still)
    await pg.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style');
        st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important;}';
        document.head.appendChild(st);
      });
    });
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
// 一番近い祭壇のそばへ行く（dbg.to('altar') は2マス手前に置くが、祭壇の画面は1.5以内でないと開かない）
export const nearAltar = (pg) =>
  pg.evaluate(() => {
    dbg.to('altar');
    const [px, pz] = __test.state().pos,
      d = (o) => Math.hypot(o.pos[0] - px, o.pos[1] - pz);
    const a = dbg
      .items()
      .filter((o) => o.altar && o.slot === 1)
      .sort((p, q) => d(p) - d(q))[0];
    if (!a) return false;
    const [ax, az] = a.pos,
      k = 1.2 / (d(a) || 1);
    dbg.step(ax + (px - ax) * k, az + (pz - az) * k);
    return true;
  });
