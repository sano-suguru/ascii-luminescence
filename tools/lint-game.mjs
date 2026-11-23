#!/usr/bin/env node
// ゲーム本体（src/game/*.js）の構文と lint。1つのファイルだけでは、ほかのファイルの名前が分からないので、
// つないだもの（gameSource）をまとめて調べ、エラーの場所を「src/game/xx.js:行:列」に直して出す。
//   node tools/lint-game.mjs           エラーと警告
//   node tools/lint-game.mjs --quiet   エラーだけ（npm run check、編集直後の hook）
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { gameSource, gameLayout, locate } from './build.mjs';

const root = join(import.meta.dirname, '..');
const quiet = process.argv.includes('--quiet');
const eslint = new ESLint({ cwd: root });
// 設定（eslint.config.js の src/**/*.js）を当てるため、仮の名前 src/game.js で調べる
const [res] = await eslint.lintText(gameSource(), { filePath: join(root, 'src/game.js'), warnIgnored: true });
if (!res) { console.error('lint の結果が返らない（eslint.config.js の設定を確かめること）'); process.exit(2); }
const msgs = res.messages.filter((m) => !quiet || m.severity === 2), layout = gameLayout();
for (const m of msgs) {
  const at = m.line ? locate(m.line, { layout }) : null;
  const where = at ? `${at.file}:${at.line}:${m.column}` : m.line ? `（包みの行 ${m.line}）` : '（全体）';
  console.log(`${where}  ${m.severity === 2 ? 'error' : 'warning'}  ${m.message}${m.ruleId ? `  ${m.ruleId}` : ''}`);
}
const e = res.errorCount, w = res.warningCount;
if (e || (!quiet && w)) console.log(`\n${e} エラー、${w} 警告（src/game/）`);
process.exit(e ? 1 : 0);
