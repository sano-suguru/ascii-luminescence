#!/usr/bin/env node
// PostToolUse（Edit / Write / MultiEdit）：編集した JS・TypeScript をその場で確かめる。
// 構文エラー・型のエラー・lint のエラーがあれば exit 2 で Claude に返し、すぐ直させる。警告では止めない。
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const file = input.tool_input?.file_path;
if (!file || !['.js', '.mjs', '.ts'].includes(extname(file))) process.exit(0);
const rel = relative(root, file);
if (rel.startsWith('..') || /^(node_modules|dist|\.build|tests\/out)\//.test(rel)) process.exit(0);

const run = (cmd, args) => {
  try {
    execFileSync(cmd, args, { cwd: root, stdio: 'pipe', encoding: 'utf8' });
    return null;
  } catch (e) {
    return ((e.stdout || '') + (e.stderr || '')).trim();
  }
};
const fail = (title, out) => {
  const lines = out.split('\n');
  process.stderr.write(
    `${title}: ${rel}\n${lines.slice(0, 40).join('\n')}${lines.length > 40 ? `\n…（ほか ${lines.length - 40} 行）` : ''}\n`,
  );
  process.exit(2);
};

const oxlint = join(root, 'node_modules/.bin/oxlint');

// TypeScript：型を確かめ（tsc。全体でも1秒かからない）、型の情報を使う lint をかける
if (extname(file) === '.ts') {
  const tsc = join(root, 'node_modules/.bin/tsc');
  if (!existsSync(tsc)) process.exit(0);
  const types = run(tsc, ['-p', root]);
  if (types) fail('型のエラー（tsc。pnpm typecheck で全体を確かめられる）', types);
  const lint = run(oxlint, ['--type-aware', '-c', join(root, '.oxlintrc.json'), '--quiet', file]);
  if (lint && /error/.test(lint)) fail('lint のエラー（pnpm lint で全体を確かめられる）', lint);
  process.exit(0);
}

const syn = run(process.execPath, ['--check', file]);
if (syn) fail('構文エラー', syn);
if (existsSync(oxlint)) {
  const lint = run(oxlint, ['-c', join(root, '.oxlintrc.json'), '--quiet', file]);
  if (lint && /error/.test(lint)) fail('lint のエラー（pnpm lint で全体を確かめられる）', lint);
}
