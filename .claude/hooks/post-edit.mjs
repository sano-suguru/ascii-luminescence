#!/usr/bin/env node
// PostToolUse（Edit / Write / MultiEdit）：編集した JS をその場で確かめる。
// 構文エラーか lint のエラーがあれば exit 2 で Claude に返し、すぐ直させる。警告では止めない。
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const file = input.tool_input?.file_path;
if (!file || !['.js', '.mjs'].includes(extname(file))) process.exit(0);
const rel = relative(root, file);
if (rel.startsWith('..') || /^(node_modules|dist|\.build|tests\/out)\//.test(rel)) process.exit(0);

const run = (cmd, args) => {
  try { execFileSync(cmd, args, { cwd: root, stdio: 'pipe', encoding: 'utf8' }); return null; }
  catch (e) { return ((e.stdout || '') + (e.stderr || '')).trim(); }
};
const fail = (title, out) => {
  const lines = out.split('\n');
  process.stderr.write(`${title}: ${rel}\n${lines.slice(0, 40).join('\n')}${lines.length > 40 ? `\n…（ほか ${lines.length - 40} 行）` : ''}\n`);
  process.exit(2);
};

// ゲーム本体（src/game/*.js）は1つだけでは調べられないので、つないだものを調べる（場所は元のファイルの行で出る）
if (/^src\/game\/[^/]+\.js$/.test(rel)) {
  if (!existsSync(join(root, 'node_modules/eslint'))) process.exit(0);
  const out = run(process.execPath, [join(root, 'tools/lint-game.mjs'), '--quiet']);
  if (out) fail('構文か lint のエラー（src/game/ をつないで調べた。npm run lint で警告も見られる）', out);
  process.exit(0);
}

const syn = run(process.execPath, ['--check', file]);
if (syn) fail('構文エラー', syn);
const eslint = join(root, 'node_modules/.bin/eslint');
if (existsSync(eslint)) {
  const lint = run(eslint, ['--quiet', '--no-warn-ignored', file]);
  if (lint) fail('lint のエラー（npx eslint で全体を確かめられる）', lint);
}
