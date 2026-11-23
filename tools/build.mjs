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
const TEST_FONTS = ['jetbrains-mono/400', 'jetbrains-mono/700', 'jetbrains-mono/800', 'm-plus-1-code/400', 'm-plus-1-code/600', 'm-plus-1-code/700', 'noto-sans-runic/400', 'biz-udgothic/400', 'biz-udgothic/700'];

// ゲームは JetBrains Mono を指定した所でも日本語を書く。JetBrains Mono に日本語は無いので、ふだんはシステムの日本語フォントで
// 描かれる（マシンごとに違う）。テスト版では、M PLUS 1 Code の面を「JetBrains Mono」の名前でも登録して、日本語をそれで描く。
// 同じ名前の面は後に書いた方が先に使われるので、本物の JetBrains Mono（後の <link>）が英数字では勝つ。
// M PLUS 1 Code を指定した所の補い（BIZ UDGothic）は、ゲームの CSS の指定どおり、その名前のまま読み込む（TEST_FONTS）。
function cjkFallback() {
  // 日本語の範囲だけ（記号と句読点・かな・漢字・全角）。罫線（タイトルのロゴ）などは含めない
  const CJK = [[0x3000, 0x30ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xf900, 0xfaff], [0xff00, 0xffef]];
  const hex = (n) => n.toString(16);
  const narrow = (range) => {
    const out = [];
    for (const t of range.split(',')) {
      const [a, b] = t.trim().replace(/^U\+/i, '').split('-').map((x) => parseInt(x, 16));
      for (const [c0, c1] of CJK) { const lo = Math.max(a, c0), hi = Math.min(b ?? a, c1); if (lo <= hi) out.push(lo === hi ? `U+${hex(lo)}` : `U+${hex(lo)}-${hex(hi)}`); }
    }
    return out.join(',');
  };
  const faces = (pkg, w, weight) => readFileSync(join(root, `node_modules/@fontsource/${pkg}/${w}.css`), 'utf8')
    .split('@font-face').slice(1).map((f) => {
      const range = f.match(/unicode-range:\s*([^;]+);/), src = f.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
      const r = range && src ? narrow(range[1]) : ''; // 読めない面は飛ばす（@fontsource の書き方が変わった時に落ちないように）
      return r ? `@font-face{font-family:'JetBrains Mono';font-style:normal;font-display:swap;font-weight:${weight};src:url(fonts/${pkg}/files/${src}) format('woff2');unicode-range:${r};}\n` : '';
    }).join('');
  // M PLUS 1 Code には全角の ！？：［］ などが無いので、BIZ UDGothic（ゲームの CSS でも次の候補）で補う。
  // 先に書いた面ほど後回しになるので、BIZ UDGothic を先、M PLUS 1 Code を後に書く。
  const set = (pkg) => faces(pkg, 400, 400) + faces(pkg, 700, 700) + faces(pkg, 700, 800);
  return set('biz-udgothic') + set('m-plus-1-code');
}

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
    page = page.replace(links[0], `<style>\n${cjkFallback()}</style>\n` + TEST_FONTS.map((f) => `<link rel="stylesheet" href="fonts/${f}.css">\n`).join(''));
    for (const l of links.slice(1)) page = page.replace(l, '');
    symlinkSync(join(root, 'node_modules/@fontsource'), join(outDir, 'fonts'), 'junction');
  }
  const out = join(outDir, 'index.html');
  writeFileSync(out, page);
  console.log(`built ${relative(root, out)} (${Math.round(Buffer.byteLength(page) / 1024)} KB)`);
  return outDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build({ test: process.argv.includes('--test') });
