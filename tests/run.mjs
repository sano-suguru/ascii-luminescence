#!/usr/bin/env node
// ブラウザのテスト（pnpm test）をまとめて走らせる：テスト版を1回だけ組み立て（.build/test/）、7つのテストを同時に jobs 個ずつ走らせる。
// どのテストも、自分のブラウザと、空いているポートの配信を使うので、互いにぶつからない（組み立ては、ここで済ませたことを AL_PREBUILT で伝える）。
// 出力は、テストが終わるたびにまとめて出す（混ざらないように）。1つのテストが LIMIT_MIN 分を越えたら止めて、それまでの出力と「時間切れ」を出す。
// どれかが失敗したら（時間切れ・シグナルで止められた時も）、終わりのコードを 1 にする。
//   node tests/run.mjs              全部（同時に3つまで）
//   node tests/run.mjs --jobs 2     同時に走らせる数（1 以上の整数）
//   node tests/run.mjs smoke world  名前を挙げた物だけ（ほかの指定 --prod などは受け付けない。1つずつ node tests/smoke.mjs --prod のように走らせる）
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { build } from 'vite';
import { ROOT } from './lib.mjs';

// 長くかかる物から始める（短い物が後ろで隙間を埋める）
const ALL = ['smoke', 'world', 'gallery', 'inventory', 'determinism', 'levels', 'panels'];
const LIMIT_MIN = 10;
const stop = (m) => {
  console.error(m);
  process.exit(2);
};
let jobs = 3;
const named = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i] ?? '';
  if (a === '--jobs') {
    const v = process.argv[++i];
    if (!v || !/^[1-9]\d*$/.test(v)) stop(`--jobs には 1 以上の整数を書く（${v ?? '値が無い'}）`);
    jobs = Number(v);
  } else if (a.startsWith('-')) stop(`知らない指定：${a}（使えるのは --jobs と、テストの名前だけ）`);
  else if (!named.includes(a)) named.push(a);
}
const unknown = named.filter((n) => !ALL.includes(n));
if (unknown.length) stop(`知らないテストの名前：${unknown.join(' ')}（${ALL.join('・')}）`);
const list = named.length ? ALL.filter((n) => named.includes(n)) : ALL;

const t0 = Date.now();
await build({ configFile: join(ROOT, 'vite.config.mjs'), mode: 'test', logLevel: 'warn' });
const run = (name) =>
  new Promise((ok) => {
    const t = Date.now(),
      out = [];
    const ch = spawn(process.execPath, [join(ROOT, 'tests', `${name}.mjs`)], { env: { ...process.env, AL_PREBUILT: '1' } });
    let timedOut = false;
    const timer = setTimeout(
      () => {
        timedOut = true;
        ch.kill('SIGKILL');
      },
      LIMIT_MIN * 60 * 1000,
    );
    ch.stdout.on('data', (d) => out.push(d));
    ch.stderr.on('data', (d) => out.push(d));
    ch.on('close', (code, signal) => {
      clearTimeout(timer);
      const sec = ((Date.now() - t) / 1000).toFixed(1),
        failed = code !== 0,
        why = timedOut ? `時間切れ（${LIMIT_MIN}分）` : signal ? `シグナル ${signal} で止められた` : `終わりのコード ${code}`;
      console.log(`\n---- ${name}（${sec}秒）${failed ? ` 失敗：${why}` : ''}`);
      process.stdout.write(Buffer.concat(out));
      ok({ name, failed, sec });
    });
  });
const results = [],
  queue = [...list];
await Promise.all(
  Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    for (let name = queue.shift(); name; name = queue.shift()) results.push(await run(name));
  }),
);
const failed = results.filter((r) => r.failed);
console.log(
  `\n全部で ${((Date.now() - t0) / 1000).toFixed(1)}秒（同時に ${jobs} つまで）：${results.map((r) => `${r.name} ${r.sec}秒${r.failed ? ' 失敗' : ''}`).join('、')}`,
);
if (failed.length) console.log(`失敗：${failed.map((r) => r.name).join('・')}`);
if (results.length !== list.length) console.log(`走らせたテストの数が足りない（${results.length} / ${list.length}）`);
process.exit(failed.length || results.length !== list.length ? 1 : 0);
