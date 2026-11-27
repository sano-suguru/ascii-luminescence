#!/usr/bin/env node
// ブラウザのテスト（pnpm test）をまとめて走らせる：テスト版と Artifact 版を1回だけ組み立て（.build/test/・.build/artifact/）、12のテスト（画面写真の比較 visual も）を同時に jobs 個ずつ走らせる。
// どのテストも、自分のブラウザと、空いているポートの配信を使うので、互いにぶつからない（組み立ては、ここで済ませたことを AL_PREBUILT で伝える）。
// 出力は、テストが終わるたびにまとめて出す（混ざらないように）。1つのテストが LIMIT_MIN 分を越えたら止めて、それまでの出力と「時間切れ」を出す。
// どれかが失敗したら（時間切れ・シグナルで止められた時も）、終わりのコードを 1 にする。
// テストごとの出力（画面に出す物と同じ中身）は、tests/out/run/<名前>.log にも書く（後から失敗の文を読むため）。走らせ始める時に、そのテストの前の回のログを書き直し、
// 出力が来るたびに書き足す（この道具ごと止められても、そこまでの出力が残る）。終わった時に、頭に日時と終わり方を書いた形で書き直す。走らせないテストの前の回のログは残る。
// 失敗したテストがある時は、終わりの「失敗：…」の行の後に、そのログのパスを出す。
//   node tests/run.mjs              全部（同時に3つまで）
//   node tests/run.mjs --jobs 2     同時に走らせる数（1 以上の整数）
//   node tests/run.mjs smoke world  名前を挙げた物だけ（ほかの指定 --prod・--update などは受け付けない。1つずつ node tests/smoke.mjs --prod のように走らせる）
//   node tests/run.mjs --shard 1/2  n 組に分けた i 組目だけ（CI が2台のランナーで分けて走らせる）。分け方は SEC のおよその秒で、組ごとの合計が近くなるように決める
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { build } from 'vite';
import { ROOT } from './lib.mjs';

// 走らせるテストの一覧と、速い CI のランナーでかかるおよその秒（テストを足したらここにも足す。足し忘れは、下の NOT_TESTS と比べて止める。組に分ける時と、走らせる順番に使う。長くかかる物から始め、短い物が後ろで隙間を埋める）
const SEC = {
  smoke: 114,
  visual: 86,
  frame: 84,
  gallery: 74,
  world: 60,
  title: 52,
  touch: 40,
  auto: 90,
  determinism: 30,
  inventory: 18,
  levels: 14,
  panels: 17,
};
// tests/ の .mjs のうち、ここで走らせない物（テストの部品と、pnpm check が走らせる glyphs）。これと SEC のどちらにも無いファイルがあれば止める
const NOT_TESTS = ['lib', 'run', 'reach', 'gallery-specimens', 'glyphs', 'page-fakes'];
const missing = readdirSync(import.meta.dirname)
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => f.slice(0, -4))
  .filter((n) => !(n in SEC) && !NOT_TESTS.includes(n));
if (missing.length) {
  console.error(
    `tests/ に、SEC にも NOT_TESTS にも無いファイルがある：${missing.join(' ')}（テストなら SEC に、部品なら NOT_TESTS に足す）`,
  );
  process.exit(2);
}
const ALL = Object.keys(SEC).sort((a, b) => (SEC[b] ?? 0) - (SEC[a] ?? 0));
// n 組に分ける：長い物から順に、その時の合計が一番小さい組へ入れる
const shardOf = (n) => {
  const sum = Array.from({ length: n }, () => 0),
    of = {};
  for (const name of ALL) {
    const k = sum.indexOf(Math.min(...sum));
    of[name] = k + 1;
    sum[k] += SEC[name] ?? 0;
  }
  return of;
};
const LIMIT_MIN = 10;
const stop = (m) => {
  console.error(m);
  process.exit(2);
};
let jobs = 3,
  shard = null;
const named = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i] ?? '';
  if (a === '--jobs') {
    const v = process.argv[++i];
    if (!v || !/^[1-9]\d*$/.test(v)) stop(`--jobs には 1 以上の整数を書く（${v ?? '値が無い'}）`);
    jobs = Number(v);
  } else if (a === '--shard') {
    const v = process.argv[++i],
      m = v?.match(/^([1-9]\d*)\/([1-9]\d*)$/);
    if (!m || Number(m[1]) > Number(m[2])) stop(`--shard には i/n（i は 1 から n まで）を書く（${v ?? '値が無い'}）`);
    shard = { i: Number(m?.[1]), n: Number(m?.[2]) };
  } else if (a.startsWith('-')) stop(`知らない指定：${a}（使えるのは --jobs・--shard と、テストの名前だけ）`);
  else if (!named.includes(a)) named.push(a);
}
const unknown = named.filter((n) => !ALL.includes(n));
if (unknown.length) stop(`知らないテストの名前：${unknown.join(' ')}（${ALL.join('・')}）`);
const of = shard ? shardOf(shard.n) : null;
const list = ALL.filter((n) => (!named.length || named.includes(n)) && (!shard || of?.[n] === shard.i));
// 走らせるテストが無い時は、通ったことにせず止める（組の数がテストより多い・名前を挙げたテストがほかの組にある、など）
if (!list.length) stop(`走らせるテストが無い（--shard ${shard ? `${shard.i}/${shard.n}` : '無し'}・名前 ${named.join(' ') || '無し'}）`);
if (shard) console.log(`組 ${shard.i}/${shard.n}：${list.join('・')}`);

const t0 = Date.now();
// Artifact 版を読むのは frame だけ
for (const mode of list.includes('frame') ? ['test', 'artifact'] : ['test'])
  await build({ configFile: join(ROOT, 'vite.config.mjs'), mode, logLevel: 'warn' });
const LOG_DIR = join(ROOT, 'tests', 'out', 'run');
const logOf = (name) => join(LOG_DIR, `${name}.log`);
const head = (name, start, lines) =>
  `# tests/run.mjs のログ：${name}\n# 始めた：${start.toISOString()}（UTC）\n${lines.map((l) => `# ${l}\n`).join('')}\n`;
// ログが書けない時（記憶域の残りが尽きた・tests/out/run を消された など）も、テストと画面への出力は続ける（そのテストで1回だけ知らせる）
const logWriter = (name) => {
  let warned = false;
  return (write) => {
    try {
      write();
    } catch (e) {
      if (!warned) console.error(`${name} のログを書けなかった（${e instanceof Error ? e.message : String(e)}）。画面への出力は続ける`);
      warned = true;
    }
  };
};
const run = (name) =>
  new Promise((ok) => {
    const t = Date.now(),
      start = new Date(t),
      out = [],
      log = logOf(name),
      tryLog = logWriter(name);
    // 前の回のログを書き直す。終わり方は、終わった時に書き直すまで「走っている途中」
    tryLog(() => {
      mkdirSync(LOG_DIR, { recursive: true });
      writeFileSync(log, head(name, start, ['終わり方：走っている途中（終わる前に tests/run.mjs が止まった）']));
    });
    const ch = spawn(process.execPath, [join(ROOT, 'tests', `${name}.mjs`)], { env: { ...process.env, AL_PREBUILT: '1' } });
    let timedOut = false;
    const timer = setTimeout(
      () => {
        timedOut = true;
        ch.kill('SIGKILL');
      },
      LIMIT_MIN * 60 * 1000,
    );
    const take = (d) => {
      out.push(d);
      tryLog(() => appendFileSync(log, d));
    };
    ch.stdout.on('data', take);
    ch.stderr.on('data', take);
    ch.on('close', (code, signal) => {
      clearTimeout(timer);
      const sec = ((Date.now() - t) / 1000).toFixed(1),
        failed = code !== 0,
        why = timedOut ? `時間切れ（${LIMIT_MIN}分）` : signal ? `シグナル ${signal} で止められた` : `終わりのコード ${code}`;
      console.log(`\n---- ${name}（${sec}秒）${failed ? ` 失敗：${why}` : ''}`);
      process.stdout.write(Buffer.concat(out));
      tryLog(() =>
        writeFileSync(
          log,
          Buffer.concat([
            Buffer.from(
              head(name, start, [`終わった：${new Date().toISOString()}（UTC、${sec}秒）`, `終わり方：${why}${failed ? '（失敗）' : ''}`]),
            ),
            ...out,
          ]),
        ),
      );
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
if (failed.length) {
  console.log(`失敗：${failed.map((r) => r.name).join('・')}`);
  for (const r of failed) console.log(`  ログ：${relative(ROOT, logOf(r.name))}`);
}
if (results.length !== list.length) console.log(`走らせたテストの数が足りない（${results.length} / ${list.length}）`);
process.exit(failed.length || results.length !== list.length ? 1 : 0);
