// テストの共通部分：組み立て・配信・ブラウザ・テスト用モードのページ。
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build, locateInPage } from '../tools/build.mjs';
import { serve } from '../tools/serve.mjs';

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

// ページのエラーの「index.html?…:行:列」に、src/game/ の場所を書き足す（組み立てたページの行は、元のファイルの行と違うため）
let pageText = null;
export const annotate = (s) =>
  !pageText
    ? s
    : s.replace(/index\.html(?:\?[^:\s)]*)?:(\d+):(\d+)/g, (all, l, c) => {
        const r = locateInPage(pageText, Number(l));
        return r.file ? `${all} (${r.file}:${r.line}:${c})` : all;
      });

// 組み立てて配信し、ブラウザを開く。fn が終わったら必ず閉じる。
export async function withBrowser(fn, { cdn = false } = {}) {
  mkdirSync(OUT, { recursive: true });
  const dir = build({ test: !cdn });
  pageText = readFileSync(join(dir, 'index.html'), 'utf8');
  const srv = await serve(dir);
  // システムのフォントを見せない（tests/fonts.conf）。テスト版は Web フォントを同梱しているので、どのマシンでも同じ文字になる。
  // 公開用の版（cdn）は Google Fonts を読むので、ふつうの設定のままにする。
  const env = cdn ? process.env : { ...process.env, FONTCONFIG_FILE: join(ROOT, 'tests/fonts.conf') };
  const browser = await chromium.launch({ args: GL_ARGS, env });
  try {
    return await fn({ browser, base: `http://127.0.0.1:${srv.port}/index.html` });
  } finally {
    await browser.close();
    srv.close();
  }
}

// ページを作る。ページのエラーは errs に集める。ポインタロックは止める。
// still: CSS のアニメーションとトランジションを止める（実際の時間で進むので、画面写真が揺れる。いつも終わった後の姿にする）
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
