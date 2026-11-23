#!/usr/bin/env node
// ゲーム本体（src/game/*.js）の構文と lint（Oxlint）。1つのファイルだけでは、ほかのファイルの名前が分からないので、
// つないだもの（gameSource）を .build/lint/ の一時ファイルに書き出してまとめて調べ、場所を「src/game/xx.js:行:列」に直して出す。
// 一時ファイルは毎回違う名前にして、終わったら消す（編集直後の hook と pnpm check が同時に動いても、途中まで書いたファイルを読まないように）。
//   node tools/lint-game.mjs           エラーと警告
//   node tools/lint-game.mjs --quiet   エラーだけ（pnpm check、編集直後の hook）
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gameSource, gameLayout, locate } from './game-source.mjs';

const root = join(import.meta.dirname, '..');
const quiet = process.argv.includes('--quiet');
const code = gameSource(),
  file = join(root, `.build/lint/game-${process.pid}-${Date.now()}.js`);
mkdirSync(join(root, '.build/lint'), { recursive: true });
writeFileSync(file, code);
let out;
try {
  out = execFileSync(join(root, 'node_modules/.bin/oxlint'), ['-c', join(root, '.oxlintrc.json'), '--format', 'json', file], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1e8,
  });
} catch (e) {
  out = e.stdout;
  if (!out) {
    console.error(e.stderr || String(e));
    process.exitCode = 2;
  }
} finally {
  rmSync(file, { force: true });
}
if (!out) process.exit(2);
const diags = JSON.parse(out).diagnostics ?? [];
// Oxlint の位置はバイト数なので、バイトで行と列を数える
const buf = Buffer.from(code),
  layout = gameLayout();
const where = (d) => {
  const span = d.labels?.[0]?.span;
  if (!span) return '（全体）';
  const before = buf.subarray(0, span.offset).toString(),
    line = before.split('\n').length,
    col = before.length - before.lastIndexOf('\n');
  const at = locate(line, { layout });
  return at ? `${at.file}:${at.line}:${col}` : `（包みの行 ${line}）`;
};
const errors = diags.filter((d) => d.severity === 'error'),
  warnings = diags.filter((d) => d.severity !== 'error');
for (const d of quiet ? errors : diags)
  console.log(`${where(d)}  ${d.severity === 'error' ? 'error' : 'warning'}  ${d.message}  ${d.code ?? ''}`);
if (errors.length || (!quiet && warnings.length)) console.log(`\n${errors.length} エラー、${warnings.length} 警告（src/game/）`);
process.exit(errors.length ? 1 : 0);
