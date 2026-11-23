#!/usr/bin/env node
// ゲーム本体（src/game/*.js）の構文と lint（Oxlint）。1つのファイルだけでは、ほかのファイルの名前が分からないので、
// つないだもの（gameSource）を .build/lint/ の一時ファイルに書き出してまとめて調べ、場所を「src/game/xx.js:行:列」に直して出す。
// 一時ファイルは毎回違う名前にして、終わったら消す（編集直後の hook と pnpm check が同時に動いても、途中まで書いたファイルを読まないように）。
// また、src/game/imports.mjs で読んだ名前（TypeScript に移した物）を、包みの関数の一番外でもう一度宣言していたらエラーにする。
// import は包みの関数の外にあるので、そこで同じ名前を宣言すると、エラーにならずに import を隠してしまう（古い定義の消し忘れ）。
// 関数の中で同じ名前を使い直すのは（色の名前の EYE など）、その関数の中だけのことなので止めない。
//   node tools/lint-game.mjs           エラーと警告
//   node tools/lint-game.mjs --quiet   エラーだけ（pnpm check、編集直後の hook）
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAst } from 'vite';
import { gameSource, gameLayout, locate } from './game-source.mjs';

const root = join(import.meta.dirname, '..');
const quiet = process.argv.includes('--quiet');
const code = gameSource(),
  file = join(root, `.build/lint/game-${process.pid}-${Date.now()}.js`);
mkdirSync(join(root, '.build/lint'), { recursive: true });
writeFileSync(file, code);
const oxlint = (args) => {
  try {
    return execFileSync(join(root, 'node_modules/.bin/oxlint'), [...args, '--format', 'json', file], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1e8,
    });
  } catch (e) {
    if (!e.stdout) console.error(e.stderr || String(e));
    return e.stdout;
  }
};
let out;
try {
  out = oxlint(['-c', join(root, '.oxlintrc.json')]);
} finally {
  rmSync(file, { force: true });
}
if (!out) process.exit(2);
const imported = new Set(
  [...code.slice(0, code.indexOf('(function(){')).matchAll(/import\s*\{([^}]*)\}/g)].flatMap((m) =>
    m[1].split(',').map((n) =>
      n
        .trim()
        .split(/\s+as\s+/)
        .pop(),
    ),
  ),
);
// 包みの関数の一番外の宣言のうち、imports.mjs で読んだ名前と同じもの。
// 構文が壊れている時は、上の Oxlint が知らせるので飛ばす。包みの関数が見つからない時（構文の木の形が変わった時など）は、
// 黙って確かめをやめずに、エラーにする
const hides = [];
const fail = (message) => hides.push({ severity: 'error', message, code: 'lint-game' });
let ast = null;
try {
  ast = parseAst(code, { lang: 'js' });
} catch {}
if (ast) {
  let fn = ast.body.at(-1)?.expression?.callee;
  while (fn?.type === 'ParenthesizedExpression') fn = fn.expression;
  const top = fn?.type === 'FunctionExpression' ? fn.body.body : null;
  if (!top)
    fail(
      '包みの関数 (function(){ … })(); が構文の木に見つからない。tools/lint-game.mjs の読み方を直すこと（読んだ名前の宣言し直しを確かめられない）',
    );
  // 宣言される名前（分割代入 {a, b: c, ...d} = … や [x, y = 1] = … も、名前になる所だけをたどる）
  const bound = (p) =>
    !p
      ? []
      : p.type === 'Identifier'
        ? [p]
        : p.type === 'ObjectPattern'
          ? p.properties.flatMap((q) => bound(q.type === 'RestElement' ? q.argument : q.value))
          : p.type === 'ArrayPattern'
            ? p.elements.flatMap(bound)
            : p.type === 'AssignmentPattern'
              ? bound(p.left)
              : p.type === 'RestElement'
                ? bound(p.argument)
                : [];
  const names = (st) =>
    st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration'
      ? [st.id]
      : st.type === 'VariableDeclaration'
        ? st.declarations.flatMap((d) => bound(d.id))
        : [];
  for (const st of top ?? [])
    for (const id of names(st))
      if (imported.has(id.name))
        hides.push({
          severity: 'error',
          message: `${id.name} は src/game/imports.mjs で読んでいる（TypeScript に移した物）。古い定義の消し忘れか、別の名前にすること`,
          code: 'imports.mjs',
          labels: [{ span: { offset: Buffer.byteLength(code.slice(0, id.start)) } }],
        });
}
const diags = [...(JSON.parse(out).diagnostics ?? []), ...hides];
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
