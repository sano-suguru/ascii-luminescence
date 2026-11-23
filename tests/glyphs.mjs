#!/usr/bin/env node
// 使う文字のもれのチェック（ブラウザ不要、数秒）：ゲームの文言（src/game/ と head.html）に出る文字が、パネルのフォントで描けるか。
//   - M PLUS 1 Code（パネルのフォント。太さ400・600・700のすべて）に入っている → よい
//   - 入っていない → head.html の BIZ UDGothic の text=（補いの文字の一覧）に入っていなければ失敗
//   - ルーン文字（U+16A0–16FF）は Noto Sans Runic で描くので対象外
// 一覧に足した文字は、BIZ UDGothic に入っているかも確かめる。幅の数え方（visW）は tests/panels.mjs が確かめる。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as fontkit from 'fontkit';
import { gameSource } from '../tools/build.mjs';
import { ROOT } from './lib.mjs';

const head = readFileSync(join(ROOT, 'src/head.html'), 'utf8'), game = gameSource();
const m = head.match(/family=BIZ\+UDGothic[^"]*?[?&]text=([^&"]+)/);
if (!m) { console.log('✗ head.html に BIZ UDGothic の text= が見つからない'); process.exit(1); }
const extra = new Set([...decodeURIComponent(m[1])]);

// @fontsource の CSS から、どのファイルがどの範囲を持つかを読み、必要なファイルだけ開く。
// 範囲の書いていない面は、全部の範囲を持つものとして扱う。ファイルの無い面は飛ばす（@fontsource の書き方が変わっても落ちないように）
const faces = (pkg, weight) => readFileSync(join(ROOT, `node_modules/@fontsource/${pkg}/${weight}.css`), 'utf8').split('@font-face').slice(1).map((f) => {
  const file = f.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1], range = f.match(/unicode-range:\s*([^;]+);/)?.[1];
  return file && { file: join(ROOT, `node_modules/@fontsource/${pkg}/files`, file),
    ranges: range ? range.split(',').map((t) => t.trim().replace(/^U\+/i, '').split('-').map((x) => parseInt(x, 16))) : [[0, 0x10ffff]] };
}).filter(Boolean);
const cache = new Map(), open = (f) => { if (!cache.has(f)) cache.set(f, fontkit.openSync(f)); return cache.get(f); };
const has = (list, cp) => list.some((fc) => fc.ranges.some(([a, b]) => a <= cp && cp <= (b ?? a)) && open(fc.file).hasGlyphForCodePoint(cp));
// 太さごとに確かめる（どの太さにも入っていること）
const mplus = [400, 600, 700].map((w) => faces('m-plus-1-code', w)), biz = [400, 700].map((w) => faces('biz-udgothic', w));
const hasAll = (sets, cp) => sets.every((list) => has(list, cp));

// head.html は、コメントを除いた本文（CSS の content なども描かれうるので残す）
const headText = head.replace(/<!--[\s\S]*?-->/g, '');
const chars = [...new Set([...game, ...headText].filter((c) => c.codePointAt(0) >= 0x80))];
const missing = [], unused = new Set(extra);
for (const c of chars) {
  const cp = c.codePointAt(0);
  if (cp >= 0x16a0 && cp <= 0x16ff) continue;
  if (hasAll(mplus, cp)) continue;
  if (extra.has(c)) { unused.delete(c); continue; }
  missing.push(c);
}
const notInBiz = [...extra].filter((c) => !hasAll(biz, c.codePointAt(0)));
const hex = (c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
let fail = false;
if (missing.length) { fail = true; console.log(`✗ M PLUS 1 Code に無く、BIZ UDGothic の一覧にも無い文字：${missing.map((c) => `${c}（${hex(c)}）`).join(' ')}\n  → 別の文字にするか、head.html の text= に足して visW の幅も合わせる`); }
if (notInBiz.length) { fail = true; console.log(`✗ BIZ UDGothic にも無い文字が一覧にある：${notInBiz.join(' ')}`); }
if (unused.size) console.log(`△ 一覧にあるが、M PLUS 1 Code で描ける（または使っていない）文字：${[...unused].join(' ')}`);
if (!fail) console.log(`✓ ${chars.length} 文字、すべてパネルのフォントで描ける（補い ${extra.size - unused.size} 文字）`);
process.exit(fail ? 1 : 0);
