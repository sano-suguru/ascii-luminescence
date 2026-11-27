// pnpm check の中身：構文と lint・型・整形・単体テスト・使う文字・組み立て（公開用と Artifact 版）を、同時に走らせる。
// どの段も、ほかの段の結果を使わず、書き出す所も別（dist/・.build/artifact/。単体テストの中の組み立ては .build/unit-<pid>/）。
// 単体テストは長い1つのファイルが最後まで残り、その間ほかのコアが空くので、同時に走らせると全体が縮む。
// 出力は段ごとにまとめ、終わった順に出す（通った段は1行、落ちた段は全部）。1つでも落ちれば、終わりのコードは 1。
import { spawn } from 'node:child_process';
import { setPriority } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..'),
  bin = (name) => join(ROOT, 'node_modules/.bin', name);
const LINT = ['tools', 'tests', '.claude/hooks', 'src/main.js', 'src/lib', 'vite.config.mjs', 'vitest.config.mjs'];
// 長い物から始める（単体テストが一番長い）
const STEPS = [
  ['単体テスト', bin('vitest'), ['run']],
  ['lint（src/game）', process.execPath, ['tools/lint-game.mjs', '--quiet']],
  ['lint', bin('oxlint'), ['--type-aware', '-c', '.oxlintrc.json', ...LINT, '--quiet']],
  ['型', bin('tsc'), ['-p', '.']],
  ['整形', bin('oxfmt'), ['--check']],
  ['使う文字', process.execPath, ['tests/glyphs.mjs']],
  ['組み立て（公開用）', bin('vite'), ['build', '--logLevel', 'warn']],
  ['組み立て（Artifact 版）', bin('vite'), ['build', '--mode', 'artifact', '--logLevel', 'warn']],
];

const t0 = performance.now();
const run = ([name, cmd, args]) =>
  new Promise((done) => {
    // Windows の node_modules/.bin は .cmd なので、シェルを通さないと動かない（パスに空白があってもよいように囲む。Node 本体はシェルを通さない）
    const shell = process.platform === 'win32' && cmd !== process.execPath,
      t = performance.now(),
      p = spawn(shell ? `"${cmd}"` : cmd, args, { cwd: ROOT, env: process.env, shell });
    // 単体テスト（一番長い）を先にし、ほかの段は優先度を下げて、空いたコアで走らせる（同じ優先度だと、単体テストからコアを奪い、全体が縮まない）
    if (name !== '単体テスト' && p.pid)
      try {
        setPriority(p.pid, 19);
      } catch {
        // 優先度を変えられない所では、そのまま走らせる
      }
    let out = '',
      ended = false;
    // 文字として読む（バイトの塊ごとに文字にすると、塊の境で日本語の文字が壊れる）
    p.stdout.setEncoding('utf8');
    p.stderr.setEncoding('utf8');
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    // 起動に失敗した時は error の後に close も来るので、1回だけ出す
    const end = (ok, extra = '') => {
      if (ended) return;
      ended = true;
      const sec = ((performance.now() - t) / 1000).toFixed(1);
      if (ok) console.log(`✓ ${name}（${sec}秒）`);
      else process.stdout.write(`✗ ${name}（${sec}秒）\n${out}${extra}\n`);
      done(ok);
    };
    p.on('error', (e) => end(false, String(e)));
    p.on('close', (code) => end(code === 0));
  });
const results = await Promise.all(STEPS.map(run));
const sec = ((performance.now() - t0) / 1000).toFixed(1);
if (results.every(Boolean)) console.log(`check：全部通った（${sec}秒）`);
else {
  console.log(`check：${results.filter((ok) => !ok).length} つの段が落ちた（${sec}秒）`);
  process.exitCode = 1;
}
