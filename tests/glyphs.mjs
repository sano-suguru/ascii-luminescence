#!/usr/bin/env node
// 使う文字のもれのチェック（ブラウザ不要、数秒）：ゲームの文言（src/game/・src/lib/ と index.html）に出る文字が、パネルのフォントで描けるか。
//   - M PLUS 1 Code（パネルのフォント。太さ400・600・700のすべて）に入っている → よい
//   - 入っていない → index.html の BIZ UDGothic の text=（補いの文字の一覧）に入っていなければ失敗
//   - ルーン文字（U+16A0–16FF）は Noto Sans Runic で描くので対象外
// 一覧に足した文字は、BIZ UDGothic に入っているかも確かめる。幅の数え方（visW）は tests/panels.mjs が確かめる。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as fontkit from 'fontkit';
import { gameText } from '../tools/game-source.mjs';
import { ROOT } from './lib.mjs';

const head = readFileSync(join(ROOT, 'src/index.html'), 'utf8'),
  game = gameText();
const m = head.match(/family=BIZ\+UDGothic[^"]*?[?&]text=([^&"]+)/);
if (!m) {
  console.log('✗ index.html に BIZ UDGothic の text= が見つからない');
  process.exit(1);
}
const extra = new Set(decodeURIComponent(m[1]));

// @fontsource の CSS から、どのファイルがどの範囲を持つかを読み、必要なファイルだけ開く。
// 範囲の書いていない面は、全部の範囲を持つものとして扱う。ファイルの無い面は飛ばす（@fontsource の書き方が変わっても落ちないように）
const faces = (pkg, weight) =>
  readFileSync(join(ROOT, `node_modules/@fontsource/${pkg}/${weight}.css`), 'utf8')
    .split('@font-face')
    .slice(1)
    .map((f) => {
      const file = f.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1],
        range = f.match(/unicode-range:\s*([^;]+);/)?.[1];
      return (
        file && {
          file: join(ROOT, `node_modules/@fontsource/${pkg}/files`, file),
          ranges: range
            ? range.split(',').map((t) =>
                t
                  .trim()
                  .replace(/^U\+/i, '')
                  .split('-')
                  .map((x) => parseInt(x, 16)),
              )
            : [[0, 0x10ffff]],
        }
      );
    })
    .filter(Boolean);
const cache = new Map(),
  open = (f) => {
    if (!cache.has(f)) cache.set(f, fontkit.openSync(f));
    return cache.get(f);
  };
const has = (list, cp) =>
  list.some((fc) => fc.ranges.some(([a, b]) => a <= cp && cp <= (b ?? a)) && open(fc.file).hasGlyphForCodePoint(cp));
// 太さごとに確かめる（どの太さにも入っていること）
const mplus = [400, 600, 700].map((w) => faces('m-plus-1-code', w)),
  biz = [400, 700].map((w) => faces('biz-udgothic', w));
const hasAll = (sets, cp) => sets.every((list) => has(list, cp));

// index.html は、コメントを除いた本文（CSS の content なども描かれうるので残す）
const headText = head.replace(/<!--[\s\S]*?-->/g, '');
// oxlint-disable-next-line typescript/no-misused-spread -- フォントの字形はコードポイントごとなので、わざとコードポイントに分ける
const chars = [...new Set([...game, ...headText].filter((c) => c.codePointAt(0) >= 0x80))];
const missing = [],
  unused = new Set(extra);
for (const c of chars) {
  const cp = c.codePointAt(0);
  if (cp >= 0x16a0 && cp <= 0x16ff) continue;
  if (hasAll(mplus, cp)) continue;
  if (extra.has(c)) {
    unused.delete(c);
    continue;
  }
  missing.push(c);
}
const notInBiz = [...extra].filter((c) => !hasAll(biz, c.codePointAt(0)));
const hex = (c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
// 文字が出てくる場所（ファイル:行）。コメントの行には印を付ける（コメントの文字も調べているので、言い換えれば済むことが多い）
const SRC = [
  'src/index.html',
  ...readdirSync(join(ROOT, 'src/game')).map((f) => `src/game/${f}`),
  ...readdirSync(join(ROOT, 'src/lib'), { recursive: true })
    .filter((f) => String(f).endsWith('.ts'))
    .map((f) => `src/lib/${f}`),
];
const whereIs = (c) => {
  const at = [];
  for (const f of SRC)
    readFileSync(join(ROOT, f), 'utf8')
      .split('\n')
      .forEach((l, i) => {
        if (l.includes(c)) at.push(`${f}:${i + 1}${/^\s*(\/\/|\/?\*|<!--)/.test(l) ? '（コメント）' : ''}`);
      });
  return at.length > 3 ? `${at.slice(0, 3).join(' ')} ほか ${at.length - 3} か所` : at.join(' ');
};
let fail = false;
if (missing.length) {
  fail = true;
  console.log(
    `✗ M PLUS 1 Code に無く、BIZ UDGothic の一覧にも無い文字：\n${missing.map((c) => `  ${c}（${hex(c)}）  ${whereIs(c)}`).join('\n')}\n  → 別の文字にするか、index.html の text= に足して visW の幅も合わせる（コメントだけなら、言い換える）`,
  );
}
if (notInBiz.length) {
  fail = true;
  console.log(`✗ BIZ UDGothic にも無い文字が一覧にある：${notInBiz.join(' ')}`);
}
if (unused.size) console.log(`△ 一覧にあるが、M PLUS 1 Code で描ける（または使っていない）文字：${[...unused].join(' ')}`);
if (!fail) console.log(`✓ ${chars.length} 文字、すべてパネルのフォントで描ける（補い ${extra.size - unused.size} 文字）`);
process.exit(fail ? 1 : 0);
