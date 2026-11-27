#!/usr/bin/env node
// 生き物を本物の階に置き、プレイヤーの目の高さから写す（テスト版を組み立てて、テスト用モードで）。図鑑より明るい迷宮の灯りの下で、
// 向かってくる姿が読めるか・光ってにじまないか・頭の上の印が体に付いているかを確かめる時に使う（見た目を直す時の最後の確かめ）。
//   pnpm field ヘビ                名前で選ぶ（図鑑の名前。表の鍵（n・T など）でもよい。主・忘れられた獣は pnpm lords）
//   --scenes 1:202,3:7             写す階（深さ:シード を , で区切る。既定は、石の迷宮の深さ 1 と大洞窟の深さ 3）
//   --rev <版>                     前の版（git の版。例 origin/main）とも同じ所で写し、前と今を上下に並べる（src/ だけを前の版にした一時的な作業場所で組み立てる）
//   --out <ディレクトリ>           置き場所（既定 tests/out/field/）
// 写す物（階ごと）：生き物を 6 マスほど先の、見えている床に置き、向かってくるところを 4m・3m・2.5m で写す（照準が当たると明るく描くので、
// いつも少し横を見る）。もう1枚、3m ほどの所で照準を合わせて写す（照準の先は明るさが 1.9 倍になる。白い塊にならないか）。
// 写真は <名前>-<深さ>-<距離>.png（照準を合わせた物は -aim）と、体のまわりで切り抜いて並べた1枚 <名前>-field.png
// （行が階、列が 4m・3m・2.5m・照準。--rev の時は、階ごとに前・今の2行で、同じ枠で切り抜く）。
// 生き物が近づいて来ない時（道が無い・見回りを続ける、など）は、置き直して試し、それでも来なければ、プレイヤーの方が寄って写す（床が無ければ、その枡を黒のままにして知らせる）。
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { withBrowser, newPage, openTest, advance, frames, arg, OUT, ROOT } from '../tests/lib.mjs';
import { cropRect, writeSheet } from './sheet.mjs';

const W = 960,
  H = 540,
  CLIP = { x: 0, y: 0, width: W, height: H },
  DISTS = [4, 3, 2.5]; // 2m より近くへは、手前で止まって攻撃する生き物がいる
const argv = process.argv.slice(2);
const usage = (why) => {
  console.log(`${why}\n使い方：pnpm field <名前…> [--scenes 1:202,3:7] [--rev <版>] [--out <ディレクトリ>]`);
  process.exit(1);
};
const opt = (k) => {
  const v = arg(k, null);
  if (argv.includes(k) && (!v || v.startsWith('--'))) usage(`${k} の後に値を書いてください`);
  return v;
};
const outDir = resolve(opt('--out') ?? join(OUT, 'field'));
const rev = opt('--rev');
const scenes = (opt('--scenes') ?? '1:202,3:7').split(',').map((s) => {
  const [depth, seed] = s.split(':').map(Number);
  if (!(depth >= 1 && depth <= 13 && seed >= 0)) usage(`--scenes の「${s}」が読めない（深さ:シード。深さは 1 から 13）`);
  return { depth, seed };
});
const VALUED = new Set(['--out', '--rev', '--scenes']);
const names = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1] ?? ''));
if (!names.length) usage('写す生き物の名前を書いてください');
mkdirSync(outDir, { recursive: true });

/** 1つの階で、1つの生き物を写す。写真のファイルと体の範囲を、距離（と 'aim'）ごとに返す。来なかった距離は null */
async function shootScene(browser, base, key, { depth, seed }, prefix, errs) {
  const pageErrs = [];
  const pg = await newPage(browser, pageErrs, { width: W, height: H, still: true });
  await openTest(pg, base, `seed=${seed}&depth=${depth}&god=1`);
  await advance(pg, 2); // 階に入ると、約1.25秒かけて明るくなる
  const got = {};
  // 置き直して試す：見えている床で、6 マスほど先の物を、近い順に
  const cells = await pg.evaluate(() => {
    __test.clearAll();
    __test.fov();
    const s = __test.state(),
      { w, h } = __test.size(),
      out = [];
    for (let i = 0; i < w * h; i++) {
      const c = __test.cell(i);
      if (!c.floor || !c.seen) continue;
      const d = Math.hypot(c.x - s.pos[0], c.z - s.pos[1]);
      if (d >= 5 && d <= 8) out.push([Math.abs(d - 6), i]);
    }
    return out.sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  });
  // 生き物の位置と距離。look が真なら、照準が当たらないよう、生き物の 0.9 横を見る（偽なら生き物そのものを見る）
  const lookAt = (aim) =>
    pg.evaluate(
      ([key, aim]) => {
        const m = __test.state().monsters.find((m) => m[0] === key),
          s = __test.state();
        if (!m) return null;
        const dx = m[1] - s.pos[0],
          dz = m[2] - s.pos[1],
          d = Math.hypot(dx, dz) || 1,
          v = __test.monsterView(key),
          y = v && v.world ? (v.world.y0 + v.world.y1) / 2 : 0.3;
        if (aim) dbg.look(m[1], y, m[2]);
        else dbg.look(m[1] + (dz / d) * 0.9, y, m[2] - (dx / d) * 0.9);
        return d;
      },
      [key, aim],
    );
  const snap = async (tag) => {
    await frames(pg, 2);
    const file = `${prefix}-${tag}.png`;
    await pg.screenshot({ path: file, timeout: 90000 });
    const v = await pg.evaluate((key) => __test.monsterView(key), key);
    got[tag] = { file, box: v && v.screen ? v.screen : null };
  };
  for (const cell of cells.slice(0, 4)) {
    await pg.evaluate(
      ([key, cell]) => {
        __test.clearAll();
        __test.summon(key, cell);
      },
      [key, cell],
    );
    for (let k = 0; k < 80 && DISTS.some((d) => !got[`${d}m`]); k++) {
      await advance(pg, 0.15);
      const d = await lookAt(false);
      if (d === null) break;
      const want = DISTS.find((w) => !got[`${w}m`] && d <= w);
      if (want === undefined) continue;
      await snap(`${want}m`);
      // 3m を写したら、照準を合わせた1枚も（同じ所で）
      if (want === 3 && !got.aim && (await lookAt(true)) !== null) await snap('aim');
    }
    if (DISTS.every((d) => got[`${d}m`])) break;
  }
  // 近づいて来なかった距離は、プレイヤーの方が、生き物から今の向きにその距離の床へ寄って写す（見回りを続ける生き物など）
  const walked = [];
  for (const d of DISTS) {
    if (got[`${d}m`]) continue;
    const ok = await pg.evaluate(
      ([key, d]) => {
        const m = __test.state().monsters.find((m) => m[0] === key),
          s = __test.state();
        if (!m) return false;
        const dx = s.pos[0] - m[1],
          dz = s.pos[1] - m[2],
          l = Math.hypot(dx, dz) || 1,
          x = m[1] + (dx / l) * d,
          z = m[2] + (dz / l) * d,
          { w } = __test.size();
        if (!__test.cell(Math.floor(z / 2) * w + Math.floor(x / 2)).floor) return false;
        dbg.step(x, z);
        __test.advance(1 / 30);
        return true;
      },
      [key, d],
    );
    if (!ok || (await lookAt(false)) === null) continue;
    await snap(`${d}m`);
    walked.push(`${d}m`);
    if (d === 3 && !got.aim && (await lookAt(true)) !== null) await snap('aim');
  }
  if (walked.length) console.log(`${prefix}：近づいて来ないので、プレイヤーが寄って写した（${walked.join('・')}）`);
  const missing = [...DISTS.map((d) => `${d}m`), 'aim'].filter((t) => !got[t]);
  if (missing.length) errs.push(`${prefix}：写せなかった（${missing.join('・')}。生き物がいないか、その距離に床が無い）`);
  if (pageErrs.length) errs.push(`${prefix}：${pageErrs.join(' / ')}`);
  await pg.close();
  return got;
}

/** 作業場所 root で組み立てたゲームで、全部の生き物と階を写す。返り値は [生き物][階] ごとの写真 */
async function shootAll(root, tag, errs) {
  const res = {};
  await withBrowser(
    async ({ browser, base }) => {
      // 名前を鍵にする（図鑑の一覧から。主・忘れられた獣は呼び出せないので除く）
      const pg = await newPage(browser, errs, { width: W, height: H, still: true });
      await openTest(pg, base);
      await advance(pg, 1);
      const list = await pg.evaluate(() => __test.gallery());
      await pg.close();
      if (typeof list === 'string') throw new Error(list);
      for (const want of names) {
        const e = list.find((x) => (x.name === want || x.key === want) && !String(x.key).includes(':'));
        if (!e) {
          errs.push(`図鑑に無い名前（主・忘れられた獣は pnpm lords）：${want}`);
          continue;
        }
        res[want] = [];
        for (const sc of scenes) {
          const prefix = join(outDir, `${e.name.replace(/[\\/:*?"<>|（）\s]/g, '_')}-${sc.depth}${tag}`);
          res[want].push(await shootScene(browser, base, e.key, sc, prefix, errs));
          console.log(`${e.name} 深さ ${sc.depth}${tag ? `（${tag.slice(1)}）` : ''}：写した`);
        }
      }
    },
    { root },
  );
  return res;
}

const errs = [];
const now = await shootAll(ROOT, '', errs);
let old = null;
if (rev) {
  // src/ だけを前の版にした一時的な作業場所（tools/case-diff.mjs と同じ作り方）
  const tmp = mkdtempSync(join(tmpdir(), 'al-field-'));
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  try {
    git('worktree', 'add', '--detach', tmp, 'HEAD');
    rmSync(join(tmp, 'src'), { recursive: true, force: true });
    execFileSync('git', ['checkout', rev, '--', 'src'], { cwd: tmp, stdio: 'ignore' });
    symlinkSync(join(ROOT, 'node_modules'), join(tmp, 'node_modules'));
    old = await shootAll(tmp, '-old', errs);
  } finally {
    try {
      git('worktree', 'remove', '--force', tmp);
    } catch {
      rmSync(tmp, { recursive: true, force: true });
      git('worktree', 'prune');
    }
  }
}
const TAGS = [...DISTS.map((d) => `${d}m`), 'aim'];
for (const want of Object.keys(now)) {
  const rowsOf = (shots, boxesFrom) =>
    TAGS.map((t, c) => {
      const s = shots[t];
      return { file: s ? s.file : null, rect: cropRect(boxesFrom(t, c), CLIP) };
    });
  const rows = [];
  scenes.forEach((_, i) => {
    const n = now[want]?.[i] ?? {},
      o = old?.[want]?.[i];
    // 前と今は同じ枠で切り抜く（大きさの違いも見えるように）
    const boxes = (t) => [n[t]?.box, o?.[t]?.box];
    if (o) rows.push(rowsOf(o, boxes));
    rows.push(rowsOf(n, boxes));
  });
  const file = join(outDir, `${want.replace(/[\\/:*?"<>|（）\s]/g, '_')}-field.png`);
  writeSheet(rows, file);
  console.log(
    `${file}（列：${TAGS.join('・')}。行：${scenes.map((s) => `深さ ${s.depth}`).join('・')}${old ? '。階ごとに、上が前の版、下が今' : ''}）`,
  );
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ scenes, rev, now, old }, null, 2) + '\n');
if (errs.length) {
  console.log('うまくいかなかった物：', errs);
  process.exitCode = 1;
}
