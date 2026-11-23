#!/usr/bin/env node
// Stop：作業を終える前に、src・tools・設定が変わっていれば pnpm check（構文・lint・整形・単体テスト・組み立て）を通す。
// 落ちたら exit 2 で止めて直させる。2回目（stop_hook_active）は止めない（無限ループを防ぐ）。
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
if (input.stop_hook_active) process.exit(0);
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
// .node-version の Node が入っていれば、それを使う（SessionStart の hook が ~/.cache に入れる）
let PATH = process.env.PATH;
try {
  const nodeBin = join(homedir(), '.cache', `node-v${readFileSync(join(root, '.node-version'), 'utf8').trim()}`, 'bin');
  if (existsSync(nodeBin)) PATH = `${nodeBin}:${PATH}`;
} catch {}
const sh = (cmd) => execSync(cmd, { cwd: root, stdio: 'pipe', encoding: 'utf8', env: { ...process.env, PATH } });

// 依存がまだ入っていない手元のセッションでは止めない（pnpm install を勧めるだけ）。
if (!existsSync(join(root, 'node_modules/.bin/oxlint'))) {
  console.log(JSON.stringify({ systemMessage: 'node_modules が無いので、終える前の check を飛ばした。pnpm install をすると有効になる。' }));
  process.exit(0);
}

let changed = '';
try {
  changed = sh('git status --porcelain --untracked-files=all');
} catch {
  process.exit(0);
}
// pnpm check は、整形の確かめでリポジトリの JSON・YAML なども見るので、check が見ない物（文書・画面写真の基準）だけの変更の時に飛ばす
const paths = changed
  .split('\n')
  .filter(Boolean)
  .map((l) => l.slice(3).split(' -> ').pop());
if (!paths.some((p) => !/^(docs\/|tests\/baseline\/)|\.md$/.test(p))) process.exit(0);
try {
  sh('pnpm --silent check');
} catch (e) {
  const out = ((e.stdout || '') + (e.stderr || '')).trim().split('\n').slice(-40).join('\n');
  process.stderr.write(`pnpm check が通らない。直してから終えること：\n${out}\n`);
  process.exit(2);
}
