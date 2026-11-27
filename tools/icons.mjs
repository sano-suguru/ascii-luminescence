// ホーム画面のアイコン（src/icons/icon-192.png・icon-512.png）を作る：node tools/icons.mjs
// タイトルのロゴ（src/index.html の #intro h1）と同じ、JetBrains Mono の太字の「A」を、暗い地に、ロゴと同じ紫の光り方で描く。
// 絵を変えたい時だけ走らせ、できた PNG を git に入れる（組み立てはこの PNG を出すだけ。tools/vite-plugins.mjs の homeScreen）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const root = join(import.meta.dirname, '..');
const font = readFileSync(join(root, 'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-800-normal.woff2')).toString(
  'base64',
);
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const pg = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const k = size / 192;
  await pg.setContent(`<!doctype html><style>
@font-face{font-family:JB;font-weight:800;src:url(data:font/woff2;base64,${font}) format('woff2');}
html,body{margin:0;width:100%;height:100%;background:radial-gradient(circle at 50% 46%,#120d2e 0%,#030209 70%);}
body{display:flex;align-items:center;justify-content:center;}
b{font-family:JB;font-weight:800;font-size:${132 * k}px;line-height:1;color:#f3efff;
  text-shadow:0 0 ${4 * k}px rgba(190,170,255,.85),0 0 ${18 * k}px rgba(120,90,255,.55),0 0 ${46 * k}px rgba(70,190,255,.25);}
</style><b>A</b>`);
  await pg.evaluate('document.fonts.ready');
  await pg.screenshot({ path: join(root, `src/icons/icon-${size}.png`) });
  await pg.close();
}
await browser.close();
console.log('src/icons/icon-192.png・icon-512.png を作った');
