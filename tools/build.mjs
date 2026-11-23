#!/usr/bin/env node
// src/head.html + src/game.js を、1ファイルのページに組み立てる。
//   node tools/build.mjs          -> dist/index.html（three.js は CDN から。公開用）
//   node tools/build.mjs --test   -> .build/test/index.html（three.js は node_modules からコピー。オフラインのテスト用）
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';

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
  }
  const out = join(outDir, 'index.html');
  writeFileSync(out, page);
  console.log(`built ${relative(root, out)} (${Math.round(Buffer.byteLength(page) / 1024)} KB)`);
  return outDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build({ test: process.argv.includes('--test') });
