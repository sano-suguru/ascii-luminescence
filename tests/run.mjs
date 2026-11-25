#!/usr/bin/env node
// ブラウザのテスト（pnpm test）をまとめて走らせる：テスト版を1回だけ組み立て（.build/test/）、7つのテストを同時に jobs 個ずつ走らせる。
// どのテストも、自分のブラウザと、空いているポートの配信を使うので、互いにぶつからない（組み立ては、ここで済ませたことを AL_PREBUILT で伝える）。
// 出力は、テストが終わるたびにまとめて出す（混ざらないように）。どれかが失敗したら、終わりのコードを 1 にする。
//   node tests/run.mjs              全部（同時に3つまで）
//   node tests/run.mjs --jobs 2     同時に走らせる数
//   node tests/run.mjs smoke world  名前を挙げた物だけ
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { build } from 'vite';
import { ROOT, arg } from './lib.mjs';

// 長くかかる物から始める（短い物が後ろで隙間を埋める）
const ALL = ['smoke', 'world', 'gallery', 'inventory', 'determinism', 'levels', 'panels'];
const jobs = Math.max(1, Number(arg('--jobs', 3)));
const named = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--jobs');
const list = named.length ? ALL.filter((n) => named.includes(n)) : ALL;
if (named.length && list.length !== named.length) {
  console.error(`知らないテストの名前：${named.filter((n) => !ALL.includes(n)).join(' ')}（${ALL.join('・')}）`);
  process.exit(2);
}

const t0 = Date.now();
await build({ configFile: join(ROOT, 'vite.config.mjs'), mode: 'test', logLevel: 'warn' });
const run = (name) =>
  new Promise((ok) => {
    const t = Date.now(),
      out = [];
    const ch = spawn(process.execPath, [join(ROOT, 'tests', `${name}.mjs`)], { env: { ...process.env, AL_PREBUILT: '1' } });
    ch.stdout.on('data', (d) => out.push(d));
    ch.stderr.on('data', (d) => out.push(d));
    ch.on('close', (code) => {
      const sec = ((Date.now() - t) / 1000).toFixed(1);
      console.log(`\n---- ${name}（${sec}秒）${code === 0 ? '' : ` 失敗（終わりのコード ${code}）`}`);
      process.stdout.write(Buffer.concat(out));
      ok({ name, code, sec });
    });
  });
const results = [],
  queue = [...list];
await Promise.all(
  Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    for (let name = queue.shift(); name; name = queue.shift()) results.push(await run(name));
  }),
);
const failed = results.filter((r) => r.code !== 0);
console.log(
  `\n全部で ${((Date.now() - t0) / 1000).toFixed(1)}秒（同時に ${jobs} つまで）：${results.map((r) => `${r.name} ${r.sec}秒${r.code ? ' 失敗' : ''}`).join('、')}`,
);
if (failed.length) console.log(`失敗：${failed.map((r) => r.name).join('・')}`);
process.exit(failed.length ? 1 : 0);
