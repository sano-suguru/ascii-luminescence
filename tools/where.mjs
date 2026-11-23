#!/usr/bin/env node
// 組み立てた JS の場所が、src/game/ のどのファイルの何行目かを調べる（ブラウザのエラーの場所を、元のファイルに直す）。
//   node tools/where.mjs index-D0mETEmY.js:4321:12   エラーに出た場所をそのまま貼ってよい（assets/… や URL の形も可）
//   node tools/where.mjs 4321                        dist/assets/ の JS（1つだけのはず）の 4321 行目
//   node tools/where.mjs 4321 --test                 テスト版（.build/test/）。テストのエラーはテストが自動で直して出す
// 組み立てた JS は Vite が書き直している（字下げなど）ので、行は元のファイルと違う。ソースマップ（.build/maps/。公開しない）で戻す。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findMap, originalPosition } from './sourcemap.mjs';

const root = join(import.meta.dirname, '..');
const test = process.argv.includes('--test');
const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const m = arg && arg.match(/(?:([\w.-]+\.js)(?:\?[^:]*)?:)?(\d+)(?::(\d+))?\)?$/);
if (!m) {
  console.log('使い方：node tools/where.mjs <JS:行:列 か 行> [--test]   例：node tools/where.mjs index-D0mETEmY.js:4321:12');
  process.exit(1);
}
const outDir = join(root, test ? '.build/test' : 'dist'),
  mapDir = join(root, '.build/maps', test ? 'test' : 'production'),
  build = test ? 'pnpm build:test' : 'pnpm build';
let js = m[1];
if (!js) {
  let list = [];
  try {
    list = readdirSync(join(outDir, 'assets')).filter((f) => f.endsWith('.js'));
  } catch {}
  if (list.length !== 1) {
    console.log(
      list.length ? `JS が ${list.length} 個ある。ファイル名も付けること：${list.join(' ')}` : `${outDir} が無い（先に ${build}）`,
    );
    process.exit(1);
  }
  js = list[0];
}
const map = findMap(js, mapDir);
if (!map) {
  console.log(`${js} のソースマップが無い（組み立て直したので名前が変わったのかもしれない。${build} をして、エラーを出し直すこと）`);
  process.exit(1);
}
const line = Number(m[2]),
  col = m[3] ? Number(m[3]) - 1 : 0;
const p = originalPosition(map, line, col);
if (!p) {
  console.log('ゲーム本体の外（包みの行など、元のファイルに対応する行が無い）');
  process.exit(0);
}
// 組み立てた後に src を変えていたら、行がずれているかもしれない
try {
  if (statSync(join(root, p.source)).mtimeMs > statSync(join(outDir, 'assets', js)).mtimeMs)
    console.log(`注意：${p.source} は組み立てた後に変わっている。行がずれているかもしれない`);
} catch {}
console.log(`${p.source}:${p.line}${m[3] ? ':' + (p.column + 1) : ''}`);
try {
  console.log(`  ${readFileSync(join(root, p.source), 'utf8').split('\n')[p.line - 1].trim().slice(0, 160)}`);
} catch {}
