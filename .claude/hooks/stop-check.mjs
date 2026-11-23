#!/usr/bin/env node
// Stop：作業を終える前に、src・tools・設定が変わっていれば npm run check（構文・lint・組み立て）を通す。
// 落ちたら exit 2 で止めて直させる。2回目（stop_hook_active）は止めない（無限ループを防ぐ）。
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
if (input.stop_hook_active) process.exit(0);
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const sh = (cmd) => execSync(cmd, { cwd: root, stdio: 'pipe', encoding: 'utf8' });

// 依存がまだ入っていない手元のセッションでは止めない（npm install を勧めるだけ）。
if (!existsSync(join(root, 'node_modules/.bin/eslint'))) {
  console.log(JSON.stringify({ systemMessage: 'node_modules が無いので、終える前の check を飛ばした。npm install をすると有効になる。' }));
  process.exit(0);
}

let changed = '';
try { changed = sh('git status --porcelain --untracked-files=all'); } catch { process.exit(0); }
if (!/(^|\s)(src\/|tools\/|tests\/|\.claude\/|eslint\.config\.js|package\.json)/m.test(changed)) process.exit(0);
try { sh('npm run --silent check'); }
catch (e) {
  const out = ((e.stdout || '') + (e.stderr || '')).trim().split('\n').slice(-40).join('\n');
  process.stderr.write(`npm run check が通らない。直してから終えること：\n${out}\n`);
  process.exit(2);
}
