#!/usr/bin/env node
// 組み立てたページの行が、src/game/ のどのファイルの何行目かを調べる（ブラウザのエラーの場所を、元のファイルに直す）。
//   node tools/where.mjs 4321                 dist/index.html の 4321 行目
//   node tools/where.mjs index.html:4321:12   エラーに出た場所をそのまま貼ってよい
//   node tools/where.mjs 4321 --test          テスト版（.build/test/index.html）の行。テストのエラーはテストが自動で直して出す
// 組み立てたページには、ファイルの境目に「// ===== src/game/xx.js =====」の行が入っている。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { locateInPage } from './build.mjs';

const root = join(import.meta.dirname, '..');
const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const m = arg && arg.match(/(?:^|:)(\d+)(?::(\d+))?$/);
if (!m) {
  console.log('使い方：node tools/where.mjs <行> [--test]   例：node tools/where.mjs index.html:4321:12');
  process.exit(1);
}
const line = Number(m[1]),
  col = m[2];
const page = join(root, process.argv.includes('--test') ? '.build/test/index.html' : 'dist/index.html');
let text;
try {
  text = readFileSync(page, 'utf8');
} catch {
  console.log(`${page} が無い（先に組み立てること：pnpm build、テスト版は pnpm build:test）`);
  process.exit(1);
}
// 組み立てた後に src を変えていたら、行がずれているかもしれない
const srcs = [join(root, 'src/head.html'), ...readdirSync(join(root, 'src/game')).map((f) => join(root, 'src/game', f))];
if (srcs.some((f) => statSync(f).mtimeMs > statSync(page).mtimeMs))
  console.log(`注意：${page} は src より古い。組み立て直さないと、行がずれているかもしれない`);
const r = locateInPage(text, line);
const OUT = {
  range: `${page} は ${text.split('\n').length} 行しかない`,
  head: 'ゲーム本体の外（head.html の部分）',
  marker: 'ファイルの境目の行（印のコメント）',
  tail: 'ゲーム本体の外（包みの終わりより後ろ）',
};
if (r.outside) {
  console.log(OUT[r.outside]);
  process.exit(r.outside === 'range' ? 1 : 0);
}
console.log(`${r.file}:${r.line}${col ? ':' + col : ''}`);
console.log(`  ${r.text.trim().slice(0, 160)}`);
