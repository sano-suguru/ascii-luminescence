#!/usr/bin/env node
// 自動で試す台本（?auto。src/lib/auto.ts）を、この環境で、スマホの遅さを真似て流す（CI には入れない。条件ごとに5分ほど）。
// Artifact 版を、テスト用モードでなく、iPhone の横向き（claude.ai のアプリの中で 750×312、画素の比 3）で、偽の window.claude の持ち主として開き、
// 書かれた診断の記録を tools/diag-report.mjs の表で出し、前に流した結果と並べる。
//
// 遅さの真似：
//   - CPU：CDP の CPU throttling（--rate。既定 4）。ページの JS（階を作る・組み立てる）が、描く手間に比べて重くなる
//   - 見かけの時計：この環境は CPU で描くので、750×312 でも1秒に7フレームほどしか描けない（いつも遅いフレームになり、画質もいつも一番下まで下がる）。
//     そこで、ページの performance.now と requestAnimationFrame の時刻を「見かけの時計」にする：本当にかかった時間を K で割る。
//     K は、自動で試さないページを先に開き、タイトルの間に1フレームの本当の長さを測って、見かけの速さが条件の fps になるように決める（探索中は JS が重くなる分、少し遅く見える）
//   - 1秒に30回まで（lowpower）：見かけの1フレームを、少なくとも 1/30 秒にする（低電力モードの iPhone の真似）。ほかの条件でも、1/60 秒より短くはしない（画面の書き換えの回数）
//   見かけの時計は、performance.now・rAF の時刻・Date.now（ゲームと台本と診断の記録の時計）を変える。setTimeout と setInterval は本当の時計のまま
//   （台本の待ちは見かけの時計なので、本当の時間では K 倍かかる）
//
// 条件（--cond で選ぶ。既定は両方）：
//   lowpower：--fps 50 --cap 30。#118 のとおり、1段下げ → 速くならない → 戻して止まる、になるか（画質が「下げた → 戻した」で終わり、その後は下げない）
//   slow    ：--fps 35（抑えなし）。下げると速くなり、戻さずに進むか（back が無い）
// どちらも、エラーが無い・全部の段を通った・うまくいかなかった段が無い、も確かめる（違えば終わりの値を 1 にする）。
//
// 結果は tests/out/auto/<条件>.json。前の結果は <条件>.prev.json に回し、段ごとの平均 fps・最長・遅いフレームの数を前と今で並べる。
// 使い方：node tools/auto-run.mjs [--cond lowpower,slow] [--rate 4] [--laps n] [--keep]（組み立て済みの Artifact 版を使う）
// 時間は、この環境の CPU で描いた物を K で割った物。本物の端末の GPU の重さとは違うので、数そのものより、前との違いと、遅いフレームの近くの処理を見る
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { build } from 'vite';
import { GL_ARGS, ROOT, OUT, arg } from '../tests/lib.mjs';
import { fakeClaude, readDiag } from '../tests/page-fakes.mjs';
import { compareRows, qualitySteps, report } from './diag-report.mjs';
import { serve } from './serve.mjs';

const CONDS = {
  lowpower: { fps: 50, cap: 30 },
  slow: { fps: 35, cap: 0 },
};
const conds = String(arg('--cond', Object.keys(CONDS).join(',')))
  .split(',')
  .filter((c) => {
    if (!CONDS[c]) throw new Error(`条件 ${c} は無い（${Object.keys(CONDS).join('・')}）`);
    return true;
  });
// 既定は短い台本（?auto=quick。見かけで45秒ほど、本当の時間で5分ほど）。--laps n で、ふつうの台本を n 周（1周で20分を越える）
const RATE = Number(arg('--rate', '4')),
  LAPS = Number(arg('--laps', '0')),
  QUICK = !LAPS;
const dir = join(OUT, 'auto');
mkdirSync(dir, { recursive: true });
if (!process.argv.includes('--keep')) await build({ configFile: join(ROOT, 'vite.config.mjs'), mode: 'artifact', logLevel: 'warn' });
const srv = await serve(join(ROOT, '.build/artifact'), 0, {});
const browser = await chromium.launch({ args: GL_ARGS, env: { ...process.env, FONTCONFIG_FILE: join(ROOT, 'tests/fonts.conf') } });
const fails = [];
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/**
 * 見かけの時計（page.addInitScript に渡す。外の変数は使えない）。見かけの時刻 = 本当に経った時間 / K ＋ 足した分。
 * requestAnimationFrame は1つの本当の rAF にまとめて呼び、呼ぶ前に、前のフレームから見かけで capMs たっていなければ、時計をそこまで進める。
 * Date.now も見かけの時計で進める（診断の記録の時刻 t が、遅いフレームやかかった時間と同じ時計になるように）
 */
const vclock = ({ K, capMs }) => {
  const realNow = performance.now.bind(performance),
    realRaf = window.requestAnimationFrame.bind(window),
    realCancel = window.cancelAnimationFrame.bind(window),
    base = realNow(),
    date0 = Date.now();
  let add = base,
    lastFrame = -Infinity,
    seq = 0,
    pumping = false;
  const now = () => (realNow() - base) / K + add;
  performance.now = now;
  Date.now = () => Math.round(date0 + now() - base);
  const queue = new Map();
  const pump = () => {
    pumping = false;
    let v = now();
    if (capMs > 0 && v - lastFrame < capMs) {
      add += capMs - (v - lastFrame);
      v = now();
    }
    lastFrame = v;
    const cbs = [...queue.values()];
    queue.clear();
    for (const cb of cbs)
      try {
        cb(v);
      } catch (e) {
        setTimeout(() => {
          throw e;
        });
      }
  };
  window.requestAnimationFrame = (cb) => {
    queue.set(++seq, cb);
    if (!pumping) {
      pumping = true;
      realRaf(pump);
    }
    return seq;
  };
  window.cancelAnimationFrame = (id) => {
    if (!queue.delete(id)) realCancel(id);
  };
};

/** iPhone の横向きの大きさのページ（CPU を遅くしてから開く） */
async function phonePage(query, init) {
  const ctx = await browser.newContext({ viewport: { width: 750, height: 312 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const pg = await ctx.newPage();
  for (const [fn, a] of init) await pg.addInitScript(fn, a);
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await pg.goto(`http://127.0.0.1:${srv.port}/index.html${query}`, { waitUntil: 'commit', timeout: 120000 });
  await pg.waitForSelector('#enter', { timeout: 120000 });
  return { ctx, pg };
}

// K を決める：自動で試さないページのタイトルで、1フレームの本当の長さ（中央）を測る（条件によらず同じなので、1回だけ）
const realMs = await (async () => {
  const { ctx, pg } = await phonePage('', []);
  await sleep(3000);
  const ms = await pg.evaluate(
    () =>
      new Promise((ok) => {
        const ts = [];
        let prev = 0;
        const f = (t) => {
          if (prev) ts.push(t - prev);
          prev = t;
          if (ts.length < 15) requestAnimationFrame(f);
          else ok(ts.sort((a, b) => a - b)[7]);
        };
        requestAnimationFrame(f);
      }),
  );
  await ctx.close();
  return ms;
})();

try {
  for (const name of conds) {
    const c = CONDS[name];
    const K = Math.max(1, realMs / (1000 / c.fps));
    const { ctx, pg } = await phonePage(`?auto=${QUICK ? 'quick' : LAPS}`, [
      [fakeClaude, true],
      // 抑えが無くても、画面の書き換え（1秒に60回）より速くはしない（止まっている間は描かないので、抑えが無いと見かけで何百 fps になる）
      [vclock, { K, capMs: 1000 / (c.cap || 60) }],
    ]);
    pg.on('pageerror', (e) => fails.push(`${name}：ページのエラー：${String(e).slice(0, 300)}`));
    console.log(
      `---- ${name}：CPU ${RATE}倍遅く・タイトルの1フレーム ${realMs.toFixed(0)}ms → K ${K.toFixed(1)}（見かけ ${c.fps}fps${c.cap ? `・${c.cap}fps まで` : ''}）`,
    );
    // 台本が終わるまで（本当の時間で、見かけの時間の K 倍かかる）
    const t0 = Date.now();
    let last = '';
    for (;;) {
      const st = await pg.evaluate(() => document.getElementById('autobar')?.textContent ?? '');
      if (st !== last) {
        console.log(`  ${((Date.now() - t0) / 1000).toFixed(0)}秒：${st.replace('止める', '')}`);
        last = st;
      }
      if (st.includes('試し終えた')) break;
      if (Date.now() - t0 > 60 * 60 * 1000) {
        fails.push(`${name}：1時間たっても台本が終わらない`);
        break;
      }
      await sleep(5000);
    }
    const rec = await readDiag(pg);
    await ctx.close();
    if (!rec) {
      fails.push(`${name}：診断の記録が書かれない`);
      continue;
    }
    rec.sim = { cond: name, ...c, rate: RATE, K: +K.toFixed(2), realTitleMs: Math.round(realMs) };
    const file = join(dir, `${name}.json`),
      prevFile = join(dir, `${name}.prev.json`);
    let prev = null;
    if (existsSync(file)) {
      renameSync(file, prevFile);
      prev = JSON.parse(readFileSync(prevFile, 'utf8'));
    }
    writeFileSync(file, JSON.stringify(rec, null, 1));
    console.log(report(rec).join('\n'));
    if (prev) console.log(compareRows(prev, rec).join('\n'));
    // 確かめる
    const a = rec.auto;
    if (!a?.done || a.stop) fails.push(`${name}：台本が終わっていない（${a?.step}・${a?.stop}）`);
    for (const s of a?.steps ?? []) if (s.miss) fails.push(`${name}：${s.lap}周目の ${s.k}：${s.miss}`);
    const q = qualitySteps(rec.took).map((x) => x.why);
    console.log(`画質の理由の並び：${q.join(' → ') || '変えていない'}`);
    if (name === 'lowpower') {
      const b = q.lastIndexOf('back');
      if (b < 0 || q.slice(b + 1).includes('auto')) fails.push(`lowpower：下げても速くならないのに、戻して止まらない（${q.join(' → ')}）`);
    }
    if (name === 'slow' && (q.includes('back') || !q.includes('auto')))
      fails.push(`slow：下げて速くなるのに、下げないか戻した（${q.join(' → ')}）`);
  }
} finally {
  await browser.close();
  srv.close();
}
console.log(fails.length ? `\n確かめて違った所：\n  ${fails.join('\n  ')}` : '\n確かめた所は、どれも思ったとおり');
process.exitCode = fails.length ? 1 : 0;
