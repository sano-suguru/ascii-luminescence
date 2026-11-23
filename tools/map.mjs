#!/usr/bin/env node
// ゲーム本体の地図：src/game/ のファイルごとに、行の数と、中の見出し（// ----- の行）を出す。
//   node tools/map.mjs          全部
//   node tools/map.mjs 火       見出しに「火」を含むファイルだけ（英語の見出しにも当たる。例：fire）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gameParts } from './game-source.mjs';

const root = join(import.meta.dirname, '..'),
  q = process.argv[2]?.toLowerCase();
for (const f of gameParts()) {
  const lines = readFileSync(join(root, 'src/game', f), 'utf8').split('\n');
  const heads = lines
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => l.startsWith('// -----'))
    .map(([n, l]) => [n, l.replace(/^\/\/ -+ */, '')]);
  if (q && !f.includes(q) && !heads.some(([, h]) => h.toLowerCase().includes(q))) continue;
  console.log(`src/game/${f}  (${lines.length - 1} 行)`);
  for (const [n, h] of heads) console.log(`  ${String(n).padStart(4)}  ${h.slice(0, 110)}`);
}
