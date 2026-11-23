#!/usr/bin/env node
// src/head.html + src/game.js を、1ファイルのページに組み立てる。
//   node tools/build.mjs          -> dist/index.html（three.js は CDN から。公開用）
//   node tools/build.mjs --test   -> .build/test/index.html（three.js は node_modules からコピー。オフラインのテスト用）
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
// テスト版では、Google Fonts の代わりに npm の @fontsource を読む（どのマシンでも同じ文字の形にするため）
const TEST_FONTS = ['jetbrains-mono/400', 'jetbrains-mono/700', 'jetbrains-mono/800', 'm-plus-1-code/400', 'm-plus-1-code/600', 'm-plus-1-code/700', 'noto-sans-runic/400'];

export function assemble() {
  const head = readFileSync(join(root, 'src/head.html'), 'utf8');
  const game = readFileSync(join(root, 'src/game.js'), 'utf8');
  return head + '<script>\n' + game + '\n</script>\n</body>\n</html>\n';
}

export function build({ test = false } = {}) {
  let page = assemble();
  const outDir = join(root, test ? '.build/test' : 'dist');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  if (test) {
    const files = [...page.matchAll(/src="https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/([^"]+)"/g)].map((m) => m[1]);
    if (!files.length) throw new Error('three.js の <script> が head.html に見つからない');
    for (const f of files) {
      const dst = join(outDir, 'three', f);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(join(root, 'node_modules/three', f), dst);
    }
    page = page.replaceAll(CDN, 'three/');
    const links = page.match(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g) || [];
    if (!links.some((l) => l.includes('stylesheet'))) throw new Error('Google Fonts の <link> が head.html に見つからない');
    page = page.replace(links[0], TEST_FONTS.map((f) => `<link rel="stylesheet" href="fonts/${f}.css">\n`).join(''));
    for (const l of links.slice(1)) page = page.replace(l, '');
    symlinkSync(join(root, 'node_modules/@fontsource'), join(outDir, 'fonts'), 'junction');
  }
  const out = join(outDir, 'index.html');
  writeFileSync(out, page);
  console.log(`built ${relative(root, out)} (${Math.round(Buffer.byteLength(page) / 1024)} KB)`);
  return outDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build({ test: process.argv.includes('--test') });
