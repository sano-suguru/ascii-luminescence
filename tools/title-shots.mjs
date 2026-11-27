#!/usr/bin/env node
// タイトルの画面を、開き方（誰が・どこで開いたか）と画面の大きさごとに写す（node tools/title-shots.mjs [--keep]）。
// 開発用の物（［開発用モード］・［自動で試す］）が誰に見えるかと、タイトルが画面に収まるかを、目で確かめるため。
// Artifact 版（.build/artifact/index.html）を、テスト用モードでなく開く（テスト用モードは開発用モードを必ずオンにするため）。
// 開き方：
//   guest：ふつうの人（Cloudflare の版と同じ。window.claude が無い）
//   shared：共有された Artifact を、持ち主でない人が開いた（偽の window.claude。持ち主でない）
//   owner：持ち主が Artifact を開いた（偽の window.claude の持ち主。開発用モードはオフ）
//   dev：?dev=1 を付けて開いた（開発用モードがオン）
//   owner-dev：持ち主が、開発用モードをオンにしたまま開いた（al_dev が '1'）
// 画面：750x312（claude.ai のアプリの中の iPhone 横）・iPhone 13 横（Safari）・1280x720（パソコン）
// 写真と、ボタンが見えるか・送らずに［迷宮に入る］まで見えるか・倍率の一覧 summary.json は tests/out/title-shots/。--keep で組み立て済みの Artifact 版を使う
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { build } from 'vite';
import { GL_ARGS, ROOT, OUT } from '../tests/lib.mjs';
import { fakeClaude } from '../tests/page-fakes.mjs';
import { serve } from './serve.mjs';

const dir = join(OUT, 'title-shots');
mkdirSync(dir, { recursive: true });
if (!process.argv.includes('--keep')) await build({ configFile: join(ROOT, 'vite.config.mjs'), mode: 'artifact', logLevel: 'warn' });
const srv = await serve(join(ROOT, '.build/artifact'), 0, {});
const browser = await chromium.launch({ args: GL_ARGS, env: { ...process.env, FONTCONFIG_FILE: join(ROOT, 'tests/fonts.conf') } });
const WHO = {
  guest: { claude: null, query: '', dev: false },
  shared: { claude: false, query: '', dev: false },
  owner: { claude: true, query: '', dev: false },
  dev: { claude: null, query: '?dev=1', dev: false },
  'owner-dev': { claude: true, query: '', dev: true },
};
const SCREENS = {
  '750x312': { viewport: { width: 750, height: 312 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  iphone13: { ...devices['iPhone 13 landscape'] },
  '1280x720': { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
};
const rows = [];
try {
  for (const [scr, opts] of Object.entries(SCREENS))
    for (const [who, w] of Object.entries(WHO)) {
      const ctx = await browser.newContext(opts);
      const pg = await ctx.newPage();
      const errs = [];
      pg.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
      if (w.claude !== null) await pg.addInitScript(fakeClaude, w.claude);
      if (w.dev) await pg.addInitScript(() => localStorage.setItem('al_dev', '1'));
      await pg.goto(`http://127.0.0.1:${srv.port}/index.html${w.query}`, { waitUntil: 'commit', timeout: 120000 });
      await pg.waitForSelector('#enter', { timeout: 120000 });
      // 持ち主かを確かめるのは、タイトルを描いた後（非同期）。分かって描き直すまで待つ
      await pg.waitForTimeout(w.claude ? 2500 : 1000);
      await pg.evaluate(() => document.fonts.ready);
      await pg.waitForTimeout(300);
      const m = await pg.evaluate(() => {
        const it = document.getElementById('intro'),
          p = document.getElementById('intropanel'),
          vis = (id) => {
            const e = document.getElementById(id);
            if (!e) return null;
            const r = e.getBoundingClientRect();
            return r.bottom <= it.clientHeight + 0.5 ? 'seen' : 'scroll';
          };
        return {
          zoom: Number(p.style.zoom || 1),
          scroll: it.scrollHeight > it.clientHeight ? `${it.scrollHeight}/${it.clientHeight}` : '',
          enter: vis('enter'),
          dev: vis('galDev'),
          auto: vis('autoB'),
          devText: document.getElementById('galDev')?.innerText ?? '',
        };
      });
      const file = `${scr}-${who}.png`;
      await pg.screenshot({ path: join(dir, file), timeout: 90000 });
      rows.push({ screen: scr, who, ...m, errors: errs, file });
      console.log(
        `${scr.padEnd(9)} ${who.padEnd(10)} 倍率 ${m.zoom.toFixed(2)}  ［迷宮に入る］${m.enter}  ［開発用モード］${m.dev ? `${m.dev}（${m.devText.replace(/\[|\]|開発用モード：/g, '')}）` : '無し'}  ［自動で試す］${m.auto ?? '無し'}` +
          `${m.scroll ? `  送る ${m.scroll}` : ''}${errs.length ? `  エラー ${errs.join(' / ')}` : ''}`,
      );
      await ctx.close();
    }
} finally {
  await browser.close();
  srv.close();
}
writeFileSync(join(dir, 'summary.json'), JSON.stringify(rows, null, 1));
console.log(`写真：${dir}`);
