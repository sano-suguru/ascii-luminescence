#!/usr/bin/env node
// 組み立てたページの行が、src/game/ のどのファイルの何行目かを調べる（ブラウザのエラーの場所を、元のファイルに直す）。
//   node tools/where.mjs 4321                 dist/index.html の 4321 行目
//   node tools/where.mjs index.html:4321:12   エラーに出た場所をそのまま貼ってよい
//   node tools/where.mjs 4321 --test          テスト版（.build/test/index.html）の行
// 組み立てたページには、ファイルの境目に「// ===== src/game/xx.js =====」の行が入っている。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARK } from './build.mjs';

const root = join(import.meta.dirname, '..');
const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const m = arg && arg.match(/(?:^|:)(\d+)(?::(\d+))?$/);
if (!m) { console.log('使い方：node tools/where.mjs <行> [--test]   例：node tools/where.mjs index.html:4321:12'); process.exit(1); }
const line = Number(m[1]), col = m[2];
const page = join(root, process.argv.includes('--test') ? '.build/test/index.html' : 'dist/index.html');
const lines = readFileSync(page, 'utf8').split('\n');
if (line < 1 || line > lines.length) { console.log(`${page} は ${lines.length} 行しかない（組み立て直したかを確かめること）`); process.exit(1); }
for (let i = line - 1; i >= 0; i--) {
  if (lines[i].startsWith(MARK)) {
    if (i === line - 1) { console.log('ファイルの境目の行（印のコメント）'); process.exit(0); }
    const file = lines[i].slice(MARK.length).replace(/ =+$/, '');
    console.log(`${file}:${line - 1 - i}${col ? ':' + col : ''}`);
    console.log(`  ${lines[line - 1].trim().slice(0, 160)}`);
    process.exit(0);
  }
}
console.log('ゲーム本体の外（head.html の部分）');
